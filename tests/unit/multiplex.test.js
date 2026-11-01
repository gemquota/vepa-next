import { describe, it, expect } from 'vitest';
import {
  WORLD_SIZE,
  PARTICLE_STRIDE,
  MAX_PARTICLES,
  STRIDE_INDEXES,
  LAW_INDEXES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createDNABuffer } from '../../src/dna/dnaBuffer.js';
import { createLawState, set } from '../../src/state/lawState.js';
import { SplitMix32 } from '../../src/core/prng.js';
import { createWorldParams, WORLD_PARAM_DEFS } from '../../src/state/worldParams.js';
import { runtimeConfig } from '../../src/state/runtimeConfig.js';
import {
  createMultiplex,
  startMultiplex,
  stopMultiplex,
  iterateMultiplex,
  stepMultiplex,
  selectShard,
  selectFittestShard,
  selectFollowShard,
  snapshotShard,
  restoreShard,
  copyShardToWorld,
  computeShardPopulationCap,
  getFitnessReport,
  computeShardMetrics,
  recordDelta,
  updateRunningBounds,
  trackGenerationProgress,
  compareShards,
  revertMultiplex,
  MULTIPLEX_DEFAULTS,
  MIN_SHARD_POPULATION,
  ALIVE_WINDOW_SIZE,
  ADAPTIVE_INTERVAL_CAP,
  VARIATION_FLOOR,
} from '../../src/multiplex/multiplex.js';

const S = STRIDE_INDEXES;

/** Build a minimal source sim: 4 particles, 2 species, laws off. */
function makeSource(particleCount = 4, laws = null) {
  const { buffer, view } = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  view.fill(0);
  for (let i = 0; i < particleCount; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 100 + i * 10;
    view[b + S.POS_Y] = 200;
    view[b + S.POS_Z] = 300;
    view[b + S.MASS] = 1.5;
    view[b + S.SPECIES_ID] = i % 2;
    view[b + S.ENERGY] = 80;
    view[b + S.DEAD] = 0;
    view[b + S.DNA_CACHE_START] = 0.5;
  }
  const dna = createDNABuffer();
  const lawState = laws || createLawState();
  return { buffer, view, count: particleCount, dna, laws: lawState, speciesCount: 2 };
}

describe('Chaos Multiplex core', () => {
  it('derives cols×rows shards from the source simulation', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(), { ...MULTIPLEX_DEFAULTS, cols: 2, rows: 2, variation: 0 }, null);
    expect(mx.active).toBe(true);
    expect(mx.shards.length).toBe(4);
    for (const shard of mx.shards) {
      expect(shard.count).toBe(4);
      expect(shard.view[0]).toBeCloseTo(100, 5); // cloned positions
    }
    stopMultiplex(mx);
    expect(mx.active).toBe(false);
    expect(mx.shards.length).toBe(0);
  });

  it('with variation disabled, shard DNA/laws match the source exactly', () => {
    const src = makeSource();
    const mx = createMultiplex(null);
    startMultiplex(mx, src, { ...MULTIPLEX_DEFAULTS, cols: 2, rows: 1, variation: 0, randomizeLaws: true, randomizeDNA: true }, null);
    for (const shard of mx.shards) {
      expect(shard.laws.lowFlags[0]).toBe(src.laws.lowFlags[0]);
      expect(shard.laws.highFlags[0]).toBe(src.laws.highFlags[0]);
      expect(shard.dna[0]).toBe(src.dna[0]);
    }
  });

  it('with laws off, stepping never moves shard particles', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(), { ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1, variation: 0 }, null);
    const before = Array.from(mx.shards[0].view.subarray(0, 4 * PARTICLE_STRIDE));
    stepMultiplex(mx, 0.25, 1, WORLD_SIZE);
    const after = Array.from(mx.shards[0].view.subarray(0, 4 * PARTICLE_STRIDE));
    expect(after).toEqual(before);
  });

  it('iteration regenerates shards from the selected shard and bumps the counter', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(), { ...MULTIPLEX_DEFAULTS, cols: 2, rows: 2, variation: 0.4 }, null);
    selectShard(mx, 2);
    expect(mx.selected).toBe(2);
    const prevSeed = mx.sourceSeed;
    iterateMultiplex(mx);
    expect(mx.iteration).toBe(1);
    expect(mx.sourceSeed).not.toBe(prevSeed);
    expect(mx.shards.length).toBe(4);
    expect(mx.selected).toBe(2);
  });

  it('new defaults: auto-iterate cadence + auto-select fittest are present', () => {
    expect(MULTIPLEX_DEFAULTS.autoIterate).toBe(false);
    expect(MULTIPLEX_DEFAULTS.autoIterateInterval).toBe(400);
    expect(MULTIPLEX_DEFAULTS.autoSelectFittest).toBe(false);
    const mx = createMultiplex(null);
    expect(mx.tick).toBe(0);
  });

  it('autoIterate regenerates shards on the configured cadence', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(), {
      ...MULTIPLEX_DEFAULTS,
      cols: 2,
      rows: 1,
      variation: 0,
      autoIterate: true,
      autoIterateInterval: 2,
    }, null);
    stepMultiplex(mx, 0.25, 1, WORLD_SIZE); // tick 1
    expect(mx.iteration).toBe(0);
    stepMultiplex(mx, 0.25, 1, WORLD_SIZE); // tick 2 → auto-iterate
    expect(mx.iteration).toBe(1);
    expect(mx.shards.length).toBe(2);
  });

  it('selectFittestShard picks the shard with the most living particles', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(4), { ...MULTIPLEX_DEFAULTS, cols: 2, rows: 2, variation: 0 }, null);
    // All four shards start with 4 alive → first is fittest.
    selectFittestShard(mx);
    expect(mx.selected).toBe(0);
    // Kill two in shard 1 and three in shard 2 → shard 0 (4 alive) stays fittest.
    mx.shards[1].view[1 * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[1].view[2 * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[2].view[1 * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[2].view[2 * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[2].view[3 * PARTICLE_STRIDE + S.DEAD] = 1;
    selectFittestShard(mx);
    expect(mx.selected).toBe(0);
    // Kill all in shard 0 → shard 1 (2 alive) is now fittest.
    for (let p = 0; p < 4; p++) mx.shards[0].view[p * PARTICLE_STRIDE + S.DEAD] = 1;
    selectFittestShard(mx);
    expect(mx.selected).toBe(3); // shard 3 is untouched → 4 alive
  });

  it('autoSelectFittest keeps the fittest shard selected after an auto-iteration', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(4), {
      ...MULTIPLEX_DEFAULTS,
      cols: 2,
      rows: 1,
      variation: 0,
      autoIterate: true,
      autoIterateInterval: 1,
      autoSelectFittest: true,
    }, null);
    mx.shards[1].view[1 * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[1].view[2 * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[1].view[3 * PARTICLE_STRIDE + S.DEAD] = 1;
    stepMultiplex(mx, 0.25, 1, WORLD_SIZE); // tick 1 → auto-iterate + fittest
    expect(mx.iteration).toBe(1);
    expect(mx.selected).toBe(0); // shard 0 had the most life before rebuild
  });
});

