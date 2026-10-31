import { PARTICLE_STRIDE, PARTICLE_SLOTS as S } from './particle-layout.js';
import { createSpatialGrid, insertParticle, queryNeighborsOrAll } from './spatial-grid.js';
import { resolveParticleContacts } from './contact-constraints.js';
import { applyExtendedLaws } from './extended-laws.js';
import { applyAdvancedPhysics } from './advanced-physics.js';
import { calculateEwaldSystem } from './periodic-ewald.js';

const WRAP_MODES = new Set(['toroidal', 'reflective']);
function wrapPosition(value, size) { return ((value % size) + size) % size; }
function shortestDelta(delta, size) {
  if (delta > size / 2) return delta - size;
  if (delta < -size / 2) return delta + size;
  return delta;
}


function calculatePeriodicAcceleration(view, indices, count, stride, slots, worldSize, gravitationalConstant, electricConstant, ewald) {
  const acceleration = new Float64Array(count * 3);
  let gravityEnergy = 0, electricEnergy = 0, interactions = 0;
  const particles = indices.map(i => {
    const b = i * stride;
    return { id: ewald.entityIds?.[i] ?? 'slot:' + i,
      position: [view[b + slots.POS_X], view[b + slots.POS_Y], view[b + slots.POS_Z]],
      mass: view[b + slots.MASS], charge: Number.isFinite(view[b + slots.CHARGE]) ? view[b + slots.CHARGE] : 0 };
  });
  const common = { boxSize: worldSize, alpha: ewald.alpha ?? 5 / worldSize,
    realShell: ewald.realShell ?? 2, reciprocalShell: ewald.reciprocalShell ?? 5 };
  if (gravitationalConstant > 0 && particles.length > 1) {
    const result = calculateEwaldSystem({ ...common, particles: particles.map(p => ({ id: p.id, position: p.position, charge: p.mass })),
      coupling: -gravitationalConstant, neutrality: 'uniform-background' });
    gravityEnergy = result.components.total; interactions += result.pairImageCount;
    result.forces.forEach((entry, n) => {
      const i = indices[n], mass = particles[n].mass;
      for (let axis = 0; axis < 3; axis++) acceleration[i * 3 + axis] += entry.force[axis] / mass;
    });
  }
  const charged = particles.filter(p => p.charge !== 0);
  if (electricConstant > 0 && charged.length > 1) {
    const result = calculateEwaldSystem({ ...common, particles: charged.map(p => ({ id: p.id, position: p.position, charge: p.charge })),
      coupling: electricConstant, neutrality: ewald.electricNeutrality ?? 'require',
      neutralityTolerance: ewald.neutralityTolerance ?? 1e-10 });
    electricEnergy = result.components.total; interactions += result.pairImageCount;
    result.forces.forEach(entry => {
      const n = indices.findIndex(i => (ewald.entityIds?.[i] ?? 'slot:' + i) === entry.entityId);
      const i = indices[n], mass = particles[n].mass;
      for (let axis = 0; axis < 3; axis++) acceleration[i * 3 + axis] += entry.force[axis] / mass;
    });
  }
  return { acceleration, interactions, gravityEnergy, electricEnergy };
}

