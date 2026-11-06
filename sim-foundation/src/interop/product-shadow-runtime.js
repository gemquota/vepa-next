import { createParticleExecutionAdapter } from '../sim/execution-adapter.js';
import {
  createProductRandomBridge, createSimWorkerRequest,
  createWorkerResponseTracker, toProductWorkerResponse,
  SIM_WORKER_PROTOCOL_VERSION,
} from './product-boundary.js';

export const PRODUCT_SIM_LAW_MAP = Object.freeze({
  GRAV: 'law.gravity',
  DRAG: 'law.drag',
  COLL: 'law.collision',
  CHARGE_LAW: 'law.charge',
  ENTR: 'law.entrainment',
  BUOYANCY: 'law.buoyancy',
  BOND: 'law.bond',
});

export function mapProductLawNames(activeLawNames = []) {
  if (!Array.isArray(activeLawNames)) throw new TypeError('activeLawNames must be an array');
  const activeLawIds = [];
  const unsupportedLawNames = [];
  for (const name of [...new Set(activeLawNames)]) {
    if (typeof name !== 'string' || !name) throw new TypeError('active law names must be non-empty strings');
    const mapped = PRODUCT_SIM_LAW_MAP[name];
    if (mapped) activeLawIds.push(mapped);
    else unsupportedLawNames.push(name);
  }
  return Object.freeze({
    activeLawIds: Object.freeze(activeLawIds),
    unsupportedLawNames: Object.freeze(unsupportedLawNames),
  });
}

