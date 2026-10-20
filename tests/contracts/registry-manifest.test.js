import test from 'node:test';
import assert from 'node:assert/strict';
import { createLawRegistry } from '../../src/sim/law-registry.js';

test('registry reports implementation status to the manifest validator', () => {
 const registry = createLawRegistry();
 registry.register({ id: 'law.gravity', version: 1, step() {} });
 const allowed = registry.validateManifest({ declaredIds: ['law.gravity', 'law.wrap'], metadataOnlyAllowlist: ['law.wrap'] });
 assert.equal(allowed.valid, true);
 const missing = registry.validateManifest({ declaredIds: ['law.gravity', 'law.wrap'] });
 assert.equal(missing.valid, false);
});
