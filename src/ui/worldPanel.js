/**
 * VEPA v3 — World Panel (WORLD tab)
 * Category filter tabs + law grid (icon ⇄ settings-style word mode) +
 * world parameter sliders grouped into accordion sections.
 */
import { LAW_INDEXES, LAW_CATEGORIES, LAW_COUNT, LAW_SPECTRUM, LAW_HUE_BY_INDEX, LAW_SAT_BY_INDEX } from '../constants.js';
import { isSet, set as setLaw, clear as clearLaw, toggle as toggleLaw } from '../state/lawState.js';
import { WORLD_PARAM_DEFS } from '../state/worldParams.js';
import { runtimeConfig } from '../state/runtimeConfig.js';
import { createSliderRow } from './sliderControl.js';

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
  TIDE: '🌊', FRICTION: '🧱', ELASTICITY: '🏀', TURBULENCE: '🌀', CENTRIPETAL: '🎯', ROTATION: '🔄', SYMBIOSIS: '🤝', PARASITE: '🪱', HIBERNATION: '💤', IMMUNITY: '🛡', ELECTROLYSIS: '🔋', PHOTOLYSIS: '💡', PRECIPITATION: '🌨', NEUTRALIZATION: '🧪', STOICHIOMETRY: '📐', AUTOCATALYSIS: '♻️', ADIABATIC: '🔺', COMPRESSION: '⤵', EXPANSION: '⤴', EQUILIBRIUM: '🌡', LATENT_HEAT: '🧊', RUNAWAY: '💥', CONSCIOUSNESS: '💭', PERCEPTION: '👀', SYNCHRONICITY: '🔗', ANTENNA: '📻', SHIELDING: '🧿', POLARIZATION: '🌈', NAVIGATION: '🧭', ENCRYPTION: '🔐', SUPERPOSITION: '☍', TUNNELING: '⤳', DECOHERENCE: '✧', WAVE_PARTICLE: '⇜', UNCERTAINTY: '?', TELEPORT: '➤', OBSERVER: '❂', PLANCK: '▰', COHERENCE: '♒', BOSONIC: '⊛', FERMIONIC: '⊝', SPIN: '⟲', SPECTRAL: '🎵', WAVEFUNCTION: '∫', HYPERPLANE: '◫', ANTIMATTER: '💫',
  TIDE: '🌊', FRICTION: '🧽', ELASTICITY: '🪀', TURBULENCE: '🌀', CENTRIPETAL: '◎', ROTATION: '🔄',
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
  { name: 'BLACK HOLE CORE', laws: ['GRAV', 'ACCR', 'SINGULARITY', 'TIDE', 'CENTRIPETAL'] },
  { name: 'ENTANGLED WEB', laws: ['ENTANGLEMENT', 'TELEPATHY', 'COMMS', 'ANTENNA', 'SYNCHRONICITY', 'COHERENCE'] },
  { name: 'CHEMICAL GARDEN', laws: ['ELECTROLYSIS', 'PHOTOLYSIS', 'PRECIPITATION', 'NEUTRALIZATION', 'AUTOCATALYSIS', 'SYMBIOSIS'] },
  { name: 'TIDAL LOCK', laws: ['TIDE', 'CENTRIPETAL', 'ROTATION', 'GRAV'] },
  { name: 'THERMAL RUNAWAY', laws: ['HEAT', 'ADIABATIC', 'RUNAWAY', 'EXPANSION', 'EQUILIBRIUM'] },
  { name: 'FARADAY CAGE', laws: ['SHIELDING', 'POLARIZATION', 'ANTENNA', 'CHARGE_LAW'] },
  { name: 'ANNIHILATION', laws: ['ANTIMATTER', 'BOSONIC', 'FERMIONIC', 'PLANCK'] },
];

