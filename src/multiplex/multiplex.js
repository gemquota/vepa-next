// ============================================================================
// VEPA4 — Chaos Multiplex Engine
// Renders X×Y concurrent simulations in a grid, all sharing one camera.
// Each shard is an independent { buffer, dna, laws, prng, worldParams }
// derived from a source simulation (the selected shard) with per-aspect
// variation (laws, DNA, population, world parameters), so the
// guided-evolution workflow can compare many futures side by side.
// ============================================================================

import {
  WORLD_SIZE,
  PARTICLE_STRIDE,
  MAX_PARTICLES,
  STRIDE_INDEXES,
  DNA_RANGES,
  LAW_COUNT,
} from '../constants.js';
import { createParticleBuffer } from '../state/particleBuffer.js';
import { createDNABuffer, getDNAFloat, setDNAFloat } from '../dna/dnaBuffer.js';
import { createLawState, getActiveCount } from '../state/lawState.js';
import { createSpeciationEngine, updateSpeciation } from '../engines/speciation.js';
import { createWorldParams, clampWorldParam } from '../state/worldParams.js';
import { runtimeConfig } from '../state/runtimeConfig.js';
import { solve, drainOffspring } from '../physics/solver.js';
import { createRenderer, renderFrame, resize as resizeRenderer } from '../render/renderer.js';
import { initCamera } from '../ui/camera.js';
import { SplitMix32 } from '../core/prng.js';

const S = STRIDE_INDEXES;

export const MULTIPLEX_DEFAULTS = {
  cols: 2,
  rows: 2,
  randomizeLaws: true,
  randomizeDNA: true,
  randomizePopulation: true,
  randomizeParams: true,   // perturb world-param (law-tuning) knobs between shards
  variation: 0.5,
  deriveMode: 'clone', // 'clone' | 'spawn'
  autoIterate: false,        // regenerate all shards every autoIterateInterval ticks
  autoIterateInterval: 400,  // ticks between auto-iterations
  autoSelectFittest: false,  // after each iteration, select the shard with the most life
  simSpeed: 1.0,             // timescale multiplier for the shard grid
  paused: false,             // freeze shard stepping (main sim keeps running)
  maxIterations: 0,          // 0 = unlimited; auto-iterate stops at this count
  variationDrift: 0,         // per-iteration variation increase (evolutionary pressure)
  populationScale: 1.0,      // scales the dynamic per-shard population cap (0.25–1)
  spawnSpecies: 5,           // species count for freshly SPAWNED shard populations (1–5)
  fitnessWindow: 32,         // rolling alive-count window feeding GROWTH / STABILITY / DELTA
  seed: 0,                   // 0 = random source seed; >0 = deterministic runs
  substeps: 1,               // solver sub-steps per shard tick (1–8)
  lawVariation: 1,           // per-aspect multipliers on the master VARIATION knob
  dnaVariation: 1,
  popVariation: 1,
  paramVariation: 1,         // world-param (law-tuning knob) variation
  keepSelected: false,       // iterate leaves the selected shard untouched (anchor)
  selectAfterIterate: 'none', // 'none' | 'fittest' | 'follow'
  eliteCount: 0,             // top-N fittest shards survive each iteration untouched (0-4)
  stagnationLimit: 5,        // generations without a best-fitness improvement before auto-iterate pauses (0 = off)
  cooling: 0,                // per-iteration variation shrink toward the exploration floor (0-0.2)
  adaptiveInterval: false,   // stretch the iterate interval ×1.5 while stagnant (cap 4000), reset on improvement
  historyDepth: 6,           // generations of shard history kept for COMPARE/HIST + revert (1-12)
  importOnExit: true,        // exit imports the selected shard into the main world
  renderQuality: 'eco',      // 'eco' | 'full' — previews skip halos/grid, DPR 1.25
  fitnessWeights: {
    population: 1,
    growth: 0,
    longevity: 0,
    stability: 0,
    energy: 0,
    reserves: 0,
    armor: 0,
    mobility: 0,
    signal: 0,
    bonds: 0,
    diversity: 0,
    exploration: 0,
    novelty: 0,
    delta: 0,
  },
  fitnessModes: {
    population: 'max',
    growth: 'max',
    longevity: 'max',
    stability: 'max',
    energy: 'max',
    reserves: 'max',
    armor: 'max',
    mobility: 'max',
    signal: 'max',
    bonds: 'max',
    diversity: 'max',
    exploration: 'max',
    novelty: 'max',
    delta: 'max',
  },
};

/** Hard cap on concurrent shards (keeps the main thread usable). */
export const MAX_SHARDS = 16;

/** Floor for the dynamic per-shard population cap (keeps shards alive at 16×). */
export const MIN_SHARD_POPULATION = 250;

/** Exploration floor for cooling: variation never anneals below this. */
export const VARIATION_FLOOR = 0.05;

/** Cap for the adaptive iterate interval (base × up to ~10 at 400). */
export const ADAPTIVE_INTERVAL_CAP = 4000;

/** The 14 fitness metrics exposed to the FIT tab (weighted composite). */
export const FITNESS_METRICS = Object.freeze([
  'population',
  'growth',
  'longevity',
  'stability',
  'energy',
  'reserves',
  'armor',
  'mobility',
  'signal',
  'bonds',
  'diversity',
  'exploration',
  'novelty',
  'delta',
]);

/** The 13 base metrics (delta is derived, not measured). */
const BASE_FITNESS_METRICS = FITNESS_METRICS.filter((m) => m !== 'delta');

/** Rolling alive-count window length feeding GROWTH / STABILITY. */
export const ALIVE_WINDOW_SIZE = 32;

/** Spatial bins per axis for the EXPLORATION metric (4×4×4 = 64 bins). */
export const EXPLORATION_BINS = 4;

/**
 * Dynamic per-shard population cap: the more shards run at once, the smaller
 * each shard's population gets (inverse-square-root curve), so the combined
 * physics budget stays bounded. `scale` (0.25–1) is the live POP SCALE knob.
 */
export function computeShardPopulationCap(total, scale = 1) {
  const count = Math.max(1, Math.round(total) || 1);
  const base = Math.floor(MAX_PARTICLES / Math.sqrt(count));
  const scaled = Math.floor(base * Math.max(0.1, Math.min(1, parseFloat(scale) || 1)));
  return Math.max(MIN_SHARD_POPULATION, Math.min(MAX_PARTICLES, scaled));
}

/** Species colour palette for freshly spawned shard populations. */
const SHARD_SPECIES_COLORS = [
  [255, 80, 80],
  [255, 200, 50],
  [80, 255, 120],
  [120, 160, 255],
  [100, 60, 140],
];

/**
 * Create a fresh multiplex state object.
 */
export function createMultiplex(bus) {
  return {
    bus,
    active: false,
    config: {
      ...MULTIPLEX_DEFAULTS,
      fitnessWeights: { ...MULTIPLEX_DEFAULTS.fitnessWeights },
      fitnessModes: { ...MULTIPLEX_DEFAULTS.fitnessModes },
    },
    shards: [],
    selected: 0,
    iteration: 0,
    tick: 0,
    populationCap: 0,
    sourceSeed: (Date.now() & 0x7fffffff) | 0,
    worldSize: WORLD_SIZE,
    deltaHistory: [],
    runningBounds: null,       // cross-generation min/max for stable fitness
    bestFitness: null,         // best stable composite seen across generations
    bestIteration: 0,          // generation index that produced bestFitness
    stagnantGenerations: 0,    // generations without a best-fitness improvement
    stagnantPaused: false,     // auto-iterate paused on convergence
    history: [],               // on-screen grid states (generation history + revert)
    currentInterval: null,     // adaptive iterate interval (null = use config base)
    baseWorldParams: null,     // world params the multiplex was derived from
    container: null,
    onResize: null,
  };
}

/**
 * Enter multiplex mode: derive cols×rows shards from `source` (the main sim
 * or a selected shard) and mount the grid into `container`.
 */
