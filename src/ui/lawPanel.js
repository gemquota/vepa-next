/**
 * VEPA v3 — Law Toggle Panel
 * Grid of toggle buttons grouped by category with color coding.
 * Multi-state laws (WRAP=4 states) cycle through on click.
 */
import { LAW_INDEXES, LAW_CATEGORIES, LAW_COLOR_BY_INDEX } from '../constants.js';
import * as lawState from '../state/lawState.js';

const CATEGORY_COLORS = {
  BLUE:   { active: 'var(--accent-blue)',   glow: 'none', label: 'Physics' },
  GREEN:  { active: 'var(--accent-green)',  glow: 'none', label: 'Biology' },
  PURPLE: { active: 'var(--accent-purple)', glow: 'none', label: 'Chemistry' },
  ORANGE: { active: 'var(--accent-orange)', glow: 'none', label: 'Thermodynamics' },
  RED:    { active: 'var(--accent-red)',    glow: 'none', label: 'Metaphysics' },
  TEAL:   { active: 'var(--accent-teal)',   glow: 'none', label: 'Electromagnetism' },
  YELLOW: { active: 'var(--accent-yellow)', glow: 'none', label: 'Information' },
  VIOLET: { active: 'var(--accent-violet)', glow: 'none', label: 'Quantum' },
  SLATE:  { active: '#78818c',               glow: 'none', label: 'Mechanics' },
};

// Laws that have multi-state behavior and their max states
const MULTI_STATE = {}; // WRAP (the only multi-state law) retired — now the TOROIDAL EDGES world param

// Build reverse lookup: law index → display name
const LAW_NAME_BY_INDEX = {};
for (const [name, idx] of Object.entries(LAW_INDEXES)) {
  LAW_NAME_BY_INDEX[idx] = name;
}

// Track multi-state values per law index
const multiStateValues = {};

/**
 * Get display text for a law button, including multi-state indicator.
 */
function getLawButtonText(idx) {
  const name = LAW_NAME_BY_INDEX[idx] || `LAW_${idx}`;
  const maxState = MULTI_STATE[idx];
  if (maxState !== undefined) {
    const stateVal = multiStateValues[idx] || 0;
    return `${name} <span class="law-state-indicator">[${stateVal}]</span>`;
  }
  return name;
}

/**
 * Compute the inline style for an active law button based on its category.
 */
function getActiveStyle(colorName) {
  const cat = CATEGORY_COLORS[colorName];
  if (!cat) return {};
  return {
    backgroundColor: cat.active,
    boxShadow: cat.glow,
    color: '#000',
  };
}

/**
 * Apply active/inactive visual state to a button element.
 */
function applyButtonState(btn, active, colorName) {
  if (active) {
    btn.classList.add('active');
    const style = getActiveStyle(colorName);
    for (const [key, val] of Object.entries(style)) {
      btn.style[key] = val;
    }
  } else {
    btn.classList.remove('active');
    btn.style.backgroundColor = '';
    btn.style.boxShadow = '';
    btn.style.color = '';
  }
}

/**
 * Create the law toggle panel in #laws-panel.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 * @param {{ lowFlags: Uint32Array, highFlags: Uint32Array, extFlags: Uint32Array }} lawStateObj
 */
export function createLawPanel(bus, lawStateObj) {
  const panel = document.getElementById('laws-panel');
  if (!panel) return;

  // Group laws by category
  const sections = [
    { key: 'physics',       cat: LAW_CATEGORIES.physics },
    { key: 'biology',       cat: LAW_CATEGORIES.biology },
    { key: 'chemistry',     cat: LAW_CATEGORIES.chemistry },
    { key: 'thermodynamics', cat: LAW_CATEGORIES.thermodynamics },
    { key: 'metaphysics',   cat: LAW_CATEGORIES.metaphysics },
    { key: 'electromagnetism', cat: LAW_CATEGORIES.electromagnetism },
    { key: 'information',   cat: LAW_CATEGORIES.information },
    { key: 'quantum',       cat: LAW_CATEGORIES.quantum },
    { key: 'mechanics',      cat: LAW_CATEGORIES.mechanics },
  ];

  let html = '';
  for (const { key, cat } of sections) {
    const colorName = cat.color;
    const catInfo = CATEGORY_COLORS[colorName] || { label: key, active: '#888' };
    html += `<div class="panel-section">`;
    html += `<h3 class="law-category-header" style="color:${catInfo.active}">${catInfo.label}</h3>`;
    html += `<div class="law-grid">`;

    for (const idx of cat.laws) {
      const name = LAW_NAME_BY_INDEX[idx] || `LAW_${idx}`;
      const isMulti = MULTI_STATE[idx] !== undefined;
      const stateHint = isMulti ? ' (multi-state)' : '';
      html += `<button class="law-btn" data-law="${idx}" title="${name}${stateHint}">${name}</button>`;
    }

    html += `</div></div>`;
  }

  // Append (settingsPanel renders camera/meta sections into the same panel first)
  panel.insertAdjacentHTML('beforeend', html);

  // Wire up click handlers
  for (const btn of panel.querySelectorAll('.law-btn')) {
    const idx = parseInt(btn.dataset.law, 10);
    const colorName = LAW_COLOR_BY_INDEX[idx] || 'BLUE';

    // Sync initial visual state
    const active = lawState.isSet(lawStateObj, idx);
    applyButtonState(btn, active, colorName);

    btn.addEventListener('click', () => {
      const maxState = MULTI_STATE[idx];

      if (maxState !== undefined) {
        // Multi-state: cycle 0 → 1 → 2 → … → 0
        const current = multiStateValues[idx] || 0;
        const next = (current + 1) % maxState;
        multiStateValues[idx] = next;

        // Set underlying bitmask if state > 0
        if (next === 0) {
          lawState.clear(lawStateObj, idx);
        } else {
          lawState.set(lawStateObj, idx);
        }

        // Update button text with state indicator
        btn.innerHTML = getLawButtonText(idx);

        // Update visual
        applyButtonState(btn, next > 0, colorName);

        bus.emit('law:toggled', {
          lawIndex: idx,
          state: next,
          active: next > 0,
          lawState: lawState.serialize(lawStateObj),
        });
      } else {
        // Simple binary toggle
        lawState.toggle(lawStateObj, idx);
        const nowActive = lawState.isSet(lawStateObj, idx);
        applyButtonState(btn, nowActive, colorName);

        bus.emit('law:toggled', {
          lawIndex: idx,
          state: nowActive ? 1 : 0,
          active: nowActive,
          lawState: lawState.serialize(lawStateObj),
        });
      }
    });
  }

  // Expose toggleLaw globally for inline onclick handlers in main.js
  window.toggleLaw = (idx) => {
    const btn = panel.querySelector(`[data-law="${idx}"]`);
    if (btn) btn.click();
  };

  // Listen for external law changes (e.g., from preset loading)
  bus.on('law:sync', () => {
    for (const btn of panel.querySelectorAll('.law-btn')) {
      const idx = parseInt(btn.dataset.law, 10);
      const colorName = LAW_COLOR_BY_INDEX[idx] || 'BLUE';
      const active = lawState.isSet(lawStateObj, idx);
      applyButtonState(btn, active, colorName);

      // For multi-state, if law is off, reset state indicator
      if (MULTI_STATE[idx] !== undefined) {
        multiStateValues[idx] = active ? 1 : 0;
        btn.innerHTML = getLawButtonText(idx);
      }
    }
  });
}
