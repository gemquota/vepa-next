/**
 * Set M.1 — Relativity (RRP L·M·N trilogy)
 * Tests the mass-warped CURVATURE field, gravitational lensing of INFO,
 * velocity time dilation, and E=mc² mass–energy conversion.
 */
import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants.js';
import { createFieldSystem, writeField } from '../../src/physics/fields.js';
import {
  stepRelativity, writeCurvature, applyLensing, applyDilation, applyMassEnergy,
  RELATIVITY_CADENCE, MAX_CURVATURE,
} from '../../src/state/relativity.js';
import { WORLD_PARAM_DEFS, worldParamDef, clampWorldParam } from '../../src/state/worldParams.js';

const S = STRIDE_INDEXES;

function makeFields() {
  return createFieldSystem(2000, 12, {});
}

function place(view, i, x, y, z, opts = {}) {
  const b = i * PARTICLE_STRIDE;
  view[b + S.POS_X] = x;
  view[b + S.POS_Y] = y;
  view[b + S.POS_Z] = z;
  view[b + S.VEL_X] = opts.vx ?? 0;
  view[b + S.VEL_Y] = opts.vy ?? 0;
  view[b + S.VEL_Z] = opts.vz ?? 0;
  view[b + S.DEAD] = 0;
  view[b + S.ENERGY] = opts.energy ?? 50;
  view[b + S.MASS] = opts.mass ?? 2;
  view[b + S.AGE] = opts.age ?? 0;
  view[b + S.HUNGER] = opts.hunger ?? 0;
  return view;
}

function makeView(count = 10) {
  const view = new Float32Array(count * PARTICLE_STRIDE);
  for (let i = 0; i < count; i++) view[i * PARTICLE_STRIDE + S.DEAD] = 1;
  return view;
}

function cellCenter(cx, cy, cz) {
  const cell = 2000 / 12;
  return [(cx + 0.5) * cell, (cy + 0.5) * cell, (cz + 0.5) * cell];
}

function cellIdx(f, x, y, z) {
  const cx = Math.floor(x / f.cell);
  const cy = Math.floor(y / f.cell);
  const cz = Math.floor(z / f.cell);
  return (cz * f.dim + cy) * f.dim + cx;
}

function sum(arr) {
  let t = 0;
  for (let i = 0; i < arr.length; i++) t += arr[i];
  return t;
}

describe('Set M — cadence & curvature', () => {
  it('is gated on its cadence (force bypasses for tests)', () => {
    const view = makeView(2);
    const quiet = stepRelativity(view, 2, PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: {} });
    expect(quiet.curvatureCells).toBe(0);
    const forced = stepRelativity(view, 2, PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: {}, force: true });
    expect(forced).toHaveProperty('curvatureCells');
    expect(RELATIVITY_CADENCE).toBe(15);
  });

  it('buckets particle mass into the CURVATURE field (bounded, SET semantics)', () => {
    const f = makeFields();
    const view = makeView(2);
    const [x, y, z] = cellCenter(5, 5, 5);
    place(view, 0, x, y, z, { mass: 4 });
    place(view, 1, x + 5, y, z, { mass: 6 }); // same cell: 10 mass total
    const cells = writeCurvature(f, view, 2, PARTICLE_STRIDE, 1);
    expect(cells).toBe(1);
    const idx = cellIdx(f, x, y, z);
    const v = f.scalars.CURVATURE[idx];
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThanOrEqual(MAX_CURVATURE);
    // Zeroed first (SET semantics — no accumulation across passes).
    writeCurvature(f, view, 2, PARTICLE_STRIDE, 0);
    expect(f.scalars.CURVATURE[idx]).toBe(0);
  });
});

describe('Set M — gravitational lensing', () => {
  it('moves INFO toward the curvature peak and conserves it exactly', () => {
    const f = makeFields();
    const cell = f.cell;
    // Flat cell A with INFO; curved peak at neighbour B (toward +x).
    const ax = 0.5 * cell, ay = 0.5 * cell, az = 0.5 * cell;
    const bx = 1.5 * cell, by = 0.5 * cell, bz = 0.5 * cell;
    writeField(f, 'INFO', ax, ay, az, 100);
    writeField(f, 'CURVATURE', ax, ay, az, 1);
    writeField(f, 'CURVATURE', bx, by, bz, 5); // peak
    const before = sum(f.scalars.INFO);
    const lensed = applyLensing(f, 0.1);
    expect(lensed).toBeGreaterThan(0);
    expect(sum(f.scalars.INFO)).toBeCloseTo(before, 4); // conserved
    // INFO flowed from the flat cell toward the peak.
    const idxA = cellIdx(f, ax, ay, az);
    const idxB = cellIdx(f, bx, by, bz);
    expect(f.scalars.INFO[idxA]).toBeLessThan(100);
    expect(f.scalars.INFO[idxB]).toBeGreaterThan(0);
  });

  it('does nothing without curvature or with strength 0', () => {
    const f = makeFields();
    const [x, y, z] = cellCenter(5, 5, 5);
    writeField(f, 'INFO', x, y, z, 50);
    expect(applyLensing(f, 0.1)).toBe(0); // no curvature
    writeField(f, 'CURVATURE', x, y, z, 3);
    expect(applyLensing(f, 0)).toBe(0); // strength 0
    expect(sum(f.scalars.INFO)).toBeCloseTo(50, 4);
  });
});

