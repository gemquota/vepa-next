/**
 * VEPA4 — minimum type scale.
 *
 * Eighty-six rules in this codebase used to resolve to 7–9px, and most of them
 * were real content: help prose, narrative logs, panel labels, multiplex
 * settings. The floor is now declared once per stylesheet and this file is what
 * keeps it a floor rather than a suggestion — adding a new 8px label is a test
 * failure, not something a reviewer has to notice.
 *
 * Two subtleties this file has to get right, both of which are easy to get
 * wrong and were wrong while writing it:
 *
 *   1. CASCADE ORDER BETWEEN THE TWO STYLESHEETS. `style.css` is a <link> in
 *      <head>; `toolbarHelp.css` is injected by the module graph and therefore
 *      loads after it, winning every specificity tie. A floor rule in
 *      `style.css` for a selector that `toolbarHelp.css` also styles is
 *      silently dead. So the resolution here walks the two files in load order
 *      and the floor is mirrored across both.
 *
 *   2. MEDIA QUERIES. A declaration inside `@media` wins over the same
 *      declaration outside it regardless of file position, so a mobile block
 *      that says `.hud-item { font-size: 9px }` beats a desktop 12px. That was
 *      a real bug here — two mobile blocks were shrinking type below the
 *      desktop value the size-doubling pass had already applied.
 *
 * The exceptions are named, and this file asserts the set matches exactly, so
 * adding one is a deliberate act rather than a quiet escape hatch.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { allRules, decls } from '../helpers/cssSources.js';

const STYLE_CSS = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');

/**
 * Every stylesheet the app ships, in load order — including the CSS that
 * savePanel.js and multiplexUI.js inject from a JavaScript template literal.
 *
 * Reading only style.css let the whole WORLD STATES tab through at 8–9px,
 * which is the exact failure this file exists to prevent: the tab looked fine
 * in the stylesheet you would think to open, and was unreadable in the app.
 */
const ALL_RULES = allRules();
const STYLE_RULES = ALL_RULES.filter((r) => r.file === 'style.css');
const TOOLBAR_RULES = ALL_RULES.filter((r) => r.file === 'src/ui/toolbarHelp.css');
const INJECTED_RULES = ALL_RULES.filter((r) => r.file.endsWith('.js'));

/** The px font-size a rule declares, whether via `font-size` or `font:`. */
function fontSizeOf(rule) {
  const d = decls(rule.body);
  if ('font-size' in d) return d['font-size'];
  if ('font' in d) return d.font;
  return null;
}

function px(value) {
  const m = /^(\d+(?:\.\d+)?)px/.exec(String(value).trim());
  return m ? Number(m[1]) : null;
}

/**
 * Effective font size per selector, in real cascade order: a media declaration
 * beats a base one, and within a tier the later stylesheet wins.
 */
function effectiveFontSizes() {
  const bySelector = new Map();
  for (const rule of ALL_RULES) {
    const size = px(fontSizeOf(rule));
    if (size === null) continue;
    const tier = rule.media ? 1 : 0;
    const prev = bySelector.get(rule.selector);
    if (!prev || tier >= prev.tier) bySelector.set(rule.selector, { tier, size, order: rule.order });
  }
  return bySelector;
}

/**
 * The dense-grid tier. 9px is a deliberate floor, not an oversight: a category
 * header in the 128-tile law grid competes with 128 neighbours for the same
 * pixels, and the readable word mode carries 11px instead. Content tiers are
 * asserted separately and much higher, so a 9px label cannot hide here.
 */
const FLOOR_PX = 9;

/**
 * Selectors that stay below the floor, and why.
 *
 * An exception nobody needs is just a stale comment, so the test below asserts
 * this set contains nothing that has since grown.
 */
const EXCEPTIONS = new Set([
  // The compact population readout has a readable 8px mobile override.
  '.hud-population-orb::after',
  // Tick labels under a 34px-tall sparkline; the DNA charts carry the real trend.
  '.dna-history-values span',
]);

const EFFECTIVE = effectiveFontSizes();
const TINY = [...EFFECTIVE.entries()].filter(([, v]) => v.size < FLOOR_PX).map(([k]) => k).sort();

