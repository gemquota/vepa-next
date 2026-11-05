# Pairwise force-work reconciliation (PR #23)

## Implemented evidence

The authoritative solver records gravity and electric pair potential changes at each solver substep. It uses the same pair displacement (including minimum-image displacement in toroidal worlds), softening, finite interaction radius, masses/charges, and cutoff-shifted potential convention as the force kernel and independent energy-budget reference.

Each event includes law, world, stable entity identities, canonical pair identity, substep, potential before/after, potential delta and conservative work (-delta potential). The bounded versioned journal validates event arithmetic, supports filters/summaries/export and survives execution snapshots.

## Interpretation and limits

These are potential-derived conservative-work measurements, not a claim that the integrator's actual kinetic-energy change equals their sum. Explicit/semi-implicit Euler, simultaneous pair interactions, other forces, contact correction and adaptive substeps can produce residuals. The journal intentionally does not distribute cross terms in total kinetic-energy change among pairs.

The finite-radius force is discontinuously truncated by the current solver. The cutoff-shifted potential is continuous at the radius but its derivative is discontinuous there; this is an explicit model boundary, not a smooth cutoff. Toroidal mode uses minimum-image pair displacement, not an infinite periodic lattice sum. No automatic energy correction is applied.
