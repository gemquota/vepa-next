import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter, validateParticleExecutionConfig } from '../../src/sim/execution-adapter.js';
import { chooseAdaptiveSubsteps, measureParticleState, validateNumericsConfig } from '../../src/sim/numerics.js';

function state() {
  const v = new Float64Array(2 * STRIDE);
  for (let i = 0; i < 2; i++) {
    const b = i * STRIDE;
    v[b + S.POS_X] = 10 + i * 10; v[b + S.POS_Y] = 10; v[b + S.POS_Z] = 10;
    v[b + S.VEL_X] = i ? -40 : 40; v[b + S.MASS] = 1; v[b + S.RADIUS] = 1;
  }
  return v;
}
const base = { worldSize: 100, dt: 0.5, interactionRadius: 20, gravitationalConstant: 0,
  electricConstant: 0, dragCoefficient: 0, activeLawIds: [], resolveContacts: false };

test('numerics config is validated and defaults preserve the legacy single-step integrator', () => {
  assert.equal(validateNumericsConfig().adaptiveSubstepping, false);
  assert.equal(validateParticleExecutionConfig({ ...base, boundaryMode: 'toroidal', softening: 1,
    contactIterations: 0, numerics: { integrator: 'explicit-euler' } }).numerics.integrator, 'explicit-euler');
  assert.throws(() => validateNumericsConfig({ maxSubsteps: 0 }), /maxSubsteps/);
  assert.throws(() => validateNumericsConfig({ integrator: 'verlet' }), /integrator/);
});

test('adaptive subdivision bounds estimated travel distance and reports a capped request', () => {
  const v = state(), numerics = validateNumericsConfig({
    adaptiveSubstepping: true, maxDisplacementFraction: 0.25, maxSubsteps: 3,
  });
  const result = chooseAdaptiveSubsteps({ view: v, count: 2, stride: STRIDE, slots: S,
    dt: 0.5, interactionRadius: 20, numerics });
  assert.equal(result.requestedSubsteps, 4);
  assert.equal(result.substeps, 3);
  assert.equal(result.stabilityLimited, true);
});

test('state diagnostics report kinetic energy, momentum and maximum speed', () => {
  const v = state();
  const result = measureParticleState(v, 2, STRIDE, S);
  assert.equal(result.kineticEnergy, 1600);
  assert.deepEqual(result.momentum, [0, 0, 0]);
  assert.equal(result.maxSpeed, 40);
});

test('execution adapter snapshots preserve numerical policy and adaptive stepping is deterministic', () => {
  const initial = state();
  const cfg = { ...base, numerics: { adaptiveSubstepping: true, maxDisplacementFraction: 0.2 } };
  const a = createParticleExecutionAdapter({ initialState: initial, config: cfg });
  const b = createParticleExecutionAdapter({ initialState: initial, config: cfg });
  const ma = a.step(), mb = b.step();
  assert.deepEqual(a.readState(), b.readState());
  assert.equal(ma.substeps, mb.substeps);
  assert.ok(ma.substeps > 1);
  const snapshot = a.createSnapshot();
  const restored = createParticleExecutionAdapter({ initialState: initial, config: base });
  restored.restoreSnapshot(snapshot);
  assert.deepEqual(restored.getConfig().numerics, a.getConfig().numerics);
});

test('explicit Euler and semi-implicit Euler are selectable integration contracts', () => {
  const initial = new Float64Array(STRIDE);
  initial[S.POS_X] = 10; initial[S.MASS] = 1; initial[S.RADIUS] = 1;
  initial[S.VEL_X] = 2;
  const a = createParticleExecutionAdapter({ initialState: initial, config: {
    ...base, worldSize: 100, dt: 0.1, interactionRadius: 20,
    activeLawIds: [], advancedPhysics: { radiation: { enabled: true, direction: [1, 0, 0], pressure: 2 } }, numerics: { integrator: 'explicit-euler' },
  } });
  const b = createParticleExecutionAdapter({ initialState: initial, config: {
    ...base, worldSize: 100, dt: 0.1, interactionRadius: 20,
    activeLawIds: [], advancedPhysics: { radiation: { enabled: true, direction: [1, 0, 0], pressure: 2 } }, numerics: { integrator: 'semi-implicit-euler' },
  } });
  a.step(); b.step();
  assert.equal(a.readState()[S.POS_X], 10);
  assert.ok(Math.abs(b.readState()[S.POS_X] - 10.02) < 1e-12);
});
