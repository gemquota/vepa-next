import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeBoundaryChange } from '../../src/sim/boundary-contract.js';

const toroidal = { boundaryMode: 'toroidal', activeLawIds: ['law.gravity', 'law.wrap'] };
const reflective = { boundaryMode: 'reflective', activeLawIds: ['law.gravity'] };

test('toroidal boundary always retains WRAP when other laws are cleared', () => {
  assert.deepEqual(proposeBoundaryChange(toroidal, { activeLawIds: [] }), {
    boundaryMode: 'toroidal',
    activeLawIds: ['law.wrap'],
  });
});

test('explicitly disabling WRAP changes boundary mode to reflective', () => {
  assert.deepEqual(proposeBoundaryChange(toroidal, { activeLawIds: ['law.gravity'] }), {
    boundaryMode: 'reflective',
    activeLawIds: ['law.gravity'],
  });
});

test('enabling WRAP activates toroidal boundary semantics', () => {
  assert.deepEqual(proposeBoundaryChange(reflective, { activeLawIds: ['law.gravity', 'law.wrap'] }), {
    boundaryMode: 'toroidal',
    activeLawIds: ['law.gravity', 'law.wrap'],
  });
});

test('explicit boundary mode wins and synchronizes WRAP in either direction', () => {
  assert.deepEqual(proposeBoundaryChange(toroidal, { boundaryMode: 'reflective' }), {
    boundaryMode: 'reflective',
    activeLawIds: ['law.gravity'],
  });
  assert.deepEqual(proposeBoundaryChange(reflective, { boundaryMode: 'toroidal' }), {
    boundaryMode: 'toroidal',
    activeLawIds: ['law.gravity', 'law.wrap'],
  });
});

test('rejects contradictory current state and invalid boundary modes', () => {
  assert.throws(() => proposeBoundaryChange(reflective, { boundaryMode: 'wraparound' }), /boundaryMode/);
  assert.throws(() => proposeBoundaryChange({ boundaryMode: 'toroidal', activeLawIds: [] }, {}), /contradictory/);
});
