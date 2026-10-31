# PR #17 — deterministic adaptive numerics and diagnostics

## Scope

This milestone adds an opt-in numerical policy to the execution adapter while preserving the legacy default (one semi-implicit Euler step per tick). The policy is validated, serialized in snapshots, and deterministic for identical inputs.

## Integrated workstreams

1. Selectable explicit Euler and semi-implicit Euler position integration.
2. Opt-in adaptive substepping based on a maximum estimated particle displacement per substep.
3. Configurable maximum substep count with an explicit `stabilityLimited` diagnostic when the requested count exceeds the cap.
4. Live-state finite-value validation and fail-closed behavior.
5. Optional pre/post kinetic-energy, momentum, maximum-speed and live-count diagnostics.
6. Aggregate per-tick interaction, fallback-query and advanced-physics metrics across substeps.
7. Numerical policy validation and snapshot round-trip persistence.
8. Deterministic replay checks across independently constructed adapters.
9. Explicitly documented numerical limits and compatibility defaults.

## Configuration

```js
runtime.configure({
  numerics: {
    integrator: 'semi-implicit-euler',
    adaptiveSubstepping: true,
    maxDisplacementFraction: 0.25,
    maxSubsteps: 16,
    rollbackOnNonFinite: true,
    diagnostics: true
  }
});
```

Set `integrator: 'explicit-euler'` to use old-velocity position updates. The default remains semi-implicit Euler. Adaptive subdivision is disabled by default.

## Interpretation and limitations

- The displacement estimator uses current maximum speed and interaction radius. It is a deterministic travel-distance bound, not a force-aware CFL condition or an error-controlled integrator; strong acceleration can still require smaller timesteps.
- If the requested subdivision exceeds `maxSubsteps`, the solver reports `stabilityLimited: true`; callers should treat this as a warning that the configured cap was reached.
- The supported integrators are explicit Euler and semi-implicit Euler. Velocity Verlet is deferred because current behavior stages include state-mutating, dissipative and reaction subsystems that need a force/potential split before a valid symplectic implementation.
- Kinetic-energy and momentum diagnostics are observations, not universal conservation assertions. Gravity, radiation pressure, drag, collisions, chemistry, nuclear conversion and external fields can exchange or remove energy/momentum; full accounting needs subsystem-specific potential and source ledgers.
- The finite-state guard checks live particle kinematics and mass. It does not certify every auxiliary species slot or validate the scientific accuracy of the configured multiphysics model.
- No claim of full Maxwell evolution, a validated fluid solver, large-scale parallelism or real-world chemical/nuclear kinetics is made by this PR.

## Compatibility

Existing worlds retain the same default timestep, semi-implicit Euler integration and one solver call per tick. Adaptive subdivision is opt-in. The numerical profile is included in execution configuration and snapshots.
