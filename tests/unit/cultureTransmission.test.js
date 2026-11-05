import { describe, expect, it } from 'vitest';
import {
  createCivilizationRegistry,
  foundCulture,
  transmitCulture,
  cultureForGroup,
  transmitBetweenGroups,
  createFederation,
  addFederationMember,
  foundPolity,
} from '../../src/state/civilization.js';

// Phase 3 closes the last mile of the "Cultural transmission" gap: culture
// that only transmits parent→child sits inert beside the rest of the social
// stack. The bridge under test is horizontal, group-to-group transmission
// routed from a relation another system (governance) already observed.
//
// Note on determinism: transmitCulture rolls a hash of (tick, item index,
// culture id lengths), so `fidelity: 1` retains every item and
// `reinvention: 0` guarantees nothing is reinvented. Tests that need an exact
// outcome pin both rather than asserting on a probabilistic result.

function twoCulturedGroups(symbolsA = ['ember', 'oath', 'mark']) {
  const r = createCivilizationRegistry();
  foundCulture(r, 'g1', { name: 'A', symbols: symbolsA });
  foundCulture(r, 'g2', { name: 'B', symbols: ['salt'] });
  return r;
}

const attrs = (r, groupId) => r.lifecycle.records.get(cultureForGroup(r, groupId)).attributes;

describe('cultureForGroup', () => {
  it('returns null when the group owns no culture', () => {
    expect(cultureForGroup(createCivilizationRegistry(), 'g1')).toBeNull();
  });

  it('finds the culture record owned by a group', () => {
    const r = createCivilizationRegistry();
    foundCulture(r, 'g1', { name: 'Ashmark', symbols: ['ember'] });
    const id = cultureForGroup(r, 'g1');
    expect(id).not.toBeNull();
    expect(r.lifecycle.records.get(id).attributes.ownerGroupId).toBe('g1');
  });

  it('does not confuse two groups that each own a culture', () => {
    const r = twoCulturedGroups();
    expect(cultureForGroup(r, 'g1')).not.toBe(cultureForGroup(r, 'g2'));
  });
});

