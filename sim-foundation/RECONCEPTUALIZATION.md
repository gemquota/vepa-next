# VEPA Universe: reconceptualization

**Status:** experimental product direction and first single-file prototype  
**Target:** `gemquota/vepa-next`, isolated branch `reconcept/3d-law-sandbox`

## Product thesis

VEPA should be experienced as a small, living universe rather than a conventional dashboard. The primary object is the evolving 3D world. Controls are a quiet laboratory for changing the laws that produce the world.

The redesign changes the presentation and the entry point, not the long-term ambition. The old versions remain evidence and feature sources, not a UI template to reproduce.

## Experience principles

1. **World first.** The simulation fills the screen. Controls stay compact and subordinate.
2. **Emergence over spectacle.** Visual complexity should be caused by interactions, not decorative UI effects.
3. **Laws are real controls.** Every visible toggle must correspond to an implemented, observable behavior. Declared inventory and executable law support must remain distinct.
4. **Fast experimentation.** Change laws and parameters while running, pause, reseed, and export a world state.
5. **Spatial intuition.** Orbit and zoom the camera, see depth cues, and manipulate a field directly in the scene.
6. **Progressive complexity.** Begin with physical laws, then add bonds and aggregates, species/DNA, field systems, ecology, cognition, culture, and civilisation only when their mechanics can be simulated and tested.
7. **SIM under the surface.** The single-file version is a packaging convenience, not permission to entangle the eventual implementation. Canonical law IDs, explicit parameter contracts, deterministic random streams, and testable solver functions remain required for the modular successor.

## Prototype scope

The first pass is a dependency-free WebGL 3D particle view with deterministic seeded initialization, pairwise softened gravity, signed charge interactions, short-range pressure, damping, local bonding/edge detection, a central field, a temporary pointer field, orbit/zoom, live controls, pause/resume, reseeding, and JSON state export.

This is a concept prototype, not a claim that all 136 historical laws have been migrated. Each law family needs a source audit and a feasible/unsafe/visual-only disposition before implementation.

## Law migration policy

For every historical law, record:

- canonical ID and source/version provenance
- executable status: implemented, partial, metadata-only, deferred, or rejected
- state inputs and outputs, units, timestep assumptions and execution order
- numerical cost and scaling behavior
- conservation/bounds assumptions and known failure modes
- deterministic fixtures and focused tests
- renderer projection, if any, without letting rendering mutate simulation state

Prioritize laws that are meaningful in a 3D particle substrate: gravity, charge/electromagnetism approximations, inertia, damping, pressure/contact, collision/merge, adhesion/bonding, fields, boundaries, orbital/steller interactions, and selected exotic interactions that have clear numerical semantics. Treat narrative, memory, goal, culture, governance, and consciousness-themed systems as higher-level domain mechanics, not forces to fake as physics.

## Explicit limitations of this pass

- Pairwise solver is O(n²) and the prototype intentionally caps population at 300.
- It is a lightweight custom WebGL renderer, not a migrated stable renderer.
- Bond proximity is detected, but persistent chemical bonds, energy accounting, molecule topology, and reaction rules are not implemented yet.
- The single-file packaging should not become the final module boundary. Split code once the law catalog and test surface grow beyond a maintainable size.
- Browser-level interaction and performance checks are still required.
