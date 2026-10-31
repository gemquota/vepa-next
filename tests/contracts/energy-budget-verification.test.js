import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEnergyBudget, compareEnergyBudgets, validateEnergyBudgetProfile } from '../../src/sim/energy-budget.js';
import { PARTICLE_SLOTS as S, PARTICLE_STRIDE } from '../../src/sim/particle-layout.js';

function world(items) {
  const state = new Float64Array(items.length * PARTICLE_STRIDE);
  items.forEach((p, i) => {
    const b = i * PARTICLE_STRIDE;
    state[b + S.MASS] = p.mass ?? 1;
    state[b + S.POS_X] = p.x ?? i * 2;
    state[b + S.POS_Y] = p.y ?? 0;
    state[b + S.POS_Z] = p.z ?? 0;
    state[b + S.VEL_X] = p.vx ?? 0;
    state[b + S.VEL_Y] = p.vy ?? 0;
    state[b + S.VEL_Z] = p.vz ?? 0;
    state[b + S.CHARGE] = p.charge ?? 0;
    state[b + S.DEAD] = p.dead ? 1 : 0;
  });
  return state;
}
const profile = {
  unitSystem: 'test-units', units: { length: 'm*', mass: 'kg*', time: 's*', charge: 'q*', energy: 'J*' },
  boundaryMode: 'reflective', worldSize: 100, interactionRadius: 10, softening: 1,
  gravitationalConstant: 2, electricConstant: 3, activeLawIds: ['law.gravity', 'law.charge'],
};

test('validates versioned dimensional labels and rejects unsupported versions', () => {
  assert.equal(validateEnergyBudgetProfile(profile).version, 1);
  assert.throws(() => validateEnergyBudgetProfile({ ...profile, version: 99 }), /version/i);
  assert.throws(() => validateEnergyBudgetProfile({ ...profile, units: { energy: '' } }), /units.energy/i);
});

test('independent reference computes kinetic and softened cutoff-shifted pair potentials', () => {
  const state = world([{ x: 0, vx: 2, mass: 2, charge: 1 }, { x: 2, charge: -1 }]);
  const result = calculateEnergyBudget(state, 2, { profile });
  assert.equal(result.components.kinetic, 4);
  const expectedGravity = -2 * 2 * 1 * (1 / Math.sqrt(5) - 1 / Math.sqrt(101));
  const expectedElectric = -3 * (1 / Math.sqrt(5) - 1 / Math.sqrt(101));
  assert.ok(Math.abs(result.components.gravitationalPotential - expectedGravity) < 1e-12);
  assert.ok(Math.abs(result.components.electricPotential - expectedElectric) < 1e-12);
  assert.equal(result.total, 4 + expectedGravity + expectedElectric);
});

test('toroidal audit uses minimum-image distance and excludes dead particles', () => {
  const state = world([{ x: 1, mass: 1 }, { x: 99, mass: 1 }, { x: 2, dead: true, vx: 100 }]);
  const result = calculateEnergyBudget(state, 3, { profile: { ...profile, boundaryMode: 'toroidal', worldSize: 100, interactionRadius: 10, activeLawIds: ['law.gravity'], gravitationalConstant: 1 } });
  const expected = -(1 / Math.sqrt(5) - 1 / Math.sqrt(101));
  assert.equal(result.particleCount, 2);
  assert.ok(Math.abs(result.components.gravitationalPotential - expected) < 1e-12);
});

test('cutoff excludes pairs and inactive laws are not silently included', () => {
  const state = world([{ x: 0, vx: 1, charge: 4 }, { x: 20, charge: 4 }]);
  const result = calculateEnergyBudget(state, 2, { profile: { ...profile, activeLawIds: [] } });
  assert.equal(result.components.kinetic, 0.5);
  assert.equal(result.components.gravitationalPotential, 0);
  assert.equal(result.components.electricPotential, 0);
});

test('residual decomposition preserves unexplained numerical drift without correction', () => {
  const state = world([{ vx: 2 }]);
  const next = world([{ vx: 3 }]);
  const before = calculateEnergyBudget(state, 1, { profile });
  const after = calculateEnergyBudget(next, 1, { profile });
  const report = compareEnergyBudgets(before, after, { externalWork: 1, tolerance: 1e-12 });
  assert.equal(report.delta, 2.5);
  assert.equal(report.externalWork, 1);
  assert.equal(report.unexplainedResidual, 1.5);
  assert.equal(report.withinTolerance, false);
  assert.match(report.interpretation, /not automatically corrected/i);
});

test('rejects comparisons across incompatible energy units', () => {
  const a = calculateEnergyBudget(world([{ vx: 1 }]), 1, { profile });
  const b = calculateEnergyBudget(world([{ vx: 1 }]), 1, { profile: { ...profile, units: { ...profile.units, energy: 'other' } } });
  assert.throws(() => compareEnergyBudgets(a, b), /incompatible units/i);
});
