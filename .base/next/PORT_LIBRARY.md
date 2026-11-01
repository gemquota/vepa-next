# VEPA source-to-Next port library

This is the component catalogue. Status starts as **AUDIT REQUIRED** unless explicitly noted. Source paths are stable-repository paths, not assertions that the destination already exists.

## 1. Bootstrap and application shell
- `src/main.js` — application composition, initialization order, event subscriptions, worker selection, tick scheduling, engine cadence and teardown.
- `index.html`, `style.css` — document shell, typography, color tokens, layout, responsive behavior, drawer and modal styling.
- `src/core/eventBus.js` — event subscription, publication and lifecycle.
- `src/debug.js` — bounded diagnostic capture, overlay, copy/export and persisted visibility.
- Port as one bootable browser app before adding feature breadth.

## 2. Canonical constants and schemas
- `src/constants.js` — law indices/count/categories, DNA trait indices/ranges, particle offsets, defaults, help metadata and shared limits.
- `src/state/runtimeConfig.js` — validated runtime parameters and config synchronization.
- `src/state/worldParams.js` — environment/world dimensions, boundary mode, field configuration and defaults.
- `src/state/lawState.js` — law enablement and mutation API.
- Acceptance: exactly one authority for each ID, default, range and schema; generated UI/spec derives from it.

## 3. Particle and species state
- `src/state/particleBuffer.js` — packed typed-array allocation, slot layout, lifecycle, capacity and accessors.
- `src/dna/dnaBuffer.js` — packed species genome storage and trait encoding.
- `src/dna/expression.js` — genotype-to-phenotype expression and effective physical traits.
- `src/state/species`/species-related state and spawn modules — species registry, roster, distribution, offspring and identity.
- Acceptance: pinned layout fixtures, slot reuse safety, migration and save/load round trips.

## 4. Physics and environment
- `src/physics/solver.js` — authoritative tick loop and law dispatch.
- `src/physics/laws.js` — per-particle and pairwise law implementations, signal behavior.
- `src/physics/lawgroups/*` — mechanics, physics, biology, chemistry, EM, thermodynamics, information, quantum and metaphysics groups.
- `src/physics/fields.js` — field grids, sampling, wells, portals, walls and field coupling.
- `src/physics/spatialGrid.js`, `octree.js`, `fmm.js` — neighbor search and long-range acceleration.
- `src/physics/contactConstraints.js` — bounded contact/overlap correction; inspect convergence limits.
- `src/physics/mergePhysics.js` — merge/accretion and conservation semantics.
- `src/physics/synergy.js` — law interaction/coupling rules.
- `src/physics/gpuCompute.js` — GPU backend and fallback compatibility.
- Acceptance: per-law source mapping, focused parity fixtures, matched benchmarks, finite-state and dense-world tests.

## 5. Worker and execution
- `src/worker/physics.worker.js` — worker protocol, initialization, config updates, tick request/result and error handling.
- Main-thread fallback path — identical semantics within declared numeric tolerance.
- Shared memory/COOP/COEP deployment requirements — test both isolated and non-isolated hosts.
- Acceptance: worker/local deterministic fixture comparison, stale config prevention, failure recovery and real-browser worker tests.

## 6. Rendering and camera
- `src/render/renderer.js` — world draw pipeline, particle styling, depth, overlays and quality behavior.
- `src/render/spriteSync.js` — simulation-to-render projection.
- `src/ui/camera.js` — pan/zoom, depth framing, pointer gestures and camera persistence.
- Acceptance: renderer read-only, no simulation mutation, stable camera behavior at desktop/mobile sizes, large-world visibility.

## 7. UI surfaces and controls
- `src/ui/ui.js` — panel composition, tabs, drawer, events and responsive state.
- `src/ui/hud.js` — live simulation metrics and status.
- `src/ui/lawPanel.js` — category tabs, law toggles, help, search/filter and active counts.
- `src/ui/worldPanel.js` — environment, boundaries, fields, gravity wells, portals and world presets.
- `src/ui/settingsPanel.js` — appearance, performance, debug, compute and runtime options.
- `src/ui/presetPanel.js`, `savePanel.js` — presets and world states.
- `src/ui/speciesPanel.js`, `dnaPanel.js`, `dnaAnalytics.js` — species, genome editing and analytics.
- `src/ui/ecoPanel.js`, `groupAnalytics.js`, `intelPanel.js`, `narrativePanel.js` — higher-level read models.
- `src/ui/sliderControl.js`, `tooltip.js` — shared control primitives.
- `src/multiplex/multiplexUI.js` — shard selection and multiplex controls.
- Acceptance: every visible control has a live behavior, state feedback, keyboard/touch affordance and failure state.

## 8. Engines and emergent systems
- `src/engines/agencyEngine.js`, `goalBehavior.js`, `goalEngine.js`, `insightEngine.js`, `lineageTracker.js`, `narrativeEngine.js`, `timelineEngine.js`, `worldEvents.js`, `ecoEngine.js`, `epochEngine.js`, `speciation.js`.
- `src/state/groupRegistry.js`, `memoryBuffers.js`, `construction.js`, `economy.js`, `governance.js`, `infrastructure.js`, `artifacts.js`, `exoticMatter.js`, `relativity.js`, `quantumMacro.js`, `stellar.js`, `synthetic.js`.
- `src/multiplex/multiplex.js` — isolated shard worlds, independent evolution and selection.
- Acceptance: explicit state ownership, deterministic cadence, bounded work, snapshot/replay, and observable UI read models.

## 9. Persistence, presets and operations
- `src/state/worldSave.js`, `presetManager.js`, `defaultPresets.js`, runtime configuration and any history/undo modules.
- Build/deploy: `package.json`, lockfile, Vite/Vitest/Playwright configs, `vercel.json`, `.github/workflows/*`, launcher and benchmark scripts.
- Acceptance: versioned schemas, safe import validation, atomic restore, migration tests, offline/reload behavior, deployment worker headers.

## Port record schema

Each port must record: ID; source repo/commit/path/blob; source behavior summary; source tests; destination path; adaptation; dependencies; owner/state; UI surface; compatibility constraints; parity tests; browser evidence; benchmark evidence; status; known deviations. Use the consolidation migration ledger as historical input, then maintain the authoritative expanded ledger alongside this library.

## Reuse rule for existing Next modules

- Keep only if it implements a required source capability and its semantics match the pinned source or an accepted improvement decision.
- Rewrite if the module creates parallel concepts, duplicate registries/state, speculative abstractions, or a contract without a live consumer.
- Retain useful tests only after converting them into source-backed fixtures; tests of a previous prototype are not parity evidence by themselves.
