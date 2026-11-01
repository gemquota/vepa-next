// AUDIT AGENT 4 — Wave 2, Batch 31: COHERENCE(120) / BOSONIC(121) / FERMIONIC(122) / SPIN(123)
import { describe, it, expect } from 'vitest';
import {
  LAW_INDEXES, PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES as S, DNA_RANGES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';
import { applyCoherence, applyBosonic, applyFermionic, applySpin } from '../../src/physics/lawgroups/quantumLaws.js';

const WORLD = 2000;
const DT = 0.25;
const rngHigh = () => 0.9;
const base = (i) => i * PARTICLE_STRIDE;

function makeWorld(count, spacing = 5) {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const view = buf.view;
  const dna = createDNABuffer();
  loadDefaults(dna, DNA_RANGES);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 100 + i * spacing;
    view[b + S.POS_Y] = 100;
    view[b + S.POS_Z] = 100;
    view[b + S.VEL_X] = 0;
    view[b + S.VEL_Y] = 0;
    view[b + S.VEL_Z] = 0;
    view[b + S.MASS] = 1.5;
    view[b + S.SPECIES_ID] = i;
    view[b + S.DEAD] = 0;
    view[b + S.AGE] = 0;
    view[b + S.ENERGY] = 100;
    view[b + S.SIGNAL] = 0;
    view[b + S.MEMORY] = 0;
    view[b + S.CHARGE] = 0;
    view[b + S.TEMPERATURE] = 0;
    view[b + S.RADIUS] = 0.6;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      view[b + S.DNA_CACHE_START + d] = r.default ?? 0;
    }
  }
  return { view, dna };
}

function pairDist(view) {
  return Math.hypot(
    view[S.POS_X] - view[PARTICLE_STRIDE + S.POS_X],
    view[S.POS_Y] - view[PARTICLE_STRIDE + S.POS_Y],
    view[S.POS_Z] - view[PARTICLE_STRIDE + S.POS_Z],
  );
}

