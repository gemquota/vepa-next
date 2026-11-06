# VEPA Next 9.3.5 atomic integration roadmap

**Baseline:** product v9.3.5 + isolated SIM foundation  
**Execution rule:** one vertical slice per PR, preserve the current product as the reference implementation until parity is demonstrated. No broad rewrites, no default-backend flips based on unit tests alone.

## Priority model

- **P0 — safety / correctness:** data corruption, broken worker fallback, non-determinism, save compatibility, solver invariants.
- **P1 — integration foundations:** explicit contracts between product and SIM without changing default behavior.
- **P2 — feature completeness:** law semantics, relationships, lifecycle and domain systems.
- **P3 — optimization / polish:** measured performance and UI quality after correctness.

## Gate 0 — baseline and evidence

- [ ] G0.1 Record exact product commit, source pin, package version and lockfile hashes.
  - [ ] Capture `git rev-parse HEAD`, `git status --short`, `sha256sum package-lock.json sim-foundation/package.json`.
  - [ ] Store the values in the audit run record; do not hand-edit generated source specs.
- [ ] G0.2 Establish repeatable validation commands.
  - [ ] `npm ci`
  - [ ] `npm run test:all`
  - [ ] `npm run repository:check`
  - [ ] `npm run syntax-check`
  - [ ] `VITE_BASE=/vepa-next/ npm run build`
- [ ] G0.3 Capture a deterministic product golden fixture.
  - [ ] Fixed seed, fixed world params, fixed DNA, fixed law mask.
  - [ ] Record positions, velocities, mass, energy, alive count and offspring at N fixed ticks.
  - [ ] Define float tolerances and stable ordering before comparing implementations.
- [ ] G0.4 Add a real-browser CI smoke test.
  - [ ] Launch built app under the Pages base path.
  - [ ] Assert boot completes and canvas has non-zero dimensions.
  - [ ] Assert at least one physics tick completes.
  - [ ] Assert worker and main-thread fallback paths independently.
  - [ ] Capture desktop and narrow/mobile viewport screenshots.
- [ ] G0.5 Make validation and publication separate workflows.
  - [ ] Validation workflow has read-only repository permissions and no deploy action.
  - [ ] Release workflow requires an explicit release trigger/environment approval.
  - [ ] Confirm Pages source/ref and deployed commit provenance before publishing.

## Gate 1 — contracts and ownership

- [ ] G1.1 Write a stable law-ID mapping between product and SIM.
  - [ ] Enumerate all 136 product law IDs from `src/constants/laws.js`.
  - [ ] Enumerate SIM law IDs from its canonical registry.
  - [ ] Map exact matches, renamed semantics, product-only, SIM-only and deprecated IDs.
  - [ ] Reject duplicate IDs and numeric-index assumptions in a contract test.
- [ ] G1.2 Specify particle layout compatibility.
  - [ ] Enumerate every product stride field and its units/meaning.
  - [ ] Enumerate SIM layout fields, types, alignment and identity semantics.
  - [ ] Define explicit conversion functions with range/finite-value checks.
  - [ ] Add round-trip fixtures and unknown-field handling.
- [ ] G1.3 Define worker boundary adapter.
  - [ ] Document product INIT/CONFIG/TICK/RESTORE protocol.
  - [ ] Document SIM INIT/STEP/CONFIGURE/SNAPSHOT/RESTORE protocol.
  - [ ] Define versioned request/response envelopes and error taxonomy.
  - [ ] Add contract tests for malformed, duplicate, stale and out-of-order messages.
- [ ] G1.4 Define random-stream ownership.
  - [ ] Identify every product PRNG consumer.
  - [ ] Identify SIM seed and named streams.
  - [ ] Specify deterministic stream allocation and replay serialization.
  - [ ] Add same-seed repeatability and stream-isolation tests.
- [ ] G1.5 Define persistence conversion.
  - [ ] Document product save schema v1 fields and optional extensions.
  - [ ] Document SIM snapshot schema and typed-array codecs.
  - [ ] Implement read-only product→SIM and SIM→product converters behind explicit adapters.
  - [ ] Add round-trip, truncated payload, invalid numeric and unknown-version fixtures.
  - [ ] Do not change default save writer until converters are proven.

## Gate 2 — simulation correctness and energy evidence

- [ ] G2.1 Build a solver phase contract.
  - [ ] Name force, constraint, integration, lifecycle and post-tick phases.
  - [ ] Specify which arrays each phase may read/write.
  - [ ] Specify ordering dependencies and whether each phase is per-particle, per-pair or cadence-driven.
  - [ ] Assert no UI/render state is mutated by solver phases.
