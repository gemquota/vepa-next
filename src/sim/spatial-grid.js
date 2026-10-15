/**
 * SIM-oriented spatial grid. Unlike the legacy helper, capacity exhaustion and
 * neighbor-output truncation are explicit results, never silent omissions.
 * The grid is toroidal to match the inspected legacy implementation.
 */
export function createSpatialGrid({ worldSize, dim = 12, cellCap = Infinity } = {}) {
  if (!Number.isFinite(worldSize) || worldSize <= 0) throw new RangeError('worldSize must be finite and > 0');
  if (!Number.isInteger(dim) || dim < 1) throw new RangeError('dim must be an integer >= 1');
  if (!(cellCap === Infinity || (Number.isInteger(cellCap) && cellCap >= 1))) {
    throw new RangeError('cellCap must be a positive integer or Infinity');
  }
  const totalCells = dim ** 3;
  const cells = Array.from({ length: totalCells }, () => []);
  const counts = new Int32Array(totalCells);
  const touched = new Int32Array(totalCells);
  return {
    worldSize, dim, cellCap, cellSize: worldSize / dim,
    cells, counts, touched, touchedCount: 0, overflowCount: 0,
  };
}

function toCell(coord, grid) {
  if (!Number.isFinite(coord)) throw new RangeError('particle coordinates must be finite');
  const raw = Math.floor(coord / grid.cellSize);
  return ((raw % grid.dim) + grid.dim) % grid.dim;
}

function flatIndex(x, y, z, dim) {
  return z * dim * dim + y * dim + x;
}

export function clearSpatialGrid(grid) {
  for (let i = 0; i < grid.touchedCount; i++) {
    const ci = grid.touched[i];
    grid.cells[ci].length = 0;
    grid.counts[ci] = 0;
  }
  grid.touchedCount = 0;
  grid.overflowCount = 0;
}

export function insertParticle(grid, particleIndex, x, y, z) {
  if (!Number.isInteger(particleIndex) || particleIndex < 0) throw new RangeError('particleIndex must be a non-negative integer');
  const cx = toCell(x, grid), cy = toCell(y, grid), cz = toCell(z, grid);
  const ci = flatIndex(cx, cy, cz, grid.dim);
  const cell = grid.cells[ci];
  if (cell.length === 0) grid.touched[grid.touchedCount++] = ci;
  if (cell.length >= grid.cellCap) {
    grid.overflowCount++;
    return { inserted: false, reason: 'cell-capacity', cellIndex: ci, overflowCount: grid.overflowCount };
  }
  cell.push(particleIndex);
  grid.counts[ci]++;
  return { inserted: true, cellIndex: ci, cellCount: cell.length };
}

/**
 * Writes neighbor indices into caller-owned storage.
 * maxNeighbors defaults to Infinity. If the caller opts into a finite cap,
 * truncated is true and the caller must handle it before physics continues.
 */
export function queryNeighbors(grid, x, y, z, out, maxNeighbors = Infinity) {
  if (!out || typeof out.length !== 'number') {
    throw new TypeError('out must be a preallocated array or typed array');
  }
  if (!(maxNeighbors === Infinity || (Number.isInteger(maxNeighbors) && maxNeighbors >= 0))) {
    throw new RangeError('maxNeighbors must be a non-negative integer or Infinity');
  }
  const cx = toCell(x, grid), cy = toCell(y, grid), cz = toCell(z, grid);
  let count = 0, truncated = false;
  const visited = grid.dim < 3 ? new Set() : null;
  outer:
  for (let dz = -1; dz <= 1; dz++) {
    const nz = ((cz + dz) % grid.dim + grid.dim) % grid.dim;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = ((cy + dy) % grid.dim + grid.dim) % grid.dim;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = ((cx + dx) % grid.dim + grid.dim) % grid.dim;
        const ci = flatIndex(nx, ny, nz, grid.dim);
        if (visited?.has(ci)) continue;
        visited?.add(ci);
        const cell = grid.cells[ci];
        for (let k = 0; k < cell.length; k++) {
          if (count >= maxNeighbors || count >= out.length) {
            truncated = true;
            break outer;
          }
          out[count++] = cell[k];
        }
      }
    }
  }
  return { count, truncated };
}
