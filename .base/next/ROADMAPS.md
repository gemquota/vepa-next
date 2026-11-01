# Browser recreation roadmaps

Each roadmap is a release gate, not a calendar estimate. Ship coherent vertical slices only.

## R0 — Source truth and executable baseline
Pin source revisions; reconcile versions; run stable tests/build/browser flows; capture screenshots; trace exact boot, tick, worker, renderer, UI and save pipelines; reconcile consolidation and V5 feature inventories.
**Gate:** reproducible baseline with no unknown critical runtime path.

## R1 — Clean source application baseline
Recreate app shell, assets, styles, responsive layout, bootstrap, event bus, debug plumbing, canonical schemas and teardown.
**Gate:** browser loads the VEPA shell and all primary panels; no inert controls.

## R2 — Core world vertical slice
Port particle buffer, spawn/distribution, species DNA/phenotype, canonical law state, essential mechanics, contacts, spatial acceleration, worker/fallback, renderer/camera/HUD.
**Gate:** seeded world evolves visibly; pause/resume, law changes, camera, worker/fallback and finite-state checks pass.

## R3 — Full law and environment migration
Port law groups in source order; fields, walls, portals, wells, environment parameters and synergies; full law catalog/help/controls; per-law fixtures and matched benchmarks.
**Gate:** every stable law is executable or explicitly dispositioned; no hidden dead toggles.

## R4 — Config, presets and persistence
Port staged config, presets, species roster, save/import/export, undo/history/timeline and atomic worker synchronization.
**Gate:** full world round-trip and deterministic continuation after restore.

## R5 — Intelligence, ecology and communication
Port insight, narrative, lineage, goals, timeline, communication DNA/signals, ecology, speciation, biodiversity, food webs, niches and reversible world events.
**Gate:** systems are driven by live state, observable, deterministic within contract and snapshot/replay safe.

## R6 — Civilization and culture
Port group detection/roles, construction, roads/nests, economy/trade, memory/culture, governance, alliances/conflict, artifacts, infrastructure, energy flows and bounded agency.
**Gate:** long-running worlds demonstrate emergent group behavior with provenance and bounded compute.

## R7 — Advanced matter
Port exotic matter, relativity, quantum macroscale, stellar systems and remaining advanced laws with explicit semantics and dedicated controls.
**Gate:** each system has bounds/conservation/determinism/performance tests; no visual-only fake controls.

## R8 — Multiplex and tooling
Port isolated shards, fitness/evolution/selection, benchmark CLI/report, performance controls and developer diagnostics.
**Gate:** shard isolation and reproducible benchmark reports.

## R9 — Release hardening
Desktop/tablet/mobile E2E, COOP/COEP worker deployment and fallback, save/load, long-run recovery, accessibility, performance and memory soak.
**Gate:** actual user workflows work in browser and release claims match observed evidence.
