/**
 * VEPA4 — the analytics panels' draw paths, executed.
 *
 * `civilizationPanel.draw` shipped a runtime `ReferenceError` for a full
 * release: a block-scoped `const` leaked one `if` past its block. It survived
 * `node --check`, it survived a 1200-test suite, and it threw every 30 ticks in
 * a live world — because *nothing ever called `draw`*. The existing panel tests
 * read the panel's source text and called its pure formatters; the code that
 * actually runs on the bus event was never entered.
 *
 * `ecoPanel.drawAll` and `groupAnalytics.drawAll` were in the same position.
 *
 * These tests drive the real event through the real panel against the
 * DOM/canvas stubs and assert the drawing *happened* — recorded 2D calls,
 * written cell values, populated logs — rather than merely that nothing threw.
 * A "did not throw" test still passes if the body is emptied.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { installDom } from '../helpers/domStub.js';
import { createEventBus } from '../../src/core/eventBus.js';
import { createEcoEngine } from '../../src/engines/ecoEngine.js';
import { createEcoPanel, speciesLeaderboard } from '../../src/ui/ecoPanel.js';
import { createGroupAnalytics } from '../../src/ui/groupAnalytics.js';
import { createCivilizationPanel } from '../../src/ui/civilizationPanel.js';

/** A tiny bus double: enough for `mountAnalyticsPanel`'s subscribe step. */
function fakeBus() {
  const handlers = new Map();
  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    },
    emit(event, payload) {
      for (const fn of handlers.get(event) || []) fn(payload);
    },
  };
}

/** Mount containers exactly as `index.html` declares them. */
function mountShell(doc, ids) {
  const root = doc.createElement('div');
  for (const id of ids) {
    const el = doc.createElement('div');
    el.setAttribute('id', id);
    root.appendChild(el);
  }
  doc.body.appendChild(root);
}

/** Every recorded 2D call name on a canvas. */
function callsOf(host, canvasId) {
  return host.querySelector('#' + canvasId).getContext('2d').calls.map((c) => c.name);
}

/* ── ECO ────────────────────────────────────────────────────────────────── */

/**
 * A metrics payload in the exact shape `pushMetrics` consumes, so the eco
 * engine builds the ring for the panel rather than the test hand-writing one.
 *
 * `avgMass` is `speciesMass[sp] / pop`, so a per-species mass scale is what
 * makes the engine's food-web heuristic (bigger AND overlapping → prey →
 * predator) actually produce an edge. Species 1 is given the heavier scale.
 */
function metrics(frameDelta, populations, massScale = { 1: 4 }) {
  const speciesPop = {};
  const speciesEnergy = {};
  const speciesMass = {};
  const speciesPos = {};
  let populationAlive = 0;
  let i = 0;
  for (const [sp, pop] of Object.entries(populations)) {
    speciesPop[sp] = pop;
    speciesEnergy[sp] = pop * 10;
    speciesMass[sp] = pop * (massScale[sp] ?? 1);
    speciesPos[sp] = [i * 5, i * 7, i * 3];
    populationAlive += pop;
    i += 1;
  }
  return {
    frameDelta,
    speciesAlive: Object.keys(populations).length,
    speciesPop,
    speciesEnergy,
    speciesMass,
    speciesPos,
    populationAlive,
  };
}

