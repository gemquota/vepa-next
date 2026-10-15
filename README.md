# VEPA Next

The intended canonical implementation of VEPA, built by selective, traceable migration from the reviewed source repositories.

**Current status (2026-10-16):** SIM foundations, replay validation, versioned snapshots, two-slot recovery storage and a shared-grid contact adaptation are committed. Contract CI passed on commit `eb0004f6e75e8603bad137b04d592a678d2f85fb` in [run 38792899940](https://github.com/gemquota/vepa-next/actions/runs/38792899940). Newer checkpoint-store and schema-v2 typed-array codec tests, plus the latest legacy contact parity fixtures, are awaiting a fresh CI result. The full runtime and authoritative physics worker have not yet been migrated; stable-vs-next performance parity remains unverified.

## Start here

- [SIM Architecture](SIM_ARCHITECTURE.md): semantic boundaries, state ownership, events, transaction lifecycle and determinism.
- [Roadmap v4 interpretation](https://github.com/gemquota/vepa-docs/blob/main/ROADMAP_V4_INTERPRETATION.md): product intent and implementation phases.
- [Feature migration map](https://github.com/gemquota/vepa-docs/blob/main/FEATURE_CATALOG_AND_MIGRATION_MAP.md): capability-by-capability migration decisions.
- [Master tracker](https://github.com/gemquota/vepa-docs/blob/main/MASTER_ROADMAP_TRACKER.md): evidence and phase status.
- [Consolidation workspace](https://github.com/gemquota/vepa-consolidation): source inventory and migration ledger.
- [Pinned stable-source baseline](https://github.com/gemquota/vepa-docs/blob/main/50-engineering/STABLE_BASELINE_BENCHMARK.md): verified workflow and captured gravity-kernel benchmark.

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

The repository has passing CI evidence for earlier SIM contract slices and a passing CI baseline for the pinned stable source. The newest checkpoint/typed-array and contact-parity changes still need fresh verification. VEPA Next is not feature-complete, the authoritative worker/solver is not yet integrated, stable performance parity has not been demonstrated, and no live deployment is claimed.
