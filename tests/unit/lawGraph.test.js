import { describe, it, expect } from 'vitest';
import { LAW_COUNT, LAW_INDEXES } from '../../src/constants.js';
import {
  LAW_RELATIONSHIPS,
  LAW_RELATIONSHIP_TYPES,
  getLawRelationships,
  validateLawOntology,
} from '../../src/state/lawOntology.js';
import {
  exportLawGraph,
  exportLawGraphJson,
  exportLawGraphMermaid,
  findLawCycles,
  getIncomingRelationships,
  inspectLaw,
  validateLawGraph,
} from '../../src/physics/lawGraph.js';

describe('law relationship ontology', () => {
  it('represents every registered law without inventing missing relationships', () => {
    expect(Object.keys(LAW_RELATIONSHIPS)).toHaveLength(LAW_COUNT);
    expect(validateLawOntology()).toEqual([]);
    expect(getLawRelationships('DRAG')).toEqual({});
    expect(getLawRelationships('GRAV').synergizesWith).toContain('PLANETARY');
    expect(getLawRelationships('TELEPORT').dependsOn).toEqual(['ENTANGLEMENT']);
  });

  it('validates the registry, categories, relationships, and canonical state references', () => {
    expect(validateLawGraph()).toEqual([]);
  });

  it('supports incoming inspection for dependency and synergy queries', () => {
    const teleport = inspectLaw('TELEPORT');
    expect(teleport.id).toBe(LAW_INDEXES.TELEPORT);
    expect(teleport.relationships.dependsOn).toEqual(['ENTANGLEMENT']);
    expect(getIncomingRelationships('MEMORY', 'dependsOn')).toEqual(['LEARN', 'FEEDBACK', 'NAVIGATION', 'OBSERVER']);
  });

  it('exports JSON and Mermaid from the same graph data', () => {
    const graph = exportLawGraph();
    expect(graph.lawCount).toBe(LAW_COUNT);
    expect(graph.laws).toHaveLength(LAW_COUNT);
    for (const type of LAW_RELATIONSHIP_TYPES) {
      if (type !== 'notes') expect(Array.isArray(graph.relationships[type])).toBe(true);
    }
    expect(JSON.parse(exportLawGraphJson()).laws).toHaveLength(LAW_COUNT);
    expect(exportLawGraphMermaid()).toContain('TELEPORT --> ENTANGLEMENT');
  });

  it('reports dependency cycles without treating them as validation failures', () => {
    expect(findLawCycles()).toEqual([]);
    expect(validateLawGraph()).toEqual([]);
  });
});
