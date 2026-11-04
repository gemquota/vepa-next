/**
 * Validate the semantic contract between a law catalog and executable registry.
 *
 * The caller supplies stable IDs from the canonical catalog and the IDs that
 * have executable implementations. Metadata-only laws must be explicitly
 * allow-listed; they are never silently treated as implemented.
 */
export function validateLawManifest({
  declaredIds,
  implementedIds,
  metadataOnlyAllowlist = [],
} = {}) {
  const errors = [];
  const normalize = (values, label) => {
    if (!Array.isArray(values)) {
      errors.push(`${label} must be an array`);
      return [];
    }
    const seen = new Set();
    for (const id of values) {
      if (typeof id !== 'string' || id.length === 0) {
        errors.push(`${label} contains an invalid ID`);
      } else if (seen.has(id)) {
        errors.push(`${label} contains duplicate ID: ${id}`);
      }
      seen.add(id);
    }
    return [...seen];
  };

  const declared = normalize(declaredIds, 'declaredIds');
  const implemented = normalize(implementedIds, 'implementedIds');
  const allowlisted = normalize(metadataOnlyAllowlist, 'metadataOnlyAllowlist');
  const declaredSet = new Set(declared);
  const implementedSet = new Set(implemented);
  const allowlistedSet = new Set(allowlisted);

  for (const id of implemented) {
    if (!declaredSet.has(id)) errors.push(`implementation is not declared: ${id}`);
  }
  for (const id of allowlisted) {
    if (!declaredSet.has(id)) errors.push(`allow-listed law is not declared: ${id}`);
    if (implementedSet.has(id)) errors.push(`implemented law must not be allow-listed metadata-only: ${id}`);
  }
  for (const id of declared) {
    if (!implementedSet.has(id) && !allowlistedSet.has(id)) {
      errors.push(`declared law has no implementation or explicit disposition: ${id}`);
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    declaredCount: declaredSet.size,
    implementedCount: implementedSet.size,
    metadataOnlyCount: allowlistedSet.size,
  });
}
