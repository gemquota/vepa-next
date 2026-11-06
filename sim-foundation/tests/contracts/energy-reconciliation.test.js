import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';

function pair({ x1 = 90, x2 = 110, vx1 = 0, vx2 = 0, mass1 = 1, mass2 = 1 } = {}) {
  const state = new Float64Array(2 * STRIDE);
  for (const [i, x, vx, mass] of [[0, x1, vx1, mass1], [1, x2, vx2, mass2]]) {
    const b = i * STRIDE;
    state[b + S.POS_X] = x; state[b + S.POS_Y] = 100; state[b + S.POS_Z] = 100;
    state[b + S.VEL_X] = vx; state[b + S.MASS] = mass; state[b + S.RADIUS] = 0.1;
  }
  return state;
}

const conservative = {
  worldSize: 200, boundaryMode: 'toroidal', dt: 0.002,
  gravitationalConstant: 1, electricConstant: 0, dragCoefficient: 0,
  softening: 0.5, interactionRadius: 80, cutoffMode: 'hard',
  activeLawIds: ['law.gravity'], resolveContacts: false, contactIterations: 0,
  numerics: { integrator: 'velocity-verlet', diagnostics: true },
};

test('closed gravity fixture reconciles kinetic and potential energy with pair-work evidence', () => {
  const runtime = createParticleExecutionAdapter({ initialState: pair({ vx1: 0.05, vx2: -0.05 }), config: conservative, worldId: 'closed-gravity' });
  const before = runtime.auditEnergyBudget({ tolerance: 1e-7 });
  for (let i = 0; i < 200; i++) runtime.step();
  const after = runtime.auditEnergyBudget({ tolerance: 1e-5 });
  assert.ok(after.comparison);
  assert.ok(Math.abs(after.comparison.unexplainedResidual) < 1e-5, JSON.stringify(after.comparison));
  const events = runtime.readForceWorkEvents({ worldId: 'closed-gravity' });
  assert.ok(events.length > 0, 'force evaluation must emit pair-work evidence');
  assert.ok(events.every(event => event.entityA && event.entityB && Number.isFinite(event.conservativeWork)));
  const potentialDelta = after.budget.components.gravitationalPotential - before.budget.components.gravitationalPotential;
  const journalDelta = events.reduce((sum, event) => sum + event.potentialDelta, 0);
  assert.ok(Math.abs(potentialDelta - journalDelta) < 1e-5, `budget ΔU=${potentialDelta}, journal ΔU=${journalDelta}`);
});

test('inelastic collision accounts measured kinetic loss as internal thermal transfer', () => {
  const state = pair({ x1: 49, x2: 50, vx1: 1, vx2: -1 });
  state[S.RADIUS] = 1; state[STRIDE + S.RADIUS] = 1;
  const runtime = createParticleExecutionAdapter({
    initialState: state,
    config: {
      ...conservative, activeLawIds: [], dt: 0.001, gravitationalConstant: 0,
      resolveContacts: false,
      advancedPhysics: { collisions: { enabled: true, restitution: 0, friction: 0 } },
      numerics: { integrator: 'semi-implicit-euler', diagnostics: true },
    },
    worldId: 'inelastic-contact',
  });
  const before = runtime.readState();
  const momentumBefore = before[S.MASS] * before[S.VEL_X] + before[STRIDE + S.MASS] * before[STRIDE + S.VEL_X];
  const kineticBefore = 0.5 * before[S.MASS] * before[S.VEL_X] ** 2 + 0.5 * before[STRIDE + S.MASS] * before[STRIDE + S.VEL_X] ** 2;
  runtime.step();
  const after = runtime.readState();
  const momentumAfter = after[S.MASS] * after[S.VEL_X] + after[STRIDE + S.MASS] * after[STRIDE + S.VEL_X];
  const kineticAfter = 0.5 * after[S.MASS] * after[S.VEL_X] ** 2 + 0.5 * after[STRIDE + S.MASS] * after[STRIDE + S.VEL_X] ** 2;
  const transfers = runtime.readEnergyEvents().filter(event => event.cause === 'inelastic-contact-dissipation');
  assert.ok(Math.abs(momentumAfter - momentumBefore) < 1e-12);
  assert.ok(kineticAfter < kineticBefore);
  assert.equal(transfers.length, 1);
  assert.ok(Math.abs(transfers[0].amount - (kineticBefore - kineticAfter)) < 1e-12);
  assert.equal(runtime.getEnergySummary().totalBalance, 0);
});
