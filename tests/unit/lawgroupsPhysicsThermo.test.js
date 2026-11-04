import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES as S, DNA_INDEXES as D } from '../../src/constants.js';
import {
  applyTide,
  applyFriction,
  applyElasticity,
  applyTurbulence,
  applyCentripetal,
  applyRotation,
} from '../../src/physics/lawgroups/physicsLaws.js';
import {
  applyAdiabatic,
  applyCompression,
  applyExpansion,
  applyEquilibrium,
  applyLatentHeat,
  applyRunaway,
} from '../../src/physics/lawgroups/thermoLaws.js';

const view = (n) => new Float32Array(n * PARTICLE_STRIDE);

function seed(buf, n) {
  for (let i = 0; i < n; i++) {
    const b = i * PARTICLE_STRIDE;
    buf[b + S.POS_X] = 100;
    buf[b + S.POS_Y] = 100;
    buf[b + S.POS_Z] = 100;
    buf[b + S.VEL_X] = 0;
    buf[b + S.VEL_Y] = 0;
    buf[b + S.VEL_Z] = 0;
    buf[b + S.MASS] = 1.5;
    buf[b + S.RADIUS] = 0.6;
    buf[b + S.ENERGY] = 100;
    buf[b + S.TEMPERATURE] = 0;
    buf[b + S.DEAD] = 0;
    buf[b + S.SPECIES_ID] = 0;
    // DNA cache defaults the lawgroup functions read (VISCOSITY / ELASTICITY).
    buf[b + S.DNA_CACHE_START + D.VISCOSITY] = 0.98;
    buf[b + S.DNA_CACHE_START + D.ELASTICITY] = 0.5;
  }
}

describe('physicsLaws', () => {
  it('applyTide pulls i toward a heavier neighbor j (∝ massJ / dist)', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[PARTICLE_STRIDE + S.POS_X] = 110; // j at (110,100,100), dist = 10
    buf[PARTICLE_STRIDE + S.MASS] = 4;
    const f = applyTide(buf, 0, PARTICLE_STRIDE, 10, 0, 0, 10, 0.5);
    expect(f.ax).toBeGreaterThan(0);
    expect(f.ax).toBeCloseTo((4 * 0.5) / 10, 5);
    expect(f.ay).toBeCloseTo(0, 5);
    expect(f.az).toBeCloseTo(0, 5);
  });

  it('applyFriction opposes velocity, scaled by VISCOSITY DNA (force = -v * k * viscosity)', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.VEL_X] = 5;
    const f = applyFriction(buf, 0, 0.1);
    expect(f.ax).toBeLessThan(0);
    expect(f.ax).toBeCloseTo(-5 * 0.1 * 0.98, 5); // default VISCOSITY 0.98
    expect(f.ay).toBeCloseTo(0, 5);
    expect(f.az).toBeCloseTo(0, 5);
    expect(buf[S.TEMPERATURE]).toBeGreaterThan(0); // kinetic → heat
  });

  it('applyElasticity pushes overlapping particles apart, scaled by ELASTICITY DNA', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[PARTICLE_STRIDE + S.POS_X] = 100.5; // dist = 0.5 < rI + rJ = 1.2
    const f = applyElasticity(buf, 0, PARTICLE_STRIDE, 0.5, 0, 0, 0.5, 1.0);
    expect(f.ax).toBeLessThan(0); // i pushed away from j
    expect(f.ax).toBeCloseTo(-(0.7 * 1.0 * 0.5) / 3.0, 5); // overlap * k * ELASTICITY / combined mass
    // No force when particles do not overlap.
    buf[PARTICLE_STRIDE + S.POS_X] = 103;
    expect(applyElasticity(buf, 0, PARTICLE_STRIDE, 3, 0, 0, 3, 1.0)).toBeNull();
  });

  it('applyTurbulence kicks perpendicular to velocity (random axis at rest)', () => {
    const moving = view(1);
    seed(moving, 1);
    moving[S.VEL_X] = 5;
    const f = applyTurbulence(moving, 0, 2, () => 0.5);
    expect(f.ax * 5 + f.ay * 0 + f.az * 0).toBeCloseTo(0, 9); // perpendicular
    expect(Math.hypot(f.ax, f.ay, f.az)).toBeCloseTo(2, 5);

    const still = view(1);
    seed(still, 1);
    const g = applyTurbulence(still, 0, 2, () => 0.5);
    expect(Math.hypot(g.ax, g.ay, g.az)).toBeGreaterThan(0);
  });

  it('applyCentripetal pulls toward the center proportional to distance', () => {
    const buf = view(1);
    seed(buf, 1);
    const f = applyCentripetal(buf, 0, 90, 100, 100, 0.1);
    expect(f.ax).toBeCloseTo(-1, 5); // (90 - 100) * 0.1
    expect(f.ay).toBeCloseTo(0, 5);
    expect(f.az).toBeCloseTo(0, 5);
  });

  it('applyRotation is tangential around the vertical axis', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.POS_X] = 110; // offset (ox, oy) = (10, 0) from center (100,100,100)
    const f = applyRotation(buf, 0, 100, 100, 100, 0.1);
    expect(f.ay).toBeCloseTo(1, 5); // +x offset rotates toward +y
    expect(f.ax).toBeCloseTo(0, 5);
    expect(f.az).toBeCloseTo(0, 5);
  });
});

