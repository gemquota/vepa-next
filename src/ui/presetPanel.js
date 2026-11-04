/**
 * VEPA4 — Preset save/load panel (WORLD sub-tab)
 *
 * A preset is a *configuration*, not a world: laws, DNA and world parameters,
 * named and kept in localStorage. It is not a snapshot — that is SAVES, and
 * the two are easy to confuse, so this panel says so on screen.
 *
 * This panel used to mount into `#world-panel`, an element that has not existed
 * since the drawer was rebuilt, so it silently rendered nothing: the preset
 * buttons in the docs and the help overlay had nothing behind them, and
 * `src/state/presetManager.js` was unreachable. It now mounts into
 * `#world-presets`, beside the world sliders it belongs with.
 */
import { LAW_INDEXES } from '../constants.js';
import * as lawState from '../state/lawState.js';
import { getSpeciesDNA, setSpeciesDNA } from '../dna/dnaBuffer.js';
import { MAX_SPECIES } from '../constants.js';

const STORAGE_KEY = 'vepa_v3_presets';

/**
 * Load all presets from localStorage.
 * @returns {Object<string, object>}
 */
function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save a preset to localStorage.
 */
function savePreset(name, data) {
  const presets = loadPresets();
  presets[name] = { ...data, savedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/**
 * Delete a preset from localStorage.
 */
function deletePreset(name) {
  const presets = loadPresets();
  delete presets[name];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/**
 * Refresh the preset dropdown options from localStorage.
 */
function refreshDropdown(select) {
  const presets = loadPresets();
  const names = Object.keys(presets).sort();

  // Clear existing options
  select.innerHTML = '<option value="">-- select preset --</option>';
  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
}

/**
 * Create the preset panel inside the WORLD sub-tab.
 *
 * Appends rather than assigning `innerHTML`: the container also holds the world
 * sliders, and the original version replaced its markup wholesale — a bug that
 * stayed invisible only because the container did not exist.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 * @returns {HTMLElement|null} the section, or null when WORLD is not mounted
 */
export function createPresetPanel(bus) {
  const panel = document.getElementById('world-presets');
  if (!panel) return null;

  // Idempotent: initUI can run more than once across a hot reload, and a
  // second copy of these controls would silently double every save.
  const existing = panel.querySelector('.preset-section');
  if (existing) existing.remove();

  const section = document.createElement('div');
  section.className = 'panel-section preset-section';
  section.innerHTML = `
    <h3 class="preset-title">PRESETS</h3>
    <div class="preset-note">A preset stores laws, DNA and world parameters — not the particles.
      For a full world snapshot use SAVES.</div>
    <div class="preset-row">
      <input type="text" id="preset-name-input" class="preset-input" placeholder="Preset name…" maxlength="40">
      <button id="preset-save-btn" class="preset-btn" title="Save current configuration">💾 Save</button>
    </div>
    <div class="preset-row">
      <select id="preset-select" class="preset-select"><option value="">-- select preset --</option></select>
      <button id="preset-load-btn" class="preset-btn" title="Load selected preset">📂 Load</button>
      <button id="preset-delete-btn" class="preset-btn preset-btn-danger" title="Delete selected preset">🗑</button>
    </div>
    <div id="preset-status" class="preset-status"></div>`;
  panel.appendChild(section);

  const nameInput = section.querySelector('#preset-name-input');
  const saveBtn = section.querySelector('#preset-save-btn');
  const select = section.querySelector('#preset-select');
  const loadBtn = section.querySelector('#preset-load-btn');
  const deleteBtn = section.querySelector('#preset-delete-btn');
  const statusEl = section.querySelector('#preset-status');

  const flash = (text, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? 'var(--accent-red)' : '';
    clearTimeout(statusEl._t);
    statusEl._t = setTimeout(() => { statusEl.textContent = ''; }, 2500);
  };

  refreshDropdown(select);

  // ── Save ──
  saveBtn.addEventListener('click', () => {
    const name = (nameInput.value || '').trim();
    if (!name) {
      nameInput.focus();
      nameInput.style.borderColor = 'var(--accent-red)';
      setTimeout(() => { nameInput.style.borderColor = ''; }, 1000);
      return;
    }
    flash('Capturing…');
    // The world owns the particle buffer, the law bitmask and the live world
    // params, so the panel asks for them rather than reaching for them.
    bus.emit('preset:requestState', { presetName: name });
  });

  // Listen for the state response and persist
  bus.on('preset:stateResponse', ({ presetName, law, dna, speciesCount, worldParams, savedAt }) => {
    savePreset(presetName, { law, dna, speciesCount, worldParams, savedAt });
    refreshDropdown(select);
    select.value = presetName;
    nameInput.value = '';
    flash(`Saved “${presetName}”`);
    bus.emit('preset:saved', { name: presetName });
  });

  // ── Load ──
  loadBtn.addEventListener('click', () => {
    const name = select.value;
    if (!name) {
      flash('PICK A PRESET FIRST', true);
      return;
    }
    const presets = loadPresets();
    const preset = presets[name];
    if (!preset) {
      flash('Preset missing', true);
      return;
    }
    flash(`Loading “${name}”…`);
    bus.emit('preset:load', { name, preset });
  });

  // ── Delete ──
  deleteBtn.addEventListener('click', () => {
    const name = select.value;
    if (!name) return;
    deletePreset(name);
    refreshDropdown(select);
    flash(`Deleted “${name}”`);
    bus.emit('preset:deleted', { name });
  });

  bus.on('preset:loaded', ({ name }) => flash(`Loaded “${name}”`));

  // ── Listen for external refresh requests ──
  bus.on('preset:refresh', () => refreshDropdown(select));

  return section;
}
