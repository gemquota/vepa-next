# Gate 4 — production integration contracts

## G4.1 deterministic random-stream ownership

The product has two existing random execution contexts:
- The main-thread fallback / ecology path uses the product `SplitMix32` instance in `src/main.js`.
- The physics worker uses one legacy SplitMix32 stream passed into `src/physics/solver.js`; stochastic consumers are reached through the solver's `prng` callback, including lifecycle/reproduction, mutation, predation, radiation/chemistry and stochastic field/law paths. Their draw order is therefore coupled to particle traversal, enabled-law set and tick ordering.

The worker now uses `createProductRandomAdapter` from `src/core/prng.js`. Its next-value sequence is bit-for-bit identical to the previous inline worker implementation and to the SIM `SplitMix32` bridge. The adapter exposes a serializable algorithm/seed/state checkpoint. Main-thread and worker states are stored separately in the additive v1 save `prng` field and restored independently. Old saves without this optional field remain loadable but cannot claim exact stochastic continuation.

SIM owns deterministic named streams keyed by domain and entity identity. Stream allocation is independent of access order, and snapshots include each stream state. The product shadow records the current legacy worker stream but does not redirect existing product consumers into SIM streams. Per-consumer migration remains a future parity-gated step; no global draw-order change is hidden in this integration.

## G4.2 stable particle identities

The SIM execution adapter allocates stable particle IDs with slot generations, rather than treating array indices as identity. It records identity state in checkpoints, restores it with the particle buffer, and increments generations when a world reset reuses a slot. Birth/death transitions from explicit lifecycle operations, V3 behavior operations and solver-detected state transitions are recorded against those IDs.

Product particle-array indexing and rendering indices remain unchanged. Identity is an additive SIM-side layer.

## G4.3 append-only event journal

The execution adapter now journals:
- `particle.created` and `particle.retired` with identity, slot, mass, kinetic-energy and momentum deltas;
- `world.configured` with changed keys and active law IDs;
- `world.reset` with generation and state digest;
- `world.snapshot-created` and `world.snapshot-restored`.

Events use versioned envelopes, a monotonic journal sequence and a monotonic journal clock. Snapshot restore validates and reinstates the prior journal before appending the restore event. Journal replay is a deterministic reducer API for domain events; it is not presented as a substitute for replaying physics state.

## G4.4 checkpoints and deterministic replay

SIM adapter checkpoints include typed particle state, layout version, world identity, tick/generation, validated config, named random-stream state, particle identities, energy ledger/budget, lifecycle audit, solver evidence, force-work journal, event journal and a particle-state digest. Restore rejects mismatched world/layout, malformed event sequence and state-digest corruption.

`replayParticleTicks(snapshot, n)` restores a complete checkpoint and advances exactly `n` deterministic solver ticks. The replay fixture compares final state digest, identity state and random-stream state. This is checkpoint-based deterministic replay. It does not claim that the partial domain event journal alone can reconstruct arbitrary historical physics.

The product save format remains v1 with an additive optional `prng` field containing main-thread and worker SplitMix32 checkpoints. Older v1 saves without it load with `prng: null` and report deterministic continuation unavailable. The product↔SIM converter preserves both checkpoints when present.

## G4.5 worker adapter integration

The actual product physics worker can load `sim-foundation/src/interop/product-shadow-runtime.js` only when `runtimeConfig.simFoundationShadow` is enabled. The feature is disabled by default and can be toggled in the running app with `window.__VEPA_SIM_SHADOW__(true|false)`.

The shadow uses the versioned PR33 request/response envelope and response tracker. It evolves a separate Float64 SIM state and periodically compares it with the product worker state. It never writes to product buffers or replaces product solver output. Diagnostics are attached to existing worker tick responses and exposed through `physics:simShadow` / `physics:simShadowStatus` events.

Only seven product laws currently map into the SIM runtime: GRAV, DRAG, COLL, CHARGE_LAW, ENTR, BUOYANCY and BOND. WRAP is handled separately through boundaryMode derived from world parameters; it is not sent as a force law. Any other active unsupported law fails closed and disables shadow execution for that configuration. CHARGE_LAW additionally requires an explicit positive electric constant. ACCR is deliberately excluded: product ACCR is structural adjacency, while the current SIM accretion implementation fuses particle state. Numeric index or name similarity is not sufficient evidence of semantic parity.

The worker still uses the product solver as the only authoritative path. The shadow is for parity evidence, not a production backend promotion. The Pages browser acceptance suite verifies both default fail-closed behavior and a supported-only configuration, while checking that product ticks continue.

## G4.6 spatial grid and periodic features

The SIM spatial grid uses wrapped cell addressing and overflow buckets. Contract tests compare its candidate set against exact toroidal minimum-image pairs, including face-crossing pairs, crowded overflow cells and query-buffer truncation. A truncated query must either fall back to a complete scan or explicitly report insufficient output capacity; it cannot silently drop neighbors.

The fixed-seed acceptance benchmark now reports grid candidate cost and exact pair coverage at 128, 512 and 2048 particles. Exact distance filtering remains authoritative after candidate generation. Minimum-image periodic handling is available in the shadow configuration. Ewald/periodic-image treatment remains selective and must be enabled only for force families with demonstrated long-range error.

## G4.7 numerics and advanced physics

The shadow adapter accepts the SIM advanced-physics configuration only through its explicit `simAdvancedPhysics` input. The SIM config validator checks the complete profile before the adapter is created; malformed/non-finite parameters fail closed. The default remains `advancedPhysics: null`. Existing per-feature numerical contracts and tests remain the acceptance basis; no advanced module is silently enabled or treated as product parity merely because it can be configured.

## Safety boundary

This gate does not change the product solver default, renderer, product worker output buffer, product law semantics, product particle indexing, default compute engine, existing worlds or save version. The SIM shadow is opt-in, isolated, and diagnostic-only. Unsupported laws are explicit rather than approximated by name.
