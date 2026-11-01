import { describe, it, expect } from 'vitest';
import {
  PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES as S, DNA_RANGES, LAW_INDEXES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';

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
    view[b + S.CHARGE] = 0;
    view[b + S.RADIUS] = 0.6;
    view[b + S.ENTANGLE_ID] = -1;
    view[b + S.ENTANGLE_PHASE] = 0;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      view[b + S.DNA_CACHE_START + d] = r.default ?? 0;
    }
    if (setup) setup(view, dna, b, i);
  }
  return { view, dna };
}

describe('Batch 23 — SYMBIOSIS / PARASITE / HIBERNATION / IMMUNITY (indices 88-91)', () => {
  it('SYMBIOSIS: different-species contacts transfer energy rich → poor', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.SPECIES_ID] = i;
      v[b + S.POS_X] = i === 0 ? 1000 : 1005;
      v[b + S.ENERGY] = i === 0 ? 100 : 40;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.SYMBIOSIS);
    expect(isSet(laws, LAW_INDEXES.SYMBIOSIS)).toBe(true);
    const total0 = view[S.ENERGY] + view[PARTICLE_STRIDE + S.ENERGY];
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ENERGY]).toBeLessThan(100);
    expect(view[PARTICLE_STRIDE + S.ENERGY]).toBeGreaterThan(40);
    expect(view[S.ENERGY] + view[PARTICLE_STRIDE + S.ENERGY]).toBeCloseTo(total0, 5);
  });

  it('SYMBIOSIS gate: without SYMBIOSIS, energies are untouched', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.SPECIES_ID] = i;
      v[b + S.POS_X] = i === 0 ? 1000 : 1005;
      v[b + S.ENERGY] = i === 0 ? 100 : 40;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ENERGY]).toBe(100);
    expect(view[PARTICLE_STRIDE + S.ENERGY]).toBe(40);
  });

  it('PARASITE: a smaller particle drains energy from a larger host', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      if (i === 0) { v[b + S.POS_X] = 1000; v[b + S.MASS] = 1; }
      else { v[b + S.POS_X] = 1005; v[b + S.MASS] = 5; v[b + S.ENERGY] = 100; }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.PARASITE);
    expect(isSet(laws, LAW_INDEXES.PARASITE)).toBe(true);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ENERGY]).toBeGreaterThan(100);              // parasite gained
    expect(view[PARTICLE_STRIDE + S.ENERGY]).toBeLessThan(100); // host lost
  });

  it('PARASITE gate: without PARASITE, no energy drain', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      if (i === 0) { v[b + S.POS_X] = 1000; v[b + S.MASS] = 1; }
      else { v[b + S.POS_X] = 1005; v[b + S.MASS] = 5; v[b + S.ENERGY] = 100; }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ENERGY]).toBe(100);
    expect(view[PARTICLE_STRIDE + S.ENERGY]).toBe(100);
  });

  it('HIBERNATION: starving particles damp motion and slowly regenerate energy', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.ENERGY] = 20;
      v[b + S.VEL_X] = 5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.HIBERNATION);
    expect(isSet(laws, LAW_INDEXES.HIBERNATION)).toBe(true);
    solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ENERGY]).toBeGreaterThan(20);
    expect(Math.abs(view[S.VEL_X])).toBeLessThan(5);
  });

  it('HIBERNATION gate: well-fed particles (≥ threshold) are not affected', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.ENERGY] = 50;
      v[b + S.VEL_X] = 5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.HIBERNATION);
    for (let t = 0; t < 10; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ENERGY]).toBe(50);
    expect(view[S.VEL_X]).toBeCloseTo(5, 5); // no damping force
  });

  it('IMMUNITY: armour regenerates and energy is restored', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.ARMOR] = 0;
      v[b + S.ENERGY] = 100;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.IMMUNITY);
    expect(isSet(laws, LAW_INDEXES.IMMUNITY)).toBe(true);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ARMOR]).toBeGreaterThan(0.5);
    expect(view[S.ENERGY]).toBeGreaterThan(100);
  });

  it('IMMUNITY gate: without IMMUNITY, armour does not regenerate', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.ARMOR] = 0;
      v[b + S.ENERGY] = 100;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ARMOR]).toBe(0);
  });
});
