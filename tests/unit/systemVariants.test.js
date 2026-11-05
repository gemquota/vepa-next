import { describe, expect, it } from 'vitest';
import {
  createStaggeredImplementationPlan,
  getStaggeredIntegrationEdges,
  getSystemVariantReport,
  VARIANT_ORDER,
} from '../../src/state/systemVariants.js';
import {
  applyNextStaggeredRelationship,
  applyNextStaggeredVariant,
  closeStaggeredRelationship,
  computeStaggeredTopology,
  getStaggeredRelationshipReport,
  materializeStaggeredTopology,
  materializeStaggeredEvolution,
  computeStaggeredEvolution,
  getStaggeredEvolutionReport,
  applyStaggeredVariant,
  integrateStaggeredSeam,
  createSystemLifecycle,
  getStaggeredProgress,
  restoreSystemLifecycle,
  serializeSystemLifecycle,
} from '../../src/state/systemLifecycle.js';

describe('staggered system variants', () => {
  it('registers exactly four variants for each of twelve systems', () => {
    const report = getSystemVariantReport();
    expect(report).toHaveLength(48);
    for (let index = 0; index < 12; index += 1) {
      expect(report.slice(index * 4, index * 4 + 4).map((variant) => variant.variant)).toEqual(VARIANT_ORDER);
    }
  });

  it('alternates A-D and inserts an integration seam between every step', () => {
    const plan = createStaggeredImplementationPlan();
    expect(plan).toHaveLength(48);
    expect(plan.slice(0, 4).map((step) => step.variant)).toEqual(['A', 'B', 'C', 'D']);
    expect(plan[0].integrationBefore).toBeNull();
    expect(plan.slice(1).every((step) => step.integrationBefore?.to === step.variantId)).toBe(true);
    expect(getStaggeredIntegrationEdges()).toHaveLength(47);
  });

  it('enforces predecessor integration while applying the schedule', () => {
    const lifecycle = createSystemLifecycle();
    expect(() => applyStaggeredVariant(lifecycle, 'family-kinship-B')).toThrow('requires integration');
    for (let index = 0; index < 48; index += 1) applyNextStaggeredVariant(lifecycle);
    expect(getStaggeredProgress(lifecycle)).toEqual({
      completed: 48,
      total: 48,
      next: null,
      integrations: 47,
      relationshipIntegrations: 0,
      topology: 'ready',
      evolution: 'ready',
    });
    expect(() => integrateStaggeredSeam(lifecycle, 'family-kinship-A', 'family-kinship-B')).not.toThrow();
    for (let index = 1; index < 47; index += 1) applyNextStaggeredRelationship(lifecycle);
    expect(getStaggeredProgress(lifecycle).relationshipIntegrations).toBe(47);
    expect(computeStaggeredTopology(lifecycle)).toMatchObject({
      nodeCount: 48,
      edgeCount: 47,
      dependencyEdgeCount: 47,
      dependencyOrder: expect.arrayContaining(['family-kinship-A', 'species-lineage-D']),
      dependencyViolations: [],
      deterministic: true,
      components: [expect.any(Array)],
    });
    expect(materializeStaggeredTopology(lifecycle).status).toBe('complete');
    expect(getStaggeredProgress(lifecycle).topology).toBe('complete');
    expect(getStaggeredProgress(lifecycle).evolution).toBe('ready');
    const evolution = materializeStaggeredEvolution(lifecycle, { seed: 7, horizon: 8 });
    expect(evolution).toMatchObject({
      status: 'complete',
      deterministic: true,
      nodeCount: 48,
      transitionCount: 47,
      horizon: 8,
    });
    expect(evolution.trajectory).toHaveLength(8);
    expect(evolution.regimes).toHaveLength(3);
    expect(getStaggeredProgress(lifecycle).evolution).toBe('complete');
    expect(getStaggeredEvolutionReport(lifecycle)).toEqual(evolution);
    expect(computeStaggeredEvolution(lifecycle, { seed: 7, horizon: 8 })).toMatchObject({
      nodes: evolution.nodes,
      transitions: evolution.transitions,
      trajectory: evolution.trajectory,
    });
    expect(getStaggeredProgress(lifecycle).completed).toBe(48);
    const relationship = getStaggeredRelationshipReport(lifecycle)[0];
    expect(closeStaggeredRelationship(lifecycle, relationship.id, 'replaced').status).toBe('closed');
    expect(getStaggeredRelationshipReport(lifecycle)[0].attributes.closeReason).toBe('replaced');
    const snapshot = serializeSystemLifecycle(lifecycle);
    const restored = restoreSystemLifecycle(snapshot);
    expect(getStaggeredProgress(restored)).toEqual(getStaggeredProgress(lifecycle));
    expect(restored.topology).toMatchObject({
      status: 'complete',
      nodeCount: 48,
      edgeCount: 47,
      dependencyEdgeCount: 47,
      deterministic: true,
    });
    expect(restored.evolution).toMatchObject({ status: 'complete', nodeCount: 48, transitionCount: 47 });
    expect(computeStaggeredTopology(restored)).toEqual(computeStaggeredTopology(lifecycle));
    expect(getStaggeredEvolutionReport(restored)).toEqual(getStaggeredEvolutionReport(lifecycle));
  });
});
