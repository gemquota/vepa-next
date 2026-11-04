/**
 * VEPA4 — HTML escaping.
 *
 * The panels build their DOM with template literals, so everything a
 * simulation, a preset file or a saved world produces is interpolated into
 * `innerHTML`. Escaping is therefore a correctness surface, and it used to be
 * four private copies of the same helper in the UI modules — three of which
 * escaped `& < > "` and not `'`.
 *
 * That gap was not academic. Those copies were used on attributes
 * (`title="${esc(label)}"`, `aria-label="${esc(label)}"`,
 * `data-help-id="${esc(id)}"`), and an apostrophe in a preset blurb or a help
 * heading ends the attribute early and injects the remainder as markup. A
 * helper whose escape set differs per module means the safe call sites are
 * whichever ones happened to get the thorough copy.
 *
 * This file pins the shared implementation and, just as importantly, pins that
 * no module has grown its own back.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import { escapeHtml } from '../../src/ui/html.js';

const UI_DIR = new URL('../../src/ui/', import.meta.url).pathname;

function uiSources() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.js')) out.push({ name, src: readFileSync(full, 'utf8') });
    }
  };
  walk(UI_DIR);
  return out;
}

describe('escapeHtml', () => {
  it('escapes the four structural characters', () => {
    expect(escapeHtml('<b>')).toBe('&lt;b&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('escapes the apostrophe, which the old private copies did not', () => {
    // The regression this module exists for. A preset named `Chris'` written
    // into title="…" without this closes the attribute early.
    expect(escapeHtml("it's")).toBe('it&#39;s');
    expect(escapeHtml("' onmouseover='x")).toBe('&#39; onmouseover=&#39;x');
  });

  it('escapes the ampersand first, so entities are not double-decoded', () => {
    // `&lt;` must not become `&amp;lt;` on a second pass.
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('neutralises an injection attempt in a single pass', () => {
    const attack = '"><img src=x onerror=alert(1)>';
    const escaped = escapeHtml(attack);
    expect(escaped).not.toMatch(/[<>"']/);
  });

  it('coerces non-strings rather than throwing', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
    expect(escapeHtml(undefined)).toBe('undefined');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('POPULATION 1,204 · stable')).toBe('POPULATION 1,204 · stable');
  });
});

describe('UI modules share one escaper', () => {
  const sources = uiSources();

  it('no UI module defines its own escaping helper', () => {
    // A fifth copy would reintroduce the per-module escape-set divergence.
    const offenders = sources
      .filter(({ name, src }) => name !== 'html.js')
      .filter(({ src }) => /function\s+(esc|escHtml|escapeHtml|escape)\s*\(/.test(src))
      .map(({ name }) => name);
    expect(offenders, 'these modules define their own escaper').toEqual([]);
  });

  it('the modules that interpolate into attributes import the shared one', () => {
    // These four are the call sites the apostrophe bug actually bit.
    for (const name of ['launchModal.js', 'helpOverlay.js', 'analyticsPanel.js', 'civilizationPanel.js']) {
      const found = sources.find((s) => s.name === name);
      expect(found, `${name} is missing`).toBeTruthy();
      expect(found.src, `${name} does not import the shared escaper`)
        .toMatch(/import \{ escapeHtml(?: as esc)? \} from '\.\/html\.js'/);
    }
  });

  it('covers every module that renders narrative or analytics markup', () => {
    // narrativePanel used to escape through textContent → innerHTML rather than
    // a replace chain. That worked, but two escaping mechanisms in one UI is
    // the same per-module divergence as four identical copies, just with a
    // subtler failure mode: the DOM version needs a document, so it throws in a
    // headless render. One escaper, no exceptions.
    for (const name of ['narrativePanel.js', 'sliderControl.js']) {
      const found = sources.find((s) => s.name === name);
      expect(found.src, `${name} does not import the shared escaper`)
        .toMatch(/import \{ escapeHtml \} from '\.\/html\.js'/);
    }
  });
});
