// ============================================================================
// VEPA v3 — Physics Worker
// Web Worker that runs the physics simulation off the main thread.
// Handles INIT, CONFIG, TOGGLE_LAW, and TICK messages.
// Falls back to main-thread tick loop if SharedArrayBuffer is unavailable.
// ============================================================================

import { solve, buildNeighborPairs, drainOffspring, resetOffspringRing } from '../physics/solver.js';
import {
  createLawState,
  toggle as toggleLaw,
  set as setLaw,
  clear as clearLaw,
  isSet,
  serialize as serializeLawState,
  deserialize as deserializeLawState,
} from '../state/lawState.js';
import {
  PARTICLE_STRIDE,
  MAX_PARTICLES,
  WORLD_SIZE,
  LAW_COUNT,
  LAW_INDEXES,
} from '../constants.js';
import { runtimeConfig } from '../state/runtimeConfig.js';
import { createGPUContext, gpuComputeForces, watchGPUDeviceLoss } from '../physics/gpuCompute.js';

const hasSAB = typeof SharedArrayBuffer !== 'undefined';
const isShared = (value) => hasSAB && value instanceof SharedArrayBuffer;

// ── Worker State ──

let particleBuffer = null;   // SharedArrayBuffer (or fallback ArrayBuffer)
let particleView = null;     // Float32Array view over particleBuffer
let particleCount = 0;
let stride = PARTICLE_STRIDE;
let worldSize = WORLD_SIZE;
let lawState = createLawState();
let dnaBuffer = null;        // SharedArrayBuffer for species DNA
let dnaView = null;          // Uint16Array view over dnaBuffer
let dt = 1.0; // worker time step
let tickCount = 0;
let hasSharedArrayBuffer = hasSAB;
let gpuContext = null;
let gpuReady = false;
let gpuLossMonitorCancel = null;
let simShadow = null;
let simShadowModulePromise = null;
let simShadowReadyPromise = Promise.resolve();
let simShadowWorldId = null;
let tickInFlight = false;

// ── Fallback State (no SharedArrayBuffer) ──

let fallbackBuffer = null;
let fallbackView = null;
let fallbackActive = false;

// ── Message Handler ──

self.onmessage = function onWorkerMessage(event) {
  const msg = event.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'INIT':
      Promise.resolve(handleInit(msg)).catch((error) => {
        self.postMessage({ type: 'ERROR', error: `INIT: ${error.message || error}` });
      });
      break;

    case 'CONFIG':
      handleConfig(msg);
      break;

    case 'TOGGLE_LAW':
      handleToggleLaw(msg);
      break;

    case 'TICK':
      // Keep the worker single-flight: the main thread may render freely, but
      // physics ticks are serialized so completion order remains deterministic.
      if (tickInFlight) {
        self.postMessage({ type: 'TICK_QUEUED', tickCount });
      } else {
        tickInFlight = true;
        Promise.resolve(handleTick(msg)).catch((error) => {
          self.postMessage({ type: 'ERROR', error: `TICK: ${error.message || error}` });
        }).finally(() => { tickInFlight = false; });
      }
      break;

    case 'GET_STATE':
      handleGetState();
      break;

    case 'RESTORE':
      handleRestore(msg);
      break;

    case 'PING':
      self.postMessage({ type: 'PONG', tickCount });
      break;

    default:
      self.postMessage({
        type: 'ERROR',
        error: `Unknown message type: ${msg.type}`,
      });
  }
};

// ── Opt-in SIM foundation shadow ──
// The product solver remains authoritative. The SIM adapter evolves an isolated
// copy and reports parity diagnostics only; unsupported product laws fail closed.
function activeProductLawNames() {
  return Object.entries(LAW_INDEXES)
    .filter(([, index]) => isSet(lawState, index))
    .map(([name]) => name);
}

