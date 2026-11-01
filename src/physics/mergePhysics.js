/**
 * VEPA4 — Merge Physics (v8.0.0 "Matter & Union")
 *
 * Union taxonomy for overlapping bodies:
 *
 *   MERGE  (one particle)   — ACCR accretion, ALLOY fusion. The pair collapses
 *                             into a single body: combined mass (× fusion
 *                             efficiency), centre-of-mass position,
 *                             momentum-conserving velocity, mass-weighted
 *                             colour (+ energy). ALLOY additionally mass-averages
 *                             the 42-float DNA cache (hybrid chemistry);
 *                             physical accretion keeps the survivor's genes.
 *   ATTACH (two orbs)        — BOND / POLYMER. Molecules stay as separate
 *                             attached orbs held by a spring at an equilibrium
 *                             distance. Bonded pairs NEVER merge — a bond is
 *                             not accretion.
 *   ADJOIN (two grains)      — ACCR composite structures (v9.1.0). Sustained
 *                             gentle contact cements both grains into a
 *                             rigid-ish rubble pile / dust aggregate: separate
 *                             identities, structurally linked across the
 *                             shared bond slots, held by an inelastic contact
 *                             response. Adjoined pairs never mass-merge.
 *   LINK   (two orbs)        — ENTANGLEMENT / SYMBIOSIS / PARASITE. Separate
 *                             particles sharing phase or energy flows.
 *
 * This module is self-contained so it can be imported by both the solver
 * (ACCR dispatch) and the ALLOY law without touching the legacy laws.js
 * surface. It supersedes the old gradual-dissolution accretion and the
 * unweighted 50/50 ALLOY colour blend.
 */

import { STRIDE_INDEXES as S, LAW_INDEXES } from '../constants.js';
import { isSet } from '../state/lawState.js';

// The six shared bond slots (BOND_PARTNER_1..6) — mirrors laws.js.
const BOND_SLOTS = [
  S.BOND_PARTNER_1,
  S.BOND_PARTNER_2,
  S.BOND_PARTNER_3,
  S.BOND_PARTNER_4,
  S.BOND_PARTNER_5,
  S.BOND_PARTNER_6,
];

/**
 * True if the two particles are bonded to each other (BOND / POLYMER /
 * ACCR-adjoined). Bonds register bilaterally in BOND_PARTNER_1..6, so one
 * side's slots are sufficient, but both are checked for symmetry.
 */
export function isBondedPair(view, iBase, jBase, stride) {
  // A bond is only meaningful once BOND_COUNT is nonzero — zero-initialised
  // partner slots (which equal particle index 0) must not look like bonds.
  if ((view[iBase + S.BOND_COUNT] || 0) < 1 && (view[jBase + S.BOND_COUNT] || 0) < 1) {
    return false;
  }
  const iIdx = iBase / stride;
  const jIdx = jBase / stride;
  for (const slot of BOND_SLOTS) {
    if (view[iBase + slot] === jIdx || view[jBase + slot] === iIdx) return true;
  }
  return false;
}

/** Break a single bilateral bond (mirrors laws.js breakBondPair). */
function breakBondPair(view, iBase, jBase, stride) {
  const iIdx = iBase / stride;
  const jIdx = jBase / stride;
  for (const slot of BOND_SLOTS) {
    if (view[iBase + slot] === jIdx) {
      view[iBase + slot] = -1;
      view[iBase + S.BOND_COUNT] = Math.max(0, view[iBase + S.BOND_COUNT] - 1);
      break;
    }
  }
  for (const slot of BOND_SLOTS) {
    if (view[jBase + slot] === iIdx) {
      view[jBase + slot] = -1;
      view[jBase + S.BOND_COUNT] = Math.max(0, view[jBase + S.BOND_COUNT] - 1);
      break;
    }
  }
}

