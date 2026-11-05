/**
 * Set I.1 — Tools & Artifacts (RRP I·J·K trilogy)
 * Tests the treasury-funded craft economy + TOOL/WEAPON/BARRIER effects.
 */
import { describe, it, expect } from 'vitest';
import { createFieldSystem, isWall } from '../../src/physics/fields.js';
import { createGroupRegistry, declareGroup, getGroupSummaries } from '../../src/state/groupRegistry.js';
import { runArtifacts, ARTIFACT_CADENCE } from '../../src/state/artifacts.js';
import { createMemoryBuffers, groupMemory, MEM } from '../../src/state/memoryBuffers.js';

function makeGroup(registry, treasury = 100, builders = 1, bbox = [400, 600]) {
  const g = declareGroup(registry, 'TEST', new Set([0]));
  g.treasury = treasury;
  g.roles = { leader: 1, forager: 1, builder: builders };
  g.members = new Set([1, 2, 3]);
  // A territory bbox (default 400..600) so BARRIER corner writes stay in-grid.
  const [lo, hi] = bbox;
  g.minX = lo; g.minY = lo; g.minZ = lo;
  g.maxX = hi; g.maxY = hi; g.maxZ = hi;
  g.cx = (lo + hi) / 2; g.cy = (lo + hi) / 2; g.cz = (lo + hi) / 2;
  return g;
}

function makeFields() {
  return createFieldSystem(2000, 12, {});
}

/** Craft kinds actually minted (not lost) across passes, in order. */
function craftedKinds(reg) {
  return reg.craftLog.filter((e) => !e.lost).map((e) => e.kind);
}

describe('Set I — artifacts crafting', () => {
  it('is gated on its cadence (force bypasses for tests)', () => {
    const reg = createGroupRegistry();
    makeGroup(reg, 1000, 1);
    const f = makeFields();
    const quiet = runArtifacts(reg, f, { tick: 1, worldParams: {} });
    expect(quiet.crafted).toBe(0);
    const forced = runArtifacts(reg, f, { tick: 0, worldParams: {}, force: true });
    expect(forced.crafted).toBe(1);
  });

  it('spends treasury and grows the inventory, spread across kinds', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 1000, 1);
    const f = makeFields();
    for (let i = 0; i < 9; i++) {
      runArtifacts(reg, f, { tick: i * 6, worldParams: {}, force: true });
    }
    const kinds = craftedKinds(reg);
    expect(kinds.length).toBe(9);
    // Rarest-kind rule spreads inventory across at least two kinds.
    expect(new Set(kinds).size).toBeGreaterThanOrEqual(2);
    const total = g.artifacts.TOOL + g.artifacts.WEAPON + g.artifacts.BARRIER;
    expect(total).toBe(9);
    expect(g.treasury).toBeLessThan(1000);
  });

  it('needs builders and treasury to craft', () => {
    const reg = createGroupRegistry();
    const noBuilder = makeGroup(reg, 1000, 0);
    const res1 = runArtifacts(reg, makeFields(), { tick: 0, worldParams: {}, force: true });
    expect(res1.crafted).toBe(0);
    expect(noBuilder.artifacts.TOOL + noBuilder.artifacts.WEAPON + noBuilder.artifacts.BARRIER).toBe(0);

    const reg2 = createGroupRegistry();
    const poor = makeGroup(reg2, 10, 1); // below CRAFT_COST 40
    const res2 = runArtifacts(reg2, makeFields(), { tick: 0, worldParams: {}, force: true });
    expect(res2.crafted).toBe(0);
    expect(poor.treasury).toBe(10);
  });

  it('respects the per-kind inventory cap', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 100000, 1);
    const f = makeFields();
    for (let i = 0; i < 40; i++) {
      runArtifacts(reg, f, { tick: i * 6, worldParams: {}, force: true });
    }
    const total = g.artifacts.TOOL + g.artifacts.WEAPON + g.artifacts.BARRIER;
    expect(total).toBeLessThanOrEqual(36); // 3 kinds × 12
    expect(g.artifacts.TOOL).toBeLessThanOrEqual(12);
  });

  it('levies maintenance decay and loses artifacts the treasury cannot pay for', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 5, 1); // too poor to craft or maintain
    g.artifacts.TOOL = 3;
    const res = runArtifacts(reg, makeFields(), { tick: 0, worldParams: { ARTIFACT_DECAY: 0.5 }, force: true });
    expect(res.decayed).toBe(3);
    expect(g.artifacts.TOOL).toBe(0);
    expect(reg.craftLog.some((e) => e.lost)).toBe(true);
  });
});

describe('Set I — artifact effects', () => {
  it('TOOL pays an income dividend into the treasury', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 1000, 0); // no builders → no craft interference
    g.artifacts.TOOL = 3;
    const before = g.treasury;
    const res = runArtifacts(reg, makeFields(), { tick: 0, worldParams: { ARTIFACT_DECAY: 0 }, force: true });
    expect(res.income).toBe(6);
    expect(g.treasury).toBe(before + 6);
  });

  it('WEAPON dampens the group threat memory (feeds H.2 flee goal)', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 1000, 1);
    g.artifacts.WEAPON = 2;
    const buffers = createMemoryBuffers();
    const mem = groupMemory(buffers, g.id);
    mem[MEM.THREAT] = 1.0;
    runArtifacts(reg, makeFields(), { tick: 0, worldParams: {}, memoryBuffers: buffers, force: true });
    expect(mem[MEM.THREAT]).toBeLessThan(1.0);
    expect(mem[MEM.THREAT]).toBeCloseTo(1 * (1 - 2 * 0.02), 5);
  });

  it('BARRIER writes impassable wall cells at the territory corners', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 1000, 1, [200, 800]); // spans cells 1..4 (cell = 166.67)
    g.artifacts.BARRIER = 1;
    const f = makeFields();
    const res = runArtifacts(reg, f, { tick: 0, worldParams: {}, force: true });
    expect(res.walls).toBe(8);
    expect(isWall(f, 250, 250, 250)).toBe(true);  // corner cell centre (cell 1)
    expect(isWall(f, 750, 750, 750)).toBe(true);  // opposite corner (cell 4)
    expect(isWall(f, 500, 500, 500)).toBe(false); // interior cell (cell 3)
  });

  it('caps wall writes (griefing safety)', () => {
    const reg = createGroupRegistry();
    makeGroup(reg, 100000, 1);
    const g = [...reg.groups.values()][0];
    g.artifacts.BARRIER = 20; // 160 corner writes without the cap
    const f = makeFields();
    const res = runArtifacts(reg, f, { tick: 0, worldParams: {}, force: true });
    expect(res.walls).toBeLessThanOrEqual(48);
  });

  it('exposes the inventory through group summaries (analytics)', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 1000, 1);
    g.artifacts.TOOL = 2;
    const summary = getGroupSummaries(reg).find((s) => s.id === g.id);
    expect(summary.artifacts).toEqual({ TOOL: 2, WEAPON: 0, BARRIER: 0 });
  });

  it('returns a no-op aggregate without fields and before the cadence', () => {
    const reg = createGroupRegistry();
    makeGroup(reg, 1000, 1);
    const res = runArtifacts(reg, null, { tick: 0, worldParams: {}, force: true });
    expect(res).toEqual({ crafted: 0, decayed: 0, walls: 0, income: 0 });
    const res2 = runArtifacts(reg, makeFields(), { tick: 1, worldParams: {} });
    expect(res2.crafted).toBe(0);
    expect(ARTIFACT_CADENCE).toBe(20);
  });
});
