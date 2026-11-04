/**
 * VEPA4 — sub-tab help navigation, sticky parameter popups, and the
 * tooltip/law-info legibility pass.
 *
 * Three user-facing defects are pinned here:
 *   1. A tab's help modal was a dead end — it explained the tab but offered no
 *      route to the sub-tab that was actually the question.
 *   2. The parameter popup vanished ~120 ms after release, so a long press
 *      flashed a wall of text and took it away before it could be read.
 *   3. Tooltip and law-info text was 8–11 px, and the system formula was
 *      rgba(255,255,255,0.35) on near-black (~3:1, below WCAG AA).
 *
 * vitest runs `environment: 'node'`, so the CSS and HTML assertions are
 * static-source checks rather than rendered-layout checks.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TAB_SUBTABS, subtabsForTab, helpForTab } from '../../src/ui/helpRegistry.js';
import * as OVERLAY from '../../src/ui/helpOverlay.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const STYLE = read('style.css');
const HTML = read('index.html');
const TOOLBAR_CSS = read('src/ui/toolbarHelp.css');
const PARAM_HELP_SRC = read('src/ui/paramHelp.js');
const OVERLAY_SRC = read('src/ui/helpOverlay.js');
const UI_SRC = read('src/ui/ui.js');

/* ── 1. Sub-tab buttons in the tab help modal ──────────────────────────── */

