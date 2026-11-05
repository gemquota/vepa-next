# VEPA v3 Small MVP

A deliberately small, runnable browser extraction of the v3 particle-world idea. It keeps the core interaction loop: a seeded particle population, charge-based attraction/repulsion, wraparound boundaries, pause/reset, live controls, and pointer influence.

## Run

Open index.html directly in a modern browser. No build step, dependency install, worker headers, or server are required.

## Included

- Deterministic initialization from a numeric or text seed.
- Particle count, interaction strength, and simulation speed controls.
- Positive/negative particle types, with unlike charges attracting and like charges repelling.
- Toroidal wraparound and pointer attraction.
- Pause/resume, reset, FPS/tick/population readouts.
- Responsive neon canvas.

## Deliberately not included

This is an MVP slice, not a wholesale copy of v3. It does not include the full law catalog, DNA/species evolution, reproduction, chemistry/thermodynamics, timeline, narrative/insight systems, preset manager, persistence engine, or v3 worker integration. Those systems have cross-file dependencies and should be extracted in separate, testable vertical slices rather than copied incompletely.

## Provenance

Source reference: gemquota/vepa-v3 at commit ccd2285ddf241c3d1ee2f6ebb4c8eea81824d973. The small MVP re-expresses a minimal subset of v3's particle-world interaction in a standalone implementation; it is not a byte-for-byte source migration. The inspected v3 engine uses Math.random() in mutation/reproduction paths, so this MVP uses its own seeded PRNG for reproducible initialization.

## Limitations

- The force solver is intentionally simple and O(n²). Keep particle counts modest.
- Seeded initialization is deterministic, but this is not a claim of cross-browser bit-exact simulation replay.
- No automated browser test has been run as part of this extraction.
