/**
 * Set J.1 — Society & Governance (RRP I·J·K trilogy)
 * Tests the policy vector, alliances/conflicts, and policy-driven effects.
 */
import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants.js';
import { createFieldSystem } from '../../src/physics/fields.js';
import { createGroupRegistry, declareGroup, getGroupSummaries } from '../../src/state/groupRegistry.js';
import { runGovernance, GOVERNANCE_CADENCE } from '../../src/state/governance.js';
import { createMemoryBuffers, speciesMemory, MEM } from '../../src/state/memoryBuffers.js';

const S = STRIDE_INDEXES;

function makeGroup(registry, name, x, y, z, treasury = 500, members = 5) {
  const g = declareGroup(registry, name, new Set([0]));
  g.treasury = treasury;
  g.roles = { leader: 1, forager: 1, builder: 1 };
  g.members = new Set(Array.from({ length: members }, (_, k) => 100 + k));
  g.cx = x; g.cy = y; g.cz = z;
  g.minX = x - 50; g.maxX = x + 50;
  g.minY = y - 50; g.maxY = y + 50;
  g.minZ = z - 50; g.maxZ = z + 50;
  return g;
}

function makeFields() {
  return createFieldSystem(2000, 12, {});
}

function makeView() {
  const view = new Float32Array(200 * PARTICLE_STRIDE);
  for (let i = 0; i < 200; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.DEAD] = 1;
    view[b + S.POS_X] = i;
    view[b + S.POS_Y] = i;
    view[b + S.POS_Z] = i;
  }
  for (const m of [100, 101, 102, 103, 104]) {
    const b = m * PARTICLE_STRIDE;
    view[b + S.DEAD] = 0;
    view[b + S.POS_X] = m - 100 + 1;  // 1..5
    view[b + S.POS_Y] = 1;
    view[b + S.POS_Z] = 1;
  }
  return view;
}

describe('Set J — policy derivation', () => {
  it('is gated on its cadence (force bypasses for tests)', () => {
    const reg = createGroupRegistry();
    makeGroup(reg, 'A', 100, 100, 100);
    const quiet = runGovernance(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: {} });
    expect(quiet.events.length).toBe(0);
    const forced = runGovernance(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 1, worldParams: {}, force: true });
    expect(forced).toHaveProperty('alliances');
    expect(GOVERNANCE_CADENCE).toBe(25);
  });

  it('aggression rises with learned threat + scarcity; stability falls', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 100, 100, 100, 100); // low treasury → scarcity
    const buffers = createMemoryBuffers();
    const mem = speciesMemory(buffers, 0);
    mem[MEM.THREAT] = 1.0;
    runGovernance(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: { POLICY_SHIFT: 1 }, memoryBuffers: buffers, force: true });
    expect(g.policy.aggression).toBeCloseTo(0.6 * 1.0 + 0.4 * 0.9, 4);
    expect(g.stability).toBeLessThan(1);
  });

  it('openness rises with treasury surplus; migration with exploration + low density', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 100, 100, 100, 5000); // surplus
    const buffers = createMemoryBuffers();
    const mem = speciesMemory(buffers, 0);
    mem[MEM.EXPLORATION] = 1.0;
    runGovernance(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: { POLICY_SHIFT: 1 }, memoryBuffers: buffers, force: true });
    expect(g.policy.openness).toBeCloseTo(0.6 * 1.0 + 0.4 * 1.0, 4);
    expect(g.policy.migration).toBeCloseTo(0.7 * 1.0 + 0.3 * 0.9, 4); // density = 5/50
  });

  it('blends slowly toward the target at the default POLICY_SHIFT', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 100, 100, 100, 5000);
    runGovernance(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: {}, force: true });
    expect(g.policy.openness).toBeLessThan(0.6); // 0 + (0.6 - 0) * 0.1 = 0.06
    expect(g.policy.openness).toBeCloseTo(0.06, 4);
  });
});

