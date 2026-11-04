# VEPA4 11-26 Audit — Updated Full Answer Set

**Prepared:** 2026-09-16
**Current reference:** VEPA4 9.1.4 workspace state
**Historical source incorporated:** user-pasted VEPA4 9.1.3 audit
**Organization:** source-of-truth, backend, mechanics, ontology, verification, lifecycle

> The historical pasted audit is preserved in `04-pasted-audit-baseline.md`. Its 9.1.3 claims, ratings, and findings are not silently rewritten to match later repository changes.

## Executive conclusion

VEPA4 is a substantial deterministic browser simulation with an operational runtime core, broad subsystem coverage, a large law catalogue, worker and synchronous execution, persistence, rendering, intelligence proxies, benchmarks, and extensive documentation infrastructure.

Its verified maturity is lower than its feature breadth. The appropriate status model is:

- **Operational:** active runtime behavior with executable evidence.
- **Reference:** baseline behavior against which other paths are compared.
- **Approximate:** a deliberate numerical approximation with an error envelope.
- **Proxy:** bounded simulation behavior inspired by a named concept.
- **Opt-in:** available only when explicitly selected.
- **Partial/experimental:** present but missing acceptance evidence or containing known incomplete paths.
- **Historical:** retained for provenance or recovery, outside current authority.

The principal conclusion is not that experimental systems should be removed. It is that each claim must be scoped to its evidence, version, backend, and model boundary.

## 1. Source-of-truth and provenance

### 1.1 Authority hierarchy

| Concern | Authority | Supporting material only |
|---|---|---|
| Runtime behavior | `src/` | Exports and prose |
| Behavior verification | Executable tests and reproducible benchmarks | Audit narrative |
| Structural specification | Regenerated and checked `docs/spec/` | Stale generated copies |
| Historical audit evidence | `docs/audit/laws/a3/` | Current runtime claims |
| Release/version state | Current manifests and changelog | Historical audit snapshots |

The pasted audit is a historical 9.1.3 source record. Current 9.1.4 claims must be validated against current source and tests rather than retroactively inserted into that record.

### 1.2 Audit corpus

The audit corpus contains repeated stage families and roll-ups. Lack of byte-identical duplicates does not prove semantic uniqueness. Retain the corpus until provenance is mapped, but do not treat every entry as independent evidence.

For each stage or roll-up, capture:

- Producer or generation method.
- Date and source revision.
- Review scope.
- Status: historical, derived, current-supporting, or superseded.
- Links to executable tests and source paths.
- Canonical successor, if one exists.

No deletion or relocation should occur without a path-level mapping and reversible archive boundary. A machine-readable ownership manifest now exists at `docs/audit/provenance.json` and is checked by `npm run provenance:check`. The validator now requires every Markdown file in `docs/audit/laws/a3/` to be covered by a manifest record and every file in `exports/` to be covered by the export ownership record.

### 1.3 Exports

The large concatenated exports are useful for handoff and archival review, but they are not runtime authority. Each artifact should eventually be classified as:

- Reproducibly generated source snapshot.
- CI artifact.
- Release artifact.
- Historical archive.
- Removal candidate.

The separate `vepa-exports` repository remains a future governance/CI decision. Local export ownership is now recorded in `exports/provenance.json` and validated without requiring external credentials. It requires a provisioned repository, write permissions, pinned source revisions, a reviewed publication workflow, and failure handling. A local report cannot claim that external publication is configured.

### 1.4 Historical tooling

`tests/run.mjs` and `scripts/patch-lawcat-test.mjs` remain recovery/history tooling. Export generators may remain active maintenance tooling, but generated outputs are derived. Vitest and current repository checks are the active verification authority.

## 2. Repository architecture and hotspots

The runtime architecture is coherent at the directory level but has high central coupling.

### 2.1 `src/main.js`

`src/main.js` is the composition root for the event bus, PRNG, particle buffer, law state, DNA, renderer, UI, worker bridge, intelligence engines, groups, ecology, epochs, memory, exotic matter, quantum state, stellar state, synthetic organisms, agency, and multiplexing.

It is operational, but initialization order, restart behavior, worker fallback, and cross-subsystem mutation order are semantically important. It should be treated as a high-risk integration hotspot.

### 2.2 `src/constants.js`

This is the major runtime SSOT for stride layout, DNA indexes, law indexes, categories, dependencies, relationships, help metadata, and global values.

Strengths include centralized indexes, named offsets, unique registry entries, and coherent 136-law mapping. Risks include excessive responsibility, heuristic parser fragility, supplemental help ownership ambiguity, and large merge/review surface.

### 2.3 `src/physics/solver.js`

The solver provides caching, quality/budget calculation, grid reuse, field preparation, time dilation, optional backend selection, pairwise interactions, mechanics, chemistry, thermodynamics, information, electromagnetism, quantum behavior, lifecycle, integration, and offspring production.

