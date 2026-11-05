import { describe, expect, it } from 'vitest';
import { inspectRepositoryArtifacts } from '../../scripts/repository-artifact-report.mjs';

describe('Batch 5 repository artifact inventory', () => {
  it('classifies export snapshots and historical tools', () => {
    const report = inspectRepositoryArtifacts();
    // H3 reconciliation (2026-09-30) retired the non-canonical parallel full
    // snapshot and the unregenerable headless-core bundle, leaving the two
    // artifacts that `npm run concat` actually produces.
    expect(report.exports).toHaveLength(2);
    expect(report.exports.every((item) => item.exists)).toBe(true);
    expect(report.tooling.find((item) => item.path === 'tests/run.mjs').status)
      .toBe('archived-legacy-runner');
    expect(report.tooling.find((item) => item.path === 'scripts/patch-lawcat-test.mjs').status)
      .toBe('historical-migration-utility');
  });

  it('records retired artifacts with a recovery boundary', () => {
    const report = inspectRepositoryArtifacts();
    expect(report.retired).toHaveLength(2);
    for (const item of report.retired) {
      expect(item.status).toBe('retired-2026-09-30');
      expect(item.exists).toBe(false);
      expect(item.note).toMatch(/git history/i);
    }
  });

  it('does not authorize deletion', () => {
    const report = inspectRepositoryArtifacts();
    expect(report.policy.deletion).toMatch(/not authorized/i);
    expect(report.policy.sourceOfTruth).toContain('src/');
  });
});
