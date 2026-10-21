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
} = {}) {
  const toroidal = boundaryMode === 'toroidal';
  let interactions = 0;

  if (activeLawIds.includes('law.entrainment') && entrainmentCoefficient > 0) {
    for (const i of alive) {
      const a = i * stride;
      const query = queryNeighbors(view[a + S.POS_X], view[a + S.POS_Y], view[a + S.POS_Z]);
      if (!query.complete) throw new Error('Neighbor query incomplete; refusing partial entrainment');
      let weightSum = 0;
      let vx = 0, vy = 0, vz = 0;
      for (let n = 0; n < query.count; n++) {
        const j = candidates[n];
        if (j === i) continue;
        const b = j * stride;
        const [dx, dy, dz] = displacement(view, a, b, S, worldSize, toroidal);
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 === 0 || d2 > interactionRadius * interactionRadius) continue;
        const weight = 1 / (d2 + softening * softening);
        vx += view[b + S.VEL_X] * weight;
        vy += view[b + S.VEL_Y] * weight;
        vz += view[b + S.VEL_Z] * weight;
        weightSum += weight;
      }
      if (weightSum > 0) {
        const factor = Math.min(1, entrainmentCoefficient * dt);
        acceleration[i * 3] += ((vx / weightSum) - view[a + S.VEL_X]) * factor / Math.max(dt, 1e-12);
        acceleration[i * 3 + 1] += ((vy / weightSum) - view[a + S.VEL_Y]) * factor / Math.max(dt, 1e-12);
        acceleration[i * 3 + 2] += ((vz / weightSum) - view[a + S.VEL_Z]) * factor / Math.max(dt, 1e-12);
        interactions++;
      }
    }
  }

  if (activeLawIds.includes('law.buoyancy') && buoyancyCoefficient !== 0) {
    for (const i of alive) {
      const b = i * stride;
      const temperature = Number.isFinite(view[b + S.TEMPERATURE]) ? view[b + S.TEMPERATURE] : ambientTemperature;
      const mass = Math.max(view[b + S.MASS], 1e-12);
      acceleration[i * 3 + 1] += buoyancyCoefficient * (temperature - ambientTemperature) / mass;
    }
  }

  if (activeLawIds.includes('law.bond') && bondStrength > 0) {
    for (const i of alive) {
      const a = i * stride;
      const partner = Math.trunc(view[a + S.BOND_PARTNER_1]);
      if (!Number.isInteger(partner) || partner < 0 || partner >= view.length / stride || partner === i || partner <= i) continue;
      const b = partner * stride;
      if (view[b + S.DEAD] >= 0.5 || view[b + S.MASS] <= 0) continue;
      const [dx, dy, dz] = displacement(view, a, b, S, worldSize, toroidal);
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 === 0) continue;
      const distance = Math.sqrt(d2);
      const restLength = Math.max(1e-6, view[a + S.RADIUS] + view[b + S.RADIUS]);
      const extension = distance - restLength;
      const nx = dx / distance, ny = dy / distance, nz = dz / distance;
      const relativeVelocity =
        (view[b + S.VEL_X] - view[a + S.VEL_X]) * nx +
        (view[b + S.VEL_Y] - view[a + S.VEL_Y]) * ny +
        (view[b + S.VEL_Z] - view[a + S.VEL_Z]) * nz;
      const force = bondStrength * extension + bondDamping * relativeVelocity;
      acceleration[i * 3] += nx * force / Math.max(view[a + S.MASS], 1e-12);
      acceleration[i * 3 + 1] += ny * force / Math.max(view[a + S.MASS], 1e-12);
      acceleration[i * 3 + 2] += nz * force / Math.max(view[a + S.MASS], 1e-12);
      acceleration[partner * 3] -= nx * force / Math.max(view[b + S.MASS], 1e-12);
      acceleration[partner * 3 + 1] -= ny * force / Math.max(view[b + S.MASS], 1e-12);
      acceleration[partner * 3 + 2] -= nz * force / Math.max(view[b + S.MASS], 1e-12);
      interactions++;
    }
  }

  if (activeLawIds.includes('law.accretion') && accretionRadiusMultiplier > 0) {
    const merged = new Set();
    for (const i of alive) {
      if (merged.has(i)) continue;
      const a = i * stride;
      const query = queryNeighbors(view[a + S.POS_X], view[a + S.POS_Y], view[a + S.POS_Z]);
      if (!query.complete) throw new Error('Neighbor query incomplete; refusing partial accretion');
      for (let n = 0; n < query.count; n++) {
        const j = candidates[n];
        if (j <= i || merged.has(j)) continue;
        const b = j * stride;
        if (view[b + S.DEAD] >= 0.5 || view[b + S.MASS] <= 0) continue;
        const [dx, dy, dz] = displacement(view, a, b, S, worldSize, toroidal);
        const distance = Math.hypot(dx, dy, dz);
        const capture = (view[a + S.RADIUS] + view[b + S.RADIUS]) * accretionRadiusMultiplier;
        if (distance > capture) continue;
        const massA = view[a + S.MASS], massB = view[b + S.MASS];
        const totalMass = massA + massB;
        if (!(totalMass > 0)) continue;
        const keep = massA >= massB ? i : j;
        const consume = keep === i ? j : i;
        const k = keep * stride, c = consume * stride;
        const km = view[k + S.MASS], cm = view[c + S.MASS];
        for (const [p, v] of [[S.POS_X, view[k + S.POS_X] * km + view[c + S.POS_X] * cm], [S.POS_Y, view[k + S.POS_Y] * km + view[c + S.POS_Y] * cm], [S.POS_Z, view[k + S.POS_Z] * km + view[c + S.POS_Z] * cm], [S.VEL_X, view[k + S.VEL_X] * km + view[c + S.VEL_X] * cm], [S.VEL_Y, view[k + S.VEL_Y] * km + view[c + S.VEL_Y] * cm], [S.VEL_Z, view[k + S.VEL_Z] * km + view[c + S.VEL_Z] * cm]]) view[k + p] = v / totalMass;
        view[k + S.MASS] = totalMass;
        view[k + S.RADIUS] = Math.cbrt(Math.max(0, view[k + S.RADIUS] ** 3 + view[c + S.RADIUS] ** 3));
        view[c + S.MASS] = 0;
        view[c + S.DEAD] = 1;
        merged.add(consume);
        interactions++;
        break;
      }
    }
  }

  return interactions;
}
