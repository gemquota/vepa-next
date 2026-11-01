import { describe, it, expect } from 'vitest';
import { PARTICLE_STRIDE, STRIDE_INDEXES } from '../../src/constants.js';
import {
  createEpochEngine,
  updateEpoch,
  getEpochs,
  getEpochSnapshot,
  resetEpoch,
  EPOCH_CAP,
} from '../../src/engines/epochEngine.js';
import { WORLD_PARAM_DEFS, createWorldParams, applyWorldParam } from '../../src/state/worldParams.js';

const S = STRIDE_INDEXES;

/** Build a stride-laid view with `alive` live particles and the rest dead. */
function makeView(total, alive) {
  const view = new Float32Array(total * PARTICLE_STRIDE);
  for (let i = 0; i < total; i++) {
    const b = i * PARTICLE_STRIDE;
    if (i < alive) {
      view[b + S.MASS] = 1;
      view[b + S.DEAD] = 0;
    } else {
      view[b + S.MASS] = 0;
      view[b + S.DEAD] = 1;
    }
  }
  return view;
}

describe('epochEngine — eras, snapshots, extinction/recovery', () => {
  it('advances eras on the epoch boundary and captures snapshots', () => {
    const engine = createEpochEngine(null, { epochLength: 10 });
    const view = makeView(20, 20);
    const captures = [];
    let lastEra = -1;

    for (let tick = 1; tick <= 25; tick++) {
      const evts = updateEpoch(engine, view, 20, PARTICLE_STRIDE, {
        tick,
        captureFn: () => {
          captures.push(tick);
          return { era: engine.era, tick };
        },
      });
      for (const e of evts) {
        if (e.type === 'epoch:boundary') lastEra = e.era;
      }
    }

    expect(lastEra).toBe(2); // boundaries at tick 10 (era 0) and 20 (era 1)
    expect(captures).toEqual([10, 20]);
    expect(getEpochs(engine).map((e) => e.index)).toEqual([0, 1]);
    expect(getEpochs(engine)[0].name).toBe('GENESIS');
    expect(getEpochs(engine)[1].name).toBe('DAWN');
    expect(getEpochSnapshot(engine, 1).tick).toBe(20);
    expect(getEpochSnapshot(engine, 99)).toBeNull();
  });

  it('detects extinction then recovery against the era baseline', () => {
    const engine = createEpochEngine(null, {
      epochLength: 100, // no boundary within the test window
      extinctionThreshold: 0.4,
      recoveryThreshold: 0.7,
    });
    const view = makeView(100, 100);
    const events = [];
    const run = (tick, alive) => {
      const v = makeView(100, alive);
      events.push(...updateEpoch(engine, v, 100, PARTICLE_STRIDE, { tick }));
    };

    run(1, 100); // baseline = 100
    expect(events.some((e) => e.type === 'epoch:extinction')).toBe(false);

    run(2, 30);  // 30/100 = 0.30 < 0.40 → extinction
    expect(events.some((e) => e.type === 'epoch:extinction')).toBe(true);

    // Still below threshold — no duplicate extinction while already open.
    const before = events.filter((e) => e.type === 'epoch:extinction').length;
    run(3, 20);
    expect(events.filter((e) => e.type === 'epoch:extinction').length).toBe(before);

    // 80/100 = 0.80 >= 0.70 → recovery (rebased baseline to 80).
    run(4, 80);
    expect(events.some((e) => e.type === 'epoch:recovery')).toBe(true);
  });

  it('caps navigable eras at EPOCH_CAP', () => {
    const engine = createEpochEngine(null, { epochLength: 2 });
    const view = makeView(10, 10);
    for (let tick = 1; tick <= EPOCH_CAP * 2 + 4; tick++) {
      updateEpoch(engine, view, 10, PARTICLE_STRIDE, { tick });
    }
    expect(engine.eras.length).toBeLessThanOrEqual(EPOCH_CAP);
  });

  it('resets cleanly on restart', () => {
    const engine = createEpochEngine(null, { epochLength: 2 });
    const view = makeView(10, 10);
    updateEpoch(engine, view, 10, PARTICLE_STRIDE, { tick: 2 });
    expect(engine.era).toBeGreaterThan(0);
    resetEpoch(engine);
    expect(engine.era).toBe(0);
    expect(engine.eras.length).toBe(0);
    expect(engine.baselineAlive).toBe(0);
  });
});

describe('TIME world-param group (Set D.2)', () => {
  it('defines TIME_SPEED / EPOCH_LENGTH / extinction + recovery thresholds', () => {
    const keys = new Set(WORLD_PARAM_DEFS.filter((d) => d.group === 'TIME').map((d) => d.key));
    expect([...keys].sort()).toEqual([
      'EPOCH_LENGTH',
      'EXTINCTION_THRESHOLD',
      'RECOVERY_THRESHOLD',
      'TIME_SPEED',
    ].sort());
  });

  it('clamps TIME_SPEED and applies it to fresh state', () => {
    const p = createWorldParams();
    expect(p.TIME_SPEED).toBe(1);
    expect(p.EPOCH_LENGTH).toBe(600);
    const fast = applyWorldParam(p, 'TIME_SPEED', 999);
    expect(fast.TIME_SPEED).toBe(10); // clamped to max
  });
});
