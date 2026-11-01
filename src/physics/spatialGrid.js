// ============================================================================
// VEPA4 — Spatial Hash Grid
// Coarse N³ partitioning for O(N) neighbor lookups in the N-body simulation.
// Resolution (dim), the per-cell insert cap (cellCap) and the neighbor gather
// cap are runtime-tunable performance knobs (SETUP > WORLD > PERFORMANCE);
// the exported defaults preserve the classic 12³ / 100 / unlimited behaviour.
// ============================================================================

import { WORLD_SIZE } from '../constants.js';

export const GRID_DIM = 12;           // default resolution (12³ cells)
export const DEFAULT_CELL_CAP = 100;  // default per-cell insert cap

/**
 * Create an empty spatial grid.
 * @param {number} [dim] - Grid resolution (dim³ cells). Default 12.
 * @param {number} [cellCap] - Max particles retained per cell. Default 100.
 */
export function createGrid(dim = GRID_DIM, cellCap = DEFAULT_CELL_CAP) {
  const cellSize = WORLD_SIZE / dim;
  const totalCells = dim * dim * dim;
  const cells = new Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    cells[i] = [];
  }
  return {
    cells,
    counts: new Int32Array(totalCells),
    // Only cells receiving particles need clearing. At high AUTO_TUNE grid
    // dimensions most cells are empty, so tracking the active set avoids a
    // full dim³ scan on every solver tick.
    touched: new Int32Array(totalCells),
    touchedCount: 0,
    cellSize,
    dim,
    cellCap,
  };
}

/**
 * Clear all cells back to empty.
 */
export function clear(grid) {
  for (let i = 0; i < grid.touchedCount; i++) {
    const cellIndex = grid.touched[i];
    grid.cells[cellIndex].length = 0;
    grid.counts[cellIndex] = 0;
  }
  grid.touchedCount = 0;
}

/**
 * Map a world coordinate to a cell coordinate (toroidal).
 */
function toCell(coord, cellSize, dim) {
  if (!Number.isFinite(coord) || !Number.isFinite(cellSize) || cellSize <= 0) return 0;
  let c = Math.floor(coord / cellSize);
  c = ((c % dim) + dim) % dim;
  return c;
}

/**
 * Compute flat cell index from 3D grid coordinates.
 */
function cellIndex(cx, cy, cz, dim) {
  return cz * dim * dim + cy * dim + cx;
}

/**
 * Insert a particle into the grid.
 * @param {object} grid - Grid returned by createGrid()
 * @param {number} index - Particle index in the buffer
 * @param {number} px - Particle X position
 * @param {number} py - Particle Y position
 * @param {number} pz - Particle Z position
 * @param {number} worldSize - World size for toroidal wrapping
 */
export function insert(grid, index, px, py, pz, worldSize) {
  const cx = toCell(px, grid.cellSize, grid.dim);
  const cy = toCell(py, grid.cellSize, grid.dim);
  const cz = toCell(pz, grid.cellSize, grid.dim);
  const ci = cellIndex(cx, cy, cz, grid.dim);
  const cell = grid.cells[ci];
  if (!cell) return;
  if (cell.length === 0) grid.touched[grid.touchedCount++] = ci;
  if (cell.length < grid.cellCap) {
    cell.push(index);
    grid.counts[ci]++;
  }
}

/**
 * Get all neighbor indices from the 27-cell neighborhood.
 * Writes into preallocated output array for zero GC pressure.
 *
 * @param {object} grid
 * @param {number} px - Query particle X
 * @param {number} py - Query particle Y
 * @param {number} pz - Query particle Z
 * @param {number} worldSize
 * @param {number[]} out - Preallocated output array
 * @param {number} [maxNeighbors] - Gather cap (truncates the neighbourhood;
 *        the performance knob NEIGHBOR_BUF). Defaults to unlimited.
 * @returns {number} number of neighbors written to out
 */
export function getNeighbors(grid, px, py, pz, worldSize, out, maxNeighbors = Infinity) {
  const cx = toCell(px, grid.cellSize, grid.dim);
  const cy = toCell(py, grid.cellSize, grid.dim);
  const cz = toCell(pz, grid.cellSize, grid.dim);
  let count = 0;

  for (let dz = -1; dz <= 1; dz++) {
    const nz = ((cz + dz) % grid.dim + grid.dim) % grid.dim;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = ((cy + dy) % grid.dim + grid.dim) % grid.dim;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = ((cx + dx) % grid.dim + grid.dim) % grid.dim;
        const ci = cellIndex(nx, ny, nz, grid.dim);
        const cell = grid.cells[ci];
        if (!cell) continue;
        for (let k = 0; k < cell.length; k++) {
          if (count >= maxNeighbors) return count;
          out[count++] = cell[k];
        }
      }
    }
  }
  return count;
}
