// ============================================================================
// VEPA4 — Biology Laws (lawgroups)
// Stateless pairwise/per-particle law functions for the biology category.
// ============================================================================

import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D } from '../../constants.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

function applySymbiosis(view, iBase, jBase, k) {
  if (view[iBase + S.SPECIES_ID] === view[jBase + S.SPECIES_ID]) return null;
  const eI = view[iBase + S.ENERGY];
  const eJ = view[jBase + S.ENERGY];
  const d = (eI - eJ) * k * 0.5;
  view[iBase + S.ENERGY] = clamp(nanGuard(eI - d), 0, 200);
  view[jBase + S.ENERGY] = clamp(nanGuard(eJ + d), 0, 200);
  return null;
}

function applyParasite(view, iBase, jBase, k) {
  const massI = view[iBase + S.MASS];
  const massJ = view[jBase + S.MASS];
  if (massI >= massJ) return null;
  const eJ = view[jBase + S.ENERGY];
  // IMMUNITY synergy (batch-23 RRP): host ARMOR (0-5) resists extraction —
  // at the cap the drain is halved (1 - ARMOR * 0.1).
  const armorResist = 1 - clamp(nanGuard(view[jBase + S.ARMOR]), 0, 5) * 0.1;
  const drain = Math.max(0, Math.min(0.05 * massJ, eJ - 5) * k * armorResist);
  view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] + drain * 0.9), 0, 200);
  view[jBase + S.ENERGY] = clamp(nanGuard(eJ - drain), 0, 200);
  return null;
}

function applyHibernation(view, iBase, k) {
  const energy = view[iBase + S.ENERGY];
  if (energy >= 30) return null;
  view[iBase + S.ENERGY] = clamp(nanGuard(energy + 0.05 * k), 0, 30);
  const damp = 0.2 * k;
  return {
    ax: nanGuard(-view[iBase + S.VEL_X] * damp),
    ay: nanGuard(-view[iBase + S.VEL_Y] * damp),
    az: nanGuard(-view[iBase + S.VEL_Z] * damp),
  };
}

function applyImmunity(view, iBase, k) {
  view[iBase + S.ARMOR] = clamp(nanGuard(view[iBase + S.ARMOR] + 0.02 * k), 0, 5);
  if (view[iBase + S.ARMOR] > 0) {
    view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] + 0.01 * k), 0, 200);
  }
  return null;
}
export { applySymbiosis, applyParasite, applyHibernation, applyImmunity };
