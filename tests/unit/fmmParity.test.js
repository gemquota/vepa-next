import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, WORLD_SIZE } from '../../src/constants.js';
import { buildFMMCells, fmmGravity } from '../../src/physics/fmm.js';
import { compareBackends, createFixture } from '../../bench/backend-compare.mjs';

describe('FMM backend boundaries', () => {
  it('uses a real toroidal near-cell stencil and exposes accounting metadata', () => {
    const view = new Float32Array(PARTICLE_STRIDE * 2);
    view[S.POS_X] = 1;
    view[S.POS_Y] = WORLD_SIZE * 0.5;
    view[S.POS_Z] = WORLD_SIZE * 0.5;
    view[S.MASS] = 1;
    view[PARTICLE_STRIDE + S.POS_X] = WORLD_SIZE - 1;
    view[PARTICLE_STRIDE + S.POS_Y] = WORLD_SIZE * 0.5;
    view[PARTICLE_STRIDE + S.POS_Z] = WORLD_SIZE * 0.5;
    view[PARTICLE_STRIDE + S.MASS] = 1;

    const cells = buildFMMCells(null, view, PARTICLE_STRIDE, 2, WORLD_SIZE, 2);
    expect(cells.nearCellCount).toBeGreaterThan(0);
    expect(cells.farCellCount).toBeGreaterThanOrEqual(0);
    expect(cells.neighbourList.length).toBe(cells.nearCellCount);
    expect(cells.interList.length).toBe(cells.farCellCount);
  });

  it('produces finite output for a deterministic fixture and reports near/far work', () => {
    const view = createFixture(32, 0x12345678);
    const fx = new Float64Array(32);
    const fy = new Float64Array(32);
    const fz = new Float64Array(32);
    const result = fmmGravity(view, PARTICLE_STRIDE, 32, WORLD_SIZE, 1, fx, fy, fz);

    expect(result.nearCellCount).toBeGreaterThan(0);
    expect(result.farCellCount).toBeGreaterThanOrEqual(0);
    for (const force of [...fx, ...fy, ...fz]) expect(Number.isFinite(force)).toBe(true);
  });

  it('keeps backend comparison explicitly relative to direct gravity', () => {
    const result = compareBackends({ count: 32, seed: 0x12345678 });
    expect(result.reference.backend).toBe('exact-direct-gravity');
    expect(result.candidates.octree.error.rmsAbsolute).toBeGreaterThanOrEqual(0);
    expect(result.candidates.fmm.error.rmsAbsolute).toBeGreaterThanOrEqual(0);
    expect(result.interpretation).toContain('Gravity-kernel fixture only');
  });

  it('pins the documented envelope band: octree supported, FMM experimental', () => {
    // docs/BACKEND_ENVELOPES.md §2/§3 — if FMM accuracy improves enough to
    // enter the envelope, this test fails and the status docs must be updated
    // in the same change (remediation plan §5.1 decision gate).
    for (const count of [32, 128, 512]) {
      const result = compareBackends({ count, seed: 0x12345678 });
      const octree = result.candidates.octree.assessment;
      const fmm = result.candidates.fmm.assessment;
      expect(octree.finite).toBe(true);
      if (count <= 128) {
        expect(octree.withinTolerance).toBe(true);
      }
      expect(fmm.finite).toBe(true);
      expect(fmm.withinTolerance).toBe(false);
    }
  });

  it('keeps FMM opt-in and outside the default solver path', () => {
    const solver = readFileSync(new URL('../../src/physics/solver.js', import.meta.url), 'utf8');
    expect(solver).toContain("runtimeConfig.gravEngine === 'fmm'");
    const config = readFileSync(new URL('../../src/state/runtimeConfig.js', import.meta.url), 'utf8');
    expect(config).toMatch(/gravEngine[\s\S]{0,80}?(exact|bh)/);
    expect(config).not.toMatch(/gravEngine\s*:\s*'fmm'/);
  });
});
