import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D, DNA_RANGES, LAW_INDEXES, MAX_PARTICLES } from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults, getDNAFloat } from '../../src/dna/dnaBuffer.js';
import { applyStoichiometry, applyAutocatalysis } from '../../src/physics/lawgroups/chemistryLaws.js';
import { applyAdiabatic, applyCompression } from '../../src/physics/lawgroups/thermoLaws.js';
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

describe('Batch 25 — STOICHIOMETRY / AUTOCATALYSIS / ADIABATIC / COMPRESSION', () => {
  it('STOICHIOMETRY (96): redistributes mass while conserving the pair total', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.MASS] = 1;
    buf[PARTICLE_STRIDE + S.MASS] = 2;
    const result = applyStoichiometry(buf, 0, PARTICLE_STRIDE, 1);
    expect(result).toBeNull();
    expect(buf[S.MASS]).toBeCloseTo(1.005, 5); // 1 - (1-2)*0.005
    expect(buf[PARTICLE_STRIDE + S.MASS]).toBeCloseTo(1.995, 5);
    expect(buf[S.MASS] + buf[PARTICLE_STRIDE + S.MASS]).toBeCloseTo(3, 6);
  });

  it('STOICHIOMETRY integration: mass converges only when enabled', () => {
    const on = makeWorld(2, (v) => {
      v[S.MASS] = 1;
      v[PARTICLE_STRIDE + S.MASS] = 2;
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.STOICHIOMETRY);
    expect(isSet(st, LAW_INDEXES.STOICHIOMETRY)).toBe(true);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.MASS]).toBeGreaterThan(1);
    expect(on.view[PARTICLE_STRIDE + S.MASS]).toBeLessThan(2);
    expect(on.view[S.MASS] + on.view[PARTICLE_STRIDE + S.MASS]).toBeCloseTo(3, 6);

    const off = makeWorld(2, (v) => {
      v[S.MASS] = 1;
      v[PARTICLE_STRIDE + S.MASS] = 2;
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.MASS]).toBe(1);
    expect(off.view[PARTICLE_STRIDE + S.MASS]).toBe(2);
  });

  it('AUTOCATALYSIS (97): same-species energy boost scaled by CATALYSIS DNA', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.SPECIES_ID] = 7;
    buf[PARTICLE_STRIDE + S.SPECIES_ID] = 7;
    buf[S.DNA_CACHE_START + D.CATALYSIS] = 1.5;
    buf[PARTICLE_STRIDE + S.DNA_CACHE_START + D.CATALYSIS] = 1.5;
    const result = applyAutocatalysis(buf, 0, PARTICLE_STRIDE, 1);
    expect(result).toBeNull();
    expect(buf[S.ENERGY]).toBeCloseTo(100.15, 5); // +0.1*1*1.5
    expect(buf[PARTICLE_STRIDE + S.ENERGY]).toBeCloseTo(100.15, 5);
    // cross-species pair → no boost
    const buf2 = view(2);
    seed(buf2, 2);
    buf2[S.SPECIES_ID] = 0;
    buf2[PARTICLE_STRIDE + S.SPECIES_ID] = 1;
    applyAutocatalysis(buf2, 0, PARTICLE_STRIDE, 1);
    expect(buf2[S.ENERGY]).toBe(100);
  });

  it('AUTOCATALYSIS integration: same-species pair gains energy in solve()', () => {
    const on = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      v[S.DNA_CACHE_START + D.CATALYSIS] = 1.5;
      v[PARTICLE_STRIDE + S.DNA_CACHE_START + D.CATALYSIS] = 1.5;
      // REACTION_THRESHOLD DNA (37): lower the mass gate so default-mass reacts.
      v[S.DNA_CACHE_START + D.REACTION_THRESHOLD] = 1;
      v[PARTICLE_STRIDE + S.DNA_CACHE_START + D.REACTION_THRESHOLD] = 1;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.AUTOCATALYSIS);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.ENERGY]).toBeGreaterThan(100);
    expect(on.view[PARTICLE_STRIDE + S.ENERGY]).toBeGreaterThan(100);

    const off = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      v[S.DNA_CACHE_START + D.CATALYSIS] = 1.5;
      v[PARTICLE_STRIDE + S.DNA_CACHE_START + D.CATALYSIS] = 1.5;
      v[S.DNA_CACHE_START + D.REACTION_THRESHOLD] = 1;
      v[PARTICLE_STRIDE + S.DNA_CACHE_START + D.REACTION_THRESHOLD] = 1;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.ENERGY]).toBe(100);
  });

  it('ADIABATIC (98): kinetic energy converts to temperature with drag', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.VEL_X] = 4; // speed 4, mass 1.5
    const f = applyAdiabatic(buf, 0, 0.1);
    expect(f).not.toBeNull();
    const dv = 4 * 0.1;
    expect(f.ax).toBeCloseTo(-dv, 5);
    expect(buf[S.TEMPERATURE]).toBeCloseTo(0.5 * 1.5 * (16 - (4 - dv) * (4 - dv)), 5);
    // stationary particle → no conversion
    const idle = view(1);
    seed(idle, 1);
    expect(applyAdiabatic(idle, 0, 0.1)).toBeNull();
  });

  it('ADIABATIC integration: moving particle heats up and slows down', () => {
    const on = makeWorld(1, (v) => {
      v[S.VEL_X] = 4;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.ADIABATIC);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.TEMPERATURE]).toBeGreaterThan(0);
    expect(on.view[S.VEL_X]).toBeLessThan(4);

    const off = makeWorld(1, (v) => {
      v[S.VEL_X] = 4;
    });
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.TEMPERATURE]).toBe(0);
    expect(off.view[S.VEL_X]).toBe(4);
  });

  it('COMPRESSION (99): touching particles shrink and heat', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[PARTICLE_STRIDE + S.POS_X] = 101; // dist = 1 < (rI+rJ)*2 = 2.4
    const result = applyCompression(buf, 0, PARTICLE_STRIDE, 1, 0.5);
    expect(result).toBeNull();
    expect(buf[S.RADIUS]).toBeCloseTo(0.45, 5); // 0.6 - min(0.3, 0.15)
    expect(buf[PARTICLE_STRIDE + S.RADIUS]).toBeCloseTo(0.45, 5);
    expect(buf[S.TEMPERATURE]).toBeCloseTo(0.5, 5);
    expect(buf[PARTICLE_STRIDE + S.TEMPERATURE]).toBeCloseTo(0.5, 5);
    // beyond contact threshold → no effect
    const far = view(2);
    seed(far, 2);
    far[PARTICLE_STRIDE + S.POS_X] = 104; // dist 4 >= 2.4
    applyCompression(far, 0, PARTICLE_STRIDE, 4, 0.5);
    expect(far[S.RADIUS]).toBeCloseTo(0.6, 5);
    expect(far[S.TEMPERATURE]).toBe(0);
  });

  it('COMPRESSION integration: overlapping pair shrinks and heats in solve()', () => {
    const on = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.POS_X] = 101;
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.COMPRESSION);
    expect(isSet(st, LAW_INDEXES.COMPRESSION)).toBe(true);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.RADIUS]).toBeLessThan(0.6);
    expect(on.view[PARTICLE_STRIDE + S.RADIUS]).toBeLessThan(0.6);
    expect(on.view[S.TEMPERATURE]).toBeGreaterThan(0);
    expect(on.view[PARTICLE_STRIDE + S.TEMPERATURE]).toBeGreaterThan(0);

    const off = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.POS_X] = 101;
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.RADIUS]).toBeCloseTo(0.6, 5);
    expect(off.view[S.TEMPERATURE]).toBe(0);
  });
});
