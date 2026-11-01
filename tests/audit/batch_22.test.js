import { describe, it, expect } from 'vitest';
import {
  PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES as S, DNA_INDEXES as D, DNA_RANGES, LAW_INDEXES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';

const WORLD = 2000;
const DT = 0.25;
const rng = () => 0.5;

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

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

describe('Batch 22 — ELASTICITY / TURBULENCE / CENTRIPETAL / ROTATION (indices 84-87)', () => {
  it('ELASTICITY: overlapping particles are pushed apart', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1000.5; // overlap: 0.6+0.6-0.5 = 0.7
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ELASTICITY);
    expect(isSet(laws, LAW_INDEXES.ELASTICITY)).toBe(true);
    const sep0 = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    const sep1 = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    expect(sep1).toBeGreaterThan(sep0);
    expect(sep1).toBeGreaterThan(1.0); // clearly separated, not stuck
  });

  it('ELASTICITY: ELASTICITY DNA sets the restitution (high bounces more than low)', () => {
    const run = (rest) => {
      const { view, dna } = makeWorld(2, (v, dna, b, i) => {
        v[b + S.POS_X] = i === 0 ? 1000 : 1000.5;
        v[b + S.DNA_CACHE_START + D.ELASTICITY] = rest;
      });
      const laws = createLawState();
      set(laws, LAW_INDEXES.ELASTICITY);
      for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
      return view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    };
    expect(run(1.0)).toBeGreaterThan(run(0.0));
  });

  it('ELASTICITY gate: without ELASTICITY, separation is unchanged', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1000.5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X]).toBeCloseTo(0.5, 5);
  });

  it('TURBULENCE: noise kicks leave a resting particle with nonzero velocity', () => {
    const { view, dna } = makeWorld(1);
    const laws = createLawState();
    set(laws, LAW_INDEXES.TURBULENCE);
    set(laws, LAW_INDEXES.WRAP);
    expect(isSet(laws, LAW_INDEXES.TURBULENCE)).toBe(true);
    const prng = lcg(999);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, prng);
    const speed = Math.hypot(view[S.VEL_X], view[S.VEL_Y], view[S.VEL_Z]);
    expect(speed).toBeGreaterThan(0.05);
  });

  it('TURBULENCE gate: without TURBULENCE, velocity stays zero', () => {
    const { view, dna } = makeWorld(1);
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    const prng = lcg(999);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, prng);
    expect(view[S.VEL_X]).toBe(0);
    expect(view[S.VEL_Y]).toBe(0);
  });

  it('CENTRIPETAL: particles are pulled toward the world centre (∝ distance)', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.POS_X] = 100; v[b + S.POS_Y] = 100; v[b + S.POS_Z] = 100;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.CENTRIPETAL);
    expect(isSet(laws, LAW_INDEXES.CENTRIPETAL)).toBe(true);
    const center = WORLD / 2;
    const d0 = Math.hypot(view[S.POS_X] - center, view[S.POS_Y] - center, view[S.POS_Z] - center);
    for (let t = 0; t < 200; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    const d1 = Math.hypot(view[S.POS_X] - center, view[S.POS_Y] - center, view[S.POS_Z] - center);
    expect(d1).toBeLessThan(d0);
    expect(view[S.VEL_X]).toBeGreaterThan(0);
    expect(view[S.VEL_Y]).toBeGreaterThan(0);
    expect(view[S.VEL_Z]).toBeGreaterThan(0);
  });

  it('CENTRIPETAL gate: without CENTRIPETAL, no central pull', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.POS_X] = 100; v[b + S.POS_Y] = 100; v[b + S.POS_Z] = 100;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 200; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_X]).toBe(0);
    expect(view[S.POS_X]).toBe(100);
  });

  it('ROTATION: tangential force spins the world (perpendicular to the radius)', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.POS_X] = 700;  // offset (−300, 0) from centre (1000,1000)
      v[b + S.POS_Y] = 1000;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ROTATION);
    expect(isSet(laws, LAW_INDEXES.ROTATION)).toBe(true);
    // First impulse is purely tangential: offset (−300, 0) → force (0, −0.6).
    solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_Y]).toBeLessThan(0);
    expect(view[S.VEL_X]).toBeCloseTo(0, 5);
    // Long-run: the swirl carries the particle around the centre (−y drift).
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_Y]).toBeLessThan(0);
    expect(view[S.POS_Y]).toBeLessThan(1000);
  });

  it('ROTATION gate: without ROTATION, no swirl', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.POS_X] = 700;
      v[b + S.POS_Y] = 1000;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_Y]).toBe(0);
    expect(view[S.POS_Y]).toBe(1000);
  });
});
