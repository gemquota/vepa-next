import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';
import { resolveParticleContacts } from '../../src/sim/contact-constraints.js';

function pair({ x1 = 49, x2 = 50, m1 = 1, m2 = 1, vx1 = 1, vx2 = -1 } = {}) {
  const state = new Float64Array(2 * STRIDE);
  for (const [i, x, mass, vx] of [[0, x1, m1, vx1], [1, x2, m2, vx2]]) {
    const b = i * STRIDE;
    state[b + S.POS_X] = x; state[b + S.POS_Y] = 50; state[b + S.POS_Z] = 50;
    state[b + S.MASS] = mass; state[b + S.RADIUS] = 1; state[b + S.VEL_X] = vx;
  }
  return state;
}
function momentum(state) {
  return state[S.MASS] * state[S.VEL_X] + state[STRIDE + S.MASS] * state[STRIDE + S.VEL_X];
}
function kinetic(state) {
  return 0.5 * state[S.MASS] * state[S.VEL_X] ** 2 + 0.5 * state[STRIDE + S.MASS] * state[STRIDE + S.VEL_X] ** 2;
}

test('positional contact correction preserves mass-weighted centre of mass', () => {
  const state = pair({ m1: 9, m2: 1, vx1: 0, vx2: 0 });
  const before = (9 * state[S.POS_X] + state[STRIDE + S.POS_X]) / 10;
  resolveParticleContacts(state, 2, STRIDE, 100, false, 8, S);
  const after = (9 * state[S.POS_X] + state[STRIDE + S.POS_X]) / 10;
  assert.ok(Math.abs(after - before) < 1e-10);
  assert.ok(state[STRIDE + S.POS_X] - state[S.POS_X] >= 1.999);
});

test('elastic collision impulse conserves momentum and kinetic energy', () => {
  const state = pair();
  const runtime = createParticleExecutionAdapter({
    initialState: state,
    config: { worldSize: 100, boundaryMode: 'toroidal', dt: 0.001,
      gravitationalConstant: 0, electricConstant: 0, dragCoefficient: 0,
      softening: 1, interactionRadius: 10, activeLawIds: [], resolveContacts: false,
      contactIterations: 0, advancedPhysics: { collisions: { enabled: true, restitution: 1, friction: 0 } } },
  });
  const before = runtime.readState();
  runtime.step();
  const after = runtime.readState();
  assert.ok(Math.abs(momentum(after) - momentum(before)) < 1e-12);
  assert.ok(Math.abs(kinetic(after) - kinetic(before)) < 1e-12);
  assert.equal(runtime.readEnergyEvents().filter(event => event.cause === 'inelastic-contact-dissipation').length, 0);
});

test('inelastic collision conserves momentum and routes kinetic loss to thermal ownership', () => {
  const runtime = createParticleExecutionAdapter({
    initialState: pair(),
    config: { worldSize: 100, boundaryMode: 'toroidal', dt: 0.001,
      gravitationalConstant: 0, electricConstant: 0, dragCoefficient: 0,
      softening: 1, interactionRadius: 10, activeLawIds: [], resolveContacts: false,
      contactIterations: 0, advancedPhysics: { collisions: { enabled: true, restitution: 0, friction: 0 } } },
  });
  const before = runtime.readState();
  const initialMomentum = momentum(before), initialKinetic = kinetic(before);
  runtime.step();
  const after = runtime.readState();
  const loss = initialKinetic - kinetic(after);
  assert.ok(Math.abs(momentum(after) - initialMomentum) < 1e-12);
  assert.ok(loss > 0);
  const event = runtime.readEnergyEvents().find(entry => entry.cause === 'inelastic-contact-dissipation');
  assert.ok(event);
  assert.ok(Math.abs(event.amount - loss) < 1e-12);
  assert.equal(event.source, 'kinetic:pair:0:1');
  assert.equal(event.destination, 'thermal:pair:0:1');
});
