import { PARTICLE_SLOTS as S } from './particle-layout.js';

const finite = (v, name, min = -Infinity) => {
  if (!Number.isFinite(v) || v < min) throw new RangeError(name + ' must be finite and >= ' + min);
  return v;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const vec3 = (v, name) => {
  if (!Array.isArray(v) || v.length !== 3) throw new TypeError(name + ' must be a three-number array');
  return v.map((n, i) => finite(n, name + '[' + i + ']'));
};

/** Validate the serializable, opt-in advanced-physics profile. */
export function validateAdvancedPhysicsConfig(config) {
  if (config == null) return null;
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('advancedPhysics must be an object or null');
  const result = structuredClone(config);
  const section = (name) => {
    const value = result[name] ?? {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(name + ' must be an object');
    value.enabled = value.enabled === true;
    result[name] = value;
    return value;
  };
  const sph = section('sph');
  if (sph.enabled) {
    finite(sph.smoothingLength, 'sph.smoothingLength', Number.EPSILON);
    finite(sph.restDensity, 'sph.restDensity', Number.EPSILON);
    finite(sph.pressureStiffness, 'sph.pressureStiffness', 0);
    finite(sph.viscosity, 'sph.viscosity', 0);
  }
  const magnetic = section('magnetic');
  if (magnetic.enabled) { magnetic.field = vec3(magnetic.field, 'magnetic.field'); finite(magnetic.scale ?? 1, 'magnetic.scale', 0); }
  const thermal = section('thermal');
  if (thermal.enabled) { finite(thermal.conductivity, 'thermal.conductivity', 0); finite(thermal.heatCapacity ?? 1, 'thermal.heatCapacity', Number.EPSILON); finite(thermal.smoothingLength, 'thermal.smoothingLength', Number.EPSILON); }
  const collisions = section('collisions');
  if (collisions.enabled) { finite(collisions.restitution, 'collisions.restitution', 0); if (collisions.restitution > 1) throw new RangeError('collisions.restitution must be <= 1'); finite(collisions.friction, 'collisions.friction', 0); if (collisions.friction > 1) throw new RangeError('collisions.friction must be <= 1'); }
  const phase = section('phase');
  if (phase.enabled) {
    if (!Array.isArray(phase.materials)) throw new TypeError('phase.materials must be an array');
    for (const m of phase.materials) {
      if (!Number.isInteger(m.speciesId) || m.speciesId < 0) throw new TypeError('material speciesId must be a non-negative integer');
      finite(m.meltPoint, 'material.meltPoint'); finite(m.boilPoint, 'material.boilPoint');
      if (m.boilPoint < m.meltPoint) throw new RangeError('material boilPoint must be >= meltPoint');
      finite(m.latentFusion ?? 0, 'material.latentFusion', 0); finite(m.latentVaporization ?? 0, 'material.latentVaporization', 0);
    }
  }
  const chemistry = section('chemistry');
  if (chemistry.enabled) {
    if (!Array.isArray(chemistry.reactions)) throw new TypeError('chemistry.reactions must be an array');
    for (const r of chemistry.reactions) {
      for (const k of ['speciesA', 'speciesB', 'productA', 'productB']) if (!Number.isInteger(r[k]) || r[k] < 0) throw new TypeError('reaction ' + k + ' must be a non-negative integer');
      finite(r.rate, 'reaction.rate', 0); finite(r.energy ?? 0, 'reaction.energy');
    }
  }
  const nuclear = section('nuclear');
  if (nuclear.enabled) {
    if (!Array.isArray(nuclear.decays)) throw new TypeError('nuclear.decays must be an array');
    for (const d of nuclear.decays) {
      if (!Number.isInteger(d.speciesId) || d.speciesId < 0 || !Number.isInteger(d.productSpeciesId) || d.productSpeciesId < 0) throw new TypeError('decay species identifiers must be non-negative integers');
      finite(d.rate, 'decay.rate', 0); finite(d.massDefectFraction, 'decay.massDefectFraction', 0);
      if (d.massDefectFraction > 1) throw new RangeError('decay.massDefectFraction must be <= 1');
      finite(d.speedOfLightSquared ?? 1, 'decay.speedOfLightSquared', 0);
    }
  }
  const radiation = section('radiation');
  if (radiation.enabled) { radiation.direction = vec3(radiation.direction, 'radiation.direction'); finite(radiation.pressure, 'radiation.pressure', 0); }
  return result;
}

function displacement(view, a, b, slots, worldSize, toroidal) {
  let x = view[b + slots.POS_X] - view[a + slots.POS_X];
  let y = view[b + slots.POS_Y] - view[a + slots.POS_Y];
  let z = view[b + slots.POS_Z] - view[a + slots.POS_Z];
  if (toroidal) {
    if (x > worldSize / 2) x -= worldSize; else if (x < -worldSize / 2) x += worldSize;
    if (y > worldSize / 2) y -= worldSize; else if (y < -worldSize / 2) y += worldSize;
    if (z > worldSize / 2) z -= worldSize; else if (z < -worldSize / 2) z += worldSize;
  }
  return [x, y, z];
}

/**
 * Conservative multiphysics stage. It is opt-in and runs inside the authoritative
 * solver before position integration. Pair forces are accumulated symmetrically.
 */
export function applyAdvancedPhysics(view, alive, acceleration, candidates, queryNeighbors, {
  stride, worldSize, boundaryMode, dt, slots = S, advancedPhysics, energyTransfers = null,
} = {}) {
  const cfg = validateAdvancedPhysicsConfig(advancedPhysics);
  if (!cfg) return Object.freeze({ pairs: 0, thermalTransfers: 0, reactions: 0, decays: 0, phaseChanges: 0 });
  const toroidal = boundaryMode === 'toroidal';
  const pairs = [];
  const seen = new Set();
  const maxRadius = Math.max(cfg.sph?.enabled ? cfg.sph.smoothingLength : 0, cfg.thermal?.enabled ? cfg.thermal.smoothingLength : 0);
  if (maxRadius > 0 || cfg.collisions?.enabled || cfg.chemistry?.enabled) {
    for (const i of alive) {
      const a = i * stride;
      const q = queryNeighbors(view[a + slots.POS_X], view[a + slots.POS_Y], view[a + slots.POS_Z]);
      if (!q.complete) throw new Error('Neighbor query incomplete; refusing partial advanced physics');
      for (let n = 0; n < q.count; n++) {
        const j = candidates[n];
        if (j <= i) continue;
        const key = i + ':' + j;
        if (seen.has(key)) continue;
        seen.add(key);
        const b = j * stride;
        const [dx, dy, dz] = displacement(view, a, b, slots, worldSize, toroidal);
        const distance = Math.hypot(dx, dy, dz);
        if (maxRadius > 0 && distance > maxRadius && !(cfg.collisions?.enabled && distance < view[a + slots.RADIUS] + view[b + slots.RADIUS])) continue;
        pairs.push({ i, j, a, b, dx, dy, dz, distance });
      }
    }
  }

  let thermalTransfers = 0, reactions = 0, decays = 0, phaseChanges = 0;
  // 1–3. SPH density, pressure and viscosity; equal/opposite pair forces preserve momentum.
  if (cfg.sph?.enabled) {
    const { smoothingLength: h, restDensity, pressureStiffness, viscosity } = cfg.sph;
    const density = new Float64Array(view.length / stride);
    const weight = r => { const q = r / h; return q < 1 ? (1 - q) ** 4 * (1 + 4 * q) : 0; };
    for (const i of alive) density[i] = Math.max(1e-12, view[i * stride + slots.MASS]);
    for (const p of pairs) if (p.distance < h) {
      const w = weight(p.distance);
      density[p.i] += view[p.b + slots.MASS] * w;
      density[p.j] += view[p.a + slots.MASS] * w;
    }
    const pressure = new Float64Array(density.length);
    for (const i of alive) pressure[i] = Math.max(0, pressureStiffness * (density[i] - restDensity));
    for (const p of pairs) {
      if (!(p.distance > 1e-12 && p.distance < h)) continue;
      const { i, j, a, b, dx, dy, dz, distance } = p;
      const mi = view[a + slots.MASS], mj = view[b + slots.MASS];
      const w = weight(distance);
      const push = 0.5 * (pressure[i] + pressure[j]) * w;
      const nx = dx / distance, ny = dy / distance, nz = dz / distance;
      acceleration[i * 3] -= push * nx / mi; acceleration[i * 3 + 1] -= push * ny / mi; acceleration[i * 3 + 2] -= push * nz / mi;
      acceleration[j * 3] += push * nx / mj; acceleration[j * 3 + 1] += push * ny / mj; acceleration[j * 3 + 2] += push * nz / mj;
      const visc = viscosity * w;
      const dvx = view[b + slots.VEL_X] - view[a + slots.VEL_X];
      const dvy = view[b + slots.VEL_Y] - view[a + slots.VEL_Y];
      const dvz = view[b + slots.VEL_Z] - view[a + slots.VEL_Z];
      const viscousHeat = Math.max(0, visc * (dvx * dvx + dvy * dvy + dvz * dvz) * dt);
      if (energyTransfers && viscousHeat > 0) energyTransfers.push({ source: 'kinetic:pair:' + i + ':' + j, destination: 'thermal:pair:' + i + ':' + j, amount: viscousHeat, cause: 'sph-viscous-dissipation', metadata: { particleA: i, particleB: j } });
      const fx = visc * (view[b + slots.VEL_X] - view[a + slots.VEL_X]);
      const fy = visc * (view[b + slots.VEL_Y] - view[a + slots.VEL_Y]);
      const fz = visc * (view[b + slots.VEL_Z] - view[a + slots.VEL_Z]);
      acceleration[i * 3] += fx / mi; acceleration[i * 3 + 1] += fy / mi; acceleration[i * 3 + 2] += fz / mi;
      acceleration[j * 3] -= fx / mj; acceleration[j * 3 + 1] -= fy / mj; acceleration[j * 3 + 2] -= fz / mj;
    }
  }

  // 4. Magnetic Lorentz force q(v × B), with explicit field units/scale.
  if (cfg.magnetic?.enabled) {
    const [bx, by, bz] = cfg.magnetic.field, scale = cfg.magnetic.scale ?? 1;
    for (const i of alive) {
      const b = i * stride, mass = view[b + slots.MASS], q = view[b + slots.CHARGE] || 0;
      if (q === 0 || mass <= 0) continue;
      acceleration[i * 3] += q * (view[b + slots.VEL_Y] * bz - view[b + slots.VEL_Z] * by) * scale / mass;
      acceleration[i * 3 + 1] += q * (view[b + slots.VEL_Z] * bx - view[b + slots.VEL_X] * bz) * scale / mass;
      acceleration[i * 3 + 2] += q * (view[b + slots.VEL_X] * by - view[b + slots.VEL_Y] * bx) * scale / mass;
    }
  }

  // 5. Pairwise thermal conduction; transfer is equal and opposite in ENERGY.
  if (cfg.thermal?.enabled) {
    const { conductivity, smoothingLength: h, heatCapacity = 1 } = cfg.thermal;
    for (const p of pairs) {
      if (!(p.distance < h)) continue;
      const ta = view[p.a + slots.TEMPERATURE], tb = view[p.b + slots.TEMPERATURE];
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) continue;
      let transfer = conductivity * (tb - ta) * (1 - p.distance / h) ** 2 * dt;
      if (transfer > 0) transfer = Math.min(transfer, Math.max(0, view[p.b + slots.ENERGY]));
      else transfer = -Math.min(-transfer, Math.max(0, view[p.a + slots.ENERGY]));
      view[p.a + slots.ENERGY] += transfer;
      view[p.b + slots.ENERGY] -= transfer;
      if (energyTransfers && transfer !== 0) energyTransfers.push({
        source: (transfer > 0 ? 'thermal:particle:' + p.j : 'thermal:particle:' + p.i),
        destination: (transfer > 0 ? 'thermal:particle:' + p.i : 'thermal:particle:' + p.j),
        amount: Math.abs(transfer), cause: 'thermal-conduction',
        metadata: { particleA: p.i, particleB: p.j },
      });
      view[p.a + slots.TEMPERATURE] += transfer / heatCapacity;
      view[p.b + slots.TEMPERATURE] -= transfer / heatCapacity;
      if (transfer !== 0) thermalTransfers++;
    }
  }

  // 6–7. Contact restitution and Coulomb-like tangential friction impulses.
  if (cfg.collisions?.enabled) {
    const e = cfg.collisions.restitution, friction = cfg.collisions.friction;
    for (const p of pairs) {
      const minDistance = Math.max(0, view[p.a + slots.RADIUS]) + Math.max(0, view[p.b + slots.RADIUS]);
      if (!(p.distance > 1e-12 && p.distance < minDistance)) continue;
      const mi = view[p.a + slots.MASS], mj = view[p.b + slots.MASS];
      const invI = 1 / mi, invJ = 1 / mj;
      const kineticBefore = 0.5 * mi * (view[p.a + slots.VEL_X] ** 2 + view[p.a + slots.VEL_Y] ** 2 + view[p.a + slots.VEL_Z] ** 2)
        + 0.5 * mj * (view[p.b + slots.VEL_X] ** 2 + view[p.b + slots.VEL_Y] ** 2 + view[p.b + slots.VEL_Z] ** 2);
      const nx = p.dx / p.distance, ny = p.dy / p.distance, nz = p.dz / p.distance;
      const rvx = view[p.b + slots.VEL_X] - view[p.a + slots.VEL_X];
      const rvy = view[p.b + slots.VEL_Y] - view[p.a + slots.VEL_Y];
      const rvz = view[p.b + slots.VEL_Z] - view[p.a + slots.VEL_Z];
      const vn = rvx * nx + rvy * ny + rvz * nz;
      if (vn >= 0) continue;
      const impulse = -(1 + e) * vn / (invI + invJ);
      const jx = impulse * nx, jy = impulse * ny, jz = impulse * nz;
      view[p.a + slots.VEL_X] -= jx * invI; view[p.a + slots.VEL_Y] -= jy * invI; view[p.a + slots.VEL_Z] -= jz * invI;
      view[p.b + slots.VEL_X] += jx * invJ; view[p.b + slots.VEL_Y] += jy * invJ; view[p.b + slots.VEL_Z] += jz * invJ;
      const tx = rvx - vn * nx, ty = rvy - vn * ny, tz = rvz - vn * nz;
      const tl = Math.hypot(tx, ty, tz);
      if (tl > 1e-12 && friction > 0) {
        const jt = Math.min(tl / (invI + invJ), friction * impulse);
        const fx = tx / tl * jt, fy = ty / tl * jt, fz = tz / tl * jt;
        view[p.a + slots.VEL_X] += fx * invI; view[p.a + slots.VEL_Y] += fy * invI; view[p.a + slots.VEL_Z] += fz * invI;
        view[p.b + slots.VEL_X] -= fx * invJ; view[p.b + slots.VEL_Y] -= fy * invJ; view[p.b + slots.VEL_Z] -= fz * invJ;
      }
      const kineticAfter = 0.5 * mi * (view[p.a + slots.VEL_X] ** 2 + view[p.a + slots.VEL_Y] ** 2 + view[p.a + slots.VEL_Z] ** 2)
        + 0.5 * mj * (view[p.b + slots.VEL_X] ** 2 + view[p.b + slots.VEL_Y] ** 2 + view[p.b + slots.VEL_Z] ** 2);
      const collisionHeat = Math.max(0, kineticBefore - kineticAfter);
      if (energyTransfers && collisionHeat > 1e-14) energyTransfers.push({
        source: 'kinetic:pair:' + p.i + ':' + p.j,
        destination: 'thermal:pair:' + p.i + ':' + p.j,
        amount: collisionHeat, cause: 'inelastic-contact-dissipation',
        metadata: { particleA: p.i, particleB: p.j, restitution: e, friction },
      });
    }
  }

  // 8. Explicit per-species phase changes with latent heat accounting.
  if (cfg.phase?.enabled) {
    const materials = new Map(cfg.phase.materials.map(m => [m.speciesId, m]));
    for (const i of alive) {
      const b = i * stride, material = materials.get(Math.trunc(view[b + slots.SPECIES_ID]));
      if (!material) continue;
      const temperature = view[b + slots.TEMPERATURE], phase = view[b + slots.PHASE_1];
      if (temperature >= material.boilPoint && phase < 2 && view[b + slots.ENERGY] >= (material.latentVaporization ?? 0) + (phase < 1 ? material.latentFusion ?? 0 : 0)) {
        const latent = (material.latentVaporization ?? 0) + (phase < 1 ? material.latentFusion ?? 0 : 0);
        view[b + slots.ENERGY] -= latent; view[b + slots.STORED_ENERGY] += latent; view[b + slots.PHASE_1] = 2; phaseChanges++;
        if (energyTransfers && latent > 0) energyTransfers.push({ source: 'thermal:particle:' + i, destination: 'phase:particle:' + i, amount: latent, cause: 'vaporization-latent-heat', metadata: { particleIndex: i, fromPhase: phase, toPhase: 2 } });
      } else if (temperature >= material.meltPoint && phase < 1 && view[b + slots.ENERGY] >= (material.latentFusion ?? 0)) {
        view[b + slots.ENERGY] -= material.latentFusion ?? 0; view[b + slots.STORED_ENERGY] += material.latentFusion ?? 0; view[b + slots.PHASE_1] = 1; phaseChanges++;
        if (energyTransfers && (material.latentFusion ?? 0) > 0) energyTransfers.push({ source: 'thermal:particle:' + i, destination: 'phase:particle:' + i, amount: material.latentFusion, cause: 'fusion-latent-heat', metadata: { particleIndex: i, fromPhase: phase, toPhase: 1 } });
      } else if (temperature < material.boilPoint && phase >= 2) {
        const released = Math.min(material.latentVaporization ?? 0, Math.max(0, view[b + slots.STORED_ENERGY]));
        view[b + slots.STORED_ENERGY] -= released; view[b + slots.ENERGY] += released;
        if (energyTransfers && released > 0) energyTransfers.push({ source: 'phase:particle:' + i, destination: 'thermal:particle:' + i, amount: released, cause: 'vaporization-latent-heat-release', metadata: { particleIndex: i, toPhase: 1 } });
        view[b + slots.PHASE_1] = 1; phaseChanges++;
      } else if (temperature < material.meltPoint && phase >= 1) {
        const released = Math.min(material.latentFusion ?? 0, Math.max(0, view[b + slots.STORED_ENERGY]));
        view[b + slots.STORED_ENERGY] -= released; view[b + slots.ENERGY] += released;
        if (energyTransfers && released > 0) energyTransfers.push({ source: 'phase:particle:' + i, destination: 'thermal:particle:' + i, amount: released, cause: 'fusion-latent-heat-release', metadata: { particleIndex: i, toPhase: 0 } });
        view[b + slots.PHASE_1] = 0; phaseChanges++;
      }
    }
  }

  // 9. Deterministic pair chemistry with per-pair progress and enthalpy exchange.
  if (cfg.chemistry?.enabled) {
    for (const p of pairs) {
      for (const r of cfg.chemistry.reactions) {
        const sa = Math.trunc(view[p.a + slots.SPECIES_ID]), sb = Math.trunc(view[p.b + slots.SPECIES_ID]);
        const forward = sa === r.speciesA && sb === r.speciesB;
        const reverse = sa === r.speciesB && sb === r.speciesA;
        if (!forward && !reverse) continue;
        const owner = p.a * stride;
        view[owner + slots.PHASE_2] += r.rate * dt;
        if (view[owner + slots.PHASE_2] < 1) continue;
        const energy = r.energy ?? 0;
        if (energy > 0 && view[p.a + slots.STORED_ENERGY] + view[p.b + slots.STORED_ENERGY] < energy) continue;
        if (energy < 0 && view[p.a + slots.ENERGY] + view[p.b + slots.ENERGY] < -energy) continue;
        view[p.a + slots.SPECIES_ID] = forward ? r.productA : r.productB;
        view[p.b + slots.SPECIES_ID] = forward ? r.productB : r.productA;
        // Exothermic reactions convert stored chemical energy to heat; endothermic
        // reactions store heat as chemical potential. The pair total is conserved.
        view[p.a + slots.ENERGY] += energy / 2; view[p.b + slots.ENERGY] += energy / 2;
        view[p.a + slots.STORED_ENERGY] -= energy / 2; view[p.b + slots.STORED_ENERGY] -= energy / 2;
        if (energyTransfers && energy !== 0) {
          const source = energy > 0 ? 'chemical:pair:' + p.i + ':' + p.j : 'thermal:pair:' + p.i + ':' + p.j;
          const destination = energy > 0 ? 'thermal:pair:' + p.i + ':' + p.j : 'chemical:pair:' + p.i + ':' + p.j;
          energyTransfers.push({ source, destination, amount: Math.abs(energy), cause: 'chemical-reaction-enthalpy', metadata: { particleA: p.i, particleB: p.j, reaction: [r.speciesA, r.speciesB, r.productA, r.productB] } });
        }
        view[owner + slots.PHASE_2] -= 1;
        reactions++;
        break;
      }
    }
  }

  // 10. Radioactive decay converts an explicitly configured mass defect to energy.
  if (cfg.nuclear?.enabled) {
    for (const i of alive) {
      const b = i * stride, species = Math.trunc(view[b + slots.SPECIES_ID]);
      const rule = cfg.nuclear.decays.find(d => d.speciesId === species);
      if (!rule) continue;
      view[b + slots.RADIATION_EXPOSURE] += rule.rate * dt;
      if (view[b + slots.RADIATION_EXPOSURE] < 1) continue;
      const dm = view[b + slots.MASS] * rule.massDefectFraction;
      view[b + slots.MASS] -= dm;
      view[b + slots.ENERGY] += dm * (rule.speedOfLightSquared ?? 1);
      if (energyTransfers && dm > 0) energyTransfers.push({ source: 'rest-mass:particle:' + i, destination: 'radiation:particle:' + i, amount: dm * (rule.speedOfLightSquared ?? 1), cause: 'radioactive-mass-defect', metadata: { particleIndex: i, massDefect: dm, speedOfLightSquared: rule.speedOfLightSquared ?? 1 } });
      view[b + slots.SPECIES_ID] = rule.productSpeciesId;
      view[b + slots.RADIATION_EXPOSURE] -= 1;
      decays++;
    }
  }

  // 11. Radiation pressure is an explicit external momentum source.
  if (cfg.radiation?.enabled) {
    const [rx, ry, rz] = cfg.radiation.direction, pressure = cfg.radiation.pressure;
    for (const i of alive) {
      const b = i * stride, mass = view[b + slots.MASS];
      if (mass <= 0) continue;
      acceleration[i * 3] += rx * pressure / mass;
      acceleration[i * 3 + 1] += ry * pressure / mass;
      acceleration[i * 3 + 2] += rz * pressure / mass;
    }
  }

  return Object.freeze({ pairs: pairs.length, thermalTransfers, reactions, decays, phaseChanges });
}
