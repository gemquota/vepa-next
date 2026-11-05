import { describe, expect, it } from 'vitest';
import {
  REGIME_NAMES,
  captureContinuityFingerprint,
  deriveContinuity,
  createContinuityCatalog,
  recordEraContinuity,
  latestRegime,
  regimeHistogram,
  isRegimeWellEvidenced,
} from '../../src/state/continuity.js';
import {
  createCivilizationRegistry,
  foundCulture,
  transmitCulture,
  recordKin,
  foundPolity,
  createFederation,
  addFederationMember,
} from '../../src/state/civilization.js';

function groupRegistry(spec) {
  const map = new Map();
  for (const [id, g] of Object.entries(spec)) {
    map.set(id, { id, members: new Set(g.members || []), treasury: g.treasury || 0 });
  }
  return { groups: map };
}

const fp = (over) => ({
  tick: 0, groups: 0, totalMembers: 0, cultures: 0, symbols: 0,
  inheritedSymbols: 0, reinventedSymbols: 0, kinEdges: 0, federations: 0,
  polities: 0, citizens: 0, treasuries: 0, ...over,
});

describe('captureContinuityFingerprint', () => {
  it('reports zeroes for an empty world', () => {
    const f = captureContinuityFingerprint(createCivilizationRegistry(), groupRegistry({}), { tick: 3 });
    expect(f.groups).toBe(0);
    expect(f.totalMembers).toBe(0);
    expect(f.cultures).toBe(0);
    expect(f.tick).toBe(3);
  });

  it('counts only groups that still have members', () => {
    // An empty group is a dissolved group; counting it would make a dying
    // civilization look stable.
    const f = captureContinuityFingerprint(
      createCivilizationRegistry(),
      groupRegistry({ g1: { members: [1, 2, 3] }, g2: { members: [] } }),
    );
    expect(f.groups).toBe(1);
    expect(f.totalMembers).toBe(3);
  });

  it('sums treasuries across living groups', () => {
    const f = captureContinuityFingerprint(
      createCivilizationRegistry(),
      groupRegistry({ g1: { members: [1], treasury: 5 }, g2: { members: [1], treasury: 7 } }),
    );
    expect(f.treasuries).toBe(12);
  });

  it('measures culture size and inherited/reinvented split', () => {
    const civ = createCivilizationRegistry();
    foundCulture(civ, 'g1', { symbols: ['ember', 'oath'] });
    foundCulture(civ, 'g2', { symbols: ['salt'] });
    // A full-fidelity transfer with no reinvention gives a clean inheritance
    // measurement, which is what cultureRetention depends on.
    transmitCulture(civ, civ.cultures.keys().next().value, [...civ.cultures.keys()][1], {
      mode: 'horizontal', fidelity: 1, reinvention: 0,
    });
    const f = captureContinuityFingerprint(civ, groupRegistry({ g1: { members: [1] }, g2: { members: [1] } }));
    expect(f.cultures).toBe(2);
    // g1 keeps its 2 seeds; g2 has 1 seed plus 2 inherited.
    expect(f.symbols).toBe(5);
    expect(f.inheritedSymbols).toBe(2);
    expect(f.reinventedSymbols).toBe(0);
  });

  it('counts kin, federations, polities and citizens', () => {
    const civ = createCivilizationRegistry();
    recordKin(civ, 1, 2);
    recordKin(civ, 2, 3);
    const fed = createFederation(civ, { name: 't' });
    addFederationMember(civ, fed.id, 'g1');
    foundPolity(civ, { name: 'P', rulerGroupId: 'g1' });
    const f = captureContinuityFingerprint(civ, groupRegistry({ g1: { members: [1] } }));
    expect(f.kinEdges).toBe(2);
    expect(f.federations).toBe(1);
    expect(f.polities).toBe(1);
  });

  it('never reads law state — a regime must describe the society, not the toggles', () => {
    const civ = createCivilizationRegistry();
    const gr = groupRegistry({ g1: { members: [1, 2] } });
    const before = JSON.stringify(captureContinuityFingerprint(civ, gr, { tick: 1 }));
    // The signature accepts no lawState parameter at all, so there is nothing
    // for a caller to smuggle one into.
    expect(captureContinuityFingerprint.length).toBeLessThanOrEqual(3);
    expect(before).not.toMatch(/law/i);
    expect(JSON.stringify(captureContinuityFingerprint(civ, gr, { tick: 1 }))).toBe(before);
  });
});

describe('deriveContinuity — first sample', () => {
  it('names the first observation as emergent and does not overclaim', () => {
    const d = deriveContinuity(null, fp({ groups: 2, totalMembers: 8 }));
    expect(d.regime).toBe(REGIME_NAMES.EMERGENT);
    expect(d.evidence).toEqual(['first-observation']);
    expect(d.continuity.comparable).toBe(false);
    // One sample cannot support a claim, so confidence must start low.
    expect(d.confidence).toBeLessThan(0.3);
    expect(isRegimeWellEvidenced(d)).toBe(false);
  });
});

