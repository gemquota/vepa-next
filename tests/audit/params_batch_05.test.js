import { describe, it, expect } from 'vitest';
import { makeWorld, withWorldParam, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { createWorldParams, applyWorldParam } from '../../src/state/worldParams.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';

describe('Batch 05 — RADIATION_LEVEL / SPAWN_RATE / SPECIES_INTERACTION / ENERGY_TRANSFER', () => {
  it('RADIATION_LEVEL: 0 disables radiation damage; 5 damages faster than 1', () => {
    const run = (level) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.ENERGY] = 100;
        v[b + S.ARMOR] = 0;
      });
      const laws = lawsWith(LAW_INDEXES.RADIATION, LAW_INDEXES.LIFE); // LIFE keeps AGE advancing & energy path active
      withWorldParam('RADIATION_LEVEL', level, () => {
        for (let t = 0; t < 50; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      });
      return view[S.ENERGY];
    };
    expect(run(0)).toBeGreaterThan(run(1));
    expect(run(5)).toBeLessThan(run(1));
  });

  it('SPAWN_RATE: state clamps to [0,100] and persists', () => {
    let s = applyWorldParam(createWorldParams(), 'SPAWN_RATE', 999);
    expect(s.SPAWN_RATE).toBe(100);
    s = applyWorldParam(s, 'SPAWN_RATE', -5);
    expect(s.SPAWN_RATE).toBe(0);
    s = applyWorldParam(s, 'SPAWN_RATE', 25);
    expect(s.SPAWN_RATE).toBe(25);
  });

  it('SPECIES_INTERACTION: 0 disables affinity pull; 2 attracts harder than 1', () => {
    const run = (interaction) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.DNA_CACHE_START + 41] = 1.0; // SPECIES_AFFINITY (same-species pull)
        }
        v[b + S.SPECIES_ID] = 0;
      });
      const laws = lawsWith(LAW_INDEXES.AFFINITY, LAW_INDEXES.WRAP);
      withWorldParam('SPECIES_INTERACTION', interaction, () => {
        for (let t = 0; t < 5; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      });
      return view[S.POS_X];
    };
    expect(run(0)).toBeCloseTo(990, 3);
    expect(run(2)).toBeGreaterThan(run(1));
    expect(run(2)).toBeLessThan(1000); // pulled toward (not past) the neighbour
  });

  it('ENERGY_TRANSFER: 0 blocks conduction; 2 conducts faster than 1', () => {
    const run = (transfer) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) v[b + S.ENERGY] = 100;
        else v[b + S.ENERGY] = 0;
      });
      const laws = lawsWith(LAW_INDEXES.ENERGY, LAW_INDEXES.WRAP);
      withWorldParam('ENERGY_TRANSFER', transfer, () => {
        for (let t = 0; t < 30; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      });
      return view[PARTICLE_STRIDE + S.ENERGY];
    };
    expect(run(0)).toBeCloseTo(0, 3);
    expect(run(2)).toBeGreaterThan(run(1));
  });
});
