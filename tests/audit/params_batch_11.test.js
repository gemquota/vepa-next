import { describe, it, expect } from 'vitest';
import { makeWorld, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';

describe('Batch 11 — DNA.STIFFNESS / DNA.FUSION / DNA.FUSION_MOMENTUM / DNA.FUSION_TIME', () => {
  it('STIFFNESS: stiffer bonds pull harder toward rest length (BOND)', () => {
    const run = (stiffness) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.DNA_CACHE_START + 8] = stiffness; // STIFFNESS
        }
      });
      const laws = lawsWith(LAW_INDEXES.BOND, LAW_INDEXES.BUOYANCY);
      for (let t = 0; t < 10; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    expect(run(5)).toBeGreaterThan(run(0.1));
  });

  it('FUSION: efficiency does not merge mass; contact remains two entities (ACCR)', () => {
    const run = (fusion) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        v[b + S.MASS] = b === 0 ? 10 : 4;
        v[b + S.DNA_CACHE_START + 17] = 0; // FUSION_TIME → fuse on first contact
        if (b === 0) {
          v[b + S.POS_X] = 999;
          v[b + S.DNA_CACHE_START + 9] = fusion; // FUSION
        } else {
          v[b + S.POS_X] = 1000;
        }
      });
      const laws = lawsWith(LAW_INDEXES.ACCR, LAW_INDEXES.BUOYANCY);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return {
        mass: view[S.MASS],
        neighborMass: view[PARTICLE_STRIDE + S.MASS],
        bondCount: view[S.BOND_COUNT],
      };
    };
    expect(run(1)).toMatchObject({ mass: 10, neighborMass: 4 });
    expect(run(0)).toMatchObject({ mass: 10, neighborMass: 4 });
    expect(run(1).bondCount).toBeGreaterThanOrEqual(1);
  });

  it('FUSION_MOMENTUM: threshold controls when ACCR adjoins (ACCR)', () => {
    const run = (fusionMom) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        v[b + S.MASS] = b === 0 ? 10 : 1;
        v[b + S.DNA_CACHE_START + 16] = fusionMom; // FUSION_MOMENTUM on both partners
        v[b + S.DNA_CACHE_START + 17] = 1000;      // FUSION_TIME → dwell never completes
        if (b === 0) {
          v[b + S.POS_X] = 999;
        } else {
          v[b + S.POS_X] = 1000;
          v[b + S.VEL_X] = -2; // 2.0 relative approach speed → 2.0 relative momentum
        }
      });
      const laws = lawsWith(LAW_INDEXES.ACCR, LAW_INDEXES.BUOYANCY);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return {
        mass: view[S.MASS],
        neighborMass: view[PARTICLE_STRIDE + S.MASS],
        bondCount: view[S.BOND_COUNT],
      };
    };
    expect(run(0.5)).toMatchObject({ mass: 10, neighborMass: 1 }); // adjoined
    expect(run(0.5).bondCount).toBeGreaterThanOrEqual(1);
    expect(run(5)).toMatchObject({ mass: 10, neighborMass: 1 });    // bounces
  });

  it('FUSION_TIME: sub-threshold pairs adjoin after dwelling in close proximity (ACCR)', () => {
    const run = (fusionTime, ticks) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        v[b + S.MASS] = b === 0 ? 10 : 1;
        v[b + S.DNA_CACHE_START + 16] = 100;         // FUSION_MOMENTUM → momentum path never triggers
        v[b + S.DNA_CACHE_START + 17] = fusionTime;  // FUSION_TIME on both partners
        if (b === 0) v[b + S.POS_X] = 999;
        else v[b + S.POS_X] = 1000;
      });
      const laws = lawsWith(LAW_INDEXES.ACCR, LAW_INDEXES.BUOYANCY);
      for (let t = 0; t < ticks; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return {
        mass: view[S.MASS],
        neighborMass: view[PARTICLE_STRIDE + S.MASS],
        bondCount: view[S.BOND_COUNT],
      };
    };
    expect(run(0, 1)).toMatchObject({ mass: 10, neighborMass: 1 });
    expect(run(3, 2)).toMatchObject({ mass: 10, neighborMass: 1 });
    expect(run(3, 3).bondCount).toBeGreaterThanOrEqual(1);
  });
});
