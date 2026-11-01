/**
 * VEPA4 — Exotic Matter (Set L.1 "Exotic Matter", RRP L·M·N trilogy)
 *
 * The physics frontier, as a world-substrate layer (decision L.1 — no new law
 * slots, the 128-law budget is full). Exotic zones are field-encoded regions
 * of the new EXOTIC scalar field (magnitude = zone kind: 1 ANTIMATTER,
 * 2 DARK, 3 STRANGE, 4 NEGATIVE). Particles inside a zone are tagged with a
 * parallel per-particle matter-state array (memoryBuffers alignment
 * discipline) that persists briefly after leaving (half-life decay, L.5).
 *
 *   1. ZONES       — deterministic placement (no PRNG, like buildWells);
 *                    zones are re-asserted into the EXOTIC field each pass to
 *                    counter the ambient decay/diffusion, with a hard write
 *                    cap (design risk L.1 — no griefing).
 *   2. ANNIHILATION (L.2) — antimatter + normal matter within a radius
 *                    annihilate: the two ENERGY pools burst into the THERMAL
 *                    field at the midpoint (energy in = energy out), the
 *                    antimatter particle dies and the normal one is destroyed
 *                    by energy loss. Capped per pass (no annihilation storms).
 *   3. DARK (L.3)   — dark particles are dim (ALPHA) and self-powered (a small
 *                    ENERGY floor) — the ghost matter of the dish.
 *   4. STRANGE (L.4) — strange particles convert normal neighbours within
 *                    range at EXOTIC_STRANGE_RATE (deterministic integer hash
 *                    — no PRNG); converted particles gain mass (slow +
 *                    predation-resistant proxy). Capped per pass.
 *   5. NEGATIVE (L.5) — negative-mass particles feel inverted gravity: a
 *                    velocity nudge up the local THERMAL+INFO density gradient
 *                    (away from mass concentrations). Well under the physics
 *                    clamps (MAX_FORCE/MAX_VELOCITY).
 *
 * Everything is deterministic — no PRNG.
 */
import { STRIDE_INDEXES } from '../constants.js';
import { writeField } from '../physics/fields.js';

export const EXOTIC_CADENCE = 15; // frames between passes
export const EXOTIC_KINDS = { ANTIMATTER: 1, DARK: 2, STRANGE: 3, NEGATIVE: 4 };
export const EXOTIC_KIND_NAMES = ['', 'ANTIMATTER', 'DARK', 'STRANGE', 'NEGATIVE'];

const ZONE_COUNT_DEFAULT = 3;         // zones seeded at world start (0 = off)
const ZONE_SIZE_DEFAULT = 2;          // zone radius in cells
const ANNIHILATE_RADIUS_DEFAULT = 8;  // world units
const STRANGE_RATE_DEFAULT = 0.02;    // conversion chance per candidate
const NEGATIVE_STRENGTH_DEFAULT = 1;  // anti-gravity nudge scale
const HALF_LIFE_DEFAULT = 20;         // tagged ticks after leaving a zone

const ANNIHILATE_CAP = 8;             // pairs per pass (risk L.2)
const ANNIHILATE_SCAN = 400;          // partner scan window per antimatter particle
const STRANGE_CAP = 6;                // conversions per pass (risk L.3)
const STRANGE_SCAN = 200;             // partner scan window per strange particle
const STRANGE_RANGE = 60;             // conversion radius (world units)
const STRANGE_MASS_MULT = 1.5;        // mass gain on conversion
const STRANGE_MASS_CAP = 8;           // converted mass ceiling (below STAR_MASS 12)
const DARK_ALPHA = 0.25;              // dim render
const DARK_ENERGY_FLOOR = 10;         // self-powered floor
const NEGATIVE_K = 0.02;              // nudge scale (well under MAX_FORCE)
const MAX_ZONE_WRITES = 1600;         // griefing cap for zone re-assertion

const S = STRIDE_INDEXES;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function num(v, dflt) {
  return Number.isFinite(Number(v)) ? Number(v) : dflt;
}

/** Combined THERMAL+INFO density at a cell index (mass proxy for anti-gravity). */
function densityAt(therm, info, i) {
  return (therm[i] || 0) + (info[i] || 0);
}

