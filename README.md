# VEPA Next

The intended canonical implementation of VEPA, built by selective, traceable migration from the reviewed source repositories.

**Current status (2026-10-21):** SIM foundations, replay validation, versioned snapshots, two-slot recovery storage, shared-grid contact handling, law-manifest validation, WRAP boundary contracts and a shared law-command adapter are committed. A minimal deterministic softened-gravity solver now provides the first physics slice, but it is not a port of stable's 128-law solver. The stable README capability gap audit is linked below. V5 remains consolidated as a behavioral migration plan covering configuration lifecycle, saves/presets, shared UI state, narrative/analytics event paths, law-grid controls and backend-setting precedence. The authoritative runtime/physics worker is still not migrated; stable-vs-next performance parity remains unverified.

## Start here

- [Stable README capability gap audit](README_CAPABILITY_GAP_AUDIT.md): feature-by-feature inventory of stable VEPA capabilities missing from Next, with required acceptance evidence.

- [SIM Architecture](SIM_ARCHITECTURE.md): semantic boundaries, state ownership, events, transaction lifecycle and determinism.
- [V5 Rework Integration Plan](V5_REWORK_PLAN.md): consolidated V5 correctness/UI behavior mapped to SIM vertical slices.
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
6. Consolidate V5 correctness/UI behavior through the same authoritative contracts.
7. Keep canonical law/schema/version registries and generate downstream references.
8. Implement Roadmap v4 as verified vertical slices, from particle physics through higher-level emergent systems.

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

The repository has passing CI evidence for earlier SIM contract slices and a passing CI baseline for the pinned stable source. The newest checkpoint/typed-array and contact-parity changes still need fresh verification. V5 behavior has been mapped into the consolidation plan but has not been claimed as runtime-integrated. VEPA Next is not feature-complete, the authoritative worker/solver is not yet integrated, stable performance parity has not been demonstrated, and no live deployment is claimed.
