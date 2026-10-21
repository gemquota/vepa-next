import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldSession } from '../../src/state/world-session.js';
import { createSnapshotStore } from '../../src/state/snapshot-store.js';

test('world session commits validated config and journals the applied generation', async () => {
  const session=createWorldSession({
    worldId:'world-a',
    initialConfig:{gravity:1},
    validateConfig: candidate => Number.isFinite(candidate.gravity) && candidate.gravity >= 0
      ? {valid:true,value:candidate}
      : {valid:false,reason:'invalid-gravity'},
  });
  const result=await session.proposeConfig({gravity:2});
  assert.equal(result.status,'committed');
  assert.equal(session.getSnapshot().config.gravity,2);
  assert.equal(session.getSnapshot().generation,1);
  assert.equal(session.getEvents()[0].type,'world.config-committed');
  assert.equal(session.getEvents()[0].schemaVersion,2);
  assert.equal(session.getEvents()[0].payload.generation,1);
  assert.deepEqual(session.getEvents()[0].payload.requestedConfig, { gravity: 2 });
  assert.deepEqual(session.getEvents()[0].payload.beforeConfig, { gravity: 1 });
  assert.deepEqual(session.getEvents()[0].payload.actualConfig, { gravity: 2 });
});

test('invalid configuration does not mutate config or generation', async () => {
  const session=createWorldSession({
    worldId:'world-b',
    initialConfig:{gravity:1},
    validateConfig: candidate => candidate.gravity >= 0
      ? {valid:true,value:candidate}
      : {valid:false,reason:'invalid-gravity'},
  });
  const result=await session.proposeConfig({gravity:-10});
  assert.equal(result.status,'rejected');
  assert.equal(session.getSnapshot().config.gravity,1);
  assert.equal(session.getSnapshot().generation,0);
  assert.equal(session.getEvents().length,1);
  assert.equal(session.getEvents()[0].type,'world.config-rejected');
  assert.deepEqual(session.getEvents()[0].payload.requestedConfig,{gravity:-10});
  assert.deepEqual(session.getEvents()[0].payload.actualConfig,{gravity:1});
});

test('apply failure restores config and calls recovery adapter', async () => {
  let restoreCalls=0;
  const session=createWorldSession({
    worldId:'world-c',
    initialConfig:{gravity:1},
    validateConfig: candidate => ({valid:true,value:candidate}),
    applyConfig: async () => { throw new Error('worker refused config'); },
    restoreConfig: async config => { restoreCalls++; assert.equal(config.gravity,1); },
  });
  const result=await session.proposeConfig({gravity:2});
  assert.equal(result.status,'rolled-back');
  assert.equal(session.getSnapshot().config.gravity,1);
  assert.equal(session.getSnapshot().generation,0);
  assert.equal(restoreCalls,1);
  assert.equal(session.getEvents().length,1);
  assert.equal(session.getEvents()[0].type,'world.config-rolled-back');
  assert.deepEqual(session.getEvents()[0].payload.requestedConfig,{gravity:2});
  assert.deepEqual(session.getEvents()[0].payload.actualConfig,{gravity:1});
});

test('session event sequence and tick ordering are monotonic', () => {
  const session=createWorldSession({worldId:'world-d'});
  session.recordEvent('world.started',{},'session.world');
  session.advanceTick();
  session.recordEvent('world.tick-completed',{tick:1},'session.world');
  assert.deepEqual(session.getEvents().map(e=>[e.tick,e.sequence]),[[0,0],[1,1]]);
});


test('world session snapshot captures config, generation, tick and event cursor', async () => {
  const session = createWorldSession({
    worldId: 'world-snapshot',
    initialConfig: { gravity: 1 },
    validateConfig: candidate => ({ valid: true, value: candidate }),
  });
  await session.proposeConfig({ gravity: 2 });
  session.advanceTick();
  session.recordEvent('world.tick-completed', { tick: 1 }, 'session.world');

  const snapshot = session.createSnapshot({
    simulationState: { particles: [1, 2, 3] },
    prngState: { state: 42 },
    fidelityPolicy: { mode: 'configured', effectiveMaxInteractions: 500 },
  });
  assert.equal(snapshot.worldId, 'world-snapshot');
  assert.equal(snapshot.tick, 1);
  assert.equal(snapshot.generation, 1);
  assert.equal(snapshot.config.gravity, 2);
  assert.equal(snapshot.lastEventSequence, 1);
  assert.deepEqual(snapshot.simulationState, { particles: [1, 2, 3] });
  assert.deepEqual(snapshot.prngState, { state: 42 });
  assert.equal(snapshot.fidelityPolicy.mode, 'configured');
});

