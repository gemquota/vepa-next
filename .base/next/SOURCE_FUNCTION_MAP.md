# Source function map — pinned VEPA baseline

Pin: `gemquota/vepa@24b56aff316d6de5a960943d6bcb9192a8d569ce`. Blob SHAs below were read from the current master tree during this audit; re-verify if the pin changes.

| File | Blob SHA | Size | Responsibility / observed entry points |
|---|---|---:|---|
| `src/main.js` | `08672da2dcad8d283e75dd1067d2f0285be2565c` | 70,029 B / 1,509 lines | Bootstrap and orchestration. Observed functions include `canUsePhysicsWorker`, `stopPhysicsWorker`, `workerConfig`, `syncPhysicsWorker`, `finishPhysicsTick`, `handleWorkerTick`, `solve`, `drainOffspring`, `startPhysicsWorker`, `spawnSingleParticle`, `spawnDefaultPopulation`, `spawnOffspring`, `advancePopulation`, `wireGoalEvents`, `computeMetrics`, `updateIntelligence`, `resetIntelligence`, `renderLoop`. |
| `src/constants.js` | `be2162548e0aed180ee262b941ebb1eedb544ff8` | 113,347 B / 1,680 lines | Canonical particle/DNA/law schemas. Declares 100-slot particle stride, 64-trait DNA schema, 136 law slots, categories, subgroups, dependencies, parameters, colors and help metadata. |
| `src/physics/solver.js` | `937d7a9848e0751807549453442d5a4a21183f52` | 75,977 B / 1,927 lines | Authoritative simulation tick. Exports `solve`, offspring drain/reset and species DNA read; includes grid, neighbor buffers, DNA cache, FMM output buffers and law timing instrumentation. |
| `src/physics/laws.js` | `d139c85aca3dd68231e490f4daae06b92aa66367` | 121,604 B / 2,786 lines | Law force/state functions. Exports buffer binding, gravity, drag, collision, accretion, tracking, predation, solvation, polymerization, acidity, oxidation, heat/cold, genotype, planetary, lifecycle and signal decay/exchange functions. |
| `src/physics/fields.js` | `ff3af5663136f53bea94336850b1f12314369c26` | 20,246 B / 564 lines | Field grid construction, ambient seeding, scalar/vector sampling, gradients, field forces, wells, walls and portals. |
| `src/state/particleBuffer.js` | `81b92c27b4fd9cd0943d7428fa24f40acfbe0615` | 7,705 B / 171 lines | Particle buffer allocation/accessors for position, velocity, mass, species, liveness, energy and DNA. |
| `src/dna/dnaBuffer.js` | `1616df960366c73586604a2c334afc2d3e8108fd` | 5,221 B / 153 lines | Species DNA allocation, raw/float trait access, species clone/mutate/default operations. |
| `src/dna/expression.js` | `21dba4dcc830204d22f990c58ab709139fca6bc1` | 10,182 B / 260 lines | Pure phenotype functions: color, radius, alpha and combined expression. |
| `src/worker/physics.worker.js` | `dbb1781e4b13a1a4f3c9717bd56227aa275b92a0` | 10,202 B / 389 lines | Worker config, law toggle, state read, restore and PRNG handlers; inspect message dispatcher and init/tick protocol next. |
| `src/render/renderer.js` | `a13f05487b2080f2375d7fdeec192375089ca5a9` | 17,249 B / 428 lines | Canvas2D renderer, particle view, phenotype cache, create/resize/destroy, frame and particle drawing, background. |
| `src/state/worldSave.js` | `f9eb8ba698473107ebcb424e8a95c5f4f8e93385` | 19,513 B / 546 lines | Version-1 world save; capture/restore, base64 typed-array conversion, JSON export/parse, IndexedDB adapter, save store, compare/fingerprint and undo ring. |
| `src/ui/ui.js` | `5db40a4b98b411f7bdb16b3c59d07c245108a971` | 13,172 B / 362 lines | UI orchestration, tabs, drawer minimize/expand/resize/zoom/swipe/hide-show, toolbar and keyboard shortcuts. |
| `src/ui/lawPanel.js` | `50852697eeb5a1ee9201107f4b5aed4ce443db56` | 6,741 B / 196 lines | Law toggle grid and active styling. |
| `src/ui/worldPanel.js` | `f99bcec453e0f7029efc2a615c9209001728d253` | 23,321 B / 548 lines | Law-set presets, selected law, law grid, category filter and world sliders. |
| `src/ui/settingsPanel.js` | `f249d9183ccea5de85de1d4391c222a41e2d6727` | 7,370 B / 186 lines | Camera/render settings and debug-log copy. |
| `style.css` | `4dbb0e7aacc716e53e66815757e1696139fe7e94` | 75,751 B / 3,041 lines | Existing visual system; root tokens include `--bg-primary: #0a0a0f`, secondary/tertiary backgrounds and text hierarchy. |

## Immediate trace tasks
- [ ] Extract full import graph from `src/main.js` and map all bootstrap-owned objects.
- [ ] Trace exact `solve()` stages in `src/physics/solver.js`; do not rely on generic tick ordering in OPERATION_MAP.
- [ ] Trace all 136 law indices to law function(s), state prerequisites and UI controls.
- [ ] Read worker message dispatcher end-to-end and document each message schema.
- [ ] Trace UI panel creation order, DOM selectors, tab IDs and event-bus command names.
- [ ] Trace renderer projection, camera transform and depth scaling.
- [ ] Trace world-save payload fields, typed-array representation, IndexedDB keys, undo semantics and migration behavior.
- [ ] Map every engine cadence, state dependency, event and UI consumer.
- [ ] Map every production module to its test files and identify untested paths.

## Important interpretation
The 136 law slots are a canonical inventory, not a guarantee that every law is equally complete or physically validated. Likewise, worker presence does not prove parity with fallback; renderer presence does not prove all UI overlays; save support does not prove every new subsystem is captured. These require explicit tests.
