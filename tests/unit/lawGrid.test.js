/**
 * VEPA4 — the LAWS grid: search, category visibility, per-category ON/OFF.
 *
 * 136 tiles is past the point where scrolling and counting lit squares is a
 * workable interface, so v9.1.29 added the three things the grid was missing:
 * a search box, a live per-category count, and an ON/OFF pair on each category
 * header.
 *
 * The bulk path deliberately toggles through the same `law:editRequested` emit a
 * manual tap uses — a bulk path of its own would be a second way for the
 * worker and the grid to disagree, which is the exact failure the dead-INERTIA
 * audit was written to prevent.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { installDom } from '../helpers/domStub.js';
import { EventBus } from '../../src/core/eventBus.js';
import { LAW_INDEXES, LAW_CATEGORIES, LAW_COUNT } from '../../src/constants.js';
import { createLawState, isSet, set as setLaw } from '../../src/state/lawState.js';
import { createWorldPanel } from '../../src/ui/worldPanel.js';
import { wirePendingLaws } from '../../src/state/pendingLaws.js';

const CATEGORIES = ['physics', 'biology', 'chemistry', 'thermodynamics', 'metaphysics',
  'electromagnetism', 'information', 'quantum', 'mechanics'];

function mount(doc) {
  const shell = doc.createElement('div');
  shell.innerHTML = `
    <div class="category-filter-row">
      ${CATEGORIES.map((c) => `<button class="cat-tab active" data-cat="cat-${c}"></button>`).join('')}
    </div>
    <div id="law-grid" class="law-icon-grid"></div>
    <div class="law-search-row">
      <input id="law-search" type="search">
      <button id="law-search-clear" class="law-search-clear">x</button>
      <span id="law-search-count" class="law-search-count"></span>
    </div>`;
  doc.body.appendChild(shell);
  return doc;
}

function visibleTiles(doc) {
  return doc.getElementById('law-grid')
    .querySelectorAll('[data-law]')
    .filter((t) => t.style.display !== 'none');
}

describe('the LAWS grid', () => {
  let doc;
  let bus;
  let laws;
  let emits;
  let pending;

  beforeEach(() => {
    doc = installDom();
    mount(doc);
    bus = new EventBus();
    emits = [];
    bus.on('law:editRequested', (p) => emits.push(p));
    laws = createLawState();
    pending = wirePendingLaws(bus, { getLive: () => laws });
    createWorldPanel(bus, laws);
  });

  it('renders one tile per declared law', () => {
    expect(doc.getElementById('law-grid').querySelectorAll('[data-law]')).toHaveLength(LAW_COUNT);
  });

  it('shows how many of a category are on, without counting lit squares', () => {
    const row = doc.getElementById('law-grid').querySelector('[data-cat-row="physics"]');
    expect(row.querySelector('.law-cat-count').textContent).toBe(`0/${LAW_CATEGORIES.physics.laws.length}`);

    for (const idx of LAW_CATEGORIES.physics.laws.slice(0, 3)) setLaw(laws, idx);
    bus.emit('law:sync');
    expect(doc.getElementById('law-grid').querySelector('[data-cat-row="physics"]')
      .querySelector('.law-cat-count').textContent).toBe(`3/${LAW_CATEGORIES.physics.laws.length}`);
  });

  it('turns a whole category on through the same emit a manual tap uses', () => {
    const onAll = doc.getElementById('law-grid')
      .querySelector('[data-cat-row="quantum"] .law-cat-bulk[data-bulk="on"]');
    onAll.dispatch('click', {});

    for (const idx of LAW_CATEGORIES.quantum.laws) expect(isSet(laws, idx), String(idx)).toBe(false);
    expect(doc.getElementById('law-grid').querySelectorAll('.pending-law')).toHaveLength(LAW_CATEGORIES.quantum.laws.length);
    expect(emits).toHaveLength(1);
    expect(emits[0]).toMatchObject({ category: 'quantum', active: true, changed: LAW_CATEGORIES.quantum.laws.length });
    expect(doc.getElementById('law-grid').querySelector('[data-cat-row="quantum"]')
      .querySelector('.law-cat-count').textContent).toBe(`${LAW_CATEGORIES.quantum.laws.length}/${LAW_CATEGORIES.quantum.laws.length}`);
    pending.commit();
    for (const idx of LAW_CATEGORIES.quantum.laws) expect(isSet(laws, idx)).toBe(true);
  });

  it('reports an explicit no-op when the only visible bulk match is WRAP', () => {
    const messages = [];
    bus.on('narrative:system', (message) => messages.push(message.text));
    const search = doc.getElementById('law-search');
    search.value = 'wrap';
    search.dispatch('input', {});
    const mechanicsOn = doc.getElementById('law-grid')
      .querySelector('[data-cat-row="mechanics"] .law-cat-bulk[data-bulk="on"]');
    expect(mechanicsOn.textContent).toBe('ON 0');
    const lawEventsBefore = emits.length;
    mechanicsOn.dispatch('click', {});
    expect(isSet(laws, LAW_INDEXES.WRAP)).toBe(false);
    expect(emits).toHaveLength(lawEventsBefore);
    expect(messages.at(-1)).toContain('0 visible targets; 0 changed');
    expect(messages.at(-1)).toContain('WRAP boundary mode was preserved');
  });

  it('searches law help hints as well as law names', () => {
    const input = doc.getElementById('law-search');
    input.value = 'hard contact prevents';
    input.dispatch('input', {});
    expect(visibleTiles(doc).map((tile) => tile.dataset.name)).toContain('contact');
  });

  it('bulk operations target visible matches and exclude WRAP with explicit feedback', () => {
    const messages = [];
    bus.on('narrative:system', (message) => messages.push(message.text));
    const search = doc.getElementById('law-search');
    search.value = 'hard contact prevents';
    search.dispatch('input', {});

    const onVisible = doc.getElementById('law-grid')
      .querySelector('[data-cat-row="mechanics"] .law-cat-bulk[data-bulk="on"]');
    expect(visibleTiles(doc).map((tile) => tile.dataset.name)).toEqual(['contact']);
    expect(onVisible.textContent).toBe('ON 1');
    onVisible.dispatch('click', {});
    expect(isSet(laws, LAW_INDEXES.CONTACT)).toBe(false);
    expect(doc.querySelector(`[data-law="${LAW_INDEXES.CONTACT}"]`).classList.contains('pending-law')).toBe(true);
    pending.commit();
    expect(isSet(laws, LAW_INDEXES.CONTACT)).toBe(true);
    expect(isSet(laws, LAW_INDEXES.MOMENTUM)).toBe(false);
    expect(emits.at(-1)).toMatchObject({ category: 'mechanics', targetCount: 1, changed: 1 });

    expect(messages.at(-1)).toContain('1 visible target');
    expect(messages.at(-1)).toContain('1 changed');
  });

  it('turns a whole category off', () => {
    for (const idx of LAW_CATEGORIES.biology.laws) setLaw(laws, idx);
    bus.emit('law:sync');

    doc.getElementById('law-grid')
      .querySelector('[data-cat-row="biology"] .law-cat-bulk[data-bulk="off"]')
      .dispatch('click', {});

    for (const idx of LAW_CATEGORIES.biology.laws) expect(isSet(laws, idx), String(idx)).toBe(true);
    pending.commit();
    for (const idx of LAW_CATEGORIES.biology.laws) expect(isSet(laws, idx), String(idx)).toBe(false);
    expect(emits.at(-1)).toMatchObject({ category: 'biology', active: false });
  });

  it('does not emit when the category is already in the requested state', () => {
    const before = emits.length;
    doc.getElementById('law-grid')
      .querySelector('[data-cat-row="physics"] .law-cat-bulk[data-bulk="off"]')
      .dispatch('click', {});
    expect(emits.length).toBe(before);
  });

  it('leaves other categories alone', () => {
    setLaw(laws, LAW_INDEXES.LIFE);
    bus.emit('law:sync');
    doc.getElementById('law-grid')
      .querySelector('[data-cat-row="chemistry"] .law-cat-bulk[data-bulk="off"]')
      .dispatch('click', {});
    expect(isSet(laws, LAW_INDEXES.LIFE)).toBe(true);
  });

  it('searches by name and reports how many laws remain reachable', () => {
    const input = doc.getElementById('law-search');
    input.value = 'field';
    input.dispatch('input', {});

    const shown = visibleTiles(doc).map((t) => t.dataset.name);
    expect(shown.length).toBeGreaterThan(0);
    for (const name of shown) expect(name).toContain('field');
    expect(doc.getElementById('law-search-count').textContent).toBe(`${shown.length} of ${LAW_COUNT}`);
  });

  it('hides a whole category row when the search matches nothing in it', () => {
    const input = doc.getElementById('law-search');
    input.value = 'zzzznotalaw';
    input.dispatch('input', {});

    expect(visibleTiles(doc)).toHaveLength(0);
    for (const cat of CATEGORIES) {
      const row = doc.getElementById('law-grid').querySelector(`[data-cat-row="${cat}"]`);
      expect(row.style.display, cat).toBe('none');
    }
  });

  it('clearing the search restores the whole grid', () => {
    const input = doc.getElementById('law-search');
    input.value = 'field';
    input.dispatch('input', {});
    const clear = doc.getElementById('law-search-clear');
    expect(clear.disabled).toBe(false);

    clear.dispatch('click', {});
    expect(input.value).toBe('');
    expect(visibleTiles(doc)).toHaveLength(LAW_COUNT);
    expect(doc.getElementById('law-search-count').textContent).toBe('');
  });

  it('composes with the category filter rather than replacing it', () => {
    // Hide the category, then search: the search must not bring it back.
    const physicsTab = doc.querySelector('[data-cat="cat-physics"]');
    physicsTab.dispatch('click', {});
    expect(doc.getElementById('law-grid').querySelector('[data-cat-row="physics"]').style.display).toBe('none');

    const input = doc.getElementById('law-search');
    input.value = 'grav';
    input.dispatch('input', {});
    expect(doc.getElementById('law-grid').querySelector('[data-cat-row="physics"]').style.display).toBe('none');
    expect(doc.getElementById('law-search-count').textContent).toBe('1 of 136');

    // Restoring the category brings back only the matching tiles.
    physicsTab.dispatch('click', {});
    const physicsShown = doc.getElementById('law-grid')
      .querySelectorAll('[data-cat-row="physics"] [data-law]')
      .filter((t) => t.style.display !== 'none');
    expect(physicsShown.map((t) => t.dataset.name)).toContain('grav');
  });

  it('Enter jumps to the first surviving tile', () => {
    const input = doc.getElementById('law-search');
    input.value = 'superposition';
    input.dispatch('input', {});

    let prevented = false;
    input.dispatch('keydown', { key: 'Enter', preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(true);
    expect(isSet(laws, LAW_INDEXES.SUPERPOSITION)).toBe(false);
    expect(emits.at(-1).changes).toEqual([{ lawIndex: LAW_INDEXES.SUPERPOSITION, active: true }]);
    pending.commit();
    expect(isSet(laws, LAW_INDEXES.SUPERPOSITION)).toBe(true);
  });
});
