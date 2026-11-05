// VEPA4 — Slate Mechanics laws
import { STRIDE_INDEXES as S } from '../../constants.js';
// These laws call clamp() with a single argument, relying on the ±50 default
// bounds AND the folded finite check. That is `clampForce`, not the plain
// three-argument `clamp` — using the latter here would evaluate
// clamp(x, undefined, undefined) => NaN. Aliased so the 20 call sites below
// keep their existing single-argument form.
import { clampForce as clamp } from '../../core/numeric.js';

const mass = (view, base) => Math.max(0.001, Number.isFinite(view[base + S.MASS]) ? view[base + S.MASS] : 0.001);

export function applyContactCorrection(view, i, j, dx, dy, dz, dist, maxCorrection = Infinity) {
  const overlap = (view[i + S.RADIUS] || 0) + (view[j + S.RADIUS] || 0) - dist;
  if (overlap <= 0) return null;
  if (dist <= 1e-6) {
    const sign = i < j ? -1 : 1;
    const share = Math.min(overlap, maxCorrection) * mass(view, j) / (mass(view, i) + mass(view, j));
    return { x: sign * share, y: 0, z: 0 };
  }
  const mi = mass(view, i), mj = mass(view, j);
  const share = Math.min(overlap, maxCorrection) * mj / (mi + mj);
  const inv = 1 / dist;
  return { x: -dx * inv * share, y: -dy * inv * share, z: -dz * inv * share };
}

export function applyCollisionImpulse(view, i, j, nx, ny, nz, elasticity = 0.5) {
  const mi = mass(view, i), mj = mass(view, j);
  const rvx = (view[i + S.VEL_X] || 0) - (view[j + S.VEL_X] || 0);
  const rvy = (view[i + S.VEL_Y] || 0) - (view[j + S.VEL_Y] || 0);
  const rvz = (view[i + S.VEL_Z] || 0) - (view[j + S.VEL_Z] || 0);
  const relativeVelocityAlongNormal = rvx * nx + rvy * ny + rvz * nz;
  if (relativeVelocityAlongNormal <= 0) return null;
  const impulse = -(1 + Math.max(0, Math.min(1, elasticity))) * relativeVelocityAlongNormal / (mi + mj);
  return { ax: impulse * mj * nx, ay: impulse * mj * ny, az: impulse * mj * nz };
}

export function applyContact(view, i, j, dx, dy, dz, dist, k = 1) {
  const correction = applyContactCorrection(view, i, j, dx, dy, dz, dist);
  if (!correction) return null;
  return { ax: clamp(correction.x * k), ay: clamp(correction.y * k), az: clamp(correction.z * k) };
}

export function applyMomentum(view, i, j, k = 0.04) {
  const mi = mass(view, i), mj = mass(view, j);
  const dvx = (view[j + S.VEL_X] || 0) - (view[i + S.VEL_X] || 0);
  const dvy = (view[j + S.VEL_Y] || 0) - (view[i + S.VEL_Y] || 0);
  const dvz = (view[j + S.VEL_Z] || 0) - (view[i + S.VEL_Z] || 0);
  return { ax: clamp(dvx * k * mj / (mi + mj)), ay: clamp(dvy * k * mj / (mi + mj)), az: clamp(dvz * k * mj / (mi + mj)) };
}

/**
 * Fold one coordinate back into `[0, worldSize)` — WRAP's toroidal branch.
 */
export function wrapCoordinate(value, worldSize) {
  return ((value % worldSize) + worldSize) % worldSize;
}