It is functionally rich but remains an orchestration hotspot. Law ordering is operationally significant without being fully represented as a formal pipeline contract. Approximate backend semantics differ from the reference path, particularly around DNA modifiers and toroidal behavior. Any GPU status must be tied to the specific current worker/solver path, not dependency presence or CPU fallback.

### 2.4 `src/physics/laws.js` and law groups

The large legacy/core law file remains a maintainability risk. Category law groups provide a better modular direction, but each law still needs explicit inputs, outputs, gates, bounds, and tests.

The pasted 9.1.3 audit reported that `src/physics/lawgroups/SPEC.md` was absent despite being referenced as an implementation SSOT. The current tree now contains that contract, including stateless-law, evidence-level, geometry, and review rules; the historical absence remains preserved as a snapshot finding.

### 2.5 State and intelligence layers

State modules are separated by subsystem, but cadence ordering, field writes, group membership, particle lifecycle, save/restore, and worker/main-thread divergence create coordination risk.

The intelligence engines are best described as deterministic emergent-state analysis and bounded control. They do not establish independent cognition merely because they produce narratives, goals, milestones, or parameter changes.

## 3. Backend and performance conclusions

### 3.1 Reference CPU solver

The CPU pairwise solver remains the reference implementation because it has the broadest semantics and strongest direct comparison role.

“Exact” should mean exact relative to the declared VEPA numerical model, including its timestep, neighbor limits, toroidal geometry, bounded laws, DNA/world parameters, and integration scheme. It must not mean physically exact reality. “Reference CPU solver” is the safer terminology.

Quality mode and performance tuning may reduce interactions, throttle expensive passes, alter grid density, or trade fidelity for responsiveness. Full-population claims must separate:

- Solver time.
- Worker round-trip time.
- Main-thread analytics.
- Renderer time.
- Browser/device overhead.

### 3.2 Barnes–Hut

Barnes–Hut is implemented, opt-in, and approximate. Exact CPU remains the reference. Required acceptance evidence includes:

- Population-scale error envelopes.
- RMS and maximum force deviation.
- Toroidal and clustered/uniform fixtures.
- Explicit error-tolerance policy.
- Explicit default-selection policy.
- Dedicated monopole/quadrupole parity tests.
- Performance and finite-value regression thresholds.

Quadrupole correction improves the approximation but does not make it semantically identical or physically exact.

### 3.3 FMM

FMM remains partial/experimental even after the `cellNeighbours` placeholder was replaced; the path still requires parity/error acceptance before promotion. Required evidence includes:

- Near/far interaction accounting.
- No double counting or omitted direct interactions.
- Toroidal seams and corners.
- Empty, coincident, clustered, uniform, and stress fixtures.
- DNA-modifier limitation analysis.
- Large-population parity/error envelopes.

The placeholder neighbor helper has now been replaced by a real toroidal same-level stencil, and the evaluator reports near/far cell accounting. The remaining acceptance work is parity/error validation, DNA-modifier scope, and large-population evidence; the surrounding multipole terminology still cannot substitute for those measurements.

### 3.4 WebGPU

WebGPU status must be reported by version and execution path. The historical pasted audit reported `_useGPU = false`, making the inspected path a scaffold/opt-in research path rather than verified device execution. Later worker-bridge changes may improve that status, but they do not retroactively change the 9.1.3 audit.

Current acceptance still requires a real browser/device test covering adapter acquisition, shader execution, readback, device loss, fallback, law toggles, deterministic fixtures, and CPU/GPU tolerance.

## 4. Law ontology and semantic fidelity

The 136-law registry can be complete as a catalogue while remaining incomplete as an ontology.

A normalized law record should declare:

- Registry identity and category.
- Implementation file and solver gate.
- Reads and writes.
- Dependencies.
- Synergies and antagonisms.
- Feedback loops.
- Bounds and finite-value guards.
- Exact/reference, approximate, or proxy status.
- Conservation obligations.
- Executable behavior evidence.

The pasted audit reported 23 laws with relationship metadata and 113 without. The remaining gate is to expand coverage by risk priority rather than alphabetically and replace text-reference evidence with focused semantic tests. The generated ontology coverage and implementation manifests are now regenerated and checked as part of the repository contract; their coverage metrics remain descriptive rather than semantic approval.

### 4.1 Bounded laws and proxies

Bounded forces, state machines, signal transformations, lifecycle transitions, and graph corrections are expected modeling techniques for a real-time emergent simulation. They are shortcomings only when:

- Presented as literal physical implementations.
- Ungated or unbounded.
- Insensitive to their claimed parameters.
- Untested at boundaries.
- Duplicated by overlapping laws without a contract.

The correct remedy is honest classification and behavior evidence, not automatic replacement of every proxy.

### 4.2 Semantic conservation and non-redundancy

Universal conservation is not established until controlled matrices cover supported law combinations. Define and test conservation obligations for momentum, energy, fields, population/lifecycle accounting, and graph/bond consistency.

A first local scaffolding slice now verifies equal-and-opposite collision response, toroidal geometry antisymmetry, and CONTACT/COLL behavioral separation. These are focused contract tests, not a universal conservation proof.

