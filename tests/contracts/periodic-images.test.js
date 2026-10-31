import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePeriodicImagePair, estimatePeriodicImageConvergence } from '../../src/sim/periodic-images.js';

const pair = { first: [1, 2, 3], second: [4, 5, 6], boxSize: 20, softening: 0.5, strength: -2 };

test('finite periodic image shell has deterministic symmetric image identities', () => {
  const a = calculatePeriodicImagePair({ ...pair, shell: 1 });
  const b = calculatePeriodicImagePair({ ...pair, shell: 1 });
  assert.equal(a.imageCount, 27);
  assert.deepEqual(a.images.map(x => x.imageId), b.images.map(x => x.imageId));
  assert.deepEqual(a.forceOnFirst, b.forceOnFirst);
  assert.equal(a.convention, 'symmetric-cubic-finite-shell');
});

test('shell zero agrees with the independently evaluated softened pair formula', () => {
  const result = calculatePeriodicImagePair({ ...pair, shell: 0 });
  const d = pair.second.map((v, i) => v - pair.first[i]);
  const r2 = d.reduce((s, v) => s + v * v, 0);
  const denominator = (r2 + pair.softening ** 2) ** 1.5;
  assert.ok(Math.abs(result.forceOnFirst[0] - (-pair.strength * d[0] / denominator)) < 1e-14);
  assert.ok(Math.abs(result.potential - pair.strength / Math.sqrt(r2 + pair.softening ** 2)) < 1e-14);
});

test('symmetric image shells cancel opposite-image force components at coincident positions', () => {
  const result = calculatePeriodicImagePair({ first: [0,0,0], second: [0,0,0],
    boxSize: 10, softening: 1, strength: 3, shell: 2 });
  assert.ok(result.forceOnFirst.every(v => Math.abs(v) < 1e-12));
});

test('convergence report compares successive shells but never claims a rigorous error bound', () => {
  const report = estimatePeriodicImageConvergence(pair, { shells: [0, 1, 2] });
  assert.equal(report.comparisons.length, 2);
  assert.equal(report.errorBound, null);
  assert.equal(typeof report.convergedByObservedDelta, 'boolean');
});

test('invalid and ambiguous shell settings fail closed', () => {
  assert.throws(() => calculatePeriodicImagePair({ ...pair, shell: -1 }), /shell/i);
  assert.throws(() => calculatePeriodicImagePair({ ...pair, shell: 13 }), /shell/i);
  assert.throws(() => estimatePeriodicImageConvergence(pair, { shells: [1, 1] }), /increasing/i);
  assert.throws(() => calculatePeriodicImagePair({ ...pair, boxSize: 0 }), /boxSize/i);
});
