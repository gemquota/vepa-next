/**
 * VEPA v3 — Main Bootstrap
 * SharedArrayBuffer optional — falls back to ArrayBuffer + main-thread tick.
 */
import { initDebug, logDebug, isDebugVisible, updateLiveStats } from './debug.js';
import { EventBus } from './core/eventBus.js';
import { SplitMix32 as PRNG } from './core/prng.js';
import { WORLD_SIZE, PARTICLE_STRIDE, MAX_PARTICLES, MAX_SPECIES, DEFAULT_PARTICLES_PER_SPECIES, STRIDE_INDEXES, DNA_INDEXES, DNA_RANGES, LAW_INDEXES, LAW_COUNT, LAW_CATEGORIES } from './constants.js';
import { createParticleBuffer, setX, setY, setVelocity, setMass, setSpeciesId, setEnergy } from './state/particleBuffer.js';
import { createLawState, set as lawSet, clear as lawClear, serialize as serializeLawState, getActiveCount as getLawCount } from './state/lawState.js';
import { runtimeConfig } from './state/runtimeConfig.js';
import { createWorldParams, applyWorldParam, spawnCaps } from './state/worldParams.js';
import { sampleSpawnPosition, buildSpawnCentres, initialPopulationTarget, perSpeciesAllocation } from './spawn/distribution.js';
import { createDNABuffer, loadDefaults, getDNAFloat } from './dna/dnaBuffer.js';
import { createRenderer, resize as resizeRenderer, paintBackground } from './render/renderer.js';
import { syncSprites } from './render/spriteSync.js';
import { initUI } from './ui/ui.js';
import { initCamera, resetCamera, setWorldSize } from './ui/camera.js';
import { solve as solveMain, resetOffspringRing, drainOffspring as drainSolverOffspring } from './physics/solver.js';
import { createInsightEngine, update as updateInsight } from './engines/insightEngine.js';
import { createSpeciationEngine, updateSpeciation } from './engines/speciation.js';
import { createEcoEngine } from './engines/ecoEngine.js';
import { createWorldEventEngine } from './engines/worldEvents.js';
import { createEpochEngine, updateEpoch, getEpochs, getEpochSnapshot, resetEpoch } from './engines/epochEngine.js';
import { createNarrativeEngine, update as updateNarrative } from './engines/narrativeEngine.js';
import { createLineageTracker, trackBirth, trackDeath } from './engines/lineageTracker.js';
import { createGoalEngine, setCurrentValue as setGoalValue, update as updateGoal } from './engines/goalEngine.js';
import { createTimelineEngine, snapshot as timelineSnapshot, getTimeline as getTimelineList, clearTimeline as clearTimelineEngine, scrub as timelineScrub } from './engines/timelineEngine.js';
import { createGroupRegistry, updateGroups, groupCount, declareGroup } from './state/groupRegistry.js';
import { PRIME_DEFAULT } from './state/defaultPresets.js';
import { createMemoryBuffers, speciesMemory, groupMemory, blendMemory, adaptMemory, decayMemory, pruneGroupMemory, resetMemoryBuffers, MEM } from './state/memoryBuffers.js';
import { createAgencyEngine, updateAgency, detectMilestones, resetAgency } from './engines/agencyEngine.js';
import { computeSpeciesGoals, applyGoalNudges } from './engines/goalBehavior.js';
import { applyConstructions } from './state/construction.js';
import { runEconomy } from './state/economy.js';
import { runArtifacts } from './state/artifacts.js';
import { runGovernance } from './state/governance.js';
import { runInfrastructure } from './state/infrastructure.js';
import { createExoticState, stepExoticMatter } from './state/exoticMatter.js';
import { stepRelativity } from './state/relativity.js';
import { createQuantumState, stepQuantumMacro } from './state/quantumMacro.js';
import { createStellarState, stepStellar } from './state/stellar.js';
import { createSyntheticState, stepSynthetic } from './state/synthetic.js';
import { getFields, writeField } from './physics/fields.js';
import { createMultiplexController } from './multiplex/multiplexUI.js';
import { copyShardToWorld, summarizeMultiplex } from './multiplex/multiplex.js';
import {
  captureWorldState,
  restoreWorldState,
  exportWorldSave,
  parseWorldSave,
  createWorldSaveStore,
  compareWorldSaves,
  createUndoRing,
} from './state/worldSave.js';
initDebug();
logDebug('main module loaded');



const SUBSTEPS = 4;
const DT = 0.25;
const WORKER_SEED = 0x51f15e;

let bus, prng, particleBuffer, particleView, lawState, dnaBuffer, renderer;
let insightEngine, narrativeEngine, lineageEngine, goalEngine, timelineEngine;
let groupRegistry = null; // Set F.1 — social groups (declared + detected)
let speciationEngine = null, ecoEngine = null, worldEventEngine = null; // Set A.1/A.2/A.3
let epochEngine = null; // Set D.1 — eras, snapshots, extinction/recovery
let memoryBuffers = null; // Set G.1 — persistent species/group memory
let exoticState = null; // Set L.1 — exotic matter zones + per-particle states
let quantumState = null; // Set N.1 — macroscale superposition + entanglement
let stellarState = null; // Set O.1 — stars, black holes, supernovae
let syntheticState = null; // Set P.1 — synthetic organisms, uploaded consciousness, machine groups
// Physics worker bridge. SharedArrayBuffer lets the worker mutate the same
// particle memory without copying; browsers without cross-origin isolation
// keep the safe main-thread path instead of paying a per-tick transfer cost.
let physicsWorker = null;
let workerReady = false;
let workerPending = false;
let workerBusy = false;
let workerFailed = false;
let workerTickSentAt = 0;
let _workerTickInFlight = false;
let _workerOffspring = [];
let agencyEngine = null; // Set H.1 — narrative actor + world milestones
let speciesGoals = new Map(); // Set H.2 — per-species goal nudges
let seenMilestones = new Set(); // Set H.3 — once-only world milestones
let prevDead = new Uint8Array(0);
let timelineRecording = false;
const TIMELINE_SNAPSHOT_INTERVAL = 150;
const METRICS_CADENCE = 8;   // full particle metric scan (computeMetrics)
const SOCIAL_CADENCE = 4;    // economy/governance/infrastructure/artifacts
const LINEAGE_CADENCE = 4;   // death-transition scan
let _cachedMetrics = null;
let _metricsTick = -1;
let particleCount = 0, speciesCount = 5, tick = 0, paused = false;
let multiplexController = null;
let worldSize = WORLD_SIZE;
let worldParams = createWorldParams();
runtimeConfig.worldParams = worldParams;
const saveStore = createWorldSaveStore();
const undoRing = createUndoRing();
let undoEnabled = true;
let lastParamSnapshotAt = 0;
const PARAM_SNAPSHOT_DEBOUNCE = 1200;
let spawnRate = worldParams.SPAWN_RATE;
let spawnAccumulator = 0;
const DEFAULT_LAWS = PRIME_DEFAULT.laws;

function applyPrimeWorldConfig() {
    const overrides = {
        FIELD_THERMAL: 0.5,   // thermal gradient → extraction + governance
        FIELD_INFO: 0.5,      // info medium → economy/markets + lensing
        WELL_COUNT: 3,        // gravity wells → density → groups + stars
        SPAWN_CENTRES: 4,     // clustered start → speciation structure
        SPAWN_CENTRE_BIAS: 0.15,
    };
    for (const [key, value] of Object.entries(overrides)) {
        worldParams = applyWorldParam(worldParams, key, value);
    }
    runtimeConfig.worldParams = worldParams;
}

function rng() { return prng.next(); }

function canUsePhysicsWorker() {
    return typeof Worker !== 'undefined' && typeof SharedArrayBuffer !== 'undefined'
        && particleBuffer instanceof SharedArrayBuffer;
}

function stopPhysicsWorker() {
    if (physicsWorker) physicsWorker.terminate();
    physicsWorker = null;
    workerReady = false;
    workerPending = false;
    workerBusy = false;
    _workerTickInFlight = false;
    _workerOffspring.length = 0;
    _cachedMetrics = null;
    _metricsTick = -1;
}

function workerConfig() {
    return {
        particleCount,
        worldSize,
        stride: PARTICLE_STRIDE,
        dt: DT * runtimeConfig.simSpeed,
        seed: WORKER_SEED,
        worldParams: { ...(runtimeConfig.worldParams || {}) },
        computeEngine: runtimeConfig.computeEngine,
        lawState: serializeLawState(lawState),
    };
}

function syncPhysicsWorker() {
    if (!physicsWorker || !workerReady || workerFailed) return;
    // DNA is a regular Uint16Array (the particle buffer is the large SAB), so
    // include a fresh structured-clone on edits; otherwise the worker would
    // keep simulating the boot-time genome forever.
    physicsWorker.postMessage({
        type: 'CONFIG',
        config: workerConfig(),
        dnaBuffer: dnaBuffer ? dnaBuffer.buffer : undefined,
    });
}

