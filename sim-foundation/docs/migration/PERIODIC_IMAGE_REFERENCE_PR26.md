# Periodic-image reference calculations (PR #26)

## Scope

This change adds a deterministic, independently callable reference for the interaction of two distinct particles across a finite symmetric cubic set of periodic images. It evaluates image offsets in lexicographic integer order and uses compensated summation for the three force components and potential.

The reference uses a softened inverse-distance potential. The `strength` parameter is signed: negative values produce attractive gravity under the documented force convention; positive or negative values can represent the corresponding signed electric pair coefficient. The returned force is the force on the first particle.

## Convergence diagnostics

`estimatePeriodicImageConvergence` compares explicitly selected, strictly increasing shell radii. It reports force-vector and potential differences between successive shells. The `convergedByObservedDelta` flag is only a thresholded observation; `errorBound` is deliberately `null`. Shell differences are not a proof that the omitted infinite tail is bounded by that value.

## Mathematical limits

- A finite cubic image shell is an approximation, not an infinite periodic lattice sum.
- Unneutralized Newtonian gravity and electrostatics with net charge do not become well-defined merely by increasing a symmetric shell. A physical convention such as a neutralizing background, Ewald-type treatment, or another explicitly specified summation convention is needed.
- This API evaluates distinct-particle interactions and does not add self-image forces or self-image energy.
- The routine is a reference/diagnostic API. It does not replace the authoritative solver's toroidal minimum-image force path, does not alter the energy budget, and does not claim solver/reference agreement for trajectories.
- It is not wired into velocity-Verlet or adaptive substep selection. The existing solver continues to use minimum-image toroidal interactions.

## Reproducibility

Image identities are integer triples `ix,iy,iz`; order, shell, box size, softening and signed strength are explicit inputs. The result includes schema/version, convention, image count and limitations. Identical inputs in the same JavaScript numeric environment produce identical ordering and arithmetic reduction order.

## Complexity

A shell radius `s` evaluates `(2s+1)^3` images for each pair. The supported maximum shell is 12 (15,625 images). This is intentionally bounded to avoid unbounded work from untrusted configuration.
