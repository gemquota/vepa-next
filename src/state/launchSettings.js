/**
 * VEPA4 — Launch configuration.
 *
 * The launcher assembles a startup-only world from a preset, law set, parameter
 * overrides, species roster and initializer options. Those choices outlive the
 * session, so validated data and persistence live here rather than in the modal.
 *
 * The split is deliberate: this module is pure data and validation with no DOM,
 * so what a launch *means* is testable, and launchModal.js is reduced to
 * rendering a list of fields and returning the answer.
 */

import { PRIME_DEFAULT, TIDAL_BLOOM } from './defaultPresets.js';
import { LAW_INDEXES, MAX_PARTICLES } from '../constants.js';
import { WORLD_PARAM_DEFS } from './worldParams.js';

/** Where the last launch choice is kept. */
export const LAUNCH_STORAGE_KEY = 'vepa-launch-settings';
export const LAUNCH_PRESETS_STORAGE_KEY = 'vepa-launch-presets';
const MAX_CUSTOM_LAUNCH_PRESETS = 12;

/** Stable FNV-1a text-to-seed mapping; text is preserved exactly as entered. */
export function deriveTextSeed(text) {
  const source = String(text ?? '');
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return { text: source, seed: ((hash >>> 0) % 2147483647) + 1 };
}

function variantOf(base, id, name, blurb, worldParams, options = {}) {
  return {
    id,
    name,
    blurb,
    category: options.category || 'Ecologies',
    playstyle: options.playstyle || 'Living world',
    objective: options.objective || 'Observe how the ecosystem finds its balance.',
    preset: {
      ...base,
      name: id,
      species: options.species || base.species,
      speciesCount: (options.species || base.species).length,
      laws: options.laws || base.laws,
      worldParams: { ...base.worldParams, ...worldParams },
    },
  };
}

function safeCustomPresets() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const parsed = JSON.parse(localStorage.getItem(LAUNCH_PRESETS_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.id === 'string'
      && typeof entry.name === 'string' && entry.settings && typeof entry.settings === 'object')
      .slice(0, MAX_CUSTOM_LAUNCH_PRESETS);
  } catch {
    return [];
  }
}

/** Read the user's locally saved launch presets without exposing storage errors. */
export function getCustomLaunchPresets() {
  return safeCustomPresets();
}

/** Save the current launch choices under a name; returns null if storage is unavailable. */
export function saveCustomLaunchPreset(name, settings) {
  const cleanName = String(name || '').trim().split(/\s+/).filter(Boolean).join(' ').slice(0, 36);
  if (!cleanName) return null;
  try {
    if (typeof localStorage === 'undefined') return null;
    const entries = safeCustomPresets();
    const slug = cleanName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = `CUSTOM:${slug || 'setup'}`;
    const base = normaliseLaunchSettings(settings);
    const entry = {
      id,
      name: cleanName,
      category: 'Saved',
      playstyle: 'Your design',
      objective: 'A saved combination of laws, parameters, founders and launch conditions.',
      blurb: 'Your saved launch configuration, ready to reuse.',
      basePresetId: base.presetId.startsWith('CUSTOM:')
        ? (entries.find((candidate) => candidate.id === base.presetId)?.basePresetId || DEFAULT_LAUNCH_PRESET_ID)
        : base.presetId,
      settings: { ...base, presetId: id },
    };
    const next = [entry, ...entries.filter((candidate) => candidate.id !== id)]
      .slice(0, MAX_CUSTOM_LAUNCH_PRESETS);
    localStorage.setItem(LAUNCH_PRESETS_STORAGE_KEY, JSON.stringify(next));
    return entry;
  } catch {
    return null;
  }
}

/** Built-ins plus saved launch configurations, newest custom presets first. */
export function getLaunchPresets() {
  const builtins = [...BUILTIN_LAUNCH_PRESETS];
  const entries = safeCustomPresets();
  return [
    ...builtins,
    ...entries.map((entry) => {
      const source = builtins.find((preset) => preset.id === entry.basePresetId)
        || builtins.find((preset) => preset.id === DEFAULT_LAUNCH_PRESET_ID);
      const savedPreset = presetFor({ ...entry.settings, presetId: entry.id });
      return { ...entry, category: entry.category || source.category, playstyle: entry.playstyle || source.playstyle, objective: entry.objective || source.objective, preset: savedPreset, custom: true };
    }),
  ];
}

