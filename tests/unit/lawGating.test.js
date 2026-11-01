import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES, DNA_RANGES, LAW_INDEXES } from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';

const S = STRIDE_INDEXES;
const WORLD = 2000;
const DT = 0.25;
const COUNT = 12;

/** Deterministic PRNG for tests. */
const rng = () => 0.5;

function makeWorld() {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const view = buf.view;
  const dna = createDNABuffer();
  loadDefaults(dna, DNA_RANGES);
  for (let i = 0; i < COUNT; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 100 + (i % 4) * 40;
    view[b + S.POS_Y] = 100 + Math.floor(i / 4) * 40;
    view[b + S.POS_Z] = 100 + i * 3;
    view[b + S.VEL_X] = 1.0;
    view[b + S.VEL_Y] = 0.5;
    view[b + S.VEL_Z] = 0.0;
    view[b + S.MASS] = 1.5;
    view[b + S.SPECIES_ID] = i % 5;
    view[b + S.DEAD] = 0;
    view[b + S.AGE] = 500;          // past reproduction gating
    view[b + S.SIGNAL] = 1.0;       // saturated signal
    view[b + S.MEMORY] = 0.5;
    view[b + S.ENERGY] = 100;
    view[b + S.RADIUS] = 0.6;
    for (let d = 0; d < 42; d++) {
      const raw = dna[(i % 5) * 64 + d] || 0;
      const norm = raw / 65535;
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      view[b + S.DNA_CACHE_START + d] = norm * (r.max - r.min) + r.min;
    }
  }
  return { view, dna };
}

function snapshot(view) {
  const snap = new Float32Array(COUNT * PARTICLE_STRIDE);
  snap.set(view.subarray(0, COUNT * PARTICLE_STRIDE));
  return snap;
}

function diffCount(before, view) {
  let changed = 0;
  for (let i = 0; i < COUNT; i++) {
    const b = i * PARTICLE_STRIDE;
    for (let o = 0; o < PARTICLE_STRIDE; o++) {
      if (Math.abs(view[b + o] - before[b + o]) > 1e-6) { changed++; break; }
    }
  }
  return changed;
}

