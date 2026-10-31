import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEwaldSystem, compareEwaldTruncations } from '../../src/sim/periodic-ewald.js';

const base={boxSize:10,alpha:0.5,realShell:2,reciprocalShell:5,neutrality:'require'};
const neutral={...base,particles:[{id:'plus',charge:1,position:[2,2,2]},{id:'minus',charge:-1,position:[7,7,7]}]};

test('Ewald result is deterministic and reports all energy components',()=>{
 const a=calculateEwaldSystem(neutral),b=calculateEwaldSystem(neutral);
 assert.deepEqual(a,b);
 assert.equal(a.method,'3d-ewald-point-particles');
 assert.ok(Number.isFinite(a.components.total));
 assert.equal(a.truncation.errorBound,null);
});
test('periodic Ewald force is equal and opposite for a two-particle system',()=>{
 const r=calculateEwaldSystem(neutral);
 for(let k=0;k<3;k++)assert.ok(Math.abs(r.forces[0].force[k]+r.forces[1].force[k])<1e-11);
});
test('Ewald rejects non-neutral electrostatics unless a uniform background is explicit',()=>{
 const particles=[{id:'a',charge:1,position:[1,1,1]},{id:'b',charge:2,position:[6,6,6]}];
 assert.throws(()=>calculateEwaldSystem({...base,particles}),/not neutral/i);
 const r=calculateEwaldSystem({...base,particles,neutrality:'uniform-background'});
 assert.notEqual(r.components.uniformBackground,0);
});
test('periodic Ewald force agrees with a finite-difference energy gradient',()=>{
 const h=1e-5, a=calculateEwaldSystem(neutral);
 const moved=structuredClone(neutral);moved.particles[0].position[0]+=h;
 const plus=calculateEwaldSystem(moved).components.total;
 moved.particles[0].position[0]-=2*h;
 const minus=calculateEwaldSystem(moved).components.total;
 const numerical=-(plus-minus)/(2*h);
 assert.ok(Math.abs(numerical-a.forces[0].force[0])<2e-5,Math.abs(numerical-a.forces[0].force[0]));
});
test('truncation comparison does not claim a rigorous error bound',()=>{
 const r=compareEwaldTruncations(neutral,{levels:[[1,3],[2,5]]});
 assert.equal(r.comparisons.length,1);assert.equal(r.errorBound,null);
});
test('coincident particles and unsupported truncations fail closed',()=>{
 assert.throws(()=>calculateEwaldSystem({...base,particles:[{id:'a',charge:1,position:[1,1,1]},{id:'b',charge:-1,position:[1,1,1]}]}),/coincident/i);
 assert.throws(()=>calculateEwaldSystem({...neutral,reciprocalShell:17}),/reciprocalShell/i);
});