describe('Multiplex live settings (v4.6.16)', () => {
  /** Law state with EXOTHERMIC enabled — deterministic linear energy gain. */
  function exoLaw() {
    const laws = createLawState();
    set(laws, LAW_INDEXES.EXOTHERMIC);
    return laws;
  }

  it('new defaults: sim speed, pause, max iterations, drift present', () => {
    expect(MULTIPLEX_DEFAULTS.simSpeed).toBe(1.0);
    expect(MULTIPLEX_DEFAULTS.paused).toBe(false);
    expect(MULTIPLEX_DEFAULTS.maxIterations).toBe(0);
    expect(MULTIPLEX_DEFAULTS.variationDrift).toBe(0);
    const mx = createMultiplex(null);
    expect(mx.config.simSpeed).toBe(1.0);
    expect(mx.config.paused).toBe(false);
    expect(mx.config.maxIterations).toBe(0);
    expect(mx.config.variationDrift).toBe(0);
  });

  it('paused freezes the shard grid (no stepping, no tick advance)', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(), {
      ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1, variation: 0, paused: true,
    }, null);
    const before = mx.shards[0].view[S.ENERGY];
    stepMultiplex(mx, 0.25, 1, WORLD_SIZE);
    expect(mx.shards[0].view[S.ENERGY]).toBe(before);
    expect(mx.tick).toBe(0);
    expect(mx.shards[0].tick).toBe(0);
  });

  it('simSpeed scales the shard timestep (2× speed → double per-step effect)', () => {
    const run = (simSpeed) => {
      const mx = createMultiplex(null);
      startMultiplex(mx, makeSource(4, exoLaw()), {
        ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1, variation: 0, simSpeed,
      }, null);
      stepMultiplex(mx, 0.25, 1, WORLD_SIZE);
      return mx.shards[0].view[S.ENERGY];
    };
    // With a law that grants +0.05/s, one 0.25s step at 1× gains 0.0125,
    // at 2× gains 0.025 (effDt = dt × simSpeed).
    const slow = run(1.0);
    const fast = run(2.0);
    expect(slow).toBeCloseTo(80.0125, 5);
    expect(fast).toBeCloseTo(80.025, 5);
    expect(fast - slow).toBeCloseTo(0.0125, 5);
  });

  it('maxIterations caps auto-iteration', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(), {
      ...MULTIPLEX_DEFAULTS,
      cols: 2, rows: 1, variation: 0,
      autoIterate: true, autoIterateInterval: 2, maxIterations: 1,
    }, null);
    stepMultiplex(mx, 0.25, 1, WORLD_SIZE); // tick 1
    expect(mx.iteration).toBe(0);
    stepMultiplex(mx, 0.25, 1, WORLD_SIZE); // tick 2 → iterate once
    expect(mx.iteration).toBe(1);
    stepMultiplex(mx, 0.25, 1, WORLD_SIZE); // tick 3
    stepMultiplex(mx, 0.25, 1, WORLD_SIZE); // tick 4 → would iterate, capped
    expect(mx.iteration).toBe(1);
  });

  it('variationDrift raises variation each iteration, capped at 1', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(), {
      ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1, variation: 0.3, variationDrift: 0.05,
    }, null);
    iterateMultiplex(mx);
    expect(mx.config.variation).toBeCloseTo(0.35, 10);
    // Cap: near-full divergence cannot exceed 1.
    const capped = createMultiplex(null);
    startMultiplex(capped, makeSource(), {
      ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1, variation: 0.98, variationDrift: 0.05,
    }, null);
    iterateMultiplex(capped);
    expect(capped.config.variation).toBe(1);
  });
});

