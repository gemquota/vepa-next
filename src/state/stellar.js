/**
 * VEPA4 — Stellar Physics (Set O.1 "Stellar Physics", RRP O·P·Q trilogy)
 *
 * The first build of the cosmic trilogy, as a world-substrate layer (decision
 * O.1 — no new law slots; the 128-law budget is full). Where L·M·N changed what
 * matter, space and time *are*, Set O scales the transformed substrate to the
 * cosmos: gravity wells become stars, stars collapse into black holes, and
 * black holes detonate as supernovae.
 *
 *   1. STARS (O.1)      — dense cells (mass + energy converge above STAR FORM
 *                         MASS, decision M.4's mass-energy equivalence pays
 *                         off) seed a star at the cell centre. A star fuses its
 *                         accreted mass into radiant output: THERMAL + INFO
 *                         field writes and a warm ENERGY feed to the region
 *                         (conserved — output is drawn from consumed mass).
 *                         Min star separation keeps the sky sparse (risk O.1).
 *   2. BLACK HOLES (O.2) — a star past BLACK HOLE HORIZON gains an event
 *                         horizon: a wider capture radius (accretion), no
 *                         radiant feed (light can't escape), and slow
 *                         Hawking-style re-emission of a HAWKING RATE share of
 *                         its mass back into the THERMAL field (conserved,
 *                         leak-proof).
 *   3. SUPERNOVAE (O.3)  — a star past SUPERNOVA MASS (and off cooldown)
 *                         detonates: a radial shockwave scatters nearby
 *                         particles outward and damages their energy, a THERMAL
 *                         burst floods the cell, and heavy elements seed the
 *                         region as a few EXOTIC field cells + INFO (risk O.3,
 *                         bounded cascade via a per-pass cap + cooldown).
 *
 * Everything is deterministic — no PRNG (hash-gated like Set L/N).
 */
import { STRIDE_INDEXES } from '../constants.js';
import { writeField } from '../physics/fields.js';

export const STELLAR_CADENCE = 15; // frames between passes
export const STAR_KINDS = { STAR: 0, BLACK_HOLE: 1, REMNANT: 2 };
export const STAR_KIND_NAMES = ['STAR', 'BLACK_HOLE', 'REMNANT'];

const STAR_FORM_DEFAULT = 20;        // mass+energy matter units to form a star
const STAR_MAX_DEFAULT = 4;          // max stars on the dish
const STAR_SEPARATION_DEFAULT = 3;   // min star separation (cells)
const STAR_RADIANCE_DEFAULT = 1;     // radiant output scale
const STAR_HORIZON_DEFAULT = 250;    // star → black hole collapse mass
const STAR_SUPERNOVA_DEFAULT = 400;  // detonation mass cap
const STAR_HAWKING_DEFAULT = 0.05;   // black-hole mass re-emission share

const ENERGY_MASS_EQUIV = 0.02;      // energy → mass conversion (M.4 echo)
const CAPTURE_FRACTION = 0.05;       // share of nearby matter captured per pass
const CAPTURE_CAP = 16;              // particles captured per star per pass
const RADIANCE_DRAIN = 0.01;         // star mass consumed per pass (× radiance)
const MASS_ENERGY_GAIN = 5;          // radiated output per mass unit (E=mc²)
const MAX_RADIANT_WRITE = 50;        // cap on a single field write
const FEED_ENERGY_CAP = 100;         // particle ENERGY ceiling when fed
const STAR_CAPTURE_CELLS = 1.5;      // star accretion radius (cells)
const BH_CAPTURE_CELLS = 2.5;        // black-hole accretion radius (cells)
const SUPERNOVA_CELLS = 3;           // shockwave radius (cells)
const SUPERNOVA_COOLDOWN = 600;      // ticks before a remnant can re-detonate
const SUPERNOVA_CAP = 3;             // detonations per pass (cascade risk O.2)
const SCATTER_CAP = 120;             // particles scattered per detonation
const SCATTER_KICK = 1.5;            // outward velocity kick (under MAX_VELOCITY)
const ELEMENT_CELLS = 6;             // exotic cells seeded per detonation

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

/**
 * Fresh stellar state. The star registry is the long-lived state; massGrid is
 * a scratch accumulation of per-cell mass-energy, resized when the field grid
 * resolution changes.
 */