export function startMultiplex(mx, source, config, container) {
  stopMultiplex(mx);
  mx.config = {
    ...MULTIPLEX_DEFAULTS,
    ...(config || {}),
    fitnessWeights: { ...((config && config.fitnessWeights) || MULTIPLEX_DEFAULTS.fitnessWeights) },
    fitnessModes: { ...((config && config.fitnessModes) || MULTIPLEX_DEFAULTS.fitnessModes) },
  };
  mx.active = true;
  mx.iteration = 0;
  mx.tick = 0;
  mx.runningBounds = null;
  mx.bestFitness = null;
  mx.bestIteration = 0;
  mx.stagnantGenerations = 0;
  mx.stagnantPaused = false;
  mx.history = [];
  mx.currentInterval = null;
  // The live WORLD panel state is the parameter baseline every shard derives
  // from (and the COMPARE tab's PARAMS row measures divergence against).
  mx.baseWorldParams = { ...(runtimeConfig.worldParams || createWorldParams()) };
  mx.container = container || null;
  const seed = Math.max(1, Math.round(mx.config.seed) || 0);
  mx.sourceSeed = seed > 0 ? (seed & 0x7fffffff) | 0 : (Date.now() & 0x7fffffff) | 0;
  buildShards(mx, source, false);
  // Generation 0 is the first on-screen grid state — history starts here.
  recordHistory(mx, getFitnessReport(mx));
}

/**
 * Leave multiplex mode: tear down shards and their canvases.
 */
export function stopMultiplex(mx) {
  for (const shard of mx.shards) {
    if (shard.wrapper && shard.wrapper.parentNode) {
      shard.wrapper.parentNode.removeChild(shard.wrapper);
    }
  }
  if (mx.onResize && typeof window !== 'undefined') {
    window.removeEventListener('resize', mx.onResize);
    mx.onResize = null;
  }
  mx.shards = [];
  mx.active = false;
  mx.container = null;
}

/**
 * Regenerate every shard from the currently selected shard (new seeds).
 * One fitness report per generation feeds selection, cross-generation bounds,
 * progress tracking, and elite retention — no duplicate metric passes.
 * @param {object} mx
 * @param {{manual?: boolean}} [opts] - `manual` (user-triggered) re-arms a
 *   run that auto-paused on stagnation.
 */
export function iterateMultiplex(mx, opts = {}) {
  if (!mx.active || mx.shards.length === 0) return;
  const cfg = mx.config || {};
  // A manual iterate is an explicit "keep going" — re-arm a stagnant run.
  if (opts.manual) {
    mx.stagnantPaused = false;
    mx.stagnantGenerations = 0;
  }
  // Evolutionary pressure: each generation drifts the variation upward so
  // later generations explore more broadly (capped at full divergence).
  const drift = Math.max(0, Math.min(0.1, parseFloat(cfg.variationDrift) || 0));
  if (drift > 0) cfg.variation = Math.min(1, (cfg.variation || 0) + drift);
  // Cooling (annealing): shrink variation toward the exploration floor each
  // generation, so evolution explores broadly early and refines late. When
  // both DRIFT and COOLING are set, cooling wins at the floor.
  const cooling = Math.max(0, Math.min(0.5, parseFloat(cfg.cooling) || 0));
  if (cooling > 0 && (cfg.variation || 0) > VARIATION_FLOOR) {
    cfg.variation = Math.max(VARIATION_FLOOR, (cfg.variation || 0) * (1 - cooling));
  }
  // Selection policy ('none' | 'fittest' | 'follow'). 'none' is the explicit
  // default, so autoSelectFittest only kicks in when no mode is chosen.
  const mode = cfg.selectAfterIterate && cfg.selectAfterIterate !== 'none'
    ? cfg.selectAfterIterate
    : (cfg.autoSelectFittest ? 'fittest' : 'none');
  // Elitist selection BEFORE the rebuild: rank the generation that just ran
  // (differentiated, evolved states) and let the winner seed the next one.
  // Selecting after the rebuild would rank freshly-spawned near-identical
  // clones — under the default population weight they all tie at the cap and
  // fittest degenerates to "always shard 0".
  const report = getFitnessReport(mx);
  if (mode === 'fittest') selectFittestShard(mx, report);
  const keepIndex = mx.selected;
  const prevSnapshot = snapshotShard(mx.shards[keepIndex]);
  // Elite retention: snapshot the top-N fittest shards (by the stable
  // composite) BEFORE the rebuild so the best lineage survives untouched.
  const elites = buildEliteSnapshots(mx, report, keepIndex, cfg.keepSelected, cfg.eliteCount);
  const source = mx.shards[keepIndex];
  mx.iteration++;
  mx.sourceSeed = ((mx.sourceSeed + 7919) & 0x7fffffff) | 0;
  buildShards(mx, source, true);
  // Anchor: keep-selected leaves the previous selection untouched.
  if (cfg.keepSelected && mx.shards[keepIndex]) {
    restoreShard(mx.shards[keepIndex], prevSnapshot);
  }
  for (const elite of elites) {
    if (cfg.keepSelected && elite.id === keepIndex) continue; // anchor already restored
    if (mx.shards[elite.id]) restoreShard(mx.shards[elite.id], elite.snap);
  }
  if (mode === 'follow') selectFollowShard(mx, prevSnapshot, cfg.keepSelected ? keepIndex : -1);
  // Close the generation: expand the stable bounds and track best/stagnation
  // (after the iteration counter bumps so bestIteration matches the UI).
  updateRunningBounds(mx, report);
  const progress = trackGenerationProgress(mx, report, parseFloat(cfg.stagnationLimit) || 0);
  // Converged: auto-iterate pauses instead of burning ticks on identical
  // generations. Manual iterates and UI re-arms clear the flag.
  if (progress.stagnant && !mx.stagnantPaused) {
    mx.stagnantPaused = true;
    if (mx.bus) {
      mx.bus.emit('multiplex:stagnant', { generation: mx.iteration, bestFitness: mx.bestFitness });
    }
  }
  // Adaptive interval: stretch the cadence while generations plateau (less
  // wasted compute), snap back to the base the moment the best improves.
  const baseInterval = Math.max(1, Math.round(cfg.autoIterateInterval) || 400);
  if (cfg.adaptiveInterval) {
    mx.currentInterval = progress.improved
      ? baseInterval
      : Math.min(ADAPTIVE_INTERVAL_CAP, Math.round((mx.currentInterval || baseInterval) * 1.5));
  } else {
    mx.currentInterval = baseInterval;
  }
  recordDelta(mx);
  // The on-screen grid (post-rebuild, elites restored) is a new history entry.
  recordHistory(mx, report);
  return { ...progress, iteration: mx.iteration };
}

/** Advance physics on every shard by one step. */
export function stepMultiplex(mx, dt, simSpeed, worldSize) {
  const cfg = mx.config || {};
  if (cfg.paused) return; // frozen grid — the main sim keeps stepping
  const effDt = dt * simSpeed * Math.max(0.05, cfg.simSpeed || 1);
  const substeps = Math.max(1, Math.min(8, Math.round(cfg.substeps) || 1));
  const subDt = effDt / substeps;
  const t0 = performance.now();
  // Per-shard world params: the solver reads the runtimeConfig singleton, so
  // each shard's knobs are swapped in for the duration of its tick and the
  // live world's params are restored afterwards. The whole loop is
  // synchronous (no awaits), so the swap is race-free on the main thread.
  const savedWorldParams = runtimeConfig.worldParams;
  try {
    for (const shard of mx.shards) {
      if (shard.count <= 0) continue;
      if (shard.worldParams) runtimeConfig.worldParams = shard.worldParams;
      for (let s = 0; s < substeps; s++) {
        solve(
          shard.view,
          shard.count,
          PARTICLE_STRIDE,
          shard.laws,
          shard.dna,
          worldSize,
          subDt,
          () => shard.prng.next(),
        );
      }
      collectDeadSlots(shard);
      spawnShardOffspring(shard);
      updateShardWindow(shard);
      shard.tick++;
      // Set A.3 — per-shard speciation: field isolation proxied by the
      // shard's own wall preset; silent so shards never touch the main bus.
      updateSpeciation(shard.speciation, shard.view, shard.count, PARTICLE_STRIDE, shard.dna, worldSize, {
        lawActiveCount: getActiveCount(shard.laws),
        wallFactor: shard.worldParams ? Math.min(1, Math.round(shard.worldParams.WALLS_PRESET || 0) / 3) : 0,
        silent: true,
      });
    }
  } finally {
    runtimeConfig.worldParams = savedWorldParams;
  }
  const tickMs = performance.now() - t0;
  mx.lastTickMs = mx.lastTickMs === undefined ? tickMs : mx.lastTickMs * 0.85 + tickMs * 0.15;
  mx.tick++;
  mx.worldSize = worldSize;
  // One pure per-tick measurement (the UI reads the report without recording).
  recordDelta(mx);
  // Auto-iterate: hands-off guided evolution — regenerate every shard on a
  // fixed cadence. Selection policy lives inside iterateMultiplex (elitist
  // pre-rebuild fittest, or post-rebuild follow).
  const interval = mx.currentInterval || Math.max(1, Math.round(cfg.autoIterateInterval) || 400);
  const maxIter = Math.max(0, Math.round(cfg.maxIterations) || 0);
  const withinLimit = maxIter === 0 || mx.iteration < maxIter;
  // stagnantPaused: evolution converged — auto-iterate stands down until a
  // manual iterate (or a knob change) re-arms it.
  if (cfg.autoIterate && mx.shards.length > 0 && withinLimit && !mx.stagnantPaused && (mx.tick % interval === 0)) {
    iterateMultiplex(mx);
  }
}

