# RB Roadmap Progress — 2026-10-12

**Authority:** `VEPA_Roadmap_v4-5.md` (now present at repository root) contains the accepted product decisions and controls where earlier RB proposal text differs. `docs/ROADMAP_V4.md` is a companion acceptance target; `docs/spec/rb/MASTER_SPEC.md` remains a proposed architecture subordinate to both. This tracker reports evidence in the current tree, not completion by documentation or compilation alone.

## Summary

**No RB section (00–11) is complete end-to-end.** The repository has useful groundwork and partial slices, but the proposal's acceptance gate requires observable/browser evidence, complete restart-only configuration, the selected GPU-rendered 3D direction, and modular boundaries. None can be marked complete on the present evidence. The existing Canvas2D/Pixi renderers are not the selected GPU-rendered 3D target. DOM-stub tests are not browser parity evidence.

### Completed roadmap groundwork (verified in source/docs)

- [x] Five named launch scenarios and deterministic text-to-seed retention are documented and covered by `tests/unit/roadmapLaunchFoundation.test.js`.
- [x] Particle, law, DNA and world-parameter schemas have source-of-truth modules and generated inventory/spec outputs.
- [x] Local worker/main-thread execution and existing save/undo surfaces are present; this is baseline coverage, not the proposed adapter/transaction architecture.
- [x] Laws have broad unit/audit coverage and a generated technical-spec tree. Coverage is not a claim of scientific fidelity; remaining per-law audit gaps still apply.
- [x] Shared system-roadmap catalog and lifecycle groundwork (48 variants, 47 relationships, connected topology and bounded replay artifacts) are described in `README.md`/`SPEC.md`; retain their documented scope and do not equate them with RB module extraction.

### Partial implementation (do not mark complete)

- [ ] WORLD parameter, law-grid, and ordinary DNA slider edits stage to restart; default Chaos includes laws, WORLD and active-species DNA. Chaos-only sampling bounds are WORLD_SIZE 50–240 in 10-unit increments (the WORLD slider step remains 100) and PARTICLE_COUNT/MAX_POP ≤300, INITIAL_POP ≤120; WORLD/DNA slider ranges are unchanged. Full preset loads, selective Chaos, autonomous actions, species-roster operations, and some compute/configuration paths still bypass global staging. Proposals are session-only and do not provide full provenance/replay transaction semantics.
- [ ] Contact, structures and solver coverage improved in v9.3.3; uniform full-height initial/background Z spawn and DNA-slider restart staging are added in v9.3.4. This does not establish dense-packing, continuous-collision, fidelity, frame-rate, or browser acceptance.
- [ ] UI overhaul, technical-spec generation and source inventory provide groundwork only; the orchestrator and several UI/solver modules remain concentrated/monolithic.

## RB sections 00–11 — completion gates

A section is checked only when its listed outcome and relevant verification evidence are complete. Subtasks are deliberately granular so work can be resumed without treating a partial slice as a completed section.

- [ ] **00 — Current program baseline:** record current mobile-first screenshots and interactions in a real browser; characterize five starter worlds, seed provenance, saves/undo and fallbacks; reconcile the source baseline to current HEAD.
- [ ] **01 — Shell and orchestrator:** extract a composition/session boundary from `src/main.js`; route commands through owned state services; characterize boot, restart, error and teardown behavior.
- [ ] **02 — Visual shell and UI:** define module ownership/read models; complete keyboard/touch/responsive behavior and real-browser parity across drawers, panels and settings; DOM stubs alone do not pass.
- [ ] **03 — World parameter system:** stage every physics-affecting setting in Easy and Advanced modes; reversible/round-tripping recipe model; coherent provenance, confirmation, undo, save and migration behavior.
- [ ] **04 — Species and genome:** stage all DNA edits and genome operations; verify all 64 traits, species creation/selection, persistence and migration without active-run mutation.
- [ ] **05 — Laws and fidelity:** make every law change restart-only across all entry points; close prioritized audit gaps with dispatch, behavior, stability and dependency evidence; no inert toggles.
- [ ] **06 — Physics and performance:** separate solver stages behind contracts; measure representative population/density/law workloads; document approximations and prove adaptation never changes simulation outcomes silently.
- [ ] **07 — Execution and cloud transport:** define provider-neutral compute contract, ordering/versioning/backpressure/recovery/security; retain local fallback. Remote execution is optional and not implemented by this proposal.
- [ ] **08 — Local rendering and visualization:** deliver roadmap-selected GPU-rendered 3D, explicit correctness-preserving capability fallback, and mobile/browser visual acceptance. Current 2D rendering does not satisfy this.
- [ ] **09 — State, presets and persistence:** unify configuration transactions, preset/world/save migration, provenance, replay and undo; ensure staged edits never leak into current-world saves.
- [ ] **10 — Emergent systems and observability:** establish stable subsystem ownership and read-only analytics projections; verify deterministic event/replay evidence and bounded user-visible actions.
- [ ] **11 — Module packages and integration:** define manifests/ports and cycle/ownership validation; isolate module tests; ship one integrated package with migration/rollback and parity gates.

## Next actionable todo lists

### P0 — Finish global configuration safety