describe('TAB_SUBTABS', () => {
  it('covers all three drawer tabs', () => {
    for (const tab of ['tab-setup', 'tab-saves', 'tab-data']) {
      expect(Object.keys(TAB_SUBTABS), `${tab} must be declared`).toContain(tab);
    }
  });

  it('declares every tab in index.html', () => {
    // Both directions: a declared tab that no longer exists, and a button in
    // the markup with no nav entry, are both dead ends at runtime.
    const inHtml = [...HTML.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
    expect(inHtml.sort()).toEqual(Object.keys(TAB_SUBTABS).sort());
  });

  it('matches the sub-tab buttons in index.html, in both directions and in order', () => {
    const inHtml = [...HTML.matchAll(/data-sub="([^"]+)"/g)].map((m) => m[1]);
    const declared = Object.values(TAB_SUBTABS).flat();
    expect(declared.sort(), 'a sub-tab button has no nav entry').toEqual(inHtml.sort());
    // Display order matters: the nav is a substitute for the real sub-tab
    // strip, so it must read left-to-right the way the drawer does.
    expect(declared).toEqual(inHtml);
  });

  it('gives every declared sub-tab a help entry to drill into', () => {
    for (const id of Object.values(TAB_SUBTABS).flat()) {
      expect(helpForTab(id), `no help entry for ${id}`).not.toBeNull();
    }
  });

  it('returns a copy, so a caller cannot corrupt the frozen table', () => {
    const first = subtabsForTab('tab-data');
    first.push('data-bogus');
    expect(subtabsForTab('tab-data')).not.toContain('data-bogus');
  });

  it('returns an empty list for an unknown tab', () => {
    expect(subtabsForTab('tab-nonexistent')).toEqual([]);
  });

  it('has setup, data and saves all tabbed', () => {
    expect(subtabsForTab('tab-setup')).toEqual(['setup-laws', 'setup-world', 'setup-species', 'setup-settings']);
    expect(subtabsForTab('tab-data').length).toBe(6);
    // SAVES was flat until v9.1.29; it now carries its own three sub-tabs.
    expect(subtabsForTab('tab-saves')).toEqual(['saves-states', 'saves-undo', 'saves-io']);
  });
});

describe('the tab help modal offers its sub-tabs as buttons', () => {
  it('renders a nav element with one button per sub-tab plus a way back', () => {
    expect(OVERLAY_SRC).toMatch(/class="tab-help-nav"/);
    expect(OVERLAY_SRC).toMatch(/class="tab-help-nav-btn/);
    expect(OVERLAY_SRC).toMatch(/data-help-id=/);
  });

  it('shows the parent tab alongside its sub-tabs so the reader can go back', () => {
    // From setup-laws you must be able to return to SETUP, not only sideways.
    expect(OVERLAY_SRC).toMatch(/crumbs\.push\(\{ id: parentId/);
    expect(OVERLAY_SRC).toMatch(/current: parentId === currentId/);
  });

  it('marks the entry being viewed as current and gives it aria-current', () => {
    expect(OVERLAY_SRC).toMatch(/aria-current="true"/);
    expect(OVERLAY_SRC).toMatch(/' current'/);
  });

  it('re-renders in place instead of stacking an overlay per sub-tab', () => {
    // Drilling through four sub-tabs used to leave four modals behind.
    expect(OVERLAY_SRC).toMatch(/showHelpModal\(next, \{/);
    expect(OVERLAY_SRC).toMatch(/function closeHelpModal\(\)[\s\S]*?modalEl = null/);
  });

  it('escapes nav labels and ids', () => {
    expect(OVERLAY_SRC).toMatch(/esc\(c\.id\)/);
    expect(OVERLAY_SRC).toMatch(/esc\(c\.label\)/);
  });

  it('styles the nav and marks the current button', () => {
    expect(TOOLBAR_CSS).toMatch(/\.tab-help-nav\s*\{/);
    expect(TOOLBAR_CSS).toMatch(/\.tab-help-nav-btn\s*\{/);
    expect(TOOLBAR_CSS).toMatch(/\.tab-help-nav-btn\.current\s*\{/);
  });

  it('gives the nav buttons a visible keyboard focus state', () => {
    expect(TOOLBAR_CSS).toMatch(/\.tab-help-nav-btn:hover,\s*\n\.tab-help-nav-btn:focus-visible/);
  });
});

/* ── 2. Parameter popups stay open ─────────────────────────────────────── */

describe('the parameter popup stays open', () => {
  it('no longer hides on release', () => {
    // The old cancel() armed a 120ms hide timer, so the popup was gone before
    // it could be read.
    expect(PARAM_HELP_SRC).not.toMatch(/setTimeout\(\(\) => hideParamPopup\(\),\s*120\)/);
    expect(PARAM_HELP_SRC).toMatch(/cancel = \(\) => \{[\s\S]*?clearTimeout\(pressTimer\);/);
  });

  it('still cancels the pending long-press timer on release', () => {
    // Persistence must not break the other half of cancel: a press that ends
    // before 500ms must not open a popup.
    expect(PARAM_HELP_SRC).toMatch(/pointerup', cancel/);
    expect(PARAM_HELP_SRC).toMatch(/pointerleave', cancel/);
    expect(PARAM_HELP_SRC).toMatch(/pointercancel', cancel/);
  });

  it('registers on the dismissal bus with no exemption, so any tap closes it', () => {
    // The long press that opens the popup emits a pointerdown, but it arrives
    // 500ms *before* the popup exists and is consumed by the press timer, so
    // it never reaches the bus. That removed the only reason the old
    // `pressInsensitive` exemption existed — and with it the bug where the
    // popup survived every tap that followed.
    expect(PARAM_HELP_SRC).toMatch(/registerTooltip\(\{[\s\S]*?name: 'param-help'/);
    expect(PARAM_HELP_SRC).not.toMatch(/pressInsensitive/);
  });

  it('re-registers on every open, so a stale anchor cannot strand the popup', () => {
    // The bus exempts a press on the tooltip's own anchor. If the record kept
    // the anchor from the *first* long press, a tap on a different parameter
    // would be treated as a press on the anchor and the popup would survive it.
    expect(PARAM_HELP_SRC).toMatch(/if \(unregister\) unregister\(\);\s*unregister = registerTooltip\(/);
  });

  it('anchors itself to the label it describes', () => {
    expect(PARAM_HELP_SRC).toMatch(/anchor: anchorEl/);
  });

  it('unregisters when hidden so a stale anchor cannot be dismissed', () => {
    expect(PARAM_HELP_SRC).toMatch(/if \(unregister\) \{ unregister\(\); unregister = null; \}/);
  });

  it('offers an Escape hatch alongside tap-anywhere dismissal', () => {
    expect(PARAM_HELP_SRC).toMatch(/export function initParamHelpDismiss/);
    expect(PARAM_HELP_SRC).toMatch(/event\.key !== 'Escape'/);
    expect(PARAM_HELP_SRC).toMatch(/isParamPopupVisible\(\)/);
  });

  it('is wired from the UI bootstrap, not at import time', () => {
    expect(UI_SRC).toMatch(/initParamHelpDismiss/);
  });

  it('exposes a visibility seam the tests can assert against', () => {
    expect(PARAM_HELP_SRC).toMatch(/export function isParamPopupVisible/);
  });

  it('keeps the 500ms long-press threshold that opens it', () => {
    expect(PARAM_HELP_SRC).toMatch(/setTimeout\(\(\) => open\(e\), 500\)/);
  });
});

/* ── 3. Tooltip and law-info legibility ─────────────────────────────────── */

describe('tooltip font sizes', () => {
  it('raised the help-drone tip above the old 8/10px', () => {
    expect(TOOLBAR_CSS).toMatch(/\.help-drone-tip strong \{[^}]*font-size: 11px/);
    expect(TOOLBAR_CSS).toMatch(/\.help-drone-tip span \{[^}]*font-size: 13px/);
  });

  it('widened the drone tip, since bigger text needs room', () => {
    const block = TOOLBAR_CSS.match(/\.help-drone-tip\s*\{[^}]*\}/)[0];
    expect(block).toMatch(/width:\s*min\(330px/);
  });

  it('raised the tab-help tip sections', () => {
    expect(TOOLBAR_CSS).toMatch(/\.tab-help-tip-sections \.help-drone-section strong \{ font-size: 11px; \}/);
    expect(TOOLBAR_CSS).toMatch(/\.tab-help-tip-sections \.help-drone-section span \{ font-size: 12px; \}/);
  });

  it('raised the parameter popup type scale', () => {
    // base 13, title 16, key/range 12, label 11 — all read without zooming.
    const css = STYLE.slice(STYLE.indexOf('.param-help-popup {'));
    expect(css).toMatch(/\.param-help-popup \{[\s\S]*?font-size:\s*13px/);
    expect(css).toMatch(/\.php-title \{[\s\S]*?font-size:\s*16px/);
    expect(css).toMatch(/\.php-key \{[\s\S]*?font-size:\s*12px/);
    expect(css).toMatch(/\.php-range \{[\s\S]*?font-size:\s*12px/);
    expect(css).toMatch(/\.php-label \{[\s\S]*?font-size:\s*11px/);
  });

  it('widened the parameter popup to match the larger type', () => {
    const css = STYLE.slice(STYLE.indexOf('.param-help-popup {'));
    expect(css).toMatch(/max-width:\s*400px/);
  });

  it('no longer leaves the popup inheriting a colour through undefined --text', () => {
    const css = STYLE.slice(STYLE.indexOf('.param-help-popup {'));
    expect(css).toMatch(/color:\s*var\(--text-primary\)/);
  });
});

describe('law info contrast', () => {
  const rule = (sel) => STYLE.match(new RegExp(`\\.law-info-module ${sel} \\{[^}]*\\}`))?.[0] || '';

  it('no longer references the undefined --text custom property', () => {
    // `--text` is not declared anywhere in this codebase, so every
    // `color: var(--text)` was invalid and silently inherited — a real cause
    // of the low contrast, not just a missing declaration. Only real
    // declarations are checked; the comments that explain this say `var(--text)`.
    expect(STYLE).not.toMatch(/(^|[;{\s])color:\s*var\(--text\)/m);
  });

  it('declares only the text tokens it actually uses', () => {
    for (const token of ['--text-primary', '--text-secondary', '--text-dim']) {
      expect(STYLE).toMatch(new RegExp(`${token}:\\s*#`));
    }
  });

  it('makes the law info module roughly twice as tall with tighter padding', () => {
    const module = STYLE.match(/\.law-info-module \{[^}]*\}/)?.[0] || '';
    expect(module).toMatch(/height:\s*192px/);
    expect(module).toMatch(/padding:\s*4px 5px/);
  });

  it('raised every law-info tier to a legible size', () => {
    expect(rule('\\.info-title')).toMatch(/font-size:\s*15px/);
    expect(rule('\\.info-category')).toMatch(/font-size:\s*11px/);
    expect(rule('\\.info-hint')).toMatch(/font-size:\s*13px/);
    expect(rule('\\.info-explanation')).toMatch(/font-size:\s*12px/);
    expect(rule('\\.info-system')).toMatch(/font-size:\s*11px/);
    expect(rule('\\.info-advanced')).toMatch(/font-size:\s*12px/);
  });

  it('no longer renders the system formula in the 0.35-alpha grey that failed AA', () => {
    // Scoped to the law-info rules so the comment recording the old value, and
    // unrelated decorative translucency elsewhere, do not trip this.
    for (const sel of ['\\.info-hint', '\\.info-explanation', '\\.info-system', '\\.info-advanced']) {
      expect(rule(sel), sel).not.toMatch(/rgba\(255,\s*255,\s*255,\s*0\.35\)/);
      // Every law-info tier now uses a real token at full or near-full opacity.
      expect(rule(sel), sel).toMatch(/color:\s*var\(--text-(primary|secondary)\)/);
    }
  });

  it('bolds the category label so it reads as a header, not body text', () => {
    expect(rule('\\.info-category')).toMatch(/font-weight:\s*bold/);
  });

  it('restores the hover colour on the close button', () => {
    expect(rule('\\.info-close:hover')).toMatch(/color:\s*var\(--text-primary\)/);
  });

  it('documents why the contrast changed, so it is not "tidied" back', () => {
    expect(STYLE).toMatch(/WCAG AA/);
  });
});

/* ── Cross-cutting invariants ───────────────────────────────────────────── */

describe('exports referenced by the tests exist', () => {
  it('helpOverlay still exports its public surface', () => {
    for (const name of ['showHelpModal', 'closeHelpModal', 'hideHelpTooltip']) {
      expect(typeof OVERLAY[name], name).toBe('function');
    }
  });

  it('the data sub-tab button no longer claims to be "Civilizations"', () => {
    // The panel was renamed to GROUPS; a stale title is the kind of drift the
    // nav buttons make very visible.
    expect(HTML).toMatch(/data-sub="data-groups" title="Groups/);
  });
});
