/**
 * Set L.1 — Exotic Matter (RRP L·M·N trilogy)
 * Tests EXOTIC field zones, per-particle matter states, annihilation, dark
 * matter, strange conversion and negative-mass anti-gravity.
 */
import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants.js';
import { createFieldSystem, writeField } from '../../src/physics/fields.js';
import {
  createExoticState, stepExoticMatter, seedExoticZones, writeExoticZones,
  exoticSummary, EXOTIC_CADENCE, EXOTIC_KINDS,
} from '../../src/state/exoticMatter.js';
import { WORLD_PARAM_DEFS, worldParamDef, clampWorldParam } from '../../src/state/worldParams.js';

const S = STRIDE_INDEXES;

function makeFields() {
  return createFieldSystem(2000, 12, {});
}

/** Alive particle at a position with energy/mass/velocity. */
function place(view, i, x, y, z, opts = {}) {
  const b = i * PARTICLE_STRIDE;
  view[b + S.POS_X] = x;
  view[b + S.POS_Y] = y;
  view[b + S.POS_Z] = z;
  view[b + S.DEAD] = 0;
  view[b + S.ENERGY] = opts.energy ?? 50;
  view[b + S.MASS] = opts.mass ?? 2;
  view[b + S.ALPHA] = opts.alpha ?? 1;
  return view;
}

function makeView(count = 20) {
  const view = new Float32Array(count * PARTICLE_STRIDE);
  for (let i = 0; i < count; i++) view[i * PARTICLE_STRIDE + S.DEAD] = 1;
  return view;
}

/** Cell centre for (cx, cy, cz) in a 2000 world / 12 grid. */
function cellCenter(cx, cy, cz) {
  const cell = 2000 / 12;
  return [(cx + 0.5) * cell, (cy + 0.5) * cell, (cz + 0.5) * cell];
}

/** Flat cell index for a world position. */
function cellIdx(f, x, y, z) {
  const cx = Math.floor(x / f.cell);
  const cy = Math.floor(y / f.cell);
  const cz = Math.floor(z / f.cell);
  return (cz * f.dim + cy) * f.dim + cx;
}

describe('Set L — cadence & zones', () => {
  it('is gated on its cadence (force bypasses for tests)', () => {
    const state = createExoticState(5);
    const view = makeView(5);
    const quiet = stepExoticMatter(state, view, 5, PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: { EXOTIC_COUNT: 0 } });
    expect(quiet.zoneWrites).toBe(0);
    const forced = stepExoticMatter(state, view, 5, PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: { EXOTIC_COUNT: 0 }, force: true });
    expect(forced).toHaveProperty('tagged');
    expect(EXOTIC_CADENCE).toBe(15);
  });

  it('grows its arrays lazily to the particle count', () => {
    const state = createExoticState(0);
    const view = makeView(10);
    const res = stepExoticMatter(state, view, 10, PARTICLE_STRIDE, makeFields(), { force: true, worldParams: { EXOTIC_COUNT: 0 } });
    expect(state.state.length).toBe(10);
    expect(res.events).toEqual([]);
  });

  it('seeds deterministic zones from EXOTIC_COUNT / ZONE SIZE; 0 = off', () => {
    const f = makeFields();
    const state = createExoticState();
    const zones = seedExoticZones(state, f, { EXOTIC_COUNT: 3, EXOTIC_ZONE_SIZE: 2 });
    expect(zones.length).toBe(3);
    // Kinds cycle 1..4 in order (1, 2, 3).
    expect(zones.map((z) => z.kind)).toEqual([1, 2, 3]);
    // Deterministic: same params → identical placement.
    const state2 = createExoticState();
    expect(seedExoticZones(state2, f, { EXOTIC_COUNT: 3, EXOTIC_ZONE_SIZE: 2 })).toEqual(zones);
    // Re-seed only on param change.
    const again = seedExoticZones(state, f, { EXOTIC_COUNT: 3, EXOTIC_ZONE_SIZE: 2 });
    expect(again).toBe(zones);
    // 0 zones = off.
    expect(seedExoticZones(state, f, { EXOTIC_COUNT: 0 })).toEqual([]);
    // Count change re-seeds.
    const more = seedExoticZones(state, f, { EXOTIC_COUNT: 5, EXOTIC_ZONE_SIZE: 2 });
    expect(more.length).toBe(5);
  });

  it('writes zone kinds into the EXOTIC scalar field', () => {
    const f = makeFields();
    const state = createExoticState();
    seedExoticZones(state, f, { EXOTIC_COUNT: 1, EXOTIC_ZONE_SIZE: 1 });
    const writes = writeExoticZones(state, f);
    expect(writes).toBeGreaterThan(0);
    // The zone centre cell (spread around the ring at radius dim*0.3) holds kind 1.
    const [x, y, z] = cellCenter(state.zones[0].cx, state.zones[0].cy, state.zones[0].cz);
    expect(f.scalars.EXOTIC).toBeDefined();
    expect(f.scalars.EXOTIC[cellIdx(f, x, y, z)]).toBe(1);
  });
});

