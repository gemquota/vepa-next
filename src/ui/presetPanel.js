/**
 * VEPA v3 — Preset Save/Load Panel
 * Save, load, and delete world presets via localStorage.
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
 * Create the preset panel in #world-panel.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 */
export function createPresetPanel(bus) {
  const panel = document.getElementById('world-panel');
  if (!panel) return;

  let html = '';
  html += '<div class="panel-section">';
  html += '<h3 class="preset-title">Presets</h3>';

  // Save row
  html += '<div class="preset-row">';
  html += '<input type="text" id="preset-name-input" class="preset-input" placeholder="Preset name…" maxlength="40">';
  html += '<button id="preset-save-btn" class="preset-btn" title="Save current state">💾 Save</button>';
  html += '</div>';

  // Load / Delete row
  html += '<div class="preset-row">';
  html += '<select id="preset-select" class="preset-select"><option value="">-- select preset --</option></select>';
  html += '<button id="preset-load-btn" class="preset-btn" title="Load selected preset">📂 Load</button>';
  html += '<button id="preset-delete-btn" class="preset-btn preset-btn-danger" title="Delete selected preset">🗑️</button>';
  html += '</div>';

  html += '</div>';
  panel.innerHTML = html;

  // DOM references
  const nameInput = document.getElementById('preset-name-input');
  const saveBtn = document.getElementById('preset-save-btn');
  const select = document.getElementById('preset-select');
  const loadBtn = document.getElementById('preset-load-btn');
  const deleteBtn = document.getElementById('preset-delete-btn');

  // Populate dropdown
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

    // Request current state from main via bus
    bus.emit('preset:requestState', { presetName: name });
  });

  // Listen for the state response and persist
  bus.on('preset:stateResponse', ({ presetName, law, dna }) => {
    savePreset(presetName, { law, dna });
    refreshDropdown(select);
    nameInput.value = '';
    bus.emit('preset:saved', { name: presetName });
  });

  // ── Load ──
  loadBtn.addEventListener('click', () => {
    const name = select.value;
    if (!name) return;

    const presets = loadPresets();
    const preset = presets[name];
    if (!preset) return;

    bus.emit('preset:load', { name, preset });
  });

  // ── Delete ──
  deleteBtn.addEventListener('click', () => {
    const name = select.value;
    if (!name) return;

    deletePreset(name);
    refreshDropdown(select);
    bus.emit('preset:deleted', { name });
  });

  // ── Listen for external refresh requests ──
  bus.on('preset:refresh', () => {
    refreshDropdown(select);
  });
}