test('world session snapshot rejects missing or non-serializable simulation state', () => {
  const session = createWorldSession({ worldId: 'world-snapshot-invalid' });
  assert.throws(() => session.createSnapshot(), /JSON-compatible/);
  assert.throws(() => session.createSnapshot({ simulationState: { time: Infinity } }), /finite/);
});


test('world session saves a checkpoint through an injected two-slot store', async () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const store = createSnapshotStore(storage);
  const session = createWorldSession({
    worldId: 'world-checkpoint',
    initialConfig: { gravity: 3 },
    validateConfig: candidate => ({ valid: true, value: candidate }),
  });
  await session.proposeConfig({ gravity: 4 });
  session.advanceTick();

  const saved = session.saveCheckpoint(store, {
    simulationState: { particles: [1, 2] },
    prngState: { state: 17 },
    fidelityPolicy: { mode: 'configured', effectiveMaxInteractions: 500 },
  });
  assert.equal(saved.storage.status, 'saved');
  assert.equal(saved.snapshot.worldId, 'world-checkpoint');
  assert.equal(saved.snapshot.tick, 1);
  assert.equal(saved.snapshot.config.gravity, 4);
  assert.equal(store.load().snapshot.checksum, saved.snapshot.checksum);
});

test('checkpoint save reports storage failure without claiming persistence', () => {
  const session = createWorldSession({ worldId: 'world-checkpoint-failure' });
  const failedStore = { save: () => ({ status: 'failed', reason: 'slot-write-failed' }) };
  const result = session.saveCheckpoint(failedStore, { simulationState: { particles: [] } });
  assert.equal(result.storage.status, 'failed');
  assert.equal(result.storage.reason, 'slot-write-failed');
});


test('committed event records requested and actual config when validation normalizes a proposal', async () => {
  const session = createWorldSession({
    worldId: 'world-normalized',
    initialConfig: { gravity: 1 },
    validateConfig: proposal => ({
      valid: true,
      value: { gravity: Math.min(10, Math.max(0, proposal.gravity)) },
    }),
  });
  const result = await session.proposeConfig({ gravity: 50 });
  assert.equal(result.status, 'committed');
  const event = session.getEvents()[0];
  assert.deepEqual(event.payload.requestedConfig, { gravity: 50 });
  assert.deepEqual(event.payload.beforeConfig, { gravity: 1 });
  assert.deepEqual(event.payload.actualConfig, { gravity: 10 });
});


test('rejected cyclic or non-finite proposal is safely represented in the outcome journal', async () => {
  const session = createWorldSession({
    worldId: 'world-unsafe-proposal',
    initialConfig: { gravity: 1 },
    validateConfig: () => ({ valid: false, reason: 'invalid-config' }),
  });
  const proposal = { gravity: Number.NaN };
  proposal.self = proposal;
  const result = await session.proposeConfig(proposal);
  assert.equal(result.status, 'rejected');
  const logged = session.getEvents()[0].payload.requestedConfig;
  assert.equal(logged.gravity, 'NaN');
  assert.equal(logged.self, '[Circular]');
});

