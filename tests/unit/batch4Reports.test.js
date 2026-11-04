import { describe, expect, it } from 'vitest';
import { compareBackends } from '../../bench/backend-compare.mjs';
import { inspectAuditCorpus } from '../../scripts/audit-corpus-report.mjs';


describe('Batch 4 backend comparison report', () => {
  it('compares both approximate backends against the exact fixture', () => {
    const report = compareBackends({ count: 16, seed: 123 });
    expect(report.reference.backend).toBe('exact-direct-gravity');
    expect(report.candidates.octree.error.rmsRelative).toBeGreaterThanOrEqual(0);
    expect(report.candidates.fmm.error.rmsRelative).toBeGreaterThanOrEqual(0);
    expect(report.interpretation).toMatch(/fixture only/i);
  });

  it('is deterministic for the same fixture and configuration', () => {
    const first = compareBackends({ count: 12, seed: 456 });
    const second = compareBackends({ count: 12, seed: 456 });
    expect(first.candidates.octree.error).toEqual(second.candidates.octree.error);
    expect(first.candidates.fmm.error).toEqual(second.candidates.fmm.error);
  });
});

describe('Batch 4 audit ownership inventory', () => {
  it('classifies the current corpus without mutating it', () => {
    const report = inspectAuditCorpus();
    expect(report.fileCount).toBeGreaterThan(0);
    expect(report.families['stage-1']).toBeGreaterThan(0);
    expect(report.families['stage-2']).toBeGreaterThan(0);
    expect(report.families['stage-3']).toBeGreaterThan(0);
    expect(report.ownership.deletionPolicy).toMatch(/no deletion/i);
    expect(report.files).toHaveLength(report.fileCount);
  });
});
