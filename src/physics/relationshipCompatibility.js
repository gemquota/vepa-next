/**
 * VEPA4 relationship compatibility.
 *
 * Compatibility is intentionally a vector rather than a friendship scalar.
 * Each dimension is derived from both participants, and callers may choose the
 * dimension relevant to a mechanism while retaining the full diagnostic vector.
 * The relationship genome is a projection over existing DNA loci; it does not
 * widen the 42-value particle cache or change the 64-value species genome.
 */

import { DNA_INDEXES as D, STRIDE_INDEXES as S } from '../constants.js';

import { clamp01 } from '../core/numeric.js';

const similarity = (a, b, scale = 1) => clamp01(1 - Math.abs((a || 0) - (b || 0)) / Math.max(scale, 1e-6));
const average = (a, b) => ((Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0)) * 0.5;

function circularSimilarity(a, b, period = 360) {
  const delta = Math.abs((((a || 0) - (b || 0) + period * 0.5) % period) - period * 0.5);
  return clamp01(1 - delta / (period * 0.5));
}

/** Existing loci exposed as relationship-genome fields. */
export const RELATIONSHIP_GENOME_LOCI = Object.freeze({
  R01_ATTRACTION_RADIUS: 'NEIGHBORHOOD_RADIUS',
  R02_ATTRACTION_STRENGTH: 'FORCE',
  R03_REPULSION_STRENGTH: 'POLARITY',
  R04_CONTACT_SENSITIVITY: 'STIFFNESS',
  R05_ATTACHMENT_PROBABILITY: 'FUSION',
  R06_ATTACHMENT_STRENGTH: 'STIFFNESS',
  R07_PREFERRED_BOND_DISTANCE: 'BASE_RADIUS',
  R08_PREFERRED_BOND_ANGLE: 'BOND_ANGLE',
  R09_BOND_ELASTICITY: 'ELASTICITY',
  // ARMOR is a stride field, not DNA; STIFFNESS is the closest existing
  // genome-controlled break-resistance proxy until relationship loci get a
  // dedicated genome segment.
  R10_BOND_BREAK_THRESHOLD: 'STIFFNESS',
  R11_RESOURCE_EXTRACTION: 'PREDATION_BIAS',
  R12_RESOURCE_GENEROSITY: 'ENERGY_EFFICIENCY',
  R13_DAMAGE_TRANSFER: 'PREDATION_BIAS',
  R14_HEALING_TRANSFER: 'ENERGY_EFFICIENCY',
  R15_DNA_TRANSFER: 'GENE_FLOW',
  R16_MUTATION_PROPENSITY: 'MUTATION',
  R17_CAPTURE_TENDENCY: 'PREDATION_BIAS',
  R18_ESCAPE_TENDENCY: 'JITTER',
  R19_PARTNER_MEMORY: 'MEMORY_DECAY',
  R20_PARTNER_RECOGNITION: 'SIGNAL_RESP',
  R21_REPRODUCTIVE_COMPATIBILITY: 'SEX_CHANCE',
  R22_OFFSPRING_INVESTMENT: 'BIRTH_RATE',
  R23_FRAGMENTATION_TENDENCY: 'FUSION',
  R24_GROUP_AFFINITY: 'SPECIES_AFFINITY',
  R25_GROUP_COORDINATION: 'SIGNAL_RESP',
});

const LOCUS_TO_INDEX = Object.fromEntries(
  Object.entries(RELATIONSHIP_GENOME_LOCI).map(([key, dnaName]) => [key, D[dnaName]])
);

/**
 * Project a normalised/decoded DNA array into a named relationship genome.
 * `dna` may contain the particle cache (0..41) or a full decoded genome.
 */
export function projectRelationshipGenome(dna = []) {
  const genome = {};
  for (const [key, index] of Object.entries(LOCUS_TO_INDEX)) {
    genome[key] = Number.isFinite(dna[index]) ? dna[index] : 0;
  }
  return Object.freeze(genome);
}

function particleTraits(particle = {}) {
  const dna = particle.dna || [];
  return {
    speciesId: particle.speciesId,
    mass: particle.mass,
    energy: particle.energy,
    radius: particle.radius,
    stiffness: dna[D.STIFFNESS],
    elasticity: dna[D.ELASTICITY],
    symmetry: dna[D.SYMMETRY],
    bondAngle: dna[D.BOND_ANGLE],
    force: dna[D.FORCE],
    polarity: dna[D.POLARITY],
    energyEfficiency: dna[D.ENERGY_EFFICIENCY],
    conductivity: dna[D.CONDUCTIVITY],
    heatOutput: dna[D.HEAT_OUTPUT],
    signalResponse: dna[D.SIGNAL_RESP],
    memoryDecay: dna[D.MEMORY_DECAY],
    predationBias: dna[D.PREDATION_BIAS],
    speciesAffinity: dna[D.SPECIES_AFFINITY],
    birthRate: dna[D.BIRTH_RATE],
    sexChance: dna[D.SEX_CHANCE],
    geneFlow: dna[D.GENE_FLOW],
    dominance: dna[D.DOMINANCE],
    crossoverRate: dna[D.CROSSOVER_RATE],
  };
}

