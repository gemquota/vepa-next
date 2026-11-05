/**
 * SIM-oriented spatial grid. Capacity exhaustion and neighbor-output truncation
 * are explicit diagnostics, not silent omissions. Overflow particles remain
 * queryable through per-cell overflow buckets.
 */
const MAX_GRID_CELLS = 250_000;

export function createSpatialGrid({ worldSize, dim = 12, cellCap = Infinity } = {}) {
  if (!Number.isFinite(worldSize) || worldSize <= 0) throw new RangeError('worldSize must be finite and > 0');
  if (!Number.isInteger(dim) || dim < 1) throw new RangeError('dim must be an integer >= 1');
  if (!(cellCap === Infinity || (Number.isInteger(cellCap) && cellCap >= 1))) {
    throw new RangeError('cellCap must be a positive integer or Infinity');
  }
  const totalCells = dim ** 3;
  if (totalCells > MAX_GRID_CELLS) throw new RangeError(`grid exceeds maximum cell budget (${MAX_GRID_CELLS})`);
  return {
    worldSize, dim, cellCap, cellSize: worldSize / dim,
    cells: Array.from({ length: totalCells }, () => []),
    counts: new Int32Array(totalCells),
    touched: new Int32Array(totalCells),
    touchedCount: 0,
    overflowCount: 0,
    overflowCells: new Map(),
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
    grid.overflowCells.delete(ci);
  }
  grid.touchedCount = 0;
  grid.overflowCount = 0;
}

export function insertParticle(grid, particleIndex, x, y, z) {
  if (!Number.isInteger(particleIndex) || particleIndex < 0) throw new RangeError('particleIndex must be a non-negative integer');
  const ci = flatIndex(toCell(x, grid), toCell(y, grid), toCell(z, grid), grid.dim);
  const cell = grid.cells[ci];
  if (cell.length === 0) grid.touched[grid.touchedCount++] = ci;
  if (cell.length >= grid.cellCap) {
    if (!grid.overflowCells.has(ci)) grid.overflowCells.set(ci, []);
    grid.overflowCells.get(ci).push(particleIndex);
    grid.overflowCount++;
    return { inserted: true, overflow: true, reason: 'cell-capacity-overflow', cellIndex: ci, overflowCount: grid.overflowCount };
  }
  cell.push(particleIndex);
  grid.counts[ci]++;
  return { inserted: true, overflow: false, cellIndex: ci, cellCount: cell.length };
}

/**
 * Writes neighbor indices into caller-owned storage. A finite output cap or
 * undersized output buffer sets truncated=true; the caller must not use the
 * incomplete result for authoritative physics without a fallback.
 */
export function queryNeighbors(grid, x, y, z, out, maxNeighbors = Infinity) {
  if (!out || typeof out.length !== 'number') throw new TypeError('out must be a preallocated array or typed array');
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
        const overflow = grid.overflowCells.get(ci) ?? [];
        for (let k = 0; k < cell.length; k++) {
          if (count >= maxNeighbors || count >= out.length) {
            truncated = true;
            break outer;
          }
          out[count++] = cell[k];
        }
        for (let k = 0; k < overflow.length; k++) {
          if (count >= maxNeighbors || count >= out.length) {
            truncated = true;
            break outer;
          }
          out[count++] = overflow[k];
        }
      }
    }
  }
  return { count, truncated };
}


/**
 * Query nearby candidates, falling back to a complete particle scan when the
 * caller-provided output buffer or explicit neighbor cap would truncate results.
 *
 * The output buffer must hold totalParticleCount entries for the fallback to be
 * complete. If it cannot, this function reports the required capacity and the
 * caller must grow/reuse a larger buffer and retry before authoritative physics.
 * The returned indices include the query particle if it was inserted in the grid;
 * callers remain responsible for self-pair filtering and exact distance tests.
 */
export function queryNeighborsOrAll(
  grid, x, y, z, out, totalParticleCount, maxNeighbors = Infinity,
) {
  if (!Number.isInteger(totalParticleCount) || totalParticleCount < 0) {
    throw new RangeError('totalParticleCount must be a non-negative integer');
  }
  const nearby = queryNeighbors(grid, x, y, z, out, maxNeighbors);
  if (!nearby.truncated) {
    return { ...nearby, complete: true, usedFallback: false, requiredCapacity: nearby.count };
  }
  if (out.length < totalParticleCount) {
    return {
      count: out.length,
      truncated: true,
      complete: false,
      usedFallback: false,
      requiredCapacity: totalParticleCount,
      reason: 'fallback-buffer-too-small',
    };
  }
  for (let i = 0; i < totalParticleCount; i++) out[i] = i;
  return {
    count: totalParticleCount,
    truncated: false,
    complete: true,
    usedFallback: true,
    requiredCapacity: totalParticleCount,
    reason: 'neighbor-query-truncated',
  };
}
