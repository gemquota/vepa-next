import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpatialGrid, clearSpatialGrid, insertParticle, queryNeighbors, queryNeighborsOrAll } from '../../src/sim/spatial-grid.js';

test('grid inserts and returns local neighbors across toroidal boundaries', () => {
  const grid = createSpatialGrid({ worldSize: 12, dim: 3 });
  assert.equal(insertParticle(grid, 7, .1, 2, 2).inserted, true);
  const out = new Int32Array(8);
  const result = queryNeighbors(grid, 11.9, 2, 2, out);
  assert.equal(result.truncated, false);
  assert.equal(result.count, 1);
  assert.equal(out[0], 7);
});

test('capacity overflow remains queryable and is reported', () => {
  const grid = createSpatialGrid({ worldSize: 10, dim: 2, cellCap: 1 });
  assert.equal(insertParticle(grid, 1, 1, 1, 1).inserted, true);
  const second = insertParticle(grid, 2, 1.1, 1.1, 1.1);
  assert.equal(second.inserted, true);
  assert.equal(second.overflow, true);
  assert.equal(second.reason, 'cell-capacity-overflow');
  assert.equal(grid.overflowCount, 1);
  const out = new Int32Array(4);
  const result = queryNeighbors(grid, 1, 1, 1, out);
  assert.equal(result.count, 2);
  assert.equal(result.truncated, false);
  assert.deepEqual([...out.slice(0, 2)].sort(), [1, 2]);
});

test('neighbor output cap explicitly reports truncation', () => {
  const grid = createSpatialGrid({ worldSize: 10, dim: 2 });
  insertParticle(grid, 1, 1, 1, 1);
  insertParticle(grid, 2, 2, 1, 1);
  const result = queryNeighbors(grid, 1, 1, 1, new Int32Array(1));
  assert.equal(result.count, 1);
  assert.equal(result.truncated, true);
});

test('clear resets active cells and overflow diagnostics', () => {
  const grid = createSpatialGrid({ worldSize: 10, dim: 2, cellCap: 1 });
  insertParticle(grid, 1, 1, 1, 1);
  insertParticle(grid, 2, 1.1, 1.1, 1.1);
  clearSpatialGrid(grid);
  assert.equal(grid.touchedCount, 0);
  assert.equal(grid.overflowCount, 0);
  assert.equal(grid.overflowCells.size, 0);
  assert.equal(grid.counts.reduce((a, b) => a + b, 0), 0);
});

test('rejects invalid grid and coordinate inputs', () => {
  assert.throws(() => createSpatialGrid({ worldSize: 0 }), /worldSize/);
  assert.throws(() => createSpatialGrid({ worldSize: 10, dim: 0 }), /dim/);
  assert.throws(() => createSpatialGrid({ worldSize: 10, dim: 64 }), /cell budget/);
  const grid = createSpatialGrid({ worldSize: 10 });
  assert.throws(() => insertParticle(grid, 1, NaN, 1, 1), /coordinates/);
});


test('complete neighbor query falls back to all particles when local output truncates', () => {
  const grid = createSpatialGrid({ worldSize: 20, dim: 4 });
  insertParticle(grid, 0, 1, 1, 1);
  insertParticle(grid, 3, 1.1, 1.1, 1.1);
  insertParticle(grid, 7, 15, 15, 15);
  const out = new Int32Array(3);
  const result = queryNeighborsOrAll(grid, 1, 1, 1, out, 3, 1);
  assert.equal(result.complete, true);
  assert.equal(result.usedFallback, true);
  assert.equal(result.truncated, false);
  assert.equal(result.count, 3);
  assert.deepEqual([...out], [0, 1, 2]);
});

test('complete neighbor query refuses to hide fallback truncation when buffer is too small', () => {
  const grid = createSpatialGrid({ worldSize: 20, dim: 4 });
  insertParticle(grid, 0, 1, 1, 1);
  insertParticle(grid, 1, 1.1, 1.1, 1.1);
  const result = queryNeighborsOrAll(grid, 1, 1, 1, new Int32Array(1), 2, 0);
  assert.equal(result.complete, false);
  assert.equal(result.truncated, true);
  assert.equal(result.requiredCapacity, 2);
  assert.equal(result.reason, 'fallback-buffer-too-small');
});