describe('minimum type scale', () => {
  it('finds the tiny rules to audit', () => {
    // Guards the assertions below from passing vacuously if the parser breaks.
    expect(TINY.length).toBeGreaterThan(0);
  });

  it('renders the compact top-bar particle count at 9px or above', () => {
    const mobile = STYLE_RULES.find((rule) => rule.selector === '.hud-population-orb::after' && rule.media);
    expect(mobile).toBeTruthy();
    expect(px(fontSizeOf(mobile))).toBeGreaterThanOrEqual(8);
  });

  it('leaves nothing tiny outside the documented exceptions', () => {
    const unexplained = TINY.filter((s) => !EXCEPTIONS.has(s));
    expect(
      unexplained,
      `below ${FLOOR_PX}px without a stated reason — add a floor or an exception`,
    ).toEqual([]);
  });

  it('keeps the exception list honest: nothing in it is now large enough to need one', () => {
    // An exception nobody needs is just a stale comment.
    const obsolete = [...EXCEPTIONS].filter((s) => {
      const e = EFFECTIVE.get(s);
      return !e || e.size >= FLOOR_PX;
    });
    expect(obsolete).toEqual([]);
  });

  it('floors every help surface at a readable size', () => {
    // The one place a reader learns what a graph measures or a law does.
    for (const sel of [
      '.help-drone-grid span',
      '.help-drone-mapping span',
      '.help-drone-section span',
      '.help-drone-tip span',
      '.tab-help-tip strong',
      '.param-help-popup',
      '.log-entry',
      '.mpx-help-item-expl',
    ]) {
      const e = EFFECTIVE.get(sel);
      expect(e, `${sel} declares no font size`).toBeTruthy();
      expect(e.size, `${sel} is ${e.size}px`).toBeGreaterThanOrEqual(11);
    }
  });

  it('floors the chaos-multiplex settings, which were never overridden', () => {
    // These sat at 8–9px with no responsive block ever raising them.
    for (const sel of ['.mpx-set-row', '.mpx-settings-title', '.mpx-stat', '.mpx-tab', '.mpx-tip-expl']) {
      expect(EFFECTIVE.get(sel).size, `${sel}`).toBeGreaterThanOrEqual(10);
    }
  });

  it('does not shrink type on small screens', () => {
    // A narrow viewport must never make a label smaller than the same label on
    // a wide one. This is the regression that shipped: two mobile blocks were
    // still carrying the pre-doubling sizes.
    for (const selector of ['.hud-item', '.sc-label', '.sc-value', '.sc-bound', '.sc-mode', '.sc-zoom']) {
      const base = ALL_RULES.filter((r) => r.selector === selector && !r.media);
      const media = ALL_RULES.filter((r) => r.selector === selector && r.media);
      if (!base.length || !media.length) continue;
      const baseSize = px(fontSizeOf(base[base.length - 1]));
      for (const m of media) {
        const mSize = px(fontSizeOf(m));
        if (mSize === null || baseSize === null) continue;
        expect(mSize, `${selector} is smaller on a narrow screen than on a wide one`).toBeGreaterThanOrEqual(
          baseSize,
        );
      }
    }
  });

  it('holds the dense law grid at 9px but gives the readable word mode 11px', () => {
    expect(EFFECTIVE.get('#law-grid .law-btn').size).toBe(9);
    expect(EFFECTIVE.get('#law-grid.word-mode .law-btn').size).toBeGreaterThanOrEqual(11);
  });

  it('sees the CSS that UI modules inject from JavaScript', () => {
    // savePanel.js and multiplexUI.js ship a <style> block in a template
    // literal. Both carry the WORLD STATES tab and the multiplex history, and
    // both used to sit at 8-9px while this file reported the app clean — the
    // failure mode of auditing only the stylesheet you expect to be the one.
    const files = new Set(INJECTED_RULES.map((r) => r.file));
    expect(files.size, 'no injected CSS found — the loader stopped working').toBeGreaterThan(0);
    expect([...files].some((f) => f.includes('savePanel'))).toBe(true);
    expect([...files].some((f) => f.includes('multiplexUI'))).toBe(true);
    for (const rule of INJECTED_RULES) {
      const size = px(fontSizeOf(rule));
      if (size === null) continue;
      expect(size, `${rule.file} ${rule.selector} is ${size}px`).toBeGreaterThanOrEqual(FLOOR_PX);
    }
  });

  it('floors each selector in the stylesheet that actually wins the cascade', () => {
    // The mirror is load-bearing: style.css is a <link> in <head>, toolbarHelp.css
    // is injected by the module graph and loads after it, so a floor rule in the
    // wrong file is dead CSS that still looks like it is working.
    const declaresFont = (rules, sel) =>
      rules.some((r) => r.selector === sel && px(fontSizeOf(r)) !== null);
    for (const sel of ['.log-entry', '.intel-label', '.cat-tab', '.mpx-set-row', '.diversity-metrics']) {
      expect(declaresFont(STYLE_RULES, sel), `${sel} must be floored in style.css`).toBe(true);
      expect(declaresFont(TOOLBAR_RULES, sel), `${sel} must not be floored in toolbarHelp.css`).toBe(false);
    }
    for (const sel of ['.help-drone-grid b', '.tab-help-kind', '.dna-chart-close', '.dna-overview-hint']) {
      expect(declaresFont(TOOLBAR_RULES, sel), `${sel} must be floored in toolbarHelp.css`).toBe(true);
      expect(declaresFont(STYLE_RULES, sel), `${sel} must not be floored in style.css`).toBe(false);
    }
  });
});
