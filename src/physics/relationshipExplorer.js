/**
 * VEPA4 relationship-space laboratory utilities.
 *
 * This module does not run the physics solver or invent new runtime laws. It
 * creates reproducible experiment configurations, exposes named mechanism
 * templates as presets, and clusters measured outcomes after a caller runs
 * those configurations through the simulation.
 */

import { getInteractionPreset } from './interactionSpace.js';
import { SplitMix32 } from '../core/prng.js';
import { clamp01, finite, deepFreeze as freeze } from '../core/numeric.js';

export const RELATIONSHIP_EXPLORATION_AXES = Object.freeze([
  'attachment',
  'resourceTransfer',
  'memory',
  'directionality',
  'persistence',
  'geneticTransfer',
]);

export const DEFAULT_EXPLORATION_VALUES = freeze({
  attachment: [0, 0.5, 1],
  resourceTransfer: [-1, 0, 1],
  memory: [0, 0.5, 1],
  directionality: [-1, 0, 1],
  persistence: [0, 0.5, 1],
  geneticTransfer: [0, 0.5, 1],
});

const TEMPLATE_DEFINITIONS = [
  ['BOND', {
    attachment: 1, resourceTransfer: 0, memory: 0.5, directionality: 0,
    persistence: 0.75, geneticTransfer: 0,
  }],
  ['PREDATION', {
    attachment: 0, resourceTransfer: -1, memory: 0.25, directionality: 1,
    persistence: 0.25, geneticTransfer: 0,
  }],
  ['SYMBIOSIS', {
    attachment: 0.5, resourceTransfer: 1, memory: 0.5, directionality: 0,
    persistence: 0.75, geneticTransfer: 0.25,
  }],
  ['PARASITE', {
    attachment: 0.5, resourceTransfer: -1, memory: 0.75, directionality: 1,
    persistence: 0.75, geneticTransfer: 0,
  }],
  ['REPRODUCTION', {
    attachment: 0.5, resourceTransfer: 0.5, memory: 0.25, directionality: 0,
    persistence: 0.5, geneticTransfer: 1,
  }],
];

export const RELATIONSHIP_MECHANISM_TEMPLATES = freeze(
  Object.fromEntries(TEMPLATE_DEFINITIONS.map(([name, dimensions]) => {
    const preset = getInteractionPreset(name);
    return [name, {
      name,
      preset: preset?.name || name,
      lawKeys: preset?.lawKeys || [],
      dimensions,
      semantics: preset?.semantics || {},
    }];
  })),
);

function valuesForAxis(axis, values) {
  const supplied = values?.[axis];
  const result = Array.isArray(supplied) && supplied.length > 0
    ? supplied
    : DEFAULT_EXPLORATION_VALUES[axis];
  return result.map(finite);
}

function cartesianAxes(axes, values, index = 0, current = {}, output = []) {
  if (index >= axes.length) {
    output.push({ ...current });
    return output;
  }
  const axis = axes[index];
  for (const value of valuesForAxis(axis, values)) {
    current[axis] = value;
    cartesianAxes(axes, values, index + 1, current, output);
  }
  delete current[axis];
  return output;
}

/**
 * Create a deterministic experiment batch. If the Cartesian product exceeds
 * maxConfigurations, seeded sampling keeps the batch bounded and repeatable.
 */
export function createExplorationBatch({
  axes = RELATIONSHIP_EXPLORATION_AXES,
  values = DEFAULT_EXPLORATION_VALUES,
  maxConfigurations = 1000,
  seed = 1,
  template,
} = {}) {
  const selectedAxes = [...new Set(axes)].filter((axis) => RELATIONSHIP_EXPLORATION_AXES.includes(axis));
  if (selectedAxes.length === 0) return [];
  const limit = Math.max(1, Math.floor(maxConfigurations));
  const configurations = cartesianAxes(selectedAxes, values);
  const templateDimensions = template
    ? (RELATIONSHIP_MECHANISM_TEMPLATES[template]?.dimensions || {})
    : {};
  if (configurations.length <= limit) {
    return configurations.map((dimensions, index) => Object.freeze({
      id: `${seed}:${index}`,
      seed,
      template: template || null,
      dimensions: Object.freeze({ ...templateDimensions, ...dimensions }),
    }));
  }

  const random = new SplitMix32(seed);
  const chosen = [];
  const seen = new Set();
  while (chosen.length < limit) {
    const index = random.nextInt(0, configurations.length - 1);
    if (seen.has(index)) continue;
    seen.add(index);
    chosen.push(configurations[index]);
  }
  return chosen.map((dimensions, index) => Object.freeze({
    id: `${seed}:${index}`,
    seed,
    template: template || null,
    dimensions: Object.freeze({ ...templateDimensions, ...dimensions }),
  }));
}

export const OUTCOME_FEATURES = Object.freeze([
  'attachmentDuration',
  'meanForce',
  'massTransfer',
  'energyTransfer',
  'healthEffect',
  'geneticTransfer',
  'topologyChange',
  'reciprocity',
  'persistence',
]);

/** Convert a measured trajectory/outcome record into a clusterable vector. */
export function extractOutcomeFeatures(outcome = {}) {
  return OUTCOME_FEATURES.map((feature) => {
    const value = finite(outcome[feature]);
    if (feature === 'healthEffect' || feature === 'reciprocity') return Math.max(-1, Math.min(1, value));
    return clamp01(value);
  });
}

export function summarizeTrajectory(trajectory = []) {
  const vectors = trajectory.map(extractOutcomeFeatures);
  if (vectors.length === 0) {
    return { samples: 0, vector: new Array(OUTCOME_FEATURES.length).fill(0), transitions: 0 };
  }
  const vector = vectors[0].map((_, index) => vectors.reduce((sum, row) => sum + row[index], 0) / vectors.length);
  let transitions = 0;
  for (let index = 1; index < vectors.length; index++) {
    if (vectors[index].some((value, dimension) => Math.abs(value - vectors[index - 1][dimension]) > 0.25)) transitions++;
  }
  return { samples: vectors.length, vector, transitions };
}

function distance(a, b) {
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0) / Math.max(1, a.length));
}

/**
 * Deterministic online clustering for measured experiment outcomes. This is
 * intentionally small and dependency-free; richer analysis can replace it
 * without changing the experiment record format.
 */
export function clusterOutcomeFeatures(records = [], { threshold = 0.2, maxClusters = 32 } = {}) {
  const clusters = [];
  const assignments = [];
  for (const record of records) {
    const vector = record.vector ? record.vector.map(finite) : extractOutcomeFeatures(record);
    let best = -1;
    let bestDistance = Infinity;
    for (let index = 0; index < clusters.length; index++) {
      const candidateDistance = distance(vector, clusters[index].centroid);
      if (candidateDistance < bestDistance) {
        best = index;
        bestDistance = candidateDistance;
      }
    }
    if (best < 0 || (bestDistance > threshold && clusters.length < maxClusters)) {
      best = clusters.length;
      clusters.push({ id: `regime-${best + 1}`, count: 0, centroid: [...vector], members: [] });
    }
    const cluster = clusters[best];
    cluster.count++;
    cluster.members.push(record.id ?? assignments.length);
    for (let dimension = 0; dimension < vector.length; dimension++) {
      cluster.centroid[dimension] += (vector[dimension] - cluster.centroid[dimension]) / cluster.count;
    }
    assignments.push(best);
  }
  return { features: [...OUTCOME_FEATURES], clusters, assignments };
}
