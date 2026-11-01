import { describe, it, expect } from 'vitest';
import { WORLD, lcg } from './paramsHelpers.js';
import { createWorldParams, spawnCaps } from '../../src/state/worldParams.js';
import { sampleSpawnPosition, buildSpawnCentres } from '../../src/spawn/distribution.js';
import { MAX_PARTICLES } from '../../src/constants.js';

const cfg = (over) => ({ ...createWorldParams(), ...over });
const rng = lcg(7);

describe('Batch 02 — MAX_POP / SHAPE / SPAWN_CENTRES / SPAWN_CENTRE_RANDOM', () => {
  it('MAX_POP: soft cap = min(MAX_POP, MAX_PARTICLES)', () => {
    expect(spawnCaps(cfg({ MAX_POP: 1000 })).softCap).toBe(1000);
    expect(spawnCaps(cfg({ MAX_POP: MAX_PARTICLES })).softCap).toBe(MAX_PARTICLES);
    expect(spawnCaps(cfg({ MAX_POP: 50 })).softCap).toBe(100);
  });

  it('SHAPE: shape 1 pulls each spawn to its uniform random draw', () => {
    // With a constant rng of 0.5 the uniform draw is (1000,1000,1000), so a
    // fully-random shape must collapse every anchor onto that point.
    const p = sampleSpawnPosition(cfg({ SHAPE: 1 }), 2000, () => 0.5);
    expect(p.x).toBeCloseTo(1000, 3);
    expect(p.y).toBeCloseTo(1000, 3);
    expect(p.z).toBeCloseTo(1000, 3);
  });

  it('SHAPE: shape 0 keeps spawns on the per-species grid anchors', () => {
    // Grid anchors vary per cell, so shape 0 with a constant rng still spans
    // the world instead of collapsing to the uniform draw.
    const ws = 2000;
    const xs = new Set();
    const gridRng = lcg(99);
    for (let i = 0; i < 50; i++) {
      const p = sampleSpawnPosition(cfg({ SHAPE: 0 }), ws, gridRng);
      xs.add(p.x.toFixed(2));
    }
    expect(xs.size).toBeGreaterThan(1);
    const first = sampleSpawnPosition(cfg({ SHAPE: 0 }), ws, () => 0.5);
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(ws);
  });

  it('SHAPE: shape 1 samples cover the full volume (mean near centre)', () => {
    const pts = [];
    for (let i = 0; i < 400; i++) pts.push(sampleSpawnPosition(cfg({ SHAPE: 1 }), 2000, rng));
    const mean = (k) => pts.reduce((a, p) => a + p[k], 0) / pts.length;
    expect(Math.abs(mean('x') - 1000)).toBeLessThan(150);
    expect(Math.abs(mean('y') - 1000)).toBeLessThan(150);
    expect(Math.abs(mean('z') - 1000)).toBeLessThan(150);
  });

  it('SPAWN_CENTRES: count centres, 1 = world middle', () => {
    const one = buildSpawnCentres(1, 0, 2000, rng);
    expect(one).toHaveLength(1);
    expect(one[0].x).toBeCloseTo(1000, 3);
    const four = buildSpawnCentres(4, 0, 2000, rng);
    expect(four).toHaveLength(4);
    const uniq = new Set(four.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}`));
    expect(uniq.size).toBe(4);
  });

  it('SPAWN_CENTRE_RANDOM: random placement scatters centres off the grid', () => {
    const grid = buildSpawnCentres(8, 0, 2000, rng);
    const rand = buildSpawnCentres(8, 1, 2000, rng);
    let distSum = 0;
    for (let i = 0; i < 8; i++) {
      distSum += Math.hypot(rand[i].x - grid[i].x, rand[i].y - grid[i].y, rand[i].z - grid[i].z);
    }
    expect(distSum).toBeGreaterThan(0);
  });

  it('SPAWN_CENTRE_RANDOM: random 0 places centres on a deterministic grid', () => {
    const a = buildSpawnCentres(8, 0, 2000, rng);
    const b = buildSpawnCentres(8, 0, 2000, lcg(7));
    expect(a).toEqual(b);
  });

  it('gate: SPAWN_CENTRES 1 + bias 0 leaves grid positions untouched by centres', () => {
    const p = sampleSpawnPosition(cfg({ SPAWN_CENTRES: 1, SPAWN_CENTRE_BIAS: 0 }), 2000, () => 0.5);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(2000);
  });
});
