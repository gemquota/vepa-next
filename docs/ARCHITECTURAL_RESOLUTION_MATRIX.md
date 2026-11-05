# Architectural Resolution Matrix

**Project:** VEPA4  
**Release context:** 9.1.22
**Program scope:** final eight unresolved architectural conclusions  
**Runtime change:** none; this is an evidence and governance record

## Status vocabulary

| Status | Meaning |
|---|---|
| **Resolved by evidence** | The claim has a reproducible measurement or executable contract and its boundary is explicit. |
| **Resolved by policy** | Ownership or operational policy is explicit, but implementation work remains intentionally deferred. |
| **Technically open** | A concrete implementation or validation gap remains before promotion to operational status. |

## Batch 3 — performance, backends, and ontology

| # | Conclusion | Current resolution | Evidence | Remaining acceptance gate |
|---:|---|---|---|---|
| 1 | FMM is not production-complete. | **Resolved by evidence — decision recorded: retain experimental** | `bench/backend-compare.mjs`, `docs/BACKEND_ENVELOPES.md` §2–3, `tests/unit/fmmParity.test.js`, `src/physics/fmm.js` | None for the current status: near/far accounting, the toroidal cell stencil, and multi-scale error envelopes are measured. Envelope parity (rmsRelative ≤ 0.1 across 32–2048 fixtures) is required before any promotion; FMM stays opt-in and never default while outside the envelope. |
| 2 | WebGPU acceleration is not operational by default. | **Resolved by policy; technically open** | `src/physics/gpuCompute.js`, `tests/e2e/physics-worker.spec.js`, backend architecture tests | Execute browser/device parity tests with an installed Chromium/WebGPU-capable environment and verify resource/error lifecycle behavior. |
| 3 | Barnes–Hut is approximate and must retain the exact solver as reference. | **Resolved by evidence** | `src/physics/octree.js`, `bench/backend-compare.mjs`, `tests/unit/octree.test.js` | Maintain population-scale error/performance envelopes before changing backend selection defaults. |
| 4 | The law registry is complete as a catalogue, but behavioral and relationship depth varies. | **Resolved by evidence; technically open** | `docs/spec/laws/implementation-status.json`, `docs/spec/laws/ontology-coverage.json`, `scripts/check-repository.mjs` | Expand relationship metadata beyond the current 35 laws (lifecycle, structural, shared-state, and extreme-force priorities landed; 101 laws intentionally empty) and keep replacing text-reference evidence with focused semantic tests. |

## Batch 4 — mechanics, audit authority, exports, and tooling

| # | Conclusion | Current resolution | Evidence | Remaining acceptance gate |
|---:|---|---|---|---|
| 5 | Mechanics consolidation is not yet a universal hot-path abstraction. | **Resolved by evidence; partially open** | `docs/MECHANICS_CONSUMER_MATRIX.md`, `src/physics/pairGeometry.js`, mechanics tests | Hot-loop scalar calculations are formally justified as performance-specialized (boundary rule 3). Remaining: optional diagnostic fields for COLL impulse, INERTIA, and TOPOLOGY if a stable inspection API is desired. |
| 6 | Audit prose cannot replace executable behavior tests. | **Resolved by evidence — enforced** | `docs/spec/audit/signoff-manifest.json`, `scripts/validate-signoff.mjs`, `docs/AUDIT_CORPUS_OWNERSHIP.md`, audit inventory, full Vitest suite | Enforced for current sign-offs: every record must classify itself, name its implementation/dispatch, and link an executable test or an explicit not-tested justification (`npm run repository:check`). Provenance per audit stage is validated by `npm run provenance:check`. |
| 7 | Export snapshots have unresolved provenance and consumer ownership. | **Resolved by policy; technically open** | `docs/EXPORT_SNAPSHOT_POLICY.md`, `scripts/repository-artifact-report.mjs`, corrected `exports/README.md` | Map consumers and release dependencies, then choose canonical snapshot, generated CI artifact, archive, or removal. |
| 8 | Historical tooling should not be treated as active verification authority. | **Resolved by policy** | `docs/LEGACY_TOOLING_INVENTORY.md`, artifact inventory, `tests/run.mjs`, `scripts/patch-lawcat-test.mjs` | Preserve recovery path until provenance is no longer needed; remove only after consumer and archive review. |

## Resolution interpretation

The phrase **resolved** in this matrix does not mean every implementation gap is closed. It means the repository now has an explicit, testable statement of what is known, what is intentionally non-operational, and what evidence is required before promotion or cleanup.

### Technically open items

1. FMM envelope parity before promotion (decision: retained experimental, see `docs/BACKEND_ENVELOPES.md` §3).
2. WebGPU browser/device execution validation.
3. Law relationship expansion beyond the prioritized 35 and continued semantic behavior coverage.
4. Universal mechanics hot-path geometry adoption (deliberately deferred; hot-loop scalars are documented as performance-specialized).
5. Export consumer/provenance mapping.

### Policy-resolved items

1. Exact CPU solver remains the reference backend.
2. Audit prose is supporting evidence, not runtime proof.
3. Experimental backends remain opt-in.
4. Historical tools remain retained but outside active verification.
5. Export and audit deletion remain prohibited until provenance review.

## Acceptance rule for future work

A conclusion may move to **Resolved by evidence** only when the repository contains:

- A reproducible command or executable test.
- A clearly identified reference behavior.
- A stated approximation or limitation boundary.
- A documented ownership/source-of-truth decision.
- A validation result that does not depend solely on prose claims.