/** Logarithmic slider mapping with a 1000-step native range for fine control. */
export function launchValueToPosition(field, value) {
  const ratio = Math.log(Math.max(field.min, Number(value)) / field.min)
    / Math.log(field.max / field.min);
  return Math.max(0, Math.min(1000, Math.round(ratio * 1000)));
}

export function launchPositionToValue(field, position) {
  const ratio = Math.max(0, Math.min(1000, Number(position))) / 1000;
  const raw = field.min * ((field.max / field.min) ** ratio);
  const snapped = field.min + Math.round((raw - field.min) / field.step) * field.step;
  return Number(Math.min(field.max, Math.max(field.min, snapped)).toFixed(6));
}

export function launchMarkPosition(field, value) {
  return launchValueToPosition(field, value) / 10;
}

function customPresetForId(id) {
  return safeCustomPresets().find((entry) => entry.id === id) || null;
}

// Keep data and UI configuration together so slider mapping/help cannot drift.
// The built-in variants are deliberately derived from real, shipped worlds.
const PRIME_LAUNCH = variantOf(PRIME_DEFAULT, 'PRIME_DEFAULT', 'PRIME',
  'Five sharply separated archetypes in a compact, energetic startup ecology — a reliable baseline for observing competition.',
  { worldSize: 800, INITIAL_POP: 900, MAX_POP: 8000, FIELD_THERMAL: 0.1, SPAWN_RATE: 4, MUTATION_RATE: 1 },
  { category: 'Ecologies', playstyle: 'Competitive', objective: 'Watch predators, producers and signalers carve out niches.' });
const GRAVITY_WELL = variantOf(PRIME_DEFAULT, 'GRAVITY_WELL', 'GRAVITY WELL',
  'A dense orbital arena: stronger gravity and a compact population make attraction, capture and collision easy to observe.',
  { worldSize: 950, INITIAL_POP: 700, MAX_POP: 5000, GLOBAL_G: 3, FIELD_THERMAL: 0.2, SPAWN_RATE: 3 },
  { category: 'Cosmos', playstyle: 'High gravity', objective: 'Follow captures, dense clusters and collision-driven structure.' });
const SOLAR_FORGE = variantOf(TIDAL_BLOOM, 'SOLAR_FORGE', 'SOLAR FORGE',
  'A hot, energetic substrate with bright thermal fields and rapid chemistry. Best when you want the world to transform quickly.',
  { worldSize: 1400, INITIAL_POP: 1200, MAX_POP: 9000, FIELD_THERMAL: 2.4, LIGHT_LEVEL: 1.4, MUTATION_RATE: 2.2, SPAWN_RATE: 8 },
  { category: 'Extreme', playstyle: 'Fast evolution', objective: 'Push a hot, crowded ecosystem through rapid change.' });
const QUIET_ORBIT = variantOf(PRIME_DEFAULT, 'QUIET_ORBIT', 'QUIET ORBIT',
  'A sparse, slower-moving dish for following long-range motion and watching a few populations find their own balance.',
  { worldSize: 2200, INITIAL_POP: 350, MAX_POP: 3000, GLOBAL_G: 0.35, FIELD_THERMAL: 0.1, SPAWN_RATE: 1, MUTATION_RATE: 0.35 },
  { category: 'Quiet', playstyle: 'Slow observation', objective: 'Track sparse populations and long-lived orbital motion.' });
const QUANTUM_GARDEN = variantOf(TIDAL_BLOOM, 'QUANTUM_GARDEN', 'QUANTUM GARDEN',
  'A roomy, gently populated world with a mild information and thermal medium for observing slow emergent structure.',
  { worldSize: 1800, INITIAL_POP: 650, MAX_POP: 7000, GLOBAL_G: 0.8, FIELD_THERMAL: 0.65, FIELD_INFO: 1.1, SPAWN_RATE: 2.5 },
  { category: 'Quantum', playstyle: 'Uncertain', objective: 'Explore entanglement, observation and unusual matter states.' });

