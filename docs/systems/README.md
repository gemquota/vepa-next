# VEPA systems atlas

**Scope:** source-grounded organization, reproduction, lineage, ecology, and civilization analysis for VEPA4 9.1.20. This atlas was reviewed against the current runtime on 2026-09-20; see [the assessment record](assessment-20260920.md).

This atlas answers two different questions without conflating them:

1. **What exists in the runtime?** A verified implementation inventory with source paths and boundaries.
2. **What can VEPA theorycraft next?** An ontology and experiment framework for systems that are not yet first-class runtime entities.

A name such as *family*, *tribe*, or *nation* is therefore not treated as proof that a corresponding class exists. The live engine currently has particles, species slots, lineage records, detected/declared groups, group roles, territory, economy, governance, infrastructure, artifacts, memory, analytics, epochs, and synthetic/machine layers. It does **not** currently maintain explicit family, mating, tribe, clan, nation, or civilization entity types; those are interpretation layers over existing primitives unless promoted by future work.

## Navigation

- [Systems overview](overview.md) — implementation status and source matrix.
- [Ontology map](ontology.md) — entity, relation, scale, and lifecycle vocabulary.
- [Comparison matrix](comparison-matrix.md) — cross-system dimensions and evidence.
- [Analysis framework](analysis-framework.md) — how to deconstruct, observe, enable, and theorycraft systems.
- [Meta-model](meta-model.md) — proposed layered architecture and invariants.
- [Role catalog](roles/README.md) — one durable analyst/designer role for each system.
- [Implementation gaps](implementation-gaps.md) — explicit partial/missing boundaries and suggested next slices.
- [Module decomposition](module-decomposition.md) — source-grounded extraction plan for future runtime modules.
- [Deployment publication](deployment-publication.md) — why the atlas is copied into the static build output.
- [Ranked roadmap](roadmap-overview.md) — synchronized multi-phase delivery order.
- [Complete concatenated systems atlas](complete-atlas.md) — one hierarchical, table-of-contents reference containing the current atlas, roles, and all 48 roadmap variants.
- [48-variant roadmap catalog](roadmaps/README.md) — four completed variants (A–D) for each of the twelve systems.
- `src/state/systemFoundation.js` — Phase 1 evidence-contract registry used by the runtime/tooling layer.
- `src/state/systemLifecycle.js` — shared Phase 2–5 records, causal events, emergence evidence, reports, and predecessor-gated variant application.
- `src/state/systemVariants.js` — the 48-variant registry and deterministic A→B→C→D integration schedule.
- The second stagger in `src/state/systemLifecycle.js` materializes all 47 adjacent seams as durable typed relationships.
- The third stagger validates and materializes those relationships as one deterministic 48-node dependency topology.
- The fourth stagger materializes bounded deterministic replay trajectories and evolutionary regime summaries over the completed topology.

## Evidence notation

| Mark | Meaning |
|---|---|
| **Implemented** | Live runtime state and update path exists; source is cited. |
| **Proxy** | Runtime behavior approximates the concept without an explicit ontology/entity. |
| **Observed** | Analytics can infer the pattern from metrics/events, but does not own it as state. |
| **Scaffolded** | This atlas defines a design contract only; no runtime claim. |
| **Missing** | No reliable live implementation was found in the reviewed source surface. |

## Assessment status

All 34 pre-existing Markdown files in this atlas were assessed against the runtime, version markers, roadmaps, and publication workflow. Five files required revision and their pre-update copies are preserved under `past/0/`; the remaining files were reviewed and retained unchanged because their claims remain accurate. The assessment is a review ledger, not a second source of truth.

## Deployment note

The repository source of truth remains `docs/systems/`. Vite emits the application into `dist/` and does not copy arbitrary repository documentation. The production build therefore runs `scripts/publish-system-atlas.mjs` after Vite finishes, publishing this atlas at `/docs/systems/` without coupling the simulation runtime to Markdown files.

## Review rule

The atlas is intentionally conservative. Future code should add a primitive or measurement before adding a label. A civilization should be *discoverable* from population, group, memory, economy, governance, infrastructure, and persistence signals before it is named as an emergent category.

## Runtime anchors

- Particle/lifecycle state: `src/constants.js`, `src/state/particleBuffer.js`, `src/physics/solver.js`.
- Genome and expression: `src/dna/dnaBuffer.js`, `src/constants.js`, `src/physics/laws.js`.
- Relationships: `src/physics/interactionSpace.js`, `src/physics/relationshipCompatibility.js`, `src/physics/relationshipState.js`.
- Lineage/species: `src/engines/lineageTracker.js`, `src/engines/speciation.js`.
- Groups/culture/social: `src/state/groupRegistry.js`, `src/state/memoryBuffers.js`, `src/state/governance.js`, `src/state/economy.js`.
- Built environment: `src/state/construction.js`, `src/state/artifacts.js`, `src/state/infrastructure.js`.
- Observation/deep time: `src/engines/ecoEngine.js`, `src/engines/insightEngine.js`, `src/engines/epochEngine.js`, `src/physics/relationshipExplorer.js`.
- Synthetic layer: `src/state/synthetic.js`.
