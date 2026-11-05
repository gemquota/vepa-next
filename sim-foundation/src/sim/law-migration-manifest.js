import { STABLE_LAW_INVENTORY } from './stable-law-inventory.js';

/**
 * Runtime migration ledger for the full stable 136-law catalogue.
 * The stable inventory remains the authority for identity/category. This overlay
 * records what Next can actually execute today and prevents catalogue presence
 * from being mistaken for runtime parity.
 */
const EXECUTABLE = new Set([
  'law.gravity', 'law.drag', 'law.collision', 'law.charge',
  'law.entrainment', 'law.buoyancy', 'law.accretion', 'law.bond',
]);

const PRIMITIVE_CLASS = Object.freeze({
  physics: 'pairwise-force/contact',
  biology: 'particle-state-transition',
  chemistry: 'state-transition/reaction',
  thermodynamics: 'field/state-transition',
  electromagnetism: 'field/circuit',
  metaphysics: 'semantic/state-machine',
});

const FOUNDATIONAL = new Set([
  'law.gravity', 'law.drag', 'law.collision', 'law.charge',
  'law.entrainment', 'law.buoyancy', 'law.accretion', 'law.bond',
  'law.energy', 'law.heat', 'law.current', 'law.electric-field',
]);

export const LAW_MIGRATION_MANIFEST = Object.freeze(STABLE_LAW_INVENTORY.map(law => Object.freeze({
  ...law,
  runtimeStatus: EXECUTABLE.has(law.canonicalId) ? 'executable' : 'catalog-only',
  primitiveClass: PRIMITIVE_CLASS[law.category] ?? 'unclassified',
  migrationPriority: EXECUTABLE.has(law.canonicalId) ? 'done' : FOUNDATIONAL.has(law.canonicalId) ? 'next-foundation' : 'queued',
  implementationNote: EXECUTABLE.has(law.canonicalId)
    ? 'Covered by the deterministic Next particle solver.'
    : 'Requires a concrete simulation primitive before it can be claimed executable.',
})));

export const LAW_MIGRATION_SUMMARY = Object.freeze({
  total: LAW_MIGRATION_MANIFEST.length,
  executable: LAW_MIGRATION_MANIFEST.filter(law => law.runtimeStatus === 'executable').length,
  catalogOnly: LAW_MIGRATION_MANIFEST.filter(law => law.runtimeStatus === 'catalog-only').length,
  byCategory: Object.freeze(Object.fromEntries(
    [...new Set(LAW_MIGRATION_MANIFEST.map(law => law.category))].map(category => [
      category,
      LAW_MIGRATION_MANIFEST.filter(law => law.category === category).length,
    ]),
  )),
});

if (LAW_MIGRATION_SUMMARY.total !== 136) throw new Error(`Expected 136 stable laws, got ${LAW_MIGRATION_SUMMARY.total}`);
