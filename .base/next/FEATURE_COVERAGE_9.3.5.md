# VEPA Next 9.3.5 feature coverage matrix

**Audit target:** `main` at `8b20f8a274d054a6f1251ae3207072d3f3dc66ca`  
**Product pin:** DayneK/vepa `v9.3.5`, `d24301cdcf95a6142ffa98d9808dffaacb1d8523`  
**Scope:** root product runtime plus the separately tested `sim-foundation/` layer.  
**Rule:** source presence, registry presence, solver dispatch, focused tests, default runtime integration and browser verification are separate evidence levels.

## 1. Status vocabulary

| Status | Meaning |
|---|---|
| **Integrated / default** | Reached by the ordinary application path, with tests supporting the behavior. |
| **Integrated / conditional** | Runtime-wired but gated by law state, configuration, cadence, capability or explicit selection. |
| **Implemented / opt-in** | Executable implementation exists but is not the default path. |
| **Implemented / not gated** | Implementation source exists, but no canonical solver gate is recorded. |
| **Metadata only** | Catalog/help/ontology or test references exist without an implementation path. |
| **Contract-only** | Exists in `sim-foundation/` and has executable contracts, but is not yet integrated into the product runtime. |
| **Partial / proxy** | A bounded approximation or subset is active; the named domain is not fully modeled. |
| **Unverified in browser** | Source/build/tests exist but the behavior has not been demonstrated in a supported real browser session. |

A feature can carry multiple qualifiers. Never collapse them into a single green check.

## 2. Product runtime coverage

| Domain | Canonical files | Runtime path | Evidence / current status | Remaining gap |
|---|---|---|---|---|
| Browser shell and boot | `index.html`, `src/main.js`, `src/react-entry.js`, Vite config | boot → world initialization → UI and render loop | Product build + unit suite; integrated | Real-browser smoke and mobile interaction evidence |
| Particle storage | `src/state/particleBuffer.js`, `src/constants/stride.js` | Float32 particle view, fixed `PARTICLE_STRIDE`, optional SharedArrayBuffer | Buffer tests; integrated | Explicit layout versioning and migration compatibility |
| Species genetics | `src/dna/dnaBuffer.js`, `src/dna/codec.js`, `src/dna/expression.js` | Species genome → phenotype cache → particle traits | DNA/expression/lifecycle tests; integrated | Audit genome-only regulatory traits and cache invalidation |
| Law catalog and state | `src/constants/laws.js`, `src/state/lawState.js`, `src/state/pendingLaws.js` | 136 indexed laws → five-word state → worker config | Registry, gating and law tests; integrated as catalog/state | Catalog index does not imply equal behavioral depth |
| Exact CPU solver | `src/physics/solver.js`, `src/physics/laws.js`, `src/physics/lawgroups/*` | spatial grid → pair/law passes → integration/lifecycle | Physics, audit, gating and mechanics tests; default reference | Add deterministic golden trajectories and browser stress cases |
| Neighbor search | `src/physics/spatialGrid.js` | reusable 3D grid and bounded neighbor collection | Physics/performance tests; integrated | Quantify truncation and dense-cell behavior at target population scales |
| Approximate gravity | `src/physics/octree.js`, `src/physics/fmm.js` | optional backend selected by runtime config | Octree tests and backend benchmarks; opt-in | Maintain error/performance envelopes; FMM remains experimental |
| WebGPU compute | `src/physics/gpuCompute.js`, `src/worker/physics.worker.js` | device probe → GPU force path → CPU continuation/fallback | Backend and worker E2E contracts; opt-in | Execute parity and loss/recovery tests on actual WebGPU-capable browsers |
| Fields and interaction space | `src/physics/fields.js`, `src/physics/interactionSpace.js` | field storage/sampling and law consumers | Fields/interaction tests; integrated where enabled | Audit all field producers/consumers and boundary semantics |
| Mechanics | `src/physics/contactConstraints.js`, `src/physics/lawgroups/mechanicsLaws.js`, `src/physics/mergePhysics.js` | CONTACT correction, COLL impulse, momentum/torque/constraints/topology/adhesion; ACCR/ALLOY structural paths | Mechanics architecture and solver tests; conditional | Preserve separation-vs-impulse semantics; complete optional diagnostics |
| Rendering | `src/render/renderer.js`, `src/render/pixiRenderer.js`, `src/render/spriteSync.js`, `src/render/zeroCopy.js` | particle view → phenotype cache → Canvas2D/Pixi projection | Renderer tests and benchmark report; integrated/selectable | Browser visual parity, resize, large-world and context-loss validation |
| UI | `src/ui/ui.js`, `src/ui/*Panel.js`, `docs/systems/ui-module-report.md` | Setup, World States, Data and panel sub-tabs | Generated UI report + panel tests; integrated | Browser-level control coverage and accessibility/touch review |
| Population lifecycle | `src/main.js`, `src/engines/lineageTracker.js`, solver offspring ring | solver offspring → population advance → birth/death/species updates | Lifecycle, DNA and lineage tests; integrated | Check worker/local parity and cap behavior |
| Ecology and speciation | `src/engines/ecoEngine.js`, `src/engines/speciation.js`, `src/engines/worldEvents.js` | cadence-driven population/ecology metrics and events | Engine/living-world tests; proxy where stated | Validate causality and sensitivity to cadence/configuration |
| Intelligence / narrative | `src/engines/insightEngine.js`, `agencyEngine.js`, `goalEngine.js`, `narrativeEngine.js`, `timelineEngine.js` | sampled simulation telemetry → goals, milestones, narrative, timeline | Engine/agency/narrative tests; operational proxy | Do not imply cognition beyond measured telemetry |
| Social and civilization state | `src/state/groupRegistry.js`, `civilization.js`, `continuity.js`, `codex.js` | groups → culture/federation/kin/polity records → continuity/codex | Civilization, wiring and continuity tests; partial/proxy | Domain-specific relationship graph, mating/family depth and long-run persistence |
| Economy and built systems | `src/state/economy.js`, `construction.js`, `artifacts.js`, `governance.js`, `infrastructure.js`, `structures.js` | group state → production/maintenance/governance/infrastructure | Domain unit tests; integrated support systems | Structures registry is not yet a full physical-body/field representation |
| Exotic / macro systems | `src/state/exoticMatter.js`, `relativity.js`, `quantumMacro.js`, `stellar.js`, `synthetic.js` | cadence-driven state passes | Domain unit tests; integrated or proxy by subsystem | Audit physical coupling, conservation and cross-system feedback individually |
| Persistence | `src/state/worldSave.js`, `presetManager.js`, `savePanel.js` | capture → validate/encode → store/export → parse/restore/compare/undo | World-save tests; integrated | Schema versioning, migration fixtures and corruption/fuzz coverage |
| Multiplex worlds | `src/multiplex/multiplex.js`, `multiplexUI.js` | shard-local stepping/rendering → copy/summarize | Multiplex tests; integrated optional mode | Re-entrancy, shard determinism and renderer cache isolation |

