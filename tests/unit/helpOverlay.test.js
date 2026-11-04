import { describe, expect, it } from 'vitest';
import { helpForGraph, GRAPH_HELP, CELL_HELP } from '../../src/ui/helpRegistry.js';

// This file tests the *resolution* logic in helpRegistry.helpForGraph — which
// ancestor wins when a pointer lands inside nested help targets — against a
// minimal stub implementing exactly the four DOM members that logic touches:
// `closest`, `querySelector`, `id` and `textContent`.
//
// It deliberately does not try to test rendering, pointer timing, layout or
// CSS. vitest runs `environment: 'node'` here and the project ships no DOM
// library, so a real-browser test would mean adding a dependency and would
// still not cover layout. What this *does* pin is the precedence rule, which
// is where the actual bug risk lives: a cell sits inside a chart section that
// sits inside a panel, and each of those could claim the help text.

/**
 * Build a tiny element tree.
 *
 * Nodes are plain objects with an explicit parent pointer, so `closest` is a
 * real upward walk rather than a mock. It supports the three selector forms
 * the production code actually uses: tag names (`canvas`), classes
 * (`.chart-section`) and ids (`#mass-histogram`).
 *
 * @param {string} tag element name, e.g. 'canvas'
 * @param {string} classes space-separated class names, or '' for none
 * @param {object|null} parent
 * @param {{id?:string, text?:string, query?:object}} [opts]
 */
function el(tag, classes, parent = null, opts = {}) {
  return {
    tag,
    classes: classes ? classes.split(' ') : [],
    parent,
    id: opts.id || '',
    textContent: opts.text || '',
    // A single query target is enough for the shapes production code queries.
    querySelector: () => opts.query || null,
    matches(selector) {
      return selector.split(',').map((s) => s.trim()).some((s) => {
        if (s.startsWith('.')) return this.classes.includes(s.slice(1));
        if (s.startsWith('#')) return this.id === s.slice(1);
        return this.tag === s;
      });
    },
    closest(selector) {
      let node = this;
      while (node) {
        if (node.matches(selector)) return node;
        node = node.parent;
      }
      return null;
    },
  };
}

describe('helpForGraph — canvas inside a chart section', () => {
  it('resolves a graph by its canvas id', () => {
    const canvas = el('canvas', '', null, { id: 'mass-histogram' });
    const hit = helpForGraph(canvas);
    expect(hit.title).toBe(GRAPH_HELP['mass-histogram'].title);
    expect(hit.scope).toBe('graph');
    expect(hit.kind).toBe('graph');
  });

  it('resolves from a descendant of the canvas surface', () => {
    // Pointer events land on the canvas itself in practice, but a child node
    // must walk up rather than return null.
    const canvas = el('canvas', '', null, { id: 'pop-line-graph' });
    const child = el('span', '', canvas);
    expect(helpForGraph(child).title).toBe('POPULATION_TRENDS');
  });

  it('resolves through an intervening chart section', () => {
    const section = el('div', 'chart-section', null, {});
    const canvas = el('canvas', '', section, { id: 'diversity-trend-graph' });
    expect(helpForGraph(canvas).title).toBe('DIVERSITY_TREND');
  });

  it('returns null for an undocumented canvas', () => {
    expect(helpForGraph(el('canvas', '', null, { id: 'not-a-known-graph' }))).toBeNull();
  });
});

describe('helpForGraph — analytics cell precedence', () => {
  function cellTree(cellId) {
    const value = el('span', 'intel-value', null, { id: cellId });
    const cell = el('div', 'intel-cell', null, { query: value });
    const label = el('span', 'intel-label', cell);
    return { label, cell };
  }

  it('resolves a cell by its value element id', () => {
    const { cell } = cellTree('civ-regime');
    const hit = helpForGraph(cell);
    expect(hit.title).toBe(CELL_HELP['civ-regime'].title);
    expect(hit.scope).toBe('cell');
  });

  it('resolves from the label inside the cell', () => {
    const { label } = cellTree('ga-treasury');
    expect(helpForGraph(label).title).toBe('TREASURY');
  });

  it('prefers the cell over an ancestor section when both could match', () => {
    // The precedence rule that matters: a cell is more specific than whatever
    // chart section happens to contain it.
    const section = el('div', 'chart-section', null, { query: { textContent: 'SOME CHART' } });
    const value = el('span', 'intel-value', null, { id: 'eco-bio' });
    const cell = el('div', 'intel-cell', section, { query: value });
    const hit = helpForGraph(cell);
    expect(hit.scope).toBe('cell');
    expect(hit.title).toBe('BIODIVERSITY');
  });

  it('falls back to the chart title when the cell has no entry', () => {
    // An undocumented cell must not swallow the section's explanation.
    const section = el('div', 'chart-section', null, {
      query: { textContent: 'UNLISTED CHART' },
    });
    const value = el('span', 'intel-value', null, { id: 'undocumented-cell' });
    const cell = el('div', 'intel-cell', section, { query: value });
    const hit = helpForGraph(cell);
    expect(hit.scope).toBe('section');
    expect(hit.title).toBe('UNLISTED CHART');
  });
});

describe('helpForGraph — chart-section fallback', () => {
  it('describes a titled section that has no canvas help', () => {
    const section = el('div', 'chart-section', null, { query: { textContent: 'LEGACY CHART' } });
    const hit = helpForGraph(section);
    expect(hit.title).toBe('LEGACY CHART');
    expect(hit.summary).toMatch(/Chart area/);
    expect(hit.scope).toBe('section');
  });

  it('returns null for an untitled section', () => {
    expect(helpForGraph(el('div', 'chart-section', null, {}))).toBeNull();
  });

  it('returns null for unrelated elements', () => {
    expect(helpForGraph(el('div', '', null, {}))).toBeNull();
    expect(helpForGraph(el('div', 'intel-log', null, {}))).toBeNull();
    expect(helpForGraph(el('button', 'tab-btn', null, {}))).toBeNull();
  });
});

describe('helpForGraph — defensive input handling', () => {
  it('tolerates null, undefined and objects without closest', () => {
    expect(helpForGraph(null)).toBeNull();
    expect(helpForGraph(undefined)).toBeNull();
    expect(helpForGraph({})).toBeNull();
    expect(helpForGraph({ id: 'x' })).toBeNull();
    expect(helpForGraph({ closest: null })).toBeNull();
  });

  it('tolerates a node whose closest returns null', () => {
    expect(helpForGraph({ closest: () => null })).toBeNull();
  });

  it('tolerates a cell whose querySelector returns nothing', () => {
    const cell = el('div', 'intel-cell', null, {});
    expect(() => helpForGraph(cell)).not.toThrow();
    expect(helpForGraph(cell)).toBeNull();
  });

  it('never throws for any documented canvas id', () => {
    for (const id of Object.keys(GRAPH_HELP)) {
      const canvas = el('canvas', '', null, { id });
      expect(() => helpForGraph(canvas)).not.toThrow();
      expect(helpForGraph(canvas).title).toBeTruthy();
    }
  });
});