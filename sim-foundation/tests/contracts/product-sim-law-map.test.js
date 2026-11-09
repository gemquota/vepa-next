import test from 'node:test';
import assert from 'node:assert/strict';
import { LAW_MIGRATION_MANIFEST } from '../../src/sim/law-migration-manifest.js';
import { mapProductLawNames } from '../../src/interop/product-shadow-runtime.js';

test('product ACCR cannot be silently mapped to SIM accretion fusion', () => {
  const productAccr = LAW_MIGRATION_MANIFEST.find(law => law.canonicalId === 'law.accretion');
  assert.equal(productAccr.runtimeStatus, 'catalog-only');
  assert.match(productAccr.implementationNote, /structural adjacency/i);
  const mapped = mapProductLawNames(['GRAV', 'ACCR']);
  assert.deepEqual(mapped.activeLawIds, ['law.gravity']);
  assert.deepEqual(mapped.unsupportedLawNames, ['ACCR']);
});

test('only explicitly parity-reviewed product laws enter the SIM shadow', () => {
  const mapped = mapProductLawNames(['GRAV', 'DRAG', 'COLL', 'CHARGE_LAW', 'ENTR', 'BUOYANCY', 'BOND', 'TIDE', 'FRICTION', 'HORIZON', 'RADIATION_PRESSURE', 'FIELD']);
  assert.equal(mapped.activeLawIds.length, 12);
  assert.deepEqual(mapped.unsupportedLawNames, []);
  for (const id of ['law.tide', 'law.friction', 'law.horizon', 'law.radiation-pressure', 'law.field']) {
    assert.equal(LAW_MIGRATION_MANIFEST.find(law => law.canonicalId === id).runtimeStatus, 'executable');
  }
  const unknown = mapProductLawNames(['ELECTRIC_FIELD']);
  assert.deepEqual(unknown.unsupportedLawNames, ['ELECTRIC_FIELD']);
});
