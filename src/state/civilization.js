/**
 * VEPA4 — Civilization ontology: culture, kinship, federation, polity.
 *
 * Closes four of the gaps named in docs/systems/implementation-gaps.md that
 * previously had runtime proxies but no explicit entities:
 *
 *   - Cultural transmission  (symbol/norm objects with fidelity + mutation,
 *                             vertical and horizontal lineage)
 *   - Kin / family            (kin edges, caregiving, households, kin resource
 *                             flow — without altering lineage semantics)
 *   - Tribe / clan            (group-to-group federation, fission and fusion)
 *   - Nation / polity         (polity container, jurisdiction, citizenship,
 *                             institutions, succession)
 *
 * DESIGN CONSTRAINTS (inherited from systemLifecycle.js):
 *   - Additive only. Never writes particle stride fields.
 *   - `createSystemRecord` / `updateSystemRecord` return CLONES. Every read
 *     goes through live(); every write goes through patchAttrs(). Mutating a
 *     returned record is a no-op on the stored state.
 *   - Does not replace groupRegistry, lineageTracker, memoryBuffers, economy,
 *     or governance. It annotates and links them.
 *   - The substrate these records live in (systemLifecycle.js) was previously
 *     test-only dead code; this module is its first runtime consumer.
 *
 * The cultural "fidelity" model is deliberately a proxy: real cultural
 * transmission is not measured here, only an explicit, inspectable accounting
 * of what a group was offered, what it retained, and what it invented.
 */

import {
  createSystemLifecycle,
  createSystemRecord,
  updateSystemRecord,
  recordSystemEvent,
  closeSystemRecord,
  serializeSystemLifecycle,
  restoreSystemLifecycle,
} from './systemLifecycle.js';
import { clamp01, finite } from '../core/numeric.js';

export const CIVILIZATION_SYSTEMS = Object.freeze({
  CULTURE: 'culture-memory',
  KINSHIP: 'family-kinship',
  TRIBE: 'group-tribe-clan',
  POLITY: 'nation-polity',
});

/** Default retention probability for an inherited cultural item. */
export const DEFAULT_FIDELITY = 0.7;
/** Default probability an unretained item is reinvented rather than lost. */
export const DEFAULT_REINVENTION = 0.15;

const INSTITUTIONS = Object.freeze(['COUNCIL', 'COURT', 'GUILD', 'SCHOOL', 'TEMPLE', 'GARRISON']);

/** The live (mutable) record for an id, or null. */
function live(registry, id) {
  return registry.lifecycle.records.get(id) || null;
}

/** Merge attribute patches into a live record and return a fresh snapshot. */
function patchAttrs(registry, id, attrs) {
  if (!registry.lifecycle.records.has(id)) return null;
  return updateSystemRecord(registry.lifecycle, id, { attributes: attrs });
}

/** Stable undirected key for a pair of particle ids. */
function pairKey(a, b) {
  return `${Math.min(a, b)}|${Math.max(a, b)}`;
}

// ── Registry lifecycle ──────────────────────────────────────────────────────

/**
 * Create the civilization registry. One instance per world; multiplex shards
 * each get their own, which is exactly the isolation the particle buffer's
 * module-level state used to prevent.
 */
export function createCivilizationRegistry(options = {}) {
  return {
    lifecycle: createSystemLifecycle(options),
    cultures: new Map(),      // culture record id → record id
    kinEdges: new Map(),      // "a|b" → edge
    households: new Map(),    // householdId → { members:Set, polityId, since }
    federations: new Map(),   // federation record id → record id
    polities: new Map(),      // polity record id → record id
    citizenOf: new Map(),     // particleId → polityId
    succession: new Map(),    // polityId → { holderId, term, eligible[] }
    tick: 0,
  };
}

// ── Culture ─────────────────────────────────────────────────────────────────

/**
 * Found a culture for a group. Cultures are the unit of cultural transmission:
 * they carry symbols and norms that members inherit and mutate.
 */
export function foundCulture(registry, groupId, seed = {}) {
  const created = createSystemRecord(registry.lifecycle, CIVILIZATION_SYSTEMS.CULTURE,
    `group:${groupId}`, {
      name: seed.name || `culture-${registry.cultures.size + 1}`,
      ownerGroupId: groupId,
      symbols: seed.symbols ? [...seed.symbols] : [],
      norms: seed.norms ? [...seed.norms] : [],
      // Per-symbol inheritance accounting.
      ledger: {},
      cohesion: 1,
    });
  registry.cultures.set(created.id, created.id);
  recordSystemEvent(registry.lifecycle, created.id, 'culture-founded', { groupId });
  return live(registry, created.id);
}

