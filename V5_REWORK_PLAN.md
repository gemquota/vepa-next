# V5 Rework Integration Plan

**Source:** `DayneK/v5` @ `fa148baf57a7f006bbfc5e47be435212145cb574`  
**Consolidation review:** `gemquota/vepa-consolidation/V5_REWORK_CONSOLIDATION.md`

## Principle

V5 is a behavior source, not the architecture to transplant. Its UI/correctness rework becomes SIM acceptance criteria and vertical slices. Direct panel-to-worker coupling, duplicate state ownership and historical implementation structure are not carried forward.

## Integration order

### 1. Law contract hardening

- Make the law registry the sole authoritative declaration of law identity and implementation status.
- Add dead-law/undeclared-law coverage.
- Add WRAP boundary semantics and explicit parameter↔law synchronization.
- Ensure individual and bulk law mutations share one command path.

**Gate:** every declared law is executable or explicitly allow-listed; WRAP replay fixtures pass.

### 2. Configuration lifecycle

- Route presets and backend changes through `world-session` transactions.
- Represent requested, validated, committed and applied values separately.
- Record rejected/rolled-back/blocked outcomes in the event journal.
- Treat backend/fidelity selection as replay metadata.

**Gate:** invalid and partial changes cannot mutate the last-known-good world silently.

### 3. Persistence and saves

- Connect V5 WORLD STATES / UNDO / IMPORT-EXPORT behavior to the existing snapshot contracts.
- Move authoritative state capture into the execution adapter once the worker is integrated.
- Preserve recoverable two-slot storage semantics.

**Gate:** save/restore produces matching world state and detects corruption or incomplete writes.

### 4. UI state projections

- Introduce shared selection state as a UI/application projection.
- Add law search, category filtering, active counts and bulk controls.
- Add explicit pending/active state for settings.
- Keep renderer/UI state read-only with respect to simulation state.

**Gate:** UI mutations only issue commands/proposals and all displayed committed state has a traceable source.

### 5. Event/read-model layer

- Add narrative batching over the event journal/application adapter.
- Derive analytics and CODEX-style evidence displays from committed snapshots/events.
- Preserve tick/sequence/evidence age rather than duplicating mutable panel state.

**Gate:** event ordering and read models survive replay and stale-state fixtures.

### 6. Browser integration

- Reuse the behavioral intent of V5's DOM/canvas tests, not its implementation assumptions.
- Add a real-browser smoke layer when the runtime application exists.
- Keep structural/unit tests for fast CI and browser tests for reachability/render paths.

**Gate:** mounted controls, producers, consumers and canvas draw paths are exercised in a real browser.

## Explicit non-goals

- Do not import the V5 application wholesale.
- Do not recreate V5's duplicate registries.
- Do not let UI panels own authoritative simulation state.
- Do not mark a feature complete because V5 documentation says it worked.
- Do not claim browser verification without executing a browser.

## Completion definition

The V5 rework is fully consolidated only when each of its distinct capabilities has a canonical VEPA Next owner, SIM contract, provenance entry, regression coverage and verification status. A capability may be deferred, replaced or rejected, but that disposition must be explicit.
