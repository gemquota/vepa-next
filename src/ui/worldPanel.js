/**
 * VEPA v3 — World Panel (WORLD tab)
 * Category filter tabs + law grid (icon ⇄ settings-style word mode) +
 * world parameter sliders grouped into accordion sections.
 */
import { LAW_INDEXES, LAW_CATEGORIES, LAW_COUNT, LAW_SPECTRUM, LAW_HUE_BY_INDEX, LAW_SAT_BY_INDEX, LAW_HELP_DB } from '../constants.js';
import { isSet } from '../state/lawState.js';
import { WORLD_PARAM_DEFS } from '../state/worldParams.js';
import { runtimeConfig } from '../state/runtimeConfig.js';
import { createSliderRow } from './sliderControl.js';
import { MECHANICS_ICONS } from './mechanicsIcons.js';
import { escapeHtml } from './html.js';

// Law icon symbols (matching v2 aesthetic)
const LAW_ICONS = {
  GRAV: '⬡', DRAG: '≋', ENTR: '~', BUOYANCY: '⌾', COLL: '⊕', ACCR: '⊞', PLANETARY: '♁',
  VOID: '∅', BOND: '⛓',
  LIFE: '✦', GLOW: '☀', AFFINITY: '⇌', REPRO: '⚤', TRACK: '⌖', SENESCENCE: '☠', PREDATION: '⚔',
  ENERGY: '⚡', RADIATION: '☢', GENOTYPE: '🧬', PHENOTYPE: '◈',
  CATALYSIS_LAW: '⚗', SOLVATION: '≈', ACIDITY: '∇', OXIDATION: '🔥', POLYMER: '⛓',
  ISOMERIZATION: '⟳', CHIRALITY: '⇆', CRYSTALLIZATION: '◇', REDUCTION: '▼', ALLOY: '◆',
  HEAT: '☀', COLD: '❄', CONVECTION: '↻', PHASE_RADIATION: '⟐', SUBLIMATION: '⟡',
  MELT: '↕', BOIL: '♨', CONDENSE: '↓', DEPOSIT: '⬇', EXOTHERMIC: '★',
  TIME_DILATION: '⌛', DIMENSIONALITY: '◈', CHAOS: '☄', ORDER: '⊡', FATE: '⚖',
  WILL: '⚔', SOUL_LAW: '👁', MIND: '🧠',
  TELEPATHY: '〰', CLAIRVOYANCE: '◎', PRECOGNITION: '◉', ASTRAL: '👻',
  COMMS: '◍',
  CHARGE_LAW: '±', FIELD: '✺', CURRENT: '⇥', RESISTANCE: 'Ω', CAPACITANCE: '∥',
  INDUCTANCE: '∿', MAGNETISM: '🧲', RESONANCE: '♫', FLUX: '⇄', IONIZATION: '⚛',
  MEMORY: '💾', PATTERN: '▦', STIGMERGY: '🐜', SIGNAL_BOOST: '📶', LEARN: '🎓',
  SYMBOL: '☯', METRIC: '📏', PREDICT: '🔮', CODE: '✜', PROTOCOL: '📡',
  FEEDBACK: '↺', LANGUAGE: '💬', CULTURE: '🎭',
  SINGULARITY: '⬤', ENTANGLEMENT: '⚭', HISTORY: '📜',
  TIDE: '🌊', FRICTION: '🧱', SYMBIOSIS: '🤝', PARASITE: '🪱', HIBERNATION: '💤', IMMUNITY: '🛡', ELECTROLYSIS: '🔋', PHOTOLYSIS: '💡', PRECIPITATION: '🌨', NEUTRALIZATION: '🧪', STOICHIOMETRY: '📐', AUTOCATALYSIS: '♻️', ADIABATIC: '🔺', COMPRESSION: '⤵', EXPANSION: '⤴', EQUILIBRIUM: '🌡', LATENT_HEAT: '🧊', RUNAWAY: '💥', CONSCIOUSNESS: '💭', PERCEPTION: '👀', SYNCHRONICITY: '🔗', ANTENNA: '📻', SHIELDING: '🧿', POLARIZATION: '🌈', NAVIGATION: '🧭', ENCRYPTION: '🔐', SUPERPOSITION: '☍', TUNNELING: '⤳', DECOHERENCE: '✧', WAVE_PARTICLE: '⇜', UNCERTAINTY: '?', TELEPORT: '➤', OBSERVER: '❂', PLANCK: '▰', COHERENCE: '♒', BOSONIC: '⊛', FERMIONIC: '⊝', SPIN: '⟲', SPECTRAL: '🎵', WAVEFUNCTION: '∫', HYPERPLANE: '◫', ANTIMATTER: '💫',
  SYMBIOSIS: '🤝', PARASITE: '🪱', HIBERNATION: '💤', IMMUNITY: '🛡',
  ELECTROLYSIS: '⚡', PHOTOLYSIS: '☀', PRECIPITATION: '🌧', NEUTRALIZATION: '🧪',
  STOICHIOMETRY: '⚖', AUTOCATALYSIS: '♾',
  ADIABATIC: '🌡', COMPRESSION: '⭘', EXPANSION: '⬡', EQUILIBRIUM: '≌', LATENT_HEAT: '💧', RUNAWAY: '🔥',
  CONSCIOUSNESS: '💭', PERCEPTION: '👁', SYNCHRONICITY: '✨',
  ANTENNA: '📡', SHIELDING: '🛰', POLARIZATION: '🎚',
  NAVIGATION: '🧭', ENCRYPTION: '🔐',
  SUPERPOSITION: '⚛', TUNNELING: '⏩', DECOHERENCE: '🌫', WAVE_PARTICLE: '🌊', UNCERTAINTY: '❓',
  TELEPORT: '👽', OBSERVER: '🔭', PLANCK: '🔩', COHERENCE: '🔗', BOSONIC: '🟣', FERMIONIC: '🚫',
  SPIN: '🕸', SPECTRAL: '🌈', WAVEFUNCTION: '🎇', HYPERPLANE: '🧊', ANTIMATTER: '💥',
  ...MECHANICS_ICONS,
};