function finishPhysicsTick(tickStart, offspring = null) {
    // Population and intelligence remain on the main thread, but run once per
    // completed worker tick rather than once per animation frame. This keeps
    // reproduction, analytics, and HUD state coherent while
    // the render loop remains free to paint between worker responses.
    advancePopulation(offspring);
    updateIntelligence();
    perfTickMs = emaPerf(perfTickMs, performance.now() - tickStart);
    updateLiveStats({
        fps,
        tick,
        particles: particleCount,
        species: speciesCount,
        laws: getLawCount(lawState),
        frameMs: perfFrameMs,
        tickMs: perfTickMs,
        renderMs: perfRenderMs,
    });
    bus.emit('physics:tick', { tick, buffer: particleBuffer, particleCount, speciesCount });
}

function handleWorkerTick(message) {
    workerBusy = false;
    _workerTickInFlight = false;
    const tickStart = workerTickSentAt || performance.now();
    const offspring = Array.isArray(message.offspring) ? message.offspring : [];
    finishPhysicsTick(tickStart, offspring);
}

function solve(...args) {
    if (physicsWorker && workerReady && !workerFailed) {
        // The legacy render-loop bookkeeping still runs after this queue call;
        // cancel its local tick increment on every in-flight frame while the
        // worker owns the actual solver completion.
        tick = Math.max(0, tick - 1);
        if (!workerBusy) {
            workerBusy = true;
            _workerTickInFlight = true;
            workerTickSentAt = performance.now();
            physicsWorker.postMessage({
                type: 'TICK',
                particleCount: args[1],
                dt: args[6] || DT,
            });
        }
        return false;
    }
    solveMain(...args);
    return true;
}

function drainOffspring() {
    const local = drainSolverOffspring();
    if (_workerOffspring.length) return local.concat(_workerOffspring.splice(0));
    return local;
}

function startPhysicsWorker() {
    stopPhysicsWorker();
    workerFailed = false;
    if (!canUsePhysicsWorker()) return false;
    try {
        physicsWorker = new Worker(new URL('./worker/physics.worker.js', import.meta.url), { type: 'module' });
        workerPending = true;
        physicsWorker.onmessage = (event) => {
            const message = event.data || {};
            if (message.type === 'WORKER_READY') return;
            if (message.type === 'INIT_COMPLETE') {
                workerReady = true;
                workerPending = false;
                logDebug('physics worker ready (SharedArrayBuffer, deterministic solver)');
                return;
            }
            if (message.type === 'TICK_COMPLETE') {
                handleWorkerTick(message);
                return;
            }
            if (message.type === 'ERROR') {
                logDebug('physics worker error: ' + message.error, 'error');
                workerFailed = true;
                stopPhysicsWorker();
                return;
            }
        };
        physicsWorker.onerror = (error) => {
            logDebug('physics worker unavailable: ' + (error.message || 'unknown error'), 'warn');
            workerFailed = true;
            stopPhysicsWorker();
        };
        physicsWorker.postMessage({
            type: 'INIT',
            buffer: particleBuffer,
            count: particleCount,
            dnaBuffer: dnaBuffer.buffer,
            config: workerConfig(),
        });
        return true;
    } catch (error) {
        logDebug('physics worker unavailable: ' + (error.message || error), 'warn');
        stopPhysicsWorker();
        workerFailed = true;
        return false;
    }
}

async function boot() {
    console.log('[VEPA v3] Booting...');
    logDebug('boot: starting');
    const t0 = performance.now();

    bus = new EventBus();
    prng = new PRNG(Date.now());

    const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
    particleBuffer = buf.buffer;
    particleView = buf.view;
    const isShared = buf.isShared;
    console.log(`[VEPA v3] SharedArrayBuffer: ${isShared}`);
    logDebug('SharedArrayBuffer: ' + isShared);

    lawState = createLawState();
    dnaBuffer = createDNABuffer();
    loadDefaults(dnaBuffer, DNA_RANGES);

    for (const name of DEFAULT_LAWS) {
        if (LAW_INDEXES[name] !== undefined) lawSet(lawState, LAW_INDEXES[name]);
    }

    applyPrimeWorldConfig();

    spawnDefaultPopulation();

    const canvas = document.getElementById('sim-canvas');
    renderer = createRenderer(canvas, MAX_PARTICLES);
    resizeRenderer(renderer);
    refreshBackground();
    window.addEventListener('resize', () => {
        if (renderer) resizeRenderer(renderer);
        refreshBackground();
    });
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
            if (renderer) resizeRenderer(renderer);
        });
        ro.observe(canvas);
    }
    initCamera(canvas, worldSize);

    initUI(bus, lawState, dnaBuffer);
    wireEvents();

    multiplexController = createMultiplexController(bus, () => ({
        view: particleView,
        count: particleCount,
        dna: dnaBuffer,
        laws: lawState,
        speciesCount,
    }), (shard) => {
        // Import the selected multiplex shard into the main world.
        const imported = copyShardToWorld(shard, { view: particleView, dna: dnaBuffer, laws: lawState });
        particleCount = imported.count;
        speciesCount = imported.speciesCount;
        resetOffspringRing();
        resetIntelligence();
        bus.emit('species:sync', { count: speciesCount });
        bus.emit('dna:sync');
        bus.emit('law:sync');
        logDebug(`multiplex import: ${imported.count} particles / ${imported.speciesCount} species`);
    });
    window.openChaosMultiplex = () => { if (multiplexController) multiplexController.openModal(); };
    bus.on('multiplex:started', () => {
        paused = true;
        bus.emit('sim:paused', { paused: true });
    });
    bus.on('multiplex:exited', () => {
        paused = false;
        bus.emit('sim:paused', { paused: false });
    });

        insightEngine = createInsightEngine(bus, { scanInterval: 90, clusterRadius: 60, minClusterSize: 5 });
    narrativeEngine = createNarrativeEngine(bus);
    lineageEngine = createLineageTracker(bus);
    goalEngine = createGoalEngine(bus);
    timelineEngine = createTimelineEngine(bus, { autoSnapshotInterval: 0, maxSnapshots: 20 });
    groupRegistry = createGroupRegistry();
        speciationEngine = createSpeciationEngine(bus, { prng: () => prng.next() });
    ecoEngine = createEcoEngine(bus);
    worldEventEngine = createWorldEventEngine(bus);
    epochEngine = createEpochEngine(bus);
    memoryBuffers = createMemoryBuffers();
    exoticState = createExoticState();
    quantumState = createQuantumState();
    stellarState = createStellarState();
    syntheticState = createSyntheticState();
    agencyEngine = createAgencyEngine(bus);
    setGoalValue(goalEngine, 'scanInterval', insightEngine.cfg.scanInterval);
    setGoalValue(goalEngine, 'clusterRadius', insightEngine.cfg.clusterRadius);
    setGoalValue(goalEngine, 'maxForce', runtimeConfig.maxForce);
    setGoalValue(goalEngine, 'drag', runtimeConfig.dragMultiplier);
    setGoalValue(goalEngine, 'birthRate', runtimeConfig.birthRate);
    setGoalValue(goalEngine, 'deathRate', runtimeConfig.deathRate);
    wireGoalEvents();
    prevDead = new Uint8Array(particleCount);

    // Keep UI work on the main thread, but move the deterministic solver and
    // its spatial-grid/pairwise hot path off-thread whenever SAB is available.
    // The worker is intentionally started after all initial writes are done.
    startPhysicsWorker();
    requestAnimationFrame(renderLoop);

    const dt = (performance.now() - t0).toFixed(1);
    console.log(`[VEPA v3] Booted in ${dt}ms — ${particleCount} particles, ${speciesCount} species`);
    logDebug(`booted in ${dt}ms — ${particleCount} particles, ${speciesCount} species`);
    bus.emit('boot:complete', { particleCount, speciesCount, dt });
}

// Fallback colours for user-added species beyond the built-in profiles
// (matches the species panel's deterministic hue rotation).
const EXTRA_SPECIES_COLORS = [
    [120, 160, 255], [255, 140, 60], [180, 255, 120], [255, 120, 220],
    [120, 255, 220], [240, 220, 100], [160, 120, 255], [255, 160, 160],
];

function profileColor(s) {
    const p = SPECIES_PROFILES[s];
    if (p) return p.color;
    return EXTRA_SPECIES_COLORS[s % EXTRA_SPECIES_COLORS.length];
}

const SPECIES_PROFILES = [
    { name: 'Predator', color: [255, 80, 80], force: 1.2, viscosity: 0.95, birthRate: 0.3, predationBias: 0.8 },
    { name: 'Sol', color: [255, 200, 50], force: 0.8, viscosity: 0.97, birthRate: 0.1, fusion: 2.0 },
    { name: 'Life', color: [80, 255, 120], force: 1.0, viscosity: 0.98, birthRate: 0.5, mutation: 0.3 },
    { name: 'Aether', color: [120, 160, 255], force: 0.5, viscosity: 0.99, signalResp: 2.0, pulseRate: 0.3 },
    { name: 'Void', color: [100, 60, 140], force: -0.5, viscosity: 0.96, deathRate: 0.2, hiddenMass: 3.0 },
];