async function rebaseSimShadow(reason = 'config', config = {}) {
  if (!runtimeConfig.simFoundationShadow) {
    simShadow = null;
    simShadowWorldId = null;
    return { status: 'disabled' };
  }
  if (!particleView) return { status: 'uninitialized' };
  if (!simShadowModulePromise) {
    simShadowModulePromise = import('../../sim-foundation/src/interop/product-shadow-runtime.js');
  }
  const module = await simShadowModulePromise;
  const worldId = String(config.worldId ?? simShadowWorldId ?? 'vepa-product-world');
  if (!simShadow || simShadowWorldId !== worldId) {
    simShadow = module.createProductSimShadow({
      worldId,
      seed: _prngSeed,
      tolerance: Number.isFinite(config.simShadowTolerance) ? config.simShadowTolerance : 1e-4,
    });
    simShadowWorldId = worldId;
  }
  const rawBoundaryMode = config.boundaryMode ?? runtimeConfig.worldParams?.BOUNDARY_MODE;
  const boundaryMode = ['toroidal', 'reflective', 'open'].includes(rawBoundaryMode) ? rawBoundaryMode : 'toroidal';
  const payload = {
    worldId,
    state: new Float32Array(particleView),
    count: particleCount,
    stride,
    worldSize,
    dt,
    worldParams: runtimeConfig.worldParams,
    activeLawNames: activeProductLawNames(),
    seed: _prngSeed,
    legacyPrngState: _prngState,
    config: {
      worldId,
      worldSize,
      dt,
      worldParams: runtimeConfig.worldParams,
      dragCoefficient: 0.015 * (runtimeConfig.dragMultiplier || 1),
      electricConstant: config.electricConstant ?? runtimeConfig.worldParams?.ELECTRIC_K ?? 0,
      boundaryMode,
      interactionRadius: config.simInteractionRadius,
      numerics: config.simNumerics,
      advancedPhysics: config.simAdvancedPhysics ?? null,
    },
  };
  const response = simShadow.request(reason === 'init' ? 'INIT' : 'CONFIG', payload);
  if (response.type === 'ERROR') {
    return { status: 'error', reason, error: response.error };
  }
  const result = response.payload ?? {};
  if (result.status === 'unsupported') {
  }
  return result;
}

function scheduleSimShadowRebase(reason = 'config', config = {}) {
  simShadowReadyPromise = rebaseSimShadow(reason, config).catch((error) => {
    const message = error?.message || String(error);
    return { status: 'error', reason, error: message };
  });
  return simShadowReadyPromise;
}

// ── INIT Handler ──

async function handleInit(msg) {
  const {
    buffer: sharedBuffer,
    count,
    config,
    dnaBuffer: sharedDna,
  } = msg;

  // Determine if we have SharedArrayBuffer
  if (isShared(sharedBuffer)) {
    hasSharedArrayBuffer = true;
    particleBuffer = sharedBuffer;
    particleView = new Float32Array(particleBuffer);
  } else if (sharedBuffer instanceof ArrayBuffer) {
    // Fallback: main thread passed a regular ArrayBuffer (copy-on-write)
    hasSharedArrayBuffer = false;
    fallbackActive = true;
    fallbackBuffer = sharedBuffer;
    fallbackView = new Float32Array(fallbackBuffer);
    particleView = fallbackView;
  } else {
    self.postMessage({
      type: 'ERROR',
      error: 'INIT: Invalid buffer type. Expected SharedArrayBuffer or ArrayBuffer.',
    });
    return;
  }

  particleCount = count || 0;
  stride = PARTICLE_STRIDE;
  resetOffspringRing();
  tickCount = 0;

  // Apply initial config
  if (config) {
    applyConfig(config);
  }
  // Probe once, off the message handler's synchronous path. Unsupported
  // browsers cleanly report false and continue on the CPU solver.
  if (runtimeConfig.computeEngine === 'gpu') {
    gpuContext = await createGPUContext();
    gpuReady = !!gpuContext;
    gpuLossMonitorCancel?.();
    gpuLossMonitorCancel = watchGPUDeviceLoss(gpuContext, (status) => {
      if (!gpuReady) return;
      gpuReady = false;
      gpuContext = null;
      self.postMessage({ type: 'GPU_FALLBACK', reason: status.reason, error: status.message });
    });
  }

  // DNA buffer
  if (isShared(sharedDna)) {
    dnaBuffer = sharedDna;
    dnaView = new Uint16Array(dnaBuffer);
  } else if (sharedDna instanceof ArrayBuffer) {
    dnaBuffer = sharedDna;
    dnaView = new Uint16Array(dnaBuffer);
  } else {
    // Create default empty DNA buffer
    const dnaByteLength = 64 * 64 * Uint16Array.BYTES_PER_ELEMENT;
    if (hasSAB) {
      dnaBuffer = new SharedArrayBuffer(dnaByteLength);
    } else {
      dnaBuffer = new ArrayBuffer(dnaByteLength);
    }
    dnaView = new Uint16Array(dnaBuffer);
  }

  const simShadowStatus = await scheduleSimShadowRebase('init', config ?? {});
  self.postMessage({
    type: 'INIT_COMPLETE',
    tickCount: 0,
    hasSharedArrayBuffer,
    particleCount,
    lawState: serializeLawState(lawState),
    gpuAvailable: gpuReady,
    gpuActive: false,
    simShadowStatus,
  });
}

