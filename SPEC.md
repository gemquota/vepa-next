# Feature Specification: VEPA4 — Integrated Intelligence

**Version**: 9.3.3 | **Date**: 2026-10-11 | **Base**: VEPA4 integrated intelligence
**Audit input**: `docs/DEEP_AUDIT_CLARIFICATIONS.md` and `docs/audit/laws/a3/`

## Working-tree Update (v9.3.3 — 2026-10-11)

The solver performs mass-weighted, deterministic discrete contact projection after all radius/motion updates using a radius-aware broadphase independent of force budgets. CONTACT/COLL/ACCR/BOND/POLYMER/ADHESION enable this exclusion; dead absorbed endpoints are skipped. Eight bounded iterations are not a full dense-packing or continuous-collision guarantee. POLYMER output feeds integration with radius-safe rest spacing; ADHESION restores surface gaps; ACCR seams use final radii. Ordinary bonds remain distinct from absorption.

Default Chaos samples physical world values and 64 species genome traits through canonical schemas/codec, preserves performance budgets, and adopts them after compute stops on restart. Law UI requests stage validated boolean overrides outside the live five-word mask. WRAP belongs to WORLD TOROIDAL; pending law details/discard and all-stage restart are explicit. Saves still capture live configuration, not proposals. Full preset loads, direct DNA edits, selective chaos and autonomous actions remain outside global staging.

## Working-tree Update (v9.3.2 — 2026-10-11)

WORLD `world:paramChanged` requests now stage in `pendingWorldParams.js` without writing `runtimeConfig`, solver state, worker CONFIG, or current-world saves. The UI shows live/proposed values and discard/restart actions. The session coordinator commits after worker stop and before respawn, with the existing pre-restart undo snapshot. Restore clears session proposals. Laws/DNA, preset loads, autonomous actions and backend settings still bypass this bounded path; global restart-only configuration is not implemented. Browser acceptance remains blocked by missing Chromium host libraries.

## Working-tree Update (v9.3.1 — 2026-10-07)

- Lowers the application particle ceiling to 10,000 and aligns population-control maxima; this reduces capacity allocation but is not a device-independent performance guarantee.
- Replaces preset comparison text with compact, accessible icon toggles while preserving selection state and three-profile comparison.

## Release Note (v9.3.0 — 2026-10-07)

- Adds the parameter/law atlas (`docs/systems/parameter-law-atlas.html`) and a launch designer that supports a 10,000 initial-population target while warning that runtime depends on device and configuration.
- Records the partial second-pass UI implementation and its outstanding acceptance gaps; it does not assert full-overhaul completion or browser verification.

## RB Roadmap Tracking

`docs/spec/rb/ROADMAP_PROGRESS.md` is the evidence-based checklist for proposed RB sections 00–11 and the ordered P0–P4 work queues. No RB section is marked complete end-to-end as of the v9.3.3 working-tree candidate. The tracker separates implemented groundwork from partial restart staging and open target work; real-browser acceptance, full configuration staging, modular extraction and GPU-rendered 3D remain incomplete. Update its checks only when the stated evidence gate passes.

## Problem Statement

The organization systems atlas at `docs/systems/` is the source-grounded companion for relationship, lifecycle, group, culture, and civilization analysis. Its completed roadmap catalog at `docs/systems/roadmaps/` contains four independent variants for each of the twelve systems. The shared `systemVariants` registry schedules those 48 variants A→B→C→D per system and inserts predecessor-gated integration seams between every adjacent step. The lifecycle substrate's second stagger materializes all 47 seams as typed durable relationship records. The third stagger derives and validates a connected 48-node topology over those relationships, with deterministic component and edge reports persisted through save/restore. The fourth stagger materializes bounded deterministic replay trajectories, evolutionary transitions, and regime summaries over the completed topology, also persisted through save/restore. It distinguishes live runtime registries from inferred analytics and proposed ontology, and defines the promotion path from observed regime to causal system.

## Technical Specification Procedure

