/**
 * VEPA v3 — Law Info Module
 * Full-width info bar above the law grid showing the last-tapped law's
 * icon, name, category, HELP_DB description, and an on/off toggle.
 */
import { LAW_INDEXES, LAW_HELP_DB, LAW_TO_CATEGORY, LAW_HUE_BY_INDEX, LAW_SAT_BY_INDEX } from '../constants.js';
import { isSet, toggle as toggleLaw } from '../state/lawState.js';
import { LAW_HELP_PATCHES } from '../state/lawHelpPatches.js';

// Supplemental records complete or refine canonical help without discarding
// tiers already present in LAW_HELP_DB.
for (const [name, patch] of Object.entries(LAW_HELP_PATCHES)) {
  LAW_HELP_DB[name] = { ...(LAW_HELP_DB[name] || {}), ...patch };
}

let infoEl = null;
let currentLawIdx = -1;
let busRef = null;
let lawStateRef = null;

// Reverse: law index → name
const LAW_NAME_BY_IDX = {};
for (const [name, idx] of Object.entries(LAW_INDEXES)) {
  LAW_NAME_BY_IDX[idx] = name;
}

// Law icon symbols
const LAW_ICONS = {
  GRAV: '⬡', DRAG: '≋', ENTR: '~', BUOYANCY: '⌾', COLL: '⊕', ACCR: '⊞', PLANETARY: '♁',
  VOID: '∅', BOND: '⛓',
  LIFE: '✦', GLOW: '☀', AFFINITY: '⇌', REPRO: '⚤', TRACK: '⌖', SENESCENCE: '☠',
  ENERGY: '⚡', RADIATION: '☢', GENOTYPE: '🧬', PHENOTYPE: '◈',
  CATALYSIS_LAW: '⚗', SOLVATION: '≈', ACIDITY: '∇', OXIDATION: '🔥', POLYMER: '⛓',
  ISOMERIZATION: '⟳', CHIRALITY: '⇆', CRYSTALLIZATION: '◇', REDUCTION: '▼', ALLOY: '◆',
  HEAT: '☀', COLD: '❄', CONVECTION: '↻', PHASE_RADIATION: '⟐', SUBLIMATION: '⟡',
  MELT: '↕', BOIL: '♨', CONDENSE: '↓', DEPOSIT: '⬇', EXOTHERMIC: '★',
  TIME_DILATION: '⌛', DIMENSIONALITY: '◈', CHAOS: '☄', ORDER: '⊡', FATE: '⚖',
  WILL: '⚔', SOUL_LAW: '👁', MIND: '🧠',
  TELEPATHY: '〰', CLAIRVOYANCE: '◎', PRECOGNITION: '◉', ASTRAL: '👻',
  CHARGE_LAW: '±', FIELD: '✺', CURRENT: '⇥', RESISTANCE: 'Ω', CAPACITANCE: '∥',
  INDUCTANCE: '∿', MAGNETISM: '🧲', RESONANCE: '♫', FLUX: '⇄', IONIZATION: '⚛',
  DISCHARGE: '✸', PLASMA: '🌋', SUPERCONDUCTIVITY: '∞',
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

/**
 * Initialize the law info module.
 * @param {object} bus - Event bus
 * @param {object} lawStateObj - Law state object for toggling
 */
export function initTooltip(bus, lawStateObj) {
  busRef = bus;
  lawStateRef = lawStateObj;
  infoEl = document.getElementById('law-info-module');
  if (!infoEl) return;

  // Listen for law toggle events
  if (bus) {
    bus.on('law:toggled', ({ lawIndex }) => {
      showLawInfo(lawIndex);
    });
  }
}

/**
 * Show law info for a given law index.
 */
function showLawInfo(idx) {
  if (!infoEl || idx === undefined || idx < 0) return;
  currentLawIdx = idx;

  const name = LAW_NAME_BY_IDX[idx];
  if (!name) return;

  const help = LAW_HELP_DB[name];
  if (!help) return;

  const catName = LAW_TO_CATEGORY[idx] || 'unknown';
  const hue = LAW_HUE_BY_INDEX[idx] !== undefined ? LAW_HUE_BY_INDEX[idx] : 210;
  const icon = LAW_ICONS[name] || '□';
  const hint = help.hint || '';
  const explanation = help.explanation || '';
  const system = help.system || '';
  const isActive = lawStateRef ? isSet(lawStateRef, idx) : false;

  infoEl.innerHTML = `
    <div class="info-row">
      <div class="info-icon" style="color:hsl(${hue} ${LAW_SAT_BY_INDEX[idx] ?? 90}% 68%);--law-h:${hue};--law-s:${LAW_SAT_BY_INDEX[idx] ?? 90}%">${icon}</div>
      <div class="info-body">
        <div class="info-header">
          <span class="info-title">${name}</span>
          <span class="info-category" style="color:hsl(${hue} 90% 68%)">${catName.toUpperCase()}</span>
          <button class="info-toggle ${isActive ? 'on' : 'off'}" data-law="${idx}">
            <span class="toggle-track">
              <span class="toggle-knob"></span>
            </span>
            <span class="toggle-label">${isActive ? 'ON' : 'OFF'}</span>
          </button>
          <button class="info-close">✕</button>
        </div>
        <div class="info-hint">${hint}</div>
        <div class="info-explanation">${explanation}</div>
        <div class="info-system">${system}</div>
      </div>
    </div>
  `;

  // Wire toggle click
  const toggleBtn = infoEl.querySelector('.info-toggle');
  if (toggleBtn && lawStateRef && busRef) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lawIdx = parseInt(toggleBtn.dataset.law, 10);
      toggleLaw(lawStateRef, lawIdx);
      const nowActive = isSet(lawStateRef, lawIdx);
      // Update toggle visuals
      toggleBtn.className = `info-toggle ${nowActive ? 'on' : 'off'}`;
      toggleBtn.querySelector('.toggle-label').textContent = nowActive ? 'ON' : 'OFF';
      // Update law grid button
      const gridBtn = document.querySelector(`#law-grid .sq-toggle[data-law="${lawIdx}"]`);
      if (gridBtn) {
        gridBtn.classList.toggle('active', nowActive);
        const h = LAW_HUE_BY_INDEX[lawIdx] !== undefined ? LAW_HUE_BY_INDEX[lawIdx] : 210;
        gridBtn.style.borderColor = nowActive ? `hsl(${h} 90% 60%)` : '';
      }
      // Notify
      busRef.emit('law:toggled', {
        lawIndex: lawIdx,
        active: nowActive,
        state: nowActive ? 1 : 0,
      });
    });
  }

  // Wire close button
  const closeBtn = infoEl.querySelector('.info-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      infoEl.classList.add('hidden');
    });
  }

  infoEl.classList.remove('hidden');
}

/**
 * Hide the law info module.
 */
export function hideLawInfo() {
  if (infoEl) infoEl.classList.add('hidden');
}
