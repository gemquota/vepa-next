import { describe, expect, it } from 'vitest';
import {
  CODEX_SOURCES,
  SOCIAL_EVIDENCE,
  LAW_SCAN_MIN_LENGTH,
  lawScanKeys,
  classifyEvidence,
  assertSocialEvidence,
  findLawAttribution,
  ASSERTION_CONFIDENCE,
  createCodex,
  explainRegime,
  recordCodexEntry,
  recordLatestCodexEntry,
  latestCodexEntry,
  codexReport,
  serializeCodex,
  restoreCodex,
} from '../../src/state/codex.js';
import {
  createContinuityCatalog,
  recordEraContinuity,
  REGIME_NAMES,
} from '../../src/state/continuity.js';
import { createCivilizationRegistry } from '../../src/state/civilization.js';
import { LAW_INDEXES } from '../../src/constants.js';

function groupRegistry(spec) {
  const map = new Map();
  for (const [id, g] of Object.entries(spec || {})) {
    map.set(id, { id, members: new Set(g.members || []), treasury: g.treasury || 0 });
  }
  return { groups: map };
}

/**
 * A continuity entry of a given shape, for exercising the codex directly.
 * The default carries three real evidence stems so it clears
 * continuity.js's MIN_EVIDENCE gate; single-stem variants are the
 * under-evidenced case and are written explicitly where tested.
 */
function entry(over = {}) {
  return {
    era: 1, tick: 10, name: 'era-1',
    regime: REGIME_NAMES.SETTLED,
    confidence: 0.8,
    evidence: ['stable-without-institutions', 'member-retention-1', 'group-retention-1'],
    rationale: 'held steady',
    continuity: { comparable: true, memberRetention: 1 },
    ...over,
  };
}

describe('evidence classification', () => {
  it('accepts every stem the continuity module can emit', () => {
    for (const stem of SOCIAL_EVIDENCE) {
      expect(classifyEvidence(stem)).toBe(stem);
    }
  });

  it('strips a numeric suffix from a stemmed token', () => {
    expect(classifyEvidence('member-retention-0.42')).toBe('member-retention');
    expect(classifyEvidence('group-retention-1')).toBe('group-retention');
  });

  it('rejects anything that is not a social measurement', () => {
    // Notably: a law name is not evidence, and neither is a particle count.
    expect(classifyEvidence('GRAV')).toBeNull();
    expect(classifyEvidence('population')).toBeNull();
    expect(classifyEvidence('member-retentionX')).toBeNull();
    expect(classifyEvidence(null)).toBeNull();
  });

  it('throws rather than guessing when evidence is not social', () => {
    // A caller offering an unrecognised token is a bug or an unreviewed new
    // measurement; the codex must refuse instead of inventing a meaning.
    expect(() => assertSocialEvidence(['GRAV enabled'])).toThrow(/non-social evidence/);
    expect(() => assertSocialEvidence('not-an-array')).toThrow(TypeError);
  });

  it('returns the stems so a record never stores a raw suffixed token', () => {
    expect(assertSocialEvidence(['member-retention-0.5', 'first-observation']))
      .toEqual(['member-retention', 'first-observation']);
  });
});

