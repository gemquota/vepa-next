import { PARTICLE_LAYOUT_VERSION, PARTICLE_STRIDE, PARTICLE_SLOTS } from './particle-layout.js';
import { stepParticleWorld } from './solver.js';
import { createDeterministicRandomStreams } from '../core/random-streams.js';
import { createParticleIdentityAllocator } from './particle-identities.js';
import { applyV3BehaviorKernel } from './v3-behavior-kernel.js';
import { validateAdvancedPhysicsConfig } from './advanced-physics.js';
import { DEFAULT_NUMERICS_CONFIG, validateNumericsConfig, chooseAdaptiveSubsteps, measureParticleState } from './numerics.js';
import { createEnergyLedger } from './energy-ledger.js';
import { calculateEnergyBudget, compareEnergyBudgets, createEnergyBudgetTimeline } from './energy-budget.js';
import { createEnergyLifecycleAudit } from './energy-lifecycle-audit.js';
import { createSolverEnergyEvidence } from './solver-energy-evidence.js';
import { createForceWorkJournal } from './force-work-journal.js';
import { calculatePeriodicImagePair, calculatePeriodicImageSystem, estimatePeriodicImageConvergence } from './periodic-images.js';
import { calculateEwaldSystem } from './periodic-ewald.js';


function estimateModeledPairAcceleration(state, count, stride, config) {
  const slots = PARTICLE_SLOTS, alive = [];
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (state[b + slots.DEAD] < 0.5 && state[b + slots.MASS] > 0) alive.push(i);
  }
  const acceleration = new Float64Array(count * 3);
  if (config.periodicMode === 'ewald') {
    const particles = alive.map(i => {
      const b=i*stride;
      return { id:'slot:'+i, position:[state[b+slots.POS_X],state[b+slots.POS_Y],state[b+slots.POS_Z]],
        mass:state[b+slots.MASS], charge:Number.isFinite(state[b+slots.CHARGE])?state[b+slots.CHARGE]:0 };
    });
    const common={boxSize:config.worldSize,alpha:config.ewald.alpha??5/config.worldSize,
      realShell:config.ewald.realShell??2,reciprocalShell:config.ewald.reciprocalShell??5};
    if(config.activeLawIds.includes('law.gravity')&&config.gravitationalConstant>0&&particles.length>1){
      const r=calculateEwaldSystem({...common,particles:particles.map(p=>({id:p.id,position:p.position,charge:p.mass})),
        coupling:-config.gravitationalConstant,neutrality:'uniform-background'});
      r.forces.forEach((f,n)=>{const i=alive[n],m=particles[n].mass;for(let k=0;k<3;k++)acceleration[i*3+k]+=f.force[k]/m;});
    }
    const charged=particles.filter(p=>p.charge!==0);
    if(config.activeLawIds.includes('law.charge')&&config.electricConstant>0&&charged.length>1){
      const r=calculateEwaldSystem({...common,particles:charged.map(p=>({id:p.id,position:p.position,charge:p.charge})),
        coupling:config.electricConstant,neutrality:config.ewald.electricNeutrality??'require',
        neutralityTolerance:config.ewald.neutralityTolerance??1e-10});
      r.forces.forEach(f=>{const n=particles.findIndex(p=>p.id===f.entityId),i=alive[n],m=particles[n].mass;for(let k=0;k<3;k++)acceleration[i*3+k]+=f.force[k]/m;});
    }
  } else {
    const size=config.worldSize, radius2=config.interactionRadius**2, soft2=config.softening**2;
    for(let a=0;a<alive.length;a++)for(let b=a+1;b<alive.length;b++){
      const i=alive[a],j=alive[b],ai=i*stride,bj=j*stride;
      let dx=state[bj+slots.POS_X]-state[ai+slots.POS_X],dy=state[bj+slots.POS_Y]-state[ai+slots.POS_Y],dz=state[bj+slots.POS_Z]-state[ai+slots.POS_Z];
      if(config.boundaryMode==='toroidal'){
        if(dx>size/2)dx-=size;else if(dx< -size/2)dx+=size;
        if(dy>size/2)dy-=size;else if(dy< -size/2)dy+=size;
        if(dz>size/2)dz-=size;else if(dz< -size/2)dz+=size;
      }
      const r2=dx*dx+dy*dy+dz*dz;
      if(r2===0||r2>radius2)continue;
      const den=Math.pow(r2+soft2,1.5),r=Math.sqrt(r2);
      const correction=config.cutoffMode==='shifted-force'?1-config.interactionRadius*den/(r*Math.pow(radius2+soft2,1.5)):1;
      if(config.activeLawIds.includes('law.gravity')&&config.gravitationalConstant>0){
        const mi=state[ai+slots.MASS],mj=state[bj+slots.MASS],f=config.gravitationalConstant*correction/den;
        for(let k=0;k<3;k++){const d=[dx,dy,dz][k];acceleration[i*3+k]+=d*f*mj;acceleration[j*3+k]-=d*f*mi;}
      }
      if(config.activeLawIds.includes('law.charge')&&config.electricConstant>0){
        const qi=Number.isFinite(state[ai+slots.CHARGE])?state[ai+slots.CHARGE]:0;
        const qj=Number.isFinite(state[bj+slots.CHARGE])?state[bj+slots.CHARGE]:0;
        if(qi&&qj){const mi=state[ai+slots.MASS],mj=state[bj+slots.MASS],f=config.electricConstant*qi*qj*correction/den;
          for(let k=0;k<3;k++){const d=[dx,dy,dz][k];acceleration[i*3+k]-=d*f/mi;acceleration[j*3+k]+=d*f/mj;}}
      }
    }
  }
  let maximum=0;
  for(const i of alive)maximum=Math.max(maximum,Math.hypot(acceleration[i*3],acceleration[i*3+1],acceleration[i*3+2]));
  return maximum;
}

