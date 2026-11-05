import { STRIDE_INDEXES as S } from '../constants.js';

/** Discrete hard-sphere projection, separate from COLL velocity impulses.
 * Rebuilt after integration/radius changes; never truncated by force budgets.
 * Bounded iterations can leave residual penetration in overpacked worlds.
 */
export function resolveParticleContacts(view, count, stride, worldSize, wrap, iterations = 8) {
  let maxRadius = 0;
  const alive = [];
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + S.DEAD] >= 0.5 || !(view[b + S.MASS] > 0)) continue;
    alive.push(i);
    maxRadius = Math.max(maxRadius, view[b + S.RADIUS] || 0);
  }
  if (!(maxRadius > 0) || !(worldSize > 0)) return;
  const dim = Math.max(1, Math.floor(worldSize / (2 * maxRadius)));
  const cellSize = worldSize / dim;
  const coordinate = (x) => Math.max(0, Math.min(dim - 1, Math.floor(x / cellSize)));
  const key = (x, y, z) => (z * dim + y) * dim + x;
  const normalize = (b) => {
    for (const slot of [S.POS_X, S.POS_Y, S.POS_Z]) {
      const x = view[b + slot];
      view[b + slot] = wrap ? ((x % worldSize) + worldSize) % worldSize
        : Math.max(0, Math.min(worldSize - 0.001, x));
    }
  };
  for (let pass = 0; pass < iterations; pass++) {
    const cells = new Map();
    for (const i of alive) {
      const b = i * stride;
      normalize(b);
      const k = key(coordinate(view[b + S.POS_X]), coordinate(view[b + S.POS_Y]), coordinate(view[b + S.POS_Z]));
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(i);
    }
    let corrected = false;
    for (const i of alive) {
      const a = i * stride;
      const cx = coordinate(view[a + S.POS_X]), cy = coordinate(view[a + S.POS_Y]), cz = coordinate(view[a + S.POS_Z]);
      const visited = dim < 3 ? new Set() : null;
      for (let oz = -1; oz <= 1; oz++) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        let x = cx + ox, y = cy + oy, z = cz + oz;
        if (wrap) { x = (x + dim) % dim; y = (y + dim) % dim; z = (z + dim) % dim; }
        else if (x < 0 || y < 0 || z < 0 || x >= dim || y >= dim || z >= dim) continue;
        const k = key(x, y, z);
        if (visited?.has(k)) continue;
        visited?.add(k);
        const neighbors = cells.get(k);
        if (!neighbors) continue;
        for (const j of neighbors) {
          if (j <= i) continue;
          const b = j * stride;
          let dx = view[b + S.POS_X] - view[a + S.POS_X];
          let dy = view[b + S.POS_Y] - view[a + S.POS_Y];
          let dz = view[b + S.POS_Z] - view[a + S.POS_Z];
          if (wrap) {
            dx -= Math.round(dx / worldSize) * worldSize;
            dy -= Math.round(dy / worldSize) * worldSize;
            dz -= Math.round(dz / worldSize) * worldSize;
          }
          const target = view[a + S.RADIUS] + view[b + S.RADIUS];
          const distance = Math.hypot(dx, dy, dz);
          if (distance >= target - 1e-4) continue;
          if (distance < 1e-8) {
            // Stable pair-specific axis; opposite endpoints share one normal.
            dx = (i + j) % 3 === 0 ? 1 : 0;
            dy = (i + j) % 3 === 1 ? 1 : 0;
            dz = (i + j) % 3 === 2 ? 1 : 0;
          } else { dx /= distance; dy /= distance; dz /= distance; }
          const mi = view[a + S.MASS], mj = view[b + S.MASS];
          const correction = target - distance + 1e-4;
          const shareA = correction * mj / (mi + mj), shareB = correction * mi / (mi + mj);
          view[a + S.POS_X] -= dx * shareA; view[b + S.POS_X] += dx * shareB;
          view[a + S.POS_Y] -= dy * shareA; view[b + S.POS_Y] += dy * shareB;
          view[a + S.POS_Z] -= dz * shareA; view[b + S.POS_Z] += dz * shareB;
          corrected = true;
        }
      }
    }
    if (!corrected) break;
  }
  for (const i of alive) normalize(i * stride);
}