export function createStellarState() {
  return {
    stars: [],                    // { x, y, z, cx, cy, cz, mass, kind, cooldown }
    massGrid: new Float32Array(0),
    gridDim: -1,
  };
}

function ensureMassGrid(state, dim) {
  const cells = dim * dim * dim;
  if (state.massGrid.length !== cells || state.gridDim !== dim) {
    state.massGrid = new Float32Array(cells);
    state.gridDim = dim;
  }
  state.massGrid.fill(0);
}

/** Combined mass-energy "matter" density of a particle (energy is dilute). */
function matterOf(mass, energy) {
  return (mass || 0) + (energy || 0) * ENERGY_MASS_EQUIV;
}

/**
 * O.1 — star formation: bucket particle mass-energy into cells, then seed a
 * star wherever a cell's matter exceeds the threshold and is at least
 * `separation` cells from every existing star (sparse sky, risk O.1).
 * @returns {number} stars formed
 */
function formStars(state, view, count, stride, system, formMass, maxStars, separation) {
  if (state.stars.length >= maxStars) return 0;
  const { dim, cell } = system;
  const grid = state.massGrid;
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const x = clamp(Math.floor(view[b] / cell), 0, dim - 1);
    const y = clamp(Math.floor(view[b + 1] / cell), 0, dim - 1);
    const z = clamp(Math.floor(view[b + 2] / cell), 0, dim - 1);
    grid[(z * dim + y) * dim + x] += matterOf(view[b + S.MASS], view[b + S.ENERGY]);
  }
  let formed = 0;
  for (let z = 0; z < dim && state.stars.length < maxStars; z++) {
    for (let y = 0; y < dim && state.stars.length < maxStars; y++) {
      for (let x = 0; x < dim && state.stars.length < maxStars; x++) {
        const i = (z * dim + y) * dim + x;
        if (grid[i] < formMass) continue;
        let tooClose = false;
        for (const s of state.stars) {
          const d = Math.sqrt((s.cx - x) ** 2 + (s.cy - y) ** 2 + (s.cz - z) ** 2);
          if (d < separation) { tooClose = true; break; }
        }
        if (tooClose) continue;
        state.stars.push({
          x: (x + 0.5) * cell,
          y: (y + 0.5) * cell,
          z: (z + 0.5) * cell,
          cx: x, cy: y, cz: z,
          mass: grid[i],
          kind: STAR_KINDS.STAR,
          cooldown: 0,
        });
        formed++;
      }
    }
  }
  return formed;
}

/** Capture radius in world units (black holes accrete from further out). */
function captureRadius(star, system) {
  return system.cell * (star.kind === STAR_KINDS.BLACK_HOLE ? BH_CAPTURE_CELLS : STAR_CAPTURE_CELLS);
}

/**
 * Accretion: a star (or black hole) captures a share of the matter of nearby
 * particles — their MASS and ENERGY accrete into the star (conserved), bounded
 * per star per pass (no instant consumption).
 * @returns {{captured:number, gained:number}}
 */
function captureParticles(star, view, count, stride, system) {
  const radius = captureRadius(star, system);
  const r2 = radius * radius;
  let captured = 0;
  let gained = 0;
  for (let i = 0; i < count && captured < CAPTURE_CAP; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const dx = view[b] - star.x, dy = view[b + 1] - star.y, dz = view[b + 2] - star.z;
    if (dx * dx + dy * dy + dz * dz > r2) continue;
    const dM = (view[b + S.MASS] || 0) * CAPTURE_FRACTION;
    const dE = (view[b + S.ENERGY] || 0) * CAPTURE_FRACTION;
    if (dM <= 0 && dE <= 0) continue;
    star.mass += dM + dE * ENERGY_MASS_EQUIV;
    gained += dM + dE * ENERGY_MASS_EQUIV;
    view[b + S.MASS] = Math.max(0.1, (view[b + S.MASS] || 1) - dM);
    view[b + S.ENERGY] = Math.max(0, (view[b + S.ENERGY] || 0) - dE);
    captured++;
  }
  return { captured, gained };
}

/**
 * Radiant output: a star fuses a small share of its own mass into THERMAL +
 * INFO field writes and a warm ENERGY feed to nearby particles (conserved —
 * the output is drawn from the consumed mass, decision M.4's E=mc²). Black
 * holes radiate nothing (light can't escape) — Hawking handles their output.
 * @returns {{radiated:number, fed:number}}
 */