const LAW_SET_STORAGE = 'vepa.lawsets.v1';

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

    // [◈ icon] [ABC list] [▦ size] — view mode + icon size toggles.
    let group = filterRow.querySelector('.view-mode-group');
    if (!group) {
      group = document.createElement('div');
      group.className = 'view-mode-group';
      const btnIcon = document.createElement('button');
      btnIcon.className = 'view-mode-toggle law-mode-icon';
      btnIcon.title = 'Icon view';
      btnIcon.textContent = '◈';
      const btnWord = document.createElement('button');
      btnWord.className = 'view-mode-toggle law-mode-abc';
      btnWord.title = 'List view';
      btnWord.textContent = 'ABC';
      const btnSize = document.createElement('button');
      btnSize.className = 'view-mode-toggle law-mode-size';
      btnSize.title = 'Toggle icon size: big (double-size tiles) / compact (old dense grid)';
      btnSize.textContent = '▦';
      group.append(btnIcon, btnWord, btnSize);
      filterRow.appendChild(group);

      const sync = () => {
        btnIcon.classList.toggle('active', viewMode === 'icon');
        btnWord.classList.toggle('active', viewMode === 'word');
        btnSize.classList.toggle('active', iconSize === 'compact');
        renderLawGrid(grid, lawStateObj, bus);
      };
      btnIcon.addEventListener('click', () => {
        viewMode = 'icon';
        sync();
      });
      btnWord.addEventListener('click', () => {
        viewMode = 'word';
        sync();
      });
      btnSize.addEventListener('click', () => {
        iconSize = iconSize === 'compact' ? 'big' : 'compact';
        sync();
      });
    }
  }

  // ── Build law grid ──
  renderLawGrid(grid, lawStateObj, bus);

  // ── Law set bar: save / load presets with a mini-icon dropdown ──
  setupLawSets(grid, bus, lawStateObj);

  // ── Build world parameter sliders (accordion groups) ──
  if (params) {
    renderWorldSliders(params, bus);
  }

  // ── Listen for law sync ──
  bus.on('law:sync', () => renderLawGrid(grid, lawStateObj, bus));

  // World-state restore (v7.6) — re-render the sliders so their positions
  // match the restored params (values are read live at render time).
  bus.on('world:paramsRestored', () => {
    if (params) renderWorldSliders(params, bus);
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
  // One row per law category (physics / biology / chemistry / thermo / meta)
  for (const [catName, cat] of Object.entries(LAW_CATEGORIES)) {
    const band = LAW_SPECTRUM[cat.color] || LAW_SPECTRUM.BLUE;
    const centerHue = band.grey ? band.hue : Math.round(band.center * 3.6);
    const catSat = band.grey ? band.sat : null;
    html += `<div class="law-cat-row" data-cat-row="${catName}">`;
    html += `<div class="law-cat-label" style="color:hsl(${centerHue} ${catSat ?? 85}% 65%);--law-h:${centerHue};--law-s:${catSat ?? 85}%">${catName}</div>`;
    for (const idx of cat.laws) {
      const name = LAW_NAME_BY_IDX[idx] || `LAW_${idx}`;
      const icon = LAW_ICONS[name] || '?';
      const active = isSet(lawStateObj, idx);
      const catClass = 'cat-' + catName;
      const hue = LAW_HUE_BY_INDEX[idx] !== undefined ? LAW_HUE_BY_INDEX[idx] : centerHue;
      const selectedClass = idx === selectedLawIdx ? ' selected' : '';
      if (isWordMode) {
        html += `<button class="law-btn ${catClass}${active ? ' active' : ''}${selectedClass}" `
              + `style="--law-h:${hue};--law-s:${LAW_SAT_BY_INDEX[idx] ?? 85}" data-law="${idx}" title="${name}">`
              + `<span class="tog-icon">${icon}</span><span class="tog-name">${name}</span></button>`;
      } else {
        html += `<button class="sq-toggle ${catClass}${active ? ' active' : ''}${selectedClass}" `
              + `style="--law-h:${hue};--law-s:${LAW_SAT_BY_INDEX[idx] ?? 85}" data-law="${idx}" title="${name}">`
              + `<span class="tog-icon">${icon}</span><span class="tog-name">${name}</span></button>`;
      }
    }
    html += '</div>';
  }
  grid.innerHTML = html;

  // Wire clicks
  grid.querySelectorAll('.sq-toggle, .law-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.law, 10);
      toggleLaw(lawStateObj, idx);
      const nowActive = isSet(lawStateObj, idx);
      btn.classList.toggle('active', nowActive);
      setSelectedLaw(idx);
      bus.emit('law:toggled', {
        lawIndex: idx,
        active: nowActive,
        state: nowActive ? 1 : 0,
      });
    });
  });

  // Re-apply category filter
  applyCategoryFilter(grid);
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
  saveBtn.title = 'Save current laws to the selected set';
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
      if (isSet(lawStateObj, i)) laws.push(i);
    }
    return laws;
  };

  const updateSelector = () => {
    selectorBtn.textContent = currentName + ' ▾';
  };

  const applyPreset = (preset) => {
    for (let i = 0; i < LAW_COUNT; i++) clearLaw(lawStateObj, i);
    for (const idx of preset.laws) setLaw(lawStateObj, idx);
    currentName = preset.name;
    updateSelector();
    bus.emit('law:sync');
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
  bus.on('law:toggled', () => {
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

function renderWorldSliders(container, bus) {
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
      value: runtimeConfig.worldParams?.[p.key] ?? p.default,
      key: p.key,
      title: `${p.label} (${p.key})`,
      onChange: (value) => bus.emit('world:paramChanged', { key: p.key, value }),
    });
    slot.replaceWith(row.el);
  });
}

function applyCategoryFilter(grid) {
  const filterRow = document.querySelector('.category-filter-row');
  if (!filterRow) return;
  // Build set of active category names from filter tab data-cat attributes
  const activeCats = new Set();
  filterRow.querySelectorAll('.cat-tab.active').forEach((btn) => {
    activeCats.add(btn.dataset.cat);
  });

  grid.querySelectorAll('.law-cat-row').forEach((row) => {
    const catName = row.dataset.catRow;
    const visible = catName !== undefined && activeCats.has('cat-' + catName);
    row.style.display = visible ? '' : 'none';
  });
}
