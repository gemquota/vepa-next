# Energy budget verification framework (PR #20)

## Scope and guarantee

This module provides a versioned, explicitly bounded audit for kinetic energy and the solver's softened finite-cutoff gravity and electric pair forces. It uses an independent O(n²) reference traversal rather than the spatial grid used by the production force pass. The audit reports a residual; it does not modify particle state or silently correct drift.

## Unit contract

Every profile declares a unit-system label and non-empty labels for length, mass, time, charge and energy. The default is explicitly named `simulation`, not SI. The labels are dimensional declarations for audit compatibility; they do not convert values or prove that caller-supplied constants are dimensionally correct. Profiles are schema/version pinned and incompatible energy labels cannot be compared.

## Potential energy

For each live pair within the finite interaction radius, the audit integrates the implemented softened radial force and shifts the potential to zero at the cutoff:

- Gravity: `-G m_i m_j (1/sqrt(r²+eps²) - 1/sqrt(R²+eps²))`
- Electric: `k q_i q_j (1/sqrt(r²+eps²) - 1/sqrt(R²+eps²))`

Toroidal worlds use the solver's minimum-image displacement. This is not an explicit periodic-image lattice sum. Reflective walls contribute no wall potential. Pairs at zero separation are skipped, matching the solver's zero-distance guard.

## Residuals and provenance

`compareEnergyBudgets` reports total change, caller-declared external work, caller-declared modeled internal transfer net, and the unexplained residual. Internal transfers should net to zero in a closed whole-world sum; the argument exists for explicitly scoped subsystem comparisons. A tolerance is caller-selected and never inferred as a physical guarantee.

## Explicit exclusions

The audit does not infer thermal, chemical, phase, nuclear, radiation, magnetic-field, SPH, contact, drag, deformation, accretion, retirement, boundary impulse, or legacy `ENERGY` / `STORED_ENERGY` inventories. Prescribed magnetic fields are not evolving Maxwell fields. Radiation pressure source work is not currently isolated. Reflective-boundary work and numerical wall residuals are not yet separately measured. Potential assumptions must be revised if the production force law changes.

This is an independent reference calculation and diagnostic contract, not a proof of global conservation, a scientific validation of all physics, or a safe basis for automatic energy correction.
