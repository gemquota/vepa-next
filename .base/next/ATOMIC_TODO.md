# Atomic hierarchical implementation checklist

Legend: [ ] open · [~] in progress · [x] verified complete. A parent is complete only when every required child is verified.

## R0 — Source truth and baseline
- [ ] R0.1 Pin repositories
  - [ ] Record stable commit and root tree SHA.
  - [ ] Record consolidation commit/tree SHA.
  - [ ] Record Next baseline commit/tree SHA.
  - [ ] Reconcile package, VERSION, changelog, README and generated spec.
  - [ ] Generate source path/blob manifest for production, UI, assets and tests.
- [ ] R0.2 Execute stable baseline
  - [ ] Clean dependency install from lockfile.
  - [ ] Run unit and audit suites; preserve logs.
  - [ ] Run syntax, repository consistency and spec checks.
  - [ ] Run production build.
  - [ ] Run browser and worker E2E.
  - [ ] Run CPU/GPU/worker benchmarks where available.
  - [ ] Record runtime, browser, OS, hardware, durations and results.
- [ ] R0.3 Capture UI baseline
  - [ ] Desktop screenshots: boot, running, paused, laws, world, species/DNA, save/load, debug.
  - [ ] Tablet screenshots.
  - [ ] Mobile screenshots.
  - [ ] Record panel labels, order, drawer behavior, camera gestures and control defaults.
- [ ] R0.4 Trace runtime
  - [ ] Trace bootstrap imports and initialization order.
  - [ ] Trace exact simulation tick function order.
  - [ ] Trace worker protocol and main-thread fallback.
  - [ ] Trace renderer and sprite synchronization.
  - [ ] Trace UI commands to state mutation and worker update.
  - [ ] Trace save/load and preset lifecycle.
  - [ ] Trace intelligence engine cadences and event wiring.
- [ ] R0.5 Reconcile consolidation
  - [ ] Import historical migration ledger entries.
  - [ ] Compare V5 runtime inventory with stable source.
  - [ ] Compare V5 correctness/UI findings with stable source.
  - [ ] Compare vepa4 and vepa-v3 findings where relevant.
  - [ ] Classify every capability: implemented, partial, missing, obsolete or unsafe.
  - [ ] Record unresolved conflicts.

## R1 — Browser application shell
- [ ] R1.1 Recreate document shell and bootstrap.
- [ ] R1.2 Port style tokens, fonts, layout and responsive panel primitives.
- [ ] R1.3 Port event bus and lifecycle.
- [ ] R1.4 Port debug overlay, bounded log, copy/export.
- [ ] R1.5 Add boot/teardown and recoverable/fatal error states.
- [ ] R1.6 Port canonical constants, law IDs, particle layout and DNA schema.
- [ ] R1.7 Port world/runtime config schema and defaults.

## R2 — Core world vertical slice
- [ ] R2.1 Particle buffer allocation/accessors.
- [ ] R2.2 Particle lifecycle, death and safe slot reuse.
- [ ] R2.3 Spawn distribution and initial population.
- [ ] R2.4 Species registry and identity.
- [ ] R2.5 Packed species DNA and trait decoding.
- [ ] R2.6 Genotype expression and phenotype.
- [ ] R2.7 Core mechanics and force dispatch.
- [ ] R2.8 Gravity, charge and electromagnetic interactions.
- [ ] R2.9 Drag, damping and boundaries.
- [ ] R2.10 Collision/contact correction and merge/accretion.
- [ ] R2.11 Spatial grid and source-required octree/FMM.
- [ ] R2.12 Field sampling and base environment.
- [ ] R2.13 Worker protocol, init/config/tick/result.
- [ ] R2.14 Main-thread fallback and worker/local parity.
- [ ] R2.15 Renderer, sprite sync and camera.
- [ ] R2.16 HUD and visible live evolution in real browser.

## R3 — Laws and environment
- [ ] R3.1 Port every law group with stable IDs.
- [ ] R3.2 Port synergy/coupling rules.
- [ ] R3.3 Audit all 136 law entries for executable dispatch.
- [ ] R3.4 Disposition dead, metadata-only and unsafe laws explicitly.
- [ ] R3.5 Add per-law fixtures and toggle tests.
- [ ] R3.6 Port fields, wells, portals and wall presets.
- [ ] R3.7 Port environment UI and worker synchronization.
- [ ] R3.8 Port law categories, icons, help and counts.
- [ ] R3.9 Port search/filter, bulk toggles and shared selection if source supports them.
- [ ] R3.10 Verify every enabled control produces observable mechanics.

## R4 — Config and persistence
- [ ] R4.1 Port staged/pending world settings.
- [ ] R4.2 Port safe restart/commit transaction.
- [ ] R4.3 Port preset candidate validation and atomic apply.
- [ ] R4.4 Port world save schema and migrations.
- [ ] R4.5 Port import/export validation and save slots.
- [ ] R4.6 Port undo/history/timeline restore.
- [ ] R4.7 Test round-trip, continuation and rollback on failure.

## R5 — Intelligence and ecology
- [ ] R5.1 Insight/cluster detection.
- [ ] R5.2 Narrative engine and bounded logs.
- [ ] R5.3 Lineage tracking.
- [ ] R5.4 Goal engine and behavior.
- [ ] R5.5 Timeline snapshots and scrubbing.
- [ ] R5.6 Engine cadences/event bus wiring.
- [ ] R5.7 Communication DNA traits and oscillator emission/decay.
- [ ] R5.8 Channel filtering and signal exchange.
- [ ] R5.9 Signal response force, energy and memory.
- [ ] R5.10 Ecology metrics/population curves.
- [ ] R5.11 Speciation, biodiversity, food webs and niches.
- [ ] R5.12 Reversible world events and ecology UI.

## R6 — Civilization and culture
- [ ] R6.1 Group detection, registry, roles and membership.
- [ ] R6.2 Nests/hives/roads and construction.
- [ ] R6.3 Treasury, trade and market prices.
- [ ] R6.4 Group collapse and lifecycle.
- [ ] R6.5 Species/group memory buffers and cultural inheritance.
- [ ] R6.6 Governance policies, alliances, conflict, migration and commerce.
- [ ] R6.7 Tools, weapons, barriers, infrastructure and energy flows.
- [ ] R6.8 Bounded agency and reversible actions.
- [ ] R6.9 Civilization and group analytics panels.

## R7 — Advanced matter
- [ ] R7.1 Exotic matter states/interactions.
- [ ] R7.2 Relativity, curvature, time dilation and mass-energy.
- [ ] R7.3 Quantum superposition, entanglement and tunneling.
- [ ] R7.4 Stellar seeding, fusion, black holes and supernovae.
- [ ] R7.5 Synthetic-life frontier and remaining advanced laws.
- [ ] R7.6 Per-system bounds, conservation, determinism and performance tests.

## R8 — Multiplex and tooling
- [ ] R8.1 Multiplex shard lifecycle and isolation.
- [ ] R8.2 Shard fitness, evolution and selection.
- [ ] R8.3 Benchmark CLI and report.
- [ ] R8.4 Performance controls/auto-tune and diagnostics.
- [ ] R8.5 Developer inspection and debug exports.

## R9 — Release
- [ ] R9.1 Full desktop/tablet/mobile browser E2E.
- [ ] R9.2 Worker host headers and fallback verification.
- [ ] R9.3 Save/load, preset, reset and long-run recovery.
- [ ] R9.4 Performance and memory soak tests.
- [ ] R9.5 Capability matrix and known limitations reconciled.
- [ ] R9.6 Deploy only after manual browser exercise and green release gates.
