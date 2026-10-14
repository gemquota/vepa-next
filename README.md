# VEPA Next

The intended canonical implementation of VEPA, built by selective, traceable migration from the source repositories.

## Status

**Bootstrap only.** This repository is currently empty apart from this project charter. No application code has been migrated, and no tests have been run here yet.

## Engineering priorities

1. Establish source-of-truth and migration provenance.
2. Establish a reproducible baseline with installation, repository checks, unit tests, browser tests, and benchmarks.
3. Make world configuration and restart behavior transactional, validated, observable, and replayable.
4. Verify physics correctness and performance with deterministic fixtures, CPU/GPU comparisons, and explicit performance targets.
5. Remove duplicated sources of truth and generated-file drift across laws, specifications, provenance, and version metadata.

## Project invariants

- Preserve the browser-first delivery model unless evidence justifies changing it.
- Deterministic replay must account for every source of randomness, ordering, timing, and worker coordination that can affect outcomes.
- Treat exact state equality as a testable requirement where feasible; document tolerances where it is not.
- Validate proposed configuration before applying it and preserve the last known-good configuration on failure.
- Record intended versus actual state transitions and provide actionable diagnostic identifiers.
- Separate throughput, render latency, memory, and persistence targets.
- Protect recovery data and make destructive cleanup explicit.
- Keep fictional awakening and higher-level cognition as designed simulation laws, not claims of real consciousness.
- Do not claim tests pass unless they were executed and their results recorded.

## Development workflow

1. Inventory and compare the sources in gemquota/vepa-consolidation.
2. Migrate small, coherent batches with provenance records.
3. Run repository consistency checks and relevant tests after each batch.
4. Keep this repository's code authoritative; place project-wide documentation in gemquota/vepa-docs.
5. Report blockers and unverified assumptions instead of silently choosing risky behavior.