/** Deterministic bounded particle solver. Laws are explicit, composable runtime capabilities. */
export function stepParticleWorld(view, count, {
  stride = PARTICLE_STRIDE,
  worldSize = 2000,
  boundaryMode = 'toroidal',
  dt = 1 / 60,
  gravitationalConstant = 1,
  electricConstant = 50000,
  dragCoefficient = 0.015,
  softening = 1,
  interactionRadius = worldSize / 8,
  cutoffMode = 'hard',
  activeLawIds = ['law.gravity'],
  resolveContacts = true,
  contactIterations = 2,
  entrainmentCoefficient = 0.35,
  buoyancyCoefficient = 0.08,
  ambientTemperature = 0,
  accretionRadiusMultiplier = 1.25,
  bondStrength = 2,
  bondDamping = 0.15,
  slots = S,
  advancedPhysics = null,
  integrator = 'semi-implicit-euler',
  energyTransfers = null,
  dragEnergyDestination = 'dissipation',
  boundaryEvents = null,
  forceWorkEvents = null,
  entityIds = null,
  worldId = 'world',
  substepIndex = 0,
} = {}) {
  if (!ArrayBuffer.isView(view) || view instanceof DataView || !Number.isInteger(count) || count < 0 ||
      !Number.isInteger(stride) || stride < 1 || view.length < count * stride) {
    throw new TypeError('view must be a numeric typed array with count * stride elements');
  }
  if (!Number.isFinite(worldSize) || worldSize <= 0 || !Number.isFinite(dt) || dt <= 0 ||
      !Number.isFinite(gravitationalConstant) || gravitationalConstant < 0 ||
      !Number.isFinite(electricConstant) || electricConstant < 0 ||
      !Number.isFinite(dragCoefficient) || dragCoefficient < 0 ||
      !Number.isFinite(softening) || softening <= 0 ||
      !Number.isFinite(interactionRadius) || interactionRadius <= 0 || interactionRadius > worldSize / 2) {
    throw new RangeError('Invalid world size, timestep, gravity, softening or interaction radius');
  }
  if (!['minimum-image','ewald'].includes(periodicMode)) throw new RangeError('periodicMode must be minimum-image or ewald');\n  if (!['hard','shifted-force'].includes(cutoffMode)) throw new RangeError('cutoffMode must be hard or shifted-force');
  if (energyTransfers !== null && !Array.isArray(energyTransfers)) throw new TypeError('energyTransfers must be an array or null');
  if (boundaryEvents !== null && !Array.isArray(boundaryEvents)) throw new TypeError('boundaryEvents must be an array or null');
  if (forceWorkEvents !== null && !Array.isArray(forceWorkEvents)) throw new TypeError('forceWorkEvents must be an array or null');
  if (typeof worldId !== 'string' || !worldId || !Number.isInteger(substepIndex) || substepIndex < 0) throw new TypeError('Invalid solver evidence identity');
  if (entityIds !== null && (!Array.isArray(entityIds) || entityIds.length < count || entityIds.some((id, i) => i < count && (typeof id !== 'string' || !id)))) throw new TypeError('entityIds must contain stable non-empty identities for every particle');
  if (!['dissipation', 'thermal'].includes(dragEnergyDestination)) throw new RangeError('dragEnergyDestination must be dissipation or thermal');
  if (!WRAP_MODES.has(boundaryMode)) throw new RangeError('boundaryMode must be toroidal or reflective');
  if (!['explicit-euler', 'semi-implicit-euler', 'velocity-verlet'].includes(integrator)) throw new RangeError('integrator must be explicit-euler, semi-implicit-euler or velocity-verlet');
  if (periodicMode === 'ewald' && (boundaryMode !== 'toroidal' || activeLawIds.some(id => !['law.gravity','law.charge'].includes(id)) || advancedPhysics !== null || (activeLawIds.includes('law.collision') && resolveContacts))) throw new RangeError('Ewald mode supports only toroidal gravity/charge without contacts or advanced physics');\n  if (integrator === 'velocity-verlet' &&
      (activeLawIds.some(id => !['law.gravity','law.charge'].includes(id)) || boundaryMode !== 'toroidal' || activeLawIds.includes('law.collision') || advancedPhysics !== null)) {
    throw new RangeError('velocity-verlet currently supports only conservative gravity and charge laws');
  }
  if (!Array.isArray(activeLawIds) || activeLawIds.some(id => typeof id !== 'string' || !id) || new Set(activeLawIds).size !== activeLawIds.length) {
    throw new TypeError('activeLawIds must be a unique array of non-empty strings');
  }
  if (!Number.isInteger(contactIterations) || contactIterations < 0) throw new RangeError('contactIterations must be a non-negative integer');
  for (const key of ['POS_X','POS_Y','POS_Z','VEL_X','VEL_Y','VEL_Z','MASS','DEAD','RADIUS','CHARGE','TEMPERATURE','BOND_PARTNER_1']) {
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
  const forcePairs = [];
  const candidates = new Int32Array(count);
  const query = (x, y, z) => queryNeighborsOrAll(grid, x, y, z, candidates, count);

  let periodicDiagnostics = null;
  if (periodicMode === 'ewald') {
    const result = calculatePeriodicAcceleration(view, alive, count, stride, slots, worldSize,
      activeLawIds.includes('law.gravity') ? gravitationalConstant : 0,
      activeLawIds.includes('law.charge') ? electricConstant : 0,
      { ...ewald, entityIds });
    acceleration.set(result.acceleration);
    interactions += result.interactions;
    periodicDiagnostics = Object.freeze({ method: '3d-ewald-point-particles',
      gravitationalPotential: result.gravityEnergy, electricPotential: result.electricEnergy,
      realShell: ewald.realShell ?? 2, reciprocalShell: ewald.reciprocalShell ?? 5,
      alpha: ewald.alpha ?? 5 / worldSize, empiricalTruncationOnly: true });
  } else {
  if (activeLawIds.includes('law.charge') && electricConstant > 0) {
    for (const i of alive) {
      const a = i * stride;
      const result = query(view[a + slots.POS_X], view[a + slots.POS_Y], view[a + slots.POS_Z]);
      if (!result.complete) throw new Error('Neighbor query incomplete; refusing partial authoritative physics');
      if (result.usedFallback) fallbackQueries++;
      for (let n = 0; n < result.count; n++) {
        const j = candidates[n];
        if (j <= i) continue;
        const b = j * stride;
        let dx = view[b + slots.POS_X] - view[a + slots.POS_X];
        let dy = view[b + slots.POS_Y] - view[a + slots.POS_Y];
        let dz = view[b + slots.POS_Z] - view[a + slots.POS_Z];
        if (boundaryMode === 'toroidal') { dx = shortestDelta(dx, worldSize); dy = shortestDelta(dy, worldSize); dz = shortestDelta(dz, worldSize); }
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared === 0 || distanceSquared > interactionRadius * interactionRadius) continue;
        const chargeA = Number.isFinite(view[a + slots.CHARGE]) ? view[a + slots.CHARGE] : 0;
        const chargeB = Number.isFinite(view[b + slots.CHARGE]) ? view[b + slots.CHARGE] : 0;
        if (chargeA === 0 || chargeB === 0) continue;
        const denominator = Math.pow(distanceSquared + softening * softening, 1.5);
        const cutoffCorrection = cutoffMode === 'shifted-force' ? 1 - interactionRadius * denominator / (Math.sqrt(distanceSquared) * Math.pow(interactionRadius * interactionRadius + softening * softening, 1.5)) : 1;
        const factorA = -electricConstant * chargeA * chargeB * cutoffCorrection / (view[a + slots.MASS] * denominator);
        const factorB = electricConstant * chargeA * chargeB * cutoffCorrection / (view[b + slots.MASS] * denominator);
        acceleration[i * 3] += dx * factorA; acceleration[i * 3 + 1] += dy * factorA; acceleration[i * 3 + 2] += dz * factorA;
        acceleration[j * 3] += dx * factorB; acceleration[j * 3 + 1] += dy * factorB; acceleration[j * 3 + 2] += dz * factorB;
        forcePairs.push({ law: 'electric', i, j, dx, dy, dz, distanceSquared,
          strength: electricConstant * chargeA * chargeB });
        interactions++;
      }
    }
  }

  if (activeLawIds.includes('law.gravity') && gravitationalConstant > 0) {
    for (const i of alive) {
      const a = i * stride;
      const result = query(view[a + slots.POS_X], view[a + slots.POS_Y], view[a + slots.POS_Z]);
      if (!result.complete) throw new Error('Neighbor query incomplete; refusing partial authoritative physics');
      if (result.usedFallback) fallbackQueries++;
      for (let n = 0; n < result.count; n++) {
        const j = candidates[n];
        if (j <= i) continue;
        const b = j * stride;
        let dx = view[b + slots.POS_X] - view[a + slots.POS_X];
        let dy = view[b + slots.POS_Y] - view[a + slots.POS_Y];
        let dz = view[b + slots.POS_Z] - view[a + slots.POS_Z];
        if (boundaryMode === 'toroidal') { dx = shortestDelta(dx, worldSize); dy = shortestDelta(dy, worldSize); dz = shortestDelta(dz, worldSize); }
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared === 0 || distanceSquared > interactionRadius * interactionRadius) continue;
        const denominator = Math.pow(distanceSquared + softening * softening, 1.5);
        const massA = view[a + slots.MASS], massB = view[b + slots.MASS];
        const cutoffCorrection = cutoffMode === 'shifted-force' ? 1 - interactionRadius * denominator / (Math.sqrt(distanceSquared) * Math.pow(interactionRadius * interactionRadius + softening * softening, 1.5)) : 1;
        const factorA = gravitationalConstant * massB * cutoffCorrection / denominator;
        const factorB = gravitationalConstant * massA * cutoffCorrection / denominator;
        acceleration[i * 3] += dx * factorA; acceleration[i * 3 + 1] += dy * factorA; acceleration[i * 3 + 2] += dz * factorA;
        acceleration[j * 3] -= dx * factorB; acceleration[j * 3 + 1] -= dy * factorB; acceleration[j * 3 + 2] -= dz * factorB;
        forcePairs.push({ law: 'gravity', i, j, dx, dy, dz, distanceSquared,
          strength: -gravitationalConstant * massA * massB });
        interactions++;
      }
    }
  }


  }

  interactions += applyExtendedLaws(view, alive, acceleration, candidates, (x, y, z) => {
    const result = query(x, y, z);
    if (result.usedFallback) fallbackQueries++;
    return result;
  }, {
    stride, worldSize, boundaryMode, interactionRadius, softening, dt, activeLawIds,
    entrainmentCoefficient, buoyancyCoefficient, ambientTemperature,
    accretionRadiusMultiplier, bondStrength, bondDamping, slots,
  });

  const advancedMetrics = applyAdvancedPhysics(view, alive, acceleration, candidates, (x, y, z) => {
    const result = query(x, y, z);
    if (result.usedFallback) fallbackQueries++;
    return result;
  }, { stride, worldSize, boundaryMode, dt, slots, advancedPhysics, energyTransfers });

  // Accretion can retire particles, so rebuild the integration list before applying velocities.
  const activeAfterLaws = [];
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (view[b + slots.DEAD] < 0.5 && view[b + slots.MASS] > 0) activeAfterLaws.push(i);
  }
  for (const i of activeAfterLaws) {
    const b = i * stride, a = i * 3;
    const oldVx = view[b + slots.VEL_X], oldVy = view[b + slots.VEL_Y], oldVz = view[b + slots.VEL_Z];
    if (integrator !== 'velocity-verlet') {
      view[b + slots.VEL_X] += acceleration[a] * dt;
      view[b + slots.VEL_Y] += acceleration[a + 1] * dt;
      view[b + slots.VEL_Z] += acceleration[a + 2] * dt;
    }
    if (activeLawIds.includes('law.drag') && dragCoefficient > 0) {
      const beforeDrag = 0.5 * view[b + slots.MASS] * (
        view[b + slots.VEL_X] ** 2 + view[b + slots.VEL_Y] ** 2 + view[b + slots.VEL_Z] ** 2);
      const damping = Math.exp(-dragCoefficient * dt);
      view[b + slots.VEL_X] *= damping; view[b + slots.VEL_Y] *= damping; view[b + slots.VEL_Z] *= damping;
      const afterDrag = 0.5 * view[b + slots.MASS] * (
        view[b + slots.VEL_X] ** 2 + view[b + slots.VEL_Y] ** 2 + view[b + slots.VEL_Z] ** 2);
      const dissipated = beforeDrag - afterDrag;
      if (energyTransfers && dissipated > 0) energyTransfers.push({
        source: 'kinetic:particle:' + i,
        destination: dragEnergyDestination + ':particle:' + i,
        amount: dissipated, cause: 'drag-dissipation',
        metadata: { particleIndex: i, destination: dragEnergyDestination },
      });
    }
    const positionVx = integrator === 'velocity-verlet' || integrator === 'explicit-euler' ? oldVx : view[b + slots.VEL_X];
    const positionVy = integrator === 'velocity-verlet' || integrator === 'explicit-euler' ? oldVy : view[b + slots.VEL_Y];
    const positionVz = integrator === 'velocity-verlet' || integrator === 'explicit-euler' ? oldVz : view[b + slots.VEL_Z];
    const half = integrator === 'velocity-verlet' ? 0.5 * dt * dt : 0;
    view[b + slots.POS_X] += positionVx * dt + acceleration[a] * half;
    view[b + slots.POS_Y] += positionVy * dt + acceleration[a + 1] * half;
    view[b + slots.POS_Z] += positionVz * dt + acceleration[a + 2] * half;
    for (const slot of [slots.POS_X, slots.POS_Y, slots.POS_Z]) {
      if (boundaryMode === 'toroidal') {
        const beforeWrap = view[b + slot];
        const afterWrap = wrapPosition(beforeWrap, worldSize);
        if (afterWrap !== beforeWrap && boundaryEvents) boundaryEvents.push({
          kind: 'toroidal-wrap', worldId, entityId: entityIds?.[i] ?? 'slot:' + i,
          substepIndex, particleIndex: i, axis: slot === slots.POS_X ? 'x' : slot === slots.POS_Y ? 'y' : 'z',
          positionBefore: beforeWrap, positionAfter: afterWrap, work: 0,
        });
        view[b + slot] = afterWrap;
      }
      else if (view[b + slot] < 0 || view[b + slot] > worldSize) {
        const beforePosition = view[b + slot];
        const lower = beforePosition < 0;
        const wall = lower ? 0 : worldSize;
        const velocitySlot = slot === slots.POS_X ? slots.VEL_X : slot === slots.POS_Y ? slots.VEL_Y : slots.VEL_Z;
        const beforeVelocity = view[b + velocitySlot];
        const afterVelocity = lower ? Math.abs(beforeVelocity) : -Math.abs(beforeVelocity);
        const mass = view[b + slots.MASS];
        const axis = slot === slots.POS_X ? 'x' : slot === slots.POS_Y ? 'y' : 'z';
        const entityId = entityIds?.[i] ?? 'slot:' + i;
        view[b + slot] = wall;
        view[b + velocitySlot] = afterVelocity;
        if (boundaryEvents) boundaryEvents.push({
          kind: 'reflective-wall-impulse', worldId, entityId, substepIndex, particleIndex: i,
          axis, wall: lower ? 'lower' : 'upper', positionBefore: beforePosition,
          impulse: mass * (afterVelocity - beforeVelocity),
          kineticEnergyDelta: 0.5 * mass * (afterVelocity * afterVelocity - beforeVelocity * beforeVelocity),
          work: 0,
        });
      }
    }
  }

  if (forceWorkEvents) {
    const pairPotential = (pair, x, y, z) => {
      const r2 = x * x + y * y + z * z;
      if (r2 === 0 || r2 > interactionRadius * interactionRadius) return 0;
      const softened = Math.sqrt(r2 + softening * softening);
      const cutoff = Math.sqrt(interactionRadius * interactionRadius + softening * softening);
      const base = pair.strength * (1 / softened - 1 / cutoff);
      return cutoffMode === 'shifted-force'
        ? base + pair.strength * (Math.sqrt(r2) - interactionRadius) * interactionRadius / Math.pow(interactionRadius * interactionRadius + softening * softening, 1.5)
        : base;
    };
    for (const pair of forcePairs) {
      const a = pair.i * stride, b = pair.j * stride;
      let dx = view[b + slots.POS_X] - view[a + slots.POS_X];
      let dy = view[b + slots.POS_Y] - view[a + slots.POS_Y];
      let dz = view[b + slots.POS_Z] - view[a + slots.POS_Z];
      if (boundaryMode === 'toroidal') {
        dx = shortestDelta(dx, worldSize); dy = shortestDelta(dy, worldSize); dz = shortestDelta(dz, worldSize);
      }
      const potentialBefore = pairPotential(pair, pair.dx, pair.dy, pair.dz);
      const potentialAfter = pairPotential(pair, dx, dy, dz);
      const idA = entityIds?.[pair.i] ?? 'slot:' + pair.i;
      const idB = entityIds?.[pair.j] ?? 'slot:' + pair.j;
      forceWorkEvents.push({
        kind: 'pair-force-work', law: pair.law, worldId, entityA: idA, entityB: idB,
        pairId: idA < idB ? idA + '|' + idB : idB + '|' + idA,
        substepIndex, potentialBefore, potentialAfter,
        potentialDelta: potentialAfter - potentialBefore,
        conservativeWork: potentialBefore - potentialAfter,
      });
    }
  }

  if (integrator === 'velocity-verlet') {
    const nextAcceleration = new Float64Array(count * 3);
    if (periodicMode === 'ewald') {
      const result = calculatePeriodicAcceleration(view, activeAfterLaws, count, stride, slots, worldSize,
        activeLawIds.includes('law.gravity') ? gravitationalConstant : 0,
        activeLawIds.includes('law.charge') ? electricConstant : 0,
        { ...ewald, entityIds });
      nextAcceleration.set(result.acceleration);
    } else {
    for (let p = 0; p < activeAfterLaws.length; p++) {
      const i = activeAfterLaws[p], a = i * stride;
      for (let q = p + 1; q < activeAfterLaws.length; q++) {
        const j = activeAfterLaws[q], b = j * stride;
        let dx = view[b + slots.POS_X] - view[a + slots.POS_X];
        let dy = view[b + slots.POS_Y] - view[a + slots.POS_Y];
        let dz = view[b + slots.POS_Z] - view[a + slots.POS_Z];
        if (boundaryMode === 'toroidal') {
          dx = shortestDelta(dx, worldSize); dy = shortestDelta(dy, worldSize); dz = shortestDelta(dz, worldSize);
        }
        const r2 = dx*dx + dy*dy + dz*dz;
        if (r2 === 0 || r2 > interactionRadius*interactionRadius) continue;
        const denominator = Math.pow(r2 + softening*softening, 1.5);
        if (activeLawIds.includes('law.gravity') && gravitationalConstant > 0) {
          const mi=view[a+slots.MASS], mj=view[b+slots.MASS];
          const correction=cutoffMode === 'shifted-force' ? 1-interactionRadius*denominator/(Math.sqrt(r2)*Math.pow(interactionRadius*interactionRadius+softening*softening,1.5)) : 1;
          const f=gravitationalConstant*correction/denominator;
          nextAcceleration[i*3]+=dx*f*mj; nextAcceleration[i*3+1]+=dy*f*mj; nextAcceleration[i*3+2]+=dz*f*mj;
          nextAcceleration[j*3]-=dx*f*mi; nextAcceleration[j*3+1]-=dy*f*mi; nextAcceleration[j*3+2]-=dz*f*mi;
        }
        if (activeLawIds.includes('law.charge') && electricConstant > 0) {
          const qi=Number.isFinite(view[a+slots.CHARGE])?view[a+slots.CHARGE]:0;
          const qj=Number.isFinite(view[b+slots.CHARGE])?view[b+slots.CHARGE]:0;
          if (qi!==0 && qj!==0) {
            const correction=cutoffMode === 'shifted-force' ? 1-interactionRadius*denominator/(Math.sqrt(r2)*Math.pow(interactionRadius*interactionRadius+softening*softening,1.5)) : 1;
            const f=electricConstant*qi*qj*correction/denominator;
            nextAcceleration[i*3]-=dx*f/view[a+slots.MASS]; nextAcceleration[i*3+1]-=dy*f/view[a+slots.MASS]; nextAcceleration[i*3+2]-=dz*f/view[a+slots.MASS];
            nextAcceleration[j*3]+=dx*f/view[b+slots.MASS]; nextAcceleration[j*3+1]+=dy*f/view[b+slots.MASS]; nextAcceleration[j*3+2]+=dz*f/view[b+slots.MASS];
          }
        }
      }
    }

    }
    for (const i of activeAfterLaws) {
      const b=i*stride,a=i*3;
      view[b+slots.VEL_X]+=0.5*(acceleration[a]+nextAcceleration[a])*dt;
      view[b+slots.VEL_Y]+=0.5*(acceleration[a+1]+nextAcceleration[a+1])*dt;
      view[b+slots.VEL_Z]+=0.5*(acceleration[a+2]+nextAcceleration[a+2])*dt;
    }
  }

  if (resolveContacts && activeLawIds.includes('law.collision') && maxRadius > 0 && activeAfterLaws.length > 1 && contactIterations > 0) {
    resolveParticleContacts(view, count, stride, worldSize, boundaryMode === 'toroidal', contactIterations, slots);
  }
  return Object.freeze({ liveCount: activeAfterLaws.length, interactions, fallbackQueries, gridDimension: dim, boundaryMode, periodicDiagnostics, advancedPhysics: advancedMetrics, energyTransfers: energyTransfers?.length ?? 0 });
}
