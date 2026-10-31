import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyLawFlags } from '../../src/sim/legacy-law-flag-migration.js';

const bit = (index) => (1 << (index % 32));

test('maps all five legacy flag words to canonical law IDs by stable index', () => {
  const legacy = { low: bit(31), high: bit(32), ext: bit(64), quad: bit(127), penta: bit(135) };
  const result = migrateLegacyLawFlags(legacy);
  assert.deepEqual(result.activeLawIds, ['law.field', 'law.antimatter', 'law.adhesion', 'law.void', 'law.bond']);
  assert.equal(result.lawInventoryCount, 136);
  assert.deepEqual(result.warnings, []);
});

test('accepts signed int32 words from JSON serialization', () => {
  const result = migrateLegacyLawFlags({ low: -2147483648, high: 0, ext: 0, quad: 0, penta: 0 });
  assert.deepEqual(result.activeLawIds, ['law.antimatter']);
});

test('warns when legacy saves omit trailing law words instead of claiming those laws are off', () => {
  const result = migrateLegacyLawFlags({ low: 1, high: 0, ext: 0 });
  assert.deepEqual(result.activeLawIds, ['law.gravity']);
  assert.deepEqual(result.warnings.map(w => w.key), ['quad', 'penta']);
  assert.deepEqual(result.warnings.map(w => [w.firstIndex, w.lastIndex]), [[96, 127], [128, 135]]);
});

test('rejects malformed legacy words and payloads', () => {
  assert.throws(() => migrateLegacyLawFlags(null), /object/);
  assert.throws(() => migrateLegacyLawFlags({ low: 1.5 }), /32-bit integer/);
  assert.throws(() => migrateLegacyLawFlags({ low: 4294967296 }), /32-bit integer/);
});
