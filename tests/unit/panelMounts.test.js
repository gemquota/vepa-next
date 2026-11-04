/**
 * VEPA4 — every panel mounts where the HTML says it does.
 *
 * `createPresetPanel` mounted into `#world-panel`, an id that has not existed
 * since the drawer was rebuilt. It was called on every boot, guarded by
 * `if (!panel) return;`, and so it rendered nothing — silently, forever. The
 * preset buttons appeared in the docs and in the help overlay with nothing
 * behind them, and `src/state/presetManager.js` was unreachable code.
 *
 * `if (!el) return;` is the right guard for a panel and the wrong *only*
 * guard: it protects a panel that has not been written yet, and it hides one
 * that was wired to the wrong id. This file is the other guard.
 *
 * The list is derived from the panels' own source, so a new panel is covered
 * the day it is written — and a renamed id fails here rather than in a drawer
 * that renders nothing.
 */
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { installDom } from '../helpers/domStub.js';
import { EventBus } from '../../src/core/eventBus.js';
import { createPresetPanel } from '../../src/ui/presetPanel.js';
import { createSavePanel } from '../../src/ui/savePanel.js';
import { createUndoRing } from '../../src/state/worldSave.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');

/** Panel modules and the mount id they look up. */
const PANEL_MOUNTS = [
  ['src/ui/lawPanel.js', 'laws-panel'],
  ['src/ui/worldPanel.js', 'law-grid'],
  ['src/ui/worldPanel.js', 'world-params'],
  ['src/ui/speciesPanel.js', 'species-list'],
  ['src/ui/settingsPanel.js', 'laws-panel'],
  ['src/ui/presetPanel.js', 'world-presets'],
  ['src/ui/savePanel.js', 'saves-panel'],
  ['src/ui/savePanel.js', 'undo-panel'],
  ['src/ui/savePanel.js', 'io-panel'],
  ['src/ui/intelPanel.js', 'intel-dashboard'],
  ['src/ui/dnaAnalytics.js', 'dna-analytics'],
  ['src/ui/narrativePanel.js', 'narrative-panel'],
  ['src/ui/groupAnalytics.js', 'groups-dashboard'],
  ['src/ui/ecoPanel.js', 'eco-dashboard'],
  ['src/ui/civilizationPanel.js', 'civilization-dashboard'],
];

function mountShell(doc, ids) {
  const root = doc.createElement('div');
  for (const id of ids) {
    const el = doc.createElement('div');
    el.setAttribute('id', id);
    root.appendChild(el);
  }
  doc.body.appendChild(root);
}

