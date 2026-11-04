import test from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateV3WorldCore,
  V3_WORLD_CORE_SCHEMA,
} from '../../src/sim/v3-world-core-migration.js';

test('composes particle, species DNA and all five law words', () => {
  const particles = new Float32Array(64);
  particles[0] = 12;
  const dna = new Uint16Array(64);
  dna[4] = 321;
  const result = migrateV3WorldCore({
    particleBuffer: particles,
    particleCount: 1,
    speciesDnaBuffer: dna,
    speciesCount: 1,
    lawFlags: { low: 1, high: 0, ext: 0, quad: 0, penta: 1 << 7 },
  });
  assert.equal(result.schema, V3_WORLD_CORE_SCHEMA);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.particleState.buffer.length, 100);
  assert.equal(result.particleState.buffer[0], 12);
  assert.equal(result.speciesGenome.buffer[4], 321);
  assert.deepEqual(result.laws.activeLawIds, ['law.gravity', 'law.adhesion']);
  assert.deepEqual(result.warnings, []);
});

test('reports omitted sections and missing legacy law words', () => {
  const result = migrateV3WorldCore({
    particleBuffer: new Float32Array(64),
    particleCount: 1,
    lawFlags: { low: 1 },
  });
  assert.equal(result.speciesGenome, null);
  assert.equal(result.laws.activeLawIds[0], 'law.gravity');
  assert.ok(result.warnings.some(item => item.code === 'missing-section' && item.section === 'speciesDnaBuffer'));
  assert.deepEqual(result.warnings.filter(item => item.code === 'missing-law-word').map(item => item.key), ['high', 'ext', 'quad', 'penta']);
});

test('rejects malformed particle and genome counts through their strict adapters', () => {
  assert.throws(() => migrateV3WorldCore({ particleBuffer: new Float32Array(64) }), /particleCount/);
  assert.throws(() => migrateV3WorldCore({ speciesDnaBuffer: new Uint16Array(64) }), /speciesCount/);
});

test('rejects payloads with no migratable sections', () => {
  assert.throws(() => migrateV3WorldCore({}), /no migratable sections/);
  assert.throws(() => migrateV3WorldCore(null), /must be an object/);
});

test('declares world state that this partial adapter does not claim to migrate', () => {
  const result = migrateV3WorldCore({ lawFlags: { low: 0, high: 0, ext: 0, quad: 0, penta: 0 } });
  assert.ok(result.unsupportedState.includes('prngState'));
  assert.ok(result.unsupportedState.includes('saveEnvelope'));
  assert.ok(Object.isFrozen(result));
});
