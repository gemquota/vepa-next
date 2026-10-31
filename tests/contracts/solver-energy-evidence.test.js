import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';
import { createSolverEnergyEvidence } from '../../src/sim/solver-energy-evidence.js';

function makeState({ x = 99, vx = 5 } = {}) {
  const state = new Float64Array(PARTICLE_STRIDE);
  state[S.POS_X] = x; state[S.POS_Y] = 50; state[S.POS_Z] = 50;
  state[S.VEL_X] = vx; state[S.MASS] = 2; state[S.RADIUS] = 0.1;
  return state;
}

test('solver evidence appends a validated batch atomically and snapshots deterministically', () => {
  const journal = createSolverEnergyEvidence({ capacity: 2 });
  const base = { kind: 'toroidal-wrap', worldId: 'w', entityId: 'e', substepIndex: 0,
    particleIndex: 0, axis: 'x', positionBefore: 101, positionAfter: 1, work: 0 };
  journal.appendBatch([base]);
  const snapshot = journal.createSnapshot();
  assert.throws(() => journal.appendBatch([base, { ...base, axis: 'q' }]), /capacity/i);
  assert.equal(journal.summary().eventCount, 1);
  const restored = createSolverEnergyEvidence({ capacity: 2, snapshot });
  assert.deepEqual(restored.list(), journal.list());
  assert.equal(restored.exportJSON(), journal.exportJSON());
});

test('invalid batch entries do not partially advance the evidence sequence', () => {
  const journal = createSolverEnergyEvidence();
  const good = { kind: 'toroidal-wrap', worldId: 'w', entityId: 'e', substepIndex: 0,
    particleIndex: 0, axis: 'x', positionBefore: 101, positionAfter: 1 };
  assert.throws(() => journal.appendBatch([good, { ...good, entityId: '' }]), /entityId/i);
  assert.equal(journal.summary().sequence, 0);
});

test('actual reflective wall integration records measured impulse and kinetic delta', () => {
  const runtime = createParticleExecutionAdapter({
    initialState: makeState(), count: 1, worldId: 'experiment-7',
    config: { worldSize: 100, boundaryMode: 'reflective', dt: 1, activeLawIds: [],
      gravitationalConstant: 0, electricConstant: 0, dragCoefficient: 0, interactionRadius: 20 },
  });
  const identity = runtime.getParticleIdentity(0);
  runtime.step();
  const [event] = runtime.readSolverEnergyEvidence();
  assert.equal(event.kind, 'reflective-wall-impulse');
  assert.equal(event.worldId, 'experiment-7');
  assert.equal(event.entityId, String(identity));
  assert.equal(event.wall, 'upper');
  assert.equal(event.axis, 'x');
  assert.equal(event.position, 104);
  assert.equal(event.impulse, -20);
  assert.equal(event.kineticEnergyDelta, 0);
  assert.equal(event.work, 0);
});

test('actual toroidal integration records coordinate remapping without fictitious work', () => {
  const runtime = createParticleExecutionAdapter({
    initialState: makeState(), count: 1, worldId: 'periodic-world',
    config: { worldSize: 100, boundaryMode: 'toroidal', dt: 1, activeLawIds: [],
      gravitationalConstant: 0, electricConstant: 0, dragCoefficient: 0, interactionRadius: 20 },
  });
  runtime.step();
  const [event] = runtime.readSolverEnergyEvidence();
  assert.equal(event.kind, 'toroidal-wrap');
  assert.equal(event.worldId, 'periodic-world');
  assert.equal(event.axis, 'x');
  assert.equal(event.positionBefore, 104);
  assert.equal(event.positionAfter, 4);
  assert.equal(event.work, 0);
});

test('solver boundary evidence survives execution snapshot and replay', () => {
  const runtime = createParticleExecutionAdapter({
    initialState: makeState(), count: 1,
    config: { worldSize: 100, boundaryMode: 'reflective', dt: 1, activeLawIds: [],
      gravitationalConstant: 0, electricConstant: 0, dragCoefficient: 0, interactionRadius: 20 },
  });
  runtime.step();
  const snapshot = runtime.createSnapshot();
  const restored = createParticleExecutionAdapter({ initialState: makeState(), count: 1 });
  restored.restoreSnapshot(snapshot);
  assert.deepEqual(restored.readSolverEnergyEvidence(), runtime.readSolverEnergyEvidence());
  assert.deepEqual(restored.getSolverEnergyEvidenceSummary(), runtime.getSolverEnergyEvidenceSummary());
});
