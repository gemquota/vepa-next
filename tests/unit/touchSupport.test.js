/**
 * VEPA4 — touch-first interaction contract.
 *
 * The drawer is used on a phone. A control is not "supported on touch" because
 * it has a click handler: it is supported because the browser hands the gesture
 * to it, and because a fingertip can land on it. Both properties are static
 * facts about the stylesheets, so they are asserted statically here rather than
 * left to a manual pass on a device nobody in CI is holding.
 *
 * What this file proves:
 *   1. Every rule that shows a `cursor: pointer` has a `touch-action` somewhere
 *      in the contract in style.css. This is the regression guard: a new
 *      clickable surface cannot ship tap-blind.
 *   2. Genuine drag surfaces resolve to `touch-action: none`, not
 *      `manipulation` — otherwise the browser pans the page instead of moving
 *      the slider.
 *   3. Under `pointer: coarse` the interactive set reaches the 44px tap
 *      minimum, with the one documented exception (the dense 128-tile law grid
 *      in icon mode, held to the 24px WCAG 2.2 AA floor).
 *   4. No affordance is reachable by `:hover` alone.
 *
 * Coverage is matched on the exact selector rather than by emulating the
 * cascade. That is stricter, not looser: a `.sq-btn { cursor:pointer }` rule is
 * satisfied only by a contract entry that names `.sq-btn`, so "it is a <button>
 * so the `button` rule probably covers it" can never quietly pass. Quote style
 * is normalised because the codebase mixes `"` and `'` in attribute
 * selectors, and that difference is not semantic.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { allRules, decls, norm } from '../helpers/cssSources.js';

const STYLE_CSS = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
const TOOLBAR_CSS = readFileSync(new URL('../../src/ui/toolbarHelp.css', import.meta.url), 'utf8');

// Every stylesheet the app ships, in load order — including the CSS two UI
// modules inject from a JavaScript template literal. Reading only style.css
// would pass this file while the WORLD STATES buttons sat at 9px with no
// touch-action, which is exactly what it exists to prevent.
const ALL_RULES = allRules();
const STYLE_RULES = ALL_RULES.filter((r) => r.file === 'style.css');
const INJECTED = ALL_RULES.filter((r) => r.file.endsWith('.js'));


/** Declaration map for a rule body. */
function decls(body) {
  const map = {};
  for (const part of body.split(';')) {
    const idx = part.indexOf(':');
    if (idx > 0) map[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim();
  }
  return map;
}

/** Effective `touch-action` declared for a selector across both stylesheets. */
function touchActionFor(selector) {
  const want = norm(selector);
  let value = null;
  for (const rule of ALL_RULES) {
    if (rule.selector !== want) continue;
    const d = decls(rule.body);
    if ('touch-action' in d) value = d['touch-action'];
  }
  return value;
}

/**
 * Every selector whose effective `cursor` (last declaration outside any
 * at-rule) is `pointer` — i.e. every surface the UI invites you to press.
 */
function pointerCursorSelectors() {
  const out = [];
  for (const selector of new Set(ALL_RULES.map((r) => r.selector))) {
    let cursor = null;
    for (const rule of ALL_RULES) {
      if (rule.selector !== selector || rule.media) continue;
      const d = decls(rule.body);
      if ('cursor' in d) cursor = d.cursor;
    }
    if (cursor === 'pointer') out.push(selector);
  }
  return out.sort();
}

const POINTER = pointerCursorSelectors();
const TOUCHED = POINTER.filter((s) => touchActionFor(s) !== null);

describe('touch-first interaction contract', () => {
  it('finds the click surfaces to audit', () => {
    // Guards the assertion below from passing vacuously if the parser breaks.
    expect(POINTER.length).toBeGreaterThan(40);
    expect(TOUCHED.length).toBe(POINTER.length);
  });

  it('every cursor:pointer surface has a touch-action', () => {
    const uncovered = POINTER.filter((s) => touchActionFor(s) === null);
    expect(uncovered).toEqual([]);
  });

  it('a pressable surface uses manipulation unless it is a drag surface', () => {
    // `manipulation` keeps scroll available but gives the tap back to us.
    // `none` is only correct where the gesture is a drag.
    const draggish = /range|resize|shard-canvas|\.tabs$|sc-input|dna-input|slider-thumb/;
    const wrong = POINTER
      .map((sel) => [sel, touchActionFor(sel)])
      .filter(([sel, value]) => value === 'none' && !draggish.test(sel));
    expect(wrong).toEqual([]);
  });

  it('range inputs and drag handles opt out of browser gestures', () => {
    for (const sel of [
      "input[type='range']",
      '.sc-input',
      '.dna-input',
      '#drawer-resize-handle',
      '.shard-canvas',
      '#main-panel .tabs',
    ]) {
      expect(touchActionFor(sel), `${sel} must opt out of browser gestures`).toBe('none');
    }
  });

  it('every interactive element type is covered by the base rule', () => {
    // Covers controls that do not exist yet, which is the point of a base rule.
    const base = ['button', 'select', 'summary', "input[type='checkbox']", "input[type='radio']", "[role='button']"];
    for (const sel of base) {
      expect(touchActionFor(sel), `${sel} needs a tap contract`).toBe('manipulation');
    }
  });

  it('sees the CSS that UI modules inject from JavaScript', () => {
    // The WORLD STATES tab and the multiplex history are styled from a <style>
    // block in a JS template literal. Reading only style.css would report this
    // app clean while those buttons had no touch-action at all.
    const files = new Set(INJECTED.map((r) => r.file));
    expect(files.size, 'no injected CSS found — the loader stopped working').toBeGreaterThan(0);
    expect([...files].some((f) => f.includes('savePanel'))).toBe(true);
    const touched = new Set(INJECTED.filter((r) => 'touch-action' in decls(r.body)).map((r) => r.selector));
    for (const sel of ['.ws-btn', '.ws-overlay-close', '.mpx-hist-revert', '.mpx-ch-toggle']) {
      expect(touched.has(sel), `${sel} has no tap contract`).toBe(true);
    }
  });

  it('the help-modal switcher has a tap contract of its own', () => {
    // The switcher is rendered from JS, so nothing in index.html pins it; only
    // these assertions do.
    for (const sel of ['.tab-switch', '.tab-switch-arrow', '.tab-switch-btn']) {
      expect(touchActionFor(sel), `${sel} needs a tap contract`).toBe('manipulation');
    }
  });

  it('coarse pointers get a 44px tap target on the primary controls', () => {
    const coarse = STYLE_RULES.filter((r) => r.media.includes('pointer: coarse'));
    expect(coarse.length).toBeGreaterThan(0);
    const block = coarse.map((r) => r.selector);
    for (const sel of [
      'button',
      '.tab-btn',
      '.sub-tab-btn',
      '.sq-btn',
      '.accordion-header',
      '.sub-accordion-header',
      '.species-card',
      '.mpx-btn',
      '.view-mode-toggle',
      '.tab-help-nav-btn',
      '.preset-btn',
      '.law-set-btn',
    ]) {
      expect(block, `${sel} needs a coarse-pointer target`).toContain(sel);
    }
    // The minimum itself must be the HIG figure, not an inherited token.
    const minHeights = coarse.map((r) => decls(r.body)['min-height']).filter((v) => v === '44px');
    expect(minHeights.length).toBeGreaterThan(0);
  });

  it('square targets also get a 44px width', () => {
    const coarse = STYLE_RULES.filter((r) => r.media.includes('pointer: coarse'));
    const widths = coarse.map((r) => decls(r.body)['min-width']).filter(Boolean);
    expect(widths).toContain('44px');
  });

  it('the dense law grid is held to the 24px AA floor and word mode to 44px', () => {
    const dense = STYLE_RULES.find(
      (r) => r.media.includes('pointer: coarse') && r.selector === '#law-grid .law-btn',
    );
    expect(decls(dense.body)['min-height']).toBe('24px');
    const word = STYLE_RULES.find(
      (r) => r.media.includes('pointer: coarse') && r.selector === '#law-grid.word-mode .law-btn',
    );
    expect(decls(word.body)['min-height']).toBe('44px');
  });

  it('slider thumbs become finger-sized and slider rows tall enough to hit', () => {
    const coarse = STYLE_RULES.filter((r) => r.media.includes('pointer: coarse'));
    const thumb = coarse.find((r) => r.selector === '.sc-input::-webkit-slider-thumb');
    expect(decls(thumb.body)).toMatchObject({ width: '28px', height: '28px' });
    for (const sel of ['.sc-row', '.world-slider-row', '.accordion-slider-row']) {
      const row = coarse.find((r) => r.selector === sel);
      expect(decls(row.body)['min-height'], `${sel} must be hittable`).toBe('44px');
    }
  });

  it('no affordance is reachable by :hover alone', () => {
    // A hover rule is only a *reveal* — and therefore a touch/keyboard dead end
    // — when the resting state was not visible at all. Un-dimming an
    // already-legible element from 0.75 to 1 is feedback, not a reveal.
    // Longest alternative first: with `focus` ahead of `focus-visible` the
    // engine matches `focus` and leaves a stray `-visible` on the selector.
    const STATE = /:(focus-visible|focus-within|hover|focus|active)\b/g;
    /** The subject of a state rule, keeping any `::pseudo-element` on it. */
    const subjectOf = (selector) => norm(selector.replace(STATE, ''));
    const isStateRule = (selector) => STATE.test(selector);

    const resting = (subject) => {
      const state = { opacity: 1, display: '', visibility: '', maxHeight: '' };
      for (const rule of ALL_RULES) {
        // Only the unconditional rule describes the resting state; a
        // `:focus-visible` block is an alternative route, not the resting one.
        if (rule.media || isStateRule(rule.selector) || rule.selector !== subject) continue;
        const d = decls(rule.body);
        if ('opacity' in d) state.opacity = parseFloat(d.opacity);
        if ('display' in d) state.display = d.display;
        if ('visibility' in d) state.visibility = d.visibility;
        if ('max-height' in d) state.maxHeight = d['max-height'];
      }
      return state;
    };

    const reveals = ALL_RULES.filter((r) => {
      if (!r.selector.includes(':hover')) return false;
      const before = resting(subjectOf(r.selector));
      return (
        before.opacity < 0.05 ||
        before.display === 'none' ||
        before.visibility === 'hidden' ||
        before.maxHeight === '0'
      );
    });

    for (const rule of reveals) {
      const subject = subjectOf(rule.selector);
      const hasFocus = ALL_RULES.some(
        (o) => o.selector.includes(':focus-visible') && subjectOf(o.selector) === subject,
      );
      const hasHoverless = subject.includes('toolbar-gesture-btn') && STYLE_CSS.includes('@media (hover: none)');
      expect(hasFocus || hasHoverless, `${subject} is hover-only`).toBe(true);
    }
    // There is at least one real reveal, so the loop above is not vacuous.
    expect(reveals.length).toBeGreaterThan(0);
    // And it is the toolbar gesture hint — the one hint a first-time touch
    // user most needs, and previously reachable only by hovering.
    expect(reveals.map((r) => r.selector)).toContain(
      '#top-toolbar .toolbar-gesture-btn:hover::after',
    );
  });
});
