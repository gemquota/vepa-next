/**
 * VEPA4 — Multi-epoch continuity and the regime catalog (sequel Phase 5).
 *
 * Closes two gaps in docs/systems/implementation-gaps.md:
 *   - "Civilization: cumulative culture and multi-group continuity across
 *     member turnover" — nothing measured whether a civilization actually
 *     persisted. `epochEngine` records era boundaries; nothing compared the
 *     world either side of one.
 *   - "Codex ontology: observer-generated regime names with evidence and
 *     confidence" — no observer vocabulary existed.
 *
 * Continuity is computed by sampling an identity fingerprint of the social
 * world at an era boundary and comparing it to the previous sample. A regime is
 * named only from the fingerprint that was actually observed, and always
 * carries its evidence and a confidence, so downstream narration can cite a
 * measurement instead of asserting a story.
 *
 * The fingerprint deliberately reads groups, cultures, kin and polity — never
 * law state. A regime name must describe the society, not the toggles.
 */

import { clamp01, finite } from '../core/numeric.js';

/** Regime names, chosen by observed fingerprint shape rather than by law state. */
export const REGIME_NAMES = Object.freeze({
  THRIVING: 'thriving',
  SETTLED: 'settled',
  STRAINED: 'strained',
  FRAGMENTING: 'fragmenting',
  COLLAPSING: 'collapsing',
  EMPTY: 'empty',
  EMERGENT: 'emergent',
});

/** Minimum evidence before a regime is named at all. */
const MIN_EVIDENCE = 3;

/**
 * Capture a fingerprint of the current social world.
 *
 * Deliberately excludes laws, particle counts and physics metrics: a regime is
 * a description of the society, so it must be derivable from the society.
 */
export function captureContinuityFingerprint(civilization, groupRegistry, options = {}) {
  const groups = groupRegistry && groupRegistry.groups ? groupRegistry.groups : new Map();
  const aliveGroups = [];
  for (const g of groups.values()) {
    const members = g.members ? g.members.size : 0;
    if (members > 0) aliveGroups.push({ id: g.id, members, treasury: g.treasury || 0 });
  }
  const totalMembers = aliveGroups.reduce((s, g) => s + g.members, 0);

  // Culture: symbol pool size and how much of it was inherited vs reinvented.
  let symbols = 0, inherited = 0, invented = 0, cultures = 0;
  for (const id of civilization.cultures.keys()) {
    const rec = civilization.lifecycle.records.get(id);
    if (!rec) continue;
    cultures++;
    symbols += rec.attributes.symbols.length;
    for (const e of Object.values(rec.attributes.ledger || {})) {
      inherited += e.inherited;
      invented += e.invented;
    }
  }

  return {
    tick: finite(options.tick, civilization.tick),
    groups: aliveGroups.length,
    totalMembers,
    cultures,
    symbols,
    inheritedSymbols: inherited,
    reinventedSymbols: invented,
    kinEdges: civilization.kinEdges.size,
    federations: civilization.federations.size,
    polities: civilization.polities.size,
    citizens: civilization.citizenOf.size,
    treasuries: aliveGroups.reduce((s, g) => s + g.treasury, 0),
  };
}

/**
 * Compare two fingerprints and derive continuity + a named regime.
 *
 * @returns {{regime:string, confidence:number, evidence:string[],
 *            continuity:object, rationale:string}}
 */