describe('ecoPanel.drawAll — the path that runs on every eco:analytics event', () => {
  let doc;
  let bus;

  beforeEach(() => {
    doc = installDom();
    mountShell(doc, ['eco-dashboard']);
    bus = fakeBus();
  });

  it('paints the curves, the food web and both log regions', () => {
    const engine = createEcoEngine(bus);
    createEcoPanel(bus);

    // Drive the real engine so the payload is the engine's, not a fixture.
    bus.emit('sim:metrics', metrics(0, { 0: 40, 1: 12 }));
    bus.emit('sim:metrics', metrics(1, { 0: 34, 1: 16 }));
    bus.emit('sim:metrics', metrics(2, { 0: 28, 1: 20 }));
    bus.emit('speciation:split', { parent: 0, child: 2, isolation: 0.42, tick: 2 });
    bus.emit('speciation:extinct', { species: 3, tick: 2 });

    expect(() => bus.emit('eco:analytics', { eco: engine })).not.toThrow();

    const host = doc.getElementById('eco-dashboard');

    // The canvas draw really executed — a recorded `stroke` per species curve.
    const curveCalls = callsOf(host, 'eco-curves');
    expect(curveCalls).toContain('clearRect');
    expect(curveCalls.filter((n) => n === 'stroke').length).toBeGreaterThanOrEqual(2);
    expect(callsOf(host, 'eco-web')).toContain('clearRect');

    // The cells carry values, not their `?? 0` placeholders.
    expect(host.querySelector('#eco-species').textContent).toBe('2');
    expect(host.querySelector('#eco-pop').textContent).toBe('48');
    expect(Number(host.querySelector('#eco-peak').textContent)).toBe(52);
    expect(host.querySelector('#eco-extinct').textContent).toBe('1');
    expect(host.querySelector('#eco-splits').textContent).toBe('1');
    expect(host.querySelector('#eco-bio').textContent).toMatch(/^\d\.\d\d$/);
    // Predator edges really were derived by the engine, not hard-coded.
    expect(host.querySelector('#eco-predators').textContent).toBe('1');

    // Leaderboard values are actually formatted (including shared-scale sparks).
    const leaderboard = speciesLeaderboard(engine);
    expect(leaderboard[0].id).toBe(0);
    expect(leaderboard[0].spark).toHaveLength(3);
    expect(leaderboard[0].spark).not.toContain('undefined');

    // Both log regions were written.
    expect(host.querySelector('#eco-niches').textContent).toContain('S0');
    expect(host.querySelector('#eco-feed').textContent).toContain('S0 → S2');
  });

  it('survives a cold world with an empty ring', () => {
    const engine = createEcoEngine(bus);
    createEcoPanel(bus);
    expect(() => bus.emit('eco:analytics', { eco: engine })).not.toThrow();

    const host = doc.getElementById('eco-dashboard');
    expect(host.querySelector('#eco-pop').textContent).toBe('0');
    expect(host.querySelector('#eco-niches').textContent).toBe('no live niches yet');
    expect(callsOf(host, 'eco-curves')).toContain('fillText'); // the empty-state label
  });
});

/* ── GROUPS ─────────────────────────────────────────────────────────────── */

function groupRecord(over = {}) {
  return {
    id: 0,
    name: 'Reef',
    declared: true,
    members: new Set([1, 2, 3]),
    species: new Set([0, 1]),
    roles: { leader: 1, forager: 2, builder: 1 },
    treasury: 12.5,
    artifacts: { TOOL: 3, WEAPON: 1, BARRIER: 2 },
    policy: { aggression: 0.3, openness: 0.7, migration: 0.2 },
    allies: new Set([1]),
    conflicts: new Map([[1, 2]]),
    stability: 0.82,
    cx: 10, cy: 12, cz: 14, minX: 2, minY: 4, minZ: 6, maxX: 30, maxY: 34, maxZ: 40,
    ...over,
  };
}

