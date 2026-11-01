// ============================================================================
// VEPA4 — Thermodynamics Law Group
// ADIABATIC / COMPRESSION / EXPANSION / EQUILIBRIUM / LATENT_HEAT / RUNAWAY
// Stateless per-particle and pairwise law functions over the flat particle
// buffer. These laws mutate buffer state directly and return null. Never
// write NaN/Infinity.
// ============================================================================

import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D } from '../../constants.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

/**
 * ADIABATIC — convert kinetic energy to TEMPERATURE, conserving total energy:
 * damp speed by a small fraction and add the removed kinetic energy to the
 * particle's temperature. Returns the velocity-reduction force.
 */
function applyAdiabatic(view, iBase, k) {
  const vx = view[iBase + S.VEL_X];
  const vy = view[iBase + S.VEL_Y];
  const vz = view[iBase + S.VEL_Z];
  const speed = Math.hypot(vx, vy, vz);
  if (speed < 1e-9 || k <= 0) return null;
  const mass = Math.max(nanGuard(view[iBase + S.MASS]), 0.001);
  const dv = Math.min(speed * k, speed * 0.9);
  const newSpeed = speed - dv;
  const removed = 0.5 * mass * (speed * speed - newSpeed * newSpeed);
  view[iBase + S.TEMPERATURE] = nanGuard((view[iBase + S.TEMPERATURE] || 0) + removed);
  const damp = dv / speed;
  return {
    ax: clamp(nanGuard(-vx * damp), -50, 50),
    ay: clamp(nanGuard(-vy * damp), -50, 50),
    az: clamp(nanGuard(-vz * damp), -50, 50),
  };
}

/**
 * COMPRESSION — when dist < (rI + rJ) * 2, shrink both RADII slightly and
 * raise both TEMPERATUREs (pressure squeeze).
 */
function applyCompression(view, iBase, jBase, dist, k) {
  const rI = view[iBase + S.RADIUS];
  const rJ = view[jBase + S.RADIUS];
  if (dist >= (rI + rJ) * 2) return null;
  const shrinkI = Math.min(rI * k, rI * 0.25);
  const shrinkJ = Math.min(rJ * k, rJ * 0.25);
  const dT = k;
  view[iBase + S.RADIUS] = nanGuard(Math.max(0.02, rI - shrinkI));
  view[jBase + S.RADIUS] = nanGuard(Math.max(0.02, rJ - shrinkJ));
  view[iBase + S.TEMPERATURE] = nanGuard((view[iBase + S.TEMPERATURE] || 0) + dT);
  view[jBase + S.TEMPERATURE] = nanGuard((view[jBase + S.TEMPERATURE] || 0) + dT);
  return null;
}

/**
 * EXPANSION — when TEMPERATURE < 0.3, grow RADIUS toward the DNA BASE_RADIUS
 * (clamped) and cool slightly.
 */
function applyExpansion(view, iBase, k) {
  const t = view[iBase + S.TEMPERATURE];
  if (t >= 0.3) return null;
  const r = view[iBase + S.RADIUS];
  const base = view[iBase + S.DNA_CACHE_START + D.BASE_RADIUS];
  if (base > r) {
    const growth = clamp((base - r) * k, 0, base - r);
    view[iBase + S.RADIUS] = nanGuard(r + growth);
  }
  view[iBase + S.TEMPERATURE] = nanGuard(t - k * 0.1);
  return null;
}

/**
 * EQUILIBRIUM — symmetric conduction: exchange TEMPERATURE toward the pair
 * mean, conserving total.
 */
function applyEquilibrium(view, iBase, jBase, k) {
  const tI = view[iBase + S.TEMPERATURE] || 0;
  const tJ = view[jBase + S.TEMPERATURE] || 0;
  const dt = (tJ - tI) * k;
  view[iBase + S.TEMPERATURE] = nanGuard(tI + dt);
  view[jBase + S.TEMPERATURE] = nanGuard(tJ - dt);
  return null;
}

/**
 * LATENT_HEAT — phase buffering: hot particles convert TEMPERATURE to ENERGY,
 * cold particles convert ENERGY back to TEMPERATURE.
 */
function applyLatentHeat(view, iBase, k) {
  const t = view[iBase + S.TEMPERATURE] || 0;
  const energy = view[iBase + S.ENERGY] || 0;
  if (t > 1.0) {
    const dT = clamp((t - 1.0) * k, 0, t - 1.0);
    view[iBase + S.TEMPERATURE] = nanGuard(t - dT);
    view[iBase + S.ENERGY] = nanGuard(energy + dT);
  } else if (t < -0.5) {
    const want = clamp((-0.5 - t) * k, 0, -0.5 - t);
    const dT = Math.min(want, Math.max(0, energy));
    view[iBase + S.TEMPERATURE] = nanGuard(t + dT);
    view[iBase + S.ENERGY] = nanGuard(energy - dT);
  }
  return null;
}

/**
 * RUNAWAY — positive feedback: TEMPERATURE > 0.8 grows quadratically.
 */
function applyRunaway(view, iBase, k) {
  const t = view[iBase + S.TEMPERATURE] || 0;
  if (t > 0.8) {
    const excess = t - 0.8;
    view[iBase + S.TEMPERATURE] = nanGuard(t + excess * excess * k);
  }
  return null;
}
export { applyAdiabatic, applyCompression, applyExpansion, applyEquilibrium, applyLatentHeat, applyRunaway };