Ablation tests are required to assess overlapping laws. Registry membership, source references, and relationship prose do not prove non-redundancy.

## 5. Mechanics and geometry

The mechanics abstraction should own equivalent pair geometry without introducing per-pair allocation. Any specialized hot-loop scalar calculation must be either migrated or justified by measured performance and parity evidence.

Preserve the distinction:

- CONTACT performs geometric penetration correction.
- COLL performs approaching-body impact impulse.

The implementation now provides side-effect-free diagnostics for COLL impulse/relative normal velocity, INERTIA scaling, and TOPOLOGY bond imbalance/correction. Remaining work is migrating or justifying every equivalent hot-loop scalar path and adding browser fixtures for individual and combined Mechanics toggles; CONTACT overlap/correction remains represented by the existing correction API.

## 6. Verification limits

The pasted audit’s validation table reported specification generation, drift checks, repository checks, syntax, 97 files/897 tests, build, and `git diff --check` as passing for its 9.1.3 snapshot. Those results must remain attributed to that snapshot.

The limitations remain important:

- Node tests are not browser tests.
- Playwright is not a substitute for unit tests.
- Node contracts do not establish WebGPU device execution.
- Bounded-behavior tests do not prove scientific correctness.
- Conservation is not proven for every law combination.
- Non-redundancy is not proven.
- Registry presence does not prove equal meaningful effect for all 136 laws.
- Serialized tests can conceal global-state coupling.

## 7. Historical hostile-review assessment

The pasted 9.1.3 audit assigned:

| Perspective | Score |
|---|---:|
| Production SRE / release engineer | 61/100 |
| Scientific/physics correctness reviewer | 55/100 |
| Adversarial maintainer / future contributor | 49/100 |
| Simple average | 55/100 |
| Weighted normalized result | 59.5/100 |

These are historical snapshot scores, not a claim that the current 9.1.4 state has been rescored.

## 8. Final implementation status

### Resolved as evidence or policy

- FMM is identified as technically open and not production-complete.
- WebGPU is opt-in/reference-bounded and still requires device evidence.
- Barnes–Hut is approximate and remains subordinate to CPU reference behavior.
- The law catalogue is structurally complete while ontology depth is uneven.
- Mechanics ownership and CONTACT/COLL separation are documented.
- Audit prose is supporting evidence, not runtime authority.
- Historical tooling is outside active authority.
- Export retention is policy-defined but consumer mapping remains open.

### Technically open

- FMM parity/error suite, DNA-modifier scope, and large-population validation.
- Real browser/device WebGPU validation.
- Backend error envelopes and default-selection policy. A local error-envelope classifier now exists in `bench/backend-compare.mjs`; population-scale calibration remains open.
- Complete mechanics hot-path migration or justification. Browser acceptance fixtures now exist in `tests/e2e/runtime-acceptance.spec.js`; they require an installed Playwright browser to execute.
- High-risk law ontology and semantic tests.
- Conservation and non-redundancy matrices.
- Per-file producer/date/source-revision metadata for the audit corpus; directory-level coverage is now machine-checked, but historical producer metadata remains unavailable.
- Export consumer map. A non-publishing contract is now machine-checked by `npm run exports:check`; external `vepa-exports` publication remains intentionally unexecuted and requires explicit CI credentials.
- Formal state-transition contract.
- Runtime/API rename from “exact CPU solver” to “reference CPU solver”; current documentation now adopts the safer terminology while compatibility names remain in historical/source material.

## 9. Completion criterion

The updated audit answers are complete only when each significant feature or law states:

1. Whether it is on the default runtime path.
2. Whether it is reference, approximate, proxy, opt-in, partial, experimental, or historical.
3. Which source files implement it.
4. Which gate and dependencies activate it.
5. Which executable test proves it.
6. Which conservation, overlap, and numerical limitations apply.
7. Which document owns the current description.
8. Which generated or historical artifacts derive from it.

## 10. Additional implementation infrastructure

- `playwright.config.js` and `tests/e2e/runtime-acceptance.spec.js` provide browser fixtures for cross-origin isolation, Mechanics toggles, and WebGPU capability reporting. A missing adapter is recorded as an environment result, not a test failure.
- `createGPUContext()` now exposes a `device.lost` promise; the worker listens for loss and compute failure, emits `GPU_FALLBACK`, and the main thread reports the active backend per completed tick.
- The deterministic headless GPU bridge now honors independent gravity and collision gates, preserving the CPU fallback as a faithful contract fixture.
- `bench/backend-compare.mjs` now emits explicit `error` and `assessment` envelopes with finite-value and tolerance fields; these are acceptance-policy measurements, not proof of physical equivalence.
- `exports/publication-plan.json` and `npm run exports:check` define a safe external-publication boundary without contacting or mutating `vepa-exports`.

Until then, the accurate final claim remains: **implemented with bounded claims and documented gaps—not universally complete.**
