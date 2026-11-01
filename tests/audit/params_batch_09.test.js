import { describe, it, expect } from 'vitest';
import { makeWorld, lawsWith, PARTICLE_STRIDE, S, WORLD, lcg } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';

describe('Batch 09 — DNA.TORQUE / DNA.JITTER / DNA.TIDAL / DNA.INERTIA', () => {
  it('TORQUE: rotates velocity around Z; 0 leaves it untouched (WRAP integration)', () => {
    const run = (torque) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 2] = torque; // TORQUE
        v[b + S.VEL_X] = 5;
      });
      const laws = lawsWith(LAW_INDEXES.WRAP);
      for (let t = 0; t < 40; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return { vx: view[S.VEL_X], vy: view[S.VEL_Y], speed: Math.hypot(view[S.VEL_X], view[S.VEL_Y]) };
    };
    const spun = run(0.8);
    const still = run(0);
    expect(Math.abs(still.vy)).toBeLessThan(1e-6);
    expect(Math.abs(spun.vy)).toBeGreaterThan(1);
    expect(spun.speed).toBeCloseTo(5, 5); // rotation preserves speed
  });

  it('JITTER: higher DNA jitter produces stronger ENTR velocity noise', () => {
    const run = (jitter) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 3] = jitter; // JITTER
      });
      const laws = lawsWith(LAW_INDEXES.ENTR, LAW_INDEXES.WRAP);
      const rng = lcg(42);
      for (let t = 0; t < 80; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, rng);
      return Math.abs(view[S.VEL_X]) + Math.abs(view[S.VEL_Y]) + Math.abs(view[S.VEL_Z]);
    };
    expect(run(1.0)).toBeGreaterThan(run(0.1) * 1.5);
    expect(run(0)).toBeLessThan(run(1.0));
  });

  it('TIDAL: close-range differential pull amplifies gravity; 0 leaves it unchanged', () => {
    const run = (tidal) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.DNA_CACHE_START + 15] = tidal; // TIDAL
        }
      });
      const laws = lawsWith(LAW_INDEXES.GRAV, LAW_INDEXES.WRAP);
      for (let t = 0; t < 6; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    expect(run(1)).toBeGreaterThan(run(0));
  });

  it('INERTIA: higher inertia resists gravity acceleration more', () => {
    const run = (inertia) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.DNA_CACHE_START + 26] = inertia; // INERTIA
        }
      });
      const laws = lawsWith(LAW_INDEXES.GRAV, LAW_INDEXES.WRAP);
      // 3 ticks only — longer runs let the low-inertia particle overshoot past
      // the neighbour and get pulled back, which scrambles the comparison.
      for (let t = 0; t < 3; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    expect(run(0.5)).toBeGreaterThan(run(2));
  });
});