/**
 * Select the highest-fitness shard (default weights = alive-only ranking).
 * Accepts an already-computed report so iterateMultiplex pays for the metric
 * pass once and reuses it for selection, bounds, progress and elites.
 */
export function selectFittestShard(mx, report) {
  const rep = report || getFitnessReport(mx);
  let best = -1;
  let bestFitness = -Infinity;
  for (const entry of rep.perShard) {
    if (entry.fitness > bestFitness) {
      bestFitness = entry.fitness;
      best = entry.id;
    }
  }
  if (best >= 0) selectShard(mx, best);
}

/**
 * Select the shard whose metric profile is closest to `prevSnapshot` (the
 * previous selection) — "follow the world that was on screen". skipIndex
 * excludes one shard (used to skip the kept-selected anchor).
 */
export function selectFollowShard(mx, prevSnapshot, skipIndex = -1) {
  if (!mx.shards.length || !prevSnapshot) return;
  const worldSize = mx.worldSize || WORLD_SIZE;
  const prev = computeShardMetrics(shardFromSnapshot(prevSnapshot), worldSize);
  const candidates = [];
  for (const shard of mx.shards) {
    if (skipIndex >= 0 && shard.id === skipIndex) continue;
    candidates.push({ id: shard.id, metrics: computeShardMetrics(shard, worldSize) });
  }
  if (!candidates.length) return;
  // Min-max normalize each base metric across prev + candidates, then pick
  // the candidate with the smallest total normalized distance to prev.
  const normPrev = {};
  const normCand = candidates.map((c) => ({ id: c.id, norm: {} }));
  for (const key of BASE_FITNESS_METRICS) {
    let min = Infinity;
    let max = -Infinity;
    for (const c of candidates) {
      const v = c.metrics[key];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (prev[key] < min) min = prev[key];
    if (prev[key] > max) max = prev[key];
    const span = max - min;
    normPrev[key] = span === 0 ? 0 : (prev[key] - min) / span;
    for (let i = 0; i < candidates.length; i++) {
      normCand[i].norm[key] = span === 0 ? 0 : (candidates[i].metrics[key] - min) / span;
    }
  }
  let bestId = -1;
  let bestDist = Infinity;
  for (const c of normCand) {
    let dist = 0;
    for (const key of BASE_FITNESS_METRICS) dist += Math.abs(c.norm[key] - normPrev[key]);
    if (dist < bestDist - 1e-12) {
      bestDist = dist;
      bestId = c.id;
    }
  }
  if (bestId >= 0) selectShard(mx, bestId);
}

/** Aggregate stats for the drawer: shard count, living particles, cap. */
export function summarizeMultiplex(mx) {
  let alive = 0;
  for (const shard of mx.shards) {
    if (!shard || !shard.view) continue;
    const n = Math.min(shard.count || 0, (shard.view.length / PARTICLE_STRIDE) | 0);
    for (let p = 0; p < n; p++) {
      if (shard.view[p * PARTICLE_STRIDE + S.DEAD] === 0) alive++;
    }
  }
  return {
    shards: mx.shards.length,
    alive,
    populationCap: mx.populationCap || 0,
    totalBudget: (mx.populationCap || 0) * mx.shards.length,
  };
}

/** Count living particles in a shard buffer. */
function countAlive(shard) {
  if (!shard || !shard.view) return 0;
  let alive = 0;
  const n = Math.min(shard.count || 0, (shard.view.length / PARTICLE_STRIDE) | 0);
  for (let p = 0; p < n; p++) {
    if (shard.view[p * PARTICLE_STRIDE + S.DEAD] === 0) alive++;
  }
  return alive;
}

/** Roll the alive-count window (cap ALIVE_WINDOW_SIZE) and update prevAlive. */
function updateShardWindow(shard) {
  const alive = countAlive(shard);
  if (!shard.aliveWindow) shard.aliveWindow = [];
  shard.aliveWindow.push(alive);
  if (shard.aliveWindow.length > ALIVE_WINDOW_SIZE) shard.aliveWindow.shift();
  shard.prevAlive = alive;
}

/** Build a metrics-compatible shard view from a snapshot (for follow-mode). */
function shardFromSnapshot(snap) {
  return {
    view: snap.view,
    dna: snap.dna,
    sourceDna: snap.sourceDna,
    count: snap.count,
    speciesCount: snap.speciesCount,
    maxCount: snap.maxCount,
    aliveWindow: snap.aliveWindow,
    prevAlive: snap.prevAlive,
  };
}

/**
 * Raw fitness metrics for one shard. All values are bounded: rates are
 * normalized (0-1), means are plain averages over living particles, and
 * novelty is a 0-1 normalized mean genome distance vs the source DNA.
 */
export function computeShardMetrics(shard, worldSize = WORLD_SIZE) {
  const out = {
    population: 0,
    growth: 0,
    longevity: 0,
    stability: 1,
    energy: 0,
    reserves: 0,
    armor: 0,
    mobility: 0,
    signal: 0,
    bonds: 0,
    diversity: 0,
    exploration: 0,
    novelty: 0,
  };
  if (!shard || !shard.view) return out;
  const n = Math.min(shard.count || 0, (shard.view.length / PARTICLE_STRIDE) | 0);
  const binSize = Math.max(1, worldSize / EXPLORATION_BINS);
  const binCount = EXPLORATION_BINS ** 3;
  const bins = new Array(binCount).fill(0);
  const speciesCounts = new Map();
  let alive = 0;
  let ageSum = 0;
  let energySum = 0;
  let reservesSum = 0;
  let armorSum = 0;
  let mobilitySum = 0;
  let signalSum = 0;
  let bondsSum = 0;
  for (let p = 0; p < n; p++) {
    const b = p * PARTICLE_STRIDE;
    if (shard.view[b + S.DEAD] >= 0.5) continue;
    alive++;
    ageSum += shard.view[b + S.AGE] || 0;
    energySum += shard.view[b + S.ENERGY] || 0;
    reservesSum += shard.view[b + S.STORED_ENERGY] || 0;
    armorSum += shard.view[b + S.ARMOR] || 0;
    mobilitySum += Math.hypot(
      shard.view[b + S.VEL_X] || 0,
      shard.view[b + S.VEL_Y] || 0,
      shard.view[b + S.VEL_Z] || 0,
    );
    signalSum += shard.view[b + S.SIGNAL] || 0;
    bondsSum += shard.view[b + S.BOND_COUNT] || 0;
    const sp = shard.view[b + S.SPECIES_ID] | 0;
    speciesCounts.set(sp, (speciesCounts.get(sp) || 0) + 1);
    const bx = Math.max(0, Math.min(EXPLORATION_BINS - 1, Math.floor(shard.view[b + S.POS_X] / binSize)));
    const by = Math.max(0, Math.min(EXPLORATION_BINS - 1, Math.floor(shard.view[b + S.POS_Y] / binSize)));
    const bz = Math.max(0, Math.min(EXPLORATION_BINS - 1, Math.floor(shard.view[b + S.POS_Z] / binSize)));
    bins[bx * EXPLORATION_BINS * EXPLORATION_BINS + by * EXPLORATION_BINS + bz]++;
  }
  out.population = alive;
  out.growth = alive - (Number.isFinite(shard.prevAlive) ? shard.prevAlive : alive);
  if (alive > 0) {
    out.longevity = ageSum / alive;
    out.energy = energySum / alive;
    out.reserves = reservesSum / alive;
    out.armor = armorSum / alive;
    out.mobility = mobilitySum / alive;
    out.signal = signalSum / alive;
    out.bonds = bondsSum / alive;
    // Shannon evenness over the species present (J = H / ln(S)). A shard
    // holding a single species is a monoculture — not diverse — so it scores 0.
    const counts = [...speciesCounts.values()];
    if (counts.length > 1) {
      let h = 0;
      for (const c of counts) {
        const p = c / alive;
        h -= p * Math.log(p);
      }
      out.diversity = h / Math.log(counts.length);
    } else {
      out.diversity = 0;
    }
    // Spatial entropy over the 4×4×4 occupancy grid, normalized by ln(bins).
    let e = 0;
    for (const c of bins) {
      if (c > 0) {
        const p = c / alive;
        e -= p * Math.log(p);
      }
    }
    out.exploration = e / Math.log(binCount);
  }
  // Novelty: mean normalized genome distance vs the shard's source DNA.
  if (shard.dna && shard.sourceDna) {
    const spStride = 64;
    const spCount = Math.min(Math.max(1, shard.speciesCount || 1), 64);
    let sum = 0;
    for (let sp = 0; sp < spCount; sp++) {
      const base = sp * spStride;
      for (let p = 0; p < spStride; p++) {
        sum += Math.abs((shard.dna[base + p] || 0) - (shard.sourceDna[base + p] || 0));
      }
    }
    out.novelty = sum / (spCount * spStride * 65535);
  }
  // Stability: 1 - coefficient-of-variation² of the alive window (0-1).
  const win = shard.aliveWindow && shard.aliveWindow.length ? shard.aliveWindow : [alive];
  const mean = win.reduce((a, b) => a + b, 0) / win.length;
  if (win.length > 1 && mean > 0) {
    let variance = 0;
    for (const c of win) variance += (c - mean) * (c - mean);
    variance /= win.length;
    out.stability = Math.max(0, Math.min(1, 1 - variance / (mean * mean)));
  }
  return out;
}

/**
 * Full fitness report: min-max normalizes the 13 base metrics across shards,
 * applies fitness modes (min → 1−norm), derives the per-shard DELTA metric
 * (mean deviation from the other shards), and computes the weighted composite.
 * PURE — reading the report never mutates controller state: the rolling
 * delta window is only written by recordDelta() (once per tick/iteration),
 * and the cross-generation bounds only by updateRunningBounds().
 */
export function getFitnessReport(mx) {
  const shards = mx.shards || [];
  const worldSize = mx.worldSize || WORLD_SIZE;
  const raw = shards.map((shard) => ({
    id: shard.id,
    metrics: computeShardMetrics(shard, worldSize),
  }));
  const weights = (mx.config && mx.config.fitnessWeights) || MULTIPLEX_DEFAULTS.fitnessWeights;
  const modes = (mx.config && mx.config.fitnessModes) || MULTIPLEX_DEFAULTS.fitnessModes;

  // Snapshot the raw (pre-normalization) values before the in-place
  // normalization below — they feed the stable cross-generation rawFitness.
  for (const r of raw) r.rawMetrics = { ...r.metrics };

  // Min-max normalize + mode flip on the base metrics. Zero span (one shard,
  // or all shards identical) normalizes to 1 — the shard is both the min and
  // the max — so a lone shard scores its full weight instead of collapsing
  // every composite to 0 and disabling fittest selection.
  for (const key of BASE_FITNESS_METRICS) {
    let min = Infinity;
    let max = -Infinity;
    for (const r of raw) {
      const v = r.metrics[key];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const span = max - min;
    const mode = modes[key];
    for (const r of raw) {
      const norm = span === 0 ? 1 : (r.metrics[key] - min) / span;
      r.metrics[key] = mode === 'min' ? 1 - norm : norm;
    }
  }

  // Delta: mean |score − mean(other shards)| over the base metrics. A shard
  // with no peers (single-shard grid) has zero divergence from "others".
  // r.rawDelta feeds the avgDelta stat (mean raw divergence across shards);
  // r.metrics.delta is the min-max normalized form used by the weight.
  for (const r of raw) {
    let sum = 0;
    for (const key of BASE_FITNESS_METRICS) {
      let others = 0;
      let cnt = 0;
      for (const o of raw) {
        if (o === r) continue;
        others += o.metrics[key];
        cnt++;
      }
      const meanOthers = cnt ? others / cnt : r.metrics[key];
      sum += Math.abs(r.metrics[key] - meanOthers);
    }
    r.rawDelta = sum / BASE_FITNESS_METRICS.length;
  }
  {
    let min = Infinity;
    let max = -Infinity;
    for (const r of raw) {
      const v = r.rawDelta;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const span = max - min;
    const mode = modes.delta;
    for (const r of raw) {
      // Zero span means no divergence at all — normalized delta is 0, not 1
      // (unlike the base metrics, where the lone shard IS both min and max).
      const norm = span === 0 ? 0 : (r.rawDelta - min) / span;
      r.metrics.delta = mode === 'min' ? 1 - norm : norm;
    }
  }

  // Weighted composite (falls back to population when all weights are 0).
  const weightSum = FITNESS_METRICS.reduce(
    (a, key) => a + Math.max(0, parseFloat(weights[key]) || 0),
    0,
  );
  const bounds = mx.runningBounds || null;
  const perShard = raw.map((r) => {
    let fitness;
    if (weightSum > 0) {
      fitness = FITNESS_METRICS.reduce(
        (a, key) => a + Math.max(0, parseFloat(weights[key]) || 0) * (r.metrics[key] || 0),
        0,
      ) / weightSum;
    } else {
      fitness = r.metrics.population || 0;
    }
    // Stable cross-generation score: raw base metrics normalized against the
    // running min/max bounds accumulated by updateRunningBounds (null on the
    // first generation → falls back to the within-generation normalization,
    // so rawFitness === fitness until bounds exist). DELTA stays derived.
    let rawFitness;
    if (weightSum > 0) {
      rawFitness = FITNESS_METRICS.reduce((a, key) => {
        const w = Math.max(0, parseFloat(weights[key]) || 0);
        if (w === 0) return a;
        let v;
        if (key === 'delta') {
          v = r.metrics.delta || 0;
        } else if (bounds && Number.isFinite(bounds.min[key]) && Number.isFinite(bounds.max[key])) {
          const span = bounds.max[key] - bounds.min[key];
          const norm = span <= 0 ? 1 : (r.rawMetrics[key] - bounds.min[key]) / span;
          v = modes[key] === 'min' ? 1 - norm : norm;
        } else {
          v = r.metrics[key] || 0;
        }
        return a + w * v;
      }, 0) / weightSum;
    } else {
      rawFitness = r.rawMetrics.population || 0;
    }
    return { id: r.id, fitness, rawFitness, rawMetrics: r.rawMetrics, metrics: r.metrics };
  });

  // avgDelta is the mean RAW divergence across shards — the per-generation
  // spread readout — not the normalized ranking form.
  const avgDelta = raw.length
    ? raw.reduce((a, e) => a + e.rawDelta, 0) / raw.length
    : 0;
  return { perShard, avgDelta, rollingDelta: (mx.deltaHistory || []).slice() };
}

/**
 * Append the current avg-delta to mx.deltaHistory (cap ALIVE_WINDOW_SIZE).
 * This is the ONLY writer to the rolling window — call it once per step and
 * once per iteration, never from per-frame display code.
 * @param {object} mx
 * @returns {number} the recorded avg delta
 */
export function recordDelta(mx) {
  const report = getFitnessReport(mx);
  mx.deltaHistory = mx.deltaHistory || [];
  mx.deltaHistory.push(report.avgDelta);
  if (mx.deltaHistory.length > ALIVE_WINDOW_SIZE) mx.deltaHistory.shift();
  return report.avgDelta;
}

/**
 * Expand the cross-generation running bounds from one generation's raw
 * metrics (called once per iteration, after the report is computed). The
 * bounds make rawFitness comparable across generations: a score of 0.9 in
 * generation 1 and generation 9 means the same thing.
 * @param {object} mx
 * @param {object} report - output of getFitnessReport
 */
export function updateRunningBounds(mx, report) {
  const entries = report && report.perShard;
  if (!entries || !entries.length) return;
  mx.runningBounds = mx.runningBounds || { min: {}, max: {} };
  for (const key of BASE_FITNESS_METRICS) {
    for (const entry of entries) {
      const v = entry.rawMetrics ? entry.rawMetrics[key] : 0;
      if (!Number.isFinite(mx.runningBounds.min[key]) || v < mx.runningBounds.min[key]) {
        mx.runningBounds.min[key] = v;
      }
      if (!Number.isFinite(mx.runningBounds.max[key]) || v > mx.runningBounds.max[key]) {
        mx.runningBounds.max[key] = v;
      }
    }
  }
}

/**
 * Record per-generation progress on the stable composite: best-so-far
 * fitness, the generation that produced it, and a stagnation counter that
 * increments whenever a generation fails to beat the best. `limit` is the
 * stagnationLimit config (0 disables convergence detection).
 * @returns {{bestFitness: number, bestIteration: number,
 *   stagnantGenerations: number, improved: boolean, stagnant: boolean}}
 */
export function trackGenerationProgress(mx, report, limit) {
  let best = -Infinity;
  for (const entry of report.perShard) {
    if (entry.rawFitness > best) best = entry.rawFitness;
  }
  const improved = mx.bestFitness == null || best > mx.bestFitness + 1e-9;
  if (improved) {
    mx.bestFitness = best;
    mx.bestIteration = mx.iteration;
    mx.stagnantGenerations = 0;
  } else {
    mx.stagnantGenerations = (mx.stagnantGenerations || 0) + 1;
  }
  return {
    bestFitness: mx.bestFitness,
    bestIteration: mx.bestIteration,
    stagnantGenerations: mx.stagnantGenerations,
    improved,
    stagnant: limit > 0 && mx.stagnantGenerations >= limit,
  };
}

/**
 * Per-metric shard comparison matrix for the COMPARE tab. Pure: rows = the
 * 13 RAW base metrics (delta is derived, not a comparable measurement),
 * columns = shards, values are the RAW (un-normalized) metrics so the table
 * shows real magnitudes. The best cell per row is flagged (highest for 'max'
 * mode, lowest for 'min' mode) so a glance shows which shard leads on each
 * axis.
 * @returns {{rows: Array<{key: string, mode: string, values: number[],
 *   bestId: number, bestValue: number}>, shardIds: number[]}}
 */
export function compareShards(mx) {
  const shards = mx.shards || [];
  const worldSize = mx.worldSize || WORLD_SIZE;
  const modes = (mx.config && mx.config.fitnessModes) || MULTIPLEX_DEFAULTS.fitnessModes;
  const raw = shards.map((shard) => ({
    id: shard.id,
    metrics: computeShardMetrics(shard, worldSize),
  }));
  const rows = BASE_FITNESS_METRICS.map((key) => {
    const mode = modes[key] === 'min' ? 'min' : 'max';
    let bestId = -1;
    let bestValue = mode === 'min' ? Infinity : -Infinity;
    for (const r of raw) {
      const v = r.metrics[key];
      if ((mode === 'min' && v < bestValue) || (mode === 'max' && v > bestValue)) {
        bestValue = v;
        bestId = r.id;
      }
    }
    return {
      key,
      mode,
      values: raw.map((r) => r.metrics[key]),
      bestId,
      bestValue: bestId >= 0 ? bestValue : 0,
    };
  });
  // PARAMS — how many world-param knobs each shard has drifted from the world
  // the multiplex was derived from. Informational (no best cell): it answers
  // "how far is this shard's physics regime from the world I configured".
  const baseParams = mx.baseWorldParams || {};
  rows.push({
    key: 'params',
    mode: 'info',
    values: raw.map((r) => {
      const shard = shards[r.id];
      if (!shard || !shard.worldParams) return 0;
      let diff = 0;
      for (const k of Object.keys(baseParams)) {
        if (shard.worldParams[k] !== baseParams[k]) diff++;
      }
      return diff;
    }),
    bestId: -1,
    bestValue: 0,
  });
  return { rows, shardIds: raw.map((r) => r.id) };
}

/** Full snapshot of a shard's view, DNA, laws, PRNG and counters. */
export function snapshotShard(shard) {
  const live = Math.max(0, Math.min(shard.count || 0, (shard.view.length / PARTICLE_STRIDE) | 0));
  return {
    view: shard.view.subarray(0, live * PARTICLE_STRIDE).slice(),
    dna: shard.dna ? shard.dna.slice() : null,
    sourceDna: shard.sourceDna ? shard.sourceDna.slice() : null,
    laws: {
      lowFlags: shard.laws ? shard.laws.lowFlags[0] : 0,
      highFlags: shard.laws ? shard.laws.highFlags[0] : 0,
      extFlags: shard.laws && shard.laws.extFlags ? shard.laws.extFlags[0] : 0,
      quadFlags: shard.laws && shard.laws.quadFlags ? shard.laws.quadFlags[0] : 0,
    },
    prngState: shard.prng ? shard.prng.state | 0 : 0,
    count: shard.count,
    speciesCount: shard.speciesCount,
    maxCount: shard.maxCount,
    tick: shard.tick,
    offspring: shard.offspring || 0,
    aliveWindow: shard.aliveWindow ? shard.aliveWindow.slice() : [],
    prevAlive: shard.prevAlive,
    worldParams: shard.worldParams ? { ...shard.worldParams } : null,
  };
}

/** Restore a snapshot onto a (freshly built) shard — keep-selected anchor. */
export function restoreShard(shard, snap) {
  if (!shard || !snap) return;
  shard.view.fill(0);
  shard.view.set(snap.view);
  if (shard.dna && snap.dna) shard.dna.set(snap.dna);
  if (shard.sourceDna && snap.sourceDna) shard.sourceDna.set(snap.sourceDna);
  if (shard.laws && snap.laws) {
    shard.laws.lowFlags[0] = snap.laws.lowFlags;
    shard.laws.highFlags[0] = snap.laws.highFlags;
    if (shard.laws.extFlags) shard.laws.extFlags[0] = snap.laws.extFlags;
    if (shard.laws.quadFlags) shard.laws.quadFlags[0] = snap.laws.quadFlags;
  }
  if (shard.prng) shard.prng.state = snap.prngState | 0;
  shard.count = snap.count;
  shard.speciesCount = snap.speciesCount;
  shard.maxCount = snap.maxCount;
  shard.tick = snap.tick;
  shard.offspring = snap.offspring;
  shard.aliveWindow = snap.aliveWindow ? snap.aliveWindow.slice() : [];
  shard.prevAlive = snap.prevAlive;
  if (snap.worldParams) shard.worldParams = { ...snap.worldParams };
}

/**
 * Record the current on-screen grid state into mx.history (capped at
 * config.historyDepth). Every entry stores the generation's config + best
 * bookkeeping, a light per-shard record (DNA/laws — enough to rebuild the
 * lineage) and FULL snapshots of the selected + fittest shards (enough to
 * revert their exact evolved state). The revert action is itself recorded,
 * so every revert is undoable.
 */
function recordHistory(mx, report) {
  const depth = Math.max(1, Math.min(12, Math.round(mx.config && mx.config.historyDepth) || 6));
  const entry = {
    generation: mx.iteration,
    config: {
      ...mx.config,
      fitnessWeights: { ...(mx.config && mx.config.fitnessWeights) },
      fitnessModes: { ...(mx.config && mx.config.fitnessModes) },
    },
    bestFitness: mx.bestFitness,
    bestIteration: mx.bestIteration,
    stagnantGenerations: mx.stagnantGenerations || 0,
    selected: mx.selected,
    shards: mx.shards.map(lightRecord),
    snapshots: {},
  };
  const fittest = fittestFromReport(report);
  const snapIds = new Set([mx.selected]);
  if (fittest >= 0) snapIds.add(fittest);
  for (const id of snapIds) {
    if (mx.shards[id]) entry.snapshots[id] = snapshotShard(mx.shards[id]);
  }
  mx.history.push(entry);
  if (mx.history.length > depth) mx.history.splice(0, mx.history.length - depth);
}

/** Compact per-shard lineage record: DNA, law flags, species, population. */
function lightRecord(shard) {
  return {
    id: shard.id,
    dna: Array.from(shard.dna),
    laws: {
      low: shard.laws.lowFlags[0] || 0,
      high: shard.laws.highFlags[0] || 0,
      ext: shard.laws.extFlags[0] || 0,
      quad: shard.laws.quadFlags[0] || 0,
    },
    speciesCount: shard.speciesCount || 5,
    count: shard.count || 0,
    worldParams: shard.worldParams ? { ...shard.worldParams } : null,
  };
}

/** Highest-fitness shard id from a report (or -1). */
function fittestFromReport(report) {
  if (!report || !report.perShard || !report.perShard.length) return -1;
  let bestId = -1;
  let bestFitness = -Infinity;
  for (const entry of report.perShard) {
    if (entry.fitness > bestFitness) {
      bestFitness = entry.fitness;
      bestId = entry.id;
    }
  }
  return bestId;
}

/**
 * Snapshot the top-N shards by stable rawFitness before a rebuild so their
 * evolved state can be restored afterwards (elitism). Returns [{ id, snap }].
 */
function buildEliteSnapshots(mx, report, keepIndex, keepSelected, eliteCount) {
  const n = Math.max(0, Math.min(4, Math.round(parseFloat(eliteCount) || 0)));
  if (n === 0) return [];
  const ranked = report.perShard
    .filter((e) => !(keepSelected && e.id === keepIndex))
    .slice()
    .sort((a, b) => b.rawFitness - a.rawFitness)
    .slice(0, n);
  return ranked.map((e) => ({ id: e.id, snap: snapshotShard(mx.shards[e.id]) }));
}

/**
 * Rebuild the grid from a recorded generation (see recordHistory). The
 * current state is recorded first, so the revert itself is undoable. Full
 * particle state is restored for the shards that carry full snapshots
 * (selected + fittest at record time); every other shard is re-spawned from
 * its recorded DNA/laws/world params — comparison futures are re-rolled from
 * the lineage, which keeps history memory-bounded.
 * @param {object} mx
 * @param {number} generation - history entry generation to restore
 * @returns {boolean} whether a matching generation was found and restored
 */
export function revertMultiplex(mx, generation) {
  if (!mx.active || !mx.shards.length) return false;
  const entry = mx.history.find((h) => h.generation === generation);
  if (!entry) return false;
  // The current grid state becomes a history entry, so reverting is undoable.
  recordHistory(mx, getFitnessReport(mx));
  mx.config = {
    ...mx.config,
    ...entry.config,
    fitnessWeights: { ...entry.config.fitnessWeights },
    fitnessModes: { ...entry.config.fitnessModes },
  };
  mx.iteration = entry.generation;
  mx.bestFitness = entry.bestFitness;
  mx.bestIteration = entry.bestIteration;
  mx.stagnantGenerations = entry.stagnantGenerations;
  mx.stagnantPaused = false;
  mx.runningBounds = null;
  mx.currentInterval = null;
  rebuildFromRecords(mx, entry);
  selectShard(mx, Math.min(entry.selected, mx.shards.length - 1));
  if (mx.bus) mx.bus.emit('multiplex:reverted', { generation: mx.iteration });
  return true;
}

/** Rebuild mx.shards from a history entry's per-shard lineage records. */
function rebuildFromRecords(mx, entry) {
  const old = mx.shards;
  mx.shards = [];
  const total = Math.max(1, Math.min(MAX_SHARDS, entry.shards.length));
  mx.populationCap = computeShardPopulationCap(total, mx.config.populationScale);
  // Re-roll comparison futures from the recorded lineage: the record already
  // encodes that generation's variety, so no fresh randomization is applied.
  const spawnConfig = {
    ...mx.config,
    deriveMode: 'spawn',
    variation: 0,
    randomizeLaws: false,
    randomizeDNA: false,
    randomizePopulation: false,
    randomizeParams: false,
  };
  for (const rec of entry.shards) {
    const seed = ((mx.sourceSeed + rec.id * 104729) & 0x7fffffff) | 0;
    const prev = old[rec.id];
    const recycle = prev ? prev : null;
    const shard = createShard(rec.id, seed, sourceFromRecord(rec), { ...spawnConfig, spawnSpecies: rec.speciesCount }, mx.populationCap, recycle);
    // Reuse the DOM cell when the grid layout is unchanged.
    if (prev) {
      shard.wrapper = prev.wrapper;
      shard.canvas = prev.canvas;
      shard.renderer = prev.renderer;
    }
    mx.shards.push(shard);
  }
  // Tear down surplus cells from a previously larger grid.
  for (let i = total; i < old.length; i++) {
    if (old[i].wrapper && old[i].wrapper.parentNode) {
      old[i].wrapper.parentNode.removeChild(old[i].wrapper);
    }
  }
  // Restore exact evolved state where full snapshots exist (count-safe).
  for (const key of Object.keys(entry.snapshots || {})) {
    const id = Number(key);
    const shard = mx.shards[id];
    const snap = entry.snapshots[id];
    if (shard && snap && snap.count <= shard.maxCount) {
      restoreShard(shard, snap);
    }
  }
  mx.selected = Math.min(mx.selected, mx.shards.length - 1);
  mountShards(mx);
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => resizeMultiplex(mx));
  }
}

/** Synthesize a createShard source from a history light record. */
function sourceFromRecord(rec) {
  const laws = createLawState();
  laws.lowFlags[0] = rec.laws.low || 0;
  laws.highFlags[0] = rec.laws.high || 0;
  laws.extFlags[0] = rec.laws.ext || 0;
  laws.quadFlags[0] = rec.laws.quad || 0;
  const dna = createDNABuffer();
  dna.set(rec.dna || []);
  return {
    view: new Float32Array(0),
    count: 0,
    dna,
    laws,
    speciesCount: rec.speciesCount || 5,
    worldParams: rec.worldParams ? { ...rec.worldParams } : null,
  };
}

/**
 * Copy a shard into the main world buffers. Returns the imported population
 * so the caller can sync particle/species counts and downstream systems.
 */
export function copyShardToWorld(shard, target) {
  const count = Math.max(0, Math.min(shard.count || 0, MAX_PARTICLES));
  target.view.fill(0);
  if (count > 0) target.view.set(shard.view.subarray(0, count * PARTICLE_STRIDE));
  if (target.dna && shard.dna) target.dna.set(shard.dna);
  if (target.laws && shard.laws) {
    target.laws.lowFlags[0] = shard.laws.lowFlags[0];
    target.laws.highFlags[0] = shard.laws.highFlags[0];
    if (target.laws.extFlags && shard.laws.extFlags) target.laws.extFlags[0] = shard.laws.extFlags[0];
    if (target.laws.quadFlags && shard.laws.quadFlags) target.laws.quadFlags[0] = shard.laws.quadFlags[0];
  }
  return { count, speciesCount: shard.speciesCount || 5 };
}

/** Render every shard to its canvas (shared camera). */
export function renderMultiplex(mx, worldSize) {
  const eco = (mx.config && mx.config.renderQuality) !== 'full';
  for (const shard of mx.shards) {
    if (!shard.renderer) continue;
    if (shard.count > 0) {
      // Pass the typed view (zero-copy) + eco flags for the preview canvases.
      shard.renderer.eco = eco;
      renderFrame(shard.renderer, shard.view, shard.count, PARTICLE_STRIDE, worldSize, { eco });
    } else {
      const { ctx, width, height } = shard.renderer;
      ctx.clearRect(0, 0, width, height);
    }
  }
}

/** Re-measure every shard canvas (call after layout changes). */
export function resizeMultiplex(mx) {
  for (const shard of mx.shards) {
    if (shard.renderer) resizeRenderer(shard.renderer);
  }
}

/** Select a shard by index and surface the selection box. */
export function selectShard(mx, index) {
  if (!mx.shards.length) return;
  mx.selected = Math.max(0, Math.min(index, mx.shards.length - 1));
  for (let i = 0; i < mx.shards.length; i++) {
    if (mx.shards[i].wrapper) {
      mx.shards[i].wrapper.classList.toggle('selected', i === mx.selected);
    }
  }
  if (mx.bus) mx.bus.emit('multiplex:selected', { index: mx.selected, total: mx.shards.length });
}

// ── Shard construction ──────────────────────────────────────────────────────

function buildShards(mx, source, fromShard) {
  let { cols, rows } = mx.config;
  cols = Math.max(1, Math.min(4, Math.round(cols) || 1));
  rows = Math.max(1, Math.min(4, Math.round(rows) || 1));
  mx.config.cols = cols;
  mx.config.rows = rows;
  const total = Math.max(1, Math.min(MAX_SHARDS, cols * rows));
  mx.populationCap = computeShardPopulationCap(total, mx.config.populationScale);

  const old = mx.shards;
  mx.shards = [];

  for (let i = 0; i < total; i++) {
    const seed = ((mx.sourceSeed + i * 104729) & 0x7fffffff) | 0;
    // Reuse the previous shard's buffers when the grid layout is unchanged —
    // avoids allocating a fresh 1 MB SharedArrayBuffer per shard on every
    // iterate, which churns the GC and stalls the tab under auto-iterate.
    // The iteration source itself must keep a fresh buffer: later shards
    // derive from its data during construction.
    const prev = old[i];
    const recycle = prev && prev !== source ? prev : null;
    const shard = createShard(i, seed, source, mx.config, mx.populationCap, recycle);
    // Reuse the DOM cell when the grid layout is unchanged so canvases,
    // renderers, and the selection box survive iteration.
    if (prev) {
      shard.wrapper = prev.wrapper;
      shard.canvas = prev.canvas;
      shard.renderer = prev.renderer;
    }
    mx.shards.push(shard);
  }

  // Tear down surplus cells from a previously larger grid.
  for (let i = total; i < old.length; i++) {
    if (old[i].wrapper && old[i].wrapper.parentNode) {
      old[i].wrapper.parentNode.removeChild(old[i].wrapper);
    }
  }

  mx.selected = Math.min(mx.selected, total - 1);
  mountShards(mx);
  selectShard(mx, mx.selected);

  // First mount: canvases only get real dimensions after a layout pass.
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => resizeMultiplex(mx));
  }
  void fromShard;
}

