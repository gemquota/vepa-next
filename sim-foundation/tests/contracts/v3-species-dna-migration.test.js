import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DNA_PACK_MAX,
  V3_SPECIES_DNA_STRIDE,
  migrateV3SpeciesDNABuffer,
} from '../../src/sim/v3-species-dna-migration.js';

const decode = (raw, min, max) => min + (raw / DNA_PACK_MAX) * (max - min);

test('preserves shared traits whose ranges did not change', () => {
  const source = new Uint16Array(V3_SPECIES_DNA_STRIDE);
  for (let i = 0; i < 42; i += 1) source[i] = (i * 997) % 65536;
  const migrated = migrateV3SpeciesDNABuffer(source, { speciesCount: 1 });
  for (let i = 0; i < 42; i += 1) {
    if (i !== 29 && i !== 33) assert.equal(migrated[i], source[i], `trait ${i}`);
  }
});

test('converts changed base-radius and magnetic-moment ranges semantically', () => {
  const source = new Uint16Array(V3_SPECIES_DNA_STRIDE);
  source[29] = 10348; // V3 value is approximately 2, within both schemas
  source[33] = 32768;
  const migrated = migrateV3SpeciesDNABuffer(source, { speciesCount: 1 });
  assert.ok(Math.abs(decode(source[29], 0.5, 10) - decode(migrated[29], 0.2, 4)) <= (9.5 + 3.8) / DNA_PACK_MAX);
  assert.ok(Math.abs(decode(source[33], 0, 1) - decode(migrated[33], -1, 1)) <= 2 / DNA_PACK_MAX);
});

test('clamps legacy values that exceed a narrowed current trait range', () => {
  const source = new Uint16Array(64);
  source[29] = DNA_PACK_MAX; // V3 base radius 10; current maximum is 4.
  const migrated = migrateV3SpeciesDNABuffer(source, { speciesCount: 1 });
  assert.equal(migrated[29], DNA_PACK_MAX);
});

test('initializes the 22 appended traits to current schema defaults', () => {
  const migrated = migrateV3SpeciesDNABuffer(new Uint16Array(64), { speciesCount: 1 });
  const ranges = [
    [0,1,.5],[0,.5,.1],[0,.1,.01],[0,1,.5],[0,1,.2],[-1,1,0],
    [1,8,2],[0,1,.1],[0,1,.05],[0,1,.5],[0,1,.1],[0,1,.5],
    [0,1,.5],[0,1,.2],[0,1,.05],[0,1,.1],[-1,1,0],[0,1,.5],
    [0,1,.5],[1,4,2],[0,1,.5],[1,10,3],
  ];
  for (let i = 0; i < ranges.length; i += 1) {
    const [min,max,value] = ranges[i];
    assert.ok(Math.abs(decode(migrated[42+i], min, max) - value) <= (max-min) / DNA_PACK_MAX);
  }
});

test('maps multiple species by explicit stride without mutating source', () => {
  const source = new Uint16Array(2 * V3_SPECIES_DNA_STRIDE);
  source[0] = 1234;
  source[V3_SPECIES_DNA_STRIDE] = 4321;
  const before = source.slice();
  const migrated = migrateV3SpeciesDNABuffer(source, { speciesCount: 2 });
  assert.equal(migrated.length, 128);
  assert.equal(migrated[0], 1234);
  assert.equal(migrated[64], 4321);
  assert.deepEqual(source, before);
});

test('rejects unsupported, ambiguous and malformed buffers', () => {
  assert.throws(() => migrateV3SpeciesDNABuffer([], { speciesCount: 0 }), /Uint16Array/);
  assert.throws(() => migrateV3SpeciesDNABuffer(new Uint16Array(64)), /speciesCount/);
  assert.throws(() => migrateV3SpeciesDNABuffer(new Uint16Array(63), { speciesCount: 1 }), /length mismatch/);
  assert.throws(() => migrateV3SpeciesDNABuffer(new Uint16Array(65), { speciesCount: 1 }), /length mismatch/);
  assert.throws(() => migrateV3SpeciesDNABuffer(new Uint16Array(64), { speciesCount: -1 }), /speciesCount/);
});