// Reverse: law index → name
const LAW_NAME_BY_IDX = {};
for (const [name, idx] of Object.entries(LAW_INDEXES)) {
  LAW_NAME_BY_IDX[idx] = name;
}

// Reverse: law index → category class
const LAW_CAT_CLASS = {};
for (const [catName, cat] of Object.entries(LAW_CATEGORIES)) {
  for (const idx of cat.laws) {
    LAW_CAT_CLASS[idx] = catName;
  }
}

// Track which law is currently selected for info display
let selectedLawIdx = -1;
let viewMode = 'icon';  // 'icon' | 'word' — which mode the law grid shows
let iconSize = 'big';   // 'big' | 'compact' — icon tile size (v8.1 toggle)

// ── Law set presets (theorycrafted) ─────────────────────────────
// Each preset lists law names; indices resolve via LAW_INDEXES at load.
export const LAW_SET_PRESETS = [
  { name: 'PRIME DIRECTIVE', laws: ['GRAV', 'DRAG', 'COLL', 'BOND'] },
  { name: 'ORIGIN SOUP', laws: ['LIFE', 'REPRO', 'ENERGY', 'AFFINITY'] },
  { name: 'NEUTRON STAR', laws: ['GRAV', 'ACCR', 'PLANETARY', 'HEAT', 'COLD'] },
  { name: 'PREDATOR PREY', laws: ['TRACK', 'PREDATION', 'AFFINITY', 'REPRO'] },
  { name: 'CRYSTAL GARDEN', laws: ['CRYSTALLIZATION', 'BOND', 'COLL', 'ISOMERIZATION'] },
  { name: 'CHEMICAL REACTOR', laws: ['CATALYSIS_LAW', 'SOLVATION', 'ACIDITY', 'OXIDATION', 'REDUCTION', 'HEAT'] },
  { name: 'HIVE MIND', laws: ['COMMS', 'MIND', 'AFFINITY', 'TELEPATHY', 'ENERGY'] },
  { name: 'GHOST NATION', laws: ['SOUL_LAW', 'ASTRAL', 'TELEPATHY', 'CLAIRVOYANCE', 'PRECOGNITION'] },
  { name: 'THERMAL ENGINE', laws: ['HEAT', 'COLD', 'CONVECTION', 'PHASE_RADIATION', 'SUBLIMATION', 'MELT', 'BOIL', 'CONDENSE', 'DEPOSIT', 'EXOTHERMIC'] },
  { name: 'ENTROPY MAX', laws: ['ENTR', 'TIME_DILATION', 'CHAOS', 'SENESCENCE'] },
  { name: 'ORDER FORGE', laws: ['ORDER', 'FATE', 'WILL', 'CRYSTALLIZATION'] },
  { name: 'GENESIS', laws: ['LIFE', 'GENOTYPE', 'PHENOTYPE', 'REPRO', 'TRACK'] },
  { name: 'GRAVITY WELL', laws: ['GRAV', 'PLANETARY', 'ACCR', 'TIME_DILATION'] },
  { name: 'BIO CHEM', laws: ['LIFE', 'CATALYSIS_LAW', 'SOLVATION', 'ENERGY'] },
  { name: 'PSYCHIC NET', laws: ['MIND', 'COMMS', 'TELEPATHY', 'CLAIRVOYANCE'] },
  { name: 'DEEP SPACE', laws: ['VOID', 'COLD', 'ASTRAL', 'SOUL_LAW', 'DRAG'] },
  { name: 'POLYMER LAB', laws: ['POLYMER', 'BOND', 'ISOMERIZATION', 'CHIRALITY'] },
  { name: 'SUPERCONDUCTOR', laws: ['ALLOY', 'COLD', 'BOND', 'HEAT', 'SUPERCONDUCTIVITY'] },
  { name: 'CHRONOS', laws: ['TIME_DILATION', 'DIMENSIONALITY', 'FATE', 'PRECOGNITION'] },
  { name: 'CHAOS THEORY', laws: ['CHAOS', 'ENTR', 'WILL', 'FATE'] },
  { name: 'ELECTRIC STORM', laws: ['CHARGE_LAW', 'FIELD', 'CURRENT', 'IONIZATION', 'DISCHARGE', 'PLASMA'] },
  { name: 'NEURAL WEB', laws: ['MEMORY', 'LEARN', 'SYMBOL', 'LANGUAGE', 'FEEDBACK', 'CULTURE'] },
  { name: 'CRYO CURRENT', laws: ['SUPERCONDUCTIVITY', 'COLD', 'CURRENT', 'RESISTANCE', 'FLUX', 'CONDENSE'] },
  { name: 'QUANTUM SOUP', laws: ['SUPERPOSITION', 'TUNNELING', 'DECOHERENCE', 'COHERENCE', 'SPIN', 'SPECTRAL'] },
  { name: 'BLACK HOLE CORE', laws: ['GRAV', 'ACCR', 'SINGULARITY', 'TIDE', 'CONTACT'] },
  { name: 'ENTANGLED WEB', laws: ['ENTANGLEMENT', 'TELEPATHY', 'COMMS', 'ANTENNA', 'SYNCHRONICITY', 'COHERENCE'] },
  { name: 'CHEMICAL GARDEN', laws: ['ELECTROLYSIS', 'PHOTOLYSIS', 'PRECIPITATION', 'NEUTRALIZATION', 'AUTOCATALYSIS', 'SYMBIOSIS'] },
  { name: 'TIDAL LOCK', laws: ['TIDE', 'MOMENTUM', 'TORQUE', 'GRAV'] },
  { name: 'THERMAL RUNAWAY', laws: ['HEAT', 'ADIABATIC', 'RUNAWAY', 'EXPANSION', 'EQUILIBRIUM'] },
  { name: 'FARADAY CAGE', laws: ['SHIELDING', 'POLARIZATION', 'ANTENNA', 'CHARGE_LAW'] },
  { name: 'ANNIHILATION', laws: ['ANTIMATTER', 'BOSONIC', 'FERMIONIC', 'PLANCK'] },
];

