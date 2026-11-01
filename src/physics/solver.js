// ============================================================================
// VEPA v3 — Physics Solver
// Processes one tick of the simulation: grid → pairwise forces → integration
// → lifecycle. All particle state lives in the Float32Array buffer.
// ============================================================================

import {
  PARTICLE_STRIDE,
  STRIDE_INDEXES,
  DNA_INDEXES,
  LAW_INDEXES,
  LAW_COUNT,
  WORLD_SIZE,
} from '../constants.js';
import { runtimeConfig } from '../state/runtimeConfig.js';
import { isAlive } from '../state/particleBuffer.js';
import { isSet } from '../state/lawState.js';
import { createGrid, clear, insert, getNeighbors } from './spatialGrid.js';
// v8.17 — Barnes–Hut long-range gravity engine (opt-in via runtimeConfig.gravEngine)
import { createOctree, buildOctree, octreeGravity } from './octree.js';
import { fmmGravity } from './fmm.js';
import { gpuComputeForcesSync } from './gpuCompute.js';
import {
  applyGravity,
  applyCollision,
  applyAccretion,
  applyPlanetary,
  applyLifeCycle,
  applySignalDecay,
  applyAffinity,
  applyReproduction,
  applyChemistry,
  applyPolymer,
  applyHeatTransfer,
  applyThermalJitter,
  applyColdDamping,
  applyConvection,
  applyTimeDilation,
  applyDimensionality,
  applyChaos,
  applyOrder,
  applyFate,
  advanceFateClock,
  applyWill,
  applySoul,
  applySoulDecay,
  applyMind,
  applyVoid,
  applyBuoyancy,
  applyBond,
  applyReduction,
  applyTelepathy,
  applyClairvoyance,
  applyPrecognition,
  applyMelt,
  applyBoil,
  applyCondense,
  applyDeposit,
  applyExothermic,
  applyAstral,
  applyAstralInfluence,
  applyGlowEffect,
  applyEnergyTransfer,
  applyRadiationDamage,
  applyTrackingBehavior,
  applyPredation,
  applyGenotypeMutation,
  applyPhenotype,
  applySolvation,
  applySolvationEffect,
  applyAcidityEffect,
  applyOxidationEffect,
  applyIsomerization,
  applyChirality,
  applyCrystallization,
  applyPhaseRadiation,
  applySublimation,
  applySignalExchange,
  applyChargeForce,
  applyFieldDrift,
  applyCurrentTransfer,
  applyResistance,
  applyCapacitanceStore,
  applyStoredChargeForce,
  applyInductance,
  applyMagneticForce,
  applyResonanceForce,
  applyFluxForce,
  applyIonization,
  applyDischarge,
  applyPlasma,
  applySuperconductivity,
  applyMemoryRefresh,
  applyMemoryDecay,
  applyPatternForce,
  applyTrailWrite,
  applyStigmergyForce,
  applySignalBoost,
  applyLearnAlign,
  applySymbolForce,
  applyMetricForce,
  applyPredictForce,
  applyCodeBlend,
  applyProtocolSync,
  applyFeedback,
  applyLanguage,
  applyCulture,
  applySingularityForce,
  applySingularityAbsorb,
  applyEntanglePair,
  applyEntanglement,
  applyHistoryWrite,
  applyHistoryForce,
  applyHistoryCalc,
  setBuffer,
} from './laws.js';
import { createSynergyCache } from './synergy.js';
import { applyAlloy, adjoinParticles, isBondedPair, mergeParticles } from './mergePhysics.js';
import { applyTide, applyFriction, applyHorizon, applyRadiationPressure, applyMassInertia, applyField } from './lawgroups/physicsLaws.js';
import { applyContact, applyMomentum, applyInertia, applyTorque, applyConstraint, applyFragmentation, applyTopology, applyAdhesion } from './lawgroups/mechanicsLaws.js';
import { applyAdiabatic, applyCompression, applyExpansion, applyEquilibrium, applyLatentHeat, applyRunaway } from './lawgroups/thermoLaws.js';
import { applySymbiosis, applyParasite, applyHibernation, applyImmunity } from './lawgroups/biologyLaws.js';
import { applyElectrolysis, applyPhotolysis, applyPrecipitation, applyNeutralization, applyStoichiometry, applyAutocatalysis } from './lawgroups/chemistryLaws.js';
import { applyAntenna, applyShielding, applyPolarization } from './lawgroups/emLaws.js';
import { applyNavigation, applyEncryption } from './lawgroups/infoLaws.js';
import { applyConsciousness, applyPerception, applySynchronicity } from './lawgroups/metaLaws.js';
import { applySuperposition, applyTunneling, applyDecoherence, applyWaveParticle, applyUncertainty, applyTeleport, applyObserver, applyPlanck, applyCoherence, applyBosonic, applyFermionic, applySpin, applySpectral, applyWavefunction, applyHyperplane, applyAntimatter } from './lawgroups/quantumLaws.js';
import { ensureFields, fieldsEnabled, advanceFields, sampleFieldForces, wellForce, resolveWall, portalAt } from './fields.js';

// ── Solver Constants ──

const MAX_FORCE = 50.0;
const DEFAULT_MAX_INTERACTIONS = 500; // live override: WP.MAX_INTERACTIONS
const MAX_VELOCITY = 10.0;
// Gravity scaled with world size so gravitational pull stays effective at the
// larger inter-particle distances of a bigger world (baseline: 240³ world).
const G = 0.2 * (WORLD_SIZE / 240) ** 2;   // lower gravity so particles don't instantly clump
const DEFAULT_DT = 1.0;

// Preallocated neighbor buffer (avoids GC during solve)
const DEFAULT_NEIGHBOR_BUF = 2000;    // live override: WP.NEIGHBOR_BUF
let _neighborBuf = new Array(DEFAULT_NEIGHBOR_BUF);
function ensureNeighborBuf(cap) {
  if (_neighborBuf.length < cap) _neighborBuf = new Array(cap);
  return _neighborBuf;
}

// Per-tick scratch buffers, reused across solves to avoid GC pressure in the
// O(N) / pairwise hot loops (at 100k particles a fresh Float32Array + three
// per-pair force objects every tick adds up to hundreds of MB of churn).
let _localDt = new Float32Array(0);
function ensureLocalDt(n) {
  if (_localDt.length < n) _localDt = new Float32Array(n);
  return _localDt;
}
const _gravOut = { ax: 0, ay: 0, az: 0 };
// v8.17: Barnes–Hut engine state — module-persistent tree, zero allocation per
// tick after warm-up. Only used when runtimeConfig.gravEngine === 'bh'.
let _bhTree = null;
let _bhTheta = 0.5;
let _bhActive = false; // per-tick flag set during engine selection
let _fmmFx = new Float64Array(0);
let _fmmFy = new Float64Array(0);
let _fmmFz = new Float64Array(0);
function ensureFmmOutputs(n) {
  if (_fmmFx.length < n) {
    _fmmFx = new Float64Array(n);
    _fmmFy = new Float64Array(n);
    _fmmFz = new Float64Array(n);
  }
  return [_fmmFx, _fmmFy, _fmmFz];
}
const _affOut = { ax: 0, ay: 0, az: 0 };
const _stigOut = { ax: 0, ay: 0, az: 0 };

// ── Per-law timing instrumentation (bench mode) ──
// When BENCH_LAW_TIMING is enabled, the solver records per-law elapsed time
// in microseconds.  The flag is toggled by the bench runner; production code
// sees a compile-time-false branch that the JIT will eliminate.
let _benchMode = false;
const _lawTimings = new Float64Array(LAW_COUNT); // µs per law, reset each tick
let _tickStart = 0;
let _lastTickUs = 0; // total µs of last completed tick

export function enableBenchMode(on) { _benchMode = !!on; }
export function getLawTimings() { return _lawTimings; }
export function getLastTickUs() { return _lastTickUs; }

// ── Persistent caches (recomputed only when the law flags actually change) ──
let _activeCache = new Uint8Array(0);
let _activeLo = -1, _activeHi = -1, _activeEx = -1, _activeQu = -1, _activePe = -1;
let _synCache = null;

// ── Spatial Grid (module-scoped, reused across ticks) ──

let _grid = null;
let _gridFingerprint = '';

function ensureGrid(dim, cellCap) {
  const fp = dim + '|' + cellCap;
  if (!_grid || _gridFingerprint !== fp) {
    _grid = createGrid(dim, cellCap);
    _gridFingerprint = fp;
  }
  return _grid;
}

// ── Read DNA cache from particle stride ──

function readDNAFromCache(view, base, dnaOut) {
  const start = STRIDE_INDEXES.DNA_CACHE_START;
  for (let d = 0; d < 42; d++) {
    dnaOut[d] = view[base + start + d];
  }
}

// ── Main Solver Entry ──

/**
 * Run one full physics tick.
 *
 * @param {Float32Array} particleBuffer - Particle state buffer (writable directly)
 * @param {number} particleCount - Number of particles in the buffer
 * @param {number} stride - Floats per particle (PARTICLE_STRIDE)
 * @param {{ lowFlags: Uint32Array, highFlags: Uint32Array, extFlags: Uint32Array }} lawState - Active laws
 * @param {Uint16Array} dnaBuffer - Species DNA buffer [64 × 64] (unused — DNA read from stride cache)
 * @param {number} worldSize - World boundary size
 * @param {number} dt - Time step (default 1.0)
 * @param {Function} prng - PRNG function returning [0,1)
 */