/**
 * WRAP — the world's boundary rule.
 *
 * This body used to be inline in the solver and keyed off the TOROIDAL world
 * param; it was a law once, lost its toggle, and became a slider nobody could
 * reason about from the grid. It is a law again at index 130, and the param is
 * kept as its default: the solver reads the bit, the param seeds it.
 *
 *   wrap on  — a particle that leaves one face re-enters through the opposite
 *              one, and its velocity is untouched.
 *   wrap off — the same face clamps it and drives the outward velocity through
 *              WALL REFLECT (0 = absorb, 1 = full reflect, 2 = over-reflect).
 *
 * Pure and coordinate-returning, so the solver writes back whichever axes
 * moved rather than mutating the buffer from inside a law.
 *
 * @param {{x: number, y: number, z: number}} position
 * @param {{x: number, y: number, z: number}} velocity
 * @param {number} worldSize
 * @param {boolean} wrap  the law bit
 * @param {number} wallReflect
 * @returns {{position: {x, y, z}, velocity: {x, y, z}, mode: 'toroidal'|'walls', touched: string[]}}
 */
export function applyWrapBoundary(position, velocity, worldSize, wrap = true, wallReflect = 1) {
  const reflect = Number.isFinite(wallReflect) ? wallReflect : 1;
  const pos = { x: position.x, y: position.y, z: position.z };
  const vel = { x: velocity.x, y: velocity.y, z: velocity.z };

  if (wrap) {
    return {
      position: {
        x: wrapCoordinate(pos.x, worldSize),
        y: wrapCoordinate(pos.y, worldSize),
        z: wrapCoordinate(pos.z, worldSize),
      },
      velocity: vel,
      mode: 'toroidal',
      touched: [],
    };
  }

  const touched = [];
  for (const axis of ['x', 'y', 'z']) {
    if (pos[axis] < 0) {
      pos[axis] = 0;
      vel[axis] = Math.abs(vel[axis]) * reflect;
      touched.push(`${axis}<0`);
    } else if (pos[axis] >= worldSize) {
      pos[axis] = worldSize - 0.01;
      vel[axis] = -Math.abs(vel[axis]) * reflect;
      touched.push(`${axis}>=${worldSize}`);
    }
  }
  return { position: pos, velocity: vel, mode: 'walls', touched };
}

export function applyTorque(view, i, j, dx, dy, dz, k = 0.01) {
  const rvx = view[j + S.VEL_X] - view[i + S.VEL_X];
  const rvy = view[j + S.VEL_Y] - view[i + S.VEL_Y];
  const rvz = view[j + S.VEL_Z] - view[i + S.VEL_Z];
  return { ax: clamp((dy * rvz - dz * rvy) * k), ay: clamp((dz * rvx - dx * rvz) * k), az: clamp((dx * rvy - dy * rvx) * k) };
}

export function applyConstraint(view, i, j, dx, dy, dz, dist, k = 0.03) {
  const target = (view[i + S.RADIUS] || 0) + (view[j + S.RADIUS] || 0) + 0.5;
  const error = dist - target;
  const inv = 1 / Math.max(dist, 1e-6);
  const force = error * k;
  return { ax: clamp(dx * inv * force), ay: clamp(dy * inv * force), az: clamp(dz * inv * force) };
}

export function applyFragmentation(view, i, j, dx, dy, dz, dist, k = 0.02) {
  const rel = Math.hypot((view[i + S.VEL_X] || 0) - (view[j + S.VEL_X] || 0), (view[i + S.VEL_Y] || 0) - (view[j + S.VEL_Y] || 0), (view[i + S.VEL_Z] || 0) - (view[j + S.VEL_Z] || 0));
  const threshold = 2 + Math.min(8, (view[i + S.ARMOR] || 0) + (view[j + S.ARMOR] || 0));
  if (rel <= threshold || dist <= 0) return null;
  const inv = 1 / dist;
  const force = (rel - threshold) * k;
  return { ax: clamp(-dx * inv * force), ay: clamp(-dy * inv * force), az: clamp(-dz * inv * force) };
}

export function applyTopology(view, i, j, dx, dy, dz, dist, k = 0.01) {
  const bonds = (view[i + S.BOND_COUNT] || 0) - (view[j + S.BOND_COUNT] || 0);
  const inv = 1 / Math.max(dist, 1e-6);
  const force = bonds * k;
  return { ax: clamp(dx * inv * force), ay: clamp(dy * inv * force), az: clamp(dz * inv * force) };
}