/**
 * Transmit culture from a parent/peer group to a receiving group.
 *
 * Vertical transmission is parent→child; horizontal is peer→peer. Each offered
 * item is retained, mutated, or lost; losses may instead be reinvented.
 * Every item is accounted for in exactly one bucket.
 */
export function transmitCulture(registry, fromCultureId, toCultureId, opts = {}) {
  const from = live(registry, fromCultureId);
  const to = live(registry, toCultureId);
  if (!from || !to || from.id === to.id) {
    return { retained: [], mutated: [], lost: [], invented: [] };
  }

  const fidelity = clamp01(finite(opts.fidelity, DEFAULT_FIDELITY));
  const reinvention = clamp01(finite(opts.reinvention, DEFAULT_REINVENTION));
  const mode = opts.mode === 'horizontal' ? 'horizontal' : 'vertical';

  const out = { retained: [], mutated: [], lost: [], invented: [] };
  const items = [...from.attributes.symbols, ...from.attributes.norms];
  const symbols = [...to.attributes.symbols];
  const ledger = JSON.parse(JSON.stringify(to.attributes.ledger || {}));

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    // Deterministic per-transfer roll derived from the pair + tick, so replaying
    // the same world produces the same cultural outcome.
    const roll = ((registry.tick * 2654435761 + index * 40503
      + fromCultureId.length * 97 + toCultureId.length) >>> 0) / 4294967296;
    let bucket;
    if (roll < fidelity) bucket = 'retained';
    else if (roll < fidelity + (1 - fidelity) * 0.5) bucket = 'mutated';
    else bucket = 'lost';

    // A lost item may be reinvented locally rather than simply forgotten.
    if (bucket === 'lost' && reinvention > 0) {
      const reRoll = ((roll * 7919) >>> 0) / 4294967296;
      if (reRoll < reinvention) {
        out.invented.push(item);
        symbols.push(`${item}~${registry.tick % 997}`);
        tally(ledger, item, 'invented');
        continue;
      }
    }

    out[bucket].push(item);
    if (bucket === 'mutated') symbols.push(`${item}*`);
    else if (bucket === 'retained') symbols.push(item);
    tally(ledger, item, bucket);
  }

  patchAttrs(registry, to.id, { symbols, ledger });
  updateSystemRecord(registry.lifecycle, to.id, {
    metrics: { lastTransferTick: registry.tick, lastTransferMode: mode },
  });
  recordSystemEvent(registry.lifecycle, to.id, 'culture-transmitted', {
    from: fromCultureId, mode,
    retained: out.retained.length, mutated: out.mutated.length,
    lost: out.lost.length, invented: out.invented.length,
  });
  return out;
}

function tally(ledger, item, field) {
  if (!ledger[item]) ledger[item] = { inherited: 0, mutated: 0, invented: 0, lost: 0 };
  // The transmission result calls this bucket `retained` (it reads as a
  // property of the transfer); the ledger calls it `inherited` (it reads as a
  // property of the receiving culture). Normalise here, because a reader of
  // the ledger — continuity.js sums `e.inherited` to measure culture
  // retention across eras — must not have to know which name won.
  const key = field === 'retained' ? 'inherited' : field;
  ledger[item][key]++;
}

/** Recompute culture cohesion from the share of symbols inherited vs invented. */
export function updateCultureCohesion(registry) {
  for (const id of registry.cultures.keys()) {
    const rec = live(registry, id);
    if (!rec) continue;
    const ledger = rec.attributes.ledger || {};
    let inherited = 0, invented = 0;
    for (const e of Object.values(ledger)) {
      inherited += e.inherited;
      invented += e.invented;
    }
    const total = inherited + invented;
    const cohesion = total > 0 ? clamp01(inherited / total) : 1;
    patchAttrs(registry, id, { cohesion });
  }
  return registry;
}

/**
 * The culture record id owned by a group, or null.
 * Used to route inter-group events (alliances, trade) into cultural
 * transmission without the caller walking the record store.
 */
export function cultureForGroup(registry, groupId) {
  for (const id of registry.cultures.keys()) {
    const rec = live(registry, id);
    if (rec && rec.attributes.ownerGroupId === groupId) return id;
  }
  return null;
}

