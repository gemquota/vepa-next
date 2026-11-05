import { describe, expect, it } from 'vitest';
import { formatCivilizationLines } from '../../src/ui/civilizationPanel.js';
import { createCodex, recordCodexEntry, codexReport } from '../../src/state/codex.js';
import {
  structureReport,
  createStructureRegistry,
  foundStructure,
  runMaintenance,
} from '../../src/state/structures.js';
import {
  createContinuityCatalog,
  recordEraContinuity,
  latestRegime,
  regimeHistogram,
} from '../../src/state/continuity.js';
import {
  createCivilizationRegistry,
  civilizationReport,
  foundCulture,
  foundPolity,
  createFederation,
  addFederationMember,
} from '../../src/state/civilization.js';
import { createSystemLifecycle } from '../../src/state/systemLifecycle.js';

// Regression file.
//
// `draw` used to inline every line of the detail log, and a block-scoped
// `const c` declared inside `if (report.codex)` was read one `if` later, outside
// its block. That is a ReferenceError at runtime — invisible to `node --check`
// and invisible to the 1212-test suite, because every existing test inspected
// the panel's *source text* rather than calling it. The panel threw every
// 30th tick in a running world.
//
// The formatter is now pure and exported, so it can be called directly. These
// tests call it with the report shapes that actually occur.

function baseReport(over = {}) {
  return {
    cultures: 1,
    federations: 0,
    polities: 0,
    kinEdges: 0,
    households: 0,
    detail: { cultures: [], federations: [], polities: [] },
    ...over,
  };
}

const text = (lines) => lines.join('\n');

describe('formatCivilizationLines — the shape that threw', () => {
  it('renders a codex report, which is the case that used to crash', () => {
    const codex = codexReport(createCodex());
    const lines = formatCivilizationLines(baseReport({ codex }));
    // The old code read `c.refused` outside the block that declared `c`, so
    // this exact shape threw ReferenceError before the refactor.
    expect(() => formatCivilizationLines(baseReport({ codex }))).not.toThrow();
    expect(lines.length).toBeGreaterThan(0);
  });

  it('renders every sub-report together without throwing', () => {
    const civ = createCivilizationRegistry();
    foundCulture(civ, 'g1', { name: 'Ashmark', symbols: ['ember', 'oath'], norms: ['share'] });
    const fed = createFederation(civ, { name: 'tribe', kind: 'tribe' });
    addFederationMember(civ, fed.id, 'g1');
    foundPolity(civ, { name: 'The Reach', rulerGroupId: 'g1' });
    const structures = createStructureRegistry(createSystemLifecycle());
    foundStructure(structures, 'g1', { kind: 'NEST' });

    const report = baseReport({
      cultures: 1,
      federations: 1,
      polities: 1,
      households: 2,
      detail: {
        cultures: [{ name: 'Ashmark', ownerGroupId: 'g1', symbols: 2, norms: 1, cohesion: 0.8 }],
        federations: [{ name: 'tribe', kind: 'tribe', members: 1, edges: 0, generation: 0 }],
        polities: [{ name: 'The Reach', citizens: 4, provinces: 1, institutions: [], term: 0 }],
      },
      structures: structureReport(structures),
      latestRegime: { regime: 'settled', confidence: 0.8 },
      codex: codexReport(createCodex()),
    });
    const out = text(formatCivilizationLines(report));
    expect(out).toContain('Ashmark');
    expect(out).toContain('tribe');
    expect(out).toContain('The Reach');
    expect(out).toContain('2 households');
    expect(out).toContain('structures — 1 standing');
  });

  it('surfaces a codex refusal instead of swallowing it', () => {
    const c = createCodex();
    recordCodexEntry(c, { era: 1, tick: 1, regime: 'settled', confidence: 0.8, evidence: ['not-social-evidence'], continuity: {} });
    const out = text(formatCivilizationLines(baseReport({ codex: codexReport(c) })));
    // Silence would read as "nothing to report" when it means the guard said no.
    expect(out).toContain('codex declined to explain');
    expect(out).toContain('non-social evidence');
  });

  it('marks an under-evidenced statement as such', () => {
    const c = createCodex();
    recordCodexEntry(c, {
      era: 1, tick: 1, regime: 'emergent', confidence: 0.2,
      evidence: ['first-observation'], continuity: {},
    });
    const out = text(formatCivilizationLines(baseReport({ codex: codexReport(c) })));
    expect(out).toContain('not enough evidence');
  });
});

describe('formatCivilizationLines — partial reports', () => {
  it('handles a report with no sequel sub-reports (a pre-v9.1.23 save)', () => {
    // Saves written before Phases 4-6 restore without these fields. This must
    // render, not throw.
    const lines = formatCivilizationLines(baseReport());
    expect(lines).toEqual([]);
  });

  it('handles a report whose detail lists are absent', () => {
    expect(() => formatCivilizationLines({})).not.toThrow();
    expect(formatCivilizationLines({})).toEqual([]);
    expect(() => formatCivilizationLines({ detail: {} })).not.toThrow();
  });

  it('omits structures rather than claiming zero', () => {
    const out = text(formatCivilizationLines(baseReport()));
    expect(out).not.toContain('structures');
    expect(out).not.toContain('codex');
  });

  it('defaults a missing culture cohesion instead of printing NaN', () => {
    const out = text(formatCivilizationLines(baseReport({
      detail: { cultures: [{ name: 'X', symbols: 1, norms: 0 }] },
    })));
    expect(out).toContain('cohesion 1.00');
    expect(out).not.toContain('NaN');
  });

  it('falls back to the owner id when a culture has no name', () => {
    const out = text(formatCivilizationLines(baseReport({
      detail: { cultures: [{ ownerGroupId: 'g7', symbols: 1, norms: 0, cohesion: 0.5 }] },
    })));
    expect(out).toContain('g7');
  });
});

