/**
 * VEPA4 — expanded data panels (INTEL / GROUPS / ECO / CIVILIZATION).
 *
 * The DATA drawer was thin: four cells in GROUPS, four in ECO, and cells whose
 * values the engines already computed but the panel never showed. This release
 * widened all four panels and, in doing so, exposed the same blind spot that
 * shipped a runtime ReferenceError last release in civilizationPanel.js —
 * `drawAll` inlines its formatting, and no test called it, so nothing executed
 * it.
 *
 * The formatters are now pure and exported. These tests call them with the
 * report shapes the engines actually produce, so the wide rows cannot rot
 * unnoticed. vitest runs `environment: 'node'`, so the cell-grid and label
 * assertions are static-source checks; the formatters are executed for real.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { formatGroupLines, summariseGroups } from '../../src/ui/groupAnalytics.js';
import { peakPopulation } from '../../src/ui/ecoPanel.js';
import { createGroupRegistry, declareGroup } from '../../src/state/groupRegistry.js';
import { CELL_HELP } from '../../src/ui/helpRegistry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const GROUP_SRC = read('src/ui/groupAnalytics.js');
const ECO_SRC = read('src/ui/ecoPanel.js');
const INTEL_SRC = read('src/ui/intelPanel.js');
const CIV_SRC = read('src/ui/civilizationPanel.js');

const text = (lines) => lines.join('\n');

/* ── GROUPS ─────────────────────────────────────────────────────────────── */

function group(over = {}) {
  return {
    id: 0,
    name: 'Reef',
    declared: true,
    members: new Set([1, 2, 3, 4]),
    species: new Set([0, 1]),
    roles: { leader: 1, forager: 2, builder: 1 },
    treasury: 12.5,
    artifacts: { TOOL: 3, WEAPON: 1, BARRIER: 2 },
    policy: { aggression: 0.3, openness: 0.7, migration: 0.2 },
    allies: new Set([1]),
    conflicts: new Map([[1, 2]]),
    stability: 0.82,
    ...over,
  };
}

function registryWith(...groups) {
  return { groups: new Map(groups.map((g) => [g.id, g])) };
}

describe('summariseGroups', () => {
  it('flattens the registry record the group engine produces', () => {
    const [s] = summariseGroups(registryWith(group()));
    expect(s.name).toBe('Reef');
    expect(s.members).toBe(4);
    expect(s.species).toBe(2);
    expect(s.leaders).toBe(1);
    expect(s.foragers).toBe(2);
    expect(s.builders).toBe(1);
    expect(s.treasury).toBe(12.5);
  });

  it('unpacks all three artifact kinds', () => {
    const [s] = summariseGroups(registryWith(group()));
    expect(s.tools).toBe(3);
    expect(s.weapons).toBe(1);
    expect(s.barriers).toBe(2);
  });

  it('carries the full policy vector, not just a scalar', () => {
    // The panel previously showed one aggregate; the J.1 policy vector has
    // three independent axes and all three change behaviour.
    const [s] = summariseGroups(registryWith(group()));
    expect(s.policy).toEqual({ aggression: 0.3, openness: 0.7, migration: 0.2 });
  });

  it('counts allies and conflicts', () => {
    const [s] = summariseGroups(registryWith(group()));
    expect(s.allies).toBe(1);
    expect(s.conflicts).toBe(1);
  });

  it('defaults every optional field rather than emitting undefined', () => {
    const bare = { id: 9, name: 'Bare', declared: false, members: new Set([1]) };
    const [s] = summariseGroups(registryWith(bare));
    expect(s.species).toBe(0);
    expect(s.leaders).toBe(0);
    expect(s.tools).toBe(0);
    expect(s.allies).toBe(0);
    expect(s.conflicts).toBe(0);
    expect(s.treasury).toBe(0);
    expect(s.policy).toEqual({ aggression: 0, openness: 0, migration: 0 });
  });

  it('returns an empty list for an absent or empty registry', () => {
    expect(summariseGroups(null)).toEqual([]);
    expect(summariseGroups(undefined)).toEqual([]);
    expect(summariseGroups({})).toEqual([]);
    expect(summariseGroups(registryWith())).toEqual([]);
  });

  it('works on a real declared group', () => {
    // declareGroup takes species ids, not member particle ids.
    const registry = createGroupRegistry();
    declareGroup(registry, 'Verdant', [0, 1, 2]);
    const [s] = summariseGroups(registry);
    expect(s.name).toBe('Verdant');
    expect(s.declared).toBe(true);
    expect(s.species).toBe(3);
    expect(s.members).toBe(0);
  });
});

