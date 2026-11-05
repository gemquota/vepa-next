# 07 — Execution backends and cloud processing

**Current evidence:** `src/main.js` sends INIT/CONFIG/TICK to `src/worker/physics.worker.js`; SharedArrayBuffer lets worker mutate local memory, ArrayBuffer fallback exists. Worker calls exact CPU `solve`, optionally after WebGPU pre-pass. `src/render/*` reads local particle view; browser COOP/COEP headers enable SAB. There is no present cloud simulation transport, service contract, identity model, or provider choice.

## Provider-neutral target

Define `ComputeSession` with interchangeable `main-thread`, `web-worker`, `GPU-assisted`, and `remote` adapters. Simulation session owns authoritative state and ordered ticks; local browser owns UI, camera, input, and rendering. Local is default and requires no account/network. Remote mode is explicitly opted into, communicates through an authenticated gateway, and must not be required to boot or restore a local world. Provider/service selection, cost ceiling, region, account, privacy and retention are ADR questions—not assumptions in this spec.

## Transport contract

Use versioned, sequenced commands (start/config patch/law change/pause/step/checkpoint/restore/stop) with session ID, world/schema versions, command ID, expected tick, idempotency key, and accepted/rejected ack. Law and physics-affecting configuration changes are restart-required: stage and acknowledge them as pending configuration, then apply only when starting a new world or explicitly restarting; never mutate the active run. Stream compact render snapshots/deltas (position, velocity/visual fields, counts, metrics as needed) with tick, sequence, server time, base snapshot ID and schema version. Do not send the full 100-float particle buffer every frame. Snapshot cadence and delta compression must be benchmarked. Include periodic full keyframes; detect gaps and request resync. Bound queues and apply backpressure; stale frames are dropped/coalesced for rendering, never reordered for state mutation.

Browser interpolates between timestamped snapshots, renders the latest coherent world with configurable interpolation delay, and shows tick/latency/staleness/backend/fallback status. User commands are applied only after authority ack. Disconnect freezes last known frame and exposes reconnect/stop/download; never silently fork local and remote authorities. “Continue locally” requires an explicit checkpoint transfer and parity test; it cannot promise deterministic continuation unless PRNG, all solver/subsystem state and cadence are captured.

## Security and operational requirements

TLS, short-lived scoped credentials, per-session authorization, origin checks, quotas/rate limits, bounded snapshot sizes, schema validation, abuse isolation, logs without genome/world payload leakage, data retention/deletion and opt-in telemetry. Define tenancy isolation, maximum particles/ticks, idle timeout, reconnect window, cost warnings and user-owned export. No secrets in client bundles. Provider failure or unsupported browser returns to local mode only through an explicit state transition with clearly stated state-loss/continuation limitations.