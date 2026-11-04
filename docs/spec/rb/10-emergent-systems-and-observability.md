# 10 — Emergent systems and observability

**Current evidence:** `src/engines/` contains insight, speciation, ecology, world events, epochs, narrative, lineage, goals, agency and behaviors. Persistent subsystems live across `src/state/` (groups, economy, memory, construction, artifacts, governance, infrastructure, civilization, structures, continuity, codex, exotic matter, relativity, quantum, stellar, synthetic). `main.js` schedules and wires many of these around solver ticks; metrics scans and social/lineage/analytics run at configured cadences. UI includes HUD, intelligence, DNA analytics, logs, groups, ecology and civilization panels.

## Target boundary

Treat physics/lifecycle as authoritative simulation state; engines consume explicit tick snapshots/events and publish typed outputs. Each module declares tick cadence, deterministic inputs/seed, writable aggregate ownership, persistence/restore version, CPU budget, dependencies and reset behavior. Analytics/interpretation are read-only projections; they may issue bounded commands only through explicit agency policy, logged and undoable. No analytics scan or DOM work in pairwise solver hot path.

Metrics are immutable, versioned values labeled with source tick and completeness. Decimate scans; share cached aggregates across HUD, charts and remote telemetry. Narrative/log queues are bounded, batched, persisted only under defined retention, and have producer/consumer lifecycle with unsubscription. Distinguish observed facts, inferred links, experimental proxies and unavailable data in every panel. World reset, restore, fork and reconnect reset/rebind only the state owned by each engine; do not leave zombie listeners or stale references.

## Verification

Test module in isolation with deterministic fixtures and fake tick/event source; test integrated cadence and ownership; serialize/restore its state; exercise no-data, high-volume and repeated mount/dispose. Benchmark metric cost separately and verify slow panels do not back-pressure physics or remote ticks. Any purported subsystem lifecycle must have a real runtime consumer, not only a test. Telemetry is opt-in, privacy minimized, and distinguish compute timing, render timing, network delay, queue backlog, quality/approximation and active/fallback backend.