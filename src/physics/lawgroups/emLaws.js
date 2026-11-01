// ============================================================================
// VEPA4 — Electromagnetism Law Group (EM)
// Per-particle and pairwise law functions: Antenna, Shielding, Polarization.
// Each function returns a force object {ax, ay, az} or null. State mutations
// are NaN-guarded and clamped before being written back to the buffer.
// ============================================================================

import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D } from '../../constants.js';

function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

/**
 * Antenna — directional emission along velocity.
 * Particles carrying an active SIGNAL broadcast additional signal energy
 * scaled by speed, so moving emitters transmit louder (SIGNAL capped at 10).
 */
function applyAntenna(view, iBase, k) {
  const signal = view[iBase + S.SIGNAL];
  if (!(signal > 0.05)) return null;
  const vx = view[iBase + S.VEL_X];
  const vy = view[iBase + S.VEL_Y];
  const vz = view[iBase + S.VEL_Z];
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const boost = Math.min(speed, 5) * 0.01 * k;
  view[iBase + S.SIGNAL] = clamp(nanGuard(signal + boost), 0, 10);
  return null;
}

/**
 * Shielding — Faraday-cage dissipation.
 * Stored ENERGY is spent to bleed off stored CHARGE, damping electrostatic
 * influence at a small energy cost (charge drained toward zero).
 */
function applyShielding(view, iBase, k) {
  const energy = view[iBase + S.ENERGY];
  const charge = view[iBase + S.CHARGE];
  if (!(energy > 5) || !(Math.abs(charge) > 0)) return null;
  const delta = Math.sign(charge) * Math.min(0.01 * k, Math.abs(charge));
  view[iBase + S.CHARGE] = nanGuard(charge - delta);
  view[iBase + S.ENERGY] = clamp(energy - 0.05 * k, 0, 200);
  return null;
}

/**
 * Polarization — channel-filtered signal exchange.
 * Particles tuned to the same TUNING_CH1 channel exchange SIGNAL toward the
 * pair mean; mismatched channels absorb the transmission instead (damp).
 */
function applyPolarization(view, iBase, jBase, k) {
  const dnaBase = S.DNA_CACHE_START;
  const t1i = view[iBase + dnaBase + D.TUNING_CH1];
  const t1j = view[jBase + dnaBase + D.TUNING_CH1];
  const si = view[iBase + S.SIGNAL];
  const sj = view[jBase + S.SIGNAL];
  if (t1i === t1j) {
    const mean = (si + sj) * 0.5;
    const t = clamp(k, 0, 1);
    view[iBase + S.SIGNAL] = clamp(nanGuard(si + (mean - si) * t), 0, 10);
    view[jBase + S.SIGNAL] = clamp(nanGuard(sj + (mean - sj) * t), 0, 10);
  } else {
    const damp = 1 - 0.01 * k;
    view[iBase + S.SIGNAL] = clamp(nanGuard(si * damp), 0, 10);
    view[jBase + S.SIGNAL] = clamp(nanGuard(sj * damp), 0, 10);
  }
  return null;
}
export { applyAntenna, applyShielding, applyPolarization };