/** Append one freshly spawned particle at `pos` with the given species. */
function spawnSingleParticle(species, pos) {
    if (_workerTickInFlight) return;
    if (particleCount >= MAX_PARTICLES) return;
    const idx = particleCount;
    const ptr = idx * PARTICLE_STRIDE;
    setX(particleBuffer, idx, PARTICLE_STRIDE, pos.x);
    setY(particleBuffer, idx, PARTICLE_STRIDE, pos.y);
    particleView[ptr + STRIDE_INDEXES.POS_Z] = pos.z;
    setVelocity(particleBuffer, idx, PARTICLE_STRIDE, 0, 0, 0);
    setMass(particleBuffer, idx, PARTICLE_STRIDE, 1.0 + prng.nextFloat(0, 1.0));
    setSpeciesId(particleBuffer, idx, PARTICLE_STRIDE, species);
    setEnergy(particleBuffer, idx, PARTICLE_STRIDE, 50 + prng.nextFloat(0, 50));
    for (let d = 0; d < 42; d++) {
        const r = DNA_RANGES[d] || { min: -1, max: 1 };
        particleView[ptr + STRIDE_INDEXES.DNA_CACHE_START + d] = getDNAFloat(dnaBuffer, species, d, r.min, r.max);
    }
    const sp = SPECIES_PROFILES[species] || SPECIES_PROFILES[0];
    particleView[ptr + STRIDE_INDEXES.COLOR_R] = sp.color[0];
    particleView[ptr + STRIDE_INDEXES.COLOR_G] = sp.color[1];
    particleView[ptr + STRIDE_INDEXES.COLOR_B] = sp.color[2];
    particleView[ptr + STRIDE_INDEXES.DEAD] = 0;
    particleView[ptr + STRIDE_INDEXES.AGE] = 0;
    particleView[ptr + STRIDE_INDEXES.SIGNAL] = 0;
    particleView[ptr + STRIDE_INDEXES.BOND_COUNT] = 0;
    particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_1] = -1;
    particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_2] = -1;
    particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_3] = -1;
    particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_4] = -1;
    particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_5] = -1;
    particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_6] = -1;
    particleView[ptr + STRIDE_INDEXES.MEMORY] = 0;
    particleView[ptr + STRIDE_INDEXES.HUNGER] = 0;
    particleView[ptr + STRIDE_INDEXES.ARMOR] = prng.nextFloat(0, 0.5);
    particleView[ptr + STRIDE_INDEXES.MITOSIS_TIMER] = 0;
    particleView[ptr + STRIDE_INDEXES.PARTNER_ID] = -1;
    particleView[ptr + STRIDE_INDEXES.TEMPERATURE] = 0.5;
    particleView[ptr + STRIDE_INDEXES.CHARGE] = 0;
    particleView[ptr + STRIDE_INDEXES.ALPHA] = 0.8;
    particleView[ptr + STRIDE_INDEXES.RADIUS] = 0.6;
    particleView[ptr + STRIDE_INDEXES.ENTANGLE_ID] = -1;
    particleView[ptr + STRIDE_INDEXES.ENTANGLE_PHASE] = 0;
    particleCount++;
}

function spawnDefaultPopulation(preserveDNA = false, keepSpecies = false) {
    const profiles = SPECIES_PROFILES;

    if (!keepSpecies) speciesCount = Math.min(profiles.length, MAX_SPECIES);
    let idx = 0;
    const caps = spawnCaps(worldParams);
    const totalTarget = initialPopulationTarget(worldParams, caps);
    const perSpecies = perSpeciesAllocation(totalTarget, speciesCount);
    const groundH = Math.max(0, Math.min(1, worldParams.GROUND_HEIGHT));

    for (let s = 0; s < speciesCount; s++) {
        const p = profiles[s] || null;
        if (p && !preserveDNA) setDNAFromProfile(s, p);

        const gridDim = Math.max(2, Math.ceil(Math.cbrt(perSpecies)));
        const cellSize = (worldSize - 10) / gridDim;

        const centres = buildSpawnCentres(
            Math.max(1, Math.min(64, Math.round(worldParams.SPAWN_CENTRES) || 1)),
            worldParams.SPAWN_CENTRE_RANDOM,
            worldSize,
            prng,
        );

        for (let i = 0; i < perSpecies && idx < caps.hardCap; i++) {
            const ptr = idx * PARTICLE_STRIDE;
            const gx = i % gridDim;
            const gy = Math.floor(i / gridDim) % gridDim;
            const gz = Math.floor(i / (gridDim * gridDim));
            let px = 5 + gx * cellSize + cellSize * 0.5 + (prng.nextFloat(0, 1) - 0.5) * cellSize * 0.4;
            let py = 5 + gy * cellSize + cellSize * 0.5 + (prng.nextFloat(0, 1) - 0.5) * cellSize * 0.4;
            let pz = 5 + gz * cellSize + cellSize * 0.5 + (prng.nextFloat(0, 1) - 0.5) * cellSize * 0.4;
            if (worldParams.SHAPE > 0) {
                px = px + (prng.nextFloat(0, worldSize) - px) * worldParams.SHAPE;
                py = py + (prng.nextFloat(0, worldSize) - py) * worldParams.SHAPE;
                pz = pz + (prng.nextFloat(0, worldSize) - pz) * worldParams.SHAPE;
            }
            if (worldParams.SPAWN_CENTRE_BIAS > 0 && centres.length > 0) {
                const c = centres[Math.floor(prng.nextFloat(0, centres.length))];
                px = px + (c.x - px) * worldParams.SPAWN_CENTRE_BIAS;
                py = py + (c.y - py) * worldParams.SPAWN_CENTRE_BIAS;
                pz = pz + (c.z - pz) * worldParams.SPAWN_CENTRE_BIAS;
            }
            if (groundH < 1) pz = Math.min(pz, Math.max(0, worldSize * groundH));
            setX(particleBuffer, idx, PARTICLE_STRIDE, px);
            setY(particleBuffer, idx, PARTICLE_STRIDE, py);
            particleView[ptr + STRIDE_INDEXES.POS_Z] = pz;
            setVelocity(particleBuffer, idx, PARTICLE_STRIDE, 0, 0, 0);
            setMass(particleBuffer, idx, PARTICLE_STRIDE, 1.0 + prng.nextFloat(0, 1.0));
            setSpeciesId(particleBuffer, idx, PARTICLE_STRIDE, s);
            setEnergy(particleBuffer, idx, PARTICLE_STRIDE, 50 + prng.nextFloat(0, 50));
            // Copy species DNA to particle DNA cache (stride 8-49)
            const dnaBase = s * 64;
            for (let d = 0; d < 42; d++) {
                const raw = dnaBuffer[dnaBase + d] || 0;
                const norm = raw / 65535;
                const r = DNA_RANGES[d] || { min: -1, max: 1 };
                particleView[ptr + STRIDE_INDEXES.DNA_CACHE_START + d] = norm * (r.max - r.min) + r.min;
            }
            particleView[ptr + STRIDE_INDEXES.DEAD] = 0;
            particleView[ptr + STRIDE_INDEXES.AGE] = 0;
            particleView[ptr + STRIDE_INDEXES.SIGNAL] = 0;
            particleView[ptr + STRIDE_INDEXES.BOND_COUNT] = 0;
            particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_1] = -1;
            particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_2] = -1;
        particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_3] = -1;
        particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_4] = -1;
        particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_5] = -1;
        particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_6] = -1;
            particleView[ptr + STRIDE_INDEXES.MEMORY] = 0;
            particleView[ptr + STRIDE_INDEXES.HUNGER] = 0;
            particleView[ptr + STRIDE_INDEXES.ARMOR] = prng.nextFloat(0, 0.5);
            particleView[ptr + STRIDE_INDEXES.MITOSIS_TIMER] = 0;
            particleView[ptr + STRIDE_INDEXES.PARTNER_ID] = -1;
            particleView[ptr + STRIDE_INDEXES.TEMPERATURE] = 0.5;
            particleView[ptr + STRIDE_INDEXES.CHARGE] = 0;
            particleView[ptr + STRIDE_INDEXES.ELECTRIC_ENERGY] = 0;
            particleView[ptr + STRIDE_INDEXES.STORED_ENERGY] = 0;
            particleView[ptr + STRIDE_INDEXES.REPRO_DRIVE] = 0;
            particleView[ptr + STRIDE_INDEXES.RADIATION_EXPOSURE] = 0;
            particleView[ptr + STRIDE_INDEXES.PHASE_1] = 0;
            particleView[ptr + STRIDE_INDEXES.PHASE_2] = 0;
            particleView[ptr + STRIDE_INDEXES.SOUL] = 0;
            particleView[ptr + STRIDE_INDEXES.TRAIL_X] = 0;
            particleView[ptr + STRIDE_INDEXES.TRAIL_Y] = 0;
            particleView[ptr + STRIDE_INDEXES.TRAIL_Z] = 0;
            particleView[ptr + STRIDE_INDEXES.ENTANGLE_ID] = -1;
            particleView[ptr + STRIDE_INDEXES.ENTANGLE_PHASE] = 0;

            for (let d = 0; d < 42; d++) {
                particleView[ptr + STRIDE_INDEXES.DNA_CACHE_START + d] = getDNAFloat(dnaBuffer, s, d, DNA_RANGES[d].min, DNA_RANGES[d].max);
            }

            const col = profileColor(s);
            particleView[ptr + STRIDE_INDEXES.COLOR_R] = col[0];
            particleView[ptr + STRIDE_INDEXES.COLOR_G] = col[1];
            particleView[ptr + STRIDE_INDEXES.COLOR_B] = col[2];
            particleView[ptr + STRIDE_INDEXES.ALPHA] = 0.8;
            particleView[ptr + STRIDE_INDEXES.RADIUS] = 0.6;
            idx++;
        }
    }
    particleCount = idx;
}