describe('Set L — particle tagging', () => {
  it('tags particles by the EXOTIC field at their cell', () => {
    const f = makeFields();
    const [x, y, z] = cellCenter(5, 5, 5);
    writeField(f, 'EXOTIC', x, y, z, 2); // dark zone
    const view = makeView(3);
    place(view, 0, x, y, z);
    place(view, 1, cellCenter(2, 2, 2)[0], 100, 100); // far away, normal
    const state = createExoticState(3);
    const res = stepExoticMatter(state, view, 3, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0 } });
    expect(res.tagged).toBe(1);
    expect(state.state[0]).toBe(EXOTIC_KINDS.DARK);
    expect(state.state[1]).toBe(0);
    expect(exoticSummary(state).DARK).toBe(1);
  });

  it('clears tags when a particle dies', () => {
    const f = makeFields();
    const [x, y, z] = cellCenter(5, 5, 5);
    writeField(f, 'EXOTIC', x, y, z, 1);
    const view = makeView(2);
    place(view, 0, x, y, z);
    const state = createExoticState(2);
    stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0 } });
    expect(state.state[0]).toBe(EXOTIC_KINDS.ANTIMATTER);
    view[S.DEAD] = 1; // kill it
    stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0 } });
    expect(state.state[0]).toBe(0);
  });

  it('decays the tag after the half-life once the particle leaves the zone', () => {
    const f = makeFields();
    const [x, y, z] = cellCenter(5, 5, 5);
    writeField(f, 'EXOTIC', x, y, z, 3);
    const view = makeView(2);
    place(view, 0, x, y, z);
    const state = createExoticState(2);
    stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0, EXOTIC_HALF_LIFE: 20 } });
    expect(state.state[0]).toBe(EXOTIC_KINDS.STRANGE);
    // Clear the field — the particle has left the zone.
    f.scalars.EXOTIC.fill(0);
    stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0, EXOTIC_HALF_LIFE: 20 } });
    expect(state.state[0]).toBe(EXOTIC_KINDS.STRANGE); // 20 - 15 = 5 left
    stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0, EXOTIC_HALF_LIFE: 20 } });
    expect(state.state[0]).toBe(0); // 5 - 15 <= 0 → cleared
  });
});

describe('Set L — annihilation', () => {
  it('annihilates antimatter + normal matter into a conserved energy burst', () => {
    const f = makeFields();
    const [ax, ay, az] = cellCenter(3, 5, 5);
    const [nx, ny, nz] = cellCenter(2, 5, 5);
    writeField(f, 'EXOTIC', ax, ay, az, 1); // antimatter zone at cell 3 only
    const view = makeView(2);
    place(view, 0, nx, ny, nz, { energy: 30 }); // normal (cell 2, mag 0)
    place(view, 1, ax, ay, az, { energy: 20 }); // antimatter (cell 3)
    const res = stepExoticMatter(createExoticState(2), view, 2, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { EXOTIC_COUNT: 0, EXOTIC_ANNIHILATE_RADIUS: 200 },
    });
    expect(res.annihilated).toBe(1);
    expect(res.events[0].type).toBe('exotic:annihilate');
    expect(res.events[0].burst).toBe(50); // energy in = energy out
    expect(view[PARTICLE_STRIDE + S.DEAD]).toBe(1); // antimatter died
    expect(view[S.ENERGY]).toBe(0); // normal destroyed by energy loss
    // Burst landed in the THERMAL field at the midpoint (conserved: 50 total).
    expect(Math.max(...f.scalars.THERMAL)).toBe(50);
  });

  it('is capped per pass (no annihilation storms)', () => {
    const f = makeFields();
    const view = makeView(20);
    // 10 pairs: all antimatter in cell 3, all normals in cell 2 (mag 0) —
    // every antimatter finds a normal within the 200-unit radius.
    const [bx, by, bz] = cellCenter(3, 5, 5);
    const [nx, ny, nz] = cellCenter(2, 5, 5);
    for (let p = 0; p < 10; p++) {
      place(view, p, nx + p * 5, ny, nz, { energy: 10 });
      place(view, 10 + p, bx + p * 5, by, bz, { energy: 10 });
    }
    // One zone write per cell (writeField ADDS — a single write keeps mag = 1).
    writeField(f, 'EXOTIC', bx, by, bz, 1);
    const res = stepExoticMatter(createExoticState(20), view, 20, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { EXOTIC_COUNT: 0, EXOTIC_ANNIHILATE_RADIUS: 200 },
    });
    expect(res.annihilated).toBeGreaterThan(0);
    expect(res.annihilated).toBeLessThanOrEqual(8); // ANNIHILATE_CAP
  });
});

