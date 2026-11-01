# Stage 1 Audit Report: Law #97 — AUTOCATALYSIS

## 1. Executive Summary
- **Law Identifier**: `LAW_INDEXES.AUTOCATALYSIS` (Index 97)
- **Category**: CHEMISTRY (YELLOW)
- **Spectrum Hue**: 97.2°
- **Solver Target**: `src/physics/lawgroups/chemistryLaws.js`
- **Help DB Hint**: "Autocatalysis: a species catalyses its own reactions."

## 2. Current Implementation Codebase Investigation
- **Bitmask Gating**: Verified via `isSet(lawState, LAW_INDEXES.AUTOCATALYSIS)` in `src/physics/solver.js`.
- **Stateless Execution Unit**: Implemented in `src/physics/lawgroups/chemistryLaws.js`.
- **Memory & Stride Layout Access**: Reads particle buffers at `i * PARTICLE_STRIDE` (CATALYSIS (DNA 38), AUTOCATALYSIS_GAIN (World), BIRTH_RATE (DNA 10), ENERGY (Stride 50)).
- **Synergy Multiplier Wiring**: Recovers multiplier via `computeSynergy()` in `src/physics/synergy.js`.

## 3. Parameter Matrix & Data Dependencies
The law operates under direct governance of the following parameters:
- **CATALYSIS (DNA 38)**
- **AUTOCATALYSIS_GAIN (World)**
- **BIRTH_RATE (DNA 10)**
- **ENERGY (Stride 50)**

## 4. Current Limitations & Observed Behavior
- **Performance Overhead**: `O(N)` or `O(N^2)` interaction scaling bounded by Spatial Grid (`GRID_DIM = 12`).
- **Edge Case Clamping**: Coordinates bounded by toroidal spatial wrapping (`WORLD_SIZE`); forces clamped to `MAX_FORCE = 50.0`.
- **Verification Status**: Validated in Vitest audit suite (`tests/audit/`).