function radiateStar(star, view, count, stride, system, radiance) {
  if (!(radiance > 0) || star.kind !== STAR_KINDS.STAR || star.mass <= 1) {
    return { radiated: 0, fed: 0 };
  }
  const consumed = Math.min(star.mass - 1, star.mass * RADIANCE_DRAIN * radiance);
  star.mass -= consumed;
  const output = consumed * MASS_ENERGY_GAIN;
  const therm = Math.min(MAX_RADIANT_WRITE, output * 0.5);
  const info = Math.min(MAX_RADIANT_WRITE, output * 0.2);
  if (therm > 0) writeField(system, 'THERMAL', star.x, star.y, star.z, therm);
  if (info > 0) writeField(system, 'INFO', star.x, star.y, star.z, info);
  // Warm the region: feed a share of the output into nearby ENERGY pools.
  const radius = system.cell * STAR_CAPTURE_CELLS;
  const r2 = radius * radius;
  const feed = Math.min(MAX_RADIANT_WRITE, output * 0.3);
  let fed = 0;
  if (feed > 0) {
    for (let i = 0; i < count; i++) {
      const b = i * stride;
      if (view[b + S.DEAD] >= 0.5) continue;
      const dx = view[b] - star.x, dy = view[b + 1] - star.y, dz = view[b + 2] - star.z;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      const e = view[b + S.ENERGY] || 0;
      if (e < FEED_ENERGY_CAP) {
        view[b + S.ENERGY] = Math.min(FEED_ENERGY_CAP, e + Math.min(feed, FEED_ENERGY_CAP - e));
        fed++;
      }
    }
  }
  return { radiated: consumed, fed };
}

/**
 * O.2 — Hawking emission: a black hole re-emits a HAWKING RATE share of its
 * mass back into the THERMAL field each pass (conserved, slow leak).
 * @returns {number} mass emitted
 */
function hawkingEmit(star, system, hawking) {
  if (!(hawking > 0) || star.kind !== STAR_KINDS.BLACK_HOLE || star.mass <= 1) return 0;
  const emit = Math.min(star.mass - 1, star.mass * hawking);
  star.mass -= emit;
  writeField(system, 'THERMAL', star.x, star.y, star.z, Math.min(MAX_RADIANT_WRITE, emit * MASS_ENERGY_GAIN * 0.5));
  return emit;
}

/**
 * O.3 — supernova: a star past SUPERNOVA MASS detonates — radial shockwave
 * (scatter + damage), a THERMAL burst, and heavy-element seeding (EXOTIC cells
 * + INFO). The star collapses to a low-mass remnant on cooldown (risk O.2).
 * @returns {number} detonations
 */
function detonate(star, view, count, stride, system, radiance, res) {
  const { cell, dim } = system;
  const radius = cell * SUPERNOVA_CELLS;
  const r2 = radius * radius;
  const burst = Math.min(MAX_RADIANT_WRITE, star.mass * (radiance || 1));
  writeField(system, 'THERMAL', star.x, star.y, star.z, burst);
  writeField(system, 'INFO', star.x, star.y, star.z, burst * 0.3);
  // Radial shockwave: scatter nearby particles outward and damage their energy.
  let scattered = 0;
  for (let i = 0; i < count && scattered < SCATTER_CAP; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const dx = view[b] - star.x, dy = view[b + 1] - star.y, dz = view[b + 2] - star.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r2 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const nx = dx / d, ny = dy / d, nz = dz / d;
    view[b + S.VEL_X] += nx * SCATTER_KICK;
    view[b + S.VEL_Y] += ny * SCATTER_KICK;
    view[b + S.VEL_Z] += nz * SCATTER_KICK;
    view[b + S.ENERGY] = Math.max(0, (view[b + S.ENERGY] || 0) * 0.5);
    scattered++;
  }
  // Heavy-element seeding: a few deterministic EXOTIC cells around the remnant
  // (zone kind 1-4 by hash) + INFO — ties Set O back to Set L's substrate.
  let seeded = 0;
  for (let k = 0; k < ELEMENT_CELLS; k++) {
    const ox = clamp(star.cx + Math.floor(hash2(star.cx, k + 1) % 5) - 2, 0, dim - 1);
    const oy = clamp(star.cy + Math.floor(hash2(star.cy, k + 2) % 5) - 2, 0, dim - 1);
    const oz = clamp(star.cz + Math.floor(hash2(star.cz, k + 3) % 5) - 2, 0, dim - 1);
    const i = (oz * dim + oy) * dim + ox;
    const kind = (hash2(star.cx + star.cy + star.cz, k + 4) % 4) + 1;
    system.scalars.EXOTIC[i] = Math.max(system.scalars.EXOTIC[i] || 0, kind);
    seeded++;
  }
  res.supernovae++;
  res.events.push({ type: 'stellar:supernova', star: { ...star }, scattered, seeded });
  // Collapse to a remnant — low mass, cooling off before it can detonate again.
  star.kind = STAR_KINDS.REMNANT;
  star.mass = Math.max(1, (star.mass || 1) / 8);
  star.cooldown = SUPERNOVA_COOLDOWN;
  return scattered;
}

