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

describe('Batch 22 — Slate Mechanics: CONTACT / MOMENTUM / TORQUE / ADHESION (indices 128-135)', () => {
  it('CONTACT: overlapping particles are pushed apart', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1000.5; // overlap: 0.6+0.6-0.5 = 0.7
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.CONTACT);
    expect(isSet(laws, LAW_INDEXES.CONTACT)).toBe(true);
    const sep0 = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    const sep1 = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    expect(sep1).toBeGreaterThan(sep0);
    expect(sep1).toBeGreaterThan(1.0); // clearly separated, not stuck
  });

  it('CONTACT gate: without CONTACT, separation is unchanged', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1000.5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.BUOYANCY); // inert gate: temperature at ambient 0.5 → no-op
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X]).toBeCloseTo(0.5, 5);
  });

  it('MOMENTUM: velocity exchange moves a moving particle toward the resting one', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1002;   // near neighbours
      v[b + S.VEL_X] = i === 0 ? 2 : 0;          // particle 0 moving +X
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.MOMENTUM);
    expect(isSet(laws, LAW_INDEXES.MOMENTUM)).toBe(true);
    for (let t = 0; t < 10; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    // momentum exchange decays the moving particle's velocity
    expect(view[S.VEL_X]).toBeLessThan(2);
  });

  it('MOMENTUM gate: without MOMENTUM, velocity is preserved', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1002;
      v[b + S.VEL_X] = i === 0 ? 2 : 0;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.BUOYANCY); // inert gate
    for (let t = 0; t < 10; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_X]).toBeCloseTo(2, 5);
  });

  it('TORQUE: relative tangential force appears between neighbours', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1002;
      v[b + S.VEL_Y] = i === 0 ? 0 : 1; // relative tangential velocity
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.TORQUE);
    expect(isSet(laws, LAW_INDEXES.TORQUE)).toBe(true);
    for (let t = 0; t < 40; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    // cross product of the x-offset with the y relative velocity acts on z
    expect(view[S.VEL_Z]).toBeGreaterThan(1e-4);
  });

  it('ADHESION: nearby particles are pulled together', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1002.5; // within contact = 0.6+0.6+2 = 3.2
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ADHESION);
    expect(isSet(laws, LAW_INDEXES.ADHESION)).toBe(true);
    const sep0 = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    const sep1 = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    expect(sep1).toBeLessThan(sep0);
  });

  it('ADHESION gate: without ADHESION, nearby particles stay put', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1002.5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.BUOYANCY); // inert gate
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X]).toBeCloseTo(2.5, 5);
  });

  it('FRAGMENTATION: hard impacts repel the pair', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1003;
      v[b + S.VEL_X] = i === 0 ? 8 : 0; // relative speed 8 > threshold 2
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.FRAGMENTATION);
    expect(isSet(laws, LAW_INDEXES.FRAGMENTATION)).toBe(true);
    const vx0 = view[S.VEL_X];
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    // the impact force opposes the closing velocity: it decays after one tick
    expect(view[S.VEL_X]).toBeLessThan(vx0);
    expect(view[PARTICLE_STRIDE + S.VEL_X]).toBeGreaterThan(0);
  });

  it('slate mechanics laws are inert without their law bit (hard gate)', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1000.5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.BUOYANCY); // inert gate only
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X]).toBeCloseTo(0.5, 5);
  });
});