// ── CONFIG Handler ──

function handleConfig(msg) {
  const { config } = msg;
  if (config) {
    applyConfig(config);
  }

  // If new buffer provided, swap it in
  if (msg.buffer) {
    if (isShared(msg.buffer)) {
      particleBuffer = msg.buffer;
      particleView = new Float32Array(particleBuffer);
      hasSharedArrayBuffer = true;
    } else if (msg.buffer instanceof ArrayBuffer) {
      fallbackBuffer = msg.buffer;
      fallbackView = new Float32Array(fallbackBuffer);
      particleView = fallbackView;
    }
  }

  // If new DNA buffer provided
  if (msg.dnaBuffer) {
    if (isShared(msg.dnaBuffer) || msg.dnaBuffer instanceof ArrayBuffer) {
      dnaBuffer = msg.dnaBuffer;
      dnaView = new Uint16Array(dnaBuffer);
    }
  }

  scheduleSimShadowRebase('config', config ?? {});
  self.postMessage({
    type: 'CONFIG_COMPLETE',
    particleCount,
    worldSize,
    lawState: serializeLawState(lawState),
    simShadowStatus: simShadow?.status ?? (runtimeConfig.simFoundationShadow ? 'pending' : 'disabled'),
  });
}

function applyConfig(config) {
  if (config.particleCount !== undefined) particleCount = config.particleCount;
  if (config.worldSize !== undefined) worldSize = config.worldSize;
  if (config.dt !== undefined) dt = config.dt;
  if (config.seed !== undefined && tickCount === 0) { _prngSeed = config.seed | 0; _prngState = _prngSeed; }
  if (config.stride !== undefined) stride = config.stride;
  if (config.worldParams) runtimeConfig.worldParams = config.worldParams;
  if (config.computeEngine === 'gpu' || config.computeEngine === 'cpu') {
    runtimeConfig.computeEngine = config.computeEngine;
  }
  if (config.simFoundationShadow !== undefined) runtimeConfig.simFoundationShadow = config.simFoundationShadow === true;

  // Restore law state from serialized form
  if (config.lawState) {
    if (typeof config.lawState === 'object' && 'low' in config.lawState) {
      lawState = deserializeLawState(config.lawState);
    }
  }

  // Set specific laws from array
  if (config.laws && Array.isArray(config.laws)) {
    lawState = createLawState();
    for (let i = 0; i < config.laws.length && i < LAW_COUNT; i++) {
      if (config.laws[i]) {
        setLaw(lawState, i);
      }
    }
  }
}

// ── TOGGLE_LAW Handler ──

