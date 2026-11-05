import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { EventBus } from '../../src/core/eventBus.js';
import { LAW_COUNT, LAW_INDEXES } from '../../src/constants.js';
import { createLawState, isSet, serialize, set } from '../../src/state/lawState.js';
import { wirePendingLaws } from '../../src/state/pendingLaws.js';
import { createWorldPanel } from '../../src/ui/worldPanel.js';
import { createLawPanel } from '../../src/ui/lawPanel.js';
import { installDom } from '../helpers/domStub.js';

function fixture() {
  const bus = new EventBus();
  const live = createLawState();
  const updates = [];
  bus.on('law:pending', ({ changes }) => updates.push(changes));
  const controller = wirePendingLaws(bus, { getLive: () => live });
  const stage = (lawIndex, active) => bus.emit('law:editRequested', { changes: [{ lawIndex, active }] });
  return { bus, live, updates, controller, stage };
}

describe('restart-staged law controls', () => {
  it('stages all five mask words without touching live state or emitting worker-sync events', () => {
    const f = fixture();
    const sync = vi.fn();
    f.bus.on('law:sync', sync);
    f.bus.on('law:toggled', sync);
    const before = serialize(f.live);
    for (let i = 0; i < LAW_COUNT; i++) if (i !== LAW_INDEXES.WRAP) f.stage(i, true);
    f.bus.emit('sim:pause');
    f.bus.emit('sim:resume');
    expect(serialize(f.live)).toEqual(before);
    expect(sync).not.toHaveBeenCalled();
    expect(f.updates.at(-1)).toHaveLength(LAW_COUNT - 1);
    expect(f.controller.commit()).toHaveLength(LAW_COUNT - 1);
    for (let i = 0; i < LAW_COUNT; i++) expect(isSet(f.live, i)).toBe(i !== LAW_INDEXES.WRAP);
    expect(f.controller.commit()).toEqual([]);
  });

  it('rejects invalid batches atomically, including WRAP', () => {
    const f = fixture();
    const rejected = vi.fn();
    f.bus.on('law:editRejected', rejected);
    for (const invalid of [null, { lawIndex: -1, active: true }, { lawIndex: LAW_COUNT, active: true },
      { lawIndex: 0.5, active: true }, { lawIndex: LAW_INDEXES.GRAV, active: 1 }, { lawIndex: LAW_INDEXES.WRAP, active: true }]) {
      f.bus.emit('law:editRequested', { changes: [{ lawIndex: LAW_INDEXES.LIFE, active: true }, invalid] });
    }
    expect(rejected).toHaveBeenCalledTimes(6);
    expect(f.controller.commit()).toEqual([]);
  });

  it('coalesces, removes reversions, protects snapshots and clears on discard/restore', () => {
    const f = fixture();
    f.stage(LAW_INDEXES.GRAV, true);
    f.stage(LAW_INDEXES.GRAV, true);
    expect(f.updates.at(-1)).toHaveLength(1);
    f.updates.at(-1)[0].active = false;
    f.bus.emit('law:pendingRequested');
    expect(f.updates.at(-1)[0].active).toBe(true);
    f.stage(LAW_INDEXES.GRAV, false);
    expect(f.updates.at(-1)).toEqual([]);
    for (const event of ['law:discardPending', 'world:restored']) {
      f.stage(LAW_INDEXES.LIFE, true);
      f.bus.emit(event);
      expect(f.controller.commit()).toEqual([]);
    }
  });

  it('rebases proposals on external law sync without retaining redundant changes', () => {
    const f = fixture();
    f.stage(LAW_INDEXES.GRAV, true);
    set(f.live, LAW_INDEXES.GRAV);
    f.bus.emit('law:sync');
    expect(f.updates.at(-1)).toEqual([]);
    f.stage(LAW_INDEXES.GRAV, false);
    expect(f.controller.commit()).toMatchObject([{ lawIndex: LAW_INDEXES.GRAV, active: false }]);
    expect(isSet(f.live, LAW_INDEXES.GRAV)).toBe(false);
  });

  it('shows pending grid state and cross-panel edits; discard restores live tiles', () => {
    const doc = installDom();
    const shell = doc.createElement('div');
    shell.innerHTML = '<div id="law-grid"></div><div id="laws-panel"></div>';
    doc.body.appendChild(shell);
    const f = fixture();
    createWorldPanel(f.bus, f.live);
    createLawPanel(f.bus, f.live);
    const selector = `[data-law="${LAW_INDEXES.GRAV}"]`;
    doc.getElementById('laws-panel').querySelector(selector).dispatch('click', {});
    expect(doc.querySelector('[data-law-pending-details]').textContent).toContain('GRAV: OFF → ON');
    expect(doc.getElementById('law-grid').querySelector(selector).getAttribute('aria-pressed')).toBe('true');
    expect(isSet(f.live, LAW_INDEXES.GRAV)).toBe(false);
    const restart = vi.fn();
    f.bus.on('sim:restart', restart);
    window.confirm = () => false;
    doc.querySelector('[data-law-pending-restart]').dispatch('click', {});
    expect(restart).not.toHaveBeenCalled();
    window.confirm = () => true;
    doc.querySelector('[data-law-pending-restart]').dispatch('click', {});
    expect(restart).toHaveBeenCalledOnce();
    doc.querySelector('[data-law-pending-discard]').dispatch('click', {});
    expect(doc.getElementById('law-grid').querySelector(selector).getAttribute('aria-pressed')).toBe('false');
    expect(doc.querySelector('[data-law-pending-restart]').disabled).toBe(true);
  });

  it('law-set LOAD stages replacement while preserving the live mask and boundary', () => {
    const doc = installDom();
    const grid = doc.createElement('div');
    grid.id = 'law-grid';
    doc.body.appendChild(grid);
    const f = fixture();
    set(f.live, LAW_INDEXES.WRAP);
    set(f.live, LAW_INDEXES.LIFE);
    createWorldPanel(f.bus, f.live);
    doc.querySelector('.law-set-selector').dispatch('click', { stopPropagation() {} });
    doc.querySelector('.law-set-row').dispatch('click', {});
    const before = serialize(f.live);
    doc.querySelector('.law-set-icon').dispatch('click', { stopPropagation() {} });
    expect(serialize(f.live)).toEqual(before);
    expect(f.updates.at(-1).length).toBeGreaterThan(0);
    f.controller.commit();
    expect(isSet(f.live, LAW_INDEXES.WRAP)).toBe(true);
    expect(serialize(f.live)).not.toEqual(before);
  });

  it('commits laws after compute stops and before WORLD adoption, spawning and worker init', () => {
    const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
    const restart = main.slice(main.indexOf("bus.on('sim:restart', (opts"), main.indexOf("bus.on('species:changed'"));
    const ordered = ['stopPhysicsWorker()', 'pendingLaws.commit()', 'pendingWorldParams.commit()', 'spawnDefaultPopulation', 'startPhysicsWorker()'];
    for (let i = 1; i < ordered.length; i++) {
      expect(restart.indexOf(ordered[i - 1])).toBeGreaterThanOrEqual(0);
      expect(restart.indexOf(ordered[i - 1])).toBeLessThan(restart.indexOf(ordered[i]));
    }
  });
});