export function applyAdhesion(view, i, j, dx, dy, dz, dist, k = 0.015) {
  const surface = (view[i + S.RADIUS] || 0) + (view[j + S.RADIUS] || 0);
  const contact = surface + 2;
  if (dist > contact) return null;
  if (dist <= surface) return applyContact(view, i, j, dx, dy, dz, dist, k);
  const inv = 1 / Math.max(dist, 1e-6);
  // Adhesion closes the surface gap, never attracts through another body.
  const dv = ((view[j + S.VEL_X] || 0) - (view[i + S.VEL_X] || 0)) * dx * inv
    + ((view[j + S.VEL_Y] || 0) - (view[i + S.VEL_Y] || 0)) * dy * inv
    + ((view[j + S.VEL_Z] || 0) - (view[i + S.VEL_Z] || 0)) * dz * inv;
  const force = ((dist - surface) * k + dv * Math.sqrt(k)) * mass(view, j) / (mass(view, i) + mass(view, j));
  return { ax: clamp(dx * inv * force), ay: clamp(dy * inv * force), az: clamp(dz * inv * force) };
}

/**
 * Return an immutable inspection record for COLL without applying the impulse.
 * This is deliberately separate from the solver's hot path.
 */
export function diagnoseCollisionImpulse(view, i, j, nx, ny, nz, elasticity = 0.5) {
  const mi = mass(view, i), mj = mass(view, j);
  const rvx = (view[i + S.VEL_X] || 0) - (view[j + S.VEL_X] || 0);
  const rvy = (view[i + S.VEL_Y] || 0) - (view[j + S.VEL_Y] || 0);
  const rvz = (view[i + S.VEL_Z] || 0) - (view[j + S.VEL_Z] || 0);
  const relativeVelocityAlongNormal = rvx * nx + rvy * ny + rvz * nz;
  const restitution = Math.max(0, Math.min(1, elasticity));
  const impulse = relativeVelocityAlongNormal > 0
    ? -(1 + restitution) * relativeVelocityAlongNormal / (mi + mj)
    : 0;
  return Object.freeze({
    relativeVelocityAlongNormal,
    restitution,
    massI: mi,
    massJ: mj,
    approaching: relativeVelocityAlongNormal > 0,
    impulse: Object.freeze({ x: impulse * mj * nx, y: impulse * mj * ny, z: impulse * mj * nz }),
  });
}

/**
 * Return WRAP's boundary decision without mutating anything.
 *
 * Deliberately separate from the hot path — `tests/unit/mechanics.test.js`
 * asserts against this rather than re-deriving the fold.
 */
export function diagnoseWrapBoundary(position, velocity, worldSize, wrap = true, wallReflect = 1) {
  const toroidal = applyWrapBoundary(position, velocity, worldSize, true);
  const walls = applyWrapBoundary(position, velocity, worldSize, false, wallReflect);
  return Object.freeze({
    worldSize,
    wallReflect: Number.isFinite(wallReflect) ? wallReflect : 1,
    wrapped: wrap,
    escapedFaces: walls.touched,
    toroidal: Object.freeze(toroidal.position),
    walls: Object.freeze({ position: walls.position, velocity: walls.velocity }),
  });
}

/** Return TOPOLOGY's graph imbalance and correction without mutating state. */
export function diagnoseTopology(view, i, j, dx, dy, dz, dist, k = 0.01) {
  const bondsI = view[i + S.BOND_COUNT] || 0;
  const bondsJ = view[j + S.BOND_COUNT] || 0;
  const bondImbalance = bondsI - bondsJ;
  const inv = 1 / Math.max(dist, 1e-6);
  const force = bondImbalance * k;
  return Object.freeze({
    bondsI,
    bondsJ,
    bondImbalance,
    coefficient: k,
    correction: Object.freeze({ ax: clamp(dx * inv * force), ay: clamp(dy * inv * force), az: clamp(dz * inv * force) }),
  });
}
