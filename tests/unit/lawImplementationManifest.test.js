import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(
  readFileSync(new URL('../../docs/spec/laws/implementation-status.json', import.meta.url), 'utf8'),
);

describe('generated law implementation manifest', () => {
  it('covers every registered law index exactly once', () => {
    expect(manifest.declaredLawCount).toBe(136);
    expect(manifest.records).toHaveLength(manifest.declaredLawCount);
    expect(new Set(manifest.records.map(record => record.index)).size).toBe(manifest.declaredLawCount);
    expect(manifest.records.map(record => record.index)).toEqual(
      Array.from({ length: manifest.declaredLawCount }, (_, index) => index),
    );
  });

  it('reports evidence categories without treating text matches as semantic proof', () => {
    const validStatuses = new Set(['wired', 'implemented-not-gated', 'metadata-only']);
    expect(manifest.records.every(record => validStatuses.has(record.status))).toBe(true);
    expect(manifest.records.every(record =>
      record.evidenceBoundary.includes('not semantic correctness proof'),
    )).toBe(true);
    expect(manifest.summary.wired + manifest.summary.implementedNotGated + manifest.summary.metadataOnly)
      .toBe(manifest.declaredLawCount);
  });
});