## 3. Law registry evidence snapshot

Generated from `docs/spec/laws/implementation-status.json` and `ontology-coverage.json` at the audit target.

| Measure | Count | Interpretation |
|---|---:|---|
| Declared laws | 136 | Canonical registry size, not number of fully validated physical models |
| Status: wired | 133 | Generator found source/solver-gate evidence; not a semantic proof |
| Implemented, not gated | 2 | BUOYANCY and SENESCENCE |
| Metadata only | 1 | ELECTRIC_FIELD |
| Laws with relationship metadata | 35 | 25.74% declared ontology metadata coverage |
| Laws without relationship metadata | 101 | Explicit metadata backlog |

**Do not infer:** 133 complete laws, 133 independently verified physical models, or that the 35 metadata-rich laws have complete parameter-space validation. The generated status file itself states that text-level source references are evidence candidates, not semantic correctness proof.

### Priority law follow-up

1. Resolve BUOYANCY and SENESCENCE: decide whether they should be gated, retired, or deliberately remain unconditional; add behavior-level tests for the chosen semantics.
2. Resolve ELECTRIC_FIELD: either add a real implementation and solver consumer or keep it explicitly metadata-only and ensure UI/help language does not imply executable behavior.
3. Expand ontology metadata from the current 35-law subset using the highest-impact cross-law dependencies first.
4. For each law, link the implementation function, solver gate, state reads/writes, parameter units/ranges, focused tests, and known approximations.
5. Add fixed-seed multi-law interaction fixtures for mechanics, energy, biology and field coupling.

## 4. SIM foundation: separate contract layer

The `sim-foundation/` tree is not the product solver. It is a separately tested candidate architecture with its own state, solver and worker contracts.

| Capability | SIM foundation files | Contract evidence | Product integration status |
|---|---|---|---|
| Seeded deterministic PRNG and stream separation | `src/core/seed.js`, `prng.js`, `random-streams.js` | core/random-stream contracts | Not wired as product-wide random authority |
| Event envelope and transactional state | `src/core/event-envelope.js`, `src/state/transaction.js`, `event-journal.js` | core and journal contracts | No unified product event/transaction boundary |
| Law registry, manifest, state and commands | `src/sim/law-registry.js`, `law-manifest.js`, `law-state.js`, `law-commands.js` | registry/manifest/state/command contracts | Product has its own 136-law catalog and law-state implementation |
| Solver and numerics | `src/sim/solver.js`, `numerics.js`, `advanced-physics.js` | solver, numerics, velocity-Verlet and advanced-physics contracts | Separate implementation; no default product solver dispatch |
| Spatial grid and periodic boundaries | `src/sim/spatial-grid.js`, `periodic-images.js`, `periodic-ewald.js` | spatial-grid, periodic-image and Ewald contracts | Product grid/periodic behavior remains independently implemented |
| Contact constraints and particle layout | `contact-constraints.js`, `particle-layout.js`, `particle-identities.js` | contact and identity contracts | No shared product memory layout / ID authority |
| Energy accounting | `energy-ledger.js`, `energy-budget.js`, `force-work-journal.js`, `solver-energy-evidence.js` | energy reconciliation and evidence contracts | Product has no equivalent unified audited ledger in its main solve path |
| Worker adapter | `execution-adapter.js`, `worker-execution-adapter.js`, `particle.worker.js` | worker adapter and protocol contracts | Separate worker protocol; not the active `src/worker/physics.worker.js` |
| Replay and snapshots | `replay.js`, `snapshot.js`, `snapshot-store.js`, `world-session.js` | replay/snapshot/session contracts | Product worldSave remains active persistence path |
| V3 migration adapters | `v3-particle-migration.js`, `v3-species-dna-migration.js`, `v3-world-core-migration.js`, `legacy-law-flag-migration.js` | migration contract tests | Candidate migration layer; not yet the product's mandatory load path |

## 5. Acceptance evidence required to promote a row

- **Runtime:** trace the default call path from UI/config to the active consumer.
- **Tests:** identify focused semantic tests, not only broad audit string matches.
- **Numerics:** define units, invariants, stable timestep range, tolerances and failure behavior where physics is involved.
- **Performance:** measure representative populations and allocation behavior in hot loops.
- **Compatibility:** test existing worlds, DNA, law masks, saves and worker fallback.
- **Browser:** verify the actual browser path, including touch/mobile and no-SharedArrayBuffer fallback where relevant.

