# Feature Specification: VEPA4 — Integrated Intelligence

**Version**: 9.1.2 | **Date**: 2026-08-26 | **Base**: VEPA4 integrated intelligence
**Audit input**: `audit/FULL_AUDIT_2026-08-01.md`

## Problem Statement

## Technical Specification Procedure

The repository includes a deterministic, dependency-free specification generator at `scripts/generate-spec.mjs`. It imports live runtime contracts and scans active source, tests, audits, configuration, and documentation to emit the hierarchical `docs/spec/` tree. The generated branches separate architecture, UI, simulation, state, laws, source inventory, testing, operations, traceability, and review findings. `npm run spec:generate` regenerates the tree; `npm run spec:check` performs a byte-for-byte drift check without modifying files.

## Development Standards (2026-08-10)

- **Product & versioning:** the product is **VEPA4**; versions use
  **`major.minor.build`** (npm-semver-native, current `9.1.2`). The v4 line is
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
- No changes to the v2 legacy tree (`src/`, root `index.html`).
- No new laws beyond the current mapped law contract; law additions require
  explicit category, state, help, dispatch, audit, and test updates.

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

`LAW_INDEXES.PREDATION = 51`, `LAW_COUNT = 52`, added to the biology category,
`LAW_HELP_DB`, and the law-grid icon map. Solver dispatches `applyPredation`
under its own bit instead of TRACK.

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
5. **No regressions**: `npm test` green (39 tests), `vite build` succeeds.

## User Stories

- As a player, I toggle PREDATION and watch predator species pursue prey,
  absorb DNA, and grow.
- As a player, I raise a species' TUNING channels and SIGNAL_RESP and watch
  them swarm toward signal emitters.
- As a player, I watch the narrative panel react to births, deaths, clusters,
  and law changes, and scrub the timeline back to an earlier snapshot.
- As a player, I enable REC and scrub; the world rewinds to the recorded state.
