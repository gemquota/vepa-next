import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D, DNA_RANGES, LAW_INDEXES, MAX_PARTICLES } from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults, getDNAFloat } from '../../src/dna/dnaBuffer.js';
import { applyExpansion, applyEquilibrium, applyLatentHeat, applyRunaway } from '../../src/physics/lawgroups/thermoLaws.js';
import { solve } from '../../src/physics/solver.js';

const WORLD = 2000;
const DT = 0.25;
const rng = () => 0.5;

function view(n) {
  return new Float32Array(n * PARTICLE_STRIDE);
}

function seed(buf, n) {
  for (let i = 0; i < n; i++) {
    const b = i * PARTICLE_STRIDE;
    buf[b + S.POS_X] = 100;
    buf[b + S.POS_Y] = 100;
    buf[b + S.POS_Z] = 100;
    buf[b + S.VEL_X] = 0;
    buf[b + S.VEL_Y] = 0;
    buf[b + S.VEL_Z] = 0;
    buf[b + S.MASS] = 1.5;
    buf[b + S.RADIUS] = 0.6;
    buf[b + S.ENERGY] = 100;
    buf[b + S.TEMPERATURE] = 0;
    buf[b + S.DEAD] = 0;
    buf[b + S.SPECIES_ID] = 0;
  }
}

function makeWorld(count, mutate) {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const v = buf.view;
  const dna = createDNABuffer();
  loadDefaults(dna, DNA_RANGES);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    v[b + S.POS_X] = 100 + (i % 4) * 50;
    v[b + S.POS_Y] = 100 + Math.floor(i / 4) * 50;
    v[b + S.POS_Z] = 100;
    v[b + S.VEL_X] = 0;
    v[b + S.VEL_Y] = 0;
    v[b + S.VEL_Z] = 0;
    v[b + S.MASS] = 1.5;
    v[b + S.SPECIES_ID] = i % 3;
    v[b + S.DEAD] = 0;
    v[b + S.ENERGY] = 100;
    v[b + S.RADIUS] = 0.6;
    v[b + S.TEMPERATURE] = 0;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      v[b + S.DNA_CACHE_START + d] = getDNAFloat(dna, i % 3, d, r.min, r.max);
    }
  }
  if (mutate) mutate(v, dna);
  return { view: v, dna };
}

