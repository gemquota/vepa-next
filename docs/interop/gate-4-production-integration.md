# Gate 4 — production integration boundary

## Purpose

Gate 4 connects the existing SIM foundation to the product worker as an **opt-in diagnostic shadow**. The product solver remains authoritative. The shadow evolves an isolated copy of product state, reports status/parity evidence, and cannot write into product particle buffers or select a replacement backend.

## Stage completion

| Stage | Integrated result | Boundary / qualification |
|---|---|---|
| G4.1 deterministic random-stream ownership | Product SplitMix32 is exposed through a checkpointable adapter. Main-thread and worker stream checkpoints are captured separately and survive product-save and SIM-snapshot conversion. | The adapter preserves the legacy sequence. It does not yet migrate product stochastic consumers to keyed per-domain/per-entity streams. |
| G4.2 stable particle identities | SIM execution assigns stable identities to live particle slots and carries allocator state through snapshots. | Identity allocation is part of SIM execution; it does not rewrite product particle layout or legacy saves. |
| G4.3 append-only event journal | SIM execution records sequenced, world-scoped events with monotonic sequence/tick validation. | Journal events are SIM evidence, not a new source of product-side mutations. |
| G4.4 checkpoints and deterministic replay | Checkpoints include world identity, generation, tick, state, config, PRNG state and journal cursor. Restore checks world identity and state digest; replay rejects invalid event suffixes before mutation. | Legacy product saves without PRNG checkpoints remain readable but cannot resume the exact prior random sequence. |
| G4.5 worker adapter integration | The live physics worker can initialize/rebase/step the SIM shadow behind `simFoundationShadow`, disabled by default. Runtime status and parity diagnostics are surfaced to the main thread. | The product worker protocol version remains unchanged; the existing message types carry only additive optional metadata. The authoritative solver remains unchanged. Unsupported product laws fail closed. |
| G4.6 spatial-grid parity | Periodic neighbor enumeration and overflow fallback are covered against a reference implementation. | This is SIM-side parity evidence; it does not silently replace the product neighbor builder. |
| G4.7 numerics and advanced physics | SIM exposes validated numerics/advanced-physics configuration, bounded substep selection, conservative integration paths and periodic-image/Ewald analysis with contract coverage. | Experimental or unsupported configurations remain explicit failures/skips; no default product solver promotion occurs. |

## Random-state contract

Product saves use an additive optional `prng` field. The current shape stores the main-thread and worker SplitMix32 checkpoints independently. A checkpoint identifies the algorithm and unsigned 32-bit internal state; the seed is retained alongside each stream. Import accepts legacy saves with no `prng` field. Those saves load normally, but the missing historical stream position is not fabricated.

The existing product stream output sequence is preserved. Keyed stream ownership is a future migration, not something this adapter pretends has already happened.

## Worker lifecycle

1. Product worker initialization creates the authoritative product solver as before.
2. With the shadow flag disabled, no SIM shadow runtime is created.
3. When explicitly enabled, the worker snapshots product state and active law names into the adapter.
4. Supported law mappings initialize an isolated SIM state. Any unsupported active law produces an explicit `unsupported` status rather than a partial comparison.
5. Each worker tick advances the product solver normally and advances the SIM copy for diagnostics. Sampled comparisons report hashes, maximum absolute difference, tolerance and tick.
6. Configuration changes rebase the shadow from current product state. Disabling the flag drops the shadow and stops diagnostics.

The shadow is not a second authoritative solver, a rollback mechanism for product state, or a hidden backend selector.

## Supported product-law mapping

The adapter currently maps the seven explicitly reviewed product laws: GRAV, DRAG, COLL, CHARGE_LAW, ENTR, BUOYANCY and BOND. Unsupported laws fail closed. ACCR is intentionally excluded because its product semantics preserve distinct particle identities and do not match a generic force-law mapping.

## Validation

Coverage is split across:
- product PRNG sequence compatibility and checkpoint round trips;
- product save normalization and legacy-save compatibility;
- product/SIM boundary conversion and worker response correlation;
- SIM identity allocation, event-journal sequencing, snapshot restore and deterministic replay;
- periodic spatial-grid reference parity;
- browser worker opt-in, worker tick continuity and CPU/GPU fallback checks.

Hardware-dependent WebGPU evidence must be reported as skipped when no adapter is available. A skip is not a parity pass.

## Explicit non-goals

- No default solver or backend change.
- No mutation of product particle buffers by SIM shadow execution.
- No product particle-layout or save-version bump.
- No claim that legacy saves can recover PRNG history they never stored.
- No automatic mapping of unsupported laws or semantic reinterpretation of ACCR.
