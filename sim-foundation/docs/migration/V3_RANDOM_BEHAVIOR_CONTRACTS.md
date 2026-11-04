# Deterministic V3 random behavior contracts

This module maps the pinned V3 worker's audited random draws to keyed streams.
It is a draw-contract layer, not a port of the surrounding biological,
thermal, chemistry or physics mutations.

## Five bundled workstreams

1. **Lifecycle identity** — generation-aware particle identities are provided
   by `particle-identities.js`; use the full `particle:<slot>:<generation>`
   value, never the raw slot.
2. **Reproduction** — the spawn gate is world-scoped; child initialization is
   keyed by the child's newly allocated identity and preserves x/y/z position,
   x/y/z velocity, then species draw order.
3. **Biology** — senescence, genotype drift and isomerization have separate
   per-particle domains. Drift returns gate, trait index (0–41), then delta;
   isomerization returns gate then species index (0–11).
4. **Thermal and chaos** — heat, melt, boil and intrinsic jitter each return
   x/y/z draws. Chaos returns its gate and, when gate < 1, three vector draws.
   The caller must apply the source feature probability and gate threshold.
5. **Pair chemistry** — allotropy, phase-through and exothermic heat use a
   canonical unordered pair key. Exothermic heat returns x then y.

## Important integration rules

- Invoke a method only when its legacy law/feature gate is enabled. Disabled
  features must not consume draws.
- The helper returns raw unit draws; source probability thresholds, trait
  mutation ranges, physical scaling, state mutation, and event emission remain
  in the caller. This avoids inventing semantics not encoded by the random
  inventory.
- Pair keys are canonical and direction-independent. This does not decide
  which particle owns a one-sided mutation; the caller must preserve that
  ownership explicitly.
- Allocate a child's generation-aware identity before calling
  `childInitialization(childId)`.
- Persist both identity allocator and random-stream snapshots atomically with
  particle state.

## Scope boundary

The five workstreams are represented in one reviewable PR as deterministic
identity and draw-contract infrastructure. The existing Next solver has no
birth/death or V3 feature mutation lifecycle, so this change does not claim that
the 34 V3 random draws have been integrated into authoritative simulation
behavior or that V3 physics/ecology parity has been achieved.
