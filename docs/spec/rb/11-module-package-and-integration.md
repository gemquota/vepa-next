# 11 — Module packages, development and integration

**Current evidence:** one npm package (`vepa-v4`), ESM, Vite, Vitest, Playwright and generated technical specs. `package.json` build produces one static browser package and generates reports/atlas. `scripts/generate-spec.mjs` owns generated outputs under `docs/spec/`; these RB files are human-authored and must not overwrite generated records. Existing project runs in a single repo and browser package; this is a future module-development design, not current workspaces.

## Isolated development model

Create a module catalog and contract package before choosing a monorepo tool. Each module has manifest (`id`, semver, contract versions, entrypoints, owned state, dependencies, capabilities, tests, data migrations, UI mount), a documented public API and a test harness with fake host ports. Develop/test modules independently in the same repository/lockfile and shared toolchain; isolate package boundaries, not dependency versions or local services. No direct imports into another module’s private files, hidden singleton writes, circular dependencies, or direct DOM/global access outside shell adapters. Shared schemas have explicit version ownership.

Composition pipeline resolves dependency graph deterministically, validates duplicate IDs/owners, contract compatibility, required capabilities and cycle-free order, then builds one optimized ESM app with Vite. The default deliverable remains one browser app faithful to current VEPA4; module separation must not require separate user installation. Optional remote compute is a service adapter, not a package dependency that breaks offline/local mode. Keep current app as fallback until module-level, integration, browser parity and save migration gates are green.

## Developer workflow and gates

Per module: unit tests, contract tests, schema/migration tests, accessibility or rendering tests where applicable, performance budget and evidence link. Cross-module: composition smoke, full law/parameter coverage, event compatibility, save/load/undo, deterministic seed fixtures, fallback matrix, UI screenshots/interactions and distribution build. CI reports which module/contract introduced regression. Changed public contracts require a migration note and dependent module update. Generated docs are regenerated only by their generator; human RB specs remain separate and spec check behavior is reviewed before adding generator ownership.

## Migration phases

1. Record baseline visual/functional fixtures, exact source ownership and public contracts.
2. Introduce schemas/ports and legacy adapters without moving behavior.
3. Extract low-risk pure modules and tests; keep old facade forwarding to modules.
4. Move session/state ownership and solver stages behind stable facades; parity-test every step.
5. Add local compute adapters and renderer-independent frames; validate actual backend reporting.
6. Prototype opt-in cloud transport behind the same port, then test limits/security/reconnect and local fallback.
7. Introduce Easy Mode views only over canonical full settings; schema-expand parameters only through review/migration gates.
8. Remove legacy adapters only after a release-level migration and rollback plan are separately approved.

A phase is not complete on compilation alone. Capture accepted deviations, performance results, visual/browser evidence, known gaps and rollback conditions. Release/version/deployment remain separate authorization.