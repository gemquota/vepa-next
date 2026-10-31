import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { stepParticleWorld } from '../../src/sim/solver.js';
import { calculateEnergyBudget, validateEnergyBudgetProfile } from '../../src/sim/energy-budget.js';

function pair(r,{m1=1,m2=2,q1=1,q2=-1}={}) {
  const v=new Float64Array(2*STRIDE);
  for(const [i,x,m,q] of [[0,0,m1,q1],[1,r,m2,q2]]) {
    const b=i*STRIDE;v[b+S.POS_X]=x;v[b+S.POS_Y]=10;v[b+S.POS_Z]=10;
    v[b+S.MASS]=m;v[b+S.CHARGE]=q;v[b+S.RADIUS]=0.1;
  }
  return v;
}
const profile={unitSystem:'reference',boundaryMode:'reflective',worldSize:100,
  interactionRadius:20,softening:1,gravitationalConstant:2,electricConstant:3,
  activeLawIds:['law.gravity','law.charge'],cutoffMode:'shifted-force'};
function potential(r,law) {
  const p=calculateEnergyBudget(pair(r),2,{profile:{...profile,activeLawIds:[law]}});
  return law==='law.gravity'?p.components.gravitationalPotential:p.components.electricPotential;
}

test('shifted-force potential derivative matches the authoritative gravity acceleration',()=>{
  const r=7,eps=1e-5,dt=1e-5;
  const derivative=(potential(r+eps,'law.gravity')-potential(r-eps,'law.gravity'))/(2*eps);
  const v=pair(r,{m1:1,m2:2,q1:0,q2:0});
  stepParticleWorld(v,2,{worldSize:100,boundaryMode:'reflective',dt,gravitationalConstant:2,
    electricConstant:0,dragCoefficient:0,softening:1,interactionRadius:20,
    cutoffMode:'shifted-force',activeLawIds:['law.gravity'],integrator:'explicit-euler',resolveContacts:false});
  assert.ok(Math.abs(v[S.VEL_X]/dt-derivative)<1e-8);
});

test('shifted-force potential derivative matches the authoritative electric acceleration',()=>{
  const r=7,eps=1e-5,dt=1e-5;
  const derivative=(potential(r+eps,'law.charge')-potential(r-eps,'law.charge'))/(2*eps);
  const v=pair(r,{m1:1,m2:2,q1:1,q2:-1});
  stepParticleWorld(v,2,{worldSize:100,boundaryMode:'reflective',dt,gravitationalConstant:0,
    electricConstant:3,dragCoefficient:0,softening:1,interactionRadius:20,
    cutoffMode:'shifted-force',activeLawIds:['law.charge'],integrator:'explicit-euler',resolveContacts:false});
  assert.ok(Math.abs(v[S.VEL_X]/dt-derivative)<1e-8);
});

test('shifted-force potential and force approach zero continuously at the cutoff',()=>{
  const radius=20,inside=radius-1e-5;
  const atCutoff=potential(radius,'law.gravity');
  const outside=potential(radius+1e-5,'law.gravity');
  const near=potential(inside,'law.gravity');
  assert.ok(Math.abs(atCutoff)<1e-14);
  assert.equal(outside,0);
  assert.ok(Math.abs(near)<1e-10);
  const dt=1e-5,v=pair(inside,{q1:0,q2:0});
  stepParticleWorld(v,2,{worldSize:100,boundaryMode:'reflective',dt,gravitationalConstant:2,
    electricConstant:0,dragCoefficient:0,softening:1,interactionRadius:radius,
    cutoffMode:'shifted-force',activeLawIds:['law.gravity'],integrator:'explicit-euler',resolveContacts:false});
  assert.ok(Math.abs(v[S.VEL_X]/dt)<1e-8);
});

test('cutoff mode is explicit and invalid profiles fail closed',()=>{
  assert.equal(validateEnergyBudgetProfile(profile).cutoffMode,'shifted-force');
  assert.throws(()=>validateEnergyBudgetProfile({...profile,cutoffMode:'invented'}),/cutoff mode/i);
});
