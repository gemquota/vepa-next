/**
 * VEPA4 — Quantum Macroscale (Set N.1 "Quantum Macroscale", RRP L·M·N trilogy)
 *
 * The third build of the physics frontier, as a world-substrate layer
 * (decision N.1 — no new law slots; the 128-law budget is full). Where Set L
 * changed what matter *is* and Set M changed how space and time behave,
 * Set N makes particles non-classical at the macroscale.
 *
 *   1. SUPERPOSITION (N.1) — a particle in a low-interaction region (slow +
 *      sparse neighbourhood) holds a second position state (qx/qy/qz,
 *      deterministic hash offset). The first interaction — a neighbour within
 *      the collapse radius, a speed burst, or the lifetime expiry — collapses
 *      the pair: a deterministic hash picks which branch is real (keep the
 *      current position or resolve to the alternate one). Journaled as
 *      `quantum:collapse`. Doubles the ghosting for superposed particles.
 *   2. ENTANGLEMENT (N.2) — the existing ENTANGLE stride offsets (75-76) get
 *      macro meaning when the ENTANGLEMENT law is not using them: pairs of
 *      superposed particles within a radius link up (registry + stride
 *      projection). Entangled pairs share ENERGY across distance (richer
 *      donates to poorer, rate-gated) and drag each other's momentum toward
 *      the mean. Measuring one collapses both (the mirror lives in the
 *      collapse path). If the ENTANGLEMENT law takes the stride offset over,
 *      the macro pair breaks cleanly.
 *   3. TUNNELING (N.3) — a high-ENERGY particle pressed against an IMPASSABLE
 *      wall tunnels through with probability TUNNEL_RATE (scaled by
 *      energy / TUNNEL_ENERGY_GATE). The pass walks the axis past the wall
 *      band to the first free cell (thick walls included) and teleports the
 *      particle there, costing energy. The TUNNELING law stays untouched —
 *      this is the macro-probability variant, bounded by ENERGY.
 *   4. OBSERVER (N.4) — species with high SELECTION_SENSITIVITY (DNA 53) or
 *      REGULATORY_DEPTH (DNA 63) observe: proximity collapses nearby
 *      superpositions. Observation is itself a measurement — journaled as
 *      `quantum:observe` and fed into the narrative.
 *
 * Everything is deterministic — no PRNG (hash-gated like Set L).
 */
import { STRIDE_INDEXES, DNA_INDEXES, DNA_RANGES } from '../constants.js';

export const QUANTUM_CADENCE = 15; // frames between passes

const SUPER_RATE_DEFAULT = 0.15;       // entry gate chance
const SUPER_SPREAD_DEFAULT = 25;       // alternate-position offset magnitude
const COLLAPSE_RADIUS_DEFAULT = 30;    // interaction radius that collapses
const ENTANGLE_RATE_DEFAULT = 0.1;     // pair-creation chance
const ENERGY_SHARE_DEFAULT = 0.02;     // energy transfer fraction per pass
const TUNNEL_RATE_DEFAULT = 0.02;      // wall-tunnel probability
const TUNNEL_ENERGY_DEFAULT = 40;      // energy gate for tunneling
const OBSERVER_RADIUS_DEFAULT = 40;    // observer collapse radius

const SUPER_SPEED_GATE = 10;            // below this speed a particle may superpose
const SUPER_NEIGHBOR_RADIUS = 120;      // sparse = fewer than this many alive nearby
const SUPER_NEIGHBOR_MIN = 2;
const SUPER_LIFETIME = 600;             // ticks superposed before forced collapse
const SUPER_MAX_FRACTION = 0.08;        // of count (capped) may be superposed
const SUPER_MAX_ABS = 100;
const SUPER_SCAN = 400;                 // neighbour scan window (entry + collapse)
const ENTANGLE_RADIUS = 80;             // pair-creation radius (world units)
const ENTANGLE_SCAN = 200;              // partner scan window
const ENTANGLE_PAIR_CAP = 40;           // pairs created per pass
const ENTANGLE_DRAG = 0.05;             // momentum pull toward the mean
const TUNNEL_CAP = 12;                  // tunnels per pass
const TUNNEL_ENERGY_COST = 5;           // energy spent per tunnel
const OBSERVE_SENS = 0.5;               // SELECTION_SENSITIVITY observer gate
const OBSERVE_DEPTH = 4;                // REGULATORY_DEPTH observer gate
const OBSERVER_SCAN = 300;              // observer target scan window
const OBSERVER_CAP = 10;                // observer collapses per pass
const COLLAPSE_CAP = 30;                // total collapses per pass

