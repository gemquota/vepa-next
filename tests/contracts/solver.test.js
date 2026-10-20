import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { stepParticleWorld } from '../../src/sim/solver.js';

function pair(x1 = 40, x2 = 50) {
 const view = new Float64Array(2 * STRIDE);
 for (const [i, x] of [[0, x1], [1, x2]]) { const b = i * STRIDE; view[b + S.POS_X] = x; view[b + S.POS_Y] = 50; view[b + S.POS_Z] = 50; view[b + S.MASS] = 1; view[b + S.RADIUS] = 0.1; }
 return view;
}
const options = { worldSize: 100, dt: 1, gravitationalConstant: 1, softening: 1, interactionRadius: 20, resolveContacts: false };

test('pair gravity attracts both particles with equal and opposite momentum change', () => {
 const view = pair(); const result = stepParticleWorld(view, 2, options);
 assert.equal(result.interactions, 1); assert.ok(view[S.POS_X] > 40); assert.ok(view[STRIDE + S.POS_X] < 50);
 assert.ok(Math.abs(view[S.VEL_X] + view[STRIDE + S.VEL_X]) < 1e-12);
});

test('disabled gravity integrates velocity without applying forces', () => {
 const view = pair(); view[S.VEL_X] = 2;
 const result = stepParticleWorld(view, 2, { ...options, activeLawIds: [] });
 assert.equal(result.interactions, 0); assert.equal(view[S.POS_X], 42); assert.equal(view[S.VEL_X], 2);
});

test('periodic boundary uses shortest displacement', () => {
 const view = pair(1, 99); stepParticleWorld(view, 2, options);
 assert.ok(view[S.VEL_X] < 0); assert.ok(view[STRIDE + S.VEL_X] > 0);
});

test('invalid numeric state is rejected before mutation', () => {
 const view = pair(); view[STRIDE + S.POS_Y] = Number.NaN;
 assert.throws(() => stepParticleWorld(view, 2, options), /Non-finite particle state/);
 assert.equal(view[S.POS_X], 40);
});


test('drag law damps velocity exponentially without requiring gravity', () => {
 const view = pair(); view[S.VEL_X] = 2;
 stepParticleWorld(view, 2, { ...options, activeLawIds: ['law.drag'], gravitationalConstant: 0, dragCoefficient: 0.5 });
 assert.ok(Math.abs(view[S.VEL_X] - 2 * Math.exp(-0.5)) < 1e-12);
});

test('collision law activates positional contact correction', () => {
 const view = pair(40, 44); view[S.RADIUS] = 3; view[STRIDE + S.RADIUS] = 3;
 stepParticleWorld(view, 2, { ...options, activeLawIds: ['law.collision'], gravitationalConstant: 0, resolveContacts: true, contactIterations: 4 });
 assert.ok(view[STRIDE + S.POS_X] - view[S.POS_X] > 4);
});