const ASHEN_FRONT = variantOf(PRIME_DEFAULT, 'ASHEN_FRONT', 'ASHEN FRONT',
  'A wounded biosphere under a persistent radiation burden. Scarce founders must reproduce and adapt before the environment wins.',
  { worldSize: 980, INITIAL_POP: 420, MAX_POP: 3200, RADIATION_LEVEL: 2.5, MUTATION_RATE: 2.1, DECAY_RATE: 1.2, SPAWN_RATE: 0.8, LIGHT_LEVEL: 0.35 },
  { category: 'Survival', playstyle: 'Harsh selection', objective: 'Can the survivors adapt before the founder line collapses?', laws: ['GRAV', 'DRAG', 'ENTR', 'COLL', 'LIFE', 'ENERGY', 'REPRO', 'GENOTYPE', 'PHENOTYPE', 'SENESCENCE', 'RADIATION', 'PREDATION', 'AFFINITY'] });
const SIGNAL_ARCHIPELAGO = variantOf(TIDAL_BLOOM, 'SIGNAL_ARCHIPELAGO', 'SIGNAL ARCHIPELAGO',
  'A world of separated founder colonies. Trails, memory and shared symbols are the bridge between distant populations.',
  { worldSize: 1900, INITIAL_POP: 780, MAX_POP: 6500, SPAWN_CENTRES: 12, SPAWN_CENTRE_RANDOM: 0.8, SPAWN_CENTRE_BIAS: 0.15, FIELD_INFO: 1.8, FIELD_THERMAL: 0.2, CULTURAL_TRANSMISSION: 1, STIGMERGY_DECAY_RATE: 0.008, SPAWN_RATE: 1.2 },
  { category: 'Civilizations', playstyle: 'Social emergence', objective: 'Watch isolated groups build memory, language and culture.', laws: ['GRAV', 'DRAG', 'COLL', 'LIFE', 'ENERGY', 'REPRO', 'AFFINITY', 'COMMS', 'MEMORY', 'PATTERN', 'STIGMERGY', 'LEARN', 'SYMBOL', 'CULTURE', 'LANGUAGE', 'HISTORY', 'NAVIGATION'] });
const STARFALL = variantOf(PRIME_DEFAULT, 'STARFALL', 'STARFALL',
  'A crowded stellar nursery where gravity, accretion and radiation turn ordinary matter into a changing sky.',
  { worldSize: 1250, INITIAL_POP: 1500, MAX_POP: 9000, GLOBAL_G: 3.5, STELLAR_FORM: 8, STELLAR_MAX: 8, STELLAR_RADIANCE: 1.8, STELLAR_HORIZON: 190, STELLAR_SUPERNOVA: 350, STELLAR_HAWKING: 0.1, FIELD_THERMAL: 1.3, EXOTIC_COUNT: 5, SPAWN_RATE: 2 },
  { category: 'Cosmos', playstyle: 'Stellar evolution', objective: 'Follow fusion, collapse, Hawking emission and supernova seeding.', laws: ['GRAV', 'DRAG', 'ENTR', 'COLL', 'ACCR', 'PLANETARY', 'LIFE', 'ENERGY', 'REPRO', 'HEAT', 'CONVECTION', 'RADIATION', 'RADIATION_PRESSURE', 'FIELD', 'ANTIMATTER'] });
const CRYSTAL_TIDE = variantOf(TIDAL_BLOOM, 'CRYSTAL_TIDE', 'CRYSTAL TIDE',
  'A slow chemical estuary: tidal heat pulses feed polymer chains, crystal lattices and structures that persist between generations.',
  { worldSize: 1500, INITIAL_POP: 620, MAX_POP: 5000, TIDAL_SCALE: 2.4, FIELD_THERMAL: 1.1, FIELD_DIFFUSION: 0.08, CONVECTION_RATE: 1.4, CRYSTAL_LATTICE: 2.2, POLYMER_LIMIT: 7, BOND_STRENGTH: 1.8, MUTATION_RATE: 0.65, SPAWN_RATE: 0.6 },
  { category: 'Chemistry', playstyle: 'Slow construction', objective: 'Observe chemical complexity and bonded structures persist.', laws: ['GRAV', 'DRAG', 'COLL', 'BOND', 'TIDE', 'FIELD', 'HEAT', 'COLD', 'CONVECTION', 'PHASE_RADIATION', 'LATENT_HEAT', 'EQUILIBRIUM', 'CATALYSIS_LAW', 'SOLVATION', 'POLYMER', 'CRYSTALLIZATION', 'OXIDATION', 'AUTOCATALYSIS', 'LIFE', 'ENERGY', 'REPRO', 'COMMS'] });

