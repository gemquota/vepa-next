import test from 'node:test';
import assert from 'node:assert/strict';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';
import { validateNumericsConfig } from '../../src/sim/numerics.js';

function orbitState() {
  const v=new Float64Array(2*STRIDE), speed=Math.sqrt(2/10)/2;
  for(const [i,x,vy] of [[0,495,-speed],[1,505,speed]]) {
    const b=i*STRIDE; v[b+S.POS_X]=x;v[b+S.POS_Y]=500;v[b+S.POS_Z]=500;
    v[b+S.VEL_Y]=vy;v[b+S.MASS]=1;v[b+S.RADIUS]=0.1;
  }
  return v;
}
const config=integrator=>({worldSize:1000,boundaryMode:'toroidal',dt:0.05,
  gravitationalConstant:1,electricConstant:0,dragCoefficient:0,softening:0.1,
  interactionRadius:100,activeLawIds:['law.gravity'],resolveContacts:false,
  numerics:{integrator,diagnostics:false}});
function totalEnergy(v) {
  const dx=v[STRIDE+S.POS_X]-v[S.POS_X],dy=v[STRIDE+S.POS_Y]-v[S.POS_Y],dz=v[STRIDE+S.POS_Z]-v[S.POS_Z];
  const r=Math.hypot(dx,dy,dz),eps=0.1,R=100;
  const kinetic=0.5*(v[S.VEL_X]**2+v[S.VEL_Y]**2+v[S.VEL_Z]**2+
    v[STRIDE+S.VEL_X]**2+v[STRIDE+S.VEL_Y]**2+v[STRIDE+S.VEL_Z]**2);
  const potential=-(1/Math.sqrt(r*r+eps*eps)-1/Math.sqrt(R*R+eps*eps));
  return kinetic+potential;
}

test('velocity Verlet is an accepted, explicitly selectable numerical policy',()=>{
  assert.equal(validateNumericsConfig({integrator:'velocity-verlet'}).integrator,'velocity-verlet');
});

test('velocity Verlet reduces two-body orbital energy drift against semi-implicit Euler',()=>{
  const initial=orbitState();
  const verlet=createParticleExecutionAdapter({initialState:initial,count:2,config:config('velocity-verlet')});
  const euler=createParticleExecutionAdapter({initialState:initial,count:2,config:config('semi-implicit-euler')});
  const e0=totalEnergy(initial);
  for(let i=0;i<1200;i++){verlet.step();euler.step();}
  const verletDrift=Math.abs(totalEnergy(verlet.getState())-e0);
  const eulerDrift=Math.abs(totalEnergy(euler.getState())-e0);
  assert.ok(verletDrift<eulerDrift, 'Verlet drift '+verletDrift+' should be below Euler drift '+eulerDrift);
});

test('velocity Verlet rejects non-conservative or unsupported solver configurations',()=>{
  const state=orbitState();
  assert.throws(()=>createParticleExecutionAdapter({initialState:state,count:2,
    config:{...config('velocity-verlet'),activeLawIds:['law.gravity','law.drag'],dragCoefficient:0.1}}),/velocity-verlet/i);
  assert.throws(()=>createParticleExecutionAdapter({initialState:state,count:2,
    config:{...config('velocity-verlet'),boundaryMode:'reflective'}}),/velocity-verlet/i);
});
