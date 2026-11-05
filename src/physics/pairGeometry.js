import { STRIDE_INDEXES as S } from '../constants.js';

/**
 * Compute the geometric facts shared by pairwise laws. The returned object is
 * intended for orchestration/debug boundaries, not for allocation in the hot
 * solver loop; callers may pass scalar values directly when profiling matters.
 */
export function getPairGeometry(view, iBase, jBase, worldSize) {
  const halfWorld = worldSize * 0.5;
  let dx = view[jBase + S.POS_X] - view[iBase + S.POS_X];
  let dy = view[jBase + S.POS_Y] - view[iBase + S.POS_Y];
  let dz = view[jBase + S.POS_Z] - view[iBase + S.POS_Z];
  if (dx > halfWorld) dx -= worldSize;
  else if (dx < -halfWorld) dx += worldSize;
  if (dy > halfWorld) dy -= worldSize;
  else if (dy < -halfWorld) dy += worldSize;
  if (dz > halfWorld) dz -= worldSize;
  else if (dz < -halfWorld) dz += worldSize;

  const distanceSquared = dx * dx + dy * dy + dz * dz;
  const distance = Math.sqrt(distanceSquared);
  const inverseDistance = distance > 1e-6 ? 1 / distance : 0;
  const combinedRadius = (view[iBase + S.RADIUS] || 0) + (view[jBase + S.RADIUS] || 0);
  const dvx = (view[jBase + S.VEL_X] || 0) - (view[iBase + S.VEL_X] || 0);
  const dvy = (view[jBase + S.VEL_Y] || 0) - (view[iBase + S.VEL_Y] || 0);
  const dvz = (view[jBase + S.VEL_Z] || 0) - (view[iBase + S.VEL_Z] || 0);
  return {
    dx, dy, dz, distanceSquared, distance, inverseDistance,
    normalX: dx * inverseDistance,
    normalY: dy * inverseDistance,
    normalZ: dz * inverseDistance,
    overlap: combinedRadius - distance,
    combinedRadius,
    relativeVelocityX: dvx,
    relativeVelocityY: dvy,
    relativeVelocityZ: dvz,
    relativeSpeed: Math.hypot(dvx, dvy, dvz),
    relativeVelocityAlongNormal: (dvx * dx + dvy * dy + dvz * dz) * inverseDistance,
  };
}
