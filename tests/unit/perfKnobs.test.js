import { describe, it, expect } from 'vitest';
import { createGrid, clear, insert, getNeighbors, GRID_DIM, DEFAULT_CELL_CAP } from '../../src/physics/spatialGrid.js';
import { WORLD_PARAM_DEFS, createWorldParams, clampWorldParam } from '../../src/state/worldParams.js';

describe('Performance knobs — WORLD_PARAM_DEFS', () => {
  const perfDefs = WORLD_PARAM_DEFS.filter((d) => d.group === 'PERFORMANCE');

  it('exposes a dedicated PERFORMANCE accordion group', () => {
    expect(perfDefs.length).toBe(9);
  });

  it('defines the solver knobs with classic defaults', () => {
    const byKey = Object.fromEntries(perfDefs.map((d) => [d.key, d]));
    expect(byKey.AUTO_TUNE).toBeTruthy();
    expect(byKey.GRID_DIM).toBeTruthy();
    expect(byKey.CELL_CAP).toBeTruthy();
    expect(byKey.MAX_INTERACTIONS).toBeTruthy();
    expect(byKey.NEIGHBOR_BUF).toBeTruthy();
    expect(byKey.AUTO_TUNE.default).toBe(1);
    expect(byKey.GRID_DIM.default).toBe(12);
    expect(byKey.CELL_CAP.default).toBe(100);
    expect(byKey.MAX_INTERACTIONS.default).toBe(500);
    expect(byKey.NEIGHBOR_BUF.default).toBe(2000);
  });

  it('lands in createWorldParams with the documented defaults', () => {
    const state = createWorldParams();
    expect(state.AUTO_TUNE).toBe(1);
    expect(state.GRID_DIM).toBe(12);
    expect(state.CELL_CAP).toBe(100);
    expect(state.MAX_INTERACTIONS).toBe(500);
    expect(state.NEIGHBOR_BUF).toBe(2000);
  });

  it('clamps the knobs to their slider ranges', () => {
    expect(clampWorldParam('GRID_DIM', 1)).toBe(6);
    expect(clampWorldParam('GRID_DIM', 1000)).toBe(64);
    expect(clampWorldParam('MAX_INTERACTIONS', 1)).toBe(8);
    expect(clampWorldParam('NEIGHBOR_BUF', 1)).toBe(24);
  });
});

describe('Performance knobs — spatial grid', () => {
  it('creates a dynamic-resolution grid', () => {
    const grid = createGrid(6);
    expect(grid.dim).toBe(6);
    expect(grid.cells.length).toBe(6 * 6 * 6);
    expect(GRID_DIM).toBe(12); // exported default unchanged
  });

  it('caps particles per cell', () => {
    const grid = createGrid(12, 1);
    // WORLD_SIZE default is 240; at dim 12 the cell size is 20, so both
    // particles land in the same cell and only the first is retained.
    insert(grid, 0, 100, 100, 0, 240);
    insert(grid, 1, 101, 101, 0, 240);
    const out = new Int32Array(64);
    const count = getNeighbors(grid, 100, 100, 0, 240, out);
    expect(count).toBe(1);
    expect(out[0]).toBe(0);
  });

  it('truncates the neighbour gather at the requested cap', () => {
    const grid = createGrid(12, DEFAULT_CELL_CAP);
    for (let i = 0; i < 8; i++) {
      insert(grid, i, 100 + i, 100, 0, 240);
    }
    const out = new Int32Array(64);
    const count = getNeighbors(grid, 100, 100, 0, 240, out, 3);
    expect(count).toBe(3);
    const uncapped = new Int32Array(64);
    const full = getNeighbors(grid, 100, 100, 0, 240, uncapped);
    expect(full).toBeGreaterThanOrEqual(8);
  });

  it('clear() resets counts after dynamic inserts', () => {
    const grid = createGrid(8, 50);
    insert(grid, 0, 10, 10, 10, 240);
    clear(grid);
    const out = new Int32Array(32);
    expect(getNeighbors(grid, 10, 10, 10, 240, out)).toBe(0);
  });
});
