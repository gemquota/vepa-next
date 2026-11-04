# Systems overview and implementation matrix

**Reviewed for VEPA4 9.1.15 on 2026-09-20.** Runtime breadth claims below are source-grounded; shared lifecycle records and reports are observation infrastructure, not proof that every named social system is a first-class entity.

## Executive matrix

| System | Runtime status | What the engine actually stores/does | Primary evidence | Boundary |
|---|---|---|---|---|
| Particle individual | Implemented | Flat stride state: position, velocity, mass, energy, age, health/death, memory, bonds, signals, group fields, and reserved synthetic fields. | `src/constants.js`, `src/state/particleBuffer.js` | No durable individual identity is guaranteed by the stride alone. |
| Mating / pair formation | Proxy / partial | Relationship compatibility, affinity, contact, bonds, reproduction gates, partner fields, and lineage events can form a pairing chain. | `src/physics/relationshipCompatibility.js`, `src/physics/relationshipState.js`, `src/physics/laws.js`, `src/engines/lineageTracker.js` | No explicit mate-selection registry, courtship state, pair exclusivity, or mating history object. |
| Reproduction | Implemented lifecycle proxy | REPRO can create offspring through energy/threshold/genetic conditions; DNA mutation/recombination and lineage birth records exist. | `src/physics/laws.js`, `src/dna/dnaBuffer.js`, `src/engines/lineageTracker.js` | Reproductive architectures are not separately represented as binary, budding, colony, or multi-parent entities. |
| Family / kinship | Missing as entity; inferable | Parent-child links and ancestor chains support a kinship graph. | `src/engines/lineageTracker.js` | No family object, household, caregiving, inheritance property, or kin-recognition policy. |
| Species | Implemented | Species IDs 0–63, species genomes, DNA cache, speciation splits, extinct-slot history, and population metrics. | `src/constants.js`, `src/dna/dnaBuffer.js`, `src/engines/speciation.js`, `src/engines/ecoEngine.js` | Species is primarily a genomic/population taxon, not a complete social identity. |
| Lineage | Implemented | Birth/death events, parent IDs, generation depth, species breakdown, ancestors, survival statistics. | `src/engines/lineageTracker.js` | Event records use bounded memory and do not yet encode relationship-specific causes/edges. |
| Group / colony | Implemented | Declared or emergent groups, membership, centroid, territory bounds, roles, age, stability, and dissolution. | `src/state/groupRegistry.js` | Group detection is density/affinity driven; it is not a general organism boundary solver. |
| Family group | Scaffold / inferable | Could be derived from lineage + persistent group membership + care/resource flow. | `lineageTracker`, `groupRegistry`, `memoryBuffers` | No first-class family semantics. |
| Pack / pride / hive / nest | Proxy | Group names, roles, nests/hives, and construction can describe these patterns. | `groupRegistry.js`, `construction.js` | Labels are names/interpretations; no specialized behavioral class per form. |
| Tribe | Scaffold / emergent interpretation | Multi-group affinity, shared memory, territory, alliance, and culture-like signals could support a tribe regime. | `groupRegistry.js`, `memoryBuffers.js`, `governance.js` | No federation-level entity or tribal identity. |
| Clan | Scaffold / emergent interpretation | Persistent kin-connected or culturally connected subgroup is measurable in principle. | lineage + memory + group registry | No clan relation, descent rule, or fission/fusion operation. |
| Nation / polity | Proxy / partial | Groups have policy vectors, alliances, conflicts, treasury, territory, and migration effects. | `src/state/governance.js`, `src/state/economy.js` | No multi-group sovereign container, citizenship, law code, or border ownership model. |
| Civilization | Proxy / partial | Group economy, artifacts, construction, infrastructure, mega-structures, governance, and eras create a bounded civilization analogue. | `economy.js`, `artifacts.js`, `construction.js`, `governance.js`, `infrastructure.js`, `epochEngine.js` | The code calls groups civilizations in comments, but does not implement a civilization entity or developmental stages. |
| Culture | Implemented as substrate / proxy | Signals, memory, learning, symbols, traces, and culture law provide transmission channels. | `src/state/memoryBuffers.js`, `src/physics/lawgroups/infoLaws.js`, `src/physics/solver.js` | No explicit cultural artifact, norm, meme, language community, or transmission lineage object. |
| Economy | Implemented bounded proxy | Treasury, extraction, income, trade, prices, craft cost, and trade log. | `src/state/economy.js`, `groupRegistry.js` | No agents, markets, currency semantics, production graph, or scarcity equilibrium beyond bounded rules. |
| Governance | Implemented bounded proxy | Policy vector, alliance/conflict decisions, raids, migration, threat feedback, cooldowns. | `src/state/governance.js` | No institutions, offices, voting, laws, legitimacy, succession, or enforcement graph. |
| Infrastructure | Implemented bounded proxy | Nests, roads, walls, bridges, hubs, energy grids, field writes, mega-project progress. | `construction.js`, `infrastructure.js`, `fields.js` | Structures are field effects, not durable inspectable objects with ownership/maintenance topology. |
| Social memory | Implemented | Species/group memory buffers with activity, cohesion, exploration, threat, adaptation, decay, and snapshots. | `src/state/memoryBuffers.js` | Memory is aggregate by species/group; individual recognition is not first-class. |
| Ecology / niches | Implemented analytics | Population curves, Shannon biodiversity, niches, food-web edges, oscillation score, speciation/extinction feed. | `src/engines/ecoEngine.js` | Food-web edges are inferred from mass and overlap, not confirmed predation histories. |
| Epoch / civilization time | Implemented | Era boundaries, snapshots, extinction/recovery thresholds, timeline records. | `src/engines/epochEngine.js`, `src/engines/timelineEngine.js` | No automatic cultural era taxonomy or causal civilizational transition model. |
| Synthetic society | Implemented bounded proxy | HUB-gated synthetic organisms, uploaded consciousness, machine flags, program traits, group participation. | `src/state/synthetic.js` | Digital persons and machine groups are registries, not a general social ontology. |
| Emergent relationship regime | Implemented laboratory layer | Deterministic templates, configuration batches, feature extraction, trajectory summaries, clustering. | `src/physics/relationshipExplorer.js` | Exploration does not itself run simulations or persist a relationship graph. |
| Cross-system lifecycle evidence | Implemented shared substrate | Stable system metadata, bounded records, causal events, emergence evidence, and deterministic reports for the 12 ranked systems. | `src/state/systemFoundation.js`, `src/state/systemLifecycle.js` | Shared records make observations comparable; they do not create family, nation, civilization, or other missing domain entities. |

## Interpretation rule

A system may be **implemented as infrastructure** while remaining a **proxy as an ontology**. The lifecycle substrate records evidence and causality consistently across systems, but only source modules listed in each row can establish domain truth.

## Reproduction and organization status

The strongest implemented chain is:

`particle state → compatibility/contact → relationship or threshold → energy/genome operation → offspring → lineage event → species/ecology metrics`.

The strongest implemented social chain is:

`particle cluster → group membership → roles/territory → treasury/trade → policy/alliance/conflict → construction/artifacts/infrastructure → epoch analytics`.

The missing bridge is a durable **organization graph** that can connect individuals, kin, groups, institutions, structures, resources, and cultural objects with typed edges. The current system has several specialized registries and aggregate buffers rather than one unified graph.