function createShard(index, seed, source, config, maxCount, recycle) {
  const buf = recycle && recycle.buffer && recycle.view
    ? { buffer: recycle.buffer, view: recycle.view }
    : createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const dna = recycle && recycle.dna ? recycle.dna : createDNABuffer();
  dna.set(source.dna.subarray ? source.dna.subarray(0, dna.length) : source.dna);

  const laws = recycle && recycle.laws ? recycle.laws : createLawState();
  laws.lowFlags[0] = source.laws.lowFlags[0];
  laws.highFlags[0] = source.laws.highFlags[0];
  laws.extFlags[0] = source.laws.extFlags[0] || 0;
  laws.quadFlags[0] = source.laws.quadFlags[0] || 0;

  const prng = new SplitMix32(seed);
  // World params: derived from the source shard when it has them (evolutionary
  // continuity across iterations), else the live WORLD panel state, else fresh
  // defaults. Perturbed per-shard by applyVariation, then swapped into the
  // runtimeConfig singleton during stepMultiplex so each shard solves under its
  // own law-tuning knobs.
  const sourceParams =
    (source && source.worldParams) ||
    runtimeConfig.worldParams ||
    createWorldParams();
  // SPAWN MODE builds a fresh population from config.spawnSpecies species
  // (clamped 1-5); CLONE mode inherits the source's species count.
  const spawnSpecies = Math.max(1, Math.min(5, Math.round(config.spawnSpecies) || 5));
  const fitnessWindow = Math.max(8, Math.min(128, Math.round(config.fitnessWindow) || ALIVE_WINDOW_SIZE));
  const shard = {
    id: index,
    buffer: buf.buffer,
    view: buf.view,
    dna,
    sourceDna: dna.slice(), // pre-variation genome this shard derived from
    laws,
    prng,
    worldParams: { ...sourceParams },
    maxCount,
    count: Math.min(source.count || 0, maxCount),
    speciesCount: config.deriveMode === 'spawn' ? spawnSpecies : (source.speciesCount || 5),
    aliveWindowSize: fitnessWindow,
    tick: 0,
    offspring: 0,
    aliveWindow: [],
    prevAlive: 0,
    deadSlots: [],
    canvas: null,
    wrapper: null,
    renderer: null,
    // Set A.3 — shards evolve species independently (silent engine: no bus
    // emissions / roster growth; fitness sees species count via metrics).
    speciation: createSpeciationEngine(null, { prng: () => prng.next() }),
  };

  if (config.deriveMode === 'spawn') {
    spawnShardPopulation(shard);
  } else {
    shard.view.fill(0);
    if (shard.count > 0) {
      shard.view.set(source.view.subarray(0, shard.count * PARTICLE_STRIDE));
    }
  }
  applyVariation(shard, config);
  shard.prevAlive = countAlive(shard);
  shard.aliveWindow = [shard.prevAlive];
  return shard;
}