describe('formatGroupLines', () => {
  it('renders name, origin, membership, roles, artifacts and policy', () => {
    const out = text(formatGroupLines(summariseGroups(registryWith(group()))));
    expect(out).toMatch(/Reef/);
    expect(out).toMatch(/declared/);
    expect(out).toMatch(/4 members/);
    expect(out).toMatch(/2 species/);
    expect(out).toMatch(/1 lead\/2 forage\/1 build/);
    expect(out).toMatch(/3 tool\/1 weapon\/2 barrier/);
    expect(out).toMatch(/1 allied/);
    expect(out).toMatch(/1 at war/);
    expect(out).toMatch(/stability 0\.82/);
    expect(out).toMatch(/agg 0\.30\/open 0\.70\/mig 0\.20/);
  });

  it('marks a detected group as detected, not declared', () => {
    const out = text(formatGroupLines(summariseGroups(registryWith(group({ declared: false })))));
    expect(out).toMatch(/detected/);
    expect(out).not.toMatch(/declared/);
  });

  it('omits the detail clauses a group does not have, instead of printing zeros', () => {
    const bare = { id: 1, name: 'Bare', declared: true, members: new Set([1]) };
    const out = text(formatGroupLines(summariseGroups(registryWith(bare))));
    expect(out).not.toMatch(/forage/);
    expect(out).not.toMatch(/barrier/);
    expect(out).not.toMatch(/at war/);
  });

  it('falls back to a stable 1.00 when stability is missing', () => {
    const out = text(formatGroupLines(summariseGroups(registryWith(group({ stability: undefined })))));
    expect(out).toMatch(/stability 1\.00/);
  });

  it('sorts richest group first', () => {
    const rich = group({ id: 1, name: 'Rich', treasury: 99 });
    const poor = group({ id: 2, name: 'Poor', treasury: 1 });
    const lines = formatGroupLines(summariseGroups(registryWith(poor, rich)));
    expect(lines[0]).toMatch(/Rich/);
    expect(lines[1]).toMatch(/Poor/);
  });

  it('breaks a treasury tie on membership, deterministically', () => {
    const a = group({ id: 1, name: 'A', treasury: 5, members: new Set([1]) });
    const b = group({ id: 2, name: 'B', treasury: 5, members: new Set([1, 2]) });
    expect(formatGroupLines(summariseGroups(registryWith(a, b)))[0]).toMatch(/B/);
  });

  it('handles an empty world without throwing', () => {
    expect(formatGroupLines([])).toEqual([]);
    expect(formatGroupLines(null)).toEqual([]);
    expect(formatGroupLines(undefined)).toEqual([]);
  });
});

/* ── ECO ────────────────────────────────────────────────────────────────── */

describe('peakPopulation', () => {
  it('finds the high-water mark across the ring', () => {
    // Current population is already shown; the question a reader actually has
    // is "has this world ever been bigger than it is now?"
    const eco = { ring: [{ total: 10 }, { total: 90 }, { total: 40 }] };
    expect(peakPopulation(eco)).toEqual({ peak: 90, samples: 3 });
  });

  it('does not assume the ring is chronologically ordered', () => {
    const eco = { ring: [{ total: 5 }, { total: 77 }, { total: 2 }] };
    expect(peakPopulation(eco).peak).toBe(77);
  });

  it('reports the sample count, so a peak of 0 is distinguishable from no data', () => {
    expect(peakPopulation({ ring: [{ total: 0 }] })).toEqual({ peak: 0, samples: 1 });
  });

  it('returns zeroes for a world that has not sampled yet', () => {
    expect(peakPopulation({ ring: [] })).toEqual({ peak: 0, samples: 0 });
    expect(peakPopulation({})).toEqual({ peak: 0, samples: 0 });
    expect(peakPopulation(null)).toEqual({ peak: 0, samples: 0 });
  });
});

/* ── Panel cell grids ───────────────────────────────────────────────────── */

/**
 * Cell ids a panel declares, in either of the two shapes in use: the GROUPS /
 * ECO / CIVILIZATION panels declare their cells as data (`{ id, label }`) and
 * render them generically, while INTEL still writes the markup inline.
 */