describe('Law gating — movement and interaction require laws', () => {
  it('with zero laws active, solve() is a hard no-op even for moving, signaling particles', () => {
    const { view, dna } = makeWorld();
    const none = createLawState();
    const before = snapshot(view);
    for (let t = 0; t < 60; t++) {
      solve(view, COUNT, PARTICLE_STRIDE, none, dna, WORLD, DT, rng);
    }
    expect(diffCount(before, view)).toBe(0);
  });

  it('with COMMS off, signals never emit, decay, or exchange — no comms movement', () => {
    const { view, dna } = makeWorld();
    const laws = createLawState();
    set(laws, LAW_INDEXES.GRAV);
    set(laws, LAW_INDEXES.COLL);
    // Particles are far apart: gravity/collision forces are negligible, so any
    // velocity/signal/energy change would have to come from the comms channel.
    const before = snapshot(view);
    for (let t = 0; t < 60; t++) {
      solve(view, COUNT, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    }
    for (let i = 0; i < COUNT; i++) {
      const b = i * PARTICLE_STRIDE;
      expect(Math.abs(view[b + S.SIGNAL] - before[b + S.SIGNAL])).toBeLessThan(1e-6);
      expect(Math.abs(view[b + S.MEMORY] - before[b + S.MEMORY])).toBeLessThan(1e-6);
      expect(Math.abs(view[b + S.ENERGY] - before[b + S.ENERGY])).toBeLessThan(1e-6);
    }
  });

  it('with DRAG off, velocity is preserved exactly — friction is law-gated', () => {
    const { view, dna } = makeWorld();
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP); // only containment; no force, no damping
    const vx0 = [], vy0 = [];
    for (let i = 0; i < COUNT; i++) {
      vx0.push(view[i * PARTICLE_STRIDE + S.VEL_X]);
      vy0.push(view[i * PARTICLE_STRIDE + S.VEL_Y]);
    }
    for (let t = 0; t < 40; t++) {
      solve(view, COUNT, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    }
    for (let i = 0; i < COUNT; i++) {
      const b = i * PARTICLE_STRIDE;
      expect(view[b + S.VEL_X]).toBeCloseTo(vx0[i], 5);
      expect(view[b + S.VEL_Y]).toBeCloseTo(vy0[i], 5);
    }
  });

  it('with DRAG on, velocity decays (viscosity + friction damping active)', () => {
    const { view, dna } = makeWorld();
    const laws = createLawState();
    set(laws, LAW_INDEXES.WRAP);
    set(laws, LAW_INDEXES.DRAG);
    const speed0 = [];
    for (let i = 0; i < COUNT; i++) {
      const b = i * PARTICLE_STRIDE;
      speed0.push(Math.hypot(view[b + S.VEL_X], view[b + S.VEL_Y], view[b + S.VEL_Z]));
    }
    for (let t = 0; t < 40; t++) {
      solve(view, COUNT, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    }
    for (let i = 0; i < COUNT; i++) {
      const b = i * PARTICLE_STRIDE;
      const speed = Math.hypot(view[b + S.VEL_X], view[b + S.VEL_Y], view[b + S.VEL_Z]);
      expect(speed).toBeLessThan(speed0[i]);
    }
  });

  it('with COMMS on, signal emission accumulates (SIGNAL grows over time)', () => {
    const { view, dna } = makeWorld();
    const laws = createLawState();
    set(laws, LAW_INDEXES.COMMS);
    for (let i = 0; i < COUNT; i++) {
      const b = i * PARTICLE_STRIDE;
      view[b + S.AGE] = 0;
      view[b + S.SIGNAL] = 0;
    }
    for (let t = 0; t < 120; t++) {
      solve(view, COUNT, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    }
    let emitted = 0;
    for (let i = 0; i < COUNT; i++) {
      if (view[i * PARTICLE_STRIDE + S.SIGNAL] > 1e-6) emitted++;
    }
    expect(emitted).toBeGreaterThan(0);
  });
});

describe('Accretion law gating', () => {
  it('LIFE alone must not grow particle mass (accretion stays off)', async () => {
    const { solve } = await import('../../src/physics/solver.js');
    const { LAW_INDEXES, STRIDE_INDEXES } = await import('../../src/constants.js');
    const { createParticleBuffer } = await import('../../src/state/particleBuffer.js');
    const { createDNABuffer } = await import('../../src/dna/dnaBuffer.js');
    const { createLawState, set } = await import('../../src/state/lawState.js');

    const { view } = createParticleBuffer(3, 100);
    view.fill(0);
    // Two particles with high energy (energy > 50 would grow mass under LIFE)
    for (let i = 0; i < 2; i++) {
      const b = i * 100;
      view[b + STRIDE_INDEXES.POS_X] = 100 + i * 50;
      view[b + STRIDE_INDEXES.POS_Y] = 100;
      view[b + STRIDE_INDEXES.POS_Z] = 100;
      view[b + STRIDE_INDEXES.MASS] = 1.0;
      view[b + STRIDE_INDEXES.ENERGY] = 100;
      view[b + STRIDE_INDEXES.DEAD] = 0;
    }
    const dna = createDNABuffer();
    const laws = createLawState();
    set(laws, LAW_INDEXES.LIFE);

    const before = view[0 + STRIDE_INDEXES.MASS] + view[100 + STRIDE_INDEXES.MASS];
    for (let t = 0; t < 60; t++) {
      solve(view, 2, 100, laws, dna, 2000, 0.25, () => 0.5);
    }
    const after = view[0 + STRIDE_INDEXES.MASS] + view[100 + STRIDE_INDEXES.MASS];
    // Small tolerance: energy decay/other LIFE effects must not grow mass
    expect(after).toBeLessThanOrEqual(before + 0.01);
  });
});