const S = STRIDE_INDEXES;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function num(v, dflt) {
  return Number.isFinite(Number(v)) ? Number(v) : dflt;
}

/** Deterministic 32-bit integer hash of a pair (no PRNG). */
function hash2(a, b) {
  let h = (a * 73856093) ^ (b * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Read a genome-only DNA param (min/max normalized, like laws.js). */
function readDNA(buf, sp, idx) {
  if (!buf) return 0;
  const raw = buf[sp * 64 + idx] || 0;
  const r = DNA_RANGES[idx];
  if (r) return r.min + (raw / 65535) * (r.max - r.min);
  return raw / 65535;
}

/**
 * Fresh quantum-macroscale state. Arrays are indexed by particle id (aligned
 * with the particle buffer) and grow lazily in stepQuantumMacro.
 */
export function createQuantumState(count = 0) {
  return {
    superposed: new Uint8Array(count),  // 1 = holding a second position state
    qx: new Float32Array(count),        // alternate position x
    qy: new Float32Array(count),        // alternate position y
    qz: new Float32Array(count),        // alternate position z
    timer: new Float32Array(count),     // ticks left before forced collapse
    entangled: new Int32Array(count).fill(-1), // macro partner index or -1
    entPhase: new Float32Array(count),  // shared phase (projection, stride 76)
  };
}

/**
 * Clear dead particles: drop superposition and break any entanglement.
 * @returns {number} particles cleaned
 */
function clearDead(state, view, count, stride) {
  let cleaned = 0;
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] < 0.5) continue;
    if (state.superposed[i]) { state.superposed[i] = 0; state.timer[i] = 0; cleaned++; }
    const p = state.entangled[i];
    if (p >= 0) {
      state.entangled[i] = -1;
      state.entPhase[i] = 0;
      if (state.entangled[p] === i) {
        state.entangled[p] = -1;
        state.entPhase[p] = 0;
        view[p * stride + S.ENTANGLE_ID] = -1;
        view[p * stride + S.ENTANGLE_PHASE] = 0;
      }
      view[b + S.ENTANGLE_ID] = -1;
      view[b + S.ENTANGLE_PHASE] = 0;
      cleaned++;
    }
  }
  return cleaned;
}

/**
 * N.1 — enter superposition: slow, isolated particles gain a second position
 * state. Deterministic hash offset for the alternate branch.
 * @returns {number} particles newly superposed
 */
function enterSuperposition(state, view, count, stride, params, res) {
  const rate = num(params.QUANTUM_SUPERPOSITION_RATE, SUPER_RATE_DEFAULT);
  if (!(rate > 0)) return 0;
  const spread = num(params.QUANTUM_SPREAD, SUPER_SPREAD_DEFAULT);
  const maxSuper = Math.min(SUPER_MAX_ABS, Math.max(8, Math.floor(count * SUPER_MAX_FRACTION)));
  const chance = Math.min(1, rate);
  let active = 0;
  for (let i = 0; i < count; i++) active += state.superposed[i] ? 1 : 0;
  let entered = 0;
  for (let i = 0; i < count && active < maxSuper; i++) {
    if (state.superposed[i] || state.entangled[i] >= 0) continue;
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const vx = view[b + S.VEL_X] || 0, vy = view[b + S.VEL_Y] || 0, vz = view[b + S.VEL_Z] || 0;
    if (vx * vx + vy * vy + vz * vz > SUPER_SPEED_GATE * SUPER_SPEED_GATE) continue;
    // Sparse neighbourhood: fewer than SUPER_NEIGHBOR_MIN alive within radius.
    const r2 = SUPER_NEIGHBOR_RADIUS * SUPER_NEIGHBOR_RADIUS;
    let near = 0;
    for (let j = 0; j < count && j < SUPER_SCAN; j++) {
      if (j === i) continue;
      const bj = j * stride;
      if (view[bj + S.DEAD] >= 0.5) continue;
      const dx = view[bj] - view[b], dy = view[bj + 1] - view[b + 1], dz = view[bj + 2] - view[b + 2];
      if (dx * dx + dy * dy + dz * dz <= r2) near++;
      if (near >= SUPER_NEIGHBOR_MIN) break;
    }
    if (near >= SUPER_NEIGHBOR_MIN) continue;
    if (hash2(i, 1) % 1000 >= chance * 1000) continue;
    // Alternate branch: deterministic offset vector from the particle hash.
    const u = hash2(i, 2) / 0xffffffff;      // [0,1)
    const v = hash2(i, 3) / 0xffffffff;
    const ang = u * Math.PI * 2;
    const dirX = Math.cos(ang), dirY = Math.sin(ang), dirZ = v * 2 - 1;
    state.qx[i] = view[b] + dirX * spread;
    state.qy[i] = view[b + 1] + dirY * spread;
    state.qz[i] = view[b + 2] + dirZ * spread;
    state.superposed[i] = 1;
    state.timer[i] = SUPER_LIFETIME;
    active++;
    entered++;
  }
  res.entered = entered;
  return entered;
}

