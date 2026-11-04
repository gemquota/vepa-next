# Velocity Verlet reference validation (PR #24)

This PR adds selectable `velocity-verlet` integration for the authoritative pairwise gravity/electric kernel. The method uses the first acceleration for the half-step position update, recomputes pair accelerations from the updated positions, and applies the average of old/new accelerations to velocity.

The implementation deliberately fails closed unless the active laws are limited to gravity and charge, the boundary mode is toroidal, and no advanced physics/contact law is active. Drag, reflective-wall impacts, contacts, and extended/advanced physics are not silently approximated as conservative Verlet terms.

The contract test compares long-run two-body orbital energy drift against semi-implicit Euler using the softened, finite-cutoff potential convention. This is a numerical regression reference, not a proof of all-body stability or universal physical accuracy. Adaptive substeps remain deterministic; each substep uses the selected integrator. The abrupt force cutoff and minimum-image periodic model remain unchanged.