describe('law attribution guard', () => {
  it('finds a law name used as a standalone word', () => {
    expect(findLawAttribution('The world collapsed while CATALYSIS_LAW was set.')).toContain('CATALYSIS_LAW');
    expect(findLawAttribution('PLANETARY drift resumed')).toContain('PLANETARY');
  });

  it('matches case-insensitively', () => {
    expect(findLawAttribution('they were under ORDER the whole time')).toContain('ORDER');
  });

  it('does not fire on a law name embedded inside a longer word', () => {
    // A substring scan would flag ordinary English and make the guard noise.
    expect(findLawAttribution('a catalytic arrangement')).toEqual([]);
    expect(findLawAttribution('preordering of things')).toEqual([]);
    expect(findLawAttribution('reordering the ranks')).toEqual([]);
  });

  it('ignores short law names that collide with ordinary words', () => {
    // LIFE, HEAT, VOID, MIND are four letters and real English words; a codex
    // sentence about a society's life is not citing the LIFE law.
    expect(LAW_SCAN_MIN_LENGTH).toBe(5);
    expect(lawScanKeys()).not.toContain('LIFE');
    expect(lawScanKeys()).not.toContain('HEAT');
    expect(lawScanKeys()).not.toContain('VOID');
    expect(lawScanKeys()).not.toContain('MIND');
  });

  it('still scans short names that carry an underscore', () => {
    // SOUL_LAW and CATALYSIS_LAW cannot be ordinary English words.
    expect(lawScanKeys()).toContain('SOUL_LAW');
    expect(findLawAttribution('they met their SOUL_LAW')).toContain('SOUL_LAW');
  });

  it('returns nothing for a clean social sentence', () => {
    const clean = 'Most of the previous era\'s members are gone; the society is contracting.';
    expect(findLawAttribution(clean)).toEqual([]);
  });

  it('handles a non-string or empty input', () => {
    expect(findLawAttribution('')).toEqual([]);
    expect(findLawAttribution(null)).toEqual([]);
    expect(findLawAttribution(undefined)).toEqual([]);
  });

  it('can be given a custom dictionary so the rule itself is testable', () => {
    // MELT is only 4 letters, so it is excluded from the default scan; passing
    // it explicitly proves the matcher and the boundary rule work, rather than
    // proving anything about the default dictionary.
    expect(findLawAttribution('things melt', ['MELT'])).toEqual(['MELT']);
    expect(findLawAttribution('things melted', ['MELT'])).toEqual([]);
    expect(findLawAttribution('things held', ['MELT'])).toEqual([]);
  });

  it('covers every law index that is distinctive enough to scan', () => {
    const keys = lawScanKeys();
    const expected = Object.keys(LAW_INDEXES)
      .filter((k) => k.length >= LAW_SCAN_MIN_LENGTH || k.includes('_'));
    expect(keys.sort()).toEqual(expected.sort());
  });
});

describe('explainRegime', () => {
  it('states a well-evidenced regime as fact', () => {
    const e = explainRegime(entry());
    expect(e.regime).toBe(REGIME_NAMES.SETTLED);
    expect(e.asserted).toBe(true);
    expect(e.wellEvidenced).toBe(true);
    expect(e.statement).toBe(e.claim);
  });

  it('requires a continuity entry', () => {
    expect(() => explainRegime(null)).toThrow(TypeError);
  });

  it('refuses to explain an entry citing non-social evidence', () => {
    expect(() => explainRegime(entry({ evidence: ['GRAV'] }))).toThrow(/non-social evidence/);
  });

  it('has no parameter through which law state could arrive', () => {
    // The structural half of the guarantee: the function's arity leaves no
    // room to pass a law bitmask in.
    expect(explainRegime.length).toBeLessThanOrEqual(2);
  });

  it('hedges below the evidence threshold instead of guessing', () => {
    const e = explainRegime(entry({ evidence: ['first-observation'], confidence: 0.2 }));
    expect(e.asserted).toBe(false);
    expect(e.statement).toBe(e.hedge);
    expect(e.statement).not.toBe(e.claim);
  });

  it('hedges when confidence is below the floor even with enough evidence', () => {
    const e = explainRegime(entry({ confidence: ASSERTION_CONFIDENCE - 0.1 }));
    expect(e.evidence).toHaveLength(3);
    expect(e.wellEvidenced).toBe(false);
    expect(e.asserted).toBe(false);
  });

  it('applies its own confidence floor independently of the continuity gate', () => {
    // Three evidence items clears continuity.js's MIN_EVIDENCE, but the codex
    // additionally refuses to assert below its own floor.
    const e = explainRegime(entry({ confidence: 0.5 }));
    expect(e.evidence).toHaveLength(3);
    expect(e.asserted).toBe(false);
  });

  it('has distinct wording for each regime so a name is never interchangeable', () => {
    const claims = new Set();
    for (const regime of Object.values(REGIME_NAMES)) {
      claims.add(explainRegime(entry({ regime })).claim);
    }
    expect(claims.size).toBe(Object.values(REGIME_NAMES).length);
  });

  it('produces prose free of law attribution for every regime', () => {
    for (const regime of Object.values(REGIME_NAMES)) {
      const e = explainRegime(entry({ regime, confidence: 0.9 }));
      expect(findLawAttribution(e.statement)).toEqual([]);
      expect(findLawAttribution(e.hedge)).toEqual([]);
    }
  });

  it('keeps the shipped prose clear of the domain words that are also law names', () => {
    // Regression pin. This repository has laws named CULTURE, OBSERVER and
    // PATTERN — all ordinary words in this domain. The first draft of the
    // templates used all three and the guard (correctly) refused to file every
    // statement. The prose was reworded rather than the dictionary weakened,
    // so a real law citation can never be smuggled past the check.
    for (const word of ['culture', 'observer', 'pattern']) {
      const isLaw = word.toUpperCase() in LAW_INDEXES;
      expect(isLaw).toBe(true);
      for (const regime of Object.values(REGIME_NAMES)) {
        const e = explainRegime(entry({ regime, confidence: 0.9 }));
        const prose = `${e.statement} ${e.hedge}`.toLowerCase();
        expect(new RegExp(`(?<![a-z])${word}(?![a-z])`).test(prose)).toBe(false);
      }
    }
  });

  it('files a statement for every regime under the real dictionary', () => {
    // End-to-end: the guard must not be so strict that it blocks legitimate
    // narration. If this fails, a template has picked up a law name again.
    const c = createCodex();
    for (const regime of Object.values(REGIME_NAMES)) {
      expect(recordCodexEntry(c, entry({ regime, confidence: 0.9 })).ok).toBe(true);
    }
    expect(c.rejected).toHaveLength(0);
  });

  it('clamps a nonsense confidence into range', () => {
    expect(explainRegime(entry({ confidence: 5 })).confidence).toBe(1);
    expect(explainRegime(entry({ confidence: -3 })).confidence).toBe(0);
  });
});