function applyVariation(shard, config) {
  const v = config.variation || 0;
  if (v <= 0) return;
  const prng = shard.prng;
  // Per-aspect multipliers (0 blocks that aspect entirely, 1 = master knob).
  const aspect = (x) => {
    const n = parseFloat(x);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
  };
  const lawV = aspect(config.lawVariation);
  const dnaV = aspect(config.dnaVariation);
  const popV = aspect(config.popVariation);

  if (config.randomizeLaws && lawV > 0) {
    for (let l = 0; l < LAW_COUNT; l++) {
      if (prng.next() < v * lawV * 0.5) {
        if (l < 32) shard.laws.lowFlags[0] ^= (1 << l);
        else if (l < 64) shard.laws.highFlags[0] ^= (1 << (l - 32));
        else if (l < 96) shard.laws.extFlags[0] ^= (1 << (l - 64));
        else shard.laws.quadFlags[0] ^= (1 << (l - 96));
      }
    }
  }

  if (config.randomizeDNA) {
    const spCount = Math.min(shard.speciesCount, 64);
    for (let s = 0; s < spCount; s++) {
      for (let p = 0; p < 42; p++) {
        if (prng.next() < v * dnaV * 0.35) {
          const r = DNA_RANGES[p] || { min: 0, max: 1 };
          const span = r.max - r.min;
          const cur = getDNAFloat(shard.dna, s, p, r.min, r.max);
          const next = Math.max(r.min, Math.min(r.max, cur + (prng.next() - 0.5) * 2 * v * dnaV * span));
          setDNAFloat(shard.dna, s, p, next, r.min, r.max);
        }
      }
    }
  }

  if (config.randomizePopulation && popV > 0) {
    for (let i = 0; i < shard.count; i++) {
      const b = i * PARTICLE_STRIDE;
      shard.view[b + S.POS_X] += (prng.next() - 0.5) * WORLD_SIZE * 0.03 * v * popV;
      shard.view[b + S.POS_Y] += (prng.next() - 0.5) * WORLD_SIZE * 0.03 * v * popV;
      shard.view[b + S.POS_Z] += (prng.next() - 0.5) * WORLD_SIZE * 0.03 * v * popV;
      shard.view[b + S.VEL_X] += (prng.next() - 0.5) * 0.2 * v * popV;
      shard.view[b + S.VEL_Y] += (prng.next() - 0.5) * 0.2 * v * popV;
      shard.view[b + S.VEL_Z] += (prng.next() - 0.5) * 0.2 * v * popV;
    }
  }

  // World-param variation: perturb the law-tuning knobs (relative to their
  // current value, clamped to each def's range) so shards explore different
  // parameter regimes — not just different laws/DNA/population.
  const paramV = config.paramVariation === undefined ? 0 : aspect(config.paramVariation);
  if (config.randomizeParams !== false && paramV > 0 && shard.worldParams) {
    const keys = Object.keys(shard.worldParams);
    for (const key of keys) {
      if (prng.next() < v * paramV * 0.35) {
        const cur = shard.worldParams[key];
        const span = Math.max(Math.abs(cur) * 0.5, 0.05);
        shard.worldParams[key] = clampWorldParam(key, cur + (prng.next() - 0.5) * 2 * span);
      }
    }
  }
}

