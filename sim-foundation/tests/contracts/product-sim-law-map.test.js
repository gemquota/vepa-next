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

test('only the seven explicitly parity-reviewed product laws enter the SIM shadow', () => {
  const mapped = mapProductLawNames(['GRAV', 'DRAG', 'COLL', 'CHARGE_LAW', 'ENTR', 'BUOYANCY', 'BOND']);
  assert.equal(mapped.activeLawIds.length, 7);
  assert.deepEqual(mapped.unsupportedLawNames, []);
  const unknown = mapProductLawNames(['ELECTRIC_FIELD']);
  assert.deepEqual(unknown.unsupportedLawNames, ['ELECTRIC_FIELD']);
});
