import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldSession } from '../../src/state/world-session.js';

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
  assert.equal(session.getEvents()[0].payload.generation,1);
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
  assert.equal(session.getEvents().length,0);
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
  assert.equal(session.getEvents().length,0);
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