/** Fresh population for a shard (mirrors the default grid spawn). */
function spawnShardPopulation(shard) {
  shard.view.fill(0);
  const species = Math.min(shard.speciesCount || 5, 64);
  // Balance species evenly when the dynamic cap is below the default spawn.
  const perSpecies = Math.max(1, Math.floor(shard.maxCount / species));
  const gridDim = Math.max(2, Math.ceil(Math.cbrt(perSpecies)));
  const cellSize = (WORLD_SIZE - 10) / gridDim;
  let idx = 0;
  for (let s = 0; s < species; s++) {
    for (let i = 0; i < perSpecies && idx < shard.maxCount; i++) {
      const b = idx * PARTICLE_STRIDE;
      const gx = i % gridDim;
      const gy = Math.floor(i / gridDim) % gridDim;
      const gz = Math.floor(i / (gridDim * gridDim));
      const jx = (shard.prng.next() - 0.5) * cellSize * 0.4;
      const jy = (shard.prng.next() - 0.5) * cellSize * 0.4;
      const jz = (shard.prng.next() - 0.5) * cellSize * 0.4;
      shard.view[b + S.POS_X] = 5 + gx * cellSize + cellSize * 0.5 + jx;
      shard.view[b + S.POS_Y] = 5 + gy * cellSize + cellSize * 0.5 + jy;
      shard.view[b + S.POS_Z] = 5 + gz * cellSize + cellSize * 0.5 + jz;
      shard.view[b + S.MASS] = 1.0 + shard.prng.next();
      shard.view[b + S.SPECIES_ID] = s;
      shard.view[b + S.ENERGY] = 50 + shard.prng.next() * 50;
      shard.view[b + S.DEAD] = 0;
      shard.view[b + S.AGE] = 0;
      const col = SHARD_SPECIES_COLORS[s % SHARD_SPECIES_COLORS.length];
      shard.view[b + S.COLOR_R] = col[0];
      shard.view[b + S.COLOR_G] = col[1];
      shard.view[b + S.COLOR_B] = col[2];
      for (let d = 0; d < 42; d++) {
        const r = DNA_RANGES[d] || { min: -1, max: 1 };
        shard.view[b + S.DNA_CACHE_START + d] =
          getDNAFloat(shard.dna, s, d, r.min, r.max);
      }
      shard.view[b + S.ELECTRIC_ENERGY] = 0;
      shard.view[b + S.STORED_ENERGY] = 0;
      shard.view[b + S.REPRO_DRIVE] = 0;
      shard.view[b + S.RADIATION_EXPOSURE] = 0;
      shard.view[b + S.ENTANGLE_ID] = -1;
      shard.view[b + S.ENTANGLE_PHASE] = 0;
      idx++;
    }
  }
  shard.count = idx;
}

