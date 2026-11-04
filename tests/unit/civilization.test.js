import { describe, expect, it } from 'vitest';
import {
  createCivilizationRegistry,
  foundCulture,
  transmitCulture,
  recordKin,
  getKin,
  kinStrength,
  createHousehold,
  joinHousehold,
  householdOf,
  flowKinResources,
  createFederation,
  addFederationMember,
  linkFederation,
  fissionFederation,
  fuseFederations,
  foundPolity,
  claimTerritory,
  addProvince,
  grantCitizenship,
  revokeCitizenship,
  foundInstitution,
  nominateSuccessor,
  installSuccessor,
  stepCivilization,
  civilizationReport,
  serializeCivilization,
  restoreCivilization,
  CIVILIZATION_SYSTEMS,
} from '../../src/state/civilization.js';

describe('culture transmission', () => {
  it('grounds cultures in durable lifecycle records', () => {
    const r = createCivilizationRegistry();
    const c = foundCulture(r, 'g1', { name: 'Ashmark', symbols: ['ember', 'oath'], norms: ['share'] });
    expect(c.id).toMatch(/^culture-memory:/);
    expect(c.phase).toBeGreaterThanOrEqual(2);
    expect(r.cultures.size).toBe(1);
    // Founding is itself a causal event, so the record advances to phase 3.
    expect(c.phase).toBe(3);
  });

  it('classifies every offered item as retained, mutated, lost, or invented', () => {
    const r = createCivilizationRegistry();
    const a = foundCulture(r, 'g1', { symbols: ['a', 'b', 'c', 'd', 'e', 'f'] });
    const b = foundCulture(r, 'g2');
    const out = transmitCulture(r, a.id, b.id, { fidelity: 0.5, reinvention: 0 });
    const accounted = out.retained.length + out.mutated.length + out.lost.length + out.invented.length;
    expect(accounted).toBe(6);
  });

  it('is deterministic for the same world state', () => {
    const build = () => {
      const r = createCivilizationRegistry();
      const a = foundCulture(r, 'g1', { symbols: ['a', 'b', 'c'] });
      const b = foundCulture(r, 'g2');
      return transmitCulture(r, a.id, b.id, { fidelity: 0.5 }).retained.join(',');
    };
    expect(build()).toBe(build());
  });

  it('honours fidelity: perfect retention keeps everything', () => {
    const r = createCivilizationRegistry();
    const a = foundCulture(r, 'g1', { symbols: ['x', 'y'] });
    const b = foundCulture(r, 'g2');
    const out = transmitCulture(r, a.id, b.id, { fidelity: 1, reinvention: 0 });
    expect(out.retained.sort()).toEqual(['x', 'y']);
  });

  it('refuses to transmit into itself and tolerates unknown ids', () => {
    const r = createCivilizationRegistry();
    const a = foundCulture(r, 'g1', { symbols: ['x'] });
    expect(transmitCulture(r, a.id, a.id).retained).toEqual([]);
    expect(transmitCulture(r, a.id, 'nope').retained).toEqual([]);
  });
});

describe('kinship and households', () => {
  it('records symmetric, accumulating kin edges', () => {
    const r = createCivilizationRegistry();
    const e1 = recordKin(r, 7, 3, { kind: 'parent', strength: 0.5 });
    expect(e1.a).toBe(3);
    expect(e1.b).toBe(7);
    const e2 = recordKin(r, 3, 7, { kind: 'parent', strength: 0.5 });
    expect(e2.strength).toBeGreaterThan(0.5);
    expect(getKin(r, 7, 3)).toBe(getKin(r, 3, 7));
  });

  it('never records self-kin', () => {
    const r = createCivilizationRegistry();
    expect(recordKin(r, 4, 4)).toBeNull();
    expect(kinStrength(r, 4)).toBe(0);
  });

  it('tracks household membership and kin resource flow', () => {
    const r = createCivilizationRegistry();
    createHousehold(r, 'hh1');
    joinHousehold(r, 'hh1', 1);
    joinHousehold(r, 'hh1', 2);
    expect(householdOf(r, 1).id).toBe('hh1');
    const moved = flowKinResources(r, 'hh1', 10, (id) => (id === 2 ? 1 : 0));
    expect(moved).toBeCloseTo(10);
    expect(flowKinResources(r, 'hh1', 10, () => 0)).toBe(0);
  });
});

describe('federation (tribe / clan)', () => {
  it('splits into a clan once the remainder drops below viability', () => {
    const r = createCivilizationRegistry();
    const f = createFederation(r, { name: 'Nine' });
    for (const g of ['a', 'b', 'c']) addFederationMember(r, f.id, g);
    // 3 -> 2 remaining is still viable (minViable = 2), so no split yet.
    expect(fissionFederation(r, f.id, 'c').newFederationId).toBeNull();
    // 2 -> 1 remaining is below viability, so the remainder becomes a clan.
    const { newFederationId } = fissionFederation(r, f.id, 'b');
    expect(newFederationId).toBeTruthy();
    const clan = r.lifecycle.records.get(newFederationId);
    expect(clan.attributes.kind).toBe('clan');
    expect(clan.attributes.members).toEqual(['a']);
    // the original is emptied, not left holding a phantom member
    expect(r.lifecycle.records.get(f.id).attributes.members).toEqual([]);
  });

  it('honours an explicit viability threshold', () => {
    // A single remaining group splits under minViable=2 but is accepted under
    // minViable=1, which proves the threshold is read rather than hardcoded.
    const mk = () => {
      const r = createCivilizationRegistry();
      const f = createFederation(r);
      addFederationMember(r, f.id, 'a');
      addFederationMember(r, f.id, 'b');
      return { r, f };
    };
    const strict = mk();
    expect(fissionFederation(strict.r, strict.f.id, 'b', { minViable: 2 }).newFederationId).toBeTruthy();

    const lax = mk();
    expect(fissionFederation(lax.r, lax.f.id, 'b', { minViable: 1 }).newFederationId).toBeNull();
  });

  it('fuses two federations and closes the absorbed one', () => {
    const r = createCivilizationRegistry();
    const keep = createFederation(r, { name: 'Keep' });
    const absorb = createFederation(r, { name: 'Absorb' });
    addFederationMember(r, keep.id, 'a');
    addFederationMember(r, absorb.id, 'b');
    linkFederation(r, keep.id, 'a', 'c', 0.5);
    fuseFederations(r, keep.id, absorb.id);
    expect(keep.attributes.members).toContain('b');
    expect(r.federations.has(absorb.id)).toBe(false);
    expect(r.lifecycle.records.get(absorb.id).status).toBe('closed');
  });
});

