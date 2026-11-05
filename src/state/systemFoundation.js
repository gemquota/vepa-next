/**
 * VEPA4 — System foundation registry.
 *
 * Phase 1 is intentionally non-destructive: it gives each documented system a
 * stable identifier, breadth rank, evidence status, source anchors, and a
 * compatibility contract before new mutable ontology is introduced.
 */

const SYSTEMS = [
  // Evidence levels: 'implemented' (runtime + focused tests), 'proxy' (runtime
  // and tested, but an explicit approximation of the named concept), 'scaffold'
  // (identity and evidence contract only), 'substrate' (shared support layer).
  // family-kinship, group-tribe-clan, nation-polity, culture-memory and
  // civilization gained real runtime entities in src/state/civilization.js on
  // 2026-09-30; they are 'proxy', not 'implemented', because the cultural
  // fidelity model is an explicit accounting rather than a measurement.
  ['family-kinship', 1, 'proxy', ['src/engines/lineageTracker.js', 'src/state/groupRegistry.js', 'src/state/civilization.js']],
  ['group-tribe-clan', 2, 'proxy', ['src/state/groupRegistry.js', 'src/state/memoryBuffers.js', 'src/state/civilization.js']],
  ['mating-reproduction', 3, 'proxy', ['src/physics/relationshipCompatibility.js', 'src/physics/laws.js', 'src/engines/lineageTracker.js']],
  ['nation-polity', 4, 'proxy', ['src/state/governance.js', 'src/state/economy.js', 'src/state/civilization.js']],
  ['civilization', 5, 'proxy', ['src/state/construction.js', 'src/state/infrastructure.js', 'src/state/economy.js', 'src/engines/epochEngine.js', 'src/state/civilization.js']],
  ['culture-memory', 6, 'proxy', ['src/state/memoryBuffers.js', 'src/physics/lawgroups/infoLaws.js', 'src/state/civilization.js']],
  ['relationship-laboratory', 7, 'implemented', ['src/physics/relationshipExplorer.js', 'src/physics/relationshipState.js']],
  ['synthetic-society', 8, 'proxy', ['src/state/synthetic.js', 'src/state/groupRegistry.js']],
  ['ecology', 9, 'implemented', ['src/engines/ecoEngine.js', 'src/engines/worldEvents.js']],
  ['economy-governance', 10, 'proxy', ['src/state/economy.js', 'src/state/governance.js']],
  ['infrastructure', 11, 'proxy', ['src/state/construction.js', 'src/state/infrastructure.js', 'src/state/artifacts.js']],
  ['species-lineage', 12, 'implemented', ['src/dna/dnaBuffer.js', 'src/engines/speciation.js', 'src/engines/lineageTracker.js']],
];

const PHASE_ONE_CONTRACT = Object.freeze({
  status: 'complete',
  name: 'evidence contract',
  guarantees: Object.freeze([
    'stable system identifier',
    'explicit implementation evidence status',
    'source anchor inventory',
    'read-only observation boundary',
    'no new particle-stride fields',
  ]),
});

export const SYSTEM_FOUNDATION = Object.freeze(
  Object.fromEntries(SYSTEMS.map(([id, breadthRank, evidence, sourceAnchors]) => [id, Object.freeze({
    id,
    breadthRank,
    evidence,
    sourceAnchors: Object.freeze([...sourceAnchors]),
    phaseOne: PHASE_ONE_CONTRACT,
  })])),
);

export const SYSTEM_FOUNDATION_ORDER = Object.freeze(
  SYSTEMS.map(([id]) => id),
);

export function getSystemFoundation(systemId) {
  return SYSTEM_FOUNDATION[systemId] || null;
}

export function getSystemFoundationReport() {
  return SYSTEM_FOUNDATION_ORDER.map((id) => ({
    ...SYSTEM_FOUNDATION[id],
    sourceAnchors: [...SYSTEM_FOUNDATION[id].sourceAnchors],
    phaseOne: {
      ...SYSTEM_FOUNDATION[id].phaseOne,
      guarantees: [...SYSTEM_FOUNDATION[id].phaseOne.guarantees],
    },
  }));
}
