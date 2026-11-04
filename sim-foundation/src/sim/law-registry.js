import { validateLawManifest } from './law-manifest.js';

const ID = /^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/;

export function createLawRegistry() {
  const laws = new Map();

  return Object.freeze({
    register(definition) {
      if (!definition || typeof definition !== 'object') throw new TypeError('Law definition must be an object');
      if (typeof definition.id !== 'string' || !ID.test(definition.id)) throw new TypeError('Law id must be namespaced');
      if (laws.has(definition.id)) throw new Error(`Duplicate law id: ${definition.id}`);
      if (!Number.isInteger(definition.version) || definition.version < 1) throw new TypeError('Law version must be a positive integer');
      if (typeof definition.step !== 'function') throw new TypeError('Law must provide step(context)');
      const normalized = Object.freeze({
        id: definition.id,
        version: definition.version,
        category: String(definition.category ?? 'uncategorized'),
        experimental: definition.experimental === true,
        dependencies: Object.freeze([...(definition.dependencies ?? [])]),
        step: definition.step,
      });
      laws.set(normalized.id, normalized);
      return normalized;
    },
    get(id) { return laws.get(id); },
    list() { return [...laws.values()].sort((a, b) => a.id.localeCompare(b.id)); },
    has(id) { return laws.has(id); },
    validateManifest({ declaredIds, metadataOnlyAllowlist = [] } = {}) {
      return validateLawManifest({
        declaredIds,
        implementedIds: [...laws.keys()],
        metadataOnlyAllowlist,
      });
    },
  });
}