export function solve(particleBuffer, particleCount, stride, lawState, dnaBuffer, worldSize, dt, prng) {
  setBuffer(particleBuffer);
  const view = particleBuffer; // Float32Array or SharedArrayBuffer view
  const S = STRIDE_INDEXES;
  const halfWorld = worldSize * 0.5;
  dt = dt || DEFAULT_DT;

  // Zero laws active → hard freeze. Nothing moves, decays, reproduces, or
  // interacts: no integration, no friction, no signal emission/exchange, no
  // lifecycle. Movement and interaction only exist while a law governs them.
  if (
    lawState.lowFlags[0] === 0 &&
    lawState.highFlags[0] === 0 &&
    (lawState.extFlags ? lawState.extFlags[0] === 0 : true) &&
    (lawState.quadFlags ? lawState.quadFlags[0] === 0 : true) &&
    (lawState.pentaFlags ? lawState.pentaFlags[0] === 0 : true)
  ) {
    // Bench mode: the early return skips the tick clock below, so record an
    // explicit zero — otherwise getLastTickUs() would report the previous
    // (stale) tick's duration for the zero-laws freeze row.
    if (_benchMode) _lastTickUs = 0;
    return;
  }

  // Per-tick law cache — the law state is fixed for the whole tick, so the
  // synergy multipliers and on/off flags are pure functions of it. Computing
  // them once (128 entries) instead of per particle/pair removes tens of
  // thousands of branch chains per tick from the hot loops.
  //
  // v8.16: These caches persist across ticks and are only recomputed when
  // the actual law flags change. The key is content-addressed (the flag
  // words themselves), NOT a mutation counter — a counter collides across
  // distinct lawState instances (tests / deserialize) that happen to have
  // performed the same number of set/toggle calls.
  const lo = lawState.lowFlags[0] | 0;
  const hi = lawState.highFlags[0] | 0;
  const ex = lawState.extFlags ? lawState.extFlags[0] | 0 : 0;
  const qu = lawState.quadFlags ? lawState.quadFlags[0] | 0 : 0;
  const pe = lawState.pentaFlags ? lawState.pentaFlags[0] | 0 : 0;
  let syn, active;
  if (_synCache && lo === _activeLo && hi === _activeHi && ex === _activeEx && qu === _activeQu && pe === _activePe) {
    syn = _synCache;
    active = _activeCache;
  } else {
    syn = createSynergyCache(lawState);
    if (_activeCache.length !== LAW_COUNT) _activeCache = new Uint8Array(LAW_COUNT);
    for (let i = 0; i < LAW_COUNT; i++) _activeCache[i] = isSet(lawState, i) ? 1 : 0;
    active = _activeCache;
    _synCache = syn;
    _activeLo = lo; _activeHi = hi; _activeEx = ex; _activeQu = qu; _activePe = pe;
  }

  // World parameters (WORLD panel sliders) — read live from runtimeConfig.
  const WP = runtimeConfig.worldParams || {};
  const effG = G * (Number.isFinite(WP.GLOBAL_G) ? WP.GLOBAL_G : 1);

  // Performance knobs (SETUP > WORLD > PERFORMANCE) — read live; the grid is
  // rebuilt only when its resolution / cell cap changes. AUTO_TUNE (default
  // on) scales the grid resolution with population density so the 27-cell
  // neighbour gather — and therefore total pairwise work — stays ~flat as N
  // grows (dim ≈ ∛(N / 0.5), clamped to the slider range). The density target
  // is ~0.5 particles/cell, which keeps the 27-cell gather sparse at every
  // population: ~17³ at 2.5k, ~27³ at 10k, ~37³ at 25k, ~59³ at 100k. The
  // finer grid reduces pairwise work at larger populations, with diminishing
  // returns once grid rebuild cost dominates. The classic 12³ floor remains
  // the minimum, so tiny populations stay bounded.
  const configuredInteractions = Math.max(8, Math.round(WP.MAX_INTERACTIONS ?? DEFAULT_MAX_INTERACTIONS));
  // Adaptive quality bounds the pairwise work per particle for large worlds.
  // It is deterministic for a given population/config and only reduces the
  // neighbour budget; disabling QUALITY_MODE restores the exact configured cap.
  const qualityMode = (WP.QUALITY_MODE ?? 1) !== 0;
  const targetFps = Math.max(15, Math.min(60, Number(WP.TARGET_FPS ?? 60)));
  const qualityBudget = Math.max(8, Math.round(WP.PAIRWISE_BUDGET ?? 96));
  const populationScale = Math.max(1, Math.sqrt(Math.max(1, particleCount) / 2500));
  const frameScale = 60 / targetFps;
  const adaptiveInteractions = Math.round(qualityBudget * frameScale / populationScale);
  const maxInteractions = qualityMode
    ? Math.max(8, Math.min(configuredInteractions, adaptiveInteractions))
    : configuredInteractions;
  const neighborCap = Math.max(24, Math.round(WP.NEIGHBOR_BUF ?? DEFAULT_NEIGHBOR_BUF));
  const autoTune = (WP.AUTO_TUNE ?? 1) !== 0;
  const gridDim = autoTune
    ? Math.max(12, Math.min(64, Math.round(Math.cbrt(Math.max(1, particleCount) / 1.4))))
    : Math.max(6, Math.min(64, Math.round(WP.GRID_DIM ?? 12)));
  const cellCap = Math.max(1, Math.min(500, Math.round(WP.CELL_CAP ?? 100)));
  const grid = ensureGrid(gridDim, cellCap);
  const nb = ensureNeighborBuf(neighborCap);

  // Field system (v8.2 E.1 — Matter & Medium): the dish itself. Rebuilt only
  // when its structural config (world size, dim, wall/well/portal layout)
  // changes; field strengths are read live. Ambient medium features (wind /
  // thermal / EM / info fields, gravity wells, portals) are active whenever
  // the sim runs (any law on — the zero-laws freeze above still applies);
  // walls are additionally gated by the COLL hard-matter toggle.
  const fieldsOn = fieldsEnabled(WP);
  let fieldSystem = null;
  if (fieldsOn) fieldSystem = ensureFields(worldSize, WP);

  // Fate clock — advances once per tick so species destiny points wander.
  advanceFateClock(dt);

  // Reusable DNA cache array (avoids allocation per particle)
  const dnaI = new Array(42);
  const _dnaJ = new Array(42);

  // Per-law timing: start the tick clock if bench mode is active.
  if (_benchMode) {
    _lawTimings.fill(0);
    _tickStart = performance.now();
  }
  const _lt = _benchMode ? performance.now.bind(performance) : null;
  function _lawStart() { return _lt ? _lt() : 0; }
  function _lawEnd(idx, t0) { if (t0) _lawTimings[idx] += (performance.now() - t0) * 1000; }

  // ── Phase 1: Build spatial grid from alive particles ──

  clear(grid);

  for (let i = 0; i < particleCount; i++) {
    const base = i * stride;
    if (view[base + S.DEAD] >= 0.5) continue; // skip dead/soul
    if (view[base + S.MASS] <= 0) continue;

    const px = view[base + S.POS_X];
    const py = view[base + S.POS_Y];
    const pz = view[base + S.POS_Z];

    if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz)) {
      insert(grid, i, px, py, pz, worldSize);
    }
  }

  // ── Phase 2: Compute time dilation per particle ──
  // v4.6.29: gravitational time dilation — the grid snapshot from Phase 1
  // feeds a softened potential (capped neighbourhood) so local time slows
  // beside massive bodies. Empty space runs at full speed.

  const localDt = ensureLocalDt(particleCount);
  const timeDilActive = active[LAW_INDEXES.TIME_DILATION];
  if (!timeDilActive) {
    // TIME_DILATION is normally off. A bulk fill is materially cheaper than
    // calling the law helper and probing the grid once per particle.
    localDt.fill(1, 0, particleCount);
  } else {
    for (let i = 0; i < particleCount; i++) {
      const base = i * stride;
      let nBuf = null, nCount = 0;
      const px = view[base + S.POS_X];
      const py = view[base + S.POS_Y];
      const pz = view[base + S.POS_Z];
      if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz)) {
        nCount = Math.min(getNeighbors(grid, px, py, pz, worldSize, nb, neighborCap), 24);
        nBuf = nb;
      }
      localDt[i] = applyTimeDilation(
        lawState, view, base,
        syn[LAW_INDEXES.TIME_DILATION], nBuf, nCount, worldSize
      );
    }
  }

  // ── Phase 2b: Astral souls — ghosts persist and fade. Soul particles
  //    (DEAD=0.5) are excluded from the pairwise/integration loop, so they
  //    are processed here when the ASTRAL law governs them. ──
  if (active[LAW_INDEXES.ASTRAL]) {
    const astralSynergy = syn[LAW_INDEXES.ASTRAL];
    for (let i = 0; i < particleCount; i++) {
      const base = i * stride;
      if (view[base + S.DEAD] >= 0.5) {
        applyAstral(lawState, view, base, dt, astralSynergy);
        // Ghost influence on living neighbours (bounded by the spatial grid,
        // which only contains alive particles).
        const gx = view[base + S.POS_X];
        const gy = view[base + S.POS_Y];
        const gz = view[base + S.POS_Z];
        if (!Number.isFinite(gx) || !Number.isFinite(gy) || !Number.isFinite(gz)) continue;
        const soul = view[base + S.SOUL];
        if (!Number.isFinite(soul) || soul < 0.01) continue;
        const gCount = getNeighbors(grid, gx, gy, gz, worldSize, nb, neighborCap);
        const gLimit = Math.min(gCount, maxInteractions);
        for (let n = 0; n < gLimit; n++) {
          const l = nb[n];
          const lBase = l * stride;
          if (view[lBase + S.DEAD] >= 0.5) continue;
          let gdx = view[lBase + S.POS_X] - gx;
          let gdy = view[lBase + S.POS_Y] - gy;
          let gdz = view[lBase + S.POS_Z] - gz;
          if (gdx > halfWorld) gdx -= worldSize;
          else if (gdx < -halfWorld) gdx += worldSize;
          if (gdy > halfWorld) gdy -= worldSize;
          else if (gdy < -halfWorld) gdy += worldSize;
          if (gdz > halfWorld) gdz -= worldSize;
          else if (gdz < -halfWorld) gdz += worldSize;
          const gDist = Math.sqrt(gdx * gdx + gdy * gdy + gdz * gdz);
          if (gDist < 1 || gDist > 80) continue;
          applyAstralInfluence(lawState, view, base, lBase, gdx, gdy, gdz, gDist, astralSynergy, dt);
        }
      }
    }
  }

  // ── Phase 3: Pairwise interactions + integration ──

  // v8.17 — gravity engine selection. 'bh' swaps the pairwise GRAV term for
  // one Barnes–Hut octree query per particle (O(N log N)); the tree is built
  // once per tick over all alive, positive-mass particles. Far-field
  // aggregates drop per-pair DNA modifiers (FORCE/TIDAL/HIDDEN_MASS) and the
  // star-collapse boost — documented approximation; 'exact' stays the default.
  _bhActive = false;
  let _fmmActive = false;
  if (active[LAW_INDEXES.GRAV] && runtimeConfig.gravEngine === 'fmm' && particleCount > 0) {
    const [fx, fy, fz] = ensureFmmOutputs(particleCount);
    fx.fill(0, 0, particleCount);
    fy.fill(0, 0, particleCount);
    fz.fill(0, 0, particleCount);
    fmmGravity(view, stride, particleCount, worldSize, effG * syn[LAW_INDEXES.GRAV], fx, fy, fz);
    _fmmActive = true;
  }
  if (
    active[LAW_INDEXES.GRAV] &&
    runtimeConfig.gravEngine === 'bh' &&
    particleCount > 0
  ) {
    const theta = Number(runtimeConfig.gravTheta);
    _bhTheta = Number.isFinite(theta) ? Math.max(0, theta) : 0.5;
    if (!_bhTree) _bhTree = createOctree(Math.max(1024, particleCount));
    buildOctree(_bhTree, view, stride, particleCount, worldSize);
    _bhTree.useQuadrupole = runtimeConfig.gravEngine === 'fmm';
    _bhActive = true;
  }

  // v8.17 — solo-gravity fast path: when the BH engine is running and GRAV is
  // the ONLY active law, every force comes from the octree query below, so the
  // 27-cell neighbour gather and the whole pairwise loop are dead weight.
  // Popcount over the four flag words detects the single-law case in O(1).
  let bhSoloGravity = false;
  if (_bhActive) {
    let pc = lo - ((lo >> 1) & 0x55555555);
    pc = (pc & 0x33333333) + ((pc >> 2) & 0x33333333);
    let bits = (pc + (pc >> 4)) & 0x0f0f0f0f;
    pc = hi - ((hi >> 1) & 0x55555555);
    pc = (pc & 0x33333333) + ((pc >> 2) & 0x33333333);
    bits += (pc + (pc >> 4)) & 0x0f0f0f0f;
    pc = ex - ((ex >> 1) & 0x55555555);
    pc = (pc & 0x33333333) + ((pc >> 2) & 0x33333333);
    bits += (pc + (pc >> 4)) & 0x0f0f0f0f;
    pc = qu - ((qu >> 1) & 0x55555555);
    pc = (pc & 0x33333333) + ((pc >> 2) & 0x33333333);
    bits += (pc + (pc >> 4)) & 0x0f0f0f0f;
    bhSoloGravity = (((bits * 0x01010101) >> 24) & 0xff) === 1;
  }

  // ── v9.0 GPU compute pre-pass ──
  // When computeEngine='gpu', build all neighbour pairs from the grid and
  // offload gravity + collision to the GPU (or CPU fallback in Node.js).
  // The per-particle loop below adds these precomputed forces and skips the
  // GRAV/COLL blocks in the pairwise loop.
  let _gpuFx = null, _gpuFy = null, _gpuFz = null;
  // The GPU force kernel is a separate opt-in backend. The synchronous solver
  // must retain the complete law semantics (DNA modifiers and non-GRAV laws),
  // so do not silently replace its exact pairwise dispatch based on the UI
  // compute preference.
  const _useGPU = false;
  if (_useGPU && !bhSoloGravity) {
    // Build all neighbour pairs
    const _gpuPairs = [];
    for (let i = 0; i < particleCount; i++) {
      const ib = i * stride;
      if (view[ib + S.DEAD] >= 0.5 || view[ib + S.MASS] <= 0) continue;
      const nCount = getNeighbors(grid, view[ib + S.POS_X], view[ib + S.POS_Y], view[ib + S.POS_Z], worldSize, nb, neighborCap);
      const lim = Math.min(nCount, maxInteractions);
      for (let n = 0; n < lim; n++) {
        const j = nb[n];
        if (j === i) continue;
        const jb = j * stride;
        if (view[jb + S.DEAD] >= 0.5 || view[jb + S.MASS] <= 0) continue;
        _gpuPairs.push({ i, j });
      }
    }
    const _gpuRes = gpuComputeForcesSync(view, particleCount, _gpuPairs, {
      worldSize, G: effG, softening: 0.5, maxForce: MAX_FORCE,
    });
    _gpuFx = _gpuRes.fx; _gpuFy = _gpuRes.fy; _gpuFz = _gpuRes.fz;
  }

  for (let i = 0; i < particleCount; i++) {
    const iBase = i * stride;

    // Skip dead particles
    if (view[iBase + S.DEAD] >= 0.5) continue;
    if (view[iBase + S.MASS] <= 0) continue;

    const localTimeStep = dt * localDt[i];
    if (localTimeStep <= 0) continue;

    // Read particle i DNA from stride cache (already decoded floats)
    readDNAFromCache(view, iBase, dnaI);

    // Current position and velocity
    let px = view[iBase + S.POS_X];
    let py = view[iBase + S.POS_Y];
    let pz = view[iBase + S.POS_Z];
    let vx = view[iBase + S.VEL_X];
    let vy = view[iBase + S.VEL_Y];
    let vz = view[iBase + S.VEL_Z];
    let mass = view[iBase + S.MASS];
    if (mass <= 0) mass = 0.001;
    // Defensive: reset any corrupted position before grid lookups
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
      px = worldSize * 0.5 + (prng() - 0.5) * 10;
      py = worldSize * 0.5 + (prng() - 0.5) * 10;
      pz = worldSize * 0.5 + (prng() - 0.5) * 10;
      vx = 0; vy = 0; vz = 0;
    }

    // Accumulated force
    let ax = 0;
    let ay = 0;
    let az = 0;
    // DISCHARGE aim: net direction toward the most opposite stored charge.
    let ddx = 0;
    let ddy = 0;
    let ddz = 0;
    let iAbsorbed = false; // consumed by a singularity's event horizon

    // v8.17 — Barnes–Hut gravity ('bh' engine): one O(log N) tree query per
    // particle replaces the pairwise GRAV term in the loop below.
    if (_bhActive) {
      octreeGravity(_bhTree, px, py, pz, effG * syn[LAW_INDEXES.GRAV], _bhTheta, _gravOut, i);
      ax += _gravOut.ax;
      ay += _gravOut.ay;
      az += _gravOut.az;
    } else if (_fmmActive) {
      ax += _fmmFx[i];
      ay += _fmmFy[i];
      az += _fmmFz[i];
    }

    // v9.0 — GPU-computed gravity + collision forces
    if (_useGPU && _gpuFx) {
      ax += _gpuFx[i];
      ay += _gpuFy[i];
      az += _gpuFz[i];
    }

    // ── Pairwise neighbor loop ──

    // v8.17: solo-gravity BH skips the neighbour gather entirely — the octree
    // query above already produced the full gravitational acceleration.
    const nCount = bhSoloGravity ? 0 : getNeighbors(grid, px, py, pz, worldSize, nb, neighborCap);
    const limit = Math.min(nCount, maxInteractions);

    // v8.16: save neighbor list + count so the bond/polymer writeback block
    // can skip the redundant second getNeighbors call.
    const savedNCount = nCount;
    const savedLimit = limit;
    const hasBondOrPolymer = active[LAW_INDEXES.BOND] || active[LAW_INDEXES.POLYMER];

    for (let n = 0; n < limit; n++) {
      const j = nb[n];
      if (j === i) continue;

      const jBase = j * stride;

      // Skip dead neighbors
      if (view[jBase + S.DEAD] >= 0.5) continue;
      if (view[jBase + S.MASS] <= 0) continue;

      // Toroidal distance
      let dx = view[jBase + S.POS_X] - px;
      let dy = view[jBase + S.POS_Y] - py;
      let dz = view[jBase + S.POS_Z] - pz;

      // Wrap distance to [-halfWorld, halfWorld]
      if (dx > halfWorld) dx -= worldSize;
      else if (dx < -halfWorld) dx += worldSize;
      if (dy > halfWorld) dy -= worldSize;
      else if (dy < -halfWorld) dy += worldSize;
      if (dz > halfWorld) dz -= worldSize;
      else if (dz < -halfWorld) dz += worldSize;

      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq);

      // ── Distance-tier fidelity (v8.17) ──
      const near = dist < 30;
      const mid = dist < 200;

      // ── Gravity ──
      // 'bh' engine: gravity was already applied above from the octree
      // far-field query; skip the per-pair exact term to avoid double counting.
      if (active[LAW_INDEXES.GRAV] && !_bhActive && !_fmmActive && !_useGPU) {
        const gravSynergy = syn[LAW_INDEXES.GRAV];
        const gravForce = applyGravity(iBase, jBase, dx, dy, dz, dist, effG * gravSynergy, _gravOut);
        if (gravForce) {
          // Gravitational collapse: stars pull nearby matter much harder
          const mI = view[iBase + S.MASS];
          const mJ = view[jBase + S.MASS];
          const bigM = Math.max(mI, mJ);
          if (bigM > runtimeConfig.starMass) {
            const collapseMult = 1.0 + (bigM - runtimeConfig.starMass) * 0.08;
            ax += gravForce.ax * collapseMult;
            ay += gravForce.ay * collapseMult;
            az += gravForce.az * collapseMult;
          } else {
            ax += gravForce.ax;
            ay += gravForce.ay;
            az += gravForce.az;
          }
        }
      }

      // ── Collision + Accretion (contact laws) ──
      if (near && (active[LAW_INDEXES.COLL] || active[LAW_INDEXES.ACCR]) && !_useGPU) {
        const m1 = view[iBase + S.MASS];
        const m2 = view[jBase + S.MASS];
        if (m1 <= 0 || m2 <= 0) continue;
        const r1 = view[iBase + S.RADIUS];
        const r2 = view[jBase + S.RADIUS];
        const overlap = (r1 + r2) - dist;
        const collOn = active[LAW_INDEXES.COLL];
        const accrOn = active[LAW_INDEXES.ACCR];

        // ACCR proximity-dwell bookkeeping: reset the timer whenever the
        // tracked partner leaves overlap range so "very close proximity"
        // means continuous contact, not a sum of separate grazes.
        if (accrOn) {
          const dwellPartner = view[iBase + S.PARTNER_ID] || -1;
          if (dwellPartner === j && !(overlap > 0 && dist > 0.01)) {
            view[iBase + S.MITOSIS_TIMER] = 0;
            view[iBase + S.PARTNER_ID] = -1;
          }
        }

        if (overlap > 0 && dist > 0.01) {
          // Collision normal (i → j)
          const invDist = 1.0 / dist;
          const nx = dx * invDist;
          const ny = dy * invDist;
          const nz = dz * invDist;

          // Relative velocity along normal
          const dvx = view[iBase + S.VEL_X] - view[jBase + S.VEL_X];
          const dvy = view[iBase + S.VEL_Y] - view[jBase + S.VEL_Y];
          const dvz = view[iBase + S.VEL_Z] - view[jBase + S.VEL_Z];
          const relVelN = dvx * nx + dvy * ny + dvz * nz;
          const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);

          // ── ACCR fusion gating (confirmed batch-02 semantics) ──
          // FUSION_MOMENTUM (DNA 16): minimum relative momentum to fuse on
          // impact; below it the pair bounces. FUSION_TIME (DNA 17): seconds
          // of continuous close proximity required for sub-threshold pairs
          // to fuse anyway.
          let fusing = false;
          let adjoined = false;
          if (accrOn) {
            const fusionMom = dnaI[DNA_INDEXES.FUSION_MOMENTUM] ?? 1.0;
            const fusionTime = dnaI[DNA_INDEXES.FUSION_TIME] ?? 2;
            const relMomentum = relSpeed * Math.min(m1, m2);
            fusing = relMomentum >= fusionMom;
            let dwell = view[iBase + S.MITOSIS_TIMER] || 0;
            if (!fusing) {
              if ((view[iBase + S.PARTNER_ID] || -1) === j) {
                dwell += localTimeStep;
              } else {
                dwell = localTimeStep;
                view[iBase + S.PARTNER_ID] = j;
              }
              if (dwell >= fusionTime) fusing = true;
            } else {
              dwell = 0;
              view[iBase + S.PARTNER_ID] = -1;
            }
            view[iBase + S.MITOSIS_TIMER] = dwell;

            // ── ACCR composite adjoining (v9.1.0) ──
            // Half the fusion dwell CEMENTS the pair into an adjoined
            // structure: both grains keep their identity and are linked via
            // the shared bond slots, so rubble piles / dust aggregates grow
            // alongside fully merged bodies. High-momentum impacts still
            // merge; low-energy dwellers build structures instead.
            if (!fusing && dwell >= fusionTime * 0.5) {
              adjoinParticles(view, iBase, jBase, stride);
            }
            adjoined = isBondedPair(view, iBase, jBase, stride);
          }

          // ── COLL: softbody push + elastic bounce ──
          // Massive bodies squish instead of rigidly bouncing; fusing pairs
          // coalesce instead of bouncing apart.
          if (collOn && !fusing && !adjoined) {
            const isStarI = m1 > runtimeConfig.starMass;
            const isStarJ = m2 > runtimeConfig.starMass;
            const push = overlap * (isStarI || isStarJ ? 0.2 : 0.5);
            px -= nx * push;
            py -= ny * push;
            pz -= nz * push;

            // Bounce if approaching (relVelN > 0 along the i→j normal means
            // the pair is closing; a negative impulse along n separates them)
            if (relVelN > 0) {
              const elasticity = dnaI[DNA_INDEXES.ELASTICITY] || 0.5;
              const impulse = -(1 + elasticity) * relVelN / (m1 + m2);
              const bounceForce = impulse * m2;
              ax += bounceForce * nx;
              ay += bounceForce * ny;
              az += bounceForce * nz;
              // A collision is a measurement — collapse the wave (v4.6.29).
              if (active[LAW_INDEXES.WAVE_PARTICLE]) {
                view[iBase + S.WAVE_MEASURED] = 1;
                view[jBase + S.WAVE_MEASURED] = 1;
              }
            }
          } else if (accrOn && !collOn && relVelN > 0 && !adjoined) {
            // Sub-threshold ACCR-only contact: the pair "bounces" — a gentle
            // elastic separation so matter does not silently pass through
            // while the dwell timer decides whether they fuse or adjoin.
            const elasticity = dnaI[DNA_INDEXES.ELASTICITY] || 0.5;
            const impulse = -(1 + elasticity) * relVelN / (m1 + m2);
            const bounceForce = impulse * m2;
            ax += bounceForce * nx;
            ay += bounceForce * ny;
            az += bounceForce * nz;
          }

          // ── Adjoined composite response (v9.1.0) ──
          // No restitution: a perfectly inelastic normal impulse plus a
          // cohesion spring toward touching rest length settle the seam, so
          // structures hold together without jitter.
          if (adjoined) {
            const dampImpulse = -relVelN / (m1 + m2);
            ax += dampImpulse * m2 * nx;
            ay += dampImpulse * m2 * ny;
            az += dampImpulse * m2 * nz;
            const spring = (dist - (r1 + r2)) * 0.05;
            ax += nx * spring;
            ay += ny * spring;
            az += nz * spring;
          }

          // ── ACCR: true accretion — the pair becomes ONE body (v8.0.0) ──
          // When the fusion gate passes (momentum or dwell), the two particles
          // collapse into a single body: combined mass (× FUSION efficiency),
          // centre-of-mass position, momentum-conserving velocity, and
          // mass-weighted colour. Bonded pairs (BOND / POLYMER molecules) are
          // excluded — a bond is not accretion; the orbs stay separate and
          // attached. STOICHIOMETRY makes the merger exact (efficiency 1.0).
          if (accrOn && fusing) {
            // FUSION DNA (9): mass-merging efficiency multiplier (0..1 → 0.5..1.5).
            const fusionMult = 0.5 + (dnaI[DNA_INDEXES.FUSION] || 0.5);
            const eff = active[LAW_INDEXES.STOICHIOMETRY] ? 1.0 : fusionMult;
            if (!isBondedPair(view, iBase, jBase, stride)) {
              mergeParticles(view, iBase, jBase, stride, { fusionMult: eff, worldSize });
              // Fold the merged body back into the integration locals so the
              // writeback and radius update reflect the new single particle.
              px = view[iBase + S.POS_X];
              py = view[iBase + S.POS_Y];
              pz = view[iBase + S.POS_Z];
              vx = view[iBase + S.VEL_X];
              vy = view[iBase + S.VEL_Y];
              vz = view[iBase + S.VEL_Z];
              mass = view[iBase + S.MASS];
            }
          }
        }
      }      // ── Affinity (mid-range, falls off with distance) ──
      if (mid && active[LAW_INDEXES.AFFINITY]) {
        const affinityForce = applyAffinity(lawState, view, iBase, jBase, dx, dy, dz, distSq, syn[LAW_INDEXES.AFFINITY], _affOut);
        if (affinityForce) {
          ax += affinityForce.ax;
          ay += affinityForce.ay;
          az += affinityForce.az;
        }
      }

      // ── Chemistry modifier (near) ──

      if (near && (
        active[LAW_INDEXES.CATALYSIS_LAW] ||
        active[LAW_INDEXES.SOLVATION] ||
        active[LAW_INDEXES.ACIDITY] ||
        active[LAW_INDEXES.CRYSTALLIZATION]
      )) {
        const chemMult = applyChemistry(lawState, view, iBase, jBase, distSq, syn[LAW_INDEXES.CATALYSIS_LAW]);
        if (chemMult !== 1.0) {
          ax *= chemMult;
          ay *= chemMult;
          az *= chemMult;
        }
      }

      // ── Polymer (contact) ──

      if (near && active[LAW_INDEXES.POLYMER]) {
        const polySynergy = syn[LAW_INDEXES.POLYMER];
        applyPolymer(lawState, view, iBase, jBase, dx, dy, dz, dist, polySynergy, stride);
      }



      // ── Bond (contact) ──

      if (near && active[LAW_INDEXES.BOND]) {
        const bondSynergy = syn[LAW_INDEXES.BOND];
        const bondForce = applyBond(lawState, view, iBase, jBase, stride, dx, dy, dz, dist, bondSynergy, nCount);
        if (bondForce) {
          ax += bondForce.ax;
          ay += bondForce.ay;
          az += bondForce.az;
        }
      }      // ── Reduction (mid-range charge neutralisation) ──
      if (mid && active[LAW_INDEXES.REDUCTION]) {
        const redSynergy = syn[LAW_INDEXES.REDUCTION];
        applyReduction(iBase, jBase, stride, redSynergy);
      }

      // ── Alloy (contact) ──

      if (near && active[LAW_INDEXES.ALLOY]) {
        const alloySynergy = syn[LAW_INDEXES.ALLOY];
        applyAlloy(lawState, view, iBase, jBase, stride, dist, alloySynergy);
      }

      // ── Heat Transfer (near) ──

      if (near && (active[LAW_INDEXES.HEAT] || active[LAW_INDEXES.COLD])) {
        const heatSynergy = syn[LAW_INDEXES.HEAT];
        applyHeatTransfer(lawState, view, iBase, jBase, dist, localTimeStep, heatSynergy);
      }

      // ── Order (mid) ──

      if (mid && active[LAW_INDEXES.ORDER]) {
        const orderForce = applyOrder(lawState, view, iBase, jBase, distSq, syn[LAW_INDEXES.ORDER]);
        if (orderForce) {
          ax += orderForce.ax;
          ay += orderForce.ay;
          az += orderForce.az;
        }
      }

      // ── Soul (mid) ──

      if (mid && active[LAW_INDEXES.SOUL_LAW]) {
        const soulSynergy = syn[LAW_INDEXES.SOUL_LAW];
        applySoul(lawState, view, iBase, jBase, distSq, soulSynergy);
      }

      // ── Mind (mid) ──

      if (mid && active[LAW_INDEXES.MIND]) {
        const mindSynergy = syn[LAW_INDEXES.MIND];
        const mindEffect = applyMind(lawState, view, iBase, jBase, distSq, mindSynergy);
        if (mindEffect && mindEffect.signalBoost) {
          view[iBase + S.SIGNAL] += mindEffect.signalBoost;
        }
      }

      // ── Energy Transfer (mid) ──
      if (mid && active[LAW_INDEXES.ENERGY]) {
        const energySynergy = syn[LAW_INDEXES.ENERGY];
        applyEnergyTransfer(lawState, view, iBase, jBase, distSq, energySynergy);
      }

      // ── Solvation (near) ──
      if (near && active[LAW_INDEXES.SOLVATION]) {
        const solvSynergy = syn[LAW_INDEXES.SOLVATION];
        const solvMult = applySolvationEffect(lawState, view, iBase, jBase, distSq, solvSynergy);
        if (solvMult !== 1.0) {
          ax *= solvMult;
          ay *= solvMult;
          az *= solvMult;
        }
        // Real-world solvation: solvent charge forces — opposite charges
        // attract, like charges repel (ions disperse through the medium).
        const solvForce = applySolvation(iBase, jBase, stride, dx, dy, dz, dist, solvSynergy);
        if (solvForce) {
          ax += solvForce.ax;
          ay += solvForce.ay;
          az += solvForce.az;
        }
      }

      // ── Acidity (near) ──
      if (near && active[LAW_INDEXES.ACIDITY]) {
        const acidSynergy = syn[LAW_INDEXES.ACIDITY];
        applyAcidityEffect(lawState, view, iBase, jBase, localTimeStep, acidSynergy);
      }

      // ── Chirality (near) ──
      if (near && active[LAW_INDEXES.CHIRALITY]) {
        const chirSynergy = syn[LAW_INDEXES.CHIRALITY];
        const chirForce = applyChirality(lawState, view, iBase, jBase, dx, dy, dz, dist, chirSynergy);
        if (chirForce) {
          ax += chirForce.ax;
          ay += chirForce.ay;
          az += chirForce.az;
        }
      }

      // ── Crystallization (near) ──
      if (near && active[LAW_INDEXES.CRYSTALLIZATION]) {
        const crysSynergy = syn[LAW_INDEXES.CRYSTALLIZATION];
        const crysForce = applyCrystallization(lawState, view, iBase, jBase, dx, dy, dz, dist, crysSynergy);
        if (crysForce) {
          ax += crysForce.ax;
          ay += crysForce.ay;
          az += crysForce.az;
        }
      }

      // ── Signal exchange (mid) ──
      if (mid && active[LAW_INDEXES.COMMS] && ((view[iBase + S.SIGNAL] || 0) > 0.01 || (view[jBase + S.SIGNAL] || 0) > 0.01)) {
        readDNAFromCache(view, jBase, _dnaJ);
        const sigForce = applySignalExchange(lawState, view, iBase, jBase, dx, dy, dz, dist, dnaI, _dnaJ, localTimeStep);
        if (sigForce) {
          ax += sigForce.ax;
          ay += sigForce.ay;
          az += sigForce.az;
        }
      }

      // ── Track (mid) ──
      if (mid && active[LAW_INDEXES.TRACK]) {
        const trackSynergy = syn[LAW_INDEXES.TRACK];
        const trackForce = applyTrackingBehavior(lawState, view, iBase, jBase, dx, dy, dz, dist, trackSynergy);
        if (trackForce) {
          ax += trackForce.ax;
          ay += trackForce.ay;
          az += trackForce.az;
        }
      }

      // ── Predation (mid-range pursuit) ──
      if (mid && active[LAW_INDEXES.PREDATION]) {
        const predForce = applyPredation(iBase, jBase, stride, dx, dy, dz, dist, prng);
        if (predForce) {
          ax += predForce.ax;
          ay += predForce.ay;
          az += predForce.az;
        }
      }

      // Telepathy (mid)
      if (mid && active[LAW_INDEXES.TELEPATHY]) {
        const telepathySynergy = syn[LAW_INDEXES.TELEPATHY];
        applyTelepathy(lawState, view, iBase, jBase, distSq, telepathySynergy, localTimeStep);
      }

      // Clairvoyance (near)
      if (near && active[LAW_INDEXES.CLAIRVOYANCE]) {
        const clairvoyanceSynergy = syn[LAW_INDEXES.CLAIRVOYANCE];
        const clairForce = applyClairvoyance(lawState, view, iBase, jBase, dx, dy, dz, dist, clairvoyanceSynergy, localTimeStep);
        if (clairForce) {
          ax += clairForce.ax;
          ay += clairForce.ay;
          az += clairForce.az;
        }
      }

      // Precognition (mid)
      if (mid && active[LAW_INDEXES.PRECOGNITION]) {
        const precogSynergy = syn[LAW_INDEXES.PRECOGNITION];
        const precogForce = applyPrecognition(lawState, view, iBase, jBase, dx, dy, dz, dist, precogSynergy, localTimeStep);
        if (precogForce) {
          ax += precogForce.ax;
          ay += precogForce.ay;
          az += precogForce.az;
        }
      }

      // ── Electromagnetism (pairwise) ──
      if (active[LAW_INDEXES.CHARGE_LAW]) {
        const chargeForce = applyChargeForce(iBase, jBase, dx, dy, dz, dist, 0.8 * syn[LAW_INDEXES.CHARGE_LAW]);
        if (chargeForce) {
          ax += chargeForce.ax;
          ay += chargeForce.ay;
          az += chargeForce.az;
        }
      }
      if (active[LAW_INDEXES.CAPACITANCE]) {
        const capForce = applyStoredChargeForce(iBase, jBase, dx, dy, dz, dist, 0.4);
        if (capForce) {
          ax += capForce.ax;
          ay += capForce.ay;
          az += capForce.az;
        }
      }
      if (active[LAW_INDEXES.MAGNETISM]) {
        const magForce = applyMagneticForce(iBase, jBase, dx, dy, dz, dist, 0.4 * syn[LAW_INDEXES.MAGNETISM]);
        if (magForce) {
          ax += magForce.ax;
          ay += magForce.ay;
          az += magForce.az;
        }
      }
      if (active[LAW_INDEXES.RESONANCE]) {
        const resForce = applyResonanceForce(iBase, jBase, dx, dy, dz, dist, 0.2);
        if (resForce) {
          ax += resForce.ax;
          ay += resForce.ay;
          az += resForce.az;
        }
      }
      if (active[LAW_INDEXES.FLUX]) {
        const fluxForce = applyFluxForce(iBase, jBase, dx, dy, dz, dist, 0.4);
        if (fluxForce) {
          ax += fluxForce.ax;
          ay += fluxForce.ay;
          az += fluxForce.az;
        }
      }
      if (active[LAW_INDEXES.INDUCTANCE]) applyInductance(iBase, jBase, dist, 0.05 * syn[LAW_INDEXES.INDUCTANCE]);
      if (active[LAW_INDEXES.CURRENT]) applyCurrentTransfer(iBase, jBase, distSq, 0.05 * syn[LAW_INDEXES.CURRENT]);
      if (active[LAW_INDEXES.IONIZATION]) {
        const relSpeed = Math.sqrt(
          (view[iBase + S.VEL_X] - view[jBase + S.VEL_X]) ** 2 +
          (view[iBase + S.VEL_Y] - view[jBase + S.VEL_Y]) ** 2 +
          (view[iBase + S.VEL_Z] - view[jBase + S.VEL_Z]) ** 2,
        );
        applyIonization(iBase, jBase, dist, relSpeed, 0.6 * syn[LAW_INDEXES.IONIZATION]);
      }
      if (active[LAW_INDEXES.DISCHARGE]) {
        // Spark direction: toward the neighbor whose stored charge is most
        // opposite to this particle's (the potential difference it will bridge).
        const ci = view[iBase + S.CHARGE] || 0;
        if (Math.abs(ci) >= 0.5) {
          const cj = view[jBase + S.CHARGE] || 0;
          const dq = cj - ci;
          const weight = (ci > 0 ? -dq : dq) / (dist + 1.0);
          if (weight > 0) {
            ddx += dx * weight;
            ddy += dy * weight;
            ddz += dz * weight;
          }
        }
      }

      // ── Information (pairwise) ──
      if (active[LAW_INDEXES.SYMBOL]) {
        const symForce = applySymbolForce(iBase, jBase, dx, dy, dz, dist, 0.3 * syn[LAW_INDEXES.SYMBOL]);
        if (symForce) {
          ax += symForce.ax;
          ay += symForce.ay;
          az += symForce.az;
        }
      }
      if (active[LAW_INDEXES.METRIC]) {
        const metForce = applyMetricForce(iBase, jBase, dx, dy, dz, dist, 0.2);
        if (metForce) {
          ax += metForce.ax;
          ay += metForce.ay;
          az += metForce.az;
        }
      }
      if (active[LAW_INDEXES.PREDICT]) {
        const predForce = applyPredictForce(iBase, jBase, dx, dy, dz, dist, 0.3 * syn[LAW_INDEXES.PREDICT]);
        if (predForce) {
          ax += predForce.ax;
          ay += predForce.ay;
          az += predForce.az;
        }
      }
      if (active[LAW_INDEXES.PATTERN]) {
        const patForce = applyPatternForce(iBase, jBase, dx, dy, dz, dist, 0.2);
        if (patForce) {
          ax += patForce.ax;
          ay += patForce.ay;
          az += patForce.az;
        }
      }
      if (active[LAW_INDEXES.STIGMERGY]) {
        const stigForce = applyStigmergyForce(iBase, jBase, 0.3 * syn[LAW_INDEXES.STIGMERGY], _stigOut);
        if (stigForce) {
          ax += stigForce.ax;
          ay += stigForce.ay;
          az += stigForce.az;
        }
      }
      if (active[LAW_INDEXES.LEARN]) applyLearnAlign(iBase, jBase, 0.05 * syn[LAW_INDEXES.LEARN]);
      if (active[LAW_INDEXES.MEMORY]) applyMemoryRefresh(iBase, jBase);
      if (active[LAW_INDEXES.CODE]) applyCodeBlend(iBase, jBase, distSq, 0.05 * syn[LAW_INDEXES.CODE]);
      if (active[LAW_INDEXES.PROTOCOL]) applyProtocolSync(iBase, jBase, 0.1 * syn[LAW_INDEXES.PROTOCOL]);
      if (active[LAW_INDEXES.SIGNAL_BOOST]) applySignalBoost(iBase, jBase, 0.08 * syn[LAW_INDEXES.SIGNAL_BOOST]);
      if (active[LAW_INDEXES.SUPERCONDUCTIVITY]) {
        const scForce = applySuperconductivity(iBase, jBase, 0.05 * syn[LAW_INDEXES.SUPERCONDUCTIVITY]);
        if (scForce) {
          ax += scForce.ax;
          ay += scForce.ay;
          az += scForce.az;
        }
      }
      if (active[LAW_INDEXES.LANGUAGE]) applyLanguage(iBase, jBase, 0.25 * syn[LAW_INDEXES.LANGUAGE]);
      if (active[LAW_INDEXES.CULTURE]) applyCulture(iBase, jBase, 0.5 * syn[LAW_INDEXES.CULTURE]);

      // ── 8x16 expansion (pairwise) ──

      // Physics
      if (active[LAW_INDEXES.TIDE]) {
        const tideForce = applyTide(view, iBase, jBase, dx, dy, dz, dist, 0.3);
        if (tideForce) { ax += tideForce.ax; ay += tideForce.ay; az += tideForce.az; }
      }
      if (active[LAW_INDEXES.HORIZON]) {
        const f = applyHorizon(view, iBase, jBase, dx, dy, dz, dist, 0.08 * syn[LAW_INDEXES.HORIZON]);
        if (f) { ax += f.ax; ay += f.ay; az += f.az; }
      }
      if (active[LAW_INDEXES.RADIATION_PRESSURE]) {
        const f = applyRadiationPressure(view, iBase, jBase, dx, dy, dz, dist, 0.12 * syn[LAW_INDEXES.RADIATION_PRESSURE]);
        if (f) { ax += f.ax; ay += f.ay; az += f.az; }
      }
      if (active[LAW_INDEXES.FIELD]) {
        const f = applyField(view, iBase, halfWorld, halfWorld, halfWorld, 0.02 * syn[LAW_INDEXES.FIELD]);
        ax += f.ax; ay += f.ay; az += f.az;
      }

      // Slate Mechanics
      if (active[LAW_INDEXES.CONTACT]) {
        const f = applyContact(view, iBase, jBase, dx, dy, dz, dist, 1.0);
        if (f) { ax += f.ax; ay += f.ay; az += f.az; }
      }
      if (active[LAW_INDEXES.MOMENTUM]) {
        const f = applyMomentum(view, iBase, jBase, 0.04);
        ax += f.ax; ay += f.ay; az += f.az;
      }
      if (active[LAW_INDEXES.TORQUE]) {
        const f = applyTorque(view, iBase, jBase, dx, dy, dz, 0.01);
        ax += f.ax; ay += f.ay; az += f.az;
      }
      if (active[LAW_INDEXES.CONSTRAINT]) {
        const f = applyConstraint(view, iBase, jBase, dx, dy, dz, dist, 0.03);
        ax += f.ax; ay += f.ay; az += f.az;
      }
      if (active[LAW_INDEXES.FRAGMENTATION]) {
        const f = applyFragmentation(view, iBase, jBase, dx, dy, dz, dist, 0.02);
        if (f) { ax += f.ax; ay += f.ay; az += f.az; }
      }
      if (active[LAW_INDEXES.TOPOLOGY]) {
        const f = applyTopology(view, iBase, jBase, dx, dy, dz, dist, 0.01);
        ax += f.ax; ay += f.ay; az += f.az;
      }
      if (active[LAW_INDEXES.ADHESION]) {
        const f = applyAdhesion(view, iBase, jBase, dx, dy, dz, dist, 0.015);
        if (f) { ax += f.ax; ay += f.ay; az += f.az; }
      }

      // Biology
      if (active[LAW_INDEXES.SYMBIOSIS]) applySymbiosis(view, iBase, jBase, 0.5);
      if (active[LAW_INDEXES.PARASITE]) applyParasite(view, iBase, jBase, 0.5);

      // Chemistry
      if (active[LAW_INDEXES.ELECTROLYSIS]) applyElectrolysis(view, iBase, jBase, 0.5);
      if (active[LAW_INDEXES.PRECIPITATION]) applyPrecipitation(view, iBase, jBase, 0.5);
      if (active[LAW_INDEXES.NEUTRALIZATION]) applyNeutralization(view, iBase, jBase, 0.5);
      if (active[LAW_INDEXES.STOICHIOMETRY]) applyStoichiometry(view, iBase, jBase, 0.5);
      if (active[LAW_INDEXES.AUTOCATALYSIS]) applyAutocatalysis(view, iBase, jBase, 0.5);

      // Thermodynamics
      if (active[LAW_INDEXES.COMPRESSION]) applyCompression(view, iBase, jBase, dist, 0.5);
      if (active[LAW_INDEXES.EQUILIBRIUM]) applyEquilibrium(view, iBase, jBase, 0.3);

      // Electromagnetism
      if (active[LAW_INDEXES.POLARIZATION]) applyPolarization(view, iBase, jBase, 0.5);

      // Information
      if (active[LAW_INDEXES.NAVIGATION]) {
        const navForce = applyNavigation(view, iBase, jBase, dx, dy, dz, dist, 0.5);
        if (navForce) { ax += navForce.ax; ay += navForce.ay; az += navForce.az; }
      }

      // Metaphysics
      if (active[LAW_INDEXES.PERCEPTION]) {
        const perForce = applyPerception(view, iBase, jBase, dist, 0.5);
        if (perForce) { ax += perForce.ax; ay += perForce.ay; az += perForce.az; }
      }
      if (active[LAW_INDEXES.SYNCHRONICITY]) {
        const syncForce = applySynchronicity(view, iBase, jBase, 0.5);
        if (syncForce) { ax += syncForce.ax; ay += syncForce.ay; az += syncForce.az; }
      }

      // Quantum
      if (active[LAW_INDEXES.COHERENCE]) {
        const cohForce = applyCoherence(view, iBase, jBase, 0.5);
        if (cohForce) { ax += cohForce.ax; ay += cohForce.ay; az += cohForce.az; }
      }
      if (active[LAW_INDEXES.BOSONIC]) {
        const bosForce = applyBosonic(view, iBase, jBase, dx, dy, dz, dist, 0.5);
        if (bosForce) { ax += bosForce.ax; ay += bosForce.ay; az += bosForce.az; }
      }
      if (active[LAW_INDEXES.FERMIONIC]) {
        const ferForce = applyFermionic(view, iBase, jBase, dx, dy, dz, dist, 0.5);
        if (ferForce) { ax += ferForce.ax; ay += ferForce.ay; az += ferForce.az; }
      }
      if (active[LAW_INDEXES.OBSERVER]) {
        // WAVE_PARTICLE: a high-MEMORY observer measures the neighbour.
        if (active[LAW_INDEXES.WAVE_PARTICLE] && (view[iBase + S.MEMORY] || 0) > 0.5) {
          view[jBase + S.WAVE_MEASURED] = 1;
        }
        applyObserver(view, iBase, jBase, 0.5);
      }
      if (active[LAW_INDEXES.ANTIMATTER]) applyAntimatter(view, iBase, jBase, 0.5);

      // ── New law types (pairwise) ──

      // Singularity — extreme inward pull from a supermassive neighbour,
      // then absorption if i crosses the hole's event horizon.
      if (active[LAW_INDEXES.SINGULARITY]) {
        const singSynergy = syn[LAW_INDEXES.SINGULARITY];
        const singForce = applySingularityForce(iBase, jBase, dx, dy, dz, dist, 0.5 * singSynergy);
        if (singForce) {
          ax += singForce.ax;
          ay += singForce.ay;
          az += singForce.az;
        }
        if (applySingularityAbsorb(iBase, jBase, dist, singSynergy)) {
          iAbsorbed = true;
          break; // i was consumed — stop interacting with neighbours
        }
      }

      // Entanglement — touching particles forge a non-local quantum link.
      if (active[LAW_INDEXES.ENTANGLEMENT]) {
        applyEntanglePair(iBase, jBase, dist);
      }
    }

    // Consumed by an event horizon this tick — skip integration/lifecycle.
    if (iAbsorbed) continue;

    // Pairwise laws may mutate mass in-place (PREDATION absorption); fold any
    // such change into the local mass before integration and writeback.
    mass = view[iBase + S.MASS];
    if (!Number.isFinite(mass) || mass <= 0) mass = 0.001;

    // The collision/softbody pass pushes the local position directly; capture
    // that delta so per-particle position mutations can be folded in later
    // without discarding the push.
    const softbodyDX = px - view[iBase + S.POS_X];
    const softbodyDY = py - view[iBase + S.POS_Y];
    const softbodyDZ = pz - view[iBase + S.POS_Z];

    // Per-law timing: record pairwise phase elapsed for each law that fired.
    // The individual law timers are accumulated in the pairwise loop above;
    // this is just the checkpoint before we enter per-particle phase.

    // ── Non-pairwise laws ──

    // Planetary gravity
    const planetSynergy = syn[LAW_INDEXES.PLANETARY];
    const planetForce = applyPlanetary(lawState, view, iBase, px, py, pz, worldSize, planetSynergy);
    if (planetForce) {
      ax += planetForce.ax;
      ay += planetForce.ay;
      az += planetForce.az;
    }

    // Void
    const voidSynergy = syn[LAW_INDEXES.VOID];
    const voidForce = applyVoid(lawState, view, iBase, px, py, pz, worldSize, voidSynergy);
    if (voidForce) {
      ax += voidForce.ax;
      ay += voidForce.ay;
      az += voidForce.az;
    }

    // Buoyancy (thermal lift — replaced WRAP at bit 3)
    const buoyForce = applyBuoyancy(lawState, view, iBase);
    if (buoyForce) az += buoyForce.az;

    // Dimensionality
    vz += applyDimensionality(lawState, view, iBase, prng, localTimeStep,
      syn[LAW_INDEXES.DIMENSIONALITY]);

    // Chaos (deterministic Lorenz map — v4.6.29, no PRNG)
    applyChaos(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.CHAOS]);

    // Soul decay — souls dissipate slowly unless replenished
    applySoulDecay(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.SOUL_LAW]);

    // Fate — per-species drifting destiny point
    const fateForce = applyFate(lawState, view, iBase, px, py, pz, worldSize,
      syn[LAW_INDEXES.FATE]);
    if (fateForce) {
      ax += fateForce.ax;
      ay += fateForce.ay;
      az += fateForce.az;
    }

    // ── Electromagnetism (per-particle) ──
    if (active[LAW_INDEXES.FIELD]) {
      const fieldForce = applyFieldDrift(iBase, 0.3 * syn[LAW_INDEXES.FIELD]);
      if (fieldForce) {
        ax += fieldForce.ax;
        ay += fieldForce.ay;
        az += fieldForce.az;
      }
    }
    if (active[LAW_INDEXES.RESISTANCE]) {
      const resForce = applyResistance(iBase, vx, vy, vz, 0.03 * syn[LAW_INDEXES.RESISTANCE]);
      if (resForce) {
        ax += resForce.ax;
        ay += resForce.ay;
        az += resForce.az;
      }
    }
    if (active[LAW_INDEXES.CAPACITANCE]) {
      applyCapacitanceStore(iBase, 0.002);
    }
    if (active[LAW_INDEXES.DISCHARGE]) {
      const discForce = applyDischarge(iBase, prng, 0.8 * syn[LAW_INDEXES.DISCHARGE], ddx, ddy, ddz);
      if (discForce) {
        ax += discForce.ax;
        ay += discForce.ay;
        az += discForce.az;
      }
    }
    if (active[LAW_INDEXES.PLASMA]) {
      applyPlasma(iBase, 0.02 * syn[LAW_INDEXES.PLASMA]);
    }

    // ── Information (per-particle) ──
    if (active[LAW_INDEXES.STIGMERGY]) {
      applyTrailWrite(iBase, px, py, pz, vx, vy, vz);
    }
    if (active[LAW_INDEXES.MEMORY]) {
      applyMemoryDecay(iBase, 0.995, 0.5);
    }
    if (active[LAW_INDEXES.FEEDBACK]) {
      const fbForce = applyFeedback(iBase, 0.5 * syn[LAW_INDEXES.FEEDBACK]);
      if (fbForce) {
        ax += fbForce.ax;
        ay += fbForce.ay;
        az += fbForce.az;
      }
    }

    // ── 8x16 expansion (per-particle) ──
    const center = worldSize * 0.5;

    // Physics
    if (active[LAW_INDEXES.FRICTION]) {
      const frForce = applyFriction(view, iBase, 0.05);
      if (frForce) { ax += frForce.ax; ay += frForce.ay; az += frForce.az; }
    }
    if (active[LAW_INDEXES.TURBULENCE]) {
      const tbForce = applyTurbulence(view, iBase, 0.05, prng);
      if (tbForce) { ax += tbForce.ax; ay += tbForce.ay; az += tbForce.az; }
    }
    if (active[LAW_INDEXES.CENTRIPETAL]) {
      const cpForce = applyCentripetal(view, iBase, center, center, center, 0.0005);
      if (cpForce) { ax += cpForce.ax; ay += cpForce.ay; az += cpForce.az; }
    }
    if (active[LAW_INDEXES.ROTATION]) {
      const rotForce = applyRotation(view, iBase, center, center, center, 0.002);
      if (rotForce) { ax += rotForce.ax; ay += rotForce.ay; az += rotForce.az; }
    }

    // Biology
    if (active[LAW_INDEXES.HIBERNATION]) {
      const hibForce = applyHibernation(view, iBase, 0.5);
      if (hibForce) { ax += hibForce.ax; ay += hibForce.ay; az += hibForce.az; }
    }
    if (active[LAW_INDEXES.IMMUNITY]) applyImmunity(view, iBase, 0.5);

    // Chemistry
    if (active[LAW_INDEXES.PHOTOLYSIS]) applyPhotolysis(view, iBase, 0.5);

    // Thermodynamics
    if (active[LAW_INDEXES.ADIABATIC]) {
      const adForce = applyAdiabatic(view, iBase, 0.1);
      if (adForce) { ax += adForce.ax; ay += adForce.ay; az += adForce.az; }
    }
    if (active[LAW_INDEXES.LATENT_HEAT]) applyLatentHeat(view, iBase, 0.1);
    if (active[LAW_INDEXES.RUNAWAY]) applyRunaway(view, iBase, 0.1);

    // Metaphysics
    if (active[LAW_INDEXES.CONSCIOUSNESS]) applyConsciousness(view, iBase, 0.5);

    // Electromagnetism
    if (active[LAW_INDEXES.ANTENNA]) applyAntenna(view, iBase, 0.5);
    if (active[LAW_INDEXES.SHIELDING]) applyShielding(view, iBase, 0.5);

    // Information
    if (active[LAW_INDEXES.ENCRYPTION]) applyEncryption(view, iBase, 0.5);

    // Quantum
    if (active[LAW_INDEXES.SUPERPOSITION]) {
      const supForce = applySuperposition(view, iBase, 0.05, prng);
      if (supForce) { ax += supForce.ax; ay += supForce.ay; az += supForce.az; }
    }
    if (active[LAW_INDEXES.TUNNELING]) applyTunneling(view, iBase, 0.5, prng);
    if (active[LAW_INDEXES.DECOHERENCE]) {
      const decForce = applyDecoherence(view, iBase, 0.1);
      if (decForce) { ax += decForce.ax; ay += decForce.ay; az += decForce.az; }
    }
    if (active[LAW_INDEXES.WAVE_PARTICLE]) {
      const wpForce = applyWaveParticle(view, iBase, 0.1);
      if (wpForce) { ax += wpForce.ax; ay += wpForce.ay; az += wpForce.az; }
    }
    if (active[LAW_INDEXES.UNCERTAINTY]) {
      const uncForce = applyUncertainty(view, iBase, 0.1, prng);
      if (uncForce) { ax += uncForce.ax; ay += uncForce.ay; az += uncForce.az; }
    }
    if (active[LAW_INDEXES.TELEPORT]) applyTeleport(view, iBase, 0.5, prng);
    if (active[LAW_INDEXES.PLANCK]) applyPlanck(view, iBase, 0.5);
    if (active[LAW_INDEXES.SPIN]) {
      const spinForce = applySpin(view, iBase, 0.05, prng);
      if (spinForce) { ax += spinForce.ax; ay += spinForce.ay; az += spinForce.az; }
    }
    if (active[LAW_INDEXES.SPECTRAL]) applySpectral(view, iBase, 0.5);
    if (active[LAW_INDEXES.WAVEFUNCTION]) applyWavefunction(view, iBase, 0.5);
    if (active[LAW_INDEXES.HYPERPLANE]) {
      const hypForce = applyHyperplane(view, iBase, 1.0);
      if (hypForce) { ax += hypForce.ax; ay += hypForce.ay; az += hypForce.az; }
    }

    // Per-particle laws may mutate position in-place (TUNNELING, UNCERTAINTY,
    // TELEPORT, WAVEFUNCTION); fold those changes into the local position so
    // later phases and the final writeback see them — while keeping the
    // collision/softbody push captured above.
    px = view[iBase + S.POS_X] + softbodyDX;
    py = view[iBase + S.POS_Y] + softbodyDY;
    pz = view[iBase + S.POS_Z] + softbodyDZ;

    // ── New law types (per-particle) ──

    // Entanglement — correlated link lifecycle only (no-signaling): no forces,
    // no signal relay; the pair's shared phase decoheres and collapses on both
    // sides when a partner dies or the correlation expires.
    if (active[LAW_INDEXES.ENTANGLEMENT]) {
      applyEntanglement(iBase);
    }

    // History — write presence into the spatial memory field, then drift
    // along the local memory-field gradient (archaeology as a force).
    // ── Field system — advance the medium once per solve ──
  // Ambient seeding toward the FIELD_* sliders + diffusion/decay + advection.
  if (fieldsOn) {
    advanceFields(fieldSystem, dt, WP);
  }

  if (active[LAW_INDEXES.HISTORY]) {
      applyHistoryWrite(iBase, px, py, pz, worldSize);
      const histForce = applyHistoryForce(iBase, px, py, pz, worldSize, 0.8 * syn[LAW_INDEXES.HISTORY]);
      if (histForce) {
        ax += histForce.ax;
        ay += histForce.ay;
        az += histForce.az;
      }
    }

    // ── Field system (v8.2 E.1): ambient medium forces ──
    // Vector fields (WIND/EM) push along their flow; scalar fields
    // (THERMAL/INFO) push down-gradient; gravity wells pull radially.
    if (fieldsOn) {
      const ff = sampleFieldForces(fieldSystem, px, py, pz, WP);
      ax += ff.ax;
      ay += ff.ay;
      az += ff.az;
      const wf = wellForce(fieldSystem, px, py, pz, WP);
      ax += wf.ax;
      ay += wf.ay;
      az += wf.az;
    }

    // ── Drag ──

    if (active[LAW_INDEXES.DRAG]) {
      const viscosity = (dnaI[DNA_INDEXES.VISCOSITY] || 0.98) * (Number.isFinite(WP.VISCOSITY) ? WP.VISCOSITY : 1);
      const dragFactor = Math.pow(viscosity, localTimeStep);
      ax -= vx * (1 - dragFactor) * 10;
      ay -= vy * (1 - dragFactor) * 10;
      az -= vz * (1 - dragFactor) * 10;

      // FRICTION DNA = velocity-dependent drag — same law family (kinetic
      // dampening). Gated with DRAG so no movement effect runs lawless.
      const friction = dnaI[DNA_INDEXES.FRICTION] || 0.01;
      ax -= vx * friction;
      ay -= vy * friction;
      az -= vz * friction;
    }

    // Entropy (jitter)
    if (active[LAW_INDEXES.ENTR]) {
      const jitter = (dnaI[DNA_INDEXES.JITTER] || 0.05) * (Number.isFinite(WP.ENTROPY) ? WP.ENTROPY : 1);
      const jitterMult = syn[LAW_INDEXES.ENTR];
      ax += (prng() - 0.5) * jitter * jitterMult * localTimeStep;
      ay += (prng() - 0.5) * jitter * jitterMult * localTimeStep;
      az += (prng() - 0.5) * jitter * jitterMult * 0.3 * localTimeStep;
    }

    // ── Force clamping (goal-engine tunable ceiling + global force scale) ──

    ax *= runtimeConfig.forceScale;
    ay *= runtimeConfig.forceScale;
    az *= runtimeConfig.forceScale;
    const forceMag = Math.sqrt(ax * ax + ay * ay + az * az);
    const forceCap = Math.min(MAX_FORCE, Math.max(0.1, runtimeConfig.maxForce));
    if (forceMag > forceCap) {
      const scale = forceCap / forceMag;
      ax *= scale;
      ay *= scale;
      az *= scale;
    }

    // ── Integration: velocity (apply forces) ──

    const inertia = dnaI[DNA_INDEXES.INERTIA] || 1.0;
    const invMass = 1.0 / mass;
    // Laws that wrote velocity deltas directly to the buffer during force
    // accumulation (CHAOS, DIMENSIONALITY, thermal currents) must be folded
    // into the local velocity before integration.
    vx = view[iBase + S.VEL_X];
    vy = view[iBase + S.VEL_Y];
    vz = view[iBase + S.VEL_Z];
    vx += (ax * localTimeStep * invMass) / inertia;
    vy += (ay * localTimeStep * invMass) / inertia;
    vz += (az * localTimeStep * invMass) / inertia;

    // Will — self-propulsion (applies boost along current velocity)
    const preWillVx = view[iBase + S.VEL_X];
    const preWillVy = view[iBase + S.VEL_Y];
    const preWillVz = view[iBase + S.VEL_Z];
    applyWill(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.WILL]);
    // Fold Will's in-place boost into the local velocity copy.
    vx += view[iBase + S.VEL_X] - preWillVx;
    vy += view[iBase + S.VEL_Y] - preWillVy;
    vz += view[iBase + S.VEL_Z] - preWillVz;

    // ── Global drag multiplier (goal-engine tunable) — gated by DRAG ──

    if (active[LAW_INDEXES.DRAG]) {
      vx *= runtimeConfig.dragMultiplier;
      vy *= runtimeConfig.dragMultiplier;
      vz *= runtimeConfig.dragMultiplier;
    }

    // ── World params: WIND (constant +X drift) + DAMPING (global decay) ──

    const worldDamp = Math.pow(1 - (Number.isFinite(WP.DAMPING) ? WP.DAMPING : 0) / 100, localTimeStep);
    if (worldDamp !== 1) {
      vx *= worldDamp;
      vy *= worldDamp;
      vz *= worldDamp;
    }
    if (WP.WIND) vx += WP.WIND * 0.5 * localTimeStep;

    // ── TORQUE DNA: rotational momentum — gently rotate the velocity vector
    //    around the Z axis (higher |TORQUE| = faster spin; sign = direction) ──
    const torque = dnaI[DNA_INDEXES.TORQUE] || 0;
    if (Math.abs(torque) > 0.001) {
      const ang = torque * 0.02 * localTimeStep;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const tvx = vx * c - vy * s;
      const tvy = vx * s + vy * c;
      vx = tvx;
      vy = tvy;
    }

    // ── Integration: position ──

    px += vx * localTimeStep;
    py += vy * localTimeStep;
    pz += vz * localTimeStep;

    // ── Velocity clamping ──
    // Runs AFTER the position step so wall-bounce velocities (set in the soft-
    // wall block below, e.g. WALL_REFLECT 2 → 200% bounce) get to move the
    // particle for one tick before the hard MAX_VELOCITY cap reins them in.

    const dnaMaxVel = dnaI[DNA_INDEXES.MAX_VELOCITY] || MAX_VELOCITY;
    const velLimit = Math.min(dnaMaxVel, MAX_VELOCITY);
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed > velLimit) {
      const vScale = velLimit / speed;
      vx *= vScale;
      vy *= vScale;
      vz *= vScale;
    }

    // ── Toroidal wrapping ──
    // TOROIDAL EDGES world param (the WRAP law was retired into WORLD →
    // SIMULATION RULES): 1 = wrap around edges, 0 = soft walls (WALL REFLECT).

    if (!Number.isFinite(WP.TOROIDAL) || WP.TOROIDAL !== 0) {
      px = ((px % worldSize) + worldSize) % worldSize;
      py = ((py % worldSize) + worldSize) % worldSize;
      pz = ((pz % worldSize) + worldSize) % worldSize;
    } else {
      // Clamp to world bounds (soft wall). WALL_REFLECT slider: 0 = 100%
      // absorption, 1 = 100% reflect (default), 2 = 200% reflect.
      const wallReflect = Number.isFinite(WP.WALL_REFLECT) ? WP.WALL_REFLECT : 1;
      if (px < 0) { px = 0; vx = Math.abs(vx) * wallReflect; }
      else if (px >= worldSize) { px = worldSize - 0.01; vx = -Math.abs(vx) * wallReflect; }
      if (py < 0) { py = 0; vy = Math.abs(vy) * wallReflect; }
      else if (py >= worldSize) { py = worldSize - 0.01; vy = -Math.abs(vy) * wallReflect; }
      if (pz < 0) { pz = 0; vz = Math.abs(vz) * wallReflect; }
      else if (pz >= worldSize) { pz = worldSize - 0.01; vz = -Math.abs(vz) * wallReflect; }
    }

    // ── Field medium: portals + hard walls (v8.2 E.1) ──
    // Portals teleport matter between paired cells (ambient feature - any
    // law on). Walls are impassable only while the COLL law (the hard-matter
    // toggle) is on; ghost laws (TUNNELING / TELEPORT / ASTRAL) pass through.
    // The response is velocity-only: push out of the wall cell and reflect
    // the velocity component pointing into it.
    if (fieldsOn && fieldSystem.portals.length > 0) {
      const dest = portalAt(fieldSystem, px, py, pz);
      if (dest) {
        px = dest.x;
        py = dest.y;
        pz = dest.z;
      }
    }
    if (
      active[LAW_INDEXES.COLL] &&
      fieldsOn &&
      fieldSystem.hasWalls &&
      !(active[LAW_INDEXES.TUNNELING] || active[LAW_INDEXES.TELEPORT] || active[LAW_INDEXES.ASTRAL])
    ) {
      const w = resolveWall(fieldSystem, px, py, pz, vx, vy, vz);
      px = w.px;
      py = w.py;
      pz = w.pz;
      vx = w.vx;
      vy = w.vy;
      vz = w.vz;
    }

    // ── NaN guard ──

    if (
      !Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz) ||
      !Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz) ||
      !Number.isFinite(mass)
    ) {
      px = worldSize * 0.5 + (prng() - 0.5) * 10;
      py = worldSize * 0.5 + (prng() - 0.5) * 10;
      pz = worldSize * 0.5 + (prng() - 0.5) * 10;
      vx = 0;
      vy = 0;
      vz = 0;
      mass = 1.0;
    }

    // ── Write back to buffer ──

    // Bond/Polymer non-overlap constraint
    // v8.16: reuse saved neighbor list from main loop
    if (hasBondOrPolymer) {
      for (let n2 = 0; n2 < savedLimit; n2++) {
        const bj = nb[n2];
        if (bj === i) continue;
        const bPtr = bj * stride;
        if (view[bPtr + S.DEAD] >= 0.5) continue;
        
        let bx = view[bPtr + S.POS_X] - px;
        let by = view[bPtr + S.POS_Y] - py;
        let bz = view[bPtr + S.POS_Z] - pz;
        
        if (bx > halfWorld) bx -= worldSize; else if (bx < -halfWorld) bx += worldSize;
        if (by > halfWorld) by -= worldSize; else if (by < -halfWorld) by += worldSize;
        if (bz > halfWorld) bz -= worldSize; else if (bz < -halfWorld) bz += worldSize;
        
        const bd2 = bx*bx + by*by + bz*bz;
        const bd = Math.sqrt(bd2 + 0.001);
        const rA = view[iBase + S.RADIUS] || 1.0;
        const rB = view[bPtr + S.RADIUS] || 1.0;
        const minDist = (rA + rB) * 1.0;
        
        if (bd < minDist) {
          const overlap = minDist - bd;
          const mTotal = mass + view[bPtr + S.MASS];
          const ratio = view[bPtr + S.MASS] / Math.max(mTotal, 0.001);
          px -= (bx/bd) * overlap * ratio;
          py -= (by/bd) * overlap * ratio;
          pz -= (bz/bd) * overlap * ratio;
        }
        
        // Bond equilibrium distance
        if (active[LAW_INDEXES.BOND]) {
          const sI = view[iBase + S.SPECIES_ID];
          const sB = view[bPtr + S.SPECIES_ID];
          const aff = dnaI[DNA_INDEXES.SPECIES_AFFINITY] || 0;
          if ((sI === sB && aff >= 0) || (sI !== sB && aff < 0)) {
            // BOND_ANGLE DNA (31): favoured cluster geometry — wider angles
            // reach farther, so the equilibrium bond distance stretches.
            const bondAngle = dnaI[DNA_INDEXES.BOND_ANGLE] || 0;
            const angleScale = 1 + Math.min(1, Math.abs(bondAngle) / 120);
            const eqDist = ((dnaI[DNA_INDEXES.BASE_RADIUS] || 5) * 2.5 + (view[bPtr + S.DNA_CACHE_START + DNA_INDEXES.BASE_RADIUS] || 5) * 2.5) * angleScale;
            if (bd > eqDist && bd > 0.1) {
              const stiffness = dnaI[DNA_INDEXES.STIFFNESS] || 0.5;
              const pull = (bd - eqDist) * stiffness * 0.15;
              px += (bx/bd) * pull * 0.5;
              py += (by/bd) * pull * 0.5;
              pz += (bz/bd) * pull * 0.5;
            }
          }
        }
      }
    }

    // Final NaN guard — the bond/polymer block runs after the first guard
    if (
      !Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz) ||
      !Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz) ||
      !Number.isFinite(mass)
    ) {
      px = worldSize * 0.5; py = worldSize * 0.5; pz = worldSize * 0.5;
      vx = 0; vy = 0; vz = 0; mass = 1.0;
    }
    view[iBase + S.POS_X] = px;
    view[iBase + S.POS_Y] = py;
    view[iBase + S.POS_Z] = pz;
    view[iBase + S.VEL_X] = vx;
    view[iBase + S.VEL_Y] = vy;
    view[iBase + S.VEL_Z] = vz;
    // Laws may have modified particle mass in-place during the pair loop
    // (ALLOY fusion, accretion, chemistry mass transfer); fold the buffer
    // value back into the local copy so the writeback and radius update
    // reflect it.
    mass = view[iBase + S.MASS];
    view[iBase + S.MASS] = mass;
    // Age is the particle's own time coordinate (frame count since birth),
    // advanced here so oscillator phases and lifecycle gating progress with
    // or without the LIFE law. Frozen entirely when no laws are active.
    view[iBase + S.AGE] = (view[iBase + S.AGE] || 0) + localTimeStep;

    // ── Signal decay (emission + decay, gated by COMMS law) ──

    if (active[LAW_INDEXES.COMMS]) {
      applySignalDecay(lawState, view, iBase, dnaI, localTimeStep);
    }

    // ── Life cycle ──

    applyLifeCycle(lawState, view, iBase, dnaI, localTimeStep, prng,
      syn[LAW_INDEXES.LIFE] * runtimeConfig.deathRate, dnaBuffer);

    // ── Glow ──
    applyGlowEffect(lawState, view, iBase, dnaI, localTimeStep,
      syn[LAW_INDEXES.GLOW]);

    // ── Genotype ──
    applyGenotypeMutation(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.GENOTYPE], prng, dnaBuffer);

    // ── Radiation ──
    applyRadiationDamage(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.RADIATION], prng);

    // ── Phenotype ──
    applyPhenotype(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.PHENOTYPE]);

    // ── Oxidation ──
    applyOxidationEffect(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.OXIDATION]);

    // ── Isomerization ──
    applyIsomerization(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.ISOMERIZATION], prng, stride);

    // ── Phase Radiation ──
    applyPhaseRadiation(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.PHASE_RADIATION]);

    // ── Sublimation ──
    applySublimation(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.SUBLIMATION], prng);

    // ── Thermal jitter (HEAT) ──

    applyThermalJitter(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.HEAT], prng);

    // ── Cold damping (COLD) ──

    applyColdDamping(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.COLD]);

    // ── Convection ──

    applyConvection(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.CONVECTION]);

    // ── Reproduction ──

    const offspring = applyReproduction(lawState, view, iBase, dnaI, prng,
      syn[LAW_INDEXES.REPRO] * runtimeConfig.birthRate, dnaBuffer, localTimeStep);
    if (offspring) {
      _offspringRing[_ringWrite] = offspring;
      _ringWrite = (_ringWrite + 1) % OFFSPRING_RING_SIZE;
    }

    // ── Update radius from mass ──

    const baseRadius = dnaI[DNA_INDEXES.BASE_RADIUS] || 2.0;
    let radiusOut = baseRadius * Math.pow(mass, 0.333);
    if (active[LAW_INDEXES.PHENOTYPE]) {
      const energy = view[iBase + S.ENERGY];
      if (Number.isFinite(energy)) {
        radiusOut *= 1 + (energy / 200 - 0.5) * 0.5 * syn[LAW_INDEXES.PHENOTYPE];
      }
    }
    view[iBase + S.RADIUS] = radiusOut;

    // ── Expansion (runs after the mass-derived radius update so its growth
    //    toward the DNA base radius is not overwritten) ──
    if (active[LAW_INDEXES.EXPANSION]) applyExpansion(view, iBase, 0.1);

    // ── Melt ──
    applyMelt(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.MELT], dnaBuffer);

    // ── Boil ──
    applyBoil(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.BOIL], prng);

    // ── Condense ──
    applyCondense(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.CONDENSE]);

    // ── Deposit ──
    applyDeposit(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.DEPOSIT]);

    // ── Exothermic ──
    applyExothermic(lawState, view, iBase,
      localTimeStep, syn[LAW_INDEXES.EXOTHERMIC]);

  }

  // ── History — advance the memory-field clock once per solve ──
  if (active[LAW_INDEXES.HISTORY]) {
    applyHistoryCalc();
  }

  // Per-law timing: record total tick time.
  if (_benchMode) {
    _lastTickUs = (performance.now() - _tickStart) * 1000;
  }
}

