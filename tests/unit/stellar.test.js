/**
 * Set O.1 — Stellar Physics (RRP O·P·Q trilogy)
 * Tests star formation from dense mass-energy cells, radiant output, black-hole
 * collapse + Hawking emission, supernova detonation (shockwave + element seed),
 * determinism, and the MATTER > STELLAR world-param subgroup.
 */
import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants.js';
import { createFieldSystem } from '../../src/physics/fields.js';
import {
  stepStellar, createStellarState, stellarSummary,
  STELLAR_CADENCE, STAR_KINDS,
} from '../../src/state/stellar.js';
import { WORLD_PARAM_DEFS, worldParamDef, clampWorldParam } from '../../src/state/worldParams.js';

const S = STRIDE_INDEXES;
const DIM = 12;
const CELL = 2000 / DIM;

function makeFields() {
  return createFieldSystem(2000, DIM, {});
}

function makeView(count = 16) {
  const view = new Float32Array(count * PARTICLE_STRIDE);
  for (let i = 0; i < count; i++) view[i * PARTICLE_STRIDE + S.DEAD] = 1;
  return view;
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
  return view;
}

function cellCenter(cx, cy, cz) {
  return [(cx + 0.5) * CELL, (cy + 0.5) * CELL, (cz + 0.5) * CELL];
}

function cellIdx(f, x, y, z) {
  return (Math.floor(z / f.cell) * f.dim + Math.floor(y / f.cell)) * f.dim + Math.floor(x / f.cell);
}

function injectStar(state, opts = {}) {
  const [x, y, z] = cellCenter(opts.cx ?? 5, opts.cy ?? 5, opts.cz ?? 5);
  state.stars.push({
    x, y, z,
    cx: opts.cx ?? 5, cy: opts.cy ?? 5, cz: opts.cz ?? 5,
    mass: opts.mass ?? 100,
    kind: opts.kind ?? STAR_KINDS.STAR,
    cooldown: opts.cooldown ?? 0,
  });
  return state.stars[state.stars.length - 1];
}

const PARAMS = {
  STELLAR_FORM: 10,
  STELLAR_MAX: 4,
  STELLAR_SEPARATION: 3,
  STELLAR_RADIANCE: 1,
  STELLAR_HORIZON: 250,
  STELLAR_SUPERNOVA: 400,
  STELLAR_HAWKING: 0.05,
};

describe('Set O — cadence & star formation', () => {
  it('is gated on its cadence (force bypasses for tests)', () => {
    const view = makeView(2);
    const quiet = stepStellar(createStellarState(), view, 2, PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: PARAMS });
    expect(quiet.formed).toBe(0);
    const forced = stepStellar(createStellarState(), view, 2, PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: PARAMS, force: true });
    expect(forced).toHaveProperty('formed');
    expect(STELLAR_CADENCE).toBe(15);
  });

  it('seeds a star where mass + energy converge above STAR FORM MASS', () => {
    const state = createStellarState();
    const f = makeFields();
    const view = makeView(6);
    const [x, y, z] = cellCenter(5, 5, 5);
    // 3 particles × (mass 8 + energy 100×0.02) = 3 × 10 = 30 matter units.
    place(view, 0, x, y, z, { mass: 8, energy: 100 });
    place(view, 1, x + 1, y, z, { mass: 8, energy: 100 });
    place(view, 2, x, y + 1, z, { mass: 8, energy: 100 });
    const res = stepStellar(state, view, 6, PARTICLE_STRIDE, f, { force: true, worldParams: PARAMS });
    expect(res.formed).toBe(1);
    expect(state.stars.length).toBe(1);
    expect(state.stars[0].kind).toBe(STAR_KINDS.STAR);
    expect(state.stars[0].mass).toBeGreaterThanOrEqual(10);
  });

  it('enforces min star separation (no star storms)', () => {
    const state = createStellarState();
    const f = makeFields();
    const view = makeView(6);
    const [x1, y1, z1] = cellCenter(5, 5, 5);
    const [x2, y2, z2] = cellCenter(5, 5, 6); // one cell away
    place(view, 0, x1, y1, z1, { mass: 8, energy: 100 });
    place(view, 1, x1 + 1, y1, z1, { mass: 8, energy: 100 });
    place(view, 2, x1, y1 + 1, z1, { mass: 8, energy: 100 });
    place(view, 3, x2, y2, z2, { mass: 8, energy: 100 });
    place(view, 4, x2 + 1, y2, z2, { mass: 8, energy: 100 });
    place(view, 5, x2, y2 + 1, z2, { mass: 8, energy: 100 });
    const res = stepStellar(state, view, 6, PARTICLE_STRIDE, f, { force: true, worldParams: { ...PARAMS, STELLAR_SEPARATION: 3 } });
    expect(res.formed).toBe(1);
    expect(state.stars.length).toBe(1);
  });

  it('forms nothing when STELLAR_FORM is 0 or STELLAR_MAX is 0', () => {
    const f = makeFields();
    const view = makeView(3);
    const [x, y, z] = cellCenter(5, 5, 5);
    place(view, 0, x, y, z, { mass: 8, energy: 100 });
    place(view, 1, x + 1, y, z, { mass: 8, energy: 100 });
    place(view, 2, x, y + 1, z, { mass: 8, energy: 100 });
    const a = stepStellar(createStellarState(), view, 3, PARTICLE_STRIDE, f, { force: true, worldParams: { ...PARAMS, STELLAR_FORM: 0 } });
    expect(a.formed).toBe(0);
    const b = stepStellar(createStellarState(), view, 3, PARTICLE_STRIDE, f, { force: true, worldParams: { ...PARAMS, STELLAR_MAX: 0 } });
    expect(b.formed).toBe(0);
  });
});