describe('formatCivilizationLines — escaping', () => {
  it('escapes HTML in a codex statement', () => {
    const c = createCodex();
    recordCodexEntry(c, {
      era: 1, tick: 1, regime: 'settled', confidence: 0.9,
      evidence: ['stable-without-institutions', 'member-retention-1', 'group-retention-1'],
      continuity: {},
    });
    const hostile = { ...codexReport(c), statement: '<img src=x onerror=alert(1)>' };
    const out = text(formatCivilizationLines(baseReport({ codex: hostile })));
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('escapes HTML in a refusal reason', () => {
    const c = createCodex();
    recordCodexEntry(c, { era: 1, tick: 1, regime: 'x', confidence: 0.5, evidence: ['<b>bad</b>'], continuity: {} });
    const out = text(formatCivilizationLines(baseReport({ codex: codexReport(c) })));
    expect(out).not.toContain('<b>bad</b>');
    expect(out).toContain('&lt;b&gt;');
  });
});

describe('the real report path, end to end', () => {
  // The unit tests above use hand-built reports. These build a genuine one the
  // way main.js does — real registry, real structures, a real era boundary —
  // and attach the sequel sub-reports, because that exact assembly is what
  // threw in the browser. A shape that is plausible in a fixture but never
  // produced by the code would not have caught it.

  function group(id, members) {
    return {
      id, name: `G${id}`, declared: true, members: new Set(members),
      roles: { leader: 1, forager: 2, builder: 1 }, cx: 50, cy: 50, cz: 50,
      minX: 40, minY: 40, minZ: 40, maxX: 60, maxY: 60, maxZ: 60,
      age: 100, treasury: 25, species: new Set([0, 1]),
      artifacts: {}, policy: {}, allies: new Set(), conflicts: new Map(),
      stability: 1, infra: {}, mega: null,
    };
  }

  function realReport() {
    const civ = createCivilizationRegistry();
    const structures = createStructureRegistry(createSystemLifecycle());
    const groups = new Map([[1, group(1, [1, 2, 3, 4])]]);

    foundCulture(civ, 1, { name: 'Ashmark', symbols: ['ember', 'oath', 'mark'], norms: ['share'] });
    const fed = createFederation(civ, { name: 'tribe', kind: 'tribe' });
    addFederationMember(civ, fed.id, 1);
    foundPolity(civ, { name: 'The Reach', rulerGroupId: 1 });
    const nest = foundStructure(structures, 1, { kind: 'NEST', x: 50, y: 50, z: 50 });
    runMaintenance(structures, { groups }, { tick: 100, maintain: [nest.id] });

    const continuity = createContinuityCatalog();
    recordEraContinuity(continuity, civ, { groups }, { tick: 100, era: 1, name: 'One' });
    const era2 = recordEraContinuity(continuity, civ, { groups }, { tick: 110, era: 2, name: 'Two' });
    const codex = createCodex();
    recordCodexEntry(codex, era2);

    // Exactly the shape main.js assembles for `civilization:analytics`.
    const report = civilizationReport(civ);
    report.structures = structureReport(structures);
    report.continuity = regimeHistogram(continuity);
    report.codex = codexReport(codex);
    report.latestRegime = latestRegime(continuity);
    return report;
  }

  it('renders a genuine populated world without throwing', () => {
    const lines = formatCivilizationLines(realReport());
    expect(lines.length).toBeGreaterThan(0);
    expect(text(lines)).toContain('structures — 1 standing');
    expect(text(lines)).toContain('codex');
  });

  it('hedges a two-sample codex rather than asserting a regime', () => {
    // Two samples are not enough, so the observer must admit its uncertainty.
    const out = text(formatCivilizationLines(realReport()));
    expect(out).toContain('not enough evidence');
    expect(out).toMatch(/0 stated \/ 1 uncertain/);
  });

  it('renders the empty world on a boot frame', () => {
    const civ = createCivilizationRegistry();
    const structures = createStructureRegistry(civ.lifecycle);
    const report = civilizationReport(civ);
    report.structures = structureReport(structures);
    report.codex = codexReport(createCodex());
    report.latestRegime = null;
    const out = text(formatCivilizationLines(report));
    // The sub-reports exist on a boot frame, they simply have nothing in them.
    // Showing an honest zero is correct; pretending they are unmeasured would
    // be the alternative, and that is reserved for a report field that is
    // genuinely absent.
    expect(out).toContain('structures — 0 standing, 0 dormant, 0 collapsed');
    expect(out).toContain('no era observed yet');
    expect(out).not.toContain('undefined');
    expect(out).not.toContain('NaN');
  });

  it('renders a real legacy save with no sequel sub-reports', () => {
    expect(formatCivilizationLines(civilizationReport(createCivilizationRegistry()))).toEqual([]);
  });
});

describe('every analytics panel formatter is exercised', () => {
  // The lesson generalises: a panel that is only regex-checked is a panel
  // that ships a runtime crash. Assert the formatter exists and is callable so
  // a future panel is nudged toward the same testable shape.
  it('civilizationPanel exposes a pure formatter', () => {
    expect(typeof formatCivilizationLines).toBe('function');
    expect(Array.isArray(formatCivilizationLines(baseReport()))).toBe(true);
  });
});