describe('Batch 26 — EXPANSION / EQUILIBRIUM / LATENT_HEAT / RUNAWAY', () => {
  it('EXPANSION (100): cold particles grow radius toward base and cool', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.TEMPERATURE] = 0.1; // below 0.3 threshold
    buf[S.DNA_CACHE_START + D.BASE_RADIUS] = 1.2;
    const result = applyExpansion(buf, 0, 0.1);
    expect(result).toBeNull();
    expect(buf[S.RADIUS]).toBeCloseTo(0.66, 5); // 0.6 + (1.2-0.6)*0.1
    expect(buf[S.TEMPERATURE]).toBeCloseTo(0.09, 5); // 0.1 - 0.1*0.1
    // warm particle above threshold → no expansion
    const warm = view(1);
    seed(warm, 1);
    warm[S.TEMPERATURE] = 0.5;
    warm[S.DNA_CACHE_START + D.BASE_RADIUS] = 1.2;
    applyExpansion(warm, 0, 0.1);
    expect(warm[S.RADIUS]).toBeCloseTo(0.6, 5);
  });

  it('EXPANSION integration: isolated cold particle grows past the mass-derived radius', () => {
    // mass 0.3 → mass-derived radius = 1.2 * 0.3^(1/3) ≈ 0.803; expansion adds
    // growth toward the DNA base radius, which must survive the radius update.
    const on = makeWorld(1, (v) => {
      v[S.MASS] = 0.3;
      v[S.TEMPERATURE] = 0.1;
      v[S.DNA_CACHE_START + D.BASE_RADIUS] = 1.2;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.EXPANSION);
    expect(isSet(st, LAW_INDEXES.EXPANSION)).toBe(true);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.RADIUS]).toBeGreaterThan(0.81);
    expect(on.view[S.TEMPERATURE]).toBeLessThan(0.1);

    const off = makeWorld(1, (v) => {
      v[S.MASS] = 0.3;
      v[S.TEMPERATURE] = 0.1;
      v[S.DNA_CACHE_START + D.BASE_RADIUS] = 1.2;
    });
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    // no laws active → hard freeze, radius stays at its seeded value
    expect(off.view[S.RADIUS]).toBeCloseTo(0.6, 5);
  });

  it('EQUILIBRIUM (101): temperature conduction toward the pair mean', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.TEMPERATURE] = 0.2;
    buf[PARTICLE_STRIDE + S.TEMPERATURE] = 0.8;
    const result = applyEquilibrium(buf, 0, PARTICLE_STRIDE, 0.5);
    expect(result).toBeNull();
    expect(buf[S.TEMPERATURE]).toBeCloseTo(0.5, 5);
    expect(buf[PARTICLE_STRIDE + S.TEMPERATURE]).toBeCloseTo(0.5, 5);
  });

  it('EQUILIBRIUM integration: hot/cold pair equalises in solve()', () => {
    const on = makeWorld(2, (v) => {
      v[S.TEMPERATURE] = 0.2;
      v[PARTICLE_STRIDE + S.TEMPERATURE] = 0.8;
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.EQUILIBRIUM);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    // solver applies k=0.3 twice per pair; the gap shrinks 0.6 → ~0.096
    expect(on.view[S.TEMPERATURE]).toBeGreaterThan(0.2);
    expect(on.view[PARTICLE_STRIDE + S.TEMPERATURE]).toBeLessThan(0.8);
    expect(Math.abs(on.view[S.TEMPERATURE] - on.view[PARTICLE_STRIDE + S.TEMPERATURE])).toBeLessThan(0.2);

    const off = makeWorld(2, (v) => {
      v[S.TEMPERATURE] = 0.2;
      v[PARTICLE_STRIDE + S.TEMPERATURE] = 0.8;
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.TEMPERATURE]).toBeCloseTo(0.2, 5);
    expect(off.view[PARTICLE_STRIDE + S.TEMPERATURE]).toBeCloseTo(0.8, 5);
  });

  it('LATENT_HEAT (102): hot → energy absorption, cold → energy release', () => {
    const hot = view(1);
    seed(hot, 1);
    hot[S.TEMPERATURE] = 2.0;
    applyLatentHeat(hot, 0, 0.5);
    expect(hot[S.TEMPERATURE]).toBeCloseTo(1.5, 5);
    expect(hot[S.ENERGY]).toBeCloseTo(100.5, 5);

    const cold = view(1);
    seed(cold, 1);
    cold[S.TEMPERATURE] = -1.0;
    applyLatentHeat(cold, 0, 0.2);
    expect(cold[S.TEMPERATURE]).toBeCloseTo(-0.9, 5);
    expect(cold[S.ENERGY]).toBeCloseTo(99.9, 5);
  });

  it('LATENT_HEAT integration: hot particle converts temperature to energy', () => {
    const on = makeWorld(1, (v) => {
      v[S.TEMPERATURE] = 2.0;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.LATENT_HEAT);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.TEMPERATURE]).toBeLessThan(2.0);
    expect(on.view[S.ENERGY]).toBeGreaterThan(100);

    const off = makeWorld(1, (v) => {
      v[S.TEMPERATURE] = 2.0;
    });
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.TEMPERATURE]).toBe(2.0);
    expect(off.view[S.ENERGY]).toBe(100);
  });

  it('RUNAWAY (103): positive feedback above the temperature threshold', () => {
    const hot = view(1);
    seed(hot, 1);
    hot[S.TEMPERATURE] = 1.5;
    applyRunaway(hot, 0, 2);
    expect(hot[S.TEMPERATURE]).toBeCloseTo(1.5 + 0.49 * 2, 5);

    const cool = view(1);
    seed(cool, 1);
    cool[S.TEMPERATURE] = 0.5;
    applyRunaway(cool, 0, 2);
    expect(cool[S.TEMPERATURE]).toBeCloseTo(0.5, 5);
  });

  it('RUNAWAY integration: hot particle self-heats in solve()', () => {
    const on = makeWorld(1, (v) => {
      v[S.TEMPERATURE] = 1.5;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.RUNAWAY);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.TEMPERATURE]).toBeGreaterThan(1.5);

    const off = makeWorld(1, (v) => {
      v[S.TEMPERATURE] = 1.5;
    });
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.TEMPERATURE]).toBe(1.5);
  });
});