const LAW_SET_STORAGE = 'vepa.lawsets.v1';
const proposedLaws = new WeakMap();
const displayedLaw = (state, index) => proposedLaws.get(state)?.get(index) ?? isSet(state, index);

function loadSavedLawSets() {
  try {
    const raw = localStorage.getItem(LAW_SET_STORAGE);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function persistLawSets(sets) {
  try { localStorage.setItem(LAW_SET_STORAGE, JSON.stringify(sets)); } catch { /* storage may be unavailable */ }
}

/** Resolve a preset's law list (names or indices) to concrete indices. */
function resolvePresetLaws(preset) {
  const out = [];
  for (const l of preset.laws || []) {
    const i = typeof l === 'number' ? l : LAW_INDEXES[l];
    if (i !== undefined && i < LAW_COUNT) out.push(i);
  }
  return out;
}

/**
 * Create the world panel in the WORLD tab.
 */
export function createWorldPanel(bus, lawStateObj) {
  const grid = document.getElementById('law-grid');
  const params = document.getElementById('world-params');
  if (!grid) return;
  proposedLaws.set(lawStateObj, new Map());
  const lawNotice = document.createElement('section');
  lawNotice.className = 'world-pending-notice';
  lawNotice.setAttribute('aria-label', 'Law restart changes');
  lawNotice.innerHTML = '<p>Law edits are proposals until restart. Lit tiles and counts show proposed settings; pending tiles are outlined. WRAP uses WORLD TOROIDAL.</p><p data-law-pending-status role="status" aria-live="polite">No staged law changes.</p><ul data-law-pending-details></ul><div class="world-pending-actions"><button type="button" data-law-pending-restart disabled>APPLY & RESTART</button><button type="button" data-law-pending-discard disabled>DISCARD LAWS</button></div>';
  grid.insertAdjacentElement('beforebegin', lawNotice);
  lawNotice.querySelector('[data-law-pending-restart]').addEventListener('click', () => {
    if (window.confirm('Apply ALL staged law and WORLD changes and restart? This replaces the current population.')) bus.emit('sim:restart');
  });
  lawNotice.querySelector('[data-law-pending-discard]').addEventListener('click', () => bus.emit('law:discardPending'));
  bus.on('law:pending', ({ changes }) => {
    proposedLaws.set(lawStateObj, new Map(changes.map(({ lawIndex, active }) => [lawIndex, active])));
    lawNotice.querySelector('[data-law-pending-status]').textContent = changes.length
      ? `${changes.length} law change${changes.length === 1 ? '' : 's'} pending — restart required.` : 'No staged law changes.';
    lawNotice.querySelector('[data-law-pending-details]').innerHTML = changes.map(({ label, liveValue, active }) =>
      `<li>${escapeHtml(label)}: ${liveValue ? 'ON' : 'OFF'} → ${active ? 'ON' : 'OFF'}</li>`).join('');
    lawNotice.querySelector('[data-law-pending-restart]').disabled = !changes.length;
    lawNotice.querySelector('[data-law-pending-discard]').disabled = !changes.length;
    renderLawGrid(grid, lawStateObj, bus);
  });
  bus.emit('law:pendingRequested');

  // ── Category filter buttons + exclusive view-mode group ──
  const filterRow = document.querySelector('.category-filter-row');
  if (filterRow) {
    filterRow.querySelectorAll('.cat-tab').forEach((btn) => {
      const catName = (btn.dataset.cat || '').replace('cat-', '');
      const band = LAW_SPECTRUM[LAW_CATEGORIES[catName]?.color] || LAW_SPECTRUM.BLUE;
      btn.style.setProperty('--cat-h', Math.round(band.center * 3.6));
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        applyCategoryFilter(grid);
      });
    });

    // Single 3-state cycle toggle: big icons → list words → compact icons.
    let group = filterRow.querySelector('.view-mode-group');
    if (!group) {
      group = document.createElement('div');
      group.className = 'view-mode-group';
      const btnCycle = document.createElement('button');
      btnCycle.className = 'view-mode-toggle law-mode-cycle';
      btnCycle.title = 'Law display: big icons → list → compact icons';
      group.appendChild(btnCycle);
      filterRow.appendChild(group);

      const VIEW_STATES = [
        { viewMode: 'icon', iconSize: 'big', glyph: '◈', label: 'BIG ICONS' },
        { viewMode: 'word', iconSize: 'big', glyph: 'ABC', label: 'LIST' },
        { viewMode: 'icon', iconSize: 'compact', glyph: '▦', label: 'COMPACT' },
      ];
      const viewStateIndex = () => {
        if (viewMode === 'word') return 1;
        return iconSize === 'compact' ? 2 : 0;
      };
      const sync = () => {
        const vs = VIEW_STATES[viewStateIndex()];
        btnCycle.textContent = vs.glyph;
        btnCycle.title = `Law display: ${vs.label} — click to cycle`;
        renderLawGrid(grid, lawStateObj, bus);
      };
      btnCycle.addEventListener('click', () => {
        const next = (viewStateIndex() + 1) % VIEW_STATES.length;
        viewMode = VIEW_STATES[next].viewMode;
        iconSize = VIEW_STATES[next].iconSize;
        sync();
      });
      sync();
    }
  }

  // ── Build law grid ──
  setupLawSearch(grid, lawStateObj, bus);
  renderLawGrid(grid, lawStateObj, bus);

  // ── Law set bar: save / load presets with a mini-icon dropdown ──
  setupLawSets(grid, bus, lawStateObj);

  // ── Build world parameter sliders (accordion groups) ──
  const pendingValues = new Map();
  if (params) {
    const notice = document.createElement('section');
    notice.className = 'world-pending-notice';
    notice.setAttribute('aria-label', 'World parameter restart changes');
    notice.innerHTML = '<p>WORLD and law edits are staged until restart. Pausing does not apply proposals. DNA sliders below are staged here too.</p><p data-pending-status role="status" aria-live="polite">No staged world changes.</p><ul data-pending-details></ul><div class="world-pending-actions"><button type="button" data-pending-restart disabled>APPLY & RESTART</button><button type="button" data-pending-discard disabled>DISCARD WORLD</button></div>';
    params.insertAdjacentElement('beforebegin', notice);
    notice.querySelector('[data-pending-restart]').addEventListener('click', () => {
      if (window.confirm('Apply all staged configuration changes and restart? This replaces the current population.')) bus.emit('sim:restart');
    });
    notice.querySelector('[data-pending-discard]').addEventListener('click', () => bus.emit('world:discardPending'));
    bus.on('world:paramsPending', ({ changes }) => {
      pendingValues.clear();
      for (const change of changes) pendingValues.set(change.key, change.value);
      notice.querySelector('[data-pending-details]').innerHTML = changes.map(({ key, label, liveValue, value }) =>
        `<li>${escapeHtml(label)} (${escapeHtml(key)}): ${liveValue} → ${value}</li>`).join('');
      notice.querySelector('[data-pending-status]').textContent = changes.length
        ? `${changes.length} world change${changes.length === 1 ? '' : 's'} pending — restart required. Staged law and DNA changes are listed in their own notices.`
        : 'No staged world changes. Law and DNA proposals have separate notices.';
      notice.querySelector('[data-pending-restart]').disabled = !changes.length;
      notice.querySelector('[data-pending-discard]').disabled = !changes.length;
    });
    renderWorldSliders(params, bus, pendingValues);
    bus.emit('world:pendingRequested');
  }

  const dnaNotice = document.createElement('section');
  dnaNotice.className = 'world-pending-notice';
  dnaNotice.setAttribute('aria-label', 'DNA restart changes');
  dnaNotice.innerHTML = '<p>Species DNA slider edits are proposals until restart. The current run keeps its live genome.</p><p data-dna-pending-status role="status" aria-live="polite">No staged DNA changes.</p><ul data-dna-pending-details></ul><div class="world-pending-actions"><button type="button" data-dna-pending-restart disabled>APPLY & RESTART</button><button type="button" data-dna-pending-discard disabled>DISCARD DNA</button></div>';
  if (params) params.insertAdjacentElement('afterend', dnaNotice);
  else grid.insertAdjacentElement('afterend', dnaNotice);
  dnaNotice.querySelector('[data-dna-pending-restart]').addEventListener('click', () => {
    if (window.confirm('Apply all staged configuration changes and restart? This replaces the current population.')) bus.emit('sim:restart');
  });
  dnaNotice.querySelector('[data-dna-pending-discard]').addEventListener('click', () => bus.emit('dna:discardPending'));
  bus.on('dna:pending', ({ changes = [] }) => {
    dnaNotice.querySelector('[data-dna-pending-status]').textContent = changes.length
      ? `${changes.length} DNA edit${changes.length === 1 ? '' : 's'} pending — restart required.`
      : 'No staged DNA changes.';
    dnaNotice.querySelector('[data-dna-pending-details]').innerHTML = changes.map(({ species, label, liveValue, value }) =>
      `<li>Species ${species + 1} · ${escapeHtml(label)}: ${liveValue.toPrecision(4)} → ${value.toPrecision(4)}</li>`).join('');
    dnaNotice.querySelector('[data-dna-pending-restart]').disabled = !changes.length;
    dnaNotice.querySelector('[data-dna-pending-discard]').disabled = !changes.length;
  });
  bus.emit('dna:pendingRequested');

  // ── Listen for law sync ──
  bus.on('law:sync', () => renderLawGrid(grid, lawStateObj, bus));

  // World-state restore (v7.6) — re-render the sliders so their positions
  // match the restored params (values are read live at render time).
  bus.on('world:paramsRestored', () => {
    if (params) renderWorldSliders(params, bus, pendingValues);
  });
}

