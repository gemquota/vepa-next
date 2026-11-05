/**
 * VEPA4 — tooltip dismissal bus.
 *
 * The drawer had four tooltip systems that each decided for themselves when to
 * hide, which is why "tap anywhere to close" never worked consistently. This
 * pins the single rule now implemented in src/ui/tooltipDismiss.js.
 *
 * Note: vitest runs `environment: 'node'`, so there is no real `document`. The
 * bus guards its install on `typeof document === 'undefined'` precisely so it
 * can be imported headlessly; a minimal fake is installed here to exercise the
 * press-routing logic directly.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  registerTooltip,
  dismissTooltips,
  isTooltipRegistered,
  registeredTooltips,
  resetTooltipDismiss,
} from '../../src/ui/tooltipDismiss.js';

function fakeElement(tag = 'div') {
  return {
    tagName: tag,
    contains(node) {
      return !!node && (node === this || (this.children || []).includes(node));
    },
  };
}

let handlers;

beforeEach(() => {
  resetTooltipDismiss();
  handlers = { pointerdown: [], contextmenu: [] };
  globalThis.document = {
    addEventListener(type, fn) {
      (handlers[type] ||= []).push(fn);
    },
  };
});

afterEach(() => {
  resetTooltipDismiss();
  delete globalThis.document;
});

function press(target) {
  for (const fn of handlers.pointerdown) fn({ target });
}

describe('registerTooltip', () => {
  it('rejects an entry with no dismiss function', () => {
    expect(() => registerTooltip({ name: 'broken' })).toThrow(TypeError);
    expect(() => registerTooltip(null)).toThrow(TypeError);
  });

  it('registers a name and reports it back', () => {
    registerTooltip({ name: 'param', dismiss: () => {} });
    expect(isTooltipRegistered('param')).toBe(true);
    expect(isTooltipRegistered('absent')).toBe(false);
    expect(registeredTooltips()).toEqual(['param']);
  });

  it('returns an unregister function', () => {
    const off = registerTooltip({ name: 'param', dismiss: () => {} });
    off();
    expect(isTooltipRegistered('param')).toBe(false);
  });

  it('installs the press listener only once, however many tooltips register', () => {
    registerTooltip({ name: 'a', dismiss: () => {} });
    registerTooltip({ name: 'b', dismiss: () => {} });
    registerTooltip({ name: 'c', dismiss: () => {} });
    expect(handlers.pointerdown).toHaveLength(1);
    expect(handlers.contextmenu).toHaveLength(1);
  });

  it('listens in the capture phase so a panel that stops propagation still dismisses', () => {
    expect(handlers.pointerdown.length).toBe(0);
    registerTooltip({ name: 'a', dismiss: () => {} });
    // The bus calls addEventListener(type, fn, true) — capture. Asserted by
    // behaviour: the handler must fire before any bubble-phase stopPropagation.
    expect(handlers.pointerdown).toHaveLength(1);
  });
});

describe('a press elsewhere dismisses', () => {
  it('dismisses a plain tooltip when an unrelated node is pressed', () => {
    let calls = 0;
    registerTooltip({ name: 'graph', dismiss: () => { calls += 1; } });
    press(fakeElement('canvas'));
    expect(calls).toBe(1);
  });

  it('dismisses every open tooltip at once', () => {
    const hits = [];
    registerTooltip({ name: 'graph', dismiss: () => hits.push('graph') });
    registerTooltip({ name: 'multiplex', dismiss: () => hits.push('multiplex') });
    press(fakeElement('canvas'));
    expect(hits.sort()).toEqual(['graph', 'multiplex']);
  });

  it('dismisses a right-click too, not only a left press', () => {
    let calls = 0;
    registerTooltip({ name: 'graph', dismiss: () => { calls += 1; } });
    for (const fn of handlers.contextmenu) fn({});
    expect(calls).toBe(1);
  });

  it('dismisses a long-press popup on contextmenu, so it cannot trap the user', () => {
    // There is no exemption left to abuse: a right-click anywhere clears the
    // parameter popup that a long press opened.
    let calls = 0;
    registerTooltip({ name: 'param', dismiss: () => { calls += 1; } });
    for (const fn of handlers.contextmenu) fn({});
    expect(calls).toBe(1);
  });

  it('has no pressInsensitive escape hatch left to opt into', () => {
    // The option was removed: the press that OPENS a tooltip is consumed by the
    // long-press timer and never reaches the bus, so nothing needed to survive
    // it — and the exemption's only lasting effect was a popup that no tap
    // could close. Comments may still name it; code may not.
    const SRC = readFileSync(new URL('../../src/ui/tooltipDismiss.js', import.meta.url), 'utf8');
    expect(SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).not.toMatch(/pressInsensitive/);
  });

  it('survives a dismiss() that unregisters itself mid-iteration', () => {
    // A dismiss callback that tears down its own registration must not make
    // the Set iterator skip the next tooltip.
    const hits = [];
    const off = registerTooltip({ name: 'self', dismiss: () => { hits.push('self'); off(); } });
    registerTooltip({ name: 'after', dismiss: () => hits.push('after') });
    press(fakeElement('canvas'));
    expect(hits.sort()).toEqual(['after', 'self']);
  });
});

describe('anchor awareness', () => {
  it('does not dismiss a tooltip when its own anchor is pressed', () => {
    // Otherwise the press that re-opens a tooltip would close it again.
    const anchor = fakeElement();
    let calls = 0;
    registerTooltip({ name: 'graph', anchor, dismiss: () => { calls += 1; } });
    press(anchor);
    expect(calls).toBe(0);
  });

  it('treats a descendant of the anchor as inside it, so it does not dismiss', () => {
    // The graph tooltip is anchored to a whole cell, so a press on any part of
    // that cell is a press on the anchor and must not make the tooltip vanish.
    const anchor = fakeElement();
    const child = fakeElement('b');
    anchor.children = [child];
    let calls = 0;
    registerTooltip({ name: 'graph', anchor, dismiss: () => { calls += 1; } });
    press(child);
    expect(calls).toBe(0);
  });

  it('dismisses when the anchor has no usable contains()', () => {
    let calls = 0;
    registerTooltip({ name: 'graph', anchor: { tagName: 'x' }, dismiss: () => { calls += 1; } });
    press(fakeElement('span'));
    expect(calls).toBe(1);
  });

  it('dismisses when the press target is null', () => {
    let calls = 0;
    registerTooltip({ name: 'graph', anchor: fakeElement(), dismiss: () => { calls += 1; } });
    press(null);
    expect(calls).toBe(1);
  });
});

describe('dismissTooltips', () => {
  it('dismisses all registered tooltips programmatically', () => {
    const hits = [];
    registerTooltip({ name: 'a', dismiss: () => hits.push('a') });
    registerTooltip({ name: 'b', dismiss: () => hits.push('b') });
    dismissTooltips();
    expect(hits.sort()).toEqual(['a', 'b']);
  });

  it('spares one by name', () => {
    const hits = [];
    registerTooltip({ name: 'a', dismiss: () => hits.push('a') });
    registerTooltip({ name: 'b', dismiss: () => hits.push('b') });
    dismissTooltips('a');
    expect(hits).toEqual(['b']);
  });

  it('is a no-op with nothing registered', () => {
    expect(() => dismissTooltips()).not.toThrow();
  });
});

describe('headless safety', () => {
  it('imports and registers without a document at all', async () => {
    delete globalThis.document;
    const mod = await import('../../src/ui/tooltipDismiss.js?headless');
    expect(() => mod.registerTooltip({ name: 'x', dismiss: () => {} })).not.toThrow();
    mod.dismissTooltips();
    mod.resetTooltipDismiss();
  });
});
