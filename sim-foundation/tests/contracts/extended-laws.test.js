import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { stepParticleWorld } from '../../src/sim/solver.js';

function pair(x1 = 40, x2 = 50) {
 const view = new Float64Array(2 * STRIDE);
 for (const [i, x] of [[0, x1], [1, x2]]) {
  const b = i * STRIDE;
  view[b + S.POS_X] = x; view[b + S.POS_Y] = 50; view[b + S.POS_Z] = 50;
  view[b + S.MASS] = 1; view[b + S.RADIUS] = 1; view[b + S.DEAD] = 0;
 }
 return view;
}
const base = { worldSize: 100, dt: 1, gravitationalConstant: 0, electricConstant: 0, softening: 1, interactionRadius: 20, resolveContacts: false };

test('entrainment aligns a particle toward its neighbor velocity', () => {
 const view = pair(); view[S.VEL_X] = 0; view[STRIDE + S.VEL_X] = 10;
 stepParticleWorld(view, 2, { ...base, activeLawIds: ['law.entrainment'], entrainmentCoefficient: 0.5 });
 assert.ok(view[S.VEL_X] > 0 && view[S.VEL_X] < 10);
});

test('buoyancy converts temperature above ambient into upward Y acceleration', () => {
 const view = pair(); view[S.TEMPERATURE] = 10;
 stepParticleWorld(view, 2, { ...base, activeLawIds: ['law.buoyancy'], buoyancyCoefficient: 2, ambientTemperature: 0 });
 assert.equal(view[S.VEL_Y], 20);
 assert.equal(view[S.POS_Y], 70);
});

test('accretion conserves pair mass and retires the consumed particle', () => {
 const view = pair(40, 41); view[S.MASS] = 2; view[STRIDE + S.MASS] = 1;
 view[S.VEL_X] = 1; view[STRIDE + S.VEL_X] = -2;
 stepParticleWorld(view, 2, { ...base, activeLawIds: ['law.accretion'], accretionRadiusMultiplier: 1.25 });
 assert.equal(view[S.MASS], 3);
 assert.equal(view[STRIDE + S.MASS], 0);
 assert.equal(view[STRIDE + S.DEAD], 1);
 assert.ok(Math.abs(view[S.VEL_X] - 0) < 1e-12);
});

test('bond pulls separated partners toward their radius-sum rest length', () => {
 const view = pair(40, 50); view[S.BOND_PARTNER_1] = 1; view[STRIDE + S.BOND_PARTNER_1] = 0;
 stepParticleWorld(view, 2, { ...base, activeLawIds: ['law.bond'], bondStrength: 2, bondDamping: 0 });
 assert.ok(view[S.VEL_X] > 0);
 assert.ok(view[STRIDE + S.VEL_X] < 0);
 assert.ok(Math.abs(view[S.VEL_X] + view[STRIDE + S.VEL_X]) < 1e-12);
});

test('extended laws compose with gravity and charge without losing deterministic symmetry', () => {
 const view = pair(); view[S.CHARGE] = 1; view[STRIDE + S.CHARGE] = -1; view[S.TEMPERATURE] = 1; view[STRIDE + S.TEMPERATURE] = -1;
 const result = stepParticleWorld(view, 2, { ...base, gravitationalConstant: 1, electricConstant: 2, activeLawIds: ['law.gravity','law.charge','law.buoyancy','law.entrainment'] });
 assert.equal(result.liveCount, 2);
 assert.ok(view[S.VEL_X] > 0);
 assert.ok(view[STRIDE + S.VEL_X] < 0);
 assert.ok(view[S.VEL_Y] > 0);
 assert.ok(view[STRIDE + S.VEL_Y] < 0);
});
