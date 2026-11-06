import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpatialGrid, insertParticle, queryNeighborsOrAll } from '../../src/sim/spatial-grid.js';

function makePoints(count, worldSize, seed = 0x12345678) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return Array.from({ length: count }, () => [next() * worldSize, next() * worldSize, next() * worldSize]);
}
function toroidalDistanceSquared(a, b, worldSize) {
  const d = [0, 1, 2].map(axis => {
    const raw = Math.abs(a[axis] - b[axis]);
    return Math.min(raw, worldSize - raw);
  });
  return d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
}

test('periodic spatial grid never misses an exact-radius pair, including overflow particles', () => {
  const worldSize = 120, radius = 18, points = makePoints(96, worldSize);
  points[0] = [0.1, 60, 60];
  points[1] = [119.9, 60, 60];
  const grid = createSpatialGrid({ worldSize, dim: 6, cellCap: 2 });
  points.forEach((p, i) => insertParticle(grid, i, ...p));
  assert.ok(grid.overflowCount > 0);
  const candidatePairs = new Set();
  const output = new Int32Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const query = queryNeighborsOrAll(grid, ...points[i], output, points.length);
    assert.equal(query.complete, true);
    assert.equal(query.truncated, false);
    const candidates = new Set(Array.from(output.subarray(0, query.count)));
    for (let j = i + 1; j < points.length; j++) {
      const exact = toroidalDistanceSquared(points[i], points[j], worldSize) <= radius * radius;
      if (exact) assert.ok(candidates.has(j), `grid missed periodic neighbor pair ${i},${j}`);
      if (exact && candidates.has(j)) candidatePairs.add(`${i}:${j}`);
    }
  }
  let exactPairCount = 0;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (toroidalDistanceSquared(points[i], points[j], worldSize) <= radius * radius) exactPairCount++;
  }
  assert.equal(candidatePairs.size, exactPairCount);
  assert.ok(candidatePairs.has('0:1'), 'periodic face pair must be found');
});

test('neighbor truncation falls back to complete scan or explicitly reports insufficient capacity', () => {
  const points = makePoints(32, 100);
  const grid = createSpatialGrid({ worldSize: 100, dim: 5 });
  points.forEach((p, i) => insertParticle(grid, i, ...p));
  const complete = queryNeighborsOrAll(grid, ...points[0], new Int32Array(points.length), points.length, 1);
  assert.equal(complete.complete, true);
  assert.equal(complete.usedFallback, true);
  assert.equal(complete.count, points.length);
  const incomplete = queryNeighborsOrAll(grid, ...points[0], new Int32Array(2), points.length, 1);
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.reason, 'fallback-buffer-too-small');
});
