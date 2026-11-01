import { describe, it, expect } from 'vitest';
import { WORLD, lcg } from './paramsHelpers.js';
import { createWorldParams, spawnCaps, applyWorldParam } from '../../src/state/worldParams.js';
import { sampleSpawnPosition, buildSpawnCentres, initialPopulationTarget, perSpeciesAllocation } from '../../src/spawn/distribution.js';
import { MAX_PARTICLES } from '../../src/constants.js';

const cfg = (over) => ({ ...createWorldParams(), ...over });
const rng = lcg(42);

describe('Batch 01 — WORLD_SIZE / GROUND_HEIGHT / PARTICLE_COUNT / INITIAL_POP', () => {
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

  it('GROUND_HEIGHT: spawn z is confined to the ground band', () => {
    const ws = 2000;
    const p = sampleSpawnPosition(cfg({ GROUND_HEIGHT: 0.3 }), ws, rng);
    expect(p.z).toBeLessThanOrEqual(ws * 0.3 + 1e-9);
  });

  it('GROUND_HEIGHT: full band (1.0) allows spawns above a low band', () => {
    const ws = 2000;
    let maxZ = 0;
    for (let i = 0; i < 200; i++) {
      const p = sampleSpawnPosition(cfg({ GROUND_HEIGHT: 1 }), ws, rng);
      maxZ = Math.max(maxZ, p.z);
    }
    expect(maxZ).toBeGreaterThan(ws * 0.5);
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

  it('INITIAL_POP: applyWorldParam clamps to [10, 50000]', () => {
    let s = applyWorldParam(createWorldParams(), 'INITIAL_POP', 5);
    expect(s.INITIAL_POP).toBe(10);
    s = applyWorldParam(s, 'INITIAL_POP', 99999);
    expect(s.INITIAL_POP).toBe(50000);
  });

  it('gate: neutral defaults keep a single centre at the world middle', () => {
    const centres = buildSpawnCentres(1, 0.5, 2000, rng);
    expect(centres).toHaveLength(1);
    expect(centres[0].x).toBeCloseTo(1000, 3);
    expect(centres[0].y).toBeCloseTo(1000, 3);
    expect(centres[0].z).toBeCloseTo(1000, 3);
  });
});
