/**
 * Explicit physics-fidelity policy.
 *
 * This module does not run the solver. It turns configured caps and an explicitly
 * selected mode into inspectable metadata for snapshots, replay and benchmarks.
 * Callers must persist the returned effective settings; do not treat this as a
 * render-quality setting.
 */
const MODES = new Set(['configured', 'adaptive']);

function finiteInteger(value, name, min = 0) {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(name + ' must be an integer >= ' + min);
  }
  return value;
}

export function resolvePhysicsFidelityPolicy({
  mode = 'configured',
  population,
  configuredMaxInteractions = 500,
  pairwiseBudget = 96,
  targetFps = 60,
  neighborBuffer = 2000,
  gridDim = 12,
  cellCap = 100,
  gravityEngine = 'exact',
} = {}) {
  if (!MODES.has(mode)) throw new RangeError('mode must be configured or adaptive');
  finiteInteger(population, 'population');
  finiteInteger(configuredMaxInteractions, 'configuredMaxInteractions', 1);
  finiteInteger(pairwiseBudget, 'pairwiseBudget', 1);
  finiteInteger(targetFps, 'targetFps', 1);
  finiteInteger(neighborBuffer, 'neighborBuffer', 1);
  finiteInteger(gridDim, 'gridDim', 1);
  finiteInteger(cellCap, 'cellCap', 1);
  if (!['exact', 'bh', 'fmm', 'gpu-gravity'].includes(gravityEngine)) {
    throw new RangeError('unsupported gravityEngine');
  }

  const boundedTargetFps = Math.max(15, Math.min(60, targetFps));
  const populationScale = Math.max(1, Math.sqrt(Math.max(1, population) / 2500));
  const adaptiveInteractions = Math.max(
    8,
    Math.round(pairwiseBudget * (60 / boundedTargetFps) / populationScale),
  );
  const effectiveMaxInteractions = mode === 'adaptive'
    ? Math.max(8, Math.min(configuredMaxInteractions, adaptiveInteractions))
    : configuredMaxInteractions;

  return Object.freeze({
    policyVersion: 1,
    mode,
    semanticsChangedByPolicy: mode === 'adaptive' && effectiveMaxInteractions < configuredMaxInteractions,
    population,
    configuredMaxInteractions,
    effectiveMaxInteractions,
    pairwiseBudget,
    targetFps: boundedTargetFps,
    neighborBuffer,
    gridDim,
    cellCap,
    gravityEngine,
    notes: Object.freeze([
      'Interaction caps can change physics outcomes and must be part of canonical configuration.',
      'targetFps is a policy input, not evidence of measured frame time.',
      'Non-exact gravity engines require separate accuracy evidence.',
    ]),
  });
}

/**
 * Report actual backend state without collapsing availability into activation.
 * The caller must supply observed runtime facts; this function probes nothing.
 */
export function describeComputeBackend({
  backend = 'cpu',
  available = true,
  initialized = true,
  activePasses = [],
  fallbackReason = null,
} = {}) {
  if (!['cpu', 'webgpu', 'webgl', 'unknown'].includes(backend)) {
    throw new RangeError('unsupported backend');
  }
  if (typeof available !== 'boolean' || typeof initialized !== 'boolean') {
    throw new TypeError('available and initialized must be booleans');
  }
  if (!Array.isArray(activePasses) || activePasses.some(x => typeof x !== 'string' || !x)) {
    throw new TypeError('activePasses must be an array of non-empty strings');
  }
  if (fallbackReason !== null && (typeof fallbackReason !== 'string' || !fallbackReason)) {
    throw new TypeError('fallbackReason must be null or a non-empty string');
  }
  const active = initialized && activePasses.length > 0;
  return Object.freeze({
    backend,
    available,
    initialized,
    active,
    activePasses: Object.freeze([...new Set(activePasses)]),
    fallbackReason,
    scope: active ? 'listed passes only' : 'no accelerated pass confirmed active',
  });
}
