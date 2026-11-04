/**
 * VEPA4 — Codex ontology (sequel Phase 6).
 *
 * Closes the last row of docs/systems/implementation-gaps.md:
 *   "Codex ontology | narrative and analytics | observer-generated regime
 *    names with evidence and confidence"
 *
 * The rule this module exists to enforce is negative, and it is the whole
 * point: an explanation may only ever be built from measured social evidence
 * and its confidence. It must never be reconstructed from which laws happen
 * to be enabled. "GRAV is on, therefore they are collapsing" is a fiction —
 * the same law set produces thriving, empty and collapsed worlds depending on
 * population, and the codex is only allowed to say which one it actually
 * observed.
 *
 * Two independent mechanisms keep that honest, because a comment is not a
 * guarantee:
 *
 *   1. Structural — `explainRegime` takes a continuity entry and nothing else.
 *      It has no parameter through which law state could arrive, and every
 *      evidence token it will accept must match a stem in SOCIAL_EVIDENCE.
 *      A token that is not a social measurement is a hard error, not a guess.
 *
 *   2. Textual — `findLawAttribution` scans the finished prose for law
 *      identifiers and `recordCodexEntry` refuses to file an entry that fails.
 *      This catches the failure mode the structural check cannot: a template
 *      edit that accidentally reintroduces a law name into the wording.
 *
 * The second mechanism is calibrated rather than paranoid. Very short law
 * identifiers (LIFE, HEAT, VOID, MIND, ...) collide with ordinary words an
 * explanation legitimately uses, so they are only matched when they are long
 * enough to be distinctive or when they carry an underscore, which no English
 * word does. The rule is exported so it is auditable and testable rather than
 * hidden.
 *
 * Below the evidence threshold the codex is required to say it does not know.
 * `isRegimeWellEvidenced` is the same gate continuity.js uses, so the codex
 * cannot quietly disagree with the catalog it is describing.
 */

import { clamp01, finite } from '../core/numeric.js';
import { LAW_INDEXES } from '../constants.js';
import { isRegimeWellEvidenced } from './continuity.js';

/** Where an explanation is allowed to get its material. */
export const CODEX_SOURCES = Object.freeze({
  CONTINUITY: 'continuity',
});

/**
 * The complete set of evidence stems a codex statement may cite.
 *
 * These are exactly the measurements continuity.js derives from the social
 * fingerprint: group membership, group count, cultural inheritance, cultural
 * invention, institution depth, and the absence of a prior sample. Nothing
 * physical and nothing configurable appears here, which is what makes the
 * allow-list a real constraint rather than documentation.
 */
export const SOCIAL_EVIDENCE = Object.freeze([
  'no-surviving-groups',
  'member-retention',
  'group-retention',
  'population-or-culture-under-pressure',
  'institutions-and-culture-persisting',
  'stable-without-institutions',
  'first-observation',
]);

/**
 * Longest law identifier we treat as "distinctive enough to scan for".
 * Four-letter keys (LIFE, HEAT, VOID, BOND, MIND, WILL, DRAG, FATE, BOIL) are
 * ordinary English words and are excluded from the prose scan.
 */
export const LAW_SCAN_MIN_LENGTH = 5;

/** Law identifiers the prose scan refuses to trust on substring matching. */
export function lawScanKeys(lawIndexes = LAW_INDEXES) {
  return Object.keys(lawIndexes).filter(
    (k) => k.length >= LAW_SCAN_MIN_LENGTH || k.includes('_'),
  );
}

/**
 * Return the evidence stem a token belongs to, or null.
 *
 * continuity.js emits suffixed tokens such as `member-retention-0.42` so the
 * number is part of the record, but the classification is about the
 * measurement, not the value.
 */
export function classifyEvidence(token) {
  if (typeof token !== 'string') return null;
  for (const stem of SOCIAL_EVIDENCE) {
    if (token === stem || token.startsWith(stem + '-')) return stem;
  }
  return null;
}

/**
 * Throw unless every evidence token is a recognised social measurement.
 * This is the structural guarantee: an unrecognised token is a caller bug or
 * a new measurement that has not been reviewed for civility, and guessing at
 * its meaning would be exactly the behaviour the codex forbids.
 */
export function assertSocialEvidence(evidence) {
  if (!Array.isArray(evidence)) throw new TypeError('codex: evidence must be an array');
  const unknown = evidence.filter((t) => classifyEvidence(t) === null);
  if (unknown.length) {
    throw new Error(
      `codex: refusing to cite non-social evidence ${JSON.stringify(unknown)}; `
      + `an explanation may only rest on ${SOCIAL_EVIDENCE.join(', ')}`,
    );
  }
  return evidence.map(classifyEvidence);
}

