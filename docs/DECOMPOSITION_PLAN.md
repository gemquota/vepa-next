# Monolith Decomposition Plan

**Project:** VEPA4 9.1.22
**Status:** 📋 **PROPOSED — awaiting review. No decomposition has been executed.**
**Origin:** audit remediation program — decomposition tasks were explicitly
deferred while every other remediation item was completed (see
`AUDIT_REMEDIATION_PLAN.md`, §3 ranks 1–12).
**Method:** line counts, export/import fan-out, section-banner and cohesion
analysis of the working tree at the time of writing.

> **Confirmation gate:** this document is the deliverable the user asked to
> review before any decomposition proceeds. Nothing below is implemented.
> Approve the whole plan, a subset (per Phase), or request changes — only then
> do the extractions start.

---

## 1. Inventory — monolith candidates

| # | File | Lines | Exports | Importers | Risk | Priority |
|---|------|------:|--------:|----------:|:----:|:--------:|
| 1 | `src/physics/laws.js` | 2 800 | 99 `apply*` + helpers | 14 (12 audit batches, `signal.test`, solver) | Medium | **P1** |
| 2 | `src/physics/solver.js` | 1 988 | 8 (incl. one ~1 675-line `solve()`) | 57 | **High** | **P2** |
| 3 | `src/constants.js` | 1 701 | 24 const objects | **149** | Low | **P3** |
| 4 | `src/main.js` | 1 537 | side-effect orchestrator | `index.html` + react entry | High | **P4** |
| 5 | `src/multiplex/multiplex.js` | 1 522 | ~25 functions | 2 | Low–Med | **P5** |
| 6 | `src/multiplex/multiplexUI.js` | 836 | 1 controller | 1 | Low | P6 |
| 7 | `src/ui/worldPanel.js` | 553 | 3 | 1 | Low | P6 |
| 8 | `src/state/worldSave.js` | 545 | ~10 | several UI modules | Medium | P6 |
| 9 | `src/ui/dnaAnalytics.js` | 541 | 1 | 1 | Low | P7 |
| 10 | `src/state/quantumMacro.js` | 511 | ~8 | solver + tests | Medium | P7 |
| 11 | `src/ui/paramHelp.js` / `src/ui/ui.js` | 466 / 485 | 1 each | UI only | Low | P8 |

**Explicit non-goals (do not decompose):**
- The lawgroup files (`lawgroups/*.js`, 1 203 lines total) — already the
  target architecture for category laws.
- `pairGeometry.js`, `mechanicsDiagnostics.js`, `mergePhysics.js` — small,
  single-purpose.
- Anything in `isolate/`, `dist/`, `exports/` — generated/preserved artifacts.

**Cross-cutting constraint (applies to every step):**
The original file stays as a **facade** that re-exports from the new modules
(`export { applyGravity, … } from './laws/physics.js';`), so the 149
`constants.js` importers, 57 `solver.js` importers, and 12 audit batches keep
working unchanged. Import churn is decoupled from code motion, and each step
can be verified in isolation.

---

## 2. Phase P1 — `src/physics/laws.js` (2 800 lines, 99 law forces)

### Current shape
- Lines 1–130: module preamble — `setBuffer`, species-DNA accessors
  (`readSpeciesDNAParam`/`writeSpeciesDNAParam`), shared helpers (`clamp`,
  `nanGuard`, `hslToRgb`, `isAccretionLink`), constants (`HISTORY_DIM`,
  `SINGULARITY_MASS`, `BOND_SLOTS`).
- Lines 130–2 800: 99 `export function apply*` law-force implementations,
  each preceded by a `// ===` banner naming the law, grouped loosely by
  category (physics → biology → chemistry → thermo → meta → EM → info →
  quantum → mechanics).

### Proposed decomposition
```
src/physics/laws/
  core.js          setBuffer + shared buffer view + clamp/nanGuard/readDNA/
                   hslToRgb/isAccretionLink/BOND_SLOTS + species DNA accessors
  physics.js       applyGravity, applyDrag, applyCollision, applyAccretion, …
  biology.js       applyLifeCycle, applyReproduction, applyPredation, …
  chemistry.js     applySolvation, applyCatalysis, …
  thermo.js        applyHeatTransfer, …
  meta.js          applyChaos, applyFate, …
  em.js            applyCharge, applyMagnetism, …
  info.js          applyMemory, applySignalExchange, …
  quantum.js       applyEntanglement, applySuperposition, …
  mechanics.js     (re-export boundary to lawgroups/mechanicsLaws.js where
                   the law already lives there; laws.js keeps only the
                   solver-dispatch wrappers)
src/physics/laws.js   ← facade: re-exports everything, public API unchanged
```

