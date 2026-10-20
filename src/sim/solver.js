import { PARTICLE_STRIDE, PARTICLE_SLOTS as S } from './particle-layout.js';
import { createSpatialGrid, clearSpatialGrid, insertParticle, queryNeighborsOrAll } from './spatial-grid.js';
import { resolveParticleContacts } from './contact-constraints.js';

const WRAP_MODES = new Set(['toroidal', 'reflective']);

function wrapPosition(value, size) { return ((value % size) + size) % size; }
function shortestDelta(delta, size) {
  if (delta > size / 2) return delta - size;
  if (delta < -size / 2) return delta + size;
  return delta;
}

/**
 * Deterministic, bounded Newtonian prototype for the first VEPA Next runtime slice.
 * This is not yet a port of stable VEPA's multi-law solver. It intentionally
 * implements only softened pair gravity and optional positional contact repair.
 */
export function stepParticleWorld(view, count, {
  stride = PARTICLE_STRIDE,
  worldSize = 2000,
  boundaryMode = 'toroidal',
  dt = 1 / 60,
  gravitationalConstant = 1,
  dragCoefficient = 0.015,
  softening = 1,
  interactionRadius = worldSize / 8,
  activeLawIds = ['law.gravity'],
  resolveContacts = true,
  contactIterations = 2,
  slots = S,
} = {}) {
  if (!ArrayBuffer.isView(view) || view instanceof DataView || !Number.isInteger(count) || count < 0 ||
      !Number.isInteger(stride) || stride < 1 || view.length < count * stride) {
    throw new TypeError('view must be a numeric typed array with count * stride elements');
  }
  if (!Number.isFinite(worldSize) || worldSize <= 0 || !Number.isFinite(dt) || dt <= 0 ||
      !Number.isFinite(gravitationalConstant) || gravitationalConstant < 0 ||
      !Number.isFinite(dragCoefficient) || dragCoefficient < 0 ||
      !Number.isFinite(softening) || softening <= 0 ||
      !Number.isFinite(interactionRadius) || interactionRadius <= 0 || interactionRadius > worldSize / 2) {
    throw new RangeError('Invalid world size, timestep, gravity, softening or interaction radius');
  }
  if (!WRAP_MODES.has(boundaryMode)) throw new RangeError('boundaryMode must be toroidal or reflective');
  if (!Array.isArray(activeLawIds) || activeLawIds.some(id => typeof id !== 'string' || !id) || new Set(activeLawIds).size !== activeLawIds.length) {
    throw new TypeError('activeLawIds must be a unique array of non-empty strings');
  }
  if (!Number.isInteger(contactIterations) || contactIterations < 0) throw new RangeError('contactIterations must be a non-negative integer');
  for (const key of ['POS_X','POS_Y','POS_Z','VEL_X','VEL_Y','VEL_Z','MASS','DEAD','RADIUS']) {
    if (!Number.isInteger(slots[key]) || slots[key] < 0 || slots[key] >= stride) throw new TypeError('Invalid particle slot: ' + key);
  }

  const alive = [];
  let maxRadius = 0;
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + slots.DEAD] >= 0.5 || view[b + slots.MASS] === 0) continue;
    const mass = view[b + slots.MASS];
    const radius = view[b + slots.RADIUS];
    for (const slot of [slots.POS_X, slots.POS_Y, slots.POS_Z, slots.VEL_X, slots.VEL_Y, slots.VEL_Z]) {
      if (!Number.isFinite(view[b + slot])) throw new RangeError('Non-finite particle state at index ' + i);
    }
    if (!Number.isFinite(mass) || mass < 0) throw new RangeError('Invalid particle mass at index ' + i);
    if (!Number.isFinite(radius) || radius < 0) throw new RangeError('Invalid particle radius at index ' + i);
    if (mass > 0) { alive.push(i); maxRadius = Math.max(maxRadius, radius); }
  }

  const acceleration = new Float64Array(count * 3);
  const dim = Math.max(1, Math.min(62, Math.floor(worldSize / interactionRadius)));
  const grid = createSpatialGrid({ worldSize, dim });
  for (const i of alive) {
    const b = i * stride;
    insertParticle(grid, i, view[b + slots.POS_X], view[b + slots.POS_Y], view[b + slots.POS_Z]);
  }

  let interactions = 0;
  let fallbackQueries = 0;
  const candidates = new Int32Array(count);
  if (activeLawIds.includes('law.gravity') && gravitationalConstant > 0) {
    for (const i of alive) {
      const a = i * stride;
      const query = queryNeighborsOrAll(grid, view[a + slots.POS_X], view[a + slots.POS_Y], view[a + slots.POS_Z], candidates, count);
      if (!query.complete) throw new Error('Neighbor query incomplete; refusing partial authoritative physics');
      if (query.usedFallback) fallbackQueries++;
      for (let n = 0; n < query.count; n++) {
        const j = candidates[n];
        if (j <= i) continue;
        const b = j * stride;
        let dx = view[b + slots.POS_X] - view[a + slots.POS_X];
        let dy = view[b + slots.POS_Y] - view[a + slots.POS_Y];
        let dz = view[b + slots.POS_Z] - view[a + slots.POS_Z];
        if (boundaryMode === 'toroidal') {
          dx = shortestDelta(dx, worldSize); dy = shortestDelta(dy, worldSize); dz = shortestDelta(dz, worldSize);
        }
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared === 0 || distanceSquared > interactionRadius * interactionRadius) continue;
        const denominator = Math.pow(distanceSquared + softening * softening, 1.5);
        const massA = view[a + slots.MASS], massB = view[b + slots.MASS];
        const factorA = gravitationalConstant * massB / denominator;
        const factorB = gravitationalConstant * massA / denominator;
        acceleration[i * 3] += dx * factorA;
        acceleration[i * 3 + 1] += dy * factorA;
        acceleration[i * 3 + 2] += dz * factorA;
        acceleration[j * 3] -= dx * factorB;
        acceleration[j * 3 + 1] -= dy * factorB;
        acceleration[j * 3 + 2] -= dz * factorB;
        interactions++;
      }
    }
  }

  for (const i of alive) {
    const b = i * stride, a = i * 3;
    view[b + slots.VEL_X] += acceleration[a] * dt;
    view[b + slots.VEL_Y] += acceleration[a + 1] * dt;
    view[b + slots.VEL_Z] += acceleration[a + 2] * dt;
    if (activeLawIds.includes('law.drag') && dragCoefficient > 0) {
      const damping = Math.exp(-dragCoefficient * dt);
      view[b + slots.VEL_X] *= damping;
      view[b + slots.VEL_Y] *= damping;
      view[b + slots.VEL_Z] *= damping;
    }
    view[b + slots.POS_X] += view[b + slots.VEL_X] * dt;
    view[b + slots.POS_Y] += view[b + slots.VEL_Y] * dt;
    view[b + slots.POS_Z] += view[b + slots.VEL_Z] * dt;
    for (const slot of [slots.POS_X, slots.POS_Y, slots.POS_Z]) {
      if (boundaryMode === 'toroidal') view[b + slot] = wrapPosition(view[b + slot], worldSize);
      else if (view[b + slot] < 0) {
        view[b + slot] = 0;
        const velocitySlot = slot === slots.POS_X ? slots.VEL_X : slot === slots.POS_Y ? slots.VEL_Y : slots.VEL_Z;
        view[b + velocitySlot] = Math.abs(view[b + velocitySlot]);
      } else if (view[b + slot] > worldSize) {
        view[b + slot] = worldSize;
        const velocitySlot = slot === slots.POS_X ? slots.VEL_X : slot === slots.POS_Y ? slots.VEL_Y : slots.VEL_Z;
        view[b + velocitySlot] = -Math.abs(view[b + velocitySlot]);
      }
    }
  }

  if (resolveContacts && activeLawIds.includes('law.collision') && maxRadius > 0 && alive.length > 1 && contactIterations > 0) {
    resolveParticleContacts(view, count, stride, worldSize, boundaryMode === 'toroidal', contactIterations, slots);
  }
  return Object.freeze({ liveCount: alive.length, interactions, fallbackQueries, gridDimension: dim, boundaryMode });
}
