import { describe, it, expect } from 'vitest';
import {
  PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES as S, DNA_RANGES, LAW_INDEXES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';
import { withWorldParam } from './paramsHelpers.js';

const WORLD = 2000;
const DT = 0.25;
const rng = () => 0.5;

function makeWorld(count, setup) {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const view = buf.view;
  const dna = createDNABuffer();
  loadDefaults(dna, DNA_RANGES);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 1000;
    view[b + S.POS_Y] = 1000;
    view[b + S.POS_Z] = 1000;
    view[b + S.VEL_X] = 0; view[b + S.VEL_Y] = 0; view[b + S.VEL_Z] = 0;
    view[b + S.MASS] = 1.5;
    view[b + S.SPECIES_ID] = 0;
    view[b + S.DEAD] = 0;
    view[b + S.AGE] = 0;
    view[b + S.ENERGY] = 100;
    view[b + S.SIGNAL] = 0;
    view[b + S.HUNGER] = 0;
    view[b + S.ARMOR] = 0;
    view[b + S.TEMPERATURE] = 0;
    view[b + S.RADIUS] = 0.6;
    view[b + S.ELECTRIC_ENERGY] = 0;
    view[b + S.STORED_ENERGY] = 0;
    view[b + S.REPRO_DRIVE] = 0;
    view[b + S.RADIATION_EXPOSURE] = 0;
    view[b + S.BOND_PARTNER_1] = -1;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      view[b + S.DNA_CACHE_START + d] = r.default ?? 0;
    }
    if (setup) setup(view, dna, b, i);
  }
  return { view, dna };
}

function changedLoci(view, base, before) {
  let changed = 0;
  for (let d = 0; d < 42; d++) {
    if (view[base + S.DNA_CACHE_START + d] !== before[d]) changed++;
  }
  return changed;
}