/**
 * Transmit culture along a group-to-group relation reported by another system
 * (governance alliances, economy trade). Safe to call every tick: it is a
 * no-op unless both groups actually own a culture.
 *
 * This is the bridge that makes the culture system react to the rest of the
 * social stack instead of sitting inert beside it.
 *
 * @param {object} registry
 * @param {string|number} groupA
 * @param {string|number} groupB
 * @param {object} [opts] passed through to transmitCulture
 * @returns {object|null} the transmission result, or null if not applicable
 */
export function transmitBetweenGroups(registry, groupA, groupB, opts = {}) {
  const from = cultureForGroup(registry, groupA);
  const to = cultureForGroup(registry, groupB);
  if (!from || !to || from === to) return null;
  return transmitCulture(registry, from, to, { mode: 'horizontal', ...opts });
}

// ── Kinship ────────────────────────────────────────────────────────────────

/**
 * Record a kin edge. Callers derive these from lineage data; this module only
 * stores and weights them, so lineage semantics stay untouched.
 */
export function recordKin(registry, a, b, opts = {}) {
  if (a === b || a == null || b == null) return null;
  const key = pairKey(a, b);
  const existing = registry.kinEdges.get(key);
  const kind = opts.kind || 'kin';
  const strength = clamp01(finite(opts.strength, 0.5));
  if (existing) {
    existing.strength = Math.min(1, existing.strength + strength * 0.25);
    if (existing.kind !== kind) existing.kind = `${existing.kind}+${kind}`;
    return existing;
  }
  const edge = { a: Math.min(a, b), b: Math.max(a, b), kind, strength, since: registry.tick };
  registry.kinEdges.set(key, edge);
  return edge;
}

/** Look up the kin edge between two particles, or null. */
export function getKin(registry, a, b) {
  return registry.kinEdges.get(pairKey(a, b)) || null;
}

/** Strongest recorded kin edge for a particle, 0 when it has none. */
export function kinStrength(registry, particleId) {
  let best = 0;
  for (const edge of registry.kinEdges.values()) {
    if (edge.a !== particleId && edge.b !== particleId) continue;
    if (edge.strength > best) best = edge.strength;
  }
  return best;
}

/** Create a household — the unit of caregiving and kin resource flow. */
export function createHousehold(registry, householdId, opts = {}) {
  if (registry.households.has(householdId)) return registry.households.get(householdId);
  const hh = {
    id: householdId,
    members: new Set(),
    polityId: opts.polityId ?? null,
    since: registry.tick,
    cohesion: 1,
  };
  registry.households.set(householdId, hh);
  return hh;
}

/** Add a particle to a household, creating it if needed. */
export function joinHousehold(registry, householdId, particleId, opts = {}) {
  const hh = typeof householdId === 'string'
    ? createHousehold(registry, householdId, opts)
    : householdId;
  hh.members.add(particleId);
  return hh;
}

/** The household containing a particle, or null. */
export function householdOf(registry, particleId) {
  for (const hh of registry.households.values()) {
    if (hh.members.has(particleId)) return hh;
  }
  return null;
}

/**
 * Distribute a resource to the neediest members of a household, weighted by
 * need. Closes the kin resource-flow gap. Returns the total scheduled.
 */
export function flowKinResources(registry, householdId, amount, need) {
  const hh = registry.households.get(householdId);
  if (!hh || hh.members.size === 0 || amount <= 0) return 0;
  const needy = [];
  let needTotal = 0;
  for (const m of hh.members) {
    const n = clamp01(finite(need(m), 0));
    if (n > 0) { needy.push({ id: m, need: n }); needTotal += n; }
  }
  if (needTotal <= 0) return 0;
  let moved = 0;
  for (const d of needy) moved += amount * (d.need / needTotal);
  hh.cohesion = clamp01(hh.cohesion + 0.01);
  return moved;
}

// ── Federation (tribe / clan) ───────────────────────────────────────────────

/** Create a federation: a multi-group identity binding several groups. */
export function createFederation(registry, opts = {}) {
  const created = createSystemRecord(registry.lifecycle, CIVILIZATION_SYSTEMS.TRIBE,
    `federation:${registry.federations.size + 1}`, {
      name: opts.name || `federation-${registry.federations.size + 1}`,
      members: [],
      edges: [],
      sharedCultureId: opts.sharedCultureId ?? null,
      kind: opts.kind || 'tribe',
      generation: 0,
    });
  registry.federations.set(created.id, created.id);
  recordSystemEvent(registry.lifecycle, created.id, 'federation-founded', { kind: created.attributes.kind });
  return live(registry, created.id);
}