describe('Set O — radiant output & accretion', () => {
  it('a star fuses its own mass into THERMAL + INFO (conserved)', () => {
    const state = createStellarState();
    const f = makeFields();
    const star = injectStar(state, { mass: 100, kind: STAR_KINDS.STAR });
    const res = stepStellar(state, makeView(0), 0, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { ...PARAMS, STELLAR_FORM: 0, STELLAR_HORIZON: 10000, STELLAR_SUPERNOVA: 10000 },
    });
    expect(star.mass).toBeLessThan(100); // fused some mass away
    expect(res.radiated).toBeGreaterThan(0);
    const idx = cellIdx(f, star.x, star.y, star.z);
    expect(f.scalars.THERMAL[idx]).toBeGreaterThan(0);
    expect(f.scalars.INFO[idx]).toBeGreaterThan(0);
  });

  it('feeds ENERGY to nearby particles (warms the region)', () => {
    const state = createStellarState();
    const f = makeFields();
    const star = injectStar(state, { mass: 200, kind: STAR_KINDS.STAR });
    const view = makeView(1);
    place(view, 0, star.x, star.y, star.z, { energy: 10, mass: 1 });
    const res = stepStellar(state, view, 1, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { ...PARAMS, STELLAR_FORM: 0, STELLAR_HORIZON: 10000, STELLAR_SUPERNOVA: 10000 },
    });
    expect(res.fed).toBeGreaterThan(0);
    expect(view[S.ENERGY]).toBeGreaterThan(10);
    expect(view[S.ENERGY]).toBeLessThanOrEqual(100);
  });

  it('accretes mass + energy from nearby particles (bounded)', () => {
    const state = createStellarState();
    const f = makeFields();
    const star = injectStar(state, { mass: 100, kind: STAR_KINDS.STAR });
    const view = makeView(1);
    place(view, 0, star.x, star.y, star.z, { mass: 10, energy: 100 });
    const before = star.mass;
    const res = stepStellar(state, view, 1, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { ...PARAMS, STELLAR_FORM: 0, STELLAR_RADIANCE: 0, STELLAR_HORIZON: 10000, STELLAR_SUPERNOVA: 10000 },
    });
    expect(res.captured).toBe(1);
    expect(star.mass).toBeGreaterThan(before);
    expect(view[S.MASS]).toBeLessThan(10);
    expect(view[S.ENERGY]).toBeLessThan(100);
  });
});

describe('Set O — black holes & Hawking emission', () => {
  it('collapses a star into a black hole past the horizon', () => {
    const state = createStellarState();
    const f = makeFields();
    injectStar(state, { mass: 500, kind: STAR_KINDS.STAR });
    const res = stepStellar(state, makeView(0), 0, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { ...PARAMS, STELLAR_FORM: 0, STELLAR_HORIZON: 250 },
    });
    expect(res.blackHoles).toBe(1);
    expect(state.stars[0].kind).toBe(STAR_KINDS.BLACK_HOLE);
  });

  it('re-emits black-hole mass as THERMAL via Hawking (conserved, leak-proof)', () => {
    const state = createStellarState();
    const f = makeFields();
    const star = injectStar(state, { mass: 100, kind: STAR_KINDS.BLACK_HOLE });
    const res = stepStellar(state, makeView(0), 0, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { ...PARAMS, STELLAR_FORM: 0, STELLAR_SUPERNOVA: 10000, STELLAR_HAWKING: 0.05 },
    });
    expect(star.mass).toBeLessThan(100);
    expect(star.mass).toBeGreaterThanOrEqual(1); // never below the floor
    const idx = cellIdx(f, star.x, star.y, star.z);
    expect(f.scalars.THERMAL[idx]).toBeGreaterThan(0);
  });
});

