import { describe, it, expect, beforeEach } from 'vitest';
import { makeEl, installDom } from '../helpers/domStub.js';

let els, allTabBtns, allContents;

/**
 * The drawer's shape, built on the shared stub.
 *
 * setupTabSwitching now walks the real tree (a strip, its buttons, the sibling
 * panels) rather than querying globally, so the double has to have that shape
 * or the wiring is never exercised and the test passes by proving nothing.
 */
function installFakeDom() {
  const doc = installDom();
  els = {};
  ['drawer-container', 'drawer-minimize-btn', 'drawer-hide-btn', 'drawer-show-btn', 'tab-setup', 'tab-data', 'setup-laws', 'setup-world']
    .forEach((id) => {
      els[id] = makeEl('div', doc);
      els[id].setAttribute('id', id);
    });
  els['drawer-container'].classes.add('active');
  const handle = makeEl('div', doc);
  const setupBtn = makeEl('button', doc);
  setupBtn.dataset.tab = 'tab-setup';
  setupBtn.classes.add('tab-btn', 'active');
  const dataBtn = makeEl('button', doc);
  dataBtn.dataset.tab = 'tab-data';
  dataBtn.classes.add('tab-btn');
  // Drawer control buttons share .tab-btn but carry no data-tab
  const minBtn = els['drawer-minimize-btn'];
  minBtn.classes.add('tab-btn');
  const hideBtn = els['drawer-hide-btn'];
  hideBtn.classes.add('tab-btn');
  const zoomBtn = makeEl('button', doc);
  zoomBtn.classes.add('tab-btn');
  allTabBtns = [setupBtn, dataBtn, minBtn, hideBtn, zoomBtn];
  els['tab-setup'].classes.add('tab-content', 'active');
  els['tab-data'].classes.add('tab-content');
  allContents = [els['tab-setup'], els['tab-data']];

  const mainPanel = makeEl('div', doc);
  mainPanel.setAttribute('id', 'main-panel');
  const tabs = makeEl('div', doc);
  tabs.setAttribute('id', 'main-panel-tabs');
  tabs.classes.add('tabs');
  for (const btn of allTabBtns) tabs.appendChild(btn);
  for (const panel of allContents) mainPanel.appendChild(panel);
  mainPanel.appendChild(tabs);
  mainPanel.appendChild(handle);
  mainPanel.appendChild(els['drawer-container']);
  // The show button lives outside the drawer in the real layout; here it only
  // has to be reachable by id, or setupDrawerHideShow bails and the hide/show
  // round trip is never wired.
  mainPanel.appendChild(els['drawer-show-btn']);
  els['drawer-container'].parentElement = mainPanel;
  doc.body.appendChild(mainPanel);

  globalThis.document = {
    ...doc,
    // setupTabSwitching asks for the strip by id; the id is namespaced in the
    // stub to keep it distinct from the `tabs` variable, so alias it here.
    querySelector: (sel) => (sel === '#main-panel .tabs' ? tabs : doc.querySelector(sel)),
    querySelectorAll: (sel) => {
      if (sel === '#main-panel .tabs, #drawer-resize-handle') return [tabs, handle];
      return doc.querySelectorAll(sel);
    },
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

  it('exposes the strip as a tablist, not a row of loose buttons', () => {
    expect(tabs.getAttribute('role')).toBe('tablist');
    for (const btn of allTabBtns.filter((b) => b.dataset.tab)) {
      expect(btn.getAttribute('role')).toBe('tab');
      expect(btn.getAttribute('aria-controls')).toBe(btn.dataset.tab);
    }
    expect(els['tab-setup'].getAttribute('role')).toBe('tabpanel');
  });

  it('keeps the strip to one tab stop with a roving tabindex', () => {
    // Two real tabs means two Tab presses if roving fails; it must be one.
    const real = allTabBtns.filter((b) => b.dataset.tab);
    allTabBtns.find((b) => b.dataset.tab === 'tab-data').dispatch('click');
    expect(real.find((b) => b.dataset.tab === 'tab-data').tabIndex).toBe(0);
    expect(real.find((b) => b.dataset.tab === 'tab-setup').tabIndex).toBe(-1);
  });

  it('mirrors selection into aria-selected, so state is not colour-only', () => {
    const dataBtn = allTabBtns.find((b) => b.dataset.tab === 'tab-data');
    const setupBtn = allTabBtns.find((b) => b.dataset.tab === 'tab-setup');
    dataBtn.dispatch('click');
    expect(dataBtn.getAttribute('aria-selected')).toBe('true');
    expect(setupBtn.getAttribute('aria-selected')).toBe('false');
  });

  it('moves between tabs with the arrow keys and wraps', () => {
    const setupBtn = allTabBtns.find((b) => b.dataset.tab === 'tab-setup');
    const dataBtn = allTabBtns.find((b) => b.dataset.tab === 'tab-data');
    let prevented = 0;
    setupBtn.dispatch('keydown', { key: 'ArrowRight', preventDefault: () => { prevented += 1; } });
    expect(dataBtn.focused).toBe(1);
    expect(els['tab-data'].classes.has('active')).toBe(true);
    // Wrapping back past the end returns to the first tab rather than stopping.
    dataBtn.dispatch('keydown', { key: 'ArrowRight', preventDefault: () => { prevented += 1; } });
    expect(setupBtn.focused).toBe(1);
    expect(prevented).toBe(2);
  });

  it('jumps to the ends with Home and End', () => {
    const setupBtn = allTabBtns.find((b) => b.dataset.tab === 'tab-setup');
    const dataBtn = allTabBtns.find((b) => b.dataset.tab === 'tab-data');
    setupBtn.dispatch('keydown', { key: 'End', preventDefault: () => {} });
    expect(dataBtn.focused).toBe(1);
    dataBtn.dispatch('keydown', { key: 'Home', preventDefault: () => {} });
    expect(setupBtn.focused).toBe(1);
  });

  it('leaves other keys alone', () => {
    const setupBtn = allTabBtns.find((b) => b.dataset.tab === 'tab-setup');
    let prevented = 0;
    setupBtn.dispatch('keydown', { key: 'a', preventDefault: () => { prevented += 1; } });
    expect(prevented).toBe(0);
    expect(setupBtn.focused).toBe(0);
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
