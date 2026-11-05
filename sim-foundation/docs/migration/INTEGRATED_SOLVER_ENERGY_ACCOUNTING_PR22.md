# Integrated solver boundary evidence (PR #22)

This change adds deterministic, bounded evidence from the actual position-integration path.

## Recorded effects

- Reflective wall impacts record the stable world/entity identity, substep, axis, wall, measured momentum impulse, and measured kinetic-energy change. A stationary ideal wall is assigned zero work; the measured kinetic delta is retained rather than silently described as conserved.
- Toroidal crossings record the before/after coordinate and identity. A wrap is a coordinate remapping, not a physical impulse or energy transfer, so its work is explicitly zero.
- Events are collected during all adaptive substeps, then appended as one validated batch after the outer tick succeeds. Capacity or validation failures restore the particle state and leave the evidence journal unchanged.
- The journal has a versioned snapshot, deterministic sequence, filters, summary and JSON export.

## Explicit limits

This is not a global conservation proof. It does not infer work from gravity/electric pair forces, reflective-wall compliance, periodic-image lattice energy, evolving magnetic fields, radiation depletion, or particle lifecycle transfers. The current solver clamps a particle to a wall after an overshoot; the recorded impulse and kinetic delta describe that implemented operation, not a finite-duration collision model. Stable entity identities are supplied by the execution adapter; direct low-level solver callers may omit them and receive slot-scoped identities. Pair and source-level reconciliation, velocity-Verlet, and independent physical reference models remain separate work rather than being simulated by synthetic evidence.