/**
 * One stellar pass. Call from the intelligence loop while laws are active.
 * `opts.force` bypasses the cadence gate (tests).
 * @returns {{formed:number, captured:number, radiated:number, fed:number,
 *            blackHoles:number, supernovae:number, events:Array}}
 */
export function stepStellar(state, view, count, stride, fieldSystem, opts = {}) {
  const res = { formed: 0, captured: 0, radiated: 0, fed: 0, blackHoles: 0, supernovae: 0, events: [] };
  if (!state || !view || !fieldSystem) return res;
  if (!opts.force) {
    const tick = opts.tick ?? 0;
    if (tick % STELLAR_CADENCE !== 0) return res;
  }
  const params = opts.worldParams || {};
  const formMass = num(params.STELLAR_FORM, STAR_FORM_DEFAULT);
  const maxStars = clamp(Math.round(num(params.STELLAR_MAX, STAR_MAX_DEFAULT)), 0, 16);
  const separation = clamp(Math.round(num(params.STELLAR_SEPARATION, STAR_SEPARATION_DEFAULT)), 1, 8);
  const radiance = num(params.STELLAR_RADIANCE, STAR_RADIANCE_DEFAULT);
  const horizon = num(params.STELLAR_HORIZON, STAR_HORIZON_DEFAULT);
  const supernovaCap = num(params.STELLAR_SUPERNOVA, STAR_SUPERNOVA_DEFAULT);
  const hawking = clamp(num(params.STELLAR_HAWKING, STAR_HAWKING_DEFAULT), 0, 1);

  ensureMassGrid(state, fieldSystem.dim);

  if (maxStars > 0 && formMass > 0) {
    res.formed = formStars(state, view, count, stride, fieldSystem, formMass, maxStars, separation);
  }

  for (const star of state.stars) {
    if (star.cooldown > 0) star.cooldown -= STELLAR_CADENCE;
    const cap = captureParticles(star, view, count, stride, fieldSystem);
    res.captured += cap.captured;
    if (star.kind === STAR_KINDS.STAR) {
      const r = radiateStar(star, view, count, stride, fieldSystem, radiance);
      res.radiated += r.radiated;
      res.fed += r.fed;
      // Star → black hole collapse.
      if (star.mass >= horizon) {
        star.kind = STAR_KINDS.BLACK_HOLE;
        res.blackHoles++;
        res.events.push({ type: 'stellar:black-hole', star: { ...star } });
      }
    } else if (star.kind === STAR_KINDS.BLACK_HOLE) {
      hawkingEmit(star, fieldSystem, hawking);
      if (star.cooldown <= 0 && star.mass >= supernovaCap) {
        detonate(star, view, count, stride, fieldSystem, radiance, res);
      }
    }
    // Remnants may accrete again and, once the cooldown clears, re-detonate.
    if (star.kind === STAR_KINDS.REMNANT) {
      // Re-ignite a remnant that has accreted back above the formation floor.
      if (star.cooldown <= 0 && star.mass >= formMass * 2) {
        star.kind = STAR_KINDS.STAR;
      }
    }
  }

  return res;
}

/** Star registry summary (for summaries / tests). */
export function stellarSummary(state) {
  const out = { stars: 0, blackHoles: 0, remnants: 0, totalMass: 0 };
  if (!state) return out;
  for (const s of state.stars) {
    if (s.kind === STAR_KINDS.STAR) out.stars++;
    else if (s.kind === STAR_KINDS.BLACK_HOLE) out.blackHoles++;
    else out.remnants++;
    out.totalMass += s.mass || 0;
  }
  return out;
}