/**
 * Rebuild the freelist of fully-dead slots (DEAD >= 1 or zero-mass) so new
 * offspring recycle them instead of growing shard.count toward maxCount.
 * Souls (DEAD = 0.5) are never recycled — ASTRAL still governs them.
 */
function collectDeadSlots(shard) {
  const n = Math.min(shard.count || 0, (shard.view.length / PARTICLE_STRIDE) | 0);
  const list = [];
  for (let p = 0; p < n; p++) {
    const b = p * PARTICLE_STRIDE;
    const dead = shard.view[b + S.DEAD] || 0;
    if (dead >= 1.0 || (dead < 0.5 && (shard.view[b + S.MASS] || 0) <= 0)) list.push(p);
  }
  shard.deadSlots = list;
}

/** Append offspring produced by the last solve() into this shard's buffer. */
function spawnShardOffspring(shard) {
  const list = drainOffspring();
  for (const off of list) {
    // Recycle a fully-dead slot when one exists so shard.count tracks the
    // live population instead of climbing monotonically to maxCount.
    const dead = shard.deadSlots && shard.deadSlots.length ? shard.deadSlots.pop() : -1;
    if (dead < 0 && shard.count >= shard.maxCount) break;
    const b = (dead >= 0 ? dead : shard.count) * PARTICLE_STRIDE;
    shard.view[b + S.POS_X] = off.x;
    shard.view[b + S.POS_Y] = off.y;
    shard.view[b + S.POS_Z] = off.z || 0;
    shard.view[b + S.VEL_X] = off.vx || 0;
    shard.view[b + S.VEL_Y] = off.vy || 0;
    shard.view[b + S.VEL_Z] = off.vz || 0;
    shard.view[b + S.MASS] = off.mass || 1.0;
    shard.view[b + S.SPECIES_ID] = off.speciesId;
    shard.view[b + S.ENERGY] = off.energy || 60;
    if (off.dna && off.dna.length) {
      for (let d = 0; d < 42 && d < off.dna.length; d++) {
        shard.view[b + S.DNA_CACHE_START + d] = off.dna[d];
      }
    }
    shard.view[b + S.DEAD] = 0;
    shard.view[b + S.AGE] = 0;
    shard.view[b + S.SIGNAL] = 0;
    shard.view[b + S.MEMORY] = 0;
    shard.view[b + S.HUNGER] = 0;
    shard.view[b + S.ARMOR] = 0.2;
    shard.view[b + S.MITOSIS_TIMER] = 0;
    shard.view[b + S.PARTNER_ID] = -1;
    shard.view[b + S.BOND_COUNT] = 0;
    shard.view[b + S.BOND_PARTNER_1] = -1;
    shard.view[b + S.BOND_PARTNER_2] = -1;
      shard.view[b + S.BOND_PARTNER_3] = -1;
      shard.view[b + S.BOND_PARTNER_4] = -1;
      shard.view[b + S.BOND_PARTNER_5] = -1;
      shard.view[b + S.BOND_PARTNER_6] = -1;
    shard.view[b + S.TEMPERATURE] = 0.5;
    shard.view[b + S.CHARGE] = 0;
    shard.view[b + S.ELECTRIC_ENERGY] = 0;
    shard.view[b + S.STORED_ENERGY] = 0;
    shard.view[b + S.REPRO_DRIVE] = 0;
    shard.view[b + S.RADIATION_EXPOSURE] = 0;
    shard.view[b + S.ENTANGLE_ID] = -1;
    shard.view[b + S.ENTANGLE_PHASE] = 0;
    // Inherit the parents' intermediate colour when reproduction carried one
    shard.view[b + S.COLOR_R] = off.colorR != null ? Math.max(0, Math.min(255, off.colorR)) : 160;
    shard.view[b + S.COLOR_G] = off.colorG != null ? Math.max(0, Math.min(255, off.colorG)) : 160;
    shard.view[b + S.COLOR_B] = off.colorB != null ? Math.max(0, Math.min(255, off.colorB)) : 160;
    if (dead < 0) shard.count++;
    shard.offspring = (shard.offspring || 0) + 1;
  }
}