describe('Set L — dark matter', () => {
  it('dims ALPHA and enforces a self-powered energy floor', () => {
    const f = makeFields();
    const [x, y, z] = cellCenter(5, 5, 5);
    writeField(f, 'EXOTIC', x, y, z, 2);
    const view = makeView(2);
    place(view, 0, x, y, z, { energy: 1, alpha: 1 });
    const state = createExoticState(2);
    const res = stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0 } });
    expect(res.dark).toBe(1);
    expect(view[S.ALPHA]).toBeCloseTo(0.25, 4);
    expect(view[S.ENERGY]).toBeGreaterThanOrEqual(10);
    // Leaving the zone restores visibility.
    f.scalars.EXOTIC.fill(0);
    stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0, EXOTIC_HALF_LIFE: 1 } });
    stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0, EXOTIC_HALF_LIFE: 1 } });
    expect(state.state[0]).toBe(0);
    expect(view[S.ALPHA]).toBe(1);
  });
});

describe('Set L — strange conversion', () => {
  function strangeSetup(rate) {
    const f = makeFields();
    const [sx, sy, sz] = cellCenter(5, 5, 5);
    const [nx, ny, nz] = cellCenter(5, 5, 5);
    writeField(f, 'EXOTIC', sx, sy, sz, 3);
    const view = makeView(2);
    place(view, 0, nx, ny, nz, { mass: 2 });   // normal (same cell → will be tagged)
    place(view, 1, sx + 30, sy, sz, { mass: 2 }); // strange candidate
    const state = createExoticState(2);
    stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0, EXOTIC_HALF_LIFE: 200 } });
    return { f, view, state };
  }

  it('converts a normal neighbour when the rate is 1', () => {
    const { f, view, state } = strangeSetup(1);
    // Both particles are now STRANGE-tagged (they sat in the zone) — clear the
    // field and re-place one as normal, keeping the other tagged.
    f.scalars.EXOTIC.fill(0);
    view[S.DEAD] = 0; // keep 0 as normal
    state.state[0] = 0;
    const res = stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { EXOTIC_COUNT: 0, EXOTIC_STRANGE_RATE: 1, EXOTIC_HALF_LIFE: 200 },
    });
    expect(res.converted).toBe(1);
    expect(state.state[0]).toBe(EXOTIC_KINDS.STRANGE);
    expect(view[S.MASS]).toBeCloseTo(3, 4); // 2 × 1.5
  });

  it('does not convert when the rate is 0', () => {
    const { f, view, state } = strangeSetup(1);
    f.scalars.EXOTIC.fill(0);
    view[S.DEAD] = 0;
    state.state[0] = 0;
    const res = stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { EXOTIC_COUNT: 0, EXOTIC_STRANGE_RATE: 0, EXOTIC_HALF_LIFE: 200 },
    });
    expect(res.converted).toBe(0);
    expect(state.state[0]).toBe(0);
  });

  it('caps converted mass below the star-collapse threshold', () => {
    const f = makeFields();
    const [sx, sy, sz] = cellCenter(5, 5, 5);
    writeField(f, 'EXOTIC', sx, sy, sz, 3);
    const view = makeView(2);
    place(view, 0, sx, sy, sz, { mass: 10 });
    place(view, 1, sx + 30, sy, sz, { mass: 2 });
    const state = createExoticState(2);
    stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0, EXOTIC_HALF_LIFE: 200 } });
    f.scalars.EXOTIC.fill(0);
    view[S.DEAD] = 0;
    state.state[0] = 0;
    stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { EXOTIC_COUNT: 0, EXOTIC_STRANGE_RATE: 1, EXOTIC_HALF_LIFE: 200 },
    });
    expect(view[S.MASS]).toBeLessThanOrEqual(8); // STRANGE_MASS_CAP
  });
});