/**
 * Set the selected law (for info display).
 */
export function setSelectedLaw(idx) {
  selectedLawIdx = idx;
  document.querySelectorAll('#law-grid .sq-toggle, #law-grid .law-btn').forEach((btn) => {
    const lawIdx = parseInt(btn.dataset.law, 10);
    btn.classList.toggle('selected', lawIdx === idx);
  });
}

function renderLawGrid(grid, lawStateObj, bus) {
  const isWordMode = viewMode === 'word';
  grid.className = isWordMode
    ? 'law-grid word-mode'
    : 'law-icon-grid' + (iconSize === 'compact' ? ' compact' : '');

  let html = '';
  // Mechanics (slate) pins to the top row, then a small divider, then the
  // eight rainbow categories in their canonical order.
  const catEntries = Object.entries(LAW_CATEGORIES);
  const mechanicsIdx = catEntries.findIndex(([n]) => n === 'mechanics');
  const orderedCats = mechanicsIdx >= 0
    ? [catEntries[mechanicsIdx], ...catEntries.filter((_, i) => i !== mechanicsIdx)]
    : catEntries;
  for (const [catName, cat] of orderedCats) {
    const band = LAW_SPECTRUM[cat.color] || LAW_SPECTRUM.BLUE;
    const centerHue = band.grey ? band.hue : Math.round(band.center * 3.6);
    const catSat = band.grey ? band.sat : null;
    let onCount = 0;
    for (const idx of cat.laws) if (displayedLaw(lawStateObj, idx)) onCount += 1;
    html += `<div class="law-cat-row" data-cat-row="${catName}">`;
    // The count answers "what is on?" without counting lit tiles, and bulk
    // controls act on visible matches only (with WRAP excluded explicitly).
    html += `<div class="law-cat-label" style="color:hsl(${centerHue} ${catSat ?? 85}% 65%);--law-h:${centerHue};--law-s:${catSat ?? 85}%">`
          + `<span class="law-cat-name">${catName}</span>`
          + `<span class="law-cat-count">${onCount}/${cat.laws.length}</span>`
          + `<button class="law-cat-bulk" data-bulk="on" data-cat="${catName}" title="Turn visible ${catName} matches on" aria-label="Turn visible ${catName} matches on">ON</button>`
          + `<button class="law-cat-bulk" data-bulk="off" data-cat="${catName}" title="Turn visible ${catName} matches off" aria-label="Turn visible ${catName} matches off">OFF</button>`
          + `</div>`;
    for (const idx of cat.laws) {
      const name = LAW_NAME_BY_IDX[idx] || `LAW_${idx}`;
      const icon = LAW_ICONS[name] || '?';
      const active = displayedLaw(lawStateObj, idx);
      const catClass = 'cat-' + catName;
      const hue = LAW_HUE_BY_INDEX[idx] !== undefined ? LAW_HUE_BY_INDEX[idx] : centerHue;
      const selectedClass = (idx === selectedLawIdx ? ' selected' : '')
        + (proposedLaws.get(lawStateObj)?.has(idx) ? ' pending-law' : '');
      const searchText = `data-name="${name.toLowerCase()}"`;
      if (isWordMode) {
        html += `<button class="law-btn ${catClass}${active ? ' active' : ''}${selectedClass}" ${searchText} `
              + `style="--law-h:${hue};--law-s:${LAW_SAT_BY_INDEX[idx] ?? 85}" data-law="${idx}" aria-pressed="${active}" title="${name}${proposedLaws.get(lawStateObj)?.has(idx) ? ' — pending restart' : ''}"${idx === LAW_INDEXES.WRAP ? ' disabled aria-label="WRAP — use WORLD TOROIDAL"' : ''}>`
              + `<span class="tog-icon">${icon}</span><span class="tog-name">${name}</span></button>`;
      } else {
        html += `<button class="sq-toggle ${catClass}${active ? ' active' : ''}${selectedClass}" ${searchText} `
              + `style="--law-h:${hue};--law-s:${LAW_SAT_BY_INDEX[idx] ?? 85}" data-law="${idx}" aria-pressed="${active}" title="${name}${proposedLaws.get(lawStateObj)?.has(idx) ? ' — pending restart' : ''}"${idx === LAW_INDEXES.WRAP ? ' disabled aria-label="WRAP — use WORLD TOROIDAL"' : ''}>`
              + `<span class="tog-icon">${icon}</span><span class="tog-name">${name}</span></button>`;
      }
    }
    html += '</div>';
    if (catName === 'mechanics') {
      html += '<div class="law-cat-divider" aria-hidden="true"></div>';
    }
  }
  grid.innerHTML = html;

  // Wire clicks
  grid.querySelectorAll('.sq-toggle, .law-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.law, 10);
      if (idx === LAW_INDEXES.WRAP) return;
      setSelectedLaw(idx);
      bus.emit('law:editRequested', { changes: [{ lawIndex: idx, active: !displayedLaw(lawStateObj, idx) }] });
    });
  });

  // Wire the per-category ON / OFF pairs. Every tile is toggled through the
  // same emit a manual tap uses, so the worker, the law panel and the preset
  // list all see the change by the same path — a bulk path of its own would be
  // a second way for the world to disagree with the grid.
  grid.querySelectorAll('.law-cat-bulk').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = LAW_CATEGORIES[btn.dataset.cat];
      if (!cat) return;
      const wantOn = btn.dataset.bulk === 'on';
      const row = btn.closest('.law-cat-row');
      const visibleIndexes = [...row.querySelectorAll('[data-law]')]
        .filter((tile) => tile.style.display !== 'none')
        .map((tile) => Number(tile.dataset.law));
      const excluded = visibleIndexes.filter((idx) => idx === LAW_INDEXES.WRAP);
      const targetIndexes = visibleIndexes.filter((idx) => idx !== LAW_INDEXES.WRAP);
      const changes = targetIndexes.filter((idx) => displayedLaw(lawStateObj, idx) !== wantOn)
        .map((lawIndex) => ({ lawIndex, active: wantOn }));
      const changed = changes.length;
      if (changed) bus.emit('law:editRequested', {
        changes, category: btn.dataset.cat, active: wantOn, changed,
        targetCount: targetIndexes.length, excluded: excluded.map(() => 'WRAP'),
      });
      const scope = `${targetIndexes.length} visible target${targetIndexes.length === 1 ? '' : 's'}`;
      const exception = excluded.length ? ' WRAP boundary mode was preserved.' : '';
      bus.emit('narrative:system', {
        text: `${btn.dataset.cat}: ${changed ? (wantOn ? 'staged ON for' : 'staged OFF for') : 'unchanged'} ${scope}; ${changed} changed.${exception}`,
      });
    });
  });

  // Re-apply category filter + search
  applyLawVisibility(grid);
}

