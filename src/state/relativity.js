/**
 * VEPA4 — Relativity (Set M.1 "Relativity", RRP L·M·N trilogy)
 *
 * The second build of the physics frontier, as a world-substrate layer
 * (decision M.1 — no new law slots; the 128-law budget is full). Where
 * Set L changed what matter *is*, Set M changes how space and time behave.
 *
 *   1. CURVATURE (M.1) — a new mass-warped scalar field: every particle's
 *      mass buckets into the field grid, so dense regions curve space around
 *      them. Written with SET semantics each pass (deterministic, no PRNG),
 *      bounded by MAX_CURVATURE.
 *   2. GRAVITATIONAL LENSING (M.2) — the INFO signal medium bends toward
 *      curvature peaks: each pass moves a small fraction of each curved
 *      cell's INFO one step toward its steepest-curvature neighbour.
 *      Conserved exactly (moves, never creates). Communication paths visibly
 *      curve around mass.
 *   3. TIME DILATION (M.3) — the *velocity* term: time runs slow for fast
 *      particles (γ = 1/√(1 − v²/c²)); the pass slows their AGE and HUNGER
 *      clocks by (1 − factor) × cadence. The *gravitational* term is already
 *      served by the TIME_DILATION law (v4.6.29, localDt from the mass
 *      potential) — Set M does not double-dilate.
 *   4. MASS–ENERGY EQUIVALENCE (M.4) — E = mc²: surplus ENERGY (> 80)
 *      condenses into MASS (energy is dilute — a small mass gain); scarce
 *      ENERGY (< 20) converts MASS into ENERGY (mass is concentrated — a
 *      large energy gain). Rate-gated, bounded (mass capped below the
 *      star-collapse threshold STAR_MASS 12).
 *
 * Everything is deterministic — no PRNG.
 */
import { STRIDE_INDEXES } from '../constants.js';

export const RELATIVITY_CADENCE = 15; // frames between passes
export const MAX_CURVATURE = 10;      // curvature ceiling (bounded field)

const CURVATURE_STRENGTH_DEFAULT = 1;
const TIME_DILATION_MAX_DEFAULT = 0.25; // slowest time may run
const LIGHT_SPEED_DEFAULT = 600;        // c (world units / tick)
const LENSING_STRENGTH_DEFAULT = 0.1;   // INFO fraction moved per pass
const MASS_ENERGY_RATE_DEFAULT = 0.02;  // E=mc² conversion rate

const ENERGY_SURPLUS = 80;        // above this, energy condenses to mass
const ENERGY_SCARCITY = 20;       // below this, mass converts to energy
const ENERGY_TO_MASS_FACTOR = 0.2; // c² in reverse: energy is dilute
const MASS_TO_ENERGY_GAIN = 5;     // E = mc²: mass is concentrated
const MASS_CAP = 10;               // below STAR_MASS 12 — no accidental stars

const S = STRIDE_INDEXES;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function num(v, dflt) {
  return Number.isFinite(Number(v)) ? Number(v) : dflt;
}

/**
 * Bucket particle mass into the CURVATURE scalar field (SET semantics).
 * @returns {number} cells with curvature
 */
export function writeCurvature(system, view, count, stride, strength) {
  const curv = system.scalars.CURVATURE;
  curv.fill(0);
  if (!(strength > 0)) return 0;
  const { dim, cell } = system;
  const volScale = Math.max(1, (cell * cell * cell) / 1e6);
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const x = clamp(Math.floor(view[b] / cell), 0, dim - 1);
    const y = clamp(Math.floor(view[b + 1] / cell), 0, dim - 1);
    const z = clamp(Math.floor(view[b + 2] / cell), 0, dim - 1);
    curv[(z * dim + y) * dim + x] += (view[b + S.MASS] || 1) * strength;
  }
  let cells = 0;
  for (let i = 0; i < curv.length; i++) {
    if (curv[i] > 0) {
      curv[i] = Math.min(MAX_CURVATURE, curv[i] / volScale);
      cells++;
    }
  }
  return cells;
}

/**
 * Gravitational lensing: move a fraction of each curved cell's INFO one step
 * toward its steepest-curvature neighbour. Conserved exactly (moves, never
 * creates) — targets accumulate in the system's scratch accumulator and are
 * applied after the pass.
 * @returns {number} cells lensed
 */
export function applyLensing(system, strength) {
  if (!(strength > 0)) return 0;
  const { dim } = system;
  const curv = system.scalars.CURVATURE;
  const info = system.scalars.INFO;
  const scratch = system.scratch;
  const acc = system.acc;
  scratch.set(info);
  acc.fill(0);
  let lensed = 0;
  for (let z = 0; z < dim; z++) {
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const i = (z * dim + y) * dim + x;
        if (curv[i] <= 0) continue;
        let best = -1, bv = curv[i];
        if (x > 0 && curv[i - 1] > bv) { bv = curv[i - 1]; best = i - 1; }
        if (x < dim - 1 && curv[i + 1] > bv) { bv = curv[i + 1]; best = i + 1; }
        if (y > 0 && curv[i - dim] > bv) { bv = curv[i - dim]; best = i - dim; }
        if (y < dim - 1 && curv[i + dim] > bv) { bv = curv[i + dim]; best = i + dim; }
        if (z > 0 && curv[i - dim * dim] > bv) { bv = curv[i - dim * dim]; best = i - dim * dim; }
        if (z < dim - 1 && curv[i + dim * dim] > bv) { bv = curv[i + dim * dim]; best = i + dim * dim; }
        if (best < 0) continue;
        const amount = scratch[i] * strength;
        if (amount <= 0) continue;
        info[i] -= amount;
        acc[best] += amount;
        lensed++;
      }
    }
  }
  for (let i = 0; i < info.length; i++) {
    if (acc[i] !== 0) info[i] += acc[i];
  }
  return lensed;
}