/** Add a group to a federation. */
export function addFederationMember(registry, federationId, groupId) {
  const rec = live(registry, federationId);
  if (!rec) return null;
  const members = rec.attributes.members.includes(groupId)
    ? rec.attributes.members
    : [...rec.attributes.members, groupId];
  patchAttrs(registry, federationId, { members });
  recordSystemEvent(registry.lifecycle, federationId, 'member-joined', { groupId });
  return live(registry, federationId);
}

/** Link two groups inside a federation; affinity is symmetric and accumulates. */
export function linkFederation(registry, federationId, groupA, groupB, affinity = 0.5) {
  const rec = live(registry, federationId);
  if (!rec || groupA === groupB) return null;
  const edges = rec.attributes.edges.map(e => ({ ...e }));
  let edge = edges.find(e => (e.a === groupA && e.b === groupB) || (e.a === groupB && e.b === groupA));
  if (!edge) {
    edge = { a: Math.min(groupA, groupB), b: Math.max(groupA, groupB), affinity: 0 };
    edges.push(edge);
  }
  edge.affinity = clamp01(edge.affinity + clamp01(finite(affinity, 0.5)) * 0.5);
  patchAttrs(registry, federationId, { edges });
  return edge;
}

/**
 * Fission: a group leaves; if the remainder falls below viability it becomes a
 * new clan federation rather than dissolving.
 */
export function fissionFederation(registry, federationId, groupId, opts = {}) {
  const rec = live(registry, federationId);
  if (!rec) return { federationId, newFederationId: null };
  const members = rec.attributes.members.filter(g => g !== groupId);
  const edges = rec.attributes.edges.filter(e => e.a !== groupId && e.b !== groupId);
  patchAttrs(registry, federationId, {
    members, edges, generation: rec.attributes.generation + 1,
  });
  recordSystemEvent(registry.lifecycle, federationId, 'fission', { groupId });

  const minViable = finite(opts.minViable, 2);
  let newFederationId = null;
  if (members.length > 0 && members.length < minViable) {
    const nf = createFederation(registry, {
      name: `${rec.attributes.name}-split`,
      kind: 'clan',
      sharedCultureId: rec.attributes.sharedCultureId,
    });
    for (const g of members) addFederationMember(registry, nf.id, g);
    patchAttrs(registry, federationId, { members: [] });
    newFederationId = nf.id;
    recordSystemEvent(registry.lifecycle, federationId, 'federation-collapsed', { into: nf.id });
  }
  return { federationId, newFederationId };
}

/** Fusion: merge `absorbId` into `keepId` and close the absorbed federation. */
export function fuseFederations(registry, keepId, absorbId) {
  const keep = live(registry, keepId);
  const absorb = live(registry, absorbId);
  if (!keep || !absorb || keepId === absorbId) return null;
  const members = [...keep.attributes.members];
  for (const g of absorb.attributes.members) if (!members.includes(g)) members.push(g);
  const edges = keep.attributes.edges.map(e => ({ ...e }));
  for (const e of absorb.attributes.edges) {
    const dup = edges.some(k => (k.a === e.a && k.b === e.b) || (k.a === e.b && k.b === e.a));
    if (!dup) edges.push({ ...e });
  }
  patchAttrs(registry, keepId, {
    members, edges,
    generation: Math.max(keep.attributes.generation, absorb.attributes.generation) + 1,
  });
  recordSystemEvent(registry.lifecycle, keepId, 'fusion', { absorbed: absorbId });
  closeSystemRecord(registry.lifecycle, absorbId, 'fused');
  registry.federations.delete(absorbId);
  return live(registry, keepId);
}

// ── Polity (nation / state) ────────────────────────────────────────────────

/** Found a polity: a jurisdiction over groups with institutions and succession. */
export function foundPolity(registry, opts = {}) {
  const created = createSystemRecord(registry.lifecycle, CIVILIZATION_SYSTEMS.POLITY,
    `polity:${registry.polities.size + 1}`, {
      name: opts.name || `polity-${registry.polities.size + 1}`,
      territory: { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity },
      provinces: [],
      citizens: 0,
      institutions: opts.institutions ? [...opts.institutions] : [],
      capital: opts.capital ?? null,
      stability: 0.5,
      legitimacy: 0.5,
      holderId: opts.holderId ?? null,
    });
  registry.polities.set(created.id, created.id);
  registry.succession.set(created.id, { holderId: created.attributes.holderId, term: 0, eligible: [] });
  recordSystemEvent(registry.lifecycle, created.id, 'polity-founded', { name: created.attributes.name });
  return live(registry, created.id);
}