/** Repaint the atmospheric backdrop canvas (sized to the viewport). */
function refreshBackground() {
    const bg = document.getElementById('bg-canvas');
    if (bg) paintBackground(bg);
}

/** Spawn offspring produced by REPRO law into the particle buffer. */
function spawnOffspring(offspring = null) {
    const list = offspring || drainOffspring();
    if (!list.length) return;
    for (const off of list) {
        if (particleCount >= MAX_PARTICLES) break;
        const ptr = particleCount * PARTICLE_STRIDE;
        setX(particleBuffer, particleCount, PARTICLE_STRIDE, off.x);
        setY(particleBuffer, particleCount, PARTICLE_STRIDE, off.y);
        particleView[ptr + STRIDE_INDEXES.POS_Z] = off.z || 0;
        setVelocity(particleBuffer, particleCount, PARTICLE_STRIDE, off.vx || 0, off.vy || 0, off.vz || 0);
        setMass(particleBuffer, particleCount, PARTICLE_STRIDE, off.mass || 1.0);
        setSpeciesId(particleBuffer, particleCount, PARTICLE_STRIDE, off.speciesId);
        setEnergy(particleBuffer, particleCount, PARTICLE_STRIDE, off.energy || 60);
        if (off.dna && off.dna.length) {
            for (let d = 0; d < 42 && d < off.dna.length; d++) {
                particleView[ptr + STRIDE_INDEXES.DNA_CACHE_START + d] = off.dna[d];
            }
        }
        particleView[ptr + STRIDE_INDEXES.DEAD] = 0;
        particleView[ptr + STRIDE_INDEXES.AGE] = 0;
        particleView[ptr + STRIDE_INDEXES.SIGNAL] = 0;
        particleView[ptr + STRIDE_INDEXES.BOND_COUNT] = 0;
        particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_1] = -1;
        particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_2] = -1;
        particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_3] = -1;
        particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_4] = -1;
        particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_5] = -1;
        particleView[ptr + STRIDE_INDEXES.BOND_PARTNER_6] = -1;
        particleView[ptr + STRIDE_INDEXES.MEMORY] = 0;
        particleView[ptr + STRIDE_INDEXES.HUNGER] = 0;
        particleView[ptr + STRIDE_INDEXES.ARMOR] = 0.2;
        particleView[ptr + STRIDE_INDEXES.MITOSIS_TIMER] = 0;
        particleView[ptr + STRIDE_INDEXES.PARTNER_ID] = -1;
        particleView[ptr + STRIDE_INDEXES.TEMPERATURE] = 0.5;
        particleView[ptr + STRIDE_INDEXES.CHARGE] = 0;
        particleView[ptr + STRIDE_INDEXES.SOUL] = 0;
        particleView[ptr + STRIDE_INDEXES.ENTANGLE_ID] = -1;
        particleView[ptr + STRIDE_INDEXES.ENTANGLE_PHASE] = 0;
        const sp = SPECIES_PROFILES[off.speciesId] || SPECIES_PROFILES[0];
        const defR = sp ? sp.color[0] : 200;
        const defG = sp ? sp.color[1] : 200;
        const defB = sp ? sp.color[2] : 200;
        particleView[ptr + STRIDE_INDEXES.COLOR_R] = off.colorR != null ? Math.max(0, Math.min(255, off.colorR)) : defR;
        particleView[ptr + STRIDE_INDEXES.COLOR_G] = off.colorG != null ? Math.max(0, Math.min(255, off.colorG)) : defG;
        particleView[ptr + STRIDE_INDEXES.COLOR_B] = off.colorB != null ? Math.max(0, Math.min(255, off.colorB)) : defB;
        particleView[ptr + STRIDE_INDEXES.ALPHA] = 0.8;
        particleView[ptr + STRIDE_INDEXES.RADIUS] = 0.6;
        particleCount++;
        if (lineageEngine) {
            trackBirth(lineageEngine, off.parentId != null ? off.parentId : -1, particleCount - 1, off.speciesId, 0);
        }
    }
}

function advancePopulation(offspring = null) {
    spawnOffspring(offspring);
    const caps = spawnCaps(worldParams);
    if (spawnRate > 0 && particleCount < caps.softCap) {
        spawnAccumulator += spawnRate * (DT * runtimeConfig.simSpeed);
        while (spawnAccumulator >= 1 && particleCount < caps.softCap) {
            spawnAccumulator -= 1;
            spawnSingleParticle(
                Math.floor(prng.nextFloat(0, speciesCount)),
                sampleSpawnPosition(worldParams, worldSize, prng),
            );
        }
    }
}

