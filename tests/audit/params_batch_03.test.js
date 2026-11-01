import { describe, it, expect } from 'vitest';
import { makeWorld, withWorldParam, lawsWith, PARTICLE_STRIDE, S, WORLD, lcg } from './paramsHelpers.js';
import { createWorldParams } from '../../src/state/worldParams.js';
import { sampleSpawnPosition, buildSpawnCentres } from '../../src/spawn/distribution.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';

const cfg = (over) => ({ ...createWorldParams(), ...over });

describe('Batch 03 — SPAWN_CENTRE_BIAS / GLOBAL_G / WIND / DAMPING', () => {
  it('SPAWN_CENTRE_BIAS: bias 1 pins spawns to a cluster centre', () => {
    const ws = 2000;
    const centres = buildSpawnCentres(4, 0, ws, lcg(3));
    // Force the same centre selection by seeding a constant rng: bias 1 => pos == centre.
    const p = sampleSpawnPosition(cfg({ SPAWN_CENTRES: 1, SPAWN_CENTRE_BIAS: 1 }), ws, () => 0.5);
    expect(p.x).toBeCloseTo(1000, 3);
    expect(p.y).toBeCloseTo(1000, 3);
    expect(p.z).toBeCloseTo(1000, 3);
    expect(centres).toHaveLength(4);
  });

  it('SPAWN_CENTRE_BIAS: bias 0 makes centres irrelevant', () => {
    const a = sampleSpawnPosition(cfg({ SPAWN_CENTRES: 8, SPAWN_CENTRE_BIAS: 0 }), 2000, () => 0.5);
    const b = sampleSpawnPosition(cfg({ SPAWN_CENTRES: 1, SPAWN_CENTRE_BIAS: 0 }), 2000, () => 0.5);
    expect(a).toEqual(b); // centre block is skipped entirely at bias 0
  });

  it('GLOBAL_G: gravity off (0) leaves particles stationary', () => {
    const { view, dna } = makeWorld(2, (v, d, b) => {
      if (b === 0) { v[b + S.POS_X] = 990; v[b + S.POS_Y] = 1000; v[b + S.POS_Z] = 1000; }
    });
    const laws = lawsWith(LAW_INDEXES.GRAV);
    withWorldParam('GLOBAL_G', 0, () => {
      for (let t = 0; t < 20; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
    });
    expect(view[S.VEL_X]).toBeCloseTo(0, 6);
    expect(view[S.POS_X]).toBeCloseTo(990, 3);
  });

  it('GLOBAL_G: gravity 2 pulls faster than gravity 1', () => {
    const run = (g) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) { v[b + S.POS_X] = 990; v[b + S.POS_Y] = 1000; v[b + S.POS_Z] = 1000; }
      });
      const laws = lawsWith(LAW_INDEXES.GRAV);
      withWorldParam('GLOBAL_G', g, () => {
        for (let t = 0; t < 10; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      });
      return view[S.POS_X];
    };
    expect(run(2)).toBeLessThan(run(1));
  });

  it('WIND: constant +X drift accelerates particles', () => {
    const { view, dna } = makeWorld(1);
    const laws = lawsWith(LAW_INDEXES.WRAP); // gate law so the solver runs
    withWorldParam('WIND', 2, () => {
      for (let t = 0; t < 10; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
    });
    // vx ≈ 0.5 * 2 * 10 = 10 (clamped at MAX_VELOCITY=10)
    expect(view[S.VEL_X]).toBeGreaterThan(5);
  });

  it('WIND: wind 0 produces no drift', () => {
    const { view, dna } = makeWorld(1);
    const laws = lawsWith(LAW_INDEXES.WRAP);
    withWorldParam('WIND', 0, () => {
      for (let t = 0; t < 10; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
    });
    expect(view[S.VEL_X]).toBeCloseTo(0, 6);
  });

  it('DAMPING: high damping decays velocity; 0 preserves it', () => {
    const run = (damp) => {
      const { view, dna } = makeWorld(1, (v, d, b) => { v[b + S.VEL_X] = 5; });
      const laws = lawsWith(LAW_INDEXES.WRAP);
      withWorldParam('DAMPING', damp, () => {
        for (let t = 0; t < 20; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      });
      return view[S.VEL_X];
    };
    expect(run(50)).toBeLessThan(0.1); // 5 * 0.5^20
    expect(run(0)).toBeCloseTo(5, 5);
  });
});
