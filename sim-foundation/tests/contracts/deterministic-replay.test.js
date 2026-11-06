import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';
import { replayParticleTicks } from '../../src/sim/deterministic-replay.js';

function state(count = 2) {
  const view = new Float64Array(count * STRIDE);
  for (const [i, x, vx] of [[0, 40, 0.02]]) {
    const b = i * STRIDE;
    view[b + S.POS_X] = x; view[b + S.POS_Y] = 40; view[b + S.POS_Z] = 40;
    view[b + S.VEL_X] = vx; view[b + S.MASS] = 1; view[b + S.RADIUS] = 0.1;
  }
  for (let i = 1; i < count; i++) view[i * STRIDE + S.DEAD] = 1;
  return view;
}
function particle({ x = 45, vx = 0, mass = 1 } = {}) {
  const view = new Float64Array(STRIDE);
  view[S.POS_X] = x; view[S.POS_Y] = 40; view[S.POS_Z] = 40;
  view[S.VEL_X] = vx; view[S.MASS] = mass; view[S.RADIUS] = 0.1;
  return view;
}
const config = {
  worldSize: 100, dt: 0.001, boundaryMode: 'toroidal',
  gravitationalConstant: 1, electricConstant: 0, dragCoefficient: 0,
  softening: 0.5, interactionRadius: 20, activeLawIds: ['law.gravity'],
  resolveContacts: false, contactIterations: 0,
  numerics: { integrator: 'velocity-verlet', diagnostics: true },
};

test('execution adapter journals particle lifecycle, configuration, snapshots, restore and reset', () => {
  const adapter = createParticleExecutionAdapter({ initialState: state(), config, randomSeed: 77, worldId: 'journal-world' });
  const created = adapter.allocateParticle(1, particle({ x: 45, vx: 0.25, mass: 2 }));
  assert.ok(created);
  assert.equal(adapter.retireParticle(1), true);
  adapter.configure({ dt: 0.002 });
  const snapshot = adapter.createSnapshot();
  const types = snapshot.eventJournal.map(event => event.type);
  assert.ok(types.includes('particle.created'));
  assert.ok(types.includes('particle.retired'));
  assert.ok(types.includes('world.configured'));
  assert.ok(types.includes('world.snapshot-created'));
  assert.equal(snapshot.lastEventSequence, snapshot.eventJournal.at(-1).sequence);

  const replay = adapter.replayJournal({
    initialState: [],
    reduce: (events, event) => [...events, event.type],
  });
  assert.equal(replay.status, 'replayed');
  assert.equal(replay.eventCount, snapshot.eventJournal.length);

  adapter.restoreSnapshot(snapshot);
  assert.equal(adapter.tick, snapshot.tick);
  assert.equal(adapter.readEventJournal().at(-1).type, 'world.snapshot-restored');
  const reset = adapter.resetWorld({ initialState: state(), config, randomSeed: 99 });
  assert.equal(reset.generation, 1);
  assert.equal(reset.tick, 0);
  assert.equal(adapter.readEventJournal().at(-1).type, 'world.reset');
  assert.equal(adapter.createSnapshot().randomState.rootSeed, 99);
  adapter.restoreSnapshot(snapshot);
  assert.equal(adapter.createSnapshot().randomState.rootSeed, 77);
  const events = adapter.readEventJournal();
  for (let i = 1; i < events.length; i++) {
    assert.equal(events[i].sequence, events[i - 1].sequence + 1);
    assert.ok(events[i].tick >= events[i - 1].tick);
  }
});

test('complete checkpoint restores identities and named random streams for deterministic tick replay', () => {
  const adapter = createParticleExecutionAdapter({ initialState: state(), config, randomSeed: 1234, worldId: 'replay-world' });
  adapter.nextRandom('mutation', 'particle:0');
  adapter.nextRandom('reproduction', 'particle:0');
  for (let i = 0; i < 5; i++) adapter.step();
  const checkpoint = adapter.createSnapshot();
  const identityBefore = checkpoint.identityState;
  const streamBefore = checkpoint.randomState;
  for (let i = 0; i < 12; i++) adapter.step();
  const expected = adapter.createSnapshot();
  const replayed = replayParticleTicks(checkpoint, 12);
  assert.equal(replayed.tick, expected.tick);
  assert.equal(replayed.stateDigest, expected.stateDigest);
  assert.deepEqual(replayed.identityState, expected.identityState);
  assert.deepEqual(replayed.randomState, expected.randomState);
  assert.deepEqual(identityBefore, checkpoint.identityState);
  assert.deepEqual(streamBefore, checkpoint.randomState);
});