// ── Law set bar (save / load presets) ───────────────────────────

function setupLawSets(grid, bus, lawStateObj) {
  const host = document.createElement('div');
  host.className = 'law-set-bar';

  // 3 buttons: dropdown selector, load (icon), save (icon)
  const selectorBtn = document.createElement('button');
  selectorBtn.className = 'law-set-btn law-set-selector';
  selectorBtn.title = 'Select a law set';
  const loadBtn = document.createElement('button');
  loadBtn.className = 'law-set-btn law-set-icon';
  loadBtn.textContent = '📂';
  loadBtn.title = 'Load the selected law set';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'law-set-btn law-set-icon';
  saveBtn.textContent = '💾';
  saveBtn.title = 'Save proposed law settings to the selected set (does not apply them)';
  host.append(selectorBtn, loadBtn, saveBtn);

  // Dropdown: one row per set, 1/4-size law icons in a single line.
  // Tapping a row only *selects* it — LOAD applies it, SAVE overwrites it.
  const dropdown = document.createElement('div');
  dropdown.className = 'law-set-dropdown';
  host.appendChild(dropdown);

  // Inline name editor (used when saving a brand-new set)
  const editor = document.createElement('div');
  editor.className = 'law-set-editor hidden';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 24;
  input.placeholder = 'PRESET NAME';
  const okBtn = document.createElement('button');
  okBtn.textContent = '✓';
  okBtn.title = 'Confirm save';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕';
  cancelBtn.title = 'Cancel save';
  editor.append(input, okBtn, cancelBtn);
  host.appendChild(editor);

  grid.insertAdjacentElement('afterend', host);

  const builtIns = LAW_SET_PRESETS.map((p) => ({ name: p.name, laws: resolvePresetLaws(p) }));
  let saved = loadSavedLawSets();
  let currentName = 'CUSTOM';   // the set applied to the sim right now
  let selectedName = null;      // the set highlighted in the dropdown

  // User-saved sets take precedence over built-ins with the same name.
  const allPresets = () => {
    const seen = new Set();
    const out = [];
    for (const p of [...saved, ...builtIns]) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      out.push(p);
    }
    return out;
  };

  const activeLawIndexes = () => {
    const laws = [];
    for (let i = 0; i < LAW_COUNT; i++) {
      if (displayedLaw(lawStateObj, i)) laws.push(i);
    }
    return laws;
  };

  const updateSelector = () => {
    selectorBtn.textContent = currentName + ' ▾';
  };

  const applyPreset = (preset) => {
    const enabled = new Set(preset.laws);
    bus.emit('law:editRequested', { changes: Array.from({ length: LAW_COUNT }, (_, lawIndex) => ({
      lawIndex, active: enabled.has(lawIndex),
    })).filter(({ lawIndex }) => lawIndex !== LAW_INDEXES.WRAP) });
    currentName = preset.name + ' (PROPOSED)';
    updateSelector();
  };

  const renderDropdown = () => {
    dropdown.innerHTML = '';
    for (const preset of allPresets()) {
      const row = document.createElement('div');
      row.className = 'law-set-row' + (preset.name === selectedName ? ' selected' : '');
      row.title = preset.name;
      const mark = document.createElement('span');
      mark.className = 'law-set-check';
      mark.textContent = preset.name === selectedName ? '✓' : '';
      const miniRow = document.createElement('div');
      miniRow.className = 'law-set-mini-row';
      for (const idx of preset.laws) {
        const name = LAW_NAME_BY_IDX[idx];
        const icon = LAW_ICONS[name] || '□';
        const cat = LAW_CAT_CLASS[idx] || 'physics';
        const s = document.createElement('span');
        s.className = 'law-set-mini-icon cat-' + cat;
        s.style.setProperty('--law-h', LAW_HUE_BY_INDEX[idx] !== undefined ? LAW_HUE_BY_INDEX[idx] : 210);
        s.style.setProperty('--law-s', (LAW_SAT_BY_INDEX[idx] || 80) + '%');
        s.textContent = icon;
        miniRow.appendChild(s);
      }
      const label = document.createElement('span');
      label.className = 'law-set-row-name';
      label.textContent = preset.name;
      row.append(mark, miniRow, label);
      // Select only — applying happens via the LOAD button. Tapping the
      // selected row again clears the selection (saving then names a new set).
      row.addEventListener('click', () => {
        selectedName = selectedName === preset.name ? null : preset.name;
        renderDropdown();
      });
      dropdown.appendChild(row);
    }
  };

  const openEditor = () => {
    editor.classList.remove('hidden');
    // Prefill the currently applied set name so saving renames it
    input.value = currentName === 'CUSTOM' ? '' : currentName;
    input.focus();
  };

  selectorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    renderDropdown();
    dropdown.classList.toggle('open');
  });

  loadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const pick = selectedName || currentName;
    const preset = allPresets().find((p) => p.name === pick);
    if (preset) {
      applyPreset(preset);
      // The applied set now lives in the selector label — clear the highlight
      selectedName = null;
      renderDropdown();
    }
    dropdown.classList.remove('open');
  });

  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.remove('open');
    if (selectedName) {
      // Overwrite the selected set with the current laws
      const name = selectedName;
      saved = saved.filter((p) => p.name !== name);
      saved.push({ name, laws: activeLawIndexes() });
      persistLawSets(saved);
      currentName = name;
      updateSelector();
      renderDropdown();
    } else {
      openEditor(); // brand-new set: ask for a name first
    }
  });

  okBtn.addEventListener('click', () => {
    const name = (input.value || '').trim().toUpperCase() || 'UNNAMED';
    saved = saved.filter((p) => p.name !== name);
    saved.push({ name, laws: activeLawIndexes() });
    persistLawSets(saved);
    currentName = name;
    selectedName = name;
    updateSelector();
    editor.classList.add('hidden');
    renderDropdown();
  });
  cancelBtn.addEventListener('click', () => editor.classList.add('hidden'));

  // Manual law edits return the label to CUSTOM
  bus.on('law:pending', () => {
    currentName = 'CUSTOM';
    updateSelector();
  });
  // Close the dropdown when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!host.contains(e.target)) dropdown.classList.remove('open');
  });

  updateSelector();
}
// ── World parameter groups (accordions) — derived from the SSOT defs ──
const WORLD_PARAM_GROUPS = (() => {
  const groupMap = new Map();
  for (const d of WORLD_PARAM_DEFS) {
    if (!groupMap.has(d.group)) groupMap.set(d.group, new Map());
    const subMap = groupMap.get(d.group);
    if (!subMap.has(d.subgroup)) subMap.set(d.subgroup, []);
    subMap.get(d.subgroup).push({ key: d.key, label: d.label, min: d.min, max: d.max, default: d.default, step: d.step });
  }
  const groups = [];
  for (const [label, subMap] of groupMap) {
    groups.push({
      label,
      subgroups: [...subMap.entries()].map(([sub, params]) => ({ label: sub, params })),
    });
  }
  return groups;
})();