/**
 * Evaluate compatibility from both particles. No dimension is a replacement
 * for the others: mechanisms should select the dimension(s) they require.
 */
export function evaluateCompatibility(particleA, particleB, world = {}) {
  const a = particleTraits(particleA);
  const b = particleTraits(particleB);
  const sameSpecies = a.speciesId === b.speciesId;
  const speciesAffinity = clamp01(0.5 + average(a.speciesAffinity, b.speciesAffinity) * 0.5);
  const interaction = clamp01(Number.isFinite(world.SPECIES_INTERACTION) ? (world.SPECIES_INTERACTION + 2) / 4 : 0.5);

  const physical = clamp01(
    similarity(a.stiffness, b.stiffness, 5) * 0.45 +
    similarity(a.elasticity, b.elasticity, 1) * 0.25 +
    similarity(a.radius, b.radius, Math.max(a.radius || 1, b.radius || 1, 1)) * 0.2 +
    (sameSpecies ? 0.1 : 0),
  );
  const energetic = clamp01(
    similarity(a.energy, b.energy, 200) * 0.55 +
    similarity(a.energyEfficiency, b.energyEfficiency, 10) * 0.45,
  );
  const genetic = clamp01(
    speciesAffinity * 0.45 +
    similarity(a.dominance, b.dominance, 1) * 0.2 +
    similarity(a.crossoverRate, b.crossoverRate, 0.5) * 0.2 +
    similarity(a.geneFlow, b.geneFlow, 1) * 0.15,
  );
  const geometric = clamp01(
    similarity(a.symmetry, b.symmetry, 2) * 0.35 +
    circularSimilarity(a.bondAngle, b.bondAngle) * 0.35 +
    similarity(a.radius, b.radius, Math.max(a.radius || 1, b.radius || 1, 1)) * 0.3,
  );
  const resource = clamp01(
    similarity(a.energyEfficiency, b.energyEfficiency, 10) * 0.45 +
    similarity(a.conductivity, b.conductivity, 1) * 0.25 +
    similarity(a.heatOutput, b.heatOutput, 1) * 0.3,
  );
  const behavioral = clamp01(
    similarity(a.signalResponse, b.signalResponse, 2) * 0.35 +
    similarity(a.memoryDecay, b.memoryDecay, 0.1) * 0.25 +
    similarity(a.predationBias, b.predationBias, 20) * 0.2 +
    speciesAffinity * 0.2,
  );
  const reproductive = clamp01(
    speciesAffinity * 0.35 +
    similarity(a.sexChance, b.sexChance, 10) * 0.3 +
    similarity(a.birthRate, b.birthRate, 10) * 0.2 +
    genetic * 0.15,
  );

  const dimensions = Object.freeze({
    physical,
    energetic,
    genetic,
    geometric,
    resource,
    behavioral,
    reproductive,
  });
  // A geometric mean preserves incompatibility: one near-zero dimension
  // cannot be hidden by high scores elsewhere. World interaction scales only
  // cross-species relationships, never same-species compatibility.
  const weighted = Object.values(dimensions).reduce((product, value) => product * Math.max(value, 0.001), 1) ** (1 / 7);
  const overall = clamp01(weighted * (sameSpecies ? 1 : interaction));
  return Object.freeze({
    sameSpecies,
    speciesAffinity,
    interaction,
    dimensions,
    overall,
  });
}

/** Decode two particle rows directly without allocating DNA arrays. */
export function compatibilityForViews(view, iBase, jBase, world = {}) {
  const dnaA = new Array(42);
  const dnaB = new Array(42);
  for (let index = 0; index < 42; index++) {
    dnaA[index] = view[iBase + S.DNA_CACHE_START + index];
    dnaB[index] = view[jBase + S.DNA_CACHE_START + index];
  }
  return evaluateCompatibility({
    dna: dnaA,
    speciesId: view[iBase + S.SPECIES_ID],
    mass: view[iBase + S.MASS],
    energy: view[iBase + S.ENERGY],
    radius: view[iBase + S.RADIUS],
  }, {
    dna: dnaB,
    speciesId: view[jBase + S.SPECIES_ID],
    mass: view[jBase + S.MASS],
    energy: view[jBase + S.ENERGY],
    radius: view[jBase + S.RADIUS],
  }, world);
}

/** Return a mechanism-safe threshold check without collapsing the vector. */
export function meetsCompatibility(compatibility, requirements = {}) {
  if (!compatibility) return false;
  if (compatibility.overall < (requirements.overall ?? 0)) return false;
  for (const [dimension, threshold] of Object.entries(requirements)) {
    if (dimension === 'overall') continue;
    if ((compatibility.dimensions[dimension] ?? 0) < threshold) return false;
  }
  return true;
}

export { LOCUS_TO_INDEX };
