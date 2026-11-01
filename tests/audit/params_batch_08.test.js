import { describe, it, expect } from 'vitest';
import { makeWorld, lawsWith, PARTICLE_STRIDE, S, WORLD } from './paramsHelpers.js';
import { LAW_INDEXES } from '../../src/constants.js';
import { solve } from '../../src/physics/solver.js';
import { setCameraConfig, resetCamera } from '../../src/ui/camera.js';
import camera from '../../src/ui/camera.js';

describe('Batch 08 — rotateSensitivity / panSensitivity / DNA.FORCE / DNA.VISCOSITY', () => {
  it('rotateSensitivity: setCameraConfig persists the orbit multiplier', () => {
    resetCamera();
    setCameraConfig({ rotateSensitivity: 2.5 });
    expect(camera.rotateSensitivity).toBe(2.5);
    resetCamera();
    expect(camera.rotateSensitivity).toBe(1.0);
  });

  it('panSensitivity: setCameraConfig persists the pan multiplier', () => {
    resetCamera();
    setCameraConfig({ panSensitivity: 0.25 });
    expect(camera.panSensitivity).toBe(0.25);
    resetCamera();
    expect(camera.panSensitivity).toBe(1.0);
  });

  it('DNA.FORCE: positive FORCE amplifies gravity pull; negative repels (GRAV law)', () => {
    // NOTE: FORCE was not consumed anywhere in the physics engine — this test
    // defines the spec (attraction/repulsion multiplier on the GRAV force).
    const run = (force) => {
      const { view, dna } = makeWorld(2, (v, d, b) => {
        if (b === 0) {
          v[b + S.POS_X] = 990;
          v[b + S.DNA_CACHE_START + 0] = force; // DNA FORCE
        }
      });
      const laws = lawsWith(LAW_INDEXES.GRAV, LAW_INDEXES.WRAP);
      for (let t = 0; t < 5; t++) solve(view, 2, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.POS_X];
    };
    // Positive force pulls harder toward the neighbour (x increases from 990).
    expect(run(1.5)).toBeGreaterThan(run(0.5));
    // Negative force repels (x decreases below 990).
    expect(run(-1)).toBeLessThan(990);
  });

  it('DNA.VISCOSITY: lower per-particle viscosity decays velocity faster (DRAG law)', () => {
    const run = (dnaV) => {
      const { view, dna } = makeWorld(1, (v, d, b) => {
        v[b + S.DNA_CACHE_START + 1] = dnaV; // DNA VISCOSITY
        v[b + S.VEL_X] = 5;
      });
      const laws = lawsWith(LAW_INDEXES.DRAG);
      for (let t = 0; t < 30; t++) solve(view, 1, PARTICLE_STRIDE, laws, dna, WORLD, 1.0, () => 0.5);
      return view[S.VEL_X];
    };
    expect(run(0.9)).toBeLessThan(run(0.99));
  });
});