function renderWorldSliders(container, bus, pendingValues = new Map()) {
  let html = '<div class="main-accordion">';

  WORLD_PARAM_GROUPS.forEach((group, gi) => {
    const open = gi === 0 ? ' open' : '';
    html += `<div class="accordion-section${open}">`;
    html += `<div class="accordion-header" data-acc="${gi}"><span class="arrow">▶</span>${group.label}</div>`;
    html += '<div class="accordion-body">';
    group.subgroups.forEach((sub, si) => {
      html += `<div class="sub-accordion-section${si === 0 ? ' open' : ''}">`;
      html += `<div class="sub-accordion-header" data-subacc="${gi}-${si}"><span class="arrow">▶</span>${sub.label}</div>`;
      html += '<div class="sub-accordion-body">';
      for (const p of sub.params) {
        html += `<div data-slider-slot="${p.key}"></div>`;
      }
      html += '</div></div>';
    });
    html += '</div></div>';
  });

  html += '</div>';
  container.innerHTML = html;

  // Accordion toggle
  container.querySelectorAll('.accordion-header').forEach((header) => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('open');
    });
  });

  // Sub-group accordion toggle
  container.querySelectorAll('.sub-accordion-header').forEach((header) => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('open');
    });
  });

  // Enhanced slider rows (min/max labels, lin/log, snap, hold-to-zoom)
  container.querySelectorAll('[data-slider-slot]').forEach((slot) => {
    const p = WORLD_PARAM_DEFS.find((d) => d.key === slot.dataset.sliderSlot);
    if (!p) return;
    const row = createSliderRow({
      label: p.label,
      min: p.min,
      max: p.max,
      step: p.step,
      default: p.default,
      value: pendingValues.get(p.key) ?? runtimeConfig.worldParams?.[p.key] ?? p.default,
      key: p.key,
      title: `${p.label} (${p.key})`,
      onChange: (value) => bus.emit('world:paramChanged', { key: p.key, value }),
    });
    slot.replaceWith(row.el);
  });
}

