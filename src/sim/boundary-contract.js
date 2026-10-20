const LEGACY_WRAP_ID = 'law.wrap';
const MODES = new Set(['toroidal', 'reflective']);

// Boundary mode is canonical. WRAP is accepted as a legacy V5 alias, not a runtime law.
export function proposeBoundaryChange(current, change) {
  validate(current, 'current');
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw new TypeError('change must be an object');
  let boundaryMode = current.boundaryMode;
  let activeLawIds = current.activeLawIds.filter(id => id !== LEGACY_WRAP_ID);
  if (Array.isArray(change.activeLawIds)) {
    const requested = [...change.activeLawIds];
    if (requested.some(id => typeof id !== 'string' || !id)) throw new TypeError('activeLawIds must contain non-empty strings');
    if (new Set(requested).size !== requested.length) throw new TypeError('activeLawIds cannot contain duplicates');
    activeLawIds = requested.filter(id => id !== LEGACY_WRAP_ID);
    if (!Object.hasOwn(change, 'boundaryMode')) {
      if (requested.includes(LEGACY_WRAP_ID)) boundaryMode = 'toroidal';
      else if (current.activeLawIds.includes(LEGACY_WRAP_ID) && requested.length > 0) boundaryMode = 'reflective';
    }
  }
  if (Object.hasOwn(change, 'boundaryMode')) boundaryMode = change.boundaryMode;
  if (!MODES.has(boundaryMode)) throw new RangeError('boundaryMode must be toroidal or reflective');
  return Object.freeze({ boundaryMode, activeLawIds: Object.freeze([...new Set(activeLawIds)].sort()) });
}

function validate(config, label) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError(label + ' must be an object');
  if (!MODES.has(config.boundaryMode)) throw new RangeError(label + '.boundaryMode must be toroidal or reflective');
  if (!Array.isArray(config.activeLawIds) || config.activeLawIds.some(id => typeof id !== 'string' || !id)) throw new TypeError(label + '.activeLawIds must be an array of non-empty strings');
  if (new Set(config.activeLawIds).size !== config.activeLawIds.length) throw new TypeError(label + '.activeLawIds cannot contain duplicates');
}