/** Deterministic 32-bit integer hash of a particle pair (no PRNG). */
function hash2(a, b) {
  let h = (a * 73856093) ^ (b * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Fresh exotic-matter state. Arrays are indexed by particle id (aligned with
 * the particle buffer) and grow lazily in stepExoticMatter when the particle
 * count exceeds the allocated length.
 */
export function createExoticState(count = 0) {
  return {
    state: new Uint8Array(count),   // 0 = normal, 1-4 = exotic kind
    timer: new Float32Array(count), // remaining tagged ticks
    zones: [],                      // seeded zone descriptors
    seeded: false,
    seedCount: -1,
    seedSize: -1,
  };
}

/**
 * (Re)seed zone descriptors when EXOTIC_COUNT / EXOTIC_ZONE_SIZE change.
 * Deterministic formulaic placement (angles + modular z, like buildWells /
 * buildPortals) — no PRNG. Zone kind cycles 1→2→3→4 by zone index.
 * @returns {Array} the zone list
 */
export function seedExoticZones(state, system, params = {}) {
  const count = clamp(Math.round(num(params.EXOTIC_COUNT, ZONE_COUNT_DEFAULT)), 0, 16);
  const size = clamp(Math.round(num(params.EXOTIC_ZONE_SIZE, ZONE_SIZE_DEFAULT)), 1, 4);
  if (state.seeded && state.seedCount === count && state.seedSize === size) return state.zones;
  state.zones = [];
  if (count > 0 && system) {
    const { dim } = system;
    const mid = (dim - 1) / 2;
    const radius = Math.max(1, dim * 0.3);
    for (let k = 0; k < count; k++) {
      const ang = (k / count) * Math.PI * 2 + 0.7;
      const cx = clamp(Math.round(mid + Math.cos(ang) * radius), 1, dim - 2);
      const cy = clamp(Math.round(mid + Math.sin(ang) * radius), 1, dim - 2);
      const cz = 2 + ((k * 11) % (dim - 4));
      state.zones.push({ cx, cy, cz, r: size, kind: (k % 4) + 1 });
    }
  }
  state.seeded = true;
  state.seedCount = count;
  state.seedSize = size;
  return state.zones;
}

/**
 * Re-assert every zone into the EXOTIC scalar field (counteracts ambient
 * decay/diffusion). Hard write cap (MAX_ZONE_WRITES) — griefing-safe.
 * @returns {number} cells written
 */
export function writeExoticZones(state, system) {
  if (!system || !system.scalars.EXOTIC || state.zones.length === 0) return 0;
  const { dim } = system;
  const s = system.scalars.EXOTIC;
  let writes = 0;
  for (const z of state.zones) {
    for (let dz = -z.r; dz <= z.r && writes < MAX_ZONE_WRITES; dz++) {
      for (let dy = -z.r; dy <= z.r && writes < MAX_ZONE_WRITES; dy++) {
        for (let dx = -z.r; dx <= z.r && writes < MAX_ZONE_WRITES; dx++) {
          if (dx * dx + dy * dy + dz * dz > z.r * z.r) continue; // sphere
          const x = z.cx + dx, y = z.cy + dy, zz = z.cz + dz;
          if (x < 0 || x >= dim || y < 0 || y >= dim || zz < 0 || zz >= dim) continue;
          s[(zz * dim + y) * dim + x] = z.kind;
          writes++;
        }
      }
    }
  }
  return writes;
}

/**
 * Tag particles by the EXOTIC field at their cell; decay the tag when the
 * particle leaves the zone (half-life). Dead particles always untag.
 * @returns {number} particles newly tagged this pass
 */
function tagParticles(state, view, count, stride, system, halfLife) {
  if (!system || !system.scalars.EXOTIC) return 0;
  const { cell, dim } = system;
  const s = system.scalars.EXOTIC;
  let tagged = 0;
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) {
      const prev = state.state[i];
      if (prev !== 0) {
        state.state[i] = 0;
        state.timer[i] = 0;
        if (prev === EXOTIC_KINDS.DARK) view[b + S.ALPHA] = 1; // restore visibility
      }
      continue;
    }
    const x = clamp(Math.floor(view[b] / cell), 0, dim - 1);
    const y = clamp(Math.floor(view[b + 1] / cell), 0, dim - 1);
    const z = clamp(Math.floor(view[b + 2] / cell), 0, dim - 1);
    const mag = s[(z * dim + y) * dim + x];
    if (mag >= 0.5) {
      const kind = clamp(Math.round(mag), 1, 4);
      if (state.state[i] !== kind) { state.state[i] = kind; tagged++; }
      state.timer[i] = halfLife;
    } else if (state.state[i] !== 0) {
      const prev = state.state[i];
      state.timer[i] -= EXOTIC_CADENCE;
      if (state.timer[i] <= 0) {
        state.state[i] = 0;
        if (prev === EXOTIC_KINDS.DARK) view[b + S.ALPHA] = 1; // restore visibility
      }
    }
  }
  return tagged;
}

