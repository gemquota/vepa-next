import { PARTICLE_SLOTS as S } from './particle-layout.js';
import { createSpatialGrid, clearSpatialGrid, insertParticle, queryNeighbors } from './spatial-grid.js';

/**
 * Project overlapping live hard spheres apart using the shared SIM spatial grid.
 * This is positional correction, separate from collision velocity impulses.
 *
 * Contract:
 * - view is a writable numeric buffer with count * stride elements.
 * - radius and mass are non-negative/positive validated simulation values.
 * - world is a cubic world [0, worldSize) with optional periodic wrapping.
 * - bounded iterations can leave residual penetration in overpacked worlds.
 * - query truncation falls back to the full live-particle candidate list.
 *
 * Source behavior adapted from DayneK/vepa src/physics/contactConstraints.js
 * at commit 625c82e90e771777b92897aa23dcb957e98c714a.
 */
export function resolveParticleContacts(view, count, stride, worldSize, wrap, iterations = 8, slots = S) {
  if (!ArrayBuffer.isView(view) || !Number.isInteger(count) || count < 0 ||
      !Number.isInteger(stride) || stride <= 0 || view.length < count * stride ||
      !Number.isFinite(worldSize) || worldSize <= 0 ||
      !Number.isInteger(iterations) || iterations < 0) {
    throw new TypeError('Invalid contact resolver buffer, dimensions, world size, or iteration count');
  }
  for (const key of ['POS_X','POS_Y','POS_Z','MASS','DEAD','RADIUS']) {
    if (!Number.isInteger(slots[key]) || slots[key] < 0 || slots[key] >= stride) {
      throw new TypeError(`Particle layout has invalid slot: ${key}`);
    }
  }
  let maxRadius = 0;
  const alive = [];
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + slots.DEAD] >= 0.5 || !(view[b + slots.MASS] > 0)) continue;
    const radius = view[b + slots.RADIUS];
    if (!Number.isFinite(radius) || radius < 0) throw new RangeError(`Invalid particle radius at index ${i}`);
    alive.push(i);
    maxRadius = Math.max(maxRadius, radius);
  }
  if (!(maxRadius > 0) || alive.length < 2 || iterations === 0) return;

  // Clamping the dimension preserves the >= 2 * maxRadius cell-size invariant
  // while respecting the shared grid's bounded allocation budget.
  const desiredDim = Math.max(1, Math.floor(worldSize / (2 * maxRadius)));
  const dim = Math.min(desiredDim, 62); // 62^3 stays below MAX_GRID_CELLS.
  const grid = createSpatialGrid({ worldSize, dim });
  const neighborBuffer = new Int32Array(count);
  const normalize = b => {
    for (const slot of [slots.POS_X, slots.POS_Y, slots.POS_Z]) {
      const value = view[b + slot];
      view[b + slot] = wrap
        ? ((value % worldSize) + worldSize) % worldSize
        : Math.max(0, Math.min(worldSize - 0.001, value));
    }
  };

  for (let pass = 0; pass < iterations; pass++) {
    clearSpatialGrid(grid);
    for (const i of alive) {
      const b = i * stride;
      normalize(b);
      insertParticle(grid, i, view[b + slots.POS_X], view[b + slots.POS_Y], view[b + slots.POS_Z]);
    }
    let corrected = false;
    for (const i of alive) {
      const a = i * stride;
      const query = queryNeighbors(
        grid,
        view[a + slots.POS_X],
        view[a + slots.POS_Y],
        view[a + slots.POS_Z],
        neighborBuffer,
      );
      // The buffer is sized for every particle, so truncation should be
      // impossible. Keep a correctness fallback rather than silently dropping
      // contacts if the query contract changes later.
      let candidateCount = query.count;
      if (query.truncated) {
        neighborBuffer.set(alive);
        candidateCount = alive.length;
      }
      for (let n = 0; n < candidateCount; n++) {
        const j = neighborBuffer[n];
        if (j <= i) continue;
        const b = j * stride;
        let dx = view[b + slots.POS_X] - view[a + slots.POS_X];
        let dy = view[b + slots.POS_Y] - view[a + slots.POS_Y];
        let dz = view[b + slots.POS_Z] - view[a + slots.POS_Z];
        if (wrap) {
          dx -= Math.round(dx / worldSize) * worldSize;
          dy -= Math.round(dy / worldSize) * worldSize;
          dz -= Math.round(dz / worldSize) * worldSize;
        }
        const target = view[a + slots.RADIUS] + view[b + slots.RADIUS];
        const distance = Math.hypot(dx, dy, dz);
        if (distance >= target - 1e-4) continue;
        if (distance < 1e-8) {
          dx = (i + j) % 3 === 0 ? 1 : 0;
          dy = (i + j) % 3 === 1 ? 1 : 0;
          dz = (i + j) % 3 === 2 ? 1 : 0;
        } else {
          dx /= distance; dy /= distance; dz /= distance;
        }
        const mi = view[a + slots.MASS], mj = view[b + slots.MASS];
        const massSum = mi + mj;
        if (!(massSum > 0) || !Number.isFinite(massSum)) continue;
        const correction = target - distance + 1e-4;
        const shareA = correction * mj / massSum, shareB = correction * mi / massSum;
        view[a + slots.POS_X] -= dx * shareA; view[b + slots.POS_X] += dx * shareB;
        view[a + slots.POS_Y] -= dy * shareA; view[b + slots.POS_Y] += dy * shareB;
        view[a + slots.POS_Z] -= dz * shareA; view[b + slots.POS_Z] += dz * shareB;
        corrected = true;
      }
    }
    if (!corrected) break;
  }
  for (const i of alive) normalize(i * stride);
}