// Roadmap starter set: named entry points into the existing, validated launch pipeline.
const PRIMORDIAL_SOUP = variantOf(TIDAL_BLOOM, 'PRIMORDIAL_SOUP', 'PRIMORDIAL SOUP',
  'A gentle warm substrate with a small founder population: start at the beginning and watch simple interactions accumulate.',
  { worldSize: 1500, INITIAL_POP: 350, MAX_POP: 2400, FIELD_THERMAL: 0.45, FIELD_INFO: 0.15, MUTATION_RATE: 0.8, SPAWN_RATE: 0.5 },
  { category: 'Starter worlds', playstyle: 'First principles', objective: 'Watch a sparse, warm dish build complexity from simple beginnings.', laws: ['GRAV', 'DRAG', 'COLL', 'FIELD', 'HEAT', 'LIFE', 'ENERGY', 'REPRO', 'COMMS'] });
const HEAD_START = variantOf(TIDAL_BLOOM, 'HEAD_START', 'HEAD START',
  'A well-populated, energetic ecology with generous resources and active reproduction, ready to develop immediately.',
  { worldSize: 1050, INITIAL_POP: 1400, MAX_POP: 9000, FIELD_THERMAL: 0.8, MUTATION_RATE: 1.2, SPAWN_RATE: 5, REPRODUCTION_THRESHOLD: 24 },
  { category: 'Starter worlds', playstyle: 'Fast emergence', objective: 'Begin with a thriving population and follow its first turning points.' });
const PEACEFUL_WORLD = variantOf(TIDAL_BLOOM, 'PEACEFUL', 'PEACEFUL',
  'A spacious, low-pressure world tuned for observation, slow growth and coexistence.',
  { worldSize: 2200, INITIAL_POP: 420, MAX_POP: 2800, GLOBAL_G: 0.25, FIELD_THERMAL: 0.25, MUTATION_RATE: 0.35, SPAWN_RATE: 0.3 },
  { category: 'Starter worlds', playstyle: 'Quiet observation', objective: 'Give populations room to find stable niches without a harsh selection pressure.', laws: ['GRAV', 'DRAG', 'COLL', 'FIELD', 'HEAT', 'LIFE', 'ENERGY', 'REPRO', 'COMMS', 'AFFINITY', 'CULTURE'] });
const CHAOS_WORLD = variantOf(PRIME_DEFAULT, 'CHAOS', 'CHAOS',
  'A dense, high-energy dish with strong gravity, rapid mutation and broad interaction for unpredictable outcomes.',
  { worldSize: 700, INITIAL_POP: 1800, MAX_POP: 9500, GLOBAL_G: 4.5, FIELD_THERMAL: 2.2, MUTATION_RATE: 3.5, SPAWN_RATE: 12, ENTROPY: 1.5 },
  { category: 'Starter worlds', playstyle: 'Unstable experiment', objective: 'Explore how a crowded, turbulent ecology responds to strong environmental pressure.' });


/** Built-in presets offered before the world exists. */
export const ROADMAP_STARTER_PRESET_IDS = Object.freeze(['PRIMORDIAL_SOUP', 'HEAD_START', 'ASHEN_FRONT', 'PEACEFUL', 'CHAOS']);