describe('Multiplex fitness + iteration (v4.6.24)', () => {
  /** Law state with EXOTHERMIC enabled — deterministic linear energy gain. */
  function exoLaw() {
    const laws = createLawState();
    set(laws, LAW_INDEXES.EXOTHERMIC);
    return laws;
  }

  it('renderQuality defaults to eco for multiplex previews', () => {
    expect(MULTIPLEX_DEFAULTS.renderQuality).toBe('eco');
    const mx = createMultiplex(null);
    expect(mx.config.renderQuality).toBe('eco');
  });

  it('new defaults: pop scale, seed, substeps, keep-selected, iterate mode, import-on-exit', () => {
    expect(MULTIPLEX_DEFAULTS.populationScale).toBe(1);
    expect(MULTIPLEX_DEFAULTS.seed).toBe(0);
    expect(MULTIPLEX_DEFAULTS.substeps).toBe(1);
    expect(MULTIPLEX_DEFAULTS.keepSelected).toBe(false);
    expect(MULTIPLEX_DEFAULTS.selectAfterIterate).toBe('none');
    expect(MULTIPLEX_DEFAULTS.importOnExit).toBe(true);
    const mx = createMultiplex(null);
    expect(mx.config.populationScale).toBe(1);
    expect(mx.config.importOnExit).toBe(true);
    expect(mx.deltaHistory).toEqual([]);
  });

  it('computeShardPopulationCap respects shard count and the POP SCALE knob', () => {
    const single = computeShardPopulationCap(1, 1);
    const many = computeShardPopulationCap(16, 1);
    expect(many).toBeLessThan(single);
    expect(computeShardPopulationCap(16, 0.25)).toBeLessThan(computeShardPopulationCap(16, 1));
    // Floor + ceiling
    expect(single).toBeGreaterThanOrEqual(MIN_SHARD_POPULATION);
    expect(single).toBeLessThanOrEqual(MAX_PARTICLES);
    expect(computeShardPopulationCap(1, 1)).toBe(computeShardPopulationCap(1, 1));
  });

  it('per-aspect variation knobs zero out their aspect at full master variation', () => {
    const laws = createLawState();
    set(laws, LAW_INDEXES.GRAV);
    const source = { ...makeSource(8), laws };
    const mk = (cfg) => {
      const mx = createMultiplex(null);
      startMultiplex(mx, source, {
        ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1,
        variation: 1, randomizeLaws: true, randomizeDNA: true, randomizePopulation: true,
        ...cfg,
      }, null);
      return mx.shards[0];
    };
    const lawBlocked = mk({ lawVariation: 0 });
    expect(lawBlocked.laws.lowFlags[0]).toBe(source.laws.lowFlags[0]);
    expect(lawBlocked.laws.highFlags[0]).toBe(source.laws.highFlags[0]);
    const dnaBlocked = mk({ dnaVariation: 0 });
    let dnaSame = true;
    for (let i = 0; i < dnaBlocked.dna.length; i++) {
      if (dnaBlocked.dna[i] !== source.dna[i]) { dnaSame = false; break; }
    }
    expect(dnaSame).toBe(true);
    const popBlocked = mk({ popVariation: 0 });
    expect(popBlocked.view[0 * PARTICLE_STRIDE + S.POS_X]).toBe(source.view[0]);
  });

  it('substeps: linear-law energy gain with substeps=4 equals substeps=1', () => {
    const run = (substeps) => {
      const mx = createMultiplex(null);
      startMultiplex(mx, makeSource(4, exoLaw()), {
        ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1, variation: 0, substeps,
      }, null);
      stepMultiplex(mx, 0.25, 1, WORLD_SIZE);
      return mx.shards[0].view[S.ENERGY];
    };
    expect(run(1)).toBeCloseTo(80.0125, 5);
    expect(Math.abs(run(4) - run(1))).toBeLessThan(1e-4);
  });

  it('copyShardToWorld copies particles, DNA and laws into the target world', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(5), { ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1, variation: 0 }, null);
    const shard = mx.shards[0];
    const target = makeSource(1);
    target.view.fill(0);
    const res = copyShardToWorld(shard, { view: target.view, dna: target.dna, laws: target.laws });
    expect(res.count).toBe(5);
    expect(res.speciesCount).toBe(2);
    for (let p = 0; p < 5; p++) {
      const b = p * PARTICLE_STRIDE;
      expect(target.view[b + S.POS_X]).toBe(shard.view[b + S.POS_X]);
      expect(target.view[b + S.DEAD]).toBe(shard.view[b + S.DEAD]);
    }
    expect(target.dna[0]).toBe(shard.dna[0]);
    expect(target.laws.lowFlags[0]).toBe(shard.laws.lowFlags[0]);
    expect(target.laws.highFlags[0]).toBe(shard.laws.highFlags[0]);
  });

  it('snapshotShard/restoreShard round-trip view, DNA, laws, counters and PRNG state', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(4), { ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1, variation: 0.3 }, null);
    const shard = mx.shards[0];
    const snap = snapshotShard(shard);
    const prngBefore = shard.prng.next();
    shard.view[0] = 999;
    shard.view[1] = 999;
    shard.dna[0] = 0;
    shard.laws.lowFlags[0] ^= 0xffffffff;
    shard.count = 1;
    shard.offspring = 123;
    restoreShard(shard, snap);
    expect(shard.count).toBe(4);
    expect(shard.offspring).toBe(0);
    expect(shard.view[0]).toBe(snap.view[0]);
    expect(shard.view[1]).toBe(snap.view[1]);
    expect(shard.dna[0]).toBe(snap.dna[0]);
    expect(shard.laws.lowFlags[0]).toBe(snap.laws.lowFlags);
    // PRNG continues from the snapshotted state.
    shard.view[0] = 100;
    const after = shard.prng.next();
    const fresh = new SplitMix32(snap.prngState);
    fresh.next(); // advance past prngBefore's one draw
    expect(after).toBe(prngBefore);
    void fresh;
  });

  it('keepSelected: iterate preserves the selected shard view, DNA and laws exactly', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(6), {
      ...MULTIPLEX_DEFAULTS, cols: 2, rows: 1, variation: 0.5, keepSelected: true,
    }, null);
    selectShard(mx, 1);
    const viewBefore = Array.from(mx.shards[1].view.subarray(0, 6 * PARTICLE_STRIDE));
    const dnaBefore = Array.from(mx.shards[1].dna);
    const lowBefore = mx.shards[1].laws.lowFlags[0];
    iterateMultiplex(mx);
    expect(mx.iteration).toBe(1);
    expect(mx.selected).toBe(1);
    expect(Array.from(mx.shards[1].view.subarray(0, 6 * PARTICLE_STRIDE))).toEqual(viewBefore);
    expect(Array.from(mx.shards[1].dna)).toEqual(dnaBefore);
    expect(mx.shards[1].laws.lowFlags[0]).toBe(lowBefore);
  });

  it("selectFollowShard picks the shard closest to the previous selection (skipping itself)", () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(4), { ...MULTIPLEX_DEFAULTS, cols: 3, rows: 1, variation: 0 }, null);
    // Shard 0 is clearly different (nearly dead); shard 2 is identical to shard 1.
    for (let p = 1; p < 4; p++) mx.shards[0].view[p * PARTICLE_STRIDE + S.DEAD] = 1;
    selectShard(mx, 1);
    const snap = snapshotShard(mx.shards[1]);
    selectFollowShard(mx, snap, 1);
    expect(mx.selected).toBe(2);
  });

  it('fitness weights: energy-only weight picks the highest-energy shard; min-mode picks the lowest', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(4), { ...MULTIPLEX_DEFAULTS, cols: 3, rows: 1, variation: 0 }, null);
    mx.shards[0].view[0 * PARTICLE_STRIDE + S.ENERGY] = 120;
    mx.shards[1].view[0 * PARTICLE_STRIDE + S.ENERGY] = 40;
    mx.shards[2].view[0 * PARTICLE_STRIDE + S.ENERGY] = 200;
    mx.config.fitnessWeights = { ...MULTIPLEX_DEFAULTS.fitnessWeights, energy: 1 };
    selectFittestShard(mx);
    expect(mx.selected).toBe(2);
    mx.config.fitnessModes = { ...MULTIPLEX_DEFAULTS.fitnessModes, energy: 'min' };
    selectFittestShard(mx);
    expect(mx.selected).toBe(1);
  });

  it('getFitnessReport returns per-shard fitness and default weights reproduce alive-only ranking', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(4), { ...MULTIPLEX_DEFAULTS, cols: 2, rows: 2, variation: 0 }, null);
    mx.shards[1].view[1 * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[1].view[2 * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[2].view[1 * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[2].view[2 * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[2].view[3 * PARTICLE_STRIDE + S.DEAD] = 1;
    const report = getFitnessReport(mx);
    expect(report.perShard).toHaveLength(4);
    expect(Array.isArray(report.perShard)).toBe(true);
    expect(typeof report.avgDelta).toBe('number');
    expect(Array.isArray(report.rollingDelta)).toBe(true);
    for (const e of report.perShard) {
      expect(typeof e.fitness).toBe('number');
      expect(Number.isFinite(e.fitness)).toBe(true);
      expect(e.metrics).toHaveProperty('population');
      expect(e.metrics).toHaveProperty('delta');
    }
    // Alive counts: shard0=4, shard1=2, shard2=1, shard3=4.
    const byId = Object.fromEntries(report.perShard.map((e) => [e.id, e]));
    expect(byId[0].fitness).toBeCloseTo(1);
    expect(byId[1].fitness).toBeCloseTo(1 / 3, 6);
    expect(byId[2].fitness).toBeCloseTo(0);
    expect(byId[3].fitness).toBeCloseTo(1);
    selectFittestShard(mx);
    expect(mx.selected).toBe(0);
    // Fitness ranking survives iteration via the default alive-only weights.
    const iter = createMultiplex(null);
    startMultiplex(iter, makeSource(4), {
      ...MULTIPLEX_DEFAULTS, cols: 2, rows: 1, variation: 0,
      autoIterate: true, autoIterateInterval: 1, autoSelectFittest: true,
    }, null);
    iter.shards[1].view[1 * PARTICLE_STRIDE + S.DEAD] = 1;
    iter.shards[1].view[2 * PARTICLE_STRIDE + S.DEAD] = 1;
    iter.shards[1].view[3 * PARTICLE_STRIDE + S.DEAD] = 1;
    stepMultiplex(iter, 0.25, 1, WORLD_SIZE);
    expect(iter.iteration).toBe(1);
    expect(iter.selected).toBe(0);
  });

  it('config seed > 0 makes the shard lineage deterministic', () => {
    const mk = () => {
      const mx = createMultiplex(null);
      startMultiplex(mx, makeSource(4), {
        ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1, variation: 0.5, seed: 42,
      }, null);
      return mx;
    };
    const a = mk();
    const b = mk();
    expect(a.sourceSeed).toBe(42);
    expect(b.sourceSeed).toBe(42);
    expect(Array.from(a.shards[0].view)).toEqual(Array.from(b.shards[0].view));
  });

  it('offspring recycle fully-dead slots instead of growing shard.count', () => {
    // Slot 0 is fully dead; two mature, reproduction-ready particles follow.
    const src = makeSource(3);
    src.view[S.DEAD] = 1;
    src.view[S.MASS] = 0;
    for (let i = 1; i < 3; i++) {
      const b = i * PARTICLE_STRIDE;
      src.view[b + S.DNA_CACHE_START + 10] = 0.9; // BIRTH_RATE high
      src.view[b + S.AGE] = 200;                  // mature
      src.view[b + S.REPRO_DRIVE] = 80;           // ready to spawn
    }
    const laws = createLawState();
    set(laws, LAW_INDEXES.LIFE);
    set(laws, LAW_INDEXES.REPRO);
    const mx = createMultiplex(null);
    startMultiplex(mx, { ...src, laws }, {
      ...MULTIPLEX_DEFAULTS, cols: 1, rows: 1, variation: 0,
    }, null);
    for (let t = 0; t < 600 && mx.shards[0].offspring === 0; t++) {
      stepMultiplex(mx, 0.25, 1, WORLD_SIZE);
    }
    const shard = mx.shards[0];
    expect(shard.offspring).toBeGreaterThan(0);
    // The newborn reused the dead slot 0: count stayed at 3, slot 0 is alive.
    expect(shard.count).toBe(3);
    expect(shard.view[S.DEAD]).toBeLessThan(0.5);
  });

  it('iterate reuses shard buffers when the grid layout is unchanged', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, makeSource(4), {
      ...MULTIPLEX_DEFAULTS, cols: 1, rows: 2, variation: 0.4,
    }, null);
    const prev = mx.shards.map((shard) => ({
      buffer: shard.buffer,
      dna: shard.dna,
    }));
    const sourceBuffer = mx.shards[mx.selected].buffer;
    iterateMultiplex(mx);
    expect(mx.iteration).toBe(1);
    for (let i = 0; i < mx.shards.length; i++) {
      if (i === mx.selected) {
        // The iteration source derives into a fresh buffer so later shards
        // still read pristine data during construction.
        expect(mx.shards[i].buffer).not.toBe(sourceBuffer);
      } else {
        expect(mx.shards[i].buffer).toBe(prev[i].buffer);
        expect(mx.shards[i].dna).toBe(prev[i].dna);
      }
    }
  });
});

