# Gate 5 — social/ecological depth and user-facing fidelity

## Delivered in this slice: G5.1 relationship graph foundation

`src/state/sparseRelationshipGraph.js` adds a sparse, bounded graph outside the particle stride and physics hot loop. It supports stable endpoint IDs, canonical undirected pair identity, explicit directed edges, typed relationships, deterministic linear decay, bounded edge history, adjacency indexing, pruning, and schema-versioned snapshot/restore.

The graph is an additive semantic registry. It does not replace existing bond slots, lineage records, mating compatibility, group state, or solver behavior. Callers must supply stable IDs; transient particle-array indices are not valid identity substitutes.

Contract coverage includes canonical pair identity, directed-edge distinction, decay, capacity, history truncation, index cleanup, snapshot round-trip, invalid endpoints, and monotonic tick enforcement.

## Remaining Gate 5 integration

The following roadmap slices remain explicitly incomplete and must not be inferred from the graph foundation:

- **G5.2 kin recognition and care:** lineage-derived kin falloff, caregiving events, resource transfer, predation/competition/population-cap interactions.
- **G5.3 reproductive architectures:** explicit compatibility, mate choice, courtship, unary/binary/multi-parent/budding/fragmentation/colony modes, with baseline REPRO preserved.
- **G5.4 physical structures:** body/footprint state, field occupancy, material budget, collision boundaries, ownership, upkeep, damage, collapse and salvage.
- **G5.5 federation and polity lifecycle:** membership, jurisdiction, succession, dissolution, transfers, cultural transmission, split/merge and turnover.
- **G5.6 UI fidelity and accessibility:** live state transitions, keyboard and touch behavior, narrow viewports, reduced motion, and reference screenshots.

These are separate vertical slices because combining them without semantic and numeric evidence would create a large, unreviewable feature bundle. No product law, save schema, worker protocol, default solver or rendering path is changed by G5.1.

## Acceptance boundary

The graph is ready for integration consumers only when their stable-ID source is proven, persistence ownership is assigned, and lifecycle operations update edges consistently. Relationship effects must be applied in explicit scheduled phases, not from UI code or hidden per-pair allocations in the solver hot loop.
