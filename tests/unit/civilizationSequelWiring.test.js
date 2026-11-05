import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createStructureRegistry,
  foundStructure,
  structureForGroup,
  runMaintenance,
  structureReport,
} from '../../src/state/structures.js';
import {
  createContinuityCatalog,
  recordEraContinuity,
  latestRegime,
  regimeHistogram,
  isRegimeWellEvidenced,
} from '../../src/state/continuity.js';
import {
  createCodex,
  recordCodexEntry,
  codexReport,
  restoreCodex,
} from '../../src/state/codex.js';
import { createCivilizationRegistry } from '../../src/state/civilization.js';
import { createSystemLifecycle } from '../../src/state/systemLifecycle.js';
import { captureWorldState, restoreWorldState } from '../../src/state/worldSave.js';
import { PARTICLE_STRIDE } from '../../src/constants.js';
import { createLawState } from '../../src/state/lawState.js';

const MAIN = readFileSync('src/main.js', 'utf8');
const PANEL = readFileSync('src/ui/civilizationPanel.js', 'utf8');
const SAVE = readFileSync('src/state/worldSave.js', 'utf8');

function groupRegistry(spec) {
  const map = new Map();
  for (const [id, g] of Object.entries(spec || {})) {
    map.set(id, { id, members: new Set(g.members || []), treasury: g.treasury || 0 });
  }
  return { groups: map };
}

// Phases 3-6 all shipped as modules that would pass every unit test and still
// never run, which is exactly how the 464-line systemLifecycle.js substrate
// spent its life. These assertions read main.js as text and pin each phase to
// the orchestrator.

