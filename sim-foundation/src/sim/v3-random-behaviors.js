/**
 * Deterministic draw contracts for the 34 random draws audited in the pinned
 * V3 worker. These helpers own draw identity and ordering, not the simulation
 * mutations or feature probabilities. Call a method only when its legacy law
 * gate is active; this preserves the source rule that disabled features consume
 * no draws.
 */
function requireStreams(streams) {
  if (!streams || typeof streams.get !== 'function') throw new TypeError('streams must expose get(domain, entityId)');
}
function requireId(value, label) {
  if (!(typeof value === 'string' && value.length) &&
      !(Number.isSafeInteger(value) && value >= 0)) throw new TypeError(label + ' must be a non-empty string or non-negative safe integer');
  return value;
}
function vector3(stream) { return Object.freeze([stream.next(), stream.next(), stream.next()]); }
function pairId(a, b) {
  requireId(a, 'first particle ID'); requireId(b, 'second particle ID');
  const left = JSON.stringify([typeof a, a]), right = JSON.stringify([typeof b, b]);
  return left < right ? JSON.stringify([a, b]) : JSON.stringify([b, a]);
}

/**
 * Exposes source-ordered random draws by semantic domain. Pair-scoped draws
 * use a canonical unordered pair key so reverse traversal shares the same
 * stream. Pair effect ownership remains the caller's responsibility.
 */
export function createV3RandomBehaviorStreams({ streams, worldId }) {
  requireStreams(streams);
  requireId(worldId, 'worldId');
  const draw = (domain, entityId) => streams.get(domain, entityId);
  return Object.freeze({
    senescenceDeath(particleId) {
      return draw('biology.death', requireId(particleId, 'particleId')).next();
    },
    genotypeDrift(particleId) {
      const r = draw('biology.genetic-drift', requireId(particleId, 'particleId'));
      return Object.freeze({ gate: r.next(), traitIndex: Math.floor(r.next() * 42), delta: r.next() });
    },
    isomerization(particleId) {
      const r = draw('chemistry.isomerization', requireId(particleId, 'particleId'));
      return Object.freeze({ gate: r.next(), speciesIndex: Math.floor(r.next() * 12) });
    },
    reproductionGate() {
      return draw('biology.spawn-gate', worldId).next();
    },
    childInitialization(childId) {
      const r = draw('biology.spawn-init', requireId(childId, 'childId'));
      return Object.freeze({
        position: vector3(r),
        velocity: vector3(r),
        speciesIndex: Math.floor(r.next() * 12),
      });
    },
    heatJitter(particleId) { return vector3(draw('thermal.heat', requireId(particleId, 'particleId'))); },
    meltJitter(particleId) { return vector3(draw('thermal.melt', requireId(particleId, 'particleId'))); },
    boilJitter(particleId) { return vector3(draw('thermal.boil', requireId(particleId, 'particleId'))); },
    intrinsicJitter(particleId) { return vector3(draw('physics.intrinsic-jitter', requireId(particleId, 'particleId'))); },
    chaosGate(particleId) {
      const r = draw('chaos.perturbation', requireId(particleId, 'particleId'));
      const gate = r.next();
      let vectorConsumed = false;
      return Object.freeze({
        gate,
        vector() {
          if (vectorConsumed) throw new Error('chaos vector draws have already been consumed');
          vectorConsumed = true;
          return vector3(r);
        },
      });
    },
    allotropy(pairA, pairB) {
      return draw('chemistry.allotropy', pairId(pairA, pairB)).next();
    },
    phaseThrough(pairA, pairB) {
      return draw('dimensional.phase-through', pairId(pairA, pairB)).next();
    },
    exothermicHeat(pairA, pairB) {
      const r = draw('chemistry.exothermic-heat', pairId(pairA, pairB));
      return Object.freeze([r.next(), r.next()]);
    },
  });
}