export function deriveContinuity(previous, current) {
  const evidence = [];
  if (!previous) {
    return {
      regime: REGIME_NAMES.EMERGENT,
      confidence: 0.2,
      evidence: ['first-observation'],
      continuity: { comparable: false },
      rationale: 'First sample; no prior era to compare against.',
    };
  }

  const ratio = (a, b) => (b > 0 ? a / b : (a > 0 ? 1 : 0));
  const dGroups = current.groups - previous.groups;
  const dMembers = current.totalMembers - previous.totalMembers;
  const memberRetention = ratio(current.totalMembers, previous.totalMembers);
  const groupRetention = ratio(current.groups, previous.groups);
  const cultureRetention = ratio(current.inheritedSymbols, previous.inheritedSymbols);
  const inventionRate = current.inheritedSymbols + current.reinventedSymbols > 0
    ? current.reinventedSymbols / (current.inheritedSymbols + current.reinventedSymbols)
    : 0;

  // Institution depth: do polities and federations exist at all, and persist?
  const institutionDepth = current.polities * 2 + current.federations + (current.polities > 0 ? 1 : 0);

  const continuity = {
    comparable: true,
    memberRetention: Math.round(memberRetention * 1000) / 1000,
    groupRetention: Math.round(groupRetention * 1000) / 1000,
    cultureRetention: Math.round(cultureRetention * 1000) / 1000,
    inventionRate: Math.round(inventionRate * 1000) / 1000,
    deltaGroups: dGroups,
    deltaMembers: dMembers,
    institutionDepth,
  };

  // Name the regime from the fingerprint only.
  let regime;
  if (current.groups === 0 || current.totalMembers === 0) {
    regime = REGIME_NAMES.EMPTY;
    evidence.push('no-surviving-groups');
  } else if (memberRetention < 0.5 || dMembers < -1) {
    regime = REGIME_NAMES.COLLAPSING;
    evidence.push(`member-retention-${continuity.memberRetention}`);
  } else if (groupRetention < 0.6 || dGroups < 0) {
    regime = REGIME_NAMES.FRAGMENTING;
    evidence.push(`group-retention-${continuity.groupRetention}`);
  } else if (memberRetention < 0.9 || dMembers < 0 || inventionRate > 0.5) {
    regime = REGIME_NAMES.STRAINED;
    evidence.push('population-or-culture-under-pressure');
  } else if (institutionDepth > 0 && cultureRetention >= 1) {
    regime = REGIME_NAMES.THRIVING;
    evidence.push('institutions-and-culture-persisting');
  } else {
    regime = REGIME_NAMES.SETTLED;
    evidence.push('stable-without-institutions');
  }

  // Confidence rises with how much of the fingerprint actually moved.
  let confidence = 0.3;
  if (previous.totalMembers > 0 && previous.groups > 0) confidence += 0.2;
  if (Math.abs(dMembers) > 1 || Math.abs(dGroups) > 0) confidence += 0.2;
  if (previous.inheritedSymbols > 0 && current.inheritedSymbols > 0) confidence += 0.15;
  if (institutionDepth > 0) confidence += 0.1;
  confidence = Math.round(clamp01(confidence) * 100) / 100;

  return {
    regime,
    confidence,
    evidence,
    continuity,
    rationale: rationaleFor(regime, continuity),
  };
}

function rationaleFor(regime, c) {
  switch (regime) {
    case REGIME_NAMES.EMPTY:
      return 'No group retained any members across the era boundary.';
    case REGIME_NAMES.COLLAPSING:
      return `Membership fell to ${c.memberRetention} of the previous era.`;
    case REGIME_NAMES.FRAGMENTING:
      return `Group count fell to ${c.groupRetention} of the previous era.`;
    case REGIME_NAMES.STRAINED:
      return `Membership ${c.memberRetention < 1 ? 'shrank' : 'held'} while ${(c.inventionRate * 100).toFixed(0)}% of cultural items were reinvented rather than inherited.`;
    case REGIME_NAMES.THRIVING:
      return `All inherited cultural items persisted and ${c.institutionDepth} institution(s) are standing.`;
    default:
      return 'Population and groups held steady with no institutions yet.';
  }
}

/**
 * Create the continuity/regime catalog.
 *
 * The catalog is the observer's memory: one entry per era boundary, bounded,
 * and the only place regime names are ever invented.
 */
export function createContinuityCatalog(options = {}) {
  return {
    entries: [],
    previous: null,
    // `options.cap || 16` would treat an explicit 0 as "unset" and hand back
    // 16 entries, defeating the minimum below. Test for finiteness instead so
    // a caller asking for a tiny catalog actually gets a tiny catalog.
    cap: Math.max(2, Math.floor(Number.isFinite(options.cap) ? options.cap : 16)),
    tick: 0,
  };
}

/**
 * Sample the world at an era boundary, derive continuity, and file a regime
 * entry. Returns the derived record.
 */
export function recordEraContinuity(catalog, civilization, groupRegistry, options = {}) {
  const fingerprint = captureContinuityFingerprint(civilization, groupRegistry, options);
  const derived = deriveContinuity(catalog.previous, fingerprint);
  catalog.tick = fingerprint.tick;

  const entry = {
    era: finite(options.era, catalog.entries.length),
    tick: fingerprint.tick,
    name: options.name || `era-${catalog.entries.length}`,
    regime: derived.regime,
    confidence: derived.confidence,
    evidence: derived.evidence,
    rationale: derived.rationale,
    continuity: derived.continuity,
    fingerprint,
  };
  catalog.entries.push(entry);
  while (catalog.entries.length > catalog.cap) catalog.entries.shift();
  catalog.previous = fingerprint;
  return entry;
}

/** The most recent regime entry, or null. */
export function latestRegime(catalog) {
  return catalog.entries.length ? catalog.entries[catalog.entries.length - 1] : null;
}

/** Aggregate view: how often each regime has been observed. */
export function regimeHistogram(catalog) {
  const hist = {};
  for (const e of catalog.entries) {
    hist[e.regime] = (hist[e.regime] || 0) + 1;
  }
  return { histogram: hist, samples: catalog.entries.length, eras: catalog.entries.map(e => e.era) };
}

/**
 * Whether a regime is well enough evidenced to be narrated as fact. Below the
 * threshold the observer must say it does not know rather than guess.
 */
export function isRegimeWellEvidenced(entry) {
  if (!entry) return false;
  return entry.evidence.length >= MIN_EVIDENCE && entry.confidence >= 0.6;
}
