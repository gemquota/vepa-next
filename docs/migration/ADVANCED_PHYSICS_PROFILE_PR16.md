# PR #16 — conservative multiphysics kernel

This PR adds an opt-in advanced-physics stage to the authoritative VEPA Next solver. Existing worlds retain their current behavior unless an `advancedPhysics` profile is supplied. The profile is validated, serializable, included in execution-adapter configuration/snapshots, and passed to the solver.

## Integrated workstreams

1. SPH-style neighborhood density estimation.
2. Pressure response with symmetric pair forces.
3. Viscous momentum exchange with symmetric pair forces.
4. Magnetic Lorentz acceleration for charged moving particles.
5. Pairwise thermal conduction with equal-and-opposite energy transfer.
6. Contact restitution impulses.
7. Tangential contact friction.
8. Species-specific melting/boiling phase transitions with explicit latent-heat costs.
9. Deterministic pair chemistry with configurable reactants, products, rates and enthalpy.
10. Radioactive decay with configurable species transitions and mass-defect-to-energy conversion.
11. Radiation pressure as an explicitly configured external momentum source.
12. Structured per-step metrics for pair count, heat transfers, reactions, decays and phase changes.

## Example profile

```js
const advancedPhysics = {
  sph: { enabled: true, smoothingLength: 18, restDensity: 1, pressureStiffness: 0.4, viscosity: 0.08 },
  magnetic: { enabled: true, field: [0, 0, 0.2], scale: 1 },
  thermal: { enabled: true, conductivity: 0.05, smoothingLength: 18, heatCapacity: 1 },
  collisions: { enabled: true, restitution: 0.35, friction: 0.12 },
  phase: { enabled: true, materials: [
    { speciesId: 0, meltPoint: 40, boilPoint: 100, latentFusion: 5, latentVaporization: 12 }
  ] },
  chemistry: { enabled: true, reactions: [
    { speciesA: 0, speciesB: 1, productA: 2, productB: 2, rate: 0.2, energy: 3 }
  ] },
  nuclear: { enabled: true, decays: [
    { speciesId: 3, productSpeciesId: 4, rate: 0.01, massDefectFraction: 0.001, speedOfLightSquared: 1000 }
  ] },
  radiation: { enabled: true, direction: [0, 1, 0], pressure: 0.002 }
};
runtime.configure({ advancedPhysics });
```

## Compatibility and physical boundaries

- Every new subsystem is disabled by default; no existing save/world is silently upgraded to a new physical model.
- The profile contains plain serializable data and is carried by the execution adapter snapshot/configuration path.
- Pair calculations use the solver's authoritative spatial-neighbor query and fail closed if a query is incomplete.
- SPH pressure/viscosity, collision impulses and thermal conduction use pairwise symmetric exchanges. Radiation pressure and magnetic fields are explicit external fields/sources.
- Phase-change latent heat is transferred from sensible energy to the stored-energy slot and released again on the reverse transition; phase markers use the existing phase slot. Pair chemistry transfers energy between stored chemical energy and sensible heat, rather than creating enthalpy from nothing.
- Chemistry and nuclear reaction rules are explicit user-authored rules. This is a configurable simulation model, not a claim of validated real-world reaction kinetics, quantum chemistry, nuclear cross sections, or full thermodynamic closure.
- This PR does not yet implement mutual gravity, adaptive timestep subdivision, a full chemical species database, fission fragment allocation, Maxwell-field evolution, or a full 3D fluid free-surface solver. Those require further solver/data-model work and reference fixtures.
- Existing world configurations remain valid because `advancedPhysics` defaults to null.

## Verification

The dedicated contract suite exercises opt-in compatibility, validation, magnetic deflection, thermal-energy conservation, contact momentum conservation, phase/latent heat, deterministic chemistry, mass-energy decay conversion, SPH momentum balance and radiation pressure. Full repository CI is the authoritative check.
