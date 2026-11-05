import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D, DNA_RANGES, LAW_INDEXES, MAX_PARTICLES } from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults, getDNAFloat } from '../../src/dna/dnaBuffer.js';
import { applyShielding, applyPolarization } from '../../src/physics/lawgroups/emLaws.js';
import { applyNavigation, applyEncryption } from '../../src/physics/lawgroups/infoLaws.js';
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
    buf[b + S.SIGNAL] = 0;
    buf[b + S.MEMORY] = 0;
    buf[b + S.CHARGE] = 0;
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
    v[b + S.SIGNAL] = 0;
    v[b + S.MEMORY] = 0;
    v[b + S.CHARGE] = 0;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      v[b + S.DNA_CACHE_START + d] = getDNAFloat(dna, i % 3, d, r.min, r.max);
    }
  }
  if (mutate) mutate(v, dna);
  return { view: v, dna };
}

describe('Batch 28 — SHIELDING / POLARIZATION / NAVIGATION / ENCRYPTION', () => {
  it('SHIELDING (108): stored charge is drained at an energy cost', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.CHARGE] = 2;
    const result = applyShielding(buf, 0, 1);
    expect(result).toBeNull();
    expect(buf[S.CHARGE]).toBeCloseTo(1.99, 5); // 2 - min(0.01, 2)
    expect(buf[S.ENERGY]).toBeCloseTo(99.95, 5); // 100 - 0.05
    // no charge → nothing to shield
    const neutral = view(1);
    seed(neutral, 1);
    applyShielding(neutral, 0, 1);
    expect(neutral[S.CHARGE]).toBe(0);
    expect(neutral[S.ENERGY]).toBe(100);
  });

  it('SHIELDING integration: charge bleeds off with energy cost in solve()', () => {
    const on = makeWorld(1, (v) => {
      v[S.CHARGE] = 2;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.SHIELDING);
    expect(isSet(st, LAW_INDEXES.SHIELDING)).toBe(true);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.CHARGE]).toBeLessThan(2);
    expect(on.view[S.ENERGY]).toBeLessThan(100);

    const off = makeWorld(1, (v) => {
      v[S.CHARGE] = 2;
    });
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.CHARGE]).toBe(2);
    expect(off.view[S.ENERGY]).toBe(100);
  });

  it('POLARIZATION (109): equal channels exchange signal, mismatch damps', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.DNA_CACHE_START + D.TUNING_CH1] = 0.5;
    buf[PARTICLE_STRIDE + S.DNA_CACHE_START + D.TUNING_CH1] = 0.5;
    buf[S.SIGNAL] = 0;
    buf[PARTICLE_STRIDE + S.SIGNAL] = 2;
    applyPolarization(buf, 0, PARTICLE_STRIDE, 0.5);
    expect(buf[S.SIGNAL]).toBeCloseTo(0.5, 5); // mean 1, t=0.5
    expect(buf[PARTICLE_STRIDE + S.SIGNAL]).toBeCloseTo(1.5, 5);
    expect(buf[S.SIGNAL] + buf[PARTICLE_STRIDE + S.SIGNAL]).toBeCloseTo(2, 5);

    const buf2 = view(2);
    seed(buf2, 2);
    buf2[S.DNA_CACHE_START + D.TUNING_CH1] = 0.5;
    buf2[PARTICLE_STRIDE + S.DNA_CACHE_START + D.TUNING_CH1] = 0.8;
    buf2[S.SIGNAL] = 1;
    buf2[PARTICLE_STRIDE + S.SIGNAL] = 1;
    applyPolarization(buf2, 0, PARTICLE_STRIDE, 1);
    expect(buf2[S.SIGNAL]).toBeCloseTo(0.99, 5);
    expect(buf2[PARTICLE_STRIDE + S.SIGNAL]).toBeCloseTo(0.99, 5);
  });

  it('POLARIZATION integration: tuned pair exchanges signal in solve()', () => {
    const on = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      v[S.SIGNAL] = 0;
      v[PARTICLE_STRIDE + S.SIGNAL] = 2;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.POLARIZATION);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.SIGNAL]).toBeGreaterThan(0);
    expect(on.view[PARTICLE_STRIDE + S.SIGNAL]).toBeLessThan(2);
    expect(on.view[S.SIGNAL] + on.view[PARTICLE_STRIDE + S.SIGNAL]).toBeCloseTo(2, 5);

    const off = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      v[S.SIGNAL] = 0;
      v[PARTICLE_STRIDE + S.SIGNAL] = 2;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.SIGNAL]).toBe(0);
    expect(off.view[PARTICLE_STRIDE + S.SIGNAL]).toBe(2);
  });

  it('NAVIGATION (110): force toward a higher-MEMORY neighbour', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.MEMORY] = 0.2;
    buf[PARTICLE_STRIDE + S.MEMORY] = 0.8;
    const f = applyNavigation(buf, 0, PARTICLE_STRIDE, 3, 4, 0, 5, 0.5);
    expect(f).not.toBeNull();
    expect(f.ax).toBeCloseTo(0.18, 5); // 3/5 * (0.8-0.2)*0.5
    expect(f.ay).toBeCloseTo(0.24, 5);
    expect(f.az).toBe(0);
    // no memory gradient → no force
    buf[S.MEMORY] = 0.9;
    expect(applyNavigation(buf, 0, PARTICLE_STRIDE, 3, 4, 0, 5, 0.5)).toBeNull();
  });

  it('NAVIGATION integration: particle steers toward the memory-rich neighbour', () => {
    const on = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      v[S.MEMORY] = 0.2;
      v[PARTICLE_STRIDE + S.MEMORY] = 0.8;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.NAVIGATION);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.VEL_X]).toBeGreaterThan(0);

    const off = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
      v[S.MEMORY] = 0.2;
      v[PARTICLE_STRIDE + S.MEMORY] = 0.8;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.VEL_X]).toBe(0);
  });

  it('ENCRYPTION (111): encodes the carrier amplitude with the cipher key', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.SIGNAL] = 2;
    const result = applyEncryption(buf, 0, 1);
    expect(result).toBeNull();
    // Default TUNING_CH1-4 → key 0 → amplitude × (0.6 + 0.4·sin 0) = ×0.6.
    expect(buf[S.SIGNAL]).toBeCloseTo(1.2, 5);
    expect(buf[S.PHASE_2]).toBe(0); // key 0 rotates the carrier by nothing

    // A nonzero key rotates PHASE_2 and rescales the carrier differently.
    const keyed = view(1);
    seed(keyed, 1);
    keyed[S.SIGNAL] = 2;
    keyed[S.DNA_CACHE_START + D.TUNING_CH1] = 0.3;
    keyed[S.DNA_CACHE_START + D.TUNING_CH2] = 0.3;
    keyed[S.DNA_CACHE_START + D.TUNING_CH3] = 0.3;
    keyed[S.DNA_CACHE_START + D.TUNING_CH4] = 0.3; // sum 1.2 → key 2
    applyEncryption(keyed, 0, 1);
    expect(keyed[S.PHASE_2]).toBeCloseTo(0.25, 5); // (2/8)·k
    expect(keyed[S.SIGNAL]).toBeCloseTo(2.0, 5);   // 2·(0.6 + 0.4·sin(π/2))
    // silent particles stay silent
    const silent = view(1);
    seed(silent, 1);
    applyEncryption(silent, 0, 1);
    expect(silent[S.SIGNAL]).toBe(0);
  });

  it('ENCRYPTION integration: signal persists above the floor in solve()', () => {
    const on = makeWorld(1, (v) => {
      v[S.SIGNAL] = 2;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.ENCRYPTION);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.SIGNAL]).toBeLessThan(2);
    expect(on.view[S.SIGNAL]).toBeGreaterThanOrEqual(0.05);

    const off = makeWorld(1, (v) => {
      v[S.SIGNAL] = 2;
    });
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.SIGNAL]).toBe(2);
  });
});
