import { migrateV3ParticleBuffer } from './v3-particle-migration.js';
import { migrateV3SpeciesDNABuffer } from './v3-species-dna-migration.js';
import { migrateLegacyLawFlags } from './legacy-law-flag-migration.js';

export const V3_WORLD_CORE_SCHEMA = 'vepa.v3-world-core';
export const V3_WORLD_CORE_SCHEMA_VERSION = 1;

/**
 * Compose the independently versioned V3 particle, species-genome and law
 * adapters into one explicit partial-world import. This is deliberately not
 * a full save importer: callers must separately migrate world metadata,
 * configuration, PRNG, worker lifecycle, fields, history and save envelopes.
 */
export function migrateV3WorldCore(source = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('V3 world core source must be an object');
  }

  const warnings = [];
  const migrated = {
    schema: V3_WORLD_CORE_SCHEMA,
    schemaVersion: V3_WORLD_CORE_SCHEMA_VERSION,
    sourceVersion: 3,
    particleState: null,
    speciesGenome: null,
    laws: null,
    warnings,
    unsupportedState: Object.freeze([
      'speciesMetadata',
      'worldConfig',
      'prngState',
      'workerLifecycle',
      'fields',
      'history',
      'checkpoints',
      'eventJournal',
      'saveEnvelope',
    ]),
  };

  if (Object.hasOwn(source, 'particleBuffer')) {
    const buffer = migrateV3ParticleBuffer(source.particleBuffer, {
      particleCount: source.particleCount,
    });
    migrated.particleState = Object.freeze({
      layoutVersion: 1,
      particleCount: source.particleCount,
      buffer,
    });
  } else {
    warnings.push(Object.freeze({ code: 'missing-section', section: 'particleBuffer' }));
  }

  if (Object.hasOwn(source, 'speciesDnaBuffer')) {
    const buffer = migrateV3SpeciesDNABuffer(source.speciesDnaBuffer, {
      speciesCount: source.speciesCount,
    });
    migrated.speciesGenome = Object.freeze({
      schemaVersion: 4,
      speciesCount: source.speciesCount,
      buffer,
    });
  } else {
    warnings.push(Object.freeze({ code: 'missing-section', section: 'speciesDnaBuffer' }));
  }

  if (Object.hasOwn(source, 'lawFlags')) {
    const result = migrateLegacyLawFlags(source.lawFlags);
    migrated.laws = Object.freeze({
      schemaVersion: 1,
      inventoryCount: result.lawInventoryCount,
      activeLawIds: result.activeLawIds,
    });
    warnings.push(...result.warnings);
  } else {
    warnings.push(Object.freeze({ code: 'missing-section', section: 'lawFlags' }));
  }

  if (!migrated.particleState && !migrated.speciesGenome && !migrated.laws) {
    throw new TypeError('V3 world core source contains no migratable sections');
  }

  migrated.warnings = Object.freeze(warnings);
  return Object.freeze(migrated);
}
