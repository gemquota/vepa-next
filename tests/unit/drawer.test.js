import { describe, it, expect, beforeEach } from 'vitest';

// ── Minimal fake DOM for the drawer wiring in src/ui/ui.js ──
function makeEl(id) {
  const el = {
    id, dataset: {}, style: {}, hidden: false,
    classes: new Set(),
    listeners: {},
    textContent: '',
    title: '',
    get classList() {
      const classes = this.classes;
      return {
        add: (...cs) => cs.forEach((c) => classes.add(c)),
        remove: (...cs) => cs.forEach((c) => classes.delete(c)),
        toggle: (c, force) => {
          const on = force !== undefined ? force : !classes.has(c);
          on ? classes.add(c) : classes.delete(c);
          return on;
        },
        contains: (c) => classes.has(c),
      };
    },
    setAttribute: (k, v) => { el['attr_' + k] = v; },
    addEventListener: (type, fn) => { (el.listeners[type] ||= []).push(fn); },
    dispatch: (type, ev = {}) => (el.listeners[type] || []).forEach((fn) => fn(ev)),
    closest: () => null,
    insertAdjacentElement: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return el;
}

let els, allTabBtns, allContents;

function installFakeDom() {
  els = {};
  ['drawer-container', 'drawer-minimize-btn', 'drawer-hide-btn', 'drawer-show-btn', 'tab-setup', 'tab-data', 'setup-laws', 'setup-world']
    .forEach((id) => { els[id] = makeEl(id); });
  els['drawer-container'].classes.add('active');
  const tabs = makeEl('tabs');
  tabs.classes.add('tabs');
  const handle = makeEl('drawer-resize-handle');
  const setupBtn = makeEl('setup-btn');
  setupBtn.dataset.tab = 'tab-setup';
  setupBtn.classes.add('tab-btn', 'active');
  const dataBtn = makeEl('data-btn');
  dataBtn.dataset.tab = 'tab-data';
  dataBtn.classes.add('tab-btn');
  // Drawer control buttons share .tab-btn but carry no data-tab
  const minBtn = els['drawer-minimize-btn'];
  minBtn.classes.add('tab-btn');
  const hideBtn = els['drawer-hide-btn'];
  hideBtn.classes.add('tab-btn');
  const zoomBtn = makeEl('zoom');
  zoomBtn.classes.add('tab-btn');
  allTabBtns = [setupBtn, dataBtn, minBtn, hideBtn, zoomBtn];
  els['tab-setup'].classes.add('tab-content', 'active');
  els['tab-data'].classes.add('tab-content');
  allContents = [els['tab-setup'], els['tab-data']];

  globalThis.document = {
    getElementById: (id) => els[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '#main-panel .tab-btn[data-tab]') return allTabBtns.filter((b) => b.dataset.tab);
      if (sel === '#main-panel .tab-btn') return allTabBtns;
      if (sel === '#main-panel .tab-content') return allContents;
      if (sel === '#main-panel .tabs, #drawer-resize-handle') return [tabs, handle];
      return [];
    },
    querySelector: (sel) => {
      if (sel === '#main-panel .tab-content.active') return allContents.find((c) => c.classes.has('active')) || null;
      if (sel === '#main-panel .tab-btn.active[data-tab]') return allTabBtns.find((b) => b.dataset.tab && b.classes.has('active')) || null;
      if (sel === '#main-panel .tabs') return tabs;
      return null;
    },
    createElement: makeEl,
    addEventListener: () => {},
  };
  globalThis.window = { innerHeight: 800, addEventListener: () => {} };
  return { tabs };
}

// ui.js is side-effect free at import; drawer functions read document at call time.
const {
  setupTabSwitching,
  setupDrawerMinimize,
  setupDrawerSwipe,
  setupDrawerHideShow,
} = await import('../../src/ui/ui.js');

describe('Bottom drawer', () => {
  let tabs;

  beforeEach(() => {
    ({ tabs } = installFakeDom());
    setupTabSwitching();
    setupDrawerMinimize();
    setupDrawerSwipe();
    setupDrawerHideShow();
  });

  it('switches tabs on a real tab click', () => {
    const setupBtn = allTabBtns.find((b) => b.dataset.tab === 'tab-setup');
    const dataBtn = allTabBtns.find((b) => b.dataset.tab === 'tab-data');
    setupBtn.dispatch('click');
    expect(els['tab-setup'].classes.has('active')).toBe(true);
    dataBtn.dispatch('click');
    expect(els['tab-data'].classes.has('active')).toBe(true);
    expect(els['tab-setup'].classes.has('active')).toBe(false);
  });

  it('minimize/expand keeps the active tab (control buttons are not tabs)', () => {
    allTabBtns.find((b) => b.dataset.tab === 'tab-setup').dispatch('click');
    const minBtn = els['drawer-minimize-btn'];
    minBtn.dispatch('click');
    expect(els['drawer-container'].classes.has('minimized')).toBe(true);
    expect(els['tab-setup'].classes.has('active')).toBe(true);
    expect(minBtn.textContent).toBe('▔');
    minBtn.dispatch('click');
    expect(els['drawer-container'].classes.has('minimized')).toBe(false);
    expect(els['tab-setup'].classes.has('active')).toBe(true);
  });

  it('swipe down minimizes and swipe up expands', () => {
    const fire = (type, y, x = 100) => tabs.dispatch(type, { clientY: y, clientX: x });
    fire('pointerdown', 400);
    fire('pointermove', 460, 105);
    fire('pointerup', 460, 105);
    expect(els['drawer-container'].classes.has('minimized')).toBe(true);
    fire('pointerdown', 400);
    fire('pointermove', 330, 105);
    fire('pointerup', 330, 105);
    expect(els['drawer-container'].classes.has('minimized')).toBe(false);
  });

  it('a short tap on the tabs does not toggle the drawer', () => {
    tabs.dispatch('pointerdown', { clientY: 400, clientX: 100 });
    tabs.dispatch('pointerup', { clientY: 405, clientX: 100 });
    expect(els['drawer-container'].classes.has('minimized')).toBe(false);
  });

  it('hide/show roundtrip restores a fully expanded drawer', () => {
    els['drawer-hide-btn'].dispatch('click');
    expect(els['drawer-container'].classes.has('hidden')).toBe(true);
    expect(els['drawer-show-btn'].hidden).toBe(false);
    els['drawer-show-btn'].dispatch('click');
    expect(els['drawer-container'].classes.has('hidden')).toBe(false);
    expect(els['drawer-container'].classes.has('minimized')).toBe(false);
    expect(els['tab-setup'].classes.has('active')).toBe(true);
  });
});
