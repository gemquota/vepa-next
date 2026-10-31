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