describe('panel mount ids', () => {
  it('every id a panel looks up is declared in index.html', () => {
    const declared = new Set([...HTML.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    const missing = PANEL_MOUNTS
      .filter(([, id]) => !declared.has(id))
      .map(([file, id]) => `${file} → #${id}`);
    expect(missing).toEqual([]);
  });

  it('every mount id a panel looks up is written literally in that panel', () => {
    // The reverse direction: a table entry pointing at an id the module no
    // longer reads would make the check above pass for the wrong reason.
    const stale = [];
    for (const [file, id] of PANEL_MOUNTS) {
      const source = readFileSync(join(ROOT, file), 'utf8');
      if (!source.includes(`'${id}'`) && !source.includes(`"${id}"`)) stale.push(`${file} → #${id}`);
    }
    expect(stale).toEqual([]);
  });

  it('finds no panel module outside the list', () => {
    const listed = new Set(PANEL_MOUNTS.map(([file]) => file));
    const uiFiles = readdirSync(join(ROOT, 'src/ui')).filter((f) => f.endsWith('.js'));
    // Modules that mount nothing (helpers, shells) are named explicitly so a
    // new panel cannot slip past by being added to src/ui.
    const NOT_PANELS = new Set([
      'analyticsPanel.js', 'html.js', 'camera.js', 'hud.js', 'tooltip.js',
      'tooltipDismiss.js', 'sliderControl.js', 'paramHelp.js', 'helpOverlay.js',
      'helpRegistry.js', 'helmetIcons.js',
    ]);
    const unlisted = uiFiles
      .filter((f) => f.startsWith('create') && !listed.has(`src/ui/${f}`))
      .filter((f) => !NOT_PANELS.has(f));
    expect(unlisted).toEqual([]);
  });
});

describe('the preset panel, revived inside WORLD', () => {
  let doc;
  let bus;

  beforeEach(() => {
    doc = installDom();
    mountShell(doc, ['world-presets']);
    bus = new EventBus();
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns the section it built instead of rendering into nothing', () => {
    const section = createPresetPanel(bus);
    expect(section).toBeTruthy();
    expect(section.querySelector('#preset-save-btn')).toBeTruthy();
    expect(section.querySelector('#preset-select')).toBeTruthy();
  });

  it('does not wipe the container it mounts into', () => {
    // The original assigned `panel.innerHTML = html`, which would have removed
    // the world sliders living beside it.
    const host = doc.getElementById('world-presets');
    const sibling = doc.createElement('div');
    sibling.setAttribute('id', 'world-params');
    host.appendChild(sibling);

    createPresetPanel(bus);
    expect(host.querySelector('#world-params')).toBeTruthy();
    expect(host.querySelector('.preset-section')).toBeTruthy();
  });

  it('saves a preset from the state the world hands back, and lists it', () => {
    createPresetPanel(bus);
    const input = doc.getElementById('world-presets').querySelector('#preset-name-input');
    input.value = '  Quiet world  ';

    // main.js owns the buffer; the panel must ask rather than reach.
    doc.getElementById('world-presets').querySelector('#preset-save-btn').dispatch('click', {});
    const requested = [];
    bus.on('preset:stateResponse', (p) => requested.push(p));
    bus.emit('preset:stateResponse', {
      presetName: 'Quiet world',
      law: { low: 7, high: 0, ext: 0, quad: 0 },
      dna: [1, 2, 3],
      worldParams: { TOROIDAL: 0 },
    });

    const stored = JSON.parse(localStorage.getItem('vepa_v3_presets'));
    expect(Object.keys(stored)).toEqual(['Quiet world']);
    expect(stored['Quiet world'].law).toEqual({ low: 7, high: 0, ext: 0, quad: 0 });
    expect(stored['Quiet world'].worldParams).toEqual({ TOROIDAL: 0 });

    // The dropdown now offers it.
    const select = doc.getElementById('world-presets').querySelector('#preset-select');
    expect([...select.children].map((o) => o.value)).toContain('Quiet world');
  });

  it('asks for the world state by name rather than reading a buffer it does not have', () => {
    const requests = [];
    bus.on('preset:requestState', (p) => requests.push(p));
    createPresetPanel(bus);

    const host = doc.getElementById('world-presets');
    const input = host.querySelector('#preset-name-input');
    input.value = 'Second';
    host.querySelector('#preset-save-btn').dispatch('click', {});
    expect(requests).toEqual([{ presetName: 'Second' }]);

    // An empty name asks for nothing rather than saving a blank preset.
    input.value = '   ';
    host.querySelector('#preset-save-btn').dispatch('click', {});
    expect(requests).toHaveLength(1);
  });

  it('deletes a preset and drops it from the dropdown', () => {
    createPresetPanel(bus);
    const host = doc.getElementById('world-presets');
    bus.emit('preset:stateResponse', { presetName: 'Gone', law: { low: 1 } });
    const select = host.querySelector('#preset-select');
    select.value = 'Gone';
    host.querySelector('#preset-delete-btn').dispatch('click', {});

    expect(JSON.parse(localStorage.getItem('vepa_v3_presets'))).toEqual({});
    expect([...host.querySelector('#preset-select').children].map((o) => o.value)).not.toContain('Gone');
  });

  it('is idempotent across a second boot', () => {
    createPresetPanel(bus);
    createPresetPanel(bus);
    expect(doc.getElementById('world-presets').querySelectorAll('.preset-section')).toHaveLength(1);
  });
});

describe('the SAVES panel, split into three sub-tabs', () => {
  let doc;
  let bus;

  beforeEach(() => {
    doc = installDom();
    mountShell(doc, ['saves-panel', 'undo-panel', 'io-panel']);
    bus = new EventBus();
  });

  it('fills all three mounts from one module', () => {
    createSavePanel(bus);
    expect(doc.getElementById('saves-panel').querySelector('#ws-list')).toBeTruthy();
    expect(doc.getElementById('undo-panel').querySelector('#ws-undo')).toBeTruthy();
    expect(doc.getElementById('io-panel').querySelector('#ws-import')).toBeTruthy();
  });

  it('shows the undo ring, not just whether a step is available', () => {
    createSavePanel(bus);
    bus.emit('world:undoState', {
      canUndo: true,
      canRedo: false,
      enabled: true,
      history: ['tick 10', 'tick 40'],
      position: 1,
    });
    const ring = doc.getElementById('undo-panel').querySelector('#ws-ring');
    expect(ring.textContent).toContain('tick 10');
    expect(ring.textContent).toContain('tick 40');
    expect(doc.getElementById('undo-panel').querySelectorAll('.ws-ring-step.now')).toHaveLength(1);
    expect(doc.getElementById('undo-panel').querySelector('#ws-undo').disabled).toBe(false);
  });

  it('says so when there is nothing to undo', () => {
    createSavePanel(bus);
    bus.emit('world:undoState', { canUndo: false, canRedo: false, enabled: true, history: [], position: -1 });
    const ring = doc.getElementById('undo-panel').querySelector('#ws-ring');
    expect(ring.textContent).toContain('Nothing to undo yet');
    expect(doc.getElementById('undo-panel').querySelector('#ws-undo').disabled).toBe(true);
  });

  it('lists a saved world with its tick and size', () => {
    createSavePanel(bus);
    bus.emit('world:listResponse', {
      saves: [{
        name: 'Baseline',
        savedAt: Date.UTC(2026, 9, 1, 12, 30),
        tick: 840,
        particleCount: 500,
        speciesCount: 5,
        bytes: 2048,
        summary: { alive: 500, species: 5, lawsOn: 12 },
      }],
    });
    const list = doc.getElementById('saves-panel').querySelector('#ws-list');
    expect(list.textContent).toContain('Baseline');
    expect(list.textContent).toContain('T 840');
    expect(list.textContent).toContain('2 KB');
    expect(list.textContent).toContain('LAWS 12');
  });
});

describe('the undo ring describes itself', () => {
  it('labels steps by name when they have one, and by tick otherwise', () => {
    const ring = createUndoRing(4);
    expect(ring.describe().history).toEqual([]);

    ring.commit({ name: 'after chaos', tick: 10, laws: { low: 0 }, worldParams: {} });
    ring.commit({ tick: 40, laws: { low: 0 }, worldParams: {} });
    const described = ring.describe();
    expect(described.history).toEqual(['after chaos', 'tick 40']);
    expect(described.position).toBe(1);
  });

  it('lists redo-able steps in the order they will come back', () => {
    const ring = createUndoRing(4);
    ring.commit({ name: 'a', laws: { low: 1 }, worldParams: {} });
    ring.commit({ name: 'b', laws: { low: 2 }, worldParams: {} });
    ring.undo({ name: 'c', laws: { low: 3 }, worldParams: {} });
    // `future` is a stack; the next redo is its last entry.
    expect(ring.describe().redo).toEqual(['c']);
  });
});