// ── Offspring Ring Buffer ──

const OFFSPRING_RING_SIZE = 256;
const _offspringRing = new Array(OFFSPRING_RING_SIZE);
let _ringWrite = 0;
let _ringRead = 0;

/**
 * Drain any offspring produced during the last solve tick.
 * @returns {object[]} Array of offspring data objects
 */
export function drainOffspring() {
  const result = [];
  while (_ringRead !== _ringWrite) {
    const offspring = _offspringRing[_ringRead];
    if (offspring) result.push(offspring);
    _offspringRing[_ringRead] = null;
    _ringRead = (_ringRead + 1) % OFFSPRING_RING_SIZE;
  }
  return result;
}

/**
 * Reset the offspring ring (call on init/restart).
 */
export function resetOffspringRing() {
  _ringWrite = 0;
  _ringRead = 0;
  for (let i = 0; i < OFFSPRING_RING_SIZE; i++) {
    _offspringRing[i] = null;
  }
}

/**
 * Read DNA parameters for a species from the DNA buffer.
 * Returns an array of 42 float values.
 *
 * @param {Uint16Array} dnaBuffer - Species DNA buffer [64 × 64]
 * @param {number} speciesId - Species index (0-63)
 * @returns {number[]}
 */
export function readSpeciesDNA(dnaBuffer, speciesId) {
  const base = speciesId * 64;
  const dna = new Array(42);
  for (let d = 0; d < 42; d++) {
    dna[d] = dnaBuffer[base + d] || 0;
  }
  return dna;
}
