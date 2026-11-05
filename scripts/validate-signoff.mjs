#!/usr/bin/env node
// Audit sign-off validator — remediation plan §4.1 (executable audit gates).
//
// Every current audit sign-off must classify itself, point at a real runtime
// implementation, name its solver gate/dispatch evidence, and link at least
// one executable test — or declare an explicit `not-tested` status with a
// justification. Claims that assert completeness without executable proof are
// rejected so prose can never out-run the evidence.
import { existsSync, readFileSync } from 'node:fs';
import { LAW_INDEXES } from '../src/constants.js';

export const SIGNOFF_STATUSES = Object.freeze([
  'operational',
  'proxy',
  'experimental',
  'metadata-only',
  'historical',
]);

const COMPLETION_CLAIM = /\bcomplete(d|ness|ly)?\b/i;
const DISPATCH_REQUIRED = new Set(['operational', 'proxy', 'experimental']);

/**
 * Validate a sign-off manifest object.
 *
 * @param {{records?: Array<object>}} manifest parsed signoff-manifest.json
 * @param {{ lawNames?: Set<string>, fileExists?: (path: string) => boolean }} [options]
 * @returns {string[]} human-readable errors (empty when valid)
 */
export function validateSignoffManifest(manifest, options = {}) {
  const lawNames = options.lawNames ?? new Set(Object.keys(LAW_INDEXES));
  const fileExists = options.fileExists ?? existsSync;
  const errors = [];

  if (!manifest || !Array.isArray(manifest.records) || manifest.records.length === 0) {
    errors.push('signoff manifest must contain a non-empty records array');
    return errors;
  }

  const seenIds = new Set();
  for (const record of manifest.records) {
    const label = record.id || '<missing id>';

    if (typeof record.id !== 'string' || record.id.length === 0) {
      errors.push(`signoff record is missing a string id`);
      continue;
    }
    if (seenIds.has(record.id)) errors.push(`${label}: duplicate sign-off id`);
    seenIds.add(record.id);

    if (typeof record.claim !== 'string' || record.claim.trim().length === 0) {
      errors.push(`${label}: claim text is required`);
    }

    if (!SIGNOFF_STATUSES.includes(record.status)) {
      errors.push(`${label}: unknown status "${record.status}" (expected ${SIGNOFF_STATUSES.join('|')})`);
    }

    if (typeof record.implementation !== 'string' || record.implementation.length === 0) {
      errors.push(`${label}: implementation file is required`);
    } else if (!fileExists(record.implementation)) {
      errors.push(`${label}: stale implementation path "${record.implementation}"`);
    }

    if (DISPATCH_REQUIRED.has(record.status) &&
        (typeof record.dispatch !== 'string' || record.dispatch.trim().length === 0)) {
      errors.push(`${label}: status "${record.status}" requires solver gate/dispatch evidence`);
    }

    const tests = record.tests ?? [];
    if (!Array.isArray(tests)) {
      errors.push(`${label}: tests must be an array of file paths`);
    } else {
      for (const testPath of tests) {
        if (typeof testPath !== 'string' || !fileExists(testPath)) {
          errors.push(`${label}: stale or invalid test path "${testPath}"`);
        }
      }
      const tested = tests.length > 0;
      const declaredNotTested = record.evidence === 'not-tested';
      if (!tested && !declaredNotTested) {
        errors.push(`${label}: no executable test linked — add a test path or an explicit evidence:"not-tested" status with notes`);
      }
      if (declaredNotTested && (typeof record.notes !== 'string' || record.notes.trim().length === 0)) {
        errors.push(`${label}: evidence "not-tested" requires a justification note`);
      }
      // Unsupported completion claims: prose may not assert completeness
      // unless an executable test backs the record.
      if (typeof record.claim === 'string' && COMPLETION_CLAIM.test(record.claim)) {
        if (record.status !== 'operational' || !tested) {
          errors.push(`${label}: completion claim requires status "operational" and at least one executable test`);
        }
      }
    }

    if (record.law !== undefined && !lawNames.has(record.law)) {
      errors.push(`${label}: unknown law name "${record.law}"`);
    }
  }

  return errors;
}

/** Load and validate the checked-in manifest against the live tree. */
export function validateSignoffFile(path = 'docs/spec/audit/signoff-manifest.json') {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  return validateSignoffManifest(manifest);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateSignoffFile(process.argv[2] || undefined);
  if (errors.length > 0) {
    console.error('signoff:check failed');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('signoff:check passed');
  }
}
