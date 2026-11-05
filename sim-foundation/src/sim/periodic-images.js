/**
 * Deterministic finite periodic-image pair reference.
 *
 * This evaluates a symmetric cubic image shell, not an infinite lattice sum.
 * Shell-to-shell differences are empirical diagnostics, never rigorous error bounds.
 */
export const PERIODIC_IMAGE_SCHEMA = 'vepa.periodic-image-reference';
export const PERIODIC_IMAGE_VERSION = 1;

function finite(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(name + ' must be finite');
  return value;
}
function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new RangeError(name + ' must be positive');
  return value;
}
function compensated(values) {
  let sum = 0, correction = 0;
  for (const value of values) {
    const y = value - correction;
    const next = sum + y;
    correction = (next - sum) - y;
    sum = next;
  }
  return sum;
}

/** Evaluate one pair over every translation in [-shell,shell]^3. */
export function calculatePeriodicImagePair({
  first, second, boxSize, softening, shell = 0, strength,
} = {}) {
  if (!Array.isArray(first) || first.length !== 3 || !Array.isArray(second) || second.length !== 3) {
    throw new TypeError('first and second must be three-component position arrays');
  }
  first.forEach((v, i) => finite(v, 'first[' + i + ']'));
  second.forEach((v, i) => finite(v, 'second[' + i + ']'));
  positive(boxSize, 'boxSize');
  positive(softening, 'softening');
  finite(strength, 'strength');
  if (!Number.isInteger(shell) || shell < 0 || shell > 12) throw new RangeError('shell must be an integer from 0 to 12');
  const forceTerms = [[], [], []], potentialTerms = [], images = [];
  for (let ix = -shell; ix <= shell; ix++) {
    for (let iy = -shell; iy <= shell; iy++) {
      for (let iz = -shell; iz <= shell; iz++) {
        const displacement = [
          second[0] + ix * boxSize - first[0],
          second[1] + iy * boxSize - first[1],
          second[2] + iz * boxSize - first[2],
        ];
        const r2 = displacement[0] ** 2 + displacement[1] ** 2 + displacement[2] ** 2;
        const softened = Math.sqrt(r2 + softening ** 2);
        const coefficient = -strength / (softened ** 3);
        const force = displacement.map(v => coefficient * v);
        const potential = strength / softened;
        force.forEach((v, axis) => forceTerms[axis].push(v));
        potentialTerms.push(potential);
        images.push(Object.freeze({
          imageId: ix + ',' + iy + ',' + iz,
          offset: Object.freeze([ix, iy, iz]),
          displacement: Object.freeze(displacement),
          forceOnFirst: Object.freeze(force),
          potential,
        }));
      }
    }
  }
  return Object.freeze({
    schema: PERIODIC_IMAGE_SCHEMA, version: PERIODIC_IMAGE_VERSION,
    shell, imageCount: images.length,
    forceOnFirst: Object.freeze(forceTerms.map(compensated)),
    potential: compensated(potentialTerms),
    images: Object.freeze(images),
    convention: 'symmetric-cubic-finite-shell',
    identity: Object.freeze({ first: 'first', second: 'second', shell }),
    limitations: Object.freeze([
      'Finite symmetric image shell only; not an infinite periodic lattice solution',
      'Shell-to-shell differences are empirical convergence indicators, not rigorous error bounds',
      'Unneutralized periodic gravity and net-charge electrostatics require additional physical conventions',
      'Self-image terms are not included; this function evaluates distinct particles only',
    ]),
  });
}

