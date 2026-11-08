import { describe, expect, it } from 'vitest';
import {
  advanceRelationshipGraph,
  createSparseRelationshipGraph,
  getRelationships,
  pruneRelationshipGraph,
  restoreRelationshipGraph,
  snapshotRelationshipGraph,
  upsertRelationship,
} from '../../src/state/sparseRelationshipGraph.js';

describe('sparse relationship graph', () => {
  it('uses stable canonical pair identity for undirected relationships', () => {
    const graph = createSparseRelationshipGraph();
    const first = upsertRelationship(graph, { source: 'p-2', target: 'p-1', type: 'kin', tick: 1 });
    const second = upsertRelationship(graph, { source: 'p-1', target: 'p-2', type: 'kin', tick: 2, strength: 0.5 });
    expect(first.id).toBe(second.id);
    expect(getRelationships(graph, 'p-1')).toHaveLength(1);
    expect(getRelationships(graph, 'p-2')[0].strength).toBe(0.5);
  });

  it('keeps directed edges distinct and applies deterministic decay', () => {
    const graph = createSparseRelationshipGraph();
    upsertRelationship(graph, { source: 1, target: 2, type: 'care', directed: true, strength: 1, decay: 0.1 });
    upsertRelationship(graph, { source: 2, target: 1, type: 'care', directed: true, strength: 0.8, decay: 0.1 });
    expect(advanceRelationshipGraph(graph, 3)).toBe(2);
    expect(getRelationships(graph, 1).map((edge) => edge.strength)).toEqual([0.7, 0.5]);
  });

  it('bounds capacity and history, and prunes inactive edges from both indexes', () => {
    const graph = createSparseRelationshipGraph({ maxEdges: 1, maxHistory: 2 });
    upsertRelationship(graph, { source: 1, target: 2, type: 'bond', decay: 1 });
    upsertRelationship(graph, { source: 1, target: 2, type: 'bond', strength: 0.8 });
    upsertRelationship(graph, { source: 1, target: 2, type: 'bond', strength: 0.7 });
    expect(getRelationships(graph, 1)[0].history).toHaveLength(2);
    expect(() => upsertRelationship(graph, { source: 2, target: 3, type: 'bond' })).toThrow(/capacity/);
    advanceRelationshipGraph(graph, 2);
    expect(pruneRelationshipGraph(graph, { beforeTick: 3 })).toHaveLength(1);
    expect(getRelationships(graph, 1)).toHaveLength(0);
  });

  it('round-trips snapshots and rejects invalid endpoints or time reversal', () => {
    const graph = createSparseRelationshipGraph();
    upsertRelationship(graph, { source: 'a', target: 'b', type: 'family', tick: 4, metadata: { lineage: 2 } });
    const restored = restoreRelationshipGraph(snapshotRelationshipGraph(graph));
    expect(snapshotRelationshipGraph(restored)).toEqual(snapshotRelationshipGraph(graph));
    expect(() => upsertRelationship(graph, { source: 1, target: 1, type: 'bad' })).toThrow(/distinct/);
    expect(() => advanceRelationshipGraph(graph, 3)).toThrow(/backwards/);
  });
});