function setDNAFromProfile(species, profile) {
    const MAP = {
        force: 'FORCE', viscosity: 'VISCOSITY', birthRate: 'BIRTH_RATE',
        predationBias: 'PREDATION_BIAS', fusion: 'FUSION', mutation: 'MUTATION',
        signalResp: 'SIGNAL_RESP', pulseRate: 'PULSE_RATE', deathRate: 'DEATH_RATE',
        hiddenMass: 'HIDDEN_MASS',
    };
    for (const [key, value] of Object.entries(profile)) {
        const dnaKey = MAP[key];
        if (!dnaKey) continue;
        const paramIdx = DNA_INDEXES[dnaKey];
        if (paramIdx === undefined) continue;
        const r = DNA_RANGES[paramIdx];
        const clamped = Math.max(r.min, Math.min(r.max, value));
        const normalized = (clamped - r.min) / (r.max - r.min);
        dnaBuffer[species * 64 + paramIdx] = Math.round(normalized * 65535);
    }
}function wireEvents() {
    const currentWorldState = (name = '') => captureWorldState({
        view: particleView,
        count: particleCount,
        speciesCount,
        dna: dnaBuffer,
        laws: lawState,
        worldParams,
        runtime: runtimeConfig,
        worldSize,
        tick,
        name,
    });
    const emitUndoState = () => {
        bus.emit('world:undoState', { canUndo: undoRing.canUndo(), canRedo: undoRing.canRedo(), enabled: undoEnabled });
    };
    const commitAutoSnapshot = () => {
        if (!undoEnabled) return;
        if (multiplexController && multiplexController.isActive()) return; // frozen main world
        if (particleCount <= 0) return; // skip empty boots
        undoRing.commit(currentWorldState());
        emitUndoState();
    };
    const applyWorldRestore = (state) => {
        const restoreWorker = !!physicsWorker;
        stopPhysicsWorker();
        const out = restoreWorldState(state, {
            view: particleView,
            dna: dnaBuffer,
            laws: lawState,
            worldParams,
            runtime: runtimeConfig,
        });
        particleCount = out.particleCount;
        speciesCount = out.speciesCount;
        worldSize = out.worldSize;
        setWorldSize(out.worldSize);
        resetOffspringRing();
        resetIntelligence();
        if (restoreWorker) startPhysicsWorker();
        bus.emit('species:sync', { count: speciesCount });
        bus.emit('dna:sync');
        bus.emit('law:sync');
        bus.emit('world:paramsRestored');
        bus.emit('world:restored', { particleCount, speciesCount, worldSize });
    };
    bus.on('sim:chaos', () => commitAutoSnapshot());
    bus.on('sim:restart', () => commitAutoSnapshot());
    bus.on('preset:load', () => commitAutoSnapshot());
    bus.on('species:aboutToChange', () => commitAutoSnapshot());
    bus.on('world:paramChanged', () => {
        if (!undoEnabled) return;
        const now = Date.now();
        if (now - lastParamSnapshotAt < PARAM_SNAPSHOT_DEBOUNCE) return;
        if (multiplexController && multiplexController.isActive()) return;
        if (particleCount <= 0) return;
        lastParamSnapshotAt = now;
        undoRing.commit(currentWorldState());
        emitUndoState();
    });
    bus.on('sim:hardReset', () => {
        if (particleCount <= 0) return;
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        saveStore.save(currentWorldState(`AUTO pre-reset ${hh}:${mm}`)).then((res) => {
            if (res && res.ok) logDebug('pre-reset world saved for rollback');
        });
    });
    bus.on('world:save', async ({ name }) => {
        const n = String(name || '').trim();
        if (!n) return;
        const res = await saveStore.save(currentWorldState(n));
        bus.emit('world:list');
        bus.emit('world:saved', { name: n, ok: !!(res && res.ok), error: res && res.error });
    });
    bus.on('world:load', async ({ name }) => {
        const state = await saveStore.load(String(name || ''));
        if (!state) return;
        commitAutoSnapshot(); // the load itself is undoable
        applyWorldRestore(state);
        bus.emit('world:loaded', { name: state.name });
        emitUndoState();
    });
    bus.on('world:undo', () => {
        const target = undoRing.undo(currentWorldState());
        if (!target) return;
        applyWorldRestore(target);
        emitUndoState();
    });
    bus.on('world:redo', () => {
        const target = undoRing.redo(currentWorldState());
        if (!target) return;
        applyWorldRestore(target);
        emitUndoState();
    });
    bus.on('world:list', async () => {
        const saves = await saveStore.list();
        bus.emit('world:listResponse', { saves });
    });
    bus.on('world:remove', async ({ name }) => {
        await saveStore.remove(String(name || ''));
        bus.emit('world:list');
    });
    bus.on('world:export', async ({ name }) => {
        const state = await saveStore.load(String(name || ''));
        if (!state) return;
        bus.emit('world:exported', { name: state.name, json: exportWorldSave(state) });
    });
    bus.on('world:import', async ({ json }) => {
        try {
            const state = parseWorldSave(json);
            const res = await saveStore.save(state);
            bus.emit('world:list');
            bus.emit('world:imported', { ok: !!(res && res.ok), error: res && res.error });
        } catch (e) {
            bus.emit('world:imported', { ok: false, error: String((e && e.message) || e) });
        }
    });
    bus.on('world:compare', async ({ names }) => {
        const wanted = Array.isArray(names) ? names : [];
        const loaded = [];
        for (const n of wanted) {
            const state = await saveStore.load(String(n));
            if (state) loaded.push(state);
        }
        const matrix = compareWorldSaves(currentWorldState('LIVE'), loaded);
        bus.emit('world:compareResponse', { matrix });
    });
    bus.on('world:toggleAutoUndo', ({ enabled }) => {
        undoEnabled = enabled !== false;
        emitUndoState();
    });
    emitUndoState();

    bus.on('law:sync', syncPhysicsWorker);
    bus.on('law:toggled', syncPhysicsWorker);
    bus.on('dna:sync', syncPhysicsWorker);
    bus.on('dna:changed', syncPhysicsWorker);
    bus.on('world:paramApplied', syncPhysicsWorker);
    bus.on('compute:changed', syncPhysicsWorker);
    bus.on('sim:pause', () => { paused = true; });
    bus.on('sim:resume', () => { paused = false; });
    bus.on('sim:restart', (opts = {}) => {
        const restartWorker = !!physicsWorker;
        stopPhysicsWorker();
        prng = new PRNG(Date.now());
        particleView.fill(0);
        resetOffspringRing();
        spawnDefaultPopulation(true, true);
        if (restartWorker) startPhysicsWorker();
        tick = 0;
        paused = false;
        resetIntelligence();
        bus.emit('species:sync', { count: speciesCount });
        logDebug('simulation restarted');
        console.log('[VEPA v3] Simulation restarted');
        resetCamera();
        bus.emit('law:sync');
        bus.emit('sim:paused', { paused: false });
    });
    bus.on('species:changed', ({ count }) => {
        speciesCount = Math.max(1, Math.min(count || 1, MAX_SPECIES));
    });

    bus.on('sim:togglePause', () => { paused = !paused; bus.emit('sim:paused', { paused }); });
    bus.on('sim:hardReset', () => {
        console.log('[VEPA v3] Hard reset requested');
        logDebug('hard reset requested', 'warn');
        location.reload();
    });
    bus.on('help:toggle', () => {
        window.open('https://github.com/gemquota/vepa/blob/new/README.md', '_blank', 'noopener');
    });

    bus.on('sim:chaos', () => {
        const shuffled = [];
        for (let i = 0; i < LAW_COUNT; i++) shuffled.push(i);
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const groups = 3 + Math.floor(Math.random() * 3); // 3-5 groups
        const groupSize = Math.ceil(LAW_COUNT / groups);
        const intensity = 0.3 + Math.random() * 0.7;

        for (let i = 0; i < LAW_COUNT; i++) lawClear(lawState, i);

        for (let g = 0; g < groups; g++) {
            const start = g * groupSize;
            const end = Math.min(start + groupSize, LAW_COUNT);
            const actProb = 0.4 + Math.random() * 0.6;
            if (Math.random() > 0.3) { // 70% chance group activates
                for (let j = start; j < end; j++) {
                    if (Math.random() < actProb) {
                        lawSet(lawState, shuffled[j]);
                    }
                }
            }
        }

        for (let s = 0; s < speciesCount; s++) {
            for (let p = 0; p < 42; p++) {
                if (Math.random() > 0.85) {
                    const r = DNA_RANGES[p];
                    const val = r.min + Math.random() * (r.max - r.min);
                    const clamped = Math.max(r.min, Math.min(r.max, val));
                    const normalized = (clamped - r.min) / (r.max - r.min);
                    dnaBuffer[s * 64 + p] = Math.round(normalized * 65535);
                }
            }
        }

        const active = getLawCount(lawState);
        logDebug(`chaos multiplexed: ${groups} groups, ${active} laws, ${Math.round(intensity*100)}% intensity`, 'warn');
        bus.emit('law:sync');
        bus.emit('narrative:system', { text: `Chaos multiplexed: ${groups} groups, ${active} laws, ${Math.round(intensity*100)}% intensity` });
    });

    bus.on('sim:chaosClear', () => {
        for (let i = 0; i < LAW_COUNT; i++) {
            lawClear(lawState, i);
        }
        logDebug('all laws cleared', 'warn');
        bus.emit('law:sync');
        bus.emit('narrative:system', { text: 'All laws cleared.' });
    });

    bus.on('sim:chaosSelective', ({ categories }) => {
        const catMap = { physics: true, biology: true, chemistry: true, thermodynamics: true, metaphysics: true };
        const activeCats = {};
        for (const c of categories) { activeCats[c] = true; }
        for (const [catName, cat] of Object.entries(LAW_CATEGORIES)) {
            if (!activeCats[catName]) continue;
            for (const idx of cat.laws) {
                if (Math.random() > 0.3) {
                    if (Math.random() > 0.5) {
                        lawSet(lawState, idx);
                    } else {
                        lawClear(lawState, idx);
                    }
                }
            }
        }
        bus.emit('law:sync');
        bus.emit('narrative:system', { text: 'Selective chaos applied.' });
    });

    bus.on('group:declare', ({ name, speciesIds }) => {
        if (!groupRegistry) return;
        const g = declareGroup(groupRegistry, name, speciesIds);
        bus.emit('narrative:system', { text: `Declared group ${g.name}.` });
    });

    bus.on('speciation:split', ({ parent, child }) => {
        speciesCount = Math.max(speciesCount, child + 1);
        if (memoryBuffers) {
            blendMemory(speciesMemory(memoryBuffers, child), speciesMemory(memoryBuffers, parent), worldParams.CULTURAL_TRANSMISSION || 0.5);
        }
        bus.emit('species:sync', { count: speciesCount });
        bus.emit('narrative:system', { text: `Speciation burst: S${parent} diverged into S${child}.` });
    });
    bus.on('speciation:extinct', ({ species }) => {
        bus.emit('narrative:system', { text: `S${species} went extinct — its slot is freed.` });
    });

    bus.on('worldEvent:triggered', ({ type }) => {
        undoRing.commit(currentWorldState());
        const fs = getFields();
        let text = '';
        if (type === 'famine') {
            worldParams = applyWorldParam(worldParams, 'SPAWN_RATE', (worldParams.SPAWN_RATE || 0) + 2);
            if (fs) writeField(fs, 'INFO', worldSize * 0.25, worldSize * 0.25, worldSize * 0.5, -8);
            text = 'Famine confirmed — drought cells written, spawn rate raised.';
        } else if (type === 'bloom') {
            worldParams = applyWorldParam(worldParams, 'SPAWN_RATE', Math.max(0, (worldParams.SPAWN_RATE || 0) - 2));
            if (fs) writeField(fs, 'INFO', worldSize * 0.75, worldSize * 0.75, worldSize * 0.5, 8);
            text = 'Bloom confirmed — fertilization written, spawn rate eased.';
        } else if (type === 'collapse') {
            worldParams = applyWorldParam(worldParams, 'SPAWN_RATE', (worldParams.SPAWN_RATE || 0) + 5);
            worldParams = applyWorldParam(worldParams, 'MUTATION_RATE', (worldParams.MUTATION_RATE || 0) + 0.05);
            if (fs) writeField(fs, 'INFO', worldSize * 0.5, worldSize * 0.5, worldSize * 0.5, 12);
            text = 'Collapse confirmed — emergency spawn + mutation rescue.';
        }
        runtimeConfig.worldParams = worldParams;
        bus.emit('narrative:system', { text: text || `${type} event.` });
        bus.emit('world:paramApplied', { key: 'SPAWN_RATE', value: worldParams.SPAWN_RATE });
    });

    bus.on('epoch:extinction', () => {
        undoRing.commit(currentWorldState());
        const fs = getFields();
        if (fs) writeField(fs, 'INFO', worldSize * 0.25, worldSize * 0.25, worldSize * 0.5, -8);
        bus.emit('narrative:system', { text: 'An extinction epoch has begun — drought cells written.' });
    });
    bus.on('epoch:recovery', () => {
        const fs = getFields();
        if (fs) writeField(fs, 'INFO', worldSize * 0.75, worldSize * 0.75, worldSize * 0.5, 8);
        bus.emit('narrative:system', { text: 'The world recovers — fertilization written.' });
    });
    bus.on('epoch:boundary', ({ era, name }) => {
        bus.emit('narrative:system', { text: `Epoch ${era} begins: ${name}.` });
    });
    bus.on('epoch:list', () => {
        bus.emit('epoch:listResponse', { eras: epochEngine ? getEpochs(epochEngine) : [] });
    });
    bus.on('epoch:restore', ({ era }) => {
        if (!epochEngine) return;
        const snapshot = getEpochSnapshot(epochEngine, era);
        if (!snapshot) return;
        applyWorldRestore(snapshot);
        bus.emit('narrative:system', { text: `Restored epoch ${era}.` });
    });

    bus.on('agency:action', ({ action }) => {
        undoRing.commit(currentWorldState());
        let text = '';
        if (action.kind === 'param') {
            worldParams = applyWorldParam(worldParams, action.key, action.value);
            runtimeConfig.worldParams = worldParams;
            if (action.key === 'SPAWN_RATE') spawnRate = worldParams.SPAWN_RATE;
            text = `The narrative acts: ${action.key} → ${worldParams[action.key]} (${action.reason}).`;
            bus.emit('world:paramApplied', { key: action.key, value: worldParams[action.key] });
        } else if (action.kind === 'field') {
            const fs = getFields();
            if (fs) writeField(fs, action.name, action.x, action.y, action.z, action.delta);
            text = `The narrative acts: ${action.reason} — ${action.name} field written.`;
        }
        bus.emit('narrative:system', { text: text || 'The narrative acts.' });
    });

    bus.on('world:paramChanged', ({ key, value }) => {
        worldParams = applyWorldParam(worldParams, key, value);
        runtimeConfig.worldParams = worldParams;
        switch (key) {
            case 'WORLD_SIZE':
                worldSize = worldParams.WORLD_SIZE;
                setWorldSize(worldSize);
                logDebug('world size set to ' + worldSize);
                break;
            case 'SPAWN_RATE':
                spawnRate = worldParams.SPAWN_RATE;
                break;
            case 'TIME_SPEED':
                runtimeConfig.simSpeed = worldParams.TIME_SPEED;
                break;
            case 'EPOCH_LENGTH':
                if (epochEngine) epochEngine.cfg.epochLength = worldParams.EPOCH_LENGTH;
                break;
            case 'EXTINCTION_THRESHOLD':
                if (epochEngine) epochEngine.cfg.extinctionThreshold = worldParams.EXTINCTION_THRESHOLD;
                break;
            case 'RECOVERY_THRESHOLD':
                if (epochEngine) epochEngine.cfg.recoveryThreshold = worldParams.RECOVERY_THRESHOLD;
                break;
            case 'PARTICLE_COUNT':
            case 'MAX_POP':
                        break;
        }
        bus.emit('world:paramApplied', { key, value });
    });

}

