import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { WORLD, lcg } from './paramsHelpers.js';
import { WORLD_PARAM_DEFS, createWorldParams, spawnCaps, applyWorldParam } from '../../src/state/worldParams.js';
import { sampleSpawnPosition, buildSpawnCentres, initialPopulationTarget, perSpeciesAllocation } from '../../src/spawn/distribution.js';
import { MAX_PARTICLES } from '../../src/constants.js';

const cfg = (over) => ({ ...createWorldParams(), ...over });
const rng = lcg(42);

describe('Batch 01 — WORLD_SIZE / PARTICLE_COUNT / INITIAL_POP', () => {
  it('WORLD_SIZE: spawn samples stay inside the world bounds', () => {
    for (const ws of [2000, 500, 10000]) {
      for (let i = 0; i < 50; i++) {
        const p = sampleSpawnPosition(cfg({}), ws, rng);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(ws);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThan(ws);
        expect(p.z).toBeGreaterThanOrEqual(0);
        expect(p.z).toBeLessThan(ws);
      }
    }
  });

  it('WORLD_SIZE: applyWorldParam clamps to [50, 20000]', () => {
    let s = applyWorldParam(createWorldParams(), 'WORLD_SIZE', 10);
    expect(s.WORLD_SIZE).toBe(50);
    s = applyWorldParam(s, 'WORLD_SIZE', 99999);
    expect(s.WORLD_SIZE).toBe(20000);
  });

  it('spawn Z is uniform across the full world height and independent of XY distribution controls', () => {
    const ws = 2000;
    expect(createWorldParams()).not.toHaveProperty('GROUND_HEIGHT');
    const variants = [
      { SHAPE: 0, SPAWN_CENTRE_BIAS: 0 },
      { SHAPE: 1, SPAWN_CENTRE_BIAS: 0 },
      { SHAPE: 0, SPAWN_CENTRE_BIAS: 1 },
      { SHAPE: 1, SPAWN_CENTRE_BIAS: 1 },
    ];
    const distributions = variants.map((controls) => {
      const spawnRng = lcg(42);
      return Array.from({ length: 2000 }, () => sampleSpawnPosition(cfg(controls), ws, spawnRng).z);
    });
    for (const zValues of distributions) {
      expect(Math.min(...zValues)).toBeLessThan(ws * 0.01);
      expect(Math.max(...zValues)).toBeGreaterThan(ws * 0.99);
      const bins = Array(10).fill(0);
      for (const z of zValues) bins[Math.min(9, Math.floor(z / (ws / bins.length)))]++;
      for (const count of bins) expect(count).toBeGreaterThan(150);
      for (const count of bins) expect(count).toBeLessThan(250);
    }
  });


  it('PARTICLE_COUNT: hard cap = min(PARTICLE_COUNT, MAX_PARTICLES)', () => {
    expect(spawnCaps(cfg({ PARTICLE_COUNT: 500 })).hardCap).toBe(500);
    expect(spawnCaps(cfg({ PARTICLE_COUNT: MAX_PARTICLES })).hardCap).toBe(MAX_PARTICLES);
    expect(spawnCaps(cfg({ PARTICLE_COUNT: 50 })).hardCap).toBe(100); // min clamp
  });

  it('INITIAL_POP: target = min(INITIAL_POP, hardCap), split across species', () => {
    const caps = spawnCaps(cfg({ PARTICLE_COUNT: 2000, INITIAL_POP: 1200 }));
    expect(initialPopulationTarget(cfg({ INITIAL_POP: 1200 }), caps)).toBe(1200);
    expect(perSpeciesAllocation(1200, 5)).toBe(240);
    expect(perSpeciesAllocation(10, 5)).toBe(2);
    const small = spawnCaps(cfg({ PARTICLE_COUNT: 100, INITIAL_POP: 5000 }));
    expect(initialPopulationTarget(cfg({ INITIAL_POP: 5000 }), small)).toBe(100);
  });

  it('INITIAL_POP: applyWorldParam clamps to the 10,000-particle engine cap', () => {
    let s = applyWorldParam(createWorldParams(), 'INITIAL_POP', -5);
    expect(s.INITIAL_POP).toBe(0);
    s = applyWorldParam(s, 'INITIAL_POP', 999999);
    expect(s.INITIAL_POP).toBe(MAX_PARTICLES);
  });

  it('gate: neutral defaults keep a single centre at the world middle', () => {
    const centres = buildSpawnCentres(1, 0.5, 2000, rng);
    expect(centres).toHaveLength(1);
    expect(centres[0].x).toBeCloseTo(1000, 3);
    expect(centres[0].y).toBeCloseTo(1000, 3);
    expect(centres[0].z).toBeCloseTo(1000, 3);
  });

  it('initial population samples full-height Z with no ground clamp or XY influence', () => {
    const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
    const spawn = main.slice(main.indexOf('function spawnDefaultPopulation'), main.indexOf('/** Repaint the atmospheric backdrop'));
    expect(spawn).toContain('const pz = sampleSpawnHeight(worldSize, prng)');
    expect(spawn).not.toMatch(/GROUND_HEIGHT|pz\s*=.*SHAPE|pz\s*=.*centreBias/i);
  });
});
