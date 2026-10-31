import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE } from '../../src/sim/particle-layout.js';
import {
  V3_PARTICLE_STRIDE,
  migrateV3ParticleBuffer,
} from '../../src/sim/v3-particle-migration.js';

test('migrates every legacy slot at the same offset and zero-initializes appended state', () => {
  const source = new Float64Array(V3_PARTICLE_STRIDE);
  for (let i = 0; i < source.length; i += 1) source[i] = i + 0.25;
  const migrated = migrateV3ParticleBuffer(source, { particleCount: 1 });

  assert.ok(migrated instanceof Float64Array);
  assert.equal(migrated.length, PARTICLE_STRIDE);
  for (let i = 0; i < V3_PARTICLE_STRIDE; i += 1) assert.equal(migrated[i], source[i]);
  for (let i = V3_PARTICLE_STRIDE; i < PARTICLE_STRIDE; i += 1) assert.equal(migrated[i], 0);
});

test('preserves cached DNA values and maps multiple particles without stride overlap', () => {
  const source = new Float32Array(2 * V3_PARTICLE_STRIDE);
  source[8] = 1.25;
  source[49] = 42.5;
  source[V3_PARTICLE_STRIDE + 8] = 2.5;
  source[V3_PARTICLE_STRIDE + 63] = 63.75;

  const migrated = migrateV3ParticleBuffer(source, { particleCount: 2 });
  assert.equal(migrated[8], 1.25);
  assert.equal(migrated[49], 42.5);
  assert.equal(migrated[PARTICLE_STRIDE + 8], 2.5);
  assert.equal(migrated[PARTICLE_STRIDE + 63], 63.75);
  assert.equal(migrated[64], 0);
  assert.equal(migrated[PARTICLE_STRIDE + 64], 0);
});

test('does not mutate the source buffer', () => {
  const source = new Float64Array(V3_PARTICLE_STRIDE).fill(7);
  const before = source.slice();
  migrateV3ParticleBuffer(source, { particleCount: 1 });
  assert.deepEqual(source, before);
});

test('rejects unsupported buffers, missing counts, and malformed lengths', () => {
  assert.throws(() => migrateV3ParticleBuffer([1, 2], { particleCount: 0 }), /Float32Array or Float64Array/);
  assert.throws(() => migrateV3ParticleBuffer(new Float64Array(64)), /particleCount/);
  assert.throws(() => migrateV3ParticleBuffer(new Float64Array(63), { particleCount: 1 }), /length mismatch/);
  assert.throws(() => migrateV3ParticleBuffer(new Float64Array(65), { particleCount: 1 }), /length mismatch/);
  assert.throws(() => migrateV3ParticleBuffer(new Float64Array(64), { particleCount: -1 }), /particleCount/);
});

test('rejects non-finite legacy values before returning a migrated buffer', () => {
  const source = new Float64Array(V3_PARTICLE_STRIDE);
  source[17] = Number.NaN;
  assert.throws(() => migrateV3ParticleBuffer(source, { particleCount: 1 }), /non-finite value at index 17/);
});