- [ ] G2.2 Connect energy ledger to real work.
  - [ ] Trace force evaluation to per-particle work contributions.
  - [ ] Define kinetic/potential/internal/field energy ownership.
  - [ ] Reconcile boundary, collision, damping, reproduction and death energy terms.
  - [ ] Add closed-system and intentionally dissipative fixtures.
  - [ ] Report residuals with tolerances; never silently clamp evidence to zero.
- [ ] G2.3 Verify integrator and timestep policy.
  - [ ] Compare current product integration against SIM velocity-Verlet fixtures.
  - [ ] Define stable timestep ranges per force family.
  - [ ] Add high-force, close-contact, extreme-mass and toroidal-boundary stress fixtures.
  - [ ] Preserve the current integrator until parity and stability criteria pass.
- [ ] G2.4 Verify periodic boundary semantics.
  - [ ] Compare product minimum-image wrapping with SIM periodic image/Ewald paths.
  - [ ] Add particles straddling each face/edge/corner.
  - [ ] Measure force continuity across boundaries.
  - [ ] Define which long-range forces require Ewald treatment versus approximation.
- [ ] G2.5 Harden contacts and structural mechanics.
  - [ ] Keep CONTACT correction distinct from COLL impulse.
  - [ ] Verify momentum/energy deltas for elastic and dissipative collisions.
  - [ ] Verify constraint solver convergence and bounded correction.
  - [ ] Verify ACCR identity preservation and ALLOY identity/fusion semantics.
  - [ ] Add dense-contact and high-speed tunneling fixtures.

## Gate 3 — law and ontology quality

- [ ] G3.1 Resolve the two implemented-but-not-gated laws.
  - [ ] BUOYANCY: identify intended consumer, gate and physical sign/unit convention.
  - [ ] SENESCENCE: identify lifecycle cadence and age/health semantics.
  - [ ] Add solver-level tests; otherwise explicitly deprecate or mark unconditional.
- [ ] G3.2 Resolve ELECTRIC_FIELD metadata-only status.
  - [ ] Decide whether it is a distinct field producer or redundant with FIELD/CHARGE_LAW.
  - [ ] If implemented, define field storage, boundary behavior, units and solver consumer.
  - [ ] If not implemented, preserve metadata-only classification and adjust UI/help claims.
- [ ] G3.3 Expand law ontology.
  - [ ] Start with energy, mechanics, field, reproduction and lifecycle dependencies.
  - [ ] For each relationship, record direction, rationale and runtime consumer.
  - [ ] Reject self-links, duplicates, unknown laws and ungrounded reciprocal claims.
  - [ ] Add consumer tests for high-risk relationships before expanding breadth.
- [ ] G3.4 Replace textual law evidence with semantic tests.
  - [ ] Identify each law's parameter units/ranges and invariants.
  - [ ] Test enabled-vs-disabled behavior with controlled fixtures.
  - [ ] Test extreme but finite parameters and NaN/Infinity guards.
  - [ ] Test representative multi-law interactions and conflict ordering.
- [ ] G3.5 Audit approximations and backend envelopes.
  - [ ] Exact CPU remains reference.
  - [ ] Barnes–Hut: population-scale force error and DNA modifier omission documented.
  - [ ] FMM: retain experimental while RMS error exceeds the agreed envelope.
  - [ ] WebGPU: run device parity and device-loss recovery on actual hardware.
  - [ ] No approximate backend becomes default without measured acceptance evidence.

## Gate 4 — product feature integration

- [ ] G4.1 Integrate deterministic random streams behind a compatibility adapter.
  - [ ] Add explicit seed/stream state to world session metadata.
  - [ ] Preserve existing product seeded runs with a compatibility mode.
  - [ ] Migrate spawn, mutation, stochastic laws and world events one consumer at a time.
- [ ] G4.2 Integrate stable particle identities.
  - [ ] Add ID allocation without changing array index semantics in the first step.
  - [ ] Define ID behavior for ACCR, ALLOY, fragmentation, death and restore.
  - [ ] Add identity-to-lineage and identity-to-relationship tests.
- [ ] G4.3 Integrate event journal incrementally.
  - [ ] Begin with birth/death, law/config changes, world reset and save/restore events.
  - [ ] Keep events append-only and versioned.
  - [ ] Add replay tests before making the journal authoritative.
- [ ] G4.4 Integrate snapshots and replay.
  - [ ] Map typed-array snapshots to product save state.
  - [ ] Add periodic checkpoint and deterministic replay fixtures.
  - [ ] Validate restoration across app reload and schema migration.
