import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimWorkerRequest, validateSimWorkerResponse, toProductWorkerResponse, createWorkerResponseTracker, SIM_WORKER_PROTOCOL_VERSION, createProductRandomBridge, productSaveToSimSnapshot, simSnapshotToProductSave, PRODUCT_SOLVER_PHASE_CONTRACT, validateSolverPhaseContract } from '../../src/interop/product-boundary.js';
function fixture() { return { format:'vepa-world-save', version:1, tick:42, worldSize:500, particleCount:1, speciesCount:1, particles:new Float32Array(100).map((_,i)=>i/10), dna:new Uint16Array(64).fill(1234), laws:{low:1,high:2,ext:4,quad:8,penta:16}, worldParams:{gravity:0.5}, runtime:{simSpeed:1}, prng:null, civilization:null }; }
test('worker bridge versions and correlates supported commands', () => { const r=createSimWorkerRequest({requestId:7,productType:'TICK',payload:{dt:1}}); assert.equal(r.type,'STEP'); assert.equal(r.protocolVersion,1); assert.equal(r.id,7); assert.throws(()=>createSimWorkerRequest({requestId:7,productType:'TOGGLE_LAW'}),/no SIM bridge mapping/); assert.throws(()=>createSimWorkerRequest({requestId:-1,productType:'TICK'}),/requestId/); });
test('worker bridge rejects stale, malformed and unsupported responses', () => { const r={protocolVersion:1,id:9,ok:true,payload:{tick:1}}; assert.equal(validateSimWorkerResponse(r,{requestId:9}).valid,true); assert.ok(validateSimWorkerResponse(r,{requestId:10}).errors.includes('stale-or-mismatched-request')); assert.ok(validateSimWorkerResponse({...r,protocolVersion:99}).errors.includes('unsupported-version')); assert.equal(toProductWorkerResponse(r,{requestId:9,productType:'TICK'}).type,'TICK_COMPLETE'); assert.throws(()=>toProductWorkerResponse(r,{requestId:10,productType:'TICK'}),/Invalid SIM worker response/); });
test('response tracker bounds completed request history without accepting stale replies', () => {
 const tracker=createWorkerResponseTracker({maxCompleted:2});
 for(let id=0;id<3;id++){
  tracker.register(id);
  assert.equal(tracker.accept({protocolVersion:SIM_WORKER_PROTOCOL_VERSION,id,ok:true,payload:{}}).accepted,true);
 }
 assert.equal(tracker.completedCount,2);
 assert.deepEqual(tracker.accept({protocolVersion:SIM_WORKER_PROTOCOL_VERSION,id:0,ok:true,payload:{}}).errors,['unknown-or-stale-response']);
});
test('product and SIM SplitMix32 bridges continue the identical sequence', () => { const p=createProductRandomBridge({seed:12345}); for(let i=0;i<13;i++)p.next(); const b=createProductRandomBridge({seed:12345,state:p.state}); assert.deepEqual(Array.from({length:20},()=>p.nextUint32()),Array.from({length:20},()=>b.nextUint32())); });
test('product v1 save round-trips through a checksummed SIM snapshot without law reinterpretation', () => { const s=fixture(); const snap=productSaveToSimSnapshot(s,{worldId:'compat-fixture'}); assert.equal(snap.tick,42); assert.equal(snap.config.lawIdentityPolicy,'opaque-product-index-space-v1'); assert.equal(snap.config.productLawMask.penta,16); assert.equal(snap.prngState,null); const out=simSnapshotToProductSave(snap,{expectedWorldId:'compat-fixture'}); assert.deepEqual(out.particles,s.particles); assert.deepEqual(out.dna,s.dna); assert.deepEqual(out.laws,s.laws); assert.equal(out.migration.prngRestored,false); });
test('optional SplitMix32 checkpoints survive product save and SIM snapshot conversion', () => {
 const s=fixture(); s.prng={algorithm:'splitmix32-v1',seed:0x51f15e,state:0x12345678};
 const snap=productSaveToSimSnapshot(s,{worldId:'prng-fixture'});
 assert.deepEqual(snap.prngState,s.prng);
 assert.equal(snap.config.deterministicContinuation,'splitmix32-v1-checkpoint-available');
 const out=simSnapshotToProductSave(snap,{expectedWorldId:'prng-fixture'});
 assert.deepEqual(out.prng,s.prng);
 assert.equal(out.migration.prngRestored,true);
});
test('dual main/worker PRNG ownership survives product-SIM conversion', () => {
 const s=fixture();
 s.prng={
  algorithm:'splitmix32-v1',seed:29,state:31,
  main:{algorithm:'splitmix32-v1',seed:29,state:31},
  worker:{algorithm:'splitmix32-v1',seed:37,state:41},
 };
 const snapshot=productSaveToSimSnapshot(s,{worldId:'dual-prng'});
 const out=simSnapshotToProductSave(snapshot,{expectedWorldId:'dual-prng'});
 assert.deepEqual(out.prng,s.prng);
});
test('legacy product saves without PRNG state remain loadable but cannot claim deterministic continuation', () => {
 const s=fixture(); delete s.prng;
 const snap=productSaveToSimSnapshot(s,{worldId:'legacy-prng-fixture'});
 assert.equal(snap.prngState,null);
 assert.match(snap.config.deterministicContinuation,/unavailable/);
 const out=simSnapshotToProductSave(snap,{expectedWorldId:'legacy-prng-fixture'});
 assert.equal(out.prng,null);
 assert.equal(out.migration.prngRestored,false);
});
test('save adapter rejects invalid lengths, non-finite values, versions and corrupted checksums', () => { const s=fixture(); assert.throws(()=>productSaveToSimSnapshot({...s,particles:new Float32Array(99)},{worldId:'bad'}),/length/); const bad=fixture(); bad.particles[4]=NaN; assert.throws(()=>productSaveToSimSnapshot(bad,{worldId:'bad'}),/non-finite/); assert.throws(()=>productSaveToSimSnapshot({...s,version:9},{worldId:'bad'}),/Unsupported/); const snap=productSaveToSimSnapshot(s,{worldId:'bad'}); assert.throws(()=>simSnapshotToProductSave({...snap,tick:snap.tick+1}),/Invalid SIM snapshot/); });
test('solver phase contract fixes order and keeps render outside physical ownership', () => { assert.equal(validateSolverPhaseContract().valid,true); assert.deepEqual(PRODUCT_SOLVER_PHASE_CONTRACT.at(-1).writes,['render-cache-only']); const bad=PRODUCT_SOLVER_PHASE_CONTRACT.map(p=>({...p})); bad[9].ownership='solver'; assert.ok(validateSolverPhaseContract(bad).errors.includes('render-must-be-renderer-owned')); });
test('worker response tracker accepts out-of-order correlations once and rejects duplicates', () => { const tracker=createWorkerResponseTracker(); tracker.register(1); tracker.register(2); assert.equal(tracker.accept({protocolVersion:1,id:2,ok:true,payload:{tick:2}}).accepted,true); assert.equal(tracker.accept({protocolVersion:1,id:1,ok:true,payload:{tick:1}}).accepted,true); assert.ok(tracker.accept({protocolVersion:1,id:2,ok:true,payload:{tick:2}}).errors.includes('duplicate-response')); assert.equal(tracker.pendingCount,0); });
