import { PARTICLE_SLOTS as S, PARTICLE_STRIDE } from './particle-layout.js';
import { createV3RandomBehaviorStreams } from './v3-random-behaviors.js';

const finite = (value, name, min = -Infinity) => {
  if (!Number.isFinite(value) || value < min) throw new RangeError(name + ' must be finite and >= ' + min);
  return value;
};
const enabled = (config, name) => config.features?.[name] === true;
const clamp01 = value => Math.max(0, Math.min(1, value));

/**
 * Applies an explicit, deterministic subset of the pinned V3 worker's
 * stochastic behavior mutations to the Next 100-slot particle layout.
 *
 * Every feature is opt-in and parameterized. No V3 DNA offsets, thresholds,
 * or probabilities are guessed: callers supply normalized parameters and
 * enable only features whose law gates are active. The function mutates the
 * supplied state in-place and returns an immutable audit summary.
 */
export function applyV3BehaviorKernel({
  state, count, stride = PARTICLE_STRIDE, dt, worldId = 'world',
  identities, streams, config = {}, pairs = [],
}) {
  if (!ArrayBuffer.isView(state) || state instanceof DataView ||
      !Number.isInteger(count) || count < 0 || !Number.isInteger(stride) ||
      stride < 100 || state.length !== count * stride) {
    throw new TypeError('state must match count * Next particle stride');
  }
  finite(dt, 'dt', 0);
  if (dt === 0) throw new RangeError('dt must be > 0');
  if (!identities || typeof identities.get !== 'function' ||
      typeof identities.allocate !== 'function' || typeof identities.release !== 'function') {
    throw new TypeError('identities must expose get, allocate and release');
  }
  if (!streams || typeof streams.get !== 'function') throw new TypeError('streams must expose get');
  if (!Array.isArray(pairs)) throw new TypeError('pairs must be an array');
  const random = createV3RandomBehaviorStreams({ streams, worldId });
  const p = config.parameters ?? {};
  const summary = Object.create(null);
  const record = name => { summary[name] = (summary[name] ?? 0) + 1; };
  const live = [];
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (state[b + S.DEAD] < 0.5 && state[b + S.MASS] > 0) live.push(i);
  }

  // 1. Senescence death.
  if (enabled(config, 'senescence')) {
    const rate = finite(p.senescenceRate ?? 0, 'senescenceRate', 0);
    for (const i of live) {
      const b = i * stride, identity = identities.get(i);
      if (identity && state[b + S.AGE] >= finite(p.senescenceAge ?? Number.MAX_VALUE, 'senescenceAge') &&
          random.senescenceDeath(identity.id) < clamp01(rate * dt)) {
        state[b + S.DEAD] = 1; state[b + S.MASS] = 0; identities.release(identity); record('senescence');
      }
    }
  }

  // 2. Genotype drift (trait storage is the 42-slot DNA cache).
  if (enabled(config, 'genotypeDrift')) {
    const rate = finite(p.genotypeDriftRate ?? 0, 'genotypeDriftRate', 0);
    const amplitude = finite(p.genotypeDriftAmplitude ?? 0, 'genotypeDriftAmplitude', 0);
    for (const i of live) {
      const b = i * stride, id = identities.get(i);
      if (!id || state[b + S.DEAD] >= 0.5) continue;
      const draw = random.genotypeDrift(id.id);
      if (draw.gate < clamp01(rate * dt)) {
        const slot = S.DNA_CACHE_START + draw.traitIndex;
        state[b + slot] += (draw.delta * 2 - 1) * amplitude;
        record('genotypeDrift');
      }
    }
  }

  // 3. Isomerization.
  if (enabled(config, 'isomerization')) {
    const rate = finite(p.isomerizationRate ?? 0, 'isomerizationRate', 0);
    for (const i of live) {
      const b = i * stride, id = identities.get(i);
      if (!id || state[b + S.DEAD] >= 0.5) continue;
      const draw = random.isomerization(id.id);
      if (draw.gate < clamp01(rate * dt)) {
        state[b + S.SPECIES_ID] = draw.speciesIndex;
        record('isomerization');
      }
    }
  }

  // 4. Reproduction gate and 5. child initialization.
  if (enabled(config, 'reproduction')) {
    const rate = finite(p.spawnRate ?? 0, 'spawnRate', 0);
    const capacity = Math.min(count - live.length, Math.ceil(rate * dt));
    if (capacity > 0 && random.reproductionGate() < clamp01(rate * 0.01 * dt)) {
      const dead = [];
      for (let i = 0; i < count; i++) {
        const b = i * stride;
        if (state[b + S.DEAD] >= 0.5 || state[b + S.MASS] <= 0) dead.push(i);
      }
      const amount = Math.min(capacity, dead.length);
      for (let n = 0; n < amount; n++) {
        const slot = dead.pop();
        const identity = identities.allocate(slot);
        const draw = random.childInitialization(identity.id);
        const b = slot * stride;
        state.fill(0, b, b + stride);
        state[b + S.POS_X] = (draw.position[0] - 0.5) * finite(p.worldWidth ?? 2000, 'worldWidth', 0);
        state[b + S.POS_Y] = (draw.position[1] - 0.5) * finite(p.worldHeight ?? 2000, 'worldHeight', 0);
        state[b + S.POS_Z] = (draw.position[2] - 0.5) * finite(p.worldDepth ?? 2000, 'worldDepth', 0);
        state[b + S.VEL_X] = (draw.velocity[0] - 0.5) * 2;
        state[b + S.VEL_Y] = (draw.velocity[1] - 0.5) * 2;
        state[b + S.VEL_Z] = (draw.velocity[2] - 0.5) * 2;
        state[b + S.MASS] = finite(p.childMass ?? 1, 'childMass', Number.MIN_VALUE);
        state[b + S.SPECIES_ID] = draw.speciesIndex;
        state[b + S.ENERGY] = finite(p.childEnergy ?? 100, 'childEnergy', 0);
        state[b + S.AGE] = 0; state[b + S.DEAD] = 0;
        record('reproduction');
      }
    }
  }

  // Per-particle stochastic thermal and intrinsic behavior.
  for (const i of live) {
    const b = i * stride, id = identities.get(i);
    if (!id || state[b + S.DEAD] >= 0.5) continue;
    state[b + S.AGE] += dt;
    // 6. Heat jitter.
    if (enabled(config, 'heat')) {
      const scale = finite(p.heatJitter ?? 0, 'heatJitter', 0), v = random.heatJitter(id.id);
      state[b + S.VEL_X] += (v[0] - 0.5) * scale;
      state[b + S.VEL_Y] += (v[1] - 0.5) * scale;
      state[b + S.VEL_Z] += (v[2] - 0.5) * scale; record('heat');
    }
    // 7. Cold damping.
    if (enabled(config, 'cold')) {
      const damping = finite(p.coldDamping ?? 0.95, 'coldDamping', 0);
      if (damping > 1) throw new RangeError('coldDamping must be <= 1');
      for (const slot of [S.VEL_X, S.VEL_Y, S.VEL_Z]) state[b + slot] *= damping;
      record('cold');
    }
    // 8. Radiation mass loss.
    if (enabled(config, 'radiation')) {
      state[b + S.MASS] = Math.max(0, state[b + S.MASS] - finite(p.radiationRate ?? 0, 'radiationRate', 0) * dt);
      record('radiation');
    }
    // 9. Sublimation.
    if (enabled(config, 'sublimation') && finite(p.entropy ?? 0, 'entropy') + state[b + S.DNA_CACHE_START + 1] > finite(p.sublimationThreshold ?? 2, 'sublimationThreshold')) {
      state[b + S.MASS] = Math.max(0, state[b + S.MASS] - finite(p.sublimationMassRate ?? 0, 'sublimationMassRate', 0) * dt);
      state[b + S.ENERGY] += finite(p.sublimationEnergyRate ?? 0, 'sublimationEnergyRate', 0) * dt;
      record('sublimation');
    }
    // 10. Melt jitter.
    if (enabled(config, 'melt')) {
      const scale = state[b + S.ENERGY] / 100 * finite(p.meltScale ?? 0, 'meltScale', 0);
      const v = random.meltJitter(id.id);
      state[b + S.VEL_X] += (v[0] - 0.5) * scale;
      state[b + S.VEL_Y] += (v[1] - 0.5) * scale;
      state[b + S.VEL_Z] += (v[2] - 0.5) * scale; record('melt');
    }
    // 11. Boil jitter and mass loss.
    if (enabled(config, 'boil') && state[b + S.ENERGY] > finite(p.boilEnergyThreshold ?? 80, 'boilEnergyThreshold')) {
      const v = random.boilJitter(id.id), scale = finite(p.boilJitter ?? 2, 'boilJitter', 0);
      state[b + S.VEL_X] += (v[0] - 0.5) * scale;
      state[b + S.VEL_Y] += (v[1] - 0.5) * scale;
      state[b + S.VEL_Z] += (v[2] - 0.5) * scale;
      state[b + S.MASS] = Math.max(0, state[b + S.MASS] - finite(p.boilMassRate ?? 0, 'boilMassRate', 0) * dt);
      record('boil');
    }
    // 12. Convection.
    if (enabled(config, 'convection')) {
      state[b + S.VEL_Y] -= finite(p.heatOutput ?? 0.1, 'heatOutput') * finite(p.convectionScale ?? 0.1, 'convectionScale') * dt;
      record('convection');
    }
    // 13. Intrinsic jitter.
    if (enabled(config, 'intrinsicJitter')) {
      const scale = (finite(p.entropy ?? 0, 'entropy') + finite(p.intrinsicJitter ?? 0, 'intrinsicJitter')) * 0.5;
      const v = random.intrinsicJitter(id.id);
      state[b + S.VEL_X] += (v[0] - 0.5) * scale;
      state[b + S.VEL_Y] += (v[1] - 0.5) * scale;
      state[b + S.VEL_Z] += (v[2] - 0.5) * scale; record('intrinsicJitter');
    }
    // 14. Chaos gate and lazy perturbation.
    if (enabled(config, 'chaos')) {
      const chaos = random.chaosGate(id.id);
      if (chaos.gate < finite(p.chaosProbability ?? 0.01, 'chaosProbability', 0)) {
        const v = chaos.vector(), scale = finite(p.chaosScale ?? 5, 'chaosScale', 0);
        state[b + S.VEL_X] += (v[0] - 0.5) * scale;
        state[b + S.VEL_Y] += (v[1] - 0.5) * scale;
        state[b + S.VEL_Z] += (v[2] - 0.5) * scale; record('chaos');
      }
    }
    if (state[b + S.MASS] <= 0) {
      state[b + S.MASS] = 0; state[b + S.DEAD] = 1;
      identities.release(id); record('retired');
    }
  }

  // 15. Pair chemistry: allotropy, phase-through and exothermic transfer
  // share one explicitly supplied canonical pair list from the caller.
  for (const pair of pairs) {
    if (!pair || !Number.isInteger(pair.a) || !Number.isInteger(pair.b) ||
        pair.a < 0 || pair.b < 0 || pair.a >= count || pair.b >= count || pair.a === pair.b) {
      throw new TypeError('each pair must contain distinct in-range particle indices a and b');
    }
    const a = pair.a * stride, b = pair.b * stride;
    const idA = identities.get(pair.a), idB = identities.get(pair.b);
    if (!idA || !idB || state[a + S.DEAD] >= 0.5 || state[b + S.DEAD] >= 0.5) continue;
    const owner = idA.id < idB.id ? a : b;
    if (enabled(config, 'allotropy') && pair.distance < finite(p.allotropyRadius ?? 10, 'allotropyRadius', 0) &&
        random.allotropy(idA.id, idB.id) < clamp01(finite(p.allotropyRate ?? 0.01, 'allotropyRate', 0) * dt)) {
      state[owner + S.SPECIES_ID] = (state[owner + S.SPECIES_ID] + 1) % 12; record('allotropy');
    }
    let phaseThrough = false;
    if (enabled(config, 'phaseThrough')) {
      phaseThrough = random.phaseThrough(idA.id, idB.id) < clamp01(finite(pair.symmetry ?? p.symmetry ?? 0.5, 'symmetry') * 0.5);
      if (phaseThrough) record('phaseThrough');
    }
    if (enabled(config, 'exothermicHeat') && pair.distance < finite(p.exothermicRadius ?? 25, 'exothermicRadius', 0) && !phaseThrough) {
      const heat = finite(pair.heatOutput ?? p.heatOutput ?? 0.1, 'heatOutput') * finite(p.exothermicScale ?? 0.05, 'exothermicScale');
      const v = random.exothermicHeat(idA.id, idB.id);
      state[owner + S.VEL_X] += (v[0] - 0.5) * heat;
      state[owner + S.VEL_Y] += (v[1] - 0.5) * heat; record('exothermicHeat');
    }
  }
  let liveCount = 0;
  for (let i = 0; i < count; i++) {
    const b = i * stride;
    if (state[b + S.DEAD] < 0.5 && state[b + S.MASS] > 0) liveCount++;
  }
  return Object.freeze({ applied: Object.freeze({ ...summary }), liveCount });
}
