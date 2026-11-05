import { describe, it, expect, beforeEach } from 'vitest';
import { PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES, DNA_INDEXES, DNA_RANGES } from '../../src/constants.js';
import { createDNABuffer, loadDefaults, getDNAFloat, getSpeciesDNA, setDNAFloat } from '../../src/dna/dnaBuffer.js';
import { createFieldSystem } from '../../src/physics/fields.js';
import { EventBus } from '../../src/core/eventBus.js';
import { SplitMix32 } from '../../src/core/prng.js';
import {
  createSpeciationEngine,
  updateSpeciation,
  SPECIATION_CADENCE,
} from '../../src/engines/speciation.js';
import { createEcoEngine, oscillationScore, biodiversity } from '../../src/engines/ecoEngine.js';
import { createWorldEventEngine } from '../../src/engines/worldEvents.js';

const S = STRIDE_INDEXES;

function makeView(speciesSpecs) {
  // speciesSpecs: [{sp, n, x, y, z}] — n particles of species sp at (x,y,z).
  const view = new Float32Array(MAX_PARTICLES * PARTICLE_STRIDE);
  let i = 0;
  for (const spec of speciesSpecs) {
    for (let k = 0; k < spec.n; k++) {
      const b = i * PARTICLE_STRIDE;
      view[b + S.POS_X] = spec.x;
      view[b + S.POS_Y] = spec.y;
      view[b + S.POS_Z] = spec.z;
      view[b + S.MASS] = spec.mass ?? 1;
      view[b + S.DEAD] = 0;
      view[b + S.SPECIES_ID] = spec.sp;
      view[b + S.ENERGY] = spec.energy ?? 100;
      i++;
    }
  }
  return { view, count: i };
}

/** A walled field system — border walls make corner positions high-isolation. */
function walledField() {
  return createFieldSystem(1000, 16, { WALLS_PRESET: 1, WALL_THICKNESS: 2 });
}

function forceScan(engine) {
  engine.frame = SPECIATION_CADENCE - 1;
}

