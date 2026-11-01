import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PARTICLE_STRIDE, MAX_PARTICLES, STRIDE_INDEXES, LAW_INDEXES } from '../../src/constants.js';
import { createParticleBuffer } from '../../src/state/particleBuffer.js';
import { createLawState, set } from '../../src/state/lawState.js';
import { createWorldParams } from '../../src/state/worldParams.js';
import { runtimeConfig } from '../../src/state/runtimeConfig.js';
import { solve } from '../../src/physics/solver.js';
import {
  gridDimFor,
  fieldsEnabled,
  createFieldSystem,
  ensureFields,
  resetFields,
  writeField,
  sampleFieldForces,
  wellForce,
  isWall,
  resolveWall,
  portalAt,
  advanceFields,
} from '../../src/physics/fields.js';

const S = STRIDE_INDEXES;
const WORLD = 2000;
const DT = 0.25;

const rng = () => 0.5;

/** One alive particle with a clean state. */
function makeParticle(x, y, z, vx = 0, vy = 0, vz = 0) {
  const buf = createParticleBuffer(MAX_PARTICLES, PARTICLE_STRIDE);
  const view = buf.view;
  const b = 0;
  view[b + S.POS_X] = x;
  view[b + S.POS_Y] = y;
  view[b + S.POS_Z] = z;
  view[b + S.VEL_X] = vx;
  view[b + S.VEL_Y] = vy;
  view[b + S.VEL_Z] = vz;
  view[b + S.MASS] = 1.5;
  view[b + S.SPECIES_ID] = 0;
  view[b + S.DEAD] = 0;
  view[b + S.AGE] = 500;
  view[b + S.SIGNAL] = 0;
  view[b + S.MEMORY] = 0;
  view[b + S.ENERGY] = 100;
  view[b + S.RADIUS] = 0.6;
  return { view, buf };
}

/** A law state with the named laws on. */
function lawStateWith(names) {
  const ls = createLawState();
  for (const n of names) set(ls, LAW_INDEXES[n]);
  return ls;
}

/** Run the solver with the given world params, returning the particle view. */
function runSolver(params, lawNames, ticks = 5, at = { x: 100, y: 100, z: 100, vx: 0 }) {
  const { view, buf } = makeParticle(at.x, at.y, at.z, at.vx);
  runtimeConfig.worldParams = { ...createWorldParams(), ...params };
  const lawState = lawStateWith(lawNames);
  for (let t = 0; t < ticks; t++) {
    solve(view, 1, PARTICLE_STRIDE, lawState, null, WORLD, DT, rng);
  }
  return { view, buf };
}

beforeEach(() => {
  resetFields();
  runtimeConfig.worldParams = createWorldParams();
});

afterEach(() => {
  resetFields();
  runtimeConfig.worldParams = createWorldParams();
});

// ── Grid resolution & enablement ─────────────────────────────────────────────

describe('field grid + enablement', () => {
  it('auto-scales the grid to world size, clamped to 12–24', () => {
    expect(gridDimFor(2000)).toBe(16);      // 2000 / 125
    expect(gridDimFor(100)).toBe(12);       // clamped low
    expect(gridDimFor(100000)).toBe(24);    // clamped high
    expect(gridDimFor(2400)).toBe(19);      // 2400 / 125 = 19.2
  });

  it('honours an explicit FIELD_GRID_DIM within 12–24', () => {
    expect(gridDimFor(2000, { FIELD_GRID_DIM: 20 })).toBe(20);
    expect(gridDimFor(2000, { FIELD_GRID_DIM: 5 })).toBe(12);
    expect(gridDimFor(2000, { FIELD_GRID_DIM: 30 })).toBe(24);
  });

  it('is disabled for default/empty params (zero solver overhead)', () => {
    expect(fieldsEnabled({})).toBe(false);
    expect(fieldsEnabled(createWorldParams())).toBe(false);
  });

  it('enables for any field, wall, well or portal feature', () => {
    expect(fieldsEnabled({ FIELD_WIND: 1 })).toBe(true);
    expect(fieldsEnabled({ FIELD_THERMAL: 1 })).toBe(true);
    expect(fieldsEnabled({ FIELD_EM: 1 })).toBe(true);
    expect(fieldsEnabled({ FIELD_INFO: 1 })).toBe(true);
    expect(fieldsEnabled({ WALLS_PRESET: 1 })).toBe(true);
    expect(fieldsEnabled({ PORTAL_COUNT: 1 })).toBe(true);
    expect(fieldsEnabled({ WELL_COUNT: 2, WELL_STRENGTH: 1 })).toBe(true);
    // A well count with zero strength is inert.
    expect(fieldsEnabled({ WELL_COUNT: 2, WELL_STRENGTH: 0 })).toBe(false);
  });
});

