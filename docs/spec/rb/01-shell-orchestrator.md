# 01 — App shell and orchestrator

**Current evidence:** `index.html`, `src/main.js`, `src/ui/ui.js`, `src/core/eventBus.js`, `src/state/runtimeConfig.js`. The 1,931-line `main.js` currently performs boot, creates shared state, resolves launch settings/presets, spawns population, mounts render/UI, wires worker and buses, and advances many subsystems. The shell is literal DOM/canvas, not a React application despite React dependencies and a hidden root node.

## Target responsibility

Keep a thin `app-shell` responsible for DOM/canvas hosts, module registration, capability discovery, service composition, and lifecycle (`start`, `pause`, `dispose`). Move simulation/world lifecycle coordination into an `application-runtime` facade with explicit dependencies; retain the current visible shells and interaction model through a parity adapter. Avoid a big-bang rewrite or parallel competing sources of truth.

## Contracts

- Boot order is explicit: capability probe → load/normalize launch profile → create world state → initialize compute session → create renderer → mount panels → start clocks. A failure in optional launch UI, GPU, Pixi, worker, or cloud transport must reach a usable documented fallback.
- Modules register through a versioned manifest declaring ID/version, owned state, public ports, capabilities, dependencies, startup/disposal, and optional UI mounts. The composition root rejects duplicate ownership, missing dependencies, incompatible contracts, and cycles before starting.
- Modules receive narrow interfaces (`WorldReadModel`, `WorldCommands`, `TickSource`, `RendererPort`, `EventPort`, persistence ports); no importing mutable singleton `runtimeConfig` across package boundaries in the target. The legacy adapter may wrap it temporarily.
- Events are typed/versioned envelopes with session ID, sequence/tick, timestamp, origin and payload. Commands are validated, acknowledged/rejected, idempotent where retried, and never imply state change before authoritative acknowledgement. Physics-affecting law/parameter edits stage as configuration and take effect only on new-world start or explicit restart; no mid-run mutation is allowed.
- Lifecycle owns one authoritative world session and disposes listeners, workers, transport, timers, renderers, and cached views on reset/restore/unmount. Repeated boot or panel recreation must not stack listeners.
- Existing launch preset, seed, SIM pause/restart/chaos, law/world/DNA changes, HUD, narrative, undo and save flows are parity fixtures. Preserve law/world/DNA edit affordances while ensuring physics-affecting changes are staged and applied only after restart, as required by the accepted roadmap.

## Extraction order

First extract pure helpers and typed contracts; next world/session controller; then UI and renderer adapters; only after deterministic integration tests move subsystem scheduling. Keep `main.js` as the legacy entry facade until all callers and parity gates are migrated. Do not promise full independent deployment: modules are isolated for development/test but bundled as one browser package unless a separately approved service boundary is selected.