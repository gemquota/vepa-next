# VEPA Next 9.3.5 operation map

**Audit target:** `main` @ `8b20f8a274d054a6f1251ae3207072d3f3dc66ca`  
**Product source pin:** DayneK/vepa v9.3.5 @ `d24301cdcf95a6142ffa98d9808dffaacb1d8523`.

This map describes the active root product and separately labels the SIM foundation. It is a call-path map, not a claim that every optional subsystem runs on every tick.

## 1. Boot and ownership

```text
index.html
  └─ src/main.js (application bootstrap)
       ├─ EventBus + seeded PRNG
       ├─ particle buffer + particle view
       ├─ law state + world params + runtime config
       ├─ species DNA buffer / defaults
       ├─ world population + spawn distribution
       ├─ renderer (Canvas2D / Pixi)
       ├─ UI panels + camera
       ├─ engines and state registries
       ├─ optional physics Worker
       └─ requestAnimationFrame(renderLoop)
```

**Primary ownership**
- Main thread owns application orchestration, UI, world/session registries, population bookkeeping, intelligence/analytics and render scheduling.
- Product solver owns one physics tick over the supplied particle view, count, stride, law state, DNA, world size, timestep and RNG callback.
- Worker owns solver execution when the worker path is available and initialized.
- Renderer reads the shared/current particle view; it is a projection, not a second simulation authority.
- SIM foundation owns only its own isolated session/worker state when its adapters are explicitly exercised by tests or future integration.

## 2. Runtime selection and tick sequence

```text
renderLoop(requestAnimationFrame)
  ├─ multiplex active?
  │    └─ shard controller step → shard render → return
  ├─ paused?
  │    ├─ yes: render current state only
  │    └─ no:
  │         ├─ worker ready?
  │         │    └─ send TICK (single-flight); await TICK_COMPLETE
  │         └─ otherwise run solveMain(...) locally
  │
  │         after a completed tick:
  │           ├─ drain/spawn offspring
  │           ├─ apply spawn-rate population feed
  │           ├─ advance population and lineage
  │           ├─ update intelligence/metrics
  │           ├─ update performance telemetry
  │           └─ emit physics:tick
  └─ render particles, sprites, camera and UI telemetry
```

Worker use is conditional: `canUsePhysicsWorker()` requires Worker, SharedArrayBuffer and a SharedArrayBuffer particle buffer. If unavailable or initialization fails, the application uses the main-thread solver. The particle buffer module also documents ArrayBuffer fallback for hosts without cross-origin isolation, including static hosting.

## 3. Product worker protocol

| Message | Direction | Responsibility |
|---|---|---|
| `INIT` | main → worker | Attach particle/DNA buffers, population count and initial config; initialize law state and optional GPU context |
| `INIT_COMPLETE` | worker → main | Confirm worker is ready |
| `CONFIG` | main → worker | Synchronize world size, timestep, world params, compute engine, law state and DNA updates |
| `TOGGLE_LAW` | main → worker | Apply a law-state change |
| `TICK` | main → worker | Request one serialized solver tick |
| `TICK_QUEUED` | worker → main | Report that a tick is already in flight |
| `TICK_COMPLETE` | worker → main | Return authoritative tick count, offspring and GPU state |
| `GPU_FALLBACK` | worker → main | Report device/compute failure and CPU fallback |
| `GET_STATE` / `RESTORE` | bidirectional | Read/restore worker-owned state |
| `PING` / `PONG` | bidirectional | Liveness probe |
| `ERROR` | worker → main | Surface protocol/init/tick failure; main marks worker failed and stops it |

The worker is single-flight. Do not introduce overlapping solver ticks: the main thread may render between completions, but physics completion order must remain serialized.

## 4. Product solver pipeline

```text
solve(view, count, stride, lawState, dnaBuffer, worldSize, dt, rng)
  ├─ bind/prepare solver scratch and runtime limits
  ├─ ensure field state / advance field cadence when enabled
  ├─ choose gravity/compute backend
  │    ├─ exact CPU (reference/default)
  │    ├─ Barnes–Hut (opt-in approximation)
  │    ├─ FMM (opt-in experimental approximation)
  │    └─ WebGPU forces (opt-in; CPU continuation/fallback)
  ├─ build/reuse spatial neighbor grid and pair candidates
  ├─ evaluate pair forces and active law families
  │    ├─ core laws in src/physics/laws.js
  │    ├─ category lawgroups
  │    ├─ synergy / compatibility
  │    ├─ field interactions
  │    └─ structural merge/bond paths
  ├─ contact/mechanics and boundary passes
  ├─ integrate particle state with timestep guards
  ├─ update per-particle lifecycle / offspring ring
  └─ return tick result to caller
```

