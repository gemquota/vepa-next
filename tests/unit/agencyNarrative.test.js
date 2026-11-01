import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants.js';
import {
  createAgencyEngine,
  updateAgency,
  decideAction,
  detectMilestones,
  resetAgency,
} from '../../src/engines/agencyEngine.js';
import { computeSpeciesGoals, applyGoalNudges } from '../../src/engines/goalBehavior.js';
import { createMemoryBuffers, speciesMemory, MEM } from '../../src/state/memoryBuffers.js';

const S = STRIDE_INDEXES;

describe('agencyEngine — narrative actor (Set H.1)', () => {
  it('rescues with a spawn-rate nudge while an extinction is open', () => {
    const a = decideAction(
      { populationAlive: 10, avgEnergy: 20, lawActiveCount: 5 },
      { extinctionOpen: true, spawnRate: 5, worldSize: 2000 },
    );
    expect(a.kind).toBe('param');
    expect(a.key).toBe('SPAWN_RATE');
    expect(a.value).toBe(7);
    expect(a.reason).toBe('rescue');
  });

  it('fertilizes when energy is low and laws are active', () => {
    const a = decideAction({ populationAlive: 200, avgEnergy: 10, lawActiveCount: 3 }, { worldSize: 2000 });
    expect(a.kind).toBe('field');
    expect(a.name).toBe('INFO');
    expect(a.delta).toBe(8);
  });

  it('balances a crowded dish with a negative INFO write', () => {
    const a = decideAction({ populationAlive: 900, avgEnergy: 60, lawActiveCount: 3 }, { worldSize: 2000 });
    expect(a.kind).toBe('field');
    expect(a.delta).toBe(-8);
  });

  it('stays silent otherwise', () => {
    expect(decideAction({ populationAlive: 200, avgEnergy: 50, lawActiveCount: 3 }, { worldSize: 2000 })).toBeNull();
  });

  it('acts on cadence, then cools down, and stays silent while lawless', () => {
    const e = createAgencyEngine(null, { cadence: 10, cooldown: 100 });
    const metrics = { populationAlive: 900, avgEnergy: 60, lawActiveCount: 3 };

    // Lawless → silent.
    expect(updateAgency(e, { metrics: { ...metrics, lawActiveCount: 0 } }).length).toBe(0);

    // Over 30 frames (three cadence windows) exactly one action fires: the
    // cooldown swallows the later windows.
    const actions = [];
    for (let f = 0; f < 30; f++) {
      for (const ev of updateAgency(e, { metrics })) actions.push(ev.action);
    }
    expect(actions.length).toBe(1);
    expect(actions[0].kind).toBe('field');
  });

  it('detects each milestone exactly once', () => {
    const seen = new Set();
    const metrics = { populationAlive: 1600, speciesAlive: 9, groupCount: 4, avgEnergy: 90 };
    const first = detectMilestones(metrics, seen);
    expect(first.map((m) => m.id)).toEqual(['species-8', 'groups-3', 'pop-1500', 'energy-80']);
    expect(detectMilestones(metrics, seen)).toEqual([]);
  });

  it('resets agency state', () => {
    const e = createAgencyEngine(null);
    e.frame = 999; e.cooldownUntil = 999; e.actions.push({ kind: 'param' });
    resetAgency(e);
    expect(e.frame).toBe(0);
    expect(e.cooldownUntil).toBe(0);
    expect(e.actions.length).toBe(0);
  });
});

describe('goalBehavior — goal-driven nudges (Set H.2)', () => {
  it('derives flee / seek / hold goals from memory', () => {
    const b = createMemoryBuffers();
    speciesMemory(b, 1)[MEM.THREAT] = 0.9;
    speciesMemory(b, 2)[MEM.EXPLORATION] = 0.8;
    speciesMemory(b, 3); // all-zero → hold
    const goals = computeSpeciesGoals(b, [1, 2, 3]);
    expect(goals.get(1).kind).toBe('flee');
    expect(goals.get(2).kind).toBe('seek');
    expect(goals.get(3).kind).toBe('hold');
  });

  it('seek pulls toward centre, flee pushes away, hold does nothing', () => {
    const view = new Float32Array(3 * PARTICLE_STRIDE);
    for (let i = 0; i < 3; i++) {
      view[i * PARTICLE_STRIDE + S.SPECIES_ID] = i + 1;
      view[i * PARTICLE_STRIDE + S.MASS] = 1;
    }
    const b = createMemoryBuffers();
    speciesMemory(b, 1)[MEM.THREAT] = 1;        // flee
    speciesMemory(b, 2)[MEM.EXPLORATION] = 1;   // seek
    speciesMemory(b, 3);                         // hold
    const goals = computeSpeciesGoals(b, [1, 2, 3]);
    applyGoalNudges(view, 3, PARTICLE_STRIDE, goals, 2000, { strength: 0.02 });

    const vx = (i) => view[i * PARTICLE_STRIDE + S.VEL_X];
    // All particles sit at the origin; the centre (1000) is ahead on +X.
    expect(vx(0)).toBeLessThan(0);   // flee → away from centre
    expect(vx(1)).toBeGreaterThan(0); // seek → toward centre
    expect(vx(2)).toBe(0);            // hold → untouched
  });
});
