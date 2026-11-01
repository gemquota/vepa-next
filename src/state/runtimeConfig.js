/**
 * VEPA4 — Mutable runtime tunables
 * Shared across modules so settings sliders, goal-engine adjustments, and
 * signal tuning take effect without rebuilds.
 */
import { createWorldParams } from './worldParams.js';

export const runtimeConfig = {
  starMass: 12,        // mass threshold for gravitational collapse (star)
  visualScale: 1.0,    // global particle size multiplier
  globalAlpha: 1.0,    // global particle opacity multiplier
  simSpeed: 1.0,       // physics time-step multiplier
  // v4 — goal-engine adjustable knobs (bounded by GoalEngine parameter ranges)
  maxForce: 50.0,      // global force clamp ceiling (solver MAX_FORCE is hard cap)
  forceScale: 1.0,     // global force multiplier applied before clamping
  dragMultiplier: 1.0, // global velocity damping multiplier (0.8–1.0)
  birthRate: 1.0,      // REPRO law synergy multiplier (0.01–1.0)
  deathRate: 1.0,      // LIFE law synergy multiplier (0.01–1.0)
  signalScale: 1.0,    // global communication DNA multiplier
  // v8.17 — gravity engine: 'exact' (default, per-pair DNA-aware), 'bh'
  // (Barnes–Hut monopole, O(N log N)), or 'fmm' (BH + quadrupole correction,
  // ~10× more accurate at the same theta). gravTheta is the opening angle
  // (0 = exact traversal; 0.4–0.7 typical). See src/physics/octree.js.
  gravEngine: 'exact',
  gravTheta: 0.5,
  // v9.0 — compute engine: GPU is the user-facing default. The worker probes
  // WebGPU once and falls back to the validated CPU path when unavailable;
  // explicit CPU selection remains available in SETTINGS > COMPUTE.
  computeEngine: 'gpu',
  worldParams: createWorldParams(), // WORLD panel sliders (SPACE/PHYSICS/ENVIRONMENT/BIOLOGY)
};
