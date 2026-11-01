/**
 * VEPA v3 — DNA Parameter Panel
 * Species selector + 64 DNA sliders grouped by category.
 * Live-updates the shared DNA buffer on slider change.
 */
import { DNA_META, DNA_RANGES, DNA_INDEXES, DNA_COUNT, MAX_SPECIES } from '../constants.js';
import { setDNAFloat, getDNAFloat } from '../dna/dnaBuffer.js';
import { createSliderRow } from './sliderControl.js';

/**
 * DNA parameter groups with display labels and member indices.
 */
const DNA_GROUPS = [
  {
    name: 'Motion',
    indices: [DNA_INDEXES.FORCE, DNA_INDEXES.VISCOSITY, DNA_INDEXES.TORQUE, DNA_INDEXES.JITTER,
              DNA_INDEXES.TIDAL, DNA_INDEXES.INERTIA, DNA_INDEXES.FRICTION, DNA_INDEXES.MAX_VELOCITY],
  },
  {
    name: 'Matter',
    indices: [DNA_INDEXES.SYMMETRY, DNA_INDEXES.HIDDEN_MASS, DNA_INDEXES.STIFFNESS, DNA_INDEXES.FUSION,
              DNA_INDEXES.FUSION_MOMENTUM, DNA_INDEXES.FUSION_TIME, DNA_INDEXES.BASE_RADIUS,
              DNA_INDEXES.ELASTICITY, DNA_INDEXES.BOND_ANGLE],
  },
  {
    name: 'Electromagnetism',
    indices: [DNA_INDEXES.POLARITY, DNA_INDEXES.ALPHA, DNA_INDEXES.CONDUCTIVITY,
              DNA_INDEXES.MAGNETIC_MOMENT, DNA_INDEXES.REACTION_THRESHOLD,
              DNA_INDEXES.CATALYSIS, DNA_INDEXES.HEAT_OUTPUT],
  },
  {
    name: 'Biology',
    indices: [DNA_INDEXES.BIRTH_RATE, DNA_INDEXES.DEATH_RATE, DNA_INDEXES.MUTATION,
              DNA_INDEXES.ENERGY_EFFICIENCY, DNA_INDEXES.SEX_CHANCE,
              DNA_INDEXES.PREDATION_BIAS, DNA_INDEXES.SPECIES_AFFINITY],
  },
  {
    name: 'Communication',
    indices: [DNA_INDEXES.SIGNAL_RESP, DNA_INDEXES.PULSE_RATE, DNA_INDEXES.NEIGHBORHOOD_RADIUS,
              DNA_INDEXES.SIGNAL_STRENGTH, DNA_INDEXES.SIGNAL_DECAY,
              DNA_INDEXES.PROPAGATION_SPEED, DNA_INDEXES.TUNING_CH1, DNA_INDEXES.TUNING_CH2,
              DNA_INDEXES.TUNING_CH3, DNA_INDEXES.TUNING_CH4, DNA_INDEXES.MEMORY_DECAY],
  },
  {
    name: 'Genetics & Regulation',
    indices: [DNA_INDEXES.DOMINANCE, DNA_INDEXES.CROSSOVER_RATE, DNA_INDEXES.EPIGENETIC_DRIFT,
              DNA_INDEXES.HETEROZYGOSITY, DNA_INDEXES.GENE_FLOW, DNA_INDEXES.REPRESSOR,
              DNA_INDEXES.ALLELE_COUNT, DNA_INDEXES.EPIGENETIC_RATE, DNA_INDEXES.HGT_RATE,
              DNA_INDEXES.REPAIR_EFFICIENCY, DNA_INDEXES.DRIFT_RATE, DNA_INDEXES.SELECTION_SENSITIVITY,
              DNA_INDEXES.SPECIATION_THRESHOLD, DNA_INDEXES.ADAPTATION_RATE, DNA_INDEXES.TRANSPOSON_RATE,
              DNA_INDEXES.GENE_SILENCING, DNA_INDEXES.RECOMBINATION_BIAS, DNA_INDEXES.MUTAGEN_SENSITIVITY,
              DNA_INDEXES.TELOMERE_LENGTH, DNA_INDEXES.PLOIDY_LEVEL, DNA_INDEXES.CODON_BIAS,
              DNA_INDEXES.REGULATORY_DEPTH],
  },
];

/**
 * Default species colors for the selector circles.
 */
