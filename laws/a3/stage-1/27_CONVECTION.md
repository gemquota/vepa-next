# Stage 1 Audit Report: Law #27 — CONVECTION

## 1. Executive Summary
- **Law Identifier**: `LAW_INDEXES.CONVECTION` (Index 27)
- **Category**: THERMODYNAMICS (GREEN)
- **Spectrum Hue**: 129.7°
- **Solver Target**: `src/physics/lawgroups/thermoLaws.js`
- **Help DB Hint**: "Convection: buoyant vertical motion from temperature."

## 2. Current Implementation Codebase Investigation
- **Bitmask Gating**: Verified via `isSet(lawState, LAW_INDEXES.CONVECTION)` in `src/physics/solver.js`.
- **Stateless Execution Unit**: Implemented in `src/physics/lawgroups/thermoLaws.js`.
- **Memory & Stride Layout Access**: Reads particle buffers at `i * PARTICLE_STRIDE` (HEAT_OUTPUT (DNA 39), CONVECTION_RATE (World), VISCOSITY (DNA 1), GLOBAL_G (World)).
- **Synergy Multiplier Wiring**: Recovers multiplier via `computeSynergy()` in `src/physics/synergy.js`.

## 3. Parameter Matrix & Data Dependencies
The law operates under direct governance of the following parameters:
- **HEAT_OUTPUT (DNA 39)**
- **CONVECTION_RATE (World)**
- **VISCOSITY (DNA 1)**
- **GLOBAL_G (World)**

## 4. Current Limitations & Observed Behavior
- **Performance Overhead**: `O(N)` or `O(N^2)` interaction scaling bounded by Spatial Grid (`GRID_DIM = 12`).
- **Edge Case Clamping**: Coordinates bounded by toroidal spatial wrapping (`WORLD_SIZE`); forces clamped to `MAX_FORCE = 50.0`.
- **Verification Status**: Validated in Vitest audit suite (`tests/audit/`).