describe('Set J — relations', () => {
  it('allies close groups with similar policy and pools their treasuries', () => {
    const reg = createGroupRegistry();
    const a = makeGroup(reg, 'A', 100, 100, 100, 1000);
    const b = makeGroup(reg, 'B', 200, 100, 100, 100); // within ALLIANCE_RANGE 350
    a.policy = { aggression: 0.1, openness: 0.6, migration: 0.2 };
    b.policy = { aggression: 0.1, openness: 0.6, migration: 0.2 };
    const res = runGovernance(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: {}, force: true });
    expect(res.alliances).toBe(1);
    expect(a.allies.has(b.id)).toBe(true);
    expect(b.allies.has(a.id)).toBe(true);
    expect(b.treasury).toBeGreaterThan(100); // pool mean-reverted toward a
    expect(a.treasury).toBeLessThan(1000);
    expect(res.events.some((e) => e.type === 'governance:alliance')).toBe(true);
  });

  it('does not ally distant or dissimilar groups', () => {
    const reg = createGroupRegistry();
    const a = makeGroup(reg, 'A', 100, 100, 100, 1000);
    const far = makeGroup(reg, 'FAR', 2000, 2000, 2000, 100);
    a.policy = { aggression: 0.1, openness: 0.6, migration: 0.2 };
    far.policy = { aggression: 0.1, openness: 0.6, migration: 0.2 };
    const reg2 = createGroupRegistry();
    const c = makeGroup(reg2, 'C', 100, 100, 100, 1000);
    const opposed = makeGroup(reg2, 'D', 200, 100, 100, 100);
    c.policy = { aggression: 0.1, openness: 0.6, migration: 0.2 };
    opposed.policy = { aggression: 0.9, openness: 0.1, migration: 0.8 };
    const r1 = runGovernance(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: {}, force: true });
    expect(r1.alliances).toBe(0);
    const r2 = runGovernance(reg2, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: {}, force: true });
    expect(r2.alliances).toBe(0);
    expect(r2.conflicts).toBe(1);
  });

  it('conflicts write tension at the border, raise threat memory, and cool down', () => {
    const reg = createGroupRegistry();
    const a = makeGroup(reg, 'A', 100, 100, 100, 1000);
    const b = makeGroup(reg, 'B', 200, 100, 100, 100);
    a.policy = { aggression: 0.9, openness: 0.1, migration: 0.1 };
    b.policy = { aggression: 0.1, openness: 0.9, migration: 0.9 };
    const buffers = createMemoryBuffers();
    speciesMemory(buffers, 0); // warm the species slot
    const f = makeFields();
    const res = runGovernance(reg, makeView(), PARTICLE_STRIDE, f, { tick: 0, worldParams: { CONFLICT_THRESHOLD: 0.3 }, memoryBuffers: buffers, force: true });
    expect(res.conflicts).toBe(1);
    expect(res.events.some((e) => e.type === 'governance:conflict')).toBe(true);
    // Negative INFO at the midpoint cell (150,100,100).
    const cell = Math.floor(150 / (2000 / 12));
    expect(f.scalars.INFO[cell + 12 * cell + 144 * cell]).toBeLessThan(0);
    // Threat memory nudged on the species — both groups share species 0, so
    // it is nudged once per side (0.05 × 2).
    expect(buffers.speciesMem.get(0)[MEM.THREAT]).toBeCloseTo(0.1, 5);
    // Cooldown: same tick + 10 (well inside 300) → no repeat.
    const again = runGovernance(reg, makeView(), PARTICLE_STRIDE, f, { tick: 10, worldParams: { CONFLICT_THRESHOLD: 0.3 }, memoryBuffers: buffers, force: true });
    expect(again.conflicts).toBe(0);
  });
});

describe('Set J — policy effects', () => {
  it('aggression raids the nearest non-ally', () => {
    const reg = createGroupRegistry();
    const raider = makeGroup(reg, 'RAID', 100, 100, 100, 500);
    const victim = makeGroup(reg, 'VIC', 300, 100, 100, 500);
    const allyG = makeGroup(reg, 'ALLY', 700, 100, 100, 500);
    raider.policy = { aggression: 0.9, openness: 0.1, migration: 0.1 };
    victim.policy = { aggression: 0.1, openness: 0.9, migration: 0.1 };
    allyG.policy = { aggression: 0.1, openness: 0.9, migration: 0.1 };
    raider.allies.add(allyG.id); // the rich near-ish group is protected
    const before = victim.treasury;
    const res = runGovernance(reg, makeView(), PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: {}, force: true });
    expect(res.raids).toBe(1);
    expect(victim.treasury).toBeLessThan(before);
    expect(raider.treasury).toBeGreaterThan(500);
    expect(res.events.some((e) => e.type === 'governance:raid')).toBe(true);
  });

  it('openness pays a commerce bonus and writes market INFO', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 100, 100, 100, 500);
    g.policy = { aggression: 0.1, openness: 0.9, migration: 0.1 };
    const f = makeFields();
    const before = g.treasury;
    // POLICY_SHIFT 0 preserves the hand-set policy (derivePolicy otherwise
    // blends it toward the memory/treasury target before effects run).
    const res = runGovernance(reg, makeView(), PARTICLE_STRIDE, f, { tick: 0, worldParams: { POLICY_SHIFT: 0 }, force: true });
    expect(res.income).toBeCloseTo(0.9 * 1.5, 4);
    expect(g.treasury).toBeCloseTo(before + 0.9 * 1.5, 4);
    expect(f.scalars.INFO.some((v) => v > 0)).toBe(true);
  });

  it('migration disperses members outward from the centroid', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 0, 0, 0, 500);
    g.policy = { aggression: 0.1, openness: 0.1, migration: 0.9 };
    const view = makeView(); // members at (1..5, 1, 1), centroid (0,0,0)
    runGovernance(reg, view, PARTICLE_STRIDE, makeFields(), { tick: 0, worldParams: {}, force: true });
    const b = 100 * PARTICLE_STRIDE;
    // Outward nudge: velocities point away from the origin.
    expect(view[b + S.VEL_X]).toBeGreaterThan(0);
    expect(view[b + S.VEL_Y]).toBeGreaterThan(0);
    expect(view[b + S.VEL_Z]).toBeGreaterThan(0);
    // Bounded: far under MAX_VELOCITY / MAX_FORCE.
    expect(view[b + S.VEL_X]).toBeLessThan(0.5);
  });

  it('exposes policy, allies and stability through group summaries', () => {
    const reg = createGroupRegistry();
    const g = makeGroup(reg, 'A', 100, 100, 100, 500);
    g.policy = { aggression: 0.4, openness: 0.5, migration: 0.6 };
    g.allies.add(99);
    g.stability = 0.8;
    const summary = getGroupSummaries(reg).find((s) => s.id === g.id);
    expect(summary.policy).toEqual({ aggression: 0.4, openness: 0.5, migration: 0.6 });
    expect(summary.allies).toContain(99);
    expect(summary.stability).toBe(0.8);
  });
});
