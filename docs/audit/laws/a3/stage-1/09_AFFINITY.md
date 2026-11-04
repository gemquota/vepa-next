# Stage 1 Audit Report: Law #9 — AFFINITY

## 1. Executive Summary
- **Law Identifier**: `LAW_INDEXES.AFFINITY` (Index 9)
- **Category**: BIOLOGY (ORANGE)
- **Spectrum Hue**: 39.7°
- **Solver Target**: `src/physics/lawgroups/biologyLaws.js`
- **Help DB Hint**: "Species-based attraction or repulsion."

## 2. Current Implementation Codebase Investigation
- **Bitmask Gating**: Verified via `isSet(lawState, LAW_INDEXES.AFFINITY)` in `src/physics/solver.js`.
- **Stateless Execution Unit**: Implemented in `src/physics/lawgroups/biologyLaws.js`.
- **Memory & Stride Layout Access**: Reads particle buffers at `i * PARTICLE_STRIDE` (SPECIES_AFFINITY (DNA 41), SPECIES_INTERACTION (World), NEIGHBORHOOD_RADIUS (DNA 18), SPECIES_ID (Stride 7)).
- **Synergy Multiplier Wiring**: Recovers multiplier via `computeSynergy()` in `src/physics/synergy.js`.

## 3. Parameter Matrix & Data Dependencies
The law operates under direct governance of the following parameters:
- **SPECIES_AFFINITY (DNA 41)**
- **SPECIES_INTERACTION (World)**
- **NEIGHBORHOOD_RADIUS (DNA 18)**
- **SPECIES_ID (Stride 7)**

## 4. Current Limitations & Observed Behavior
- **Performance Overhead**: `O(N)` or `O(N^2)` interaction scaling bounded by Spatial Grid (`GRID_DIM = 12`).
- **Edge Case Clamping**: Coordinates bounded by toroidal spatial wrapping (`WORLD_SIZE`); forces clamped to `MAX_FORCE = 50.0`.
- **Verification Status**: Validated in Vitest audit suite (`tests/audit/`).
