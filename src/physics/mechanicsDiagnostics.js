import { getPairGeometry } from './pairGeometry.js';
import { STRIDE_INDEXES as S } from '../constants.js';
import { applyContact, applyMomentum, applyTorque, applyConstraint, applyFragmentation, applyAdhesion } from './lawgroups/mechanicsLaws.js';

/**
 * Return source-level mechanics facts and each law's isolated contribution.
 * This is intentionally opt-in and does not mutate the particle buffer.
 */
export function inspectMechanicsPair(view, iBase, jBase, worldSize) {
  const geometry = getPairGeometry(view, iBase, jBase, worldSize);
  const snapshot = view.slice ? view.slice() : null;
  const contact = applyContact(view, iBase, jBase, geometry.dx, geometry.dy, geometry.dz, geometry.distance, 1);
  const momentum = applyMomentum(view, iBase, jBase, 0.04);
  const torque = applyTorque(view, iBase, jBase, geometry.dx, geometry.dy, geometry.dz, 0.01);
  const constraint = applyConstraint(view, iBase, jBase, geometry.dx, geometry.dy, geometry.dz, geometry.distance, 0.03);
  const fragmentation = applyFragmentation(view, iBase, jBase, geometry.dx, geometry.dy, geometry.dz, geometry.distance, 0.02);
  const adhesion = applyAdhesion(view, iBase, jBase, geometry.dx, geometry.dy, geometry.dz, geometry.distance, 0.015);
  // Current helpers are expected to be pure; restore defensively if a future
  // diagnostic-only helper adds state mutation.
  if (snapshot && typeof view.set === 'function') view.set(snapshot);
  return {
    distance: geometry.distance,
    overlap: geometry.overlap,
    relativeSpeed: geometry.relativeSpeed,
    relativeVelocityAlongNormal: geometry.relativeVelocityAlongNormal,
    contactCorrection: contact,
    momentumCorrection: momentum,
    torqueContribution: torque,
    constraintCorrection: constraint,
    fragmentationThreshold: 2 + Math.min(8, (view[iBase + S.ARMOR] || 0) + (view[jBase + S.ARMOR] || 0)),
    fragmentationContribution: fragmentation,
    adhesionContribution: adhesion,
  };
}
