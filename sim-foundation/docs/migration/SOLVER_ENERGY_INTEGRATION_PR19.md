# PR #19 — Solver energy-transfer instrumentation

## Integrated solver stages

The execution adapter now collects energy-transfer intents from each internal solver substep and commits the complete event batch to the PR #18 ledger at the end of a successful outer tick. The particle-state checkpoint is restored if solver execution or ledger commit fails. Events are tagged with the outer simulation tick and retain deterministic emission order.

Instrumented transfer causes:

- **Drag:** exact kinetic-energy reduction caused by the configured exponential velocity damping, routed to a configurable thermal or dissipation destination.
- **SPH viscosity:** pairwise relative-velocity work estimate booked as viscous heating. This is a modelled dissipative-work estimate; it is not an exact discrete energy delta of the complete pressure-plus-viscosity integrator.
- **Thermal conduction:** directional pairwise transfers matching the signed amount applied to the two particle energy slots.
- **Inelastic contacts:** measured pair kinetic-energy decrease across restitution and friction impulses, booked as heat.
- **Phase transitions:** latent heat moved between particle thermal and phase-energy accounts on melting, vaporization and reverse transitions.
- **Chemical reactions:** reaction enthalpy transferred between pair chemical and thermal flow accounts.
- **Radioactive decay:** configured mass-defect energy moved from a rest-mass flow account to a radiation flow account.

## Transaction semantics

1. Solver stages append transfer intents to a tick-local buffer; they do not mutate the ledger while substeps are still executing.
2. After all substeps succeed, the adapter creates any missing typed flow accounts and submits one ledger transaction for the full tick.
3. If the batch is invalid or exceeds the bounded event journal capacity, the particle state is restored to the pre-tick checkpoint and the tick does not advance.
4. The ledger tick advances only after successful state and event commit.
5. The adapter exposes the number of emitted transfer events in each step result.

Flow accounts use explicit directional names (for example, `kinetic:particle:4`, `thermal:particle:4`, `chemical:pair:2:8`). These are event-flow accumulators, not authoritative inventories of the complete physical energy stored in each particle. The journal is the source of provenance.

## Configurable drag destination

```js
const runtime = createParticleExecutionAdapter({
  initialState,
  config: {
    activeLawIds: ['law.drag'],
    dragCoefficient: 0.02,
    dragEnergyDestination: 'thermal', // or 'dissipation'
  },
});
```

## Deliberate limits

This integration improves transfer provenance but does not yet close the simulator's global energy budget.

- Gravity and electric force work are not booked. A future potential-energy model must match the solver's softened force, finite interaction cutoff and boundary convention.
- Magnetic Lorentz work is not booked as field energy; the current model uses a prescribed external field and does not evolve Maxwell fields.
- Radiation pressure source work is not yet separated from other acceleration contributions.
- The SPH viscosity entry is a pairwise dissipative-work estimate; a force-work integrator with discrete energy correction is still needed for exact accounting.
- The legacy `ENERGY` and `STORED_ENERGY` slots have no complete global unit/ownership contract. Flow events intentionally do not pretend to reconstruct their full balances.
- Rest-mass flow uses the configured `speedOfLightSquared` value. This is a simulation parameter, not a claim that the world uses SI units.
- Boundary reflections, accretion/retirement, external fields, and all extended-law state mutations still need dedicated energy models.
- The event journal is bounded by the ledger's configured capacity (default 10,000 events); it fails closed instead of silently discarding history.

Conservation residuals are therefore not presented as a validated physical conservation proof. PR #19 delivers instrumented, replayable and atomically committed subsystem transfer events with explicit model limits.

## Verification scope

Tests cover drag's exact damping loss, conduction direction, inelastic contact loss, phase latent heat, chemical enthalpy, nuclear mass-defect transfer, tick provenance and rollback when ledger capacity rejects a solver tick. CI is the authoritative result.
