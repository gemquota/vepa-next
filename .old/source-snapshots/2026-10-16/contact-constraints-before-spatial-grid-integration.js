import { PARTICLE_SLOTS as S } from './particle-layout.js';

/**
 * Project overlapping live hard spheres apart using a rebuilt spatial grid.
 * This is positional correction, separate from collision velocity impulses.
 *
 * Contract:
 * - view is a writable numeric buffer with count * stride elements.
 * - radius and mass are non-negative/positive validated simulation values.
 * - world is a cubic world [0, worldSize) with optional periodic wrapping.
 * - bounded iterations can leave residual penetration in overpacked worlds.
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
  if (!(maxRadius > 0) || !(worldSize > 0) || alive.length < 2 || iterations === 0) return;
  const dim = Math.max(1, Math.floor(worldSize / (2 * maxRadius)));
  const cellSize = worldSize / dim;
  const coordinate = value => Math.max(0, Math.min(dim - 1, Math.floor(value / cellSize)));
  const key = (x, y, z) => (z * dim + y) * dim + x;
  const normalize = b => {
    for (const slot of [slots.POS_X, slots.POS_Y, slots.POS_Z]) {
      const value = view[b + slot];
      view[b + slot] = wrap
        ? ((value % worldSize) + worldSize) % worldSize
        : Math.max(0, Math.min(worldSize - 0.001, value));
    }
  };

  for (let pass = 0; pass < iterations; pass++) {
    const cells = new Map();
    for (const i of alive) {
      const b = i * stride;
      normalize(b);
      const k = key(coordinate(view[b + slots.POS_X]), coordinate(view[b + slots.POS_Y]), coordinate(view[b + slots.POS_Z]));
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(i);
    }
    let corrected = false;
    for (const i of alive) {
      const a = i * stride;
      const cx = coordinate(view[a + slots.POS_X]), cy = coordinate(view[a + slots.POS_Y]), cz = coordinate(view[a + slots.POS_Z]);
      const visited = dim < 3 ? new Set() : null;
      for (let oz = -1; oz <= 1; oz++) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        let x = cx + ox, y = cy + oy, z = cz + oz;
        if (wrap) {
          x = (x + dim) % dim; y = (y + dim) % dim; z = (z + dim) % dim;
        } else if (x < 0 || y < 0 || z < 0 || x >= dim || y >= dim || z >= dim) continue;
        const k = key(x, y, z);
        if (visited?.has(k)) continue;
        visited?.add(k);
        const neighbors = cells.get(k);
        if (!neighbors) continue;
        for (const j of neighbors) {
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
    }
    if (!corrected) break;
  }
  for (const i of alive) normalize(i * stride);
}
