import { PARTICLE_LAYOUT_VERSION, PARTICLE_STRIDE, PARTICLE_SLOTS } from './particle-layout.js';
import { stepParticleWorld } from './solver.js';
import { createDeterministicRandomStreams } from '../core/random-streams.js';
import { createParticleIdentityAllocator } from './particle-identities.js';
import { applyV3BehaviorKernel } from './v3-behavior-kernel.js';

function copyConfig(value) { return { ...value, activeLawIds: [...value.activeLawIds] }; }

export function validateParticleExecutionConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('config must be an object');
  if (!['toroidal', 'reflective'].includes(config.boundaryMode)) throw new RangeError('Invalid boundaryMode');
  if (!Array.isArray(config.activeLawIds) || config.activeLawIds.some(id => typeof id !== 'string' || !id) || new Set(config.activeLawIds).size !== config.activeLawIds.length) throw new TypeError('activeLawIds must be unique non-empty strings');
  for (const key of ['worldSize', 'dt', 'gravitationalConstant', 'electricConstant', 'dragCoefficient', 'softening', 'interactionRadius']) {
    if (!Number.isFinite(config[key])) throw new RangeError(key + ' must be finite');
  }
  if (config.worldSize <= 0 || config.dt <= 0 || config.gravitationalConstant < 0 || config.electricConstant < 0 || config.dragCoefficient < 0 || config.softening <= 0 || config.interactionRadius <= 0 || config.interactionRadius > config.worldSize / 2) throw new RangeError('Invalid physics configuration range');
  if (!Number.isInteger(config.contactIterations) || config.contactIterations < 0) throw new RangeError('contactIterations must be a non-negative integer');
  if (typeof config.resolveContacts !== 'boolean') throw new TypeError('resolveContacts must be boolean');
  return copyConfig(config);
}

export const RENDER_STRIDE = 7;

const DEFAULT_CONFIG = Object.freeze({
  worldSize: 2000,
  boundaryMode: 'toroidal',
  dt: 1 / 60,
  gravitationalConstant: 1,
  electricConstant: 50000,
  dragCoefficient: 0.015,
  softening: 1,
  interactionRadius: 250,
  activeLawIds: ['law.gravity'],
  resolveContacts: true,
  contactIterations: 2,
});

