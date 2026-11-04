# 00 — Current program baseline

**Status:** historical observed baseline, not a target architecture. Evidence snapshot: `main` at `2f8ca03` (v9.3.0); it was clean at that inspection. It predates the v9.3.1 commit and later changes; runtime truth remains the current source tree.

## Product and visual language

VEPA4 is a vanilla ESM browser simulation packaged by Vite. The page is a full-viewport, dark neon-noir petri dish: `body.theme-sanguine`, near-black background and translucent panels, compact monospace labels, red as the active setup accent, cyan/blue/gold/green highlights, thin borders, small glows, and color-coded law tiles. `index.html` layers an atmospheric `#bg-canvas`, live `#sim-canvas`, and pointer-enabled UI. A 36px top toolbar carries pause, population/species/tick telemetry, chaos/restart, undo, and help. The bottom drawer defaults to at most 50vh and contains SETUP, SAVES, DATA; Setup nests LAWS, WORLD, SPECIES, SETTINGS; Data nests intelligence, DNA, logs, groups, ecology, civilization. Drawer resize/hide/minimize/zoom, keyboard tabs, tooltips/help, responsive touch affordances, analytical canvases, and accordion controls are part of the observable UI contract—not decorative extras.

Laws are shown as spectrum-coded icon tiles with list/compact variants, category filtering, search, and help/details. World settings are grouped into dense accordions with enhanced sliders (bounds, linear/log choice, snap, precision zoom). Species has a roster and trait accordion. Current implementation uses Canvas2D with optional PixiJS and Canvas2D fallback; the accepted roadmap selects GPU-rendered 3D as the product direction, which is not yet implemented. Preserve visual hierarchy, active/inactive states, status feedback, keyboard behavior, touch targets, and responsive drawer composition in any parity milestone.

## Functional inventory / hard contracts

- `src/main.js` is the current integration orchestrator: boot/launch settings, seed, world and species setup, events, worker bridge, render loop, population and intelligence cadence, saves/undo, and lifecycle wiring. At 1,931 lines, it is an integration hotspot, not a clean module boundary.
- Particle state is a flat 100-float stride; max population is 100,000. DNA is 64 parameters × 64 species, quantized in `Uint16Array`; 42 values are cached in each particle and 22 are genome-only. Law SSOT is `LAW_INDEXES`/`LAW_COUNT=136`, five U32 words, serialized `{low,high,ext,quad,penta}`.
- `WORLD_PARAM_DEFS` currently contains 149 entries. It is the world-parameter schema, distinct from species DNA and runtime-only tuning. `LAW_INDEXES`, `DNA_INDEXES`, `STRIDE_INDEXES`, and parameter definitions are the SSOTs; no magic indices in consumers.
- Main thread owns UI/rendering/orchestration; `src/worker/physics.worker.js` executes serialized ticks against SharedArrayBuffer when available. ArrayBuffer/main-thread fallbacks exist. Optional WebGPU currently computes a limited gravity force pre-pass; CPU remains authoritative for the rest of solver semantics. Barnes–Hut/FMM gravity are approximations; exact pairwise CPU is the reference.
- Solver combines spatial-neighbor building, pairwise law dispatch, integration, life-cycle, emergent state passes, and optional approximate/accelerated paths. Laws are not all equally empirically validated: fidelity is a test/audit target, not an assertion.
- Saves carry particle/DNA/law/world/runtime state and some ontology state; older formats/optional fields exist. Round-trip and compatibility behavior must remain explicit.

## Target parity gate

The accepted roadmap governs target behavior: GPU-rendered 3D is the selected presentation direction; law and physics-parameter edits take effect only on new-world start or explicit restart, never mid-run; experimental features remain isolated to separate experimental worlds/saves; and performance degradation cannot silently change simulation state or outcomes.

Before replacing a boundary, characterize current boot/launch scenarios, panel states, controls/events, law toggles, preset outcomes, renderer output, snapshots/undo, worker fallback, and representative deterministic worlds. Retain screenshot/interaction fixtures where feasible, golden state summaries, and API/event tests. A “faithful mimic” means all accepted user-visible flows and save/config contracts pass these gates; pixel identity is not inferred from a successful build. See `MASTER_SPEC.md` for proposed migration and acceptance gates.