import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXPLORATION_VALUES,
  OUTCOME_FEATURES,
  RELATIONSHIP_MECHANISM_TEMPLATES,
  clusterOutcomeFeatures,
  createExplorationBatch,
  extractOutcomeFeatures,
  summarizeTrajectory,
} from '../../src/physics/relationshipExplorer.js';

describe('relationship-space explorer', () => {
  it('exposes named mechanism templates without replacing interaction presets', () => {
    expect(RELATIONSHIP_MECHANISM_TEMPLATES.BOND.dimensions.attachment).toBe(1);
    expect(RELATIONSHIP_MECHANISM_TEMPLATES.PREDATION.dimensions.directionality).toBe(1);
    expect(RELATIONSHIP_MECHANISM_TEMPLATES.REPRODUCTION.dimensions.geneticTransfer).toBe(1);
    expect(Object.isFrozen(RELATIONSHIP_MECHANISM_TEMPLATES)).toBe(true);
  });

  it('creates a bounded deterministic Cartesian experiment batch', () => {
    const values = { ...DEFAULT_EXPLORATION_VALUES, attachment: [0, 1], memory: [0, 1] };
    const first = createExplorationBatch({ axes: ['attachment', 'memory'], values, seed: 42 });
    const second = createExplorationBatch({ axes: ['attachment', 'memory'], values, seed: 42 });
    expect(first).toHaveLength(4);
    expect(first).toEqual(second);
    expect(first[0].dimensions).toEqual({ attachment: 0, memory: 0 });
  });

  it('uses seeded sampling when the configuration space exceeds the limit', () => {
    const first = createExplorationBatch({ maxConfigurations: 7, seed: 9 });
    const second = createExplorationBatch({ maxConfigurations: 7, seed: 9 });
    expect(first).toHaveLength(7);
    expect(first).toEqual(second);
    expect(new Set(first.map((config) => JSON.stringify(config.dimensions))).size).toBe(7);
  });

  it('extracts trajectory features and detects stable outcome regimes', () => {
    const featureVector = extractOutcomeFeatures({ attachmentDuration: 2, healthEffect: -2, reciprocity: 0.8 });
    expect(featureVector).toHaveLength(OUTCOME_FEATURES.length);
    expect(featureVector[4]).toBe(-1);
    const summary = summarizeTrajectory([
      { attachmentDuration: 1, reciprocity: 1 },
      { attachmentDuration: 1.1, reciprocity: 0.9 },
    ]);
    expect(summary.samples).toBe(2);
    const regimes = clusterOutcomeFeatures([
      { id: 'cooperative-a', vector: [1, 0, 0, 1, 0, 0, 0.8, 1, 1] },
      { id: 'cooperative-b', vector: [0.95, 0, 0, 0.95, 0, 0, 0.8, 0.9, 1] },
      { id: 'predatory', vector: [0, 0.1, 1, 0.8, -1, 0, 0, -1, 0.2] },
    ]);
    expect(regimes.clusters).toHaveLength(2);
    expect(regimes.assignments).toEqual([0, 0, 1]);
    expect(regimes.clusters[0].members).toEqual(['cooperative-a', 'cooperative-b']);
  });
});