describe('deriveContinuity — regime naming', () => {
  it('names an empty world when nothing survived', () => {
    const d = deriveContinuity(fp({ groups: 3, totalMembers: 9 }), fp({ groups: 0, totalMembers: 0 }));
    expect(d.regime).toBe(REGIME_NAMES.EMPTY);
    expect(d.evidence).toContain('no-surviving-groups');
  });

  it('names a collapse when membership retention halves', () => {
    const d = deriveContinuity(fp({ groups: 2, totalMembers: 10 }), fp({ groups: 2, totalMembers: 3 }));
    expect(d.regime).toBe(REGIME_NAMES.COLLAPSING);
    expect(d.continuity.memberRetention).toBeCloseTo(0.3, 2);
    expect(d.evidence.some((e) => e.startsWith('member-retention'))).toBe(true);
  });

  it('names fragmentation when groups thin out but members hold', () => {
    const d = deriveContinuity(
      fp({ groups: 4, totalMembers: 10 }),
      fp({ groups: 1, totalMembers: 9, inheritedSymbols: 5 }),
    );
    expect(d.regime).toBe(REGIME_NAMES.FRAGMENTING);
    expect(d.evidence.some((e) => e.startsWith('group-retention'))).toBe(true);
  });

  it('names strain when culture is reinvented faster than it is inherited', () => {
    const d = deriveContinuity(
      fp({ groups: 2, totalMembers: 10, inheritedSymbols: 10 }),
      fp({ groups: 2, totalMembers: 10, inheritedSymbols: 2, reinventedSymbols: 8 }),
    );
    expect(d.regime).toBe(REGIME_NAMES.STRAINED);
    expect(d.continuity.inventionRate).toBeCloseTo(0.8, 2);
  });

  it('names thriving when institutions stand and culture fully persisted', () => {
    const d = deriveContinuity(
      fp({ groups: 2, totalMembers: 10, inheritedSymbols: 6 }),
      fp({ groups: 2, totalMembers: 10, inheritedSymbols: 6, polities: 1, federations: 1 }),
    );
    expect(d.regime).toBe(REGIME_NAMES.THRIVING);
    expect(d.continuity.institutionDepth).toBeGreaterThan(0);
  });

  it('names settled when nothing moved and there are no institutions', () => {
    const d = deriveContinuity(
      fp({ groups: 2, totalMembers: 10, inheritedSymbols: 4 }),
      fp({ groups: 2, totalMembers: 10, inheritedSymbols: 4 }),
    );
    expect(d.regime).toBe(REGIME_NAMES.SETTLED);
  });

  it('prefers the more severe diagnosis when several conditions hold', () => {
    // Both groups and members collapse: collapse must win over fragmentation.
    const d = deriveContinuity(fp({ groups: 5, totalMembers: 50 }), fp({ groups: 1, totalMembers: 2 }));
    expect(d.regime).toBe(REGIME_NAMES.COLLAPSING);
  });
});

describe('deriveContinuity — measurement discipline', () => {
  it('always returns evidence, a confidence and a rationale', () => {
    const d = deriveContinuity(fp({ groups: 2, totalMembers: 10 }), fp({ groups: 2, totalMembers: 12 }));
    expect(d.evidence.length).toBeGreaterThan(0);
    expect(d.confidence).toBeGreaterThan(0);
    expect(d.confidence).toBeLessThanOrEqual(1);
    expect(d.rationale.length).toBeGreaterThan(0);
  });

  it('rounds reported ratios to three decimals', () => {
    const d = deriveContinuity(fp({ groups: 1, totalMembers: 3 }), fp({ groups: 1, totalMembers: 1 }));
    // Rounded on purpose so the value is stable in saved worlds and the UI.
    expect(d.continuity.memberRetention).toBe(0.333);
  });

  it('treats growth from zero as full retention rather than dividing by zero', () => {
    const d = deriveContinuity(fp({ groups: 0, totalMembers: 0 }), fp({ groups: 2, totalMembers: 6 }));
    expect(Number.isFinite(d.continuity.memberRetention)).toBe(true);
    expect(d.continuity.memberRetention).toBe(1);
  });

  it('gives more confidence when more of the fingerprint actually moved', () => {
    const still = deriveContinuity(
      fp({ groups: 2, totalMembers: 10, inheritedSymbols: 4 }),
      fp({ groups: 2, totalMembers: 10, inheritedSymbols: 4 }),
    );
    const moved = deriveContinuity(
      fp({ groups: 2, totalMembers: 10, inheritedSymbols: 4 }),
      fp({ groups: 3, totalMembers: 25, inheritedSymbols: 4, polities: 1 }),
    );
    expect(moved.confidence).toBeGreaterThan(still.confidence);
  });

  it('is a pure function of its two inputs', () => {
    const a = fp({ groups: 2, totalMembers: 10, inheritedSymbols: 3 });
    const b = fp({ groups: 1, totalMembers: 6, inheritedSymbols: 2 });
    expect(deriveContinuity(a, b)).toEqual(deriveContinuity(a, b));
  });
});