export const BUILTIN_LAUNCH_PRESETS = Object.freeze([
  PRIMORDIAL_SOUP,
  HEAD_START,
  ASHEN_FRONT,
  PEACEFUL_WORLD,
  CHAOS_WORLD,
  {
    id: 'TIDAL_BLOOM',
    name: 'TIDAL BLOOM',
    category: 'Ecologies',
    playstyle: 'Emergent ecology',
    objective: 'A warm, changing biosphere where chemistry and culture build on each other.',
    blurb: 'A tidal substrate with warm zones, thermal gradients and a rich chemical field — a living ecology with chemistry and culture from the first frame.',
    preset: TIDAL_BLOOM,
  },
  PRIME_LAUNCH,
  GRAVITY_WELL,
  SOLAR_FORGE,
  QUIET_ORBIT,
  QUANTUM_GARDEN,
  SIGNAL_ARCHIPELAGO,
  STARFALL,
  CRYSTAL_TIDE,
]);

export const ROADMAP_STARTER_PRESETS = Object.freeze(ROADMAP_STARTER_PRESET_IDS
  .map((id) => BUILTIN_LAUNCH_PRESETS.find((preset) => preset.id === id))
  .filter(Boolean));

/** The preset used when nothing has been chosen, or when storage is unusable. */
export const DEFAULT_LAUNCH_PRESET_ID = 'TIDAL_BLOOM';

/**
 * The launch settings, declared rather than written out in the modal so the
 * control, its range and its help text cannot drift apart.
 *
 * `worldParamKey` names where a slider lands. The launch designer's additional
 * law, species and parameter overrides are validated below against their SSOTs.
 */
export const LAUNCH_FIELDS = Object.freeze([
  {
    key: 'renderBackend',
    label: 'RENDERER',
    kind: 'choice',
    options: [
      { value: 'canvas2d', label: 'Canvas2D — safe, works everywhere' },
      { value: 'pixi', label: 'PixiJS — GPU batches, best at high population' },
    ],
    help: 'Canvas2D is the reference path and is always correct. PixiJS draws through the GPU and holds up far better with tens of thousands of particles, but is still opt-in until it is benchmarked on your device.',
  },
  {
    key: 'founderEra',
    label: 'FOUNDER ERA',
    kind: 'choice',
    options: [
      { value: 'newborn', label: 'Newborn — all founders begin at age zero' },
      { value: 'established', label: 'Established — founders begin at mixed ages' },
      { value: 'ancient', label: 'Ancient — begin near a generational turning point' },
    ],
    help: 'A launch-only initial condition: sets particle ages and starting energy before the first tick. Ancient founders can trigger immediate senescence when that law is enabled.',
  },
  {
    key: 'computeEngine',
    label: 'COMPUTE',
    kind: 'choice',
    options: [
      { value: 'gpu', label: 'GPU — WebGPU, falls back to CPU' },
      { value: 'cpu', label: 'CPU — always available' },
    ],
    help: 'GPU is the default: the worker probes for WebGPU once and falls back to the validated CPU path if it is missing. Force CPU if you suspect the GPU path on your device.',
  },
  {
    key: 'simSpeed',
    label: 'SIM SPEED',
    kind: 'range',
    min: 0.1,
    max: 3,
    step: 0.1,
    marks: [0.1, 0.25, 0.5, 1, 2, 3],
    help: 'Time-step multiplier. Below 1 the world runs in slow motion, which is how you actually watch a law take effect; above 1 it runs fast and you watch populations move.',
  },
  {
    key: 'worldSize',
    label: 'WORLD SIZE',
    kind: 'range',
    min: 400,
    max: 3000,
    step: 50,
    worldParamKey: 'WORLD_SIZE',
    marks: [400, 600, 900, 1200, 1800, 2400, 3000],
    help: 'Edge length of the cubic toroidal world. Density is particle count ÷ volume, so a bigger world with the same population is a sparser, slower dish.',
  },
  {
    key: 'initialPop',
    label: 'INITIAL POPULATION',
    kind: 'range',
    min: 100,
    max: MAX_PARTICLES,
    step: 100,
    worldParamKey: 'INITIAL_POP',
    marks: [100, 250, 500, 1000, 2500, 5000, 7500, MAX_PARTICLES],
    help: 'How many particles exist at t=0. The engine hard cap is 10,000; starts near that ceiling may run slowly depending on device, active laws, and world settings.',
  },
  {
    key: 'maxPopulation', label: 'POPULATION CEILING', kind: 'range', min: 1000, max: MAX_PARTICLES, step: 100,
    worldParamKey: 'MAX_POP', marks: [1000, 2000, 4000, 8000, MAX_PARTICLES],
    help: 'Soft ceiling for future population growth, up to the 10,000-particle engine limit; choose a lower cap for a lighter, more readable simulation.',
  },
  {
    key: 'gravity', label: 'GRAVITY', kind: 'range', min: 0.1, max: 20, step: 0.1,
    worldParamKey: 'GLOBAL_G', marks: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20],
    help: 'Global gravitational coupling. Low values let species drift; high values pull clusters together quickly. This is a logarithmic control for useful detail at both ends.',
  },
  {
    key: 'thermalField', label: 'THERMAL FIELD', kind: 'range', min: 0.05, max: 5, step: 0.05,
    worldParamKey: 'FIELD_THERMAL', marks: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    help: 'Strength of the ambient thermal field. It tunes how strongly the dish carries heat gradients into thermodynamic and chemical behavior.',
  },
  {
    key: 'spawnRate', label: 'SPAWN RATE', kind: 'range', min: 0.1, max: 50, step: 0.1,
    worldParamKey: 'SPAWN_RATE', marks: [0.1, 0.5, 1, 2, 5, 10, 25, 50],
    help: 'Ongoing world-level spawning per second. Lower values leave ecology to reproduction; higher values keep introducing new particles.',
  },
  {
    key: 'mutationRate', label: 'MUTATION RATE', kind: 'range', min: 0.1, max: 5, step: 0.1,
    worldParamKey: 'MUTATION_RATE', marks: [0.1, 0.25, 0.5, 1, 2, 3, 5],
    help: 'Scales DNA mutation during reproduction. Raise it to make evolution more active; lower it for steadier species over longer runs.',
  },
]);