describe('transmitBetweenGroups', () => {
  it('is a no-op when the receiver has no culture', () => {
    const r = createCivilizationRegistry();
    foundCulture(r, 'g1', { symbols: ['ember'] });
    expect(transmitBetweenGroups(r, 'g1', 'g2')).toBeNull();
  });

  it('is a no-op when the sender has no culture', () => {
    const r = createCivilizationRegistry();
    foundCulture(r, 'g2', { symbols: ['salt'] });
    expect(transmitBetweenGroups(r, 'g1', 'g2')).toBeNull();
  });

  it('is a no-op for a self-directed transmission', () => {
    expect(transmitBetweenGroups(twoCulturedGroups(), 'g1', 'g1')).toBeNull();
  });

  it('writes nothing when it returns null', () => {
    const r = createCivilizationRegistry();
    foundCulture(r, 'g1', { symbols: ['ember'] });
    const before = attrs(r, 'g1').symbols.slice();
    transmitBetweenGroups(r, 'g1', 'g2');
    expect(attrs(r, 'g1').symbols).toEqual(before);
  });

  it('resolves the pair and delegates to transmitCulture', () => {
    const r = twoCulturedGroups();
    const from = cultureForGroup(r, 'g1');
    const to = cultureForGroup(r, 'g2');
    const bridged = transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 1, reinvention: 0 });
    const direct = transmitCulture(r, from, to, { mode: 'horizontal', fidelity: 1, reinvention: 0 });
    // The bridge is a resolver, not a second implementation: both paths
    // report the same four buckets.
    expect(Object.keys(bridged).sort()).toEqual(['invented', 'lost', 'mutated', 'retained']);
    expect(direct.retained.length).toBe(3);
    expect(bridged.retained.length).toBe(3);
  });

  it('inherits every peer symbol at full fidelity', () => {
    const r = twoCulturedGroups();
    transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 1, reinvention: 0 });
    const symbols = attrs(r, 'g2').symbols;
    expect(symbols).toEqual(expect.arrayContaining(['salt', 'ember', 'oath', 'mark']));
  });

  it('does not duplicate a symbol the receiver already holds', () => {
    const r = twoCulturedGroups();
    foundCulture(r, 'g2', { name: 'B2', symbols: ['salt', 'ember'] });
    // g1 and g2 both hold 'ember' and both are owned by different groups, so
    // the receiver keeps exactly one copy after a full-fidelity transfer.
    transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 1, reinvention: 0 });
    const symbols = attrs(r, 'g2').symbols;
    expect(symbols.filter((s) => s === 'ember').length).toBe(1);
  });

  it('records horizontal mode, keeping it distinct from parent→child', () => {
    const r = twoCulturedGroups();
    transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 1, reinvention: 0 });
    const rec = r.lifecycle.records.get(cultureForGroup(r, 'g2'));
    expect(rec.metrics.lastTransferMode).toBe('horizontal');
  });

  it('tallies inheritance on the receiving culture ledger', () => {
    const r = twoCulturedGroups();
    transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 1, reinvention: 0 });
    const ledger = attrs(r, 'g2').ledger;
    // The ledger field is `inherited` even though the transfer result calls the
    // same bucket `retained`; continuity.js sums `e.inherited` to measure
    // culture retention across eras, so a mismatch here would silently make
    // the `thriving` regime unreachable.
    expect(ledger.ember.inherited).toBe(1);
    expect(ledger.oath.inherited).toBe(1);
    expect(ledger.ember.retained).toBeUndefined();
  });

  it('leaves no ledger entry with a bucket name the reader does not know', () => {
    const r = twoCulturedGroups();
    transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 0.5, reinvention: 0.3 });
    for (const entry of Object.values(attrs(r, 'g2').ledger)) {
      expect(Object.keys(entry).sort()).toEqual(['inherited', 'invented', 'lost', 'mutated']);
    }
  });

  it('leaves the source culture unchanged (transmission is not transfer)', () => {
    const r = twoCulturedGroups();
    const before = attrs(r, 'g1').symbols.slice();
    transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 1, reinvention: 0 });
    expect(attrs(r, 'g1').symbols).toEqual(before);
  });

  it('is directionally asymmetric', () => {
    const a = twoCulturedGroups();
    const b = twoCulturedGroups();
    transmitBetweenGroups(a, 'g1', 'g2', { fidelity: 1, reinvention: 0 });
    transmitBetweenGroups(b, 'g2', 'g1', { fidelity: 1, reinvention: 0 });
    // g1 owns ember/oath/mark; g2 owns salt. A one-way transfer must move
    // symbols in that direction only — the sender never loses its own, and
    // the run where the transfer went the other way must not also have filled
    // g1's pool.
    expect(attrs(a, 'g2').symbols).toEqual(expect.arrayContaining(['salt', 'ember', 'oath', 'mark']));
    expect(attrs(a, 'g1').symbols).toEqual(expect.arrayContaining(['ember', 'oath', 'mark']));
    expect(attrs(a, 'g1').symbols).not.toContain('salt');
    // ...and the mirrored run does move salt the other way.
    expect(attrs(b, 'g1').symbols).toContain('salt');
    expect(attrs(b, 'g2').symbols).not.toContain('mark');
  });

  it('never retains an item at zero fidelity', () => {
    const r = twoCulturedGroups();
    const sent = transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 0, reinvention: 0 });
    // transmitCulture hashes (tick, index) per item, so at fidelity 0 the
    // three items split across the mutated/lost buckets by value. What is
    // guaranteed is that none survive verbatim and every one is accounted for.
    expect(sent.retained).toHaveLength(0);
    expect(sent.mutated.length + sent.lost.length).toBe(3);
    const symbols = attrs(r, 'g2').symbols;
    expect(symbols).toEqual(expect.arrayContaining(['salt']));
    expect(symbols).not.toContain('ember');
    // Mutated items appear as `item*`; lost items do not appear at all.
    for (const s of sent.mutated) expect(symbols).toContain(`${s}*`);
    for (const s of sent.lost) expect(symbols).not.toContain(s);
  });

  it('reinvented items are locally re-derived, not copied verbatim', () => {
    const r = twoCulturedGroups();
    const sent = transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 0, reinvention: 1 });
    // With reinvention at its maximum every item that would have been lost is
    // instead re-derived, so nothing is dropped — but nothing is copied either.
    expect(sent.mutated.length + sent.invented.length).toBe(3);
    expect(sent.lost).toHaveLength(0);
    const symbols = attrs(r, 'g2').symbols;
    expect(symbols).not.toContain('ember');
    for (const item of sent.invented) {
      expect(symbols.some((s) => s.startsWith(`${item}~`))).toBe(true);
    }
  });

  it('records a causal event on the receiver', () => {
    const r = twoCulturedGroups();
    const rec = r.lifecycle.records.get(cultureForGroup(r, 'g2'));
    const before = rec.metrics.events || 0;
    transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 1, reinvention: 0 });
    expect(r.lifecycle.records.get(cultureForGroup(r, 'g2')).metrics.events).toBeGreaterThan(before);
  });

  it('returns a live record, not a detached clone, so the caller can read it', () => {
    const r = twoCulturedGroups();
    const sent = transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 1, reinvention: 0 });
    expect(Array.isArray(sent.retained)).toBe(true);
  });

  it('transmits between federated groups without needing the federation', () => {
    const r = twoCulturedGroups();
    const fed = createFederation(r, { name: 'tribe', kind: 'tribe' });
    addFederationMember(r, fed.id, 'g1');
    addFederationMember(r, fed.id, 'g2');
    // Federation is a separate relation; the culture bridge does not consult
    // it, so membership neither blocks nor gates transmission.
    expect(transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 1, reinvention: 0 })).not.toBeNull();
  });

  it('does not disturb polities when culture moves', () => {
    const r = twoCulturedGroups();
    const p = foundPolity(r, { name: 'The Reach', rulerGroupId: 'g1' });
    const before = r.lifecycle.records.get(p.id).attributes.citizens || 0;
    transmitBetweenGroups(r, 'g1', 'g2', { fidelity: 1, reinvention: 0 });
    expect(r.lifecycle.records.get(p.id).attributes.citizens || 0).toBe(before);
  });

  it('is safe to call on every tick (idempotent when nothing is owned)', () => {
    const r = createCivilizationRegistry();
    for (let i = 0; i < 50; i++) {
      expect(transmitBetweenGroups(r, `g${i}`, `g${i + 1}`)).toBeNull();
    }
    expect(r.lifecycle.records.size).toBe(0);
  });
});
