import { describe, it, expect } from 'vitest';
import { makeWorld, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';
import { computeRadius } from '../../src/dna/expression.js';

describe('Batch 12 — DNA.BASE_RADIUS / DNA.ELASTICITY / DNA.BOND_ANGLE / DNA.POLARITY', () => {
  it('BASE_RADIUS: scales the visual radius linearly', () => {
    const r = (base) => {
      const { view } = makeWorld(1, (v, d, b) => {
        v[b + S.MASS] = 2;
        v[b + S.DNA_CACHE_START + 29] = base; // BASE_RADIUS
      });
      return computeRadius(view, 0, 0, PARTICLE_STRIDE);
    };
    expect(r(4)).toBeCloseTo(r(0.4) * 10, 5);
    expect(r(0.4)).toBeGreaterThan(0.3);
  });

  it('ELASTICITY: bouncier particles reverse approach velocity harder (COLL)', () => {
    const run = (elasticity) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        v[b + S.RADIUS] = 3; // wide bodies → overlap at 4 apart
        if (b === 0) {
          v[b + S.POS_X] = 998;
          v[b + S.VEL_X] = 2;
          v[b + S.DNA_CACHE_START + 30] = elasticity; // ELASTICITY
        } else {
          v[b + S.POS_X] = 1002;
          v[b + S.VEL_X] = -2;
        }
      });
      const laws = lawsWith(LAW_INDEXES.COLL, LAW_INDEXES.BUOYANCY);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.VEL_X];
    };
    expect(run(1)).toBeLessThan(run(0.1));
  });

  it('BOND_ANGLE: wider angle preference stretches the equilibrium bond distance (BOND)', () => {
    const run = (bondAngle) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 8] = 1;
        v[b + S.DNA_CACHE_START + 29] = 5;
        v[b + S.RADIUS] = 5;
        v[b + S.BOND_COUNT] = 1;
        v[b + S.BOND_PARTNER_1] = b === 0 ? 1 : 0;
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.DNA_CACHE_START + 31] = bondAngle; // BOND_ANGLE
        } else {
          v[b + S.POS_X] = 1002; // stretched ordinary bond; wider geometry prefers a longer surface spacing
        }
      });
      const laws = lawsWith(LAW_INDEXES.BOND, LAW_INDEXES.BUOYANCY);
      for (let t = 0; t < 5; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    // Wider angles increase the surface-based target and reduce the bond's inward correction.
    expect(run(360)).toBeLessThan(run(0));
  });

  it('POLARITY: like charges repel, opposite charges attract (CHARGE_LAW)', () => {
    const run = (p0, p1) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.DNA_CACHE_START + 4] = p0; // POLARITY
        } else {
          v[b + S.POS_X] = 1000;
          v[b + S.DNA_CACHE_START + 4] = p1;
        }
      });
      const laws = lawsWith(LAW_INDEXES.CHARGE_LAW, LAW_INDEXES.BUOYANCY);
      for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    expect(run(1, 1)).toBeLessThan(990);      // like charges repel (x decreases)
    expect(run(1, -1)).toBeGreaterThan(990);  // opposite charges attract
    expect(run(0, 0)).toBeCloseTo(990, 3);
  });
});