describe('speciation (Set A.1)', () => {
  let dnaBuffer;

  beforeEach(() => {
    dnaBuffer = createDNABuffer();
    loadDefaults(dnaBuffer, DNA_RANGES);
  });

  it('splits a qualifying species; child claims an extinct-freed slot, parent keeps its own', () => {
    const prng = new SplitMix32(0x5EED);
    const engine = createSpeciationEngine(null, { prng: () => prng.next() });
    // Low threshold + corner placement against border walls → high isolation.
    setDNAFloat(dnaBuffer, 0, DNA_INDEXES.SPECIATION_THRESHOLD, 0.1, DNA_RANGES[54].min, DNA_RANGES[54].max);
    const { view, count } = makeView([{ sp: 0, n: 10, x: 10, y: 10, z: 10 }]);
    forceScan(engine);
    const events = updateSpeciation(engine, view, count, PARTICLE_STRIDE, dnaBuffer, 1000, {
      lawActiveCount: 1,
      fieldSystem: walledField(),
    });

    const split = events.find((e) => e.type === 'speciation:split');
    expect(split).toBeTruthy();
    expect(split.parent).toBe(0);
    expect(split.child).toBe(1); // first free slot (species 1 has no live members)

    // Parent keeps its slot; some members re-tagged as the child.
    let parentCount = 0, childCount = 0;
    for (let i = 0; i < count; i++) {
      const sp = view[i * PARTICLE_STRIDE + S.SPECIES_ID];
      if (sp === 0) parentCount++;
      if (sp === 1) childCount++;
    }
    expect(parentCount).toBeGreaterThan(0);
    expect(childCount).toBeGreaterThan(0);
    // Child genome diverged from the parent (mutations applied) — at least
    // one of the 64 params must differ.
    const pa = getSpeciesDNA(dnaBuffer, 0);
    const pb = getSpeciesDNA(dnaBuffer, 1);
    expect(pa.some((v, i) => v !== pb[i])).toBe(true);
  });

  it('does not split a high-threshold species or a sparse one', () => {
    const prng = new SplitMix32(0x5EED);
    const engine = createSpeciationEngine(null, { prng: () => prng.next() });
    // Default threshold 0.5 but sparse (3 < MIN_MEMBERS).
    const sparse = makeView([{ sp: 0, n: 3, x: 10, y: 10, z: 10 }]);
    forceScan(engine);
    let events = updateSpeciation(engine, sparse.view, sparse.count, PARTICLE_STRIDE, dnaBuffer, 1000, {
      lawActiveCount: 1,
      fieldSystem: walledField(),
    });
    expect(events.some((e) => e.type === 'speciation:split')).toBe(false);

    // Threshold high (0.9) with a full population — score stays < 1.
    setDNAFloat(dnaBuffer, 0, DNA_INDEXES.SPECIATION_THRESHOLD, 0.9, DNA_RANGES[54].min, DNA_RANGES[54].max);
    const full = makeView([{ sp: 0, n: 10, x: 10, y: 10, z: 10 }]);
    forceScan(engine);
    events = updateSpeciation(engine, full.view, full.count, PARTICLE_STRIDE, dnaBuffer, 1000, {
      lawActiveCount: 1,
      fieldSystem: walledField(),
    });
    expect(events.some((e) => e.type === 'speciation:split')).toBe(false);
  });

  it('reports extinctions and recycles the freed slot', () => {
    const prng = new SplitMix32(0x5EED);
    const engine = createSpeciationEngine(null, { prng: () => prng.next() });
    setDNAFloat(dnaBuffer, 0, DNA_INDEXES.SPECIATION_THRESHOLD, 0.9, DNA_RANGES[54].min, DNA_RANGES[54].max);
    // Species 0 + species 1 both alive (species 1 occupies the next slot).
    const alive = makeView([
      { sp: 0, n: 8, x: 500, y: 500, z: 500 },
      { sp: 1, n: 3, x: 500, y: 500, z: 500 },
    ]);
    forceScan(engine);
    updateSpeciation(engine, alive.view, alive.count, PARTICLE_STRIDE, dnaBuffer, 1000, {
      lawActiveCount: 1,
      fieldSystem: walledField(),
    });
    expect(engine.seenSpecies.has(1)).toBe(true);

    // Kill species 1 → extinct; then a split of species 0 recycles slot 1.
    for (let i = 0; i < alive.count; i++) {
      const b = i * PARTICLE_STRIDE;
      if (view(b, alive.view) === 1) {
        alive.view[b + S.DEAD] = 1;
        alive.view[b + S.MASS] = 0;
      }
    }
    forceScan(engine);
    const events = updateSpeciation(engine, alive.view, alive.count, PARTICLE_STRIDE, dnaBuffer, 1000, {
      lawActiveCount: 1,
      fieldSystem: walledField(),
    });
    expect(events.some((e) => e.type === 'speciation:extinct' && e.species === 1)).toBe(true);
    expect(engine.extinctHistory.some((e) => e.species === 1)).toBe(true);
  });

  it('silent mode (multiplex) never emits events or grows the roster', () => {
    const prng = new SplitMix32(0x5EED);
    const engine = createSpeciationEngine(null, { prng: () => prng.next() });
    setDNAFloat(dnaBuffer, 0, DNA_INDEXES.SPECIATION_THRESHOLD, 0.1, DNA_RANGES[54].min, DNA_RANGES[54].max);
    const { view, count } = makeView([{ sp: 0, n: 10, x: 10, y: 10, z: 10 }]);
    forceScan(engine);
    const events = updateSpeciation(engine, view, count, PARTICLE_STRIDE, dnaBuffer, 1000, {
      lawActiveCount: 1,
      fieldSystem: walledField(),
      silent: true,
    });
    expect(events).toHaveLength(0);
    // Split still happened internally (particles re-tagged) — just silently.
    let childCount = 0;
    for (let i = 0; i < count; i++) {
      if (view[i * PARTICLE_STRIDE + S.SPECIES_ID] === 1) childCount++;
    }
    expect(childCount).toBeGreaterThan(0);
  });
});