const DEFAULT_SPECIES_COLORS = [
  '#ff5050', // Predator — Red
  '#ffc832', // Sol — Yellow
  '#50ff78', // Life — Green
  '#78a0ff', // Aether — Blue
  '#643c8c', // Void — Purple
];

let selectedSpecies = 0;
let speciesColors = [...DEFAULT_SPECIES_COLORS];
let sliders = [];

/**
 * Rebuild all slider values to reflect the current DNA buffer state.
 */
function refreshSliders(dnaBuffer, rangeInfo) {
  for (const s of sliders) {
    const val = getDNAFloat(dnaBuffer, selectedSpecies, s.index, rangeInfo[s.index].min, rangeInfo[s.index].max);
    s.row.setValue(val, { emit: false, snap: false });
  }
}

/**
 * Create the DNA parameter panel in #dna-panel.
 *
 * @param {import('../core/eventBus.js').EventBus} bus
 * @param {Uint16Array} dnaBuffer
 */
export function createDNAPanel(bus, dnaBuffer) {
  const panel = document.getElementById('dna-panel');
  if (!panel) return;

  let html = '';

  // ── Species Selector ──
  html += '<div class="panel-section">';
  html += '<h3 class="dna-section-title">Species</h3>';
  html += '<div class="species-selector">';
  for (let i = 0; i < MAX_SPECIES; i++) {
    const color = speciesColors[i] || '#444';
    const active = i === selectedSpecies ? 'active' : '';
    html += `<button class="species-dot ${active}" data-species="${i}" `
          + `style="background:${color}" title="Species ${i}"></button>`;
  }
  html += '</div></div>';

  // ── DNA Sliders by Group ──
  DNA_GROUPS.forEach((group, gi) => {
    html += `<div class="panel-section">`;
    html += `<h3 class="dna-section-title">${group.name}</h3>`;
    html += `<div class="dna-rows" data-group-idx="${gi}"></div>`;
    html += `</div>`;
  });

  panel.innerHTML = html;

  // ── Build enhanced slider rows ──
  sliders = [];
  DNA_GROUPS.forEach((group, gi) => {
    const rowsEl = panel.querySelector(`.dna-rows[data-group-idx="${gi}"]`);
    if (!rowsEl) return;
    for (const idx of group.indices) {
      if (idx >= DNA_COUNT) continue;
      const range = DNA_RANGES[idx];
      const name = DNA_META[idx] || `DNA_${idx}`;
      const row = createSliderRow({
        label: name,
        min: range.min,
        max: range.max,
        step: (range.max - range.min) / 1000,
        value: range.default,
        key: String(idx),
        title: `${name} (DNA ${idx})`,
        onChange: (val) => {
          setDNAFloat(dnaBuffer, selectedSpecies, idx, val, range.min, range.max);
          bus.emit('dna:changed', {
            species: selectedSpecies,
            param: idx,
            value: val,
            paramName: name,
          });
        },
      });
      row.el.classList.add('sc-dna');
      rowsEl.appendChild(row.el);
      sliders.push({ index: idx, row });
    }
  });

  // ── Initialize slider values from current DNA buffer ──
  refreshSliders(dnaBuffer, DNA_RANGES);

  // ── Wire up species selector ──
  for (const dot of panel.querySelectorAll('.species-dot')) {
    dot.addEventListener('click', () => {
      // Update selected species
      panel.querySelector('.species-dot.active')?.classList.remove('active');
      selectedSpecies = parseInt(dot.dataset.species, 10);
      dot.classList.add('active');

      // Refresh sliders to show selected species' DNA
      refreshSliders(dnaBuffer, DNA_RANGES);
      bus.emit('dna:speciesChanged', { species: selectedSpecies });
    });
  }

  // ── Listen for external DNA changes (e.g., preset load, reset) ──
  bus.on('dna:sync', ({ species } = {}) => {
    const targetSpecies = species !== undefined ? species : selectedSpecies;
    if (targetSpecies === selectedSpecies) {
      refreshSliders(dnaBuffer, DNA_RANGES);
    }
  });

  // ── Listen for species list updates ──
  bus.on('species:info', ({ colors } = {}) => {
    if (colors) {
      speciesColors = [...colors];
      const dots = panel.querySelectorAll('.species-dot');
      for (let i = 0; i < dots.length; i++) {
        dots[i].style.background = speciesColors[i] || '#444';
      }
    }
  });
}
