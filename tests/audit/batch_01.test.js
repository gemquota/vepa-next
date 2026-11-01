import { describe, it, expect } from 'vitest';
import {
  PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES as S, DNA_RANGES, LAW_INDEXES,
} from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set, isSet } from '../../src/state/lawState.js';
import { createDNABuffer, loadDefaults } from '../../src/dna/dnaBuffer.js';
import { solve } from '../../src/physics/solver.js';
import { runtimeConfig } from '../../src/state/runtimeConfig.js';

const WORLD = 2000;
const DT = 0.25;
const rng = () => 0.5;

// Deterministic LCG so the ENTR jitter test is reproducible.
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
    view[b + S.RADIUS] = 0.6;
    view[b + S.BOND_PARTNER_1] = -1;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      view[b + S.DNA_CACHE_START + d] = r.default ?? 0;
    }
    if (setup) setup(view, dna, b, i);
  }
  return { view, dna };
}

describe('Batch 01 — GRAV / DRAG / ENTR / BUOYANCY (indices 0-3)', () => {
  it('GRAV: particles accelerate toward each other and separation decreases', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 995 : 1005;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.GRAV);
    expect(isSet(laws, LAW_INDEXES.GRAV)).toBe(true);
    const d0 = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    for (let t = 0; t < 5; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    const d1 = view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X];
    expect(d1).toBeLessThan(d0);
    expect(view[S.VEL_X]).toBeGreaterThan(0);              // i pulled toward j (+x)
    expect(view[PARTICLE_STRIDE + S.VEL_X]).toBeLessThan(0); // j pulled toward i (-x)
  });

  it('GRAV: FORCE DNA is pairwise — both positive amplify, both negative repel, opposite cancel', () => {
    const run = (f0, f1) => {
      const { view, dna } = makeWorld(2, (v, dna, b, i) => {
        v[b + S.POS_X] = i === 0 ? 995 : 1005;
        v[b + S.DNA_CACHE_START + 0] = i === 0 ? f0 : f1; // FORCE
      });
      const laws = createLawState();
      set(laws, LAW_INDEXES.GRAV);
      for (let t = 0; t < 5; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
      return view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X]; // separation
    };
    const plain = run(0, 0);              // no FORCE → plain attraction
    expect(run(100, 100)).toBeLessThan(plain); // both positive → multiply pull
    expect(run(-100, -100)).toBeGreaterThan(10); // both negative → multiply negatively (repel)
    expect(run(100, -100)).toBeCloseTo(10, 5);   // opposite signs → cancel (neutral)
  });

  it('GRAV gate: with GRAV off, resting particles never move', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.POS_X] = i === 0 ? 995 : 1005;
    });
    const laws = createLawState();
    // GLOW with zero SIGNAL keeps the sim running without adding any force.
    set(laws, LAW_INDEXES.GLOW);
    for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_X]).toBe(0);
    expect(view[PARTICLE_STRIDE + S.VEL_X]).toBe(0);
    expect(view[PARTICLE_STRIDE + S.POS_X] - view[S.POS_X]).toBeCloseTo(10, 5);
  });

  it('DRAG: velocity decays over time (viscosity damping)', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.VEL_X] = 5;
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.DRAG);
    const v0 = view[S.VEL_X];
    for (let t = 0; t < 60; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(Math.abs(view[S.VEL_X])).toBeLessThan(Math.abs(v0));
    expect(view[S.VEL_X]).toBeGreaterThan(0); // decays, does not reverse
  });

  it('DRAG gate: without DRAG, velocity is preserved exactly', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.VEL_X] = 5;
    });
    const laws = createLawState();
    for (let t = 0; t < 60; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_X]).toBeCloseTo(5, 5);
  });

  it('ENTR: jitter injects random kinetic energy (velocity leaves zero)', () => {
    const { view, dna } = makeWorld(2, (v, dna, b) => {
      v[b + S.DNA_CACHE_START + 3] = 5; // JITTER
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.ENTR);
    const prng = lcg(12345);
    for (let t = 0; t < 80; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, prng);
    const speed = Math.hypot(view[S.VEL_X], view[S.VEL_Y], view[S.VEL_Z]);
    expect(speed).toBeGreaterThan(0.2);
  });

  it('ENTR gate: without ENTR, no force means velocity stays zero', () => {
    const { view, dna } = makeWorld(2, (v, dna, b) => {
      v[b + S.DNA_CACHE_START + 3] = 5;
    });
    const laws = createLawState();
    const prng = lcg(12345);
    for (let t = 0; t < 80; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, prng);
    expect(view[S.VEL_X]).toBe(0);
    expect(view[S.VEL_Y]).toBe(0);
  });

  it('BUOYANCY: hot particles rise (−z), cold particles sink (+z)', () => {
    const { view, dna } = makeWorld(2, (v, dna, b, i) => {
      v[b + S.TEMPERATURE] = i === 0 ? 1 : 0;
      v[b + S.DNA_CACHE_START + 39] = 0.5; // HEAT_OUTPUT
    });
    const laws = createLawState();
    set(laws, LAW_INDEXES.BUOYANCY);
    solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_Z]).toBeLessThan(0);                        // hot → rises
    expect(view[PARTICLE_STRIDE + S.VEL_Z]).toBeGreaterThan(0);   // cold → sinks
  });

  it('BUOYANCY gate: without it, temperature alone produces no vertical force', () => {
    const { view, dna } = makeWorld(1, (v) => {
      v[S.TEMPERATURE] = 1;
    });
    const laws = createLawState();
    // GLOW with zero SIGNAL keeps the sim running without adding any force.
    set(laws, LAW_INDEXES.GLOW);
    solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.VEL_Z]).toBe(0);
  });

  it('TOROIDAL EDGES on (default): particles crossing the edge reappear on the opposite side', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.POS_X] = WORLD - 5;
      v[b + S.VEL_X] = 10;
    });
    // GLOW with zero SIGNAL keeps the sim running without adding any force.
    const laws = createLawState();
    set(laws, LAW_INDEXES.GLOW);
    for (let t = 0; t < 3; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    expect(view[S.POS_X]).toBeGreaterThan(0);
    expect(view[S.POS_X]).toBeLessThan(10);
  });

  it('TOROIDAL EDGES off: soft walls clamp and reflect at the WALL_REFLECT default', () => {
    const { view, dna } = makeWorld(1, (v, dna, b) => {
      v[b + S.POS_X] = WORLD - 5;
      v[b + S.VEL_X] = 10;
    });
    const laws = createLawState();
    // GLOW with zero SIGNAL keeps the sim running without adding any force.
    set(laws, LAW_INDEXES.GLOW);
    const prev = runtimeConfig.worldParams;
    runtimeConfig.worldParams = { ...prev, TOROIDAL: 0 };
    for (let t = 0; t < 3; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
    runtimeConfig.worldParams = prev;
    expect(view[S.POS_X]).toBeLessThan(WORLD);        // clamped inside the world
    expect(view[S.VEL_X]).toBeCloseTo(-10, 5);        // full 100% reflect (default)
  });

  it('WALL_REFLECT slider (with TOROIDAL off) — 0 absorbs, 1 reflects, 2 doubles the bounce', () => {
    const run = (wallReflect) => {
      const { view, dna } = makeWorld(1, (v, dna, b) => {
        v[b + S.POS_X] = WORLD - 5;
        v[b + S.VEL_X] = 10;
      });
      const laws = createLawState();
      // GLOW with zero SIGNAL keeps the sim running without adding any force.
      set(laws, LAW_INDEXES.GLOW);
      const prev = runtimeConfig.worldParams;
      runtimeConfig.worldParams = { ...prev, TOROIDAL: 0, WALL_REFLECT: wallReflect };
      for (let t = 0; t < 3; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, DT, rng);
      runtimeConfig.worldParams = prev;
      return { x: view[S.POS_X], vx: view[S.VEL_X] };
    };
    const absorb = run(0);
    const reflect = run(1);
    const double = run(2);
    expect(absorb.x).toBeCloseTo(WORLD - 0.01, 3); // 100% absorption → sticks to wall
    expect(absorb.vx).toBeCloseTo(0, 5);
    expect(reflect.x).toBeCloseTo(WORLD - 2.5, 1); // full reflect → ~2.5 back in (clamped at WORLD-0.01)
    expect(reflect.vx).toBeCloseTo(-10, 5);
    // 200% reflect moves twice as far before the MAX_VELOCITY cap reins it in.
    expect(double.x).toBeLessThan(reflect.x - 1);
    expect(double.vx).toBeLessThan(0);
  });
});