/** Annihilation: antimatter + normal matter → conserved THERMAL burst. */
function applyAnnihilation(state, view, count, stride, system, params, res) {
  const radius = num(params.EXOTIC_ANNIHILATE_RADIUS, ANNIHILATE_RADIUS_DEFAULT);
  if (!(radius > 0) || !system) return;
  const r2 = radius * radius;
  let pairs = 0;
  for (let i = 0; i < count && pairs < ANNIHILATE_CAP; i++) {
    if (state.state[i] !== EXOTIC_KINDS.ANTIMATTER) continue;
    const bi = i * stride;
    if (view[bi + S.DEAD] >= 0.5) continue;
    const ax = view[bi], ay = view[bi + 1], az = view[bi + 2];
    for (let j = 0; j < count && j < ANNIHILATE_SCAN; j++) {
      if (j === i || state.state[j] !== 0) continue;
      const bj = j * stride;
      if (view[bj + S.DEAD] >= 0.5) continue;
      const dx = view[bj] - ax, dy = view[bj + 1] - ay, dz = view[bj + 2] - az;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      // Energy in = energy out: the two pools burst into the field.
      const burst = Math.max(0, (view[bi + S.ENERGY] || 0) + (view[bj + S.ENERGY] || 0));
      if (burst > 0) {
        writeField(system, 'THERMAL', (ax + view[bj]) / 2, (ay + view[bj + 1]) / 2, (az + view[bj + 2]) / 2, burst);
      }
      view[bi + S.DEAD] = 1;      // antimatter dies
      view[bj + S.ENERGY] = 0;    // normal destroyed by energy loss
      state.state[i] = 0; state.timer[i] = 0;
      state.state[j] = 0; state.timer[j] = 0;
      pairs++;
      res.annihilated++;
      res.events.push({ type: 'exotic:annihilate', a: i, b: j, burst });
      break;
    }
  }
}

/** Dark matter: dim render + self-powered energy floor. */
function applyDark(state, view, count, stride, res) {
  let dark = 0;
  for (let i = 0; i < count; i++) {
    if (state.state[i] !== EXOTIC_KINDS.DARK) continue;
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    view[b + S.ALPHA] = DARK_ALPHA;
    if ((view[b + S.ENERGY] || 0) < DARK_ENERGY_FLOOR) view[b + S.ENERGY] = DARK_ENERGY_FLOOR;
    dark++;
  }
  res.dark = dark;
}

/** Strange matter: contagious conversion (deterministic hash, capped). */
function applyStrange(state, view, count, stride, system, params, res) {
  const rate = num(params.EXOTIC_STRANGE_RATE, STRANGE_RATE_DEFAULT);
  if (!(rate > 0) || !system) return;
  const range2 = STRANGE_RANGE * STRANGE_RANGE;
  const chance = Math.min(1, rate);
  const halfLife = num(params.EXOTIC_HALF_LIFE, HALF_LIFE_DEFAULT);
  let converted = 0;
  for (let i = 0; i < count && converted < STRANGE_CAP; i++) {
    if (state.state[i] !== EXOTIC_KINDS.STRANGE) continue;
    const bi = i * stride;
    if (view[bi + S.DEAD] >= 0.5) continue;
    const ax = view[bi], ay = view[bi + 1], az = view[bi + 2];
    for (let j = 0; j < count && j < STRANGE_SCAN; j++) {
      if (j === i || state.state[j] !== 0) continue;
      const bj = j * stride;
      if (view[bj + S.DEAD] >= 0.5) continue;
      const dx = view[bj] - ax, dy = view[bj + 1] - ay, dz = view[bj + 2] - az;
      if (dx * dx + dy * dy + dz * dz > range2) continue;
      if (hash2(i, j) % 1000 >= chance * 1000) continue;
      state.state[j] = EXOTIC_KINDS.STRANGE;
      state.timer[j] = halfLife;
      view[bj + S.MASS] = Math.min(STRANGE_MASS_CAP, (view[bj + S.MASS] || 1) * STRANGE_MASS_MULT);
      converted++;
      res.converted++;
      res.events.push({ type: 'exotic:convert', from: i, to: j });
      break;
    }
  }
}

