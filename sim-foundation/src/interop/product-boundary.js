import { SplitMix32 } from '../core/prng.js';
import { createWorldSnapshot, validateWorldSnapshot, restoreSnapshotValue } from '../state/snapshot.js';
export const PRODUCT_WORKER_PROTOCOL_VERSION = 1;
export const SIM_WORKER_PROTOCOL_VERSION = 1;
export const PRODUCT_SAVE_FORMAT = 'vepa-world-save';
export const PRODUCT_SAVE_VERSION = 1;
const PRODUCT_TO_SIM = Object.freeze({ INIT: 'INIT', CONFIG: 'CONFIGURE', TICK: 'STEP', GET_STATE: 'READ_STATE', RESTORE: 'RESTORE', PING: 'STATUS' });
const PRODUCT_RESPONSE = Object.freeze({ INIT: 'INIT_COMPLETE', CONFIG: 'CONFIG_COMPLETE', TICK: 'TICK_COMPLETE', GET_STATE: 'STATE', RESTORE: 'RESTORE_COMPLETE', PING: 'PONG' });
function record(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(label + ' must be a plain object'); }
export function createSimWorkerRequest({ requestId, productType, payload = null } = {}) {
 if (!Number.isSafeInteger(requestId) || requestId < 0) throw new TypeError('requestId must be a non-negative safe integer');
 const type = PRODUCT_TO_SIM[productType]; if (!type) throw new RangeError('Product worker command has no SIM bridge mapping: ' + productType);
 // Match the existing SIM worker adapter envelope exactly: protocolVersion + id + type + payload.
 return Object.freeze({ protocolVersion: SIM_WORKER_PROTOCOL_VERSION, id: requestId, type, payload });
}
export function validateSimWorkerResponse(message, { requestId } = {}) {
 const errors = []; if (!message || typeof message !== 'object' || Array.isArray(message)) return { valid: false, errors: ['invalid-envelope'] };
 if (message.protocolVersion !== SIM_WORKER_PROTOCOL_VERSION) errors.push('unsupported-version');
 if (!Number.isSafeInteger(message.id) || message.id < 0) errors.push('invalid-request-id');
 if (requestId !== undefined && message.id !== requestId) errors.push('stale-or-mismatched-request');
 if (message.ok !== true && message.ok !== false) errors.push('invalid-result-status');
 if (message.ok === false && (!message.error || typeof message.error.message !== 'string')) errors.push('missing-error-detail');
 return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
export function toProductWorkerResponse(message, { requestId, productType } = {}) {
 const verdict = validateSimWorkerResponse(message, { requestId }); if (!verdict.valid) throw new TypeError('Invalid SIM worker response: ' + verdict.errors.join(', '));
 if (message.ok === false) return Object.freeze({ type: 'ERROR', error: message.error.message, requestId: message.id });
 const type = PRODUCT_RESPONSE[productType]; if (!type) throw new RangeError('Product worker response has no bridge mapping: ' + productType);
 return Object.freeze({ type, payload: message.payload ?? null, requestId: message.id });
}
export function createProductRandomBridge({ seed = 0, state = seed } = {}) {
 if (!Number.isInteger(state) || state < -2147483648 || state > 0xffffffff) throw new TypeError('product PRNG state must be a 32-bit integer');
 const stream = new SplitMix32(seed).restore({ algorithm: 'splitmix32-v1', state: state >>> 0 });
 return Object.freeze({ next: () => stream.next(), nextUint32: () => stream.nextUint32(), snapshot: () => stream.snapshot(), get state() { return stream.snapshot().state; } });
}
function typed(value, Constructor, label) { if (!(value instanceof Constructor)) throw new TypeError(label + ' must be a ' + Constructor.name); for (let i = 0; i < value.length; i++) if (!Number.isFinite(value[i])) throw new TypeError(label + ' contains a non-finite value at index ' + i); }
function word(value, label) { if (!Number.isInteger(value) || value < -2147483648 || value > 0xffffffff) throw new TypeError(label + ' must be a 32-bit integer'); return value >>> 0; }
export function productSaveToSimSnapshot(save, { worldId, generation = 0 } = {}) {
 record(save, 'product save'); if (save.format !== PRODUCT_SAVE_FORMAT || save.version !== PRODUCT_SAVE_VERSION) throw new TypeError('Unsupported product world-save format or version');
 if (!Number.isSafeInteger(save.particleCount) || save.particleCount < 0 || !Number.isSafeInteger(save.speciesCount) || save.speciesCount < 0) throw new TypeError('invalid product counts');
 typed(save.particles, Float32Array, 'product particles'); if (save.particles.length !== save.particleCount * 100) throw new RangeError('product particle buffer length mismatch');
 if (save.dna !== null) typed(save.dna, Uint16Array, 'product DNA'); record(save.laws, 'product law mask');
 const productLawMask = Object.freeze({ low: word(save.laws.low, 'laws.low'), high: word(save.laws.high, 'laws.high'), ext: word(save.laws.ext, 'laws.ext'), quad: word(save.laws.quad, 'laws.quad'), penta: word(save.laws.penta, 'laws.penta') });
 return createWorldSnapshot({ worldId, tick: Number.isSafeInteger(save.tick) && save.tick >= 0 ? save.tick : 0, generation, config: { source: { format: PRODUCT_SAVE_FORMAT, version: PRODUCT_SAVE_VERSION }, worldSize: save.worldSize, worldParams: save.worldParams ?? {}, runtime: save.runtime ?? {}, productLawMask, lawIdentityPolicy: 'opaque-product-index-space-v1', deterministicContinuation: 'unavailable-product-save-has-no-prng-state' }, simulationState: { layoutVersion: 1, particleStride: 100, particleCount: save.particleCount, speciesCount: save.speciesCount, particles: save.particles, dna: save.dna, civilization: save.civilization ?? null }, prngState: null, lastEventSequence: -1 });
}
export function simSnapshotToProductSave(snapshot, { expectedWorldId } = {}) {
 const verdict = validateWorldSnapshot(snapshot, { expectedWorldId }); if (!verdict.valid) throw new TypeError('Invalid SIM snapshot: ' + verdict.errors.join(', '));
 const config = restoreSnapshotValue(snapshot.config); const state = restoreSnapshotValue(snapshot.simulationState);
 if (config?.source?.format !== PRODUCT_SAVE_FORMAT || config.source.version !== PRODUCT_SAVE_VERSION || state?.layoutVersion !== 1 || state.particleStride !== 100) throw new TypeError('SIM snapshot does not contain a supported product v1 payload');
 typed(state.particles, Float32Array, 'snapshot particles'); if (state.particles.length !== state.particleCount * 100) throw new RangeError('snapshot particle buffer length mismatch'); if (state.dna !== null) typed(state.dna, Uint16Array, 'snapshot DNA');
 return Object.freeze({ format: PRODUCT_SAVE_FORMAT, version: PRODUCT_SAVE_VERSION, tick: snapshot.tick, worldSize: config.worldSize, particleCount: state.particleCount, speciesCount: state.speciesCount, particles: state.particles.slice(), dna: state.dna?.slice() ?? null, laws: { ...config.productLawMask }, worldParams: { ...config.worldParams }, runtime: { ...config.runtime }, civilization: state.civilization ?? null, migration: Object.freeze({ source: 'vepa.world-snapshot/v2', prngRestored: false }) });
}
export const PRODUCT_SOLVER_PHASE_CONTRACT = Object.freeze([
 ...[['prepare','solver','tick',['scratch','runtime-limits']],['field-update','solver','cadence',['field-state']],['backend-selection','solver','tick',['backend-local-state']],['neighbor-build','solver','tick-or-reuse',['neighbor-index']],['force-evaluation','solver','particle-and-pair',['force-accumulators']],['mechanics-boundaries','solver','particle-and-pair',['particle-physical-state']],['integration','solver','particle',['particle-physical-state']],['lifecycle','solver','particle-and-population',['particle-lifecycle','offspring-buffer']],['post-tick','main-thread','cadence',['population','lineage','metrics','events']],['render','renderer','frame',['render-cache-only']]].map(([id,ownership,granularity,writes]) => Object.freeze({ id, ownership, granularity, writes: Object.freeze(writes) }))
]);
export function validateSolverPhaseContract(phases = PRODUCT_SOLVER_PHASE_CONTRACT) {
 const ids = new Set(); const errors = []; for (const phase of phases) { if (!phase || typeof phase.id !== 'string' || !phase.id || ids.has(phase.id)) errors.push('invalid-or-duplicate-phase-id'); else ids.add(phase.id); if (phase?.id === 'render' && phase.ownership !== 'renderer') errors.push('render-must-be-renderer-owned'); if (phase?.id === 'post-tick' && phase.ownership !== 'main-thread') errors.push('post-tick-must-be-main-thread-owned'); }
 if (phases.map(p => p?.id).join('|') !== PRODUCT_SOLVER_PHASE_CONTRACT.map(p => p.id).join('|')) errors.push('phase-order-drift'); return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}