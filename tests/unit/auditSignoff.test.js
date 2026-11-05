import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SIGNOFF_STATUSES,
  validateSignoffFile,
  validateSignoffManifest,
} from '../../scripts/validate-signoff.mjs';

const manifest = JSON.parse(
  readFileSync(new URL('../../docs/spec/audit/signoff-manifest.json', import.meta.url), 'utf8'),
);

/** Synthetic options so unit tests do not depend on the live worktree. */
function options({ existing = new Set() } = {}) {
  return {
    lawNames: new Set(['GRAV', 'LIFE', 'CONTACT', 'COLL']),
    fileExists: (path) => existing.has(path),
  };
}

function record(overrides = {}) {
  return {
    id: 'sample',
    claim: 'A bounded descriptive claim backed by its linked evidence.',
    status: 'experimental',
    implementation: 'src/sample.js',
    dispatch: 'runtimeConfig.sample === true',
    tests: ['tests/unit/sample.test.js'],
    ...overrides,
  };
}

const tree = options({
  existing: new Set([
    'src/sample.js',
    'tests/unit/sample.test.js',
    'tests/unit/other.test.js',
  ]),
});

describe('audit sign-off gate (remediation §4.1)', () => {
  it('accepts the checked-in sign-off manifest against the live tree', () => {
    expect(validateSignoffFile()).toEqual([]);
  });

  it('classifies every record into the approved status vocabulary', () => {
    expect(manifest.records.length).toBeGreaterThan(0);
    for (const entry of manifest.records) {
      expect(SIGNOFF_STATUSES).toContain(entry.status);
    }
  });

  it('rejects a stale implementation path', () => {
    const errors = validateSignoffManifest(
      { records: [record({ implementation: 'src/removed.js' })] },
      tree,
    );
    expect(errors.join('\n')).toMatch(/stale implementation path/);
  });

  it('rejects a stale test path', () => {
    const errors = validateSignoffManifest(
      { records: [record({ tests: ['tests/unit/removed.test.js'] })] },
      tree,
    );
    expect(errors.join('\n')).toMatch(/stale or invalid test path/);
  });

  it('rejects an unknown law name', () => {
    const errors = validateSignoffManifest({ records: [record({ law: 'NOT_A_LAW' })] }, tree);
    expect(errors.join('\n')).toMatch(/unknown law name/);
  });

  it('rejects a record with no executable test and no explicit not-tested status', () => {
    const errors = validateSignoffManifest({ records: [record({ tests: [] })] }, tree);
    expect(errors.join('\n')).toMatch(/no executable test linked/);
  });

  it('allows an explicit not-tested status only with a justification note', () => {
    const missingNote = validateSignoffManifest(
      { records: [record({ tests: [], evidence: 'not-tested' })] },
      tree,
    );
    expect(missingNote.join('\n')).toMatch(/justification note/);

    const withNote = validateSignoffManifest(
      { records: [record({ tests: [], evidence: 'not-tested', notes: 'Validated by script X.' })] },
      tree,
    );
    expect(withNote).toEqual([]);
  });

  it('rejects unsupported completion claims', () => {
    const errors = validateSignoffManifest(
      {
        records: [
          record({
            claim: 'The backend is complete and fully verified.',
            status: 'metadata-only',
            tests: [],
            evidence: 'not-tested',
            notes: 'Prose only.',
          }),
        ],
      },
      tree,
    );
    expect(errors.join('\n')).toMatch(/completion claim requires status "operational"/);
  });

  it('requires dispatch evidence for operational, proxy, and experimental records', () => {
    for (const status of ['operational', 'proxy', 'experimental']) {
      const errors = validateSignoffManifest(
        { records: [record({ status, dispatch: undefined })] },
        tree,
      );
      expect(errors.join('\n')).toMatch(/requires solver gate\/dispatch evidence/);
    }
  });

  it('rejects unknown statuses and duplicate ids', () => {
    const errors = validateSignoffManifest(
      { records: [record({ status: 'done' }), record()] },
      tree,
    );
    expect(errors.join('\n')).toMatch(/unknown status "done"/);
    expect(errors.join('\n')).toMatch(/duplicate sign-off id/);
  });
});