// ── Structural build ─────────────────────────────────────────────────────────

describe('createFieldSystem', () => {
  it('allocates dim³ cells with the requested walls/wells/portals', () => {
    const sys = createFieldSystem(2000, 8, {
      WALLS_PRESET: 3,
      WALL_THICKNESS: 2,
      WELL_COUNT: 2,
      PORTAL_COUNT: 1,
    });
    expect(sys.cells).toBe(8 * 8 * 8);
    expect(sys.hasWalls).toBe(true);
    expect(sys.wells).toHaveLength(2);
    expect(sys.portals).toHaveLength(1);
    expect(sys.scalars.THERMAL).toHaveLength(512);
    expect(sys.vectors.WIND).toHaveLength(512 * 3);
  });

  it('no walls preset means no impassable cells', () => {
    const sys = createFieldSystem(2000, 8, {});
    expect(sys.hasWalls).toBe(false);
    expect(isWall(sys, 100, 100, 100)).toBe(false);
  });

  it('cross preset marks the centre slabs impassable', () => {
    const sys = createFieldSystem(2000, 8, { WALLS_PRESET: 3, WALL_THICKNESS: 1 });
    // dim 8 → mid = 4 → one-cell slabs at x=4 and y=4 (world x ∈ [1000, 1250)).
    expect(isWall(sys, 4.5 * 250, 1 * 250 + 10, 4 * 250)).toBe(true);
    expect(isWall(sys, 1 * 250 + 10, 4.5 * 250, 4 * 250)).toBe(true);
    expect(isWall(sys, 1 * 250 + 10, 1 * 250 + 10, 4 * 250)).toBe(false);
  });
});

// ── writeField + forces ──────────────────────────────────────────────────────

describe('field forces', () => {
  it('writeField feeds a vector field that sampleFieldForces reads', () => {
    const sys = createFieldSystem(2000, 8, {});
    writeField(sys, 'WIND', 250, 250, 250, [10, 0, 0]);
    const f = sampleFieldForces(sys, 250, 250, 250, { FIELD_WIND: 5 });
    expect(f.ax).toBeGreaterThan(0);
    expect(f.ay).toBe(0);
  });

  it('ambient seeding relaxes WIND toward +X and THERMAL toward hot-at-+X', () => {
    const params = { FIELD_WIND: 5, FIELD_THERMAL: 5, FIELD_DIFFUSION: 0 };
    const sys = createFieldSystem(2000, 8, params);
    for (let i = 0; i < 50; i++) advanceFields(sys, DT, params);
    // WIND: +X component approaches the slider value (gentle circulation keeps
    // the perpendicular components near zero rather than exactly zero).
    const wind = sys.vectors.WIND;
    expect(wind[3]).toBeGreaterThan(2);
    expect(Math.abs(wind[4])).toBeLessThan(1);
    // THERMAL: hot at +X, cold at 0 (cell x=7, y=4, z=4).
    const t = sys.scalars.THERMAL;
    expect(t[((4 * 8) + 4) * 8 + 7]).toBeGreaterThan(1);
    expect(t[0]).toBeLessThan(0.1);
  });

  it('ambient THERMAL pushes particles down-gradient', () => {
    const params = { FIELD_THERMAL: 5, FIELD_DIFFUSION: 0 };
    const sys = createFieldSystem(2000, 8, params);
    for (let i = 0; i < 50; i++) advanceFields(sys, DT, params);
    // At the cold side the gradient points toward +X (hot), so the force is -X.
    const f = sampleFieldForces(sys, 200, 1000, 1000, params);
    expect(f.ax).toBeLessThan(0);
  });

  it('wellForce pulls toward the well centre', () => {
    const params = { WELL_COUNT: 1, WELL_STRENGTH: 2 };
    const sys = createFieldSystem(2000, 8, params);
    const w = sys.wells[0];
    const f = wellForce(sys, w.x - 100, w.y, w.z, params);
    expect(f.ax).toBeGreaterThan(0); // toward +X (the well)
    expect(Math.abs(f.ay)).toBeLessThan(0.001);
  });

  it('advanceFields diffuses a scalar spike into neighbours', () => {
    const params = { FIELD_DIFFUSION: 0.5 };
    const sys = createFieldSystem(2000, 8, params);
    const i = 4 * 8 * 8 + 4 * 8 + 4; // centre cell
    sys.scalars.INFO[i] = 10;
    advanceFields(sys, DT, params);
    expect(sys.scalars.INFO[i]).toBeLessThan(10);
    expect(sys.scalars.INFO[i + 1]).toBeGreaterThan(0);
  });
});

