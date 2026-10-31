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

import { createParticleExecutionAdapter } from '../../src/sim/execution-adapter.js';
import { PARTICLE_STRIDE, PARTICLE_SLOTS as S } from '../../src/sim/particle-layout.js';

test('system reference conserves pair force and exposes stable pair provenance', () => {
  const result = calculatePeriodicImageSystem({
    particles: [
      { id: 'alpha', position: [1, 2, 3] },
      { id: 'beta', position: [4, 5, 6] },
      { id: 'gamma', position: [8, 2, 1] },
    ],
    boxSize: 20, softening: 0.5, shell: 1,
    pairStrength: (a, b) => a.id === 'alpha' && b.id === 'beta' ? -2 : 1,
  });
  assert.equal(result.pairCount, 3);
  assert.equal(result.pairEvidence[0].pairId, 'alpha|beta');
  const net = result.forces.reduce((sum, item) => sum.map((v, i) => v + item.force[i]), [0,0,0]);
  assert.ok(net.every(v => Math.abs(v) < 1e-12));
});

test('system reference rejects duplicate identities before evaluating any pair', () => {
  assert.throws(() => calculatePeriodicImageSystem({
    particles: [{ id: 'same', position: [0,0,0] }, { id: 'same', position: [1,0,0] }],
    boxSize: 10, softening: 1, pairStrength: () => 1,
  }), /unique/i);
});

test('execution adapter exposes periodic reference without changing solver policy', () => {
  const state = new Float64Array(PARTICLE_STRIDE);
  state[S.MASS] = 1;
  const adapter = createParticleExecutionAdapter({ initialState: state, count: 1 });
  assert.equal(typeof adapter.calculatePeriodicImagePair, 'function');
  assert.equal(typeof adapter.calculatePeriodicImageSystem, 'function');
  assert.equal(typeof adapter.estimatePeriodicImageConvergence, 'function');
  assert.equal(adapter.getConfig().boundaryMode, 'toroidal');
});
