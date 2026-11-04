# Audit Risk Remediation Plan

**Project:** VEPA4  
**Source audit basis:** `docs/ARCHITECTURAL_RESOLUTION_MATRIX.md`, `docs/FEATURE_STATUS_MATRIX.md`, `docs/MECHANICS_CONSUMER_MATRIX.md`, `docs/AUDIT_CORPUS_OWNERSHIP.md`, `docs/EXPORT_SNAPSHOT_POLICY.md`, `docs/LEGACY_TOOLING_INVENTORY.md`  
**Plan status:** actionable planning; no runtime changes implied  
**Reference release:** VEPA4 9.1.21

## 1. Executive plan

The audit identified five technically open areas and three policy-governed areas. The safest sequence is:

1. **Verification gates and source-of-truth cleanup** — prevent false completion claims before adding more implementation.
2. **WebGPU and backend evidence** — validate the newly wired path on real browsers/devices and preserve exact CPU reference behavior.
3. **Mechanics hot-path consolidation** — reduce duplicated geometry calculations without changing CONTACT/COLL semantics.
4. **Law semantic depth** — expand ontology and behavior tests by risk, not by registry order.
5. **FMM decision** — either complete it with measurable error bounds or explicitly retire the incomplete path.
6. **Audit/export/tooling provenance** — establish ownership and archive rules before any deletion or relocation.

No plan should promote an approximate backend, delete audit records, or claim physical fidelity solely because a generator or prose report exists.

## 2. Prioritization model

Each work item receives three scores from 1–5:

- **Importance (I):** consequence of leaving the risk unresolved.
- **Difficulty (D):** engineering/research effort and uncertainty.
- **Impact (P):** breadth of improvement across runtime correctness, trust, and maintainability.

Priority is calculated as:

```text
Priority = (I × 2 + P × 2 + D) / 5
```

Higher scores should be scheduled first. Difficulty is included but weighted less than importance and impact so high-value hard work is not hidden behind easy documentation tasks.

## 3. Prioritized action matrix

| Rank | Action | Risk addressed | I | D | P | Score | Recommended phase |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | Establish executable audit-signoff gates | Prose reports overstating implementation completeness | 5 | 3 | 5 | **4.6** | 1 |
| 2 | Complete real-browser WebGPU parity and failure testing | GPU path not verified on an actual device | 5 | 4 | 5 | **4.8** | 1 |
| 3 | Define exact CPU reference fixtures and backend error envelopes | Approximate backends lack population-scale acceptance limits | 5 | 4 | 5 | **4.8** | 1 |
| 4 | Resolve the FMM placeholder and make a keep/retire decision | Incomplete algorithm may be mistaken for a supported backend | 5 | 5 | 4 | **4.8** | 2 |
| 5 | Consolidate mechanics pair geometry in the hot path | Duplicate scalar calculations and semantic drift risk | 4 | 4 | 5 | **4.2** | 2 |
| 6 | Add dedicated CONTACT/COLL/INERTIA/TOPOLOGY diagnostics | Mechanics behavior is difficult to inspect quantitatively | 4 | 3 | 4 | **3.8** | 2 |
| 7 | Expand law ontology by dependency and state risk | Only 23 of 136 laws have relationship metadata | 4 | 4 | 4 | **4.0** | 3 |
| 8 | Add semantic behavior tests for priority laws | Text references are weaker than runtime evidence | 5 | 4 | 5 | **4.8** | 3 |
| 9 | Add audit-stage producer/provenance manifests | Historical audit ownership is unclear | 3 | 2 | 4 | **3.0** | 4 |
| 10 | Map export consumers and choose retention states | Derived snapshots have unresolved consumer ownership | 3 | 3 | 3 | **3.0** | 4 |
| 11 | Formalize historical-tool recovery and exclusion rules | Legacy tools could be mistaken for active verification | 3 | 2 | 3 | **2.6** | 4 |
| 12 | Correct stale architecture/version/path claims continuously | Documentation and codebase parity drift | 4 | 2 | 4 | **3.6** | Every phase |

## 4. Phase 1 — Verification gates and backend evidence

### 4.1 Create executable audit-signoff gates

**Objective:** prevent an audit record from calling a law or backend “complete” without executable evidence.

**Actions:**

1. Extend `scripts/check-repository.mjs` with an audit-claim validator.
2. Require each current audit sign-off to identify:
   - Runtime implementation file.
   - Solver gate or dispatch evidence.
   - At least one executable test, or an explicit `not-tested` status.
   - Approximation/proxy classification.
3. Generate `docs/spec/audit/signoff-manifest.json` from the source and test tree.
4. Fail CI only on malformed or contradictory claims; do not fail merely because a feature is experimental.
5. Add tests for missing evidence, stale paths, unknown law names, and unsupported “complete” claims.

**Acceptance criteria:**

- Every current sign-off is classified as `operational`, `proxy`, `experimental`, `metadata-only`, or `historical`.
- No audit record can imply executable proof when only text references exist.
- `npm run repository:check` validates the signoff manifest.

