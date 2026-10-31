# Energy source, boundary and lifecycle accounting — PR #21

## What is recorded

The versioned lifecycle audit records explicit, append-only evidence for particle creation and retirement, accretion, external work, reflective-boundary work/flux, prescribed magnetic-field work, radiation work/momentum exchange, generic source work and substep transfers. Each record carries a stable caller-supplied source identity, optional entity/target identity, tick, signed mass/energy/momentum deltas, energy-unit label, provenance and metadata. The bounded journal supports filtering, summaries, JSON export and validated snapshot restore.

The execution adapter automatically records particle creation and retirement using quantities it can directly calculate from the particle buffer: mass, kinetic energy and momentum. It deliberately does not interpret legacy ENERGY or STORED_ENERGY slots as dimensioned inventories.

## Explicit source APIs

`recordEnergySourceEvent(event)` accepts a versioned event kind and caller-measured deltas. This is the integration seam for force providers, boundary handlers, radiation transport, magnetic-field providers, accretion logic and worker substep instrumentation. A record is evidence supplied by the subsystem; it is not a physical measurement performed by this audit module.

The `recordAccretionEvent` helper requires caller-supplied transferred mass and carried energy deltas. It does not mutate particle state or claim that an accretion operation happened. The owner of the particle lifecycle must apply the corresponding state transition atomically with its own transaction.

## Guarantees and limitations

- Events are ordered by append sequence and carry the caller's tick and stable source identity.
- Journal capacity is bounded and overflow fails closed; no event is silently discarded.
- Snapshot restore validates schema, sequence, event kinds and finite values.
- Particle create/retire captures mass, kinetic energy and momentum from the actual state buffer.
- The journal does not infer force work, wall impulses, accretion physics, magnetic field energy or radiation source depletion.
- Solver-level reflective wall flux and per-adaptive-substep source work are not automatically emitted until those solver subsystems provide exact work/impulse hooks.
- Toroidal wrapping is a coordinate remapping, not an energy source; potential continuity remains subject to the energy-budget profile's minimum-image assumptions.
- Event totals from unrelated source identities or energy-unit labels must not be summed without a caller-defined dimensional conversion.
- No automatic energy correction is performed.

This is a provenance and accounting integration seam, not a proof of global conservation. Unknown physical work remains unknown rather than being assigned a fabricated source.
