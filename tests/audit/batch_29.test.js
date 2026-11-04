// AUDIT AGENT 4 — Wave 2, Batch 29: SUPERPOSITION(112) / TUNNELING(113) / DECOHERENCE(114) / WAVE_PARTICLE(115)
import { describe, it, expect } from 'vitest';
import {
  LAW_INDEXES, PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES as S, DNA_RANGES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';
import { applySuperposition, applyTunneling, applyDecoherence, applyWaveParticle } from '../../src/physics/lawgroups/quantumLaws.js';

const WORLD = 2000;
const DT = 0.25;
const rngHigh = () => 0.9;    // deterministic > 0.5
const rngLow = () => 0.0009;  // deterministic < 0.005 thresholds

function makeWorld(count) {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const view = buf.view;
  const dna = createDNABuffer();
  loadDefaults(dna, DNA_RANGES);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 100;
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

describe('Batch 29 — SUPERPOSITION / TUNNELING / DECOHERENCE / WAVE_PARTICLE (indices 112-115)', () => {
  it('SUPERPOSITION drifts without collapse and collapses by the L2 Born rule', () => {
    // Direct (no collapse, prng 0.9 ≥ 0.02·k): gentle interference drift from
    // the rotating phase — the amplitude state is untouched.
    const buf = new Float32Array(1 * PARTICLE_STRIDE);
    const f = applySuperposition(buf, 0, 1, rngHigh);
    expect(f.ax).toBeCloseTo(Math.sin(0.05) * 0.05, 6);
    expect(f.ay).toBeCloseTo(Math.cos(0.05) * 0.05, 6);

    // Direct collapse with unnormalised amplitudes: the L2 Born draw
    // (p = |a|²/Σ|a|²) samples basis 0 for r = 0.25·norm².
    const c = new Float32Array(1 * PARTICLE_STRIDE);
    c[S.SUPER_AMP_1] = 0.5;
    c[S.SUPER_AMP_2] = 0.5;
    let draw = 0;
    const seq = () => (draw++ === 0 ? 0.01 : 0.5);
    const cf = applySuperposition(c, 0, 1, seq);
    expect(cf.ax).toBe(0); // basis 0 = stay
    expect(c[S.SUPER_AMP_1]).toBeCloseTo(0.85, 6); // 1 − 3·0.05 re-spread

    // Integration: drift force (k=0.05) moves the velocity; gate off → frozen.
    const w = makeWorld(1);
    const st = createLawState();
    set(st, LAW_INDEXES.SUPERPOSITION);
    expect(isSet(st, LAW_INDEXES.SUPERPOSITION)).toBe(true);
    solve(w.view, 1, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngHigh);
    expect(Math.abs(w.view[S.VEL_X])).toBeGreaterThan(1e-9);

    // Gate: no law → frozen
    const w2 = makeWorld(1);
    const none = createLawState();
    solve(w2.view, 1, PARTICLE_STRIDE, none, w2.dna, WORLD, DT, rngHigh);
    expect(w2.view[S.VEL_X]).toBe(0);
  });

  it('TUNNELING phase-shifts position when triggered', () => {
    // Direct: prng 0.9 < 0.005*200 → hop +3.6 (radius 0.6 × 6)
    const buf = new Float32Array(1 * PARTICLE_STRIDE);
    buf[S.RADIUS] = 0.6;
    buf[S.POS_X] = 100; buf[S.POS_Y] = 100; buf[S.POS_Z] = 100;
    const result = applyTunneling(buf, 0, 200, rngHigh);
    expect(result).toBeNull();
    expect(buf[S.POS_X]).toBeCloseTo(103.6, 4);

    // Integration: solver k=0.5 → 0.0009 < 0.0025 triggers, hop −3.6 → 96.4
    const w = makeWorld(1);
    const st = createLawState();
    set(st, LAW_INDEXES.TUNNELING);
    expect(isSet(st, LAW_INDEXES.TUNNELING)).toBe(true);
    solve(w.view, 1, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngLow);
    expect(w.view[S.POS_X]).toBeCloseTo(96.4, 1);

    // Gate: no law → position frozen
    const w2 = makeWorld(1);
    const none = createLawState();
    solve(w2.view, 1, PARTICLE_STRIDE, none, w2.dna, WORLD, DT, rngLow);
    expect(w2.view[S.POS_X]).toBe(100);
  });

  it('DECOHERENCE damps velocity and radiates SIGNAL', () => {
    // Direct: VEL 5 → ax = −5*0.01*1 = −0.05, SIGNAL += 0.001
    const buf = new Float32Array(1 * PARTICLE_STRIDE);
    buf[S.VEL_X] = 5;
    const f = applyDecoherence(buf, 0, 1);
    expect(f.ax).toBeCloseTo(-0.05, 5);
    expect(buf[S.SIGNAL]).toBeCloseTo(0.001, 5);

    // Integration: solver k=0.1 → slow damping + signal growth over 10 ticks
    const w = makeWorld(1);
    w.view[S.VEL_X] = 5;
    const st = createLawState();
    set(st, LAW_INDEXES.DECOHERENCE);
    expect(isSet(st, LAW_INDEXES.DECOHERENCE)).toBe(true);
    for (let t = 0; t < 10; t++) solve(w.view, 1, PARTICLE_STRIDE, st, w.dna, WORLD, DT, rngHigh);
    expect(w.view[S.VEL_X]).toBeLessThan(5 - 0.001);
    expect(w.view[S.SIGNAL]).toBeGreaterThan(0.0005);

    // Gate: no law → velocity and signal frozen
    const w2 = makeWorld(1);
    w2.view[S.VEL_X] = 5;
    const none = createLawState();
    for (let t = 0; t < 10; t++) solve(w2.view, 1, PARTICLE_STRIDE, none, w2.dna, WORLD, DT, rngHigh);
    expect(w2.view[S.VEL_X]).toBe(5);
    expect(w2.view[S.SIGNAL]).toBe(0);
  });

  it('WAVE_PARTICLE spreads unmeasured particles as waves and accelerates measured ones', () => {
    // Direct: unmeasured slow particle → perpendicular de Broglie drift (no damping).
    const wave = new Float32Array(1 * PARTICLE_STRIDE);
    wave[S.VEL_X] = 0.2;
    const waveForce = applyWaveParticle(wave, 0, 1);
    expect(waveForce.ax).toBeCloseTo(0, 6); // perpendicular to v
    expect(waveForce.ay).toBeCloseTo(0.02, 6); // inv(0.2)·0.02·(0.5 + 0.5·sin 0)

    // Measured particle → localised, accelerates along velocity; flag decays.
    const part = new Float32Array(1 * PARTICLE_STRIDE);
    part[S.VEL_X] = 5;
    part[S.WAVE_MEASURED] = 1;
    expect(applyWaveParticle(part, 0, 1).ax).toBeCloseTo(0.05, 5);
    expect(part[S.WAVE_MEASURED]).toBeCloseTo(0.95, 6);

    // Integration: a measured particle accelerates (VEL grows).
    const wf = makeWorld(1);
    wf.view[S.VEL_X] = 5;
    wf.view[S.WAVE_MEASURED] = 1;
    const st = createLawState();
    set(st, LAW_INDEXES.WAVE_PARTICLE);
    expect(isSet(st, LAW_INDEXES.WAVE_PARTICLE)).toBe(true);
    for (let t = 0; t < 10; t++) solve(wf.view, 1, PARTICLE_STRIDE, st, wf.dna, WORLD, DT, rngHigh);
    expect(wf.view[S.VEL_X]).toBeGreaterThan(5);

    // Integration: an unmeasured particle spreads perpendicular — forward
    // speed is preserved (no damping).
    const ws = makeWorld(1);
    ws.view[S.VEL_X] = 0.2;
    for (let t = 0; t < 30; t++) solve(ws.view, 1, PARTICLE_STRIDE, st, ws.dna, WORLD, DT, rngHigh);
    expect(ws.view[S.VEL_X]).toBeCloseTo(0.2, 2);
  });
});