/**
 * Collapse a superposed particle: a deterministic hash picks the real branch
 * (keep the current position or resolve to the alternate one). Measuring one
 * entangled partner collapses both (N.2 mirror).
 * @returns {boolean} whether a collapse happened
 */
function collapseOne(state, view, stride, i, tick, res, cause) {
  if (!state.superposed[i]) return false;
  const b = i * stride;
  const pickAlt = hash2(i, tick) % 2 === 0;
  if (pickAlt) {
    view[b] = state.qx[i];
    view[b + 1] = state.qy[i];
    view[b + 2] = state.qz[i];
  }
  state.superposed[i] = 0;
  state.timer[i] = 0;
  res.collapsed++;
  res.events.push({ type: 'quantum:collapse', particle: i, alt: pickAlt, cause });
  // Measurement collapses an entangled partner too (N.2).
  const p = state.entangled[i];
  if (p >= 0 && state.superposed[p]) {
    const pb = p * stride;
    const pickAltP = hash2(p, tick) % 2 === 0;
    if (pickAltP) {
      view[pb] = state.qx[p];
      view[pb + 1] = state.qy[p];
      view[pb + 2] = state.qz[p];
    }
    state.superposed[p] = 0;
    state.timer[p] = 0;
    res.collapsed++;
    res.events.push({ type: 'quantum:collapse', particle: p, alt: pickAltP, cause: 'entangled-mirror' });
  }
  return true;
}

/**
 * N.1 — natural collapse: interaction (neighbour within radius), a speed
 * burst, or lifetime expiry resolves the superposition. Capped per pass.
 * @returns {number} collapses
 */
function collapseNatural(state, view, count, stride, params, tick, res) {
  const radius = num(params.QUANTUM_COLLAPSE_RADIUS, COLLAPSE_RADIUS_DEFAULT);
  const r2 = radius * radius;
  let collapses = 0;
  for (let i = 0; i < count && collapses < COLLAPSE_CAP; i++) {
    if (!state.superposed[i]) continue;
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    let cause = null;
    const vx = view[b + S.VEL_X] || 0, vy = view[b + S.VEL_Y] || 0, vz = view[b + S.VEL_Z] || 0;
    if (vx * vx + vy * vy + vz * vz > SUPER_SPEED_GATE * SUPER_SPEED_GATE) {
      cause = 'speed';
    } else if (radius > 0) {
      for (let j = 0; j < count && j < SUPER_SCAN; j++) {
        if (j === i) continue;
        const bj = j * stride;
        if (view[bj + S.DEAD] >= 0.5) continue;
        const dx = view[bj] - view[b], dy = view[bj + 1] - view[b + 1], dz = view[bj + 2] - view[b + 2];
        if (dx * dx + dy * dy + dz * dz <= r2) { cause = 'interaction'; break; }
      }
    }
    if (!cause && state.timer[i] > 0) {
      state.timer[i] -= QUANTUM_CADENCE;
      if (state.timer[i] <= 0) cause = 'lifetime';
    }
    if (!cause) continue;
    if (collapseOne(state, view, stride, i, tick, res, cause)) collapses++;
  }
  return collapses;
}

