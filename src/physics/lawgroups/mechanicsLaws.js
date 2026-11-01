// VEPA4 — Slate Mechanics laws
import { STRIDE_INDEXES as S } from '../../constants.js';

const clamp = (v, lo = -50, hi = 50) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0;
const mass = (view, base) => Math.max(0.001, Number.isFinite(view[base + S.MASS]) ? view[base + S.MASS] : 0.001);

export function applyContact(view, i, j, dx, dy, dz, dist, k = 1) {
  const overlap = (view[i + S.RADIUS] || 0) + (view[j + S.RADIUS] || 0) - dist;
  if (overlap <= 0) return null;
  const inv = 1 / Math.max(dist, 1e-6);
  const force = overlap * k / (mass(view, i) + mass(view, j));
  return { ax: clamp(-dx * inv * force), ay: clamp(-dy * inv * force), az: clamp(-dz * inv * force) };
}

export function applyMomentum(view, i, j, k = 0.04) {
  const mi = mass(view, i), mj = mass(view, j);
  const dvx = (view[j + S.VEL_X] || 0) - (view[i + S.VEL_X] || 0);
  const dvy = (view[j + S.VEL_Y] || 0) - (view[i + S.VEL_Y] || 0);
  const dvz = (view[j + S.VEL_Z] || 0) - (view[i + S.VEL_Z] || 0);
  return { ax: clamp(dvx * k * mj / (mi + mj)), ay: clamp(dvy * k * mj / (mi + mj)), az: clamp(dvz * k * mj / (mi + mj)) };
}

export function applyInertia(view, i, ax, ay, az, k = 0.02) {
  const m = mass(view, i);
  return { ax: clamp(ax * k / m), ay: clamp(ay * k / m), az: clamp(az * k / m) };
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
  const contact = (view[i + S.RADIUS] || 0) + (view[j + S.RADIUS] || 0) + 2;
  if (dist > contact) return null;
  const inv = 1 / Math.max(dist, 1e-6);
  const force = (contact - dist) * k;
  return { ax: clamp(dx * inv * force), ay: clamp(dy * inv * force), az: clamp(dz * inv * force) };
}
