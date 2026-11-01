import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants.js';
import { createGroupRegistry, declareGroup, updateGroups } from '../../src/state/groupRegistry.js';
import { applyConstructions } from '../../src/state/construction.js';
import { runEconomy } from '../../src/state/economy.js';
import { createFieldSystem } from '../../src/physics/fields.js';

const S = STRIDE_INDEXES;
const WORLD = 1000;
const DIM = 16;

function fieldSystem() {
  return createFieldSystem(WORLD, DIM, {});
}

function makeGroup(reg, cx, cy, cz, count = 5) {
  const g = declareGroup(reg, `G-${cx}`, [0]);
  for (let k = 0; k < count; k++) {
    g.members.add(k + 1000 + cx); // fake particle indices
  }
  g.cx = cx; g.cy = cy; g.cz = cz;
  g.roles.forager = Math.floor(count / 2);
  g.roles.leader = 1;
  g.treasury = 10;
  return g;
}

describe('construction (Set F.2)', () => {
  it('writes nests and roads into the INFO field with caps', () => {
    const fs = fieldSystem();
    const reg = createGroupRegistry();
    makeGroup(reg, 200, 200, 200);
    makeGroup(reg, 400, 200, 200);

    const res = applyConstructions(reg, fs, { force: true });
    expect(res.nests).toBe(2);
    expect(res.roads).toBeGreaterThanOrEqual(1);
    expect(res.writes).toBeGreaterThan(0);
    expect(res.writes).toBeLessThanOrEqual(96 * 2); // cap incl. dual writes

    // INFO must actually be non-zero somewhere (nests + roads wrote).
    const info = fs.scalars.INFO;
    const nonzero = [...info].filter((v) => v > 0).length;
    expect(nonzero).toBeGreaterThan(0);
    // THERMAL too (nests run warm).
    const thermal = fs.scalars.THERMAL;
    expect([...thermal].some((v) => v > 0)).toBe(true);
  });

  it('respects the cadence gate and the griefing cap', () => {
    const fs = fieldSystem();
    const reg = createGroupRegistry();
    // 8 groups in a tight cluster — roads would explode without caps.
    for (let k = 0; k < 8; k++) {
      makeGroup(reg, 300 + k * 20, 300, 300);
    }
    const res = applyConstructions(reg, fs, { force: true });
    expect(res.writes).toBeLessThanOrEqual(96 * 2);
    // Cadence: tick=7 should do nothing without force.
    const reg2 = createGroupRegistry();
    makeGroup(reg2, 200, 200, 200);
    const skipped = applyConstructions(reg2, fs, { tick: 7 });
    expect(skipped.writes).toBe(0);
  });

  it('writes nothing without a field system', () => {
    const reg = createGroupRegistry();
    makeGroup(reg, 200, 200, 200);
    const res = applyConstructions(reg, null, { force: true });
    expect(res.writes).toBe(0);
    expect(res.nests).toBe(0);
  });
});

describe('economy (Set F.3)', () => {
  it('accumulates treasury from foragers and leaders', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 200, 200, 200, 6);
    g.roles.forager = 4;
    g.roles.leader = 1;
    g.treasury = 10;
    runEconomy(reg, null, PARTICLE_STRIDE, null, { force: true });
    expect(g.treasury).toBeGreaterThan(10);
  });

  it('trades treasury between close groups and logs to the ring', () => {
    const reg = createGroupRegistry();
    const rich = makeGroup(reg, 200, 200, 200, 6);
    const poor = makeGroup(reg, 240, 200, 200, 6);
    rich.treasury = 500;
    poor.treasury = 5;
    rich.roles.forager = 3;
    poor.roles.forager = 3;

    const res = runEconomy(reg, null, PARTICLE_STRIDE, null, { force: true });
    expect(res.trades).toBeGreaterThanOrEqual(1);
    expect(res.volume).toBeGreaterThan(0);
    expect(rich.treasury).toBeLessThan(500);
    expect(poor.treasury).toBeGreaterThan(5);
    expect(reg.tradeLog.length).toBeGreaterThanOrEqual(1);
    expect(reg.tradeLog[0].from).toBe(rich.id);
    expect(reg.tradeLog[0].to).toBe(poor.id);
  });

  it('does not trade between distant groups', () => {
    const reg = createGroupRegistry();
    const a = makeGroup(reg, 100, 100, 100);
    const b = makeGroup(reg, 900, 900, 900);
    a.treasury = 500;
    b.treasury = 5;
    const res = runEconomy(reg, null, PARTICLE_STRIDE, null, { force: true });
    expect(res.trades).toBe(0);
  });

  it('writes market prices onto the field grid', () => {
    const fs = fieldSystem();
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 200, 200, 200, 6);
    g.treasury = 60;
    runEconomy(reg, null, PARTICLE_STRIDE, fs, { force: true });
    // The centroid cell should carry a price (INFO > 0) after the write.
    const cell = 200 / (WORLD / DIM);
    const i = Math.floor(cell);
    const idx = i + i * DIM + i * DIM * DIM; // x=y=z=i
    expect(fs.scalars.INFO[idx]).toBeGreaterThan(0);
  });
});