/**
 * N.2 — entanglement bookkeeping: break stale pairs (death / law takeover),
 * share ENERGY across distance, drag momentum toward the mean, and re-assert
 * the stride projection (offsets 75-76) for live pairs.
 * @returns {{shared:number, broken:number}}
 */
function syncEntanglement(state, view, count, stride, params) {
  const shareRate = num(params.QUANTUM_ENERGY_SHARE, ENERGY_SHARE_DEFAULT);
  let shared = 0, broken = 0;
  for (let i = 0; i < count; i++) {
    const p = state.entangled[i];
    if (p < 0) continue;
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5 || view[p * stride + S.DEAD] >= 0.5) {
      // Dead partner — clear both sides.
      state.entangled[i] = -1;
      state.entPhase[i] = 0;
      if (state.entangled[p] === i) { state.entangled[p] = -1; state.entPhase[p] = 0; }
      view[b + S.ENTANGLE_ID] = -1;
      view[b + S.ENTANGLE_PHASE] = 0;
      view[p * stride + S.ENTANGLE_ID] = -1;
      view[p * stride + S.ENTANGLE_PHASE] = 0;
      broken++;
      continue;
    }
    // The ENTANGLEMENT law took the stride offset over → break cleanly.
    if (view[b + S.ENTANGLE_ID] >= 0 && view[b + S.ENTANGLE_ID] !== p) {
      state.entangled[i] = -1;
      state.entPhase[i] = 0;
      if (state.entangled[p] === i) { state.entangled[p] = -1; state.entPhase[p] = 0; }
      if (view[p * stride + S.ENTANGLE_ID] === i) {
        view[p * stride + S.ENTANGLE_ID] = -1;
        view[p * stride + S.ENTANGLE_PHASE] = 0;
      }
      broken++;
      continue;
    }
    // ENERGY sharing across distance (richer → poorer, rate-gated).
    if (shareRate > 0) {
      const ei = view[b + S.ENERGY] || 0;
      const ej = view[p * stride + S.ENERGY] || 0;
      const diff = Math.abs(ei - ej);
      if (diff > 0) {
        const transfer = Math.min(diff, diff * shareRate);
        if (ei > ej) {
          view[b + S.ENERGY] = ei - transfer;
          view[p * stride + S.ENERGY] = ej + transfer;
        } else {
          view[b + S.ENERGY] = ei + transfer;
          view[p * stride + S.ENERGY] = ej - transfer;
        }
        shared++;
      }
      // Momentum drag toward the mean (entanglement is rigid across distance).
      for (let k = 0; k < 3; k++) {
        const vi = view[b + S.VEL_X + k] || 0;
        const vj = view[p * stride + S.VEL_X + k] || 0;
        const mean = (vi + vj) / 2;
        view[b + S.VEL_X + k] = vi + (mean - vi) * ENTANGLE_DRAG;
        view[p * stride + S.VEL_X + k] = vj + (mean - vj) * ENTANGLE_DRAG;
      }
    }
    // Re-assert the stride projection.
    view[b + S.ENTANGLE_ID] = p;
    view[b + S.ENTANGLE_PHASE] = state.entPhase[i];
  }
  return { shared, broken };
}

/**
 * N.2 — pair creation: two superposed, unlinked particles within radius
 * entangle (registry + stride projection), gated by a deterministic hash.
 * @returns {number} pairs created
 */
