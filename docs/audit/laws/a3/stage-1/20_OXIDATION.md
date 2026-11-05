# Stage 1 Audit Report: Law #20 — OXIDATION

## 1. Executive Summary
- **Law Identifier**: `LAW_INDEXES.OXIDATION` (Index 20)
- **Category**: CHEMISTRY (YELLOW)
- **Spectrum Hue**: 85.7°
- **Solver Target**: `src/physics/lawgroups/chemistryLaws.js`
- **Help DB Hint**: "Oxidation: charged particles rust, burn and glow."

## 2. Current Implementation Codebase Investigation
- **Bitmask Gating**: Verified via `isSet(lawState, LAW_INDEXES.OXIDATION)` in `src/physics/solver.js`.
- **Stateless Execution Unit**: Implemented in `src/physics/lawgroups/chemistryLaws.js`.
- **Memory & Stride Layout Access**: Reads particle buffers at `i * PARTICLE_STRIDE` (REACTION_THRESHOLD (DNA 37), OXIDATION_RATE (World), HEAT_OUTPUT (DNA 39), CHARGE (Stride 67)).
- **Synergy Multiplier Wiring**: Recovers multiplier via `computeSynergy()` in `src/physics/synergy.js`.

## 3. Parameter Matrix & Data Dependencies
The law operates under direct governance of the following parameters:
- **REACTION_THRESHOLD (DNA 37)**
- **OXIDATION_RATE (World)**
- **HEAT_OUTPUT (DNA 39)**
- **CHARGE (Stride 67)**

## 4. Current Limitations & Observed Behavior
- **Performance Overhead**: `O(N)` or `O(N^2)` interaction scaling bounded by Spatial Grid (`GRID_DIM = 12`).
- **Edge Case Clamping**: Coordinates bounded by toroidal spatial wrapping (`WORLD_SIZE`); forces clamped to `MAX_FORCE = 50.0`.
- **Verification Status**: Validated in Vitest audit suite (`tests/audit/`).
