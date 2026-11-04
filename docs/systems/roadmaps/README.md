# VEPA systems roadmap catalog

**Finalization status:** 48 roadmap variants complete for VEPA4 9.1.21; the fourth integration stagger is implemented.

Each system has four independent sequel variants:

- **A — Evidence-first:** strengthen current instrumentation and validation.
- **B — Relationship-graph-first:** add bounded typed relationships and topology.
- **C — Explicit-system-first:** promote validated projections into durable records.
- **D — Open-ended evolutionary:** discover regimes from experiments and trajectories.

Every file contains a finalization report, six phases, system emphasis, and expected outcome. Runtime integration is scheduled through `src/state/systemVariants.js` and `src/state/systemLifecycle.js` as A→B→C→D per system with 47 predecessor seams. The third stagger validates and materializes those seams as a deterministic connected dependency topology of 48 nodes and 47 edges. The fourth stagger adds bounded replay trajectories, deterministic evolutionary transitions, and regime summaries over that topology.

## Catalog

| System | A | B | C | D |
|---|---|---|---|---|
| Family / kinship | [A](family-kinship-A.md) | [B](family-kinship-B.md) | [C](family-kinship-C.md) | [D](family-kinship-D.md) |
| Group / tribe / clan | [A](group-tribe-clan-A.md) | [B](group-tribe-clan-B.md) | [C](group-tribe-clan-C.md) | [D](group-tribe-clan-D.md) |
| Mating / reproduction | [A](mating-reproduction-A.md) | [B](mating-reproduction-B.md) | [C](mating-reproduction-C.md) | [D](mating-reproduction-D.md) |
| Nation / polity | [A](nation-polity-A.md) | [B](nation-polity-B.md) | [C](nation-polity-C.md) | [D](nation-polity-D.md) |
| Civilization | [A](civilization-A.md) | [B](civilization-B.md) | [C](civilization-C.md) | [D](civilization-D.md) |
| Culture / memory | [A](culture-memory-A.md) | [B](culture-memory-B.md) | [C](culture-memory-C.md) | [D](culture-memory-D.md) |
| Relationship laboratory | [A](relationship-laboratory-A.md) | [B](relationship-laboratory-B.md) | [C](relationship-laboratory-C.md) | [D](relationship-laboratory-D.md) |
| Synthetic society | [A](synthetic-society-A.md) | [B](synthetic-society-B.md) | [C](synthetic-society-C.md) | [D](synthetic-society-D.md) |
| Ecology / niches | [A](ecology-A.md) | [B](ecology-B.md) | [C](ecology-C.md) | [D](ecology-D.md) |
| Economy / governance | [A](economy-governance-A.md) | [B](economy-governance-B.md) | [C](economy-governance-C.md) | [D](economy-governance-D.md) |
| Infrastructure | [A](infrastructure-A.md) | [B](infrastructure-B.md) | [C](infrastructure-C.md) | [D](infrastructure-D.md) |
| Species / lineage | [A](species-lineage-A.md) | [B](species-lineage-B.md) | [C](species-lineage-C.md) | [D](species-lineage-D.md) |

## Shared compatibility gates

1. Preserve particle stride and law-state contracts.
2. Keep projections additive and evidence-backed.
3. Use bounded records and deterministic identifiers.
4. Separate solver-critical state from analysis and Codex interpretation.
5. Require formation, update, break, serialization, and test behavior for persistent edges.
6. Do not promote an analytical label to a runtime entity without causal evidence.
