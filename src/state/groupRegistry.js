/**
 * VEPA4 — Group Registry (Set F.1 "Civilizations", RRP E·F·A trilogy)
 *
 * Groups are the social unit of the dish: a set of particles (unbounded,
 * possibly multi-species) that share a territory, roles and — from F.3 — a
 * treasury. They exist through BOTH paths:
 *
 *   - declared: the player (or a preset) creates a named group for a set of
 *     species; it recruits ungrouped particles of those species on contact.
 *   - detected: emergent clusters form organically from contact thresholds
 *     + DNA (species affinity / signal), persist while they stay dense, and
 *     dissolve on membership collapse (zero alive members) or prolonged
 *     shrink below the minimum.
 *
 * Membership is written onto the particle stride: GROUP_ID (offset 96) and
 * GROUP_ROLE (offset 97: 0 none, 1 leader, 2 forager, 3 builder). The design
 * doc asked for 68/85, but 68 is PHASE_1 (quantum law state) and 85 is
 * CHAOS_STATE_X — the genuinely free reserved tail (96-97) is used instead
 * so no law state is clobbered.
 *
 * The pass runs every SCAN_INTERVAL frames from main.js (like the insight
 * engine) and only while laws are active + matter is moving, so a fresh
 * lawless world stays quiet.
 */
import { STRIDE_INDEXES, DNA_INDEXES } from '../constants.js';

export const GROUP_ROLE_NONE = 0;
export const GROUP_ROLE_LEADER = 1;
export const GROUP_ROLE_FORAGER = 2;
export const GROUP_ROLE_BUILDER = 3;

const CONTACT_RADIUS = 60;       // world units — cluster neighbourhood
const CONTACT_RADIUS_SQ = CONTACT_RADIUS * CONTACT_RADIUS;
const MIN_MEMBERS = 4;           // minimum dense cluster for a group
const DEFAULT_STALE_GRACE = 300; // scans under MIN_MEMBERS before dissolving (opts.staleGrace overrides)
export const SCAN_INTERVAL = 30; // detection cadence (frames)
const MIN_MOTION = 0.05;         // avg particle speed gate (lawless-freeze guard)
const NAMES = ['NEST', 'HIVE', 'PRIDE', 'SWARM', 'COLONY', 'PACK', 'GARDEN', 'FLEET', 'CIRCLE', 'CLAN'];

export function createGroupRegistry() {
  return {
    groups: new Map(), // id → group
    nextId: 1,
    frame: 0,
    events: [],        // drained + emitted by main.js
    tradeLog: [],      // F.3 economy ring (bounded by economy.js)
    craftLog: [],      // Set I — artifact craft/decay ring (bounded by artifacts.js)
  };
}

/** Player-declared group: recruits particles of the given species on contact. */
export function declareGroup(registry, name, speciesIds) {
  const id = registry.nextId++;
  const group = freshGroup(id, name || `GROUP-${id}`, true, new Set(speciesIds));
  registry.groups.set(id, group);
  registry.events.push({ type: 'group:declared', group, reason: 'declared' });
  return group;
}

function freshGroup(id, name, declared, species) {
  return {
    id,
    name,
    declared,
    species, // Set<speciesId> — declared only; emergent groups adopt members as found
    members: new Set(), // Set<particleIndex> (unbounded)
    roles: { leader: 0, forager: 0, builder: 0 },
    cx: 0, cy: 0, cz: 0,
    minX: Infinity, minY: Infinity, minZ: Infinity,
    maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
    age: 0,
    underMinTicks: 0,
    treasury: 0, // F.3 economy
    artifacts: { TOOL: 0, WEAPON: 0, BARRIER: 0 }, // Set I — crafted inventory
    policy: { aggression: 0, openness: 0, migration: 0 }, // Set J — governance vector
    allies: new Set(),   // Set J — allied group ids (shared treasury pooling)
    conflicts: new Map(), // Set J — id → { since, cooldownUntil }
    stability: 1,        // Set J — 0..1 from policy × treasury
    infra: { harvested: 0, grid: 0 }, // Set K — extraction + grid stats
    mega: null,          // Set K — active mega-structure { kind, progress, target }
  };
}

/** Total registered groups (declared + detected). */
export function groupCount(registry) {
  return registry.groups.size;
}