describe('groupAnalytics.drawAll — the path that runs on every groups:analytics event', () => {
  let doc;
  let bus;

  beforeEach(() => {
    doc = installDom();
    mountShell(doc, ['groups-dashboard']);
    bus = fakeBus();
  });

  it('paints the overlay, network and sankey canvases and writes the detail log', () => {
    createGroupAnalytics(bus);
    const registry = {
      groups: new Map([
        [0, groupRecord()],
        [1, groupRecord({ id: 1, name: 'Kelp', cx: 60, cz: 70, minX: 50, maxX: 90, allies: new Set([0]), treasury: 4 })],
      ]),
      tradeLog: [{ from: 0, to: 1, amount: 2.5 }],
    };

    expect(() => bus.emit('groups:analytics', { registry })).not.toThrow();

    const host = doc.getElementById('groups-dashboard');
    for (const canvas of ['ga-overlay', 'ga-network', 'ga-sankey']) {
      expect(callsOf(host, canvas), canvas).toContain('clearRect');
    }
    expect(callsOf(host, 'ga-overlay')).toContain('fillRect');

    expect(host.querySelector('#ga-groups').textContent).toBe('2');
    expect(host.querySelector('#ga-members').textContent).toBe('6');
    expect(host.querySelector('#ga-treasury').textContent).toBe('17');
    expect(host.querySelector('#ga-volume').textContent).toBe('2.5');
    expect(host.querySelector('#ga-artifacts').textContent).toBe('12');

    // The detail log is innerHTML, so it is asserted through the parsed tree.
    const detail = host.querySelector('#ga-detail');
    expect(detail.textContent).toContain('Reef');
    expect(detail.textContent).toContain('Kelp');
  });

  it('survives an empty registry', () => {
    createGroupAnalytics(bus);
    expect(() => bus.emit('groups:analytics', { registry: { groups: new Map() } })).not.toThrow();
    const host = doc.getElementById('groups-dashboard');
    expect(host.querySelector('#ga-groups').textContent).toBe('0');
    expect(host.querySelector('#ga-detail').textContent).toBe('no groups detected yet');
  });
});

/* ── CIVILIZATION ───────────────────────────────────────────────────────── */

describe('civilizationPanel.draw — the path that shipped a ReferenceError', () => {
  let doc;
  let bus;

  beforeEach(() => {
    doc = installDom();
    mountShell(doc, ['civilization-dashboard']);
    bus = fakeBus();
  });

  it('writes every cell and the detail log from a populated report', () => {
    createCivilizationPanel(bus);
    const report = {
      cultures: 2,
      federations: 1,
      polities: 1,
      kinEdges: 3,
      households: 4,
      citizens: 9,
      detail: {
        cultures: [{ name: 'Ashmark', ownerGroupId: 'g1', symbols: 2, norms: 1, cohesion: 0.8 }],
        federations: [{ name: 'tribe', kind: 'tribe', members: 1, edges: 0, generation: 2 }],
        polities: [{ name: 'The Reach', citizens: 4, provinces: 1, institutions: [], term: 0 }],
      },
      structures: { standing: 1, total: 3 },
      latestRegime: { regime: 'settled', confidence: 0.8 },
      codex: { statement: 'a culture formed', entries: 2, asserted: 1, admitted: 1, confidence: 0.7, evidence: 3, refused: null, wellEvidenced: true, latest: 'settled', tick: 1200, rejected: 0 },
    };

    expect(() => bus.emit('civilization:analytics', { report })).not.toThrow();

    const host = doc.getElementById('civilization-dashboard');
    expect(host.querySelector('#civ-cultures').textContent).toBe('2');
    expect(host.querySelector('#civ-structures').textContent).toBe('1/3');
    expect(host.querySelector('#civ-regime').textContent).toBe('settled');
    expect(host.querySelector('#civ-confidence').textContent).toBe('0.80');
    expect(host.querySelector('#civ-generations').textContent).toBe('2');
    expect(host.querySelector('#civ-detail').textContent).toContain('Ashmark');
    // The codex is a full-width block now, with its statement and its age.
    const codex = host.querySelector('#civ-codex-block');
    expect(codex.textContent).toContain('a culture formed');
    expect(codex.textContent).toContain('settled');
  });

  it('renders the empty report without a single undefined in the log', () => {
    createCivilizationPanel(bus);
    expect(() => bus.emit('civilization:analytics', {
      report: { cultures: 0, federations: 0, polities: 0, kinEdges: 0, households: 0, detail: {} },
    })).not.toThrow();

    const host = doc.getElementById('civilization-dashboard');
    expect(host.querySelector('#civ-regime').textContent).toBe('—');
    expect(host.querySelector('#civ-detail').textContent).toBe('no civilization entities yet');
    expect(host.querySelector('#civ-detail').textContent).not.toContain('undefined');
    // No codex yet: the block says so instead of rendering an empty shell.
    expect(host.querySelector('#civ-codex-block').textContent).toContain('No codex yet');
  });
});
