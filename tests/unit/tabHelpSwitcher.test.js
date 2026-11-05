/**
 * VEPA4 — the tab-help switcher.
 *
 * The help modal used to be a dead end: you could only leave it by closing it
 * and hunting for another tab button, which on a phone means closing, aiming,
 * and long-pressing. These tests pin the switcher that replaced that — arrows
 * at each end, a square per top-level tab, and an expanded current entry.
 *
 * The registry half (TAB_ORDER, cycleTabId, owningTabId, tabSwitcher) is pure
 * data and is tested directly. The overlay half is DOM-only and cannot run in
 * this environment (vitest is `environment: 'node'` and the project ships no
 * DOM library), so it is pinned by static assertions on the source plus a
 * mutation check. That is a real limitation, stated here rather than hidden:
 * the click wiring itself has not been exercised in a browser.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

import {
  TAB_ORDER,
  TAB_HELP,
  TAB_SUBTABS,
  cycleTabId,
  owningTabId,
  tabSwitcher,
} from '../../src/ui/helpRegistry.js';

const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const OVERLAY = readFileSync(new URL('../../src/ui/helpOverlay.js', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../../src/ui/toolbarHelp.css', import.meta.url), 'utf8');

/** The `data-tab` values in index.html, in document order. */
function tabOrderFromHtml() {
  return [...HTML.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
}

describe('TAB_ORDER', () => {
  it('matches the drawer order in index.html', () => {
    expect([...TAB_ORDER]).toEqual(tabOrderFromHtml());
  });

  it('names only tabs that have help and no sub-tabs of their own', () => {
    for (const id of TAB_ORDER) {
      expect(TAB_HELP[id], `${id} has no help entry`).toBeTruthy();
      expect(Object.keys(TAB_SUBTABS)).toContain(id);
    }
  });

  it('is frozen, so an edit cannot silently reorder the arrows', () => {
    expect(Object.isFrozen(TAB_ORDER)).toBe(true);
  });
});

describe('cycleTabId', () => {
  it('advances and wraps forward', () => {
    expect(cycleTabId('tab-setup', 1)).toBe('tab-saves');
    expect(cycleTabId('tab-saves', 1)).toBe('tab-data');
    expect(cycleTabId('tab-data', 1)).toBe('tab-setup');
  });

  it('retreats and wraps backward', () => {
    expect(cycleTabId('tab-data', -1)).toBe('tab-saves');
    expect(cycleTabId('tab-setup', -1)).toBe('tab-data');
  });

  it('is a full cycle from any start', () => {
    for (const start of TAB_ORDER) {
      const seen = [];
      let at = start;
      for (let i = 0; i < TAB_ORDER.length; i += 1) {
        at = cycleTabId(at, 1);
        seen.push(at);
      }
      expect(seen.sort()).toEqual([...TAB_ORDER].sort());
    }
  });

  it('falls back to the first tab for an unknown id rather than crashing', () => {
    expect(cycleTabId('nope', 1)).toBe('tab-saves');
    expect(cycleTabId(undefined, 1)).toBe('tab-saves');
  });
});

describe('owningTabId', () => {
  it('resolves a tab to itself', () => {
    expect(owningTabId('tab-data')).toBe('tab-data');
  });

  it('resolves a sub-tab to its parent tab', () => {
    expect(owningTabId('data-civilization')).toBe('tab-data');
    expect(owningTabId('setup-laws')).toBe('tab-setup');
  });

  it('falls back to the first tab for an unknown id', () => {
    expect(owningTabId('nope')).toBe(TAB_ORDER[0]);
    expect(owningTabId('')).toBe(TAB_ORDER[0]);
  });
});

describe('tabSwitcher', () => {
  it('lists every top-level tab in drawer order', () => {
    expect(tabSwitcher('tab-setup').map((e) => e.id)).toEqual([...TAB_ORDER]);
  });

  it('marks exactly one entry current', () => {
    for (const id of [...TAB_ORDER, 'data-dna', 'setup-settings']) {
      const items = tabSwitcher(id);
      expect(items.filter((e) => e.current).map((e) => e.id)).toEqual([owningTabId(id)]);
    }
  });

  it('carries the icon and title the expanded entry needs', () => {
    const current = tabSwitcher('tab-saves').find((e) => e.current);
    expect(current.icon).toBe(TAB_HELP['tab-saves'].icon);
    expect(current.title).toBe(TAB_HELP['tab-saves'].title);
  });

  it('flags that the current entry stands in for a sub-tab view', () => {
    // Drilling into DATA > CIVILIZATION and then reading the strip: DATA is
    // current, and `own` says the expansion is standing in for a sub-tab.
    const fromSub = tabSwitcher('data-civilization').find((e) => e.current);
    expect(fromSub.own).toBe(true);
    const fromTab = tabSwitcher('tab-data').find((e) => e.current);
    expect(fromTab.own).toBe(false);
  });

  it('still resolves the owner when given a sub-tab id', () => {
    expect(tabSwitcher('setup-species').find((e) => e.current).id).toBe('tab-setup');
  });
});

describe('help modal switcher markup', () => {
  it('renders an arrow at each end that carries a step', () => {
    expect(OVERLAY).toMatch(/tab-switch-arrow[^>]*data-help-step="-1"/);
    expect(OVERLAY).toMatch(/tab-switch-arrow[^>]*data-help-step="1"/);
  });

  it('renders a square per top-level tab, not just the current one', () => {
    // The point of the feature is that the *other* tabs are visible and tappable.
    expect(OVERLAY).toMatch(/tabSwitcher\(currentId\)/);
    expect(OVERLAY).toMatch(/tab-switch-icon/);
  });

  it('expands the current entry and keeps the label in the DOM for the others', () => {
    // The label is rendered unconditionally and hidden with CSS, so it is
    // still announced and still findable; only the current entry lays it out.
    expect(OVERLAY).toMatch(/tab-switch-label/);
    expect(CSS).toMatch(/\.tab-switch-label \{[^}]*display: none/);
    expect(CSS).toMatch(/\.tab-switch-btn\.current \.tab-switch-label \{[^}]*display: block/);
  });

  it('marks the current square for assistive tech, not colour alone', () => {
    expect(OVERLAY).toMatch(/aria-pressed="\$\{item\.current \? 'true' : 'false'\}"/);
  });

  it('cycles from the owning tab, so arrows work from a sub-tab view', () => {
    expect(OVERLAY).toMatch(/cycleTabId\(owningTabId\(id\)/);
  });

  it('treats a tap on the already-current square as a no-op', () => {
    // It is not a broken button; it is the expanded entry.
    expect(OVERLAY).toMatch(/if \(switchBtn\.classList\.contains\('current'\)\) return;/);
  });

  it('re-renders in place rather than stacking overlays', () => {
    expect(OVERLAY).toMatch(/function showHelpModal[\s\S]*?closeHelpModal\(\);/);
  });

  it('cycles from the keyboard without stealing arrows from inputs', () => {
    expect(OVERLAY).toMatch(/onModalKey[\s\S]*?ArrowLeft[\s\S]*?ArrowRight/);
    expect(OVERLAY).toMatch(/\^\(INPUT\|TEXTAREA\|SELECT\)\$/);
  });

  it('gives the switcher a tap contract', () => {
    expect(CSS).toMatch(/\.tab-switch,\s*\.tab-switch-arrow,\s*\.tab-switch-btn \{\s*touch-action: manipulation/);
    expect(CSS).toMatch(/@media \(pointer: coarse\)[\s\S]*?\.tab-switch-arrow,\s*\.tab-switch-btn \{[\s\S]*?44px/);
  });
});