let lastFrameTime = 0, frameCount = 0, fps = 0;
let perfFrameMs = 0, perfTickMs = 0, perfRenderMs = 0;
const PERF_EMA = 0.15;
function emaPerf(prev, next) { return prev + (next - prev) * PERF_EMA; }


function wireGoalEvents() {
    bus.on('goal:adjusted', (adj) => {
        switch (adj.parameter) {
            case 'scanInterval': if (insightEngine) insightEngine.cfg.scanInterval = adj.newValue; break;
            case 'clusterRadius': if (insightEngine) insightEngine.cfg.clusterRadius = adj.newValue; break;
            case 'maxForce': runtimeConfig.maxForce = adj.newValue; break;
            case 'drag': runtimeConfig.dragMultiplier = adj.newValue; break;
            case 'birthRate': runtimeConfig.birthRate = adj.newValue; break;
            case 'deathRate': runtimeConfig.deathRate = adj.newValue; break;
        }
        bus.emit('goal:applied', adj);
    });
    bus.on('timeline:scrubTo', (tickIndex) => {
        const entry = timelineScrub(timelineEngine, tickIndex);
        if (!entry || !entry.data) return;
        particleView.set(entry.data);
        if (entry.metadata && entry.metadata.particleCount) particleCount = entry.metadata.particleCount;
        prevDead = new Uint8Array(particleCount);
        tick = entry.tick;
        bus.emit('timeline:restored', { index: entry.index, tick: entry.tick });
    });
    bus.on('timeline:record', ({ enabled }) => {
        timelineRecording = !!enabled;
        bus.emit('timeline:recording', { enabled: timelineRecording, count: getTimelineList(timelineEngine).length });
    });
    bus.on('timeline:clear', () => {
        clearTimelineEngine(timelineEngine);
        bus.emit('timeline:cleared');
    });
}

function computeMetrics() {
    let alive = 0, energySum = 0;
    const speciesAlive = new Set();
    const speciesPop = {};
    const speciesEnergy = {};
    const speciesMass = {};
    const speciesPos = {};
    for (let i = 0; i < particleCount; i++) {
        const base = i * PARTICLE_STRIDE;
        if (particleView[base + STRIDE_INDEXES.DEAD] < 0.5 && (particleView[base + STRIDE_INDEXES.MASS] || 0) > 0) {
            alive++;
            const sp = particleView[base + STRIDE_INDEXES.SPECIES_ID] || 0;
            const e = particleView[base + STRIDE_INDEXES.ENERGY] || 0;
            energySum += e;
            speciesAlive.add(sp);
            speciesPop[sp] = (speciesPop[sp] || 0) + 1;
            speciesEnergy[sp] = (speciesEnergy[sp] || 0) + e;
            speciesMass[sp] = (speciesMass[sp] || 0) + (particleView[base + STRIDE_INDEXES.MASS] || 0);
            const pos = speciesPos[sp] || (speciesPos[sp] = [0, 0, 0]);
            pos[0] += particleView[base + STRIDE_INDEXES.POS_X];
            pos[1] += particleView[base + STRIDE_INDEXES.POS_Y];
            pos[2] += particleView[base + STRIDE_INDEXES.POS_Z];
        }
    }
    const clusterCount = insightEngine && insightEngine.lastClusters
        ? insightEngine.lastClusters.clusters.length : 0;
    return {
        populationAlive: alive,
        speciesAlive: speciesAlive.size,
        clusterCount,
        groupCount: groupRegistry ? groupRegistry.groups.size : 0,
        avgEnergy: alive ? energySum / alive : 0,
        frameDelta: fps,
        lawActiveCount: getLawCount(lawState),
        speciesPop,
        speciesEnergy,
        speciesMass,
        speciesPos,
    };
}

function getMetrics() {
    if (!_cachedMetrics || _metricsTick < 0 || tick < _metricsTick || tick - _metricsTick >= METRICS_CADENCE) {
        _cachedMetrics = computeMetrics();
        _metricsTick = tick;
    } else {
        _cachedMetrics.lawActiveCount = getLawCount(lawState);
    }
    return _cachedMetrics;
}

function adaptCultureFromMetrics(buffers, metrics) {
    const rate = (worldParams.CULTURAL_TRANSMISSION || 0.5) * 0.5;
    const threatSignal = epochEngine && epochEngine.extinctionOpen ? 1 : 0;
    for (const key of Object.keys(metrics.speciesPop || {})) {
        const id = Number(key);
        const pop = metrics.speciesPop[key] || 0;
        const energy = metrics.speciesEnergy[key] || 0;
        const avgEnergy = pop ? energy / pop : 0;
        const mem = speciesMemory(buffers, id);
        adaptMemory(mem, [
            Math.max(0, Math.min(1, avgEnergy / 100)),
            Math.max(-1, Math.min(1, (pop / 200) * 2 - 1)),
            pop > 100 ? -0.5 : 0.5,
            threatSignal,
        ], rate);
    }
}

/** Run insight, narrative, lineage, timeline, and goal engines each tick. */
function updateIntelligence() {
    // Worker completion owns intelligence; never scan the live buffer once per
    // paint while the off-thread solver is still running.
    if (_workerTickInFlight) return;
    // Guard: a single failing intelligence pass must never kill the frame
    // loop (which would blank the canvas while the UI stays responsive).
    try {
        updateIntelligenceCore();
    } catch (e) {
        console.error('intelligence pass error:', e);
        logDebug('INTELLIGENCE ERROR: ' + (e && (e.stack || e.message) || e), 'error');
    }
}

