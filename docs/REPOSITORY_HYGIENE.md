# Repository Hygiene and Ownership

**Status:** Phase 2 cleanup record for VEPA4 9.1.3.

This document defines ownership boundaries for generated artifacts and historical tooling. It deliberately records decisions before any deletion or relocation so cleanup remains reversible and does not erase provenance.

## Source-of-truth boundaries

| Area | Owner | Policy |
| --- | --- | --- |
| Runtime behavior | `src/` | Edit source modules and tests; generated documents must not become a runtime dependency. |
| Technical specification | `scripts/generate-spec.mjs` plus live source inputs | `docs/spec/` is generated. Run `npm run spec:generate`; never hand-edit individual generated records. `npm run spec:check` compares expected paths and bytes without writing. |
| Law metadata | `src/constants.js`, `src/state/lawHelpPatches.js`, and Mechanics help metadata | Canonical runtime metadata remains authoritative; supplemental help is reported as supplemental until ownership is consolidated. |
| Audit evidence | `docs/audit/` | Retain until each duplicate corpus has a documented producer, input set, and historical purpose. Audit prose is evidence, not proof of runtime behavior. |
| Export snapshots | `exports/` | Derived review artifacts only. Regenerate with the documented scripts; do not use concatenations as an alternate source tree. |

## Generated specification contract

The generator scans only active inputs (`src/`, `tests/`, `bench/`, `public/`, and selected root configuration files). It excludes `docs/spec/`, build output, dependencies, and VCS metadata, preventing generated files from self-ingestion. The generated manifest and procedure are owned by the generator. Check mode must be side-effect free.

## Legacy tooling

- `tests/run.mjs` is a VEPA v3-era Node test runner. The active suite is Vitest via `npm test`; the legacy runner is retained for provenance only.
- `scripts/patch-lawcat-test.mjs` is a historical migration utility that mutates a test file. It is not a build, test, or release step and must only be run deliberately.
- Export scripts are maintenance tooling, not application entrypoints. The full concatenation generator is invoked from `exports/generate-full-concat.mjs`, not from `.dist/`.

## Experimental and partial features

- `src/physics/fmm.js` remains experimental/partial: its helper implementation is incomplete and it is not the standard solver backend.
- `src/physics/gpuCompute.js` remains an opt-in experimental WebGPU backend. The CPU solver is the operational default; browser/device coverage is not equivalent to unit-test coverage.
- `src/physics/octree.js` is an optional approximate gravity/backend utility and must not be described as the default exact solver.
- Mechanics consolidation has reusable pair geometry and separated CONTACT/COLL helpers, but not every force law has been generalized onto one shared geometry consumer yet.

## Deferred decisions

1. Compare `docs/audit/` duplicate corpora against their producers before deleting or moving anything.
2. Decide whether large checked-in export concatenations belong in releases, generated CI artifacts, or neither.
3. Consolidate supplemental help into the canonical help owner only after preserving the current UI contract and tests.
4. Add browser/device verification for WebGPU and focused correctness/performance tests for FMM before changing their status.

Phase 3 status evidence is consolidated in [FEATURE_STATUS_MATRIX.md](FEATURE_STATUS_MATRIX.md). No deletion is authorized by this record. Each deferred decision requires a separate review and validation pass.
