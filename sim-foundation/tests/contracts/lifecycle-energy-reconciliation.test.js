import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';

function world({ count = 2, live = [0], vx = 3, mass = 2 } = {}) {
  const state = new Float64Array(count * STRIDE);
  for (const slot of live) {
    const b = slot * STRIDE;
    state[b + S.POS_X] = 10 + slot; state[b + S.POS_Y] = 10; state[b + S.POS_Z] = 10;
    state[b + S.MASS] = mass; state[b + S.RADIUS] = 0.25;
    state[b + S.VEL_X] = vx; state[b + S.DEAD] = 0;
  }
  for (let slot = 0; slot < count; slot++) {
    if (live.includes(slot)) continue;
    state[slot * STRIDE + S.DEAD] = 1;
  }
  return createParticleExecutionAdapter({
    initialState: state,
    config: { worldSize: 100, dt: 1, gravitationalConstant: 0, electricConstant: 0,
      dragCoefficient: 0, softening: 1, interactionRadius: 10, activeLawIds: [],
      resolveContacts: false, contactIterations: 0 },
    randomSeed: 123,
    worldId: 'lifecycle-fixture',
  });
}

test('reproduction records the new particle mass, kinetic energy and momentum as a source event', () => {
  const runtime = world();
  const result = runtime.applyV3Behaviors({
    worldId: 'reproduction-fixture',
    features: { reproduction: true },
    parameters: { spawnRate: 100, childMass: 0.5, childEnergy: 7, worldWidth: 100, worldHeight: 100, worldDepth: 100 },
  });
  assert.equal(result.applied.reproduction, 1);
  const [event] = runtime.readEnergyLifecycleEvents({ sourceId: 'reproduction' });
  assert.equal(event.kind, 'particle-created');
  assert.equal(event.massDelta, 0.5);
  assert.ok(event.kineticEnergyDelta >= 0);
  assert.ok(event.momentumDelta.every(Number.isFinite));
  assert.equal(event.metadata.worldId, 'reproduction-fixture');
  assert.equal(runtime.getParticleIdentity(1).id, event.entityId);
});

test('death records negative mass, kinetic energy and momentum deltas exactly once', () => {
  const runtime = world({ count: 1, live: [0], vx: 3, mass: 2 });
  const identity = runtime.getParticleIdentity(0);
  const result = runtime.applyV3Behaviors({
    features: { radiation: true },
    parameters: { radiationRate: 2 },
  });
  assert.equal(result.applied.retired, 1);
  const events = runtime.readEnergyLifecycleEvents({ kind: 'particle-retired' });
  assert.equal(events.length, 1);
  assert.equal(events[0].entityId, identity.id);
  assert.equal(events[0].massDelta, -2);
  assert.equal(events[0].kineticEnergyDelta, -9);
  assert.deepEqual(events[0].momentumDelta, [-6, 0, 0]);
  assert.equal(runtime.getParticleIdentity(0), null);
});