describe('Batch 04 — SENESCENCE / ENERGY / RADIATION / GENOTYPE (indices 12-15)', () => {
  it('SENESCENCE: particles past age 500 die at a rate set by DEATH_RATE', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.AGE] = 1000;
      v[b + S.DNA_CACHE_START + 11] = 500; // DEATH_RATE → death chance 0.55 > prng 0.5
      dna[0 * 64 + 60] = 0;                // TELOMERE_LENGTH → 0 (full aging; default 0.5 would damp the chance below 0.5)
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.LIFE);
    set(laws, LAW_INDEXES.SENESCENCE);
    expect(isSet(laws, LAW_INDEXES.SENESCENCE)).toBe(true);
    solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    expect(view[S.DEAD]).toBe(1);
  });

  it('SENESCENCE gate: without SENESCENCE, old particles survive the tick', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.AGE] = 1000;
      v[b + S.DNA_CACHE_START + 11] = 500;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.LIFE);
    solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    expect(view[S.DEAD]).toBe(0);
  });

  it('SENESCENCE gate: senescence is nested inside LIFE and never fires alone', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.AGE] = 1000;
      v[b + S.DNA_CACHE_START + 11] = 500;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.SENESCENCE);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    expect(view[S.DEAD]).toBe(0);
  });

  it('ENERGY: every energy pool (LIFE/ELECTRIC/STORED) conducts toward equilibrium', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1050;
      if (i === 0) {
        v[b + S.ENERGY] = 10;
        v[b + S.ELECTRIC_ENERGY] = 20;
        v[b + S.STORED_ENERGY] = 30;
      } else {
        v[b + S.ENERGY] = 200;
        v[b + S.ELECTRIC_ENERGY] = 150;
        v[b + S.STORED_ENERGY] = 80;
      }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ENERGY);
    expect(isSet(laws, LAW_INDEXES.ENERGY)).toBe(true);
    const cold = [
      view[S.ENERGY], view[S.ELECTRIC_ENERGY], view[S.STORED_ENERGY],
    ];
    const hot = [
      view[PARTICLE_STRIDE + S.ENERGY],
      view[PARTICLE_STRIDE + S.ELECTRIC_ENERGY],
      view[PARTICLE_STRIDE + S.STORED_ENERGY],
    ];
    for (let t = 0; t < 30; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    for (let ch = 0; ch < 3; ch++) {
      const chI = ch === 0 ? S.ENERGY : (ch === 1 ? S.ELECTRIC_ENERGY : S.STORED_ENERGY);
      const coldVal = view[chI];
      const hotVal = view[PARTICLE_STRIDE + chI];
      expect(coldVal).toBeGreaterThan(cold[ch]);               // cold gains
      expect(hotVal).toBeLessThan(hot[ch]);                    // hot loses
      expect(coldVal + hotVal).toBeCloseTo(cold[ch] + hot[ch], 4); // conserved (float-safe)
    }
    // Signal transmission and reproduction drive are NOT energy reservoirs.
    expect(view[S.SIGNAL]).toBe(0);
    expect(view[S.REPRO_DRIVE]).toBe(0);
  });

  it('ENERGY gate: without ENERGY, all energy pools are untouched', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1050;
      if (i === 0) {
        v[b + S.ENERGY] = 10;
        v[b + S.ELECTRIC_ENERGY] = 20;
        v[b + S.STORED_ENERGY] = 30;
      } else {
        v[b + S.ENERGY] = 200;
        v[b + S.ELECTRIC_ENERGY] = 150;
        v[b + S.STORED_ENERGY] = 80;
      }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ENERGY]).toBe(10);
    expect(view[S.ELECTRIC_ENERGY]).toBe(20);
    expect(view[S.STORED_ENERGY]).toBe(30);
    expect(view[PARTICLE_STRIDE + S.ENERGY]).toBe(200);
    expect(view[PARTICLE_STRIDE + S.ELECTRIC_ENERGY]).toBe(150);
    expect(view[PARTICLE_STRIDE + S.STORED_ENERGY]).toBe(80);
  });

  it('RADIATION: exposure accumulates slowly and compounds damage over time', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.ENERGY] = 100;
      v[b + S.ARMOR] = 0;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.RADIATION);
    expect(isSet(laws, LAW_INDEXES.RADIATION)).toBe(true);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    expect(view[S.ENERGY]).toBeLessThan(100);
    // Compounding exposure makes the dose worse than a flat 0.02/tick (98.0).
    expect(view[S.ENERGY]).toBeLessThan(98.0);
    expect(view[S.ENERGY]).toBeGreaterThan(97.0);
    expect(view[S.RADIATION_EXPOSURE]).toBeCloseTo(1.0, 5); // +0.01/tick × 100
  });

  it('RADIATION: RADIATION_LEVEL slider scales damage (0 none, 5 fastest)', () => {
    const run = (level) => {
      const { view, dna } = makeWorld(1, (v, dna, b) => {
        v[b + S.ENERGY] = 100;
        v[b + S.ARMOR] = 0;
      });
      const laws = createLawState();
      set(laws, LAW_INDEXES.RADIATION);
      withWorldParam('RADIATION_LEVEL', level, () => {
        for (let t = 0; t < 50; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
      });
      return view[S.ENERGY];
    };
    expect(run(0)).toBe(100);
    expect(run(1)).toBeLessThan(100);
    expect(run(5)).toBeLessThan(run(1));
  });

  it('RADIATION: full armor fully shields the particle from damage', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.ENERGY] = 100;
      v[b + S.ARMOR] = 1;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.RADIATION);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    expect(view[S.ENERGY]).toBe(100);
  });

  it('RADIATION: energy depletion from radiation kills the particle', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.ENERGY] = 1;
      v[b + S.ARMOR] = 0;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.RADIATION);
    withWorldParam('RADIATION_LEVEL', 5, () => {
      for (let t = 0; t < 50; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    });
    expect(view[S.DEAD]).toBe(1);
  });

  it('RADIATION gate: without RADIATION, energy and exposure are untouched', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.ENERGY] = 100;
      v[b + S.ARMOR] = 0;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
    expect(view[S.ENERGY]).toBe(100);
    expect(view[S.RADIATION_EXPOSURE]).toBe(0);
  });

  it('RADIATION: accumulated dose ramps DNA mutation chance', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1050;
      v[b + S.ENERGY] = 100;
      v[b + S.ARMOR] = 1; // shield damage so only the mutation ramp is observable
      v[b + S.RADIATION_EXPOSURE] = i === 0 ? 100 : 0;
      v[b + S.DNA_CACHE_START + 12] = 0.5; // MUTATION
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.RADIATION);
    const before = new Float32Array(42);
    before.set(view.subarray(S.DNA_CACHE_START, S.DNA_CACHE_START + 42));
    const lowPrng = () => 0.001; // fires whenever mutProb > 0.001
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, lowPrng);
    // Particle 0 (exposure 100 → mutProb 0.1) mutates; particle 1 (exposure
    // 0.01 → mutProb 0.00001) does not.
    expect(changedLoci(view, 0, before)).toBeGreaterThan(0);
    expect(changedLoci(view, PARTICLE_STRIDE, before)).toBe(0);
  });

  it('GENOTYPE: DNA cache drifts over time under temperature stress', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.DNA_CACHE_START + 12] = 5; // MUTATION
      v[b + S.TEMPERATURE] = 10;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.GENOTYPE);
    expect(isSet(laws, LAW_INDEXES.GENOTYPE)).toBe(true);
    const before = new Float32Array(42);
    before.set(view.subarray(S.DNA_CACHE_START, S.DNA_CACHE_START + 42));
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(changedLoci(view, 0, before)).toBeGreaterThan(0);
  });

  it('GENOTYPE: radiation exposure ramps the mutation rate', () => {
    const run = (exposure) => {
      const { view, dna } = makeWorld(1, (v, dna, b) => {
        v[b + S.DNA_CACHE_START + 12] = 5; // MUTATION
        v[b + S.TEMPERATURE] = 10;
        v[b + S.RADIATION_EXPOSURE] = exposure;
      });
      const laws = createLawState();
      set(laws, LAW_INDEXES.GENOTYPE);
      const before = new Float32Array(42);
      before.set(view.subarray(S.DNA_CACHE_START, S.DNA_CACHE_START + 42));
      for (let t = 0; t < 20; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
      return changedLoci(view, 0, before);
    };
    const low = run(0);
    const high = run(100);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
  });

  it('GENOTYPE: rare mutations write back into the species genome', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.DNA_CACHE_START + 12] = 5; // MUTATION
      v[b + S.TEMPERATURE] = 10;
    });
    // CROSSOVER_RATE (43) packed to max 0.5 → writeback chance 0.0001/tick.
    dna[0 * 64 + 43] = 65535;
    const laws = createLawState();
    set(laws, LAW_INDEXES.GENOTYPE);
    const before = new Float32Array(42);
    for (let d = 0; d < 42; d++) before[d] = dna[0 * 64 + d];
    const tinyPrng = () => 1e-7; // below every writeback probability
    for (let t = 0; t < 20; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, tinyPrng);
    let changed = 0;
    for (let d = 0; d < 42; d++) {
      if (dna[0 * 64 + d] !== before[d]) changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });

  it('GENOTYPE gate: without GENOTYPE, the DNA cache is untouched', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.DNA_CACHE_START + 12] = 5;
      v[b + S.TEMPERATURE] = 10;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    const before = new Float32Array(42);
    before.set(view.subarray(S.DNA_CACHE_START, S.DNA_CACHE_START + 42));
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(changedLoci(view, 0, before)).toBe(0);
  });
});
