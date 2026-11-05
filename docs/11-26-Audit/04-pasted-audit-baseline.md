# VEPA4 Pasted Audit Baseline

**Source:** user-pasted audit messages
**Observed release:** VEPA4 9.1.3
**Observed commit:** `a9f3103 — Update 195 files`
**Observed branch:** `main`
**Audit mode:** read-only
**Status:** historical source record; not silently merged with later repository state

## 1. Executive judgment

The pasted audit describes VEPA4 as a substantial, functioning browser simulation with a deterministic core, broad subsystem coverage, an extensive law registry, and unusually broad test/documentation infrastructure. It also states that apparent maturity exceeds verified maturity because runtime source, generated metadata, historical audit prose, exports, and current documentation disagree in important places.

The audit separates the repository into:

1. A real operational simulation: flat particle memory, worker and synchronous solver paths, spatial grid, law gating, DNA/lifecycle systems, persistence, rendering, intelligence, and world-state subsystems.
2. An experimental/approximate layer: FMM, Barnes–Hut, WebGPU, mechanics abstraction, ontology relationships, and advanced cosmic, synthetic, quantum, and social systems.
3. A historical/documentation layer: generated specifications, multi-stage audits, export snapshots, historical tooling, legacy claims, and stale references.

Its overall assessment was:

| Dimension | Assessment |
|---|---|
| Operational simulation quality | Good |
| Scientific/semantic fidelity | Mixed |
| Repository/documentation coherence | Weak-to-moderate |
| Experimental backend maturity | Low-to-moderate |
| Maintainability under continued growth | Moderate risk |

## 2. Batch 3 conclusions 1–4

### 2.1 FMM production readiness

**Status:** Resolved by evidence; technically open.

Evidence named by the audit:

- `src/physics/fmm.js`
- `bench/backend-compare.mjs`
- `docs/FEATURE_STATUS_MATRIX.md`
- Focused backend tests

The FMM path remains experimental because it requires:

- Removal or completion of the `cellNeighbours` placeholder.
- Near/far interaction accounting validation.
- Toroidal edge-case validation.
- DNA-modifier limitation analysis.
- Large-population parity/error testing.

No FMM promotion or runtime behavior change was claimed.

### 2.2 WebGPU operational status

**Status:** Resolved by policy; technically open.

The audit records that:

- WebGPU is opt-in.
- CPU remains the reference backend.
- Synchronous fallback is not proof of GPU execution.
- Browser/device parity is still required.

Remaining gate:

- Execute browser/device WebGPU tests with an installed compatible browser environment.
- Validate GPU resource and error lifecycle behavior.

### 2.3 Barnes–Hut approximation boundary

**Status:** Resolved by evidence.

The exact CPU solver remains the reference implementation. The backend comparison confirms Barnes–Hut is approximate rather than semantically identical.

The benchmark framework measures:

- Exact direct gravity.
- Barnes–Hut error.
- FMM error.
- RMS and maximum force deviations.
- Timing for the controlled fixture.

Barnes–Hut remains opt-in and is not promoted to the default solver.

### 2.4 Law registry and ontology completeness

**Status:** Resolved by evidence; technically open.

The audit reports:

- 136 registered laws.
- 136 implementation-status records.
- 136 ontology coverage records.
- 23 laws with relationship metadata.
- 113 laws without relationship metadata.

The registry is complete as a catalogue, but relationship metadata and semantic behavior evidence are not uniform.

Remaining gates:

- Expand ontology metadata coverage.
- Add focused semantic tests instead of relying primarily on textual references.

## 3. Batch 4 conclusions 5–8

### 3.1 Mechanics consolidation

**Status:** Resolved by evidence; technically open.

The audit documents:

- Shared pair-geometry ownership.
- CONTACT as geometric separation correction.
- COLL as impact response/impulse.
- Mechanics diagnostics as non-mutating inspection.
- Bond/merge/adjoin boundaries.
- TOPOLOGY, INERTIA, TORQUE, FRAGMENTATION, and ADHESION consumers.

Remaining gates:

- Migrate or formally justify equivalent hot-loop scalar calculations.
- Add dedicated diagnostics for COLL impulse, INERTIA, and TOPOLOGY.
- Add browser fixtures for Mechanics toggles.

### 3.2 Audit prose versus executable evidence

**Status:** Resolved by policy.

The ownership policy establishes:

- Audit prose is supporting evidence.
- Runtime source and executable tests are authoritative.
- Historical sign-off text cannot independently prove behavior.
- Future audit records should include executable test references and provenance.
- The current audit corpus remains preserved.

### 3.3 Export snapshot ownership

