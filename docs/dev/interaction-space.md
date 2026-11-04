# VEPA interaction space

VEPA treats a named mechanism as a recipe, not as an indivisible physics primitive. Every recipe is described by the dimensions that change: trigger, participants, direction, relationship, geometry, constraints, material flow, information flow, identity, persistence, failure, and outcome.

The executable behavior remains in the solver and law-group functions. The inspectable registry is `src/physics/interactionSpace.js`; it deliberately does not replace or duplicate the hot path.

## Joining and transformation matrix

| Mechanism | Trigger / participants | Relation and geometry | Material / information | Identity and lifecycle | Runtime evidence |
|---|---|---|---|---|---|
| CONTACT | overlap or collision / binary | independent; overlapping or touching | none | unchanged; instantaneous | solver contact phase + `applyContactCorrection` |
| ADHESION | proximity or touching / binary | temporary coupling; edge-to-edge attraction | none | unchanged; contact-duration | `applyAdhesion` |
| BOND | contact / binary | persistent bilateral coupling; elastic edge link | none | unchanged; breakable | `applyBond` and bond slots |
| ACCR | proximity, sustained contact, momentum/dwell / binary | rigid-ish bilateral seam; edge-to-edge | no mass merge | composite of separate particles; conditional seam | `adjoinParticles` + `ACCR_LINK_MASK` maintenance |
| POLYMER | proximity, compatibility, topology / n-body | elastic links; chain/branch topology | no mass merge | composite of separate particles; valence-limited | `applyPolymer` + bond slots |
| CRYSTALLIZATION | compatibility, temperature, threshold / n-body | lattice/cluster attachment | composite material and state coupling | composite structure; conditionally stable | `applyCrystallization` |
| ALLOY | overlap/contact and compatibility / binary | fused/coincident | pooled mass/energy; DNA and colour blend | one survivor (`A+B→C`); absorbed body dies | `mergeParticles` / `applyAlloy` |
| CONSTRAINT | existing link/topology / binary | constrained preferred distance | none | unchanged; conditional | `applyConstraint` only acts on linked pairs |
| PREDATION | proximity/collision, hunger / binary | directed hierarchy; free geometry | prey mass/energy transfer and DNA absorption | prey weakened or destroyed; conditional | `applyPredation` |
| SINGULARITY | field and horizon threshold / unary + neighbors | directed capture; coincident at horizon | mass absorption and energy conversion | captured body dies; conditional | `applySingularityAbsorb` |
| SYMBIOSIS | proximity and compatibility / binary | mutual coupling; physically separate | bidirectional energy transfer | both identities remain; contact-duration | `applySymbiosis` |
| PARASITE | proximity and compatibility / binary | directed host relationship | one-way energy extraction | both identities remain; conditional | `applyParasite` |
| ENTANGLEMENT | state/history / binary | physically independent shared state | correlated phase/state | unchanged; decoherence-conditional | `applyEntanglePair` / `applyEntanglement` |
| REPRODUCTION | compatibility/contact/threshold / binary or unary | temporary composite or cluster | energy/mass redistribution; recombination and mutation | parents plus offspring; timed lifecycle | `applyReproduction` and lineage payload |

## Four implementation levels

1. **Physics primitives:** position, velocity, overlap, impulse, mass, energy, fields, and distance.
2. **Relationship primitives:** attract, repel, touch, attach, constrain, couple, exchange, transfer, synchronize, capture, and release.
3. **Transformation primitives:** damage, grow, split, merge, fragment, copy, mutate, recombine, consume, create, and destroy.
4. **Named mechanisms:** ACCR, BOND, POLYMER, ALLOY, PREDATION, REPRODUCTION, and the other law recipes above.

This separation prevents a new named mechanism from silently inventing a second fusion path. In particular:

- **ACCR is a persistent structural relationship.** It registers a bilateral seam, maintains edge-to-edge placement, preserves separate masses and identities, and uses `ACCR_LINK_MASK` to distinguish rigid seams from ordinary flexible links.
- **BOND and POLYMER are not fusion.** Their bond slots keep bodies separate; `CONSTRAINT` can act only after a link exists.
- **ALLOY is the explicit one-body transformation.** `mergeParticles` performs centre-of-mass placement, momentum-weighted velocity, pooled mass/energy, blended colour, optional DNA blending, and marks the absorbed body dead.
- **PREDATION, PARASITE, and SYMBIOSIS are material/biological flows.** They do not become structural attachments merely because they exchange energy or mass.
- **ENTANGLEMENT is information/state coupling.** It does not imply physical contact or a bond.
- **REPRODUCTION is a lifecycle chain, not a single join:** eligibility → drive/threshold → energy cost → genetic construction → offspring creation → lineage recording.

## Runtime compatibility and relationship state

The solver now evaluates a multidimensional compatibility vector lazily for pairwise relationship laws. Physical and geometric compatibility gate new BOND, POLYMER, ACCR, and CRYSTALLIZATION links; physical and energetic compatibility gate ALLOY; resource and behavioural compatibility modulate SYMBIOSIS and PARASITE; behavioural/resource eligibility gates PREDATION. Existing ACCR seams remain exempt from new-formation gates and are maintained from their bilateral `ACCR_LINK_MASK` topology.

`src/physics/relationshipCompatibility.js` projects relationship-genome tendencies from the existing DNA loci without widening the 42-value particle cache. `src/physics/relationshipState.js` supplies an allocation-friendly semantic record for relationship age, stress, integrity, flows, affinity, stability, and break/repair transitions; it is intentionally outside the solver’s Float32 hot path until a graph buffer is introduced.

The registry is metadata and an audit surface. It is not a promise that every named effect is a physically complete model; the implementation references identify the bounded simulation proxy currently used by VEPA.

## Active relationship-space exploration

`src/physics/relationshipExplorer.js` provides a deterministic laboratory layer above the runtime solver. It does not add a second physics path. A caller supplies generated configurations to a simulation run, records the resulting trajectory, then uses the explorer to compare and cluster regimes.

### Experiment pipeline

| Stage | Explorer API | Purpose |
|---|---|---|
| Seed | `RELATIONSHIP_MECHANISM_TEMPLATES` | Keep BOND, PREDATION, SYMBIOSIS, PARASITE, and REPRODUCTION as recognizable starting recipes. |
| Perturb | `createExplorationBatch()` | Enumerate or seeded-sample attachment, resource transfer, memory, directionality, persistence, and genetic-transfer dimensions. |
| Measure | `extractOutcomeFeatures()` | Normalize attachment duration, force, material/energy transfer, health effect, genetic transfer, topology change, reciprocity, and persistence. |
| Summarize | `summarizeTrajectory()` | Reduce one trajectory to a feature vector and transition count. |
| Discover | `clusterOutcomeFeatures()` | Group measured trajectories into stable empirical regimes without assigning biological names. |

The explorer deliberately separates **what VEPA permits** from **what an experiment discovers**. A cluster may later be interpreted as cooperative, parasitic, predatory, or reproductive by an observer/Codex layer, but those labels are not required by the physics substrate. Configuration generation is reproducible through `SplitMix32` seeds and bounded by `maxConfigurations`, making thousands of experiments practical without unbounded memory growth.