function updateIntelligenceCore() {
    if (!particleView || !particleCount) return;

    // Insight — spatio-temporal cluster detection. v8.1.1: gated on active
    // laws + particle motion so a fresh lawless/static world stays silent.
    if (insightEngine) {
        updateInsight(insightEngine, particleView, particleCount, PARTICLE_STRIDE, worldSize, {
            lawActiveCount: getLawCount(lawState),
            motionGate: true,
        });
    }

    // Narrative — paced multi-voice commentary on engine events
    if (narrativeEngine) {
        updateNarrative(narrativeEngine, particleView, particleCount, PARTICLE_STRIDE);
    }

    // Lineage — death transitions (births are tracked in spawnOffspring).
    // Scanned on a cadence: deaths are rare events, and the O(N) pass is
    // pure per-frame overhead otherwise.
    if (lineageEngine && tick % LINEAGE_CADENCE === 0) {
        if (prevDead.length < particleCount) {
            const grown = new Uint8Array(particleCount);
            grown.set(prevDead);
            prevDead = grown;
        }
        for (let i = 0; i < particleCount; i++) {
            const base = i * PARTICLE_STRIDE;
            const dead = particleView[base + STRIDE_INDEXES.DEAD] >= 0.5 ? 1 : 0;
            if (dead && !prevDead[i]) {
                let cause = 'unknown';
                if ((particleView[base + STRIDE_INDEXES.HUNGER] || 0) >= 100) cause = 'starvation';
                else if ((particleView[base + STRIDE_INDEXES.ENERGY] || 0) <= 0) cause = 'energy-depletion';
                trackDeath(lineageEngine, i, cause);
            }
            prevDead[i] = dead;
        }
    }

    // Timeline — recording snapshots on a fixed cadence
    if (timelineEngine && timelineRecording && tick % TIMELINE_SNAPSHOT_INTERVAL === 0) {
        const data = new Float32Array(particleView.buffer.slice(0));
        timelineSnapshot(timelineEngine, data, { tick, particleCount });
        bus.emit('timeline:snapshot', { count: getTimelineList(timelineEngine).length });
    }

    // Goal engine — evaluate and self-tune world constraints. v8.1.1: only
    // autotune while laws are active; on a lawless world the adjustments
    // were pure log noise.
    const metrics = getMetrics();
    if (goalEngine && metrics.lawActiveCount > 0) {
        updateGoal(goalEngine, metrics);
    }

    // Group registry (Set F.1) — declared + detected social groups. Same
    // law/motion gate as insight: a fresh lawless world forms nothing.
    if (groupRegistry && metrics.lawActiveCount > 0) {
        const groupEvents = updateGroups(groupRegistry, particleView, particleCount, PARTICLE_STRIDE, null, {
            lawActiveCount: metrics.lawActiveCount,
        });
        for (const ev of groupEvents) bus.emit(ev.type, ev);
        // Social/economic systems run on a cadence — they don't need 60 Hz and
        // their per-group/member scans are pure overhead on the hot path.
        if (tick % SOCIAL_CADENCE === 0) {
            // Construction (F.2) — nests/hives + roads into the field grid.
            applyConstructions(groupRegistry, getFields(), { tick });
            // Economy (F.3) — treasury, pairwise trade, market prices.
            const eco = runEconomy(groupRegistry, particleView, particleCount, getFields(), { tick });
            if (eco.trades > 0) bus.emit('economy:trade', eco);
            // Artifacts (Set I.1) — treasury-funded TOOL/WEAPON/BARRIER inventory:
            // tools pay an income dividend, weapons damp threat memory (H.2 flee),
            // barriers write impassable wall cells at the territory edge.
            const art = runArtifacts(groupRegistry, getFields(), { tick, worldParams, memoryBuffers });
            if (art.crafted > 0 || art.decayed > 0 || art.walls > 0) bus.emit('artifacts:pass', art);
            // Governance (Set J.1) — per-group policy vector (aggression/openness/
            // migration) from member memory + treasury; alliances pool treasuries,
            // conflicts write tension at the border and raise threat memory; policy
            // drives raids / commerce / dispersal.
            const gov = runGovernance(groupRegistry, particleView, PARTICLE_STRIDE, getFields(), { tick, worldParams, memoryBuffers });
            for (const ev of gov.events) bus.emit(ev.type, ev);
            // Infrastructure (Set K.1) — extract ambient field energy into the
            // treasury (conserved), allied grids feed member ENERGY, and
            // era-progressed mega-structures (WALL/BRIDGE/HUB) execute on target.
            const inf = runInfrastructure(groupRegistry, particleView, PARTICLE_STRIDE, getFields(), {
                tick, worldParams, era: epochEngine ? epochEngine.era : 0,
            });
            for (const ev of inf.events) bus.emit(ev.type, ev);
        }
    }
    // Set L — Exotic Matter (L.1): EXOTIC field zones tag particles with
    // antimatter/dark/strange/negative states — annihilation bursts conserved
    // energy, dark matter dims and self-powers, strange matter converts
    // neighbours, negative mass repels from density. Ambient: runs whenever
    // laws are active, gated on its own cadence.
    if (exoticState && metrics.lawActiveCount > 0) {
        const exo = stepExoticMatter(exoticState, particleView, particleCount, PARTICLE_STRIDE, getFields(), {
            tick, worldParams,
        });
        if (exo.annihilated > 0 || exo.converted > 0) bus.emit('exotic:pass', exo);
    }
    // Set M — Relativity (M.1–M.4): mass-warped CURVATURE field, gravitational
    // lensing of the INFO medium toward curvature peaks, velocity time
    // dilation on AGE/HUNGER, and E=mc² energy↔mass conversion. Ambient:
    // runs whenever laws are active, gated on its own cadence.
    if (metrics.lawActiveCount > 0) {
        const rel = stepRelativity(particleView, particleCount, PARTICLE_STRIDE, getFields(), {
            tick, worldParams,
        });
        if (rel.condensed > 0 || rel.converted > 0) bus.emit('relativity:pass', rel);
    }
    // Set N — Quantum Macroscale (N.1–N.4): deterministic superposition with
    // collapse-on-interaction, macro entanglement (reuses stride 75–76),
    // ENERGY-gated wall tunneling, and DNA-gated observer collapse. Ambient:
    // runs whenever laws are active, gated on its own cadence.
    if (quantumState && metrics.lawActiveCount > 0) {
        const qm = stepQuantumMacro(quantumState, particleView, particleCount, PARTICLE_STRIDE, getFields(), {
            tick, worldParams, dnaBuffer,
        });
        if (qm.collapsed > 0 || qm.tunneled > 0 || qm.observed > 0) bus.emit('quantum:pass', qm);
    }
    // Set O — Stellar Physics (O.1–O.3): dense cells seed stars that fuse
    // accreted mass into radiant output, collapse to black holes past a
    // horizon, and detonate as supernovae past a mass cap. Ambient: runs
    // whenever laws are active, gated on its own cadence.
    if (stellarState && metrics.lawActiveCount > 0) {
        const st = stepStellar(stellarState, particleView, particleCount, PARTICLE_STRIDE, getFields(), {
            tick, worldParams,
        });
        if (st.formed > 0 || st.blackHoles > 0 || st.supernovae > 0) bus.emit('stellar:pass', st);
    }
    // Set P — Synthetic Life (P.1–P.3): synthetic organisms from HUBs, uploaded
    // consciousness at intelligence threshold, machine groups in the F.1 registry.
    if (syntheticState && metrics.lawActiveCount > 0) {
        const syn = stepSynthetic(syntheticState, particleView, particleCount, PARTICLE_STRIDE, getFields(), {
            tick, worldParams, groupRegistry, era: epochEngine ? epochEngine.era : 0,
            maxParticles: MAX_PARTICLES,
        });
        if (syn.spawned > 0 || syn.uploaded > 0 || syn.decayed > 0) bus.emit('synthetic:pass', syn);
    }
    // Speciation (Set A.1) — DNA-slot taxa split when SPECIATION_THRESHOLD ×
    // field isolation is exceeded; children claim extinct-freed slots.
    if (speciationEngine && metrics.lawActiveCount > 0) {
        const specEvents = updateSpeciation(speciationEngine, particleView, particleCount, PARTICLE_STRIDE, dnaBuffer, worldSize, {
            lawActiveCount: metrics.lawActiveCount,
            fieldSystem: getFields(),
        });
        for (const ev of specEvents) bus.emit(ev.type, ev);
    }
    // Epochs (Set D.1) — era boundaries, full-world snapshots, extinction/recovery.
    if (epochEngine) {
        const epochEvents = updateEpoch(epochEngine, particleView, particleCount, PARTICLE_STRIDE, {
            tick,
            captureFn: () => captureWorldState({
                view: particleView,
                count: particleCount,
                speciesCount,
                dna: dnaBuffer,
                laws: lawState,
                worldParams,
                runtime: runtimeConfig,
                worldSize,
                tick,
                name: `Epoch ${epochEngine.era}`,
            }),
        });
        for (const ev of epochEvents) bus.emit(ev.type, ev);
    }
    // Memory & Culture (Set G) — persistent species/group memory: cultural
    // transmission (group ← member species), behavioral adaptation from
    // energy/density/epoch conditions, then decay + group prune.
    if (memoryBuffers) {
        if (groupRegistry) {
            const liveGroups = new Set(groupRegistry.groups.keys());
            for (const g of groupRegistry.groups.values()) {
                const gmem = groupMemory(memoryBuffers, g.id);
                for (const sp of g.species || []) {
                    blendMemory(gmem, speciesMemory(memoryBuffers, sp), (worldParams.CULTURAL_TRANSMISSION || 0.5) * 0.2);
                }
            }
            pruneGroupMemory(memoryBuffers, liveGroups);
        }
        if (tick % 60 === 0) {
            adaptCultureFromMetrics(memoryBuffers, metrics);
            decayMemory(memoryBuffers);
            // Set H.2 — re-derive per-species goals from the updated memory.
            speciesGoals = computeSpeciesGoals(memoryBuffers, Object.keys(metrics.speciesPop || {}).map(Number));
        }
    }
    // Set H.2 — goal-driven velocity nudges (seek / flee from memory goals).
    if (speciesGoals.size > 0) {
        applyGoalNudges(particleView, particleCount, PARTICLE_STRIDE, speciesGoals, worldSize);
    }
    // Set H.1 — the narrative actor may take one bounded, reversible action.
    if (agencyEngine) {
        const agencyEvents = updateAgency(agencyEngine, {
            metrics,
            extinctionOpen: epochEngine ? epochEngine.extinctionOpen : false,
            spawnRate,
            worldSize,
        });
        for (const ev of agencyEvents) bus.emit(ev.type, ev);
    }
    if (tick % 30 === 0) {
        // Set H.3 — world milestones (once-only quests).
        for (const m of detectMilestones(metrics, seenMilestones)) {
            bus.emit('narrative:system', { text: m.text });
        }
        bus.emit('sim:metrics', metrics);
        if (groupRegistry) {
            bus.emit('groups:analytics', { registry: groupRegistry, metrics });
        }
        if (ecoEngine) {
            bus.emit('eco:analytics', { eco: ecoEngine });
        }
    }
}