**Status:** Resolved by policy; technically open.

The export system has:

- Corrected README contracts.
- Explicit retention policy.
- Read-only artifact inventory.
- Canonical versus legacy snapshot classification.

Retained snapshots named by the audit:

- `vepa-full-codebase-concat.md`
- `vepa-docs-concat.md`
- `vepa-codebase-full-concat.md`

Remaining gates:

- Map consumers and release dependencies.
- Select a canonical snapshot per use case.
- Decide whether each artifact belongs in the repository, CI artifacts, an archive, or should eventually be removed.

### 3.4 Historical tooling authority

**Status:** Resolved by policy.

The audit classifies:

- `tests/run.mjs` as an archived VEPA v3 runner.
- `scripts/patch-lawcat-test.mjs` as a historical migration utility.
- Export generators as maintenance tooling.
- Vitest as the active test authority.

Historical tools remain available for recovery but are outside the active build, test, and release path.

## 4. Pasted validation claims

| Check | Result reported by pasted audit |
|---|---|
| Specification generation | Passed |
| Specification drift check | Passed |
| Repository consistency check | Passed |
| Syntax check | Passed |
| Full Vitest suite | 97 files / 897 tests passed |
| Production build | Passed |
| `git diff --check` | Passed |
| Repository law count | 136 laws |
| Version | 9.1.3 |
| Ontology records | 136 |

The audit’s final state was:

- Batch 3 conclusions 1–4: completed.
- Batch 4 conclusions 5–8: completed.
- Runtime behavior: unchanged.
- Experimental systems promoted: none.
- Files deleted: none.
- Files relocated: none.
- Commits: none.
- Pushes: none.
- Deploys: none.

“Completed” here means the conclusions were formally resolved as evidence or policy decisions; it does not mean every remaining technical gate was implemented.

## 5. Hostile review scores

Each perspective used ten categories: functional integrity; feature completeness/fidelity; architecture/modularity; performance/scalability; determinism/reproducibility; test strength; documentation/code parity; repository hygiene/ownership; deployment/operability; and maintainability/change safety.

| Review perspective | Score |
|---|---:|
| Production SRE / Release Engineer | 61/100 |
| Scientific/Physics Correctness Reviewer | 55/100 |
| Adversarial Maintainer / Future Contributor | 49/100 |
| Simple average | 55/100 |
| Weighted normalized result | 59.5/100 |

The final rating placed VEPA4 at the upper edge of the “functional but materially burdened by qualification, drift, or unresolved architecture” tier.

## 6. Highest-severity findings

### Critical

1. Canonical documentation was stale across `README.md`, `SPEC.md`, `PLAN.md`, and `AGENTS.md`.
2. Help metadata extraction was not trustworthy: runtime and generated counts disagreed.
3. `src/physics/lawgroups/SPEC.md` was referenced as a law SSOT but reported absent.

### High

4. WebGPU was structurally present but disabled in the inspected solver path through `_useGPU = false`.
5. FMM contained an explicit `cellNeighbours()` placeholder.
6. Historical audit prose overstated completion relative to newer manifests and behavioral evidence.
7. `src/main.js`, `src/physics/solver.js`, `src/physics/laws.js`, and `src/constants.js` were oversized runtime hotspots.

### Medium

8. Export provenance and consumer ownership were unresolved.
9. Browser verification was incomplete.
10. State-transition and cross-subsystem mutation contracts were implicit.

## 7. Semantic and structural conclusions

The pasted audit identifies six ontological layers:

1. Physical substrate: particles, positions, velocities, mass, radius, energy, temperature, charge, fields, and boundaries.
2. Law system: identifiers, categories, state, dependencies, parameters, implementations, help, and relationships.
3. Biological/evolutionary layer: species, genome, phenotype, reproduction, mutation, speciation, lineage, and memory inheritance.
4. Social/cultural layer: groups, roles, treasury, economy, governance, construction, infrastructure, artifacts, and cultural memory.
5. Narrative/intelligence layer: insight, goals, narrative, agency, milestones, timelines, and world events.
6. Documentation/governance layer: specifications, audits, compendia, exports, ownership policies, resolution matrices, and historical tools.

The audit’s strongest technical description for the intelligence layer is:

> A deterministic emergent-state analysis and bounded control layer.

It does not establish independent cognition or consciousness in a strict technical sense.

## 8. State reconciliation rule

This document preserves the pasted 9.1.3 observations. Later repository work may change the current state, including WebGPU worker behavior, version markers, generated specifications, test counts, law-state representation, or audit paths. Those changes must be recorded as later state, not retroactively attributed to the original 9.1.3 audit.