/** Compact summaries for the analytics layer (F.4). */
export function getGroupSummaries(registry) {
  const out = [];
  for (const g of registry.groups.values()) {
    out.push({
      id: g.id,
      name: g.name,
      declared: g.declared,
      members: g.members.size,
      roles: { ...g.roles },
      species: g.species ? g.species.size : 0,
      cx: g.cx, cy: g.cy, cz: g.cz,
      minX: g.minX, minY: g.minY, minZ: g.minZ,
      maxX: g.maxX, maxY: g.maxY, maxZ: g.maxZ,
      treasury: g.treasury,
      artifacts: { ...g.artifacts },
      policy: { ...g.policy },
      allies: [...g.allies],
      stability: g.stability,
      infra: { ...g.infra },
      mega: g.mega ? { ...g.mega } : null,
      age: g.age,
    });
  }
  return out;
}

/**
 * One detection pass. Call every SCAN_INTERVAL frames while the sim runs.
 * @returns {Array<{type, group, reason}>} events for the bus
 */
export function updateGroups(registry, view, count, stride, _dnaBuffer, opts = {}) {
  registry.frame++;
  if (registry.frame % SCAN_INTERVAL !== 0) return registry.events.splice(0);
  registry.events.splice(0);

  // Motion + law gate: a frozen lawless world forms nothing.
  if (!opts.lawActiveCount || opts.lawActiveCount <= 0) return registry.events;

  const S = STRIDE_INDEXES;
  const particles = collectParticles(view, count, stride);

  // Prune dead members from every existing group (also runs on extinction).
  const liveIds = new Set(particles.map((p) => p.i));
  for (const g of registry.groups.values()) {
    for (const m of [...g.members]) {
      if (!liveIds.has(m)) g.members.delete(m);
    }
  }

  if (particles.length === 0) {
    // Everything died: dissolve every group as a collapse.
    for (const g of [...registry.groups.values()]) {
      registry.events.push({ type: 'group:dissolved', group: g, reason: 'collapse' });
      registry.groups.delete(g.id);
    }
    return registry.events;
  }

  let speedSum = 0;
  for (const p of particles) speedSum += p.speed;
  if (speedSum / particles.length < MIN_MOTION) return registry.events;

  // Particles claimed by a declared group THIS pass — the emergent detector
  // must not re-claim them (stride GROUP_ID is stale until the writeback).
  const claimed = new Set();

  // ── Declared groups: seed + recruit ungrouped particles of their species ──
  for (const g of registry.groups.values()) {
    if (!g.declared) continue;
    const memberSet = g.members;
    const candidates = particles.filter(
      (p) => !p.groupId && !claimed.has(p.i) && g.species.has(p.species),
    );
    if (memberSet.size === 0) {
      // Seed from the first qualifying particles (they anchor recruitment).
      for (let k = 0; k < Math.min(MIN_MEMBERS, candidates.length); k++) {
        memberSet.add(candidates[k].i);
        claimed.add(candidates[k].i);
      }
    }
    // Recruit ungrouped particles of the declared species on contact.
    for (const p of candidates) {
      if (memberSet.has(p.i)) continue;
      if (nearAnyMember(view, stride, memberSet, p)) {
        memberSet.add(p.i);
        claimed.add(p.i);
      }
    }
  }

  // ── Emergent detection: dense clusters via a coarse contact grid ──
  const ungrouped = particles.filter((p) => !p.groupId && !claimed.has(p.i));
  const clusters = findDenseClusters(ungrouped, view, stride);
  for (const cluster of clusters) {
    if (!clusterQualifies(cluster)) continue;
    // Persist: merge into an existing emergent group whose centroid is near.
    let target = null;
    for (const g of registry.groups.values()) {
      if (g.declared || g.members.size === 0) continue;
      const d2 = (g.cx - cluster.cx) ** 2 + (g.cy - cluster.cy) ** 2 + (g.cz - cluster.cz) ** 2;
      if (d2 < (CONTACT_RADIUS * 2) ** 2) { target = g; break; }
    }
    if (!target) {
      target = freshGroup(registry.nextId++, NAMES[registry.nextId % NAMES.length], false, new Set());
      registry.groups.set(target.id, target);
      registry.events.push({ type: 'group:formed', group: target, reason: 'emergent' });
    }
    for (const p of cluster.members) {
      if (!p.groupId && !claimed.has(p.i)) {
        target.members.add(p.i);
        claimed.add(p.i);
      }
    }
  }

  // ── Roles + territory + write stride ──
  for (const g of registry.groups.values()) {
    assignRolesAndTerritory(g, view, stride);
    g.age++;
    if (g.members.size === 0) {
      registry.events.push({ type: 'group:dissolved', group: g, reason: 'collapse' });
      registry.groups.delete(g.id);
    } else if (!g.declared && g.members.size < MIN_MEMBERS) {
      g.underMinTicks++;
      if (g.underMinTicks > (opts.staleGrace ?? DEFAULT_STALE_GRACE)) {
        for (const m of g.members) clearGroupFields(view, m, stride);
        registry.events.push({ type: 'group:dissolved', group: g, reason: 'shrink' });
        registry.groups.delete(g.id);
      }
    } else {
      g.underMinTicks = 0;
    }
  }

  // Clear group fields on particles that ended up in no group.
  const memberOf = new Set();
  for (const g of registry.groups.values()) {
    for (const m of g.members) memberOf.add(m);
  }
  for (const p of particles) {
    if (!memberOf.has(p.i)) clearGroupFields(view, p.i, stride);
  }

  return registry.events;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectParticles(view, count, stride) {
  const S = STRIDE_INDEXES;
  const out = [];
  for (let i = 0; i < count; i++) {
    const base = i * stride;
    if (view[base + S.DEAD] >= 0.5) continue;
    if ((view[base + S.MASS] || 0) <= 0) continue;
    const x = view[base + S.POS_X];
    const y = view[base + S.POS_Y];
    const z = view[base + S.POS_Z];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const vx = view[base + S.VEL_X] || 0;
    const vy = view[base + S.VEL_Y] || 0;
    const vz = view[base + S.VEL_Z] || 0;
    const cache = base + S.DNA_CACHE_START;
    const groupId = view[base + S.GROUP_ID] || 0;
    out.push({
      i, x, y, z,
      speed: Math.sqrt(vx * vx + vy * vy + vz * vz),
      species: view[base + S.SPECIES_ID] || 0,
      signal: view[base + S.SIGNAL] || 0,
      memory: view[base + S.MEMORY] || 0,
      energy: view[base + S.ENERGY] || 0,
      affinity: view[cache + DNA_INDEXES.SPECIES_AFFINITY] || 0,
      jitter: view[cache + DNA_INDEXES.JITTER] || 0,
      force: view[cache + DNA_INDEXES.FORCE] || 0,
      stiffness: view[cache + DNA_INDEXES.STIFFNESS] || 0,
      bondAngle: view[cache + DNA_INDEXES.BOND_ANGLE] || 0,
      groupId,
    });
  }
  return out;
}

function nearAnyMember(view, stride, memberSet, p) {
  const S = STRIDE_INDEXES;
  for (const m of memberSet) {
    const base = m * stride;
    const dx = view[base + S.POS_X] - p.x;
    const dy = view[base + S.POS_Y] - p.y;
    const dz = view[base + S.POS_Z] - p.z;
    if (dx * dx + dy * dy + dz * dz < CONTACT_RADIUS_SQ) return true;
  }
  return false;
}

/** Union-find clustering over a coarse contact grid (cell = CONTACT_RADIUS). */
function findDenseClusters(particles, view, stride) {
  const grid = new Map(); // key → particle indices
  const cell = CONTACT_RADIUS;
  const keyOf = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (const p of particles) {
    const k = keyOf(p.x, p.y, p.z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(p);
  }
  const visited = new Set();
  const clusters = [];
  const S = STRIDE_INDEXES;
  for (const p of particles) {
    if (visited.has(p.i)) continue;
    // BFS over neighbouring cells.
    const stack = [p];
    visited.add(p.i);
    const members = [];
    while (stack.length) {
      const q = stack.pop();
      members.push(q);
      const kx = Math.floor(q.x / cell);
      const ky = Math.floor(q.y / cell);
      const kz = Math.floor(q.z / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const bucket = grid.get(`${kx + dx},${ky + dy},${kz + dz}`);
            if (!bucket) continue;
            for (const n of bucket) {
              if (visited.has(n.i)) continue;
              const ddx = n.x - q.x;
              const ddy = n.y - q.y;
              const ddz = n.z - q.z;
              if (ddx * ddx + ddy * ddy + ddz * ddz < CONTACT_RADIUS_SQ) {
                visited.add(n.i);
                stack.push(n);
              }
            }
          }
        }
      }
    }
    if (members.length >= MIN_MEMBERS) {
      let cx = 0, cy = 0, cz = 0;
      for (const m of members) { cx += m.x; cy += m.y; cz += m.z; }
      clusters.push({ members, cx: cx / members.length, cy: cy / members.length, cz: cz / members.length });
    }
  }
  return clusters;
}

