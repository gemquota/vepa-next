/**
 * Deterministic numerical policy helpers. Adaptive subdivision is based on a
 * conservative displacement bound; it is not a substitute for force-based CFL
 * analysis or an error-controlled ODE integrator.
 */
export const DEFAULT_NUMERICS_CONFIG = Object.freeze({
  integrator: 'semi-implicit-euler',
  adaptiveSubstepping: false,
  maxDisplacementFraction: 0.25,
  maxSubsteps: 16,
  rollbackOnNonFinite: true,
  diagnostics: true,
});

export function validateNumericsConfig(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('numerics must be an object');
  const result = { ...DEFAULT_NUMERICS_CONFIG, ...config };
  if (!['explicit-euler', 'semi-implicit-euler'].includes(result.integrator)) {
    throw new RangeError('numerics.integrator must be explicit-euler or semi-implicit-euler');
  }
  if (typeof result.adaptiveSubstepping !== 'boolean' ||
      typeof result.rollbackOnNonFinite !== 'boolean' || typeof result.diagnostics !== 'boolean') {
    throw new TypeError('numerics switches must be boolean');
  }
  if (!Number.isFinite(result.maxDisplacementFraction) ||
      result.maxDisplacementFraction <= 0 || result.maxDisplacementFraction > 1) {
    throw new RangeError('numerics.maxDisplacementFraction must be in (0, 1]');
  }
  if (!Number.isInteger(result.maxSubsteps) || result.maxSubsteps < 1 || result.maxSubsteps > 256) {
    throw new RangeError('numerics.maxSubsteps must be an integer from 1 to 256');
  }
  return Object.freeze(result);
}

export function measureParticleState(view, count, stride, slots) {
  let kineticEnergy = 0, px = 0, py = 0, pz = 0, maxSpeed = 0, liveCount = 0;
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + slots.DEAD] >= 0.5 || view[b + slots.MASS] <= 0) continue;
    const mass = view[b + slots.MASS];
    const vx = view[b + slots.VEL_X], vy = view[b + slots.VEL_Y], vz = view[b + slots.VEL_Z];
    const speed = Math.hypot(vx, vy, vz);
    if (![mass, vx, vy, vz, view[b + slots.POS_X], view[b + slots.POS_Y], view[b + slots.POS_Z]].every(Number.isFinite)) {
      throw new RangeError('Non-finite live particle state at index ' + i);
    }
    kineticEnergy += 0.5 * mass * speed * speed;
    px += mass * vx; py += mass * vy; pz += mass * vz;
    maxSpeed = Math.max(maxSpeed, speed);
    liveCount++;
  }
  return Object.freeze({ kineticEnergy, momentum: Object.freeze([px, py, pz]), maxSpeed, liveCount });
}

export function chooseAdaptiveSubsteps({ view, count, stride, slots, dt, interactionRadius, numerics }) {
  const state = measureParticleState(view, count, stride, slots);
  if (!numerics.adaptiveSubstepping || state.maxSpeed === 0) {
    return Object.freeze({ substeps: 1, requestedSubsteps: 1, stabilityLimited: false, maxSpeed: state.maxSpeed });
  }
  const maxDisplacement = interactionRadius * numerics.maxDisplacementFraction;
  const requestedSubsteps = Math.max(1, Math.ceil(state.maxSpeed * dt / maxDisplacement));
  return Object.freeze({
    substeps: Math.min(requestedSubsteps, numerics.maxSubsteps),
    requestedSubsteps,
    stabilityLimited: requestedSubsteps > numerics.maxSubsteps,
    maxSpeed: state.maxSpeed,
  });
}
