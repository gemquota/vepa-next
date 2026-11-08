import { PARTICLE_SLOTS as S } from './particle-layout.js';

function shortestDelta(delta, size) {
  if (delta > size / 2) return delta - size;
  if (delta < -size / 2) return delta + size;
  return delta;
}

function displacement(view, a, b, slots, worldSize, toroidal) {
  let dx = view[b + slots.POS_X] - view[a + slots.POS_X];
  let dy = view[b + slots.POS_Y] - view[a + slots.POS_Y];
  let dz = view[b + slots.POS_Z] - view[a + slots.POS_Z];
  if (toroidal) {
    dx = shortestDelta(dx, worldSize);
    dy = shortestDelta(dy, worldSize);
    dz = shortestDelta(dz, worldSize);
  }
  return [dx, dy, dz];
}

/** Apply laws that share the solver's existing neighborhood/particle primitives. */
export function applyExtendedLaws(view, alive, acceleration, candidates, queryNeighbors, {
  stride,
  worldSize,
  boundaryMode,
  interactionRadius,
  softening,
  dt,
  activeLawIds,
  entrainmentCoefficient = 0.35,
  buoyancyCoefficient = 0.08,
  ambientTemperature = 0,
  accretionRadiusMultiplier = 1.25,
  bondStrength = 2,
  bondDamping = 0.15,
  tideCoefficient = 0.3,
  horizonCoefficient = 0.08,
  radiationPressureCoefficient = 0.12,
  fieldCoefficient = 0.02,
  frictionCoefficient = 0.05,
  slots = S,
} = {}) {
  const toroidal = boundaryMode === 'toroidal';
  let interactions = 0;

  if (activeLawIds.includes('law.entrainment') && entrainmentCoefficient > 0) {
    for (const i of alive) {
      const a = i * stride;
      const query = queryNeighbors(view[a + slots.POS_X], view[a + slots.POS_Y], view[a + slots.POS_Z]);
      if (!query.complete) throw new Error('Neighbor query incomplete; refusing partial entrainment');
      let weightSum = 0;
      let vx = 0, vy = 0, vz = 0;
      for (let n = 0; n < query.count; n++) {
        const j = candidates[n];
        if (j === i) continue;
        const b = j * stride;
        const [dx, dy, dz] = displacement(view, a, b, slots, worldSize, toroidal);
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 === 0 || d2 > interactionRadius * interactionRadius) continue;
        const weight = 1 / (d2 + softening * softening);
        vx += view[b + slots.VEL_X] * weight;
        vy += view[b + slots.VEL_Y] * weight;
        vz += view[b + slots.VEL_Z] * weight;
        weightSum += weight;
      }
      if (weightSum > 0) {
        const factor = Math.min(1, entrainmentCoefficient * dt);
        acceleration[i * 3] += ((vx / weightSum) - view[a + slots.VEL_X]) * factor / Math.max(dt, 1e-12);
        acceleration[i * 3 + 1] += ((vy / weightSum) - view[a + slots.VEL_Y]) * factor / Math.max(dt, 1e-12);
        acceleration[i * 3 + 2] += ((vz / weightSum) - view[a + slots.VEL_Z]) * factor / Math.max(dt, 1e-12);
        interactions++;
      }
    }
  }

  // Product-law ports: coefficients are explicit effective values. Product
  // synergy multipliers must be supplied by the caller when comparing a
  // combined-law configuration; defaults reproduce the isolated law constants.
  const pairPhysics = activeLawIds.some(id =>
    id === 'law.tide' || id === 'law.horizon' || id === 'law.radiation-pressure' || id === 'law.field');
  if (pairPhysics || activeLawIds.includes('law.field')) {
    for (const i of alive) {
      const a = i * stride;
      const massA = Math.max(view[a + slots.MASS], 1e-12);
      if (!pairPhysics) continue;
      const query = queryNeighbors(view[a + slots.POS_X], view[a + slots.POS_Y], view[a + slots.POS_Z]);
      if (!query.complete) throw new Error('Neighbor query incomplete; refusing partial product-law parity');
      for (let n = 0; n < query.count; n++) {
        const j = candidates[n];
        if (j === i) continue;
        const b = j * stride;
        if (view[b + slots.DEAD] >= 0.5 || view[b + slots.MASS] <= 0) continue;
        const [dx, dy, dz] = displacement(view, a, b, slots, worldSize, toroidal);
        const distance = Math.hypot(dx, dy, dz);
        if (!(distance > 0) || distance > interactionRadius) continue;
        const invDistance = 1 / distance;
        if (activeLawIds.includes('law.field') && fieldCoefficient !== 0) {
          const fx = worldSize * 0.5 - view[a + slots.POS_X];
          const fy = worldSize * 0.5 - view[a + slots.POS_Y];
          const fz = worldSize * 0.5 - view[a + slots.POS_Z];
          const fieldDistance = Math.hypot(fx, fy, fz);
          if (fieldDistance > 0) {
            const fieldMagnitude = Math.min(50, Math.max(0, fieldCoefficient) * Math.min(fieldDistance, 100) / 100);
            acceleration[i * 3] += fx / fieldDistance * fieldMagnitude / massA;
            acceleration[i * 3 + 1] += fy / fieldDistance * fieldMagnitude / massA;
            acceleration[i * 3 + 2] += fz / fieldDistance * fieldMagnitude / massA;
          }
        }
        let magnitude = 0;
        let sign = 1;
        if (activeLawIds.includes('law.tide') && tideCoefficient !== 0) {
          magnitude = view[b + slots.MASS] * tideCoefficient / distance;
          acceleration[i * 3] += dx * invDistance * magnitude / massA;
          acceleration[i * 3 + 1] += dy * invDistance * magnitude / massA;
          acceleration[i * 3 + 2] += dz * invDistance * magnitude / massA;
        }
        if (activeLawIds.includes('law.horizon') && horizonCoefficient !== 0) {
          const neighborMass = Math.max(0, view[b + slots.MASS]);
          const neighborRadius = Math.max(0.01, view[b + slots.RADIUS]);
          const horizon = neighborRadius + Math.sqrt(neighborMass) * 0.5;
          if (distance < horizon * 4) {
            const falloff = Math.max(0, 1 - distance / (horizon * 4));
            magnitude = Math.min(50, horizonCoefficient * neighborMass * falloff * falloff / Math.max(distance, 0.1));
            acceleration[i * 3] += dx * invDistance * magnitude / massA;
            acceleration[i * 3 + 1] += dy * invDistance * magnitude / massA;
            acceleration[i * 3 + 2] += dz * invDistance * magnitude / massA;
          }
        }
        if (activeLawIds.includes('law.radiation-pressure') && radiationPressureCoefficient !== 0) {
          const energy = Math.max(0, view[b + slots.ENERGY] || 0)
            + Math.max(0, view[b + slots.ELECTRIC_ENERGY] || 0)
            + Math.max(0, view[b + slots.STORED_ENERGY] || 0);
          magnitude = Math.min(50, radiationPressureCoefficient * energy / Math.max(1, distance * distance));
          sign = -1;
          acceleration[i * 3] += sign * dx * invDistance * magnitude / massA;
          acceleration[i * 3 + 1] += sign * dy * invDistance * magnitude / massA;
          acceleration[i * 3 + 2] += sign * dz * invDistance * magnitude / massA;
        }
        interactions++;
      }
    }
  }

  if (activeLawIds.includes('law.friction') && frictionCoefficient !== 0) {
    for (const i of alive) {
      const b = i * stride;
      const vx = Number.isFinite(view[b + slots.VEL_X]) ? view[b + slots.VEL_X] : 0;
      const vy = Number.isFinite(view[b + slots.VEL_Y]) ? view[b + slots.VEL_Y] : 0;
      const vz = Number.isFinite(view[b + slots.VEL_Z]) ? view[b + slots.VEL_Z] : 0;
      const speed = Math.hypot(vx, vy, vz);
      const viscosityRaw = view[b + slots.DNA_CACHE_START + 1];
      const viscosity = Number.isFinite(viscosityRaw) ? viscosityRaw : 0.98;
      const damping = frictionCoefficient * viscosity;
      if (speed > 1e-6) view[b + slots.TEMPERATURE] = Math.min(1, (view[b + slots.TEMPERATURE] || 0) + speed * damping * 0.5);
      acceleration[i * 3] += Math.max(-50, Math.min(50, -vx * damping)) / Math.max(view[b + slots.MASS], 1e-12);
      acceleration[i * 3 + 1] += Math.max(-50, Math.min(50, -vy * damping)) / Math.max(view[b + slots.MASS], 1e-12);
      acceleration[i * 3 + 2] += Math.max(-50, Math.min(50, -vz * damping)) / Math.max(view[b + slots.MASS], 1e-12);
    }
  }

  if (activeLawIds.includes('law.buoyancy') && buoyancyCoefficient !== 0) {
    for (const i of alive) {
      const b = i * stride;
      const temperature = Number.isFinite(view[b + slots.TEMPERATURE]) ? view[b + slots.TEMPERATURE] : ambientTemperature;
      const mass = Math.max(view[b + slots.MASS], 1e-12);
      acceleration[i * 3 + 1] += buoyancyCoefficient * (temperature - ambientTemperature) / mass;
    }
  }

  if (activeLawIds.includes('law.bond') && bondStrength > 0) {
    for (const i of alive) {
      const a = i * stride;
      const partner = Math.trunc(view[a + slots.BOND_PARTNER_1]);
      if (!Number.isInteger(partner) || partner < 0 || partner >= view.length / stride || partner === i || partner <= i) continue;
      const b = partner * stride;
      if (view[b + slots.DEAD] >= 0.5 || view[b + slots.MASS] <= 0) continue;
      const [dx, dy, dz] = displacement(view, a, b, slots, worldSize, toroidal);
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 === 0) continue;
      const distance = Math.sqrt(d2);
      const restLength = Math.max(1e-6, view[a + slots.RADIUS] + view[b + slots.RADIUS]);
      const extension = distance - restLength;
      const nx = dx / distance, ny = dy / distance, nz = dz / distance;
      const relativeVelocity =
        (view[b + slots.VEL_X] - view[a + slots.VEL_X]) * nx +
        (view[b + slots.VEL_Y] - view[a + slots.VEL_Y]) * ny +
        (view[b + slots.VEL_Z] - view[a + slots.VEL_Z]) * nz;
      const force = bondStrength * extension + bondDamping * relativeVelocity;
      acceleration[i * 3] += nx * force / Math.max(view[a + slots.MASS], 1e-12);
      acceleration[i * 3 + 1] += ny * force / Math.max(view[a + slots.MASS], 1e-12);
      acceleration[i * 3 + 2] += nz * force / Math.max(view[a + slots.MASS], 1e-12);
      acceleration[partner * 3] -= nx * force / Math.max(view[b + slots.MASS], 1e-12);
      acceleration[partner * 3 + 1] -= ny * force / Math.max(view[b + slots.MASS], 1e-12);
      acceleration[partner * 3 + 2] -= nz * force / Math.max(view[b + slots.MASS], 1e-12);
      interactions++;
    }
  }

  if (activeLawIds.includes('law.accretion') && accretionRadiusMultiplier > 0) {
    const merged = new Set();
    for (const i of alive) {
      if (merged.has(i)) continue;
      const a = i * stride;
      const query = queryNeighbors(view[a + slots.POS_X], view[a + slots.POS_Y], view[a + slots.POS_Z]);
      if (!query.complete) throw new Error('Neighbor query incomplete; refusing partial accretion');
      for (let n = 0; n < query.count; n++) {
        const j = candidates[n];
        if (j <= i || merged.has(j)) continue;
        const b = j * stride;
        if (view[b + slots.DEAD] >= 0.5 || view[b + slots.MASS] <= 0) continue;
        const [dx, dy, dz] = displacement(view, a, b, slots, worldSize, toroidal);
        const distance = Math.hypot(dx, dy, dz);
        const capture = (view[a + slots.RADIUS] + view[b + slots.RADIUS]) * accretionRadiusMultiplier;
        if (distance > capture) continue;
        const massA = view[a + slots.MASS], massB = view[b + slots.MASS];
        const totalMass = massA + massB;
        if (!(totalMass > 0)) continue;
        const keep = massA >= massB ? i : j;
        const consume = keep === i ? j : i;
        const k = keep * stride, c = consume * stride;
        const km = view[k + slots.MASS], cm = view[c + slots.MASS];
        for (const [p, v] of [[slots.POS_X, view[k + slots.POS_X] * km + view[c + slots.POS_X] * cm], [slots.POS_Y, view[k + slots.POS_Y] * km + view[c + slots.POS_Y] * cm], [slots.POS_Z, view[k + slots.POS_Z] * km + view[c + slots.POS_Z] * cm], [slots.VEL_X, view[k + slots.VEL_X] * km + view[c + slots.VEL_X] * cm], [slots.VEL_Y, view[k + slots.VEL_Y] * km + view[c + slots.VEL_Y] * cm], [slots.VEL_Z, view[k + slots.VEL_Z] * km + view[c + slots.VEL_Z] * cm]]) view[k + p] = v / totalMass;
        view[k + slots.MASS] = totalMass;
        view[k + slots.RADIUS] = Math.cbrt(Math.max(0, view[k + slots.RADIUS] ** 3 + view[c + slots.RADIUS] ** 3));
        view[c + slots.MASS] = 0;
        view[c + slots.DEAD] = 1;
        merged.add(consume);
        interactions++;
        break;
      }
    }
  }

  return interactions;
}