function copyConfig(value) { return { ...value, activeLawIds: [...value.activeLawIds], advancedPhysics: value.advancedPhysics == null ? null : structuredClone(value.advancedPhysics), ewald: { ...value.ewald }, numerics: { ...value.numerics } }; }

export function validateParticleExecutionConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('config must be an object');
  if (!['minimum-image','ewald'].includes(config.periodicMode ?? 'minimum-image')) throw new RangeError('Invalid periodicMode');
  if (!['hard','shifted-force'].includes(config.cutoffMode ?? 'hard')) throw new RangeError('Invalid cutoffMode');
  if (!['toroidal', 'reflective'].includes(config.boundaryMode)) throw new RangeError('Invalid boundaryMode');
  if (!Array.isArray(config.activeLawIds) || config.activeLawIds.some(id => typeof id !== 'string' || !id) || new Set(config.activeLawIds).size !== config.activeLawIds.length) throw new TypeError('activeLawIds must be unique non-empty strings');
  for (const key of ['worldSize', 'dt', 'gravitationalConstant', 'electricConstant', 'dragCoefficient', 'softening', 'interactionRadius']) {
    if (!Number.isFinite(config[key])) throw new RangeError(key + ' must be finite');
  }
  if (config.worldSize <= 0 || config.dt <= 0 || config.gravitationalConstant < 0 || config.electricConstant < 0 || config.dragCoefficient < 0 || config.softening <= 0 || config.interactionRadius <= 0 || config.interactionRadius > config.worldSize / 2) throw new RangeError('Invalid physics configuration range');
  if (!['dissipation', 'thermal'].includes(config.dragEnergyDestination ?? 'dissipation')) throw new RangeError('dragEnergyDestination must be dissipation or thermal');
  if (!Number.isInteger(config.contactIterations) || config.contactIterations < 0) throw new RangeError('contactIterations must be a non-negative integer');
  if (typeof config.resolveContacts !== 'boolean') throw new TypeError('resolveContacts must be boolean');
  const ewald = { ...(config.ewald ?? {}) };
  if (!Number.isInteger(ewald.realShell ?? 2) || (ewald.realShell ?? 2) < 0 || (ewald.realShell ?? 2) > 6 || !Number.isInteger(ewald.reciprocalShell ?? 5) || (ewald.reciprocalShell ?? 5) < 1 || (ewald.reciprocalShell ?? 5) > 16) throw new RangeError('Invalid Ewald truncation settings');
  if (ewald.alpha !== undefined && (!Number.isFinite(ewald.alpha) || ewald.alpha <= 0)) throw new RangeError('ewald.alpha must be positive and finite');
  if (!['require','uniform-background'].includes(ewald.electricNeutrality ?? 'require')) throw new RangeError('Invalid Ewald electric neutrality policy');
  if ((config.periodicMode ?? 'minimum-image') === 'ewald' && (config.boundaryMode !== 'toroidal' || config.activeLawIds.some(id => !['law.gravity','law.charge'].includes(id)) || config.advancedPhysics != null || config.activeLawIds.includes('law.collision'))) throw new RangeError('Ewald mode requires toroidal boundaries and only gravity/charge laws');
  config = { ...config, ewald, advancedPhysics: validateAdvancedPhysicsConfig(config.advancedPhysics ?? null), numerics: validateNumericsConfig(config.numerics ?? DEFAULT_NUMERICS_CONFIG) };
  if (config.numerics.integrator === 'velocity-verlet' &&
      (config.activeLawIds.some(id => !['law.gravity','law.charge'].includes(id)) || config.boundaryMode !== 'toroidal' || config.advancedPhysics !== null)) {
    throw new RangeError('velocity-verlet currently supports only conservative gravity and charge laws with toroidal boundaries');
  }
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
  cutoffMode: 'hard',
  activeLawIds: ['law.gravity'],
  resolveContacts: true,
  contactIterations: 2,
  advancedPhysics: null,
  dragEnergyDestination: 'dissipation',
  numerics: DEFAULT_NUMERICS_CONFIG,
});

