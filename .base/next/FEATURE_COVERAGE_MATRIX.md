# Feature coverage matrix

This matrix separates **source copied** from **behavior verified**. The stable source tree has been copied into the rebuild branch; no feature is marked browser-verified merely because its source files exist.

| Capability family | Stable source components | Primary UI surface | Copy state | Runtime/parity state |
|---|---|---|---|---|
| App bootstrap and lifecycle | `src/main.js`, `src/core/eventBus.js` | App shell, toolbar, HUD | Source copied | Not yet run in Next |
| Particle substrate and identity | `src/state/particleBuffer.js`, constants, spawn | World viewport, species | Source copied | Not yet baseline-tested |
| Species genome and phenotype | `src/dna/*`, species state | Species/DNA panels | Source copied | Not yet baseline-tested |
| Canonical law catalogue | `src/constants.js`, `src/state/lawState.js` | Law/world panel | Source copied | 136 law slots; per-law execution audit pending |
| Mechanics and force laws | `src/physics/solver.js`, `laws.js`, lawgroups | World and law controls | Source copied | Per-law fixture and numerical parity pending |
| Spatial acceleration | `spatialGrid.js`, `octree.js`, `fmm.js` | Performance settings | Source copied | Scaling benchmark pending |
| Contact/collision/accretion | solver, merge/contact mechanics | World viewport, law controls | Source copied | Dense packing and conservation tests pending |
| Environment and fields | `src/physics/fields.js`, world state | WORLD > ENVIRONMENT | Source copied | Field interaction/browser tests pending |
| Worker and fallback | `src/worker/physics.worker.js`, main bootstrap | Runtime status/debug | Source copied | Worker/fallback parity pending |
| Renderer and camera | `src/render/*`, `src/ui/camera.js` | Main canvas, camera controls | Source copied | Browser visual regression pending |
| Law UI and settings | `src/ui/lawPanel.js`, `worldPanel.js`, `settingsPanel.js` | Bottom drawer / setup | Source copied | Control-by-control interaction audit pending |
| Presets and world persistence | `src/state/defaultPresets.js`, `presetManager.js`, `worldSave.js` | Preset/save panels | Source copied | Full round-trip and corruption tests pending |
| Debug and diagnostics | `src/debug.js`, solver metrics | Debug overlay/settings | Source copied | Browser copy/export test pending |
| Intelligence engines | insight, narrative, lineage, goal, timeline engines | INTEL/narrative/timeline panels | Source copied | Cadence/wiring and replay tests pending |
| Communication DNA | signal laws and DNA traits | DNA/species panels | Source copied | Channel filtering and response tests pending |
| Ecology and speciation | eco/epoch/speciation/world-event engines | ECO/data panels | Source copied | Long-run population/ecology tests pending |
| Civilization and groups | group registry, construction, economy, governance, infrastructure | CIVILIZATIONS/group analytics | Source copied | Emergent behavior and bounded-work tests pending |
| Memory and culture | memory buffers and culture adaptation | Species/group analytics | Source copied | Inheritance and snapshot tests pending |
| Agency and artifacts | agency/narrative engines, artifacts | INTEL/narrative panels | Source copied | Reversible action and evidence tests pending |
| Exotic matter | `src/state/exoticMatter.js` and laws | SETUP > WORLD > MATTER | Source copied | Bounds and conservation tests pending |
| Relativity | `src/state/relativity.js` and laws | MATTER > RELATIVITY | Source copied | Numerical and causal bounds pending |
| Quantum macroscale | `src/state/quantumMacro.js` and laws | MATTER > QUANTUM | Source copied | Determinism/interaction tests pending |
| Stellar systems | `src/state/stellar.js` and laws | MATTER > STELLAR | Source copied | Accretion/emission/energy tests pending |
| Synthetic/advanced law frontier | `src/state/synthetic.js`, lawgroups and law audit | Law catalog/data | Source copied | Feature-by-feature disposition pending |
| Multiplex shards | `src/multiplex/*` | Multiplex controls | Source copied | Shard isolation/evolution tests pending |
| Benchmark/reporting | `bench/*`, `public/bench-report/*` | Benchmark report | Source copied | Reproducible measurements pending |
| Deployment and runtime headers | Vite/Vercel config and stable deployment files | Hosting | App source copied; Next workflows preserved | Reconcile Pages/Vercel and COOP/COEP before deployment |

## Consolidation cross-check

The existing consolidation audit identified these Next gaps before the source reset. They remain explicit acceptance checks, not presumed solved by copying:
- full stable law runtime and canonical law command behavior;
- full fields/environment and performance controls;
- worker lifecycle, fallback and browser failure recovery;
- benchmark CLI/report and stable-vs-Next comparison;
- all five intelligence engines and their application wiring;
- communication DNA and signal exchange;
- ecology, biodiversity, food webs, niches and world events;
- civilizations, memory/culture, governance, infrastructure and energy;
- exotic matter, relativity, quantum macroscale and stellar physics;
- multiplex shard evolution/selection;
- debug export and complete save/preset workflows;
- deployment isolation headers and browser verification.

The source reset makes these code paths available in the new branch. It does not itself prove that the current pinned source runs correctly or that every UI path works. R0 and R1/R2 acceptance gates must establish that.
