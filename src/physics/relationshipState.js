/**
 * VEPA4 first-class relationship state.
 *
 * This module is deliberately independent of the particle hot path. The
 * Float32 stride remains the authoritative runtime storage for existing laws;
 * these helpers provide a stable semantic record for analysis, persistence,
 * and future relationship-graph consumers.
 */

import { clamp01, finite } from '../core/numeric.js';

export const RELATIONSHIP_TYPES = Object.freeze([
  'independent',
  'temporary',
  'structural',
  'rigid',
  'flexible',
  'elastic',
  'hierarchical',
  'mutual',
  'shared-state',
  'fused',
  'composite',
]);

export function createRelationshipState({
  id,
  a,
  b,
  type = 'temporary',
  typeVector = {},
  tick = 0,
  strength = 0,
  integrity = 1,
  preferredDistance = 0,
  preferredAngle = 0,
  topologyRole = 'neighbor',
} = {}) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
    throw new TypeError('relationship endpoints must be distinct integer particle ids');
  }
  return {
    id: id ?? `${Math.min(a, b)}:${Math.max(a, b)}`,
    a: Math.min(a, b),
    b: Math.max(a, b),
    type,
    typeVector: { ...typeVector },
    age: 0,
    lastTick: tick,
    strength: clamp01(strength),
    stress: 0,
    integrity: clamp01(integrity),
    energyFlow: 0,
    massFlow: 0,
    informationFlow: 0,
    preferredDistance: Math.max(0, finite(preferredDistance)),
    preferredAngle: finite(preferredAngle),
    health: 1,
    affinity: 0,
    stability: clamp01(integrity),
    topologyRole,
    formationCount: 1,
    breakCount: 0,
    active: true,
  };
}

export function updateRelationshipState(state, {
  tick = state.lastTick,
  dt = 1,
  strength,
  stress,
  integrity,
  energyFlow,
  massFlow,
  informationFlow,
  affinity,
  health,
  stability,
} = {}) {
  if (!state || state.active === false) return state;
  const elapsed = Math.max(0, finite(tick - state.lastTick, 0));
  const next = {
    ...state,
    age: Math.max(0, finite(state.age) + elapsed * Math.max(0, finite(dt, 1))),
    lastTick: tick,
    strength: strength === undefined ? state.strength : clamp01(strength),
    stress: stress === undefined ? state.stress : clamp01(stress),
    integrity: integrity === undefined ? state.integrity : clamp01(integrity),
    energyFlow: energyFlow === undefined ? state.energyFlow : finite(energyFlow),
    massFlow: massFlow === undefined ? state.massFlow : finite(massFlow),
    informationFlow: informationFlow === undefined ? state.informationFlow : finite(informationFlow),
    affinity: affinity === undefined ? state.affinity : Math.max(-1, Math.min(1, finite(affinity))),
    health: health === undefined ? state.health : clamp01(health),
    stability: stability === undefined ? state.stability : clamp01(stability),
  };
  return next;
}

export function applyRelationshipStress(state, amount, { repair = false } = {}) {
  if (!state || state.active === false) return state;
  const delta = Math.abs(finite(amount));
  const integrity = repair
    ? clamp01(state.integrity + delta)
    : clamp01(state.integrity - delta);
  const stress = repair
    ? clamp01(state.stress - delta)
    : clamp01(state.stress + delta);
  return { ...state, integrity, stress, stability: integrity };
}

export function shouldBreakRelationship(state, {
  integrity = 0.05,
  maxAge,
  maxStress = 1,
  force,
  forceThreshold,
  distance,
  maxDistance,
  health = 0,
} = {}) {
  if (!state || state.active === false) return true;
  if (state.integrity <= integrity || state.stress >= maxStress) return true;
  if (maxAge !== undefined && state.age >= maxAge) return true;
  if (forceThreshold !== undefined && Math.abs(finite(force)) >= forceThreshold) return true;
  if (maxDistance !== undefined && finite(distance, Infinity) > maxDistance) return true;
  if (state.health <= health) return true;
  return false;
}

export function closeRelationship(state, tick = state?.lastTick ?? 0) {
  if (!state) return null;
  return {
    ...state,
    active: false,
    lastTick: tick,
    breakCount: (state.breakCount || 0) + 1,
  };
}

export function recordRelationshipEvent(state, event = {}) {
  if (!state) return null;
  const next = { ...state };
  if (event.formed) next.formationCount = (state.formationCount || 0) + 1;
  if (event.energyFlow !== undefined) next.energyFlow = finite(event.energyFlow);
  if (event.massFlow !== undefined) next.massFlow = finite(event.massFlow);
  if (event.informationFlow !== undefined) next.informationFlow = finite(event.informationFlow);
  if (event.affinity !== undefined) next.affinity = Math.max(-1, Math.min(1, finite(event.affinity)));
  if (event.topologyRole !== undefined) next.topologyRole = event.topologyRole;
  return next;
}

export function relationshipKey(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  return `${Math.min(a, b)}:${Math.max(a, b)}`;
}

export function indexRelationships(relationships = []) {
  const index = new Map();
  for (const relationship of relationships) {
    if (!relationship || relationship.active === false) continue;
    const key = relationshipKey(relationship.a, relationship.b);
    if (key) index.set(key, relationship);
  }
  return index;
}