**Important semantics**
- A law toggle is a permission/gate, not a command that guarantees visible motion.
- CONTACT geometric separation and COLL impact impulse are distinct operations.
- ACCR adjoins while preserving particle identities; ALLOY is the fusion path.
- The exact CPU solver remains the reference for approximate/accelerated paths.
- Barnes–Hut far-field aggregation omits some per-pair DNA modifiers; FMM has documented error-envelope limits. Neither should silently become default.
- Hot-loop scratch reuse and allocation-free pair processing are performance constraints, not optional cleanup preferences.

## 5. Post-tick subsystem pipeline

```text
solver result / offspring
  └─ main-thread completion
       ├─ population caps + spawn-rate feed
       ├─ birth/death/lineage tracking
       ├─ species/speciation/ecology/world events
       ├─ group and memory updates
       ├─ economy / construction / artifacts / governance / infrastructure
       ├─ civilization / culture / federation / structures / continuity / codex
       ├─ exotic matter / relativity / quantum macro / stellar / synthetic passes
       ├─ insight / agency / goals / narrative / timeline
       └─ metrics + EventBus notifications
```

These are cadence- and condition-dependent state systems. They are not all force kernels and must not be inserted into the particle pair loop merely to make the architecture look uniform.

## 6. Render pipeline

```text
particle buffer view
  ├─ sprite synchronization
  ├─ phenotype cache (DNA-derived colour/radius/alpha)
  ├─ camera projection
  └─ renderer backend
       ├─ Canvas2D fallback
       └─ PixiJS renderer
  └─ HUD / panels / telemetry
```

Rendering must not mutate physical state. Keep renderer caches bound to the specific view identity so multiplex shards cannot leak phenotype state across buffers. Measure both render backends on the same deterministic fixture.

## 7. Persistence pipeline

```text
live world
  ├─ captureWorldState
  │    ├─ particle buffer
  │    ├─ DNA buffer
  │    ├─ law state
  │    ├─ world params + selected runtime knobs
  │    ├─ world/tick metadata
  │    └─ supported civilization/codex state
  ├─ in-memory named save store / undo ring
  └─ exportWorldSave (.vepa.json)
       └─ parseWorldSave → validate/decode → restoreWorldState
```

Presets are not full snapshots: presets capture laws/DNA/world parameters; world saves capture particle state as well. Compatibility and schema evolution need explicit migration fixtures before changing the save format.

## 8. SIM foundation operation map (separate, not active product path)

```text
SIM caller / tests
  └─ world-session
       ├─ deterministic seed + PRNG streams
       ├─ transactional state + event journal
       ├─ canonical SIM law registry / manifest / law state
       ├─ particle identity + layout
       ├─ SIM solver + numerics
       │    ├─ spatial grid
       │    ├─ periodic images / Ewald
       │    ├─ contact constraints
       │    ├─ energy ledger / force-work journal
       │    └─ advanced physics
       ├─ execution adapter
       │    └─ SIM particle.worker protocol
       ├─ replay / snapshot / snapshot store
       └─ v3 migration adapters
```

The SIM worker protocol (`INIT`, `STEP`, `CONFIGURE`, `READ_RENDER_STATE`, identity/allocation/retirement, status/state, snapshot/restore, dispose) is not the product worker protocol above. Do not wire it into the UI until the adapter boundary, state ownership and buffer compatibility are specified.

## 9. Highest-risk integration boundaries

1. **Two law authorities:** product `src/constants/laws.js` and SIM registry must be reconciled by stable semantic IDs, not copied numeric indexes.
2. **Two particle layouts:** product Float32 stride and SIM particle-layout contract must not share buffers until every field, alignment, identity and migration rule is proven compatible.
3. **Two worker protocols:** no mixed message handling or shared mutable state across workers.
4. **Two random systems:** preserve deterministic replay by explicitly owning seed/stream state and defining cross-version RNG migration.
5. **Two persistence formats:** product `.vepa.json` and SIM snapshots need versioned conversion with round-trip and corruption tests.
6. **Energy evidence:** SIM ledger must be connected to actual force-work/integration events, not filled from post-hoc estimates.
7. **Browser deployment:** SharedArrayBuffer requires cross-origin isolation; the ArrayBuffer fallback must remain a first-class tested path for GitHub Pages.
