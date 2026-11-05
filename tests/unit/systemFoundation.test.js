import { describe, expect, it } from 'vitest';
import {
  SYSTEM_FOUNDATION,
  SYSTEM_FOUNDATION_ORDER,
  getSystemFoundation,
  getSystemFoundationReport,
} from '../../src/state/systemFoundation.js';

describe('system foundation registry', () => {
  it('orders all documented systems from smallest to broadest implementation', () => {
    expect(SYSTEM_FOUNDATION_ORDER).toHaveLength(12);
    expect(SYSTEM_FOUNDATION_ORDER[0]).toBe('family-kinship');
    expect(SYSTEM_FOUNDATION_ORDER.at(-1)).toBe('species-lineage');
    expect(SYSTEM_FOUNDATION_ORDER.every((id, index) => SYSTEM_FOUNDATION[id].breadthRank === index + 1)).toBe(true);
  });

  it('marks Phase 1 complete without claiming missing ontology is implemented', () => {
    const family = getSystemFoundation('family-kinship');
    const ecology = getSystemFoundation('ecology');
    expect(family.phaseOne.status).toBe('complete');
    // family-kinship gained real runtime entities in src/state/civilization.js
    // (2026-09-30) and is now an honest 'proxy'. The contract this test protects
    // is that we never overclaim: it must NOT be 'implemented', because kin
    // recognition is derived bookkeeping, not a simulation of kinship.
    expect(family.evidence).toBe('proxy');
    expect(family.evidence).not.toBe('implemented');
    expect(family.sourceAnchors).toContain('src/state/civilization.js');
    expect(ecology.evidence).toBe('implemented');
    expect(family.phaseOne.guarantees).toContain('no new particle-stride fields');
  });

  it('no longer reports any system as a bare scaffold', () => {
    // All twelve systems now have a runtime anchor set; none is identity-only.
    const report = getSystemFoundationReport();
    expect(report.every((s) => s.evidence !== 'scaffold')).toBe(true);
    expect(report.every((s) => s.sourceAnchors.length > 0)).toBe(true);
  });

  it('returns defensive report copies', () => {
    const report = getSystemFoundationReport();
    report[0].sourceAnchors.push('test');
    expect(getSystemFoundation('family-kinship').sourceAnchors).not.toContain('test');
  });
});