function finite(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeSimConfig(payload, activeLawIds) {
  const source = payload.config ?? payload;
  const worldParams = source.worldParams ?? payload.worldParams ?? {};
  const worldSize = finite(source.worldSize ?? payload.worldSize, 240);
  const dt = finite(source.dt ?? payload.dt, 0.025);
  const globalG = finite(worldParams.GLOBAL_G, 1);
  const explicitElectric = source.electricConstant ?? payload.electricConstant ?? worldParams.ELECTRIC_K;
  const electricConstant = finite(explicitElectric, 0);
  const interactionRadius = Math.min(
    Math.max(0.001, finite(source.interactionRadius ?? payload.interactionRadius, worldSize * 0.25)),
    worldSize * 0.5,
  );
  return {
    worldSize,
    dt,
    gravitationalConstant: finite(source.gravitationalConstant, 0.2 * (worldSize / 240) ** 2 * globalG),
    electricConstant,
    dragCoefficient: Math.max(0, finite(source.dragCoefficient ?? payload.dragCoefficient, 0.015)),
    softening: Math.max(0.001, finite(source.softening, 0.5)),
    interactionRadius,
    cutoffMode: source.cutoffMode ?? 'hard',
    boundaryMode: source.boundaryMode ?? payload.boundaryMode ?? 'toroidal',
    periodicMode: source.periodicMode ?? 'minimum-image',
    activeLawIds,
    resolveContacts: activeLawIds.includes('law.collision'),
    contactIterations: Number.isInteger(source.contactIterations) ? source.contactIterations : 2,
    advancedPhysics: source.advancedPhysics ?? null,
    numerics: source.numerics ?? { integrator: 'semi-implicit-euler', diagnostics: true },
  };
}

function typedState(value, label) {
  if (!ArrayBuffer.isView(value) || value instanceof DataView || ![Float32Array, Float64Array].includes(value.constructor)) {
    throw new TypeError(label + ' must be a Float32Array or Float64Array');
  }
  for (let i = 0; i < value.length; i++) if (!Number.isFinite(value[i])) throw new TypeError(label + ' contains non-finite data');
  return value;
}

function quantizedHash(state) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < state.length; i++) {
    const quantized = Math.round(state[i] * 1e6);
    hash = Math.imul(hash ^ (quantized | 0), 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function makeShadowSnapshot(adapter, worldId, legacySeed, legacyBridge) {
  const simSnapshot = adapter.createSnapshot();
  return Object.freeze({
    schema: 'vepa.product-sim-shadow',
    version: 1,
    worldId,
    simSnapshot,
    legacyPrng: Object.freeze({
      algorithm: 'splitmix32-v1',
      seed: legacySeed >>> 0,
      state: legacyBridge.state,
    }),
  });
}

/**
 * In-process SIM adapter used by the actual product worker as an opt-in shadow.
 * It never writes to product state. Unsupported product laws fail closed rather
 * than being silently omitted from a parity comparison.
 */
export function createProductSimShadow({ worldId = 'product-shadow', seed = 0, tolerance = 1e-4 } = {}) {
  let adapter = null;
  let status = 'idle';
  let requestId = 0;
  let legacySeed = seed >>> 0;
  let legacyBridge = createProductRandomBridge({ seed: legacySeed, state: legacySeed });
  let unsupportedLawNames = [];
  let supportedLawIds = [];
  const tracker = createWorkerResponseTracker();

  function initialize(payload) {
    const count = payload.count;
    const stride = payload.stride ?? 100;
    const productState = typedState(payload.state, 'product initial state');
    if (!Number.isInteger(count) || count < 0 || productState.length !== count * stride) {
      throw new RangeError('product state length must equal count * stride');
    }
    const mapped = mapProductLawNames(payload.activeLawNames ?? []);
    unsupportedLawNames = [...mapped.unsupportedLawNames];
    supportedLawIds = [...mapped.activeLawIds];
    const normalized = normalizeSimConfig(payload, mapped.activeLawIds);
    if (mapped.activeLawIds.includes('law.charge') && normalized.electricConstant <= 0) {
      unsupportedLawNames.push('CHARGE_LAW (no explicit electricConstant supplied)');
    }
    if (unsupportedLawNames.length) {
      adapter = null;
      status = 'unsupported';
      return Object.freeze({
        status, unsupportedLawNames: Object.freeze([...unsupportedLawNames]),
        supportedLawIds: Object.freeze([...supportedLawIds]), count, stride,
      });
    }
    const selectedSeed = Number.isInteger(payload.seed) ? payload.seed : seed;
    legacySeed = Number.isInteger(payload.legacyPrngState) ? payload.legacyPrngState >>> 0 : selectedSeed >>> 0;
    legacyBridge = createProductRandomBridge({ seed: selectedSeed, state: legacySeed });
    adapter = createParticleExecutionAdapter({
      initialState: new Float64Array(productState),
      count, stride, config: normalized,
      randomSeed: selectedSeed,
      worldId: payload.worldId ?? worldId,
    });
    status = 'ready';
    return Object.freeze({
      status, count, stride, tick: adapter.tick,
      supportedLawIds: Object.freeze([...supportedLawIds]),
      identityCount: adapter.getParticleIdentityCount(),
      randomStreamCount: adapter.getRandomStreamCount(),
      legacyPrng: legacyBridge.snapshot(),
    });
  }

  function configure(payload) {
    if (payload.state) return initialize(payload);
    const mapped = mapProductLawNames(payload.activeLawNames ?? []);
    const normalized = normalizeSimConfig(payload, mapped.activeLawIds);
    const unsupported = [...mapped.unsupportedLawNames];
    if (mapped.activeLawIds.includes('law.charge') && normalized.electricConstant <= 0) unsupported.push('CHARGE_LAW (no explicit electricConstant supplied)');
    if (unsupported.length) {
      adapter = null;
      status = 'unsupported';
      unsupportedLawNames = unsupported;
      return Object.freeze({ status, unsupportedLawNames: Object.freeze([...unsupported]) });
    }
    if (!adapter) throw new Error('SIM shadow must be initialized with product state before CONFIG');
    adapter.configure(normalized);
    supportedLawIds = [...mapped.activeLawIds];
    status = 'ready';
    return Object.freeze({ status, tick: adapter.tick, supportedLawIds: Object.freeze([...supportedLawIds]) });
  }

  function step(payload) {
    if (!adapter || status !== 'ready') throw new Error('SIM shadow is not ready; active product laws may be unsupported');
    if (payload.dt !== undefined && payload.dt !== adapter.getConfig().dt) adapter.configure({ dt: payload.dt });
    const metrics = adapter.step();
    let comparison = null;
    if (payload.productState !== undefined) {
      const productState = typedState(payload.productState, 'product comparison state');
      if (productState.length !== adapter.count * adapter.stride) throw new RangeError('product comparison state shape differs from SIM shadow');
      const simState = adapter.readState();
      let maxAbsDifference = 0;
      for (let i = 0; i < simState.length; i++) {
        const difference = Math.abs(simState[i] - productState[i]);
        if (difference > maxAbsDifference) maxAbsDifference = difference;
      }
      comparison = Object.freeze({
        productHash: quantizedHash(productState),
        simHash: quantizedHash(simState),
        maxAbsDifference,
        withinTolerance: maxAbsDifference <= tolerance,
        tolerance,
      });
    }
    return Object.freeze({
      status, tick: adapter.tick, metrics,
      comparison,
      identityCount: adapter.getParticleIdentityCount(),
      randomStreamCount: adapter.getRandomStreamCount(),
    });
  }

  function dispatch(type, payload = {}) {
    switch (type) {
      case 'INIT': return initialize(payload);
      case 'CONFIGURE': return configure(payload);
      case 'STEP': return step(payload);
      case 'READ_STATE': {
        if (!adapter) return Object.freeze({ status, unsupportedLawNames: Object.freeze([...unsupportedLawNames]) });
        return Object.freeze({
          status, tick: adapter.tick, state: adapter.readState(),
          snapshot: makeShadowSnapshot(adapter, worldId, legacySeed, legacyBridge),
          eventJournal: adapter.readEventJournal(),
        });
      }
      case 'RESTORE': {
        const snapshot = payload.snapshot;
        if (!snapshot || snapshot.schema !== 'vepa.product-sim-shadow' || snapshot.version !== 1 || snapshot.worldId !== worldId) {
          throw new TypeError('Incompatible product/SIM shadow checkpoint');
        }
        const simSnapshot = snapshot.simSnapshot;
        if (!adapter) {
          adapter = createParticleExecutionAdapter({
            initialState: simSnapshot.state, count: simSnapshot.count, stride: simSnapshot.stride,
            config: simSnapshot.config, randomSeed: simSnapshot.randomState.rootSeed, worldId,
          });
        }
        adapter.restoreSnapshot(simSnapshot);
        legacySeed = snapshot.legacyPrng.seed >>> 0;
        legacyBridge = createProductRandomBridge({ seed: legacySeed, state: snapshot.legacyPrng.state });
        status = 'ready';
        return Object.freeze({ status, tick: adapter.tick, lastEventSequence: adapter.readEventJournal().at(-1)?.sequence ?? -1 });
      }
      case 'STATUS':
        return Object.freeze({ status, tick: adapter?.tick ?? 0, unsupportedLawNames: Object.freeze([...unsupportedLawNames]), supportedLawIds: Object.freeze([...supportedLawIds]) });
      default: throw new RangeError('Unsupported SIM shadow request type: ' + type);
    }
  }

  return Object.freeze({
    request(productType, payload = {}) {
      const id = requestId++;
      let request;
      try {
        request = createSimWorkerRequest({ requestId: id, productType, payload });
      } catch (error) {
        return Object.freeze({ type: 'ERROR', error: error instanceof Error ? error.message : String(error), requestId: id });
      }
      tracker.register(id);
      let response;
      try {
        response = { protocolVersion: SIM_WORKER_PROTOCOL_VERSION, id, ok: true, payload: dispatch(request.type, request.payload) };
      } catch (error) {
        response = { protocolVersion: SIM_WORKER_PROTOCOL_VERSION, id, ok: false, error: { message: error instanceof Error ? error.message : String(error) } };
      }
      const accepted = tracker.accept(response);
      if (!accepted.accepted) return Object.freeze({ type: 'ERROR', error: accepted.errors.join(', '), requestId: id });
      return toProductWorkerResponse(response, { requestId: id, productType });
    },
    get status() { return status; },
    get tick() { return adapter?.tick ?? 0; },
    get snapshot() { return adapter ? makeShadowSnapshot(adapter, worldId, legacySeed, legacyBridge) : null; },
  });
}