function handleToggleLaw(msg) {
  const { lawIndex, forceOn, forceOff } = msg;

  if (typeof lawIndex !== 'number' || lawIndex < 0 || lawIndex >= LAW_COUNT) {
    self.postMessage({
      type: 'ERROR',
      error: `TOGGLE_LAW: Invalid law index ${lawIndex}. Must be 0-${LAW_COUNT - 1}.`,
    });
    return;
  }

  if (forceOn) {
    setLaw(lawState, lawIndex);
  } else if (forceOff) {
    clearLaw(lawState, lawIndex);
  } else {
    toggleLaw(lawState, lawIndex);
  }

  scheduleSimShadowRebase('law-toggle');
  self.postMessage({
    type: 'LAW_TOGGLED',
    lawIndex,
    active: isSet(lawState, lawIndex),
    lawState: serializeLawState(lawState),
    simShadowStatus: simShadow?.status ?? (runtimeConfig.simFoundationShadow ? 'pending' : 'disabled'),
  });
}

// ── TICK Handler ──

async function handleTick(msg) {
  if (!particleView) {
    self.postMessage({
      type: 'ERROR',
      error: 'TICK: No particle buffer initialized. Send INIT first.',
    });
    return;
  }

  if (msg.particleCount !== undefined) particleCount = msg.particleCount;
  if (msg.dt !== undefined) dt = msg.dt;

  const tickStart = performance.now();

  // WebGPU owns only the embarrassingly-parallel pairwise gravity
  // pre-pass. The CPU solver remains authoritative for every other law and
  // receives the GPU result explicitly, so GPU selection cannot silently
  // bypass DNA, lifecycle, field, chemistry, information, quantum, or
  // mechanics semantics.
  let gpuForces = null;
  if (gpuReady && runtimeConfig.computeEngine === 'gpu') {
    try {
      const pairs = buildNeighborPairs(particleView, particleCount, stride, worldSize);
      gpuForces = await gpuComputeForces(gpuContext, particleView, particleCount, pairs, {
        worldSize,
        G: 0.2 * (worldSize / 240) ** 2 * (Number(runtimeConfig.worldParams?.GLOBAL_G) || 1),
        softening: 0.5,
        maxForce: runtimeConfig.maxForce || 50,
        gravityEnabled: isSet(lawState, LAW_INDEXES.GRAV),
        // Keep CONTACT/COLL on the CPU: the exact solver owns positional
        // correction and velocity impulse semantics; the GPU contributes
        // gravity only to avoid double-applying collision response.
        collisionEnabled: false,
      });
      if (!gpuForces) {
        gpuReady = false;
        gpuContext = null;
        self.postMessage({ type: 'GPU_FALLBACK', reason: 'compute-failed', error: 'WebGPU compute returned no force buffer' });
      }
    } catch (error) {
      gpuReady = false;
      gpuContext = null;
      self.postMessage({ type: 'GPU_FALLBACK', error: error.message || String(error) });
    }
  }

  // Run the exact CPU solver, optionally consuming the completed GPU force
  // pre-pass. A null result is the normal CPU fallback.
  solve(
    particleView,
    particleCount,
    stride,
    lawState,
    dnaView,
    worldSize,
    dt,
    prng,
    gpuForces
  );

  // Collect offspring
  const offspring = drainOffspring();

  tickCount++;
  let simShadowDiagnostics = null;
  if (runtimeConfig.simFoundationShadow) {
    await simShadowReadyPromise;
    if (simShadow?.status === 'ready') {
      const productState = tickCount % 60 === 0 ? new Float32Array(particleView) : undefined;
      const shadowResponse = simShadow.request('TICK', { dt, productState, legacyPrngState: _prngState >>> 0 });
      if (shadowResponse.type === 'ERROR') {
        simShadowDiagnostics = { status: 'error', error: shadowResponse.error };
      } else if (productState) {
        simShadowDiagnostics = shadowResponse.payload;
      }
    }
  }
  const tickDuration = performance.now() - tickStart;

  // Post result back to main thread
  const reply = {
    type: 'TICK_COMPLETE',
    tickCount,
    tickDuration,
    particleCount,
    gpuAvailable: gpuReady,
    gpuActive: !!gpuForces,
    simShadowStatus: simShadow?.status ?? (runtimeConfig.simFoundationShadow ? 'pending' : 'disabled'),
    ...(simShadowDiagnostics ? { simShadow: simShadowDiagnostics } : {}),
  };

  if (offspring.length > 0) {
    reply.offspring = offspring;
  }

  self.postMessage(reply);
}

