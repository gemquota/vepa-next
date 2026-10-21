# VEPA Universe

A minimalist, dependency-free 3D particle sandbox exploring a new expression of VEPA's core experience.

## Run

Open `index.html` in a modern browser with WebGL enabled. No package installation, build step, server, or external asset is required.

## Controls

- Drag to orbit the view.
- Scroll or pinch to zoom.
- Toggle laws and tune their parameters while the world runs.
- Pause/resume, reset, or initialize a new seed.
- Enable Touch Field and tap the scene to add a temporary attractor.
- Export the current state as JSON.

## Current executable laws

- Gravity: softened pairwise mass attraction.
- Charge: signed pairwise attraction/repulsion.
- Pressure: short-range repulsion.
- Damping: velocity decay.
- Bonding: short-range attraction plus proximity-edge detection.
- Central field: tunable attraction toward the origin.

The prototype uses an O(n²) pairwise solver and caps the population at 300. Bond detection is not yet a chemistry model; it does not implement persistent bond topology, reaction rules, or energy accounting. It does not claim migration of the historical 136-law catalog.

See [RECONCEPTUALIZATION.md](RECONCEPTUALIZATION.md) for the intended direction and migration policy.