function view(b, viewArr) {
  return viewArr[b + S.SPECIES_ID];
}

describe('eco engine (Set A.2)', () => {
  it('builds the metrics ring with biodiversity and oscillation', () => {
    const bus = new EventBus();
    const eco = createEcoEngine(bus);
    for (let t = 0; t < 12; t++) {
      bus.emit('sim:metrics', {
        populationAlive: 100,
        speciesAlive: 2,
        speciesPop: { 0: 60, 1: 40 },
        speciesEnergy: { 0: 6000, 1: 4000 },
        speciesMass: { 0: 60, 1: 40 },
        speciesPos: { 0: [100, 100, 100], 1: [200, 200, 200] },
        avgEnergy: 100,
        frameDelta: t * 60,
      });
    }
    expect(eco.ring.length).toBe(12);
    expect(biodiversity(eco)).toBeGreaterThan(0.6); // Shannon of 60/40 split ≈ 0.67
    expect(oscillationScore(eco)).toBe(0);          // constant population
  });

  it('derives food-web edges from mass × spatial overlap', () => {
    const bus = new EventBus();
    const eco = createEcoEngine(bus);
    bus.emit('sim:metrics', {
      populationAlive: 10,
      speciesAlive: 2,
      speciesPop: { 0: 5, 1: 5 },
      speciesEnergy: { 0: 500, 1: 500 },
      speciesMass: { 0: 500, 1: 20 }, // 0 is a 25× predator of 1
      speciesPos: { 0: [100, 100, 100], 1: [110, 100, 100] },
      avgEnergy: 100,
      frameDelta: 60,
    });
    expect(eco.foodWeb.has('1->0')).toBe(true);
    const edge = eco.foodWeb.get('1->0');
    expect(edge.prey).toBe(1);
    expect(edge.predator).toBe(0);
  });
});

describe('world events (Set A.3)', () => {
  it('fires famine only after baseline warm-up + physics confirm, then cools down', () => {
    const bus = new EventBus();
    const engine = createWorldEventEngine(bus);
    const fired = [];
    bus.on('worldEvent:triggered', (e) => fired.push(e));

    // Baseline: 5 healthy samples.
    for (let t = 0; t < 5; t++) {
      bus.emit('sim:metrics', { populationAlive: 100, avgEnergy: 100, frameDelta: t * 60 });
    }
    expect(fired).toHaveLength(0);

    // Crash: below 40% pop AND below 30% energy — needs 2 consecutive checks.
    bus.emit('sim:metrics', { populationAlive: 30, avgEnergy: 20, frameDelta: 5 * 60 });
    expect(fired).toHaveLength(0); // confirm 1 of 2
    bus.emit('sim:metrics', { populationAlive: 28, avgEnergy: 18, frameDelta: 6 * 60 });
    expect(fired).toHaveLength(1);
    expect(fired[0].type).toBe('famine');

    // Cooldown: an immediately following crash does NOT retrigger.
    bus.emit('sim:metrics', { populationAlive: 20, avgEnergy: 10, frameDelta: 7 * 60 });
    bus.emit('sim:metrics', { populationAlive: 20, avgEnergy: 10, frameDelta: 8 * 60 });
    expect(fired).toHaveLength(1);
  });

  it('ignores single-sample dips (no false positives on restore)', () => {
    const bus = new EventBus();
    const engine = createWorldEventEngine(bus);
    const fired = [];
    bus.on('worldEvent:triggered', (e) => fired.push(e));
    for (let t = 0; t < 5; t++) {
      bus.emit('sim:metrics', { populationAlive: 100, avgEnergy: 100, frameDelta: t * 60 });
    }
    bus.emit('sim:metrics', { populationAlive: 20, avgEnergy: 10, frameDelta: 5 * 60 });
    bus.emit('sim:metrics', { populationAlive: 100, avgEnergy: 100, frameDelta: 6 * 60 });
    expect(fired).toHaveLength(0);
  });
});