describe('recordCodexEntry', () => {
  it('files a statement with its evidence and confidence', () => {
    const c = createCodex();
    const res = recordCodexEntry(c, entry());
    expect(res.ok).toBe(true);
    expect(res.entry.source).toBe(CODEX_SOURCES.CONTINUITY);
    expect(res.entry.evidence).toEqual([
      'stable-without-institutions', 'member-retention', 'group-retention',
    ]);
    expect(res.entry.confidence).toBe(0.8);
    expect(latestCodexEntry(c).id).toBe(res.entry.id);
  });

  it('rejects a missing entry rather than filing an empty claim', () => {
    const c = createCodex();
    expect(recordCodexEntry(c, null)).toEqual({ ok: false, reason: 'no-continuity-entry' });
    expect(c.entries).toHaveLength(0);
  });

  it('refuses non-social evidence and records why', () => {
    const c = createCodex();
    const res = recordCodexEntry(c, entry({ evidence: ['ENERGY rose'] }));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/non-social evidence/);
    expect(c.entries).toHaveLength(0);
    expect(c.rejected).toHaveLength(1);
  });

  it('refuses to file prose that attributes the state to a law', () => {
    const c = createCodex();
    // The structural check cannot see inside a template string, so this is the
    // guard that catches a bad wording edit. SOCIETY is supplied as the scan
    // dictionary because the collapsing template genuinely contains the word
    // "society" — the same shape as the real CULTURE/OBSERVER/PATTERN
    // collisions the shipped prose is worded around.
    const res = recordCodexEntry(c, entry({ regime: REGIME_NAMES.COLLAPSING }), { keys: ['SOCIETY'] });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/law attribution/);
    expect(res.violations).toContain('SOCIETY');
    expect(c.entries).toHaveLength(0);
    expect(c.rejected).toHaveLength(1);
  });

  it('accepts the same entry when the dictionary does not collide', () => {
    const c = createCodex();
    expect(recordCodexEntry(c, entry({ regime: REGIME_NAMES.COLLAPSING }), { keys: ['CATALYSIS_LAW'] }).ok).toBe(true);
  });

  it('surfaces the refusal reason in the report', () => {
    const c = createCodex();
    recordCodexEntry(c, entry({ evidence: ['nonsense'] }));
    expect(codexReport(c).refused).toMatch(/non-social evidence/);
  });

  it('bounds the catalog and the refusal ring', () => {
    const c = createCodex({ cap: 2 });
    for (let i = 0; i < 4; i++) recordCodexEntry(c, entry({ era: i, tick: i }));
    expect(c.entries).toHaveLength(2);
    expect(c.entries.map((e) => e.era)).toEqual([2, 3]);
    for (let i = 0; i < 4; i++) recordCodexEntry(c, entry({ evidence: ['nope'] }));
    expect(c.rejected).toHaveLength(2);
  });

  it('enforces a minimum cap for an explicit zero', () => {
    expect(createCodex({ cap: 0 }).cap).toBe(2);
  });
});