describe('Phase 4 — durable structures are wired into the app', () => {
  it('is imported by the orchestrator', () => {
    expect(MAIN).toMatch(/from '\.\/state\/structures\.js'/);
    expect(MAIN).toMatch(/createStructureRegistry/);
    expect(MAIN).toMatch(/foundStructure/);
    expect(MAIN).toMatch(/runMaintenance/);
    expect(MAIN).toMatch(/structureReport/);
  });

  it('is instantiated at boot', () => {
    expect(MAIN).toMatch(/structures = createStructureRegistry\(civilization\.lifecycle\)/);
  });

  it('is re-instantiated on reset so a restart leaves no orphan structures', () => {
    const resets = MAIN.match(/structures = createStructureRegistry\(civilization\.lifecycle\)/g) || [];
    // Boot + resetIntelligence: the same line twice, deliberately.
    expect(resets.length).toBeGreaterThanOrEqual(2);
    expect(MAIN).toMatch(/function resetIntelligence\(\)\s*\{[\s\S]*?structures = createStructureRegistry/);
  });

  it('runs maintenance on its own bounded cadence, not every tick', () => {
    expect(MAIN).toMatch(/tick % STRUCTURE_MAINTENANCE_INTERVAL === 0/);
    // Upkeep on every social tick would drain treasuries far too fast.
    expect(MAIN).not.toMatch(/runMaintenance\([^)]*tick % SOCIAL_CADENCE/);
  });

  it('bounds how many structures can exist', () => {
    expect(MAIN).toMatch(/MAX_STRUCTURES/);
    expect(MAIN).toMatch(/structures\.byId\.size >= MAX_STRUCTURES/);
  });

  it('looks up an existing structure by owner rather than guessing a record id', () => {
    // Record ids are allocated by the lifecycle substrate as
    // `infrastructure:<n>`, so a `has('infrastructure:group:1')` check would
    // never match and would found a new nest on every single pass.
    expect(MAIN).toMatch(/structureForGroup/);
    expect(MAIN).not.toMatch(/lifecycle\.records\.has\(`infrastructure:/);
  });

  it('emits a bus event so the simulation is observable', () => {
    expect(MAIN).toMatch(/bus\.emit\('structures:pass'/);
  });

  it('surfaces the structure report on the analytics event', () => {
    expect(MAIN).toMatch(/report\.structures = structures \? structureReport\(structures\)/);
  });

  it('is rendered by the civilization panel', () => {
    expect(PANEL).toMatch(/civ-structures/);
  });
});

describe('Phase 5 — continuity is wired into the app', () => {
  it('is imported by the orchestrator', () => {
    expect(MAIN).toMatch(/from '\.\/state\/continuity\.js'/);
    expect(MAIN).toMatch(/createContinuityCatalog/);
    expect(MAIN).toMatch(/recordEraContinuity/);
    expect(MAIN).toMatch(/latestRegime/);
    expect(MAIN).toMatch(/regimeHistogram/);
  });

  it('is instantiated at boot and on reset', () => {
    expect((MAIN.match(/continuity = createContinuityCatalog\(\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('samples only at an era boundary, never per tick', () => {
    // Continuity compares two worlds; sampling it every tick would compare a
    // world against itself and manufacture fake stability.
    expect(MAIN).toMatch(/bus\.on\('epoch:boundary'/);
    expect(MAIN).toMatch(/recordEraContinuity\(continuity, civilization, groupRegistry/);
  });

  it('surfaces the regime on the analytics event and in the panel', () => {
    expect(MAIN).toMatch(/report\.latestRegime = continuity \? latestRegime\(continuity\)/);
    expect(MAIN).toMatch(/report\.continuity = continuity \? regimeHistogram\(continuity\)/);
    expect(PANEL).toMatch(/civ-regime/);
    expect(PANEL).toMatch(/civ-confidence/);
  });
});

describe('Phase 6 — the codex is wired into the app', () => {
  it('is imported by the orchestrator', () => {
    expect(MAIN).toMatch(/from '\.\/state\/codex\.js'/);
    expect(MAIN).toMatch(/createCodex/);
    expect(MAIN).toMatch(/recordCodexEntry/);
    expect(MAIN).toMatch(/codexReport/);
  });

  it('is instantiated at boot and on reset', () => {
    expect((MAIN.match(/codex = createCodex\(\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('speaks only from the era boundary, i.e. from continuity evidence', () => {
    expect(MAIN).toMatch(/recordCodexEntry\(codex, entry\)/);
  });

  it('never hands law state to the codex', () => {
    // The whole contract of the module. If a lawState reference ever appears
    // near the codex calls, the guard has been routed around.
    const codexCalls = MAIN.match(/recordCodexEntry\([^)]*\)/g) || [];
    expect(codexCalls.length).toBeGreaterThan(0);
    for (const call of codexCalls) expect(call).not.toMatch(/law/i);
    const explainCalls = MAIN.match(/codexReport\([^)]*\)/g) || [];
    for (const call of explainCalls) expect(call).not.toMatch(/law/i);
  });

  it('routes a refused explanation to an explicit uncertainty event', () => {
    // When the guard declines, the app must say so rather than stay silent and
    // let the reader assume there was simply nothing to report.
    expect(MAIN).toMatch(/codex:uncertain/);
    expect(MAIN).toMatch(/if \(!filed\.ok\)/);
  });

  it('emits a regime event only when the evidence supports an assertion', () => {
    expect(MAIN).toMatch(/bus\.emit\(c\.asserted \? 'codex:regime' : 'codex:uncertain'/);
  });

  it('carries evidence and confidence with every emitted statement', () => {
    expect(MAIN).toMatch(/evidence: c\.evidence/);
    expect(MAIN).toMatch(/confidence: c\.confidence/);
  });

  it('is rendered by the civilization panel with its evidence count', () => {
    expect(PANEL).toMatch(/civ-codex/);
    expect(PANEL).toMatch(/codex — /);
    expect(PANEL).toMatch(/evidence — /);
  });
});

describe('sequel save/restore contract', () => {
  it('persists the codex additively', () => {
    expect(MAIN).toMatch(/codex: codex \? serializeCodex\(codex\) : null/);
    expect(SAVE).toMatch(/codex: opts\.codex \?\? null/);
    expect(SAVE).toMatch(/codex: state\.codex \?\? null/);
  });

  it('restores the codex without breaking when a save predates it', () => {
    expect(MAIN).toMatch(/if \(out\.codex\) codex = restoreCodex\(out\.codex\)/);
  });

  it('captures civilization and CODEX in epoch checkpoints as well as named saves', () => {
    expect(MAIN).toMatch(/captureFn: \(\) => captureWorldState\(\{[\s\S]*?name: `Epoch \$\{epochEngine\.era\}`,[\s\S]*?civilization: civilization \? serializeCivilization\(civilization\) : null,[\s\S]*?codex: codex \? serializeCodex\(codex\) : null/);
  });

  it('re-hosts structures on the restored lifecycle', () => {
    // A restored civilization brings a new lifecycle object with it, so the
    // structure registry must be re-pointed at it or every record lookup
    // silently misses.
    expect(MAIN).toMatch(/civilization = restoreCivilization\(out\.civilization\)[\s\S]*?structures = createStructureRegistry\(civilization\.lifecycle\)/);
  });

  it('restores cleanly from a save with no codex field', () => {
    expect(restoreCodex(null).entries).toEqual([]);
  });

  it('round-trips the codex through a real world capture', () => {
    const view = new Float32Array(PARTICLE_STRIDE * 2);
    const c = createCodex();
    recordCodexEntry(c, {
      era: 4, tick: 120, name: 'Fourth Age',
      regime: 'settled', confidence: 0.75,
      evidence: ['stable-without-institutions', 'member-retention-1', 'group-retention-1'],
      continuity: { comparable: true },
    });
    const snap = captureWorldState({
      view, count: 2, speciesCount: 2, laws: createLawState(),
      worldParams: {}, runtime: {}, worldSize: 100, tick: 120, codex: JSON.parse(JSON.stringify(c)),
    });
    const back = restoreWorldState(JSON.parse(JSON.stringify(snap)));
    const restored = restoreCodex(back.codex);
    expect(restored.entries).toHaveLength(1);
    expect(restored.entries[0].era).toBe(4);
    expect(restored.entries[0].statement).toBe(c.entries[0].statement);
  });
});

describe('the three phases compose into one observer path', () => {
  it('carries a social change all the way to a cited statement', () => {
    // Structures, then continuity, then codex — an integration-level check
    // that the phases are chained rather than three independent modules.
    const civ = createCivilizationRegistry();
    const structures = createStructureRegistry(civ.lifecycle);
    const gr = groupRegistry({ g1: { members: [1, 2, 3, 4], treasury: 100 } });
    const nest = foundStructure(structures, 'g1', { kind: 'NEST' });

    // Phase 4: the structure stands.
    expect(structureForGroup(structures, 'g1').id).toBe(nest.id);
    expect(structureReport(structures).standing).toBe(1);

    // Phase 5: an era boundary observes the surviving society.
    const continuity = createContinuityCatalog();
    const era = recordEraContinuity(continuity, civ, gr, { tick: 10, era: 1, name: 'One' });
    expect(era.fingerprint.groups).toBe(1);
    expect(era.fingerprint.totalMembers).toBe(4);
    expect(latestRegime(continuity).era).toBe(1);

    // Phase 6: the first sample is admitted rather than asserted.
    const codex = createCodex();
    const filed = recordCodexEntry(codex, era);
    expect(filed.ok).toBe(true);
    expect(filed.entry.asserted).toBe(false);
    expect(isRegimeWellEvidenced(era)).toBe(false);

    // A second, comparable sample is allowed to assert.
    const era2 = recordEraContinuity(continuity, civ, gr, { tick: 20, era: 2, name: 'Two' });
    const filed2 = recordCodexEntry(codex, era2);
    expect(filed2.ok).toBe(true);
    expect(filed2.entry.confidence).toBeGreaterThan(0);
    expect(codexReport(codex).rejected).toBe(0);
  });

  it('sees an emptied world as a collapse the observer can name', () => {
    const civ = createCivilizationRegistry();
    const continuity = createContinuityCatalog();
    recordEraContinuity(continuity, civ, groupRegistry({ g1: { members: [1, 2, 3, 4] } }), { tick: 1, era: 1 });
    const era2 = recordEraContinuity(continuity, civ, groupRegistry({}), { tick: 2, era: 2 });
    expect(era2.regime).toBe('empty');
    const filed = recordCodexEntry(createCodex(), era2);
    expect(filed.ok).toBe(true);
    expect(filed.entry.evidence).toContain('no-surviving-groups');
  });

  it('does not let a structure registry outlive its lifecycle', () => {
    // createStructureRegistry holds a direct reference; a registry pointed at a
    // discarded lifecycle would write into an orphan.
    const first = createSystemLifecycle();
    const s1 = createStructureRegistry(first);
    foundStructure(s1, 'g1', {});
    const second = createSystemLifecycle();
    const s2 = createStructureRegistry(second);
    expect(structureReport(s2).total).toBe(0);
    expect(structureReport(s1).total).toBe(1);
  });

  it('records upkeep as a lifecycle event so the phase is auditable', () => {
    const civ = createCivilizationRegistry();
    const structures = createStructureRegistry(civ.lifecycle);
    const gr = groupRegistry({ g1: { members: [1], treasury: 10 } });
    const nest = foundStructure(structures, 'g1', {});
    runMaintenance(structures, gr, { tick: 1, maintain: [nest.id] });
    const ev = civ.lifecycle.events.filter((e) => e.recordId === nest.id && e.type === 'maintained');
    expect(ev).toHaveLength(1);
  });
});
