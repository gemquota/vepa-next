/**
 * VEPA4 — the shared selection context and the ECO leaderboard that feeds it.
 *
 * Six read-only DATA grids, no way to say "this one". The leaderboard is the
 * tap surface; the context is the memory. Both are tested here because the
 * whole feature is the two of them agreeing.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';

import { installDom } from '../helpers/domStub.js';
import { createSelectionContext, SELECTION_KINDS } from '../../src/state/selection.js';
import { speciesLeaderboard, sparkline, createEcoPanel } from '../../src/ui/ecoPanel.js';

function ecoOf(populations, frames = 1) {
  const ring = [];
  for (let f = 0; f < frames; f++) {
    const species = {};
    let total = 0;
    for (const [sp, base] of Object.entries(populations)) {
      const pop = Math.max(0, base - f * Math.round(base / (frames + 2)));
      species[sp] = { pop };
      total += pop;
    }
    ring.push({ tick: f, total, speciesAlive: Object.keys(species).length, shannon: 0.6, species });
  }
  return { ring, extinct: [], splits: [], foodWeb: new Map(), niches: new Map() };
}

/* ── the context ────────────────────────────────────────────────────────── */

describe('shared selection context', () => {
  it('starts empty and publishes nothing until something is selected', () => {
    const events = [];
    const bus = { emit: (name, payload) => events.push([name, payload]) };
    const selection = createSelectionContext(bus);

    expect(selection.isEmpty()).toBe(true);
    expect(selection.get()).toEqual({ species: null, group: null });
    expect(events).toEqual([]);
  });

  it('broadcasts `selection:changed` on a real change only', () => {
    const events = [];
    const bus = { emit: (name, payload) => events.push([name, payload]) };
    const selection = createSelectionContext(bus);

    expect(selection.select({ species: 3 })).toBe(true);
    expect(selection.select({ species: 3 })).toBe(false);   // not a change
    expect(events).toEqual([['selection:changed', { species: 3, group: null }]]);

    expect(selection.clear()).toBe(true);
    expect(selection.clear()).toBe(false);
    expect(events).toHaveLength(2);
    expect(events[1][1]).toEqual({ species: null, group: null });
  });

  it('matches by kind, so a species id never selects a group with the same number', () => {
    const selection = createSelectionContext();
    selection.select({ group: 2 });
    expect(selection.matches('group', 2)).toBe(true);
    expect(selection.matches('species', 2)).toBe(false);
    expect(selection.matches('nonsense', 2)).toBe(false);
    expect(SELECTION_KINDS).toEqual(['species', 'group']);
  });

  it('normalises ids and refuses nonsense', () => {
    const selection = createSelectionContext();
    selection.select({ species: '4' });
    expect(selection.get().species).toBe(4);

    expect(selection.select({ species: 'abc' })).toBe(false);
    expect(selection.get().species).toBe(4);       // unchanged, not corrupted
    expect(selection.select({})).toBe(false);
  });

  it('freezes the snapshot so a panel cannot mutate the selection in place', () => {
    const selection = createSelectionContext();
    selection.select({ species: 1 });
    expect(Object.isFrozen(selection.get())).toBe(true);
  });
});

/* ── the leaderboard ────────────────────────────────────────────────────── */

describe('species leaderboard', () => {
  it('ranks by population and reports each species share of the live total', () => {
    const rows = speciesLeaderboard(ecoOf({ 0: 40, 1: 12, 2: 8 }));
    expect(rows.map((r) => r.id)).toEqual([0, 1, 2]);
    expect(rows[0].pop).toBe(40);
    expect(rows[0].share).toBeCloseTo(40 / 60);
    expect(rows[2].share).toBeCloseTo(8 / 60);
  });

  it('carries a per-species trend across the ring, not just the latest value', () => {
    const eco = ecoOf({ 0: 40, 1: 12 }, 4);
    const rows = speciesLeaderboard(eco);
    expect(rows[0].trend).toHaveLength(4);
    expect(rows[0].trend[0]).toBeGreaterThan(rows[0].trend[3]);
  });

  it('is empty for a world that has not booted', () => {
    expect(speciesLeaderboard({ ring: [] })).toEqual([]);
    expect(speciesLeaderboard(null)).toEqual([]);
  });

  it('honours the row limit', () => {
    const populations = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i, 100 - i]));
    expect(speciesLeaderboard(ecoOf(populations))).toHaveLength(8);
  });
});

describe('sparkline', () => {
  it('scales against the series maximum by default', () => {
    expect(sparkline([5, 5, 5])).toBe('███');
    expect(sparkline([0, 0, 8])).toBe('▁▁█');
    expect(sparkline([])).toBe('');
  });

  it('takes an explicit scale so a small species stays visibly small', () => {
    // 3 particles against a board where the leader peaked at 40.
    expect(sparkline([3, 3, 3], 12, 40)).toBe('▁▁▁');
    expect(sparkline([40, 40, 40], 12, 40)).toBe('███');
  });

  it('keeps to the requested width', () => {
    expect([...sparkline(Array.from({ length: 50 }, (_, i) => i))]).toHaveLength(12);
  });
});

/* ── the two halves together ────────────────────────────────────────────── */

describe('tapping a leaderboard row drives the shared selection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('selects, re-renders as focused, and clears on a second tap', () => {
    // The analytics shell throttles redraws to ~2 Hz, so the clock is stepped
    // forward between frames rather than the throttle being bypassed.
    let clock = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);

    const doc = installDom();
    const mount = doc.createElement('div');
    mount.setAttribute('id', 'eco-dashboard');
    doc.body.appendChild(mount);

    const selection = createSelectionContext();
    const eco = ecoOf({ 0: 40, 1: 12 });

    // Re-create the panel against the real module.
    const handlers = new Map();
    const bus = { on: (e, fn) => handlers.set(e, fn) };
    createEcoPanel(bus, selection);
    handlers.get('eco:analytics')({ eco });

    const board = doc.getElementById('eco-dashboard').querySelector('#eco-leaderboard');
    expect(board).toBeTruthy();
    const rows = board.querySelectorAll('.eco-board-row');
    expect(rows).toHaveLength(2);

    rows[0].dispatch('click', {});
    expect(selection.get()).toEqual({ species: 0, group: null });

    // The next frame marks the selected row.
    clock += 1000;
    handlers.get('eco:analytics')({ eco });
    const marked = doc.getElementById('eco-dashboard').querySelectorAll('.eco-board-row.selected');
    expect(marked).toHaveLength(1);
    expect(marked[0].dataset.species).toBe('0');

    // And tapping it again is a way out.
    doc.getElementById('eco-dashboard').querySelectorAll('.eco-board-row')[0].dispatch('click', {});
    expect(selection.isEmpty()).toBe(true);
  });
});
