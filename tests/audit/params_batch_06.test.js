import { describe, it, expect } from 'vitest';
import { makeWorld, withWorldParam, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { runtimeConfig } from '../../src/state/runtimeConfig.js';
import { LAW_INDEXES, DNA_RANGES } from '../../src/constants.js';
import { solve, drainOffspring, resetOffspringRing } from '../../src/physics/solver.js';
import { computeRadius, computeAlpha } from '../../src/dna/expression.js';

describe('Batch 06 — MUTATION_RATE / DECAY_RATE / visualScale / globalAlpha', () => {
  it('MUTATION_RATE: offspring DNA deviates more with rate 5 than 0 (REPRO)', () => {
    const run = (rate) => {
      resetOffspringRing();
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 10] = 1.0; // BIRTH_RATE → always try to reproduce
        v[b + S.DNA_CACHE_START + 12] = 0.8; // MUTATION
        v[b + S.REPRO_DRIVE] = 60; // drive gate satisfied (REPRO)
        v[b + S.AGE] = 200;
        v[b + S.ENERGY] = 100;
      });
      const laws = lawsWith(LAW_INDEXES.REPRO, LAW_INDEXES.WRAP);
      withWorldParam('MUTATION_RATE', rate, () => {
        solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.001); // always reproduce
      });
      const off = drainOffspring();
      if (!off.length) return 0;
      let dev = 0;
      for (let d = 0; d < 42; d++) {
        dev += Math.abs(off[0].dna[d] - view[S.DNA_CACHE_START + d]);
      }
      return dev;
    };
    expect(run(5)).toBeGreaterThan(run(0));
  });

  it('DECAY_RATE: 2 decays energy twice as fast as 1; 0 stops decay', () => {
    const run = (rate) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 34] = 0; // ENERGY_EFFICIENCY 0 → base decay
        v[b + S.DNA_CACHE_START + 12] = 1e-6; // MUTATION → negligible bio-pulse
        v[b + S.ENERGY] = 100;
      });
      const laws = lawsWith(LAW_INDEXES.LIFE);
      withWorldParam('DECAY_RATE', rate, () => {
        withWorldParam('LIGHT_LEVEL', 0, () => {
          for (let t = 0; t < 100; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
        });
      });
      return view[S.ENERGY];
    };
    expect(run(2)).toBeLessThan(run(1));
    expect(run(0)).toBeCloseTo(100, 3);
  });

  it('visualScale: computeRadius scales linearly with BASE SIZE', () => {
    const { view } = makeWorld(1, (v, d, b) => {
      v[b + S.MASS] = 2;
      v[b + S.DNA_CACHE_START + 29] = 1; // BASE_RADIUS
    });
    runtimeConfig.visualScale = 1;
    const r1 = computeRadius(view, 0, 0, PARTICLE_STRIDE);
    runtimeConfig.visualScale = 2;
    const r2 = computeRadius(view, 0, 0, PARTICLE_STRIDE);
    runtimeConfig.visualScale = 1;
    expect(r2).toBeCloseTo(r1 * 2, 5);
  });

  it('globalAlpha: computeAlpha scales with PARTICLE ALPHA', () => {
    const { view } = makeWorld(1, (v, d, b) => { v[b + S.ALPHA] = 0.8; });
    runtimeConfig.globalAlpha = 1;
    const a1 = computeAlpha(view, 0, 0, PARTICLE_STRIDE);
    runtimeConfig.globalAlpha = 0.5;
    const a2 = computeAlpha(view, 0, 0, PARTICLE_STRIDE);
    runtimeConfig.globalAlpha = 1;
    expect(a2).toBeCloseTo(a1 * 0.5, 5);
  });
});
