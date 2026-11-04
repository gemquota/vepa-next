import { describe, expect, it } from 'vitest';
import { buildNeighborPairs } from '../../src/physics/solver.js';
import { createGPUContext, gpuComputeForcesSync } from '../../src/physics/gpuCompute.js';
import { PARTICLE_STRIDE, MAX_PARTICLES, LAW_COUNT } from '../../src/constants.js';

function fixture(count) {
  const view = new Float32Array(count * PARTICLE_STRIDE);
  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STRIDE;
    view[base] = 10 + i;
    view[base + 1] = 10;
    view[base + 2] = 10;
    view[base + 6] = 1;
    view[base + 56] = 1;
  }
  return view;
}

describe('WebGPU bridge contracts', () => {
  it('builds the same directed neighbor-pair shape consumed by the GPU kernel', () => {
    const view = fixture(3);
    const pairs = buildNeighborPairs(view, 3, PARTICLE_STRIDE, 100);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every(({ i, j }) => Number.isInteger(i) && Number.isInteger(j) && i !== j)).toBe(true);
    expect(pairs.some(({ i, j }) => i === 0 && j === 1)).toBe(true);
  });

  it('keeps the CPU fallback finite and deterministic when a GPU device is absent', () => {
    const view = fixture(3);
    const pairs = buildNeighborPairs(view, 3, PARTICLE_STRIDE, 100);
    const first = gpuComputeForcesSync(view, 3, pairs, { worldSize: 100, G: 0.2, collisionEnabled: true });
    const second = gpuComputeForcesSync(view, 3, pairs, { worldSize: 100, G: 0.2, collisionEnabled: true });
    expect(Array.from(first.fx)).toEqual(Array.from(second.fx));
    expect([...first.fx, ...first.fy, ...first.fz].every(Number.isFinite)).toBe(true);
  });

  it('honors independent gravity and collision gates in the headless fallback', () => {
    const view = fixture(2);
    view[PARTICLE_STRIDE + 56] = 2;
    const pairs = [{ i: 0, j: 1 }];
    const noGravity = gpuComputeForcesSync(view, 2, pairs, {
      worldSize: 100,
      G: 1,
      gravityEnabled: false,
      collisionEnabled: false,
    });
    expect(Array.from(noGravity.fx)).toEqual([0, 0]);
    expect(Array.from(noGravity.fy)).toEqual([0, 0]);
    expect(Array.from(noGravity.fz)).toEqual([0, 0]);

    const collisionOnly = gpuComputeForcesSync(view, 2, pairs, {
      worldSize: 100,
      G: 1,
      gravityEnabled: false,
      collisionEnabled: true,
    });
    expect(collisionOnly.fx[0]).not.toBe(0);
  });

  it('filters dead and massless particles out of the GPU neighbor pairs', () => {
    const view = fixture(3);
    view[PARTICLE_STRIDE + 52] = 1; // particle 1 dead
    view[2 * PARTICLE_STRIDE + 6] = 0; // particle 2 massless
    const pairs = buildNeighborPairs(view, 3, PARTICLE_STRIDE, 100);
    expect(pairs).toEqual([]);
    for (const index of [0, 1, 2]) {
      expect(pairs.some(({ i, j }) => i === index || j === index)).toBe(false);
    }
  });

  it('returns bounded zero forces for an empty pair list', () => {
    const view = fixture(3);
    const result = gpuComputeForcesSync(view, 3, [], {
      worldSize: 100,
      G: 1,
      gravityEnabled: true,
      collisionEnabled: true,
    });
    expect(Array.from(result.fx)).toEqual([0, 0, 0]);
    expect(Array.from(result.fy)).toEqual([0, 0, 0]);
    expect(Array.from(result.fz)).toEqual([0, 0, 0]);
    expect([...result.fx, ...result.fy, ...result.fz].every(Number.isFinite)).toBe(true);
  });

  it('reports unavailable WebGPU cleanly in a headless test environment', async () => {
    expect(await createGPUContext()).toBeNull();
  });

  it('distinguishes storage layout, population capacity, and law registry size', () => {
    expect(PARTICLE_STRIDE).toBe(100);
    expect(MAX_PARTICLES).toBe(10000);
    expect(LAW_COUNT).toBe(136);
  });
});
