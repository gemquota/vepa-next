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

describe('Batch 21 — ENTANGLEMENT / HISTORY / TIDE / FRICTION (indices 80-83)', () => {
  it('ENTANGLEMENT: touching particles forge a non-local link (ENTANGLE_ID + PHASE)', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1000.5; // dist 0.5 < rSum + 0.5
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ENTANGLEMENT);
    expect(isSet(laws, LAW_INDEXES.ENTANGLEMENT)).toBe(true);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ENTANGLE_ID]).toBe(1);          // i linked to j
    expect(view[PARTICLE_STRIDE + S.ENTANGLE_ID]).toBe(0);
    expect(view[S.ENTANGLE_PHASE]).toBeGreaterThan(0.9);
    expect(view[PARTICLE_STRIDE + S.ENTANGLE_PHASE]).toBeGreaterThan(0.9);
  });

  it('ENTANGLEMENT: correlation-only — velocities never converge (no-signaling)', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1000.5;
      v[b + S.VEL_X] = i === 0 ? 0 : 5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ENTANGLEMENT);
    for (let t = 0; t < 150; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    const rel = view[S.VEL_X] - view[PARTICLE_STRIDE + S.VEL_X];
    // No momentum travels through the link: the 5-unit gap is preserved.
    expect(Math.abs(rel)).toBeGreaterThan(4.5);
    expect(view[S.VEL_X]).toBe(0);
    expect(view[PARTICLE_STRIDE + S.VEL_X]).toBe(5);
    // The shared correlation decoheres slowly (0.998^150 ≈ 0.74) and stays live.
    expect(view[S.ENTANGLE_ID]).toBe(1);
    expect(view[S.ENTANGLE_PHASE]).toBeCloseTo(0.74, 2);
  });

  it('ENTANGLEMENT: phase decay collapses the shared correlation on both sides', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1000.5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ENTANGLEMENT);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng); // link forms
    expect(view[S.ENTANGLE_ID]).toBe(1);
    // Separate the pair so the contact mechanism cannot re-form the link.
    view[PARTICLE_STRIDE + S.POS_X] = 1800;
    view[S.ENTANGLE_PHASE] = 0.02; // force the decay threshold
    view[PARTICLE_STRIDE + S.ENTANGLE_PHASE] = 0.02;
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ENTANGLE_ID]).toBe(-1);
    expect(view[PARTICLE_STRIDE + S.ENTANGLE_ID]).toBe(-1);
    expect(view[S.ENTANGLE_PHASE]).toBe(0);
    expect(view[PARTICLE_STRIDE + S.ENTANGLE_PHASE]).toBe(0);
  });

  it('ENTANGLEMENT gate: without the law, no link forms', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1000.5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.ENTANGLE_ID]).toBe(-1);
    expect(view[PARTICLE_STRIDE + S.ENTANGLE_ID]).toBe(-1);
  });

  it('HISTORY: particles drift along the local memory-field gradient', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      // Adjacent coarse cells (cell size 166.7): cell 0 and cell 1.
      if (i === 0) { v[b + S.POS_X] = 100; v[b + S.POS_Y] = 100; v[b + S.POS_Z] = 100; }
      else { v[b + S.POS_X] = 267; v[b + S.POS_Y] = 100; v[b + S.POS_Z] = 100; }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.HISTORY);
    expect(isSet(laws, LAW_INDEXES.HISTORY)).toBe(true);
    // Each particle's own presence lands in its cell; the ∇History gradient
    // (wrap-around central differences) then pulls the pair toward the
    // remembered activity: p0 +x, p1 −x.
    for (let t = 0; t < 5; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_X]).toBeGreaterThan(0.001);
    expect(view[PARTICLE_STRIDE + S.VEL_X]).toBeLessThan(-0.001);
  });

  it('HISTORY gate: without the law, no memory drift', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.POS_X] = 100; v[b + S.POS_Y] = 100; v[b + S.POS_Z] = 100;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 200; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.POS_X]).toBe(100);
    expect(view[S.VEL_X]).toBe(0);
  });

  it('TIDE: particles are pulled toward a massive neighbour', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      if (i === 0) { v[b + S.POS_X] = 1000; }
      else { v[b + S.POS_X] = 1100; v[b + S.MASS] = 20; }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.TIDE);
    expect(isSet(laws, LAW_INDEXES.TIDE)).toBe(true);
    const d0 = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    for (let t = 0; t < 100; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    const d1 = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    expect(d1).toBeLessThan(d0);
    expect(view[S.VEL_X]).toBeGreaterThan(0); // light i pulled toward heavy j
  });

  it('TIDE gate: without TIDE, no mass coupling', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      if (i === 0) { v[b + S.POS_X] = 1000; }
      else { v[b + S.POS_X] = 1100; v[b + S.MASS] = 20; }
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 100; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_X]).toBe(0);
    expect(view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X]).toBeCloseTo(100, 5);
  });

  it('FRICTION: velocity-dependent drag slows moving particles and converts motion to heat', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.VEL_X] = 5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.FRICTION);
    set(laws, LAW_INDEXES.WRAP);
    expect(isSet(laws, LAW_INDEXES.FRICTION)).toBe(true);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(Math.abs(view[S.VEL_X])).toBeLessThan(5);
    expect(view[S.VEL_X]).toBeGreaterThan(0);
    expect(view[S.TEMPERATURE]).toBeGreaterThan(0); // kinetic energy dissipates as heat (batch-20)
  });

  it('FRICTION: higher VISCOSITY DNA damps harder (material friction)', () => {
    const run = (viscosity) => {
      const { view, dna } = makeWorld(1, (v, dna, b) => {
        v[b + S.VEL_X] = 5;
        v[b + S.DNA_CACHE_START + D.VISCOSITY] = viscosity;
      });
      const laws = createLawState();
      set(laws, LAW_INDEXES.FRICTION);
      set(laws, LAW_INDEXES.WRAP);
      for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
      return Math.abs(view[S.VEL_X]);
    };
    expect(run(1.0)).toBeLessThan(run(0.5));
  });

  it('FRICTION gate: without FRICTION, velocity is preserved', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.VEL_X] = 5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_X]).toBeCloseTo(5, 5);
  });
});