/**
 * Cement two contacting grains into a composite structure (ACCR adjoining).
 *
 * Both particles keep their full identity — position, velocity, mass, DNA,
 * colour. The pair is registered bilaterally across free bond slots exactly
 * like BOND / POLYMER links, so all existing bond bookkeeping treats the seam
 * as a first-class structural bond: isBondedPair excludes the pair from
 * further mass accretion, death drops the seam, and third-party partners can
 * still rebond around it. No-op when either side has exhausted its six slots
 * or the pair is already linked.
 */
export function adjoinParticles(view, iBase, jBase, stride) {
  const iIdx = iBase / stride;
  const jIdx = jBase / stride;
  // A match only means "already linked" when some bond exists —
  // zero-initialised partner slots equal particle index 0 and must not
  // look like an existing seam (same guard as isBondedPair).
  if ((view[iBase + S.BOND_COUNT] || 0) >= 1 || (view[jBase + S.BOND_COUNT] || 0) >= 1) {
    for (const slot of BOND_SLOTS) {
      if (view[iBase + slot] === jIdx || view[jBase + slot] === iIdx) return; // already linked
    }
  }
  if ((view[iBase + S.BOND_COUNT] || 0) >= 6 || (view[jBase + S.BOND_COUNT] || 0) >= 6) return;
  for (const slot of BOND_SLOTS) {
    if (view[iBase + slot] < 0) {
      view[iBase + slot] = jIdx;
      view[iBase + S.BOND_COUNT] = (view[iBase + S.BOND_COUNT] || 0) + 1;
      break;
    }
  }
  for (const slot of BOND_SLOTS) {
    if (view[jBase + slot] < 0) {
      view[jBase + slot] = iIdx;
      view[jBase + S.BOND_COUNT] = (view[jBase + S.BOND_COUNT] || 0) + 1;
      break;
    }
  }
}

/**
 * Full merger: two overlapping bodies become ONE particle.
 *
 * The subject survives with combined mass (× fusion efficiency), centre-of-mass
 * position, momentum-conserving velocity, and mass-weighted colour (+ energy).
 * With blendDNA the 42-float DNA cache is mass-averaged too (hybrid chemistry,
 * ALLOY); physical accretion keeps the survivor's genetic identity.
 * The neighbour is absorbed (DEAD) and its third-party bonds are dropped so
 * its former partners can rebond. Returns true when a merge happened.
 *
 * @param {Float32Array} view
 * @param {number} subjBase  Base pointer of the surviving particle.
 * @param {number} nbBase    Base pointer of the absorbed particle.
 * @param {number} stride
 * @param {object} [opts]    { fusionMult, blendDNA, worldSize }
 */