/**
 * Velocity time dilation: slow the AGE / HUNGER clocks of fast particles by
 * (1 − γ) × cadence, γ = √(1 − min((v/c)², 1 − dilationMax²)) — bounded by
 * TIME_DILATION_MAX. @returns {number} particles dilated
 */
export function applyDilation(view, count, stride, params) {
  const c = num(params.LIGHT_SPEED, LIGHT_SPEED_DEFAULT);
  const dilationMax = clamp(num(params.TIME_DILATION_MAX, TIME_DILATION_MAX_DEFAULT), 0.25, 1);
  if (!(c > 0)) return 0;
  const c2 = c * c;
  const ratioClamp = 1 - dilationMax * dilationMax;
  let dilated = 0;
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const vx = view[b + S.VEL_X] || 0, vy = view[b + S.VEL_Y] || 0, vz = view[b + S.VEL_Z] || 0;
    const v2 = vx * vx + vy * vy + vz * vz;
    if (v2 < 1e-6) continue;
    const ratio = Math.min(v2 / c2, ratioClamp);
    const factor = Math.sqrt(1 - ratio); // time runs slow for fast particles
    if (factor >= 1) continue;
    const lost = RELATIVITY_CADENCE * (1 - factor);
    view[b + S.AGE] = Math.max(0, (view[b + S.AGE] || 0) - lost);
    if ((view[b + S.HUNGER] || 0) > 0) view[b + S.HUNGER] = Math.max(0, (view[b + S.HUNGER] || 0) - lost);
    dilated++;
  }
  return dilated;
}

/**
 * Mass–energy equivalence (E = mc²): surplus ENERGY condenses to MASS; scarce
 * ENERGY converts MASS to ENERGY. Rate-gated, bounded, deterministic.
 * @returns {{condensed:number, converted:number}}
 */
export function applyMassEnergy(view, count, stride, params) {
  const rate = num(params.MASS_ENERGY_RATE, MASS_ENERGY_RATE_DEFAULT);
  if (!(rate > 0)) return { condensed: 0, converted: 0 };
  let condensed = 0, converted = 0;
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5) continue;
    const energy = view[b + S.ENERGY] || 0;
    const mass = view[b + S.MASS] || 1;
    if (energy > ENERGY_SURPLUS && mass < MASS_CAP) {
      // Energy condenses to mass (energy is dilute: a small mass gain).
      const d = Math.min(energy - ENERGY_SURPLUS, (MASS_CAP - mass) / ENERGY_TO_MASS_FACTOR) * rate;
      if (d > 0) {
        view[b + S.ENERGY] = energy - d;
        view[b + S.MASS] = mass + d * ENERGY_TO_MASS_FACTOR;
        condensed++;
      }
    } else if (energy < ENERGY_SCARCITY && mass > 1) {
      // Mass converts to energy (mass is concentrated: a large energy gain).
      const d = Math.min((ENERGY_SCARCITY - energy) / MASS_TO_ENERGY_GAIN, mass - 1) * rate;
      if (d > 0) {
        view[b + S.ENERGY] = energy + d * MASS_TO_ENERGY_GAIN;
        view[b + S.MASS] = mass - d;
        converted++;
      }
    }
  }
  return { condensed, converted };
}

/**
 * One relativity pass. Call from the intelligence loop while laws are active.
 * `opts.force` bypasses the cadence gate (tests).
 * @returns {{curvatureCells:number, dilated:number, lensed:number,
 *            condensed:number, converted:number}}
 */
export function stepRelativity(view, count, stride, fieldSystem, opts = {}) {
  const res = { curvatureCells: 0, dilated: 0, lensed: 0, condensed: 0, converted: 0 };
  if (!view || !fieldSystem || !fieldSystem.scalars.CURVATURE) return res;
  if (!opts.force) {
    const tick = opts.tick ?? 0;
    if (tick % RELATIVITY_CADENCE !== 0) return res;
  }
  const params = opts.worldParams || {};
  res.curvatureCells = writeCurvature(fieldSystem, view, count, stride, num(params.CURVATURE_STRENGTH, CURVATURE_STRENGTH_DEFAULT));
  res.lensed = applyLensing(fieldSystem, num(params.LENSING_STRENGTH, LENSING_STRENGTH_DEFAULT));
  res.dilated = applyDilation(view, count, stride, params);
  const mc = applyMassEnergy(view, count, stride, params);
  res.condensed = mc.condensed;
  res.converted = mc.converted;
  return res;
}
