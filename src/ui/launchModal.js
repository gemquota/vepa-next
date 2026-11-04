/**
 * VEPA4 — Launch modal.
 *
 * Shown before the world exists, the launcher combines a scenario with its
 * initial laws, parameter values, founder roster and startup conditions.
 *
 * Design rules, in priority order:
 *
 *   1. IT MUST NEVER BLOCK THE BOOT. Escape, the backdrop and the cancel
 *      affordance all resolve to "no choice", and main.js treats that as "use
 *      the defaults". A modal that can trap the boot sequence is a white screen
 *      waiting to happen, and this one runs before anything is initialised, so
 *      a failure here has no fallback behind it.
 *   2. EVERY CONTROL IS TAPPABLE FIRST. The preset cards and the field controls
 *      are 44px minimum under `pointer: coarse` like the rest of the drawer —
 *      this is the first thing anyone sees on a phone, so it gets the treatment
 *      before anything else does.
 *   3. THE FIELDS ARE GENERATED, NOT WRITTEN. They come from LAUNCH_FIELDS, so
 *      a setting's control, its range and its help text cannot drift apart, and
 *      adding one is a single entry in state/launchSettings.js.
 *
 */

import {
  getLaunchPresets,
  LAUNCH_FIELDS,
  defaultLaunchSettings,
  launchMarkPosition,
  launchPositionToValue,
  launchValueToPosition,
  normaliseLaunchSettings,
  saveCustomLaunchPreset,
  deriveTextSeed,
} from '../state/launchSettings.js';
import { escapeHtml as esc } from './html.js';
import { LAW_CATEGORIES, LAW_HELP_DB, LAW_INDEXES } from '../constants.js';
import { WORLD_PARAM_DEFS } from '../state/worldParams.js';

const LAW_NAMES_BY_INDEX = Object.fromEntries(Object.entries(LAW_INDEXES).map(([name, index]) => [index, name]));
const LAW_GROUP_LABELS = {
  physics: 'PHYSICS', mechanics: 'MECHANICS', biology: 'BIOLOGY', chemistry: 'CHEMISTRY',
  thermodynamics: 'THERMODYNAMICS', metaphysics: 'METAPHYSICS', electromagnetism: 'ELECTROMAGNETISM',
  information: 'INFORMATION', quantum: 'QUANTUM',
};
const PARAM_ALIASES = { WORLD_SIZE: 'worldSize', GLOBAL_G: 'gravity' };

const TITLE = 'LAUNCH DISH';

function formatValue(value) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function presetValueFor(field, entry) {
  const params = entry?.preset?.worldParams || {};
  if (field.key === 'simSpeed') return params.dt ?? 1;
  const legacy = { WORLD_SIZE: 'worldSize', GLOBAL_G: 'gravity' };
  const key = field.worldParamKey;
  return params[key] ?? params[legacy[key]] ?? field.min;
}

function rangeMarksHtml(field) {
  return (field.marks || []).map((mark) => `<span class="launch-mark" style="--mark:${launchMarkPosition(field, mark)}%" title="${formatValue(mark)}" aria-hidden="true"></span>`).join('');
}

function presetCardsHtml(presets, selectedId, comparedIds = []) {
  return presets.map((entry) => presetCardHtml(entry, entry.id === selectedId, comparedIds.includes(entry.id))).join('');
}

function presetCardHtml(entry, selected, compared) {
  const p = entry.preset || {};
  const species = Array.isArray(p.species) ? p.species.length : 0;
  const laws = Array.isArray(p.laws) ? p.laws.length : 0;
  const size = p.worldParams && (p.worldParams.worldSize || p.worldParams.WORLD_SIZE);
  return `<div class="launch-preset-wrap" data-category="${esc(entry.category || 'Ecologies')}">
    <button type="button" class="launch-preset${selected ? ' current' : ''}${entry.custom ? ' custom' : ''}"
        data-preset="${esc(entry.id)}" aria-pressed="${selected ? 'true' : 'false'}">
      <span class="launch-preset-name">${esc(entry.name)}${entry.custom ? ' · SAVED' : ''}</span>
      <span class="launch-preset-meta">${species} species · ${laws} laws · ${esc(entry.playstyle || 'Custom')}${size ? ` · ${formatValue(size)}u` : ''}</span>
      <span class="launch-preset-blurb">${esc(entry.blurb)}</span>
      <span class="launch-preset-objective">${esc(entry.objective || 'Your saved world, ready to begin.')}</span>
    </button>
    <button type="button" class="launch-compare${compared ? ' current' : ''}" data-compare-select="${esc(entry.id)}" aria-label="${compared ? 'Remove from' : 'Add to'} comparison: ${esc(entry.name)}" title="${compared ? 'Remove from' : 'Add to'} comparison" aria-pressed="${compared ? 'true' : 'false'}"><span aria-hidden="true">⇄</span></button>
  </div>`;
}

