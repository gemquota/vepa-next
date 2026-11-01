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
      const laws = lawsWith(LAW_INDEXES.BOND, LAW_INDEXES.WRAP);
      for (let t = 0; t < 10; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    expect(run(5)).toBeGreaterThan(run(0.1));
  });

  it('FUSION: higher fusion efficiency transfers more mass on overlap (ACCR)', () => {
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
      const laws = lawsWith(LAW_INDEXES.ACCR, LAW_INDEXES.WRAP);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.MASS];
    };
    expect(run(1)).toBeGreaterThan(run(0));
  });

  it('FUSION_MOMENTUM: minimum momentum to fuse — above merges, below bounces (ACCR)', () => {
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
      const laws = lawsWith(LAW_INDEXES.ACCR, LAW_INDEXES.WRAP);
      for (let t = 0; t < 1; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.MASS];
    };
    expect(run(0.5)).toBeGreaterThan(10.02);  // above min momentum → fuses
    expect(run(5)).toBe(10);                  // below min momentum → bounces
  });

  it('FUSION_TIME: sub-threshold pairs fuse after dwelling in close proximity (ACCR)', () => {
    const run = (fusionTime, ticks) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        v[b + S.MASS] = b === 0 ? 10 : 1;
        v[b + S.DNA_CACHE_START + 16] = 100;         // FUSION_MOMENTUM → momentum path never triggers
        v[b + S.DNA_CACHE_START + 17] = fusionTime;  // FUSION_TIME on both partners
        if (b === 0) v[b + S.POS_X] = 999;
        else v[b + S.POS_X] = 1000;
      });
      const laws = lawsWith(LAW_INDEXES.ACCR, LAW_INDEXES.WRAP);
      for (let t = 0; t < ticks; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.MASS];
    };
    expect(run(0, 1)).toBeGreaterThan(10.02);  // 0 → fuse on first contact
    expect(run(3, 2)).toBe(10);                // 2 s < 3 s → not yet fused
    expect(run(3, 3)).toBeGreaterThan(10.02);  // 3 s of proximity → fused
  });
});