// ── DOM: grid + canvases ────────────────────────────────────────────────────

function mountShards(mx) {
  if (!mx.container) return;
  const { cols, rows } = mx.config;
  mx.container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  mx.container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

  for (const shard of mx.shards) {
    if (shard.wrapper) continue; // reused from a previous build

    const wrap = document.createElement('div');
    wrap.className = 'shard-cell';
    wrap.dataset.shardLabel = 'S' + String(shard.id + 1).padStart(2, '0');
    const canvas = document.createElement('canvas');
    canvas.className = 'shard-canvas';
    wrap.appendChild(canvas);
    mx.container.appendChild(wrap);

    shard.wrapper = wrap;
    shard.canvas = canvas;
    shard.renderer = createRenderer(canvas, MAX_PARTICLES, { maxDpr: 1.25, eco: true });
    // The camera module keeps a single shared camera object, so gestures on
    // any shard move every shard (and the main sim) simultaneously.
    initCamera(canvas, WORLD_SIZE);

    // Tap = select (drag gestures are handled by the shared camera).
    let downX = 0, downY = 0, downT = 0;
    canvas.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
    });
    canvas.addEventListener('pointerup', (e) => {
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (dx * dx + dy * dy < 64 && performance.now() - downT < 450) {
        selectShard(mx, shard.id);
      }
    });
  }

  if (!mx.onResize) {
    mx.onResize = () => resizeMultiplex(mx);
    window.addEventListener('resize', mx.onResize);
  }
}
