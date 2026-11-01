import { describe, it, expect } from 'vitest';
import { makeWorld, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';
import { computeColor } from '../../src/dna/expression.js';

describe('Batch 10 — DNA.FRICTION / DNA.MAX_VELOCITY / DNA.SYMMETRY / DNA.HIDDEN_MASS', () => {
  it('FRICTION: higher DNA friction damps velocity faster under DRAG', () => {
    const run = (friction) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 27] = friction; // FRICTION
        v[b + S.VEL_X] = 5;
      });
      const laws = lawsWith(LAW_INDEXES.DRAG, LAW_INDEXES.WRAP);
      for (let t = 0; t < 30; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return Math.abs(view[S.VEL_X]);
    };
    expect(run(0.1)).toBeLessThan(run(0.01));
  });

  it('MAX_VELOCITY: caps terminal speed; generous limits leave velocity untouched', () => {
    const run = (maxVel) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 28] = maxVel; // MAX_VELOCITY
        v[b + S.VEL_X] = 8;
      });
      const laws = lawsWith(LAW_INDEXES.WRAP);
      for (let t = 0; t < 10; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return Math.abs(view[S.VEL_X]);
    };
    expect(run(3)).toBeLessThanOrEqual(3 + 1e-6);
    expect(run(3)).toBeLessThan(run(20));
    expect(run(20)).toBeCloseTo(8, 3);
  });

  it('SYMMETRY: positive brightens the visual colour, negative darkens it', () => {
    const lum = (symmetry) => {
      const { view } = makeWorld(1, (v, d, b) => {
        v[b + S.COLOR_R] = 200;
        v[b + S.COLOR_G] = 200;
        v[b + S.COLOR_B] = 200;
        v[b + S.ENERGY] = 0;
        v[b + S.DNA_CACHE_START + 6] = symmetry; // SYMMETRY
      });
      const c = computeColor(view, 0, 0, PARTICLE_STRIDE);
      return Math.max(c.r, c.g, c.b);
    };
    expect(lum(1)).toBeGreaterThan(lum(-1));
  });

  it('HIDDEN_MASS: extra hidden mass amplifies gravitational pull', () => {
    const run = (hidden) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.DNA_CACHE_START + 7] = hidden; // HIDDEN_MASS
        }
      });
      const laws = lawsWith(LAW_INDEXES.GRAV, LAW_INDEXES.WRAP);
      for (let t = 0; t < 6; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    expect(run(3)).toBeGreaterThan(run(0));
  });
});