// ── Walls & portals ──────────────────────────────────────────────────────────

describe('walls & portals', () => {
  it('resolveWall pushes a particle out of a wall cell and reflects velocity', () => {
    const sys = createFieldSystem(2000, 8, { WALLS_PRESET: 3, WALL_THICKNESS: 1 });
    // Inside the x-slab wall cell (x=4) near its low face, moving toward the
    // interior — it must be pushed out the low face (cell 3, free) and bounce.
    // (y=2 keeps the position clear of the perpendicular y-slab.)
    const r = resolveWall(sys, 4 * 250 + 5, 2 * 250 + 10, 4 * 250 + 20, 5, 0, 0);
    expect(isWall(sys, r.px, r.py, r.pz)).toBe(false);
    expect(r.px).toBeLessThan(4 * 250);
    expect(r.vx).toBeLessThan(0); // reflected
  });

  it('portalAt returns the paired cell centre', () => {
    const sys = createFieldSystem(2000, 8, { PORTAL_COUNT: 1 });
    const a = sys.portals[0].a;
    const b = sys.portals[0].b;
    const ax = a % 8;
    const ay = Math.floor(a / 8) % 8;
    const az = Math.floor(a / 64);
    const dest = portalAt(sys, (ax + 0.5) * 250, (ay + 0.5) * 250, (az + 0.5) * 250);
    expect(dest).not.toBeNull();
    const bx = b % 8;
    const by = Math.floor(b / 8) % 8;
    const bz = Math.floor(b / 64);
    expect(dest.x).toBeCloseTo((bx + 0.5) * 250, 5);
    expect(dest.y).toBeCloseTo((by + 0.5) * 250, 5);
    expect(dest.z).toBeCloseTo((bz + 0.5) * 250, 5);
  });
});

// ── Solver integration ───────────────────────────────────────────────────────

describe('solver integration', () => {
  it('FIELD_WIND drifts particles +X while the sim runs; no params = frozen', () => {
    const wind = runSolver({ FIELD_WIND: 5 }, ['WRAP'], 30);
    const vx = wind.view[S.VEL_X];
    const px = wind.view[S.POS_X];
    expect(vx).toBeGreaterThan(1);
    expect(px).toBeGreaterThan(110);

    // Control: same laws, zero fields — nothing moves.
    const ctrl = runSolver({}, ['WRAP'], 30);
    expect(ctrl.view[S.POS_X]).toBeCloseTo(100, 3);
    expect(ctrl.view[S.VEL_X]).toBe(0);
  });

  it('COLL makes walls impassable (velocity-only bounce), COLL off = pass-through', () => {
    // Cross preset, thickness 2, on a 2000 world → dim 16 → cell 125 → x-slab
    // cells 7..8 → world x ∈ [875, 1125).
    const wallParams = { WALLS_PRESET: 3, WALL_THICKNESS: 2 };
    const at = { x: 870, y: 1000, z: 1000, vx: 10 };
    const blocked = runSolver(wallParams, ['WRAP', 'COLL'], 6, at);
    expect(blocked.view[S.POS_X]).toBeLessThan(875); // never entered the slab
    expect(blocked.view[S.VEL_X]).toBeLessThan(0);   // bounced

    // Same layout without COLL: the slab is decorative, matter passes through.
    const pass = runSolver(wallParams, ['WRAP'], 6, at);
    expect(pass.view[S.POS_X]).toBeGreaterThan(875);
  });

  it('portals teleport matter across the dish', () => {
    const { view, buf } = makeParticle(187.5, 312.5, 312.5); // cell (1,2,2) — portal A
    runtimeConfig.worldParams = { ...createWorldParams(), PORTAL_COUNT: 1 };
    const lawState = lawStateWith(['WRAP']);
    solve(view, 1, PARTICLE_STRIDE, lawState, null, WORLD, DT, rng);
    // Portal B centre: cell (14,13,13) → (1812.5, 1687.5, 1687.5).
    expect(view[S.POS_X]).toBeGreaterThan(1700);
    expect(view[S.POS_Y]).toBeGreaterThan(1500);
    expect(view[S.POS_Z]).toBeGreaterThan(1500);
  });
});
