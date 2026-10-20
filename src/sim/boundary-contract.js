const WRAP_LAW_ID = 'law.wrap';
const BOUNDARY_MODES = new Set(['toroidal', 'reflective']);

/**
 * Resolve the relationship between world boundary mode and the WRAP law.
 * Boundary mode is canonical when explicitly supplied; a direct law toggle
 * updates the mode when it is the source of the proposal.
 */
export function proposeBoundaryChange(current, change) {
  validateConfig(current, 'current');
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    throw new TypeError('change must be an object');
  }

  const currentLaws = new Set(current.activeLawIds);
  let boundaryMode = current.boundaryMode;
  let activeLawIds = [...currentLaws];

  if (Array.isArray(change.activeLawIds)) {
    activeLawIds = [...new Set(change.activeLawIds)];
    if (activeLawIds.some(id => typeof id !== 'string' || !id)) {
      throw new TypeError('activeLawIds must contain non-empty strings');
    }
    const wasWrapActive = currentLaws.has(WRAP_LAW_ID);
    const isWrapActive = activeLawIds.includes(WRAP_LAW_ID);
    if (activeLawIds.length > 0 && wasWrapActive !== isWrapActive && !Object.hasOwn(change, 'boundaryMode')) {
      boundaryMode = isWrapActive ? 'toroidal' : 'reflective';
    }
  }

  if (Object.hasOwn(change, 'boundaryMode')) boundaryMode = change.boundaryMode;
  if (!BOUNDARY_MODES.has(boundaryMode)) {
    throw new RangeError('boundaryMode must be toroidal or reflective');
  }

  const laws = new Set(activeLawIds);
  if (boundaryMode === 'toroidal') laws.add(WRAP_LAW_ID);
  else laws.delete(WRAP_LAW_ID);

  return Object.freeze({
    boundaryMode,
    activeLawIds: Object.freeze([...laws].sort()),
  });
}

function validateConfig(config, label) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError(label + ' must be an object');
  }
  if (!BOUNDARY_MODES.has(config.boundaryMode)) {
    throw new RangeError(label + '.boundaryMode must be toroidal or reflective');
  }
  if (!Array.isArray(config.activeLawIds) ||
      config.activeLawIds.some(id => typeof id !== 'string' || !id)) {
    throw new TypeError(label + '.activeLawIds must be an array of non-empty strings');
  }
  if (new Set(config.activeLawIds).size !== config.activeLawIds.length) {
    throw new TypeError(label + '.activeLawIds cannot contain duplicates');
  }
  if (config.activeLawIds.includes(WRAP_LAW_ID) !== (config.boundaryMode === 'toroidal')) {
    throw new Error(label + ' has contradictory boundaryMode and law.wrap state');
  }
}
