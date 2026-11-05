import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D, DNA_RANGES, LAW_INDEXES, MAX_PARTICLES } from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults, getDNAFloat } from '../../src/dna/dnaBuffer.js';
import { applyConsciousness, applyPerception, applySynchronicity } from '../../src/physics/lawgroups/metaLaws.js';
import { applyAntenna } from '../../src/physics/lawgroups/emLaws.js';
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
    buf[b + S.MEMORY] = 0;
    buf[b + S.SIGNAL] = 0;
    buf[b + S.PHASE_1] = 0;
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
    v[b + S.MEMORY] = 0;
    v[b + S.SIGNAL] = 0;
    v[b + S.PHASE_1] = 0;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      v[b + S.DNA_CACHE_START + d] = getDNAFloat(dna, i % 3, d, r.min, r.max);
    }
  }
  if (mutate) mutate(v, dna);
  return { view: v, dna };
}

describe('Batch 27 — CONSCIOUSNESS / PERCEPTION / SYNCHRONICITY / ANTENNA', () => {
  it('CONSCIOUSNESS (104): self-regeneration of ENERGY and MEMORY', () => {
    const buf = view(1);
    seed(buf, 1);
    const result = applyConsciousness(buf, 0, 0.5);
    expect(result).toBeNull();
    // Stationary particle: prediction error ≈ 0 → self-maintenance regen.
    expect(buf[S.ENERGY]).toBeCloseTo(100.005, 5); // +0.01·0.5
    expect(buf[S.MEMORY]).toBe(0);
    // caps respected
    buf[S.ENERGY] = 199.99;
    buf[S.MEMORY] = 0.999;
    applyConsciousness(buf, 0, 1);
    expect(buf[S.ENERGY]).toBeLessThanOrEqual(200);
    expect(buf[S.MEMORY]).toBeLessThanOrEqual(1);
  });

  it('CONSCIOUSNESS: high prediction error drives attention (MEMORY up, ENERGY down)', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.VEL_X] = 10; // speed 10 vs self-model 0 → err ≈ 9.5
    applyConsciousness(buf, 0, 1);
    expect(buf[S.MEMORY]).toBeCloseTo(0.19, 5); // 9.5·0.02
    expect(buf[S.SIGNAL]).toBeCloseTo(0.095, 5); // 9.5·0.01
    expect(buf[S.ENERGY]).toBeCloseTo(99.525, 5); // 100 − 9.5·0.05
  });

  it('CONSCIOUSNESS integration: self-maintenance in solve(), attention with motion', () => {
    const on = makeWorld(1);
    const st = createLawState();
    set(st, LAW_INDEXES.CONSCIOUSNESS);
    expect(isSet(st, LAW_INDEXES.CONSCIOUSNESS)).toBe(true);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.ENERGY]).toBeGreaterThan(100);
    expect(on.view[S.MEMORY]).toBe(0); // stationary → no attention

    const off = makeWorld(1);
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.ENERGY]).toBe(100);
    expect(off.view[S.MEMORY]).toBe(0);

    // A moving particle in an unpredicted state attends.
    const moving = makeWorld(1);
    moving.view[S.VEL_X] = 10;
    solve(moving.view, 1, PARTICLE_STRIDE, st, moving.dna, WORLD, DT, rng);
    expect(moving.view[S.MEMORY]).toBeGreaterThan(0);
  });

  it('PERCEPTION (105): velocity alignment within extended sensing range', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.DNA_CACHE_START + D.NEIGHBORHOOD_RADIUS] = 60; // range = 120
    buf[S.VEL_X] = 1;
    buf[PARTICLE_STRIDE + S.VEL_X] = 2;
    const f = applyPerception(buf, 0, PARTICLE_STRIDE, 50, 1);
    expect(f).not.toBeNull();
    expect(f.ax).toBeCloseTo(0.01, 5); // (2-1)*0.01*1
    // beyond twice the radius → no force
    expect(applyPerception(buf, 0, PARTICLE_STRIDE, 200, 1)).toBeNull();
  });

  it('PERCEPTION integration: idle particle accelerates toward a fast neighbour', () => {
    const on = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      v[PARTICLE_STRIDE + S.VEL_X] = 2;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.PERCEPTION);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.VEL_X]).toBeGreaterThan(0);

    const off = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      v[PARTICLE_STRIDE + S.VEL_X] = 2;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.VEL_X]).toBe(0);
  });

  it('SYNCHRONICITY (106): close phases align velocities and merge phases', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.PHASE_1] = 0.1;
    buf[PARTICLE_STRIDE + S.PHASE_1] = 0.2;
    buf[PARTICLE_STRIDE + S.VEL_X] = 1;
    const f = applySynchronicity(buf, 0, PARTICLE_STRIDE, 1);
    expect(f).not.toBeNull();
    expect(f.ax).toBeCloseTo(0.02, 5); // (1-0)*0.02*1
    expect(buf[S.PHASE_1]).toBeCloseTo(0.15, 5);
    expect(buf[PARTICLE_STRIDE + S.PHASE_1]).toBeCloseTo(0.15, 5);
    // phases too far apart → no interaction
    buf[S.PHASE_1] = 0;
    buf[PARTICLE_STRIDE + S.PHASE_1] = 0.5;
    expect(applySynchronicity(buf, 0, PARTICLE_STRIDE, 1)).toBeNull();
  });

  it('SYNCHRONICITY integration: phases converge and velocity aligns in solve()', () => {
    const on = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      v[S.PHASE_1] = 0.1;
      v[PARTICLE_STRIDE + S.PHASE_1] = 0.2;
      v[PARTICLE_STRIDE + S.VEL_X] = 1;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.SYNCHRONICITY);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.VEL_X]).toBeGreaterThan(0);
    expect(Math.abs(on.view[S.PHASE_1] - on.view[PARTICLE_STRIDE + S.PHASE_1])).toBeLessThan(0.1);

    const off = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      v[S.PHASE_1] = 0.1;
      v[PARTICLE_STRIDE + S.PHASE_1] = 0.2;
      v[PARTICLE_STRIDE + S.VEL_X] = 1;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.VEL_X]).toBe(0);
    expect(off.view[S.PHASE_1]).toBeCloseTo(0.1, 5);
    expect(off.view[PARTICLE_STRIDE + S.PHASE_1]).toBeCloseTo(0.2, 5);
  });

  it('ANTENNA (107): moving emitter with active signal boosts its broadcast', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.SIGNAL] = 1;
    buf[S.VEL_X] = 100; // speed cap 5
    const result = applyAntenna(buf, 0, 1);
    expect(result).toBeNull();
    expect(buf[S.SIGNAL]).toBeCloseTo(1.05, 5); // +min(100,5)*0.01*1
    expect(buf[S.SIGNAL]).toBeLessThanOrEqual(10);
    // silent particle → no boost
    const silent = view(1);
    seed(silent, 1);
    silent[S.SIGNAL] = 0.01;
    applyAntenna(silent, 0, 1);
    expect(silent[S.SIGNAL]).toBeCloseTo(0.01, 5);
  });

  it('ANTENNA integration: signal grows for a moving emitter in solve()', () => {
    const on = makeWorld(1, (v) => {
      v[S.SIGNAL] = 1;
      v[S.VEL_X] = 5;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.ANTENNA);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.SIGNAL]).toBeGreaterThan(1);

    const off = makeWorld(1, (v) => {
      v[S.SIGNAL] = 1;
      v[S.VEL_X] = 5;
    });
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.SIGNAL]).toBe(1);
  });
});
