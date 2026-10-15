# VEPA Next

The intended canonical implementation of VEPA, built by selective, traceable migration from the reviewed source repositories.

**Current status:** SIM target architecture and migration planning are committed. The full runtime has not yet been migrated; tests and performance parity are not yet verified.

## Start here

- [SIM Architecture](SIM_ARCHITECTURE.md): semantic boundaries, state ownership, events, transaction lifecycle and determinism.
- [Roadmap v4 interpretation](https://github.com/gemquota/vepa-docs/blob/main/ROADMAP_V4_INTERPRETATION.md): product intent and implementation phases.
- [Feature migration map](https://github.com/gemquota/vepa-docs/blob/main/FEATURE_CATALOG_AND_MIGRATION_MAP.md): capability-by-capability migration decisions.
- [Master tracker](https://github.com/gemquota/vepa-docs/blob/main/MASTER_ROADMAP_TRACKER.md): evidence and phase status.
- [Consolidation workspace](https://github.com/gemquota/vepa-consolidation): source inventory and migration ledger.

## Engineering priorities

1. Establish source authority, provenance and a clean baseline.
2. Implement SIM contracts and a failure-safe world session.
3. Preserve stable physics behavior while measuring candidate performance.
4. Make world configuration, persistence and replay validated and inspectable.
5. Recover unique capabilities across historical versions without duplicate implementations.
6. Keep canonical law/schema/version registries and generate downstream references.
7. Implement Roadmap v4 as verified vertical slices, from particle physics through higher-level emergent systems.

## Invariants

- Browser-first delivery unless evidence justifies a change.
- No untracked randomness, wall-clock dependence or unspecified event ordering in deterministic simulation paths.
- Validate proposed configuration before mutating live state.
- Preserve last-known-good state or enter an explicit recoverable blocked state on failure.
- Keep intended, validated, committed and applied configuration distinguishable.
- Separate simulation timestep, simulation speed, wall-clock time and render rate.
- Keep simulation semantics stable when render detail adapts.
- Record diagnostics and recovery references for failed operations.
- Keep fictional awakening as a designed game law, not a claim of real consciousness.
- Do not claim tests pass or performance parity exists without execution evidence.

## Migration workflow

1. Pin source commit and file/blob SHAs.
2. Classify feature behavior as KEEP, ADAPT, MERGE, REPLACE, ARCHIVE or REJECT.
3. Define the SIM contract and tests before moving complex behavior.
4. Migrate a coherent vertical slice with provenance.
5. Run focused tests, repository checks, build and relevant benchmarks.
6. Update docs, feature map, changelog and master tracker.
7. Keep rollback to a known-good commit.

## Performance principle

Preserve the stable implementation's measured behavior before optimizing. Keep typed-array data paths and avoid allocations or dynamic semantic dispatch in particle-level hot loops unless benchmarks demonstrate a net win. Performance parity must be demonstrated on matching workloads and reference hardware, with solver throughput, render latency, memory and save/load measured separately.

## Honest boundary

The GitHub connector used for this refactor can inspect and commit repository text, but it does not run npm, browsers or GPU benchmarks in this session. No claim is made that VEPA Next is runnable, feature-complete, tested, stable-equivalent or deployed yet.