/** Reset intelligence state on simulation restart. */
function resetIntelligence() {
    prevDead = new Uint8Array(particleCount);
    if (insightEngine) { insightEngine.frame = 0; insightEngine.history = []; insightEngine.lastClusters = null; }
    if (goalEngine) { goalEngine.frame = 0; goalEngine.history = []; }
    if (timelineEngine) clearTimelineEngine(timelineEngine);
    if (groupRegistry) { groupRegistry.groups.clear(); groupRegistry.nextId = 1; groupRegistry.frame = 0; groupRegistry.events.length = 0; groupRegistry.tradeLog.length = 0; groupRegistry.craftLog.length = 0; }
    // Set A — reset speciation state (fresh slot census), eco ring and event
    // baseline on every restart so nothing carries across worlds.
    if (speciationEngine) {
        speciationEngine.pending.length = 0;
        speciationEngine.seenSpecies.clear();
        speciationEngine.splits.length = 0;
        speciationEngine.frame = 0;
    }
    if (ecoEngine) { ecoEngine.ring.length = 0; ecoEngine.foodWeb.clear(); ecoEngine.niches.clear(); ecoEngine.splits.length = 0; ecoEngine.extinct.length = 0; }
    if (worldEventEngine) {
        worldEventEngine.baselineTotal = 0;
        worldEventEngine.baselineEnergy = 0;
        worldEventEngine.samples = 0;
        worldEventEngine.confirm = 0;
        worldEventEngine.cooldownUntil = 0;
        worldEventEngine.events.length = 0;
    }
    if (epochEngine) resetEpoch(epochEngine);
    if (memoryBuffers) resetMemoryBuffers(memoryBuffers);
    exoticState = createExoticState(particleCount);
    quantumState = createQuantumState(particleCount);
    stellarState = createStellarState();
    if (agencyEngine) resetAgency(agencyEngine);
    speciesGoals = new Map();
    seenMilestones.clear();
}

function renderLoop(now) {
    const loopStart = performance.now();
    requestAnimationFrame(renderLoop);
    frameCount++;
    if (now - lastFrameTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFrameTime = now;
    }

    // Chaos Multiplex mode — step + render every shard, shared camera.
    if (multiplexController && multiplexController.isActive()) {
        const stepStart = loopStart;
        multiplexController.step(DT, runtimeConfig.simSpeed, worldSize);
        const stepEnd = performance.now();
        multiplexController.render(worldSize);
        const loopEnd = performance.now();
        perfTickMs = emaPerf(perfTickMs, stepEnd - stepStart);
        perfRenderMs = emaPerf(perfRenderMs, loopEnd - stepEnd);
        perfFrameMs = emaPerf(perfFrameMs, loopEnd - loopStart);
        const mx = multiplexController.mx || {};
        // summarizeMultiplex scans every shard particle — throttle to ~5 Hz.
        if (frameCount % 12 === 0) updateLiveStats({
            fps,
            tick: mx.tick || 0,
            particles: summarizeMultiplex(mx).alive,
            species: 0,
            laws: 0,
            frameMs: perfFrameMs,
            tickMs: perfTickMs,
            renderMs: perfRenderMs,
        });
        return;
    }

    // Always render (so paused state still shows particles)
    // Physics only runs when not paused
    if (!paused) {
    // Main-thread physics
    if (particleView) {
        const tickStart = performance.now();
        solve(particleView, particleCount, PARTICLE_STRIDE, lawState, dnaBuffer, worldSize, DT * runtimeConfig.simSpeed, rng);
        spawnOffspring();
        // Regular population feed — SPAWN_RATE particles per second, placed
        // randomly within the configured initial spawn distribution.
        // Capped by MAX_POP (soft cap) and PARTICLE_COUNT (hard cap).
        const caps = spawnCaps(worldParams);
        if (spawnRate > 0 && particleCount < caps.softCap) {
            spawnAccumulator += spawnRate * (DT * runtimeConfig.simSpeed);
            while (spawnAccumulator >= 1 && particleCount < caps.softCap) {
                spawnAccumulator -= 1;
                spawnSingleParticle(
                    Math.floor(prng.nextFloat(0, speciesCount)),
                    sampleSpawnPosition(worldParams, worldSize, prng),
                );
            }
        }
        tick++;
        updateIntelligence();
        perfTickMs = emaPerf(perfTickMs, performance.now() - tickStart);
        updateLiveStats({ fps, tick, particles: particleCount, species: speciesCount, laws: getLawCount(lawState), frameMs: perfFrameMs, tickMs: perfTickMs, renderMs: perfRenderMs });
        // On-screen canvas debug overlay (first 2 seconds, debug overlay only)
        if (isDebugVisible() && tick <= 130) {
            const dbg = renderer.ctx;
            if (dbg) {
                dbg.save();
                dbg.font = '10px monospace';
                dbg.fillStyle = 'rgba(0,0,0,0.7)';
                dbg.fillRect(4, 38, 320, tick === 1 ? 120 : 70);
                dbg.fillStyle = '#0f0';
                dbg.textAlign = 'left';
                dbg.textBaseline = 'top';
                let ly = 40;
                if (tick === 1) {
                    // Live particle count
                    let aliveCount = 0, deadCount = 0, nanPos = 0;
                    for (let di = 0; di < particleCount; di++) {
                        const dbb = di * PARTICLE_STRIDE;
                        const d = particleView[dbb + STRIDE_INDEXES.DEAD];
                        const px = particleView[dbb], py = particleView[dbb + 1];
                        if (d >= 0.5) deadCount++;
                        else if (px !== px || py !== py) nanPos++;
                        else aliveCount++;
                    }
                    dbg.fillStyle = '#ff0';
                    dbg.fillText('PARTICLES: ' + particleCount + ' | Alive: ' + aliveCount + ' Dead: ' + deadCount + ' NaN: ' + nanPos, 8, ly); ly += 14;
                    dbg.fillText('CANVAS: ' + renderer.width + 'x' + renderer.height + ' | Laws: ' + getLawCount(lawState), 8, ly); ly += 14;
                    const p0 = particleView[0], p1 = particleView[1], p2 = particleView[2];
                    const c0 = particleView[0 + STRIDE_INDEXES.COLOR_R], c1 = particleView[0 + STRIDE_INDEXES.COLOR_G], c2 = particleView[0 + STRIDE_INDEXES.COLOR_B];
                    const a = particleView[0 + STRIDE_INDEXES.ALPHA];
                    const d0 = particleView[0 + STRIDE_INDEXES.DEAD];
                    dbg.fillStyle = '#0ff';
                    dbg.fillText('POS: (' + p0.toFixed(1) + ',' + p1.toFixed(1) + ',' + p2.toFixed(1) + ') DEAD:' + d0.toFixed(2) + ' ALPHA:' + a.toFixed(2), 8, ly); ly += 14;
                    dbg.fillText('COLOR: rgb(' + c0 + ',' + c1 + ',' + c2 + ') | MASS:' + particleView[6].toFixed(2) + ' NRG:' + particleView[50].toFixed(1), 8, ly); ly += 14;
                    dbg.fillText('AGE:' + particleView[51].toFixed(0) + ' HUNGER:' + particleView[62].toFixed(2) + ' TEMP:' + particleView[66].toFixed(2), 8, ly); ly += 14;
                }
                // Always show FPS in debug
                dbg.fillStyle = '#0f0';
                dbg.fillText('FPS: ' + fps + ' TICK: ' + tick, 8, ly);
                dbg.restore();
            }
        }
        bus.emit('physics:tick', { tick, buffer: particleBuffer, particleCount, speciesCount });
    }

    } // end if (!paused)

    // Render (always, even when paused)
    if (renderer && particleBuffer) {
        const renderStart = performance.now();
        renderer.paused = paused;
        syncSprites(renderer, particleView, particleCount, PARTICLE_STRIDE, worldSize, lawState);
        perfRenderMs = emaPerf(perfRenderMs, performance.now() - renderStart);
        perfFrameMs = emaPerf(perfFrameMs, performance.now() - loopStart);
    }
}

// Global errors and unhandled rejections are captured by src/debug.js into
// the debug overlay (single message log for the whole page session).
boot().catch(e => {
    console.error('BOOT ERROR:', e);
    logDebug('BOOT ERROR: ' + (e.stack || e.message || e), 'error');
});