function applyCategoryFilter(grid) {
  applyLawVisibility(grid);
}

/**
 * Apply the category filter and the search box together.
 *
 * They compose rather than replace each other: a category tab hides a whole
 * row, and the search hides individual tiles inside the rows that survive. The
 * count in the search row reports how many laws are currently reachable, so a
 * search that matches nothing in a hidden category says so instead of
 * pretending the grid is simply short.
 */
function applyLawVisibility(grid) {
  const filterRow = document.querySelector('.category-filter-row');
  // Build set of active category names from filter tab data-cat attributes
  const activeCats = new Set();
  if (filterRow) {
    filterRow.querySelectorAll('.cat-tab.active').forEach((btn) => {
      activeCats.add(btn.dataset.cat);
    });
  }

  const query = (lawSearchValue() || '').trim().toLowerCase();
  let visibleTiles = 0;

  grid.querySelectorAll('.law-cat-row').forEach((row) => {
    const catName = row.dataset.catRow;
    const catOpen = catName !== undefined && activeCats.has('cat-' + catName);
    let rowMatches = 0;
    row.querySelectorAll('[data-law]').forEach((tile) => {
      const idx = Number(tile.dataset.law);
      const lawName = LAW_NAME_BY_IDX[idx] || '';
      const hint = LAW_HELP_DB[lawName]?.hint || '';
      const searchText = `${lawName} ${catName} ${hint}`.toLocaleLowerCase();
      const hit = !query || searchText.includes(query);
      tile.style.display = catOpen && hit ? '' : 'none';
      if (catOpen && hit) rowMatches += 1;
    });
    // A row with nothing left to show is hidden rather than left as a header
    // with a count and no laws under it.
    row.style.display = catOpen && (rowMatches > 0 || !query) ? '' : 'none';
    visibleTiles += rowMatches;
  });

  grid.querySelectorAll('.law-cat-bulk').forEach((button) => {
    const row = button.closest('.law-cat-row');
    const catName = button.dataset.cat;
    const visible = [...row.querySelectorAll('[data-law]')]
      .filter((tile) => tile.style.display !== 'none');
    const excludedWrap = visible.some((tile) => Number(tile.dataset.law) === LAW_INDEXES.WRAP);
    const targetCount = visible.filter((tile) => Number(tile.dataset.law) !== LAW_INDEXES.WRAP).length;
    const action = button.dataset.bulk === 'on' ? 'Turn on' : 'Turn off';
    const exception = excludedWrap ? '; WRAP boundary mode excluded' : '';
    button.textContent = `${button.dataset.bulk.toUpperCase()} ${targetCount}`;
    button.title = `${action} ${targetCount} visible ${catName} law${targetCount === 1 ? '' : 's'}${exception}`;
    button.setAttribute('aria-label', button.title);
  });

  const countEl = document.getElementById('law-search-count');
  if (countEl) {
    countEl.textContent = query ? `${visibleTiles} of ${LAW_COUNT}` : '';
  }
  return visibleTiles;
}

/** The current search text, read from the input if one is mounted. */
function lawSearchValue() {
  const input = document.getElementById('law-search');
  return input ? input.value : '';
}

/**
 * Wire the law search box.
 *
 * Kept out of `renderLawGrid` so typing does not rebuild 136 tiles per
 * keystroke — the grid is written once and the filter only toggles `display`.
 */
function setupLawSearch(grid, lawStateObj, bus) {
  const input = document.getElementById('law-search');
  const clear = document.getElementById('law-search-clear');
  if (!input) return;
  input.addEventListener('input', () => {
    applyLawVisibility(grid);
    if (clear) clear.disabled = !input.value;
  });
  // Enter jumps to the first surviving tile, so a keyboard user reaches a law
  // without tabbing through 130 hidden buttons.
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    for (const row of grid.querySelectorAll('.law-cat-row')) {
      if (row.style.display === 'none') continue;
      const first = [...row.querySelectorAll('[data-law]')].find((t) => t.style.display !== 'none');
      if (first) {
        first.click();
        return;
      }
    }
  });
  if (clear) {
    clear.disabled = !input.value;
    clear.addEventListener('click', () => {
      input.value = '';
      applyLawVisibility(grid);
      clear.disabled = true;
      input.focus();
    });
  }
}
