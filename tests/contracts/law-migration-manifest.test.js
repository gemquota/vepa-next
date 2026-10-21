import test from 'node:test';
import assert from 'node:assert/strict';
import { LAW_MIGRATION_MANIFEST, LAW_MIGRATION_SUMMARY } from '../../src/sim/law-migration-manifest.js';

test('migration ledger covers every stable law exactly once', () => {
 assert.equal(LAW_MIGRATION_MANIFEST.length, 136);
 assert.equal(new Set(LAW_MIGRATION_MANIFEST.map(law => law.canonicalId)).size, 136);
 assert.deepEqual(LAW_MIGRATION_MANIFEST.map(law => law.stableIndex), Array.from({ length: 136 }, (_, i) => i));
});

test('only laws with executable solver coverage are marked executable', () => {
 assert.equal(LAW_MIGRATION_SUMMARY.executable, 8);
 assert.equal(LAW_MIGRATION_SUMMARY.catalogOnly, 128);
 for (const law of LAW_MIGRATION_MANIFEST) {
  assert.ok(['executable', 'catalog-only'].includes(law.runtimeStatus));
  assert.ok(law.primitiveClass.length > 0);
 }
});
