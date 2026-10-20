import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeBoundaryChange } from '../../src/sim/boundary-contract.js';

const toroidal = { boundaryMode: 'toroidal', activeLawIds: ['law.gravity', 'law.wrap'] };
const reflective = { boundaryMode: 'reflective', activeLawIds: ['law.gravity'] };

test('bulk clear preserves boundary mode and removes legacy WRAP from law IDs', () => {
 assert.deepEqual(proposeBoundaryChange(toroidal, { activeLawIds: [] }), { boundaryMode: 'toroidal', activeLawIds: [] });
});
test('removing legacy WRAP from a non-empty list requests reflective mode', () => {
 assert.deepEqual(proposeBoundaryChange(toroidal, { activeLawIds: ['law.gravity'] }), { boundaryMode: 'reflective', activeLawIds: ['law.gravity'] });
});
test('adding legacy WRAP requests toroidal mode without storing it as a law', () => {
 assert.deepEqual(proposeBoundaryChange(reflective, { activeLawIds: ['law.gravity', 'law.wrap'] }), { boundaryMode: 'toroidal', activeLawIds: ['law.gravity'] });
});
test('explicit boundary mode wins', () => {
 assert.deepEqual(proposeBoundaryChange(toroidal, { boundaryMode: 'reflective' }), { boundaryMode: 'reflective', activeLawIds: ['law.gravity'] });
 assert.deepEqual(proposeBoundaryChange(reflective, { boundaryMode: 'toroidal' }), { boundaryMode: 'toroidal', activeLawIds: ['law.gravity'] });
});
test('rejects invalid modes and duplicate law IDs', () => {
 assert.throws(() => proposeBoundaryChange(reflective, { boundaryMode: 'wraparound' }), /boundaryMode/);
 assert.throws(() => proposeBoundaryChange(reflective, { activeLawIds: ['law.gravity', 'law.gravity'] }), /duplicates/);
});