describe('polity (nation / state)', () => {
  it('accumulates jurisdiction and provinces', () => {
    const r = createCivilizationRegistry();
    const p = foundPolity(r, { name: 'Republic' });
    claimTerritory(r, p.id, { minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 10 });
    addProvince(r, p.id, 'north', ['g1']);
    addProvince(r, p.id, 'north', ['g2']);
    expect(p.attributes.provinces[0].groups).toEqual(['g1', 'g2']);
    expect(p.attributes.territory.maxX).toBe(10);
  });

  it('moves citizenship between polities without double counting', () => {
    const r = createCivilizationRegistry();
    const a = foundPolity(r);
    const b = foundPolity(r);
    grantCitizenship(r, 5, a.id);
    grantCitizenship(r, 5, b.id);
    expect(a.attributes.citizens).toBe(0);
    expect(b.attributes.citizens).toBe(1);
    revokeCitizenship(r, 5);
    expect(b.attributes.citizens).toBe(0);
  });

  it('refuses a successor who was not nominated or is not a citizen', () => {
    const r = createCivilizationRegistry();
    const p = foundPolity(r);
    nominateSuccessor(r, p.id, 9);
    expect(installSuccessor(r, p.id, 9)).toBeNull(); // not a citizen
    grantCitizenship(r, 9, p.id);
    expect(installSuccessor(r, p.id, 9)).not.toBeNull();
    expect(p.attributes.holderId).toBe(9);
    // a second, un-nominated claimant is rejected
    grantCitizenship(r, 10, p.id);
    expect(installSuccessor(r, p.id, 10)).toBeNull();
  });

  it('raises legitimacy and costs stability when founding an institution', () => {
    const r = createCivilizationRegistry();
    const p = foundPolity(r);
    const before = p.attributes.legitimacy;
    foundInstitution(r, p.id, 'GUILD');
    expect(p.attributes.legitimacy).toBeGreaterThan(before);
    // unknown institution kinds are ignored
    expect(foundInstitution(r, p.id, 'NOT_A_THING')).toBeNull();
  });
});

describe('civilization step, report, and persistence', () => {
  it('prunes kin and citizenship for particles that died', () => {
    const r = createCivilizationRegistry();
    recordKin(r, 1, 2);
    const p = foundPolity(r);
    grantCitizenship(r, 1, p.id);
    stepCivilization(r, { tick: 5, alive: new Set([3]) });
    expect(r.kinEdges.size).toBe(0);
    expect(r.citizenOf.size).toBe(0);
    expect(r.tick).toBe(5);
  });

  it('summarises the registry', () => {
    const r = createCivilizationRegistry();
    foundCulture(r, 'g1', { symbols: ['s'] });
    createFederation(r); addFederationMember(r, [...r.federations.keys()][0], 'g1');
    foundPolity(r);
    recordKin(r, 1, 2);
    const rep = civilizationReport(r);
    expect(rep.cultures).toBe(1);
    expect(rep.federations).toBe(1);
    expect(rep.polities).toBe(1);
    expect(rep.kinEdges).toBe(1);
  });

  it('round-trips through save/restore', () => {
    const r = createCivilizationRegistry();
    const c = foundCulture(r, 'g1', { symbols: ['s'] });
    const p = foundPolity(r, { name: 'R' });
    grantCitizenship(r, 4, p.id);
    createHousehold(r, 'hh'); joinHousehold(r, 'hh', 4);
    recordKin(r, 4, 5);
    const f = createFederation(r); addFederationMember(r, f.id, 'g1');

    const restored = restoreCivilization(serializeCivilization(r));
    expect(restored.cultures.size).toBe(1);
    expect(restored.citizenOf.get(4)).toBe(p.id);
    expect(restored.federations.size).toBe(1);
    expect(restored.households.get('hh').members.has(4)).toBe(true);
    expect(getKin(restored, 5, 4)).not.toBeNull();
    // lifecycle records survive, so evidence history is preserved
    expect(restored.lifecycle.records.get(c.id).metrics.events).toBeGreaterThan(0);
  });

  it('rejects an unknown snapshot version without throwing', () => {
    expect(restoreCivilization({ version: 99 }).cultures.size).toBe(0);
    expect(restoreCivilization(null).cultures.size).toBe(0);
  });

  it('uses the documented system ids', () => {
    expect(CIVILIZATION_SYSTEMS.CULTURE).toBe('culture-memory');
    expect(CIVILIZATION_SYSTEMS.POLITY).toBe('nation-polity');
  });
});
