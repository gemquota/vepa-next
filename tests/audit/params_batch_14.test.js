import { describe, it, expect } from 'vitest';
import { makeWorld, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve, drainOffspring, resetOffspringRing } from '../../src/physics/solver.js';

describe('Batch 14 — DNA.CATALYSIS / DNA.HEAT_OUTPUT / DNA.BIRTH_RATE / DNA.DEATH_RATE', () => {
  it('CATALYSIS: higher catalysis accelerates the autocatalytic energy gain', () => {
    const run = (catalysis) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        v[b + S.MASS] = 1.5;
        v[b + S.DNA_CACHE_START + 37] = 0;          // REACTION_THRESHOLD → always fire
        v[b + S.DNA_CACHE_START + 38] = catalysis;  // CATALYSIS
      });
      const laws = lawsWith(LAW_INDEXES.AUTOCATALYSIS, LAW_INDEXES.WRAP);
      for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.ENERGY];
    };
    expect(run(2)).toBeGreaterThan(run(0.1));
  });

  it('HEAT_OUTPUT: charged oxidation releases energy scaled by heat output', () => {
    const run = (heatOutput) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.CHARGE] = 1;
        v[b + S.DNA_CACHE_START + 39] = heatOutput; // HEAT_OUTPUT
      });
      const laws = lawsWith(LAW_INDEXES.OXIDATION, LAW_INDEXES.WRAP);
      for (let t = 0; t < 20; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.ENERGY];
    };
    expect(run(1)).toBeGreaterThan(100); // release = charge·heatOutput·0.05/tick
    expect(run(0)).toBeCloseTo(100, 3);  // no heat output → no energy gain
  });

  it('BIRTH_RATE: high birth rate reproduces where low rate does not (REPRO)', () => {
    const run = (birthRate) => {
      resetOffspringRing();
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 10] = birthRate; // BIRTH_RATE
        v[b + S.REPRO_DRIVE] = 60; // drive gate satisfied (REPRO)
        v[b + S.AGE] = 200;
        v[b + S.ENERGY] = 100;
      });
      const laws = lawsWith(LAW_INDEXES.REPRO, LAW_INDEXES.WRAP);
      solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.05);
      return drainOffspring().length;
    };
    expect(run(10)).toBe(1);
    expect(run(1)).toBe(0);
  });

  it('DEATH_RATE: high death rate kills old particles; 0 never does (SENESCENCE)', () => {
    const run = (deathRate) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 11] = deathRate; // DEATH_RATE
        v[b + S.AGE] = 1000;
        v[b + S.DNA_CACHE_START + 34] = 0;         // ENERGY_EFFICIENCY → plain decay
      });
      const laws = lawsWith(LAW_INDEXES.LIFE, LAW_INDEXES.SENESCENCE, LAW_INDEXES.WRAP);
      for (let t = 0; t < 5; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.001);
      return view[S.DEAD];
    };
    expect(run(10)).toBe(1);
    expect(run(0)).toBe(0);
  });
});