/** A fresh, valid settings object. Never null, never partial. */
export function defaultLaunchSettings() {
  return {
    presetId: DEFAULT_LAUNCH_PRESET_ID,
    laws: null,
    speciesNames: null,
    parameterOverrides: {},
    launchSeed: null,
    launchSeedText: '',
    founderEra: 'newborn',
    renderBackend: 'canvas2d',
    computeEngine: 'gpu',
    simSpeed: 1,
    worldSize: null, // null means "whatever the chosen preset says"
    initialPop: null,
    maxPopulation: null,
    gravity: null,
    thermalField: null,
    spawnRate: null,
    mutationRate: null,
  };
}

/** Clamp/validate one field, falling back to the default when it is unusable. */
function coerceField(field, value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (field.kind === 'choice') {
    return field.options.some((o) => o.value === value) ? value : fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.min(field.max, Math.max(field.min, n));
  // Snap to the step so a hand-edited value cannot land between increments.
  const snapped = field.min + Math.round((clamped - field.min) / field.step) * field.step;
  return Number(snapped.toFixed(6));
}

/**
 * Coerce anything into a valid settings object. Exported because the modal, the
 * storage read and the tests all need exactly this and must not each grow their
 * own version: a saved object from an older release with a field that no longer
 * exists has to degrade to the default, not to `undefined`.
 */
export function normaliseLaunchSettings(raw) {
  const base = defaultLaunchSettings();
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base };
  if (typeof raw.presetId === 'string') out.presetId = raw.presetId;
  for (const field of LAUNCH_FIELDS) {
    if (field.key in raw) out[field.key] = raw[field.key] === null && field.kind === 'range' && field.worldParamKey
      ? null : coerceField(field, raw[field.key], base[field.key]);
  }
  if (typeof raw.launchSeedText === 'string') out.launchSeedText = raw.launchSeedText;
  if (raw.launchSeed !== null && raw.launchSeed !== undefined && raw.launchSeed !== '') {
    const seed = Number(raw.launchSeed);
    out.launchSeed = Number.isFinite(seed) ? Math.max(1, Math.min(2147483647, Math.trunc(seed))) : null;
  }
  if (out.launchSeedText) out.launchSeed = deriveTextSeed(out.launchSeedText).seed;
  if (typeof raw.founderEra === 'string' && ['newborn', 'established', 'ancient'].includes(raw.founderEra)) out.founderEra = raw.founderEra;
  if (Array.isArray(raw.laws)) {
    const validLaws = new Set(Object.keys(LAW_INDEXES));
    out.laws = [...new Set(raw.laws.filter((law) => typeof law === 'string' && validLaws.has(law)))];
  }
  if (Array.isArray(raw.speciesNames)) {
    const speciesNames = [...new Set(raw.speciesNames.filter((name) => typeof name === 'string').map((name) => name.slice(0, 40)))];
    out.speciesNames = speciesNames.length ? speciesNames : null;
  }
  if (raw.parameterOverrides && typeof raw.parameterOverrides === 'object' && !Array.isArray(raw.parameterOverrides)) {
    const defs = new Map(WORLD_PARAM_DEFS.map((def) => [def.key, def]));
    out.parameterOverrides = {};
    for (const [key, rawValue] of Object.entries(raw.parameterOverrides)) {
      const def = defs.get(key);
      const value = Number(rawValue);
      if (!def || !Number.isFinite(value)) continue;
      const clamped = Math.min(def.max, Math.max(def.min, value));
      out.parameterOverrides[key] = Number((def.min + Math.round((clamped - def.min) / def.step) * def.step).toFixed(6));
    }
  }
  return out;
}

