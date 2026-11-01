import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D, DNA_RANGES, LAW_INDEXES, MAX_PARTICLES } from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, clear, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults, setDNAFloat, getDNAFloat } from '../../src/dna/dnaBuffer.js';
import { applyChaos, applyOrder, applyFate, applyWill, advanceFateClock, getFateTime } from '../../src/physics/laws.js';
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
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      v[b + S.DNA_CACHE_START + d] = getDNAFloat(dna, i % 3, d, r.min, r.max);
    }
  }
  if (mutate) mutate(v, dna);
  return { view: v, dna };
}

describe('Batch 09 — CHAOS / ORDER / FATE / WILL', () => {
  it('CHAOS (32): deterministic Lorenz forcing, gated by isSet', () => {
    const buf = view(1);
    seed(buf, 1);
    const state = createLawState();
    set(state, LAW_INDEXES.CHAOS);
    expect(isSet(state, LAW_INDEXES.CHAOS)).toBe(true);
    applyChaos(state, buf, 0, 1, 1); // (lawState, view, base, dt, synergy)
    // Particle 0's deterministic seed: x=0.1, y=0.1, z=20. One Euler step
    // (dt=1, h=0.02): x→0.1, y→0.114, z→18.9335. Kick = ((x−14)/28)·0.5.
    expect(buf[S.CHAOS_STATE_X]).toBeCloseTo(0.1, 5);
    expect(buf[S.CHAOS_STATE_Y]).toBeCloseTo(0.114, 5);
    expect(buf[S.CHAOS_STATE_Z]).toBeCloseTo(18.9335, 4);
    expect(buf[S.VEL_X]).toBeCloseTo(-0.2482, 3); // (0.1−14)/28·0.5
    expect(buf[S.VEL_Y]).toBeCloseTo(-0.2482, 3);
    expect(buf[S.VEL_Z]).toBeCloseTo(-0.1241, 3); // half on Z
    expect(buf[S.TEMPERATURE]).toBeCloseTo(0, 5); // stir (18.93−20)/40·0.02 → clamped 0

    // Deterministic: the same seed reproduces the same map and kick — no PRNG.
    const buf2 = view(1);
    seed(buf2, 1);
    applyChaos(state, buf2, 0, 1, 1);
    expect(buf2[S.VEL_X]).toBe(buf[S.VEL_X]);
    expect(buf2[S.CHAOS_STATE_Z]).toBe(buf[S.CHAOS_STATE_Z]);

    // gate off → no effect
    const off = createLawState();
    const buf3 = view(1);
    seed(buf3, 1);
    applyChaos(off, buf3, 0, 1, 1);
    expect(buf3[S.VEL_X]).toBe(0);
  });

  it('CHAOS integration: solve() moves particles only when enabled', () => {
    const on = makeWorld(1);
    const st = createLawState();
    set(st, LAW_INDEXES.CHAOS);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, () => 0.9);
    expect(Math.abs(on.view[S.VEL_X])).toBeGreaterThan(0);

    const off = makeWorld(1);
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, () => 0.9);
    expect(off.view[S.VEL_X]).toBe(0);
  });

  it('ORDER (33): velocity alignment with neighbors, gated by isSet', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[PARTICLE_STRIDE + S.VEL_X] = 5;
    const state = createLawState();
    set(state, LAW_INDEXES.ORDER);
    expect(isSet(state, LAW_INDEXES.ORDER)).toBe(true);
    const f = applyOrder(state, buf, 0, PARTICLE_STRIDE, 100, 1);
    expect(f).not.toBeNull();
    expect(f.ax).toBeCloseTo(5 * 0.04, 5); // 0.2 (strong alignment)
    expect(f.ay).toBeCloseTo(0, 5);
    // beyond 40k distSq (~200 units) → no alignment
    expect(applyOrder(state, buf, 0, PARTICLE_STRIDE, 50000, 1)).toBeNull();
    // gate off → null
    expect(applyOrder(createLawState(), buf, 0, PARTICLE_STRIDE, 100, 1)).toBeNull();
  });

  it('ORDER integration: idle particle accelerates toward neighbor velocity', () => {
    const on = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.VEL_X] = 5;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.ORDER);
    solve(on.view, 2, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.VEL_X]).toBeGreaterThan(0);

    const off = makeWorld(2, (v) => {
      v[PARTICLE_STRIDE + S.VEL_X] = 5;
    });
    solve(off.view, 2, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.VEL_X]).toBe(0);
  });

  it('FATE (34): species destiny point pull, gated by isSet', () => {
    advanceFateClock(-getFateTime()); // deterministic destiny phase
    const buf = view(1);
    seed(buf, 1); // species 0 at (100, 100, 100)
    const state = createLawState();
    set(state, LAW_INDEXES.FATE);
    expect(isSet(state, LAW_INDEXES.FATE)).toBe(true);
    const f = applyFate(state, buf, 0, 100, 100, 100, WORLD, 1);
    expect(f).not.toBeNull();
    // Species 0 destiny at t=0 is (1000, 1640, 1000): pull magnitude 0.02,
    // toroidal shortest path → +X, −Y (wrapped), +Z
    expect(Math.hypot(f.ax, f.ay, f.az)).toBeCloseTo(0.02, 5);
    expect(f.ax).toBeGreaterThan(0);
    expect(f.ay).toBeLessThan(0);
    expect(f.az).toBeGreaterThan(0);
    // a different species has a different destiny direction
    const buf2 = view(1);
    seed(buf2, 1);
    buf2[S.SPECIES_ID] = 1;
    const f2 = applyFate(state, buf2, 0, 100, 100, 100, WORLD, 1);
    expect(f2).not.toBeNull();
    expect(Math.sign(f2.ax)).not.toBe(Math.sign(f.ax));
    // gate off → null
    expect(applyFate(createLawState(), buf, 0, 100, 100, 100, WORLD, 1)).toBeNull();
  });

  it('FATE integration: particles drift toward their destiny; off preserves position', () => {
    advanceFateClock(-getFateTime());
    const on = makeWorld(1);
    const st = createLawState();
    set(st, LAW_INDEXES.FATE);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    // species 0 destiny X = 1000 > particle X = 100 → drifts +X
    expect(on.view[S.VEL_X]).toBeGreaterThan(0);

    const off = makeWorld(1);
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.VEL_X]).toBe(0);
  });

  it('WILL (35): self-propulsion along current velocity, gated by isSet', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.VEL_X] = 5;
    const state = createLawState();
    set(state, LAW_INDEXES.WILL);
    expect(isSet(state, LAW_INDEXES.WILL)).toBe(true);
    applyWill(state, buf, 0, 1, 1);
    expect(buf[S.VEL_X]).toBeCloseTo(5.01, 5); // 0.01*dt*synergy along +x
    expect(buf[S.VEL_Y]).toBe(0);
    // stationary particles get no boost
    const idle = view(1);
    seed(idle, 1);
    applyWill(state, idle, 0, 1, 1);
    expect(idle[S.VEL_X]).toBe(0);
    // gate off → no boost
    const buf2 = view(1);
    seed(buf2, 1);
    buf2[S.VEL_X] = 5;
    applyWill(createLawState(), buf2, 0, 1, 1);
    expect(buf2[S.VEL_X]).toBe(5);
  });

  it('WILL integration: moving particle speeds up; gate off preserves speed', () => {
    const on = makeWorld(1, (v) => {
      v[S.VEL_X] = 2;
    });
    const st = createLawState();
    set(st, LAW_INDEXES.WILL);
    solve(on.view, 1, PARTICLE_STRIDE, st, on.dna, WORLD, DT, rng);
    expect(on.view[S.VEL_X]).toBeGreaterThan(2);

    const off = makeWorld(1, (v) => {
      v[S.VEL_X] = 2;
    });
    solve(off.view, 1, PARTICLE_STRIDE, createLawState(), off.dna, WORLD, DT, rng);
    expect(off.view[S.VEL_X]).toBe(2);
  });
});
