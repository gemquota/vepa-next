import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LAW_INDEXES } from '../../src/constants.js';
import { LAW_RELATIONSHIP_TYPES, validateLawOntology } from '../../src/state/lawOntology.js';

const coverage = JSON.parse(
  readFileSync(new URL('../../docs/spec/laws/ontology-coverage.json', import.meta.url), 'utf8'),
);

describe('generated law ontology coverage', () => {
  it('accounts for every registered law exactly once', () => {
    const names = Object.keys(LAW_INDEXES);
    const covered = [...coverage.lawsWithMetadata, ...coverage.lawsWithoutMetadata];
    expect(coverage.declaredLawCount).toBe(names.length);
    expect(new Set(covered).size).toBe(names.length);
    expect(new Set(covered)).toEqual(new Set(names));
  });

  it('reports the canonical relationship vocabulary and valid ontology data', () => {
    expect(Object.keys(coverage.recordsByRelationshipType).sort()).toEqual([...LAW_RELATIONSHIP_TYPES].sort());
    expect(coverage.evidenceBoundary).toContain('does not prove semantic completeness');
    expect(validateLawOntology()).toEqual([]);
  });
});
