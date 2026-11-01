import { describe, it, expect } from 'vitest';
import { makeWorld, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';
import { computeAlpha } from '../../src/dna/expression.js';

describe('Batch 13 — DNA.ALPHA / DNA.CONDUCTIVITY / DNA.MAGNETIC_MOMENT / DNA.REACTION_THRESHOLD', () => {
  it('ALPHA: DNA alpha drives visual opacity when the stride alpha is unset', () => {
    const a = (alpha) => {
      const { view } = makeWorld(1, (v, d, b) => {
        v[b + S.ALPHA] = 0; // let DNA alpha take over
        v[b + S.DNA_CACHE_START + 5] = alpha; // ALPHA
      });
      return computeAlpha(view, 0, 0, PARTICLE_STRIDE);
    };
    expect(a(1)).toBeCloseTo(1, 3);
    expect(a(0.2)).toBeCloseTo(0.2, 3);
    expect(a(1)).toBeGreaterThan(a(0.2));
  });

  it('CONDUCTIVITY: more conductive particles diffuse charge faster (CURRENT)', () => {
    const run = (conductivity) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        v[b + S.CHARGE] = b === 0 ? 1 : 0;
        // Both particles conduct (CURRENT needs both sides — confirmed batch-14).
        v[b + S.DNA_CACHE_START + 32] = conductivity; // CONDUCTIVITY
      });
      const laws = lawsWith(LAW_INDEXES.CURRENT, LAW_INDEXES.WRAP);
      for (let t = 0; t < 10; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.CHARGE];
    };
    expect(run(1)).toBeLessThan(run(0.05));
  });

  it('MAGNETIC_MOMENT: aligned moments attract; zero moments are inert (MAGNETISM)', () => {
    const run = (moment) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.DNA_CACHE_START + 33] = moment; // MAGNETIC_MOMENT
        } else {
          v[b + S.POS_X] = 995;
          v[b + S.DNA_CACHE_START + 33] = moment;
        }
      });
      const laws = lawsWith(LAW_INDEXES.MAGNETISM, LAW_INDEXES.WRAP);
      for (let t = 0; t < 40; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    expect(run(0.5)).toBeGreaterThan(990);
    expect(run(0)).toBeCloseTo(990, 3);
  });

  it('REACTION_THRESHOLD: autocatalysis requires both masses above the threshold', () => {
    const run = (threshold) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        v[b + S.MASS] = 1.5;
        v[b + S.DNA_CACHE_START + 37] = threshold; // REACTION_THRESHOLD
        v[b + S.DNA_CACHE_START + 38] = 2;         // CATALYSIS → strong reaction
      });
      const laws = lawsWith(LAW_INDEXES.AUTOCATALYSIS, LAW_INDEXES.WRAP);
      for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.ENERGY];
    };
    expect(run(0.5)).toBeGreaterThan(100); // mass 1.5 ≥ 0.5 → fires
    expect(run(5)).toBeCloseTo(100, 3);    // mass 1.5 < 5 → blocked
  });
});
