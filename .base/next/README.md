# VEPA Next migration library (9.3.5 reconciliation)

This directory is the current migration and parity reference for gemquota/vepa-next mainline. It is not a claim that every source capability has been integrated or browser-verified.

## Current implementation authority

- Product runtime: DayneK/vepa v9.3.5, pinned to d24301cdcf95a6142ffa98d9808dffaacb1d8523.
- Repository package version: 9.3.5.
- Current mainline integration: product runtime at repository root.
- Additional simulation contracts: sim-foundation/; these contracts are tested separately and are not yet fully absorbed into the product worker/UI.
- Pin record: SOURCE_PIN.md.

The current root tree supersedes the 9.1.2-era source-faithful rebuild plan. Do not copy old law counts, indexes, module paths, test fixtures, package assumptions, or workflow configuration forward without revalidating them against this pin.

## Historical migration material

The original reconnaissance library remains recoverable on the closed historical branch rebuild/source-faithful-baseline (PR #30): https://github.com/gemquota/vepa-next/tree/rebuild/source-faithful-baseline . Its documents include the port catalogue, feature matrix, operation map, UI recreation specification, roadmaps, atomic TODOs, decisions, and source inventory.

That material is retained as historical analysis only. It described a 9.1.2-era source tree and workflow layout. The 136-law count is also present in the current 9.3.5 tree, so the count itself is not evidence of staleness; the canonical names, indices, gates, implementations and tests must be read from the current registry. The historical branch is intentionally not merged into main. Re-audit every item before turning it into an implementation task.

## Reconciliation rules

1. Use the current 9.3.5 root tree and SOURCE_PIN.md as product authority.
2. Treat sim-foundation/ as a separate contract layer until a feature is integrated into the live product runtime, worker protocol, UI and persistence path.
3. Distinguish present in source, covered by tests, integrated in runtime, and verified in a real browser. These are separate states.
4. Never infer law counts or indexes from old docs. Resolve the canonical registry and generated specifications in the current tree.
5. Preserve useful historical physics work only after checking units, conservation properties, deterministic ordering, numerical stability, hot-loop cost and compatibility with the current solver.
6. Port vertical slices: state ownership, solver/mechanics, worker synchronization, UI behavior, persistence, tests and browser evidence.
7. Keep deployment separate from validation. A successful build is not a deployment, and a deployment from an old ref is not evidence about mainline.

## Current verified baseline (commit 8b20f8a)

The recorded mainline CI state reports:
- Product unit suite: passing.
- SIM foundation contracts: passing (254/254 in the recorded run).
- Production build: passing.
- Separate legacy sandbox Pages workflow: failed because it omitted dependency installation and invoked the nonexistent npm run check script.
- Real-browser visual validation remains incomplete; the previous CI record notes a Chromium host-library limitation.

Re-run the workflow on the current PR/commit before treating these results as current.

## Work queue

- [ ] Re-pin the current product and SIM trees whenever either source changes.
- [ ] Rebuild a 9.3.5 feature coverage matrix from actual source registries and runtime call paths.
- [ ] Reconcile the historical port library against current module paths and ownership boundaries.
- [ ] Trace the exact solver tick, worker protocol, renderer, UI command and save/restore pipelines.
- [ ] Convert each retained feature into an atomic vertical-slice task with tests and browser acceptance.
- [ ] Add browser validation on a supported CI host and capture desktop/mobile evidence.
- [ ] Only enable Pages publication after an explicit release decision and successful browser/release gates.

## Reconciled 9.3.5 working documents

- [Feature coverage matrix](FEATURE_COVERAGE_9.3.5.md): product subsystems, law evidence, and the separate SIM foundation.
- [Operation map](OPERATION_MAP_9.3.5.md): boot, tick, worker, solver, post-tick, rendering and persistence paths.
- [Atomic roadmap](ATOMIC_ROADMAP_9.3.5.md): sequenced parity gates and decomposed integration tasks.

These documents were checked against the 9.3.5 source pin, the current 136-entry law registry, generated implementation-status and ontology-coverage reports, the worker entrypoints, the UI module report, and SIM contract modules. They are an audit snapshot, not generated truth; refresh them when source ownership or call paths change.