- [ ] Inventory every UI, preset, chaos, narrative/goal, worker/backend and autonomous write path that can change physics outcomes.
- [x] Route ordinary DNA slider edits from the DNA and species panels through a session-only candidate batch; display per-species proposal details and support discard/confirmed restart. Restart commits after compute stops and before population spawn/worker init. Targeted controller tests cover validation, clamping, reversion, pause isolation, discard/restore and ordering. This does not stage presets, roster edits, selective Chaos, autonomous paths or other direct writers.
- [ ] Route preset loads, selective Chaos, and autonomous/configuration edits through the same candidate configuration/restart boundary; extend DNA staging to genome operations and define cross-source merge semantics.
- [ ] Decide and implement save/provenance/undo/replay semantics for proposed versus committed configuration; preserve launch input and derived seed.
- [ ] Add integration tests for pause, restart, worker stop ordering, undo/restore, save/load, and each configuration source.

### P1 — Establish browser baseline and acceptance

- [ ] Restore/run a real-browser test environment and verify launch → simulation → WORLD/law/DNA edit → discard/restart → save/restore flows.
- [ ] Capture mobile-first screen/interaction baselines and verify renderer, fallbacks, keyboard/touch, and responsive drawer states.
- [ ] Add a dedicated app-level test for new restart-staged control flows; existing DOM-stub coverage is not a substitute.

### P2 — Incremental architecture extraction

- [ ] Characterize APIs/events and state ownership before moving code; keep legacy facades during extraction.
- [ ] Extract pure schemas/helpers, then session/state transactions, UI read models, solver stages, and backend/render adapters in that order.
- [ ] Add per-boundary contract and migration tests; after each extraction run all repository gates and compare deterministic fixtures.

### P3 — GPU renderer / platform decisions

- [ ] Specify GPU 3D implementation and correctness-preserving fallbacks against the accepted roadmap; do not choose APIs or relax product requirements silently.
- [ ] Define mobile capability/performance matrix, visual acceptance, GPU loss/recovery behavior and metrics.
- [ ] Keep optional remote compute behind the same contract and require explicit approval for provider, data/security/cost and recovery choices.

### P4 — Release gates

- [ ] Close relevant law audits and classify each remaining approximation/known issue.
- [ ] Verify deterministic replay, numerical stability/conservation where applicable, save migrations, performance workload matrix, browser smoke and rollback.
- [ ] Update this tracker only with source/test/browser evidence; then sync release docs and version markers before an authorized release.

## Accepted roadmap crosswalk

The product roadmap has explicit acceptance targets that are not all equivalent to RB sections. Current evidence supports these limited check-offs:

- [x] **Starter setup foundation:** five named starter scenarios and deterministic text-to-seed retention are implemented and covered by `tests/unit/roadmapLaunchFoundation.test.js`; preset preview/custom-save behavior still needs evidence.
- [ ] **Global restart-only configuration:** law edits, selected WORLD edits, and ordinary DNA slider edits stage, but full preset loads, selective Chaos, autonomous actions, species-roster operations and some compute settings remain live paths; proposed configuration provenance/replay is incomplete.
- [ ] **Physics sandbox / emergence ladder acceptance:** unit/audit coverage is broad, but end-to-end reproducible rung transitions and real-browser evidence have not been established.
- [ ] **Save, migration, recovery and replay acceptance:** current save/undo surfaces exist, but the roadmap's full configuration/event provenance, migration, corruption recovery and replay-compatibility guarantees remain unverified.
- [ ] **Mobile-first tutorial and spoiler-safe progression:** no verified sub-two-minute tutorial or progression-spoiler gate is present in the evidence reviewed.
- [ ] **GPU-rendered 3D and visual acceptance:** current Canvas2D/Pixi visualization is not the accepted GPU 3D direction; mobile/browser fallback behavior is not accepted yet.
- [ ] **Experimental isolation, privacy/unlisted sharing and hosted operations:** mark unverified/not implemented pending feature-specific evidence; do not claim hosted economies, rollback, security or privacy acceptance from the architecture proposal.

## Verification record

- Source baseline: v9.3.4 release commit `534cfdb` on `main`, based on `34d5592` (`chore(roadmap): preserve roadmap baseline and track evidence-gated progress`); tag `v9.3.4` pushed to `origin`; pre-release branch `backup/pre-v934-release-20261012`. This release adds uniform full-height spawn Z, removes GROUND_HEIGHT, clarifies Chaos granularity, and stages ordinary DNA slider edits.
- Verification: focused spawn/Chaos/DNA tests pass (5 files, 29 tests); full Vitest passes (144 files, 1,571 tests); `npm run syntax-check` passes; `npm run repository:check` passes (spec 180 files, 136 laws, ontology/provenance/signoff and UI report); `npm run build` passes with existing >500 kB chunk warning; `git diff --check` passes.
- Real-browser status: not verified; Chromium cannot load host library `libglib-2.0.so.0`.
- Deployment: Freebuff `https://v5.freebuff.app/` reports `active` after this release (static Vite, 118 files, zero unresolved build errors). Hosting status does not expose the source commit hash; browser acceptance remains unverified.