**Dependencies:** none.  
**Primary files:** `scripts/check-repository.mjs`, `scripts/generate-spec.mjs`, `docs/audit/`, `tests/unit/`.

### 4.2 Validate WebGPU on real browsers/devices

**Objective:** prove the worker bridge works with an actual WebGPU implementation rather than only with Node contracts or CPU fallbacks.

**Actions:**

1. Add a browser fixture with a small deterministic particle cloud.
2. Run CPU and GPU gravity on the same immutable initial buffer.
3. Compare force vectors using absolute and relative tolerances.
4. Test:
   - WebGPU available and device granted.
   - `navigator.gpu` absent.
   - Adapter unavailable.
   - Device lost during or after submission.
   - Shader/readback failure.
   - Zero pairs and dead-particle filtering.
   - Law toggles with GRAV disabled and enabled.
5. Assert CONTACT/COLL remains CPU-owned and is not double-applied.
6. Record device, browser, adapter, limits, timing, and tolerance in a machine-readable report.

**Acceptance criteria:**

- Browser tests pass on at least one Chromium/WebGPU-capable environment.
- CPU fallback passes when WebGPU is unavailable.
- GPU output stays within a documented tolerance for the controlled fixture.
- A failed GPU pass produces a bounded fallback, not a stalled worker.
- No claim is made that the GPU path is exact for DNA-modified gravity unless that behavior is explicitly implemented and tested.

**Dependencies:** Playwright browser/device environment.  
**Primary files:** `src/physics/gpuCompute.js`, `src/worker/physics.worker.js`, `tests/e2e/physics-worker.spec.js`.

### 4.3 Establish backend error envelopes

**Objective:** turn approximate backend behavior into measurable, versioned constraints.

**Actions:**

1. Define deterministic fixtures at small, medium, and large population sizes.
2. Compare exact CPU, Barnes–Hut, FMM, and GPU gravity where available.
3. Measure RMS absolute error, RMS relative error, maximum error, momentum drift, finite-value failures, and wall-clock time.
4. Run fixtures across toroidal boundary cases and clustered/uniform distributions.
5. Store reports as generated artifacts with fixture seed and configuration.
6. Set promotion rules:
   - Exact CPU remains reference.
   - Approximate engines require an explicit tolerance envelope.
   - A backend cannot become default solely because it is faster on one fixture.

**Acceptance criteria:**

- `bench:backends` supports repeatable fixture scales.
- Each optional backend has a documented error/performance envelope.
- Regression tests detect material error or timing changes.

**Dependencies:** WebGPU browser validation for GPU rows; FMM decision for final FMM status.  
**Primary files:** `bench/backend-compare.mjs`, `src/physics/octree.js`, `src/physics/fmm.js`, `src/physics/gpuCompute.js`.

## 5. Phase 2 — FMM and mechanics correctness

### 5.1 Resolve the FMM placeholder

**Objective:** remove ambiguity around whether FMM is an incomplete implementation or a supported approximation.

**Decision gate:** choose exactly one path after measurement.

| Path | When to choose | Required result |
|---|---|---|
| Complete | Cell-neighbor architecture can meet documented error and performance goals | Implement near/far accounting, toroidal handling, and tests |
| Retire to historical | Architecture cannot justify its complexity or error | Remove runtime selection, retain provenance documentation, and exclude from active backend claims |
| Retain experimental | Useful research path but not ready for promotion | Replace misleading completion language and add explicit unsupported-case tests |

**Actions:**

1. Trace every FMM output from cell construction to solver integration.
2. Replace or remove `cellNeighbours` placeholder behavior.
3. Verify near-field direct interactions are not omitted or double-counted.
4. Test toroidal wrap, empty cells, single-particle, clustered, and uniform fixtures.
5. Compare against exact CPU at multiple scales.
6. Update `FEATURE_STATUS_MATRIX.md` and architectural resolution status.

**Acceptance criteria:**

- No placeholder remains on the active execution path.
- FMM has a documented status backed by tests and benchmark output.
- The default exact solver behavior is unchanged.

### 5.2 Consolidate mechanics pair geometry

**Objective:** make pair geometry a single semantic boundary without sacrificing allocation-free hot-loop performance.

**Actions:**

1. Inventory every local `dx/dy/dz/dist/overlap` calculation in `solver.js`.
2. Compare each calculation against `getPairGeometry`.
3. Define a zero-allocation geometry contract using either:
   - A reusable scalar scratch object, or
   - An inline helper that returns into caller-provided storage.
4. Migrate one law family at a time: CONTACT/COLL, MOMENTUM/INERTIA, then TORQUE/CONSTRAINT.
5. Add parity tests before and after each migration.
6. Keep CONTACT geometric correction separate from COLL impact impulse.

**Acceptance criteria:**

- Equivalent calculations are either consolidated or explicitly documented as performance-specialized.
- Mechanics outputs are unchanged for fixed fixtures.
- No per-pair object allocation is introduced.
- Benchmarks show no unacceptable regression.

### 5.3 Add mechanics diagnostics

**Objective:** make high-risk mechanics behavior observable without mutating state.

**Required diagnostics:**

