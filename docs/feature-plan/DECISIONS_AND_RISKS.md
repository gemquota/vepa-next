# VEPA Decisions and Risks

This document consolidates recurring constraints from the GUIDE, PLAN, and RRP intent records. It records design direction, not proof that the corresponding mechanism is fully implemented.

## Architectural decisions

| ID | Decision | Rationale | Required verification |
|---|---|---|---|
| ADR-FP-01 | One authoritative field-mutation API | Avoid divergent write paths and make field effects inspectable/reversible | Search all writes; test caps, determinism, and undo behaviour |
| ADR-FP-02 | One event/metrics ownership path | Avoid competing aggregate state and inconsistent event detection | Trace metric production, event confirmation, journal, and consumers |
| ADR-FP-03 | Deterministic random decisions | Support reproducible seeds, replay, and debugging | Inventory RNG calls; test same seed/config/state yields matching outcomes |
| ADR-FP-04 | Explicit lifecycle invariants | Parallel particle buffers, species slots, groups, and shards must stay aligned | Test spawn/death/speciation/import/reset and save/load |
| ADR-FP-05 | Autonomous changes are bounded and inspectable | Prevent runaway agents/events and unexplained state changes | Rate limits, checkpoint/journal tests, action caps |
| ADR-FP-06 | Reuse existing law slots unless a law-budget change is approved | Later RRP designs state that the 128-law budget is full | Verify actual bitmask/law count; require a migration decision before widening |
| ADR-FP-07 | Measure performance by subsystem | Solver, worker overhead, rendering, multiplex, and memory costs differ | Repeatable benchmarks with environment, population, settings, and units |
| ADR-FP-08 | Separate design intent from implementation status | Plans and changelogs can become stale | Every verified claim links to current source and test evidence |
| ADR-FP-09 | Treat scientific language carefully | Exotic, quantum, relativistic, and awareness concepts are simulation mechanics, not validated physical theories or real sentience | UI and docs label approximations, assumptions, and diegetic effects |

## Cross-cutting risks

| Risk | Failure mode | Mitigation / acceptance check |
|---|---|---|
| State-buffer drift | Particle death/spawn/speciation leaves parallel arrays misaligned | Central lifecycle operations; assertions and randomized lifecycle tests |
| Non-determinism | Unseeded randomness, timing-dependent workers, or unordered updates break replay | Explicit RNG ownership; fixed tick boundaries; golden-run comparisons |
| Field-write runaway | Walls, roads, events, or exotic zones fill the grid or overwrite each other | Write budgets, per-tick caps, priority/ownership semantics, stress tests |
| Event storms | Threshold oscillation repeatedly triggers events and mutations | Detection/confirmation split, hysteresis, cooldown, journal review |
| Undo/snapshot growth | Full-world snapshots exhaust memory | Explicit retention limits, size estimates, eviction policy, recovery tests |
| Performance collapse | Pairwise work, dense fields, or multiplex shards overwhelm the solver | Spatial gather limits, allocation-free hot paths, benchmarks across density levels |
| Economy exploits | Trade, extraction, crafting, or shared power creates unbounded resources | Accounting invariants, upkeep, transaction logs, caps |
| Exotic-state cascades | Annihilation, conversion, supernovae, or shard exchange trigger chain reactions | Rate caps, cooldowns, conservation checks, bounded interaction radius |
| Time/relativity instability | Scaled timestep or dilation freezes or destabilizes simulation | Clamp ranges, stable solver envelope, extreme-value tests |
| Save/rebirth corruption | Partial state restoration silently loses lineage, epochs, or RNG state | Versioned schema, validation before mutation, rollback on failure |
| UI misrepresentation | Overlays suggest certainty or scientific validity not supported by the model | Show metric definitions, inputs, model assumptions, and status |
| Plan/source drift | Old plan text conflicts with current runtime | Automated spec drift checks plus manual traceability review |

## Decisions still requiring explicit resolution

1. **Law capacity:** verify the current law representation and whether the 128-law ceiling remains binding before adding laws or changing bitmasks.
2. **State ownership:** confirm which structures are authoritative on the main thread, worker, or shared memory and document synchronization rules.
3. **Persistence contract:** define the exact saved state needed for deterministic replay, including RNG state, configuration, event history, lineage, epochs, and version metadata.
4. **Feature truth:** classify each catalog entry against current source as verified, partially implemented, designed, deferred, or absent.
5. **Performance targets:** define separate baseline and target thresholds for solver throughput, worker latency, rendering frame time, memory, and persistence.
6. **Scientific framing:** label simulated approximations and fictional mechanics clearly; avoid implying that emergent behaviour demonstrates real consciousness or reproduces physical quantum/relativistic phenomena.

## Historical notes

The historical PLAN includes milestone-specific test counts, performance numbers, and implementation descriptions. Treat them as dated claims tied to their recorded version and environment, not as current performance guarantees. Preserve original numbers only when their original benchmark setup can also be recovered.