function comparisonHtml(presets, ids) {
  const entries = ids.map((id) => presets.find((entry) => entry.id === id)).filter(Boolean);
  if (!entries.length) return '<p class="launch-note">Choose up to three worlds with the ⇄ button to see their starting profiles side by side.</p>';
  const rows = [
    ['STYLE', (entry) => entry.playstyle || 'Custom'],
    ['STARTING POPULATION', (entry) => formatValue(entry.preset.worldParams?.INITIAL_POP ?? entry.preset.worldParams?.initialPopulation ?? 0)],
    ['SPECIES', (entry) => (entry.preset.species || []).map((species) => species.name).join(', ')],
    ['ACTIVE LAWS', (entry) => String((entry.preset.laws || []).length)],
    ['WORLD SIZE', (entry) => formatValue(entry.preset.worldParams?.WORLD_SIZE ?? entry.preset.worldParams?.worldSize ?? 0)],
    ['THERMAL FIELD', (entry) => formatValue(entry.preset.worldParams?.FIELD_THERMAL ?? 0)],
    ['SPAWN CENTRES', (entry) => String(entry.preset.worldParams?.SPAWN_CENTRES ?? WORLD_PARAM_DEFS.find((def) => def.key === 'SPAWN_CENTRES')?.default ?? 1)],
    ['MUTATION RATE', (entry) => formatValue(entry.preset.worldParams?.MUTATION_RATE ?? WORLD_PARAM_DEFS.find((def) => def.key === 'MUTATION_RATE')?.default ?? 1)],
    ['MISSION', (entry) => entry.objective || entry.blurb],
  ];
  return `<div class="launch-compare-scroll"><table class="launch-compare-table"><thead><tr><th>PROFILE</th>${entries.map((entry) => `<th>${esc(entry.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, value]) => `<tr><th>${label}</th>${entries.map((entry) => `<td>${esc(value(entry))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function lawPickerHtml(entry, settings) {
  const selected = new Set(settings.laws ?? entry?.preset?.laws ?? []);
  return Object.entries(LAW_CATEGORIES).map(([key, category]) => {
    const laws = category.laws.map((index) => LAW_NAMES_BY_INDEX[index]).filter(Boolean);
    return `<details class="launch-law-category" data-law-category="${key}"><summary>${esc(LAW_GROUP_LABELS[key] || key.toUpperCase())}<span>${laws.filter((law) => selected.has(law)).length}/${laws.length}</span></summary>
      <div class="launch-law-grid">${laws.map((law) => `<label class="launch-check-row" data-search="${esc(law.toLowerCase())}"><input type="checkbox" class="launch-law-toggle" data-law="${esc(law)}" ${selected.has(law) ? 'checked' : ''}><span>${esc(law)}</span><small>${esc(LAW_HELP_DB[law]?.hint || 'Starting law')}</small></label>`).join('')}</div>
    </details>`;
  }).join('');
}

function parameterPickerHtml(entry, settings) {
  const params = entry?.preset?.worldParams || {};
  const grouped = new Map();
  for (const def of WORLD_PARAM_DEFS) {
    if (!grouped.has(def.group)) grouped.set(def.group, []);
    grouped.get(def.group).push(def);
  }
  return [...grouped].map(([group, defs]) => `<details class="launch-param-category"><summary>${esc(group)}<span>${defs.length} controls</span></summary>
    <div class="launch-param-grid">${defs.map((def) => {
      const key = def.key;
      const quickField = LAUNCH_FIELDS.find((field) => field.worldParamKey === key);
      const value = settings.parameterOverrides[key]
        ?? (quickField && settings[quickField.key] !== null ? settings[quickField.key] : undefined)
        ?? params[key] ?? params[PARAM_ALIASES[key]] ?? def.default;

      return `<label class="launch-param-row" data-search="${esc(`${key} ${def.label} ${def.subgroup || ''}`.toLowerCase())}"><span>${esc(def.label)}<small>${esc(def.subgroup || group)} · ${def.min}–${def.max}</small></span><input type="number" data-param="${esc(key)}" min="${def.min}" max="${def.max}" step="${def.step}" value="${value}" aria-label="${esc(def.label)}"><button type="button" class="launch-param-reset" data-param-reset="${esc(key)}" title="Use preset value">↺</button></label>`;
    }).join('')}</div></details>`).join('');
}

function speciesPickerHtml(entry, settings) {
  const species = entry?.preset?.species || [];
  const available = new Set(species.map((item) => item.name));
  const selectedNames = settings.speciesNames?.filter((name) => available.has(name)) || [];
  const selected = new Set(selectedNames.length ? selectedNames : species.map((item) => item.name));
  return `<div class="launch-species-grid">${species.map((item) => `<label class="launch-species-card"><input type="checkbox" class="launch-species-toggle" data-species="${esc(item.name)}" ${selected.has(item.name) ? 'checked' : ''}><span class="launch-species-dot" style="--species-rgb:${item.color.join(',')}"></span><span><strong>${esc(item.name)}</strong><small>${esc(Object.keys(item.dna || {}).slice(0, 3).join(' · ') || 'Distinct founder genome')}</small></span></label>`).join('')}</div><p class="launch-note"><span data-species-count>${selected.size}</span> founders selected. At least one species must remain in the starting dish.</p>`;
}

function advancedPanelsHtml(entry, settings) {
  const filter = '<label class="launch-filter"><span class="launch-sr-only">Filter launch options</span><input type="search" class="launch-advanced-search" placeholder="Filter laws or parameters…" autocomplete="off"><button type="button" data-act="clear-search" aria-label="Clear filter">CLEAR</button></label>';
  return `<div class="launch-advanced-tabs" role="tablist" aria-label="Starting world controls">
        <button type="button" class="launch-tab current" data-tab="laws" aria-selected="true">LAWS</button><button type="button" class="launch-tab" data-tab="parameters" aria-selected="false">PARAMETERS</button><button type="button" class="launch-tab" data-tab="species" aria-selected="false">SPECIES</button><button type="button" class="launch-tab" data-tab="launch" aria-selected="false">LAUNCH ONLY</button>
      </div>
      <div class="launch-tab-panel" data-panel="laws"><div class="launch-panel-tools"><strong><span data-law-count>${(settings.laws ?? entry?.preset?.laws ?? []).length}</span> laws active</strong><button type="button" data-act="reset-laws">RESET TO PRESET</button><button type="button" data-act="all-laws">SELECT ALL</button></div>${filter}<div class="launch-law-categories">${lawPickerHtml(entry, settings)}</div></div>
      <div class="launch-tab-panel" data-panel="parameters" hidden><p class="launch-note">Edit only what you mean to change. Untouched values inherit from the selected preset.</p><div class="launch-panel-tools"><strong>World parameter overrides</strong><button type="button" data-act="reset-parameters">RESET ALL</button></div>${filter}${parameterPickerHtml(entry, settings)}</div>
      <div class="launch-tab-panel" data-panel="species" hidden><p class="launch-note">Choose which of this world's distinct founder genomes enter the initial population.</p>${speciesPickerHtml(entry, settings)}</div>
      <div class="launch-tab-panel" data-panel="launch" hidden><p class="launch-note">These are initializer controls, not live world sliders. Seeded worlds reproduce their initial random sequence.</p>
        <div class="launch-seed-row"><label for="launch-seed-text">WORLD NAME OR TEXT SEED</label><input type="text" id="launch-seed-text" maxlength="120" value="${esc(settings.launchSeedText)}" placeholder="A text seed, e.g. quiet blue dawn"><span class="launch-seed-derived" data-seed-result>${settings.launchSeedText ? `Seed ${settings.launchSeed}` : ''}</span></div>
        <div class="launch-seed-row"><label for="launch-seed">NUMERIC SEED</label><input type="number" id="launch-seed" min="1" max="2147483647" step="1" value="${settings.launchSeed ?? ''}" placeholder="Fresh each launch"><button type="button" data-act="random-seed">ROLL SEED</button></div>
        ${fieldHtml(LAUNCH_FIELDS.find((field) => field.key === 'founderEra'), settings.founderEra, entry, settings)}
      </div>`;
}

function advancedContentHtml(entry, settings) {
  return `<section class="launch-advanced" aria-label="Advanced world design">
    <button type="button" class="launch-advanced-toggle" data-act="toggle-advanced" aria-expanded="false" aria-controls="launch-advanced-body"><span>＋</span> DESIGN YOUR STARTING WORLD <small>laws · parameters · species · launch conditions</small></button>
    <div class="launch-advanced-body" id="launch-advanced-body" hidden>${advancedPanelsHtml(entry, settings)}</div>
  </section>`;
}

/** One declared setting, rendered from its descriptor. */
function fieldHtml(field, value, entry, settings = defaultLaunchSettings()) {
  const helpId = `launch-help-${field.key}`;
  const helpButton = `<button type="button" class="launch-field-label launch-help-trigger" data-help="${esc(field.key)}" aria-expanded="false" aria-controls="${helpId}" title="Show ${esc(field.label.toLowerCase())} description">${esc(field.label)} <span>ⓘ</span></button>`;
  if (field.kind === 'choice') {
    return `<div class="launch-field" data-field="${esc(field.key)}">
      <div class="launch-field-head">
        <div class="launch-label-group">${helpButton}</div>
        <span class="launch-field-value" data-value-for="${esc(field.key)}">${esc(labelForOption(field, value))}</span>
      </div>
      <div class="launch-choices" role="radiogroup" aria-label="${esc(field.label)}">
        ${field.options.map((o) => `<button type="button" class="launch-choice${o.value === value ? ' current' : ''}"
            data-key="${esc(field.key)}" data-value="${esc(o.value)}"
            role="radio" aria-checked="${o.value === value ? 'true' : 'false'}">${esc(o.label)}</button>`).join('')}
      </div>
      <p class="launch-help" id="${helpId}" hidden>${esc(field.help)}</p>
    </div>`;
  }
  const current = value === null ? '' : Number(value);
  const advancedValue = field.worldParamKey ? settings.parameterOverrides[field.worldParamKey] : undefined;
  const sliderValue = advancedValue ?? (current === '' ? presetValueFor(field, entry) : current);
  const position = launchValueToPosition(field, sliderValue);
  if (field.kind === 'number') {
    return `<div class="launch-field" data-field="${esc(field.key)}"><div class="launch-field-head"><div class="launch-label-group">${helpButton}</div><span class="launch-field-value" data-value-for="${esc(field.key)}">${value ?? ''}</span></div><input type="number" class="launch-number" data-key="${esc(field.key)}" min="${field.min}" max="${field.max}" step="${field.step}" value="${value ?? ''}" placeholder="Fresh each launch" aria-describedby="${helpId}"><p class="launch-help" id="${helpId}" hidden>${esc(field.help)}</p></div>`;
  }
  return `<div class="launch-field" data-field="${esc(field.key)}">
    <div class="launch-field-head">
      <div class="launch-label-group">${helpButton}</div>
      <span class="launch-field-value" data-value-for="${esc(field.key)}">${advancedValue !== undefined ? 'from advanced' : (current === '' ? 'from preset' : formatValue(current))}</span>
    </div>
    <div class="launch-range-wrap">
      <input class="launch-range" type="range" id="launch-${esc(field.key)}"
        data-key="${esc(field.key)}" min="0" max="1000" step="1" value="${position}"
        aria-label="${esc(field.label)}" aria-describedby="${helpId}">
      <div class="launch-scale" aria-hidden="true">${rangeMarksHtml(field)}</div>
    </div>
    <p class="launch-help" id="${helpId}" hidden>${esc(field.help)}</p>
  </div>`;
}

function labelForOption(field, value) {
  const found = field.options.find((o) => o.value === value);
  return found ? found.label.split('—')[0].trim() : String(value ?? '');
}

function updatePresetSelection(overlay, presets, settings) {
  for (const card of overlay.querySelectorAll('.launch-preset')) {
    const selected = card.dataset.preset === settings.presetId;
    card.classList.toggle('current', selected);
    card.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
  const entry = presets.find((candidate) => candidate.id === settings.presetId);
  for (const field of LAUNCH_FIELDS) {
    const value = settings[field.key];
    const fieldNode = overlay.querySelector(`[data-field="${field.key}"]`);
    if (!fieldNode) continue;
    const readout = fieldNode.querySelector(`[data-value-for="${field.key}"]`);
    if (field.kind === 'choice') {
      for (const button of fieldNode.querySelectorAll('.launch-choice')) {
        const selected = button.dataset.value === String(value);
        button.classList.toggle('current', selected);
        button.setAttribute('aria-checked', selected ? 'true' : 'false');
      }
      if (readout) readout.textContent = labelForOption(field, value);
    } else if (field.kind === 'number') {
      const number = fieldNode.querySelector('.launch-number');
      if (number) number.value = value ?? '';
      if (readout) readout.textContent = value ?? '';
    } else {
      const range = fieldNode.querySelector('.launch-range');
      const advancedValue = field.worldParamKey ? settings.parameterOverrides[field.worldParamKey] : undefined;
      const sliderValue = advancedValue ?? (value === null ? presetValueFor(field, entry) : value);
      if (range) range.value = String(launchValueToPosition(field, sliderValue));
      if (readout) readout.textContent = advancedValue !== undefined ? 'from advanced' : (value === null ? 'from preset' : formatValue(value));
    }
  }
}

function renderPresetCards(overlay, presets, selectedId, comparedIds = []) {
  const grid = overlay.querySelector('.launch-presets');
  if (grid) grid.innerHTML = presetCardsHtml(presets, selectedId, comparedIds);
}

function renderComparison(overlay, presets, comparedIds) {
  const target = overlay.querySelector('.launch-comparison');
  if (target) target.innerHTML = comparisonHtml(presets, comparedIds);
}

function updateComparisonButtons(overlay, presets, comparedIds) {
  for (const button of overlay.querySelectorAll('[data-compare-select]')) {
    const selected = comparedIds.includes(button.dataset.compareSelect);
    const preset = presets.find((entry) => entry.id === button.dataset.compareSelect);
    const action = selected ? 'Remove from' : 'Add to';
    button.classList.toggle('current', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    button.setAttribute('aria-label', `${action} comparison: ${preset?.name || 'world'}`);
    button.setAttribute('title', `${action} comparison`);
  }
}

function renderAdvanced(overlay, entry, settings) {
  const body = overlay.querySelector('.launch-advanced-body');
  const activePanel = [...overlay.querySelectorAll('.launch-tab-panel')].find((panel) => !panel.hidden)?.dataset.panel || 'laws';
  if (body) body.innerHTML = advancedPanelsHtml(entry, settings);
  for (const panel of overlay.querySelectorAll('.launch-tab-panel')) panel.hidden = panel.dataset.panel !== activePanel;
  for (const tab of overlay.querySelectorAll('.launch-tab')) {
    const active = tab.dataset.tab === activePanel;
    tab.classList.toggle('current', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  }
}

/**
 * Show the launch modal.
 *
 * @param {object} [options]
 * @param {object} [options.settings] last launch settings
 * @param {boolean} [options.isFirstRun] changes the primary button's wording
 * @returns {Promise<object|null>} chosen settings, or null when dismissed
 */
export function showLaunchModal(options = {}) {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let settings = normaliseLaunchSettings(options.settings || defaultLaunchSettings());
    let presets = getLaunchPresets();
    if (!presets.some((preset) => preset.id === settings.presetId)) {
      settings = { ...settings, presetId: defaultLaunchSettings().presetId };
    }
    let selectedEntry = presets.find((preset) => preset.id === settings.presetId);
    let comparedIds = [];
    const overlay = document.createElement('div');
    overlay.className = 'launch-overlay';
    overlay.id = 'launch-overlay';
    overlay.innerHTML = `
      <section class="launch-panel" role="dialog" aria-modal="true" aria-labelledby="launch-title">
        <header class="launch-header">
          <div><span class="launch-kicker">VEPA4 · WORLD INITIALIZER</span><h1 id="launch-title">${TITLE}</h1>
            <p class="launch-intro">Choose the conditions your next living world begins with.</p></div>
          <button type="button" class="launch-close" data-act="cancel" aria-label="Skip and use defaults">×</button>
        </header>
        <div class="launch-body">
          <h2 class="launch-section-title">CHOOSE A WORLD</h2>
          <div class="launch-preset-filters" aria-label="Filter presets">
            ${['All', ...new Set(presets.map((preset) => preset.category || 'Ecologies'))].map((category) => `<button type="button" class="launch-filter-chip${category === 'All' ? ' current' : ''}" data-preset-filter="${esc(category)}">${esc(category)}</button>`).join('')}
          </div>
          <div class="launch-presets" role="list" aria-label="Launch presets">
            ${presetCardsHtml(presets, settings.presetId, comparedIds)}
          </div>
          <div class="launch-comparison" aria-live="polite">${comparisonHtml(presets, comparedIds)}</div>
          <div class="launch-custom-save">
            <label class="launch-sr-only" for="launch-custom-name">Name this launch preset</label>
            <input id="launch-custom-name" class="launch-custom-name" type="text" maxlength="36" placeholder="Name your setup…" autocomplete="off">
            <button type="button" class="launch-save-preset" data-act="save-custom">SAVE SETUP</button>
            <span class="launch-custom-status" role="status" aria-live="polite"></span>
          </div>
          <h2 class="launch-section-title">TUNE THE STARTING CONDITIONS</h2>
          <p class="launch-note launch-log-note">Logarithmic scales give fine control at low values; tap ABOUT for a description. Tick marks show useful reference values.</p>
          ${LAUNCH_FIELDS.filter((field) => field.key !== 'launchSeed' && field.key !== 'founderEra').map((field) => fieldHtml(field, settings[field.key], selectedEntry, settings)).join('')}
          ${advancedContentHtml(selectedEntry, settings)}
          <p class="launch-note launch-note-remember">Your choice is remembered. Fine-tune the world later from SETUP.</p>
        </div>
        <footer class="launch-footer">
          <button type="button" class="launch-secondary" data-act="cancel">Use defaults</button>
          <button type="button" class="launch-primary" data-act="launch">${options.isFirstRun ? 'Launch' : 'Launch with these settings'}</button>
        </footer>
      </section>`;
    document.body.appendChild(overlay);

    const previouslyFocused = typeof document.activeElement === 'object' ? document.activeElement : null;
    const panel = overlay.querySelector('.launch-panel');
    const firstControl = overlay.querySelector('.launch-preset, .launch-primary');
    if (firstControl && typeof firstControl.focus === 'function') firstControl.focus();

    const selectPreset = (id) => {
      const entry = presets.find((candidate) => candidate.id === id);
      if (!entry) return;
      for (const field of LAUNCH_FIELDS) {
        const button = overlay.querySelector(`.launch-help-trigger[data-help="${field.key}"]`);
        const help = overlay.querySelector(`#launch-help-${field.key}`);
        if (button) button.setAttribute('aria-expanded', 'false');
        if (help) help.hidden = true;
      }
      selectedEntry = entry;
      if (entry.custom) {
        settings = normaliseLaunchSettings({ ...entry.settings, presetId: id });
      } else {
        settings = {
          ...settings,
          presetId: id,
          worldSize: null,
          initialPop: null,
          maxPopulation: null,
          gravity: null,
          thermalField: null,
          spawnRate: null,
          mutationRate: null,
        };
      }
      if (!entry.custom) {
        settings = { ...settings, laws: null, speciesNames: null, parameterOverrides: {} };
        for (const field of LAUNCH_FIELDS) if (field.worldParamKey) settings[field.key] = null;
      }
      updatePresetSelection(overlay, presets, settings);
      renderAdvanced(overlay, selectedEntry, settings);
      renderComparison(overlay, presets, comparedIds);
    };

    const setChoice = (key, value) => {
      settings = { ...settings, [key]: value };
      const field = LAUNCH_FIELDS.find((candidate) => candidate.key === key);
      if (field) {
        const readout = overlay.querySelector(`[data-value-for="${key}"]`);
        if (readout) readout.textContent = labelForOption(field, value);
      }
      for (const button of overlay.querySelectorAll(`.launch-choice[data-key="${key}"]`)) {
        const selected = button.dataset.value === String(value);
        button.classList.toggle('current', selected);
        button.setAttribute('aria-checked', selected ? 'true' : 'false');
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close();
        resolve(null);
        return;
      }
      const helpButton = event.target.closest('.launch-help-trigger');
      if (helpButton) {
        const field = overlay.querySelector(`[data-field="${helpButton.dataset.help}"]`);
        const help = field && field.querySelector('.launch-help');
        const expanded = helpButton.getAttribute('aria-expanded') !== 'true';
        if (help) help.hidden = !expanded;
        helpButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        return;
      }
      const compareButton = event.target.closest('[data-compare-select]');
      if (compareButton) {
        const id = compareButton.dataset.compareSelect;
        comparedIds = comparedIds.includes(id) ? comparedIds.filter((item) => item !== id) : [...comparedIds, id].slice(-3);
        updateComparisonButtons(overlay, presets, comparedIds);
        renderComparison(overlay, presets, comparedIds);
        return;
      }
      const filterButton = event.target.closest('[data-preset-filter]');
      if (filterButton) {
        const category = filterButton.dataset.presetFilter;
        for (const chip of overlay.querySelectorAll('.launch-filter-chip')) chip.classList.toggle('current', chip === filterButton);
        for (const card of overlay.querySelectorAll('.launch-preset-wrap')) card.hidden = category !== 'All' && card.dataset.category !== category;
        return;
      }
      const tabButton = event.target.closest('.launch-tab');
      if (tabButton) {
        const panels = overlay.querySelectorAll('.launch-tab-panel');
        for (const panelNode of panels) panelNode.hidden = panelNode.dataset.panel !== tabButton.dataset.tab;
        for (const tab of overlay.querySelectorAll('.launch-tab')) {
          const active = tab.dataset.tab === tabButton.dataset.tab;
          tab.classList.toggle('current', active);
          tab.setAttribute('aria-selected', active ? 'true' : 'false');
        }
        return;
      }
      const advancedToggle = event.target.closest('[data-act="toggle-advanced"]');
      if (advancedToggle) {
        const body = overlay.querySelector('#launch-advanced-body');
        const expanded = advancedToggle.getAttribute('aria-expanded') !== 'true';
        advancedToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        advancedToggle.querySelector('span').textContent = expanded ? '−' : '＋';
        if (body) body.hidden = !expanded;
        return;
      }
      const paramReset = event.target.closest('[data-param-reset]');
      if (paramReset) {
        const key = paramReset.dataset.paramReset;
        const next = { ...settings, parameterOverrides: { ...settings.parameterOverrides } };
        const savedSettings = selectedEntry?.custom ? selectedEntry.settings : null;
        if (savedSettings?.parameterOverrides?.[key] !== undefined) {
          next.parameterOverrides[key] = savedSettings.parameterOverrides[key];
        } else {
          delete next.parameterOverrides[key];
        }
        for (const field of LAUNCH_FIELDS) {
          if (field.worldParamKey === key) next[field.key] = savedSettings ? (savedSettings[field.key] ?? null) : null;
        }
        settings = next;
        updatePresetSelection(overlay, presets, settings);
        renderAdvanced(overlay, selectedEntry, settings);
        return;
      }
      const act = event.target.closest('[data-act]');
      if (act && act.dataset.act === 'save-custom') {
        const nameInput = overlay.querySelector('#launch-custom-name');
        const saved = saveCustomLaunchPreset(nameInput ? nameInput.value : '', settings);
        const status = overlay.querySelector('.launch-custom-status');
        if (!saved) {
          if (status) status.textContent = 'Enter a name; browser storage must be available.';
          return;
        }
        settings = normaliseLaunchSettings({ ...saved.settings, presetId: saved.id });
        presets = getLaunchPresets();
        selectedEntry = presets.find((candidate) => candidate.id === saved.id);
        renderPresetCards(overlay, presets, saved.id, comparedIds);
        updateComparisonButtons(overlay, presets, comparedIds);
        updatePresetSelection(overlay, presets, settings);
        renderAdvanced(overlay, selectedEntry, settings);
        renderComparison(overlay, presets, comparedIds);
        if (nameInput) nameInput.value = '';
        if (status) status.textContent = `Saved “${saved.name}” on this device.`;
        return;
      }
      if (act && act.dataset.act === 'clear-search') {
        const panelSearch = act.closest('.launch-tab-panel')?.querySelector('.launch-advanced-search');
        if (panelSearch) {
          panelSearch.value = '';
          for (const row of panelSearch.closest('.launch-tab-panel').querySelectorAll('[data-search]')) row.hidden = false;
        }
        return;
      }
      if (act && act.dataset.act === 'reset-laws') {
        settings = {
          ...settings,
          laws: selectedEntry?.custom ? (selectedEntry.settings.laws ?? null) : null,
        };
        renderAdvanced(overlay, selectedEntry, settings);
        return;
      }
      if (act && act.dataset.act === 'all-laws') {
        settings = { ...settings, laws: Object.keys(LAW_INDEXES) };
        renderAdvanced(overlay, selectedEntry, settings);
        return;
      }
      if (act && act.dataset.act === 'reset-parameters') {
        const savedSettings = selectedEntry?.custom ? selectedEntry.settings : null;
        const reset = {
          ...settings,
          parameterOverrides: { ...(savedSettings?.parameterOverrides || {}) },
        };
        for (const field of LAUNCH_FIELDS) {
          if (field.worldParamKey) reset[field.key] = savedSettings ? (savedSettings[field.key] ?? null) : null;
        }
        settings = reset;
        updatePresetSelection(overlay, presets, settings);
        renderAdvanced(overlay, selectedEntry, settings);
        return;
      }
      if (act && act.dataset.act === 'random-seed') {
        const seed = globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] : Date.now();
        settings = { ...settings, launchSeed: Math.max(1, seed % 2147483647), launchSeedText: '' };
        const seedInput = overlay.querySelector('#launch-seed');
        const textInput = overlay.querySelector('#launch-seed-text');
        const result = overlay.querySelector('[data-seed-result]');
        if (seedInput) seedInput.value = settings.launchSeed;
        if (textInput) textInput.value = '';
        if (result) result.textContent = '';
        return;
      }
      if (act && act.dataset.act === 'launch') {
        const seedInput = overlay.querySelector('#launch-seed');
        if (seedInput && seedInput.value !== '') settings = { ...settings, launchSeed: Number(seedInput.value) };
      }
      if (act) {
        const answer = act.dataset.act === 'launch' ? normaliseLaunchSettings(settings) : null;
        close();
        resolve(answer);
        return;
      }
      const card = event.target.closest('.launch-preset');
      if (card) { selectPreset(card.dataset.preset); return; }
      const choice = event.target.closest('.launch-choice');
      if (choice) setChoice(choice.dataset.key, choice.dataset.value);
    });

    overlay.addEventListener('change', (event) => {
      const speciesCheck = event.target.closest('.launch-species-toggle');
      if (speciesCheck) {
        const availableSpecies = (selectedEntry?.preset?.species || []).map((item) => item.name);
        const selectedSpecies = settings.speciesNames?.filter((name) => availableSpecies.includes(name)) || [];
        const activeSpecies = new Set(selectedSpecies.length ? selectedSpecies : availableSpecies);
        if (speciesCheck.checked) activeSpecies.add(speciesCheck.dataset.species);
        else activeSpecies.delete(speciesCheck.dataset.species);
        if (!activeSpecies.size) { speciesCheck.checked = true; return; }
        settings = { ...settings, speciesNames: [...activeSpecies] };
        const speciesCountNode = overlay.querySelector('[data-species-count]');
        if (speciesCountNode) speciesCountNode.textContent = String(activeSpecies.size);
        return;
      }
      const lawCheck = event.target.closest('.launch-law-toggle');
      if (!lawCheck) return;
      const activeLaws = new Set(settings.laws ?? selectedEntry?.preset?.laws ?? []);
      if (lawCheck.checked) activeLaws.add(lawCheck.dataset.law);
      else activeLaws.delete(lawCheck.dataset.law);
      settings = { ...settings, laws: [...activeLaws] };
      const lawCount = overlay.querySelector('[data-law-count]');
      if (lawCount) lawCount.textContent = String(activeLaws.size);
      const category = lawCheck.closest('.launch-law-category');
      const countLabel = category?.querySelector('summary span');
      if (category && countLabel) countLabel.textContent = `${category.querySelectorAll('.launch-law-toggle:checked').length}/${category.querySelectorAll('.launch-law-toggle').length}`;
    });

    overlay.addEventListener('input', (event) => {
      const search = event.target.closest('.launch-advanced-search');
      if (search) {
        const query = search.value.trim().toLowerCase();
        const panelNode = search.closest('.launch-tab-panel');
        for (const row of panelNode.querySelectorAll('[data-search]')) {
          row.hidden = Boolean(query && !row.dataset.search.includes(query));
          const category = row.closest('.launch-law-category, .launch-param-category');
          if (query && !row.hidden && category) category.open = true;
        }
        return;
      }
      const number = event.target.closest('.launch-number');
      if (number) {
        const field = LAUNCH_FIELDS.find((candidate) => candidate.key === number.dataset.key);
        settings = { ...settings, [number.dataset.key]: number.value === '' ? null : (field ? Number(number.value) : null) };
        return;
      }
      const textSeed = event.target.closest('#launch-seed-text');
      if (textSeed) {
        const derived = textSeed.value ? deriveTextSeed(textSeed.value) : null;
        settings = { ...settings, launchSeedText: textSeed.value, launchSeed: derived?.seed ?? null };
        const seedInput = overlay.querySelector('#launch-seed');
        const result = overlay.querySelector('[data-seed-result]');
        if (seedInput) seedInput.value = derived?.seed ?? '';
        if (result) result.textContent = derived ? `Seed ${derived.seed}` : '';
        return;
      }
      const seed = event.target.closest('#launch-seed');
      if (seed) {
        settings = { ...settings, launchSeed: seed.value === '' ? null : Number(seed.value), launchSeedText: '' };
        const textInput = overlay.querySelector('#launch-seed-text');
        const result = overlay.querySelector('[data-seed-result]');
        if (textInput) textInput.value = '';
        if (result) result.textContent = '';
        return;
      }
      const param = event.target.closest('[data-param]');
      if (param) {
        if (param.value === '') return;
        const value = Number(param.value);
        if (!Number.isFinite(value)) return;
        const min = Number(param.min ?? param.getAttribute('min')) || 0;
        const max = Number(param.max ?? param.getAttribute('max'));
        const step = Number(param.step ?? param.getAttribute('step')) || 1;
        const clamped = Math.min(max, Math.max(min, value));
        const snapped = min + Math.round((clamped - min) / step) * step;
        const snappedValue = Number(snapped.toFixed(6));
        param.value = String(snappedValue);
        const next = { ...settings, parameterOverrides: { ...settings.parameterOverrides, [param.dataset.param]: snappedValue } };
        for (const field of LAUNCH_FIELDS) {
          if (field.worldParamKey !== param.dataset.param) continue;
          next[field.key] = null;
          const range = overlay.querySelector(`.launch-range[data-key="${field.key}"]`);
          const readout = overlay.querySelector(`[data-value-for="${field.key}"]`);
          if (range) range.value = String(launchValueToPosition(field, snappedValue));
          if (readout) readout.textContent = 'from advanced';
        }
        settings = next;
        return;
      }
      const input = event.target.closest('.launch-range');
      if (!input) return;
      const field = LAUNCH_FIELDS.find((candidate) => candidate.key === input.dataset.key);
      if (!field) return;
      const value = launchPositionToValue(field, input.value);
      const parameterOverrides = { ...settings.parameterOverrides };
      if (field.worldParamKey) delete parameterOverrides[field.worldParamKey];
      settings = { ...settings, [field.key]: value, parameterOverrides };
      const readout = overlay.querySelector(`[data-value-for="${field.key}"]`);
      if (readout) readout.textContent = formatValue(value);
      if (field.worldParamKey) {
        const parameter = overlay.querySelector(`[data-param="${field.worldParamKey}"]`);
        if (parameter) parameter.value = String(value);
      }
      if (!selectedEntry?.custom && selectedEntry) settings.presetId = selectedEntry.id;
    });

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        resolve(null);
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [...panel.querySelectorAll('button, input, select, [tabindex]')]
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    function close() {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    }
    document.addEventListener('keydown', onKey, true);
  });
}

/** True while the launch modal is on screen. Test seam and debug hook. */
export function isLaunchModalOpen() {
  return typeof document !== 'undefined' && Boolean(document.getElementById('launch-overlay'));
}