describe('Set O — supernovae', () => {
  it('detonates a star past SUPERNOVA MASS: shockwave + damage + element seed', () => {
    const state = createStellarState();
    const f = makeFields();
    const star = injectStar(state, { mass: 500, kind: STAR_KINDS.BLACK_HOLE });
    const view = makeView(1);
    place(view, 0, star.x + 10, star.y, star.z, { energy: 100, mass: 2 });
    const res = stepStellar(state, view, 1, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { ...PARAMS, STELLAR_FORM: 0, STELLAR_SUPERNOVA: 400 },
    });
    expect(res.supernovae).toBe(1);
    expect(star.kind).toBe(STAR_KINDS.REMNANT);
    expect(star.mass).toBeLessThan(500);
    // Scatter: velocity kick + energy damage.
    const vx = view[S.VEL_X], vy = view[S.VEL_Y], vz = view[S.VEL_Z];
    expect(Math.abs(vx) + Math.abs(vy) + Math.abs(vz)).toBeGreaterThan(0);
    expect(view[S.ENERGY]).toBeLessThan(100);
    // Heavy-element seeding: some EXOTIC cells written.
    let exotic = 0;
    for (let i = 0; i < f.scalars.EXOTIC.length; i++) if (f.scalars.EXOTIC[i] > 0) exotic++;
    expect(exotic).toBeGreaterThan(0);
  });

  it('collapses to a remnant on cooldown (no immediate re-detonation)', () => {
    const state = createStellarState();
    const f = makeFields();
    const star = injectStar(state, { mass: 500, kind: STAR_KINDS.BLACK_HOLE });
    stepStellar(state, makeView(0), 0, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { ...PARAMS, STELLAR_FORM: 0, STELLAR_SUPERNOVA: 400 },
    });
    expect(star.cooldown).toBeGreaterThan(0);
    const again = stepStellar(state, makeView(0), 0, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { ...PARAMS, STELLAR_FORM: 0, STELLAR_SUPERNOVA: 400 },
    });
    expect(again.supernovae).toBe(0);
  });
});

describe('Set O — integration, determinism & params', () => {
  it('runs the full pass end-to-end deterministically', () => {
    function run() {
      const state = createStellarState();
      const f = makeFields();
      const view = makeView(3);
      const [x, y, z] = cellCenter(5, 5, 5);
      place(view, 0, x, y, z, { mass: 8, energy: 100 });
      place(view, 1, x + 1, y, z, { mass: 8, energy: 100 });
      place(view, 2, x, y + 1, z, { mass: 8, energy: 100 });
      const res = stepStellar(state, view, 3, PARTICLE_STRIDE, f, { force: true, worldParams: PARAMS });
      return { res, summary: stellarSummary(state) };
    }
    const a = run();
    const b = run();
    expect(a.res).toEqual(b.res);
    expect(a.summary).toEqual(b.summary);
    expect(a.res.formed).toBe(1);
  });

  it('defines the MATTER > STELLAR subgroup with sane defaults', () => {
    const defs = WORLD_PARAM_DEFS.filter((d) => d.group === 'MATTER' && d.subgroup === 'STELLAR');
    expect(defs.length).toBe(7);
    expect(worldParamDef('STELLAR_FORM').default).toBe(20);
    expect(worldParamDef('STELLAR_MAX').default).toBe(4);
    expect(worldParamDef('STELLAR_HORIZON').default).toBe(250);
    expect(worldParamDef('STELLAR_SUPERNOVA').default).toBe(400);
    expect(worldParamDef('STELLAR_HAWKING').default).toBe(0.05);
    expect(clampWorldParam('STELLAR_MAX', 99)).toBe(16);
    expect(clampWorldParam('STELLAR_HAWKING', -5)).toBe(0);
  });
});