describe('thermoLaws', () => {
  it('applyAdiabatic converts kinetic energy to temperature', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.VEL_X] = 4; // speed 4, mass 1.5
    const f = applyAdiabatic(buf, 0, 0.1);
    const dv = 4 * 0.1;
    expect(f.ax).toBeCloseTo(-dv, 5); // velocity-reduction force
    expect(buf[S.TEMPERATURE]).toBeGreaterThan(0);
    expect(buf[S.TEMPERATURE]).toBeCloseTo(0.5 * 1.5 * (16 - (4 - dv) * (4 - dv)), 5);
  });

  it('applyCompression shrinks and heats touching particles', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[PARTICLE_STRIDE + S.POS_X] = 101; // dist = 1 < (rI + rJ) * 2 = 2.4
    expect(applyCompression(buf, 0, PARTICLE_STRIDE, 1, 0.1)).toBeNull();
    expect(buf[S.RADIUS]).toBeLessThan(0.6);
    expect(buf[PARTICLE_STRIDE + S.RADIUS]).toBeLessThan(0.6);
    expect(buf[S.TEMPERATURE]).toBeGreaterThan(0);
    expect(buf[PARTICLE_STRIDE + S.TEMPERATURE]).toBeGreaterThan(0);
  });

  it('applyExpansion grows radius toward DNA base radius when cold', () => {
    const buf = view(1);
    seed(buf, 1);
    buf[S.TEMPERATURE] = 0.1; // below 0.3 threshold
    buf[S.DNA_CACHE_START + D.BASE_RADIUS] = 1.2;
    expect(applyExpansion(buf, 0, 0.1)).toBeNull();
    expect(buf[S.RADIUS]).toBeGreaterThan(0.6);
    expect(buf[S.TEMPERATURE]).toBeLessThan(0.1);
  });

  it('applyEquilibrium exchanges temperature toward the pair mean', () => {
    const buf = view(2);
    seed(buf, 2);
    buf[S.TEMPERATURE] = 0.2;
    buf[PARTICLE_STRIDE + S.TEMPERATURE] = 0.8;
    expect(applyEquilibrium(buf, 0, PARTICLE_STRIDE, 0.5)).toBeNull();
    expect(buf[S.TEMPERATURE]).toBeCloseTo(0.5, 5);
    expect(buf[PARTICLE_STRIDE + S.TEMPERATURE]).toBeCloseTo(0.5, 5);
  });

  it('applyLatentHeat converts temperature to energy when hot and back when cold', () => {
    const hot = view(1);
    seed(hot, 1);
    hot[S.TEMPERATURE] = 2.0;
    expect(applyLatentHeat(hot, 0, 0.5)).toBeNull();
    expect(hot[S.TEMPERATURE]).toBeCloseTo(1.5, 5);
    expect(hot[S.ENERGY]).toBeGreaterThan(100);

    const cold = view(1);
    seed(cold, 1);
    cold[S.TEMPERATURE] = -1.0;
    expect(applyLatentHeat(cold, 0, 0.2)).toBeNull();
    expect(cold[S.TEMPERATURE]).toBeGreaterThan(-1.0);
    expect(cold[S.ENERGY]).toBeLessThan(100);
  });

  it('applyRunaway applies positive feedback above threshold and none below', () => {
    const hot = view(1);
    seed(hot, 1);
    hot[S.TEMPERATURE] = 1.5;
    expect(applyRunaway(hot, 0, 2)).toBeNull();
    expect(hot[S.TEMPERATURE]).toBeGreaterThan(1.5);
    expect(hot[S.TEMPERATURE]).toBeCloseTo(1.5 + 0.49 * 2, 5);

    const cool = view(1);
    seed(cool, 1);
    cool[S.TEMPERATURE] = 0.5;
    applyRunaway(cool, 0, 2);
    expect(cool[S.TEMPERATURE]).toBeCloseTo(0.5, 5);
  });
});
