import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_RANGES, LAW_INDEXES, MAX_PARTICLES } from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults, getDNAFloat } from '../../src/dna/dnaBuffer.js';
import { setBuffer, applyReduction, applyMelt, applyBoil } from '../../src/physics/laws.js';
import { applyAlloy } from '../../src/physics/mergePhysics.js';
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
    buf[b + S.DEAD] = 0;
    buf[b + S.SPECIES_ID] = 0;
    buf[b + S.TEMPERATURE] = 0;
    buf[b + S.CHARGE] = 0;
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
    v[b + S.CHARGE] = 0;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      v[b + S.DNA_CACHE_START + d] = getDNAFloat(dna, i % 3, d, r.min, r.max);
    }
  }
  if (mutate) mutate(v, dna);
  return { view: v, dna };
}

describe('Batch 11 — REDUCTION / ALLOY / MELT / BOIL', () => {
  it('REDUCTION (40): opposite charges cancel toward zero, same-sign pairs untouched', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.CHARGE] = 1.0;
    buf[PARTICLE_STRIDE + S.CHARGE] = -1.0;
    setBuffer(buf);
    applyReduction(0, PARTICLE_STRIDE, PARTICLE_STRIDE, 1);
    expect(buf[S.CHARGE]).toBeCloseTo(0.95, 5);
    expect(buf[PARTICLE_STRIDE + S.CHARGE]).toBeCloseTo(-0.95, 5);

    // Same-sign charges repel — nothing is neutralized.
    const same = view(2);
    seed(same, 2);
    same[S.CHARGE] = 1.0;
    same[PARTICLE_STRIDE + S.CHARGE] = 0.2;
    setBuffer(same);
    applyReduction(0, PARTICLE_STRIDE, PARTICLE_STRIDE, 1);
    expect(same[S.CHARGE]).toBe(1.0);
    expect(same[PARTICLE_STRIDE + S.CHARGE]).toBeCloseTo(0.2, 5);
  });

  it('REDUCTION integration: opposite charges converge only when law enabled', () => {
    const on = makeWorld(2, (v) => {
      v[S.CHARGE] = 1.0;
      v[PARTICLE_STRIDE + S.CHARGE] = -1.0;
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.REDUCTION);
    expect(isSet(st, LAW_INDEXES.REDUCTION)).toBe(true);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(Math.abs(on.view[S.CHARGE])).toBeLessThan(1.0);
    expect(Math.abs(on.view[PARTICLE_STRIDE + S.CHARGE])).toBeLessThan(1.0);

    const off = makeWorld(2, (v) => {
      v[S.CHARGE] = 1.0;
      v[PARTICLE_STRIDE + S.CHARGE] = -1.0;
      v[PARTICLE_STRIDE + S.SPECIES_ID] = 0;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.CHARGE]).toBe(1.0);
    expect(off.view[PARTICLE_STRIDE + S.CHARGE]).toBe(-1.0);
  });

  it('ALLOY (41): full mass merge + mass-weighted DNA average + colour blend', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[PARTICLE_STRIDE + S.SPECIES_ID] = 1;
    buf[S.DNA_CACHE_START + 0] = 100; // FORCE of the survivor
    buf[PARTICLE_STRIDE + S.DNA_CACHE_START + 0] = 0; // FORCE of the absorbed
    buf[S.COLOR_R] = 255;
    buf[PARTICLE_STRIDE + S.COLOR_B] = 255;
    const state = createLawState();
    set(state, LAW_INDEXES.ALLOY);
    expect(isSet(state, LAW_INDEXES.ALLOY)).toBe(true);
    applyAlloy(state, buf, 0, PARTICLE_STRIDE, PARTICLE_STRIDE, 0.3, 1);
    expect(buf[PARTICLE_STRIDE + S.DEAD]).toBe(1);
    expect(buf[S.MASS]).toBeCloseTo(3.0, 5); // full merge, not 10%
    expect(buf[S.DNA_CACHE_START + 0]).toBeCloseTo(50, 5); // averaged hybrid DNA
    expect(buf[S.COLOR_R]).toBeCloseTo(127.5, 5);
    expect(buf[S.COLOR_B]).toBeCloseTo(127.5, 5);
    // same species → no merge
    const same = view(2);
    seed(same, 2);
    applyAlloy(state, same, 0, PARTICLE_STRIDE, PARTICLE_STRIDE, 0.3, 1);
    expect(same[PARTICLE_STRIDE + S.DEAD]).toBe(0);
    // beyond overlap threshold → no merge
    const far = view(2);
    seed(far, 2);
    far[PARTICLE_STRIDE + S.SPECIES_ID] = 1;
    applyAlloy(state, far, 0, PARTICLE_STRIDE, PARTICLE_STRIDE, 2.0, 1);
    expect(far[PARTICLE_STRIDE + S.DEAD]).toBe(0);
    // gate off → no merge
    const off = view(2);
    seed(off, 2);
    off[PARTICLE_STRIDE + S.SPECIES_ID] = 1;
    applyAlloy(createLawState(), off, 0, PARTICLE_STRIDE, PARTICLE_STRIDE, 0.3, 1);
    expect(off[PARTICLE_STRIDE + S.DEAD]).toBe(0);
  });

  it('ALLOY (v8.0.0): colour blend is mass-weighted — the heavier partner dominates', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[PARTICLE_STRIDE + S.SPECIES_ID] = 1;
    buf[S.MASS] = 1.0;                    // survivor light
    buf[PARTICLE_STRIDE + S.MASS] = 3.0;  // absorbed heavy
    buf[S.COLOR_R] = 0;
    buf[S.COLOR_B] = 255;
    buf[PARTICLE_STRIDE + S.COLOR_R] = 255;
    buf[PARTICLE_STRIDE + S.COLOR_B] = 0;
    const state = createLawState();
    set(state, LAW_INDEXES.ALLOY);
    applyAlloy(state, buf, 0, PARTICLE_STRIDE, PARTICLE_STRIDE, 0.3, 1);
    expect(buf[PARTICLE_STRIDE + S.DEAD]).toBe(1);
    expect(buf[S.MASS]).toBeCloseTo(4.0, 5);
    // weighted: red 255·3/4, blue 255·1/4
    expect(buf[S.COLOR_R]).toBeCloseTo(191.25, 3);
    expect(buf[S.COLOR_B]).toBeCloseTo(63.75, 3);
  });

  it('ALLOY (v8.0.0): a bonded pair alloys — it does not fuse into one body', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[PARTICLE_STRIDE + S.SPECIES_ID] = 1;
    buf[S.BOND_PARTNER_1] = 1;
    buf[PARTICLE_STRIDE + S.BOND_PARTNER_1] = 0;
    buf[S.BOND_COUNT] = 1;
    buf[PARTICLE_STRIDE + S.BOND_COUNT] = 1;
    const state = createLawState();
    set(state, LAW_INDEXES.ALLOY);
    applyAlloy(state, buf, 0, PARTICLE_STRIDE, PARTICLE_STRIDE, 0.3, 1);
    expect(buf[PARTICLE_STRIDE + S.DEAD]).toBe(0);
    expect(buf[S.MASS]).toBeCloseTo(1.5, 5);
  });

  it('ALLOY integration: overlapping cross-species pair fuses fully in solve()', () => {
    const on = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.POS_X] = 100.3; // dist 0.3
      v[S.DNA_CACHE_START + 0] = 100;
      v[PARTICLE_STRIDE + S.DNA_CACHE_START + 0] = 0;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.ALLOY);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[PARTICLE_STRIDE + S.DEAD]).toBe(1);
    expect(on.view[S.MASS]).toBeGreaterThan(1.5);
    expect(on.view[S.DNA_CACHE_START + 0]).toBeLessThan(100);

    const off = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.POS_X] = 100.3;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[PARTICLE_STRIDE + S.DEAD]).toBe(0);
    expect(off.view[S.MASS]).toBe(1.5);
  });

  it('MELT (42): hot particles lose stiffness (not mass), recover when cool', () => {
    const dna = createDNABuffer();
    loadDefaults(dna, DNA_RANGES);
    const buf = view(1);
    seed(buf, 1);
    buf[S.TEMPERATURE] = 1.0;
    buf[S.DNA_CACHE_START + 8] = 1.0; // STIFFNESS baseline
    const state = createLawState();
    set(state, LAW_INDEXES.MELT);
    expect(isSet(state, LAW_INDEXES.MELT)).toBe(true);
    applyMelt(state, buf, 0, 1, 1, dna);
    expect(buf[S.DNA_CACHE_START + 8]).toBeLessThan(1.0); // softened
    expect(buf[S.DNA_CACHE_START + 8]).toBeGreaterThan(0.19); // 20% floor
    expect(buf[S.MASS]).toBe(1.5); // melting is not mass loss

    // Cool below the melt point → stiffness recovers toward the baseline.
    buf[S.TEMPERATURE] = 0.5;
    applyMelt(state, buf, 0, 1, 1, dna);
    expect(buf[S.DNA_CACHE_START + 8]).toBeGreaterThan(0.99);
    // gate off → unchanged
    const off = view(1);
    seed(off, 1);
    off[S.TEMPERATURE] = 1.0;
    off[S.DNA_CACHE_START + 8] = 1.0;
    applyMelt(createLawState(), off, 0, 1, 1, dna);
    expect(off[S.DNA_CACHE_START + 8]).toBe(1.0);
  });

  it('MELT integration: high-temperature particle softens with law on', () => {
    const on = makeWorld(1, (v) => {
      v[S.TEMPERATURE] = 1.0;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.MELT);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.DNA_CACHE_START + 8]).toBeLessThan(1.0);
    expect(on.view[S.MASS]).toBe(1.5);

    const off = makeWorld(1, (v) => {
      v[S.TEMPERATURE] = 1.0;
    });
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.DNA_CACHE_START + 8]).toBeCloseTo(1.0, 4);
    expect(off.view[S.MASS]).toBe(1.5);
  });

  it('BOIL (43): very hot particles eject mass, burn energy, use the PRNG', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.MASS] = 10;
    buf[S.TEMPERATURE] = 1.0;
    const state = createLawState();
    set(state, LAW_INDEXES.BOIL);
    expect(isSet(state, LAW_INDEXES.BOIL)).toBe(true);
    applyBoil(state, buf, 0, 1, 1, rng);
    expect(buf[S.MASS]).toBeLessThan(10); // ejectMass = 10*0.002 = 0.02 > 0.01
    expect(buf[S.ENERGY]).toBeLessThan(100); // latent heat burn
    expect(buf[S.TEMPERATURE]).toBeLessThan(1.0);
    expect(buf[S.VEL_X]).toBe(0); // deterministic prng (0.5) → no kick
    // below threshold (0.9) → unchanged
    const warm = view(1);
    seed(warm, 1);
    warm[S.MASS] = 10;
    warm[S.TEMPERATURE] = 0.5;
    applyBoil(state, warm, 0, 1, 1, rng);
    expect(warm[S.MASS]).toBe(10);
    // ejection too small (mass 1.5 → ejectMass 0.003 < 0.01) → unchanged
    const small = view(1);
    seed(small, 1);
    small[S.TEMPERATURE] = 1.0;
    applyBoil(state, small, 0, 1, 1, rng);
    expect(small[S.MASS]).toBe(1.5);
    // gate off → unchanged
    const off = view(1);
    seed(off, 1);
    off[S.MASS] = 10;
    off[S.TEMPERATURE] = 1.0;
    applyBoil(createLawState(), off, 0, 1, 1, rng);
    expect(off[S.MASS]).toBe(10);
  });

  it('BOIL integration: hot massive particle ejects mass in solve()', () => {
    const on = makeWorld(1, (v) => {
      v[S.MASS] = 50; // at DT=0.25, ejectMass = 50*0.0005 = 0.025 > 0.01 threshold
      v[S.TEMPERATURE] = 1.0;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.BOIL);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.MASS]).toBeLessThan(50);
    expect(on.view[S.ENERGY]).toBeLessThan(100);

    const off = makeWorld(1, (v) => {
      v[S.MASS] = 50;
      v[S.TEMPERATURE] = 1.0;
    });
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.MASS]).toBe(50);
  });
});