test('checkpoint restores simulation, config, generation, tick and complete event journal', async () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const store = createSnapshotStore(storage);
  const source = createWorldSession({
    worldId: 'world-coordinated-restore',
    initialConfig: { gravity: 1 },
    validateConfig: candidate => ({ valid: true, value: candidate }),
  });
  await source.proposeConfig({ gravity: 2 });
  source.advanceTick();
  source.recordEvent('world.tick-completed', { tick: 1 }, 'session.world');
  const state = { positions: new Float32Array([1.5, 2.5, 3.5]) };
  const saved = source.saveCheckpoint(store, {
    simulationState: state,
    prngState: { state: 99 },
    fidelityPolicy: { mode: 'configured' },
  });
  assert.equal(saved.storage.status, 'saved');
  assert.equal(saved.snapshot.journalEvents.length, 2);

  const runtime = { config: { gravity: 0 }, state: { positions: new Float32Array([0]) } };
  const target = createWorldSession({
    worldId: 'world-coordinated-restore',
    initialConfig: { gravity: 0 },
    validateConfig: candidate => ({ valid: true, value: candidate }),
    applyConfig: async config => { runtime.config = structuredClone(config); },
    restoreConfig: async config => { runtime.config = structuredClone(config); },
  });
  const restored = await target.restoreCheckpoint(store.load().snapshot, {
    captureSimulationState: async () => structuredClone(runtime.state),
    restoreSimulationState: async simulationState => { runtime.state = simulationState; },
  });
  assert.equal(restored.status, 'restored');
  assert.equal(target.getSnapshot().tick, 1);
  assert.equal(target.getSnapshot().generation, 1);
  assert.deepEqual(target.getSnapshot().config, { gravity: 2 });
  assert.deepEqual(target.getEvents().map(event => [event.type, event.sequence]), [
    ['world.config-committed', 0],
    ['world.tick-completed', 1],
  ]);
  assert.ok(runtime.state.positions instanceof Float32Array);
  assert.deepEqual([...runtime.state.positions], [1.5, 2.5, 3.5]);
  assert.deepEqual(runtime.config, { gravity: 2 });
  target.recordEvent('world.after-restore', {}, 'test');
  assert.equal(target.getEvents().at(-1).sequence, 2);
});

test('failed checkpoint restore rolls runtime and session metadata back', async () => {
  const source = createWorldSession({
    worldId: 'world-restore-rollback',
    initialConfig: { gravity: 3 },
    validateConfig: candidate => ({ valid: true, value: candidate }),
  });
  await source.proposeConfig({ gravity: 8 });
  source.advanceTick();
  const checkpoint = source.createSnapshot({ simulationState: { particles: [8] } });

  const runtime = { config: { gravity: 1 }, state: { particles: [1] } };
  const target = createWorldSession({
    worldId: 'world-restore-rollback',
    initialConfig: { gravity: 1 },
    validateConfig: candidate => ({ valid: true, value: candidate }),
    applyConfig: async config => { runtime.config = structuredClone(config); },
    restoreConfig: async config => { runtime.config = structuredClone(config); },
  });
  const before = target.getSnapshot();
  let firstRestore = true;
  const result = await target.restoreCheckpoint(checkpoint, {
    captureSimulationState: async () => structuredClone(runtime.state),
    restoreSimulationState: async (state, context = {}) => {
      if (firstRestore && !context.rollback) {
        firstRestore = false;
        throw new Error('simulated restore failure');
      }
      runtime.state = state;
    },
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'restore-failed');
  assert.deepEqual(target.getSnapshot(), before);
  assert.deepEqual(runtime.config, { gravity: 1 });
  assert.deepEqual(runtime.state, { particles: [1] });
});

test('checkpoint with a missing or inconsistent journal is rejected before runtime mutation', async () => {
  const session = createWorldSession({
    worldId: 'world-invalid-journal',
    initialConfig: { gravity: 1 },
    validateConfig: candidate => ({ valid: true, value: candidate }),
  });
  const checkpoint = session.createSnapshot({ simulationState: { particles: [1] } });
  const invalid = { ...checkpoint, journalEvents: [{ nope: true }] };
  const runtime = { config: { gravity: 1 }, state: { particles: [1] } };
  const result = await session.restoreCheckpoint(invalid, {
    captureSimulationState: async () => runtime.state,
    restoreSimulationState: async state => { runtime.state = state; },
  });
  assert.equal(result.status, 'rejected');
  assert.equal(result.reason, 'invalid-snapshot');
  assert.deepEqual(runtime, { config: { gravity: 1 }, state: { particles: [1] } });
});

