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

describe('Batch 24 — ELECTROLYSIS / PHOTOLYSIS / PRECIPITATION / NEUTRALIZATION (indices 92-95)', () => {
  it('ELECTROLYSIS: charge imbalance converts mass into energy + signal', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1005;
      v[b + S.CHARGE] = i === 0 ? 1 : 0;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ELECTROLYSIS);
    expect(isSet(laws, LAW_INDEXES.ELECTROLYSIS)).toBe(true);
    const m0 = view[S.MASS];
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.MASS]).toBeLessThan(m0);
    expect(view[S.ENERGY]).toBeGreaterThan(100);
    expect(view[S.SIGNAL]).toBeGreaterThan(0);
  });

  it('ELECTROLYSIS gate: balanced charges (|Δ| ≤ 0.5) do not decompose', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1005;
      v[b + S.CHARGE] = 0.2;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ELECTROLYSIS);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.MASS]).toBe(1.5);
    expect(view[S.SIGNAL]).toBe(0);
  });

  it('PHOTOLYSIS: strong signal converts mass into energy', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.SIGNAL] = 1;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.PHOTOLYSIS);
    expect(isSet(laws, LAW_INDEXES.PHOTOLYSIS)).toBe(true);
    const m0 = view[S.MASS];
    solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.MASS]).toBeLessThan(m0);
    expect(view[S.ENERGY]).toBeGreaterThan(100);
    expect(view[S.SIGNAL]).toBeCloseTo(0.9, 6); // light spent
  });

  it('PHOTOLYSIS gate: weak signal (≤ 0.5) does not decompose', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.SIGNAL] = 0.2;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.PHOTOLYSIS);
    solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.MASS]).toBe(1.5);
    expect(view[S.ENERGY]).toBe(100);
  });

  it('PRECIPITATION: high-energy contacts condense mass and shrink radius', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1005;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.PRECIPITATION);
    expect(isSet(laws, LAW_INDEXES.PRECIPITATION)).toBe(true);
    const m0 = view[S.MASS];
    const r0 = view[S.RADIUS];
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.MASS]).toBeGreaterThan(m0);
    expect(view[S.RADIUS]).toBeLessThan(r0);
    expect(view[S.ENERGY]).toBeLessThan(100);
  });

  it('PRECIPITATION gate: without PRECIPITATION, no condensation', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1005;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.MASS]).toBe(1.5);
    expect(view[S.ENERGY]).toBe(100);
  });

  it('NEUTRALIZATION: opposite charges cancel and release heat', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1005;
      v[b + S.CHARGE] = i === 0 ? 1 : -1;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.NEUTRALIZATION);
    expect(isSet(laws, LAW_INDEXES.NEUTRALIZATION)).toBe(true);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(Math.abs(view[S.CHARGE])).toBeLessThan(1);
    expect(Math.abs(view[PARTICLE_STRIDE + S.CHARGE])).toBeLessThan(1);
    expect(view[S.TEMPERATURE]).toBeGreaterThan(0);
    expect(view[PARTICLE_STRIDE + S.TEMPERATURE]).toBeGreaterThan(0);
  });

  it('NEUTRALIZATION gate: same-sign or zero charges are unaffected', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 1000 : 1005;
      v[b + S.CHARGE] = 0.5; // same sign
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.NEUTRALIZATION);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.CHARGE]).toBe(0.5);
    expect(view[S.TEMPERATURE]).toBe(0);
  });
});
