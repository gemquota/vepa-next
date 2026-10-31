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

import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';

test('execution adapter records, exports and snapshot-restores audit history', () => {
  const state = world([{ x: 10, vx: 1 }, { x: 12, vx: -1 }]);
  const runtime = createParticleExecutionAdapter({
    initialState: state,
    config: { worldSize: 100, interactionRadius: 10, boundaryMode: 'reflective',
      gravitationalConstant: 0, electricConstant: 0, dragCoefficient: 0,
      activeLawIds: [], resolveContacts: false, contactIterations: 0 },
  });
  const baseline = runtime.auditEnergyBudget({ provenance: { kind: 'baseline' } });
  assert.equal(baseline.comparison, null);
  runtime.step();
  const next = runtime.auditEnergyBudget({ provenance: { kind: 'post-step' } });
  assert.equal(next.entry.tick, 1);
  assert.equal(next.comparison.delta, 0);
  assert.equal(runtime.readEnergyBudgetTimeline().length, 2);
  const exported = JSON.parse(runtime.exportEnergyBudgetAudit());
  assert.equal(exported.entries.length, 2);
  const snapshot = runtime.createSnapshot();
  const restored = createParticleExecutionAdapter({ initialState: state, config: runtime.getConfig() });
  restored.restoreSnapshot(snapshot);
  assert.deepEqual(restored.readEnergyBudgetTimeline(), runtime.readEnergyBudgetTimeline());
  assert.equal(JSON.parse(restored.exportEnergyBudgetAudit()).entries.length, 2);
  assert.throws(() => runtime.auditEnergyBudget(), /ticks must increase/i);
});

import { createEnergyLifecycleAudit } from '../../src/sim/energy-lifecycle-audit.js';

test('lifecycle audit validates event provenance, filters and bounded overflow', () => {
  const audit = createEnergyLifecycleAudit({ capacity: 2 });
  audit.record({ kind: 'external-work', sourceId: 'engine:thruster-A', tick: 0, work: 3,
    kineticEnergyDelta: 3, momentumDelta: [1, 0, 0], energyUnit: 'J*' });
  audit.record({ kind: 'boundary-flux', sourceId: 'wall:left', tick: 1, work: -1 });
  assert.equal(audit.summary().eventCount, 2);
  assert.equal(audit.list({ kind: 'external-work', sourceId: 'engine:thruster-A' })[0].work, 3);
  assert.throws(() => audit.record({ kind: 'source-work', sourceId: 'third', tick: 2 }), /capacity/i);
  assert.throws(() => audit.record({ kind: 'magnetic-field-work', sourceId: 'bad', tick: 2, work: Infinity }), /finite/i);
});

test('lifecycle audit snapshots preserve deterministic event sequence and reject corruption', () => {
  const audit = createEnergyLifecycleAudit();
  audit.record({ kind: 'accretion', sourceId: 'accretion:disk-1', entityId: 'p1', targetId: 'p2',
    tick: 4, massDelta: 2, kineticEnergyDelta: 5, momentumDelta: [2, 0, 0] });
  const snapshot = audit.createSnapshot();
  const restored = createEnergyLifecycleAudit({ snapshot });
  assert.deepEqual(restored.list(), audit.list());
  assert.throws(() => createEnergyLifecycleAudit({ snapshot: { ...snapshot, sequence: 9 } }), /sequence/i);
});

test('adapter automatically accounts particle creation and retirement with measured mass, kinetic energy and momentum', () => {
  const state = world([{ x: 10, vx: 2, mass: 3 }]);
  const runtime = createParticleExecutionAdapter({ initialState: state, config: {
    worldSize: 100, interactionRadius: 10, boundaryMode: 'reflective',
    gravitationalConstant: 0, electricConstant: 0, dragCoefficient: 0,
    activeLawIds: [], resolveContacts: false, contactIterations: 0,
  } });
  const original = runtime.readEnergyLifecycleEvents();
  assert.equal(original.length, 0);
  runtime.retireParticle(0);
  const retired = runtime.readEnergyLifecycleEvents({ kind: 'particle-retired' })[0];
  assert.equal(retired.massDelta, -3);
  assert.equal(retired.kineticEnergyDelta, -6);
  assert.deepEqual(retired.momentumDelta, [-6, 0, 0]);
  const values = new Float64Array(PARTICLE_STRIDE);
  values[S.MASS] = 2; values[S.VEL_Y] = 3; values[S.DEAD] = 0;
  runtime.allocateParticle(0, values);
  const created = runtime.readEnergyLifecycleEvents({ kind: 'particle-created' })[0];
  assert.equal(created.massDelta, 2);
  assert.equal(created.kineticEnergyDelta, 9);
  assert.deepEqual(created.momentumDelta, [0, 6, 0]);
});

test('adapter source and accretion events survive snapshots and JSON export', () => {
  const state = world([{ x: 0, vx: 1 }]);
  const runtime = createParticleExecutionAdapter({ initialState: state, config: {
    worldSize: 100, interactionRadius: 10, boundaryMode: 'reflective',
    gravitationalConstant: 0, electricConstant: 0, dragCoefficient: 0,
    activeLawIds: [], resolveContacts: false, contactIterations: 0,
  } });
  runtime.recordEnergySourceEvent({ kind: 'magnetic-field-work', sourceId: 'field:uniform-1',
    work: 0.25, kineticEnergyDelta: 0.25, provenance: { provider: 'test-field' } });
  runtime.recordAccretionEvent({ sourceId: 'accretion:cloud-2', entityId: 'p1', targetId: 'p0',
    massDelta: 1, thermalEnergyDelta: 4, energyUnit: 'J*' });
  const snapshot = runtime.createSnapshot();
  const restored = createParticleExecutionAdapter({ initialState: state, config: runtime.getConfig() });
  restored.restoreSnapshot(snapshot);
  assert.deepEqual(restored.readEnergyLifecycleEvents(), runtime.readEnergyLifecycleEvents());
  assert.equal(restored.getEnergyLifecycleSummary().byKind.accretion, 1);
  assert.equal(JSON.parse(restored.exportEnergyLifecycleAudit()).events.length, 2);
});