function entanglePairs(state, view, count, stride, params, tick, res) {
  const rate = num(params.QUANTUM_ENTANGLE_RATE, ENTANGLE_RATE_DEFAULT);
  if (!(rate > 0)) return 0;
  const r2 = ENTANGLE_RADIUS * ENTANGLE_RADIUS;
  const chance = Math.min(1, rate);
  let pairs = 0;
  for (let i = 0; i < count && pairs < ENTANGLE_PAIR_CAP; i++) {
    if (!state.superposed[i] || state.entangled[i] >= 0) continue;
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    if (view[b + S.ENTANGLE_ID] >= 0) continue; // law owns the offset
    for (let j = i + 1; j < count && j < ENTANGLE_SCAN; j++) {
      if (!state.superposed[j] || state.entangled[j] >= 0) continue;
      const bj = j * stride;
      if (view[bj + S.DEAD] >= 0.5) continue;
      if (view[bj + S.ENTANGLE_ID] >= 0) continue;
      const dx = view[bj] - view[b], dy = view[bj + 1] - view[b + 1], dz = view[bj + 2] - view[b + 2];
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      if (hash2(i, j + tick) % 1000 >= chance * 1000) continue;
      const phase = hash2(i, j + 7) / 0xffffffff;
      state.entangled[i] = j;
      state.entangled[j] = i;
      state.entPhase[i] = phase;
      state.entPhase[j] = phase;
      view[b + S.ENTANGLE_ID] = j;
      view[b + S.ENTANGLE_PHASE] = phase;
      view[bj + S.ENTANGLE_ID] = i;
      view[bj + S.ENTANGLE_PHASE] = phase;
      pairs++;
      res.events.push({ type: 'quantum:entangle', a: i, b: j, phase });
      break;
    }
  }
  return pairs;
}

/**
 * N.3 — macro tunneling: a high-ENERGY particle pressed against an IMPASSABLE
 * wall tunnels through with probability TUNNEL_RATE × energy gate. Walks each
 * axis past the wall band to the first free cell. Deterministic hash, capped.
 * @returns {number} tunnels
 */
function applyTunneling(state, view, count, stride, system, params, tick, res) {
  if (!system || !system.hasWalls) return 0;
  const rate = num(params.QUANTUM_TUNNEL_RATE, TUNNEL_RATE_DEFAULT);
  if (!(rate > 0)) return 0;
  const gate = num(params.QUANTUM_TUNNEL_ENERGY, TUNNEL_ENERGY_DEFAULT);
  const { dim, cell } = system;
  const walls = system.walls;
  const chance = Math.min(1, rate);
  let tunneled = 0;
  const axes = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
  ];
  for (let i = 0; i < count && tunneled < TUNNEL_CAP; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const energy = view[b + S.ENERGY] || 0;
    if (energy < TUNNEL_ENERGY_COST) continue;
    if (hash2(i, tick + 5) % 1000 >= chance * Math.min(1, energy / gate) * 1000) continue;
    const cx = clamp(Math.floor(view[b] / cell), 0, dim - 1);
    const cy = clamp(Math.floor(view[b + 1] / cell), 0, dim - 1);
    const cz = clamp(Math.floor(view[b + 2] / cell), 0, dim - 1);
    let resolved = null;
    for (const [dx, dy, dz] of axes) {
      let x = cx + dx, y = cy + dy, z = cz + dz;
      if (x < 0 || x >= dim || y < 0 || y >= dim || z < 0 || z >= dim) continue;
      if (walls[(z * dim + y) * dim + x] === 0) continue; // not pressed on a wall
      // Walk past the wall band to the first free cell.
      let fx = x, fy = y, fz = z;
      let steps = 0;
      while (steps < dim) {
        fx += dx; fy += dy; fz += dz;
        steps++;
        if (fx < 0 || fx >= dim || fy < 0 || fy >= dim || fz < 0 || fz >= dim) break;
        if (walls[(fz * dim + fy) * dim + fx] === 0) { resolved = [fx, fy, fz]; break; }
      }
      if (resolved) break;
    }
    if (!resolved) continue;
    // Teleport to the far side; momentum carries through along the axis.
    const [tx, ty, tz] = resolved;
    view[b] = (tx + 0.5) * cell;
    view[b + 1] = (ty + 0.5) * cell;
    view[b + 2] = (tz + 0.5) * cell;
    view[b + S.ENERGY] = Math.max(0, energy - TUNNEL_ENERGY_COST);
    tunneled++;
    res.events.push({ type: 'quantum:tunnel', particle: i, from: [cx, cy, cz], to: resolved });
  }
  return tunneled;
}

