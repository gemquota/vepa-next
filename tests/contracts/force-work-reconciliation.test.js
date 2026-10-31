import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';
import { createForceWorkJournal } from '../../src/sim/force-work-journal.js';

function pair({x1=40,x2=50,m1=1,m2=2,q1=0,q2=0}={}) {
  const state=new Float64Array(2*PARTICLE_STRIDE);
  for(const [i,x,m,q] of [[0,x1,m1,q1],[1,x2,m2,q2]]) {
    const b=i*PARTICLE_STRIDE;
    state[b+S.POS_X]=x; state[b+S.POS_Y]=50; state[b+S.POS_Z]=50;
    state[b+S.MASS]=m; state[b+S.CHARGE]=q; state[b+S.RADIUS]=0.1;
  }
  return state;
}
const base={worldSize:100,boundaryMode:'reflective',dt:0.1,gravitationalConstant:1,
  electricConstant:10,softening:1,interactionRadius:20,dragCoefficient:0,
  activeLawIds:['law.gravity'],resolveContacts:false};

test('gravity pair work uses stable identities and exact cutoff-shifted potential delta',()=>{
  const runtime=createParticleExecutionAdapter({initialState:pair(),count:2,worldId:'force-world',config:base});
  runtime.step();
  const [event]=runtime.readForceWorkEvents();
  assert.equal(event.law,'gravity');
  assert.equal(event.worldId,'force-world');
  assert.equal(event.entityA,runtime.getParticleIdentity(0).toString());
  assert.equal(event.entityB,runtime.getParticleIdentity(1).toString());
  assert.equal(event.pairId,[event.entityA,event.entityB].sort().join('|'));
  assert.equal(event.potentialDelta,event.potentialAfter-event.potentialBefore);
  assert.equal(event.conservativeWork,-event.potentialDelta);
  assert.ok(event.conservativeWork>0);
});

test('electric pair work is separately attributed for unlike charges',()=>{
  const runtime=createParticleExecutionAdapter({initialState:pair({q1:1,q2:-1}),count:2,
    config:{...base,activeLawIds:['law.charge']}});
  runtime.step();
  const [event]=runtime.readForceWorkEvents();
  assert.equal(event.law,'electric');
  assert.ok(event.conservativeWork>0);
});

test('disabled pair laws emit no pair work records',()=>{
  const runtime=createParticleExecutionAdapter({initialState:pair(),count:2,
    config:{...base,activeLawIds:[]}});
  runtime.step();
  assert.equal(runtime.readForceWorkEvents().length,0);
});

test('journal rejects inconsistent potential arithmetic without partial append',()=>{
  const journal=createForceWorkJournal();
  const event={kind:'pair-force-work',law:'gravity',worldId:'w',entityA:'a',entityB:'b',
    pairId:'a|b',substepIndex:0,potentialBefore:-2,potentialAfter:-1,
    potentialDelta:1,conservativeWork:-1};
  assert.throws(()=>journal.appendBatch([event,{...event,potentialDelta:5}]),/Inconsistent/);
  assert.equal(journal.summary().sequence,0);
});

test('force-work journal survives execution snapshot restore',()=>{
  const runtime=createParticleExecutionAdapter({initialState:pair(),count:2,config:base});
  runtime.step();
  const snapshot=runtime.createSnapshot();
  const restored=createParticleExecutionAdapter({initialState:pair(),count:2});
  restored.restoreSnapshot(snapshot);
  assert.deepEqual(restored.readForceWorkEvents(),runtime.readForceWorkEvents());
  assert.deepEqual(restored.getForceWorkSummary(),runtime.getForceWorkSummary());
});
