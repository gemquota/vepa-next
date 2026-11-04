# Mechanics Consumer Matrix

**Snapshot:** VEPA4 9.1.29

This document records where the Mechanics laws are declared, consumed, inspected, and verified. It is an architecture inventory, not a claim that each law is a complete physical model.

## Consumer matrix

| Capability | Canonical implementation | Runtime consumer | Diagnostic/inspection consumer | Test evidence | Status |
|---|---|---|---|---|---|
| Shared pair geometry | `src/physics/pairGeometry.js` → `getPairGeometry` | `src/physics/solver.js` computes pair scalars in the hot loop | `src/physics/mechanicsDiagnostics.js` | `tests/unit/mechanicsArchitecture.test.js` | Shared boundary established |
| CONTACT correction | `src/physics/lawgroups/mechanicsLaws.js` → `applyContactCorrection` | Solver contact pass; separate from impact impulse | `inspectMechanicsPair` uses the legacy convenience wrapper for isolated inspection | `tests/unit/mechanics.test.js`, `tests/unit/mechanicsArchitecture.test.js` | Runtime-wired and gated |
| COLL impact response | `src/physics/lawgroups/mechanicsLaws.js` → `applyCollisionImpulse` | Solver collision pass | No diagnostic impulse field yet | Mechanics/audit solver tests | Runtime-wired and gated |
| MOMENTUM | `mechanicsLaws.js` → `applyMomentum` | Solver mechanics pass | `inspectMechanicsPair` | Mechanics architecture tests | Runtime-wired and gated |
| WRAP | `mechanicsLaws.js` → `applyWrapBoundary` | Solver boundary pass, gated on `active[LAW_INDEXES.WRAP]` | `diagnoseWrapBoundary` (non-mutating) | `tests/unit/mechanics.test.js` | Runtime-wired and gated; the TOROIDAL EDGES world param seeds the bit |
| TORQUE | `mechanicsLaws.js` → `applyTorque` | Solver mechanics pass | `inspectMechanicsPair` | Mechanics architecture tests | Runtime-wired and gated |
| CONSTRAINT | `mechanicsLaws.js` → `applyConstraint` | Solver mechanics pass | `inspectMechanicsPair` | Mechanics architecture tests | Runtime-wired and gated |
| FRAGMENTATION | `mechanicsLaws.js` → `applyFragmentation` | Solver mechanics pass | `inspectMechanicsPair` | Mechanics architecture tests | Runtime-wired and gated |
| TOPOLOGY | `mechanicsLaws.js` → `applyTopology` | Solver mechanics pass | No dedicated diagnostic field yet | Mechanics/audit solver tests | Runtime-wired and gated |
| ADHESION | `mechanicsLaws.js` → `applyAdhesion` | Solver mechanics pass | `inspectMechanicsPair` | Mechanics architecture tests | Runtime-wired and gated |
| ACCR adjoin path | `mergePhysics.js` → `adjoinParticles` | Solver accretion/contact branch | No dedicated diagnostic path | Merge/solver tests | Runtime-wired; retains two identities |
| Bond/merge classification | `mergePhysics.js` → `isBondedPair`, `mergeParticles`, `applyAlloy` | Solver ACCR/ALLOY and bond exclusion paths | Indirectly visible through particle bond/dead fields | `tests/audit/batch_11.test.js`, merge tests | Runtime-wired |

## Boundary rules

1. `CONTACT` performs geometric separation correction.
2. `COLL` performs impact response and must not be treated as the geometry correction implementation.
3. `getPairGeometry` is the shared scalar boundary for diagnostic and future parity consumers; the solver's equivalent local hot-loop scalars are **performance-specialized** (allocation-free by design) and must stay value-equivalent to `getPairGeometry` for the same pair — verified by `tests/unit/mechanicsArchitecture.test.js`.
4. `mechanicsDiagnostics.js` is opt-in and must not mutate the particle buffer.
5. `mergePhysics.js` owns structural classification and bond hygiene; Mechanics laws do not silently mass-merge particles.
6. Mechanics consumers must use stride constants rather than duplicated offsets.

## Verification boundary

The unit suite verifies isolated geometry, separation-versus-impact semantics, tangential torque, non-merging adhesion, diagnostic immutability, and solver wiring. Browser verification exercises the actual worker shell separately. No claim of conservation, stability under every parameter combination, or physical completeness follows from these contract tests alone.

## Removed capabilities

| Capability | What it was | Why it went |
|---|---|---|
| `INERTIA` (mechanics, law 130) | `mechanicsLaws.js` → `applyInertia`, mass-scaling the accumulated acceleration | It was **imported into `solver.js` and never called** — a dead toggle that duplicated `MASS_INERTIA` (86), which *is* dispatched. Removed in v9.1.29; its slot 130 became `WRAP`. `tests/unit/deadLawToggles.test.js` is the gate that stops this recurring. |

## Follow-up gaps

- Add diagnostic fields for `TOPOLOGY` and the dedicated `COLL` impulse when a stable inspection API is desired.
- Add a browser fixture that toggles Mechanics laws and checks observable worker state transitions.
- Compare exact pairwise output against approximate backends under a fixed fixture before enabling any optional backend by default.