/** DNA/signal gate: a cluster forms a group when it is communicative or affine. */
function clusterQualifies(cluster) {
  let aff = 0, sig = 0;
  for (const m of cluster.members) { aff += m.affinity; sig += m.signal; }
  const n = cluster.members.length;
  return aff / n >= 0.3 || sig / n >= 0.2;
}

function assignRolesAndTerritory(group, view, stride) {
  const S = STRIDE_INDEXES;
  const members = [...group.members];
  group.roles.leader = 0;
  group.roles.forager = 0;
  group.roles.builder = 0;
  // Track the distinct species actually in the group (multi-species alliances).
  for (const m of members) group.species.add(view[m * stride + S.SPECIES_ID] || 0);
  if (members.length === 0) {
    group.minX = group.minY = group.minZ = 0;
    group.maxX = group.maxY = group.maxZ = 0;
    group.cx = group.cy = group.cz = 0;
    return;
  }
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let sx = 0, sy = 0, sz = 0;
  // Leadership score: signal + memory + energy (a "voice" in the group).
  const scored = members.map((m) => {
    const base = m * stride;
    const cache = base + S.DNA_CACHE_START;
    const x = view[base + S.POS_X];
    const y = view[base + S.POS_Y];
    const z = view[base + S.POS_Z];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    sx += x; sy += y; sz += z;
    const signal = view[base + S.SIGNAL] || 0;
    const memory = view[base + S.MEMORY] || 0;
    const energy = view[base + S.ENERGY] || 0;
    return {
      m,
      score: signal + memory * 2 + energy / 100,
      stiffness: view[cache + DNA_INDEXES.STIFFNESS] || 0,
      bondAngle: view[cache + DNA_INDEXES.BOND_ANGLE] || 0,
      jitter: view[cache + DNA_INDEXES.JITTER] || 0,
      force: view[cache + DNA_INDEXES.FORCE] || 0,
      speed: Math.hypot(view[base + S.VEL_X] || 0, view[base + S.VEL_Y] || 0, view[base + S.VEL_Z] || 0),
    };
  });
  scored.sort((a, b) => b.score - a.score);
  // Leader: the strongest voice.
  const leader = scored[0];
  view[leader.m * stride + S.GROUP_ROLE] = GROUP_ROLE_LEADER;
  group.roles.leader = 1;
  for (let k = 1; k < scored.length; k++) {
    const s = scored[k];
    let role = GROUP_ROLE_NONE;
    if (s.stiffness > 0.6 || s.bondAngle > 0.5) {
      role = GROUP_ROLE_BUILDER;
      group.roles.builder++;
    } else if (s.jitter + s.force > 0.8 || s.speed > 1) {
      role = GROUP_ROLE_FORAGER;
      group.roles.forager++;
    }
    view[s.m * stride + S.GROUP_ROLE] = role;
  }
  view[leader.m * stride + S.GROUP_ID] = group.id;
  for (const m of members) view[m * stride + S.GROUP_ID] = group.id;
  group.minX = minX; group.minY = minY; group.minZ = minZ;
  group.maxX = maxX; group.maxY = maxY; group.maxZ = maxZ;
  group.cx = sx / members.length;
  group.cy = sy / members.length;
  group.cz = sz / members.length;
}

function clearGroupFields(view, i, stride) {
  view[i * stride + STRIDE_INDEXES.GROUP_ID] = 0;
  view[i * stride + STRIDE_INDEXES.GROUP_ROLE] = GROUP_ROLE_NONE;
}
