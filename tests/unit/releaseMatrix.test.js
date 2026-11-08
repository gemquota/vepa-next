import { describe, expect, it } from 'vitest';
import { runReleaseMatrix } from '../../bench/release-matrix.mjs';

describe('release benchmark matrix', () => {
  it('produces deterministic fixture coverage and honest measurement scope', () => {
    const report = runReleaseMatrix({ counts: [8], seeds: [123] });
    expect(report.schemaVersion).toBe(1);
    expect(report.matrix).toEqual({ counts: [8], seeds: [123] });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].timings.exact.samples).toBe(1);
    expect(report.scope.notMeasured).toContain('full product solver and law-mask combinations');
    expect(report.rows[0].error.octree.maxRmsRelative).toBeGreaterThanOrEqual(0);
  });
});