### Order of extraction (one commit each)
1. `core.js` (helpers + `setBuffer`) — everything else imports it.
2. Category files in banner order (physics first — largest).
3. Facade wiring + import audit (`rg "from '.*physics/laws.js'"` must still
   resolve every name).

### Risk & verification
- **Risk: low–medium.** Pure function movement; the only shared mutable state
  is the module-scoped buffer view behind `setBuffer` — it must be owned by
  exactly one module (`core.js`) and imported by the rest, otherwise tests
  that call `setBuffer` then `apply*` would see divergent views.
- **Verify per step:** `npx vitest run tests/audit/` (32 batch files import
  `laws.js` directly and act as the de-facto behavior spec), plus
  `tests/unit/laws.test.js`, `lawgroups*`, `signal.test`, `physics.test`.
- **Acceptance:** zero test edits required beyond import-path changes that
  the facade makes unnecessary; full `npm test` green.

---

## 3. Phase P2 — `src/physics/solver.js` (1 988 lines)

### Current shape
- 131–224: constants (`MAX_FORCE`, `MAX_VELOCITY`, grid/DNA/bench caches),
  buffer-cap helpers (`ensureNeighborBuf`, `ensureLocalDt`, `ensureFmmOutputs`),
  per-law bench instrumentation, module-scoped spatial grid.
- 240–263: `buildNeighborPairs` (already extracted, used by the WebGPU
  bridge).
- 265–1 940: **`solve()` — a single ~1 675-line function** containing the
  backend selection (exact / Barnes–Hut / FMM / GPU), the pair loop with all
  `isSet(lawState, …)` dispatch, mechanics passes, integration, and lifecycle.
- 1940–1988: offspring ring buffer + `readSpeciesDNA`.

### Proposed decomposition (staged, behavior-preserving)
```
src/physics/solver/
  benchMode.js       enableBenchMode/getLawTimings/getLastTickUs + counters
  buffers.js         ensureNeighborBuf/ensureLocalDt/ensureFmmOutputs/grid mgmt
  offspringRing.js   OFFSPRING_RING + drain/reset
  backends.js        grav/compute backend adapter (exact, 'bh', 'fmm', gpu)
  phases.js          named sub-functions of solve(): pairLoop, mechanicsPass,
                     integrate, lifecycle — each taking an explicit scratch
                     context object (no closure over solver module state)
src/physics/solver.js  ← facade + the solve() body shrunk to a phase sequencer
```

### Order
1. `offspringRing.js` + `benchMode.js` + `buffers.js` — leaf extractions with
   existing export names, zero behavioral surface. **No perf risk.**
2. `backends.js` — moves the `_bhTree`/`_fmm*`/`gpuForces` adapter block
   (solver lines ~474–680) behind one function; opt-in paths only, guarded by
   `backendArchitecture.test.js` string contracts (update those expectations
   in the same commit).
3. `phases.js` — **the risky step.** Slice `solve()` into phase functions that
   receive a reusable scratch context (module-level singleton to stay
   allocation-free). Only after steps 1–2 are green.

### Risk & verification (this is the hot path)
- **Risk: high.** This file produced the v8.15.1 "~9× at 100k" allocation-free
  hot path; any per-pair allocation introduced by the refactor is a
  regression.
- **Mandatory gates per step:**
  - `npm test` (physics, lawGating, audit batches, perfKnobs, webgpuContract).
  - `node bench/solver.bench.mjs` before/after — **acceptance: ≤5 % median
    regression** at default knobs; `npm run bench:backends` for backend rows.
  - `rg "runtimeConfig.gravEngine === 'fmm'"` etc. still satisfied —
    `backendArchitecture.test.js` asserts source contracts; update the test in
    the same commit if (and only if) the moved strings remain semantically
    identical.
  - Golden parity: run a fixed seed through `solve()` for N ticks and diff
    positions before/after each step (a small script can snapshot a fixture —
    add it as part of step 1 so every later step has a parity oracle).

---

## 4. Phase P3 — `src/constants.js` (1 701 lines, 149 importers)

Pure data. Split by table with a facade:
```
src/constants/
  stride.js    PARTICLE_STRIDE, STRIDE_INDEXES, buffer caps
  dna.js       DNA_INDEXES/DNA_COUNT/DNA_META/DNA_RANGES
  laws.js      LAW_INDEXES/LAW_COUNT/LAW_CATEGORIES/LAW_SUBGROUPS/
               LAW_DEPENDENCIES/LAW_PARAMETERS/spectrum + hue maps
  help.js      LAW_HELP_DB (the bulk — 4-tier entries)
  world.js     WORLD_SIZE, physics tunables, spawn defaults
src/constants.js  ← re-export facade (keeps `grep 'PARTICLE_STRIDE'
                     src/constants.js` quick-refs and all 149 importers valid)
```
- **Risk: low** (no logic), but **high blast radius** — do it late and only
  with the facade; `scripts/generate-spec.mjs` and `check-repository.mjs`
  import the module, so keep the public export surface byte-identical.
