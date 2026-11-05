import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  TAB_HELP,
  SUBTAB_HELP,
  GRAPH_HELP,
  CELL_HELP,
  HELP_KIND,
  helpForTab,
  helpForGraph,
  allHelpIds,
} from '../../src/ui/helpRegistry.js';
import {
  HELP_LONG_PRESS_MS,
  HELP_MOVE_TOLERANCE,
  HELP_TOOLTIP_LINGER_MS,
  isHelpModalOpen,
  isHelpTooltipVisible,
  isHelpLongPressInitialised,
} from '../../src/ui/helpOverlay.js';

const HTML = readFileSync('index.html', 'utf8');
const UI = readFileSync('src/ui/ui.js', 'utf8');
const DNA = readFileSync('src/ui/dnaAnalytics.js', 'utf8');

/** Every tab button target in the shell. */
function tabTargets() {
  return [...HTML.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
}

/** Every sub-tab button target in the shell. */
function subTabTargets() {
  return [...HTML.matchAll(/data-sub="([^"]+)"/g)].map((m) => m[1]);
}

/** Every canvas id inside the DNA chart grid. */
function chartCanvases() {
  const grid = HTML.slice(HTML.indexOf('id="dna-charts"'), HTML.indexOf('id="data-logs"'));
  return [...grid.matchAll(/<canvas id="([^"]+)"/g)].map((m) => m[1]);
}

describe('coverage — every reachable control is documented', () => {
  // The point of a help registry is that it cannot quietly fall behind. These
  // tests read index.html rather than a hand-written list, so adding a panel
  // without documenting it fails here rather than shipping a dead spot.
  it('documents every top-level tab', () => {
    for (const id of tabTargets()) {
      expect(TAB_HELP[id], `tab ${id} has no help entry`).toBeTruthy();
    }
  });

  it('documents every sub-tab', () => {
    for (const id of subTabTargets()) {
      expect(SUBTAB_HELP[id], `sub-tab ${id} has no help entry`).toBeTruthy();
    }
  });

  it('documents every DNA chart canvas', () => {
    for (const id of chartCanvases()) {
      expect(GRAPH_HELP[id], `graph ${id} has no help entry`).toBeTruthy();
    }
  });

  it('documents every intel cell declared by the analytics panels', () => {
    // Two declaration shapes must both be covered: the hand-written markup in
    // intelPanel.js, and the `cells: [{ id, label }]` arrays the shared
    // analytics shell renders for the other panels.
    const panelSources = ['intelPanel', 'groupAnalytics', 'ecoPanel', 'civilizationPanel']
      .map((f) => readFileSync(`src/ui/${f}.js`, 'utf8')).join('\n');
    const fromHtml = [...panelSources.matchAll(/id="([a-z]+-[a-z-]+)"[^>]*class="intel-value"/g)]
      .map((m) => m[1]);
    const fromArrays = [...panelSources.matchAll(/\{\s*id:\s*'([a-z]+-[a-z-]+)',\s*label:/g)]
      .map((m) => m[1]);
    const cellIds = [...new Set([...fromHtml, ...fromArrays])];
    expect(cellIds.length, 'no intel cells discovered — the extraction broke').toBeGreaterThan(20);
    for (const id of cellIds) {
      expect(CELL_HELP[id], `cell ${id} has no help entry`).toBeTruthy();
    }
  });

  it('has no orphaned cell entries', () => {
    const panelSources = ['intelPanel', 'groupAnalytics', 'ecoPanel', 'civilizationPanel']
      .map((f) => readFileSync(`src/ui/${f}.js`, 'utf8')).join('\n');
    const declared = new Set([
      ...[...panelSources.matchAll(/id="([a-z]+-[a-z-]+)"[^>]*class="intel-value"/g)].map((m) => m[1]),
      ...[...panelSources.matchAll(/\{\s*id:\s*'([a-z]+-[a-z-]+)',\s*label:/g)].map((m) => m[1]),
      // Panels also build blocks the help overlay can resolve — the codex
      // stopped being a grid cell and became one of these.
      ...[...panelSources.matchAll(/\.id\s*=\s*'([a-z]+-[a-z-]+)'/g)].map((m) => m[1]),
    ]);
    for (const id of Object.keys(CELL_HELP)) {
      expect(declared.has(id), `${id} is not a declared cell`).toBe(true);
    }
  });

  it('has no orphaned help entries — every entry points at something real', () => {
    const known = new Set([...tabTargets(), ...subTabTargets()]);
    for (const id of Object.keys(TAB_HELP)) expect(known.has(id), `${id} is not a tab`).toBe(true);
    for (const id of Object.keys(SUBTAB_HELP)) expect(known.has(id), `${id} is not a sub-tab`).toBe(true);
    const canvases = new Set(chartCanvases());
    for (const id of Object.keys(GRAPH_HELP)) expect(canvases.has(id), `${id} is not a chart`).toBe(true);
  });

  it('gives every sub-tab content a button, so no panel is unreachable', () => {
    // Regression: data-civilization shipped as a sub-tab-content with no
    // button, so the whole civilization dashboard could not be opened.
    const contents = [...HTML.matchAll(/id="((?:data|setup)-[a-z]+)" class="sub-tab-content/g)]
      .map((m) => m[1]);
    const buttons = new Set(subTabTargets());
    expect(contents.length).toBeGreaterThan(0);
    for (const id of contents) {
      expect(buttons.has(id), `sub-tab content ${id} has no button`).toBe(true);
    }
  });
});

describe('entry shape', () => {
  const all = { ...TAB_HELP, ...SUBTAB_HELP, ...GRAPH_HELP, ...CELL_HELP };

  it('gives every entry a title and a summary', () => {
    for (const [id, entry] of Object.entries(all)) {
      expect(entry.title, `${id} missing title`).toBeTruthy();
      expect(entry.title.length, `${id} title too short`).toBeGreaterThan(1);
      expect(entry.summary, `${id} missing summary`).toBeTruthy();
      expect(entry.summary.length, `${id} summary too short`).toBeGreaterThan(20);
    }
  });

  it('gives every section a label and a body', () => {
    for (const [id, entry] of Object.entries(all)) {
      if (!entry.sections) continue;
      expect(Array.isArray(entry.sections), `${id} sections not an array`).toBe(true);
      for (const section of entry.sections) {
        expect(section.length, `${id} section must be [label, body]`).toBe(2);
        expect(section[0]).toBeTruthy();
        expect(section[1]).toBeTruthy();
      }
    }
  });

  it('gives tab help multiple sections, since a tab covers a subsystem', () => {
    for (const [id, entry] of Object.entries({ ...TAB_HELP, ...SUBTAB_HELP })) {
      expect(entry.sections.length, `${id} has too few sections`).toBeGreaterThanOrEqual(2);
    }
  });

  it('uses no empty or duplicated summaries', () => {
    const summaries = Object.values(all).map((e) => e.summary);
    expect(new Set(summaries).size).toBe(summaries.length);
  });
});

describe('content accuracy', () => {
  it('states the real regime vocabulary the continuity module can emit', () => {
    const entry = SUBTAB_HELP['data-civilization'];
    const text = [entry.summary, ...entry.sections.map((s) => s.join(' '))].join(' ');
    for (const regime of ['thriving', 'settled', 'strained', 'fragmenting', 'collapsing', 'empty', 'emergent']) {
      expect(text, `regime ${regime} not mentioned`).toContain(regime);
    }
  });

  it('documents the five DNA traits the diversity metric actually samples', () => {
    // dnaAnalytics.js samples traits [0, 4, 10, 12, 15], which are FORCE,
    // POLARITY, BIRTH_RATE, MUTATION and TIDAL. Documenting a different set
    // would be a help entry that teaches the user something untrue.
    const text = GRAPH_HELP['diversity-trend-graph'].sections.map((s) => s.join(' ')).join(' ');
    for (const trait of ['FORCE', 'POLARITY', 'BIRTH_RATE', 'MUTATION', 'TIDAL']) {
      expect(text).toContain(trait);
    }
    expect(text).toContain('500');
  });

  it('classifies every chart by the drawing routine that renders it', () => {
    expect(GRAPH_HELP['pop-line-graph'].kind).toContain('multi-series');
    expect(GRAPH_HELP['mass-nrg-scatter'].kind).toContain('scatter');
    for (const id of ['mass-histogram', 'energy-distribution', 'age-demographics', 'velocity-distribution']) {
      expect(GRAPH_HELP[id].kind).toContain('histogram');
    }
    for (const id of ['diversity-trend-graph', 'nrg-trend-graph', 'mass-trend-graph']) {
      expect(GRAPH_HELP[id].kind).toContain('line over time');
    }
  });

  it('distinguishes the GROUPS panel from the multi-group CIVILIZATION sub-tab', () => {
    // The stale "this panel is titled Civilizations (Set F), which is
    // misleading" note described a label that no longer existed anywhere. What
    // is actually true, and useful, is where the two panels stop.
    const text = SUBTAB_HELP['data-groups'].sections.map((s) => s.join(' ')).join(' ');
    expect(text).toContain('individual groups');
    expect(text).toContain('CIVILIZATION sub-tab');
    expect(text).not.toContain('misleading');
  });

  it('records the honesty boundary for the codex', () => {
    const text = SUBTAB_HELP['data-civilization'].sections.map((s) => s.join(' ')).join(' ');
    expect(text).toMatch(/never explains a state by which laws/);
    expect(text).toContain('proxy');
  });

  it('documents the chart gestures that actually ship', () => {
    const text = SUBTAB_HELP['data-dna'].sections.map((s) => s.join(' ')).join(' ');
    expect(text).toMatch(/Long-press any graph/);
    expect(text).toMatch(/Double-click a graph to expand/);
  });
});

describe('helpForTab', () => {
  it('resolves a top-level tab', () => {
    const e = helpForTab('tab-data');
    expect(e.title).toBe('DATA');
    expect(e.kind).toBe(HELP_KIND.TAB);
  });

  it('resolves a sub-tab', () => {
    expect(helpForTab('setup-laws').title).toBe('LAWS');
  });

  it('returns null for an unknown or missing id', () => {
    expect(helpForTab('tab-nope')).toBeNull();
    expect(helpForTab('')).toBeNull();
    expect(helpForTab(null)).toBeNull();
  });

  it('does not mutate the frozen registry', () => {
    const before = JSON.stringify(TAB_HELP['tab-data']);
    helpForTab('tab-data');
    expect(JSON.stringify(TAB_HELP['tab-data'])).toBe(before);
    expect(Object.isFrozen(TAB_HELP)).toBe(true);
  });
});

describe('helpForGraph', () => {
  it('returns null without an element', () => {
    expect(helpForGraph(null)).toBeNull();
    expect(helpForGraph({})).toBeNull();
    expect(helpForGraph({ closest: () => null })).toBeNull();
  });

  it('exposes the ids it can resolve', () => {
    const ids = allHelpIds();
    expect(ids.tabs).toContain('tab-setup');
    expect(ids.subtabs).toContain('data-civilization');
    expect(ids.graphs).toContain('pop-line-graph');
    // The codex is a full-width block now, not a grid cell, so its help key
    // moved with it.
    expect(ids.cells).toContain('civ-codex-block');
  });
});

describe('overlay contract', () => {
  it('uses the same hold duration as the rest of the app', () => {
    // paramHelp.js and sliderControl.js both use 500ms; a third value would
    // make the gesture feel unreliable across the drawer.
    const slider = readFileSync('src/ui/sliderControl.js', 'utf8');
    const m = slider.match(/LONG_PRESS_MS = (\d+)/);
    expect(Number(m[1])).toBe(HELP_LONG_PRESS_MS);
  });

  it('cancels a hold when the pointer moves, so scrolling never misfires', () => {
    expect(HELP_MOVE_TOLERANCE).toBeGreaterThan(4);
    expect(HELP_MOVE_TOLERANCE).toBeLessThanOrEqual(12);
  });

  it('uses a sane tooltip linger', () => {
    expect(HELP_TOOLTIP_LINGER_MS).toBeGreaterThan(600);
    expect(HELP_TOOLTIP_LINGER_MS).toBeLessThanOrEqual(4000);
  });

  it('reports a closed initial state', () => {
    expect(isHelpModalOpen()).toBe(false);
    expect(isHelpTooltipVisible()).toBe(false);
  });

  it('exposes an init guard so double-init cannot double-bind listeners', () => {
    expect(typeof isHelpLongPressInitialised()).toBe('boolean');
  });
});

describe('wiring', () => {
  it('initialises the gesture from tab setup', () => {
    expect(UI).toMatch(/import \{ initHelpLongPress \} from '\.\/helpOverlay\.js'/);
    expect(UI).toMatch(/initHelpLongPress\(document\.body\)/);
  });

  it('no longer binds a long-press hold on charts', () => {
    // Charts used to expand on a 600ms hold. That gesture is now help, so a
    // second hold handler here would fight it.
    expect(DNA).not.toMatch(/holdTimer/);
    expect(DNA).toMatch(/dblclick/);
  });

  it('keeps expand and collapse mutually exclusive', () => {
    expect(DNA).toMatch(/function collapseChart/);
    expect(DNA).toMatch(/dna-chart-expanded/);
  });

  it('stale drone claims about graph expansion are gone', () => {
    // The drone map claimed long-press "Graph expand", which stopped being
    // true when the gesture moved to double-click.
    expect(UI).not.toMatch(/Graph expand/);
    expect(UI).toMatch(/graph double-click expand \/ shrink/);
  });

  it('ships styles for both surfaces', () => {
    const css = readFileSync('src/ui/toolbarHelp.css', 'utf8');
    expect(css).toMatch(/\.tab-help-overlay/);
    expect(css).toMatch(/\.tab-help-tip/);
    expect(css).toMatch(/\.tab-help-sections/);
  });
});