const cellsOf = (src) => {
  const spec = [...src.matchAll(/\{\s*id:\s*'((?:ga|eco|intel|civ)-[a-z-]+)',\s*label:/g)].map((m) => m[1]);
  const markup = [...src.matchAll(/<span id="((?:ga|eco|intel|civ)-[a-z-]+)"/g)].map((m) => m[1]);
  return [...new Set([...spec, ...markup])];
};

/** Every id the panel writes into, from its `setVal(...)` calls. */
const writtenOf = (src) => new Set([...src.matchAll(/set(?:Val|Value)\('([^']+)'/g)].map((m) => m[1]));

describe('the DATA panels got wider', () => {
  it('GROUPS grew from four cells to eight', () => {
    const cells = cellsOf(GROUP_SRC);
    expect(cells.length).toBeGreaterThanOrEqual(8);
    for (const id of ['ga-leaders', 'ga-artifacts', 'ga-alliances', 'ga-conflicts']) {
      expect(cells, id).toContain(id);
    }
  });

  it('ECO grew from four cells to eight', () => {
    const cells = cellsOf(ECO_SRC);
    expect(cells.length).toBeGreaterThanOrEqual(8);
    for (const id of ['eco-peak', 'eco-extinct', 'eco-predators', 'eco-splits']) {
      expect(cells, id).toContain(id);
    }
  });

  it('INTEL grew from six cells to nine', () => {
    const cells = cellsOf(INTEL_SRC);
    expect(cells.length).toBeGreaterThanOrEqual(9);
    for (const id of ['intel-largest', 'intel-cluster-energy', 'intel-net']) {
      expect(cells, id).toContain(id);
    }
  });

  it('CIVILIZATION grew from eight cells to ten, with CODEX promoted out of the grid', () => {
    const cells = cellsOf(CIV_SRC);
    expect(cells.length).toBeGreaterThanOrEqual(10);
    for (const id of ['civ-households', 'civ-citizens', 'civ-generations']) {
      expect(cells, id).toContain(id);
    }
    // The codex stopped being a "1/2" number and became a full-width block with
    // its own help key; it is no longer one of the grid cells.
    expect(cells, 'civ-codex should no longer be a grid cell').not.toContain('civ-codex');
    expect(CIV_SRC).toContain('civ-codex-block');
  });

  it('renders every value cell it declares, so no cell is permanently blank', () => {
    for (const [name, src] of [['groups', GROUP_SRC], ['eco', ECO_SRC], ['intel', INTEL_SRC], ['civ', CIV_SRC]]) {
      const written = writtenOf(src);
      for (const id of cellsOf(src)) {
        expect(written.has(id), `${name}: ${id} is declared but never written`).toBe(true);
      }
    }
  });

  it('shows a value the engine already computed instead of leaving it undisplayed', () => {
    // stability / legitimacy / eligible heirs were all on the report object
    // and none of them were on screen.
    expect(CIV_SRC).toMatch(/stability/);
    expect(CIV_SRC).toMatch(/legitimacy/);
    expect(CIV_SRC).toMatch(/heir|eligible/i);
  });

  it('halves alliance and conflict pairs, because the registry stores both directions', () => {
    // A mutual alliance is recorded on both groups; showing raw sizes counts
    // every relationship twice against the alliance count next to it.
    expect(GROUP_SRC).toMatch(/Math\.floor\([\s\S]{0,40}\/ 2\)|\/ 2/);
  });

  it('derives the new INTEL cells from the same payload as the count beside them', () => {
    // Two independent reads of cluster state would be free to disagree.
    expect(INTEL_SRC).toMatch(/const clusters = \(data && data\.clusters\) \|\| \[\]/);
    expect(INTEL_SRC).toMatch(/intel-largest/);
    expect(INTEL_SRC).toMatch(/intel-cluster-energy/);
  });

  it('keeps NET GROWTH signed, so direction is readable at a glance', () => {
    expect(INTEL_SRC).toMatch(/intel-net', births - deaths/);
  });
});

/* ── Help coverage for every new cell ───────────────────────────────────── */

describe('every new data cell is documented', () => {
  const NEW_CELLS = [
    'intel-largest', 'intel-cluster-energy', 'intel-net',
    'ga-leaders', 'ga-artifacts', 'ga-alliances', 'ga-conflicts',
    'eco-peak', 'eco-extinct', 'eco-predators', 'eco-splits',
    'civ-households', 'civ-citizens', 'civ-generations',
  ];

  it('has a help entry with a title and a summary', () => {
    for (const id of NEW_CELLS) {
      const entry = CELL_HELP[id];
      expect(entry, `no CELL_HELP entry for ${id}`).toBeTruthy();
      expect(entry.title.length, `${id}.title`).toBeGreaterThan(0);
      expect(entry.summary.length, `${id}.summary`).toBeGreaterThan(20);
    }
  });

  it('explains what each cell measures, not merely what it is called', () => {
    for (const id of NEW_CELLS) {
      const entry = CELL_HELP[id];
      expect(entry.sections.length, `${id} needs at least one section`).toBeGreaterThan(0);
      for (const [heading, body] of entry.sections) {
        expect(String(heading).length, `${id} section heading`).toBeGreaterThan(2);
        expect(String(body).length, `${id} section "${heading}"`).toBeGreaterThan(40);
      }
    }
  });

  it('matches the label the panel renders, so the help names the right cell', () => {
    for (const [name, src] of [['ga', GROUP_SRC], ['eco', ECO_SRC], ['intel', INTEL_SRC], ['civ', CIV_SRC]]) {
      for (const m of src.matchAll(/\{\s*id:\s*'((?:ga|eco|intel|civ)-[a-z-]+)',\s*label:\s*'([^']+)'\s*\}/g)) {
        const [, id, label] = m;
        expect(CELL_HELP[id]?.title, `${name}: ${id} label/title mismatch`).toBe(label);
      }
    }
  });
});
