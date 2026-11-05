# Generation-aware particle identities

## Purpose

Particle array slots are reusable storage locations, not durable identities. A
particle that dies and is replaced in the same slot must not inherit the prior
occupant's deterministic random stream. This module gives every allocation a
slot-plus-generation identity, for example `particle:12:3`.

## Contract

- Allocation is explicit; the authoritative simulation lifecycle calls it when
  a particle is born and calls `release(identity)` when that exact occupant dies.
- Automatic allocation chooses the lowest free slot. A caller may request a
  specific free slot when a legacy free-list determines placement.
- Every successful allocation increments the slot generation. A released slot
  can be reused, but its next identity is different.
- Release is generation-checked. A stale death/release event cannot free a
  newer occupant of the same slot.
- Snapshots contain schema/version, capacity, per-slot generations and active
  flags. Restore validates the complete input before replacing live allocator
  state.
- Use the returned `identity.id` as the entity key for keyed random streams.
  Save this allocator snapshot atomically beside particle state and RNG state.

## Deliberate integration boundary

This is a lifecycle primitive, not an inferred mirror of the current Float64
particle buffer. The current solver has a fixed particle count and no birth/death
allocator API, while the audited V3 worker owns a separate dead-slot free-list.
The module therefore does not mutate particle state or claim that reproduction
is migrated. The next integration step must connect allocation/release to the
actual birth/death mutation points and include this snapshot in the enclosing
world checkpoint.
