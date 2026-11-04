# Module decomposition proposal

This proposal separates **appropriate runtime modules** from concepts that should remain analytical projections until they have durable state, lifecycle rules, and tests. It is intentionally incremental: extract cohesive responsibilities first, then promote a concept to a first-class entity only when the simulation needs to persist and mutate it.

## Existing boundaries that should remain separate

| Concern | Current module(s) | Keep separate because |
|---|---|---|
| Particle storage and stride access | `src/state/particleBuffer.js`, `src/constants.js` | Flat-buffer layout is a concurrency and memory contract. |
| Laws and pairwise physics | `src/physics/solver.js`, `src/physics/laws.js`, `src/physics/lawgroups/` | Law dispatch, stateless law behavior, and integration have different test and performance constraints. |
| Relationship eligibility/state | `src/physics/relationshipCompatibility.js`, `src/physics/relationshipState.js` | Compatibility is derived; relationship state is persistent and indexed. |
| Species genome/expression | `src/dna/dnaBuffer.js`, `src/dna/expression.js` | Genome storage and phenotype expression have different mutation and caching semantics. |
| Population history | `src/engines/lineageTracker.js`, `src/engines/speciation.js` | Lineage events and species partitioning answer different questions. |
| Group organization | `src/state/groupRegistry.js` | Membership, roles, territory, stability, and dissolution form one coherent aggregate boundary. |
| Economy/governance | `src/state/economy.js`, `src/state/governance.js` | Resource accounting and policy decisions should not share mutable state. |
| Built environment | `src/state/construction.js`, `src/state/infrastructure.js`, `src/state/artifacts.js` | Construction progress, network infrastructure, and portable artifacts have distinct lifecycles. |
| Observation and interpretation | `src/engines/ecoEngine.js`, `src/engines/insightEngine.js`, `src/physics/relationshipExplorer.js` | Metrics, pattern detection, and controlled experiments should not mutate the physics substrate. |

## Recommended next modules

### 1. Relationship observation pipeline

**Proposed files:**

- `src/engines/relationshipRecorder.js` — sparse formation, transfer, stress, break, and closure events.
- `src/engines/relationshipFeatures.js` — derive duration, reciprocity, asymmetry, flow, damage, topology, and persistence vectors.
- `src/engines/relationshipRegimes.js` — cluster vectors and assign evidence-based interpretations.

**Reason:** `relationshipState.js` owns state mechanics, while the explorer owns experiments. A recorder/features/regimes split would prevent analytics from entering the solver hot path.

### 2. Lineage and kinship projection

**Proposed files:**

- `src/engines/kinshipGraph.js` — parent/ancestor/descendant edges and generation queries.
- `src/engines/familyProjection.js` — infer persistent kin groups from lineage, membership, care, and resource flow.

**Reason:** family is currently inferable from lineage and groups, not a runtime entity. These modules can provide read-only projections without prematurely changing particle storage.

### 3. Organization hierarchy

**Proposed files:**

- `src/state/organizationRegistry.js` — generic multi-scale organization records.
- `src/state/organizationRelations.js` — affiliation, alliance, subordination, federation, fission, and fusion edges.
- `src/engines/organizationDetection.js` — derive family/group/tribe/polity/civilization hypotheses from evidence.

**Reason:** tribe, clan, nation, and civilization share structural dimensions but should not be four duplicated registries. A typed organization record can carry scale and evidence while preserving distinct projections.

### 4. Cultural transmission

**Proposed files:**

- `src/state/culturalTraits.js` — explicit symbols, norms, practices, and trait metadata.
- `src/engines/culturalTransmission.js` — vertical, horizontal, and oblique transmission.
- `src/engines/culturalSelection.js` — retention, mutation, prestige, and environmental selection.

**Reason:** memory buffers and information laws provide substrate, but they do not yet persist a cultural trait as a transferable object.

### 5. Reproductive strategy layer

**Proposed files:**

- `src/engines/reproductiveStrategies.js` — binary, self, budding, fragmentation, parasitic, and collective strategy projections.
- `src/engines/reproductionLedger.js` — investment, parent contribution, offspring outcome, and strategy history.

**Reason:** `REPRO` currently provides a lifecycle path. These modules would separate the primitive creation event from the analysis of mating architecture and parental investment.

### 6. Economy and polity projections

**Proposed files:**

- `src/state/resourceLedger.js` — normalized production, consumption, transfer, and scarcity events.
- `src/engines/marketDynamics.js` — prices, trade networks, and production dependencies.
- `src/engines/polityProjection.js` — sovereignty, citizenship, borders, institutions, legitimacy, and enforcement evidence.

**Reason:** existing economy and governance are useful bounded proxies. Ledger/event extraction should precede adding more rules to those modules.

## Invariants for any extraction

1. New modules must not write directly into the particle buffer unless they own an explicitly documented stride field.
2. Solver-critical modules must remain allocation-free in the pairwise hot path.
3. Projections must be deterministic under the supplied seed and replayable from events.
4. A named category must include evidence thresholds and a confidence/status field.
5. Every new persistent edge needs formation, update, break, serialization, and test behavior.
6. Family, tribe, clan, nation, and civilization should initially be views over generic organization relations, not parallel copies of `groupRegistry`.
7. Analytics and Codex interpretation must consume observations rather than alter physical outcomes.

## Suggested delivery order

1. Relationship recorder and feature extraction.
2. Kinship graph and reproductive ledger.
3. Generic organization registry and hierarchy projection.
4. Cultural trait/transmission records.
5. Economy/polity event ledgers.
6. UI/Codex views over the resulting evidence graph.

This order preserves the current runtime while creating the data needed for richer organization to emerge rather than be declared by labels.
