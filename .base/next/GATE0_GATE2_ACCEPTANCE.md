# Gate 0 and Gate 2 acceptance evidence

Baseline: VEPA product 9.3.5 and the isolated SIM foundation. This document describes repeatable evidence; it does not claim cross-platform bitwise floating-point identity or promote SIM to the production backend.

## Gate 0 — baseline and evidence

### G0.1 immutable baseline
`npm run baseline:capture` writes `.artifacts/baseline-run.json` with the checked-out commit, branch, clean-worktree assertion, product/SIM package versions, and SHA-256 hashes of the lockfile and SIM package manifest. The CI artifact is commit-scoped. A dirty checkout fails rather than producing ambiguous provenance.

### G0.2 validation commands
The validation workflow executes, in order: `npm ci`, baseline capture, product golden capture, `npm run test:all`, `npm run repository:check`, `npm run syntax-check`, `VITE_BASE=/vepa-next/ npm run build`, Chromium installation, and the built-Pages browser suite. The workflow has read-only repository permissions and no deployment step.

### G0.3 product golden fixture
`npm run golden:capture` executes the production product solver (not the SIM solver) with a fixed seed, fixed four-particle state, fixed gravity law mask, fixed world size and timestep. It records Float32 state hashes, kinetic energy, momentum, live count and offspring count at ticks 1, 2, 4, 8 and 16. Two independent runs must match bit-for-bit in the same runtime. The captured JSON is retained as a CI artifact, not committed as a machine-independent numerical promise.

The fixture is deliberately narrow: it is a baseline sentinel for solver determinism and state drift, not proof that every law or backend is deterministic.

### G0.4 browser smoke
The production-preview suite serves the built app under `/vepa-next/`, checks successful boot, non-zero canvas dimensions and live tick progression, then tests both the isolated SharedArrayBuffer worker path and the main-thread path with Worker unavailable. Desktop and narrow/mobile screenshots are retained as test artifacts.

### G0.5 validation/release separation
The pull-request/push validation workflow is read-only and never deploys. `.github/workflows/release-pages.yml` is dispatch-only, requires a full expected commit SHA matching the selected ref, and targets the `github-pages-release` environment so repository environment protection can require human approval. It builds and publishes the exact checked-out SHA only after release validation. The workflow is added but is not invoked by this PR.

## Gate 2 — physics correctness and energy evidence

### G2.2 energy ownership and reconciliation
- Kinetic energy is measured from live mass/velocity slots.
- Gravity and electric potential belong to the force model that generated the pair force; the budget is independently recomputed from positions and the declared softened/cutoff profile.
- Thermal, chemical, phase, radiation, rest-mass and dissipation transfers are internal ownership flows recorded in the energy ledger. Transfers move a signed amount between named accounts; they do not create or destroy the ledger's total balance.
- Reflective-wall impulses and toroidal coordinate wraps are solver-boundary evidence. A toroidal coordinate remap performs zero work. A stationary reflective wall changes momentum but performs zero work in this model.
- Inelastic contact loss is measured from pre/post collision kinetic energy and transferred to thermal ownership. Elastic contact must not emit a dissipation transfer.
- Reproduction/death/accretion lifecycle changes remain lifecycle-audit events. They are not silently folded into conservative pair potential; a complete world-energy claim requires explicit source/sink terms for those transitions.
- Residuals are reported, never clamped to zero. The closed gravity fixture uses velocity-Verlet and compares independent before/after budgets against the force-work journal. The inelastic fixture checks momentum conservation and exact kinetic-to-thermal transfer.

### G2.3 integrator and timestep evidence
The production default is unchanged. Tests compare velocity-Verlet trajectories at successively halved timesteps against a fine-step reference, and stress close contacts, high force, extreme mass ratios and periodic corners. These are fixture-specific acceptance envelopes. They are not universal CFL limits: extended laws, contacts and state-dependent force discontinuities require their own measured limits.

### G2.4 periodic boundary semantics
Minimum-image tests cover face, edge and corner crossings, equal/opposite pair forces, and invariance under a common periodic translation. Ewald remains a separate point-particle periodic Poisson model with explicit neutrality policy and empirically truncated real/reciprocal sums. Truncation comparisons are diagnostics, not certified error bounds. Minimum-image and Ewald potentials must not be compared as if they were the same model.

### G2.5 contacts and structural mechanics
Positional CONTACT correction is separate from velocity-level COLL impulses. Tests cover mass-weighted center-of-mass preservation, elastic momentum/kinetic conservation, inelastic momentum conservation and explicit thermalized loss. Structural identity/fusion semantics remain governed by the separate identity/ontology contracts; a contact projection alone does not establish ACCR or ALLOY identity behavior.
