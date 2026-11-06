import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';
import { measureParticleState } from '../../src/sim/numerics.js';

function initialPair() {
  const state = new Float64Array(2 * STRIDE);
  for (const [i, x, vx, mass] of [[0, 90, 0, 1], [1, 110, 0, 1]]) {
    const b = i * STRIDE;
    state[b + S.POS_X] = x; state[b + S.POS_Y] = 100; state[b + S.POS_Z] = 100;
    state[b + S.VEL_Y] = i ? 0.02 : -0.02; state[b + S.MASS] = mass; state[b + S.RADIUS] = 0.1;
  }
  return state;
}
const base = {
  worldSize: 200, boundaryMode: 'toroidal', gravitationalConstant: 1,
  electricConstant: 0, dragCoefficient: 0, softening: 0.5,
  interactionRadius: 80, activeLawIds: ['law.gravity'],
  resolveContacts: false, contactIterations: 0,
};

function trajectory(dt, integrator, duration = 0.2) {
  const runtime = createParticleExecutionAdapter({
    initialState: initialPair(),
    config: { ...base, dt, numerics: { integrator, diagnostics: true } },
  });
  const steps = Math.round(duration / dt);
  for (let i = 0; i < steps; i++) runtime.step();
  return runtime.readState();
}
function positionError(a, b) {
  let sum = 0;
  for (const slot of [S.POS_X, S.POS_Y, S.POS_Z, STRIDE + S.POS_X, STRIDE + S.POS_Y, STRIDE + S.POS_Z]) sum += (a[slot] - b[slot]) ** 2;
  return Math.sqrt(sum);
}

test('velocity-Verlet converges toward a fine-step reference as timestep is halved', () => {
  const reference = trajectory(0.0005, 'velocity-verlet');
  const coarse = trajectory(0.01, 'velocity-verlet');
  const fine = trajectory(0.005, 'velocity-verlet');
  const coarseError = positionError(coarse, reference);
  const fineError = positionError(fine, reference);
  assert.ok(fineError < coarseError, `halving dt did not reduce error: coarse=${coarseError}, fine=${fineError}`);
  assert.ok([...fine].every(Number.isFinite));
});

test('semi-implicit Euler remains finite in close-contact, high-force and extreme-mass fixtures', () => {
  const state = new Float64Array(2 * STRIDE);
  for (const [i, x, mass] of [[0, 49.9, 1e6], [1, 50.1, 1e-3]]) {
    const b = i * STRIDE;
    state[b + S.POS_X] = x; state[b + S.POS_Y] = 50; state[b + S.POS_Z] = 50;
    state[b + S.MASS] = mass; state[b + S.RADIUS] = 0.01;
  }
  const runtime = createParticleExecutionAdapter({
    initialState: state,
    config: { ...base, worldSize: 100, dt: 1e-8, gravitationalConstant: 1e4,
      softening: 0.1, interactionRadius: 10, numerics: { integrator: 'semi-implicit-euler', diagnostics: true } },
  });
  for (let i = 0; i < 10; i++) runtime.step();
  const final = runtime.readState();
  assert.ok([...final].every(Number.isFinite));
  assert.equal(measureParticleState(final, 2, STRIDE, S).liveCount, 2);
});

test('periodic-boundary stress remains finite across an edge and corner under small steps', () => {
  const state = new Float64Array(2 * STRIDE);
  for (const [i, p] of [[0, [0.05, 0.05, 0.05]], [1, [99.95, 99.95, 99.95]]]) {
    const b = i * STRIDE;
    state[b + S.POS_X] = p[0]; state[b + S.POS_Y] = p[1]; state[b + S.POS_Z] = p[2];
    state[b + S.VEL_X] = i ? 0.001 : -0.001;
    state[b + S.MASS] = 1; state[b + S.RADIUS] = 0.01;
  }
  const runtime = createParticleExecutionAdapter({
    initialState: state,
    config: { ...base, worldSize: 100, dt: 1e-4, interactionRadius: 10,
      numerics: { integrator: 'semi-implicit-euler', diagnostics: true } },
  });
  for (let i = 0; i < 20; i++) runtime.step();
  assert.ok([...runtime.readState()].every(Number.isFinite));
});