describe('Set M — velocity time dilation', () => {
  it('slows AGE and HUNGER for fast particles, clamped by TIME_DILATION_MAX', () => {
    const view = makeView(2);
    // v = c at LIGHT_SPEED 600 → ratio clamped → factor = TIME_DILATION_MAX = 0.25.
    place(view, 0, 100, 100, 100, { vx: 600, age: 1000, hunger: 50 });
    place(view, 1, 200, 100, 100, { vx: 0, age: 1000, hunger: 50 }); // slow
    const dilated = applyDilation(view, 2, PARTICLE_STRIDE, { LIGHT_SPEED: 600, TIME_DILATION_MAX: 0.25 });
    expect(dilated).toBe(1);
    const lost = RELATIVITY_CADENCE * (1 - 0.25); // 15 × 0.75 = 11.25
    expect(view[S.AGE]).toBeCloseTo(1000 - lost, 4);
    expect(view[S.HUNGER]).toBeCloseTo(50 - lost, 4);
    expect(view[PARTICLE_STRIDE + S.AGE]).toBe(1000); // slow particle untouched
  });

  it('never drives AGE or HUNGER below zero', () => {
    const view = makeView(1);
    place(view, 0, 100, 100, 100, { vx: 600, age: 3, hunger: 1 });
    applyDilation(view, 1, PARTICLE_STRIDE, { LIGHT_SPEED: 600, TIME_DILATION_MAX: 0.25 });
    expect(view[S.AGE]).toBe(0);
    expect(view[S.HUNGER]).toBe(0);
  });
});

describe('Set M — mass–energy equivalence', () => {
  it('condenses surplus ENERGY into MASS (energy is dilute)', () => {
    const view = makeView(1);
    place(view, 0, 100, 100, 100, { energy: 100, mass: 2 });
    const mc = applyMassEnergy(view, 1, PARTICLE_STRIDE, { MASS_ENERGY_RATE: 1 });
    expect(mc.condensed).toBe(1);
    expect(view[S.ENERGY]).toBeCloseTo(80, 4); // surplus 20 converted
    expect(view[S.MASS]).toBeCloseTo(2 + 20 * 0.2, 4); // 6
  });

  it('converts MASS to ENERGY under scarcity (mass is concentrated)', () => {
    const view = makeView(1);
    place(view, 0, 100, 100, 100, { energy: 10, mass: 5 });
    const mc = applyMassEnergy(view, 1, PARTICLE_STRIDE, { MASS_ENERGY_RATE: 1 });
    expect(mc.converted).toBe(1);
    expect(view[S.ENERGY]).toBeCloseTo(20, 4);
    expect(view[S.MASS]).toBeCloseTo(3, 4);
  });

  it('is a no-op at rate 0 and never exceeds the mass/energy bounds', () => {
    const view = makeView(2);
    place(view, 0, 100, 100, 100, { energy: 100, mass: 2 });
    place(view, 1, 200, 100, 100, { energy: 10, mass: 10 });
    const mc = applyMassEnergy(view, 2, PARTICLE_STRIDE, { MASS_ENERGY_RATE: 0 });
    expect(mc.condensed + mc.converted).toBe(0);
    expect(view[S.MASS]).toBe(2);
    // Near the caps: mass never exceeds MASS_CAP (10), energy stays ≥ 80.
    const v2 = makeView(1);
    place(v2, 0, 100, 100, 100, { energy: 100, mass: 9.9 });
    applyMassEnergy(v2, 1, PARTICLE_STRIDE, { MASS_ENERGY_RATE: 1 });
    expect(v2[S.MASS]).toBeLessThanOrEqual(10);
    expect(v2[S.ENERGY]).toBeGreaterThanOrEqual(80);
  });
});

describe('Set M — integration & determinism', () => {
  it('runs the full pass end-to-end deterministically', () => {
    function run() {
      const f = makeFields();
      const view = makeView(3);
      const [x, y, z] = cellCenter(5, 5, 5);
      place(view, 0, x, y, z, { mass: 8, energy: 95, vx: 300, age: 500 });
      place(view, 1, x + 100, y, z, { mass: 4, energy: 50 });
      writeField(f, 'INFO', x, y, z, 40);
      return stepRelativity(view, 3, PARTICLE_STRIDE, f, {
        force: true,
        worldParams: { CURVATURE_STRENGTH: 1, LENSING_STRENGTH: 0.1, LIGHT_SPEED: 600, TIME_DILATION_MAX: 0.25, MASS_ENERGY_RATE: 0.5 },
      });
    }
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    expect(a.curvatureCells).toBeGreaterThan(0);
  });

  it('defines the MATTER > RELATIVITY subgroup with sane defaults', () => {
    const defs = WORLD_PARAM_DEFS.filter((d) => d.group === 'MATTER' && d.subgroup === 'RELATIVITY');
    expect(defs.length).toBe(5);
    expect(worldParamDef('CURVATURE_STRENGTH').default).toBe(1);
    expect(worldParamDef('TIME_DILATION_MAX').default).toBe(0.25);
    expect(worldParamDef('LIGHT_SPEED').default).toBe(600);
    expect(worldParamDef('MASS_ENERGY_RATE').default).toBe(0.02);
    expect(clampWorldParam('CURVATURE_STRENGTH', 99)).toBe(5);
    expect(clampWorldParam('LIGHT_SPEED', 10)).toBe(100);
  });
});