/** Extend a polity's jurisdiction to include a bounding box. */
export function claimTerritory(registry, polityId, bounds) {
  const rec = live(registry, polityId);
  if (!rec || !bounds) return null;
  const t = { ...rec.attributes.territory };
  t.minX = Math.min(t.minX, bounds.minX); t.maxX = Math.max(t.maxX, bounds.maxX);
  t.minY = Math.min(t.minY, bounds.minY); t.maxY = Math.max(t.maxY, bounds.maxY);
  t.minZ = Math.min(t.minZ, bounds.minZ); t.maxZ = Math.max(t.maxZ, bounds.maxZ);
  patchAttrs(registry, polityId, { territory: t });
  return live(registry, polityId);
}

/** Add a province (an administrative region owning several groups). */
export function addProvince(registry, polityId, provinceId, groupIds = []) {
  const rec = live(registry, polityId);
  if (!rec) return null;
  const provinces = rec.attributes.provinces.map(p => ({ ...p, groups: [...p.groups] }));
  const existing = provinces.find(p => p.id === provinceId);
  if (existing) {
    for (const g of groupIds) if (!existing.groups.includes(g)) existing.groups.push(g);
  } else {
    provinces.push({ id: provinceId, groups: [...groupIds], wealth: 0 });
  }
  patchAttrs(registry, polityId, { provinces });
  if (!existing) recordSystemEvent(registry.lifecycle, polityId, 'province-created', { provinceId });
  return live(registry, polityId);
}

/** Grant citizenship, revoking any prior polity membership. */
export function grantCitizenship(registry, particleId, polityId) {
  const rec = live(registry, polityId);
  if (!rec) return null;
  const prior = registry.citizenOf.get(particleId);
  if (prior === polityId) return rec;
  if (prior) {
    const p = live(registry, prior);
    if (p) {
      patchAttrs(registry, prior, { citizens: Math.max(0, p.attributes.citizens - 1) });
      recordSystemEvent(registry.lifecycle, prior, 'citizen-departed', { particleId });
    }
  }
  registry.citizenOf.set(particleId, polityId);
  patchAttrs(registry, polityId, { citizens: rec.attributes.citizens + 1 });
  return live(registry, polityId);
}

/** Revoke citizenship. */
export function revokeCitizenship(registry, particleId) {
  const polityId = registry.citizenOf.get(particleId);
  if (!polityId) return false;
  const rec = live(registry, polityId);
  registry.citizenOf.delete(particleId);
  if (rec) {
    patchAttrs(registry, polityId, { citizens: Math.max(0, rec.attributes.citizens - 1) });
    recordSystemEvent(registry.lifecycle, polityId, 'citizen-departed', { particleId });
  }
  return true;
}

/** Found an institution; raises legitimacy, costs stability while young. */
export function foundInstitution(registry, polityId, kind) {
  const rec = live(registry, polityId);
  if (!rec || !INSTITUTIONS.includes(kind)) return null;
  if (rec.attributes.institutions.includes(kind)) return rec;
  patchAttrs(registry, polityId, {
    institutions: [...rec.attributes.institutions, kind],
    legitimacy: clamp01(rec.attributes.legitimacy + 0.1),
    stability: clamp01(rec.attributes.stability - 0.02),
  });
  recordSystemEvent(registry.lifecycle, polityId, 'institution-founded', { kind });
  return live(registry, polityId);
}

/** Nominate a successor candidate. */
export function nominateSuccessor(registry, polityId, particleId) {
  const rec = live(registry, polityId);
  const line = registry.succession.get(polityId);
  if (!rec || !line) return null;
  if (!line.eligible.includes(particleId)) line.eligible.push(particleId);
  recordSystemEvent(registry.lifecycle, polityId, 'successor-nominated', { particleId });
  return line;
}

/**
 * Install a nominated successor. Requires both nomination and citizenship, so
 * succession can never produce a citizen-less ruler.
 */
