# VEPA Law Relationship Architecture — Roadmap 1

## Scope

Roadmap 1 adds a descriptive, machine-readable relationship layer for the live VEPA law registry. It is intentionally metadata-only: the solver does not import or consume this ontology, so enabling it does not reorder, gate, or otherwise change simulation behavior.

The canonical registry remains `src/constants.js` (`LAW_INDEXES`, `LAW_CATEGORIES`, and related state indexes). Relationship records live in `src/state/lawOntology.js`; graph queries and exports live in `src/physics/lawGraph.js`.

## Ten-roadmap sequence

1. **Relationship ontology foundations** — vocabulary, registry validation, graph inspection/export.
2. **Physics/Mechanics boundary** — distinguish `COLL` from `CONTACT` and `MASS_INERTIA` from `INERTIA` while preserving behavior.
3. **State/resource accounting** — formalize energy, temperature, mass, signal, memory, bond, and entanglement budgets.
4. **Feedback and stability** — classify cycles, add bounded-loop diagnostics, and test runaway scenarios.
5. **Chemistry/thermal/electromagnetic coupling** — make transformation chains explicit and observable.
6. **Structure formation** — formalize `BOND → CONSTRAINT → TOPOLOGY` and material organization.
7. **Information/biology coupling** — trace memory, learning, culture, behavior, and inheritance.
8. **Quantum state machine** — separate observation, coherence, uncertainty, and wave/particle transitions.
9. **Emergent-chain integration tests** — exercise cross-category scenarios as system-level contracts.
10. **Developer tooling and UI** — expose relationship inspection and diagnostics in development tools.

Only Roadmap 1 is implemented by this change.

## Relationship vocabulary

Each law may declare any of the following fields:

- `dependsOn`: hard semantic prerequisites; references must name registered laws.
- `synergizesWith`: descriptive positive interaction; it never enables another law.
- `antagonizes`: descriptive opposition; it never automatically subtracts output.
- `reads` / `writes`: state identifiers used as inputs or directly modified values.
- `consumes` / `produces`: resource-flow annotations, distinct from ordinary reads/writes.
- `transforms`: human-readable state conversion expressions such as `ENERGY -> TEMPERATURE`.
- `feedback`: `POSITIVE`, `NEGATIVE`, or `MIXED` when a meaningful loop is known.
- `notes`: implementation or semantic qualification.

Records are keyed by law name rather than numeric index for reviewability. Every registered law receives a record; an empty record means that no relationship has been asserted yet, not that the law is unimplemented.

## Validation and inspection

`validateLawOntology()` checks relationship shape, feedback polarity, unknown law references, self-references, and duplicate edge references.

`validateLawGraph()` additionally checks:

- registry count and contiguous indexes;
- category membership for every index;
- state references against Stride, DNA, World, and explicitly reserved derived-state names.

The inspection API provides:

- `getLawRecord(nameOrIndex)`;
- `getIncomingRelationships(nameOrIndex, type)`;
- `inspectLaw(nameOrIndex)`.

The export API provides one shared graph model through:

- `exportLawGraph()`;
- `exportLawGraphJson()`;
- `exportLawGraphMermaid()`.

`findLawCycles()` reports cycles in the declared hard-dependency graph. Cycles are diagnostic results rather than validation failures. Roadmap 1 does not infer cycles from shared state or synergies.

## Initial semantic slice

The first declared records capture the highest-value relationships from the architecture review:

- contact, collision, momentum, inertia, bond, constraint, topology, and adhesion;
- catalysis, heat, cold, ionization, and discharge;
- memory, learning, feedback, observer, and navigation;
- genotype and phenotype;
- entanglement and teleportation.

The remaining laws are represented by empty records until their implementation is reviewed. This avoids fabricating semantics from names alone.

## Deferred overlap report

### `COLL` versus `CONTACT`

Roadmap 1 records the pair as synergistic and documents the intended boundary:

- `COLL`: impact/restitution response;
- `CONTACT`: geometric non-penetration/separation constraint.

The implementations are not changed here. Roadmap 2 must verify whether both effects are independently observable or whether the pair currently double-applies separation.

### `MASS_INERTIA` versus `INERTIA`

Both records remain active and are not merged. The ontology notes the current interpretation:

- `MASS_INERTIA`: legacy physics inertia proxy;
- `INERTIA`: Mechanics inertia proxy.

Roadmap 2 must determine whether the former is a distinct nonlinear/high-mass effect or a duplicate implementation before changing either law.

## Verification

The focused graph suite covers registry totality, relationship validation, category/state validation, incoming inspection, JSON/Mermaid consistency, and cycle reporting. The Roadmap 1 verification baseline is:

- 136 registered laws represented;
- 9 categories validated;
- 77 exported law-to-law edges in the initial slice;
- no validation errors;
- no declared hard-dependency cycles;
- full Vitest suite passing;
- syntax check and Vite production build passing.

## Non-goals

This roadmap does not add laws, modify solver order, change numerical constants, enforce dependencies at runtime, infer relationships automatically, or claim scientific equivalence. Those concerns belong to later roadmaps after the metadata has been reviewed against implementation behavior.
