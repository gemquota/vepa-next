/**
 * VEPA4 — launch configuration and the launch modal.
 *
 * The launch modal is the only piece of UI that runs *before* anything is
 * initialised, which gives it a property nothing else has: if it throws or
 * never resolves, there is no world behind it to fall back on. So the
 * behaviour pinned here is mostly about not getting in the way —
 *
 *   - every dismissal path (Escape, backdrop, "Use defaults", a throw inside
 *     the modal) resolves to `null`, and `null` is a fully handled answer;
 *   - a remembered launch opens the modal on what you last chose;
 *   - corrupt storage degrades to the defaults instead of breaking boot;
 *   - the preset picker, the choice rows and the ranges are all reachable and
 *     all carry the answers back.
 *
 * The modal half needs a DOM, which the project does not ship, so it runs
 * against tests/helpers/domStub.js — a shared stub with just enough of the
 * element API, including an HTML parser, to exercise the real wiring rather
 * than a mock of it.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { installDom, makeStorage } from '../helpers/domStub.js';

import {
  BUILTIN_LAUNCH_PRESETS,
  DEFAULT_LAUNCH_PRESET_ID,
  LAUNCH_FIELDS,
  LAUNCH_PRESETS_STORAGE_KEY,
  LAUNCH_STORAGE_KEY,
  defaultLaunchSettings,
  getCustomLaunchPresets,
  launchMarkPosition,
  launchPositionToValue,
  launchValueToPosition,
  normaliseLaunchSettings,
  presetFor,
  readLaunchSettings,
  saveCustomLaunchPreset,
  writeLaunchSettings,
} from '../../src/state/launchSettings.js';

let doc;

beforeEach(() => {
  doc = installDom();
});

describe('launch settings state', () => {
  it('defaults to a preset that actually exists', () => {
    const base = defaultLaunchSettings();
    expect(BUILTIN_LAUNCH_PRESETS.some((p) => p.id === base.presetId)).toBe(true);
    expect(presetFor(base)).toBeTruthy();
  });

  it('gives every built-in preset a blurb, so the choice is legible', () => {
    // "TIDAL_BLOOM" tells you nothing about whether you want it. That is the
    // whole reason the picker exists.
    for (const p of BUILTIN_LAUNCH_PRESETS) {
      expect(p.blurb, `${p.id} has no blurb`).toBeTruthy();
      expect(p.blurb.length, `${p.id} blurb is too short to help`).toBeGreaterThan(40);
      expect(p.preset).toBeTruthy();
    }
  });

  it('declares help text for every field, because these are the first controls anyone sees', () => {
    for (const f of LAUNCH_FIELDS) {
      expect(f.label, `${f.key} has no label`).toBeTruthy();
      expect(f.help, `${f.key} has no help`).toBeTruthy();
      expect(f.help.length).toBeGreaterThan(40);
    }
  });

  it('validates choice fields against their own options', () => {
    const bad = normaliseLaunchSettings({ renderBackend: 'webgl-experimental' });
    expect(bad.renderBackend).toBe(defaultLaunchSettings().renderBackend);
    const good = normaliseLaunchSettings({ renderBackend: 'pixi' });
    expect(good.renderBackend).toBe('pixi');
  });

  it('clamps and snaps range fields to their own step', () => {
    const simSpeed = LAUNCH_FIELDS.find((f) => f.key === 'simSpeed');
    const initialPop = LAUNCH_FIELDS.find((f) => f.key === 'initialPop');
    expect(initialPop.max).toBe(10000);
    expect(initialPop.step).toBe(100);
    expect(normaliseLaunchSettings({ initialPop: 10000 }).initialPop).toBe(10000);
    expect(normaliseLaunchSettings({ initialPop: 20000 }).initialPop).toBe(10000);
    expect(normaliseLaunchSettings({ simSpeed: 99 }).simSpeed).toBe(simSpeed.max);
    expect(normaliseLaunchSettings({ simSpeed: -5 }).simSpeed).toBe(simSpeed.min);
    // A hand-edited or stale value must not land between increments.
    expect(normaliseLaunchSettings({ simSpeed: 1.37 }).simSpeed).toBe(1.4);
    expect(normaliseLaunchSettings({ simSpeed: null }).simSpeed).toBe(1);
    expect(normaliseLaunchSettings({ worldSize: null }).worldSize).toBeNull();
  });

  it('maps logarithmic slider positions to values and places reference marks', () => {
    const gravity = LAUNCH_FIELDS.find((field) => field.key === 'gravity');
    expect(launchValueToPosition(gravity, gravity.min)).toBe(0);
    expect(launchValueToPosition(gravity, gravity.max)).toBe(1000);
    expect(launchPositionToValue(gravity, 0)).toBe(gravity.min);
    expect(launchPositionToValue(gravity, 1000)).toBe(gravity.max);
    expect(launchValueToPosition(gravity, 1)).toBeCloseTo(launchValueToPosition(gravity, 0.1) + 435, -1);
    expect(launchMarkPosition(gravity, 1)).toBe(launchValueToPosition(gravity, 1) / 10);
  });

  it('saves named launch configurations locally and caps their count', () => {
    const entry = saveCustomLaunchPreset('  My   World ', { ...defaultLaunchSettings(), gravity: 2.4 });
    expect(entry.name).toBe('My World');
    expect(entry.settings.gravity).toBe(2.4);
    expect(globalThis.localStorage.getItem(LAUNCH_PRESETS_STORAGE_KEY)).toBeTruthy();
    expect(getCustomLaunchPresets()).toHaveLength(1);
    expect(presetFor(entry.settings).name).toBe('TIDAL_BLOOM');
    expect(saveCustomLaunchPreset('   ', defaultLaunchSettings())).toBeNull();
    for (let i = 0; i < 14; i++) saveCustomLaunchPreset(`Saved ${i}`, defaultLaunchSettings());
    expect(getCustomLaunchPresets()).toHaveLength(12);
  });

  it('degrades a null, partial or non-object input to the defaults', () => {
    for (const input of [null, undefined, 'nonsense', 42, []]) {
      expect(normaliseLaunchSettings(input)).toEqual(defaultLaunchSettings());
    }
  });

  it('ignores fields it does not recognise rather than carrying them', () => {
    const out = normaliseLaunchSettings({ presetId: 'PRIME_DEFAULT', rogueField: 'x' });
    expect(out.presetId).toBe('PRIME_DEFAULT');
    expect('rogueField' in out).toBe(false);
  });

  it('reapplies custom launch choices once over their source preset and can clear saved overrides', () => {
    const saved = saveCustomLaunchPreset('Starfall Lab', normaliseLaunchSettings({
      presetId: 'STARFALL',
      gravity: 7.2,
      parameterOverrides: { STELLAR_MAX: 12 },
    }));
    const configured = presetFor(saved.settings);
    expect(configured.worldParams.GLOBAL_G).toBe(7.2);
    expect(configured.worldParams.STELLAR_MAX).toBe(12);

    const reset = presetFor({ ...saved.settings, gravity: null, parameterOverrides: {} });
    const starfall = BUILTIN_LAUNCH_PRESETS.find((preset) => preset.id === 'STARFALL').preset;
    expect(reset.worldParams.GLOBAL_G).toBe(starfall.worldParams.GLOBAL_G);
    expect(reset.worldParams.STELLAR_MAX).toBe(starfall.worldParams.STELLAR_MAX);
  });

  it('validates advanced laws, species, world overrides, seed and founder era', () => {
    const out = normaliseLaunchSettings({
      laws: ['GRAV', 'NOT_A_LAW', 'GRAV'],
      speciesNames: ['Bloom', 'Bloom'],
      parameterOverrides: { GLOBAL_G: 30, NOT_A_PARAM: 7, FIELD_THERMAL: 1.5 },
      launchSeed: -2,
      founderEra: 'ancient',
    });
    expect(out.laws).toEqual(['GRAV']);
    expect(out.speciesNames).toEqual(['Bloom']);
    expect(out.parameterOverrides).toEqual({ GLOBAL_G: 20, FIELD_THERMAL: 1.5 });
    expect(out.launchSeed).toBe(1);
    expect(out.founderEra).toBe('ancient');
    expect(normaliseLaunchSettings({ speciesNames: [] }).speciesNames).toBeNull();
    expect(presetFor(normaliseLaunchSettings({ speciesNames: [] })).species.length).toBeGreaterThan(0);
  });

  it('resolves the advanced law, species and parameter choices into the real preset', () => {
    const configured = presetFor(normaliseLaunchSettings({
      presetId: 'TIDAL_BLOOM', laws: ['GRAV', 'MIND'], speciesNames: ['Bloom', 'Chorus'],
      parameterOverrides: { FIELD_THERMAL: 1.5 },
    }));
    expect(configured.laws).toEqual(['GRAV', 'MIND']);
    expect(configured.species.map((species) => species.name)).toEqual(['Bloom', 'Chorus']);
    expect(configured.speciesCount).toBe(2);
    expect(configured.worldParams.FIELD_THERMAL).toBe(1.5);
  });

  it('ships distinct categorized presets with varied laws, species, and objectives', () => {
    expect(BUILTIN_LAUNCH_PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(BUILTIN_LAUNCH_PRESETS.map((preset) => preset.category)).size).toBeGreaterThan(4);
    expect(new Set(BUILTIN_LAUNCH_PRESETS.map((preset) => preset.objective)).size).toBeGreaterThan(8);
    expect(BUILTIN_LAUNCH_PRESETS.find((preset) => preset.id === 'STARFALL').preset.laws).toContain('ANTIMATTER');
  });

  it('round-trips through storage', () => {
    const settings = normaliseLaunchSettings({
      presetId: 'PRIME_DEFAULT', renderBackend: 'pixi', simSpeed: 1.5, worldSize: 900,
    });
    expect(writeLaunchSettings(settings)).toBe(true);
    expect(readLaunchSettings()).toEqual(settings);
  });

  it('falls back to the defaults when stored data is corrupt', () => {
    // A truncated or hand-edited value must not stop the app from booting.
    globalThis.localStorage = makeStorage({ [LAUNCH_STORAGE_KEY]: '{not json' });
    expect(readLaunchSettings()).toEqual(defaultLaunchSettings());
  });

  it('survives storage that refuses to cooperate', () => {
    // Private browsing throws on setItem in some browsers.
    globalThis.localStorage = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('denied'); },
    };
    expect(readLaunchSettings()).toEqual(defaultLaunchSettings());
    expect(writeLaunchSettings(defaultLaunchSettings())).toBe(false);
  });
});

describe('launch modal', () => {
  const load = async () => import('../../src/ui/launchModal.js');

  it('renders a card per built-in preset, with the current one marked and categories available', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({ settings: normaliseLaunchSettings({ presetId: 'PRIME_DEFAULT' }) });
    const cards = doc.querySelectorAll('.launch-preset');
    expect(cards).toHaveLength(BUILTIN_LAUNCH_PRESETS.length);
    expect(doc.querySelector('.launch-preset.current').dataset.preset).toBe('PRIME_DEFAULT');
    expect(doc.querySelectorAll('.launch-filter-chip').length).toBeGreaterThan(4);
    expect(doc.querySelector('.launch-preset[data-preset="STARFALL"]')).toBeTruthy();
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
  });

  it('compares presets in a table and filters the preset catalog by category', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    const starfallCompare = doc.querySelector('.launch-compare[data-compare-select="STARFALL"]');
    expect(starfallCompare.querySelector('span').textContent).toBe('⇄');
    expect(starfallCompare.getAttribute('aria-label')).toContain('Add to comparison');
    starfallCompare.dispatch('click');
    expect(starfallCompare.getAttribute('aria-pressed')).toBe('true');
    expect(starfallCompare.getAttribute('aria-label')).toContain('Remove from comparison');
    doc.querySelector('.launch-compare[data-compare-select="TIDAL_BLOOM"]').dispatch('click');
    expect(doc.querySelector('.launch-compare-table')).toBeTruthy();
    expect(doc.querySelector('.launch-compare-table').textContent).toContain('STARTING POPULATION');
    doc.querySelector('.launch-filter-chip[data-preset-filter="Cosmos"]').dispatch('click');
    expect(doc.querySelector('.launch-preset-wrap[data-category="Ecologies"]').hidden).toBe(true);
    expect(doc.querySelector('.launch-preset-wrap[data-category="Cosmos"]').hidden).toBe(false);
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
  });

  it('opens the advanced designer and returns law, parameter, species and seed choices', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    doc.querySelector('[data-act="toggle-advanced"]').dispatch('click');
    expect(doc.querySelector('.launch-advanced-body').hidden).toBe(false);
    const law = doc.querySelector('.launch-law-toggle[data-law="MIND"]');
    law.checked = true;
    law.dispatch('change');
    doc.querySelector('.launch-tab[data-tab="parameters"]').dispatch('click');
    const parameter = doc.querySelector('.launch-param-row input[data-param="FIELD_THERMAL"]');
    parameter.value = '2';
    parameter.dispatch('input');
    expect(doc.querySelector('[data-value-for="thermalField"]').textContent).toBe('from advanced');
    doc.querySelector('.launch-tab[data-tab="species"]').dispatch('click');
    const founder = doc.querySelector('.launch-species-toggle[data-species="Drift"]');
    founder.checked = false;
    founder.dispatch('change');
    doc.querySelector('.launch-tab[data-tab="launch"]').dispatch('click');
    const seed = doc.querySelector('#launch-seed');
    seed.value = '12345';
    seed.dispatch('input');
    doc.querySelector('[data-act="launch"]').dispatch('click');
    const answer = await promise;
    expect(answer.laws).toContain('MIND');
    expect(answer.parameterOverrides.FIELD_THERMAL).toBe(2);
    expect(answer.speciesNames).not.toContain('Drift');
    expect(answer.launchSeed).toBe(12345);
  });

  it('renders one control per declared field', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    for (const field of LAUNCH_FIELDS) {
      const node = doc.querySelector(`[data-field="${field.key}"]`);
      expect(node, `${field.key} was not rendered`).toBeTruthy();
      if (field.kind === 'choice') {
        expect(node.querySelectorAll('.launch-choice')).toHaveLength(field.options.length);
      } else {
        expect(node.querySelector('input[type="range"]'), `${field.key} has no range`).toBeTruthy();
      }
    }
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
  });

  it('returns the chosen settings on launch', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    doc.querySelector('.launch-preset[data-preset="PRIME_DEFAULT"]').dispatch('click');
    doc.querySelector('.launch-choice[data-key="renderBackend"][data-value="pixi"]').dispatch('click');
    doc.querySelector('[data-act="launch"]').dispatch('click');
    const answer = await promise;
    expect(answer.presetId).toBe('PRIME_DEFAULT');
    expect(answer.renderBackend).toBe('pixi');
  });

  it('carries a range value back', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    const field = LAUNCH_FIELDS.find((candidate) => candidate.key === 'simSpeed');
    const range = doc.querySelector('.launch-range[data-key="simSpeed"]');
    range.value = String(launchValueToPosition(field, 2.5));
    range.dispatch('input', { target: range });
    doc.querySelector('[data-act="launch"]').dispatch('click');
    expect((await promise).simSpeed).toBe(2.5);
  });

  it('renders the population controls within the 10,000-particle engine cap', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    doc.querySelector('[data-act="toggle-advanced"]').dispatch('click');
    doc.querySelector('.launch-tab[data-tab="parameters"]').dispatch('click');
    const range = doc.querySelector('.launch-range[data-key="initialPop"]');
    expect(LAUNCH_FIELDS.find((field) => field.key === 'initialPop').max).toBe(10000);
    expect(LAUNCH_FIELDS.find((field) => field.key === 'maxPopulation').max).toBe(10000);
    expect(doc.querySelector('[data-param="PARTICLE_COUNT"]').getAttribute('max')).toBe('10000');
    expect(doc.querySelector('[data-param="MAX_POP"]').getAttribute('max')).toBe('10000');
    expect(doc.querySelector('[data-value-for="initialPop"]').textContent).toBe('from preset');
    range.value = String(launchValueToPosition(LAUNCH_FIELDS.find((field) => field.key === 'initialPop'), 10000));
    range.dispatch('input', { target: range });
    doc.querySelector('[data-act="launch"]').dispatch('click');
    expect((await promise).initialPop).toBe(10000);
  });

  it('shows the live value beside a logarithmic range as it moves', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    const field = LAUNCH_FIELDS.find((candidate) => candidate.key === 'simSpeed');
    const range = doc.querySelector('.launch-range[data-key="simSpeed"]');
    expect(range.getAttribute('min')).toBe('0');
    expect(range.getAttribute('max')).toBe('1000');
    range.value = '650';
    range.dispatch('input', { target: range });
    expect(doc.querySelector('[data-value-for="simSpeed"]').textContent)
      .toBe(String(launchPositionToValue(field, 650)));
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
  });

  it('opens and closes slider descriptions by tapping the label', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    const label = doc.querySelector('.launch-help-trigger[data-help="gravity"]');
    const help = doc.querySelector('#launch-help-gravity');
    expect(help.hidden).toBe(true);
    label.dispatch('click');
    expect(help.hidden).toBe(false);
    expect(label.getAttribute('aria-expanded')).toBe('true');
    label.dispatch('click');
    expect(help.hidden).toBe(true);
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
  });

  it('saves the edited launch setup and can select it again', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    const gravity = doc.querySelector('.launch-range[data-key="gravity"]');
    gravity.value = '700';
    gravity.dispatch('input', { target: gravity });
    const name = doc.querySelector('#launch-custom-name');
    name.value = 'Gravity test';
    doc.querySelector('.launch-save-preset').dispatch('click');
    expect(doc.querySelector('.launch-custom-status').textContent).toContain('Saved');
    expect(doc.querySelector('.launch-preset[data-preset="CUSTOM:gravity-test"]')).toBeTruthy();
    doc.querySelector('.launch-preset[data-preset="TIDAL_BLOOM"]').dispatch('click');
    doc.querySelector('.launch-preset[data-preset="CUSTOM:gravity-test"]').dispatch('click');
    doc.querySelector('[data-act="launch"]').dispatch('click');
    const result = await promise;
    expect(result.presetId).toBe('CUSTOM:gravity-test');
    expect(result.gravity).toBe(launchPositionToValue(LAUNCH_FIELDS.find((field) => field.key === 'gravity'), 700));
  });

  it('resets advanced parameters back to the selected preset and clears the quick slider override', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    doc.querySelector('[data-act="toggle-advanced"]').dispatch('click');
    doc.querySelector('.launch-tab[data-tab="parameters"]').dispatch('click');
    const parameter = doc.querySelector('[data-param="FIELD_THERMAL"]');
    parameter.value = '2';
    parameter.dispatch('input');
    doc.querySelector('[data-param-reset="FIELD_THERMAL"]').dispatch('click');
    doc.querySelector('[data-act="launch"]').dispatch('click');
    const answer = await promise;
    expect(answer.parameterOverrides.FIELD_THERMAL).toBeUndefined();
    expect(answer.thermalField).toBeNull();
  });

  it('labels a range that is still following the preset', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    // null means "the preset decides", and saying so is better than showing a
    // number that is not in effect yet.
    expect(doc.querySelector('[data-value-for="worldSize"]').textContent).toBe('from preset');
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
  });

  it('moves the current marker when another preset is tapped', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({ settings: normaliseLaunchSettings({ presetId: DEFAULT_LAUNCH_PRESET_ID }) });
    doc.querySelector('.launch-preset[data-preset="PRIME_DEFAULT"]').dispatch('click');
    const current = doc.querySelectorAll('.launch-preset').filter((c) => c.classes.has('current'));
    expect(current).toHaveLength(1);
    expect(current[0].dataset.preset).toBe('PRIME_DEFAULT');
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
  });

  it('keeps exactly one choice marked current per field', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    doc.querySelector('.launch-choice[data-key="computeEngine"][data-value="cpu"]').dispatch('click');
    for (const btn of doc.querySelectorAll('.launch-choice[data-key="computeEngine"]')) {
      const on = btn.classList.contains('current');
      expect(btn.getAttribute('aria-checked')).toBe(on ? 'true' : 'false');
    }
    expect(doc.querySelectorAll('.launch-choice[data-key="computeEngine"].current')).toHaveLength(1);
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
  });

  it('falls back to a real preset when the remembered id no longer exists', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({ settings: normaliseLaunchSettings({ presetId: 'PRESET_FROM_THE_FUTURE' }) });
    expect(doc.querySelectorAll('.launch-preset')).toHaveLength(BUILTIN_LAUNCH_PRESETS.length);
    expect(doc.querySelector('.launch-preset.current')).toBeTruthy();
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
  });
});

describe('launch modal never blocks the boot', () => {
  const load = async () => import('../../src/ui/launchModal.js');

  it('resolves null on Escape, and removes itself from the document', async () => {
    const { showLaunchModal, isLaunchModalOpen } = await load();
    const promise = showLaunchModal({});
    expect(isLaunchModalOpen()).toBe(true);
    doc.dispatch('keydown', { key: 'Escape' });
    expect(await promise).toBeNull();
    expect(isLaunchModalOpen()).toBe(false);
  });

  it('resolves null on "Use defaults"', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    doc.querySelector('.launch-secondary[data-act="cancel"]').dispatch('click');
    expect(await promise).toBeNull();
  });

  it('resolves null when the backdrop is tapped', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    doc.querySelector('#launch-overlay').dispatch('click', { target: doc.querySelector('#launch-overlay') });
    expect(await promise).toBeNull();
  });

  it('stays open when the backdrop is not what was tapped', async () => {
    const { showLaunchModal, isLaunchModalOpen } = await load();
    const promise = showLaunchModal({});
    const panel = doc.querySelector('.launch-panel');
    panel.dispatch('click', { target: panel });
    expect(isLaunchModalOpen()).toBe(true);
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
  });

  it('resolves null immediately when there is no document at all', async () => {
    const { showLaunchModal } = await load();
    const saved = globalThis.document;
    delete globalThis.document;
    expect(await showLaunchModal({})).toBeNull();
    globalThis.document = saved;
  });

  it('leaves no keydown listener behind after it closes', async () => {
    // A leaked listener would keep the modal's focus trap alive after the modal
    // is gone, and the next Escape anywhere on the page would be swallowed.
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    expect(doc.listeners.keydown).toHaveLength(1);
    doc.dispatch('keydown', { key: 'Escape' });
    await promise;
    expect(doc.listeners.keydown).toHaveLength(0);
  });

  it('unwinds safely if it is dismissed twice', async () => {
    const { showLaunchModal } = await load();
    const promise = showLaunchModal({});
    doc.dispatch('keydown', { key: 'Escape' });
    expect(() => doc.dispatch('keydown', { key: 'Escape' })).not.toThrow();
    expect(await promise).toBeNull();
  });

  it('closes on Escape with a form control focused', async () => {
    // A modal that only closes when focus happens to be on its chrome is a
    // modal people cannot dismiss with a keyboard.
    const { showLaunchModal, isLaunchModalOpen } = await load();
    const promise = showLaunchModal({});
    const range = doc.querySelector('.launch-range');
    range.focus();
    expect(doc.activeElement).toBe(range);
    doc.dispatch('keydown', { key: 'Escape' });
    expect(await promise).toBeNull();
    expect(isLaunchModalOpen()).toBe(false);
  });
});

describe('boot integration', () => {
  const MAIN = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');

  it('resolves the launch configuration before laws, world params and spawn', () => {
    const boot = MAIN.slice(MAIN.indexOf('async function boot'));
    const at = (needle) => boot.indexOf(needle);
    expect(at('await resolveLaunchConfiguration()')).toBeGreaterThan(-1);
    // Order is the whole point: a preset decides the laws, the world
    // parameters and the species, so it has to land before all three.
    expect(at('await resolveLaunchConfiguration()')).toBeLessThan(at('for (const name of DEFAULT_LAWS)'));
    expect(at('await resolveLaunchConfiguration()')).toBeLessThan(at('applyDefaultWorldConfig()'));
    expect(at('await resolveLaunchConfiguration()')).toBeLessThan(at('spawnDefaultPopulation()'));
  });

  it('refills SPECIES_PROFILES in place so module-scope closures see the choice', () => {
    // SPECIES_PROFILES is read by functions that captured it at module scope;
    // reassigning the binding would leave them on the old array.
    expect(MAIN).toMatch(/SPECIES_PROFILES\.length = 0/);
    expect(MAIN).toMatch(/SPECIES_PROFILES\.push\(/);
  });

  it('treats a dismissed modal as a normal answer, not an error', async () => {
    const { defaultLaunchSettings } = await import('../../src/state/launchSettings.js');
    const settings = normaliseLaunchSettings(defaultLaunchSettings());
    // This is exactly what main.js does with a null from the modal.
    expect(settings.presetId).toBe(DEFAULT_LAUNCH_PRESET_ID);
    expect(presetFor(settings)).toBeTruthy();
  });
});