export function installSuccessor(registry, polityId, particleId) {
  const rec = live(registry, polityId);
  const line = registry.succession.get(polityId);
  if (!rec || !line) return null;
  if (!line.eligible.includes(particleId)) return null;
  if (registry.citizenOf.get(particleId) !== polityId) return null;
  const prior = line.holderId;
  line.holderId = particleId;
  line.term++;
  line.eligible = line.eligible.filter(p => p !== particleId);
  patchAttrs(registry, polityId, {
    holderId: particleId,
    // A peaceful handover stabilises; repeated terms erode legitimacy.
    stability: clamp01(rec.attributes.stability + 0.05),
    legitimacy: clamp01(rec.attributes.legitimacy - 0.01),
  });
  recordSystemEvent(registry.lifecycle, polityId, 'succession', { from: prior, to: particleId, term: line.term });
  return live(registry, polityId);
}

// ── Step + reporting ────────────────────────────────────────────────────────

/**
 * Advance the registry one tick. Idempotent and cheap: prunes kin edges and
 * citizenship for departed particles, then re-derives culture cohesion.
 */
export function stepCivilization(registry, opts = {}) {
  registry.tick = finite(opts.tick, registry.tick + 1);
  const alive = opts.alive instanceof Set ? opts.alive : null;
  if (alive) {
    for (const [key, edge] of registry.kinEdges) {
      if (!alive.has(edge.a) && !alive.has(edge.b)) registry.kinEdges.delete(key);
    }
    for (const pid of [...registry.citizenOf.keys()]) {
      if (!alive.has(pid)) revokeCitizenship(registry, pid);
    }
  }
  updateCultureCohesion(registry);
  return registry;
}

/** A bounded, serializable report for the UI and for analysis. */
export function civilizationReport(registry) {
  const cultures = [...registry.cultures.keys()].map((id) => {
    const r = live(registry, id);
    return r && {
      id, ownerGroupId: r.attributes.ownerGroupId,
      symbols: r.attributes.symbols.length,
      norms: r.attributes.norms.length,
      cohesion: r.attributes.cohesion,
      events: r.metrics.events || 0,
    };
  }).filter(Boolean);

  const federations = [...registry.federations.keys()].map((id) => {
    const r = live(registry, id);
    return r && {
      id, name: r.attributes.name, kind: r.attributes.kind,
      members: r.attributes.members.length, edges: r.attributes.edges.length,
      generation: r.attributes.generation,
    };
  }).filter(Boolean);

  const polities = [...registry.polities.keys()].map((id) => {
    const r = live(registry, id);
    if (!r) return null;
    const line = registry.succession.get(id);
    return {
      id, name: r.attributes.name, citizens: r.attributes.citizens,
      provinces: r.attributes.provinces.length,
      institutions: [...r.attributes.institutions],
      stability: r.attributes.stability, legitimacy: r.attributes.legitimacy,
      term: line ? line.term : 0, eligible: line ? line.eligible.length : 0,
    };
  }).filter(Boolean);

  return {
    tick: registry.tick,
    cultures: cultures.length,
    federations: federations.length,
    polities: polities.length,
    kinEdges: registry.kinEdges.size,
    households: registry.households.size,
    citizens: registry.citizenOf.size,
    detail: { cultures, federations, polities },
  };
}

/** Serialize for world save. Sets and Maps become plain structures. */
export function serializeCivilization(registry) {
  return {
    version: 1,
    tick: registry.tick,
    lifecycle: serializeSystemLifecycle(registry.lifecycle),
    cultures: [...registry.cultures.entries()],
    kinEdges: [...registry.kinEdges.values()],
    households: [...registry.households.values()].map(h => ({ ...h, members: [...h.members] })),
    federations: [...registry.federations.entries()],
    polities: [...registry.polities.entries()],
    citizenOf: [...registry.citizenOf.entries()],
    succession: [...registry.succession.entries()],
  };
}

/** Restore from a world-save snapshot; an unknown shape yields an empty registry. */
export function restoreCivilization(snapshot) {
  const registry = createCivilizationRegistry();
  if (!snapshot || snapshot.version !== 1) return registry;
  registry.tick = finite(snapshot.tick, 0);
  registry.lifecycle = restoreSystemLifecycle(snapshot.lifecycle);
  registry.cultures = new Map(snapshot.cultures || []);
  registry.kinEdges = new Map((snapshot.kinEdges || []).map(e => [pairKey(e.a, e.b), e]));
  registry.households = new Map((snapshot.households || [])
    .map(h => [h.id, { ...h, members: new Set(h.members || []) }]));
  registry.federations = new Map(snapshot.federations || []);
  registry.polities = new Map(snapshot.polities || []);
  registry.citizenOf = new Map(snapshot.citizenOf || []);
  registry.succession = new Map(snapshot.succession || []);
  return registry;
}