/**
 * N.4 — observer effect: species with high SELECTION_SENSITIVITY or
 * REGULATORY_DEPTH collapse nearby superpositions by observing them.
 * @returns {number} observations
 */
function applyObserver(state, view, count, stride, dnaBuffer, params, tick, res) {
  const radius = num(params.QUANTUM_OBSERVER_RADIUS, OBSERVER_RADIUS_DEFAULT);
  if (!(radius > 0) || !dnaBuffer) return 0;
  const r2 = radius * radius;
  let observed = 0;
  for (let i = 0; i < count && observed < OBSERVER_CAP; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const sens = readDNA(dnaBuffer, view[b + S.SPECIES_ID] || 0, DNA_INDEXES.SELECTION_SENSITIVITY);
    const depth = readDNA(dnaBuffer, view[b + S.SPECIES_ID] || 0, DNA_INDEXES.REGULATORY_DEPTH);
    if (sens < OBSERVE_SENS && depth < OBSERVE_DEPTH) continue;
    for (let j = 0; j < count && j < OBSERVER_SCAN; j++) {
      if (j === i || !state.superposed[j]) continue;
      const bj = j * stride;
      if (view[bj + S.DEAD] >= 0.5) continue;
      const dx = view[bj] - view[b], dy = view[bj + 1] - view[b + 1], dz = view[bj + 2] - view[b + 2];
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      if (collapseOne(state, view, stride, j, tick, res, 'observer')) {
        observed++;
        res.events.push({ type: 'quantum:observe', observer: i, target: j });
      }
      break; // one observation per observer per pass
    }
  }
  return observed;
}

/**
 * One quantum-macroscale pass. Call from the intelligence loop while laws are
 * active. `opts.force` bypasses the cadence gate (tests).
 * @returns {{entered:number, collapsed:number, entangled:number, shared:number,
 *            broken:number, tunneled:number, observed:number, events:Array}}
 */
export function stepQuantumMacro(state, view, count, stride, fieldSystem, opts = {}) {
  const res = { entered: 0, collapsed: 0, entangled: 0, shared: 0, broken: 0, tunneled: 0, observed: 0, events: [] };
  if (!state || !view) return res;
  // Lazy array growth — keep aligned with the particle buffer across spawns.
  if (state.superposed.length < count) {
    const sup = new Uint8Array(count);
    sup.set(state.superposed);
    state.superposed = sup;
    const qx = new Float32Array(count); qx.set(state.qx); state.qx = qx;
    const qy = new Float32Array(count); qy.set(state.qy); state.qy = qy;
    const qz = new Float32Array(count); qz.set(state.qz); state.qz = qz;
    const timer = new Float32Array(count); timer.set(state.timer); state.timer = timer;
    const ent = new Int32Array(count).fill(-1); ent.set(state.entangled); state.entangled = ent;
    const phase = new Float32Array(count); phase.set(state.entPhase); state.entPhase = phase;
  }
  if (!opts.force) {
    const tick = opts.tick ?? 0;
    if (tick % QUANTUM_CADENCE !== 0) return res;
  }
  const tick = opts.tick ?? 0;
  const params = opts.worldParams || {};
  clearDead(state, view, count, stride);
  const sync = syncEntanglement(state, view, count, stride, params);
  res.shared = sync.shared;
  res.broken = sync.broken;
  enterSuperposition(state, view, count, stride, params, res);
  collapseNatural(state, view, count, stride, params, tick, res);
  res.observed = applyObserver(state, view, count, stride, opts.dnaBuffer, params, tick, res);
  res.entangled = entanglePairs(state, view, count, stride, params, tick, res);
  res.tunneled = applyTunneling(state, view, count, stride, fieldSystem, params, tick, res);
  return res;
}

/** Superposition / entanglement counts (for summaries / tests). */
export function quantumSummary(state) {
  const out = { superposed: 0, entangled: 0, pairs: 0 };
  if (!state) return out;
  for (let i = 0; i < state.superposed.length; i++) {
    if (state.superposed[i]) out.superposed++;
    if (state.entangled[i] >= 0) out.entangled++;
  }
  out.pairs = Math.floor(out.entangled / 2);
  return out;
}
