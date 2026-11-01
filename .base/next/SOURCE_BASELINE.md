# Source baseline and repository audit

## Immutable starting pins

| Role | Repository | Branch | Commit |
|---|---|---|---|
| Main code base | `gemquota/vepa` | `master` | `24b56aff316d6de5a960943d6bcb9192a8d569ce` |
| Consolidation findings | `gemquota/vepa-consolidation` | `main` | `2100e4b0667b98b3e9b5ac9af955ab217b370c41` |
| Existing Next baseline | `gemquota/vepa-next` | `main` | `08b498832d95fae2e9da3ff887e76849e2661050` |

These are initial pins captured during this rebuild. Re-pin and record the tree SHA before implementation begins. Do not use a moving branch name as provenance.

## Repository shape

- `vepa`: 1,949 Git tree entries at the inspected current tree; full browser application, source, tests, documentation, audits, generated specs, legacy archives and operational scripts.
- `vepa-next`: 176 Git tree entries; modular simulation contracts, worker prototype, law matrix prototype, tests and extensive architecture/migration docs. It is not a full recreation of the stable browser application.
- `vepa-consolidation`: 33 Git tree entries; source register, migration ledger, V5 review, repository review, archive integrity and policy documents.

## Baseline product inventory from stable README and source tree

### Runtime and simulation
- Particle state in typed-array buffer; species DNA and phenotype/expression.
- 136 indexed law slots, grouped into physics, biology, chemistry, electromagnetism, thermodynamics, information, metaphysics and quantum categories.
- Pair mechanics, collision/contact correction, accretion, fields, spatial grid and octree/FMM acceleration.
- Deterministic PRNG infrastructure; inspect every random consumer before asserting deterministic replay.
- Worker solver with SharedArrayBuffer path and non-isolated fallback.
- World parameters, runtime config, law state, presets and world-save envelope.

### Rendering and interaction
- Canvas2D renderer and sprite synchronization.
- Camera controls, zoom/depth handling, HUD, tooltips, debug overlay.
- Law, world, settings, species, DNA, ecology, intelligence, narrative, preset and save panels.
- Multiplex UI and benchmark/report surfaces.
- Existing visual identity is defined by `style.css`, `index.html`, panel markup and screenshots; preserve it as the design baseline.

### Higher-level engines and systems
- Insight/cluster detection, narrative, lineage, goals, timeline and world events.
- Communication DNA and signal exchange.
- Ecology, speciation, biodiversity, food webs, niches and reversible world events.
- Civilization groups, roles, construction, roads/nests, trade, governance, alliances, conflict, infrastructure and treasury.
- Deep time/epochs, memory/culture, agency and artifacts.
- Exotic matter, relativity, quantum macroscale, stellar physics and multiplex shards.

This is an inventory of advertised/source-present systems, not proof every toggle is currently wired or every feature is healthy. Each item must be source-audited and executed.

## Consolidation findings to reconcile

The consolidation repository's 2026-10-21 register names DayneK/vepa as a newer candidate, while this user-directed rebuild explicitly selects the current `gemquota/vepa` repository as the implementation base. Therefore:
1. Use gemquota/vepa for the initial copy and behavioral baseline.
2. Use consolidation as a gap/history/porting ledger, not as a reason to silently switch source authority.
3. Inspect its additional reviews for features or fixes absent from gemquota/vepa.
4. Compare V5 runtime and correctness/UI rework separately.
5. Re-pin all source repos before each migration batch; source pins in old consolidation docs may be stale.

Known risks called out by consolidation:
- Version metadata may disagree across README, package, VERSION, changelog and generated spec.
- Seeded PRNG alone does not prove deterministic simulation; audit random calls, mutation order, worker handoff, GPU/CPU behavior and external inputs.
- Configuration staging and restart transactions have historically been partial.
- Contact correction has bounded convergence and may leave residual overlap in dense packing.
- Presence of tests/scripts is not evidence they were run.
- Generated registries/specs need one-way authority to avoid duplicated facts.
- Archive integrity must be verified before recovery use.

## Required baseline capture

Before changing mechanics:
- [ ] Record exact source commit and tree SHA.
- [ ] Record package/version/build metadata and resolve discrepancies.
- [ ] Install from lockfile and record runtime versions.
- [ ] Run source unit, audit, worker/E2E, build, spec-generation and benchmark commands where available.
- [ ] Capture baseline screenshots at desktop and mobile widths.
- [ ] Record boot population, tick throughput, render frame time, memory, save/load size and worker/fallback behavior.
- [ ] Exercise pause/resume, law toggles, world settings, species/DNA controls, save/load, presets, camera, panels and debug export.
- [ ] Save deterministic seeded fixtures and compare state hashes/checkpoints across repeated runs.
- [ ] Separate source bugs from migration bugs in the issue ledger.

No baseline runtime test or browser test is claimed by this document. Those are explicit first roadmap gates.
