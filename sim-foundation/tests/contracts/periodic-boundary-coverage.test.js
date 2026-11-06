import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { stepParticleWorld } from '../../src/sim/solver.js';

const options = { worldSize: 100, dt: 0.01, gravitationalConstant: 1, electricConstant: 0,
  dragCoefficient: 0, softening: 0.5, interactionRadius: 20, activeLawIds: ['law.gravity'],
  resolveContacts: false, boundaryMode: 'toroidal', periodicMode: 'minimum-image' };
function pair(a, b) {
  const view = new Float64Array(2 * STRIDE);
  for (const [i, p] of [[0, a], [1, b]]) {
    const base = i * STRIDE;
    view[base + S.POS_X] = p[0]; view[base + S.POS_Y] = p[1]; view[base + S.POS_Z] = p[2];
    view[base + S.MASS] = 1; view[base + S.RADIUS] = 0.1;
  }
  return view;
}
function velocity(view, i) {
  const b = i * STRIDE;
  return [view[b + S.VEL_X], view[b + S.VEL_Y], view[b + S.VEL_Z]];
}
function compareTranslated(a, b) {
  stepParticleWorld(a, 2, options);
  stepParticleWorld(b, 2, options);
  for (let i = 0; i < 2; i++) for (let axis = 0; axis < 3; axis++) {
    assert.ok(Math.abs(velocity(a, i)[axis] - velocity(b, i)[axis]) < 1e-12);
  }
}

test('minimum-image forces are translation invariant across a face', () => {
  compareTranslated(pair([0.1, 40, 40], [99.9, 40, 40]), pair([20.1, 40, 40], [19.9, 40, 40]));
});

test('minimum-image forces are translation invariant across an edge', () => {
  compareTranslated(pair([0.1, 0.1, 40], [99.9, 99.9, 40]), pair([20.1, 20.1, 40], [19.9, 19.9, 40]));
});

test('minimum-image forces are translation invariant across a corner', () => {
  compareTranslated(pair([0.1, 0.1, 0.1], [99.9, 99.9, 99.9]), pair([20.1, 20.1, 20.1], [19.9, 19.9, 19.9]));
});

test('pair forces remain equal and opposite at every periodic stratum', () => {
  for (const [a, b] of [
    [[0.1, 40, 40], [99.9, 40, 40]],
    [[0.1, 0.1, 40], [99.9, 99.9, 40]],
    [[0.1, 0.1, 0.1], [99.9, 99.9, 99.9]],
  ]) {
    const view = pair(a, b);
    stepParticleWorld(view, 2, options);
    for (let axis = 0; axis < 3; axis++) {
      const sum = velocity(view, 0)[axis] + velocity(view, 1)[axis];
      assert.ok(Math.abs(sum) < 1e-12);
    }
  }
});