/**
 * Read the last launch choice. Tolerates a missing, corrupt or
 * storage-denied `localStorage` — a private-mode browser must still boot.
 */
export function readLaunchSettings() {
  try {
    if (typeof localStorage === 'undefined') return defaultLaunchSettings();
    const raw = localStorage.getItem(LAUNCH_STORAGE_KEY);
    if (!raw) return defaultLaunchSettings();
    return normaliseLaunchSettings(JSON.parse(raw));
  } catch {
    return defaultLaunchSettings();
  }
}

/** Persist a launch choice. Returns false when storage refused it. */
export function writeLaunchSettings(settings) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(LAUNCH_STORAGE_KEY, JSON.stringify(normaliseLaunchSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

/** True when the user has explicitly chosen, rather than inherited, a launch. */
export function hasLaunchChoice(settings) {
  return settings && settings.presetId !== null && settings.presetId !== undefined;
}

/** Resolve built-in or saved launch configuration's base simulation preset. */
export function presetFor(rawSettings) {
  const input = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
    ? rawSettings
    : {};
  const settings = normaliseLaunchSettings(input);
  const custom = customPresetForId(settings.presetId);
  const found = BUILTIN_LAUNCH_PRESETS.find((preset) => preset.id === settings.presetId);
  const baseEntry = found || (custom && BUILTIN_LAUNCH_PRESETS.find((preset) => preset.id === custom.basePresetId))
    || BUILTIN_LAUNCH_PRESETS.find((preset) => preset.id === DEFAULT_LAUNCH_PRESET_ID);
  const savedSettings = custom ? normaliseLaunchSettings(custom.settings) : null;
  // Saved custom configurations inherit from their built-in source world. The
  // raw caller fields take precedence so an explicit null clears saved options.
  const base = baseEntry.preset;
  const effective = normaliseLaunchSettings(custom
    ? { ...savedSettings, ...input, parameterOverrides: input.parameterOverrides ?? savedSettings.parameterOverrides }
    : settings);
  if (custom) effective.presetId = custom.id;
  const matchingSpecies = Array.isArray(effective.speciesNames)
    ? base.species.filter((entry) => effective.speciesNames.includes(entry.name))
    : base.species;
  const species = matchingSpecies.length ? matchingSpecies : base.species;
  const laws = effective.laws ?? base.laws;
  const quickOverrides = Object.fromEntries(LAUNCH_FIELDS
    .filter((field) => field.worldParamKey && effective[field.key] !== null && effective[field.key] !== undefined)
    .map((field) => [field.worldParamKey, effective[field.key]]));
  const worldParams = Object.keys(quickOverrides).length || Object.keys(effective.parameterOverrides).length
    ? { ...base.worldParams, ...quickOverrides, ...effective.parameterOverrides }
    : base.worldParams;
  if (species.length === base.species.length && laws === base.laws && worldParams === base.worldParams) return base;
  const safeSpecies = species.length ? species : base.species.slice(0, 1);
  return { ...base, laws, species: safeSpecies, speciesCount: safeSpecies.length, worldParams };
}