// ── GET_STATE Handler ──

function handleGetState() {
  self.postMessage({
    type: 'STATE',
    particleCount,
    worldSize,
    tickCount,
    lawState: serializeLawState(lawState),
    hasSharedArrayBuffer,
    gpuAvailable: gpuReady,
    prngSeed: _prngSeed >>> 0,
    prngState: _prngState >>> 0,
    simShadowStatus: simShadow?.status ?? (runtimeConfig.simFoundationShadow ? 'pending' : 'disabled'),
    simShadowSnapshot: simShadow?.snapshot ?? null,
  });
}

// ── RESTORE Handler ──

function handleRestore(msg) {
  if (msg.lawState) {
    lawState = deserializeLawState(msg.lawState);
  }
  if (msg.particleCount !== undefined) {
    particleCount = msg.particleCount;
  }
  if (msg.tickCount !== undefined) {
    tickCount = msg.tickCount;
  }
  if (Number.isInteger(msg.prngSeed) && Number.isInteger(msg.prngState)) {
    _prngSeed = msg.prngSeed | 0;
    _prngState = msg.prngState | 0;
  } else if (msg.simShadowSnapshot?.legacyPrng) {
    _prngSeed = msg.simShadowSnapshot.legacyPrng.seed | 0;
    _prngState = msg.simShadowSnapshot.legacyPrng.state | 0;
  }

  if (runtimeConfig.simFoundationShadow && msg.simShadowSnapshot && simShadow) {
    const response = simShadow.request('RESTORE', { snapshot: msg.simShadowSnapshot });
    if (response.type === 'ERROR') simShadowReadyPromise = Promise.resolve({ status: 'error', reason: 'restore', error: response.error });
  } else if (runtimeConfig.simFoundationShadow) {
    scheduleSimShadowRebase('restore-without-sim-checkpoint');
  }

  self.postMessage({
    type: 'RESTORE_COMPLETE',
    tickCount,
    lawState: serializeLawState(lawState),
    simShadowStatus: simShadow?.status ?? (runtimeConfig.simFoundationShadow ? 'pending' : 'disabled'),
  });
}

// ── PRNG for Worker ──

// SplitMix32-style PRNG (deterministic, fast, no Math.random dependency)
let _prngSeed = 0x51f15e;
let _prngState = 0x51f15e;

function prng() {
  let z = (_prngState + 0x9e3779b9) | 0;
  _prngState = z;
  z = (z ^ (z >>> 16)) | 0;
  z = Math.imul(z, 0x21f0aaad);
  z = z ^ (z >>> 15);
  z = Math.imul(z, 0x735a2d97);
  z = z ^ (z >>> 15);
  return (z >>> 0) / 4294967296;
}

// ── Main-Thread Fallback Mode ──

// When SharedArrayBuffer is unavailable, the worker runs in a simple
// request/response loop: main thread sends buffer copies, worker
// processes them and sends them back. This is slower but functional.
//
// The TICK handler above already works for both modes:
// - SharedArrayBuffer: solver writes directly, main thread sees changes
// - ArrayBuffer: worker sends TICK_COMPLETE, main thread must copy state back
//
// The main thread should check hasSharedArrayBuffer in INIT_COMPLETE
// and decide whether to re-copy the buffer after each TICK_COMPLETE.

self.postMessage({ type: 'WORKER_READY' });
