import test from 'node:test';
import assert from 'node:assert/strict';
import { attachParticleWorker } from '../../src/sim/particle.worker.js';
import { createWorkerExecutionAdapter } from '../../src/sim/worker-execution-adapter.js';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
function makeState(){const v=new Float64Array(2*STRIDE);for(const [i,x] of [[0,40],[1,50]]){const b=i*STRIDE;v[b+S.POS_X]=x;v[b+S.POS_Y]=50;v[b+S.POS_Z]=50;v[b+S.MASS]=1;v[b+S.RADIUS]=0.1;}return v;}
function makeWorker(){const main=new Map();let workerMessage;const scope={addEventListener:(_t,fn)=>{workerMessage=fn;},postMessage:data=>queueMicrotask(()=>main.get('message')?.({data:structuredClone(data)}))};attachParticleWorker(scope);return{addEventListener:(t,fn)=>main.set(t,fn),postMessage:data=>queueMicrotask(()=>workerMessage({data:structuredClone(data)})),terminate(){}};}
const options={initialState:makeState(),count:2,config:{worldSize:100,dt:1,interactionRadius:20,resolveContacts:false}};
test('worker adapter steps and reads state without an extra tick',async()=>{const r=await createWorkerExecutionAdapter({...options,workerFactory:makeWorker});assert.equal(r.mode,'worker');assert.equal((await r.getStatus()).tick,0);const result=await r.step();assert.equal(result.metrics.tick,1);assert.ok((await r.readState())[S.POS_X]>40);assert.equal((await r.getStatus()).tick,1);await r.dispose();});
test('worker construction failure selects in-process fallback',async()=>{const r=await createWorkerExecutionAdapter({...options,workerFactory:()=>{throw new Error('unavailable');}});assert.equal(r.mode,'in-process');assert.equal((await r.step()).metrics.tick,1);});

test('worker and in-process adapters produce equivalent state for the same deterministic steps',async()=>{const worker=await createWorkerExecutionAdapter({...options,workerFactory:makeWorker});const local=await createWorkerExecutionAdapter({...options,workerFactory:()=>{throw new Error('unavailable');}});for(let i=0;i<5;i++){await worker.step();await local.step();}assert.deepEqual(Array.from(await worker.readState()),Array.from(await local.readState()));assert.deepEqual(await worker.getConfig(),await local.getConfig());await worker.dispose();await local.dispose();});