describe('Batch 31 — COHERENCE / BOSONIC / FERMIONIC / SPIN (indices 120-123)', () => {
  it('COHERENCE phase-locks similar neighbour velocities', () => {
    // Direct: p1 VEL 0.5, diff < 1 → ax = (0.5-0)*0.02 = 0.01
    const buf = new Float32Array(2 * PARTICLE_STRIDE);
    buf[base(1) + S.VEL_X] = 0.5;
    const f = applyCoherence(buf, base(0), base(1), 1);
    expect(f.ax).toBeCloseTo(0.01, 5);

    // Integration: relative velocity shrinks over 30 ticks
    const w = makeWorld(2, 5);
    w.view[PARTICLE_STRIDE + S.VEL_X] = 0.5;
    const st = createLawState();
    set(st, LAW_INDEXES.COHERENCE);
    expect(isSet(st, LAW_INDEXES.COHERENCE)).toBe(true);
    const rel0 = Math.abs(w.view[S.VEL_X] - w.view[PARTICLE_STRIDE + S.VEL_X]);
    for (let t = 0; t < 30; t++) solve(w.view, 2, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngHigh);
    const rel1 = Math.abs(w.view[S.VEL_X] - w.view[PARTICLE_STRIDE + S.VEL_X]);
    expect(rel1).toBeLessThan(rel0);

    // Gate: no law → relative velocity preserved
    const w2 = makeWorld(2, 5);
    w2.view[PARTICLE_STRIDE + S.VEL_X] = 0.5;
    const none = createLawState();
    for (let t = 0; t < 30; t++) solve(w2.view, 2, PARTICLE_STRIDE, none, w2.dna, WORLD, DT, rngHigh);
    expect(Math.abs(w2.view[S.VEL_X] - w2.view[PARTICLE_STRIDE + S.VEL_X])).toBe(0.5);
  });

  it('BOSONIC attracts particles within short range (glue)', () => {
    // Direct: dist 2 < 3 → scale (3-2)*1 = 1 → ax = 1
    const buf = new Float32Array(2 * PARTICLE_STRIDE);
    const f = applyBosonic(buf, base(0), base(1), 2, 0, 0, 2, 1);
    expect(f.ax).toBeCloseTo(1, 5);
    expect(applyBosonic(buf, base(0), base(1), 4, 0, 0, 4, 1)).toBeNull();

    // Integration: pair 2 apart → dist shrinks (collision floor ~1.2)
    const w = makeWorld(2, 2);
    const st = createLawState();
    set(st, LAW_INDEXES.BOSONIC);
    expect(isSet(st, LAW_INDEXES.BOSONIC)).toBe(true);
    const d0 = pairDist(w.view);
    for (let t = 0; t < 10; t++) solve(w.view, 2, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngHigh);
    expect(pairDist(w.view)).toBeLessThan(d0 - 0.2);

    // Gate: no law → dist unchanged
    const w2 = makeWorld(2, 2);
    const none = createLawState();
    for (let t = 0; t < 10; t++) solve(w2.view, 2, PARTICLE_STRIDE, none, w2.dna, WORLD, DT, rngHigh);
    expect(pairDist(w2.view)).toBe(2);
  });

  it('FERMIONIC pushes overlapping particles apart (exclusion)', () => {
    // Direct: rSum 1.2, dist 1 → scale (1-1/1.2)*5 = 0.833 → ax < 0
    const buf = new Float32Array(2 * PARTICLE_STRIDE);
    buf[S.RADIUS] = 0.6;
    buf[PARTICLE_STRIDE + S.RADIUS] = 0.6;
    const f = applyFermionic(buf, base(0), base(1), 1, 0, 0, 1, 1);
    expect(f.ax).toBeLessThan(0);
    expect(applyFermionic(buf, base(0), base(1), 2, 0, 0, 2, 1)).toBeNull();

    // Integration: overlapping pair (dist 0.8 < rSum 1.2) separates
    const w = makeWorld(2, 0.8);
    const st = createLawState();
    set(st, LAW_INDEXES.FERMIONIC);
    expect(isSet(st, LAW_INDEXES.FERMIONIC)).toBe(true);
    const d0 = pairDist(w.view);
    for (let t = 0; t < 10; t++) solve(w.view, 2, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngHigh);
    expect(pairDist(w.view)).toBeGreaterThan(d0 + 0.05);

    // Gate: no law → dist unchanged
    const w2 = makeWorld(2, 0.8);
    const none = createLawState();
    for (let t = 0; t < 10; t++) solve(w2.view, 2, PARTICLE_STRIDE, none, w2.dna, WORLD, DT, rngHigh);
    expect(pairDist(w2.view)).toBeCloseTo(0.8, 5);
  });

  it('SPIN applies a perpendicular wiggle with particle-index parity', () => {
    // Direct: even particle (index 0) → +y wiggle; odd particle → −y wiggle
    const buf = new Float32Array(2 * PARTICLE_STRIDE);
    buf[S.VEL_X] = 3;
    const fEven = applySpin(buf, base(0), 1, rngHigh);
    expect(fEven.ay).toBeCloseTo(0.1, 5);

    const buf2 = new Float32Array(2 * PARTICLE_STRIDE);
    buf2[base(1) + S.VEL_X] = 3;
    const fOdd = applySpin(buf2, base(1), 1, rngHigh);
    expect(fOdd.ay).toBeCloseTo(-0.1, 5);

    // Integration: particle 0 (index 0) gets +y, particle 1 (index 1) gets −y
    const w = makeWorld(2, 5);
    w.view[S.VEL_X] = 3;
    w.view[PARTICLE_STRIDE + S.VEL_X] = 3;
    const st = createLawState();
    set(st, LAW_INDEXES.SPIN);
    expect(isSet(st, LAW_INDEXES.SPIN)).toBe(true);
    for (let t = 0; t < 5; t++) solve(w.view, 2, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngHigh);
    expect(w.view[S.VEL_Y]).toBeGreaterThan(0.001);
    expect(w.view[PARTICLE_STRIDE + S.VEL_Y]).toBeLessThan(-0.001);
  });
});