/** Negative mass: repelled from mass concentrations (density gradient). */
function applyNegative(state, view, count, stride, system, params, res) {
  const strength = num(params.EXOTIC_NEGATIVE_STRENGTH, NEGATIVE_STRENGTH_DEFAULT);
  if (!(strength > 0) || !system) return;
  const { cell, dim } = system;
  const therm = system.scalars.THERMAL;
  const info = system.scalars.INFO;
  const K = NEGATIVE_K * strength;
  let nudged = 0;
  for (let i = 0; i < count; i++) {
    if (state.state[i] !== EXOTIC_KINDS.NEGATIVE) continue;
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const x = clamp(Math.floor(view[b] / cell), 1, dim - 2);
    const y = clamp(Math.floor(view[b + 1] / cell), 1, dim - 2);
    const z = clamp(Math.floor(view[b + 2] / cell), 1, dim - 2);
    const at = (z * dim + y) * dim + x;
    const gx = (densityAt(therm, info, at + 1) - densityAt(therm, info, at - 1)) / (2 * cell);
    const gy = (densityAt(therm, info, at + dim) - densityAt(therm, info, at - dim)) / (2 * cell);
    const gz = (densityAt(therm, info, at + dim * dim) - densityAt(therm, info, at - dim * dim)) / (2 * cell);
    view[b + S.VEL_X] += gx * K;
    view[b + S.VEL_Y] += gy * K;
    view[b + S.VEL_Z] += gz * K;
    nudged++;
  }
  res.nudged = nudged;
}

/**
 * One exotic-matter pass. Call from the intelligence loop while laws are
 * active. `opts.force` bypasses the cadence gate (tests).
 * @returns {{tagged:number, annihilated:number, converted:number,
 *            nudged:number, dark:number, zoneWrites:number, events:Array}}
 */
export function stepExoticMatter(state, view, count, stride, fieldSystem, opts = {}) {
  const res = { tagged: 0, annihilated: 0, converted: 0, nudged: 0, dark: 0, zoneWrites: 0, events: [] };
  if (!state || !view) return res;
  // Lazy array growth — keep aligned with the particle buffer across spawns.
  if (state.state.length < count) {
    const next = new Uint8Array(count);
    next.set(state.state);
    const nextTimer = new Float32Array(count);
    nextTimer.set(state.timer);
    state.state = next;
    state.timer = nextTimer;
  }
  if (!opts.force) {
    const tick = opts.tick ?? 0;
    if (tick % EXOTIC_CADENCE !== 0) return res;
  }
  const params = opts.worldParams || {};
  seedExoticZones(state, fieldSystem, params);
  res.zoneWrites = writeExoticZones(state, fieldSystem);
  const halfLife = num(params.EXOTIC_HALF_LIFE, HALF_LIFE_DEFAULT);
  res.tagged = tagParticles(state, view, count, stride, fieldSystem, halfLife);
  applyAnnihilation(state, view, count, stride, fieldSystem, params, res);
  applyDark(state, view, count, stride, res);
  applyStrange(state, view, count, stride, fieldSystem, params, res);
  applyNegative(state, view, count, stride, fieldSystem, params, res);
  return res;
}

/** Per-kind particle counts (for summaries / tests). */
export function exoticSummary(state) {
  const out = { ANTIMATTER: 0, DARK: 0, STRANGE: 0, NEGATIVE: 0 };
  if (!state) return out;
  for (let i = 0; i < state.state.length; i++) {
    const k = state.state[i];
    if (k >= 1 && k <= 4) out[EXOTIC_KIND_NAMES[k]]++;
  }
  return out;
}
