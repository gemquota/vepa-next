import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareBackends } from '../../../bench/backend-compare.mjs';
import { runtimeConfig } from '../../../src/state/runtimeConfig.js';

test('exact direct gravity remains the numerical reference and FMM remains experimental outside the envelope', () => {
  assert.equal(runtimeConfig.gravEngine, 'exact');
  const result = compareBackends({ count: 128, seed: 0x12345678, theta: 0.7 });
  assert.equal(result.reference.backend, 'exact-direct-gravity');
  assert.ok(result.candidates.octree.assessment.finite);
  assert.ok(result.candidates.fmm.assessment.finite);
  assert.equal(result.candidates.fmm.assessment.withinTolerance, false);
  const policy = readFileSync(new URL('../../../docs/BACKEND_ENVELOPES.md', import.meta.url), 'utf8');
  assert.match(policy, /FMM[\s\S]{0,200}experimental/i);
  assert.match(policy, /exact CPU[\s\S]{0,100}reference/i);
});

test('backend benchmark reports error envelopes rather than promoting an approximation', () => {
  const result = compareBackends({ count: 32, seed: 0x12345678 });
  for (const candidate of Object.values(result.candidates)) {
    assert.ok(Number.isFinite(candidate.error.rmsRelative));
    assert.ok(Number.isFinite(candidate.error.maxAbsolute));
    assert.equal(typeof candidate.assessment.withinTolerance, 'boolean');
  }
});