The repository includes a deterministic, dependency-free specification generator at `scripts/generate-spec.mjs`. It imports live runtime contracts and scans active source, tests, audits, configuration, and documentation to emit the hierarchical `docs/spec/` tree. The generated branches separate architecture, UI, simulation, state, laws, source inventory, testing, operations, traceability, and review findings. `npm run spec:generate` regenerates the tree; `npm run spec:check` performs a byte-for-byte drift check without modifying files.

## Development Standards (2026-08-10)

- **Product & versioning:** the product is **VEPA4**; versions use
  **`major.minor.build`** (npm-semver-native, current `9.3.0`). The v4 line is
  retroactively mapped old `4.M.N` → `M.N.0` (generation `4` moved into the
  product name). Changelog headers carry both labels
  (`## [4.6.28] - date → 6.28.0`); the full rule lives in `AGENTS.md` §10.4.
- **Commits:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
  is mandatory — `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`
  with scopes, `!`/`BREAKING CHANGE:` for breaking changes. Release commits use
  `chore(release): v7.0.0 — <summary>` and tags are `v7.0.0`.

VEPA v3 recreated the simulation with clean module boundaries, but the five
intelligence engines — Insight, Narrative, Goal, Lineage, Timeline — were left
disconnected from the application (compiled factories, zero imports in
`main.js`). The communication DNA group (11 parameters) was inert in the
physics engine, and PREDATION — a v2 law — existed only as a function miswired
under the TRACK toggle. The result: a physics sandbox with no narrative,
no evolution history, no self-tuning, and no replay.

VEPA4 closes that gap: engines become first-class citizens of the simulation
loop, DNA communication drives real forces, and the world surfaces its own
intelligence through a live dashboard.

## Goals

1. Wire all five engines into `main.js` with event-driven communication only.
2. Implement communication DNA physics (pulse emission, channel-filtered
   propagation, signal response, memory).
3. Restore PREDATION as an explicit law (parity with v2).
4. Provide a World Intelligence Dashboard (clusters, lineage, goals, timeline).
5. Keep the v3 performance characteristics (no per-frame allocations in hot loops).

## Non-Goals

- No additional worker modes beyond the deterministic Web Worker path; the
  main-thread solver remains the compatibility fallback when SharedArrayBuffer
  is unavailable.
- No new laws beyond the current mapped law contract; law additions require
  explicit category, state, help, dispatch, audit, and test updates.
  (The v2-era legacy trees were archived to `gemquota/vepa-archive` on
  2026-08-10; the root `src/` **is** the v4 tree.)

## Architecture

### Engine wiring (main.js)

| Engine | Update cadence | Emits | Consumes |
|--------|----------------|-------|----------|
| Insight | every `scanInterval` frames | `cluster:detected` | particle buffer |
| Narrative | every frame (paced) | `narrative:entry` | cluster/law/lineage/goal events |
| Lineage | every frame (death scan); on spawn | `lineage:branch`, `lineage:death` | `spawnOffspring` births, DEAD transitions |
| Goal | every `evaluationInterval` frames | `goal:adjusted`, `goal:applied` | `sim:metrics` |
| Timeline | every 150 frames while recording | `timeline:snapshot`, `timeline:restored` | `timeline:record`, `timeline:scrubTo` |

All engines hold no DOM references. The UI subscribes to the same bus.

### Deterministic worker execution

The live solver is dispatched to `src/worker/physics.worker.js` when the
particle buffer is a `SharedArrayBuffer`. Only one tick is in flight at a time;
the worker mutates the shared particle view and returns offspring/timing data,
while population growth, intelligence engines, and HUD updates run once on
completion. Law, DNA, and world-parameter events send a serialized `CONFIG`
update before the next tick. Hosts without cross-origin isolation use the
synchronous main-thread solver fallback.

### Signal system (laws.js + solver.js)