- **Verify:** `npm run repository:check`, `npm run spec:check`, full tests.

---

## 5. Phase P4 — `src/main.js` (1 537 lines)

Mixed responsibilities observed: worker bridge (127–287), boot (289–413),
population/spawn (414–660), DNA profile wiring (662–1042), metrics +
intelligence cadence (1043–1412), render loop (1413–end).

### Proposed decomposition
```
src/workerBridge.js     canUsePhysicsWorker/start/stop/sync/handleWorkerTick/
                        finishPhysicsTick/drainOffspring (workerConfig)
src/spawn/population.js  spawnSingleParticle/spawnDefaultPopulation/
                         spawnOffspring/advancePopulation/setDNAFromProfile +
                         SPECIES_PROFILES/EXTRA_SPECIES_COLORS
src/intelligenceCadence.js  computeMetrics/getMetrics/updateIntelligence*/
                            adaptCultureFromMetrics/resetIntelligence/wireGoalEvents
src/main.js            ← boot(), applyPrimeWorldConfig(), renderLoop(), wiring
```
- **Risk: high** — module-level mutable state and event-bus wiring order are
  load-bearing; `main.js` is not unit-tested directly (covered by e2e
  `runtime-acceptance.spec.js`).
- **Order:** extract in the list order above (worker bridge first — most
  self-contained), one commit each, e2e smoke (`npx playwright test
  tests/e2e/runtime-acceptance.spec.js`) after each.

---

## 6. Phases P5–P8 — lower-risk polish

| Phase | File | Split | Risk |
|-------|------|-------|:----:|
| P5 | `multiplex.js` (1 522) | `shardLifecycle.js` (create/start/stop/step/iterate), `fitness.js` (computeShardMetrics/getFitnessReport/recordDelta/compareShards/bounds/generations), `snapshot.js` (snapshot/restore/revert/records/elites), facade for the 2 importers | Low |
| P6 | `multiplexUI.js` (836) | `modal` / `overlay` / `grid` / `drawer` renderers behind `createMultiplexController` | Low |
| P6 | `worldPanel.js` (553) | `lawGrid.js`, `lawSetPresets.js` (LAW_SET_PRESETS + storage + bar), `worldSliders.js` (WORLD_PARAM_GROUPS/accordion render) | Low |
| P6 | `worldSave.js` (545) | `saveFormat.js` (format/version/caps/RUNTIME_KNOBS), `undoRing.js`, `saveList.js` | Medium (persistence) |
| P7 | `dnaAnalytics.js` (541), `quantumMacro.js` (511) | chart collection vs render; superposition/entangle/tunnel subsystems | Medium |
| P8 | `paramHelp.js` (466), `ui.js` (485) | only if touched by other work — below the pain threshold | Low |

---

## 7. Recommended execution order & gates

1. **P1 laws.js** — highest duplication payoff; protected by 32 audit batches.
2. **P2 steps 1–2** (leaf extractions + backend adapter) — safe.
3. **P3 constants.js facade split** — pure data, unblocks merge conflicts.
4. **P4 main.js** — needs e2e as the oracle.
5. **P2 step 3** (`solve()` phase split) — only with the golden-parity oracle
   and bench comparison from P2 step 1.
6. **P5–P8** — opportunistic polish.

**Global acceptance criteria (every step):**
- `npm run syntax-check` · `npm test` · `npm run repository:check` ·
  `npm run spec:check` · `npm run build` all green.
- No import-path churn outside the file being split (facades absorb it).
- Solver-touching steps additionally pass `node bench/solver.bench.mjs` with
  ≤5 % median regression.
- `docs/spec/audit/signoff-manifest.json` paths updated if any signed-off
  file moves (the new signoff gate will fail otherwise — by design).
- Version + changelog entry per release protocol (§10.4).

**Estimated blast radius:** P1 ≈ 14 importers unaffected (facade) · P2 ≈ 57
unaffected · P3 ≈ 149 unaffected · P4 ≈ e2e-only surface.

---

## 8. What was deliberately NOT done

Per the user's instruction, **no decomposition has been performed yet**. The
remediation program items 1–12 (audit signoff gates, WebGPU evidence, backend
envelopes, FMM decision, mechanics geometry/diagnostics, ontology expansion,
semantic tests, provenance/exports/historical tooling, stale-claim correction)
were completed first and are recorded in `CHANGELOG.md`, `BACKEND_ENVELOPES.md`,
`FEATURE_STATUS_MATRIX.md`, `ARCHITECTURAL_RESOLUTION_MATRIX.md`, and
`docs/spec/audit/signoff-manifest.json`.
