# VEPA Implementation Plan

This plan turns the feature catalog into a verifiable delivery process. It is intentionally status-neutral: historical plans contain milestone claims, but current completion must be established against the branch being delivered.

## Delivery rules

1. **Audit before changing.** Inspect current code, tests, build scripts, and generated specifications before implementing a feature.
2. **Keep the baseline.** Record the current commit, runtime behaviour, benchmark profile, and relevant tests before refactoring.
3. **Implement vertical slices.** Each slice includes state/model changes, integration, UI/inspection, persistence where applicable, tests, and documentation.
4. **Preserve compatibility deliberately.** Save formats, deterministic seeds, public events, law identifiers, DNA slots, and import/export contracts require explicit migration decisions.
5. **Do not mark planned behaviour as shipped.** A design document, changelog entry, or passing build alone is not feature-level proof.
6. **Prefer shared primitives.** Reuse field writes, metrics/events, undo/snapshot, group/economy, memory, and worker boundaries rather than parallel implementations.

## Phase 0: Establish an evidence baseline

- [ ] Confirm default branch, current version, and canonical runtime entry points.
- [ ] Inspect the existing generated `docs/spec/` tree and run its drift check.
- [ ] Run existing unit/integration tests and production build; record results and known failures.
- [ ] Capture representative solver benchmarks at sparse, default, dense, and stress populations.
- [ ] Map current implementations for fields, solver/laws, species lifecycle, groups, persistence, timeline, multiplex, workers, UI, and analytics.
- [ ] Compare the current source against the historical claims in `PLAN.md`; log mismatches rather than assuming the plan is current.
- **Exit gate:** baseline commit, test/build results, benchmark command/output, and a source-backed status for each catalog entry are recorded.

## Phase 1: Stabilize core contracts

- [ ] Define authoritative ownership for simulation state and worker/main-thread synchronisation.
- [ ] Define deterministic random-number use and what state is required for replay.
- [ ] Specify field schema, update cadence, write budget, and the single mutation API.
- [ ] Specify event/metrics ownership, confirmation gates, cooldowns, and journal format.
- [ ] Specify species/group/particle lifecycle invariants for all parallel buffers and registries.
- [ ] Specify snapshot/undo/save validation and memory limits.
- **Exit gate:** invariants have tests; state mutations have clear owners; determinism and recovery failures are diagnosable.

## Phase 2: Physics and environment

- [ ] Validate boundary modes and hard-collision semantics.
- [ ] Validate scalar/vector fields, advection, walls, portals, and gravity wells.
- [ ] Integrate field and boundary changes with deterministic stepping and persistence.
- [ ] Add tests for conservation claims, caps, collision edge cases, and repeatable seeded runs.
- **Exit gate:** the environment behaves consistently at boundaries and under high density; benchmarks show acceptable regression bounds.

## Phase 3: Ecology and reproduction

- [ ] Validate the reproduction tiers and DNA/trait ranges against current source.
- [ ] Implement or correct speciation triggers, slot recycling, extinction queues, and lineage continuity.
- [ ] Add ecosystem metrics, food-web/niche views, and world-event confirmation.
- [ ] Test births/deaths/speciation at slot limits, including save/load and replay.
- **Exit gate:** no stale references after lifecycle changes; metrics match fixture data; events are bounded and reversible.

## Phase 4: Civilizations and shared economy

- [ ] Validate group detection/declaration, membership changes, roles, and treasury invariants.
- [ ] Implement construction, roads, barriers, trade, markets, and energy sharing on shared field/economy APIs.
- [ ] Add governance, alliances/conflicts, artifacts, upkeep, and mega-structure progression in dependency order.
- [ ] Add bounded write budgets, cooldowns, accounting checks, and inspectable group analytics.
- **Exit gate:** no unbounded entity/field growth; transfers are accounted for; group lifecycle and replay tests pass.

## Phase 5: Memory, agency, and narrative

- [ ] Implement persistent species/group memory and cultural transmission only after lifecycle contracts are stable.
- [ ] Add metrics-driven adaptation with bounded rates.
- [ ] Add species goals and narrative actions with explicit authority, rate limits, checkpointing, and journaling.
- [ ] Add epochs, snapshots, restore, and extinction/recovery events with validated memory caps.
- **Exit gate:** all autonomous changes are explainable in the journal, bounded, and reproducible from saved state.

## Phase 6: Artifacts, infrastructure, and multiplex

- [ ] Add treasury-backed artifacts and upkeep.
- [ ] Add extraction, energy networks, roads, and capped multi-tick construction.
- [ ] Verify shard isolation, per-shard random streams, fitness metrics, and import-on-exit semantics.
- [ ] Benchmark multiplex workload separately from the primary world.
- **Exit gate:** shard runs remain isolated unless explicit transfer occurs; resource creation and transfer are bounded and tested.

## Phase 7: Exotic and cosmic extensions

These are high-risk design extensions, not prerequisites for a stable core. Do not start until Phases 0–6 are verified.

- [ ] L: exotic-matter state, annihilation, conversion, and inverted-force rules.
- [ ] M: curvature, signal lensing, time dilation, and mass-energy accounting.
- [ ] N: superposition, entanglement, and tunnelling with deterministic collapse.
- [ ] O: stellar formation, collapse thresholds, and supernova events.
- [ ] P: synthetic entities and digital lineages with bounded upkeep.
- [ ] Q: cosmic epochs, cross-shard exchange, and controlled expansion.
- **Exit gate:** every extension has a precise state model, deterministic test fixtures, conservation/bounds checks where claimed, and stress tests for runaway effects.

## Phase 8: Entropy, awareness, and observer lifecycle

- [ ] R: implement slow entropy progression and validated seed/state-preserving rebirth.
- [ ] S: add diegetic awareness only as an explicit simulation mechanic; journal player interventions.
- [ ] T: define a deterministic, inspectable graduation predicate; cap and checkpoint observer actions; validate new-game-plus state.
- **Exit gate:** rebirth is reproducible, graduation is measurable, and observer actions cannot corrupt authoritative state.

## Phase 9: Release hardening

- [ ] Run syntax checks, complete test suite, production build, and performance benchmarks.
- [ ] Run deterministic replay/save-load tests across representative scenarios.
- [ ] Validate migration and recovery paths from pre-change saves where compatibility is promised.
- [ ] Check documentation generation/drift and verify source links.
- [ ] Record known limitations, benchmark environment, release notes, and maintainer review.
- **Exit gate:** acceptance criteria are met or explicitly waived with rationale; no unlabelled feature is represented as verified.

## Per-feature completion checklist

A feature is **Verified** only when all applicable checks are complete:

- [ ] User-visible behaviour and state transitions are specified.
- [ ] Dependencies and ownership boundaries are named.
- [ ] Source implementation exists in the current branch.
- [ ] Positive, negative, boundary, and lifecycle tests pass.
- [ ] Determinism/save-load/replay tests pass when state or randomness is involved.
- [ ] Performance and memory costs are measured when the feature affects hot paths or long-lived state.
- [ ] UI/analytics expose enough information to inspect the behaviour.
- [ ] Documentation and generated specs match the source.
- [ ] Risks, deferred scope, and compatibility effects are recorded.
