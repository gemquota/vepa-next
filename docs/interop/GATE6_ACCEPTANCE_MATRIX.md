# Gate 6 acceptance matrix

| Stage | Status in this PR | Evidence / remaining requirement |
|---|---|---|
| G6.1 Benchmark matrix | Gravity-kernel foundation implemented | `bench/release-matrix.mjs`; exact/Barnes–Hut/FMM, fixed seeds, median/p95 and error |
| G6.2 Hot-loop constraints | Policy documented, not accepted | Full-solver profiling and before/after allocation evidence |
| G6.3 Compatibility matrix | Not accepted | Existing-world/save, isolation modes, worker fallback and desktop/mobile browser tests |
| G6.4 Release gate | Not accepted | Full CI, production build, browser smoke/screenshots and source/deploy provenance |

A successful gravity benchmark is not a release candidate by itself.