/**
 * Find law identifiers appearing as standalone words in `text`.
 *
 * Matching is case-insensitive and word-boundary based so `MELT` is found in
 * "they melt" but not inside "melting-pot". Returns the offending keys.
 */
export function findLawAttribution(text, keys = lawScanKeys()) {
  if (typeof text !== 'string' || !text) return [];
  const haystack = text.toLowerCase();
  const hits = [];
  for (const key of keys) {
    const needle = key.toLowerCase();
    const re = new RegExp(`(?<![a-z0-9])${needle}(?![a-z0-9])`, 'i');
    if (re.test(haystack)) hits.push(key);
  }
  return hits;
}

/** Minimum confidence before the codex will state a regime as fact. */
export const ASSERTION_CONFIDENCE = 0.6;

// Prose note: these templates are scanned by `findLawAttribution`, and this
// repository has laws literally named CULTURE, OBSERVER and PATTERN — all
// three are also ordinary words in this domain. Rather than weaken the guard's
// dictionary (which would let a genuine law citation through unnoticed), the
// templates are worded around the collisions. `codex.test.js` pins this.
const CLAIM_TEMPLATES = Object.freeze({
  empty: 'No group retained any members into this era.',
  collapsing: 'Most of the previous era\'s members are gone; the society is contracting.',
  fragmenting: 'The population largely held, but fewer groups survived to carry it.',
  strained: 'The society is under strain on either its membership or its inherited symbols.',
  thriving: 'Inherited symbols and standing institutions both persisted across the boundary.',
  settled: 'Membership and groups held steady, with no institutions yet to speak of.',
  emergent: 'A first reading only; there is no prior era to compare against.',
});

const HEDGE_TEMPLATES = Object.freeze({
  empty: 'Nothing is left to compare, so the record notes an absence rather than a trend.',
  collapsing: 'The drop is real but not yet corroborated across enough readings.',
  fragmenting: 'The group count moved, but the evidence for a lasting shape is thin.',
  strained: 'Something in the membership or its symbols moved, and the reading cannot yet say which.',
  thriving: 'Inherited symbols and institutions both held, though only briefly seen.',
  settled: 'Little changed; the record does not yet have enough runs to call this a regime.',
  emergent: 'A single reading cannot establish a regime at all.',
});

/**
 * Turn a continuity entry into a stated or hedged explanation.
 *
 * @param {object} entry  a continuity catalog entry (regime, evidence,
 *                        confidence, continuity, rationale)
 * @param {object} [opts] { keys } to override the law scan dictionary (tests)
 * @returns {{claim:string, hedge:string, regime:string, confidence:number,
 *            evidence:string[], wellEvidenced:boolean, asserted:boolean,
 *            continuity:object}}
 * @throws when the entry cites evidence that is not a social measurement
 */
export function explainRegime(entry, opts = {}) {
  if (!entry) throw new TypeError('codex: explainRegime requires a continuity entry');
  const evidence = assertSocialEvidence(entry.evidence || []);
  const regime = entry.regime;
  const template = CLAIM_TEMPLATES[regime] || CLAIM_TEMPLATES.settled;
  const hedge = HEDGE_TEMPLATES[regime] || HEDGE_TEMPLATES.settled;

  // Two gates, deliberately both required. continuity.js owns the evidence
  // count; the codex additionally owns its own confidence floor, so lowering
  // one without the other cannot silently promote a guess to a fact.
  const wellEvidenced = isRegimeWellEvidenced(entry)
    && clamp01(finite(entry.confidence, 0)) >= ASSERTION_CONFIDENCE;

  return {
    regime,
    claim: template,
    hedge,
    // Below the gate the observer says so instead of picking a side.
    statement: wellEvidenced ? template : hedge,
    confidence: clamp01(finite(entry.confidence, 0)),
    evidence,
    wellEvidenced,
    asserted: wellEvidenced,
    continuity: entry.continuity || {},
  };
}

/** Create the codex. Bounded: the observer does not keep every thought. */
export function createCodex(options = {}) {
  return {
    entries: [],
    rejected: [],   // bounded ring of refusals, so the guard is observable
    // See continuity.js: an explicit cap of 0 must clamp to the minimum, not
    // fall through to the default.
    cap: Math.max(2, Math.floor(Number.isFinite(options.cap) ? options.cap : 16)),
    source: CODEX_SOURCES.CONTINUITY,
    tick: 0,
  };
}