- Per-particle: `applySignalDecay` — oscillator emission
  (`phase = sin(age·0.01·(0.1+pulseRate))`, gated by SIGNAL_STRENGTH),
  exponential decay via SIGNAL_DECAY, memory decay via MEMORY_DECAY.
- Pairwise: `applySignalExchange` — gated by NEIGHBORHOOD_RADIUS, delivered
  signal = `sender.signal × sender.SIGNAL_STRENGTH × receiver.PROPAGATION_SPEED
  × channelFilter × dt × signalScale`; channelFilter is the normalized dot
  product of receiver × sender TUNING_CH1-4; SIGNAL_RESP converts delivery
  into attraction force + energy; MEMORY accumulates.

### Predation law

`LAW_INDEXES.PREDATION = 51`. The law contract has since grown from the
52 laws named when PREDATION was added to **`LAW_COUNT = 136`**
(`src/constants/laws.js:34`), across 9 categories. PREDATION sits in the
biology category alongside the law-grid icon map and `LAW_HELP_DB`; the solver
dispatches `applyPredation` (`src/physics/laws.js:286`) under its own bit at
`solver.js:1021-1025` rather than under TRACK.

### Goal-engine tunables

`runtimeConfig` gains `maxForce`, `forceScale`, `dragMultiplier`, `birthRate`,
`deathRate`, `signalScale`. Solver consumes them at the force-clamp,
integration, and REPRO/LIFE synergy points. Insight consumes `scanInterval` /
`clusterRadius` adjustments live.

## Acceptance Criteria

1. **Engines wired**: boot creates all five engines; a 1000-frame run produces
   ≥1 `cluster:detected`, ≥1 `lineage:branch`/`lineage:death`, `goal:adjusted`
   events, and timeline snapshots when recording is enabled. *(verified via
   unit tests on engine behavior + wiring code inspection)*
2. **Signals move matter**: two particles with tuned communication DNA
   exchange signal and apply a response force; mismatched tuning channels
   block delivery. *(verified in `tests/unit/signal.test.js`)*
3. **Predation law toggles**: enabling PREDATION (bit 51) dispatches pursuit;
   disabling it removes pursuit. *(solver guard verified)*
4. **Dashboard renders**: the WORLD tab shows the intelligence section with
   live counters, REC toggle, and scrub slider. *(DOM-driven, no unit test —
   manual verify in browser)*
5. **No regressions**: `npm test` green — currently **951 tests across 109
   files** (verified 2026-09-30), `npm run repository:check` green
   (136 laws, provenance + signoff manifests valid), and `vite build` succeeds.

## Verification Gates

Run before declaring any change complete:

| Gate | Command | Contract |
|---|---|---|
| Tests | `npm test` | Current serial verification: 88 unit files / 1,081 tests and 50 audit files / 458 tests pass separately; combined Vitest worker invocation currently ends with `ERR_IPC_CHANNEL_CLOSED` |
| Syntax | `npm run syntax-check` | `node --check` over every `src/**/*.js` |
| Spec drift | `npm run spec:check` | generated `docs/spec/` matches source byte-for-byte |
| Repository | `npm run repository:check` | `spec:check` + law/provenance/signoff manifests |
| Build | `npm run build` | `vite build` → `dist/` + system atlas publication |

`npm run repository:check` runs in CI before deploy. Note that
`scripts/generate-spec.mjs` reads the constants modules with regex over
`src/constants/*.js`; the split-module path is declared in its
`CONSTANTS_SOURCE_FILES` list and guarded against drift against the live
`LAW_INDEXES`/`LAW_CATEGORIES`. Adding or renaming a constants file requires
updating that list.

## User Stories

- As a player, I toggle PREDATION and watch predator species pursue prey,
  absorb DNA, and grow.
- As a player, I raise a species' TUNING channels and SIGNAL_RESP and watch
  them swarm toward signal emitters.
- As a player, I watch the narrative panel react to births, deaths, clusters,
  and law changes, and scrub the timeline back to an earlier snapshot.
- As a player, I enable REC and scrub; the world rewinds to the recorded state.
