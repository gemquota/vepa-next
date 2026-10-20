import test from 'node:test';
import assert from 'node:assert/strict';
import { attachParticleWorker } from '../../src/sim/particle.worker.js';
import { PARTICLE_STRIDE as STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';
function setup() { let listener; const messages=[]; attachParticleWorker({addEventListener:(_type,fn)=>{listener=fn;},postMessage:data=>messages.push(data)}); return {messages,send:data=>listener({data})}; }
function state() { const v=new Float64Array(2*STRIDE); for (const [i,x] of [[0,40],[1,50]]) {const b=i*STRIDE;v[b+S.POS_X]=x;v[b+S.POS_Y]=50;v[b+S.POS_Z]=50;v[b+S.MASS]=1;v[b+S.RADIUS]=0.1;} return v; }
const m=(id,type,payload)=>({protocolVersion:1,id,type,payload});
test('worker initializes and advances particle state',async()=>{const h=setup();await h.send(m(1,'INIT',{initialState:state(),config:{worldSize:100,dt:1,interactionRadius:20,resolveContacts:false}}));assert.equal(h.messages[0].ok,true);await h.send(m(2,'STEP'));assert.equal(h.messages[1].payload.metrics.tick,1);assert.ok(h.messages[1].payload.renderState[0]>40);});
test('worker reports invalid command order',async()=>{const h=setup();await h.send(m(1,'STEP'));assert.equal(h.messages[0].ok,false);assert.match(h.messages[0].error.message,/not initialized/);});
