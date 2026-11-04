# Contact and structural behavior correction — 2026-10-11

Working-tree version 9.3.3; not a release or physical-fidelity signoff.

## Causes and repair

- Contact correction preceded integration and radius growth, ignored exact-center stationary overlaps and shared truncated force neighbors. Final discrete projection rebuilds a radius-aware uncapped broadphase after motion/growth. Pair corrections are mass-weighted and deterministic; eight bounded iterations preserve a resource limit rather than claiming perfect dense packing.
- POLYMER returned a spring which the solver ignored. The solver now accumulates it; rest distance is max(4, sum of radii) and formation honors schema POLYMER_LIMIT (up to six mutual slots).
- ADHESION pulled inward at/below contact. It now restores surface gap with mass weighting/normal damping and separates penetration.
- BOND writeback attracted eligible but unlinked neighbors to a DNA-scaled distant equilibrium. Correction now requires an actual bond; surface-based symmetric BOND_ANGLE spacing controls its spring. ACCR final seam maintenance follows mass-grown radii instead of stale contact sizes. Dead absorbed particles are not projected.

## Evidence

`tests/unit/contactStructures.test.js` covers coincident centers, center of mass, large radii, periodic seams vs walls, dense local contact with force cell cap 1, final motion/radius separation, dead endpoint exclusion, actual polymer spring integration/mutual topology, a 40-tick three-particle chain, and adhesion force direction. ACCR dwell recognizes surface contact within 0.001 units so the projection margin does not reset slow attachment timers.

Accretion audits now compare separation against final radii, not initial 0.6-radius assumptions. BOND_ANGLE audit uses stiff linked particles; unlinked attraction is no longer its expected behavior. Existing absorption, accretion identity and law gating audits remain enabled.

Full Vitest: 143 files / 1,567 tests passed on 2026-10-11.

A five-sample Node contact-only check used SplitMix32(42), uniform 1200³ worlds, radius 3, mass 1, at 900/2,500/10,000 particles. Median times after numeric cell keys and reduced duplicate-cell bookkeeping: 7.59 / 16.93 / 36.42 ms on this host. Initial implementation measured 12.34 / 54.37 / 560.46 ms on the same fixture. These exclude the rest of solve/render and are not FPS guarantees or dense/large-radius timings. No claim of speedup versus the pre-task solver.

Managed preview readiness succeeded; Chromium interaction/screenshot verification failed at launch because `libglib-2.0.so.0` is missing.

## Limits

This is bounded discrete behavior, not continuous swept collision detection, complete packing convergence, energy conservation or measured scientific fidelity. Extremely overpacked worlds can retain penetration; large-radius cells can degrade toward quadratic work. Forces still use configured neighbor budgets. Ghost worlds with no hard-contact/structural law remain pass-through. Disjoint 3D spheres can overlap in 2D projection, and renderer visualScale can exceed physical radius. Browser verification remains blocked by host Chromium libraries.
