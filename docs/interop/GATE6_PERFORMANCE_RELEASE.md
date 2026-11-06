# Gate 6 — performance and release evidence

## Delivered in this slice: G6.1 gravity benchmark matrix foundation

Run `npm run bench:release-matrix` to produce a fixed-seed matrix at 32, 128, 512, 1024 and 2048 particles. Each count uses three fixed seeds and reports median, p95, min/max timing plus worst observed RMS-relative and maximum absolute force error for exact-direct gravity, Barnes–Hut and FMM.

The report includes Node/platform/architecture context and an explicit scope declaration. It is a gravity-kernel benchmark, not a full product solver benchmark.

## G6.2 hot-loop constraints — not yet accepted

The repository's hot-loop policy remains:
- no per-pair object allocation;
- reuse typed scratch buffers and spatial structures;
- keep optional backend dispatch outside the exact pair loop where practical;
- require benchmark evidence for abstraction or dispatch changes.

A static source scan is not sufficient proof of allocation behavior. Acceptance requires profiling representative full-solver workloads and retaining before/after evidence.

## G6.3 compatibility matrix — not yet accepted

Required browser/runtime coverage remains:
- v9.3.5 existing-world load and save round-trip;
- explicit migration or actionable failure for older save schemas;
- ArrayBuffer fallback without cross-origin isolation;
- SharedArrayBuffer worker path with COOP/COEP;
- desktop/mobile viewport and touch interaction.

The gravity-kernel benchmark cannot establish any of these properties.

## G6.4 release gate — not yet accepted

Release requires full product and SIM tests, repository/spec checks, syntax checks, production build, browser smoke tests, screenshots, source-pin provenance and deployed-commit identity. Deployment remains a separate explicit approval step. This PR does not deploy or change the default backend.

## Reproduction and interpretation

The benchmark is fixed-seed and repeated, but wall-clock timings remain machine-dependent. Compare runs on the same hardware/runtime and avoid treating one noisy run as a release threshold. Approximation acceptance must use the published error envelope in addition to speed; faster incorrect forces are still incorrect forces.
