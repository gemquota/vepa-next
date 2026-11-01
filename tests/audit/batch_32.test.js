// AUDIT AGENT 4 — Wave 2, Batch 32: SPECTRAL(124) / WAVEFUNCTION(125) / HYPERPLANE(126) / ANTIMATTER(127)
import { describe, it, expect } from 'vitest';
import {
  LAW_INDEXES, PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES as S, DNA_RANGES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';
import { applySpectral, applyWavefunction, applyHyperplane, applyAntimatter } from '../../src/physics/lawgroups/quantumLaws.js';

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

describe('Batch 32 — SPECTRAL / WAVEFUNCTION / HYPERPLANE / ANTIMATTER (indices 124-127)', () => {
  it('SPECTRAL emits a species-tagged SIGNAL tone', () => {
    // Direct: species 3 → SIGNAL += 0.001 + 0.001*(3%5) = 0.004
    const buf = new Float32Array(1 * PARTICLE_STRIDE);
    buf[S.SPECIES_ID] = 3;
    const result = applySpectral(buf, 0, 1);
    expect(result).toBeNull();
    expect(buf[S.SIGNAL]).toBeCloseTo(0.004, 5);

    // Integration: solver k=0.5 → SIGNAL grows to ~0.01 over 5 ticks
    const w = makeWorld(1);
    w.view[S.SPECIES_ID] = 3;
    const st = createLawState();
    set(st, LAW_INDEXES.SPECTRAL);
    expect(isSet(st, LAW_INDEXES.SPECTRAL)).toBe(true);
    for (let t = 0; t < 5; t++) solve(w.view, 1, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngHigh);
    expect(w.view[S.SIGNAL]).toBeGreaterThan(0.005);

    // Gate: no law → no signal
    const w2 = makeWorld(1);
    const none = createLawState();
    for (let t = 0; t < 5; t++) solve(w2.view, 1, PARTICLE_STRIDE, none, w2.dna, WORLD, DT, rngHigh);
    expect(w2.view[S.SIGNAL]).toBe(0);
  });

  it('WAVEFUNCTION snaps position onto the wave grid', () => {
    // Direct: q = 0.5 → 100.3 → 100.5
    const buf = new Float32Array(1 * PARTICLE_STRIDE);
    buf[S.POS_X] = 100.3;
    const result = applyWavefunction(buf, 0, 1);
    expect(result).toBeNull();
    expect(buf[S.POS_X]).toBeCloseTo(100.5, 5);

    // Integration: solver k=0.5 → q = 0.25 → 100.3 → 100.25
    const w = makeWorld(1);
    w.view[S.POS_X] = 100.3;
    const st = createLawState();
    set(st, LAW_INDEXES.WAVEFUNCTION);
    expect(isSet(st, LAW_INDEXES.WAVEFUNCTION)).toBe(true);
    solve(w.view, 1, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngHigh);
    expect(w.view[S.POS_X]).toBeCloseTo(100.25, 5);

    // Gate: no law → position unchanged
    const w2 = makeWorld(1);
    w2.view[S.POS_X] = 100.3;
    const none = createLawState();
    solve(w2.view, 1, PARTICLE_STRIDE, none, w2.dna, WORLD, DT, rngHigh);
    expect(w2.view[S.POS_X]).toBeCloseTo(100.3, 5);
  });

  it('HYPERPLANE applies a constant slow shear force', () => {
    // Direct: k=1 → ax 0.001, ay 0.0005, az 0.0002
    const buf = new Float32Array(1 * PARTICLE_STRIDE);
    const f = applyHyperplane(buf, 0, 1);
    expect(f.ax).toBeCloseTo(0.001, 6);
    expect(f.ay).toBeCloseTo(0.0005, 6);
    expect(f.az).toBeCloseTo(0.0002, 6);

    // Integration: solver k=1.0 → velocity accumulates shear
    const w = makeWorld(1);
    const st = createLawState();
    set(st, LAW_INDEXES.HYPERPLANE);
    expect(isSet(st, LAW_INDEXES.HYPERPLANE)).toBe(true);
    for (let t = 0; t < 5; t++) solve(w.view, 1, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngHigh);
    expect(w.view[S.VEL_X]).toBeGreaterThan(1e-5);
    expect(w.view[S.VEL_Y]).toBeGreaterThan(1e-5);

    // Gate: no law → velocity stays 0
    const w2 = makeWorld(1);
    const none = createLawState();
    for (let t = 0; t < 5; t++) solve(w2.view, 1, PARTICLE_STRIDE, none, w2.dna, WORLD, DT, rngHigh);
    expect(w2.view[S.VEL_X]).toBe(0);
  });

  it('ANTIMATTER annihilates opposite-charge pairs on contact', () => {
    // Direct: CHARGE +1/-1 → both DEAD=1, SIGNAL burst 10
    const buf = new Float32Array(2 * PARTICLE_STRIDE);
    buf[base(0) + S.CHARGE] = 1;
    buf[base(1) + S.CHARGE] = -1;
    const result = applyAntimatter(buf, base(0), base(1), 1);
    expect(result).toBeNull();
    expect(buf[base(0) + S.DEAD]).toBe(1);
    expect(buf[base(1) + S.DEAD]).toBe(1);
    expect(buf[base(0) + S.SIGNAL]).toBe(10);
    expect(buf[base(1) + S.SIGNAL]).toBe(10);

    // Integration: solver k=0.5 → both annihilated, signal burst
    const w = makeWorld(2, 5);
    w.view[S.CHARGE] = 1;
    w.view[PARTICLE_STRIDE + S.CHARGE] = -1;
    const st = createLawState();
    set(st, LAW_INDEXES.ANTIMATTER);
    expect(isSet(st, LAW_INDEXES.ANTIMATTER)).toBe(true);
    solve(w.view, 2, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngHigh);
    expect(w.view[S.DEAD]).toBe(1);
    expect(w.view[PARTICLE_STRIDE + S.DEAD]).toBe(1);
    expect(w.view[S.SIGNAL]).toBeGreaterThan(0);
    expect(w.view[PARTICLE_STRIDE + S.SIGNAL]).toBeGreaterThan(0);

    // Gate: no law → both alive, no signal
    const w2 = makeWorld(2, 5);
    w2.view[S.CHARGE] = 1;
    w2.view[PARTICLE_STRIDE + S.CHARGE] = -1;
    const none = createLawState();
    solve(w2.view, 2, PARTICLE_STRIDE, none, w2.dna, WORLD, DT, rngHigh);
    expect(w2.view[S.DEAD]).toBe(0);
    expect(w2.view[PARTICLE_STRIDE + S.DEAD]).toBe(0);
    expect(w2.view[S.SIGNAL]).toBe(0);
  });
});
