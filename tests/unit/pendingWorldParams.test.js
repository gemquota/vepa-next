import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { installDom } from '../helpers/domStub.js';
import { createWorldPanel } from '../../src/ui/worldPanel.js';
import { createLawState } from '../../src/state/lawState.js';
import { EventBus } from '../../src/core/eventBus.js';
import { createPendingWorldParams, wirePendingWorldParams } from '../../src/state/pendingWorldParams.js';
import { applyWorldParam, createWorldParams, WORLD_PARAM_DEFS } from '../../src/state/worldParams.js';

describe('restart-staged WORLD parameters', () => {
  it('stages every schema key without mutating the live object', () => {
    const live = createWorldParams();
    const before = { ...live };
    const pending = createPendingWorldParams(() => live);
    for (const def of WORLD_PARAM_DEFS) {
      expect(pending.stage(def.key, live[def.key] === def.min ? def.max : def.min)).toBe(true);
    }
    expect(pending.snapshot()).toHaveLength(WORLD_PARAM_DEFS.length);
    expect(live).toEqual(before);
  });

  it('rejects invalid/unknown inputs, clamps values, coalesces edits and removes reversions', () => {
    const live = createWorldParams();
    const pending = createPendingWorldParams(() => live);
    for (const value of [NaN, Infinity, null, '2', undefined]) expect(pending.stage('GLOBAL_G', value)).toBe(false);
    expect(pending.stage('__proto__', 2)).toBe(false);
    expect(pending.stage('unknown', 2)).toBe(false);
    pending.stage('GLOBAL_G', 1000);
    expect(pending.snapshot()).toEqual([{ key: 'GLOBAL_G', label: 'GRAVITY STRENGTH', liveValue: 1, value: 20 }]);
    pending.stage('GLOBAL_G', 3);
    expect(pending.snapshot()).toHaveLength(1);
    pending.stage('GLOBAL_G', 1);
    expect(pending.snapshot()).toEqual([]);
  });

  function fixture() {
    const bus = new EventBus();
    let live = createWorldParams();
    const applied = vi.fn(({ key, value }) => { live = applyWorldParam(live, key, value); });
    const states = [];
    bus.on('world:paramsPending', (state) => states.push(state));
    const controller = wirePendingWorldParams(bus, { getLive: () => live, apply: applied });
    return { bus, controller, applied, states, live: () => live };
  }

  it('keeps changes pending while running or paused and applies only an explicit commit', () => {
    const f = fixture();
    f.bus.emit('world:paramChanged', { key: 'GLOBAL_G', value: 4 });
    f.bus.emit('sim:pause');
    f.bus.emit('sim:resume');
    expect(f.live().GLOBAL_G).toBe(1);
    expect(f.applied).not.toHaveBeenCalled();
    expect(f.controller.commit()).toHaveLength(1);
    expect(f.live().GLOBAL_G).toBe(4);
    expect(f.applied).toHaveBeenCalledTimes(1);
    expect(f.states.at(-1)).toEqual({ changes: [] });
    f.controller.commit();
    expect(f.applied).toHaveBeenCalledTimes(1);
  });

  it('discards pending changes and resets on world restore without applying anything', () => {
    const f = fixture();
    const restored = vi.fn();
    f.bus.on('world:paramsRestored', restored);
    f.bus.emit('world:paramChanged', { key: 'TOROIDAL', value: 0 });
    f.bus.emit('world:discardPending');
    expect(restored).toHaveBeenCalledTimes(1);
    expect(f.controller.commit()).toEqual([]);
    f.bus.emit('world:paramChanged', { key: 'INITIAL_POP', value: 300 });
    f.bus.emit('world:restored');
    expect(f.controller.commit()).toEqual([]);
    expect(f.applied).not.toHaveBeenCalled();
    expect(f.live().TOROIDAL).toBe(1);
  });

  it('publishes independent snapshots for remount/refresh and protects internal pending data', () => {
    const f = fixture();
    f.bus.emit('world:paramChanged', { key: 'GLOBAL_G', value: 4 });
    f.states.at(-1).changes[0].value = 10;
    f.bus.emit('world:pendingRequested');
    expect(f.states.at(-1).changes[0].value).toBe(4);
  });

  it('shows proposals, gates restart confirmation and clears the pending UI on discard', () => {
    const doc = installDom();
    const shell = doc.createElement('div');
    shell.innerHTML = '<div id="law-grid"></div><div id="world-params"></div>';
    doc.body.appendChild(shell);
    const f = fixture();
    const restart = vi.fn();
    f.bus.on('sim:restart', restart);
    createWorldPanel(f.bus, createLawState());
    const button = doc.querySelector('[data-pending-restart]');
    expect(button.disabled).toBe(true);
    f.bus.emit('world:paramChanged', { key: 'GLOBAL_G', value: 4 });
    expect(doc.querySelector('[data-pending-details]').textContent).toContain('1 → 4');
    expect(button.disabled).toBe(false);
    window.confirm = () => false;
    button.dispatch('click', {});
    expect(restart).not.toHaveBeenCalled();
    window.confirm = () => true;
    button.dispatch('click', {});
    expect(restart).toHaveBeenCalledTimes(1);
    doc.querySelector('[data-pending-discard]').dispatch('click', {});
    expect(button.disabled).toBe(true);
    expect(doc.querySelector('[data-pending-details]').textContent).toBe('');
    expect(f.live().GLOBAL_G).toBe(1);
  });

  it('wires commit after worker stop and before population spawn / worker initialization', () => {
    const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
    const restart = main.slice(main.indexOf("bus.on('sim:restart', (opts"), main.indexOf("bus.on('species:changed'"));
    expect(restart.indexOf('stopPhysicsWorker()')).toBeLessThan(restart.indexOf('pendingWorldParams.commit()'));
    expect(restart.indexOf('pendingWorldParams.commit()')).toBeLessThan(restart.indexOf('spawnDefaultPopulation'));
    expect(restart.indexOf('spawnDefaultPopulation')).toBeLessThan(restart.indexOf('startPhysicsWorker()'));
    expect(main).not.toContain("bus.on('world:paramChanged', ({ key, value }) =>");
  });
});