/** In-process authoritative execution adapter; designed to be mirrored by a future Worker adapter. */
export function createParticleExecutionAdapter({ initialState, count, stride = PARTICLE_STRIDE, config = {}, randomSeed = 0, worldId = 'world' } = {}) {
  if (!ArrayBuffer.isView(initialState) || initialState instanceof DataView) throw new TypeError('initialState must be a numeric typed array');
  if (!Number.isInteger(stride) || stride < 1) throw new RangeError('stride must be a positive integer');
  if (typeof worldId !== 'string' || !worldId.trim()) throw new TypeError('worldId must be a non-empty string');
  const particleCount = count ?? initialState.length / stride;
  if (!Number.isInteger(particleCount) || particleCount < 0 || initialState.length !== particleCount * stride) throw new RangeError('initialState length must equal count * stride');

  let state = new Float64Array(initialState);
  let tick = 0;
  const energyAccounts = [['external', 'external-source', true], ['kinetic', 'kinetic', false], ['thermal', 'thermal', false], ['chemical', 'chemical-potential', false], ['gravitational-potential', 'gravitational-potential', true], ['electric-potential', 'electric-potential', true], ['magnetic-field', 'magnetic-field', false], ['radiation', 'radiation', false], ['dissipation', 'dissipation', false], ['deformation', 'deformation', false], ['rest-mass', 'rest-mass', false]];
  let energyLedger = createEnergyLedger();
  let energyBudgetTimeline = createEnergyBudgetTimeline();
  let energyLifecycleAudit = createEnergyLifecycleAudit();
  let solverEnergyEvidence = createSolverEnergyEvidence();
  let forceWorkJournal = createForceWorkJournal();
  for (const [id, type, allowNegative] of energyAccounts) energyLedger.createAccount({ id, type, allowNegative });
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
    createEnergyAccount(account) { return energyLedger.createAccount(account); },
    transferEnergy(transfer) { return energyLedger.transfer({ ...transfer, tick: transfer.tick ?? tick }); },
    transactEnergy(transfers) { return energyLedger.transact(transfers.map(transfer => ({ ...transfer, tick: transfer.tick ?? tick }))); },
    getEnergyAccount(id) { return energyLedger.getAccount(id); },
    getEnergySummary() { return energyLedger.summary(); },
    auditEnergy() { return energyLedger.audit(); },
    readEnergyEvents(options) { return energyLedger.listEvents(options); },
    recordEnergySourceEvent(event) {
      return energyLifecycleAudit.record({ ...event, tick: event.tick ?? tick });
    },
    recordAccretionEvent({ sourceId, entityId, targetId, massDelta, kineticEnergyDelta = 0,
      thermalEnergyDelta = 0, chemicalEnergyDelta = 0, radiationEnergyDelta = 0,
      momentumDelta = [0, 0, 0], energyUnit = null, provenance = null, metadata = null } = {}) {
      return energyLifecycleAudit.record({ kind: 'accretion', sourceId, entityId, targetId,
        tick, massDelta, kineticEnergyDelta, thermalEnergyDelta, chemicalEnergyDelta,
        radiationEnergyDelta, momentumDelta, energyUnit, provenance, metadata });
    },
    readEnergyLifecycleEvents(options) { return energyLifecycleAudit.list(options); },
    getEnergyLifecycleSummary() { return energyLifecycleAudit.summary(); },
    exportEnergyLifecycleAudit() { return energyLifecycleAudit.exportJSON(); },
    readSolverEnergyEvidence(options) { return solverEnergyEvidence.list(options); },
    getSolverEnergyEvidenceSummary() { return solverEnergyEvidence.summary(); },
    exportSolverEnergyEvidence() { return solverEnergyEvidence.exportJSON(); },
    readForceWorkEvents(options) { return forceWorkJournal.list(options); },
    getForceWorkSummary() { return forceWorkJournal.summary(); },
    exportForceWorkJournal() { return forceWorkJournal.exportJSON(); },
    calculatePeriodicImagePair(options) { return calculatePeriodicImagePair(options); },
    calculatePeriodicImageSystem(options) { return calculatePeriodicImageSystem(options); },
    estimatePeriodicImageConvergence(options, policy) { return estimatePeriodicImageConvergence(options, policy); },
    auditEnergyBudget({ profile = {}, externalWork = 0, modeledInternalTransfers = 0, tolerance = 1e-10, provenance = null } = {}) {
      const auditProfile = {
        unitSystem: 'simulation',
        boundaryMode: activeConfig.boundaryMode,
        worldSize: activeConfig.worldSize,
        interactionRadius: activeConfig.interactionRadius,
        cutoffMode: activeConfig.cutoffMode,
        periodicMode: activeConfig.periodicMode,
        ewald: activeConfig.ewald,
        softening: activeConfig.softening,
        gravitationalConstant: activeConfig.gravitationalConstant,
        electricConstant: activeConfig.electricConstant,
        activeLawIds: activeConfig.activeLawIds,
        ...profile,
      };
      const budget = calculateEnergyBudget(state, particleCount, { stride, profile: auditProfile });
      const previous = energyBudgetTimeline.latest();
      const comparison = previous ? compareEnergyBudgets(previous.budget, budget, {
        externalWork, modeledInternalTransfers, tolerance,
      }) : null;
      const entry = energyBudgetTimeline.append({ tick, budget, comparison, provenance });
      return Object.freeze({ budget, comparison, entry });
    },
    readEnergyBudgetTimeline(options) { return energyBudgetTimeline.list(options); },
    exportEnergyBudgetAudit() { return energyBudgetTimeline.exportJSON(); },
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
      const previous = state.slice(base, base + stride);
      state.set(values, base);
      const mass = values[PARTICLE_SLOTS.MASS];
      const vx = values[PARTICLE_SLOTS.VEL_X], vy = values[PARTICLE_SLOTS.VEL_Y], vz = values[PARTICLE_SLOTS.VEL_Z];
      try {
        energyLifecycleAudit.record({ kind: 'particle-created', sourceId: 'particle-creation',
          entityId: String(identity), tick, massDelta: mass,
          kineticEnergyDelta: 0.5 * mass * (vx * vx + vy * vy + vz * vz),
          momentumDelta: [mass * vx, mass * vy, mass * vz],
          metadata: { slot, speciesId: values[PARTICLE_SLOTS.SPECIES_ID] } });
      } catch (error) {
        state.set(previous, base);
        particleIdentities.release(identity);
        throw error;
      }
      return identity;
    },
    retireParticle(slot) {
      const identity = particleIdentities.get(slot);
      if (!identity) return false;
      const base = slot * stride;
      const mass = state[base + PARTICLE_SLOTS.MASS];
      const vx = state[base + PARTICLE_SLOTS.VEL_X], vy = state[base + PARTICLE_SLOTS.VEL_Y], vz = state[base + PARTICLE_SLOTS.VEL_Z];
      energyLifecycleAudit.record({ kind: 'particle-retired', sourceId: 'particle-retirement',
        entityId: String(identity), tick, massDelta: -mass,
        kineticEnergyDelta: -0.5 * mass * (vx * vx + vy * vy + vz * vz),
        momentumDelta: [-mass * vx, -mass * vy, -mass * vz], metadata: { slot } });
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
      // Always retain a tick checkpoint: state and its transfer journal commit together.
      const beforeState = new Float64Array(state);
      const before = activeConfig.numerics.diagnostics ? measureParticleState(state, particleCount, stride, PARTICLE_SLOTS) : null;
      const maxAcceleration = activeConfig.numerics.adaptiveSubstepping
        ? estimateModeledPairAcceleration(state, particleCount, stride, activeConfig) : 0;
      const subdivision = chooseAdaptiveSubsteps({
        view: state, count: particleCount, stride, slots: PARTICLE_SLOTS,
        dt: activeConfig.dt, interactionRadius: activeConfig.interactionRadius,
        numerics: activeConfig.numerics, maxAcceleration,
      });
      const subDt = activeConfig.dt / subdivision.substeps;
      let aggregate = { liveCount: 0, interactions: 0, fallbackQueries: 0, gridDimension: 0, periodicDiagnostics: null,
        boundaryMode: activeConfig.boundaryMode,
        advancedPhysics: { pairs: 0, thermalTransfers: 0, reactions: 0, decays: 0, phaseChanges: 0 }, energyTransferCount: 0 };
      const pendingEnergyTransfers = [];
      const pendingBoundaryEvents = [];
      const pendingForceWorkEvents = [];
      const entityIds = Array.from({ length: particleCount }, (_, slot) => {
        const identity = particleIdentities.get(slot);
        return identity ? String(identity) : 'unallocated-slot:' + slot;
      });
      try {
        for (let stepIndex = 0; stepIndex < subdivision.substeps; stepIndex++) {
          const metrics = stepParticleWorld(state, particleCount, {
            ...activeConfig, dt: subDt, integrator: activeConfig.numerics.integrator,
            stride, slots: PARTICLE_SLOTS, energyTransfers: pendingEnergyTransfers,
            boundaryEvents: pendingBoundaryEvents, forceWorkEvents: pendingForceWorkEvents, entityIds, worldId, substepIndex: stepIndex,
          });
          aggregate.liveCount = metrics.liveCount;
          aggregate.interactions += metrics.interactions;
          aggregate.fallbackQueries += metrics.fallbackQueries;
          aggregate.gridDimension = metrics.gridDimension;
          aggregate.periodicDiagnostics = metrics.periodicDiagnostics;
          aggregate.energyTransferCount = pendingEnergyTransfers.length;
          for (const key of Object.keys(aggregate.advancedPhysics)) aggregate.advancedPhysics[key] += metrics.advancedPhysics[key] ?? 0;
          if (activeConfig.numerics.rollbackOnNonFinite) measureParticleState(state, particleCount, stride, PARTICLE_SLOTS);
        }
      } catch (error) {
        state = beforeState;
        throw error;
      }
      let after = null;
      const beforeLedgerSnapshot = energyLedger.createSnapshot();
      const beforeEvidenceSnapshot = solverEnergyEvidence.createSnapshot();
      const beforeForceWorkSnapshot = forceWorkJournal.createSnapshot();
      try {
        after = activeConfig.numerics.diagnostics ? measureParticleState(state, particleCount, stride, PARTICLE_SLOTS) : null;
        if (pendingEnergyTransfers.length) {
          // These are signed flow accounts, not claims about complete physical inventories.
          // The event journal is the authoritative provenance record for each subsystem transfer.
          const accountIds = new Set();
          for (const transfer of pendingEnergyTransfers) {
            accountIds.add(transfer.source);
            accountIds.add(transfer.destination);
          }
          for (const id of [...accountIds].sort()) {
            try { energyLedger.getAccount(id); }
            catch {
              const type = id.split(':', 1)[0] || 'unclassified';
              energyLedger.createAccount({ id, type, allowNegative: true });
            }
          }
          energyLedger.transact(pendingEnergyTransfers.map(transfer => ({
            ...transfer, tick,
          })));
        }
        solverEnergyEvidence.appendBatch(pendingBoundaryEvents);
        forceWorkJournal.appendBatch(pendingForceWorkEvents);
      } catch (error) {
        state = beforeState;
        energyLedger = createEnergyLedger({ snapshot: beforeLedgerSnapshot });
        solverEnergyEvidence = createSolverEnergyEvidence({ snapshot: beforeEvidenceSnapshot });
        forceWorkJournal = createForceWorkJournal({ snapshot: beforeForceWorkSnapshot });
        throw error;
      }
      for (let i = 0; i < particleCount; i++) {
        const identity = particleIdentities.get(i);
        const base = i * stride;
        if (identity && (state[base + PARTICLE_SLOTS.DEAD] >= 0.5 || state[base + PARTICLE_SLOTS.MASS] <= 0)) {
          particleIdentities.release(identity);
        }
      }
      tick++;
      energyLedger.setTick(tick);
      return Object.freeze({
        tick, ...aggregate, substeps: subdivision.substeps,
        requestedSubsteps: subdivision.requestedSubsteps,
        stabilityLimited: subdivision.stabilityLimited,
        maxSpeedBefore: subdivision.maxSpeed,
        maxAccelerationBefore: subdivision.maxAcceleration,
        ...(before && after ? {
          diagnostics: Object.freeze({
            kineticEnergyBefore: before.kineticEnergy,
            kineticEnergyAfter: after.kineticEnergy,
            kineticEnergyDelta: after.kineticEnergy - before.kineticEnergy,
            momentumBefore: before.momentum,
            momentumAfter: after.momentum,
            momentumDelta: Object.freeze(after.momentum.map((value, i) => value - before.momentum[i])),
            maxSpeedAfter: after.maxSpeed,
            liveCountBefore: before.liveCount,
            liveCountAfter: after.liveCount,
          }),
        } : {}),
      });
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
        energyLedger: energyLedger.createSnapshot(),
        energyBudgetTimeline: energyBudgetTimeline.createSnapshot(),
        energyLifecycleAudit: energyLifecycleAudit.createSnapshot(),
        solverEnergyEvidence: solverEnergyEvidence.createSnapshot(),
        forceWorkJournal: forceWorkJournal.createSnapshot(),
        state: new Float64Array(state),
      });
    },
    restoreSnapshot(snapshot) {
      if (!snapshot || snapshot.layoutVersion !== PARTICLE_LAYOUT_VERSION || snapshot.stride !== stride || snapshot.count !== particleCount) throw new TypeError('Snapshot layout is incompatible with this execution adapter');
      validateState(snapshot.state, snapshot.tick);
      const nextConfig = validateParticleExecutionConfig(snapshot.config);
      const nextEnergyLedger = snapshot.energyLedger ? createEnergyLedger({ snapshot: snapshot.energyLedger }) : createEnergyLedger({ tick: snapshot.tick });
      const nextEnergyBudgetTimeline = createEnergyBudgetTimeline({ snapshot: snapshot.energyBudgetTimeline ?? null });
      const nextEnergyLifecycleAudit = createEnergyLifecycleAudit({ snapshot: snapshot.energyLifecycleAudit ?? null });
      const nextSolverEnergyEvidence = createSolverEnergyEvidence({ snapshot: snapshot.solverEnergyEvidence ?? null });
      const nextForceWorkJournal = createForceWorkJournal({ snapshot: snapshot.forceWorkJournal ?? null });
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
      energyLedger = nextEnergyLedger;
      energyBudgetTimeline = nextEnergyBudgetTimeline;
      energyLifecycleAudit = nextEnergyLifecycleAudit;
      solverEnergyEvidence = nextSolverEnergyEvidence;
      forceWorkJournal = nextForceWorkJournal;
      state = new Float64Array(snapshot.state);
      tick = snapshot.tick;
      activeConfig = nextConfig;
      return Object.freeze({ restored: true, tick });
    },
  });
}