// ── v7.2: elitist iteration, stable fitness, shard history + revert ──

/** Minimal source with explicit species count (variation off = deterministic). */
function mkSource(count = 4, species = 2) {
  const view = new Float32Array(MAX_PARTICLES * PARTICLE_STRIDE);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 100 + i * 10;
    view[b + S.POS_Y] = 100;
    view[b + S.POS_Z] = 100;
    view[b + S.SPECIES_ID] = i % species;
    view[b + S.DEAD] = 0;
    view[b + S.AGE] = i * 5;
    view[b + S.ENERGY] = 50 + i * 10;
  }
  return {
    view,
    count,
    speciesCount: species,
    dna: createDNABuffer(),
    laws: createLawState(),
  };
}

/** Deterministic 2×1 grid (seed 42) with the given config merged in. */
function startMx(config) {
  const mx = createMultiplex(null);
  startMultiplex(mx, mkSource(4, 2), { seed: 42, cols: 2, rows: 1, ...config }, null);
  return mx;
}

describe('fitness report purity + normalization (v7.2)', () => {
  it('is pure — reading the report never mutates controller state', () => {
    const mx = startMx({ variation: 0.4 });
    getFitnessReport(mx);
    getFitnessReport(mx);
    expect(mx.deltaHistory).toEqual([]); // recordDelta is the only writer
    expect(mx.runningBounds).toBeNull();
  });

  it('zero span (single shard) normalizes to 1 instead of collapsing to 0', () => {
    const mx = startMx({ cols: 1, rows: 1, variation: 0 });
    const report = getFitnessReport(mx);
    expect(report.perShard[0].metrics.population).toBe(1);
    expect(report.perShard[0].fitness).toBe(1);
    expect(report.avgDelta).toBe(0); // no peers → zero divergence
  });

  it('recordDelta is the only writer to deltaHistory and caps the window', () => {
    const mx = startMx({ variation: 0.4 });
    const avg = recordDelta(mx);
    expect(mx.deltaHistory).toEqual([avg]);
    for (let i = 0; i < ALIVE_WINDOW_SIZE + 5; i++) recordDelta(mx);
    expect(mx.deltaHistory).toHaveLength(ALIVE_WINDOW_SIZE);
  });

  it('a single-species shard scores diversity 0 (monoculture)', () => {
    const mx = createMultiplex(null);
    startMultiplex(mx, mkSource(4, 1), { seed: 1, cols: 1, rows: 1, variation: 0 }, null);
    expect(computeShardMetrics(mx.shards[0], WORLD_SIZE).diversity).toBe(0);
  });
});