export function mergeParticles(view, subjBase, nbBase, stride, opts = {}) {
  const fusionMult = opts.fusionMult != null ? opts.fusionMult : 1;
  const blendDNA = !!opts.blendDNA;
  const worldSize = opts.worldSize;

  const m1 = view[subjBase + S.MASS];
  const m2 = view[nbBase + S.MASS];
  if (!(m1 > 0) || !(m2 > 0)) return false;
  const rawTotal = m1 + m2;
  if (rawTotal <= 0) return false;

  const total = rawTotal * fusionMult;
  const w2 = m2 / rawTotal;
  const w1 = m1 / rawTotal;

  // Centre of mass — wrap-aware when a world size is known (subject-anchored
  // so the toroidal seam never splits a merged body).
  let dx = view[nbBase + S.POS_X] - view[subjBase + S.POS_X];
  let dy = view[nbBase + S.POS_Y] - view[subjBase + S.POS_Y];
  let dz = view[nbBase + S.POS_Z] - view[subjBase + S.POS_Z];
  if (worldSize > 0) {
    const hw = worldSize / 2;
    if (dx > hw) dx -= worldSize; else if (dx < -hw) dx += worldSize;
    if (dy > hw) dy -= worldSize; else if (dy < -hw) dy += worldSize;
    if (dz > hw) dz -= worldSize; else if (dz < -hw) dz += worldSize;
  }
  let nx = view[subjBase + S.POS_X] + dx * w2;
  let ny = view[subjBase + S.POS_Y] + dy * w2;
  let nz = view[subjBase + S.POS_Z] + dz * w2;
  if (worldSize > 0) {
    nx = ((nx % worldSize) + worldSize) % worldSize;
    ny = ((ny % worldSize) + worldSize) % worldSize;
    nz = ((nz % worldSize) + worldSize) % worldSize;
  }
  view[subjBase + S.POS_X] = nx;
  view[subjBase + S.POS_Y] = ny;
  view[subjBase + S.POS_Z] = nz;

  // Momentum conservation: (m1·v1 + m2·v2) / (m1 + m2)
  view[subjBase + S.VEL_X] = w1 * view[subjBase + S.VEL_X] + w2 * view[nbBase + S.VEL_X];
  view[subjBase + S.VEL_Y] = w1 * view[subjBase + S.VEL_Y] + w2 * view[nbBase + S.VEL_Y];
  view[subjBase + S.VEL_Z] = w1 * view[subjBase + S.VEL_Z] + w2 * view[nbBase + S.VEL_Z];

  // Mass-weighted colour — the heavier body dominates the blend.
  view[subjBase + S.COLOR_R] = w1 * view[subjBase + S.COLOR_R] + w2 * view[nbBase + S.COLOR_R];
  view[subjBase + S.COLOR_G] = w1 * view[subjBase + S.COLOR_G] + w2 * view[nbBase + S.COLOR_G];
  view[subjBase + S.COLOR_B] = w1 * view[subjBase + S.COLOR_B] + w2 * view[nbBase + S.COLOR_B];

  // Mass-weighted energy (one body now holds the pair's thermal/metabolic pool).
  const e1 = view[subjBase + S.ENERGY];
  const e2 = view[nbBase + S.ENERGY];
  if (Number.isFinite(e1) && Number.isFinite(e2)) {
    view[subjBase + S.ENERGY] = w1 * e1 + w2 * e2;
  }

  view[subjBase + S.MASS] = total;

  // Optional hybrid DNA (ALLOY) — mass-weighted like a real composite.
  if (blendDNA) {
    for (let d = 0; d < 42; d++) {
      const a = view[subjBase + S.DNA_CACHE_START + d];
      const b = view[nbBase + S.DNA_CACHE_START + d];
      if (Number.isFinite(a) && Number.isFinite(b)) {
        view[subjBase + S.DNA_CACHE_START + d] = a + (b - a) * w2;
      }
    }
  }

  // Bond hygiene: never leave the absorbed particle holding a bond to the
  // survivor (callers normally exclude bonded pairs, this is defensive), and
  // drop its bonds to third parties so their slots stay reusable.
  if (isBondedPair(view, subjBase, nbBase, stride)) {
    breakBondPair(view, subjBase, nbBase, stride);
  }
  for (const slot of BOND_SLOTS) {
    const partner = view[nbBase + slot];
    if (Number.isFinite(partner) && partner >= 0) {
      breakBondPair(view, nbBase, partner * stride, stride);
    }
  }

  view[nbBase + S.DEAD] = 1.0;
  return true;
}

/**
 * ALLOY — cross-species fusion (v8.0.0).
 *
 * Two different-species particles that overlap dissolve into one homogeneous
 * composite: full mass merge, DNA averaged (mass-weighted hybrid composition),
 * colour mass-weighted. The survivor keeps its species slot but behaves as the
 * mix. Bonded pairs are molecules and never alloy — they stay separate
 * attached orbs.
 */
export function applyAlloy(lawState, view, iBase, jBase, stride, dist, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ALLOY)) return;
  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  if (speciesI === speciesJ) return;
  const r1 = view[iBase + S.RADIUS];
  const r2 = view[jBase + S.RADIUS];
  if (dist > (r1 + r2) * 0.5) return;
  if (isBondedPair(view, iBase, jBase, stride)) return;
  mergeParticles(view, iBase, jBase, stride, { blendDNA: true });
}