describe('Set L — negative mass', () => {
  it('nudges negative particles up the density gradient (anti-gravity)', () => {
    const f = makeFields();
    const [x, y, z] = cellCenter(5, 5, 5);
    writeField(f, 'EXOTIC', x, y, z, 4);
    // Density ramp: hot cell at +X, cold at −X.
    writeField(f, 'THERMAL', x + f.cell, y, z, 10);
    const view = makeView(2);
    place(view, 0, x, y, z, { alpha: 1 });
    const res = stepExoticMatter(createExoticState(2), view, 2, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { EXOTIC_COUNT: 0, EXOTIC_NEGATIVE_STRENGTH: 5 },
    });
    expect(res.nudged).toBe(1);
    expect(view[S.VEL_X]).toBeGreaterThan(0); // repelled from the dense cell
    expect(view[S.VEL_Y]).toBe(0);
    expect(view[S.VEL_Z]).toBe(0);
  });

  it('does not nudge without a density gradient', () => {
    const f = makeFields();
    const [x, y, z] = cellCenter(5, 5, 5);
    writeField(f, 'EXOTIC', x, y, z, 4);
    const view = makeView(2);
    place(view, 0, x, y, z);
    stepExoticMatter(createExoticState(2), view, 2, PARTICLE_STRIDE, f, {
      force: true,
      worldParams: { EXOTIC_COUNT: 0, EXOTIC_NEGATIVE_STRENGTH: 5 },
    });
    expect(view[S.VEL_X]).toBe(0);
    expect(view[S.VEL_Y]).toBe(0);
    expect(view[S.VEL_Z]).toBe(0);
  });
});

describe('Set L — summaries & determinism', () => {
  it('counts tagged particles per kind', () => {
    const f = makeFields();
    const view = makeView(6);
    const [x, y, z] = cellCenter(5, 5, 5);
    writeField(f, 'EXOTIC', x, y, z, 2); // dark zone
    place(view, 0, x, y, z);
    const state = createExoticState(6);
    stepExoticMatter(state, view, 6, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0 } });
    const sum = exoticSummary(state);
    expect(sum.DARK).toBe(1);
    expect(sum.ANTIMATTER + sum.STRANGE + sum.NEGATIVE).toBe(0);
  });

  it('is deterministic — identical runs give identical results', () => {
    function run() {
      const f = makeFields();
      const [x, y, z] = cellCenter(5, 5, 5);
      writeField(f, 'EXOTIC', x, y, z, 3);
      const view = makeView(2);
      place(view, 0, x, y, z, { mass: 2 });
      place(view, 1, x + 30, y, z, { mass: 2 });
      const state = createExoticState(2);
      const first = stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0, EXOTIC_HALF_LIFE: 200 } });
      f.scalars.EXOTIC.fill(0);
      view[S.DEAD] = 0;
      state.state[0] = 0;
      const second = stepExoticMatter(state, view, 2, PARTICLE_STRIDE, f, { force: true, worldParams: { EXOTIC_COUNT: 0, EXOTIC_STRANGE_RATE: 0.5, EXOTIC_HALF_LIFE: 200 } });
      return { tagged: first.tagged, converted: second.converted, to: second.events.map((e) => e.to) };
    }
    expect(run()).toEqual(run());
  });
});

describe('Set L — world params', () => {
  it('defines the MATTER > EXOTIC subgroup with sane defaults', () => {
    const defs = WORLD_PARAM_DEFS.filter((d) => d.group === 'MATTER' && d.subgroup === 'EXOTIC');
    expect(defs.length).toBe(6);
    const count = worldParamDef('EXOTIC_COUNT');
    expect(count).not.toBeNull();
    expect(count.default).toBe(3);
    expect(count.min).toBe(0);
    expect(count.max).toBe(16);
    expect(clampWorldParam('EXOTIC_COUNT', 99)).toBe(16);
    expect(clampWorldParam('EXOTIC_COUNT', -5)).toBe(0);
    expect(worldParamDef('EXOTIC_STRANGE_RATE').default).toBe(0.02);
    expect(worldParamDef('EXOTIC_HALF_LIFE').default).toBe(20);
  });
});