describe('iterateMultiplex policies (v7.2)', () => {
  it('fittest mode selects the winner of the EVOLVED generation before rebuilding', () => {
    const mx = startMx({ selectAfterIterate: 'fittest', variation: 0.3 });
    for (let i = 0; i < 2; i++) mx.shards[0].view[i * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[0].prevAlive = 0;
    expect(mx.selected).toBe(0);
    iterateMultiplex(mx);
    expect(mx.selected).toBe(1); // winner seeds the next generation
    expect(mx.shards[1].tick).toBe(0); // fresh descendant of the winner
  });

  it('autoSelectFittest alone (default selectAfterIterate) still selects fittest', () => {
    const mx = startMx({ autoSelectFittest: true, variation: 0.2 });
    for (let i = 0; i < 3; i++) mx.shards[1].view[i * PARTICLE_STRIDE + S.DEAD] = 1;
    mx.shards[1].prevAlive = 0;
    iterateMultiplex(mx);
    expect(mx.selected).toBe(0);
  });

  it('keepSelected restores the anchor across iteration', () => {
    const mx = startMx({ keepSelected: true, selectAfterIterate: 'none', variation: 0.3 });
    const beforeBuf = Array.from(mx.shards[0].view.subarray(0, mx.shards[0].count * PARTICLE_STRIDE));
    iterateMultiplex(mx);
    expect(Array.from(mx.shards[0].view.subarray(0, mx.shards[0].count * PARTICLE_STRIDE))).toEqual(beforeBuf);
    // Sibling was regenerated with variation → different buffer.
    expect(Array.from(mx.shards[1].view.subarray(0, mx.shards[1].count * PARTICLE_STRIDE))).not.toEqual(beforeBuf);
  });
});

describe('stepMultiplex delta history (v7.2)', () => {
  it('records one delta sample per tick regardless of UI reads', () => {
    const mx = startMx({ variation: 0.2, selectAfterIterate: 'none' });
    for (let t = 0; t < 5; t++) {
      getFitnessReport(mx); // simulated per-frame UI read — must not record
      stepMultiplex(mx, 1, 1, WORLD_SIZE);
    }
    expect(mx.deltaHistory).toHaveLength(5);
    expect(mx.shards[0].tick).toBe(5);
  });
});

describe('generation progress + convergence (v7.2)', () => {
  it('report carries rawMetrics and rawFitness (== fitness before bounds exist)', () => {
    const mx = startMx({ variation: 0.4 });
    const report = getFitnessReport(mx);
    expect(report.perShard.length).toBe(2);
    for (const entry of report.perShard) {
      expect(entry.rawMetrics.population).toBeGreaterThanOrEqual(0);
      expect(entry.rawFitness).toBeCloseTo(entry.fitness, 6); // first gen: same normalization
    }
    expect(mx.runningBounds).toBeNull(); // pure report never seeds bounds
  });

  it('updateRunningBounds expands min/max across generations', () => {
    const mx = startMx({ variation: 0.4 });
    const r1 = getFitnessReport(mx);
    updateRunningBounds(mx, r1);
    const min1 = mx.runningBounds.min.population;
    const max1 = mx.runningBounds.max.population;
    // Kill every particle in shard 1 → a new lower population bound.
    for (let p = 0; p < 4; p++) mx.shards[1].view[p * PARTICLE_STRIDE + S.DEAD] = 1;
    const r2 = getFitnessReport(mx);
    updateRunningBounds(mx, r2);
    expect(mx.runningBounds.min.population).toBeLessThan(min1);
    expect(mx.runningBounds.max.population).toBe(max1);
    // Bounds now make rawFitness stable and comparable across generations.
    const stable = getFitnessReport(mx);
    for (const entry of stable.perShard) {
      expect(entry.rawFitness).toBeGreaterThanOrEqual(0);
      expect(entry.rawFitness).toBeLessThanOrEqual(1);
    }
  });

  it('trackGenerationProgress records best and counts stagnation', () => {
    const mx = startMx({ variation: 0 });
    mx.iteration = 1;
    const r1 = getFitnessReport(mx);
    const p1 = trackGenerationProgress(mx, r1, 5);
    expect(p1.improved).toBe(true); // first generation seeds the best
    expect(p1.bestIteration).toBe(1);
    expect(p1.stagnantGenerations).toBe(0);
    const firstBest = p1.bestFitness;
    // Identical shards, no variation → no improvement → stagnation accrues.
    const r2 = getFitnessReport(mx);
    const p2 = trackGenerationProgress(mx, r2, 5);
    expect(p2.improved).toBe(false);
    expect(p2.bestFitness).toBe(firstBest);
    expect(p2.stagnantGenerations).toBe(1);
    expect(p2.stagnant).toBe(false);
    const r3 = getFitnessReport(mx);
    const p3 = trackGenerationProgress(mx, r3, 2);
    expect(p3.stagnant).toBe(true); // 2 stagnant >= limit 2
  });

  it('auto-iteration pauses once the stagnation limit is hit, manual iterate re-arms', () => {
    const mx = startMx({
      variation: 0,
      autoIterate: true,
      autoIterateInterval: 2,
      stagnationLimit: 2,
      selectAfterIterate: 'none',
    });
    // Identical shards can never improve the best → stagnation accrues.
    for (let t = 0; t < 6; t++) stepMultiplex(mx, 1, 1, WORLD_SIZE); // ticks 1..6
    // Gen 1 improves (seeds best), gens 2-3 stagnate → paused at iteration 3.
    expect(mx.iteration).toBe(3);
    expect(mx.stagnantGenerations).toBe(2);
    expect(mx.stagnantPaused).toBe(true);
    // Auto-iterate stands down: more steps do not bump the iteration.
    for (let t = 0; t < 4; t++) stepMultiplex(mx, 1, 1, WORLD_SIZE);
    expect(mx.iteration).toBe(3);
    // Manual iterate re-arms the run: the pause clears and the stagnation
    // counter restarts (the manual generation itself still can't improve,
    // so it already counts as the first stagnant generation).
    const prog = iterateMultiplex(mx, { manual: true });
    expect(mx.stagnantPaused).toBe(false);
    expect(mx.stagnantGenerations).toBe(1);
    expect(prog.iteration).toBe(4);
    // And auto-iteration resumes on the cadence.
    stepMultiplex(mx, 1, 1, WORLD_SIZE); // tick 1 (post-iterate)
    stepMultiplex(mx, 1, 1, WORLD_SIZE); // tick 2 → auto-iterate fires
    expect(mx.iteration).toBe(5);
  });

  it('eliteCount preserves the fittest shard state across iteration', () => {
    const mx = startMx({ variation: 0.4, selectAfterIterate: 'none' });
    mx.config.eliteCount = 1;
    const report = getFitnessReport(mx);
    let best = report.perShard[0];
    for (const e of report.perShard) if (e.rawFitness > best.rawFitness) best = e;
    const bestId = best.id;
    const before = mx.shards[bestId];
    const n = before.count * PARTICLE_STRIDE;
    const viewBefore = Array.from(before.view.subarray(0, n));
    const dnaBefore = Array.from(before.dna);
    iterateMultiplex(mx);
    // The elite slot was rebuilt fresh, then restored — byte-identical state.
    const after = mx.shards[bestId];
    expect(after.count).toBe(before.count);
    expect(Array.from(after.view.subarray(0, n))).toEqual(viewBefore);
    expect(Array.from(after.dna)).toEqual(dnaBefore);
  });
});

describe('shard comparison + history/revert + annealing (v7.2)', () => {
  it('new defaults: cooling, adaptive interval, history depth are present', () => {
    expect(MULTIPLEX_DEFAULTS.cooling).toBe(0);
    expect(MULTIPLEX_DEFAULTS.adaptiveInterval).toBe(false);
    expect(MULTIPLEX_DEFAULTS.historyDepth).toBe(6);
    expect(MULTIPLEX_DEFAULTS.eliteCount).toBe(0);
    expect(MULTIPLEX_DEFAULTS.stagnationLimit).toBe(5);
    expect(ADAPTIVE_INTERVAL_CAP).toBeGreaterThan(0);
    expect(VARIATION_FLOOR).toBe(0.05);
  });

  it('compareShards builds a per-metric matrix with best-per-row honors', () => {
    const mx = startMx({ variation: 0.4 });
    mx.config.fitnessModes = { ...mx.config.fitnessModes, energy: 'min' };
    const matrix = compareShards(mx);
    expect(matrix.shardIds).toEqual([0, 1]);
    // 13 raw base metrics (delta is derived) + the informational PARAMS row.
    expect(matrix.rows).toHaveLength(14);
    const metricRows = matrix.rows.filter((r) => r.key !== 'params');
    for (const row of metricRows) {
      expect(row.values).toHaveLength(2);
      expect([0, 1]).toContain(row.bestId);
      const want = row.mode === 'min' ? Math.min(...row.values) : Math.max(...row.values);
      expect(row.bestValue).toBe(want);
      expect(row.values[row.bestId]).toBe(want);
    }
    // The informational PARAMS row measures knob divergence from the source world.
    const paramsRow = matrix.rows.find((r) => r.key === 'params');
    expect(paramsRow.mode).toBe('info');
    expect(paramsRow.bestId).toBe(-1);
    expect(paramsRow.values).toHaveLength(2);
    // The energy row honors the min mode: bestId = shard with the lowest energy.
    const energy = matrix.rows.find((r) => r.key === 'energy');
    expect(energy.mode).toBe('min');
    expect(energy.values[energy.bestId]).toBe(Math.min(...energy.values));
  });

  it('records every on-screen generation into history, capped at depth', () => {
    const mx = startMx({ variation: 0.4, historyDepth: 2 });
    expect(mx.history.length).toBe(1); // generation 0 recorded at start
    expect(mx.history[0].generation).toBe(0);
    expect(mx.history[0].shards.length).toBe(2); // light per-shard records
    expect(Object.keys(mx.history[0].snapshots).length).toBeGreaterThan(0); // selected+fittest full snaps
    iterateMultiplex(mx);
    iterateMultiplex(mx);
    iterateMultiplex(mx);
    expect(mx.history.map((h) => h.generation)).toEqual([2, 3]); // capped at depth 2
  });

  it('revertMultiplex rebuilds the grid from a recorded generation (and is undoable)', () => {
    const mx = startMx({ variation: 0.4, historyDepth: 6 });
    iterateMultiplex(mx);
    iterateMultiplex(mx); // now on generation 2; history holds G0..G2
    const g0 = mx.history.find((h) => h.generation === 0);
    const g0Dna = g0.shards.map((r) => Array.from(r.dna));
    expect(mx.bestFitness).not.toBeNull();
    expect(revertMultiplex(mx, 0)).toBe(true);
    expect(mx.iteration).toBe(0);
    expect(mx.bestFitness).toBeNull(); // bookkeeping restored to G0
    expect(mx.shards.length).toBe(2);
    expect(mx.shards.map((s) => Array.from(s.dna))).toEqual(g0Dna);
    // The revert was recorded → reverting again returns to generation 2.
    const last = mx.history[mx.history.length - 1];
    expect(last.generation).toBe(2);
    expect(revertMultiplex(mx, last.generation)).toBe(true);
    expect(mx.iteration).toBe(2);
  });

  it('revertMultiplex refuses unknown generations and inactive grids', () => {
    const mx = startMx({ variation: 0.4 });
    expect(revertMultiplex(mx, 99)).toBe(false);
    stopMultiplex(mx);
    expect(revertMultiplex(mx, 0)).toBe(false);
  });

  it('cooling anneals variation toward the exploration floor', () => {
    const mx = startMx({ variation: 0.5, cooling: 0.1 });
    iterateMultiplex(mx);
    expect(mx.config.variation).toBeCloseTo(0.45, 5); // 0.5 × (1 − 0.1)
    for (let i = 0; i < 30; i++) iterateMultiplex(mx);
    expect(mx.config.variation).toBeCloseTo(VARIATION_FLOOR, 5); // clamped at floor
  });

  it('adaptive interval stretches while stagnant and snaps back on improvement', () => {
    const mx = startMx({ variation: 0, adaptiveInterval: true, autoIterateInterval: 10 });
    iterateMultiplex(mx); // first generation seeds the best → base interval
    expect(mx.currentInterval).toBe(10);
    iterateMultiplex(mx); // stagnant → ×1.5
    expect(mx.currentInterval).toBe(15);
    iterateMultiplex(mx); // stagnant again → ×1.5 (capped at ADAPTIVE_INTERVAL_CAP)
    expect(mx.currentInterval).toBeGreaterThan(15);
    expect(mx.currentInterval).toBeLessThanOrEqual(ADAPTIVE_INTERVAL_CAP);
    // Force an improvement: a higher best seeds → interval snaps back to base.
    mx.bestFitness = 0;
    iterateMultiplex(mx);
    expect(mx.currentInterval).toBe(10);
    // stepMultiplex honors the stretched cadence.
    const mx2 = startMx({ variation: 0, adaptiveInterval: true, autoIterate: true, autoIterateInterval: 2 });
    stepMultiplex(mx2, 1, 1, WORLD_SIZE); // tick 1
    stepMultiplex(mx2, 1, 1, WORLD_SIZE); // tick 2 → iterate (gen 1 seeds best)
    expect(mx2.iteration).toBe(1);
    expect(mx2.currentInterval).toBe(2);
    stepMultiplex(mx2, 1, 1, WORLD_SIZE); // tick 3
    stepMultiplex(mx2, 1, 1, WORLD_SIZE); // tick 4 → iterate (stagnant) → interval 3
    expect(mx2.iteration).toBe(2);
    expect(mx2.currentInterval).toBe(3);
  });
});

describe('per-shard world params (v7.3)', () => {
  it('paramVariation 0 leaves world params identical to the source world', () => {
    const baseParams = createWorldParams();
    runtimeConfig.worldParams = baseParams;
    const mx = startMx({
      seed: 9001,
      variation: 1,
      paramVariation: 0,
      randomizeParams: true,
      randomizeLaws: false,
      randomizeDNA: false,
      randomizePopulation: false,
    });
    expect(mx.baseWorldParams).toEqual(baseParams);
    for (const shard of mx.shards) {
      expect(shard.worldParams).toEqual(baseParams);
    }
    stopMultiplex(mx);
    runtimeConfig.worldParams = baseParams; // restore the singleton
  });

  it('paramVariation 1 perturbs knobs within their defined ranges', () => {
    const baseParams = createWorldParams();
    runtimeConfig.worldParams = baseParams;
    const mx = startMx({
      seed: 4242,
      variation: 1,
      paramVariation: 1,
      randomizeParams: true,
      randomizeLaws: false,
      randomizeDNA: false,
      randomizePopulation: false,
    });
    for (const shard of mx.shards) {
      expect(shard.worldParams).not.toEqual(baseParams);
      for (const def of WORLD_PARAM_DEFS) {
        const v = shard.worldParams[def.key];
        expect(v).toBeGreaterThanOrEqual(def.min - 1e-6);
        expect(v).toBeLessThanOrEqual(def.max + 1e-6);
      }
    }
    stopMultiplex(mx);
    runtimeConfig.worldParams = baseParams;
  });

  it('randomizeParams false blocks world-param perturbation', () => {
    const baseParams = createWorldParams();
    runtimeConfig.worldParams = baseParams;
    const mx = startMx({
      seed: 4242,
      variation: 1,
      paramVariation: 1,
      randomizeParams: false,
      randomizeLaws: false,
      randomizeDNA: false,
      randomizePopulation: false,
    });
    for (const shard of mx.shards) {
      expect(shard.worldParams).toEqual(baseParams);
    }
    stopMultiplex(mx);
    runtimeConfig.worldParams = baseParams;
  });

  it('iteration keeps a perturbed lineage (source shard params seed the next generation)', () => {
    const mx = startMx({ variation: 0.4, selectAfterIterate: 'none', seed: 7 });
    const base = createWorldParams();
    const gen0 = { ...mx.shards[0].worldParams };
    expect(gen0).not.toEqual(base); // variation × paramVariation perturbed the knobs
    iterateMultiplex(mx);
    const gen1 = mx.shards[0].worldParams;
    let perturbed = 0;
    let inherited = 0;
    for (const key of Object.keys(base)) {
      if (gen1[key] !== base[key]) perturbed++;
      if (gen0[key] !== base[key] && gen1[key] === gen0[key]) inherited++;
    }
    expect(perturbed).toBeGreaterThan(0); // lineage still diverges from defaults
    expect(inherited).toBeGreaterThan(0); // and carries evolved knobs forward
    stopMultiplex(mx);
  });

  it('stepMultiplex restores the live world params (no leakage)', () => {
    const baseParams = createWorldParams();
    runtimeConfig.worldParams = baseParams;
    const mx = startMx({ variation: 0.5, seed: 11 });
    expect(mx.shards[0].worldParams).not.toEqual(baseParams); // derived + perturbed
    stepMultiplex(mx, 0.25, 1, WORLD_SIZE);
    expect(runtimeConfig.worldParams).toBe(baseParams); // restored exactly
    stopMultiplex(mx);
    runtimeConfig.worldParams = baseParams;
  });

  it('revert restores the recorded world params', () => {
    const mx = startMx({ variation: 0.5, selectAfterIterate: 'none', historyDepth: 6 });
    const gen0Params = { ...mx.history[0].shards[0].worldParams };
    iterateMultiplex(mx); // gen 1
    iterateMultiplex(mx); // gen 2
    expect(mx.shards[0].worldParams).not.toEqual(gen0Params);
    expect(revertMultiplex(mx, 0)).toBe(true);
    expect(mx.iteration).toBe(0);
    expect(mx.shards[0].worldParams).toEqual(gen0Params);
    stopMultiplex(mx);
  });

  it('compare includes a PARAMS divergence row against the source world', () => {
    const baseParams = createWorldParams();
    runtimeConfig.worldParams = baseParams;
    const mx = startMx({ variation: 1, paramVariation: 1, seed: 99 });
    const { rows } = compareShards(mx);
    const paramsRow = rows.find((r) => r.key === 'params');
    expect(paramsRow).toBeTruthy();
    expect(paramsRow.values.length).toBe(mx.shards.length);
    expect(Math.max(...paramsRow.values)).toBeGreaterThan(0);
    stopMultiplex(mx);
    runtimeConfig.worldParams = baseParams;
  });
});