/** In-process authoritative execution adapter; designed to be mirrored by a future Worker adapter. */
export function createParticleExecutionAdapter({ initialState, count, stride = PARTICLE_STRIDE, config = {}, randomSeed = 0 } = {}) {
  if (!ArrayBuffer.isView(initialState) || initialState instanceof DataView) throw new TypeError('initialState must be a numeric typed array');
  if (!Number.isInteger(stride) || stride < 1) throw new RangeError('stride must be a positive integer');
  const particleCount = count ?? initialState.length / stride;
  if (!Number.isInteger(particleCount) || particleCount < 0 || initialState.length !== particleCount * stride) throw new RangeError('initialState length must equal count * stride');

  let state = new Float64Array(initialState);
  let tick = 0;
  const randomStreams = createDeterministicRandomStreams({ seed: randomSeed });
  let particleIdentities = createParticleIdentityAllocator({ capacity: particleCount });
  for (let i = 0; i < particleCount; i++) {
    const base = i * stride;
    if (state[base + PARTICLE_SLOTS.DEAD] < 0.5 && state[base + PARTICLE_SLOTS.MASS] > 0) {
      particleIdentities.allocate(i);
    }
  }
  let activeConfig = validateParticleExecutionConfig({ ...DEFAULT_CONFIG, ...config, activeLawIds: config.activeLawIds ?? DEFAULT_CONFIG.activeLawIds });

  function validateState(nextState, nextTick) {
    if (!ArrayBuffer.isView(nextState) || nextState instanceof DataView || nextState.length !== particleCount * stride) throw new TypeError('snapshot state has an incompatible typed-array shape');
    if (!Number.isInteger(nextTick) || nextTick < 0) throw new RangeError('snapshot tick must be a non-negative integer');
    for (let i = 0; i < nextState.length; i++) if (!Number.isFinite(nextState[i])) throw new RangeError('snapshot state contains a non-finite value');
  }

  return Object.freeze({
    get tick() { return tick; },
    get count() { return particleCount; },
    get stride() { return stride; },
    getConfig() { return copyConfig(activeConfig); },
    nextRandom(domain, entityId) { return randomStreams.get(domain, entityId).next(); },
    getParticleIdentity(slot) { return particleIdentities.get(slot); },
    applyV3Behaviors(behaviorConfig, pairs = []) {
      return applyV3BehaviorKernel({
        state, count: particleCount, stride, dt: activeConfig.dt,
        identities: particleIdentities, streams: randomStreams,
        worldId: behaviorConfig?.worldId ?? 'world',
        config: behaviorConfig, pairs,
      });
    },
    allocateParticle(slot, values) {
      if (!Number.isInteger(slot) || slot < 0 || slot >= particleCount) throw new RangeError('particle slot is outside execution capacity');
      if (!ArrayBuffer.isView(values) && !Array.isArray(values)) throw new TypeError('particle values must be an array or typed array');
      if (values.length !== stride || Array.from(values).some(value => !Number.isFinite(value))) throw new TypeError('particle values must contain exactly stride finite numbers');
      if (particleIdentities.get(slot)) throw new Error('particle slot is already alive');
      const base = slot * stride;
      if (values[PARTICLE_SLOTS.DEAD] >= 0.5 || values[PARTICLE_SLOTS.MASS] <= 0) throw new TypeError('new particle values must describe a live particle');
      const identity = particleIdentities.allocate(slot);
      state.set(values, base);
      return identity;
    },
    retireParticle(slot) {
      const identity = particleIdentities.get(slot);
      if (!identity) return false;
      const base = slot * stride;
      state[base + PARTICLE_SLOTS.DEAD] = 1;
      state[base + PARTICLE_SLOTS.MASS] = 0;
      return particleIdentities.release(identity);
    },
    readState() { return new Float64Array(state); },
    readRenderState() {
      const render = new Float32Array(particleCount * RENDER_STRIDE);
      for (let i = 0; i < particleCount; i++) {
        const source = i * stride, target = i * RENDER_STRIDE;
        render[target] = state[source + PARTICLE_SLOTS.POS_X];
        render[target + 1] = state[source + PARTICLE_SLOTS.POS_Y];
        render[target + 2] = state[source + PARTICLE_SLOTS.POS_Z];
        render[target + 3] = state[source + PARTICLE_SLOTS.RADIUS];
        render[target + 4] = state[source + PARTICLE_SLOTS.ENERGY];
        render[target + 5] = state[source + PARTICLE_SLOTS.DEAD];
        render[target + 6] = state[source + PARTICLE_SLOTS.CHARGE];
      }
      return render;
    },
    configure(proposal) {
      const next = validateParticleExecutionConfig({ ...activeConfig, ...proposal, activeLawIds: proposal.activeLawIds ?? activeConfig.activeLawIds });
      activeConfig = next;
      return copyConfig(activeConfig);
    },
    step() {
      const metrics = stepParticleWorld(state, particleCount, { ...activeConfig, stride, slots: PARTICLE_SLOTS });
      for (let i = 0; i < particleCount; i++) {
        const identity = particleIdentities.get(i);
        const base = i * stride;
        if (identity && (state[base + PARTICLE_SLOTS.DEAD] >= 0.5 || state[base + PARTICLE_SLOTS.MASS] <= 0)) {
          particleIdentities.release(identity);
        }
      }
      tick++;
      return Object.freeze({ tick, ...metrics });
    },
    createSnapshot() {
      return Object.freeze({
        layoutVersion: PARTICLE_LAYOUT_VERSION,
        stride,
        count: particleCount,
        tick,
        config: copyConfig(activeConfig),
        randomState: randomStreams.snapshot(),
        identityState: particleIdentities.snapshot(),
        state: new Float64Array(state),
      });
    },
    restoreSnapshot(snapshot) {
      if (!snapshot || snapshot.layoutVersion !== PARTICLE_LAYOUT_VERSION || snapshot.stride !== stride || snapshot.count !== particleCount) throw new TypeError('Snapshot layout is incompatible with this execution adapter');
      validateState(snapshot.state, snapshot.tick);
      const nextConfig = validateParticleExecutionConfig(snapshot.config);
      const nextRandomStreams = createDeterministicRandomStreams({
        seed: randomSeed,
        ...(snapshot.randomState === undefined ? {} : { snapshot: snapshot.randomState }),
      });
      if (snapshot.identityState === undefined) throw new TypeError('Snapshot is missing particle identity state');
      const nextIdentities = createParticleIdentityAllocator({ capacity: particleCount, snapshot: snapshot.identityState });
      for (let i = 0; i < particleCount; i++) {
        const base = i * stride;
        const alive = snapshot.state[base + PARTICLE_SLOTS.DEAD] < 0.5 && snapshot.state[base + PARTICLE_SLOTS.MASS] > 0;
        if (alive !== Boolean(nextIdentities.get(i))) throw new TypeError('Snapshot particle identity state does not match particle liveness');
      }
      randomStreams.restore(nextRandomStreams.snapshot());
      particleIdentities = nextIdentities;
      state = new Float64Array(snapshot.state);
      tick = snapshot.tick;
      activeConfig = nextConfig;
      return Object.freeze({ restored: true, tick });
    },
  });
}