describe('continuity catalog', () => {
  it('starts empty', () => {
    const c = createContinuityCatalog();
    expect(c.entries).toEqual([]);
    expect(latestRegime(c)).toBeNull();
  });

  it('files one entry per era and keeps the previous fingerprint', () => {
    const civ = createCivilizationRegistry();
    const gr = groupRegistry({ g1: { members: [1, 2, 3] } });
    const c = createContinuityCatalog();
    const first = recordEraContinuity(c, civ, gr, { tick: 10, era: 1, name: 'First' });
    expect(first.regime).toBe(REGIME_NAMES.EMERGENT);
    const second = recordEraContinuity(c, civ, gr, { tick: 20, era: 2, name: 'Second' });
    // With a comparable prior sample the same world is no longer "emergent".
    expect(second.evidence).not.toEqual(['first-observation']);
    expect(c.entries).toHaveLength(2);
  });

  it('carries era name, index and tick onto the entry', () => {
    const c = createContinuityCatalog();
    const e = recordEraContinuity(c, createCivilizationRegistry(), groupRegistry({}), { tick: 7, era: 3, name: 'Third Age' });
    expect(e.era).toBe(3);
    expect(e.name).toBe('Third Age');
    expect(e.tick).toBe(7);
  });

  it('retains the raw fingerprint so a claim can be re-checked later', () => {
    const c = createContinuityCatalog();
    const e = recordEraContinuity(c, createCivilizationRegistry(), groupRegistry({ g1: { members: [1] } }), {});
    expect(e.fingerprint).toBeTruthy();
    expect(e.fingerprint.totalMembers).toBe(1);
  });

  it('bounds the catalog and drops the oldest entries', () => {
    const civ = createCivilizationRegistry();
    const gr = groupRegistry({ g1: { members: [1] } });
    const c = createContinuityCatalog({ cap: 3 });
    for (let i = 0; i < 6; i++) recordEraContinuity(c, civ, gr, { tick: i, era: i });
    expect(c.entries).toHaveLength(3);
    expect(c.entries.map((e) => e.era)).toEqual([3, 4, 5]);
  });

  it('enforces a minimum catalog cap so the observer keeps some memory', () => {
    expect(createContinuityCatalog({ cap: 0 }).cap).toBe(2);
  });

  it('detects an emptied world across an era boundary', () => {
    const c = createContinuityCatalog();
    recordEraContinuity(c, createCivilizationRegistry(), groupRegistry({ g1: { members: [1, 2, 3, 4] } }), { tick: 1 });
    const gr = groupRegistry({});
    const e = recordEraContinuity(c, createCivilizationRegistry(), gr, { tick: 2 });
    expect(e.regime).toBe(REGIME_NAMES.EMPTY);
    expect(e.rationale).toMatch(/No group retained/);
  });
});

describe('regimeHistogram', () => {
  it('reports an empty catalog cleanly', () => {
    expect(regimeHistogram(createContinuityCatalog())).toEqual({
      histogram: {}, samples: 0, eras: [],
    });
  });

  it('counts how often each regime was observed', () => {
    const civ = createCivilizationRegistry();
    const gr = groupRegistry({ g1: { members: [1] } });
    const c = createContinuityCatalog();
    recordEraContinuity(c, civ, gr, { tick: 1 });
    recordEraContinuity(c, civ, gr, { tick: 2 });
    recordEraContinuity(c, createCivilizationRegistry(), groupRegistry({}), { tick: 3 });
    const h = regimeHistogram(c);
    expect(h.samples).toBe(3);
    expect(h.histogram[REGIME_NAMES.EMPTY]).toBe(1);
    expect(h.eras).toEqual([0, 1, 2]);
  });
});

describe('isRegimeWellEvidenced', () => {
  it('is false for a missing entry', () => {
    expect(isRegimeWellEvidenced(null)).toBe(false);
  });

  it('is false for a first observation', () => {
    const d = deriveContinuity(null, fp({ groups: 2, totalMembers: 8 }));
    expect(isRegimeWellEvidenced(d)).toBe(false);
  });

  it('requires both enough evidence and enough confidence', () => {
    expect(isRegimeWellEvidenced({ evidence: ['a'], confidence: 0.9 })).toBe(false);
    expect(isRegimeWellEvidenced({ evidence: ['a', 'b', 'c'], confidence: 0.4 })).toBe(false);
    expect(isRegimeWellEvidenced({ evidence: ['a', 'b', 'c'], confidence: 0.7 })).toBe(true);
  });
});