/** Compare successive symmetric shells; reports observed change without certifying a bound. */
export function estimatePeriodicImageConvergence(options, { shells = [0, 1, 2] } = {}) {
  if (!Array.isArray(shells) || shells.length < 2 ||
      shells.some((s, i) => !Number.isInteger(s) || s < 0 || s > 12 || (i && s <= shells[i - 1]))) {
    throw new RangeError('shells must be a strictly increasing array of at least two supported integers');
  }
  const results = shells.map(shell => calculatePeriodicImagePair({ ...options, shell }));
  const comparisons = [];
  for (let i = 1; i < results.length; i++) {
    const previous = results[i - 1], current = results[i];
    comparisons.push(Object.freeze({
      fromShell: previous.shell, toShell: current.shell,
      forceDelta: Object.freeze(current.forceOnFirst.map((v, axis) => v - previous.forceOnFirst[axis])),
      forceDeltaMagnitude: Math.hypot(...current.forceOnFirst.map((v, axis) => v - previous.forceOnFirst[axis])),
      potentialDelta: current.potential - previous.potential,
      potentialAbsoluteDelta: Math.abs(current.potential - previous.potential),
    }));
  }
  return Object.freeze({
    schema: PERIODIC_IMAGE_SCHEMA, version: PERIODIC_IMAGE_VERSION,
    shells: Object.freeze(results),
    comparisons: Object.freeze(comparisons),
    convergedByObservedDelta: comparisons.every(c => c.forceDeltaMagnitude <= 1e-10 && c.potentialAbsoluteDelta <= 1e-10),
    errorBound: null,
    interpretation: 'Observed shell stability only; no mathematical truncation-error bound is asserted',
  });
}


/**
 * O(n^2) independent system reference. pairStrength receives the two particle
 * records and must return the signed potential coefficient for that pair.
 */
export function calculatePeriodicImageSystem({
  particles, boxSize, softening, shell = 0, pairStrength,
} = {}) {
  if (!Array.isArray(particles)) throw new TypeError('particles must be an array');
  if (typeof pairStrength !== 'function') throw new TypeError('pairStrength must be a function');
  const ids = new Set();
  for (const particle of particles) {
    if (!particle || typeof particle.id !== 'string' || !particle.id) throw new TypeError('each particle requires a stable non-empty id');
    if (ids.has(particle.id)) throw new TypeError('particle ids must be unique');
    ids.add(particle.id);
    if (!Array.isArray(particle.position) || particle.position.length !== 3) throw new TypeError('particle position must have three components');
  }
  const forceTerms = particles.map(() => [[], [], []]);
  const pairEvidence = [];
  let potential = 0, potentialCorrection = 0;
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    if (!a || typeof a.id !== 'string' || !a.id) throw new TypeError('each particle requires a stable non-empty id');
    if (!Array.isArray(a.position) || a.position.length !== 3) throw new TypeError('particle position must have three components');
    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j];
      const strength = finite(pairStrength(a, b), 'pair strength');
      const result = calculatePeriodicImagePair({
        first: a.position, second: b.position, boxSize, softening, shell, strength,
      });
      result.forceOnFirst.forEach((value, axis) => {
        forceTerms[i][axis].push(value);
        forceTerms[j][axis].push(-value);
      });
      const y = result.potential - potentialCorrection;
      const next = potential + y;
      potentialCorrection = (next - potential) - y;
      potential = next;
      pairEvidence.push(Object.freeze({
        pairId: a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id,
        entityA: a.id, entityB: b.id, shell,
        imageCount: result.imageCount,
        forceOnA: result.forceOnFirst,
        potential: result.potential,
      }));
    }
  }
  return Object.freeze({
    schema: PERIODIC_IMAGE_SCHEMA, version: PERIODIC_IMAGE_VERSION,
    convention: 'symmetric-cubic-finite-shell',
    shell, particleCount: particles.length, pairCount: pairEvidence.length,
    forces: Object.freeze(forceTerms.map((terms, index) => Object.freeze({
      entityId: particles[index].id,
      force: Object.freeze(terms.map(compensated)),
    }))),
    potential,
    pairEvidence: Object.freeze(pairEvidence),
    errorBound: null,
    limitations: Object.freeze([
      'Distinct-particle pairs only; self-image forces and energies are excluded',
      'Finite symmetric cubic image shell only; no infinite-lattice guarantee',
      'Shell differences are empirical and are not rigorous truncation-error bounds',
    ]),
  });
}