describe('recordLatestCodexEntry', () => {
  it('explains the newest continuity entry', () => {
    const civ = createCivilizationRegistry();
    const gr = groupRegistry({ g1: { members: [1, 2] } });
    const continuity = createContinuityCatalog();
    recordEraContinuity(continuity, civ, gr, { tick: 1, era: 1, name: 'One' });
    const c = createCodex();
    const res = recordLatestCodexEntry(c, continuity);
    expect(res.ok).toBe(true);
    expect(res.entry.era).toBe(1);
  });

  it('does nothing when the continuity catalog is empty', () => {
    const c = createCodex();
    expect(recordLatestCodexEntry(c, createContinuityCatalog()).ok).toBe(false);
    expect(recordLatestCodexEntry(c, null).ok).toBe(false);
  });

  it('hedges on a first observation rather than naming a regime', () => {
    const continuity = createContinuityCatalog();
    recordEraContinuity(continuity, createCivilizationRegistry(), groupRegistry({ g1: { members: [5] } }), { tick: 1 });
    const res = recordLatestCodexEntry(createCodex(), continuity);
    expect(res.entry.asserted).toBe(false);
    expect(res.entry.statement).toBe(res.entry.hedge);
  });
});

describe('codexReport', () => {
  it('reports an empty codex without throwing', () => {
    expect(codexReport(createCodex())).toMatchObject({
      entries: 0, latest: null, statement: 'no era observed yet', refused: null,
    });
  });

  it('separates stated claims from admitted uncertainty', () => {
    const c = createCodex();
    recordCodexEntry(c, entry({ regime: REGIME_NAMES.SETTLED, confidence: 0.9 }));
    recordCodexEntry(c, entry({ regime: REGIME_NAMES.EMERGENT, evidence: ['first-observation'], confidence: 0.2 }));
    const rep = codexReport(c);
    expect(rep.entries).toBe(2);
    expect(rep.asserted).toBe(1);
    expect(rep.admitted).toBe(1);
    // The report leads with the newest statement, whatever its strength.
    expect(rep.latest).toBe(REGIME_NAMES.EMERGENT);
    expect(rep.wellEvidenced).toBe(false);
  });

  it('counts only the evidence stems, not the raw suffixed tokens', () => {
    const c = createCodex();
    recordCodexEntry(c, entry({ evidence: ['member-retention-0.5', 'group-retention-0.5'] }));
    expect(codexReport(c).evidence).toBe(2);
  });

  it('counts the evidence behind the latest statement', () => {
    const c = createCodex();
    recordCodexEntry(c, entry({ evidence: ['member-retention-1', 'group-retention-1'], confidence: 0.8 }));
    expect(codexReport(c).evidence).toBe(2);
  });
});

describe('codex serialization', () => {
  it('round-trips entries', () => {
    const c = createCodex();
    recordCodexEntry(c, entry({ era: 2, tick: 99 }));
    const back = restoreCodex(serializeCodex(c));
    expect(back.entries).toHaveLength(1);
    expect(back.entries[0].era).toBe(2);
    expect(back.entries[0].statement).toBe(c.entries[0].statement);
    expect(back.tick).toBe(99);
  });

  it('restores an empty catalog from a missing snapshot', () => {
    const back = restoreCodex(null);
    expect(back.entries).toEqual([]);
    expect(codexReport(back).entries).toBe(0);
  });

  it('does not alias the original entries', () => {
    const c = createCodex();
    recordCodexEntry(c, entry());
    const back = restoreCodex(serializeCodex(c));
    back.entries[0].statement = 'tampered';
    expect(c.entries[0].statement).not.toBe('tampered');
  });

  it('applies the cap when restoring', () => {
    const c = createCodex();
    for (let i = 0; i < 5; i++) recordCodexEntry(c, entry({ era: i }));
    const back = restoreCodex(serializeCodex({ ...c, cap: 3 }));
    expect(back.entries).toHaveLength(3);
  });
});