- CONTACT correction vector and overlap.
- COLL impulse vector and relative normal velocity.
- INERTIA scaling factor.
- TOPOLOGY bond imbalance and correction.
- Conservation-oriented before/after momentum summaries where applicable.

**Acceptance criteria:**

- Diagnostics are opt-in and side-effect free.
- Tests verify finite values and immutability.
- Browser fixture can toggle each Mechanics law and observe a meaningful state transition.

## 6. Phase 3 — Law semantic depth

### 6.1 Expand ontology by risk

Do not fill metadata alphabetically. Prioritize laws with the highest coupling and state mutation risk:

1. Lifecycle: `LIFE`, `REPRO`, `SENESCENCE`, `ENERGY`, `GENOTYPE`, `PHENOTYPE`.
2. Structural: `COLL`, `ACCR`, `BOND`, Mechanics laws.
3. Shared state: `MEMORY`, `COMMS`, `FEEDBACK`, `ENTANGLEMENT`, `SUPERPOSITION`.
4. Extreme forces: `GRAV`, `PLANETARY`, `SINGULARITY`, `HORIZON`, `RADIATION`.
5. Remaining category laws in dependency order.

For each law declare, where applicable:

- `dependsOn`
- `synergizesWith`
- `antagonizes`
- `reads`
- `writes`
- `consumes`
- `produces`
- `transforms`
- `feedback`

**Acceptance criteria:**

- Metadata references only known laws/state fields.
- Relationship validation remains error-free.
- Coverage percentage is reported honestly.
- New metadata is accompanied by a focused semantic test or an explicit evidence gap.

### 6.2 Add semantic tests for priority laws

Each test should verify observable behavior, not merely imports or source text.

| Test family | Required assertions |
|---|---|
| Force laws | Direction, magnitude bounds, finite output, parameter sensitivity |
| Lifecycle laws | Energy/age/dead transitions, birth/death gates, deterministic outcomes |
| Structural laws | Separation, impulse, bond/merge boundaries, non-duplication |
| Information laws | Memory/signal read-write effects and dependency gates |
| Quantum/meta proxies | State transitions, observation/collapse conditions, bounded proxy behavior |

**Acceptance criteria:**

- Priority laws have at least one behavior test and one boundary test.
- Tests distinguish “no effect because gated” from “no effect because broken.”
- Audit records link to tests by path and test name.

## 7. Phase 4 — Provenance and repository lifecycle

### 7.1 Add audit-stage provenance

**Actions:**

1. Create a machine-readable manifest for `docs/audit/laws/a3/`.
2. Record stage, producer, date, input scope, source version, and status.
3. Mark historical reports immutable in policy, not necessarily in filesystem permissions.
4. Link roll-ups to their stage inputs.
5. Add a check that future audit outputs contain provenance headers.

**Acceptance criteria:**

- Every stage family has an owner and purpose.
- Roll-ups can be traced to their source records.
- No audit file is deleted or moved without a mapping and archive boundary.

### 7.2 Resolve export snapshot ownership

**Actions:**

1. Search repository history and documentation for every `exports/*.md` consumer.
2. Classify each snapshot as `required`, `generated-ci`, `release-artifact`, `historical`, or `remove-candidate`.
3. Prefer reproducible generation over checked-in duplication where consumers permit it.
4. If retained, record producer command and source revision in the snapshot header.
5. If removed, archive it reversibly and update all links.

**Acceptance criteria:**

- Every retained export has a named producer and consumer.
- No export is treated as runtime source.
- The canonical snapshot set is documented.

### 7.3 Formalize historical tooling

**Actions:**

1. Keep `tests/run.mjs` and `scripts/patch-lawcat-test.mjs` outside active verification.
2. Add explicit `historical` metadata to the artifact inventory.
3. Document recovery instructions and mutation warnings.
4. Remove only after consumer search and archive review.

**Acceptance criteria:**

- Current CI cannot accidentally invoke historical tooling.
- Recovery purpose is documented.
- Historical tools do not influence completion or release claims.

## 8. Continuous controls

Add these checks to normal development and release review:

- `npm run spec:check`
- `npm run repository:check`
- `npm test`
- `npm run syntax-check`
- `npm run build`
- `npm run bench:backends`
- `npm run audit:inventory`
- `npm run artifact:inventory`
- `git diff --check`

For every significant feature, require a short status record answering:

1. Is it on the default runtime path?
2. Is it exact, approximate, proxy, opt-in, partial, or historical?
3. What executable test proves the claim?
4. What is the reference behavior?
5. What known limitations remain?
6. Which document owns the current description?

## 9. Definition of done for the remediation program

The audit risks are addressed when:

- No current document claims stronger implementation status than its evidence supports.
- WebGPU has real browser/device evidence and safe fallback coverage.
- FMM has a deliberate complete, experimental, or retired status with no placeholder ambiguity.
- Approximate backends have repeatable error/performance envelopes.
- Mechanics geometry and CONTACT/COLL boundaries have parity tests.
- Priority laws have semantic tests and ontology metadata.
- Audit and export artifacts have provenance and consumer ownership.
- Historical tooling is excluded from active authority.
- Generated documentation and version markers pass repository checks.
