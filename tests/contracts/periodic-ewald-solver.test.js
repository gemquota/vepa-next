import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';
import { PARTICLE_STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { calculateEnergyBudget } from '../../src/sim/energy-budget.js';
import { calculateEwaldSystem } from '../../src/sim/periodic-ewald.js';

function makeState() {
  const state=new Float64Array(2*PARTICLE_STRIDE);
  state[S.MASS]=1;state[S.POS_X]=2;state[S.POS_Y]=2;state[S.POS_Z]=2;state[S.CHARGE]=1;state[S.RADIUS]=0;
  const b=PARTICLE_STRIDE;
  state[b+S.MASS]=1;state[b+S.POS_X]=7;state[b+S.POS_Y]=7;state[b+S.POS_Z]=7;state[b+S.CHARGE]=-1;state[b+S.RADIUS]=0;
  return state;
}
const config={worldSize:10,interactionRadius:5,dt:1e-4,gravitationalConstant:0.1,electricConstant:1,
  dragCoefficient:0,periodicMode:'ewald',activeLawIds:['law.gravity','law.charge'],
  numerics:{integrator:'velocity-verlet',adaptiveSubstepping:false}};

test('opt-in Ewald mode drives the authoritative solver and returns world/substep diagnostics',()=>{
 const adapter=createParticleExecutionAdapter({initialState:makeState(),count:2,config:{...config,numerics:{integrator:'velocity-verlet',adaptiveSubstepping:true}},worldId:'ewald-test'});
 const result=adapter.step();
 assert.equal(result.periodicDiagnostics.method,'3d-ewald-point-particles');
 assert.equal(result.periodicDiagnostics.worldId,'ewald-test');
 assert.equal(result.periodicDiagnostics.substepIndex,0);
 assert.equal(result.periodicDiagnostics.entityIds.length,2);
 assert.ok(result.interactions>0);\n assert.ok(result.maxAccelerationBefore>0);
});

test('Ewald energy budget uses the same periodic model and explicit background conventions',()=>{
 const state=makeState();
 const budget=calculateEnergyBudget(state,2,{profile:{worldSize:10,interactionRadius:5,periodicMode:'ewald',
   activeLawIds:['law.gravity','law.charge'],gravitationalConstant:0.1,electricConstant:1,
   ewald:{realShell:2,reciprocalShell:5,electricNeutrality:'require'}}});
 assert.ok(Number.isFinite(budget.components.gravitationalPotential));
 assert.ok(Number.isFinite(budget.components.electricPotential));
 assert.ok(budget.assumptions.some(x=>x.includes('periodic Poisson')));
});

test('Ewald configuration survives snapshot restore and produces deterministic future state',()=>{
 const a=createParticleExecutionAdapter({initialState:makeState(),count:2,config});
 a.step();const checkpoint=a.createSnapshot();
 const b=createParticleExecutionAdapter({initialState:makeState(),count:2,config});
 b.restoreSnapshot(checkpoint);
 const ar=a.step(),br=b.step();
 assert.deepEqual(a.readState(),b.readState());
 assert.deepEqual(ar.periodicDiagnostics,br.periodicDiagnostics);
 assert.equal(b.getConfig().periodicMode,'ewald');
});

test('adapter rejects Ewald with incompatible boundary, contact, or advanced physics',()=>{
 assert.throws(()=>createParticleExecutionAdapter({initialState:makeState(),count:2,
   config:{...config,boundaryMode:'reflective'}}),/Ewald mode/i);
 assert.throws(()=>createParticleExecutionAdapter({initialState:makeState(),count:2,
   config:{...config,activeLawIds:['law.gravity','law.collision']}}),/Ewald mode/i);
});

test('uniform-background gravity force and potential remain finite for positive total mass',()=>{
 const result=calculateEwaldSystem({boxSize:10,particles:[
   {id:'m1',charge:2,position:[1,1,1]},{id:'m2',charge:3,position:[6,6,6]}],
   coupling:-0.5,neutrality:'uniform-background',realShell:2,reciprocalShell:5});
 assert.ok(Number.isFinite(result.components.uniformBackground));
 assert.ok(result.forces.every(x=>x.force.every(Number.isFinite)));
});