- [ ] G4.5 Integrate worker adapter only after protocol parity.
  - [ ] Keep product worker as production path initially.
  - [ ] Add adapter behind a runtime feature flag.
  - [ ] Compare state hashes after N ticks across both worker paths.
  - [ ] Test cancellation, disposal, worker failure and fallback.
- [ ] G4.6 Integrate spatial grid and periodic solver features.
  - [ ] Benchmark current grid against SIM grid at identical fixtures.
  - [ ] Preserve exact neighbor coverage; no silent capped-neighbor truncation.
  - [ ] Add periodic image/Ewald only for force families with demonstrated need.
- [ ] G4.7 Integrate numerics and advanced physics selectively.
  - [ ] Build per-feature parity fixture and dimensional analysis.
  - [ ] Validate conservation, stability and bounded approximation.
  - [ ] Reject features that only duplicate current law semantics or increase hot-loop cost without measurable benefit.

## Gate 5 — social/ecological depth and user-facing fidelity

- [ ] G5.1 Add sparse relationship graph with stable pair IDs.
  - [ ] Define edge schema, directionality, type and decay.
  - [ ] Add bounded storage, indexing and pruning.
  - [ ] Add serialization, restore and pair-history tests.
- [ ] G5.2 Add explicit kin recognition and care.
  - [ ] Derive kin from lineage with configurable recognition falloff.
  - [ ] Add caregiving and resource transfer as explicit events.
  - [ ] Test against predation, competition and population caps.
- [ ] G5.3 Improve mating/reproductive architectures.
  - [ ] Separate compatibility, mate choice, courtship and reproduction outcomes.
  - [ ] Model unary/binary/multi-parent/budding/fragmentation/colony strategies as explicit modes.
  - [ ] Preserve the current REPRO path as baseline until parity is documented.
- [ ] G5.4 Promote structures from social records to physical objects.
  - [ ] Define structural body state, footprint/field occupancy and material budget.
  - [ ] Connect construction to collision/field boundaries.
  - [ ] Add ownership, upkeep, damage, collapse and salvage tests.
- [ ] G5.5 Add group federation and polity lifecycle.
  - [ ] Define membership, jurisdiction, succession and dissolution.
  - [ ] Connect resource transfers and cultural transmission to explicit edges.
  - [ ] Test split/merge and member turnover across epochs.
- [ ] G5.6 Improve UI evidence and accessibility.
  - [ ] Preserve the existing aesthetic and density while making status/action hierarchy clear.
  - [ ] Verify every generated UI control against a live state transition.
  - [ ] Add keyboard, touch target, narrow viewport and reduced-motion checks.
  - [ ] Capture reference screenshots for setup, world states, data and mobile layouts.

## Gate 6 — performance and release

- [ ] G6.1 Establish benchmark matrix.
  - [ ] Particle counts: small, nominal, stress and upper-bound.
  - [ ] Law masks: baseline, mechanics-heavy, biology-heavy and all-enabled stress.
  - [ ] Backends: exact, Barnes–Hut, FMM, WebGPU when available.
  - [ ] Record median/p95 tick time, allocation/GC, force error and memory.
- [ ] G6.2 Protect hot-loop constraints.
  - [ ] No per-pair object allocation.
  - [ ] Reuse typed scratch buffers and spatial structures.
  - [ ] Keep branch-heavy optional backends outside the exact pair loop where possible.
  - [ ] Require benchmark evidence for any abstraction or dispatch change.
- [ ] G6.3 Verify compatibility matrix.
  - [ ] Existing v9.3.5 worlds load unchanged.
  - [ ] Old saves either migrate explicitly or fail with actionable errors.
  - [ ] ArrayBuffer fallback works without cross-origin isolation.
  - [ ] SharedArrayBuffer worker path works with COOP/COEP.
  - [ ] Desktop/mobile viewport and touch interaction remain functional.
- [ ] G6.4 Release gate.
  - [ ] Full tests, repository checks, syntax checks and production build pass.
  - [ ] Browser smoke and screenshots are attached to the release record.
  - [ ] Source pin and deployed commit are identical and visible.
  - [ ] Deploy only through an explicit release workflow/environment approval.

## PR slicing policy

- PRs should deliver 1–3 related vertical slices, not 10–20 unrelated toggles.
- Every PR must state: baseline SHA, behavior changed, compatibility risk, focused tests, full checks, benchmark delta (if hot path), and rollback strategy.
- Never merge a migration adapter merely because its own contract tests pass; product parity must be measured.
- Keep exact CPU behavior and existing saves recoverable until the new path has passed deterministic, numeric and browser gates.
