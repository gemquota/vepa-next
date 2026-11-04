import { describe, expect, it } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S } from '../../src/constants.js';
import { buildFMMCells, fmmGravity } from '../../src/physics/fmm.js';
import { countAlive } from '../../src/physics/octree.js';
import { gpuComputeForcesSync } from '../../src/physics/gpuCompute.js';

function particles(count = 4) {
  const view = new Float32Array(count * PARTICLE_STRIDE);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = 10 + i * 3;
    view[b + S.POS_Y] = 20 + i * 2;
    view[b + S.POS_Z] = 30 + i;
    view[b + S.MASS] = 1 + i;
    view[b + S.RADIUS] = 1;
  }
  return view;
}

describe('optional backend contracts', () => {
  it('FMM cell construction filters dead and non-positive-mass particles', () => {
    const view = particles();
    view[S.DEAD] = 1;
    view[PARTICLE_STRIDE + S.MASS] = 0;

    const cells = buildFMMCells(null, view, PARTICLE_STRIDE, 4, 100, 2);

    expect(countAlive(view, PARTICLE_STRIDE, 4)).toBe(2);
    expect(cells.occupied.length).toBe(2);
    expect(cells.interStart.length).toBe(cells.occupied.length + 1);
    expect(cells.neighStart.length).toBe(cells.occupied.length + 1);
  });

  it('FMM force output remains finite for a small toroidal cloud', () => {
    const view = particles();
    const fx = new Float64Array(4);
    const fy = new Float64Array(4);
    const fz = new Float64Array(4);

    const result = fmmGravity(view, PARTICLE_STRIDE, 4, 100, 1, fx, fy, fz);

    expect(result.nCells).toBeGreaterThan(0);
    for (const force of [...fx, ...fy, ...fz]) expect(Number.isFinite(force)).toBe(true);
  });

  it('headless GPU helper is explicitly usable as a deterministic CPU fallback', () => {
    const view = particles(2);
    const pairs = [{ i: 0, j: 1 }];
    const params = { worldSize: 100, G: 1, softening: 0.5, maxForce: 50 };

    const first = gpuComputeForcesSync(view, 2, pairs, params);
    const second = gpuComputeForcesSync(view, 2, pairs, params);

    expect(Array.from(first.fx)).toEqual(Array.from(second.fx));
    expect(Array.from(first.fy)).toEqual(Array.from(second.fy));
    expect(Array.from(first.fz)).toEqual(Array.from(second.fz));
    expect(first.fx[0]).not.toBe(0);
  });
});