/**
 * Explain a continuity entry and file it.
 *
 * Returns the filed entry, or `{ ok: false, reason }` when the guard refused
 * it. Refusals are recorded on the catalog rather than thrown, because a bad
 * explanation should be visible in the UI, not crash the simulation loop.
 */
export function recordCodexEntry(catalog, entry, opts = {}) {
  if (!entry) return { ok: false, reason: 'no-continuity-entry' };

  let explanation;
  try {
    explanation = explainRegime(entry, opts);
  } catch (err) {
    const rejection = { tick: finite(entry.tick, catalog.tick), reason: err.message, evidence: entry.evidence || [] };
    catalog.rejected.push(rejection);
    while (catalog.rejected.length > catalog.cap) catalog.rejected.shift();
    return { ok: false, reason: err.message };
  }

  // Defence in depth: the structural guarantee above cannot see the inside of
  // a template string, so the finished prose is checked as well.
  const keys = opts.keys || lawScanKeys();
  const violations = findLawAttribution(explanation.statement, keys)
    .concat(findLawAttribution(explanation.hedge, keys));
  if (violations.length) {
    const reason = `law attribution in prose: ${violations.join(', ')}`;
    const rejection = { tick: entry.tick, reason, evidence: explanation.evidence };
    catalog.rejected.push(rejection);
    while (catalog.rejected.length > catalog.cap) catalog.rejected.shift();
    return { ok: false, reason, violations };
  }

  const record = {
    id: `codex:${catalog.entries.length + 1}`,
    era: finite(entry.era, catalog.entries.length),
    tick: finite(entry.tick, catalog.tick),
    name: entry.name || `era-${catalog.entries.length}`,
    source: CODEX_SOURCES.CONTINUITY,
    regime: explanation.regime,
    statement: explanation.statement,
    claim: explanation.claim,
    hedge: explanation.hedge,
    confidence: explanation.confidence,
    evidence: explanation.evidence,
    wellEvidenced: explanation.wellEvidenced,
    asserted: explanation.asserted,
    continuity: explanation.continuity,
  };
  catalog.entries.push(record);
  while (catalog.entries.length > catalog.cap) catalog.entries.shift();
  catalog.tick = record.tick;
  return { ok: true, entry: record };
}

/**
 * Explain the latest continuity entry and file it. Convenience for the era
 * boundary path, which is the only place the codex should speak from.
 */
export function recordLatestCodexEntry(catalog, continuityCatalog, opts = {}) {
  const latest = continuityCatalog && continuityCatalog.entries.length
    ? continuityCatalog.entries[continuityCatalog.entries.length - 1]
    : null;
  return recordCodexEntry(catalog, latest, opts);
}

/** The most recent codex entry, or null. */
export function latestCodexEntry(catalog) {
  return catalog.entries.length ? catalog.entries[catalog.entries.length - 1] : null;
}

/** Bounded report for the UI. Separates stated facts from admitted unknowns. */
export function codexReport(catalog) {
  const latest = latestCodexEntry(catalog);
  const stated = catalog.entries.filter((e) => e.asserted).length;
  const lastRejection = catalog.rejected.length
    ? catalog.rejected[catalog.rejected.length - 1]
    : null;
  return {
    entries: catalog.entries.length,
    latest: latest ? latest.regime : null,
    statement: latest ? latest.statement : 'no era observed yet',
    confidence: latest ? latest.confidence : 0,
    evidence: latest ? latest.evidence.length : 0,
    wellEvidenced: latest ? latest.wellEvidenced : false,
    asserted: stated,
    admitted: catalog.entries.length - stated,
    rejected: catalog.rejected.length,
    // Surfaced so the UI can show *why* the observer stayed silent instead of
    // leaving the reader to assume there was simply nothing to say.
    refused: lastRejection ? lastRejection.reason : null,
    tick: catalog.tick,
  };
}

export function serializeCodex(catalog) {
  return {
    cap: catalog.cap,
    tick: catalog.tick,
    entries: catalog.entries.map((e) => ({ ...e })),
  };
}

export function restoreCodex(snapshot) {
  const catalog = createCodex({ cap: snapshot && snapshot.cap });
  if (!snapshot) return catalog;
  catalog.tick = finite(snapshot.tick, 0);
  for (const e of snapshot.entries || []) catalog.entries.push({ ...e });
  while (catalog.entries.length > catalog.cap) catalog.entries.shift();
  return catalog;
}
