// ============================================================================
// VEPA4 — Metaphysics Law Group (META)
// Per-particle and pairwise law functions: Consciousness, Perception,
// Synchronicity.
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
 * Consciousness — predictive self-model (v4.6.29).
 * The particle maintains a running estimate of its own speed
 * (SELF_MODEL_SPEED). When actual motion deviates from the model
 * (prediction error) it 'attends': MEMORY rises, the error broadcasts as
 * SIGNAL (global-workspace flavour via COMMS/MIND), and attention costs
 * ENERGY. Low error → efficient self-maintenance regen. A computational
 * proxy for predictive processing; consciousness itself is unresolved, so
 * this is an honest approximation.
 */
function applyConsciousness(view, iBase, k) {
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const model = view[iBase + S.SELF_MODEL_SPEED] || 0;
  const updated = model * 0.95 + speed * 0.05;
  view[iBase + S.SELF_MODEL_SPEED] = nanGuard(updated);
  const err = Math.abs(speed - updated);
  if (err > 0.3) {
    // Attention: prediction error drives the self-model, costs energy.
    view[iBase + S.MEMORY] = clamp(nanGuard((view[iBase + S.MEMORY] || 0) + err * 0.02 * k), 0, 1);
    view[iBase + S.SIGNAL] = clamp(nanGuard((view[iBase + S.SIGNAL] || 0) + err * 0.01 * k), 0, 10);
    view[iBase + S.ENERGY] = clamp(nanGuard((view[iBase + S.ENERGY] || 0) - err * 0.05 * k), 0, 200);
  } else {
    // Efficient self-maintenance while the world matches the model.
    view[iBase + S.ENERGY] = clamp(nanGuard((view[iBase + S.ENERGY] || 0) + 0.01 * k), 0, 200);
  }
  return null;
}

/**
 * Perception — extended sensing.
 * Within twice the NEIGHBORHOOD_RADIUS, gently align this particle's velocity
 * toward the neighbor's velocity (awareness at a distance).
 */
function applyPerception(view, iBase, jBase, dist, k) {
  const radius = view[iBase + S.DNA_CACHE_START + D.NEIGHBORHOOD_RADIUS];
  if (!(dist < radius * 2)) return null;
  return {
    ax: nanGuard((view[jBase + S.VEL_X] - view[iBase + S.VEL_X]) * 0.01 * k),
    ay: nanGuard((view[jBase + S.VEL_Y] - view[iBase + S.VEL_Y]) * 0.01 * k),
    az: nanGuard((view[jBase + S.VEL_Z] - view[iBase + S.VEL_Z]) * 0.01 * k),
  };
}

/**
 * Synchronicity — resonant phase alignment.
 * When PHASE_1 values are close (< 0.3), pull velocities together and move
 * both phases toward the pair mean (resonant entrainment).
 */
function applySynchronicity(view, iBase, jBase, k) {
  const p1i = view[iBase + S.PHASE_1];
  const p1j = view[jBase + S.PHASE_1];
  if (!(Math.abs(p1i - p1j) < 0.3)) return null;
  const mean = (p1i + p1j) * 0.5;
  const t = clamp(k, 0, 1);
  view[iBase + S.PHASE_1] = nanGuard(p1i + (mean - p1i) * t);
  view[jBase + S.PHASE_1] = nanGuard(p1j + (mean - p1j) * t);
  return {
    ax: nanGuard((view[jBase + S.VEL_X] - view[iBase + S.VEL_X]) * 0.02 * k),
    ay: nanGuard((view[jBase + S.VEL_Y] - view[iBase + S.VEL_Y]) * 0.02 * k),
    az: nanGuard((view[jBase + S.VEL_Z] - view[iBase + S.VEL_Z]) * 0.02 * k),
  };
}
export { applyConsciousness, applyPerception, applySynchronicity };
