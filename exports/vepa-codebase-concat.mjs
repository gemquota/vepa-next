// ============================================================================
// VEPA4 — Minimal Functional Concatenated Core (generated 2026-08-14)
//
// Single-file snapshot of the headless physics core. Every module keeps its
// own closure scope via the tiny __define/__import registry, so per-file
// private helpers (clamp, nanGuard, ...) cannot collide. No imports remain —
// the file is self-contained and runs in Node:
//
//     node exports/vepa-codebase-concat.mjs
//
// Modules (20 files, dependency order):
//   - src/core/prng.js
//   - src/constants.js
//   - src/state/worldParams.js
//   - src/state/runtimeConfig.js
//   - src/state/particleBuffer.js
//   - src/state/lawState.js
//   - src/physics/spatialGrid.js
//   - src/dna/dnaBuffer.js
//   - src/physics/laws.js
//   - src/physics/synergy.js
//   - src/physics/lawgroups/physicsLaws.js
//   - src/physics/lawgroups/thermoLaws.js
//   - src/physics/lawgroups/biologyLaws.js
//   - src/physics/lawgroups/chemistryLaws.js
//   - src/physics/lawgroups/emLaws.js
//   - src/physics/lawgroups/infoLaws.js
//   - src/physics/lawgroups/metaLaws.js
//   - src/physics/lawgroups/quantumLaws.js
//   - src/physics/solver.js
//   - src/spawn/distribution.js
// Excluded by design (browser-only): src/ui, src/render, src/engines,
// src/multiplex, src/worker/physics.worker.js, src/main.js, src/debug.js.
// ============================================================================

const __modules = new Map();
function __define(key, factory) { __modules.set(key, factory()); }
function __import(key) {
  const mod = __modules.get(key);
  if (!mod) throw new Error('module not loaded: ' + key);
  return mod;
}

// ══════════════════════════════════════════════════════════════════════
// FILE: src/core/prng.js
// ══════════════════════════════════════════════════════════════════════
__define('src/core/prng.js', () => {class SplitMix32 {
  constructor(seed) {
    this.state = seed | 0;
  }

  next() {
    let z = (this.state + 0x9e3779b9) | 0;
    this.state = z;
    z = (z ^ (z >>> 16)) | 0;
    z = Math.imul(z, 0x21f0aaad);
    z = z ^ (z >>> 15);
    z = Math.imul(z, 0x735a2d97);
    z = z ^ (z >>> 15);
    return (z >>> 0) / 4294967296;
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }
}

  return { SplitMix32 };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/constants.js
// ══════════════════════════════════════════════════════════════════════
__define('src/constants.js', () => {// ============================================================================
// VEPA v3 — Core Constants
// Single Source of Truth for stride layout, DNA parameters, law indexes,
// category mappings, DNA ranges, and world configuration defaults.
// ============================================================================

// --- Global Simulation Constants ---

const PARTICLE_STRIDE = 100;
const DEFAULT_DNA_STRIDE = 64;
const DNA_PACK_MAX = 65535;
const MAX_SPECIES = 64;
const MAX_PARTICLES = 2500;
const STAR_MASS = 12;   // mass threshold for gravitational collapse (star)
const DEFAULT_PARTICLES_PER_SPECIES = 250;
const WORLD_SIZE = 2000;
const RHO_REF = 0.2;                    // ADIABATIC reference density (neighborhood occupancy 0..1) — no compression heating at this density
const ADIABATIC_GAMMA_MINUS_ONE = 2 / 3; // gamma-1 for the monatomic ideal-gas adiabatic law (gamma = 5/3)

// --- Particle Stride Layout (100 floats per particle) ---

const STRIDE_INDEXES = {
  POS_X:          0,
  POS_Y:          1,
  POS_Z:          2,
  VEL_X:          3,
  VEL_Y:          4,
  VEL_Z:          5,
  MASS:           6,
  SPECIES_ID:     7,
  DNA_CACHE_START: 8,
  DNA_CACHE_END:  49,   // 8 + 42 = 50, so indices 8..49 hold 42 DNA values
  ENERGY:         50,
  AGE:            51,
  DEAD:           52,
  COLOR_R:        53,
  COLOR_G:        54,
  COLOR_B:        55,
  RADIUS:         56,
  SIGNAL:         57,
  BOND_COUNT:     58,
  BOND_PARTNER_1: 59,
  BOND_PARTNER_2: 60,
  MEMORY:         61,
  HUNGER:         62,
  ARMOR:          63,
  MITOSIS_TIMER:  64,
  PARTNER_ID:     65,
  TEMPERATURE:    66,
  CHARGE:         67,
  PHASE_1:        68,
  PHASE_2:        69,
  SOUL:           70,
  TRAIL_X:        71,
  TRAIL_Y:        72,
  TRAIL_Z:        73,
  ALPHA:          74,
  ENTANGLE_ID:    75,
  ENTANGLE_PHASE: 76,
  // ── Multi-energy architecture (batch 03) ──
  // ENERGY (50) stays the LIFE/metabolic pool; SIGNAL (57) is signal
  // transmission strength. These additional reservoirs keep other energy
  // kinds from colliding with metabolism:
  ELECTRIC_ENERGY: 77, // electrical potential energy (EM laws, batches 14-20)
  STORED_ENERGY:   78, // general reserve pool (capacitance / fusion storage)
  REPRO_DRIVE:     79, // reproductive drive meter (REPRO law gate)
  RADIATION_EXPOSURE: 80, // accumulated radiation dose (RADIATION law; ramps mutation)
  // ── Polymer chain expansion (batch 06) ──
  // BOND_PARTNER_1/2 (59/60) plus these four slots give the documented
  // "max 6 bonds per particle" for POLYMER chains. Added at the tail so
  // existing stride offsets (persisted saves, workers) stay stable.
  BOND_PARTNER_3:     81,
  BOND_PARTNER_4:     82,
  BOND_PARTNER_5:     83,
  BOND_PARTNER_6:     84,
  // ── Law-redesign state (v4.6.29) ──
  // Deterministic chaos map (CHAOS), symbol token (SYMBOL), superposition
  // amplitudes (SUPERPOSITION), wave/particle measurement flag
  // (WAVE_PARTICLE) and the predictive self-model speed (CONSCIOUSNESS).
  // Added at the tail (85-95) so persisted saves and worker buffers keep
  // their offsets stable; 96-99 remain reserved.
  CHAOS_STATE_X:   85,
  CHAOS_STATE_Y:   86,
  CHAOS_STATE_Z:   87,
  SYMBOL_TOKEN:    88,
  SUPER_AMP_1:     89,
  SUPER_AMP_2:     90,
  SUPER_AMP_3:     91,
  SUPER_AMP_4:     92,
  SUPER_PHASE:     93,
  WAVE_MEASURED:   94,
  SELF_MODEL_SPEED: 95,
};

// --- DNA Indexes (42 parameters) ---

const DNA_INDEXES = {
  FORCE:              0,
  VISCOSITY:          1,
  TORQUE:             2,
  JITTER:             3,
  POLARITY:           4,
  ALPHA:              5,
  SYMMETRY:           6,
  HIDDEN_MASS:        7,
  STIFFNESS:          8,
  FUSION:             9,
  BIRTH_RATE:         10,
  DEATH_RATE:         11,
  MUTATION:           12,
  SIGNAL_RESP:        13,
  PULSE_RATE:         14,
  TIDAL:              15,
  FUSION_MOMENTUM:    16,
  FUSION_TIME:        17,
  NEIGHBORHOOD_RADIUS: 18,
  SIGNAL_STRENGTH:    19,
  SIGNAL_DECAY:       20,
  PROPAGATION_SPEED:  21,
  TUNING_CH1:         22,
  TUNING_CH2:         23,
  TUNING_CH3:         24,
  TUNING_CH4:         25,
  INERTIA:            26,
  FRICTION:           27,
  MAX_VELOCITY:       28,
  BASE_RADIUS:        29,
  ELASTICITY:         30,
  BOND_ANGLE:         31,
  CONDUCTIVITY:       32,
  MAGNETIC_MOMENT:    33,
  ENERGY_EFFICIENCY:  34,
  SEX_CHANCE:         35,
  PREDATION_BIAS:     36,
  REACTION_THRESHOLD: 37,
  CATALYSIS:          38,
  HEAT_OUTPUT:        39,
  MEMORY_DECAY:       40,
  SPECIES_AFFINITY:   41,
  DOMINANCE:          42,
  CROSSOVER_RATE:     43,
  EPIGENETIC_DRIFT:   44,
  HETEROZYGOSITY:     45,
  GENE_FLOW:          46,
  REPRESSOR:          47,
  // ── Genetics & regulatory expansion (batch: DNA 64) — indices 48-63 ──
  // Genome-only params: stored in the 64×64 species DNA buffer, read on
  // demand via readSpeciesDNAParam (never cached in the particle stride).
  ALLELE_COUNT:       48,
  EPIGENETIC_RATE:    49,
  HGT_RATE:           50,
  REPAIR_EFFICIENCY:  51,
  DRIFT_RATE:         52,
  SELECTION_SENSITIVITY: 53,
  SPECIATION_THRESHOLD:  54,
  ADAPTATION_RATE:    55,
  TRANSPOSON_RATE:    56,
  GENE_SILENCING:     57,
  RECOMBINATION_BIAS: 58,
  MUTAGEN_SENSITIVITY: 59,
  TELOMERE_LENGTH:    60,
  PLOIDY_LEVEL:       61,
  CODON_BIAS:         62,
  REGULATORY_DEPTH:   63,
};

const DNA_COUNT = 64;

// --- Human-readable names for each DNA index ---

const DNA_META = [
  'Force',
  'Viscosity',
  'Torque',
  'Jitter',
  'Polarity',
  'Alpha',
  'Symmetry',
  'Hidden Mass',
  'Stiffness',
  'Fusion',
  'Birth Rate',
  'Death Rate',
  'Mutation',
  'Signal Response',
  'Pulse Rate',
  'Tidal',
  'Fusion Momentum',
  'Fusion Time',
  'Neighborhood Radius',
  'Signal Strength',
  'Signal Decay',
  'Propagation Speed',
  'Tuning Ch1',
  'Tuning Ch2',
  'Tuning Ch3',
  'Tuning Ch4',
  'Inertia',
  'Friction',
  'Max Velocity',
  'Base Radius',
  'Elasticity',
  'Bond Angle',
  'Conductivity',
  'Magnetic Moment',
  'Energy Efficiency',
  'Sex Chance',
  'Predation Bias',
  'Reaction Threshold',
  'Catalysis',
  'Heat Output',
  'Memory Decay',
  'Species Affinity',
  'Dominance',
  'Crossover Rate',
  'Epigenetic Drift',
  'Heterozygosity',
  'Gene Flow',
  'Repressor',
  'Allele Count',
  'Epigenetic Rate',
  'HGT Rate',
  'Repair Efficiency',
  'Drift Rate',
  'Selection Sensitivity',
  'Speciation Threshold',
  'Adaptation Rate',
  'Transposon Rate',
  'Gene Silencing',
  'Recombination Bias',
  'Mutagen Sensitivity',
  'Telomere Length',
  'Ploidy Level',
  'Codon Bias',
  'Regulatory Depth',
];

// --- DNA Ranges [min, max, default] for each of the 64 parameters ---

const DNA_RANGES = [
  { min: -100,  max: 100,  default: 1.0    },   // 0  FORCE
  { min: 0.5,   max: 1.0,  default: 0.98   },   // 1  VISCOSITY
  { min: -1,    max: 1,    default: 0       },   // 2  TORQUE
  { min: 0,     max: 5.0,  default: 0.05    },   // 3  JITTER
  { min: -1,    max: 1,    default: 0       },   // 4  POLARITY
  { min: 0,     max: 1,    default: 0.5     },   // 5  ALPHA
  { min: -1,    max: 1,    default: 0       },   // 6  SYMMETRY
  { min: -5,    max: 5,    default: 0       },   // 7  HIDDEN_MASS
  { min: 0.1,   max: 5,    default: 1.0     },   // 8  STIFFNESS
  { min: 0,     max: 1,    default: 0.5     },   // 9  FUSION
  { min: 0,     max: 10,   default: 0.5     },   // 10 BIRTH_RATE
  { min: 0,     max: 10,   default: 0.1     },   // 11 DEATH_RATE
  { min: 0,     max: 10,   default: 0.5     },   // 12 MUTATION
  { min: 0,     max: 2,    default: 1.0     },   // 13 SIGNAL_RESP
  { min: 0,     max: 1,    default: 0.2     },   // 14 PULSE_RATE
  { min: -1,    max: 1,    default: 0       },   // 15 TIDAL
  { min: 0,     max: 50,   default: 1.0     },   // 16 FUSION_MOMENTUM
  { min: 0,     max: 100,  default: 2       },   // 17 FUSION_TIME
  { min: 20,    max: 500,  default: 120     },   // 18 NEIGHBORHOOD_RADIUS
  { min: 0,     max: 1,    default: 0.5     },   // 19 SIGNAL_STRENGTH
  { min: 0.1,   max: 0.99, default: 0.95    },   // 20 SIGNAL_DECAY
  { min: 0.01,  max: 1.0,  default: 0.5     },   // 21 PROPAGATION_SPEED
  { min: 0,     max: 1,    default: 1       },   // 22 TUNING_CH1
  { min: 0,     max: 1,    default: 1       },   // 23 TUNING_CH2
  { min: 0,     max: 1,    default: 1       },   // 24 TUNING_CH3
  { min: 0,     max: 1,    default: 1       },   // 25 TUNING_CH4
  { min: 0.1,   max: 2,    default: 1.0     },   // 26 INERTIA
  { min: 0,     max: 0.1,  default: 0.01    },   // 27 FRICTION
  { min: 1,     max: 50,   default: 20      },   // 28 MAX_VELOCITY
  { min: 0.2,   max: 4,    default: 0.4     },   // 29 BASE_RADIUS
  { min: 0,     max: 1,    default: 0.5     },   // 30 ELASTICITY
  { min: 0,     max: 360,  default: 0       },   // 31 BOND_ANGLE
  { min: 0,     max: 1,    default: 0.1     },   // 32 CONDUCTIVITY
  { min: -1,    max: 1,    default: 0.1     },   // 33 MAGNETIC_MOMENT
  { min: 0,     max: 10,   default: 0.8     },   // 34 ENERGY_EFFICIENCY
  { min: 0,     max: 10,   default: 0.05    },   // 35 SEX_CHANCE
  { min: 0,     max: 20,   default: 0       },   // 36 PREDATION_BIAS
  { min: 10,    max: 1000, default: 500     },   // 37 REACTION_THRESHOLD
  { min: 1,     max: 10,   default: 1.0     },   // 38 CATALYSIS
  { min: 0,     max: 1,    default: 0.1     },   // 39 HEAT_OUTPUT
  { min: 0.9,   max: 1.0,  default: 0.99    },   // 40 MEMORY_DECAY
  { min: -1.0,  max: 1.0,  default: 0.0     },   // 41 SPECIES_AFFINITY
  { min: 0.0,   max: 1.0,  default: 0.5     },   // 42 DOMINANCE
  { min: 0.0,   max: 0.5,  default: 0.1     },   // 43 CROSSOVER_RATE
  { min: 0.0,   max: 0.1,  default: 0.01    },   // 44 EPIGENETIC_DRIFT
  { min: 0.0,   max: 1.0,  default: 0.5     },   // 45 HETEROZYGOSITY
  { min: 0.0,   max: 1.0,  default: 0.2     },   // 46 GENE_FLOW
  { min: -1.0,  max: 1.0,  default: 0.0     },   // 47 REPRESSOR
  { min: 1,     max: 8,    default: 2        },   // 48 ALLELE_COUNT
  { min: 0,     max: 1,    default: 0.1      },   // 49 EPIGENETIC_RATE
  { min: 0,     max: 1,    default: 0.05     },   // 50 HGT_RATE
  { min: 0,     max: 1,    default: 0.5      },   // 51 REPAIR_EFFICIENCY
  { min: 0,     max: 1,    default: 0.1      },   // 52 DRIFT_RATE
  { min: 0,     max: 1,    default: 0.5      },   // 53 SELECTION_SENSITIVITY
  { min: 0,     max: 1,    default: 0.5      },   // 54 SPECIATION_THRESHOLD
  { min: 0,     max: 1,    default: 0.2      },   // 55 ADAPTATION_RATE
  { min: 0,     max: 1,    default: 0.05     },   // 56 TRANSPOSON_RATE
  { min: 0,     max: 1,    default: 0.1      },   // 57 GENE_SILENCING
  { min: -1,    max: 1,    default: 0        },   // 58 RECOMBINATION_BIAS
  { min: 0,     max: 1,    default: 0.5      },   // 59 MUTAGEN_SENSITIVITY
  { min: 0,     max: 1,    default: 0.5      },   // 60 TELOMERE_LENGTH
  { min: 1,     max: 4,    default: 2        },   // 61 PLOIDY_LEVEL
  { min: 0,     max: 1,    default: 0.5      },   // 62 CODON_BIAS
  { min: 1,     max: 10,   default: 3        },   // 63 REGULATORY_DEPTH
];

// --- Law Indexes (64 laws) ---

const LAW_INDEXES = {
  // Physics (Blue) — indices 0-6
  GRAV:           0,
  DRAG:           1,
  ENTR:           2,
  WRAP:           3,
  COLL:           4,
  ACCR:           5,
  PLANETARY:      6,

  // Biology (Green) — indices 7-16
  LIFE:           7,
  GLOW:           8,
  AFFINITY:       9,
  REPRO:          10,
  TRACK:          11,
  SENESCENCE:     12,
  ENERGY:         13,
  RADIATION:      14,
  GENOTYPE:       15,
  PHENOTYPE:      16,

  // Chemistry (Purple) — indices 17-24
  CATALYSIS_LAW:  17,
  SOLVATION:      18,
  ACIDITY:        19,
  OXIDATION:      20,
  POLYMER:        21,
  ISOMERIZATION:  22,
  CHIRALITY:      23,
  CRYSTALLIZATION: 24,

  // Thermodynamics (Orange) — indices 25-29
  HEAT:           25,
  COLD:           26,
  CONVECTION:     27,
  PHASE_RADIATION: 28,
  SUBLIMATION:    29,

  // Metaphysics (Red) — indices 30-37
  TIME_DILATION:  30,
  DIMENSIONALITY: 31,
  CHAOS:          32,
  ORDER:          33,
  FATE:           34,
  WILL:           35,
  SOUL_LAW:       36,
  MIND:           37,

  // Added missing V2 laws
  // Physics
  VOID:           38,
  BOND:           39,
  // Chemistry
  REDUCTION:      40,
  ALLOY:          41,
  // Thermodynamics
  MELT:           42,
  BOIL:           43,
  CONDENSE:       44,
  DEPOSIT:        45,
  EXOTHERMIC:     46,
  // Metaphysics
  TELEPATHY:      47,
  CLAIRVOYANCE:   48,
  PRECOGNITION:   49,
  ASTRAL:         50,
  PREDATION:     51,
  COMMS:         52,

  // Electromagnetism (Cyan) — indices 53-65
  CHARGE_LAW:    53,
  FIELD:         54,
  CURRENT:       55,
  RESISTANCE:    56,
  CAPACITANCE:   57,
  INDUCTANCE:    58,
  MAGNETISM:     59,
  RESONANCE:     60,
  FLUX:          61,
  IONIZATION:    62,
  DISCHARGE:     63,
  PLASMA:        64,
  SUPERCONDUCTIVITY: 65,

  // Information (Gold) — indices 66-78
  MEMORY:        66,
  PATTERN:       67,
  STIGMERGY:     68,
  SIGNAL_BOOST:  69,
  LEARN:         70,
  SYMBOL:        71,
  METRIC:        72,
  PREDICT:       73,
  CODE:          74,
  PROTOCOL:      75,
  FEEDBACK:      76,
  LANGUAGE:      77,
  CULTURE:       78,

  // New law types (indices 79-81)
  SINGULARITY:   79,
  ENTANGLEMENT:  80,
  HISTORY:       81,

  // 8x16 expansion — Physics (indices 82-87)
  TIDE:          82,
  FRICTION:      83,
  ELASTICITY:    84,
  TURBULENCE:    85,
  CENTRIPETAL:   86,
  ROTATION:      87,

  // Biology (indices 88-91)
  SYMBIOSIS:     88,
  PARASITE:      89,
  HIBERNATION:   90,
  IMMUNITY:      91,

  // Chemistry (indices 92-97)
  ELECTROLYSIS:  92,
  PHOTOLYSIS:    93,
  PRECIPITATION: 94,
  NEUTRALIZATION: 95,
  STOICHIOMETRY: 96,
  AUTOCATALYSIS: 97,

  // Thermodynamics (indices 98-103)
  ADIABATIC:     98,
  COMPRESSION:   99,
  EXPANSION:     100,
  EQUILIBRIUM:   101,
  LATENT_HEAT:   102,
  RUNAWAY:       103,

  // Metaphysics (indices 104-106)
  CONSCIOUSNESS: 104,
  PERCEPTION:    105,
  SYNCHRONICITY: 106,

  // Electromagnetism (indices 107-109)
  ANTENNA:       107,
  SHIELDING:     108,
  POLARIZATION:  109,

  // Information (indices 110-111)
  NAVIGATION:    110,
  ENCRYPTION:    111,

  // Quantum (indices 112-127)
  SUPERPOSITION: 112,
  TUNNELING:     113,
  DECOHERENCE:   114,
  WAVE_PARTICLE: 115,
  UNCERTAINTY:   116,
  TELEPORT:      117,
  OBSERVER:      118,
  PLANCK:        119,
  COHERENCE:     120,
  BOSONIC:       121,
  FERMIONIC:     122,
  SPIN:          123,
  SPECTRAL:      124,
  WAVEFUNCTION:  125,
  HYPERPLANE:    126,
  ANTIMATTER:    127,
};

const LAW_COUNT = 128;

// --- Law Category Mapping ---

const LAW_CATEGORIES = {
  physics: {
    color: 'RED',
    laws: [
      LAW_INDEXES.GRAV,
      LAW_INDEXES.DRAG,
      LAW_INDEXES.ENTR,
      LAW_INDEXES.COLL,
      LAW_INDEXES.ACCR,
      LAW_INDEXES.PLANETARY,
      LAW_INDEXES.VOID,
      LAW_INDEXES.BOND,
      LAW_INDEXES.SINGULARITY,
      LAW_INDEXES.TIDE,
      LAW_INDEXES.FRICTION,
      LAW_INDEXES.ELASTICITY,
      LAW_INDEXES.TURBULENCE,
      LAW_INDEXES.CENTRIPETAL,
      LAW_INDEXES.ROTATION,
    ],
  },
  biology: {
    color: 'ORANGE',
    laws: [
      LAW_INDEXES.LIFE,
      LAW_INDEXES.GLOW,
      LAW_INDEXES.AFFINITY,
      LAW_INDEXES.REPRO,
      LAW_INDEXES.TRACK,
      LAW_INDEXES.SENESCENCE,
      LAW_INDEXES.ENERGY,
      LAW_INDEXES.RADIATION,
      LAW_INDEXES.GENOTYPE,
      LAW_INDEXES.PHENOTYPE,
      LAW_INDEXES.PREDATION,
      LAW_INDEXES.COMMS,
      LAW_INDEXES.SYMBIOSIS,
      LAW_INDEXES.PARASITE,
      LAW_INDEXES.HIBERNATION,
      LAW_INDEXES.IMMUNITY,
    ],
  },
  chemistry: {
    color: 'YELLOW',
    laws: [
      LAW_INDEXES.CATALYSIS_LAW,
      LAW_INDEXES.SOLVATION,
      LAW_INDEXES.ACIDITY,
      LAW_INDEXES.OXIDATION,
      LAW_INDEXES.POLYMER,
      LAW_INDEXES.ISOMERIZATION,
      LAW_INDEXES.CHIRALITY,
      LAW_INDEXES.CRYSTALLIZATION,
      LAW_INDEXES.REDUCTION,
      LAW_INDEXES.ALLOY,
      LAW_INDEXES.ELECTROLYSIS,
      LAW_INDEXES.PHOTOLYSIS,
      LAW_INDEXES.PRECIPITATION,
      LAW_INDEXES.NEUTRALIZATION,
      LAW_INDEXES.STOICHIOMETRY,
      LAW_INDEXES.AUTOCATALYSIS,
    ],
  },
  thermodynamics: {
    color: 'GREEN',
    laws: [
      LAW_INDEXES.HEAT,
      LAW_INDEXES.COLD,
      LAW_INDEXES.CONVECTION,
      LAW_INDEXES.PHASE_RADIATION,
      LAW_INDEXES.SUBLIMATION,
      LAW_INDEXES.MELT,
      LAW_INDEXES.BOIL,
      LAW_INDEXES.CONDENSE,
      LAW_INDEXES.DEPOSIT,
      LAW_INDEXES.EXOTHERMIC,
      LAW_INDEXES.ADIABATIC,
      LAW_INDEXES.COMPRESSION,
      LAW_INDEXES.EXPANSION,
      LAW_INDEXES.EQUILIBRIUM,
      LAW_INDEXES.LATENT_HEAT,
      LAW_INDEXES.RUNAWAY,
    ],
  },
  metaphysics: {
    color: 'TEAL',
    laws: [
      LAW_INDEXES.TIME_DILATION,
      LAW_INDEXES.DIMENSIONALITY,
      LAW_INDEXES.CHAOS,
      LAW_INDEXES.ORDER,
      LAW_INDEXES.FATE,
      LAW_INDEXES.WILL,
      LAW_INDEXES.SOUL_LAW,
      LAW_INDEXES.MIND,
      LAW_INDEXES.TELEPATHY,
      LAW_INDEXES.CLAIRVOYANCE,
      LAW_INDEXES.PRECOGNITION,
      LAW_INDEXES.ASTRAL,
      LAW_INDEXES.ENTANGLEMENT,
      LAW_INDEXES.CONSCIOUSNESS,
      LAW_INDEXES.PERCEPTION,
      LAW_INDEXES.SYNCHRONICITY,
    ],
  },
  electromagnetism: {
    color: 'BLUE',
    laws: [
      LAW_INDEXES.CHARGE_LAW,
      LAW_INDEXES.FIELD,
      LAW_INDEXES.CURRENT,
      LAW_INDEXES.RESISTANCE,
      LAW_INDEXES.CAPACITANCE,
      LAW_INDEXES.INDUCTANCE,
      LAW_INDEXES.MAGNETISM,
      LAW_INDEXES.RESONANCE,
      LAW_INDEXES.FLUX,
      LAW_INDEXES.IONIZATION,
      LAW_INDEXES.DISCHARGE,
      LAW_INDEXES.PLASMA,
      LAW_INDEXES.SUPERCONDUCTIVITY,
      LAW_INDEXES.ANTENNA,
      LAW_INDEXES.SHIELDING,
      LAW_INDEXES.POLARIZATION,
    ],
  },
  information: {
    color: 'VIOLET',
    laws: [
      LAW_INDEXES.MEMORY,
      LAW_INDEXES.PATTERN,
      LAW_INDEXES.STIGMERGY,
      LAW_INDEXES.SIGNAL_BOOST,
      LAW_INDEXES.LEARN,
      LAW_INDEXES.SYMBOL,
      LAW_INDEXES.METRIC,
      LAW_INDEXES.PREDICT,
      LAW_INDEXES.CODE,
      LAW_INDEXES.PROTOCOL,
      LAW_INDEXES.FEEDBACK,
      LAW_INDEXES.LANGUAGE,
      LAW_INDEXES.CULTURE,
      LAW_INDEXES.HISTORY,
      LAW_INDEXES.NAVIGATION,
      LAW_INDEXES.ENCRYPTION,
    ],
  },
  quantum: {
    color: 'PURPLE',
    laws: [
      LAW_INDEXES.SUPERPOSITION,
      LAW_INDEXES.TUNNELING,
      LAW_INDEXES.DECOHERENCE,
      LAW_INDEXES.WAVE_PARTICLE,
      LAW_INDEXES.UNCERTAINTY,
      LAW_INDEXES.TELEPORT,
      LAW_INDEXES.OBSERVER,
      LAW_INDEXES.PLANCK,
      LAW_INDEXES.COHERENCE,
      LAW_INDEXES.BOSONIC,
      LAW_INDEXES.FERMIONIC,
      LAW_INDEXES.SPIN,
      LAW_INDEXES.SPECTRAL,
      LAW_INDEXES.WAVEFUNCTION,
      LAW_INDEXES.HYPERPLANE,
      LAW_INDEXES.ANTIMATTER,
    ],
  },
};

// --- Law sub-groups (UI splitting — breaks the 128-law wall into themes) ---
// Each category lists labelled sub-groups; every law appears in exactly one.
// The LAWS tab renders these as sub-headers inside each collapsible category.

const LAW_SUBGROUPS = {
  physics: [
    { label: 'ATTRACTION', laws: [LAW_INDEXES.GRAV, LAW_INDEXES.PLANETARY, LAW_INDEXES.ACCR, LAW_INDEXES.VOID, LAW_INDEXES.TIDE, LAW_INDEXES.SINGULARITY, LAW_INDEXES.CENTRIPETAL] },
    { label: 'MOTION & COLLISION', laws: [LAW_INDEXES.DRAG, LAW_INDEXES.ENTR, LAW_INDEXES.COLL, LAW_INDEXES.FRICTION, LAW_INDEXES.ELASTICITY, LAW_INDEXES.TURBULENCE, LAW_INDEXES.ROTATION] },
    { label: 'BONDING', laws: [LAW_INDEXES.BOND] },
  ],
  biology: [
    { label: 'LIFECYCLE', laws: [LAW_INDEXES.LIFE, LAW_INDEXES.REPRO, LAW_INDEXES.SENESCENCE, LAW_INDEXES.HIBERNATION, LAW_INDEXES.RADIATION, LAW_INDEXES.GENOTYPE, LAW_INDEXES.PHENOTYPE] },
    { label: 'ECOLOGY', laws: [LAW_INDEXES.AFFINITY, LAW_INDEXES.TRACK, LAW_INDEXES.PREDATION, LAW_INDEXES.SYMBIOSIS, LAW_INDEXES.PARASITE, LAW_INDEXES.IMMUNITY] },
    { label: 'SIGNAL & ENERGY', laws: [LAW_INDEXES.GLOW, LAW_INDEXES.COMMS, LAW_INDEXES.ENERGY] },
  ],
  chemistry: [
    { label: 'MEDIUM & IONS', laws: [LAW_INDEXES.SOLVATION, LAW_INDEXES.ACIDITY, LAW_INDEXES.NEUTRALIZATION, LAW_INDEXES.PRECIPITATION] },
    { label: 'REDOX', laws: [LAW_INDEXES.OXIDATION, LAW_INDEXES.REDUCTION, LAW_INDEXES.ELECTROLYSIS, LAW_INDEXES.PHOTOLYSIS] },
    { label: 'MOLECULAR', laws: [LAW_INDEXES.POLYMER, LAW_INDEXES.ISOMERIZATION, LAW_INDEXES.CHIRALITY, LAW_INDEXES.CRYSTALLIZATION, LAW_INDEXES.ALLOY] },
    { label: 'KINETICS', laws: [LAW_INDEXES.CATALYSIS_LAW, LAW_INDEXES.AUTOCATALYSIS, LAW_INDEXES.STOICHIOMETRY] },
  ],
  thermodynamics: [
    { label: 'HEAT FLOW', laws: [LAW_INDEXES.HEAT, LAW_INDEXES.COLD, LAW_INDEXES.CONVECTION, LAW_INDEXES.EQUILIBRIUM] },
    { label: 'PHASE CHANGE', laws: [LAW_INDEXES.PHASE_RADIATION, LAW_INDEXES.SUBLIMATION, LAW_INDEXES.MELT, LAW_INDEXES.BOIL, LAW_INDEXES.CONDENSE, LAW_INDEXES.DEPOSIT, LAW_INDEXES.LATENT_HEAT] },
    { label: 'PRESSURE & FEEDBACK', laws: [LAW_INDEXES.ADIABATIC, LAW_INDEXES.COMPRESSION, LAW_INDEXES.EXPANSION, LAW_INDEXES.RUNAWAY, LAW_INDEXES.EXOTHERMIC] },
  ],
  metaphysics: [
    { label: 'SELF', laws: [LAW_INDEXES.WILL, LAW_INDEXES.FATE, LAW_INDEXES.CONSCIOUSNESS, LAW_INDEXES.PERCEPTION] },
    { label: 'TIME & SPACE', laws: [LAW_INDEXES.TIME_DILATION, LAW_INDEXES.DIMENSIONALITY, LAW_INDEXES.CHAOS, LAW_INDEXES.ORDER] },
    { label: 'PSYCHIC', laws: [LAW_INDEXES.MIND, LAW_INDEXES.TELEPATHY, LAW_INDEXES.CLAIRVOYANCE, LAW_INDEXES.PRECOGNITION] },
    { label: 'SOUL', laws: [LAW_INDEXES.SOUL_LAW, LAW_INDEXES.ASTRAL, LAW_INDEXES.SYNCHRONICITY, LAW_INDEXES.ENTANGLEMENT] },
  ],
  electromagnetism: [
    { label: 'STATIC FIELDS', laws: [LAW_INDEXES.CHARGE_LAW, LAW_INDEXES.FIELD, LAW_INDEXES.CAPACITANCE, LAW_INDEXES.FLUX, LAW_INDEXES.SHIELDING] },
    { label: 'CONDUCTION', laws: [LAW_INDEXES.CURRENT, LAW_INDEXES.RESISTANCE, LAW_INDEXES.SUPERCONDUCTIVITY, LAW_INDEXES.INDUCTANCE] },
    { label: 'MAGNETIC & WAVES', laws: [LAW_INDEXES.MAGNETISM, LAW_INDEXES.RESONANCE, LAW_INDEXES.ANTENNA, LAW_INDEXES.POLARIZATION] },
    { label: 'IONIZATION', laws: [LAW_INDEXES.IONIZATION, LAW_INDEXES.DISCHARGE, LAW_INDEXES.PLASMA] },
  ],
  information: [
    { label: 'MEMORY & LEARNING', laws: [LAW_INDEXES.MEMORY, LAW_INDEXES.LEARN, LAW_INDEXES.FEEDBACK, LAW_INDEXES.PATTERN] },
    { label: 'SIGNALING', laws: [LAW_INDEXES.STIGMERGY, LAW_INDEXES.SIGNAL_BOOST, LAW_INDEXES.PROTOCOL, LAW_INDEXES.ENCRYPTION] },
    { label: 'CULTURE & CODE', laws: [LAW_INDEXES.SYMBOL, LAW_INDEXES.CODE, LAW_INDEXES.LANGUAGE, LAW_INDEXES.CULTURE] },
    { label: 'NAVIGATION', laws: [LAW_INDEXES.METRIC, LAW_INDEXES.PREDICT, LAW_INDEXES.HISTORY, LAW_INDEXES.NAVIGATION] },
  ],
  quantum: [
    { label: 'STATE & COLLAPSE', laws: [LAW_INDEXES.SUPERPOSITION, LAW_INDEXES.DECOHERENCE, LAW_INDEXES.OBSERVER, LAW_INDEXES.WAVEFUNCTION] },
    { label: 'DUALITY & TRANSPORT', laws: [LAW_INDEXES.WAVE_PARTICLE, LAW_INDEXES.TUNNELING, LAW_INDEXES.TELEPORT, LAW_INDEXES.UNCERTAINTY] },
    { label: 'STATISTICS & SPIN', laws: [LAW_INDEXES.BOSONIC, LAW_INDEXES.FERMIONIC, LAW_INDEXES.SPIN, LAW_INDEXES.COHERENCE] },
    { label: 'SPECTRA & EXTREMES', laws: [LAW_INDEXES.PLANCK, LAW_INDEXES.SPECTRAL, LAW_INDEXES.HYPERPLANE, LAW_INDEXES.ANTIMATTER] },
  ],
};

// --- Law dependency map (v4.6.29) ---
// `requires`: all listed laws must be active (hard gate — the dependent law is
// locked in the UI and does nothing without them). `anyOf`: at least one must
// be active. `soft: true` entries are documentation-only (synergies / signal
// sources) and are NOT gated in the UI — see audit-suite/fidelity-audit-v4.6.29.md §2.

const LAW_DEPENDENCIES = {
  [LAW_INDEXES.SENESCENCE]:    { requires: [LAW_INDEXES.LIFE], reason: 'aging is nested inside the LIFE cycle' },
  [LAW_INDEXES.TELEPORT]:      { requires: [LAW_INDEXES.ENTANGLEMENT], reason: 'state teleport needs an entangled partner' },
  [LAW_INDEXES.ENCRYPTION]:    { requires: [LAW_INDEXES.COMMS], reason: 'the cipher scrambles the COMMS channel' },
  [LAW_INDEXES.FEEDBACK]:      { requires: [LAW_INDEXES.MEMORY], reason: 'the memory trace only exists under MEMORY' },
  [LAW_INDEXES.OBSERVER]:      { requires: [LAW_INDEXES.MEMORY], reason: 'observation requires a memory trace' },
  [LAW_INDEXES.NAVIGATION]:    { requires: [LAW_INDEXES.MEMORY], reason: 'steering reads the memory gradient' },
  [LAW_INDEXES.ISOMERIZATION]: { anyOf: [LAW_INDEXES.BOND, LAW_INDEXES.POLYMER], reason: 'rearrangement needs existing bonds' },

  // Soft (documentation only — not gated):
  [LAW_INDEXES.LANGUAGE]:      { anyOf: [LAW_INDEXES.GLOW, LAW_INDEXES.COMMS], soft: true, reason: 'needs a signal source to exchange memory' },
  [LAW_INDEXES.SIGNAL_BOOST]:  { anyOf: [LAW_INDEXES.GLOW, LAW_INDEXES.COMMS], soft: true, reason: 'relays an existing signal' },
  [LAW_INDEXES.ANTENNA]:       { anyOf: [LAW_INDEXES.GLOW, LAW_INDEXES.COMMS], soft: true, reason: 'broadcasts an existing signal' },
  [LAW_INDEXES.POLARIZATION]:  { anyOf: [LAW_INDEXES.GLOW, LAW_INDEXES.COMMS], soft: true, reason: 'filters an existing signal exchange' },
  [LAW_INDEXES.MIND]:          { anyOf: [LAW_INDEXES.COMMS, LAW_INDEXES.TELEPATHY], soft: true, reason: 'amplifies an existing signal channel' },
  [LAW_INDEXES.WAVE_PARTICLE]: { requires: [LAW_INDEXES.OBSERVER], soft: true, reason: 'duality needs measurement — without OBSERVER it stays purely wave-like' },
};

// --- Reverse lookup: law index → category name ---

const LAW_TO_CATEGORY = {};
for (const [catName, cat] of Object.entries(LAW_CATEGORIES)) {
  for (const idx of cat.laws) {
    LAW_TO_CATEGORY[idx] = catName;
  }
}

// --- Reverse lookup: category color by law index ---

const LAW_COLOR_BY_INDEX = {};
for (const [catName, cat] of Object.entries(LAW_CATEGORIES)) {
  for (const idx of cat.laws) {
    LAW_COLOR_BY_INDEX[idx] = cat.color;
  }
}


// --- EM-spectrum rainbow bands (percent positions on a 0-100 spectrum) ---
// Eight evenly spaced colours at 12.5% intervals; each band is 4 points wide
// (center ± 2). RED wraps through 100/0, so its band runs start=98 to end=102.

const LAW_SPECTRUM = {
  RED:    { start: 98,   end: 102, center: 0 },
  ORANGE: { start: 10.5, end: 14.5, center: 12.5 },
  YELLOW: { start: 23,   end: 27,   center: 25 },
  GREEN:  { start: 35.5, end: 39.5, center: 37.5 },
  TEAL:   { start: 48,   end: 52,   center: 50 },
  BLUE:   { start: 60.5, end: 64.5, center: 62.5 },
  VIOLET: { start: 73,   end: 77,   center: 75 },
  PURPLE: { start: 85.5, end: 89.5, center: 87.5 },
};

// --- Per-law hue: each of the 16 laws in a category is spread across its band ---

const LAW_HUE_BY_INDEX = {};
for (const [catName, cat] of Object.entries(LAW_CATEGORIES)) {
  const band = LAW_SPECTRUM[cat.color];
  const step = (band.end - band.start) / (cat.laws.length - 1);
  cat.laws.forEach((idx, k) => {
    const pos = (band.start + k * step) % 100; // RED wraps through 100/0
    LAW_HUE_BY_INDEX[idx] = Math.round(((pos / 100) * 360) * 10) / 10;
  });
}


// --- Law HELP_DB (tooltip descriptions) ---
// Mirrors v2 HELP_DB structure: each law has a hint + explanation + system + advanced tier.

const LAW_HELP_DB = {
  // Electromagnetism (Cyan)
  CHARGE_LAW: {
    hint: "Coulomb force: charged particles attract or repel.",
    explanation: "Confirmed batch-14 (match irl): real inverse-square Coulomb force on the effective charge = POLARITY DNA + stored stride CHARGE — opposite signs attract, like signs repel, with no weighting between the two charge sources.",
    system: "qq = (POLARITY₁ + CHARGE₁) × (POLARITY₂ + CHARGE₂); force = −k×qq/(dist² + 0.5). Zero effective charge feels no force.",
  },
  FIELD: {
    hint: "Uniform electric field drift along the particle's polarity.",
    explanation: "Confirmed batch-14: every polarized particle receives a constant uniform acceleration (same on all three axes) along its POLARITY sign — positive drifts one way, negative the other. Stored CHARGE scales the drift strength, so a charged particle feels the field harder.",
    system: "POLARITY ≠ 0: acceleration = POLARITY × k × (1 + |CHARGE| × 0.5) on each axis. Combined with CHARGE_LAW it separates species by polarity into opposing drift lanes.",
  },
  CURRENT: {
    hint: "Charge transport: charge diffuses between conductive particles.",
    explanation: "Confirmed batch-14: neighboring particles exchange stored charge proportionally to CONDUCTIVITY DNA, smoothing charge gradients like electric current through a conductor — but both particles must be conductive for current to flow (real materials).",
    system: "Within 17 units: dq = (CHARGE_j − CHARGE_i) × min(CONDUCTIVITY_i, CONDUCTIVITY_j) × k; charge flows from high to low. Pairs with CAPACITANCE and IONIZATION.",
  },
  RESISTANCE: {
    hint: "Electrical resistance: fast motion converts kinetic energy into heat.",
    explanation: "Confirmed batch-15 (match irl): moving particles are damped and their TEMPERATURE rises with speed — kinetic energy dissipates as heat. Resistance is material-dependent: CONDUCTIVITY DNA lowers the damping (conductors glide, insulators resist), and hotter particles damp harder — the thermal-Ohmic feedback that prevents runaway charge-driven velocities.",
    system: "damp = speed·k·(1 − CONDUCTIVITY·0.9)·(1 + TEMP·2); TEMP += speed·k·(1 − CONDUCTIVITY·0.9)·0.5 (cap 1). High conductivity = low resistance; hot = slow.",
  },
  CAPACITANCE: {
    hint: "Capacitance: particles store energy as charge.",
    explanation: "Confirmed batch-15: particles accumulate stored CHARGE from surplus ENERGY and feel a pairwise force from stored charge — energy storage that later drives electrostatic motion. Discharging drains toward zero only, so a depleted capacitor never flips polarity from draining.",
    system: "Charge accrues when ENERGY exceeds 50 (clamped ±2, the breakdown limit) and bleeds toward zero when below. Stored charge feeds CHARGE_LAW and FLUX; same-sign stored charge repels.",
  },
  INDUCTANCE: {
    hint: "Inductance: neighbors align their motion magnetically.",
    explanation: "Confirmed batch-15 (match irl): velocity alignment between coupled particles — magnetic coupling that damps relative motion and shepherds streams. Coupling needs a magnetic field (|MAGNETIC_MOMENT product|) and both particles must conduct, and it fades with distance like a real inductive field.",
    system: "dv = (v_j − v_i)·k·couple, couple = |m1·m2|/(1 + dist·0.03), requires CONDUCTIVITY > 0 on both. Momentum-conserving; forms coherent flow lanes.",
  },
  MAGNETISM: {
    hint: "Magnetic moment alignment: aligned moments attract.",
    explanation: "Confirmed batch-15: MAGNETIC_MOMENT is signed (−1..1) — matching signs attract, opposing signs repel, scaled by the product of their moments. Both behaviors are now reachable through normal DNA.",
    system: "F = k·m1·m2/dist² — aligned moments form magnetic chains and filaments along the moment direction; opposing moments push apart. Complements CHARGE_LAW for full electromagnetic structure.",
  },
  RESONANCE: {
    hint: "Resonance: pulsing particles attract when their pulse rates match.",
    explanation: "Confirmed batch-16 (match irl): sympathetic vibration — particles with similar PULSE_RATE DNA that are actively signaling attract each other, and phase alignment amplifies them. In-phase pairs (constructive interference) scale the attraction up and the stronger pulser drives the weaker one's SIGNAL upward; out-of-phase pairs get no drive.",
    system: "F = k·s1·s2·sync·phaseSync/(dist+1), sync = 1−|ΔPULSE_RATE|, phaseSync = 0.5+0.5·cos(Δphase·π/2) using the GLOW/COMMS oscillator phase = sin(age·0.01·(0.1+pulseRate)). phaseSync > 0.6 → weaker pulser gains SIGNAL.",
  },
  FLUX: {
    hint: "Charge flux: particles are pushed along the charge gradient.",
    explanation: "Confirmed batch-16 (match irl): F = qE — the drift direction depends on the particle's effective charge q = POLARITY + CHARGE. Positive carriers move DOWN the stored-charge gradient (with the field), negative carriers move UP it (electrons run the other way), and neutral particles follow the field lines toward higher stored charge.",
    system: "F = dir·k·(c_j − c_i)/(dist+1), dir = −1 for q > 1e-3, +1 for q < −1e-3, +1 for neutral. Turns stored charge into directed motion; works with CURRENT and CAPACITANCE.",
  },
  IONIZATION: {
    hint: "Ionization: hard contacts strip charge onto particles.",
    explanation: "Confirmed batch-16 (match irl): a hard contact above a threshold impact energy ionizes the pair — charge is transferred, forming a conserved +/− ion pair (q_i + q_j = 0). The pair's combined POLARITY sign decides which partner turns positive. Already-charged particles are not re-stripped.",
    system: "dist ≤ 3 and impact = min(1, relSpeed·k) > 0.15 → q_i = impact·s, q_j = −impact·s with s = sign(POLARITY_i + POLARITY_j) || 1. Seeds CHARGE_LAW, FLUX, and CURRENT with genuine ion pairs.",
  },
  DISCHARGE: {
    hint: "Discharge: stored charge bursts into motion and heat.",
    explanation: "Confirmed batch-16 (match irl): the spark travels along the potential difference — the kick is aimed at the neighbor with the most opposite stored charge, not a random direction. Threshold |c| ≥ 0.5, heat spike, and reset-to-zero unchanged; random burst only when no opposite-charge field exists nearby.",
    system: "|c| ≥ 0.5 → kick = |c|·k aimed along the accumulated opposite-charge gradient (weighted by −sign(c)·(c_j − c_i)/(dist+1)); TEMP += |c|·0.08 (cap 1); CHARGE = 0. Spark-like impulses re-seed electrostatic dynamics.",
  },
  PLASMA: {
    hint: "Plasma: hot particles ionize — heat becomes charge.",
    explanation: "Confirmed batch-17 (match irl): the thermal-EM bridge with hysteresis — above 0.6 surplus heat ionizes into stored CHARGE (cooling the gas), and below 0.5 a cooled plasma recombines: stored charge converts back to heat and the ion resets. Plasma never keeps its charge after it cools.",
    system: "temp > 0.6 → CHARGE += (temp−0.6)·k, temp −= conv·0.5; temp < 0.5 with stored charge → CHARGE = 0, temp += |c|·k·2 (cap 1). The 0.5–0.6 band prevents rapid oscillation. Feeds CHARGE_LAW/FLUX.",
  },
  SUPERCONDUCTIVITY: {
    hint: "Superconductivity: cold pairs couple into lossless streams.",
    explanation: "Confirmed batch-17: pairs below the critical temperature (≤ 0.35) lock together — velocities align and stored charge equalizes with far less damping than normal. Synergies: +COLD ×1.8, +RESISTANCE cancels Ohmic damping ×0.2 (true lossless flow).",
    system: "Both particles ≤ 0.35 → charge diff halves toward zero and relative velocity damps toward alignment. Forms coherent, near-frictionless flow lanes.",
  },

  // Information (Gold)
  MEMORY: {
    hint: "Memory: particles retain momentum and remember recent contacts.",
    explanation: "Confirmed batch-17: interacting particles refresh a MEMORY trace (+0.05 on contact, capped 1); remembered motion persists — velocity slowly grows while the trace decays over time (×0.995/tick).",
    system: "Uses the MEMORY stride slot; velocity ×= 1 + mem·k·0.02 per tick. +FEEDBACK ×1.6, +HISTORY ×1.6. Encourages inertial motion and historical continuity.",
  },
  PATTERN: {
    hint: "Pattern: dense regions attract more particles (cohesion).",
    explanation: "Confirmed batch-17: nearby particles are pulled together by a distance-scaled cohesion force (k/(dist+1), inert below dist 1), reinforcing whatever structure already exists.",
    system: "Positive feedback — clumps thicken. +HISTORY ×1.5 remembered-geometry drift. Pair with ORDER for crystallization or CHAOS for pattern turbulence.",
  },
  STIGMERGY: {
    hint: "Stigmergy: particles leave trails and follow the trails of others.",
    explanation: "Confirmed batch-17 (match irl): only moving particles lay a predicted-path trail marker (pos + vel·8); a stopped particle's marker evaporates back toward it. Followers are pulled along the pheromone gradient — the pull falls off with distance to the marker and scales with freshness (markers far from their owner are stale).",
    system: "Speed ≥ 0.5 → TRAIL = pos + v·8; stopped → marker lerps 8%/tick back to the owner. Follow: F = k·freshness/(1+dist·0.1), freshness = 1/(1+ownerDist·0.02). +LEARN ×1.3. Ant-like foraging streams without global coordination.",
  },
  SIGNAL_BOOST: {
    hint: "Signal boost: contact amplifies and relays signals.",
    explanation: "Confirmed batch-17: a signaling particle relays its SIGNAL to neighbors on contact, scaled by its SIGNAL_STRENGTH DNA (0.5–1.5×) — stronger emitters relay more. Propagates pulses beyond normal communication range.",
    system: "s1 > 0.01 → s2 += s1·k·(0.5 + SIGNAL_STRENGTH·0.5). +PROTOCOL ×1.5 relayed synchronization. Extends the COMMS layer like a relay chain.",
  },
  LEARN: {
    hint: "Learning: particles match the velocity of their neighbors.",
    explanation: "Confirmed batch-18: velocity alignment (boids-style) — each particle steers toward the average motion of nearby particles; both converge via the pair loop.",
    system: "v1 += (v2 − v1)·k·0.1. +STIGMERGY ×1.3 learned trail-following, +SYMBOL ×1.4 species schooling. Creates schooling/flocking.",
  },
  SYMBOL: {
    hint: "Symbol: arbitrary tokens acquire shared meaning through contact.",
    explanation: "Each particle carries a SYMBOL_TOKEN (8 bins). Tokens are meaningless until contact imprints them: the partner with higher MEMORY (the 'authority') copies its token onto the naive one, so meaning spreads through the group. Response is token-gated — same-token particles attract (homing on shared meaning), different-token pairs are neutral. This differentiates SYMBOL from AFFINITY: grouping follows learned identity, not species.",
    system: "Token = round(SYMBOL_TOKEN·7). On contact the naive partner's token moves toward the higher-MEMORY partner's bin. Force: same token → +0.15·k/(dist+1) attraction; different tokens → −0.05·k/(dist+1).",
    advanced: "+CULTURE spreads tokens group-wide; +MEMORY accelerates imprinting; +COMMS can tag pulses with the token (future).",
  },
  METRIC: {
    hint: "Metric: particles climb the energy gradient.",
    explanation: "Confirmed batch-19: particles are attracted toward higher-ENERGY neighbors (F = k·dE/(dist+1)), flowing from poor to rich regions like value-seeking agents.",
    system: "An information-theoretic gradient: energy acts as a fitness landscape.",
  },
  PREDICT: {
    hint: "Predict: particles aim where the neighbor will be.",
    explanation: "Confirmed batch-19: attraction is computed toward the neighbor's extrapolated future position (velocity × 3-tick prediction window), producing interception and pursuit curves.",
    system: "Aim at pos + Δv·3, force k/(dist+1). +TRACK ×1.5 interception. Anticipation makes pursuit smooth — clever predators.",
  },
  CODE: {
    hint: "Code: close contact blends DNA between particles.",
    explanation: "Confirmed batch-19: on close contact (≤ 4 units) particles exchange DNA cache values at sampled loci — horizontal information transfer.",
    system: "Blends 7 sampled loci (every 6th) toward the average at rate k·0.01. +LANGUAGE ×1.5 words spread genes. Moves traits through the population.",
  },
  PROTOCOL: {
    hint: "Protocol: neighbors entrain their signal phase.",
    explanation: "Confirmed batch-19: signals of nearby particles converge toward the average (s1/s2 swap equal deltas) — synchronization like metronomes coupling on a table.",
    system: "d = (s2 − s1)·k·0.1, both clamped 0..1. +SIGNAL_BOOST ×1.5 relayed synchronization. With RESONANCE creates global pulse waves.",
  },
  FEEDBACK: {
    hint: "Feedback: memory amplifies motion, motion refreshes memory.",
    explanation: "Particles with a MEMORY trace accelerate along their existing velocity, and fast motion recharges the trace — a self-reinforcing inertial loop.",
    system: "Positive feedback loop. With MEMORY it produces persistent, history-driven motion; can destabilize into runaway or lock into orbits.",
  },
  LANGUAGE: {
    hint: "Language: signaling pairs exchange memory traces.",
    explanation: "When two particles are actively signaling, their MEMORY states converge and the signal relays between them — shared words carried between minds.",
    system: "Distinct from PROTOCOL (signal phase) — LANGUAGE moves stored memory state. With SIGNAL_BOOST it builds distributed shared knowledge.",
  },
  CULTURE: {
    hint: "Culture: same-species contacts converge their traits.",
    explanation: "Contacts between particles of the same species blend their DNA cache — norms spread within the group while leaving other species untouched.",
    system: "In-group trait convergence. With GENOTYPE it acts as soft heredity; with SYMBOL it sharpens species identity over time.",
  },
  SINGULARITY: {
    hint: "Singularity: supermassive particles collapse into black holes.",
    explanation: "Particles above the critical mass exert an extreme inverse-square pull on everything around them and absorb any particle that crosses their event horizon, releasing an accretion flash.",
    system: "Uses MASS, DEAD, RADIUS and TEMPERATURE. With ACCR, mass concentrates until collapse; matter then rains in and the hole grows.",
  },
  ENTANGLEMENT: {
    hint: "Entanglement: touching particles forge correlated quantum links.",
    explanation: "Particles that make contact become entangled (ENTANGLE_ID + phase 1). The link is a pure correlation — it carries no signals and transfers no momentum (no-signaling theorem); the shared phase decoheres (×0.998/tick) until the correlation snaps on both sides, and one partner's death collapses the pair. TELEPORT is the only legitimate use of the link: quantum state transfer.",
    system: "Stores the partner index in ENTANGLE_ID; ENTANGLE_PHASE decays the shared correlation over time. No forces, no signal relay, no recoil — correlated collapse only. +TELEPATHY ×1.6, +COMMS ×1.5.",
  },
  HISTORY: {
    hint: "History: the world remembers where particles have been.",
    explanation: "A coarse 12×12×12 spatial memory field accumulates particle presence (energy/mass-weighted, exponentially decaying); particles drift along the local memory-field gradient — archaeology as a local force, long after the action moved on.",
    system: "12×12×12 memory field, decaying exponentially; per-particle local ∇History gradient (wrap-around central differences, six reads — no global field scan). +MEMORY ×1.6, +PATTERN ×1.5. Past activity leaves a local attractor that steers new arrivals.",
  },

  GRAV: {
    hint: "Universal gravitational attraction between all particles.",
    explanation: "Newtonian gravity: F = G*m1*m2/r². FORCE DNA modulates the pair: both positive multiply the pull, both negative invert it into repulsion, opposite signs cancel to a neutral pair. HIDDEN_MASS adds dark-matter mass.",
    system: "Fundamental force driving cluster formation and orbital dynamics. Uses HIDDEN_MASS for dark-matter effects; TIDAL boosts close-range pull; stars (> starMass) pull harder.",
  },
  DRAG: {
    hint: "Velocity-dependent motion damping.",
    explanation: "Slows particles proportional to their VISCOSITY DNA parameter. Higher viscosity = more damping.",
    system: "Prevents runaway velocities. Combined with friction (always active) stabilizes the simulation.",
  },
  ENTR: {
    hint: "Brownian jitter adds random thermal motion.",
    explanation: "Particles receive random force kicks proportional to JITTER DNA, preventing static equilibrium.",
    system: "Acts as thermal noise floor. In low-viscosity regimes it drives chaos; in high-viscosity it enables slow annealing.",
  },
  WRAP: {
    hint: "Toroidal world wrapping (particles wrap around edges).",
    explanation: "Simulation rule (v4.6.29): not a universe law — a boundary condition for the sim itself. When enabled, particles leaving one edge reappear on the opposite edge; when disabled, soft walls reflect them. Lives in WORLD → SIMULATION RULES alongside WALL REFLECT.",
    system: "On = toroidal wrap, off = soft walls whose velocity effect is set by the WALL REFLECT slider (0 = absorb, 1 = reflect, 2 = double bounce). Still bit 3 in the law state so saves and presets stay compatible.",
  },
  COLL: {
    hint: "Physical collisions with momentum exchange.",
    explanation: "Particles bounce off each other based on ELASTICITY DNA. Overlapping particles are pushed apart. Standalone from ACCR — turn ACCR off to get pure elastic bouncing without mass fusion.",
    system: "Impulse-based collision response with mass-weighted velocity exchange. ELASTICITY controls bounciness. Pairs that are fusing under ACCR coalesce instead of bouncing.",
  },
  ACCR: {
    hint: "Mass accretion on collision.",
    explanation: "FUSION_MOMENTUM DNA is the MINIMUM relative momentum required to fuse on impact — faster pairs merge, slower pairs bounce. FUSION_TIME DNA is how long slower pairs must stay in very close proximity before they fuse anyway. FUSION DNA scales the mass-transfer efficiency.",
    system: "Hierarchical mass growth. Proximity dwell is tracked per contact pair; leaving contact resets the clock. Stars (> starMass) pull overlapping matter in and dissolve it. High fusion leads to proto-celestial body formation.",
  },
  PLANETARY: {
    hint: "Atmospheric gravity: constant downward pull toward the ground.",
    explanation: "Every particle falls toward the ground plane (z = 0) with a constant acceleration that is independent of mass — simulating particles much smaller than the world falling through a planet's atmosphere.",
    system: "Force is scaled by mass so acceleration is mass-independent. ×1.5 with GRAV. With WRAP off the soft-wall clamp turns z = 0 into the ground; particles pile up there instead of floating to the centre.",
  },
  VOID: {
    hint: "Vacuum pressure: empty space pushes particles apart.",
    explanation: "Confirmed batch-10 (yes): strengthened and dark-energy scaled — the outward push grows with distance from the world centre, opposing gravitational clustering harder at the edges.",
    system: "Strength = 0.004 x synergy x (0.3 + dist/(worldSize/2)) along the radial direction from the world centre.",
  },
  BOND: {
    hint: "Molecular bonding between nearby particles.",
    explanation: "Confirmed batch-10: molecular bonds prefer dense neighbourhoods — the more neighbours nearby, the stronger and longer-range the bond — instead of chain ends (that is POLYMER's job). Stretched bonds break past 3x the rest length.",
    system: "Density boost = min(2, 1 + nCount x 0.05) scales spring force and range (30 x boost). Rest length = (r1+r2) x 1.1, spring k = STIFFNESS DNA x 0.05 x synergy x boost. Bonds register in all 6 shared slots; break when dist > rest x 3.",
  },
  LIFE: {
    hint: "Biological lifecycle: energy cost, aging, death.",
    explanation: "Particles consume metabolic energy over time (based on ENERGY_EFFICIENCY, scaled by the DECAY_RATE slider) and photosynthesis subsidises it from LIGHT_LEVEL. When metabolic energy hits 0, they die; hunger beyond the cap also kills.",
    system: "Core ecosystem loop. Only the LIFE metabolic path triggers energy-depletion death — charge/electromagnetic energy lives in its own fields and laws. Senescence (age-based death) is a separate law.",
  },
  GLOW: {
    hint: "Signaling pulses: particles emit periodic signals for visual brightness.",
    explanation: "GLOW is an emitter only (batch-04 correction): an oscillator (PULSE_RATE × SIGNAL_STRENGTH DNA) raises the particle's SIGNAL — its transmission strength — when the phase is positive. Signal (SIGNAL) and metabolism (ENERGY) are separate channels and GLOW never converts one into the other.",
    system: "Emission: SIGNAL += phase×PULSE_RATE×SIGNAL_STRENGTH×dt×0.05×synergy when the oscillator phase is positive; with COMMS the pulse propagates to neighbours. No energy regen — ENERGY stays exactly as the LIFE law left it. Distinct from COMMS, which handles propagation.",
  },
  AFFINITY: {
    hint: "Species-based attraction or repulsion.",
    explanation: "SPECIES_AFFINITY BOOSTS attraction to the same species: the same-species pull scales with positive affinity and is inert at 0. Different-species pairs repel only when SPECIES_AFFINITY is negative (xenophobic).",
    system: "Uses SPECIES_AFFINITY DNA (index 41). Same-species: strength 0.1×max(0, affinity)×synergy×SPECIES_INTERACTION. Cross-species: repel at 0.05×|affinity| when negative. Positive = gregarious, negative = xenophobic.",
  },
  REPRO: {
    hint: "Reproduction driven by a reproductive-drive meter.",
    explanation: "Particles accumulate REPRODUCTIVE DRIVE from BIRTH_RATE over time. Once the drive passes 60 and the particle is mature (AGE ≥ 100), it has a per-tick chance to spawn a child with mutated DNA; spawning consumes the drive and half the parent's life energy.",
    system: "Drive (REPRO_DRIVE stride field 79) accumulates BIRTH_RATE×0.1×dt×synergy, capped at 100. Chance = BIRTH_RATE×0.01×synergy per tick. MUTATION controls offspring variation; genetics params 42-47 + SEX_CHANCE enable two-parent crossover. Energy is no longer the reproduction gate.",
  },
  TRACK: {
    hint: "Predation tracking: particles chase lower-mass prey of another species.",
    explanation: "Particles with high PREDATION_BIAS are attracted to lower-mass particles — but only across species: a predator never hunts its own kind.",
    system: "Requires PREDATION_BIAS ≥ 0.1 and a different-species neighbour with mass < 0.8× the predator's; pull strength = PREDATION_BIAS×0.05×synergy. Combines with LIFE and REPRO for full ecosystem simulation.",
  },
  PREDATION: {
    hint: "Predation: mass-difference pursuit and gene absorption.",
    explanation: "Confirmed batch-13 (match docs): larger particles pursue smaller ones based on PREDATION_BIAS DNA, absorbing DNA traits and mass on contact. A predator never hunts its own kind — predation is strictly cross-species (matches TRACK). Prey flee with jitter-based repulsion.",
    system: "Cross-species pairs with mass difference > 0.5: predator pull = PREDATION_BIAS×0.1×preyMass/dist; prey flee = JITTER×0.2/dist. On contact, 5 PRNG-sampled DNA traits blend 5% toward the prey plus mass transfer.",
    advanced: "Pairs with TRACK and REPRO for full ecosystem cycles. High PREDATION_BIAS species act as apex predators; prey species benefit from JITTER for escape.",
  },
  COMMS: {
    hint: "Communication: particles emit and exchange channel-filtered signals.",
    explanation: "Confirmed batch-14: oscillator pulses (PULSE_RATE × SIGNAL_STRENGTH DNA) build a SIGNAL field each tick; neighbors within NEIGHBORHOOD_RADIUS exchange signal filtered by TUNING_CH1-4, converting delivery into homing force + memory. The sender pays the emission cost — signalling is no longer a free energy source.",
    system: "The only law that drives signal emission, decay, and pairwise signal exchange. Delivery: receiver SIGNAL/MEMORY += delivered, homing force = SIGNAL_RESP × delivered × 0.05; sender ENERGY −= delivered × 0.5 (floor 0). With COMMS off, SIGNAL and MEMORY fields freeze.",
    advanced: "Receiver sensitivity is SIGNAL_RESP, range is NEIGHBORHOOD_RADIUS, persistence is SIGNAL_DECAY, and channel tuning is TUNING_CH1-4. Because COMMS is the sole gate for the communication DNA group, toggling it off guarantees zero signal-driven movement even when other laws are active.",
  },
  SENESCENCE: {
    hint: "Age-based death: old particles die off.",
    explanation: "Particles past age 500 have increasing death probability based on DEATH_RATE DNA. Senescence is nested inside the LIFE cycle (confirmed): it only fires while LIFE is on, so aging is a property of living organisms.",
    system: "Past AGE 500, per-tick death chance = DEATH_RATE×0.001×(1 + ageNorm×0.5)×dt. Requires LIFE. Prevents immortal particles and enables generational turnover.",
  },
  ENERGY: {
    hint: "Energy conduction: every energy pool flows toward equilibrium.",
    explanation: "Nearby particles conduct ALL energy reservoirs pairwise toward equilibrium — LIFE energy (ENERGY), ELECTRIC_ENERGY and STORED_ENERGY each transfer independently, like thermal conduction. SIGNAL (transmission strength) and REPRO_DRIVE (drive meter) are not energy reservoirs and are never touched.",
    system: "For each channel, pairs within dist² < 40000 transfer (hot − cold)×0.005×synergy×ENERGY_TRANSFER per tick. Conservation holds per channel. Prevents energy hoarding by high-mass particles.",
  },
  RADIATION: {
    hint: "Background radiation damages unprotected particles and slowly irradiates them.",
    explanation: "Particles accumulate RADIATION_EXPOSURE over time, scaled by the RADIATION_LEVEL slider. Low-ARMOR particles take life-energy damage that slowly compounds with the accumulated dose, and the dose steadily ramps DNA mutation chance — more and more over time.",
    system: "Exposure += RADIATION_LEVEL×dt×0.01 (cap 100). Damage = (1−ARMOR)×0.02×RADIATION_LEVEL×(1 + exposure×0.02)×dt×synergy; energy ≤ 0 kills. Mutation chance = exposure×0.001×dt×synergy per tick, perturbing the DNA cache. Radiation death is consistent with the batch-02 LIFE depletion death.",
  },
  GENOTYPE: {
    hint: "Genetics engine: somatic drift, gene flow and species-genome evolution.",
    explanation: "DNA and genetics are a major part of VEPA. GENOTYPE drives per-particle somatic drift in the DNA cache (heritable through REPRO), modulated by the genetics params: REPRESSOR damps drift, HETEROZYGOSITY widens variance, EPIGENETIC_DRIFT adds non-heritable noise, GENE_FLOW pulls foreign genes horizontally, and accumulated RADIATION exposure ramps the rate. Rarely, a mutation writes back into the species genome itself, so evolution accumulates at the species level.",
    system: "Base chance = MUTATION×(1+TEMPERATURE)×dt×0.01×synergy×(1−REPRESSOR×0.5)×(1+exposure×0.05); mutates 1-3 cache loci by ±MUTATION×0.05×(1+HETEROZYGOSITY×2). Epigenetic noise and gene-flow blend per mutation; writeback chance = CROSSOVER_RATE×0.0002×dt, quantized into the 64×64 species DNA buffer.",
  },
  PHENOTYPE: {
    hint: "Gene expression: the inherited genome becomes the visible body.",
    explanation: "Phenotype = genotype (DNA cache) expressed through the environment. POLARITY → hue, ALPHA → saturation, SYMMETRY → lightness are translated into the particle's colour every tick, and ENERGY is the environment — well-fed particles (energy > 100) grow larger, starving ones shrink. Offspring inherit the DNA, so they inherit the look.",
    system: "RADIUS ×= (1 + (energy/200 − 0.5) × 0.5 × synergy); colour = HSL(POLARITY→hue 0-240, ALPHA→saturation, SYMMETRY→lightness) written to COLOR_R/G/B (0-255). The solver's mass-derived radius recompute applies the same energy factor.",
  },
  CATALYSIS_LAW: {
    hint: "Catalysis: reactions happen faster — and it is free.",
    explanation: "Increases the multiplier for chemical interactions (confirmed batch-05: chemistry only, no energy cost). CATALYSIS DNA (index 38) controls the multiplier.",
    system: "chemMult = 1 + CATALYSIS×0.5×synergy, applied to the forces accumulated before the chemistry modifier in the pair loop (affinity/gravity). Free — never touches ENERGY, CHARGE or SIGNAL.",
  },
  SOLVATION: {
    hint: "Solvation: the solvent medium — opposite charges attract, like charges repel.",
    explanation: "Real-world solvation (confirmed batch-05): like dissolving salt in water, the medium pulls opposite-charge ions together and pushes like charges apart, and charge-different particles react faster in the solvent.",
    system: "Charge force = 0.05×|q1×q2|×synergy along the pair axis, sign = attract for opposite signs, repel for like signs (wired into the solver pair loop). Reaction multiplier = 1 + |Δcharge|×0.2×synergy when the gap > 0.5. Uses stride CHARGE (POLARITY DNA seeds it).",
  },
  ACIDITY: {
    hint: "Acid/base exchange: charge equalization between particles.",
    explanation: "Documented behavior (confirmed batch-05): particles exchange CHARGE when close, equalizing their electrical potential. CONDUCTIVITY DNA controls the transfer rate and the CHARGE field is altered. ENERGY is untouched.",
    system: "When |Δcharge| ≥ 0.3, transfer = Δcharge × max(CONDUCTIVITY_i, CONDUCTIVITY_j) × 0.1 × dt × synergy from the higher-charge particle to the lower. Charge is conserved per pair.",
  },
  OXIDATION: {
    hint: "Oxidation: charged particles rust, burn and glow.",
    explanation: "Real oxidation is electron loss (confirmed batch-06): a charged particle's CHARGE drifts toward 0 at the same rate its mass erodes, and with HEAT_OUTPUT DNA it releases heat energy and flashes brighter while it burns.",
    system: "Requires |CHARGE| ≥ 0.3. MASS −= |charge|×0.001×dt×synergy; CHARGE decays by |charge|×0.001×dt×synergy toward 0 (electrical rust). With HEAT_OUTPUT (DNA 39): ENERGY += charge×HEAT_OUTPUT×0.05×dt×synergy (cap 200), TEMPERATURE rises, and COLOR_R/G/B + ALPHA flash toward white.",
  },
  POLYMER: {
    hint: "Polymerization: particles form chain bonds.",
    explanation: "Confirmed batch-10: polymers prefer to extend chains — free/tip particles (0-1 bonds) bond eagerly while well-connected particles (3+) are avoided, so POLYMER grows linear chains instead of cross-linked webs.",
    system: "Bond slots (BOND_PARTNER_1..6, stride 59/60/81-84), max 6 mutual bonds. Bond range = 10 x synergy x chainBias, where chainBias = 1.0 (0-1 bonds), 0.5 (2), 0.25 (3+). Spring force stiffness 0.02 x synergy, rest length 4.",
  },
  ISOMERIZATION: {
    hint: "Isomerization: bond topology rearrangement.",
    explanation: "Real isomerization keeps the same atoms but rearranges the bonds (confirmed batch-06: match real life). A particle with 3+ chain bonds occasionally breaks one connection — the freed partner becomes a fragment (its reciprocal bond is cleared too) — and the rearrangement consumes a little energy.",
    system: "Chance = 0.02×dt×synergy per tick when BOND_COUNT ≥ 3 and ENERGY ≥ 1: break the first filled bond slot, clear the partner's reciprocal slot and decrement both counts, then ENERGY −= 0.5×dt×synergy.",
  },
  CHIRALITY: {
    hint: "Chirality: handedness from TORQUE DNA creates spin bias.",
    explanation: "Confirmed batch-06: handedness comes from TORQUE DNA (geometric mirror-handedness, clockwise vs counter-clockwise), not charge. Same-handedness pairs deflect perpendicular to their separation — positive torque spins one way, negative the other, like mirror-image enantiomers.",
    system: "Same-sign TORQUE pair (dist ≥ 1): perpendicular deflection (−dy, dx)×0.01×synergy×sign(TORQUE)×invDist. Opposite-handedness or zero-torque pairs: no force.",
  },
  CRYSTALLIZATION: {
    hint: "Crystallization: same-species rigid lattice formation.",
    explanation: "Confirmed batch-07 + repaired: any pair within 150 units is pulled toward an 8-unit lattice grid, and same-species pairs crystallize 3x stronger (rigid clusters). Range and strength were tuned up so lattices actually form at default spawn spacing.",
    system: "Quantizes pair separation to an 8-unit grid (pull 0.05 x synergy, range 1-150); same-species pairs pull 3x harder. Creates crystalline structures.",
  },
  HEAT: {
    hint: "Thermal motion: heat adds random jitter to hot particles.",
    explanation: "Confirmed batch-07: particles above 0.5 TEMPERATURE receive random velocity kicks proportional to temperature (kinetic-theory thermal noise), and heat conducts pairwise toward equilibrium.",
    system: "Thermal jitter = +/-(temp x 0.01 x dt x synergy) per axis for temp > 0.5; conduction rate 0.01 x dt x synergy / HEAT_CAPACITY, hot flows to cold.",
  },
  COLD: {
    hint: "Cold slows particles down.",
    explanation: "Confirmed batch-07: particles below 0.5 TEMPERATURE have their velocity damped each tick, and cold conducts heat from warmer neighbours toward equilibrium.",
    system: "Velocity x= max(0, 1 - (0.5 - temp) x 0.1 x dt x synergy) for temp < 0.5; conduction cools the hotter neighbour (rate 0.015 x dt x synergy / HEAT_CAPACITY).",
  },
  CONVECTION: {
    hint: "Convection: buoyant vertical motion from temperature.",
    explanation: "Confirmed batch-07: hot particles get positive Y velocity (buoyancy), creating convection currents. Buoyancy is deliberately not scaled by HEAT_CAPACITY — conduction already encodes capacity into the temperature field.",
    system: "Buoyancy = (temp - 0.5) * 0.001 * dt * synergy on VEL_Y. Drives large-scale circulation patterns.",
  },
  PHASE_RADIATION: {
    hint: "Blackbody radiation: hot particles emit energy.",
    explanation: "Confirmed batch-08 (follow irl behaviour): Stefan-Boltzmann blackbody emission — every warm body radiates and hot bodies radiate disproportionately (T^4 curve), cooling TEMPERATURE and ENERGY while boosting SIGNAL glow.",
    system: "For temp > 0.05: radiated = temp^4 x 0.05 x dt x synergy; ENERGY -= radiated, TEMPERATURE -= radiated, SIGNAL += radiated (cap 1). Prevents energy runaway.",
  },
  SUBLIMATION: {
    hint: "Sublimation: low-mass hot particles turn to gas.",
    explanation: "Confirmed batch-08: hot (temp > 0.5) high-energy (ENERGY > 50) particles sublimate, losing mass down to a 0.02 floor and gaining a PRNG velocity burst; sublimation consumes extra energy and cools the particle.",
    system: "sublRate = (temp-0.5) x 0.005 x dt x synergy; MASS -= sublRate (floor 0.02), VEL_X/Y += (prng()-0.5) x sublRate x 5, ENERGY -= sublRate x 20, TEMPERATURE -= sublRate x 0.5.",
  },
  MELT: {
    hint: "Melting: hot particles lose structural integrity.",
    explanation: "Confirmed batch-11 (follow HELP_DB): melting is a loss of rigidity, not mass — above the melt point (temp 0.7) a particle's effective STIFFNESS decays toward a 20% floor, and below it the particle re-solidifies and stiffness recovers. Reversible phase change.",
    system: "STIFFNESS (DNA cache) decays by (temp−0.7) x 0.02 x dt x synergy toward 20% of the species baseline; recovers at 0.005 x dt x synergy below temp 0.7.",
  },
  BOIL: {
    hint: "Boiling: very hot particles eject mass.",
    explanation: "Confirmed batch-11 (yes): particles above boiling temperature (temp 0.9) eject a mass fraction as energetic vapor — the ejected mass becomes a PRNG velocity burst and costs latent heat (ENERGY), with a 0.02 mass floor so nothing boils away completely.",
    system: "ejectMass = mass x (temp−0.9) x 0.02 x dt x synergy (> 0.01 threshold); MASS −= ejectMass (floor 0.02); VEL ±= (prng()−0.5) x ejectMass x 10/5; ENERGY −= ejectMass x 20; TEMPERATURE −= boilRate x 0.3.",
  },
  CONDENSE: {
    hint: "Condensation: cool particles gain mass from vapor.",
    explanation: "Confirmed batch-12 (match irl): condensation is exothermic — below temp 0.3 a particle absorbs vapor mass and releases latent heat, so it warms as it grows (clamped below boiling).",
    system: "temp < 0.3: MASS += (0.3−temp) x 0.005 x dt x synergy; TEMPERATURE += (0.3−temp) x 0.01 x dt x synergy (cap 0.9).",
  },
  DEPOSIT: {
    hint: "Deposition: vapor directly solidifies on cold particles.",
    explanation: "Confirmed batch-12 (match irl): deposition (frost) skips the liquid phase and is exothermic — cold particles (temp < 0.2) accrete solid mass 3x faster than condensation, grow visibly (radius), and release latent heat as the frost forms.",
    system: "temp < 0.2: MASS += (0.2−temp) x 0.03 x dt x synergy, RADIUS += (0.2−temp) x 0.005 x dt x synergy, TEMPERATURE += (0.2−temp) x 0.02 x dt x synergy (cap 0.9).",
  },
  EXOTHERMIC: {
    hint: "Exothermic reactions release extra energy.",
    explanation: "Confirmed batch-12 (match irl): exothermic reactions release heat while they run — a bounded steady ENERGY + TEMPERATURE release (replaces the old unbounded ENERGY ×= 1.1 exponential), capped at the 200 energy ceiling and below boiling.",
    system: "ENERGY += 0.05 x dt x synergy (cap 200); TEMPERATURE += 0.01 x dt x synergy (cap 0.9).",
  },
  TIME_DILATION: {
    hint: "Time dilation: gravity slows local time near massive bodies.",
    explanation: "Weak-field gravitational time dilation (v4.6.29): local time slows inside a softened gravitational potential summed over neighbouring masses — clocks run slower beside ACCR stars and SINGULARITY cores and at full speed in empty space. Replaces the old SOUL-gated bullet time with the actual GR mechanism.",
    system: "Φ = Σ mⱼ/(rⱼ+0.5) over the local neighbourhood (capped 24 nearest, self excluded, torus-wrapped distances); localDt = √(1 − clamp(2·Φ·0.001·synergy)), floored at 0.3. localDt scales AGE, oscillator phase and lifecycle time.",
    advanced: "A star-mass neighbour at r≈10 slows time ~11%; SINGULARITY cores approach the floor. Synergises with GRAV/ACCR clustering — dense cores literally age slower.",
  },
  DIMENSIONALITY: {
    hint: "Dimensional drift: random Z-axis motion.",
    explanation: "Confirmed batch-08 (make it stronger): particles receive random Z-axis forces at 3x the old amplitude, visibly exploring 3D space.",
    system: "VEL_Z += (prng()-0.5) x 0.3 x synergy x dt. Prevents particles from settling into pure 2D planes.",
  },
  CHAOS: {
    hint: "Chaos: deterministic Lorenz dynamics — sensitive dependence on initial conditions.",
    explanation: "Replaces stochastic noise with a per-particle Lorenz system (σ=10, ρ=28, β=8/3): every particle integrates the same deterministic 3-variable map, so two nearly-identical particles diverge exponentially (the butterfly effect) and the same seed reproduces the same run.",
    system: "Per-particle state in CHAOS_STATE_X/Y/Z; Euler step x' = x + σ(y−x)·h, y' = y + (x(ρ−z)−y)·h, z' = z + (xy−βz)·h; kick = (x−14)/28·0.5·synergy on X/Y (half on Z); thermal stir ∝ (z−20)/40·0.02·synergy (clamped 0-1). With ORDER on, both run at ×0.3.",
    advanced: "Fully deterministic — no PRNG draws. Map state is seeded from the particle index, so sibling particles visibly diverge from nearly identical starts.",
  },
  ORDER: {
    hint: "Order: velocity alignment, system convergence.",
    explanation: "Confirmed batch-09 (strongly): particles strongly align their velocity with neighbors within ~200 units, creating coherent flow.",
    system: "Vicsek alignment: accel = neighbor velocity x 0.04 x synergy within distSq < 40000 (~200 units). With CHAOS on, both run at x0.3.",
  },
  FATE: {
    hint: "Fate: each species drifts toward its own destiny.",
    explanation: "Confirmed batch-09 (redesign — the old pairwise attraction duplicated AFFINITY): every species has a slowly wandering destiny point it is gently pulled toward, so species migrate and segregate toward their own fate.",
    system: "Destiny point = golden-angle phase per species, drifting on a fate clock (span 0.32 x worldSize). Pull = 0.02 x synergy along the shortest toroidal path. Full-world range.",
  },
  WILL: {
    hint: "Will: self-propulsion along current velocity.",
    explanation: "Particles boost their own velocity in the direction they're already moving.",
    system: "Self-propulsion model. Energy-independent: any particle with velocity gets a boost.",
  },
  SOUL_LAW: {
    hint: "Soul: ethereal energy shared between same-species.",
    explanation: "Confirmed batch-10 (agent decision): SOUL is a conserved shared field — the giver loses what the receiver gains, both capped to [0, 1], and souls decay slowly unless replenished. Keeps TIME_DILATION's 70% max slowdown as the ceiling.",
    system: "Same-species transfer: receiver += soul x 0.001 x synergy, giver -= same (cap 1.0, range ~100 units). Per-particle decay: soul x= 1 - 0.002 x dt x synergy.",
  },
  MIND: {
    hint: "Hivemind: collective consciousness signal boost.",
    explanation: "Confirmed batch-10 (synergies are the interesting part): same-species pairs amplify each other's SIGNAL, and the hivemind is shaped by law synergies — COMMS x1.5, TELEPATHY x2.0, ENERGY x0.5 (drain), POLYMER x0.5 (overhead).",
    system: "signalBoost = 0.01 x synergy / dist for same-species within ~200 units. Synergy: COMMS +1.5x, TELEPATHY +2.0x, ENERGY 0.5x, POLYMER 0.5x.",
  },
  TELEPATHY: {
    hint: "Telepathy: instant information sharing across species.",
    explanation: "Confirmed batch-12 (slight energy drain): same-species particles share SIGNAL instantly regardless of distance, and the receiver pays a slight energy cost per transfer for the shared channel.",
    system: "Same-species pair: receiver SIGNAL += sender SIGNAL x 0.05 x synergy (any distance); receiver ENERGY −= 0.02 x synergy x dt.",
  },
  CLAIRVOYANCE: {
    hint: "Clairvoyance: particles sense future positions.",
    explanation: "Confirmed batch-13 (slight cost): particles steer toward where neighbors will be (3-tick velocity extrapolation) instead of where they are, and sensing the future drains a little energy.",
    system: "Predictive steering: velocity extrapolation targeting; ENERGY −= 0.02 × synergy × dt per prediction (floor 0).",
  },
  PRECOGNITION: {
    hint: "Precognition: collision anticipation and avoidance.",
    explanation: "Confirmed batch-13 (slight cost): when a neighbor is closing in (1-50 units) the particle steers perpendicular to slip past, and anticipating the collision drains a little energy. Reduces collisions at the cost of smoothness.",
    system: "Collision course (dot < 0): lateral avoidance force 0.05 × synergy; ENERGY −= 0.02 × synergy × dt per dodge (floor 0).",
  },
  ASTRAL: {
    hint: "Astral projection: souls leave bodies on death.",
    explanation: "Confirmed batch-13 (expanded): when a particle dies its SOUL persists as a translucent ghost that fades over time. The ghost exerts a soft soul-pull on nearby living particles, and same-species kin receive a conserved sliver of its soul before it dissipates.",
    system: "DEAD=0.5 soul state: ALPHA=soul×0.5, MASS=soul×0.1, SOUL ×= 0.999/tick, removed < 0.001. Ghost pull = soul×0.02×synergy×dt within 80 units; same-species gift = soul×0.002×synergy×dt (conserved, both clamped).",
  },
  REDUCTION: {
    hint: "Reduction: charge is neutralized between particles.",
    explanation: "Confirmed batch-11 (real-life behavior): opposite charges attract and cancel out when they interact — each magnitude shrinks toward zero. Same-sign charges repel, so nothing is neutralized. The mirror of OXIDATION.",
    system: "For opposite-sign pairs: CHARGE −= CHARGE x 0.05 x synergy on both (snap to 0 when the step exceeds the magnitude). Same-sign pairs are untouched.",
  },
  ALLOY: {
    hint: "Alloying: different-species particles fuse into composites.",
    explanation: "Confirmed batch-11 (real-life behavior): two different-species particles that overlap dissolve into one homogeneous composite — full mass merge, per-particle DNA averaged (mass-weighted), colour blended. The survivor keeps its species slot but behaves as the mix.",
    system: "Overlap dist < (r1+r2) x 0.5: MASS = m1+m2, DNA_CACHE = mass-weighted average of both, colours blended, j is marked DEAD. Gated by ALLOY.",
  },
  TIDE: {
    hint: "Tides: massive neighbours stretch and pull at each other.",
    explanation: "Confirmed batch-21: particles feel a tidal force proportional to the mass of nearby massive particles (∝ massJ·k/dist) — a long-range pull that strengthens with mass and weakens slowly with distance.",
    system: "Long-range mass coupling (inverse-distance, reaches further than gravity). With GRAV it produces orbital capture; with SINGULARITY the tidal field deepens around the hole.",
    advanced: "Tidal force uses MASS of both partners; inverse-distance not inverse-square, so it reaches further than gravity.",
  },
  FRICTION: {
    hint: "Friction: velocity-dependent drag slows everything down.",
    explanation: "Confirmed batch-20 (match irl): particles lose velocity proportionally to their current speed, and the removed kinetic energy converts to heat (TEMPERATURE rises) — real friction dissipates motion as heat. Damping scales with VISCOSITY DNA (0.5–1.0): higher viscosity = more damping.",
    system: "damp = k·VISCOSITY; TEMP += speed·damp·0.5 (cap 1). With DRAG the two dampings stack; with COLD it drives fast thermal equilibrium.",
    advanced: "Damping factor per tick is k·VISCOSITY DNA; the kinetic loss appears as temperature.",
  },
  ELASTICITY: {
    hint: "Elasticity: collisions bounce with restitution.",
    explanation: "Confirmed batch-20: overlapping particles are pushed apart with a coefficient of restitution from ELASTICITY DNA (0–1, default 0.5) — real materials bounce less when less elastic. Light particles still bounce harder (inverse combined mass).",
    system: "Overlap push: mag = overlap·k·ELASTICITY/(mI+mJ). With COLL it dominates the impulse; with BOND it competes against forming stable links.",
    advanced: "Restitution factor scales with ELASTICITY DNA and the inverse of combined mass — light particles bounce harder.",
  },
  TURBULENCE: {
    hint: "Turbulence: a noise-driven swirl perturbs every particle.",
    explanation: "Confirmed batch-22: each particle receives a pseudo-random perpendicular kick — a churning flow field. Kicks stay perpendicular to velocity so total kinetic energy is roughly conserved.",
    system: "Vorticity noise (perpendicular pseudo-random kick, k·0.05). With CONVECTION it stirs thermal plumes; with DRAG the flow is damped into eddies.",
    advanced: "Kicks are perpendicular to velocity so total kinetic energy is roughly conserved.",
  },
  CENTRIPETAL: {
    hint: "Centripetal: everything is pulled gently toward the world centre.",
    explanation: "Confirmed batch-22: particles drift toward the centre of the dish with a weak restoring force that grows with distance (∝ distance — harmonic oscillator).",
    system: "Global attractor at world centre (k·0.0005). With PLANETARY it competes against local bodies; with ROTATION it creates orbital shells.",
    advanced: "Force is proportional to distance from centre — harmonic oscillator behaviour.",
  },
  ROTATION: {
    hint: "Rotation: the world spins around its centre.",
    explanation: "Confirmed batch-22: particles feel a tangential force (90° to the radius, ∝ distance from the axis) that sets the whole dish rotating — solid-body rotation.",
    system: "Global rigid-frame swirl (k·0.002). With CENTRIPETAL it forms stable orbits; with TURBULENCE it shears into spiral arms.",
    advanced: "Tangential force scales with distance from the axis — solid-body rotation.",
  },
  SYMBIOSIS: {
    hint: "Symbiosis: different species exchange energy on contact.",
    explanation: "Contact between different species transfers energy from the richer partner to the poorer one, benefiting both.",
    system: "Cross-species mutualism. With AFFINITY it drives mixed-species cliques; with ENERGY it keeps partners alive longer.",
    advanced: "Energy flows only between different species; same-species contacts are unaffected.",
  },
  PARASITE: {
    hint: "Parasite: smaller particles drain energy from larger hosts.",
    explanation: "On contact, a smaller particle siphons energy from a larger one, at a small efficiency loss.",
    system: "Size-based extraction. With PREDATION it escalates to lethal drain; with IMMUNITY hosts resist the drain.",
    advanced: "Drain is proportional to the host's surplus energy; hosts below a floor are not drained.",
  },
  HIBERNATION: {
    hint: "Hibernation: starving particles slow down to preserve energy.",
    explanation: "Low-energy particles damp their own velocity and stop burning energy, effectively sleeping through scarcity.",
    system: "Energy-conservation dormancy. With SENESCENCE it extends lifespan; with ENERGY it prevents starvation death.",
    advanced: "Particles under the energy floor reduce movement but regain energy slowly.",
  },
  IMMUNITY: {
    hint: "Immunity: armour regenerates and drains are resisted.",
    explanation: "Particles slowly rebuild ARMOR and take reduced damage from drains, poisons and radiation.",
    system: "Defensive regen. With PARASITE it halves extraction; with RADIATION it blocks genotypic damage.",
    advanced: "ARMOR regenerates up to a species-scaled cap; excess drain energy is discarded.",
  },
  ELECTROLYSIS: {
    hint: "Electrolysis: charge splits matter apart.",
    explanation: "Charged neighbours drive mass-to-energy conversion, releasing signal and heat as the compound breaks down.",
    system: "Charge-driven decomposition. With ACIDITY it accelerates corrosion; with CURRENT it produces gas-like scatter.",
    advanced: "Requires a charge difference between partners; uses CONDUCTIVITY DNA.",
  },
  PHOTOLYSIS: {
    hint: "Photolysis: light (signal) breaks matter down.",
    explanation: "Particles bathed in strong signal convert some mass into energy — light-powered chemistry.",
    system: "Signal-driven decomposition. With GLOW it makes luminous regions chemically active; with SOLVATION it etches clusters.",
    advanced: "Conversion scales with incoming SIGNAL and CATALYSIS DNA.",
  },
  PRECIPITATION: {
    hint: "Precipitation: dissolved matter condenses into dense clumps.",
    explanation: "Particles in high-density neighbourhoods gain mass and shrink radius, settling into solid clumps.",
    system: "Condensation from saturation. With CRYSTALLIZATION it nucleates crystals; with SOLVATION it fights re-dissolution.",
    advanced: "Uses local density from the spatial grid; clumps become heavier and slower.",
  },
  NEUTRALIZATION: {
    hint: "Neutralization: opposite charges cancel and release heat.",
    explanation: "Contacts between oppositely charged particles reduce both charges and produce thermal energy.",
    system: "Charge annihilation. With CHARGE_LAW it calms electric storms; with HEAT it feeds thermal feedback.",
    advanced: "Heat released is proportional to the product of the two charges.",
  },
  STOICHIOMETRY: {
    hint: "Stoichiometry: mass is conserved in every exchange.",
    explanation: "When mass or energy changes hands, an equal and opposite amount is passed to the partner — no free mass.",
    system: "Balance enforcement. With ACCR it makes mergers exact; with PARASITE it caps extraction at the host's loss.",
    advanced: "Corrects drift so total mass in each pair interaction stays constant.",
  },
  AUTOCATALYSIS: {
    hint: "Autocatalysis: a species catalyses its own reactions.",
    explanation: "Same-species contacts boost each other's energy conversion — the chemistry feeds itself.",
    system: "Self-catalysis. With CATALYSIS_LAW it amplifies reactions; with SYMBIOSIS it rewards same-species cliques.",
    advanced: "Reaction gain is squared for same-species pairs, making species purity advantageous.",
  },
  ADIABATIC: {
    hint: "Adiabatic: motion converts to heat without loss.",
    explanation: "Kinetic energy is converted into TEMPERATURE at constant total energy — compression heats without waste.",
    system: "Lossless KE→heat. With HEAT it seeds thermal noise; with COLD it keeps falling particles warm.",
    advanced: "Total kinetic+thermal energy of the pair is conserved.",
  },
  COMPRESSION: {
    hint: "Compression: particles shrink and heat up under pressure.",
    explanation: "High-pressure (crowded) particles reduce RADIUS and raise TEMPERATURE.",
    system: "Density-driven squeeze. With PRECIPITATION it forms dense cores; with EXPANSION it counteracts.",
    advanced: "Uses neighbourhood pressure from the spatial grid.",
  },
  EXPANSION: {
    hint: "Expansion: particles swell and cool when sparse.",
    explanation: "Isolated particles grow RADIUS and shed TEMPERATURE, drifting apart like cooling gas.",
    system: "Rarefaction cooling. With COMPRESSION it opposes; with TURBULENCE it lets gas fill the dish.",
    advanced: "Expansion is limited by the particle's species base radius.",
  },
  EQUILIBRIUM: {
    hint: "Equilibrium: heat flows from hot to cold neighbours.",
    explanation: "Contacts exchange TEMPERATURE toward the pair's mean — thermal conduction between particles.",
    system: "Neighbour diffusion. With HEAT it spreads warmth; with COLD it equalises chill.",
    advanced: "Exchange rate is symmetric, conserving total temperature.",
  },
  LATENT_HEAT: {
    hint: "Latent heat: phase changes absorb or release energy.",
    explanation: "Mass changes absorb or release TEMPERATURE in bursts, buffering phase transitions.",
    system: "Phase-change buffer. With MELT/BOIL it smooths transitions; with SUBLIMATION it feeds the vapour.",
    advanced: "The buffer uses the pair's combined mass as its capacity.",
  },
  RUNAWAY: {
    hint: "Runaway: hot particles produce more heat.",
    explanation: "TEMPERATURE above a threshold generates additional heat — a positive feedback that can cascade.",
    system: "Thermal feedback. With HEAT it accelerates; with EQUILIBRIUM the cascade is capped by diffusion.",
    advanced: "Gain is quadratic above the threshold — designed to produce flares.",
  },
  CONSCIOUSNESS: {
    hint: "Consciousness: a predictive self-model that attends to prediction error.",
    explanation: "The particle maintains a self-model — a running estimate of its own speed (SELF_MODEL_SPEED). When actual motion deviates from the model (prediction error) it 'attends': MEMORY rises, the error broadcasts as SIGNAL (global-workspace flavour via COMMS/MIND), and attention costs ENERGY. Low error → efficient self-maintenance regen. A computational proxy for predictive processing; consciousness itself is unresolved, so this is an honest approximation.",
    system: "err = |speed − model|; model ← 0.95·model + 0.05·speed. err > 0.3: MEMORY += err·0.02, SIGNAL += err·0.01, ENERGY −= err·0.05. Else ENERGY += 0.01·k. Caps 0..200 / 0..1.",
    advanced: "+MIND broadcasts the workspace; +COMMS carries the signal; +LEARN improves the model by imitation.",
  },
  PERCEPTION: {
    hint: "Perception: awareness extends far beyond touch.",
    explanation: "Particles sense the world at a larger radius, responding to neighbours they could not feel before.",
    system: "Extended sensing range. With TELEPATHY it spans the dish; with TRACK it sharpens pursuit.",
    advanced: "Scales NEIGHBORHOOD_RADIUS DNA; pairs are formed only when both perceive.",
  },
  SYNCHRONICITY: {
    hint: "Synchronicity: meaningful coincidences align the swarm.",
    explanation: "Particles whose SIGNAL phases are similar gently pull their velocities and phases together — resonant alignment.",
    system: "Phase resonance. With PRECOGNITION it anticipates; with COHERENCE it locks motion.",
    advanced: "Coupling strength is proportional to phase agreement.",
  },
  ANTENNA: {
    hint: "Antenna: particles broadcast signal directionally.",
    explanation: "Signaling particles emit a stronger, focused pulse that carries further along their velocity axis.",
    system: "Directive emission. With COMMS it extends range; with SIGNAL_BOOST it amplifies relay.",
    advanced: "Emission gain peaks along the velocity direction and falls off to the sides.",
  },
  SHIELDING: {
    hint: "Shielding: a Faraday cage blocks external EM forces.",
    explanation: "Particles with stored charge resist incoming electric and magnetic forces, trading ENERGY for protection.",
    system: "EM isolation. With CHARGE_LAW it calms storms; with DISCHARGE it prevents stray arcs.",
    advanced: "Shield strength scales with stored CAPACITANCE charge.",
  },
  POLARIZATION: {
    hint: "Polarization: signals are filtered by channel alignment.",
    explanation: "Only signals matching a particle's TUNING channel pass through; mismatched signals are absorbed and decay.",
    system: "Channel filtering. With COMMS it sharpens directed communication; with STIGMERGY it selects trails.",
    advanced: "Uses TUNING_CH1-4 DNA; absorbed signals contribute small ENERGY.",
  },
  NAVIGATION: {
    hint: "Navigation: particles steer toward remembered hotspots.",
    explanation: "Memory-rich regions attract particles — the past becomes a map that guides movement.",
    system: "Memory-gradient following. With HISTORY it reads the global field; with STIGMERGY it follows local trails.",
    advanced: "Attraction uses MEMORY and the HISTORY field when both are on.",
  },
  ENCRYPTION: {
    hint: "Encryption: keyed cipher — only matching keys decode the COMMS channel.",
    explanation: "Derives a per-particle cipher key from TUNING_CH1-4 and scrambles the signal carrier phase; the COMMS exchange only relays intelligible signal between keyholders — mismatched keys absorb the transmission as noise. Replaces the old 'signals last longer' behaviour (persistence was not encryption).",
    system: "key = floor(((TUNING_CH1+TUNING_CH2+TUNING_CH3+TUNING_CH4)/4)·7). applyEncryption rotates PHASE_2 by key/8 and encodes SIGNAL; the pairwise exchange decodes only on matching keys, else damp to noise. Requires COMMS.",
    advanced: "Key drift via MEMORY can rotate keys over time (forward secrecy, future).",
  },
  SUPERPOSITION: {
    hint: "Superposition: a spread of velocity states with Born-rule collapse.",
    explanation: "Each particle stores 4 basis amplitudes (SUPER_AMP_1-4) over 4 candidate velocities. Phases rotate each tick; a collapse event picks one basis state with probability |a|² (Born rule), then renormalises — the actual quantum measurement mechanism in a discrete toy.",
    system: "Amplitudes initialised as a dominant state plus a small spread; each tick SUPER_PHASE rotates the basis; collapse with probability 0.02·k to basis j with p = |aⱼ|²/Σ|a|²; basis offsets: stay, ±perpendicular, boost-along-velocity.",
    advanced: "OBSERVER accelerates collapse; DECOHERENCE damps amplitude spread; ENTANGLEMENT couples two particles' bases.",
  },
  TUNNELING: {
    hint: "Tunneling: particles occasionally pass straight through barriers.",
    explanation: "A small chance each tick lets a particle ignore its interactions and phase-shift a short distance.",
    system: "Barrier penetration. With BOND it can escape stable links; with FERMIONIC it breaks exclusion stacking.",
    advanced: "Chance scales with energy and speed.",
  },
  DECOHERENCE: {
    hint: "Decoherence: quantum spread collapses into classical order.",
    explanation: "Velocity variance is damped each tick and excess energy is radiated as signal — measurement by the world.",
    system: "Wavefunction collapse. With SUPERPOSITION it opposes; with OBSERVER it accelerates collapse.",
    advanced: "Radiation feeds the SIGNAL field, coupling quantum noise to communication.",
  },
  WAVE_PARTICLE: {
    hint: "Wave-particle: observation decides — unmeasured systems spread as waves.",
    explanation: "Duality is now measurement-gated instead of speed-gated: an unobserved particle behaves like a wave (de Broglie spread, λ ∝ 1/p, diffraction-style drift); once measured (collision, or an OBSERVER/high-MEMORY neighbour) it behaves like a localised particle until the measurement flag decays.",
    system: "WAVE_MEASURED flag (set on collision or by OBSERVER neighbours, decays ×0.95/tick). flag > 0.1 → particle mode (accelerate along velocity); else wave mode (perpendicular spread scaled by 1/speed; PLANCK sets the quantum scale).",
    advanced: "No observer → purely wave-like: the honest Copenhagen reading. OBSERVER makes it dual.",
  },
  UNCERTAINTY: {
    hint: "Uncertainty: position and velocity cannot both be known.",
    explanation: "Fast particles jitter position; slow particles get velocity kicks — an irreducible uncertainty tradeoff.",
    system: "Heisenberg-style jitter. With SUPERPOSITION it widens spread; with COHERENCE it fights precision.",
    advanced: "Jitter magnitude is inversely proportional to local time step stability.",
  },
  TELEPORT: {
    hint: "Teleport: quantum state transfer through an entangled link.",
    explanation: "Real quantum teleportation: the particle's state (velocity/energy) is transferred to its entangled partner through a one-tick-delayed classical SIGNAL channel, consuming the link (ENTANGLE_PHASE). The sender collapses to a jittered ground state — no clone remains. Nothing moves through space; the entangled partner adopts the state.",
    system: "Requires ENTANGLE_ID ≥ 0 (ENTANGLEMENT law). Probability 0.002·k per tick: partner adopts velocity/energy, sender velocity randomises ±0.2, sender pays ENERGY (classical channel cost), ENTANGLE_PHASE = 0 (link snaps). No position change.",
    advanced: "Synergies: ENTANGLEMENT creates the links; DECOHERENCE stabilises transfer; OBSERVER measures the outcome.",
  },
  OBSERVER: {
    hint: "Observer: measurement collapses nearby states.",
    explanation: "Particles with high MEMORY act as observers — they damp the spread of nearby particles and copy their state.",
    system: "Measurement collapse. With PERCEPTION the observer radius grows; with DECOHERENCE it accelerates collapse.",
    advanced: "Observed particles lose variance but gain a memory imprint.",
  },
  PLANCK: {
    hint: "Planck: energy moves only in discrete quanta.",
    explanation: "Energy and velocity changes are rounded to fixed quantum steps, quantising all motion.",
    system: "Discrete spectrum. With HEAT it creates thermal bands; with PRECIPITATION it sizes clumps.",
    advanced: "Quantum step is fixed; species MASS changes the visible granularity.",
  },
  COHERENCE: {
    hint: "Coherence: neighbouring particles phase-lock.",
    explanation: "Particles that share similar velocities lock together, damping relative motion and aligning pulses.",
    system: "Phase-locking. With SYNCHRONICITY it aligns signals; with BOSONIC it forms stable clusters.",
    advanced: "Lock strength rises with pair phase agreement; light particles lock fastest.",
  },
  BOSONIC: {
    hint: "Bosonic: force-carriers gather into clusters.",
    explanation: "Particles feel a strong mutual attraction when close, acting like force-carrying bosons that glue matter together.",
    system: "Bose-style clustering. With COHERENCE it forms lattices; with FERMIONIC it competes for space.",
    advanced: "Attraction only inside a short range — glue, not gravity.",
  },
  FERMIONIC: {
    hint: "Fermionic: no two particles share a state.",
    explanation: "Particles resist stacking: overlapping particles push apart so no two occupy the same state.",
    system: "Exclusion principle. With BOSONIC it balances clustering; with COLL it sharpens scattering.",
    advanced: "Push force grows sharply below a species-scaled exclusion radius.",
  },
  SPIN: {
    hint: "Spin: particles carry intrinsic angular momentum.",
    explanation: "Each particle has a small spin phase that produces a perpendicular wiggle, visible as precession.",
    system: "Intrinsic rotation. With ROTATION it couples to the world spin; with MAGNETISM it aligns with fields.",
    advanced: "Spin direction is set by particle index parity; speed scales with ENERGY.",
  },
  SPECTRAL: {
    hint: "Spectral: particles emit characteristic signal lines.",
    explanation: "Each particle emits a weak, species-specific signal tone that marks its identity in the field.",
    system: "Identity radiation. With COMMS it tags conversations; with GENOTYPE it fingerprints lineages.",
    advanced: "Tone depends on SPECIES_ID; amplitude depends on ENERGY.",
  },
  WAVEFUNCTION: {
    hint: "Wavefunction: position is a probability cloud.",
    explanation: "Particle position is blurred — movement is smoothed and positions round to a wave grid, making motion probabilistic.",
    system: "Probability envelope. With UNCERTAINTY it widens; with OBSERVER it collapses.",
    advanced: "Blur is applied at integration time, preserving conservation on average.",
  },
  HYPERPLANE: {
    hint: "Hyperplane: a fourth spatial axis drifts through the dish.",
    explanation: "Particles drift along a hidden axis that slowly tilts, injecting a smooth global shear into the world.",
    system: "Extra-dimensional drift. With DIMENSIONALITY it extends the fold; with ROTATION it twists the plane.",
    advanced: "Shear is uniform and slow — invisible except in long trajectories.",
  },
  ANTIMATTER: {
    hint: "Antimatter: opposites annihilate on contact.",
    explanation: "Contacts between particles of opposite charge parity annihilate both, releasing a burst of energy and signal.",
    system: "Pair annihilation. With ENERGY it converts matter to heat; with SPECTRAL it flashes a bright line.",
    advanced: "Annihilation removes both particles — use carefully.",
  },
};

  return { PARTICLE_STRIDE, DEFAULT_DNA_STRIDE, DNA_PACK_MAX, MAX_SPECIES, MAX_PARTICLES, STAR_MASS, DEFAULT_PARTICLES_PER_SPECIES, WORLD_SIZE, RHO_REF, ADIABATIC_GAMMA_MINUS_ONE, STRIDE_INDEXES, DNA_INDEXES, DNA_COUNT, DNA_META, DNA_RANGES, LAW_INDEXES, LAW_COUNT, LAW_CATEGORIES, LAW_SUBGROUPS, LAW_DEPENDENCIES, LAW_TO_CATEGORY, LAW_COLOR_BY_INDEX, LAW_SPECTRUM, LAW_HUE_BY_INDEX, LAW_HELP_DB };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/state/worldParams.js
// ══════════════════════════════════════════════════════════════════════
__define('src/state/worldParams.js', () => {/**
 * VEPA4 — World parameter state (single source of truth)
 *
 * All sliders in the WORLD panel map 1:1 onto these definitions. The UI
 * (worldPanel.js) renders from WORLD_PARAM_DEFS, the main thread stores the
 * live state via createWorldParams()/applyWorldParam(), and the solver reads
 * the same state through runtimeConfig.worldParams (shared module instance —
 * VEPA runs the solver on the main thread).
 */
const { WORLD_SIZE, MAX_PARTICLES } = __import('src/constants.js');

const WORLD_PARAM_DEFS = [
  // ── SPACE ──
  { key: 'WORLD_SIZE', label: 'WORLD SIZE', min: 50, max: 20000, default: WORLD_SIZE, step: 100, group: 'SPACE', subgroup: 'WORLD' },
  { key: 'GROUND_HEIGHT', label: 'GROUND HEIGHT', min: 0, max: 1, default: 0.9, step: 0.05, group: 'SPACE', subgroup: 'WORLD' },
  { key: 'PARTICLE_COUNT', label: 'PARTICLE COUNT', min: 100, max: 20000, default: 1000, step: 100, group: 'SPACE', subgroup: 'POPULATION' },
  { key: 'INITIAL_POP', label: 'INITIAL POPULATION', min: 10, max: 5000, default: 250, step: 10, group: 'SPACE', subgroup: 'POPULATION' },
  { key: 'MAX_POP', label: 'MAX POPULATION', min: 100, max: 50000, default: 5000, step: 100, group: 'SPACE', subgroup: 'POPULATION' },
  { key: 'SHAPE', label: 'DISTRIBUTION', min: 0, max: 1, default: 0, step: 0.05, group: 'SPACE', subgroup: 'DISTRIBUTION' },
  { key: 'SPAWN_CENTRES', label: 'CENTRES', min: 1, max: 64, default: 1, step: 1, group: 'SPACE', subgroup: 'DISTRIBUTION' },
  { key: 'SPAWN_CENTRE_RANDOM', label: 'CENTRE SCATTER', min: 0, max: 1, default: 0.5, step: 0.05, group: 'SPACE', subgroup: 'DISTRIBUTION' },
  { key: 'SPAWN_CENTRE_BIAS', label: 'CENTRE BIAS', min: 0, max: 1, default: 0, step: 0.05, group: 'SPACE', subgroup: 'DISTRIBUTION' },
  // ── PHYSICS ──
  { key: 'GLOBAL_G', label: 'GRAVITY STRENGTH', min: 0, max: 20, default: 1, step: 1, group: 'PHYSICS', subgroup: 'FORCES' },
  { key: 'WIND', label: 'WIND FORCE', min: 0, max: 5, default: 0, step: 0.5, group: 'PHYSICS', subgroup: 'FORCES' },
  { key: 'DAMPING', label: 'MOTION DAMPING %', min: 0, max: 100, default: 0, step: 1, group: 'PHYSICS', subgroup: 'MOTION' },
  { key: 'VISCOSITY', label: 'GLOBAL VISCOSITY', min: 0.5, max: 1, default: 1, step: 0.01, group: 'PHYSICS', subgroup: 'MOTION' },
  { key: 'ENTROPY', label: 'ENTROPY', min: 0, max: 2, default: 1, step: 0.05, group: 'PHYSICS', subgroup: 'MOTION' },
  { key: 'WALL_REFLECT', label: 'WALL REFLECT', min: 0, max: 2, default: 1, step: 0.05, group: 'PHYSICS', subgroup: 'MOTION' }, // 0 = 100% absorption, 1 = 100% reflect, 2 = 200% reflect
  { key: 'RESONANCE_Q', label: 'RESONANCE Q', min: 1, max: 20, default: 10, step: 1, group: 'PHYSICS', subgroup: 'SIGNAL' }, // resonance bandwidth = 1/Q (law-RRP RESONANCE gate)
  // ── ENVIRONMENT ──
  { key: 'HEAT_CAPACITY', label: 'HEAT CAPACITY', min: 0.1, max: 10, default: 1, step: 0.5, group: 'ENVIRONMENT', subgroup: 'THERMAL' },
  { key: 'LIGHT_LEVEL', label: 'LIGHT LEVEL', min: 0, max: 2, default: 0.5, step: 0.1, group: 'ENVIRONMENT', subgroup: 'THERMAL' },
  { key: 'RADIATION_LEVEL', label: 'RADIATION LEVEL', min: 0, max: 5, default: 1, step: 0.5, group: 'ENVIRONMENT', subgroup: 'THERMAL' },
  { key: 'CRITICAL_TEMP', label: 'CRITICAL TEMP', min: 0.05, max: 0.5, default: 0.2, step: 0.05, group: 'ENVIRONMENT', subgroup: 'THERMAL' }, // T_C shared by SUPERCONDUCTIVITY (unbind above) + BOSONIC (BEC below)
  { key: 'SPAWN_RATE', label: 'REGULAR SPAWN /S', min: 0, max: 100, default: 5, step: 1, group: 'ENVIRONMENT', subgroup: 'POPULATION' },
  // ── BIOLOGY ──
  { key: 'SPECIES_INTERACTION', label: 'SPECIES INTERACTION', min: -2, max: 2, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'INTERACTION' },
  { key: 'ENERGY_TRANSFER', label: 'ENERGY TRANSFER', min: 0, max: 2, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'INTERACTION' },
  { key: 'MUTATION_RATE', label: 'MUTATION RATE', min: 0, max: 5, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'LIFE CYCLE' },
  { key: 'DECAY_RATE', label: 'DECAY RATE', min: 0, max: 2, default: 1, step: 0.05, group: 'BIOLOGY', subgroup: 'LIFE CYCLE' },
];

const DEF_BY_KEY = new Map(WORLD_PARAM_DEFS.map((d) => [d.key, d]));

function clampWorldParam(key, value) {
  const def = DEF_BY_KEY.get(key);
  if (!def) return value;
  let v = Number.isFinite(value) ? value : def.default;
  return Math.min(def.max, Math.max(def.min, v));
}

/** Fresh world-param state (all defaults). */
function createWorldParams() {
  const state = {};
  for (const d of WORLD_PARAM_DEFS) state[d.key] = d.default;
  return state;
}

/** Apply one slider change, clamped to the param's range. Returns new state. */
function applyWorldParam(state, key, value) {
  const def = DEF_BY_KEY.get(key);
  if (!def) return state;
  return { ...state, [key]: clampWorldParam(key, value) };
}

/** Caps enforced when spawning: PARTICLE_COUNT / MAX_POP bound the buffer. */
function spawnCaps(state) {
  return {
    hardCap: Math.min(Math.round(clampWorldParam('PARTICLE_COUNT', state.PARTICLE_COUNT)), MAX_PARTICLES),
    softCap: Math.min(Math.round(clampWorldParam('MAX_POP', state.MAX_POP)), MAX_PARTICLES),
  };
}

function worldParamDef(key) {
  return DEF_BY_KEY.get(key) || null;
}

  return { WORLD_PARAM_DEFS, clampWorldParam, createWorldParams, applyWorldParam, spawnCaps, worldParamDef };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/state/runtimeConfig.js
// ══════════════════════════════════════════════════════════════════════
__define('src/state/runtimeConfig.js', () => {/**
 * VEPA4 — Mutable runtime tunables
 * Shared across modules so settings sliders, goal-engine adjustments, and
 * signal tuning take effect without rebuilds.
 */
const { createWorldParams } = __import('src/state/worldParams.js');

const runtimeConfig = {
  starMass: 12,        // mass threshold for gravitational collapse (star)
  visualScale: 1.0,    // global particle size multiplier
  globalAlpha: 1.0,    // global particle opacity multiplier
  simSpeed: 1.0,       // physics time-step multiplier
  // v4 — goal-engine adjustable knobs (bounded by GoalEngine parameter ranges)
  maxForce: 50.0,      // global force clamp ceiling (solver MAX_FORCE is hard cap)
  forceScale: 1.0,     // global force multiplier applied before clamping
  dragMultiplier: 1.0, // global velocity damping multiplier (0.8–1.0)
  birthRate: 1.0,      // REPRO law synergy multiplier (0.01–1.0)
  deathRate: 1.0,      // LIFE law synergy multiplier (0.01–1.0)
  signalScale: 1.0,    // global communication DNA multiplier
  worldParams: createWorldParams(), // WORLD panel sliders (SPACE/PHYSICS/ENVIRONMENT/BIOLOGY)
};

  return { runtimeConfig };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/state/particleBuffer.js
// ══════════════════════════════════════════════════════════════════════
__define('src/state/particleBuffer.js', () => {const { STRIDE_INDEXES } = __import('src/constants.js');

/**
 * Create a particle storage buffer.
 * Uses SharedArrayBuffer when available (needs COOP/COEP headers);
 * falls back to regular ArrayBuffer for compatibility (e.g. GitHub Pages).
 * @param {number} maxParticles - Maximum number of particles
 * @param {number} stride - Floats per particle (must match PARTICLE_STRIDE)
 * @returns {{ buffer: ArrayBuffer|SharedArrayBuffer, view: Float32Array, isShared: boolean }}
 */
function createParticleBuffer(maxParticles, stride) {
    const byteLength = maxParticles * stride * Float32Array.BYTES_PER_ELEMENT;
    let buffer;
    let isShared = false;
    try {
        buffer = new SharedArrayBuffer(byteLength);
        isShared = true;
    } catch {
        buffer = new ArrayBuffer(byteLength);
    }
    const view = new Float32Array(buffer);
    return { buffer, view, isShared };
}

function getParticle(buffer, index, stride) {
    const view = new Float32Array(buffer);
    const base = index * stride;
    const S = STRIDE_INDEXES;
    return {
        x: view[base + S.POS_X],
        y: view[base + S.POS_Y],
        z: view[base + S.POS_Z],
        vx: view[base + S.VEL_X],
        vy: view[base + S.VEL_Y],
        vz: view[base + S.VEL_Z],
        mass: view[base + S.MASS],
        speciesId: view[base + S.SPECIES_ID],
        energy: view[base + S.ENERGY],
        age: view[base + S.AGE],
        dead: view[base + S.DEAD],
        colorR: view[base + S.COLOR_R],
        colorG: view[base + S.COLOR_G],
        colorB: view[base + S.COLOR_B],
        radius: view[base + S.RADIUS],
        signal: view[base + S.SIGNAL],
        bondCount: view[base + S.BOND_COUNT],
        bondPartner1: view[base + S.BOND_PARTNER_1],
        bondPartner2: view[base + S.BOND_PARTNER_2],
        bondPartner3: view[base + S.BOND_PARTNER_3],
        bondPartner4: view[base + S.BOND_PARTNER_4],
        bondPartner5: view[base + S.BOND_PARTNER_5],
        bondPartner6: view[base + S.BOND_PARTNER_6],
        memory: view[base + S.MEMORY],
        hunger: view[base + S.HUNGER],
        armor: view[base + S.ARMOR],
        electricEnergy: view[base + S.ELECTRIC_ENERGY],
        storedEnergy: view[base + S.STORED_ENERGY],
        reproDrive: view[base + S.REPRO_DRIVE],
        radiationExposure: view[base + S.RADIATION_EXPOSURE],
    };
}

function setParticle(buffer, index, stride, data) {
    const view = new Float32Array(buffer);
    const base = index * stride;
    const S = STRIDE_INDEXES;
    if (data.x !== undefined) view[base + S.POS_X] = data.x;
    if (data.y !== undefined) view[base + S.POS_Y] = data.y;
    if (data.z !== undefined) view[base + S.POS_Z] = data.z;
    if (data.vx !== undefined) view[base + S.VEL_X] = data.vx;
    if (data.vy !== undefined) view[base + S.VEL_Y] = data.vy;
    if (data.vz !== undefined) view[base + S.VEL_Z] = data.vz;
    if (data.mass !== undefined) view[base + S.MASS] = data.mass;
    if (data.speciesId !== undefined) view[base + S.SPECIES_ID] = data.speciesId;
    if (data.energy !== undefined) view[base + S.ENERGY] = data.energy;
    if (data.age !== undefined) view[base + S.AGE] = data.age;
    if (data.dead !== undefined) view[base + S.DEAD] = data.dead;
    if (data.colorR !== undefined) view[base + S.COLOR_R] = data.colorR;
    if (data.colorG !== undefined) view[base + S.COLOR_G] = data.colorG;
    if (data.colorB !== undefined) view[base + S.COLOR_B] = data.colorB;
    if (data.radius !== undefined) view[base + S.RADIUS] = data.radius;
    if (data.signal !== undefined) view[base + S.SIGNAL] = data.signal;
    if (data.bondCount !== undefined) view[base + S.BOND_COUNT] = data.bondCount;
    if (data.bondPartner1 !== undefined) view[base + S.BOND_PARTNER_1] = data.bondPartner1;
    if (data.bondPartner2 !== undefined) view[base + S.BOND_PARTNER_2] = data.bondPartner2;
    if (data.bondPartner3 !== undefined) view[base + S.BOND_PARTNER_3] = data.bondPartner3;
    if (data.bondPartner4 !== undefined) view[base + S.BOND_PARTNER_4] = data.bondPartner4;
    if (data.bondPartner5 !== undefined) view[base + S.BOND_PARTNER_5] = data.bondPartner5;
    if (data.bondPartner6 !== undefined) view[base + S.BOND_PARTNER_6] = data.bondPartner6;
    if (data.memory !== undefined) view[base + S.MEMORY] = data.memory;
    if (data.hunger !== undefined) view[base + S.HUNGER] = data.hunger;
    if (data.armor !== undefined) view[base + S.ARMOR] = data.armor;
    if (data.electricEnergy !== undefined) view[base + S.ELECTRIC_ENERGY] = data.electricEnergy;
    if (data.storedEnergy !== undefined) view[base + S.STORED_ENERGY] = data.storedEnergy;
    if (data.reproDrive !== undefined) view[base + S.REPRO_DRIVE] = data.reproDrive;
    if (data.radiationExposure !== undefined) view[base + S.RADIATION_EXPOSURE] = data.radiationExposure;
}

function getX(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_X];
}
function getY(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_Y];
}
function getZ(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_Z];
}
function setX(buffer, index, stride, value) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_X] = value;
}
function setY(buffer, index, stride, value) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_Y] = value;
}
function setZ(buffer, index, stride, value) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.POS_Z] = value;
}

function getVelocity(buffer, index, stride) {
    const view = new Float32Array(buffer);
    const base = index * stride;
    const S = STRIDE_INDEXES;
    return { vx: view[base + S.VEL_X], vy: view[base + S.VEL_Y], vz: view[base + S.VEL_Z] };
}
function setVelocity(buffer, index, stride, vx, vy, vz) {
    const view = new Float32Array(buffer);
    view[index * stride + STRIDE_INDEXES.VEL_X] = vx;
    view[index * stride + STRIDE_INDEXES.VEL_Y] = vy;
    view[index * stride + STRIDE_INDEXES.VEL_Z] = vz;
}

function getMass(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.MASS];
}
function setMass(buffer, index, stride, mass) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.MASS] = mass;
}

function getSpeciesId(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.SPECIES_ID];
}
function setSpeciesId(buffer, index, stride, id) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.SPECIES_ID] = id;
}

function isAlive(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.DEAD] < 0.5;
}
function kill(buffer, index, stride) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.DEAD] = 1.0;
}

function getEnergy(buffer, index, stride) {
    return new Float32Array(buffer)[index * stride + STRIDE_INDEXES.ENERGY];
}
function setEnergy(buffer, index, stride, energy) {
    new Float32Array(buffer)[index * stride + STRIDE_INDEXES.ENERGY] = energy;
}

function getDNA(buffer, index, stride) {
    const view = new Float32Array(buffer);
    const base = index * stride + STRIDE_INDEXES.DNA_CACHE_START;
    const dna = [];
    for (let i = 0; i < 42; i++) dna.push(view[base + i]);
    return dna;
}
function setDNA(buffer, index, stride, dnaArray) {
    const view = new Float32Array(buffer);
    const base = index * stride + STRIDE_INDEXES.DNA_CACHE_START;
    for (let i = 0; i < 42 && i < dnaArray.length; i++) view[base + i] = dnaArray[i];
}

  return { createParticleBuffer, getParticle, setParticle, getX, getY, getZ, setX, setY, setZ, getVelocity, setVelocity, getMass, setMass, getSpeciesId, setSpeciesId, isAlive, kill, getEnergy, setEnergy, getDNA, setDNA };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/state/lawState.js
// ══════════════════════════════════════════════════════════════════════
__define('src/state/lawState.js', () => {/**
 * 128-law bitmask system using four Uint32Arrays.
 * Laws 0-31 → lowFlags, Laws 32-63 → highFlags, Laws 64-95 → extFlags,
 * Laws 96-127 → quadFlags.
 */

const { LAW_DEPENDENCIES } = __import('src/constants.js');

/**
 * Create a fresh law state with all laws off.
 * @returns {{ lowFlags: Uint32Array, highFlags: Uint32Array, extFlags: Uint32Array, quadFlags: Uint32Array }}
 */
function createLawState() {
    return {
        lowFlags: new Uint32Array(1),
        highFlags: new Uint32Array(1),
        extFlags: new Uint32Array(1),
        quadFlags: new Uint32Array(1),
    };
}

/**
 * Toggle a law on/off by index (0-127).
 */
function toggle(state, lawIndex) {
    if (lawIndex < 32) {
        state.lowFlags[0] ^= (1 << lawIndex);
    } else if (lawIndex < 64) {
        state.highFlags[0] ^= (1 << (lawIndex - 32));
    } else if (lawIndex < 96) {
        state.extFlags[0] ^= (1 << (lawIndex - 64));
    } else {
        state.quadFlags[0] ^= (1 << (lawIndex - 96));
    }
}

/**
 * Turn a law on (no-op if already on).
 */
function set(state, lawIndex) {
    if (lawIndex < 32) {
        state.lowFlags[0] |= (1 << lawIndex);
    } else if (lawIndex < 64) {
        state.highFlags[0] |= (1 << (lawIndex - 32));
    } else if (lawIndex < 96) {
        state.extFlags[0] |= (1 << (lawIndex - 64));
    } else {
        state.quadFlags[0] |= (1 << (lawIndex - 96));
    }
}

/**
 * Turn a law off (no-op if already off).
 */
function clear(state, lawIndex) {
    if (lawIndex < 32) {
        state.lowFlags[0] &= ~(1 << lawIndex);
    } else if (lawIndex < 64) {
        state.highFlags[0] &= ~(1 << (lawIndex - 32));
    } else if (lawIndex < 96) {
        state.extFlags[0] &= ~(1 << (lawIndex - 64));
    } else {
        state.quadFlags[0] &= ~(1 << (lawIndex - 96));
    }
}

/**
 * Check if a law is active.
 * @returns {boolean}
 */
function isSet(state, lawIndex) {
    if (lawIndex < 32) {
        return (state.lowFlags[0] & (1 << lawIndex)) !== 0;
    } else if (lawIndex < 64) {
        return (state.highFlags[0] & (1 << (lawIndex - 32))) !== 0;
    } else if (lawIndex < 96) {
        return (state.extFlags[0] & (1 << (lawIndex - 64))) !== 0;
    } else {
        return (state.quadFlags[0] & (1 << (lawIndex - 96))) !== 0;
    }
}

/**
 * Count how many laws are currently active (popcount).
 * @returns {number}
 */
function getActiveCount(state) {
    return popcount(state.lowFlags[0]) + popcount(state.highFlags[0]) + popcount(state.extFlags[0]) + popcount(state.quadFlags[0]);
}

/**
 * Return a 128-element boolean array representing all law states.
 * @returns {boolean[]}
 */
function getStateVector(state) {
    const vector = new Array(128);
    for (let i = 0; i < 32; i++) {
        vector[i] = (state.lowFlags[0] & (1 << i)) !== 0;
    }
    for (let i = 0; i < 32; i++) {
        vector[32 + i] = (state.highFlags[0] & (1 << i)) !== 0;
    }
    for (let i = 0; i < 32; i++) {
        vector[64 + i] = (state.extFlags[0] & (1 << i)) !== 0;
    }
    for (let i = 0; i < 32; i++) {
        vector[96 + i] = (state.quadFlags[0] & (1 << i)) !== 0;
    }
    return vector;
}

/**
 * Create a law state from a boolean array.
 * @param {boolean[]} vector - Array of at least 128 booleans
 * @returns {{ lowFlags: Uint32Array, highFlags: Uint32Array, extFlags: Uint32Array, quadFlags: Uint32Array }}
 */
function fromVector(vector) {
    const state = createLawState();
    for (let i = 0; i < 128 && i < vector.length; i++) {
        if (!vector[i]) continue;
        if (i < 32) state.lowFlags[0] |= (1 << i);
        else if (i < 64) state.highFlags[0] |= (1 << (i - 32));
        else if (i < 96) state.extFlags[0] |= (1 << (i - 64));
        else state.quadFlags[0] |= (1 << (i - 96));
    }
    return state;
}

/**
 * Serialize to a plain object for persistence (JSON-safe).
 * @returns {{ low: number, high: number, ext: number, quad: number }}
 */
function serialize(state) {
    return {
        low: state.lowFlags[0],
        high: state.highFlags[0],
        ext: state.extFlags[0],
        quad: state.quadFlags[0],
    };
}

/**
 * Restore law state from a serialized form.
 * Accepts legacy { low, high, ext } objects — quad defaults to 0.
 * @param {{ low: number, high: number, ext?: number, quad?: number }} data
 * @returns {{ lowFlags: Uint32Array, highFlags: Uint32Array, extFlags: Uint32Array, quadFlags: Uint32Array }}
 */
function deserialize(data) {
    const state = createLawState();
    state.lowFlags[0] = data.low || 0;
    state.highFlags[0] = data.high || 0;
    state.extFlags[0] = data.ext || 0;
    state.quadFlags[0] = data.quad || 0;
    return state;
}

// ── Internal helpers ──

function popcount(x) {
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    x = (x + (x >>> 4)) & 0x0F0F0F0F;
    x = x + (x >>> 8);
    x = x + (x >>> 16);
    return x & 0x3F;
}

/**
 * List the unmet hard dependencies for a law index (from LAW_DEPENDENCIES).
 * `requires` laws must all be active; `anyOf` needs at least one active.
 * Returns an array of dependency entries (law index + reason) that are NOT
 * satisfied. Soft entries (soft: true) are never gating.
 * @returns {{index: number, reason: string}[]}
 */
function unmetDependencies(state, lawIndex) {
    const dep = LAW_DEPENDENCIES[lawIndex];
    if (!dep || dep.soft) return [];
    const unmet = [];
    const check = (idx) => !isSet(state, idx);
    if (dep.requires) {
        for (const idx of dep.requires) {
            if (check(idx)) unmet.push({ index: idx, reason: dep.reason });
        }
    }
    if (dep.anyOf) {
        const anyActive = dep.anyOf.some((idx) => isSet(state, idx));
        if (!anyActive) unmet.push({ index: dep.anyOf[0], reason: dep.reason });
    }
    return unmet;
}

/**
 * True when every hard dependency of the law is currently satisfied.
 */
function dependenciesSatisfied(state, lawIndex) {
    return unmetDependencies(state, lawIndex).length === 0;
}

  return { createLawState, toggle, set, clear, isSet, getActiveCount, getStateVector, fromVector, serialize, deserialize, unmetDependencies, dependenciesSatisfied };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/spatialGrid.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/spatialGrid.js', () => {// ============================================================================
// VEPA v3 — Spatial Hash Grid
// 12x12x12 partitioning for O(N) neighbor lookups in the N-body simulation.
// ============================================================================

const { WORLD_SIZE } = __import('src/constants.js');

const GRID_DIM = 12;

/**
 * Create an empty spatial grid.
 * @returns {{ cells: number[][], counts: Int32Array, cellSize: number, dim: number }}
 */
function createGrid() {
  const cellSize = WORLD_SIZE / GRID_DIM;
  const totalCells = GRID_DIM * GRID_DIM * GRID_DIM;
  const cells = new Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    cells[i] = [];
  }
  return {
    cells,
    counts: new Int32Array(totalCells),
    cellSize,
    dim: GRID_DIM,
  };
}

/**
 * Clear all cells back to empty.
 */
function clear(grid) {
  for (let i = 0; i < grid.cells.length; i++) {
    grid.cells[i].length = 0;
    grid.counts[i] = 0;
  }
}

/**
 * Map a world coordinate to a cell index (toroidal).
 */
function toCell(coord, cellSize) {
  if (!Number.isFinite(coord) || !Number.isFinite(cellSize) || cellSize <= 0) return 0;
  let c = Math.floor(coord / cellSize);
  c = ((c % GRID_DIM) + GRID_DIM) % GRID_DIM;
  return c;
}

/**
 * Compute flat cell index from 3D grid coordinates.
 */
function cellIndex(cx, cy, cz) {
  return cz * GRID_DIM * GRID_DIM + cy * GRID_DIM + cx;
}

/**
 * Insert a particle into the grid.
 * @param {object} grid - Grid returned by createGrid()
 * @param {number} index - Particle index in the buffer
 * @param {number} px - Particle X position
 * @param {number} py - Particle Y position
 * @param {number} pz - Particle Z position
 * @param {number} worldSize - World size for toroidal wrapping
 */
function insert(grid, index, px, py, pz, worldSize) {
  const cx = toCell(px, grid.cellSize);
  const cy = toCell(py, grid.cellSize);
  const cz = toCell(pz, grid.cellSize);
  const ci = cellIndex(cx, cy, cz);
  const cell = grid.cells[ci];
  if (!cell) return;
  if (cell.length < 100) {
    cell.push(index);
    grid.counts[ci]++;
  }
}

/**
 * Get all neighbor indices from the 27-cell neighborhood.
 * Writes into preallocated output array for zero GC pressure.
 *
 * @param {object} grid
 * @param {number} px - Query particle X
 * @param {number} py - Query particle Y
 * @param {number} pz - Query particle Z
 * @param {number} worldSize
 * @param {number[]} out - Preallocated output array
 * @returns {number} number of neighbors written to out
 */
function getNeighbors(grid, px, py, pz, worldSize, out) {
  const cx = toCell(px, grid.cellSize);
  const cy = toCell(py, grid.cellSize);
  const cz = toCell(pz, grid.cellSize);
  let count = 0;

  for (let dz = -1; dz <= 1; dz++) {
    const nz = ((cz + dz) % GRID_DIM + GRID_DIM) % GRID_DIM;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = ((cy + dy) % GRID_DIM + GRID_DIM) % GRID_DIM;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = ((cx + dx) % GRID_DIM + GRID_DIM) % GRID_DIM;
        const ci = cellIndex(nx, ny, nz);
        const cell = grid.cells[ci];
        if (!cell) continue;
        for (let k = 0; k < cell.length; k++) {
          out[count++] = cell[k];
        }
      }
    }
  }
  return count;
}

  return { GRID_DIM, createGrid, clear, insert, getNeighbors };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/dna/dnaBuffer.js
// ══════════════════════════════════════════════════════════════════════
__define('src/dna/dnaBuffer.js', () => {const { DNA_RANGES, DNA_INDEXES } = __import('src/constants.js');

const SPECIES_COUNT = 64;
const PARAM_COUNT = 64;
const TOTAL = SPECIES_COUNT * PARAM_COUNT;
const PACK_MAX = 65535;

/**
 * Allocate a Uint16Array DNA configuration buffer [64 species × 64 params].
 * @returns {Uint16Array}
 */
function createDNABuffer() {
    return new Uint16Array(TOTAL);
}

/**
 * Get raw uint16 value for a specific species and param index.
 */
function getDNA(buffer, species, param) {
    return buffer[species * PARAM_COUNT + param];
}

/**
 * Set raw uint16 value for a specific species and param index.
 */
function setDNA(buffer, species, param, value) {
    buffer[species * PARAM_COUNT + param] = value;
}

/**
 * Get DNA param as a normalized float in [min, max] range.
 */
function getDNAFloat(buffer, species, param, min, max) {
    const raw = buffer[species * PARAM_COUNT + param];
    return min + (raw / PACK_MAX) * (max - min);
}

/**
 * Set DNA param by quantizing a float in [min, max] to uint16.
 */
function setDNAFloat(buffer, species, param, value, min, max) {
    const clamped = Math.max(min, Math.min(max, value));
    const normalized = (clamped - min) / (max - min);
    buffer[species * PARAM_COUNT + param] = Math.round(normalized * PACK_MAX);
}

/**
 * Get all 64 DNA params for a species as float values using DNA_RANGES.
 * @param {Uint16Array} buffer
 * @param {number} species - Species index (0-63)
 * @returns {number[]} Float array of 64 normalized values
 */
function getSpeciesDNA(buffer, species) {
    const result = new Float32Array(PARAM_COUNT);
    const base = species * PARAM_COUNT;
    for (let i = 0; i < PARAM_COUNT; i++) {
        const raw = buffer[base + i];
        if (i < DNA_RANGES.length) {
            const { min, max } = DNA_RANGES[i];
            result[i] = min + (raw / PACK_MAX) * (max - min);
        } else {
            result[i] = raw / PACK_MAX;
        }
    }
    return result;
}

/**
 * Set all 64 DNA params for a species from a float array using DNA_RANGES.
 * @param {Uint16Array} buffer
 * @param {number} species - Species index (0-63)
 * @param {number[]} dnaArray - Float values (only first PARAM_COUNT are used)
 */
function setSpeciesDNA(buffer, species, dnaArray) {
    const base = species * PARAM_COUNT;
    for (let i = 0; i < PARAM_COUNT; i++) {
        if (i >= dnaArray.length) break;
        if (i < DNA_RANGES.length) {
            const { min, max } = DNA_RANGES[i];
            const clamped = Math.max(min, Math.min(max, dnaArray[i]));
            const normalized = (clamped - min) / (max - min);
            buffer[base + i] = Math.round(normalized * PACK_MAX);
        } else {
            buffer[base + i] = Math.round(Math.max(0, Math.min(1, dnaArray[i])) * PACK_MAX);
        }
    }
}

/**
 * Copy all DNA from one species to another.
 * @param {Uint16Array} buffer
 * @param {number} sourceSpecies
 * @param {number} targetSpecies
 */
function cloneSpecies(buffer, sourceSpecies, targetSpecies) {
    const srcBase = sourceSpecies * PARAM_COUNT;
    const tgtBase = targetSpecies * PARAM_COUNT;
    for (let i = 0; i < PARAM_COUNT; i++) {
        buffer[tgtBase + i] = buffer[srcBase + i];
    }
}

/**
 * Apply mutation to a single DNA param within a range.
 * The mutation shifts the raw uint16 value by a random amount scaled by range.
 * @param {Uint16Array} buffer
 * @param {number} species - Species index
 * @param {number} param - Param index
 * @param {number} range - Maximum mutation magnitude (fraction of full range, 0-1)
 * @param {Function} prng - PRNG function returning float in [0, 1)
 */
function mutateSpecies(buffer, species, param, range, prng) {
    const idx = species * PARAM_COUNT + param;
    const current = buffer[idx];

    // Compute param range for scaling
    let min = 0;
    let max = 1;
    if (param < DNA_RANGES.length) {
        min = DNA_RANGES[param].min;
        max = DNA_RANGES[param].max;
    }
    const paramRange = max - min;

    // Convert current uint16 to float, apply mutation, convert back
    const asFloat = min + (current / PACK_MAX) * paramRange;
    const mutation = (prng() * 2 - 1) * range * paramRange;
    const newFloat = Math.max(min, Math.min(max, asFloat + mutation));
    const normalized = (newFloat - min) / paramRange;
    buffer[idx] = Math.round(normalized * PACK_MAX);
}

/**
 * Load default DNA values from DNA_RANGES into the buffer for all species.
 * @param {Uint16Array} buffer
 * @param {Array<{min: number, max: number, default: number}>} ranges - DNA_RANGES constant
 */
function loadDefaults(buffer, ranges) {
    for (let species = 0; species < SPECIES_COUNT; species++) {
        const base = species * PARAM_COUNT;
        for (let i = 0; i < PARAM_COUNT; i++) {
            if (i < ranges.length) {
                const { min, max, default: def } = ranges[i];
                const clamped = Math.max(min, Math.min(max, def));
                const normalized = (clamped - min) / (max - min);
                buffer[base + i] = Math.round(normalized * PACK_MAX);
            } else {
                buffer[base + i] = Math.round(PACK_MAX / 2);
            }
        }
    }
}

  return { createDNABuffer, getDNA, setDNA, getDNAFloat, setDNAFloat, getSpeciesDNA, setSpeciesDNA, cloneSpecies, mutateSpecies, loadDefaults };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/laws.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/laws.js', () => {// ============================================================================
// VEPA v3 — Law Force Computation
// Per-law force functions for the physics engine. Each function reads from
// the particle buffer and returns force contributions as {ax, ay, az}.
//
// Convention:
//   p1Ptr = subject particle base offset (index * stride)
//   p2Ptr = neighbor particle base offset (index * stride)
//   stride = PARTICLE_STRIDE (100)
//   DNA values accessed via: buffer[p1Ptr + DNA_CACHE_START + DNA_INDEX]
// ============================================================================

const { PARTICLE_STRIDE, STRIDE_INDEXES, DNA_INDEXES, DNA_RANGES, DNA_COUNT, LAW_INDEXES } = __import('src/constants.js');
const { isSet } = __import('src/state/lawState.js');
const { runtimeConfig } = __import('src/state/runtimeConfig.js');
const { getDNAFloat } = __import('src/dna/dnaBuffer.js');

/** Live world-param state (WORLD panel sliders). */
function worldParams() {
  return runtimeConfig.worldParams || {};
}

const S = STRIDE_INDEXES;
const D = DNA_INDEXES;
const DNA_BASE = S.DNA_CACHE_START;

// Polymer chain bond slots (batch 06): the documented "max 6 bonds per
// particle". Not contiguous in the stride (2 legacy slots + 4 appended), so
// iterate this list rather than a numeric range.
const BOND_SLOTS = [
  S.BOND_PARTNER_1, S.BOND_PARTNER_2, S.BOND_PARTNER_3,
  S.BOND_PARTNER_4, S.BOND_PARTNER_5, S.BOND_PARTNER_6,
];

/**
 * Read a species genome param (DNA buffer, 64×64 Uint16) as a float.
 * Genetics params 42-47 live only in the species genome, not the stride cache.
 */
function readSpeciesDNAParam(buf, sp, idx) {
  if (!buf) return 0;
  const raw = buf[sp * 64 + idx];
  if (idx < DNA_RANGES.length) {
    const { min, max } = DNA_RANGES[idx];
    return min + (raw / 65535) * (max - min);
  }
  return raw / 65535;
}

/** Write a float back into the species genome (quantized to uint16). */
function writeSpeciesDNAParam(buf, sp, idx, value) {
  if (!buf) return;
  const r = DNA_RANGES[idx] || { min: -1, max: 1 };
  const clamped = Math.max(r.min, Math.min(r.max, value));
  const normalized = (clamped - r.min) / (r.max - r.min);
  buf[sp * 64 + idx] = Math.round(normalized * 65535);
}

/** HSL → RGB (0-1 channels) — used by PHENOTYPE gene expression. */
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

let buffer_global = null;

// HISTORY law — coarse spatial memory field (12^3 cells), reset per buffer
const HISTORY_DIM = 12;
const HISTORY_DECAY = 0.97;
let historyField = null;
let historyLast = null;
let historyTick = 0;
let historyBufferRef = null;

// SINGULARITY law — collapse threshold (mass units)
const SINGULARITY_MASS = 20;

/**
 * Set the shared particle buffer reference.
 */
function setBuffer(buffer) {
  buffer_global = buffer;
  if (buffer !== historyBufferRef) {
    historyBufferRef = buffer;
    historyField = new Float32Array(HISTORY_DIM * HISTORY_DIM * HISTORY_DIM);
    historyLast = new Uint32Array(HISTORY_DIM * HISTORY_DIM * HISTORY_DIM);
    historyTick = 0;
  }
}

function readDNA(ptr, dnaIndex) {
  return buffer_global[ptr + DNA_BASE + dnaIndex];
}

function clamp(val, lo, hi) {
  if (val < lo) return lo;
  if (val > hi) return hi;
  return val;
}

function nanGuard(val) {
  return (val !== val) ? 0 : val;
}

// ============================================================================
// 1. GRAVITY
// ============================================================================
function applyGravity(p1Ptr, p2Ptr, dx, dy, dz, dist, G) {
  const buf = buffer_global;
  const SOFTENING = 0.5;
  const m1 = readDNA(p1Ptr, D.HIDDEN_MASS) + buf[p1Ptr + S.MASS];
  const m2 = readDNA(p2Ptr, D.HIDDEN_MASS) + buf[p2Ptr + S.MASS];
  const dist2 = dist * dist + SOFTENING;
  let force = G * m1 * m2 / dist2;

  // FORCE DNA (0): pairwise gravity modifier — like signs multiply the pull
  // (both negative invert it into repulsion), opposite signs cancel each
  // other out leaving a gravitationally neutral pair. ±100 range → ±2 cap.
  const forceA = readDNA(p1Ptr, D.FORCE) || 0;
  const forceB = readDNA(p2Ptr, D.FORCE) || 0;
  if (forceA !== 0 || forceB !== 0) {
    const combined = forceA + forceB;
    if (Math.abs(combined) > 0.001) {
      const fScale = Math.max(-2, Math.min(2, combined / 25));
      force *= 1 + Math.abs(fScale) * 0.5;
      if (combined < 0) force = -force;
    } else {
      force = 0; // opposite signs cancel each other out
    }
  }

  // TIDAL DNA (15): differential structural forces — close encounters pull
  // harder (stronger with higher |TIDAL|).
  const tidal = readDNA(p1Ptr, D.TIDAL);
  if (Number.isFinite(tidal) && tidal !== 0) {
    force *= 1 + tidal * 0.5 * Math.max(0, 1 - dist / 100);
  }

  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

// ============================================================================
// 2. DRAG
// ============================================================================
function applyDrag(vx, vy, vz, friction) {
  const damp = 1.0 - clamp(friction, 0, 1);
  return {
    ax: nanGuard(vx * damp - vx),
    ay: nanGuard(vy * damp - vy),
    az: nanGuard(vz * damp - vz),
  };
}

// ============================================================================
// 4. COLLISION
// ============================================================================
function applyCollision(p1Ptr, p2Ptr, stride, dx, dy, dz, dist) {
  const buf = buffer_global;
  const m1 = buf[p1Ptr + S.MASS];
  const m2 = buf[p2Ptr + S.MASS];
  const r1 = buf[p1Ptr + S.RADIUS];
  const r2 = buf[p2Ptr + S.RADIUS];
  const overlap = (r1 + r2) - dist;

  if (overlap <= 0) return { ax: 0, ay: 0, az: 0 };

  const elasticity = readDNA(p1Ptr, D.ELASTICITY);
  const invDist = 1.0 / Math.max(dist, 0.01);
  const nx = dx * invDist;
  const ny = dy * invDist;
  const nz = dz * invDist;

  const dvx = buf[p1Ptr + S.VEL_X] - buf[p2Ptr + S.VEL_X];
  const dvy = buf[p1Ptr + S.VEL_Y] - buf[p2Ptr + S.VEL_Y];
  const dvz = buf[p1Ptr + S.VEL_Z] - buf[p2Ptr + S.VEL_Z];
  const relVelN = dvx * nx + dvy * ny + dvz * nz;

  if (relVelN > 0) return { ax: 0, ay: 0, az: 0 };

  const totalMass = m1 + m2;
  const impulse = -(1 + elasticity) * relVelN / totalMass;

  return {
    ax: nanGuard(impulse * m2 * nx),
    ay: nanGuard(impulse * m2 * ny),
    az: nanGuard(impulse * m2 * nz),
  };
}

// ============================================================================
// 5. ACCRETION
// ============================================================================
function applyAccretion(p1Ptr, p2Ptr, stride, fusion, fusionMomentum) {
  const buf = buffer_global;
  const dx = buf[p2Ptr + S.POS_X] - buf[p1Ptr + S.POS_X];
  const dy = buf[p2Ptr + S.POS_Y] - buf[p1Ptr + S.POS_Y];
  const dz = buf[p2Ptr + S.POS_Z] - buf[p1Ptr + S.POS_Z];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const r1 = buf[p1Ptr + S.RADIUS];
  const r2 = buf[p2Ptr + S.RADIUS];
  const m2 = buf[p2Ptr + S.MASS];

  if (dist < (r1 + r2) * fusion * 0.5) {
    const dvx = buf[p2Ptr + S.VEL_X] - buf[p1Ptr + S.VEL_X];
    const dvy = buf[p2Ptr + S.VEL_Y] - buf[p1Ptr + S.VEL_Y];
    const dvz = buf[p2Ptr + S.VEL_Z] - buf[p1Ptr + S.VEL_Z];
    const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);

    if (relSpeed < fusionMomentum * 2.0) {
      const m1 = buf[p1Ptr + S.MASS];
      const gain = m2 * 0.3;
      // Gene Fusion: blend DNA from consumed particle into survivor
      const dnaBlend = Math.min(1.0, gain / (m1 + 0.001));
      for (let t = 0; t < 42; t++) {
        const pv = buf[p1Ptr + S.DNA_CACHE_START + t] || 0;
        const ov = buf[p2Ptr + S.DNA_CACHE_START + t] || 0;
        buf[p1Ptr + S.DNA_CACHE_START + t] = pv + (ov - pv) * dnaBlend * 0.5;
      }
      // Color blending
      const ratio = gain / (m1 + gain + 0.001);
      buf[p1Ptr + S.COLOR_R] += (buf[p2Ptr + S.COLOR_R] - buf[p1Ptr + S.COLOR_R]) * ratio;
      buf[p1Ptr + S.COLOR_G] += (buf[p2Ptr + S.COLOR_G] - buf[p1Ptr + S.COLOR_G]) * ratio;
      buf[p1Ptr + S.COLOR_B] += (buf[p2Ptr + S.COLOR_B] - buf[p1Ptr + S.COLOR_B]) * ratio;

      buf[p1Ptr + S.MASS] += gain;
      buf[p2Ptr + S.MASS] = m2 - gain;
      if (buf[p2Ptr + S.MASS] <= 0.1) buf[p2Ptr + S.DEAD] = 1.0;
    }
  }
  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 6. TRACKING (Attraction toward same-species neighbors)
// ============================================================================
function applyTracking(p1Ptr, p2Ptr, stride, dx, dy, dz, dist) {
  const buf = buffer_global;
  const s1 = buf[p1Ptr + S.SPECIES_ID];
  const s2 = buf[p2Ptr + S.SPECIES_ID];
  if (s1 !== s2) return { ax: 0, ay: 0, az: 0 };

  const strength = 0.1;
  const invDist = 1.0 / Math.max(dist, 0.01);
  return {
    ax: nanGuard(dx * invDist * strength),
    ay: nanGuard(dy * invDist * strength),
    az: nanGuard(dz * invDist * strength),
  };
}

// ============================================================================
// 6b. PREDATION (Mass-difference based pursuit/flee + gene absorption on contact)
// ============================================================================
function applyPredation(p1Ptr, p2Ptr, stride, dx, dy, dz, dist, prng) {
  const buf = buffer_global;
  // A predator never hunts its own kind (matches TRACK's documented
  // ecosystem behavior — predation is strictly cross-species).
  if (buf[p1Ptr + S.SPECIES_ID] === buf[p2Ptr + S.SPECIES_ID]) {
    return { ax: 0, ay: 0, az: 0 };
  }
  const mass1 = buf[p1Ptr + S.MASS];
  const mass2 = buf[p2Ptr + S.MASS];
  const massDiff = mass1 - mass2;
  if (Math.abs(massDiff) < 0.5) return { ax: 0, ay: 0, az: 0 };

  const r1 = buf[p1Ptr + S.RADIUS];
  const r2 = buf[p2Ptr + S.RADIUS];
  const invDist = 1.0 / Math.max(dist, 0.01);

  if (massDiff > 0.5) {
    // p1 is predator: pursue p2
    const predBias = readDNA(p1Ptr, D.PREDATION_BIAS) || 0;
    const strength = predBias * 0.1 * mass2 * invDist;
    const force = {
      ax: nanGuard(dx * invDist * strength),
      ay: nanGuard(dy * invDist * strength),
      az: nanGuard(dz * invDist * strength),
    };
    // Gene absorption on contact
    if (dist < r1 + r2 && predBias > 0.1) {
      const absorpRate = 0.05;
      const roll = (prng && typeof prng === 'function') ? prng : Math.random;
      for (let t = 0; t < 5; t++) {
        const trait = Math.floor(roll() * 42);
        const preyVal = buf[p2Ptr + S.DNA_CACHE_START + trait] || 0;
        const predVal = buf[p1Ptr + S.DNA_CACHE_START + trait] || 0;
        buf[p1Ptr + S.DNA_CACHE_START + trait] = predVal + (preyVal - predVal) * absorpRate;
      }
      // Mass transfer
      const transfer = Math.min(0.5, mass2 * 0.1);
      buf[p1Ptr + S.MASS] += transfer * 0.5;
      buf[p2Ptr + S.MASS] -= transfer;
    }
    return force;
  } else {
    // p1 is prey: flee from p2
    const jitter = readDNA(p1Ptr, D.JITTER) || 0.1;
    const strength = jitter * 0.2 * invDist;
    return {
      ax: nanGuard(-dx * invDist * strength),
      ay: nanGuard(-dy * invDist * strength),
      az: nanGuard(-dz * invDist * strength),
    };
  }
}

// ============================================================================
// 7. SOLVATION
// ============================================================================
function applySolvation(p1Ptr, p2Ptr, stride, dx, dy, dz, dist, synergy) {
  const buf = buffer_global;
  const charge1 = buf[p1Ptr + S.CHARGE];
  const charge2 = buf[p2Ptr + S.CHARGE];
  if (charge1 === 0 || charge2 === 0) return { ax: 0, ay: 0, az: 0 };

  const strength = 0.05 * Math.abs(charge1 * charge2) * (synergy || 1);
  const invDist = 1.0 / Math.max(dist, 0.01);
  // Real-world solvation (batch-05 confirmation): the solvent pulls
  // opposite-charge ions together and pushes like charges apart — the same
  // Coulomb rule that dissolves salt crystals and keeps ions dispersed.
  const sign = charge1 * charge2 < 0 ? 1 : -1;
  return {
    ax: nanGuard(dx * invDist * strength * sign),
    ay: nanGuard(dy * invDist * strength * sign),
    az: nanGuard(dz * invDist * strength * sign),
  };
}

// ============================================================================
// 8. POLYMERIZATION
// ============================================================================
function applyPolymerization(p1Ptr, p2Ptr, stride, dx, dy, dz, dist) {
  const buf = buffer_global;
  if (dist > 30) return { ax: 0, ay: 0, az: 0 };

  const bondCount = buf[p1Ptr + S.BOND_COUNT];
  if (bondCount >= 6) return { ax: 0, ay: 0, az: 0 };

  if (dist < 15) {
    const partnerSlot = S.BOND_PARTNER_1 + Math.floor(bondCount);
    if (partnerSlot <= S.BOND_PARTNER_2) {
      buf[p1Ptr + partnerSlot] = p2Ptr / stride;
      buf[p1Ptr + S.BOND_COUNT] = bondCount + 1;
    }
  }

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 9. ACIDITY
// ============================================================================
function applyAcidity(p1Ptr, p2Ptr, stride, dt) {
  const buf = buffer_global;
  const charge1 = buf[p1Ptr + S.CHARGE];
  const charge2 = buf[p2Ptr + S.CHARGE];
  const conductivity = readDNA(p1Ptr, D.CONDUCTIVITY);

  if (Math.abs(charge1 - charge2) < 0.1) return { ax: 0, ay: 0, az: 0 };

  const transfer = (charge1 - charge2) * conductivity * dt * 0.1;
  buf[p1Ptr + S.CHARGE] -= transfer;
  buf[p2Ptr + S.CHARGE] += transfer;

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 10. OXIDATION
// ============================================================================
function applyOxidation(p1Ptr, p2Ptr, stride, dt) {
  const buf = buffer_global;
  const charge1 = buf[p1Ptr + S.CHARGE];
  const charge2 = buf[p2Ptr + S.CHARGE];
  const conductivity = readDNA(p1Ptr, D.CONDUCTIVITY);
  const heatOutput = readDNA(p1Ptr, D.HEAT_OUTPUT);

  if (Math.abs(charge1 - charge2) < 0.1) return { ax: 0, ay: 0, az: 0 };

  const transfer = (charge1 - charge2) * conductivity * dt * 0.1;
  buf[p1Ptr + S.CHARGE] -= transfer;
  buf[p2Ptr + S.CHARGE] += transfer;

  const energyRelease = Math.abs(transfer) * heatOutput * 100.0;
  buf[p1Ptr + S.ENERGY] += energyRelease * 0.5;
  buf[p2Ptr + S.ENERGY] += energyRelease * 0.5;
  buf[p1Ptr + S.TEMPERATURE] += energyRelease * 0.01;
  buf[p2Ptr + S.TEMPERATURE] += energyRelease * 0.01;

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 11. HEAT
// ============================================================================
function applyHeat(p1Ptr, stride, dt) {
  const buf = buffer_global;
  const temp = buf[p1Ptr + S.TEMPERATURE];
  const energyEfficiency = readDNA(p1Ptr, D.ENERGY_EFFICIENCY);

  if (temp < 0.01) return { ax: 0, ay: 0, az: 0 };

  const thermalScale = Math.sqrt(temp) * energyEfficiency * dt;
  const t = performance.now();
  const r1 = Math.sin(t * 12.9898 + p1Ptr * 78.233) * 43758.5453;
  const r2 = Math.sin(t * 78.233 + p1Ptr * 12.9898) * 43758.5453;
  const r3 = Math.sin(t * 43.111 + p1Ptr * 34.567) * 43758.5453;
  const n1 = (r1 - Math.floor(r1)) * 2.0 - 1.0;
  const n2 = (r2 - Math.floor(r2)) * 2.0 - 1.0;
  const n3 = (r3 - Math.floor(r3)) * 2.0 - 1.0;

  buf[p1Ptr + S.VEL_X] += n1 * thermalScale;
  buf[p1Ptr + S.VEL_Y] += n2 * thermalScale;
  buf[p1Ptr + S.VEL_Z] += n3 * thermalScale;
  buf[p1Ptr + S.TEMPERATURE] *= 0.99;

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 12. COLD
// ============================================================================
function applyCold(p1Ptr, stride) {
  const buf = buffer_global;
  const temp = buf[p1Ptr + S.TEMPERATURE];

  if (temp >= 0.5) return { ax: 0, ay: 0, az: 0 };

  const coldFactor = 1.0 - (0.5 - temp);
  const damping = clamp(coldFactor, 0.1, 1.0);

  buf[p1Ptr + S.VEL_X] *= damping;
  buf[p1Ptr + S.VEL_Y] *= damping;
  buf[p1Ptr + S.VEL_Z] *= damping;

  for (let offset = S.VEL_X; offset <= S.VEL_Z; offset++) {
    if (buf[p1Ptr + offset] !== buf[p1Ptr + offset]) buf[p1Ptr + offset] = 0;
  }

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 13. GENOTYPE (Radiation field / DNA mutation)
// ============================================================================
function applyGenotype(p1Ptr, stride, dt) {
  const buf = buffer_global;
  const mutationRate = readDNA(p1Ptr, D.MUTATION);
  const temperature = buf[p1Ptr + S.TEMPERATURE];

  if (mutationRate < 0.01) return { ax: 0, ay: 0, az: 0 };

  const mutProb = mutationRate * (1.0 + temperature) * dt * 0.01;
  if (mutProb < 0.001) return { ax: 0, ay: 0, az: 0 };

  const numMutations = Math.floor(mutProb * 3) + 1;
  const dnaStart = DNA_BASE;

  for (let m = 0; m < numMutations; m++) {
    const hashVal = Math.sin(p1Ptr * 127.1 + m * 311.7 + performance.now() * 0.001) * 43758.5453;
    const dnaIdx = Math.abs(Math.floor(hashVal)) % 42;
    const perturbHash = Math.sin(p1Ptr * 269.5 + dnaIdx * 183.3) * 43758.5453;
    const perturb = ((perturbHash - Math.floor(perturbHash)) * 2.0 - 1.0) * mutationRate * 0.05;
    buf[p1Ptr + dnaStart + dnaIdx] += perturb;
  }

  return { ax: 0, ay: 0, az: 0 };
}

// ============================================================================
// 14. PLANETARY (Atmospheric gravity — confirmed batch-02 semantics)
// ============================================================================
// A constant downward force toward the ground plane (z ≈ 0), simulating
// particles that are much smaller than the world and fall through a planet's
// atmosphere. Force is scaled by mass so the resulting acceleration is
// mass-independent — every particle falls at the same rate. Combined with
// GRAV the pull is ×1.5. With WRAP off the soft-wall clamp turns z = 0 into
// the ground; with WRAP on the planet world still falls toward the band.
function applyPlanetary(lawState, view, base, px, py, pz, worldSize, synergy) {
  if (!isSet(lawState, LAW_INDEXES.PLANETARY)) return null; // LAW_INDEXES.PLANETARY = 6

  const mass = view[base + S.MASS] || 1.0;
  const strength = 0.02 * synergy;
  return {
    ax: 0,
    ay: 0,
    az: -strength * mass,
  };
}

// ============================================================================
// 15. LIFE CYCLE
// ============================================================================
function applyLifeCycle(lawState, view, base, dnaParams, dt, prng, synergy, dnaBuffer) {
  if (!isSet(lawState, LAW_INDEXES.LIFE)) return; // LAW_INDEXES.LIFE = 7

  // AGE is advanced by the solver core each tick (frame count), not here.
  const age = view[base + S.AGE];

  let energy = view[base + S.ENERGY];
  const decayRate = 0.01 * (1 - dnaParams[34] * synergy) * (worldParams().DECAY_RATE ?? 1); // ENERGY_EFFICIENCY=34
  energy -= decayRate * dt;
  // Photosynthesis — LIGHT_LEVEL feeds a slow energy subsidy to life.
  energy += 0.02 * (worldParams().LIGHT_LEVEL ?? 0.5) * dt;
  // When the metabolic budget hits 0 the organism dies (confirmed batch-02
  // semantics). This is the LIFE metabolic path only — charge/electromagnetic
  // dynamics live in their own fields and laws and do not trigger it.
  if (energy <= 0) {
    view[base + S.ENERGY] = 0;
    view[base + S.DEAD] = 1.0;
    return;
  }
  view[base + S.ENERGY] = energy;

  let hunger = view[base + S.HUNGER] + dt * 0.02;
  if (hunger > 100) {
    view[base + S.DEAD] = 1.0;
    return;
  }
  view[base + S.HUNGER] = hunger;

  // === BIOLOGICAL VARIANCE ===
  const ageNorm = Math.min(1.0, age / 5000);
  const birthRate = Math.abs(dnaParams[10] || 0.5); // BIRTH_RATE=10
  const mutRate = Math.abs(dnaParams[12] || 0.5); // MUTATION=12

  // Age-based color drift (biological fading)
  view[base + S.COLOR_R] += (Math.sin(age * 0.001) * 2.0 * mutRate);
  view[base + S.COLOR_G] += (Math.cos(age * 0.0007) * 2.0 * mutRate);
  view[base + S.COLOR_B] += (Math.sin(age * 0.0013 + 1.0) * 2.0 * mutRate);

  // Mass fluctuation from metabolism — accretion-style mass gain/loss only
  // while the ACCR law governs it (LIFE alone must not grow/shrink mass).
  if (isSet(lawState, LAW_INDEXES.ACCR)) {
    const mass = view[base + S.MASS] || 1.0;
    const massFluctuation = (energy - 50) * 0.0001 * birthRate;
    view[base + S.MASS] += massFluctuation * dt;
  }

  // Bio-rhythm energy pulse
  const bioPulse = Math.sin(age * 0.01 * birthRate) * 0.5 * mutRate;
  view[base + S.ENERGY] += bioPulse * dt * 0.1;

  // Clamp values
  view[base + S.COLOR_R] = Math.max(0, Math.min(255, view[base + S.COLOR_R] || 0));
  view[base + S.COLOR_G] = Math.max(0, Math.min(255, view[base + S.COLOR_G] || 0));
  view[base + S.COLOR_B] = Math.max(0, Math.min(255, view[base + S.COLOR_B] || 0));
  view[base + S.MASS] = Math.max(0.1, Math.min(50, view[base + S.MASS] || 1));
  // === END BIOLOGICAL VARIANCE ===

  // Senescence (LAW_INDEXES.SENESCENCE = 12)
  if (isSet(lawState, LAW_INDEXES.SENESCENCE)) {
    // TELOMERE_LENGTH (60, genome-only) — longer telomeres resist aging death.
    const telomere = dnaBuffer ? readSpeciesDNAParam(dnaBuffer, view[base + S.SPECIES_ID] || 0, 60) : 0.5;
    const deathRate = dnaParams[11] * 0.001 * (1.0 + ageNorm * 0.5) * (1 - telomere * 0.5);
    if (age > 500 && prng() < deathRate * dt) {
      view[base + S.DEAD] = 1.0;
      return;
    }
  }

  // Radiation damage lives in the standalone RADIATION law (applyRadiationDamage)
  // — applying it here as well would double-drain every irradiated organism.
}

// ============================================================================
// 16. SIGNAL DECAY
// ============================================================================
function applySignalDecay(lawState, view, base, dnaParams, dt) {
  if (!isSet(lawState, LAW_INDEXES.COMMS)) return; // COMMS=52
  // v4 — communication DNA, gated by the COMMS law: oscillator emission + decay.
  const decay = dnaParams[20]; // SIGNAL_DECAY=20 (0.1–0.99)
  const pulseRate = dnaParams[14]; // PULSE_RATE=14 (0–1)
  const strength = dnaParams[19]; // SIGNAL_STRENGTH=19 (0–1)
  const memDecay = dnaParams[40]; // MEMORY_DECAY=40 (0.9–1.0)
  let signal = view[base + S.SIGNAL] || 0;
  signal *= Math.pow(Math.max(0.1, decay), dt);
  const phase = Math.sin((view[base + S.AGE] || 0) * 0.01 * (0.1 + pulseRate));
  if (phase > 0) {
    signal += phase * pulseRate * strength * dt * 0.05 * runtimeConfig.signalScale;
  }
  if (signal > 1) signal = 1;
  if (signal < 0) signal = 0;
  view[base + S.SIGNAL] = signal;
  // Memory trace decays toward zero each tick
  const mem = view[base + S.MEMORY] || 0;
  view[base + S.MEMORY] = mem * Math.pow(memDecay || 0.99, dt);
}

// ============================================================================
// 60. SIGNAL EXCHANGE — channel-filtered pairwise communication
// ============================================================================

/** Channel compatibility: normalized dot product of receiver × sender tuning (TUNING_CH1-4). */
function channelMatch(receiverDna, senderDna) {
  let dot = 0, rMag = 0, sMag = 0;
  for (let c = 0; c < 4; c++) {
    const r = receiverDna[22 + c] || 0;
    const s = senderDna[22 + c] || 0;
    dot += r * s;
    rMag += r * r;
    sMag += s * s;
  }
  if (rMag < 1e-6 || sMag < 1e-6) return 1.0; // untuned channels are open
  return Math.max(0, dot / Math.sqrt(rMag * sMag));
}

/**
 * Pairwise signal propagation. A particle's SIGNAL field radiates toward
 * neighbors within NEIGHBORHOOD_RADIUS; the receiver's SIGNAL_RESP converts
 * delivered signal into attraction force + energy, filtered by TUNING_CH*.
 * @returns {{ax:number,ay:number,az:number}|null} response force (or null)
 */
/** ENCRYPTION key (v4.6.29) — folded from the TUNING_CH1-4 channels. */
function cipherKey(view, base) {
  const d = S.DNA_CACHE_START;
  const sum = (view[base + d + D.TUNING_CH1] || 0)
    + (view[base + d + D.TUNING_CH2] || 0)
    + (view[base + d + D.TUNING_CH3] || 0)
    + (view[base + d + D.TUNING_CH4] || 0);
  return Math.floor(Math.max(0, Math.min(1, sum / 4)) * 7);
}

function applySignalExchange(lawState, view, iBase, jBase, dx, dy, dz, dist, dnaI, dnaJ, dt) {
  if (!isSet(lawState, LAW_INDEXES.COMMS)) return null; // COMMS=52
  const sI = view[iBase + S.SIGNAL] || 0;
  const sJ = view[jBase + S.SIGNAL] || 0;
  if (sI < 0.01 && sJ < 0.01) return null;

  // ENCRYPTION gate (v4.6.29): keyed cipher — only matching keys decode the
  // channel; mismatched keys absorb the transmission as noise.
  if (isSet(lawState, LAW_INDEXES.ENCRYPTION)) {
    if (cipherKey(view, iBase) !== cipherKey(view, jBase)) {
      view[iBase + S.SIGNAL] = Math.max(0, sI - 0.01);
      view[jBase + S.SIGNAL] = Math.max(0, sJ - 0.01);
      return null;
    }
  }

  const nRadius = ((dnaI[18] || 120) + (dnaJ[18] || 120)) * 0.5; // NEIGHBORHOOD_RADIUS
  if (dist > nRadius) return null;

  const respI = dnaI[13] || 0;   // SIGNAL_RESP
  const respJ = dnaJ[13] || 0;
  const strI = dnaI[19] || 0;    // SIGNAL_STRENGTH
  const strJ = dnaJ[19] || 0;
  const propI = dnaI[21] || 0.5; // PROPAGATION_SPEED
  const propJ = dnaJ[21] || 0.5;
  const chI = channelMatch(dnaI, dnaJ); // i receives j
  const chJ = channelMatch(dnaJ, dnaI); // j receives i

  const invDist = 1.0 / Math.max(dist, 0.01);
  const scale = runtimeConfig.signalScale;
  let ax = 0, ay = 0, az = 0;

  // j → i: the receiver gains signal + memory + homing force, the sender
  // pays the emission cost (confirmed batch-14: signalling is no longer a
  // free energy source).
  if (sJ > 0.01 && respI > 0.01) {
    const delivered = sJ * strJ * propI * chI * dt * scale;
    view[iBase + S.SIGNAL] = Math.min(1, (view[iBase + S.SIGNAL] || 0) + delivered);
    view[iBase + S.MEMORY] = (view[iBase + S.MEMORY] || 0) + delivered;
    const eJ = view[jBase + S.ENERGY];
    if (Number.isFinite(eJ)) view[jBase + S.ENERGY] = Math.max(0, eJ - delivered * 0.5);
    const forceMag = respI * delivered * 0.05;
    ax += dx * invDist * forceMag;
    ay += dy * invDist * forceMag;
    az += dz * invDist * forceMag;
  }

  // i → j: symmetric — i pays when j receives.
  if (sI > 0.01 && respJ > 0.01) {
    const delivered = sI * strI * propJ * chJ * dt * scale;
    view[jBase + S.SIGNAL] = Math.min(1, (view[jBase + S.SIGNAL] || 0) + delivered);
    view[jBase + S.MEMORY] = (view[jBase + S.MEMORY] || 0) + delivered;
    const eI = view[iBase + S.ENERGY];
    if (Number.isFinite(eI)) view[iBase + S.ENERGY] = Math.max(0, eI - delivered * 0.5);
    const forceMag = respJ * delivered * 0.05;
    ax -= dx * invDist * forceMag;
    ay -= dy * invDist * forceMag;
    az -= dz * invDist * forceMag;
  }

  if (ax === 0 && ay === 0 && az === 0) return null;
  return { ax: nanGuard(ax), ay: nanGuard(ay), az: nanGuard(az) };
}


// ============================================================================
// 17. AFFINITY
// ============================================================================
function applyAffinity(lawState, view, iBase, jBase, dx, dy, dz, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.AFFINITY)) return null; // AFFINITY=9
  if (distSq < 1) return null;

  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  const affinityI = view[iBase + S.DNA_CACHE_START + 41]; // SPECIES_AFFINITY=41

  if (speciesI === speciesJ) {
    // Same-species cohesion: SPECIES_AFFINITY BOOSTS the attraction — the
    // pull grows with positive affinity and is inert at 0. Xenophobic
    // species (affinity < 0) get no same-species pull at all.
    const strength = 0.1 * Math.max(0, affinityI) * synergy * (worldParams().SPECIES_INTERACTION ?? 1);
    const invDist = 1 / Math.sqrt(distSq);
    return {
      ax: dx * invDist * strength,
      ay: dy * invDist * strength,
      az: dz * invDist * strength,
    };
  }

  if (affinityI < 0) {
    const strength = 0.05 * Math.abs(affinityI) * synergy * (worldParams().SPECIES_INTERACTION ?? 1);
    const invDist = 1 / Math.sqrt(distSq);
    return {
      ax: -dx * invDist * strength,
      ay: -dy * invDist * strength,
      az: -dz * invDist * strength,
    };
  }

  return null;
}

// ============================================================================
// 18. REPRODUCTION
// ============================================================================
function applyReproduction(lawState, view, base, dnaParams, prng, synergy, dnaBuffer, dt) {
  if (!isSet(lawState, LAW_INDEXES.REPRO)) return null; // REPRO=10

  const energy = view[base + S.ENERGY];
  const age = view[base + S.AGE];
  const birthRate = dnaParams[10]; // BIRTH_RATE=10

  // Reproductive drive is its own energy channel (REPRO_DRIVE stride field):
  // it accumulates from BIRTH_RATE over time and gates reproduction — a
  // particle cannot spawn from raw metabolic energy alone. Spawning consumes
  // the drive and half the parent's life energy.
  let drive = view[base + S.REPRO_DRIVE] || 0;
  drive += birthRate * 0.1 * (dt || 1) * synergy;
  if (drive > 100) drive = 100;
  view[base + S.REPRO_DRIVE] = drive;

  if (drive < 60 || age < 100) return null;
  if (prng() > birthRate * synergy * 0.01) return null;

  view[base + S.REPRO_DRIVE] = 0; // spawning consumes the drive
  view[base + S.ENERGY] = energy * 0.5;

  const px = view[base + S.POS_X];
  const py = view[base + S.POS_Y];
  const pz = view[base + S.POS_Z];
  const speciesId = view[base + S.SPECIES_ID];

  // Genetics params (indices 42-47) come from the species DNA buffer,
  // NOT from the per-particle stride cache (which only holds 0-41).
  const dominance = readSpeciesDNAParam(dnaBuffer, speciesId, 42);
  const crossoverRate = readSpeciesDNAParam(dnaBuffer, speciesId, 43);
  const epigeneticDrift = readSpeciesDNAParam(dnaBuffer, speciesId, 44);
  const heterozygosity = readSpeciesDNAParam(dnaBuffer, speciesId, 45);
  const geneFlow = readSpeciesDNAParam(dnaBuffer, speciesId, 46);
  const repressor = readSpeciesDNAParam(dnaBuffer, speciesId, 47);
  // Genetics & regulatory params (48-63, genome-only).
  const alleleCount = readSpeciesDNAParam(dnaBuffer, speciesId, 48);
  const epigeneticRate = readSpeciesDNAParam(dnaBuffer, speciesId, 49);
  const hgtRate = readSpeciesDNAParam(dnaBuffer, speciesId, 50);
  const repairEfficiency = readSpeciesDNAParam(dnaBuffer, speciesId, 51);
  const transposonRate = readSpeciesDNAParam(dnaBuffer, speciesId, 56);
  const geneSilencing = readSpeciesDNAParam(dnaBuffer, speciesId, 57);
  const recombinationBias = readSpeciesDNAParam(dnaBuffer, speciesId, 58);
  const ploidyLevel = readSpeciesDNAParam(dnaBuffer, speciesId, 61);

  const mutationRate = dnaParams[12] * 0.1; // MUTATION=12
  const offspringDna = new Array(DNA_COUNT);

  // --- Genetics: Crossover ---
  // Check BOND_PARTNER_1 for a potential second parent
  const partnerIdx = view[base + S.BOND_PARTNER_1];
  let hasTwoParents = false;
  const partnerDna = new Array(DNA_COUNT);

  // SEX_CHANCE DNA (35): multi-parent reproduction probability — boosts the
  // crossover/second-parent chance above the species CROSSOVER_RATE baseline.
  const sexChance = Math.abs(dnaParams[35] || 0);
  if (partnerIdx >= 0 && prng() < crossoverRate * (1 + sexChance * 0.5)) {
    const partnerBase = partnerIdx * PARTICLE_STRIDE;
    const partnerSpecies = view[partnerBase + S.SPECIES_ID];
    if (partnerSpecies === speciesId) {
      hasTwoParents = true;
      // Read first 42 DNA values from partner's stride cache
      for (let d = 0; d < 42; d++) {
        partnerDna[d] = view[partnerBase + S.DNA_CACHE_START + d];
      }
      // Fill genetics params (42-63) from species DNA buffer
      for (let d = 42; d < DNA_COUNT; d++) {
        partnerDna[d] = readSpeciesDNAParam(dnaBuffer, speciesId, d);
      }
    }
  }

  // --- Build offspring DNA with crossover, dominance, mutation ---
  for (let d = 0; d < DNA_COUNT; d++) {
    let parentA, parentB;

    if (d < 42) {
      // Core traits: use dnaParams (from stride cache)
      parentA = dnaParams[d] || 0;
      parentB = hasTwoParents ? (partnerDna[d] || 0) : parentA;
    } else {
      // Genetics params (42-63): read from species DNA buffer
      parentA = readSpeciesDNAParam(dnaBuffer, speciesId, d);
      parentB = hasTwoParents ? readSpeciesDNAParam(dnaBuffer, speciesId, d) : parentA;
    }

    let val;
    // PLOIDY_LEVEL (default 2) raises recombination; stays neutral at default.
    if (hasTwoParents && prng() < 0.5 + (ploidyLevel - 2) * 0.05) {
      // Sexual reproduction with dominance; ALLELE_COUNT (default 2) widens
      // the blend window; RECOMBINATION_BIAS skews which parent dominates.
      if (prng() < 0.3 + (alleleCount - 2) * 0.05) {
        // Crossover: blend both parents
        val = (parentA + parentB) * 0.5;
      } else if (prng() < Math.max(0, Math.min(1, dominance + recombinationBias * 0.3))) {
        // Dominant: favor higher magnitude
        val = Math.abs(parentA) > Math.abs(parentB) ? parentA : parentB;
      } else {
        // Recessive: favor lower magnitude
        val = Math.abs(parentA) < Math.abs(parentB) ? parentA : parentB;
      }
    } else {
      // Asexual: clone parent
      val = parentA;
    }

    // Apply mutation (scaled by repressor, REPAIR_EFFICIENCY, GENE_SILENCING;
    // TRANSPOSON_RATE amplifies the leap — a mobile-element burst).
    const effectiveMutation = mutationRate * (1 - repressor * 0.5)
      * (1 - repairEfficiency * 0.5)
      * (1 - geneSilencing * 0.3)
      * (1 + transposonRate * 4)
      * (worldParams().MUTATION_RATE ?? 1);
    val += (prng() - 0.5) * effectiveMutation * 10;

    // Apply epigenetic drift (non-heritable noise; EPIGENETIC_RATE scales it)
    val += (prng() - 0.5) * epigeneticDrift * 5 * (1 + epigeneticRate * 3);

    // Gene flow: horizontal transfer from other species (GENE_FLOW + HGT_RATE)
    if (prng() < geneFlow * 0.01 + hgtRate * 0.02) {
      const otherSpecies = Math.floor(prng() * 5) % 64;
      if (otherSpecies !== speciesId) {
        const foreignGene = readSpeciesDNAParam(dnaBuffer, otherSpecies, d);
        val += (foreignGene - val) * 0.1;
      }
    }

    offspringDna[d] = Math.max(-100, Math.min(100, val));
  }

  // Offspring colour = the parents' intermediate colour. Two parents blend
  // 50/50; a single parent clones its own colour, with slight mutation.
  let colorR = view[base + S.COLOR_R];
  let colorG = view[base + S.COLOR_G];
  let colorB = view[base + S.COLOR_B];
  if (hasTwoParents) {
    const partnerBase = partnerIdx * PARTICLE_STRIDE;
    colorR = (colorR + view[partnerBase + S.COLOR_R]) * 0.5;
    colorG = (colorG + view[partnerBase + S.COLOR_G]) * 0.5;
    colorB = (colorB + view[partnerBase + S.COLOR_B]) * 0.5;
  }
  const colorMut = Math.abs(mutationRate) * 12;
  colorR = Math.max(0, Math.min(255, colorR + (prng() - 0.5) * colorMut));
  colorG = Math.max(0, Math.min(255, colorG + (prng() - 0.5) * colorMut));
  colorB = Math.max(0, Math.min(255, colorB + (prng() - 0.5) * colorMut));

  return {
    parentId: Math.floor(base / PARTICLE_STRIDE),
    x: px + (prng() - 0.5) * 20,
    y: py + (prng() - 0.5) * 20,
    z: pz + (prng() - 0.5) * 20,
    vx: 0, vy: 0, vz: 0,
    speciesId,
    mass: view[base + S.MASS] * 0.8,
    energy: 60,
    dna: offspringDna,
    colorR, colorG, colorB,
  };
}

// ============================================================================
// 19. CHEMISTRY MODIFIER
// ============================================================================
// 19. CHEMISTRY MODIFIER
// ============================================================================
function applyChemistry(lawState, view, iBase, jBase, distSq, synergy) {
  let multiplier = 1.0;

  if (isSet(lawState, LAW_INDEXES.CATALYSIS_LAW)) { // CATALYSIS_LAW=17
    const catI = view[iBase + S.DNA_CACHE_START + 38]; // CATALYSIS=38
    multiplier *= 1.0 + catI * 0.5 * synergy;
  }

  if (isSet(lawState, LAW_INDEXES.SOLVATION)) multiplier *= 1.2; // SOLVATION=18

  if (isSet(lawState, LAW_INDEXES.ACIDITY)) { // ACIDITY=19
    const chargeI = view[iBase + S.CHARGE];
    const chargeJ = view[jBase + S.CHARGE];
    const polarity = Math.abs(chargeI - chargeJ);
    multiplier *= 1.0 + polarity * 0.3;
  }

  if (isSet(lawState, LAW_INDEXES.CRYSTALLIZATION) && distSq < 100) { // CRYSTALLIZATION=24
    multiplier *= 1.5;
  }

  return multiplier;
}

// ============================================================================
// 20. POLYMER (bond formation)
// ============================================================================
function applyPolymer(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy, stride) {
  if (!isSet(lawState, LAW_INDEXES.POLYMER)) return { ax: 0, ay: 0, az: 0 };
  if (dist > 25) return { ax: 0, ay: 0, az: 0 };

  // Batch-06 confirmation ("match documentation"): up to 6 bonds per particle
  // (BOND_PARTNER_1..6), tracked mutually — when i chains to j, j chains back
  // to i, so A-B-C topology is stable on both ends.
  const iIdx = Math.round(iBase / stride);
  const jIdx = Math.round(jBase / stride);
  const bondCount = view[iBase + S.BOND_COUNT];
  const jBondCount = view[jBase + S.BOND_COUNT];

  let alreadyBonded = false;
  for (const slot of BOND_SLOTS) {
    if (view[iBase + slot] === jIdx || view[jBase + slot] === iIdx) {
      alreadyBonded = true;
      break;
    }
  }
  // Batch-10: chain bias — polymers prefer extending chains: free/tip
  // particles (0-1 bonds) bond eagerly, well-connected particles (3+) are
  // avoided, so POLYMER grows linear chains instead of cross-linked webs.
  const chainBias = jBondCount <= 1 ? 1.0 : (jBondCount >= 3 ? 0.25 : 0.5);
  if (!alreadyBonded && bondCount < 6 && jBondCount < 6 && dist < 10 * synergy * chainBias) {
    for (const slot of BOND_SLOTS) {
      if (view[iBase + slot] < 0) {
        view[iBase + slot] = jIdx;
        view[iBase + S.BOND_COUNT] = bondCount + 1;
        break;
      }
    }
    for (const slot of BOND_SLOTS) {
      if (view[jBase + slot] < 0) {
        view[jBase + slot] = iIdx;
        view[jBase + S.BOND_COUNT] = jBondCount + 1;
        break;
      }
    }
  }
  // Spring force to maintain polymer chain
  if (dist < 0.1) return { ax: 0, ay: 0, az: 0 };
  const stiffness = 0.02 * synergy;
  const restLen = 4.0;
  const displacement = dist - restLen;
  const forceMag = stiffness * displacement;
  const invDist = 1.0 / dist;
  return {
    ax: dx * invDist * forceMag,
    ay: dy * invDist * forceMag,
    az: dz * invDist * forceMag,
  };
}

// ============================================================================
// 21. HEAT TRANSFER
// ============================================================================
function applyHeatTransfer(lawState, view, iBase, jBase, dist, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.HEAT) && !isSet(lawState, LAW_INDEXES.COLD)) return; // HEAT=25, COLD=26

  const tempI = view[iBase + S.TEMPERATURE];
  const tempJ = view[jBase + S.TEMPERATURE];
  const diff = tempI - tempJ;

  if (isSet(lawState, LAW_INDEXES.HEAT)) {
    const rate = 0.01 * dt * synergy / (worldParams().HEAT_CAPACITY ?? 1);
    view[iBase + S.TEMPERATURE] -= diff * rate;
    view[jBase + S.TEMPERATURE] += diff * rate;
  }

  if (isSet(lawState, LAW_INDEXES.COLD) && tempJ > tempI) {
    const rate = 0.015 * dt * synergy / (worldParams().HEAT_CAPACITY ?? 1);
    const tDec2 = -diff * rate;
    const tInc2 = -diff * rate;
    view[jBase + S.TEMPERATURE] -= (tDec2 !== tDec2) ? 0 : tDec2;
    view[iBase + S.TEMPERATURE] += (tInc2 !== tInc2) ? 0 : tInc2;
  }
}

// ============================================================================
// 21b. THERMAL JITTER (HEAT) — hot particles get kinetic-theory random kicks
// ============================================================================
function applyThermalJitter(lawState, view, base, dt, synergy, prng) {
  if (!isSet(lawState, LAW_INDEXES.HEAT)) return; // HEAT=25
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp) || temp <= 0.5) return;
  const kick = temp * 0.01 * dt * synergy;
  view[base + S.VEL_X] += (prng() - 0.5) * 2 * kick;
  view[base + S.VEL_Y] += (prng() - 0.5) * 2 * kick;
  view[base + S.VEL_Z] += (prng() - 0.5) * 2 * kick;
}

// ============================================================================
// 21c. COLD DAMPING — cold particles (< 0.5 TEMP) are slowed toward stillness
// ============================================================================
function applyColdDamping(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.COLD)) return; // COLD=26
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp) || temp >= 0.5) return;
  const damp = Math.max(0, 1 - (0.5 - temp) * 0.1 * dt * synergy);
  view[base + S.VEL_X] *= damp;
  view[base + S.VEL_Y] *= damp;
  view[base + S.VEL_Z] *= damp;
}

// ============================================================================
// 22. CONVECTION
// ============================================================================
function applyConvection(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.CONVECTION)) return; // CONVECTION=27

  const temp = view[base + S.TEMPERATURE];
  const buoyancy = (temp - 0.5) * 0.001 * dt * synergy;
  if (Number.isFinite(buoyancy)) {
    view[base + S.VEL_Y] += buoyancy;
  }
}

// ============================================================================
// 23. TIME DILATION
// ============================================================================
function applyTimeDilation(lawState, view, base, synergy, neighborList, neighborCount, worldSize) {
  if (!isSet(lawState, LAW_INDEXES.TIME_DILATION)) return 1.0; // TIME_DILATION=30
  // Weak-field gravitational time dilation (v4.6.29): localDt = sqrt(1 - 2*Phi*k),
  // Phi = softened potential summed over the local neighbourhood (grid snapshot).
  // Self is excluded and distances are wrapped across the torus, so clocks run
  // slower beside massive bodies and at full speed in empty space.
  let potential = 0;
  if (neighborList && neighborCount > 0 && worldSize > 0) {
    const px = view[base + S.POS_X];
    const py = view[base + S.POS_Y];
    const pz = view[base + S.POS_Z];
    const half = worldSize * 0.5;
    for (let n = 0; n < neighborCount; n++) {
      const jBase = neighborList[n] * PARTICLE_STRIDE;
      if (jBase === base) continue; // no self-potential
      const dx = wrapDelta((view[jBase + S.POS_X] || 0) - px, worldSize, half);
      const dy = wrapDelta((view[jBase + S.POS_Y] || 0) - py, worldSize, half);
      const dz = wrapDelta((view[jBase + S.POS_Z] || 0) - pz, worldSize, half);
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.5;
      potential += (view[jBase + S.MASS] || 0) / r;
    }
  }
  const phi = potential * 0.001 * synergy;
  const localDt = Math.sqrt(Math.max(0, 1 - 2 * phi));
  return Math.max(0.3, Number.isFinite(localDt) ? localDt : 1.0);
}

/** Signed shortest distance across a toroidal world (worldSize > 0). */
function wrapDelta(d, worldSize, half) {
  let w = d % worldSize;
  if (w > half) w -= worldSize;
  else if (w < -half) w += worldSize;
  return w;
}

// ============================================================================
// 24. DIMENSIONALITY
// ============================================================================
function applyDimensionality(lawState, view, base, prng, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.DIMENSIONALITY)) return 0; // DIMENSIONALITY=31
  // Batch-08 confirmation ("make it stronger"): 0.1 -> 0.3 Z-drift amplitude.
  const force = (prng() - 0.5) * 0.3 * synergy * dt;
  view[base + S.VEL_Z] += force;
  return force;
}

// ============================================================================
// 25. CHAOS
// ============================================================================
function applyChaos(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.CHAOS)) return; // CHAOS=32
  // Deterministic Lorenz system per particle (v4.6.29): every particle
  // integrates the same nonlinear map (sigma=10, rho=28, beta=8/3), so
  // nearly-identical states diverge exponentially (butterfly effect) and
  // the same seed reproduces the same run. No PRNG draws.
  let x = view[base + S.CHAOS_STATE_X] || 0;
  let y = view[base + S.CHAOS_STATE_Y] || 0;
  let z = view[base + S.CHAOS_STATE_Z] || 0;
  if (x === 0 && y === 0 && z === 0) {
    // Deterministic seed from the particle index — sibling particles start
    // nearly-identical and visibly diverge.
    const seed = base / PARTICLE_STRIDE;
    x = 0.1 + (seed % 7) * 0.013;
    y = 0.1 + (seed % 13) * 0.007;
    z = 20 + (seed % 5) * 0.31;
  }
  const step = 0.02 * (dt || 1);
  const dx = 10 * (y - x);
  const dy = x * (28 - z) - y;
  const dz = x * y - (8 / 3) * z;
  const nx = x + dx * step;
  const ny = y + dy * step;
  const nz = z + dz * step;
  view[base + S.CHAOS_STATE_X] = nanGuard(nx);
  view[base + S.CHAOS_STATE_Y] = nanGuard(ny);
  view[base + S.CHAOS_STATE_Z] = nanGuard(nz);

  // Kick from the map output (centred on the attractor core, x ≈ 14).
  const kick = ((nx - 14) / 28) * 0.5 * synergy * (dt || 1);
  view[base + S.VEL_X] += kick;
  view[base + S.VEL_Y] += kick;
  view[base + S.VEL_Z] += kick * 0.5;
  // Thermal stir from z — deterministic, feeds HEAT / PHASE_RADIATION.
  const tempStir = ((nz - 20) / 40) * 0.02 * synergy * (dt || 1);
  const temp = (view[base + S.TEMPERATURE] || 0) + tempStir;
  view[base + S.TEMPERATURE] = Number.isFinite(temp) ? Math.max(0, Math.min(1, temp)) : view[base + S.TEMPERATURE];
}

// ============================================================================
// 26. ORDER
// ============================================================================
function applyOrder(lawState, view, iBase, jBase, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ORDER)) return null; // ORDER=33
  // Batch-09 confirmation ("strongly"): alignment 0.005 -> 0.04, range
  // ~100 -> ~200 units, so coherent flow actually emerges.
  if (distSq > 40000) return null;

  const strength = 0.04 * synergy;
  return {
    ax: view[jBase + S.VEL_X] * strength,
    ay: view[jBase + S.VEL_Y] * strength,
    az: view[jBase + S.VEL_Z] * strength,
  };
}

// ============================================================================
// 27. FATE
// ============================================================================
// Fate (batch-09 redesign — user: "boring and similar to existing laws"):
// the old pairwise same-species attraction duplicated AFFINITY. Now every
// species has a drifting "destiny" point (golden-angle phase per species,
// slowly wandering on a clock) that its members are gently pulled toward —
// species migrate and segregate toward their own fate.
let _fateTime = 0;
function advanceFateClock(dt) { _fateTime += dt; }
function getFateTime() { return _fateTime; }

function applyFate(lawState, view, base, px, py, pz, worldSize, synergy) {
  if (!isSet(lawState, LAW_INDEXES.FATE)) return null; // FATE=34
  const species = view[base + S.SPECIES_ID] || 0;
  const phase = species * 2.39996323; // golden-angle offset, unique per species
  const t = getFateTime() * 0.0004;
  const span = worldSize * 0.32;
  let dx = worldSize * 0.5 + span * Math.sin(t + phase) - px;
  let dy = worldSize * 0.5 + span * Math.cos(t * 0.8 + phase * 1.3) - py;
  let dz = worldSize * 0.5 + span * Math.sin(t * 0.6 + phase * 1.7) - pz;
  // Shortest toroidal path to the destiny point
  if (dx > worldSize * 0.5) dx -= worldSize; else if (dx < -worldSize * 0.5) dx += worldSize;
  if (dy > worldSize * 0.5) dy -= worldSize; else if (dy < -worldSize * 0.5) dy += worldSize;
  if (dz > worldSize * 0.5) dz -= worldSize; else if (dz < -worldSize * 0.5) dz += worldSize;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 1) return { ax: 0, ay: 0, az: 0 };
  const strength = 0.02 * synergy;
  return {
    ax: (dx / dist) * strength,
    ay: (dy / dist) * strength,
    az: (dz / dist) * strength,
  };
}

// ============================================================================
// 28. WILL (Self-propulsion)
// ============================================================================
function applyWill(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.WILL)) return; // WILL=35

  const vx = view[base + S.VEL_X];
  const vy = view[base + S.VEL_Y];
  const vz = view[base + S.VEL_Z];
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (speed < 0.01) return;

  const boost = 0.01 * dt * synergy;
  const boostX = (vx / speed) * boost;
  const boostY = (vy / speed) * boost;
  const boostZ = (vz / speed) * boost;
  if (Number.isFinite(boostX)) view[base + S.VEL_X] += boostX;
  if (Number.isFinite(boostY)) view[base + S.VEL_Y] += boostY;
  if (Number.isFinite(boostZ)) view[base + S.VEL_Z] += boostZ;
}

// ============================================================================
// 29. SOUL
// ============================================================================
function applySoul(lawState, view, iBase, jBase, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.SOUL_LAW)) return; // SOUL_LAW=36
  if (distSq > 10000) return;

  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  if (speciesI !== speciesJ) return;

  const soulJ = view[jBase + S.SOUL];
  const soulI = view[iBase + S.SOUL];
  const transfer = soulJ * 0.001 * synergy;
  if (Number.isFinite(transfer) && transfer > 0) {
    // Batch-10 (agent decision): soul is a conserved shared field — the giver
    // loses what the receiver gains, and both are capped to [0, 1] so
    // TIME_DILATION's 70% max slowdown stays the ceiling.
    view[iBase + S.SOUL] = Math.min(1, soulI + transfer);
    view[jBase + S.SOUL] = Math.max(0, soulJ - transfer);
  }
}

// Soul dissipates slowly when it is not being replenished (batch-10 decision).
function applySoulDecay(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.SOUL_LAW)) return; // SOUL_LAW=36
  const soul = view[base + S.SOUL];
  if (!Number.isFinite(soul) || soul <= 0) return;
  view[base + S.SOUL] = Math.max(0, soul * (1 - 0.002 * dt * synergy));
}

// ============================================================================
// 30. MIND (Collective hivemind)
// ============================================================================
function applyMind(lawState, view, iBase, jBase, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.MIND)) return null; // MIND=37
  if (distSq > 40000) return null;

  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  if (speciesI !== speciesJ) return null;

  const strength = 0.01 * synergy;
  const invDist = 1 / Math.sqrt(distSq);
  return { ax: 0, ay: 0, az: 0, signalBoost: strength * invDist };
}


// ============================================================================
// 31. VOID — Vacuum pressure / cosmological constant
// ============================================================================
function applyVoid(lawState, view, base, px, py, pz, worldSize, synergy) {
  if (!isSet(lawState, LAW_INDEXES.VOID)) return null;
  const cx = worldSize * 0.5;
  const cy = worldSize * 0.5;
  const cz = worldSize * 0.5;
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  const distSq = dx * dx + dy * dy + dz * dz;
  if (distSq < 1) return null;
  // Batch-10 ("yes"): strengthened and dark-energy scaled — the push grows
  // with distance from the centre, opposing gravitational clustering harder
  // at the edges.
  const dist = Math.sqrt(distSq);
  const norm = dist / (worldSize * 0.5);
  const strength = 0.004 * synergy * (0.3 + norm);
  const invDist = 1 / dist;
  return {
    ax: dx * invDist * strength,
    ay: dy * invDist * strength,
    az: dz * invDist * strength,
  };
}

// ============================================================================
// 32. BOND — Spring-like molecular bonding
// ============================================================================
// Clear a bilateral bond between i and j if one exists.
function breakBondPair(view, iBase, jBase, stride) {
  const jIdx = jBase / stride;
  const iIdx = iBase / stride;
  for (const slot of BOND_SLOTS) {
    if (view[iBase + slot] === jIdx) {
      view[iBase + slot] = -1;
      view[iBase + S.BOND_COUNT] = Math.max(0, view[iBase + S.BOND_COUNT] - 1);
      break;
    }
  }
  for (const slot of BOND_SLOTS) {
    if (view[jBase + slot] === iIdx) {
      view[jBase + slot] = -1;
      view[jBase + S.BOND_COUNT] = Math.max(0, view[jBase + S.BOND_COUNT] - 1);
      break;
    }
  }
}

function applyBond(lawState, view, iBase, jBase, stride, dx, dy, dz, dist, synergy, nCount) {
  if (!isSet(lawState, LAW_INDEXES.BOND)) return null;
  // Batch-10: molecular bonds prefer dense neighbourhoods — places with more
  // neighbours to bond to — instead of chain ends (that is POLYMER's job).
  const densityBoost = Math.min(2.0, 1 + (nCount || 0) * 0.05);
  if (dist < 0.1) return null;
  const stiffness = view[iBase + S.DNA_CACHE_START + 8]; // STIFFNESS
  if (!Number.isFinite(stiffness) || stiffness < 0.01) return null;
  // Edge-to-edge rest length: particles touch at their radii
  const r1 = view[iBase + S.RADIUS];
  const r2 = view[jBase + S.RADIUS];
  if (!Number.isFinite(r1) || !Number.isFinite(r2)) return null;
  const restLength = (r1 + r2) * 1.1; // slight buffer to avoid overlap
  // Molecular bonds are short-range: they form within ~2x the rest length
  // (extended by local density) and break when stretched beyond that, instead
  // of holding forever.
  const bondRange = restLength * 2 * densityBoost;
  if (dist > bondRange) {
    breakBondPair(view, iBase, jBase, stride);
    return null;
  }
  // Spring force: F = -k * (dist - restLength); denser neighbourhoods bond harder
  const displacement = dist - restLength;
  const forceMag = stiffness * displacement * 0.05 * synergy * densityBoost;
  const invDist = 1.0 / Math.max(dist, 0.01);
  const fx = dx * invDist * forceMag;
  const fy = dy * invDist * forceMag;
  const fz = dz * invDist * forceMag;
  if (!Number.isFinite(fx)) return null;
  // Register bond bilaterally across all 6 shared slots (consistent with POLYMER)
  const jIdx = jBase / stride;
  const iIdx = iBase / stride;
  for (const slot of BOND_SLOTS) {
    if (view[iBase + slot] === jIdx || view[jBase + slot] === iIdx) {
      return { ax: fx, ay: fy, az: fz };
    }
  }
  if (view[iBase + S.BOND_COUNT] < 6 && view[jBase + S.BOND_COUNT] < 6) {
    for (const slot of BOND_SLOTS) {
      if (view[iBase + slot] < 0) {
        view[iBase + slot] = jIdx;
        view[iBase + S.BOND_COUNT] += 1;
        break;
      }
    }
    for (const slot of BOND_SLOTS) {
      if (view[jBase + slot] < 0) {
        view[jBase + slot] = iIdx;
        view[jBase + S.BOND_COUNT] += 1;
        break;
      }
    }
  }
  return { ax: fx, ay: fy, az: fz };
}

// ============================================================================
// 33. REDUCTION — Charge neutralization
// ============================================================================
function applyReduction(b1Ptr, b2Ptr, stride, synergy) {
  const buf = buffer_global;
  const charge1 = buf[b1Ptr + S.CHARGE];
  const charge2 = buf[b2Ptr + S.CHARGE];
  if (!Number.isFinite(charge1) || !Number.isFinite(charge2)) return;
  // Real-life reduction: opposite charges attract and cancel out when they
  // interact; same-sign charges repel, so nothing gets neutralized.
  if (charge1 * charge2 >= 0) return;
  const rate = 0.05 * synergy;
  const d1 = charge1 * rate;
  const d2 = charge2 * rate;
  buf[b1Ptr + S.CHARGE] = Math.abs(charge1) <= Math.abs(d1) ? 0 : charge1 - d1;
  buf[b2Ptr + S.CHARGE] = Math.abs(charge2) <= Math.abs(d2) ? 0 : charge2 - d2;
}

// ============================================================================
// 34. ALLOY — Cross-species fusion
// ============================================================================
function applyAlloy(lawState, view, iBase, jBase, stride, dist, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ALLOY)) return;
  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  if (speciesI === speciesJ) return;
  const r1 = view[iBase + S.RADIUS];
  const r2 = view[jBase + S.RADIUS];
  if (dist > (r1 + r2) * 0.5) return;
  // Real-life alloying: the two materials dissolve into one homogeneous
  // composite — full mass merge, DNA averaged (hybrid composition), colour
  // blended. The survivor keeps its species slot but behaves as the mix.
  const m1 = view[iBase + S.MASS];
  const m2 = view[jBase + S.MASS];
  const total = m1 + m2;
  const w2 = total > 0 ? m2 / total : 0.5;
  view[iBase + S.MASS] = total;
  view[jBase + S.DEAD] = 1.0;
  for (let d = 0; d < 42; d++) {
    const a = view[iBase + S.DNA_CACHE_START + d];
    const b = view[jBase + S.DNA_CACHE_START + d];
    if (Number.isFinite(a) && Number.isFinite(b)) {
      view[iBase + S.DNA_CACHE_START + d] = a + (b - a) * w2;
    }
  }
  view[iBase + S.COLOR_R] = (view[iBase + S.COLOR_R] + view[jBase + S.COLOR_R]) * 0.5;
  view[iBase + S.COLOR_G] = (view[iBase + S.COLOR_G] + view[jBase + S.COLOR_G]) * 0.5;
  view[iBase + S.COLOR_B] = (view[iBase + S.COLOR_B] + view[jBase + S.COLOR_B]) * 0.5;
}

// ============================================================================
// 35. MELT — High temp particles lose mass
// ============================================================================
function applyMelt(lawState, view, base, dt, synergy, dnaBuffer) {
  if (!isSet(lawState, LAW_INDEXES.MELT)) return;
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp)) return;
  const stiffness = view[base + S.DNA_CACHE_START + D.STIFFNESS];
  if (!Number.isFinite(stiffness)) return;
  const speciesId = view[base + S.SPECIES_ID];
  const range = DNA_RANGES[D.STIFFNESS] || { min: 0.1, max: 5, default: 1 };
  const baseline = dnaBuffer && dnaBuffer.length
    ? getDNAFloat(dnaBuffer, speciesId, D.STIFFNESS, range.min, range.max)
    : (stiffness > 0 ? stiffness : range.default);
  if (temp >= 0.7) {
    // Melt (per HELP_DB): heat softens the particle — effective stiffness
    // decays toward a 20% floor while hot. Real melting loses rigidity, not
    // mass, and it is reversible below the melt point.
    const floor = baseline * 0.2;
    const rate = (temp - 0.7) * 0.02 * dt * synergy;
    view[base + S.DNA_CACHE_START + D.STIFFNESS] = Math.max(floor, stiffness - rate);
  } else if (stiffness < baseline - 1e-6) {
    // Re-solidify: stiffness recovers toward the species baseline.
    view[base + S.DNA_CACHE_START + D.STIFFNESS] = Math.min(baseline, stiffness + 0.005 * dt * synergy);
  }
}

// ============================================================================
// 36. BOIL — Very hot particles eject mass as energetic vapor
// ============================================================================
function applyBoil(lawState, view, base, dt, synergy, prng) {
  if (!isSet(lawState, LAW_INDEXES.BOIL)) return;
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp) || temp < 0.9) return;
  const mass = view[base + S.MASS];
  const boilRate = (temp - 0.9) * 0.02 * dt * synergy;
  const ejectMass = mass * boilRate;
  if (ejectMass > 0.01) {
    // Boil: vaporizing mass is energetic — the ejected fraction becomes
    // kinetic energy and costs latent heat (ENERGY), with a mass floor so
    // particles never boil away completely.
    view[base + S.MASS] = Math.max(0.02, mass - ejectMass);
    const rnd = prng || Math.random;
    view[base + S.VEL_X] += (rnd() - 0.5) * ejectMass * 10;
    view[base + S.VEL_Y] += (rnd() - 0.5) * ejectMass * 10;
    view[base + S.VEL_Z] += (rnd() - 0.5) * ejectMass * 5;
    view[base + S.ENERGY] = Math.max(0, (view[base + S.ENERGY] || 0) - ejectMass * 20);
    view[base + S.TEMPERATURE] -= boilRate * 0.3;
  }
}

// ============================================================================
// 37. CONDENSE — Cool particles gain mass
// ============================================================================
function applyCondense(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.CONDENSE)) return;
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp) || temp > 0.3) return;
  const mass = view[base + S.MASS];
  const condenseRate = (0.3 - temp) * 0.005 * dt * synergy;
  view[base + S.MASS] = mass + condenseRate;
  // Real-life condensation releases latent heat — the particle warms as it
  // gains vapor mass (clamped so it can't cross into boiling).
  view[base + S.TEMPERATURE] = Math.min(0.9, temp + condenseRate * 2);
}

// ============================================================================
// 38. DEPOSIT — Gas directly solidifies on cold particles
// ============================================================================
function applyDeposit(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.DEPOSIT)) return;
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(temp) || temp > 0.2) return;
  const mass = view[base + S.MASS];
  const depositRate = (0.2 - temp) * 0.01 * dt * synergy;
  view[base + S.MASS] = mass + depositRate * 3;
  view[base + S.RADIUS] = view[base + S.RADIUS] + depositRate * 0.5;
  // Real-life deposition (frost) is exothermic — it skips the liquid phase,
  // builds solid mass fast, and releases latent heat as it forms.
  view[base + S.TEMPERATURE] = Math.min(0.9, temp + depositRate * 2);
}

// ============================================================================
// 39. EXOTHERMIC — Energy amplification for all reactions
// ============================================================================
function applyExothermic(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.EXOTHERMIC)) return;
  const energy = view[base + S.ENERGY];
  const temp = view[base + S.TEMPERATURE];
  if (!Number.isFinite(energy) || !Number.isFinite(temp)) return;
  // Real-life exothermic reactions release heat while the reaction runs —
  // a bounded steady release (the old ENERGY ×= 1.1 was an unbounded
  // exponential). Capped at the ENERGY ceiling and below boiling.
  view[base + S.ENERGY] = Math.min(200, energy + 0.05 * synergy * dt);
  view[base + S.TEMPERATURE] = Math.min(0.9, temp + 0.01 * synergy * dt);
}

// ============================================================================
// 40. TELEPATHY — Instant signal sharing within species
// ============================================================================
function applyTelepathy(lawState, view, iBase, jBase, distSq, synergy, dt) {
  if (!isSet(lawState, LAW_INDEXES.TELEPATHY)) return null;
  const speciesI = view[iBase + S.SPECIES_ID];
  const speciesJ = view[jBase + S.SPECIES_ID];
  if (speciesI !== speciesJ) return null;
  const signalJ = view[jBase + S.SIGNAL];
  if (!Number.isFinite(signalJ)) return null;
  const transfer = signalJ * 0.05 * synergy;
  if (transfer > 0.001) {
    view[iBase + S.SIGNAL] += transfer;
    // The receiver pays a slight energy cost for the shared channel.
    const energy = view[iBase + S.ENERGY];
    if (Number.isFinite(energy)) {
      view[iBase + S.ENERGY] = Math.max(0, energy - 0.02 * synergy * (dt || 1));
    }
  }
  return null;
}

// ============================================================================
// 41. CLAIRVOYANCE — Predictive steering toward future positions
// ============================================================================
function applyClairvoyance(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy, dt) {
  if (!isSet(lawState, LAW_INDEXES.CLAIRVOYANCE)) return null;
  if (dist < 1) return null;
  // Predict where neighbor will be based on its velocity
  const vx_j = view[jBase + S.VEL_X];
  const vy_j = view[jBase + S.VEL_Y];
  const vz_j = view[jBase + S.VEL_Z];
  const predDx = (dx + vx_j * 3) - dx;
  const predDy = (dy + vy_j * 3) - dy;
  const predDz = (dz + vz_j * 3) - dz;
  const strength = 0.02 * synergy;
  const invDist = 1.0 / dist;
  // Sensing the future costs a little energy (confirmed batch-13).
  const energy = view[iBase + S.ENERGY];
  if (Number.isFinite(energy)) {
    view[iBase + S.ENERGY] = Math.max(0, energy - 0.02 * synergy * (dt || 1));
  }
  return {
    ax: predDx * invDist * strength,
    ay: predDy * invDist * strength,
    az: predDz * invDist * strength,
  };
}

// ============================================================================
// 42. PRECOGNITION — Collision anticipation and avoidance
// ============================================================================
function applyPrecognition(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy, dt) {
  if (!isSet(lawState, LAW_INDEXES.PRECOGNITION)) return null;
  if (dist < 1 || dist > 50) return null;
  // Check if on collision course
  const vx_i = view[iBase + S.VEL_X];
  const vy_i = view[iBase + S.VEL_Y];
  const vz_i = view[iBase + S.VEL_Z];
  const relVx = view[jBase + S.VEL_X] - vx_i;
  const relVy = view[jBase + S.VEL_Y] - vy_i;
  const relVz = view[jBase + S.VEL_Z] - vz_i;
  const dot = dx * relVx + dy * relVy + dz * relVz;
  if (dot > 0) return null; // Moving apart
  const strength = 0.05 * synergy;
  const invDist = 1.0 / dist;
  // Anticipating the collision costs a little energy (confirmed batch-13).
  const energy = view[iBase + S.ENERGY];
  if (Number.isFinite(energy)) {
    view[iBase + S.ENERGY] = Math.max(0, energy - 0.02 * synergy * (dt || 1));
  }
  // Avoid by steering perpendicular to approach
  return {
    ax: -(dy * invDist) * strength,
    ay: (dx * invDist) * strength,
    az: 0,
  };
}

// ============================================================================
// 43. ASTRAL — Soul persists as ghost after death
// ============================================================================
function applyAstral(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ASTRAL)) return;
  if (view[base + S.DEAD] < 0.5) return; // Only affects dead/soul particles
  const soul = view[base + S.SOUL];
  if (!Number.isFinite(soul) || soul < 0.01) return;
  // Ghost persists, gradually fading
  view[base + S.ALPHA] = soul * 0.5;
  view[base + S.MASS] = soul * 0.1;
  // Ghost forces nearby living particles
  view[base + S.SOUL] *= 0.999;
  if (view[base + S.SOUL] < 0.001) {
    view[base + S.DEAD] = 1.0; // Fully dead, remove
  }
}

/**
 * ASTRAL ghost influence on one living neighbour (called from the solver's
 * soul pass over the spatial grid): the ghost exerts a soft soul-pull on the
 * living, and same-species kin receive a sliver of its soul before it fades
 * away (soul is conserved, matching SOUL_LAW's transfer semantics).
 */
function applyAstralInfluence(lawState, view, ghostBase, livingBase, dx, dy, dz, dist, synergy, dt) {
  if (!isSet(lawState, LAW_INDEXES.ASTRAL)) return;
  const soul = view[ghostBase + S.SOUL];
  if (!Number.isFinite(soul) || soul < 0.01) return;
  const invDist = 1.0 / Math.max(dist, 0.01);
  const step = (dt || 1);
  // Soft soul-pull: the living drift gently toward the ghost (dx points
  // ghost → living, so negate it).
  const pull = soul * 0.02 * synergy * step;
  view[livingBase + S.VEL_X] -= dx * invDist * pull;
  view[livingBase + S.VEL_Y] -= dy * invDist * pull;
  view[livingBase + S.VEL_Z] -= dz * invDist * pull;
  // Same-species blessing: a conserved sliver of soul passes to living kin.
  if (view[ghostBase + S.SPECIES_ID] === view[livingBase + S.SPECIES_ID]) {
    const gift = soul * 0.002 * synergy * step;
    view[ghostBase + S.SOUL] = Math.max(0, soul - gift);
    view[livingBase + S.SOUL] = Math.min(1, (view[livingBase + S.SOUL] || 0) + gift);
  }
}


// ============================================================================
// 44. GLOW — Signal emission produces visual brightness
// ============================================================================
function applyGlowEffect(lawState, view, base, dnaParams, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.GLOW)) return;

  // GLOW emits signal pulses only (confirmed batch-04 correction): an
  // oscillator raises the particle's SIGNAL — its transmission strength —
  // when the phase is positive. With COMMS active the pulse propagates to
  // neighbours. GLOW does NOT convert signal into life energy: signal
  // (SIGNAL) and metabolism (ENERGY) are separate channels.
  const pulseRate = dnaParams[14] || 0.2;   // PULSE_RATE
  const strength = dnaParams[19] || 0.5;    // SIGNAL_STRENGTH
  const age = view[base + S.AGE] || 0;
  const signal = view[base + S.SIGNAL] || 0;

  const phase = Math.sin(age * 0.01 * (0.1 + pulseRate));
  if (phase > 0) {
    view[base + S.SIGNAL] = Math.max(0, signal + phase * pulseRate * strength * dt * 0.05 * synergy);
  }
}

// ============================================================================
// 45. ENERGY — Energy conduction between adjacent particles
// ============================================================================
// The ENERGY law balances every energy reservoir pairwise toward equilibrium:
// LIFE energy (ENERGY), ELECTRIC_ENERGY and STORED_ENERGY each conduct
// independently between neighbouring particles. SIGNAL (transmission
// strength) and REPRO_DRIVE (drive meter) are not energy reservoirs and are
// intentionally left untouched. Confirmed batch-04 interpretation of "what
// energy": all of them.
const ENERGY_CHANNELS = [S.ENERGY, S.ELECTRIC_ENERGY, S.STORED_ENERGY];

function applyEnergyTransfer(lawState, view, iBase, jBase, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ENERGY)) return null;
  if (distSq > 40000) return null;
  const rate = 0.005 * synergy * (worldParams().ENERGY_TRANSFER ?? 1);
  for (const ch of ENERGY_CHANNELS) {
    const energyI = view[iBase + ch];
    const energyJ = view[jBase + ch];
    if (!Number.isFinite(energyI) || !Number.isFinite(energyJ)) continue;
    const diff = energyJ - energyI;
    if (Math.abs(diff) < 0.1) continue;
    const transfer = diff * rate;
    view[iBase + ch] += transfer;
    view[jBase + ch] -= transfer;
  }
  return null;
}

// ============================================================================
// 46. RADIATION — Ambient radiation damages low-armor particles
// ============================================================================
function applyRadiationDamage(lawState, view, base, dt, synergy, prng) {
  if (!isSet(lawState, LAW_INDEXES.RADIATION)) return;

  const armor = view[base + S.ARMOR];
  const energy = view[base + S.ENERGY];
  if (!Number.isFinite(armor) || !Number.isFinite(energy)) return;

  // The RADIATION_LEVEL slider scales the damage (confirmed batch-04 spec).
  const level = Number.isFinite(worldParams().RADIATION_LEVEL) ? worldParams().RADIATION_LEVEL : 1;

  // Exposure builds very slowly but keeps increasing over time (cap 100).
  // The accumulated dose both worsens the damage and ramps mutation chance.
  let exposure = view[base + S.RADIATION_EXPOSURE] || 0;
  exposure += level * dt * 0.01;
  if (exposure > 100) exposure = 100;
  view[base + S.RADIATION_EXPOSURE] = exposure;

  // Energy damage: ARMOR shields; exposure slowly compounds the dose.
  const damage = (1 - armor) * 0.02 * level * (1 + exposure * 0.02) * dt * synergy;
  if (damage > 0.001) {
    const newEnergy = energy - damage;
    if (newEnergy <= 0) {
      // Radiation depletion kills — consistent with the batch-02 LIFE death.
      view[base + S.ENERGY] = 0;
      view[base + S.DEAD] = 1.0;
    } else {
      view[base + S.ENERGY] = newEnergy;
    }
  }

  // Mutation ramp: the accumulated dose slowly increases the chance of DNA
  // damage — more and more over time as exposure climbs.
  const mutationRate = view[base + S.DNA_CACHE_START + 12] || 0.5;
  const mutProb = exposure * 0.001 * dt * synergy;
  if (prng && mutProb > 0 && prng() < mutProb) {
    const hashVal = Math.sin(base * 173.3 + performance.now() * 0.001) * 43758.5453;
    const dnaIdx = Math.abs(Math.floor(hashVal)) % 42;
    const perturb = (prng() - 0.5) * mutationRate * 0.05;
    const val = view[base + S.DNA_CACHE_START + dnaIdx];
    if (Number.isFinite(val)) view[base + S.DNA_CACHE_START + dnaIdx] = val + perturb;
  }
}

// ============================================================================
// 47. TRACK — Predation tracking
// ============================================================================
function applyTrackingBehavior(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy) {
  if (!isSet(lawState, LAW_INDEXES.TRACK)) return null;
  if (dist < 1) return null;
  const massI = view[iBase + S.MASS];
  const massJ = view[jBase + S.MASS];
  if (!Number.isFinite(massI) || !Number.isFinite(massJ)) return null;
  const predationBias = view[iBase + S.DNA_CACHE_START + 36];
  if (!Number.isFinite(predationBias) || predationBias < 0.1) return null;
  // Predation is cross-species: a predator never hunts its own kind.
  if (view[iBase + S.SPECIES_ID] === view[jBase + S.SPECIES_ID]) return null;
  if (massJ < massI * 0.8) {
    const strength = predationBias * 0.05 * synergy;
    const invDist = 1.0 / dist;
    return {
      ax: dx * invDist * strength,
      ay: dy * invDist * strength,
      az: dz * invDist * strength,
    };
  }
  return null;
}

// ============================================================================
// 48. GENOTYPE — DNA mutation from environmental stress
// ============================================================================
function applyGenotypeMutation(lawState, view, base, dt, synergy, prng, dnaBuffer) {
  if (!isSet(lawState, LAW_INDEXES.GENOTYPE)) return;
  const mutationRate = view[base + S.DNA_CACHE_START + 12];
  const temperature = view[base + S.TEMPERATURE];
  if (!Number.isFinite(mutationRate) || !Number.isFinite(temperature)) return;
  if (mutationRate < 0.01) return;

  const speciesId = view[base + S.SPECIES_ID] || 0;
  // Genetics params (42-47) come from the species genome (DNA buffer).
  const crossoverRate = readSpeciesDNAParam(dnaBuffer, speciesId, 43);
  const epigeneticDrift = readSpeciesDNAParam(dnaBuffer, speciesId, 44);
  const heterozygosity = readSpeciesDNAParam(dnaBuffer, speciesId, 45);
  const geneFlow = readSpeciesDNAParam(dnaBuffer, speciesId, 46);
  const repressor = readSpeciesDNAParam(dnaBuffer, speciesId, 47);
  // Genetics & regulatory params (48-63, genome-only).
  const alleleCount = readSpeciesDNAParam(dnaBuffer, speciesId, 48);
  const epigeneticRate = readSpeciesDNAParam(dnaBuffer, speciesId, 49);
  const hgtRate = readSpeciesDNAParam(dnaBuffer, speciesId, 50);
  const repairEfficiency = readSpeciesDNAParam(dnaBuffer, speciesId, 51);
  const driftRate = readSpeciesDNAParam(dnaBuffer, speciesId, 52);
  const selectionSensitivity = readSpeciesDNAParam(dnaBuffer, speciesId, 53);
  const speciationThreshold = readSpeciesDNAParam(dnaBuffer, speciesId, 54);
  const adaptationRate = readSpeciesDNAParam(dnaBuffer, speciesId, 55);
  const transposonRate = readSpeciesDNAParam(dnaBuffer, speciesId, 56);
  const geneSilencing = readSpeciesDNAParam(dnaBuffer, speciesId, 57);
  const mutagenSensitivity = readSpeciesDNAParam(dnaBuffer, speciesId, 59);
  const ploidyLevel = readSpeciesDNAParam(dnaBuffer, speciesId, 61);
  const codonBias = readSpeciesDNAParam(dnaBuffer, speciesId, 62);
  const regulatoryDepth = readSpeciesDNAParam(dnaBuffer, speciesId, 63);

  // Accumulated radiation dose (RADIATION law) ramps the mutation rate —
  // radiation increases mutation chance more and more over time.
  const exposure = view[base + S.RADIATION_EXPOSURE] || 0;

  let mutProb = mutationRate * (1.0 + temperature) * dt * 0.01 * synergy
    * (1 - repressor * 0.5)            // REPRESSOR dampens genetic drift
    * (1 - repairEfficiency * 0.6)     // REPAIR_EFFICIENCY mends damage
    * (1 / (1 + regulatoryDepth * 0.03)) // REGULATORY_DEPTH stabilizes expression
    * (1 + driftRate * 0.5)            // DRIFT_RATE adds neutral drift
    // MUTAGEN_SENSITIVITY scales how hard radiation dose ramps mutation
    * (1 + exposure * 0.05 * (0.5 + mutagenSensitivity * 1.5));
  if (mutProb < 0.001) return;

  const numMutations = Math.floor(mutProb * 3) + 1;
  const dnaStart = S.DNA_CACHE_START;

  for (let m = 0; m < numMutations; m++) {
    // Somatic drift — per-particle DNA cache (heritable through REPRO).
    const hashVal = Math.sin(base * 127.1 + m * 311.7 + performance.now() * 0.001) * 43758.5453;
    const dnaIdx = Math.abs(Math.floor(hashVal)) % 42;
    const perturbHash = Math.sin(base * 269.5 + dnaIdx * 183.3) * 43758.5453;
    // HETEROZYGOSITY + ALLELE_COUNT + PLOIDY_LEVEL widen variance;
    // GENE_SILENCING damps expression; CODON_BIAS biases the direction.
    const varScale = (1 + heterozygosity * 2
      + (alleleCount - 2) * 0.25
      + (ploidyLevel - 2) * 0.15)
      * (1 - geneSilencing * 0.4);
    const perturb = ((perturbHash - Math.floor(perturbHash)) * 2.0 - 1.0)
      * mutationRate * 0.05 * varScale * (0.5 + codonBias);
    const newVal = view[base + dnaStart + dnaIdx] + perturb;
    if (Number.isFinite(newVal)) {
      view[base + dnaStart + dnaIdx] = newVal;
    }

    // Epigenetic drift — extra non-heritable noise on the cache.
    if ((epigeneticDrift + epigeneticRate) > 0 && prng && prng() < 0.5) {
      const epiIdx = Math.abs(Math.floor(Math.sin(base * 91.7 + m * 173.1) * 43758.5453)) % 42;
      const epiNoise = (prng() - 0.5) * (epigeneticDrift + epigeneticRate * 2) * 2;
      view[base + dnaStart + epiIdx] += epiNoise;
    }

    // Gene flow — horizontal transfer of a foreign gene into the cache.
    if (dnaBuffer && prng && prng() < geneFlow * 0.01 + hgtRate * 0.02) {
      const otherSpecies = (Math.floor(prng() * 63) >= speciesId) ? (Math.floor(prng() * 63) + 1) : Math.floor(prng() * 63);
      const r = DNA_RANGES[dnaIdx] || { min: -1, max: 1 };
      const foreign = readSpeciesDNAParam(dnaBuffer, otherSpecies, dnaIdx);
      view[base + dnaStart + dnaIdx] += (foreign - view[base + dnaStart + dnaIdx]) * 0.1;
    }

    // Transposon jump — TRANSPOSON_RATE: a mobile element leaps to a random
    // locus with a larger, directionally-biased perturbation.
    if (prng && prng() < transposonRate * 0.05) {
      const jumpIdx = Math.abs(Math.floor(Math.sin(base * 137.9 + m * 219.7) * 43758.5453)) % 42;
      view[base + dnaStart + jumpIdx] += (prng() - 0.5) * mutationRate * 0.2 * (0.5 + codonBias);
    }
  }

  // Species-genome evolution — a rare heritable mutation written back to the
  // species DNA buffer, so evolution accumulates at the species level for
  // future spawns and offspring genetics. DNA and genetics are a major part
  // of VEPA, so this is slow but persistent.
  // SELECTION_SENSITIVITY strengthens heritable change; SPECIATION_THRESHOLD
  // (low = easy divergence) gates the write-back; ADAPTATION_RATE scales the leap.
  if (dnaBuffer && prng && prng() < crossoverRate * 0.0002 * dt
      * (0.2 + selectionSensitivity * 0.8)
      * (1 - speciationThreshold * 0.4)) {
    const gIdx = Math.abs(Math.floor(Math.sin(base * 53.7 + performance.now() * 0.0007) * 43758.5453)) % 42;
    const current = readSpeciesDNAParam(dnaBuffer, speciesId, gIdx);
    const gPerturb = (prng() - 0.5) * mutationRate * 0.02 * (0.5 + adaptationRate * 1.5);
    writeSpeciesDNAParam(dnaBuffer, speciesId, gIdx, current + gPerturb);
  }
}

// ============================================================================
// 49. PHENOTYPE — Express DNA as visual trait modulation
// ============================================================================
function applyPhenotype(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.PHENOTYPE)) return;
  const energy = view[base + S.ENERGY];
  const radius = view[base + S.RADIUS];
  if (!Number.isFinite(energy) || !Number.isFinite(radius)) return;
  // Energy-driven size (batch-05 confirmation): ENERGY is the environment —
  // a well-fed particle (energy > 100) expresses a larger body, a starving
  // one shrinks, exactly like real organisms where nutrition affects size.
  const energyFactor = 1 + (energy / 200 - 0.5) * 0.5 * synergy;
  view[base + S.RADIUS] = radius * energyFactor;

  // Gene expression: the inherited genome (DNA cache) is translated into the
  // visible phenotype — POLARITY → hue, ALPHA → saturation, SYMMETRY →
  // lightness — so offspring inherit their species' look along with its DNA.
  const polarity = view[base + S.DNA_CACHE_START + 4];
  const alpha = view[base + S.DNA_CACHE_START + 5];
  const symmetry = view[base + S.DNA_CACHE_START + 6];
  if (Number.isFinite(polarity) && Number.isFinite(alpha) && Number.isFinite(symmetry)) {
    const hue = (polarity + 1) * 120; // POLARITY -1..1 → 0(red)..240(blue)
    const sat = Math.max(0, Math.min(1, alpha)); // ALPHA 0..1
    const light = Math.max(0.1, Math.min(0.9, 0.5 + symmetry * 0.4)); // SYMMETRY -1..1
    const [r, g, b] = hslToRgb(hue, sat, light);
    view[base + S.COLOR_R] = r * 255;
    view[base + S.COLOR_G] = g * 255;
    view[base + S.COLOR_B] = b * 255;
  }
}

// ============================================================================
// 50. SOLVATION — Increase reaction rate in solvent
// ============================================================================
function applySolvationEffect(lawState, view, iBase, jBase, distSq, synergy) {
  if (!isSet(lawState, LAW_INDEXES.SOLVATION)) return 1.0;
  const chargeI = view[iBase + S.CHARGE];
  const chargeJ = view[jBase + S.CHARGE];
  if (!Number.isFinite(chargeI) || !Number.isFinite(chargeJ)) return 1.0;
  const polarity = Math.abs(chargeI - chargeJ);
  if (polarity > 0.5) {
    return 1.0 + polarity * 0.2 * synergy;
  }
  return 1.0;
}

// ============================================================================
// 51. ACIDITY — Acidic charge damages unprotected particles
// ============================================================================
function applyAcidityEffect(lawState, view, iBase, jBase, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.ACIDITY)) return;
  const chargeI = view[iBase + S.CHARGE];
  const chargeJ = view[jBase + S.CHARGE];
  if (!Number.isFinite(chargeI) || !Number.isFinite(chargeJ)) return;
  const diff = chargeJ - chargeI;
  if (Math.abs(diff) < 0.3) return;
  // Documented behavior (batch-05 confirmation): acid/base exchange equalizes
  // electrical potential. CONDUCTIVITY DNA controls the transfer rate and the
  // CHARGE field is altered — charge flows from the higher-charge particle to
  // the lower until the gap closes. ENERGY is untouched.
  const condI = view[iBase + S.DNA_CACHE_START + 32] || 0;
  const condJ = view[jBase + S.DNA_CACHE_START + 32] || 0;
  const conductivity = Math.max(condI, condJ);
  if (conductivity <= 0) return;
  const transfer = diff * conductivity * 0.1 * dt * synergy;
  view[iBase + S.CHARGE] += transfer;
  view[jBase + S.CHARGE] -= transfer;
}

// ============================================================================
// 52. OXIDATION — Charge imbalance causes structural degradation
// ============================================================================
function applyOxidationEffect(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.OXIDATION)) return;
  const charge = Math.abs(view[base + S.CHARGE]);
  if (!Number.isFinite(charge) || charge < 0.3) return;
  const mass = view[base + S.MASS];
  if (Number.isFinite(mass) && mass > 0.1) {
    view[base + S.MASS] -= charge * 0.001 * dt * synergy;
  }
  // Batch-06 confirmation: real oxidation is electron loss — the charge
  // magnitude drifts toward 0 at the same rate (the particle rusts
  // electrically) instead of only eating mass.
  const c = view[base + S.CHARGE];
  if (Number.isFinite(c) && c !== 0) {
    const decay = c * 0.001 * dt * synergy;
    view[base + S.CHARGE] = Math.abs(c) <= Math.abs(decay) ? 0 : c - decay;
  }

  // HEAT_OUTPUT DNA (39): charged oxidation releases energy + temperature and
  // the particle flashes brighter (glow) as it burns.
  const heatOutput = view[base + S.DNA_CACHE_START + D.HEAT_OUTPUT] || 0;
  if (heatOutput > 0.001) {
    const release = charge * heatOutput * 0.05 * dt * synergy;
    view[base + S.ENERGY] = Math.min(200, (view[base + S.ENERGY] || 0) + release);
    view[base + S.TEMPERATURE] = (view[base + S.TEMPERATURE] || 0) + release * 0.01;
    if (release > 0.0001) {
      const flash = release * 40;
      view[base + S.COLOR_R] = Math.min(255, (view[base + S.COLOR_R] || 0) + flash);
      view[base + S.COLOR_G] = Math.min(255, (view[base + S.COLOR_G] || 0) + flash);
      view[base + S.COLOR_B] = Math.min(255, (view[base + S.COLOR_B] || 0) + flash);
      view[base + S.ALPHA] = Math.min(1, (view[base + S.ALPHA] || 0) + release * 0.1);
    }
  }
}

// ============================================================================
// 53. ISOMERIZATION — Structural rearrangement changes properties
// ============================================================================
function applyIsomerization(lawState, view, base, dt, synergy, prng, stride) {
  if (!isSet(lawState, LAW_INDEXES.ISOMERIZATION)) return;
  // Batch-06 confirmation ("match real life"): real isomerization keeps the
  // same atoms but rearranges the bonds. A particle with 3+ chain bonds
  // occasionally breaks one connection — the freed partner becomes a fragment
  // (its reciprocal bond is cleared too) — and the rearrangement consumes a
  // little energy. The old "radius breathing" placeholder is gone.
  const bondCount = view[base + S.BOND_COUNT];
  if (!Number.isFinite(bondCount) || bondCount < 3) return;
  const energy = view[base + S.ENERGY];
  if (!Number.isFinite(energy) || energy < 1) return;
  const chance = 0.02 * dt * synergy;
  if (prng && prng() >= chance) return;

  const iIdx = Math.round(base / stride);
  for (const slot of BOND_SLOTS) {
    const partnerIdx = view[base + slot];
    if (partnerIdx >= 0) {
      const partnerBase = Math.round(partnerIdx) * stride;
      if (Number.isFinite(partnerBase) && partnerBase >= 0 && partnerBase < view.length) {
        for (const pSlot of BOND_SLOTS) {
          if (view[partnerBase + pSlot] === iIdx) {
            view[partnerBase + pSlot] = -1;
            view[partnerBase + S.BOND_COUNT] = Math.max(0, (view[partnerBase + S.BOND_COUNT] || 0) - 1);
            break;
          }
        }
      }
      view[base + slot] = -1;
      view[base + S.BOND_COUNT] = Math.max(0, bondCount - 1);
      break;
    }
  }
  // Isomerization consumes energy (documented).
  view[base + S.ENERGY] = Math.max(0, energy - 0.5 * dt * synergy);
}

// ============================================================================
// 54. CHIRALITY — Handedness affects interaction bias
// ============================================================================
function applyChirality(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy) {
  if (!isSet(lawState, LAW_INDEXES.CHIRALITY)) return null;
  if (dist < 1) return null;
  // Batch-06 confirmation (documented): handedness comes from TORQUE DNA
  // (rotational momentum), not POLARITY — real chirality is geometric
  // mirror-handedness (clockwise vs counter-clockwise spin), not charge.
  const torqueI = view[iBase + S.DNA_CACHE_START + D.TORQUE];
  const torqueJ = view[jBase + S.DNA_CACHE_START + D.TORQUE];
  if (!Number.isFinite(torqueI) || !Number.isFinite(torqueJ)) return null;
  if (torqueI === 0 || torqueJ === 0) return null;
  // Same-handedness pairs deflect perpendicular to their separation; the
  // deflection direction follows the handedness sign (left vs right mirror
  // image rotate opposite ways). Opposite-handedness pairs: no force.
  if ((torqueI > 0 && torqueJ > 0) || (torqueI < 0 && torqueJ < 0)) {
    const strength = 0.01 * synergy;
    const invDist = 1.0 / dist;
    const dir = torqueI > 0 ? 1 : -1;
    return {
      ax: -dy * invDist * strength * dir,
      ay: dx * invDist * strength * dir,
      az: 0,
    };
  }
  return null;
}

// ============================================================================
// 55. CRYSTALLIZATION — Particles align into ordered lattice
// ============================================================================
function applyCrystallization(lawState, view, iBase, jBase, dx, dy, dz, dist, synergy) {
  if (!isSet(lawState, LAW_INDEXES.CRYSTALLIZATION)) return null;
  // Batch-07 repair: range widened 30 -> 150 so lattices actually form at
  // default spawn spacing (~100-300 units), pull strengthened 0.01 -> 0.05.
  if (dist < 1 || dist > 150) return null;
  const gridSize = 8.0;
  const targetX = Math.round(dx / gridSize) * gridSize;
  const targetY = Math.round(dy / gridSize) * gridSize;
  const targetZ = Math.round(dz / gridSize) * gridSize;
  // Same-species pairs crystallize 3x stronger (batch-07 confirmation)
  const sameSpecies = view[iBase + S.SPECIES_ID] === view[jBase + S.SPECIES_ID];
  const pullScale = sameSpecies ? 3.0 : 1.0;
  const pullX = (targetX - dx) * 0.05 * synergy * pullScale;
  const pullY = (targetY - dy) * 0.05 * synergy * pullScale;
  const pullZ = (targetZ - dz) * 0.05 * synergy * pullScale;
  return {
    ax: pullX,
    ay: pullY,
    az: pullZ,
  };
}

// ============================================================================
// 56. PHASE_RADIATION — Hot particles radiate energy as light
// ============================================================================
function applyPhaseRadiation(lawState, view, base, dt, synergy) {
  if (!isSet(lawState, LAW_INDEXES.PHASE_RADIATION)) return;
  const temp = view[base + S.TEMPERATURE];
  const energy = view[base + S.ENERGY];
  if (!Number.isFinite(temp) || !Number.isFinite(energy)) return;
  // Batch-08 confirmation ("follow irl behaviour"): Stefan-Boltzmann blackbody
  // emission — every warm body radiates, hot bodies radiate disproportionately
  // (T^4 curve), cooling both TEMPERATURE and ENERGY and glowing via SIGNAL.
  if (temp > 0.05) {
    const radiated = temp * temp * temp * temp * 0.05 * dt * synergy;
    if (radiated > 0) {
      // Energy floor 0: radiation cools and dims a body, it can never drive
      // ENERGY negative (the unclamped drain let hot bodies crater ENERGY
      // below zero every tick once multiple heat sources compounded).
      view[base + S.ENERGY] = Math.max(0, energy - radiated);
      view[base + S.TEMPERATURE] = Math.max(0, view[base + S.TEMPERATURE] - radiated);
      view[base + S.SIGNAL] = Math.min(1, view[base + S.SIGNAL] + radiated);
    }
  }
}

// ============================================================================
// 57. SUBLIMATION — Solid particles skip liquid phase
// ============================================================================
function applySublimation(lawState, view, base, dt, synergy, prng) {
  if (!isSet(lawState, LAW_INDEXES.SUBLIMATION)) return;
  const temp = view[base + S.TEMPERATURE];
  const mass = view[base + S.MASS];
  const energy = view[base + S.ENERGY];
  if (!Number.isFinite(temp) || !Number.isFinite(mass) || !Number.isFinite(energy)) return;
  // Batch-08 confirmation ("sure"): documented low-mass + high-energy gate;
  // mass can sublimate almost fully away (floor 0.02); burst uses the sim PRNG.
  if (temp > 0.5 && energy > 50 && mass > 0.02) {
    const sublRate = (temp - 0.5) * 0.005 * dt * synergy;
    view[base + S.MASS] = Math.max(0.02, view[base + S.MASS] - sublRate);
    view[base + S.VEL_X] += (prng() - 0.5) * sublRate * 5;
    view[base + S.VEL_Y] += (prng() - 0.5) * sublRate * 5;
    view[base + S.ENERGY] = Math.max(0, view[base + S.ENERGY] - sublRate * 20);
    view[base + S.TEMPERATURE] = Math.max(0, view[base + S.TEMPERATURE] - sublRate * 0.5);
  }
}

// ============================================================================
// 11. ELECTROMAGNETISM (cyan)
// ============================================================================

/** CHARGE_LAW — real Coulomb force on effective charge = POLARITY + stored CHARGE. */
function applyChargeForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const q1 = (readDNA(p1Ptr, D.POLARITY) || 0) + (buf[p1Ptr + S.CHARGE] || 0);
  const q2 = (readDNA(p2Ptr, D.POLARITY) || 0) + (buf[p2Ptr + S.CHARGE] || 0);
  const qq = q1 * q2;
  if (qq === 0) return null;
  const force = -k * qq / (dist * dist + 0.5); // like charges repel, opposite attract
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** FIELD — uniform 3D drift along POLARITY sign, scaled by stored charge. */
function applyFieldDrift(p1Ptr, k) {
  const buf = buffer_global;
  const q = readDNA(p1Ptr, D.POLARITY) || 0;
  if (q === 0) return null;
  const c = buf[p1Ptr + S.CHARGE] || 0;
  const f = k * (1 + Math.abs(c) * 0.5); // charged particles feel the field harder
  return { ax: q * f, ay: q * f, az: q * f };
}

/** CURRENT — charge diffusion between conductive neighbors. */
function applyCurrentTransfer(p1Ptr, p2Ptr, distSq, k) {
  const buf = buffer_global;
  if (distSq > 300) return;
  // Real conduction needs both materials to conduct (confirmed batch-14).
  const cond = Math.min(readDNA(p1Ptr, D.CONDUCTIVITY) || 0, readDNA(p2Ptr, D.CONDUCTIVITY) || 0);
  if (cond <= 0) return;
  const dq = (buf[p2Ptr + S.CHARGE] - buf[p1Ptr + S.CHARGE]) * cond * k;
  if (dq === 0) return;
  buf[p1Ptr + S.CHARGE] += dq;
  buf[p2Ptr + S.CHARGE] -= dq;
}

/** RESISTANCE — kinetic energy → heat + velocity damping (per-particle).
 * Material-dependent (batch-15): high CONDUCTIVITY = low resistance, and
 * hotter particles damp harder (the doc's "hotter they get, more they slow"
 * feedback — prevents runaway charge-driven velocities). */
function applyResistance(p1Ptr, vx, vy, vz, k) {
  const buf = buffer_global;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (speed < 0.01) return null;
  const cond = readDNA(p1Ptr, D.CONDUCTIVITY) || 0;
  const materialFactor = 1 - cond * 0.9; // conductors glide, insulators resist
  const heatFactor = 1 + (buf[p1Ptr + S.TEMPERATURE] || 0) * 2; // hotter → slower
  const damp = speed * k * materialFactor * heatFactor;
  buf[p1Ptr + S.TEMPERATURE] = Math.min(1, (buf[p1Ptr + S.TEMPERATURE] || 0) + speed * k * materialFactor * 0.5);
  return { ax: -vx * damp, ay: -vy * damp, az: -vz * damp };
}

/** CAPACITANCE — store surplus energy as charge (per-particle).
 * Batch-15: discharging drains toward zero only — a depleted capacitor never
 * flips sign from draining. Charging keeps the ±2 breakdown clamp. */
function applyCapacitanceStore(p1Ptr, k) {
  const buf = buffer_global;
  const energy = buf[p1Ptr + S.ENERGY] || 50;
  const delta = (energy - 50) * k;
  const c = buf[p1Ptr + S.CHARGE] || 0;
  if (delta < 0) {
    // Bleed toward zero; never overshoot into the opposite polarity.
    buf[p1Ptr + S.CHARGE] = c > 0 ? Math.max(0, c + delta) : c;
  } else {
    buf[p1Ptr + S.CHARGE] = clamp(c + delta, -2, 2);
  }
}

/** CAPACITANCE — pairwise force from stored charge. */
function applyStoredChargeForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const c1 = buf[p1Ptr + S.CHARGE] || 0;
  const c2 = buf[p2Ptr + S.CHARGE] || 0;
  const qq = c1 * c2;
  if (qq === 0) return null;
  const force = -k * qq / (dist * dist + 0.5); // same-sign stored charge repels
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** INDUCTANCE — velocity alignment (magnetic coupling), in-place.
 * Batch-15: coupling scales with the product of MAGNETIC_MOMENT magnitudes
 * (|m1·m2| — induction needs a magnetic field), fades with distance, and both
 * particles must conduct (real materials, consistent with CURRENT). Momentum
 * is conserved: the pair swaps equal-and-opposite velocity deltas. */
function applyInductance(p1Ptr, p2Ptr, dist, k) {
  const buf = buffer_global;
  const cond = Math.min(readDNA(p1Ptr, D.CONDUCTIVITY) || 0, readDNA(p2Ptr, D.CONDUCTIVITY) || 0);
  if (cond <= 0) return;
  const m1 = readDNA(p1Ptr, D.MAGNETIC_MOMENT) || 0;
  const m2 = readDNA(p2Ptr, D.MAGNETIC_MOMENT) || 0;
  const couple = Math.abs(m1 * m2) / (1 + dist * 0.03);
  if (couple <= 0.0001) return;
  for (const slot of [S.VEL_X, S.VEL_Y, S.VEL_Z]) {
    const dv = (buf[p2Ptr + slot] - buf[p1Ptr + slot]) * k * couple;
    buf[p1Ptr + slot] += dv;
    buf[p2Ptr + slot] -= dv;
  }
}

/** MAGNETISM — aligned moments attract, opposing repel. */
function applyMagneticForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const m1 = readDNA(p1Ptr, D.MAGNETIC_MOMENT) || 0;
  const m2 = readDNA(p2Ptr, D.MAGNETIC_MOMENT) || 0;
  const mm = m1 * m2;
  if (mm === 0) return null;
  const force = k * mm / (dist * dist + 0.5);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** RESONANCE — sympathetic vibration: matched pulsing pairs attract and amplify.
 * Batch-16: phase alignment matters. In-phase pairs (constructive interference)
 * scale the attraction up and the stronger pulser amplifies the weaker one's
 * SIGNAL — synchronized swarms get louder. Mismatched phase damps the force. */
function applyResonanceForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const s1 = buf[p1Ptr + S.SIGNAL] || 0;
  const s2 = buf[p2Ptr + S.SIGNAL] || 0;
  if (s1 <= 0.01 || s2 <= 0.01) return null;
  const pr1 = readDNA(p1Ptr, D.PULSE_RATE) || 0.5;
  const pr2 = readDNA(p2Ptr, D.PULSE_RATE) || 0.5;
  const sync = 1.0 - Math.abs(pr1 - pr2);
  const sig = s1 * s2 * Math.max(0, sync);
  if (sig <= 0.001) return null;
  // Same oscillator phase as GLOW/COMMS: phase = sin(age·0.01·(0.1+pulseRate)).
  const ph1 = Math.sin((buf[p1Ptr + S.AGE] || 0) * 0.01 * (0.1 + pr1));
  const ph2 = Math.sin((buf[p2Ptr + S.AGE] || 0) * 0.01 * (0.1 + pr2));
  const phaseSync = 0.5 + 0.5 * Math.cos((ph1 - ph2) * Math.PI * 0.5);
  // Constructive interference: the weaker pulser is driven by the stronger.
  if (phaseSync > 0.6) {
    const weaker = s1 < s2 ? p1Ptr : p2Ptr;
    const stronger = weaker === p1Ptr ? p2Ptr : p1Ptr;
    buf[weaker + S.SIGNAL] = Math.min(1, (buf[weaker + S.SIGNAL] || 0) + (buf[stronger + S.SIGNAL] || 0) * phaseSync * k * 0.1);
  }
  const force = k * sig * phaseSync / (dist + 1.0);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** FLUX — charge carriers drift along the field: F = qE (batch-16).
 * Direction depends on the particle's effective charge q = POLARITY + CHARGE:
 * positive carriers move DOWN the stored-charge gradient (with the field),
 * negative carriers move UP it (electrons run the other way), and neutrals
 * follow the field lines — the classic "pushed toward higher charge" behavior. */
function applyFluxForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const dq = (buf[p2Ptr + S.CHARGE] || 0) - (buf[p1Ptr + S.CHARGE] || 0);
  if (dq === 0) return null;
  const q = (readDNA(p1Ptr, D.POLARITY) || 0) + (buf[p1Ptr + S.CHARGE] || 0);
  // Epsilon band: quantized "default 0" POLARITY is ~1.5e-5, so treat |q| ≤ 1e-3 as neutral (follows the field lines).
  const dir = q > 1e-3 ? -1 : q < -1e-3 ? 1 : 1;
  const force = dir * k * dq / (dist + 1.0);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** IONIZATION — hard contacts strip charge, forming conserved +/− ion pairs.
 * Batch-16 (match irl): ionization needs a threshold impact (real ionization
 * energy), and it transfers charge — the pair becomes a +/− ion pair with
 * conserved total charge (q_i + q_j = 0). The combined POLARITY of the pair
 * sets which partner turns positive. Already-charged particles are not re-stripped. */
function applyIonization(p1Ptr, p2Ptr, dist, relSpeed, k) {
  const buf = buffer_global;
  if (dist > 3.0) return;
  const impact = Math.min(1, relSpeed * k);
  if (impact <= 0.15) return; // below ionization energy — no strip
  const c1 = buf[p1Ptr + S.CHARGE] || 0;
  const c2 = buf[p2Ptr + S.CHARGE] || 0;
  if (c1 !== 0 || c2 !== 0) return; // already ionized — no further stripping
  const s = Math.sign((readDNA(p1Ptr, D.POLARITY) || 0) + (readDNA(p2Ptr, D.POLARITY) || 0)) || 1;
  buf[p1Ptr + S.CHARGE] = impact * s;
  buf[p2Ptr + S.CHARGE] = -impact * s;
}

/** DISCHARGE — stored charge bursts into motion + heat (per-particle).
 * Batch-16 (match irl): the spark travels along the potential difference —
 * kicked toward the neighbor with the most opposite stored charge (accumulated
 * by the solver during the pair loop). Random burst only when no opposite-charge
 * field exists nearby. Threshold (|c| ≥ 0.5), heat spike, and reset unchanged. */
function applyDischarge(p1Ptr, prng, k, aimX, aimY, aimZ) {
  const buf = buffer_global;
  const c = buf[p1Ptr + S.CHARGE] || 0;
  if (Math.abs(c) < 0.5) return null;
  const kick = c * k;
  const aimMag = Math.sqrt(aimX * aimX + aimY * aimY + aimZ * aimZ);
  let ax, ay, az;
  if (aimMag > 0.001) {
    // Spark follows the gradient toward the opposite charge. Direction comes
    // from the aim (already charge-aware); magnitude is |charge|·k so the
    // charge sign never flips the aimed kick.
    ax = Math.abs(kick) * (aimX / aimMag);
    ay = Math.abs(kick) * (aimY / aimMag);
    az = Math.abs(kick) * (aimZ / aimMag);
  } else {
    const dir = prng ? (prng() - 0.5) * 2 : 0;
    ax = kick * 0.6;
    ay = kick * dir;
    az = kick * 0.2;
  }
  buf[p1Ptr + S.TEMPERATURE] = Math.min(1, (buf[p1Ptr + S.TEMPERATURE] || 0) + Math.abs(c) * 0.08);
  buf[p1Ptr + S.CHARGE] = 0;
  return { ax: nanGuard(ax), ay: nanGuard(ay), az: nanGuard(az) };
}

/** PLASMA — the thermal-EM bridge with hysteresis (batch-17, match irl).
 * Above 0.6 surplus heat ionizes into stored charge, cooling the gas. Below
 * 0.5 a cooled plasma recombines: stored charge converts back to heat and the
 * ion resets — real plasma never keeps its charge after it cools. The 0.6/0.5
 * band prevents rapid ionize/recombine oscillation. */
function applyPlasma(p1Ptr, k) {
  const buf = buffer_global;
  const temp = buf[p1Ptr + S.TEMPERATURE] || 0;
  const excess = temp - 0.6;
  if (excess > 0) {
    const conv = excess * k;
    buf[p1Ptr + S.CHARGE] = clamp((buf[p1Ptr + S.CHARGE] || 0) + conv, -2, 2);
    buf[p1Ptr + S.TEMPERATURE] = temp - conv * 0.5;
    return;
  }
  // Recombination: below the ionization threshold, charge releases as heat.
  if (temp < 0.5) {
    const c = buf[p1Ptr + S.CHARGE] || 0;
    if (c !== 0) {
      buf[p1Ptr + S.TEMPERATURE] = Math.min(1, temp + Math.abs(c) * k * 2);
      buf[p1Ptr + S.CHARGE] = 0;
    }
  }
}

/** SUPERCONDUCTIVITY — cold pairs couple: relative motion damped + charge equalized. */
function applySuperconductivity(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const t1 = buf[p1Ptr + S.TEMPERATURE] || 0;
  const t2 = buf[p2Ptr + S.TEMPERATURE] || 0;
  if (t1 > 0.35 || t2 > 0.35) return null;
  const dq = ((buf[p2Ptr + S.CHARGE] || 0) - (buf[p1Ptr + S.CHARGE] || 0)) * k * 0.4;
  buf[p1Ptr + S.CHARGE] = (buf[p1Ptr + S.CHARGE] || 0) + dq;
  buf[p2Ptr + S.CHARGE] = (buf[p2Ptr + S.CHARGE] || 0) - dq;
  // Coupling force: damps the subject's motion toward the neighbor's velocity
  return {
    ax: nanGuard((buf[p2Ptr + S.VEL_X] - buf[p1Ptr + S.VEL_X]) * k),
    ay: nanGuard((buf[p2Ptr + S.VEL_Y] - buf[p1Ptr + S.VEL_Y]) * k),
    az: nanGuard((buf[p2Ptr + S.VEL_Z] - buf[p1Ptr + S.VEL_Z]) * k),
  };
}

// ============================================================================
// 12. INFORMATION (gold)
// ============================================================================

/** MEMORY — refresh the trace on contact. */
function applyMemoryRefresh(p1Ptr, p2Ptr) {
  const buf = buffer_global;
  buf[p1Ptr + S.MEMORY] = Math.min(1, (buf[p1Ptr + S.MEMORY] || 0) + 0.05);
  buf[p2Ptr + S.MEMORY] = Math.min(1, (buf[p2Ptr + S.MEMORY] || 0) + 0.05);
}

/** MEMORY — decay + momentum persistence (per-particle). */
function applyMemoryDecay(p1Ptr, decay, k) {
  const buf = buffer_global;
  const mem = buf[p1Ptr + S.MEMORY] || 0;
  if (mem <= 0) return;
  buf[p1Ptr + S.MEMORY] = mem * decay;
  buf[p1Ptr + S.VEL_X] *= 1.0 + mem * k * 0.02;
  buf[p1Ptr + S.VEL_Y] *= 1.0 + mem * k * 0.02;
  buf[p1Ptr + S.VEL_Z] *= 1.0 + mem * k * 0.02;
}

/** PATTERN — cohesion: dense regions pull particles together. */
function applyPatternForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  if (dist < 1.0) return null;
  const force = k / (dist + 1.0);
  const invDist = 1.0 / dist;
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** STIGMERGY — lay a predicted-path trail marker, or let it evaporate.
 * Batch-17 (match irl): only moving particles lay pheromone (speed gate);
 * a stopped particle's marker melts back toward it (evaporation), so trails
 * fade instead of persisting forever. */
function applyTrailWrite(p1Ptr, px, py, pz, vx, vy, vz) {
  const buf = buffer_global;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (speed >= 0.5) {
    buf[p1Ptr + S.TRAIL_X] = px + vx * 8.0;
    buf[p1Ptr + S.TRAIL_Y] = py + vy * 8.0;
    buf[p1Ptr + S.TRAIL_Z] = pz + vz * 8.0;
  } else {
    // Evaporation: the marker melts back toward the owner's position.
    buf[p1Ptr + S.TRAIL_X] += (px - buf[p1Ptr + S.TRAIL_X]) * 0.08;
    buf[p1Ptr + S.TRAIL_Y] += (py - buf[p1Ptr + S.TRAIL_Y]) * 0.08;
    buf[p1Ptr + S.TRAIL_Z] += (pz - buf[p1Ptr + S.TRAIL_Z]) * 0.08;
  }
}

/** STIGMERGY — follow a neighbor's trail marker along the pheromone gradient.
 * Batch-17 (match irl): the pull falls off with distance to the marker and
 * scales with freshness — a marker far from its owner's current position is
 * stale (evaporated) and pulls weakly. */
function applyStigmergyForce(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const tx = buf[p2Ptr + S.TRAIL_X] || 0;
  const ty = buf[p2Ptr + S.TRAIL_Y] || 0;
  const tz = buf[p2Ptr + S.TRAIL_Z] || 0;
  const ddx = tx - buf[p1Ptr + S.POS_X];
  const ddy = ty - buf[p1Ptr + S.POS_Y];
  const ddz = tz - buf[p1Ptr + S.POS_Z];
  const dd = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) + 1.0;
  // Freshness: how close the marker is to its owner's current position.
  const ownerDx = tx - buf[p2Ptr + S.POS_X];
  const ownerDy = ty - buf[p2Ptr + S.POS_Y];
  const ownerDz = tz - buf[p2Ptr + S.POS_Z];
  const ownerDist = Math.sqrt(ownerDx * ownerDx + ownerDy * ownerDy + ownerDz * ownerDz);
  const freshness = 1.0 / (1.0 + ownerDist * 0.02);
  // Distance falloff: pheromone strength drops with distance from the marker.
  const falloff = 1.0 / (1.0 + dd * 0.1);
  return {
    ax: nanGuard((ddx / dd) * k * freshness * falloff),
    ay: nanGuard((ddy / dd) * k * freshness * falloff),
    az: nanGuard((ddz / dd) * k * freshness * falloff),
  };
}

/** SIGNAL_BOOST — relay signal to a neighbor on contact.
 * Batch-17: the relay scales with the sender's SIGNAL_STRENGTH DNA (0.5..1.5×),
 * consistent with GLOW/COMMS — stronger emitters relay more. */
function applySignalBoost(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const s1 = buf[p1Ptr + S.SIGNAL] || 0;
  if (s1 > 0.01) {
    const strengthRaw = readDNA(p1Ptr, D.SIGNAL_STRENGTH);
    const strength = Number.isFinite(strengthRaw) ? strengthRaw : 0.5;
    buf[p2Ptr + S.SIGNAL] = Math.min(1, (buf[p2Ptr + S.SIGNAL] || 0) + s1 * k * (0.5 + strength * 0.5));
  }
}

/** LEARN — velocity matching (boids alignment), in-place. */
function applyLearnAlign(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const kk = k * 0.1;
  for (const slot of [S.VEL_X, S.VEL_Y, S.VEL_Z]) {
    buf[p1Ptr + slot] += (buf[p2Ptr + slot] - buf[p1Ptr + slot]) * kk;
  }
}

/** SYMBOL — token-gated social force with contact imprinting (v4.6.29).
 * Arbitrary tokens acquire shared meaning: the higher-MEMORY partner teaches
 * its token on contact; same-token particles attract (homing on shared
 * meaning), different-token pairs repel weakly. Grouping follows learned
 * identity, not species — distinct from AFFINITY. */
function applySymbolForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const t1 = Math.round((buf[p1Ptr + S.SYMBOL_TOKEN] || 0) * 7);
  const t2 = Math.round((buf[p2Ptr + S.SYMBOL_TOKEN] || 0) * 7);
  const rSum = (buf[p1Ptr + S.RADIUS] || 0.6) + (buf[p2Ptr + S.RADIUS] || 0.6);
  if (dist < rSum + 0.5) {
    const m1 = buf[p1Ptr + S.MEMORY] || 0;
    const m2 = buf[p2Ptr + S.MEMORY] || 0;
    const learn = Math.min(0.3, Math.abs(m1 - m2) * 0.2 * k);
    if (learn > 0.001) {
      if (m1 > m2) {
        const cur = buf[p2Ptr + S.SYMBOL_TOKEN] || 0;
        buf[p2Ptr + S.SYMBOL_TOKEN] = nanGuard(Math.min(1, Math.max(0, cur + (t1 / 7 - cur) * learn)));
      } else if (m2 > m1) {
        const cur = buf[p1Ptr + S.SYMBOL_TOKEN] || 0;
        buf[p1Ptr + S.SYMBOL_TOKEN] = nanGuard(Math.min(1, Math.max(0, cur + (t2 / 7 - cur) * learn)));
      }
    }
  }
  const strength = t1 === t2 ? 0.15 : -0.05;
  const force = k * strength / (dist + 1.0);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** METRIC — climb the energy gradient. */
function applyMetricForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const dE = (buf[p2Ptr + S.ENERGY] || 50) - (buf[p1Ptr + S.ENERGY] || 50);
  if (dE === 0) return null;
  const force = k * dE / (dist + 1.0);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/** PREDICT — aim at the neighbor's extrapolated position. */
function applyPredictForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const t = 3.0;
  const pdx = dx + (buf[p2Ptr + S.VEL_X] - buf[p1Ptr + S.VEL_X]) * t;
  const pdy = dy + (buf[p2Ptr + S.VEL_Y] - buf[p1Ptr + S.VEL_Y]) * t;
  const pdz = dz + (buf[p2Ptr + S.VEL_Z] - buf[p1Ptr + S.VEL_Z]) * t;
  const pd = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz) + 0.001;
  const force = k / (dist + 1.0);
  return {
    ax: nanGuard((pdx / pd) * force),
    ay: nanGuard((pdy / pd) * force),
    az: nanGuard((pdz / pd) * force),
  };
}

/** CODE — blend DNA cache loci between contacting particles. */
function applyCodeBlend(p1Ptr, p2Ptr, distSq, k) {
  const buf = buffer_global;
  if (distSq > 16.0) return;
  const rate = k * 0.01;
  for (let d = 0; d < 42; d += 6) {
    const base = S.DNA_CACHE_START + d;
    const v1 = buf[p1Ptr + base];
    const v2 = buf[p2Ptr + base];
    buf[p1Ptr + base] = v1 + (v2 - v1) * rate;
    buf[p2Ptr + base] = v2 + (v1 - v2) * rate;
  }
}

/** PROTOCOL — entrain signal phase between neighbors. */
function applyProtocolSync(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const s1 = buf[p1Ptr + S.SIGNAL] || 0;
  const s2 = buf[p2Ptr + S.SIGNAL] || 0;
  const d1 = (s2 - s1) * k;
  buf[p1Ptr + S.SIGNAL] = Math.max(0, Math.min(1, s1 + d1));
  buf[p2Ptr + S.SIGNAL] = Math.max(0, Math.min(1, s2 - d1));
}

/** FEEDBACK — memory amplifies motion and motion refreshes memory. */
function applyFeedback(p1Ptr, k) {
  const buf = buffer_global;
  const mem = buf[p1Ptr + S.MEMORY] || 0;
  const vx = buf[p1Ptr + S.VEL_X] || 0;
  const vy = buf[p1Ptr + S.VEL_Y] || 0;
  const vz = buf[p1Ptr + S.VEL_Z] || 0;
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  buf[p1Ptr + S.MEMORY] = Math.min(1, mem + speed * k * 0.02);
  if (mem <= 0 || speed < 0.001) return null;
  // Self-propulsion along current velocity, scaled by the memory trace
  const boost = mem * k * 0.1;
  return {
    ax: nanGuard(vx * boost),
    ay: nanGuard(vy * boost),
    az: nanGuard(vz * boost),
  };
}

/** LANGUAGE — signaling pairs exchange memory traces (shared words). */
function applyLanguage(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  const s1 = buf[p1Ptr + S.SIGNAL] || 0;
  const s2 = buf[p2Ptr + S.SIGNAL] || 0;
  if (s1 <= 0.01 && s2 <= 0.01) return;
  const m1 = buf[p1Ptr + S.MEMORY] || 0;
  const m2 = buf[p2Ptr + S.MEMORY] || 0;
  const avg = (m1 + m2) * 0.5;
  buf[p1Ptr + S.MEMORY] = m1 + (avg - m1) * k;
  buf[p2Ptr + S.MEMORY] = m2 + (avg - m2) * k;
  if (s1 > 0.01) {
    buf[p2Ptr + S.SIGNAL] = Math.min(1, (buf[p2Ptr + S.SIGNAL] || 0) + s1 * k * 0.1);
  }
}

/** CULTURE — same-species contacts converge their DNA cache. */
function applyCulture(p1Ptr, p2Ptr, k) {
  const buf = buffer_global;
  if (buf[p1Ptr + S.SPECIES_ID] !== buf[p2Ptr + S.SPECIES_ID]) return;
  const rate = k * 0.02;
  for (let d = 0; d < 42; d += 3) {
    const base = S.DNA_CACHE_START + d;
    const v1 = buf[p1Ptr + base];
    const v2 = buf[p2Ptr + base];
    buf[p1Ptr + base] = v1 + (v2 - v1) * rate;
    buf[p2Ptr + base] = v2 + (v1 - v2) * rate;
  }
}

// ============================================================================
// 13. NEW LAW TYPES (singularity / entanglement / history)
// ============================================================================

/** SINGULARITY — extreme inward pull from a supermassive neighbour. */
function applySingularityForce(p1Ptr, p2Ptr, dx, dy, dz, dist, k) {
  const buf = buffer_global;
  const m2 = buf[p2Ptr + S.MASS] || 0;
  if (m2 < SINGULARITY_MASS) return null;
  const force = k * (m2 * m2) / (dist * dist + 0.5);
  const invDist = 1.0 / (dist + 0.001);
  return {
    ax: nanGuard(dx * invDist * force),
    ay: nanGuard(dy * invDist * force),
    az: nanGuard(dz * invDist * force),
  };
}

/**
 * SINGULARITY — event horizon absorption. The subject (p1, a normal particle)
 * is consumed by the neighbouring singularity (p2). Returns true if absorbed.
 */
function applySingularityAbsorb(p1Ptr, p2Ptr, dist, k) {
  const buf = buffer_global;
  const m2 = buf[p2Ptr + S.MASS] || 0;
  if (m2 < SINGULARITY_MASS) return false;
  const horizon = Math.max(2.5, Math.sqrt(m2) * 0.8);
  if (dist >= horizon) return false;
  const m1 = buf[p1Ptr + S.MASS] || 0;
  if (m1 <= 0) return false;
  buf[p2Ptr + S.MASS] = m2 + m1;
  buf[p2Ptr + S.TEMPERATURE] = Math.min(1, (buf[p2Ptr + S.TEMPERATURE] || 0) + 0.12 * k);
  buf[p1Ptr + S.MASS] = 0;
  buf[p1Ptr + S.DEAD] = 1;
  return true;
}

/** ENTANGLEMENT — contact pairs two unentangled particles into a quantum link. */
function applyEntanglePair(p1Ptr, p2Ptr, dist) {
  const buf = buffer_global;
  if (buf[p1Ptr + S.ENTANGLE_ID] >= 0 || buf[p2Ptr + S.ENTANGLE_ID] >= 0) return;
  const rSum = (buf[p1Ptr + S.RADIUS] || 0.6) + (buf[p2Ptr + S.RADIUS] || 0.6);
  if (dist > rSum + 0.5) return;
  buf[p1Ptr + S.ENTANGLE_ID] = p2Ptr / PARTICLE_STRIDE;
  buf[p2Ptr + S.ENTANGLE_ID] = p1Ptr / PARTICLE_STRIDE;
  buf[p1Ptr + S.ENTANGLE_PHASE] = 1.0;
  buf[p2Ptr + S.ENTANGLE_PHASE] = 1.0;
}

/**
 * ENTANGLEMENT — correlated link lifecycle (per-particle). The pair shares a
 * phase that decoheres (×0.998/tick); no signals and no momentum travel
 * through the link (no-signaling theorem). When one partner dies or the phase
 * expires, the shared correlation collapses on both sides. TELEPORT is the
 * only legitimate use of the link (quantum state transfer).
 */
function applyEntanglement(p1Ptr) {
  const buf = buffer_global;
  const partnerIdx = buf[p1Ptr + S.ENTANGLE_ID];
  if (partnerIdx < 0) return null;
  const phase = buf[p1Ptr + S.ENTANGLE_PHASE] || 0;
  buf[p1Ptr + S.ENTANGLE_PHASE] = phase * 0.998;

  const jBase = partnerIdx * PARTICLE_STRIDE;
  if (buf[jBase + S.DEAD] >= 0.5 || buf[jBase + S.MASS] <= 0) {
    // partner lost → the correlation collapses on both sides
    clearEntangleLink(p1Ptr);
    clearEntangleLink(jBase);
    return null;
  }

  if (buf[p1Ptr + S.ENTANGLE_PHASE] < 0.05) {
    clearEntangleLink(p1Ptr);
    clearEntangleLink(jBase);
    return null;
  }
  return null;
}

/** Clear one side of an entangled pair. */
function clearEntangleLink(ptr) {
  const buf = buffer_global;
  buf[ptr + S.ENTANGLE_ID] = -1;
  buf[ptr + S.ENTANGLE_PHASE] = 0;
}

/** HISTORY — accumulate presence into the spatial memory field. */
function applyHistoryWrite(p1Ptr, px, py, pz, worldSize) {
  const buf = buffer_global;
  if (!historyField) return;
  const cx = Math.max(0, Math.min(HISTORY_DIM - 1, Math.floor((px / worldSize) * HISTORY_DIM)));
  const cy = Math.max(0, Math.min(HISTORY_DIM - 1, Math.floor((py / worldSize) * HISTORY_DIM)));
  const cz = Math.max(0, Math.min(HISTORY_DIM - 1, Math.floor((pz / worldSize) * HISTORY_DIM)));
  const c = cx + cy * HISTORY_DIM + cz * HISTORY_DIM * HISTORY_DIM;
  const dt = historyTick - (historyLast[c] || 0);
  const presence = (buf[p1Ptr + S.ENERGY] || 50) * 0.02 + (buf[p1Ptr + S.MASS] || 1) * 0.05;
  historyField[c] = historyField[c] * Math.pow(HISTORY_DECAY, dt) + presence;
  historyLast[c] = historyTick;
}

/** Advance the memory-field clock once per solve. */
function applyHistoryCalc() {
  if (!historyField) return;
  historyTick++;
}

/** HISTORY — drift along the local memory-field gradient (archaeology as a force). */
function applyHistoryForce(p1Ptr, px, py, pz, worldSize, k) {
  if (!historyField) return null;
  const cellX = (px / worldSize) * HISTORY_DIM;
  const cellY = (py / worldSize) * HISTORY_DIM;
  const cellZ = (pz / worldSize) * HISTORY_DIM;
  const { gx, gy, gz } = historyGradient(cellX, cellY, cellZ);
  const gm = Math.sqrt(gx * gx + gy * gy + gz * gz);
  if (gm < 1e-6) return null;
  return {
    ax: nanGuard((gx / gm) * k),
    ay: nanGuard((gy / gm) * k),
    az: nanGuard((gz / gm) * k),
  };
}

/** Value of one coarse memory cell, toroidally wrapped. */
function historyCell(cx, cy, cz) {
  const x = ((cx % HISTORY_DIM) + HISTORY_DIM) % HISTORY_DIM;
  const y = ((cy % HISTORY_DIM) + HISTORY_DIM) % HISTORY_DIM;
  const z = ((cz % HISTORY_DIM) + HISTORY_DIM) % HISTORY_DIM;
  return historyField[x + y * HISTORY_DIM + z * HISTORY_DIM * HISTORY_DIM] || 0;
}

/**
 * Central-difference gradient of the coarse memory field at a fractional cell
 * position (wrap-around neighbours). Six reads — no global field scan.
 */
function historyGradient(cx, cy, cz) {
  const x = Math.floor(cx);
  const y = Math.floor(cy);
  const z = Math.floor(cz);
  return {
    gx: historyCell(x + 1, y, z) - historyCell(x - 1, y, z),
    gy: historyCell(x, y + 1, z) - historyCell(x, y - 1, z),
    gz: historyCell(x, y, z + 1) - historyCell(x, y, z - 1),
  };
}

  return { setBuffer, applyGravity, applyDrag, applyCollision, applyAccretion, applyTracking, applyPredation, applySolvation, applyPolymerization, applyAcidity, applyOxidation, applyHeat, applyCold, applyGenotype, applyPlanetary, applyLifeCycle, applySignalDecay, cipherKey, applySignalExchange, applyAffinity, applyReproduction, applyChemistry, applyPolymer, applyHeatTransfer, applyThermalJitter, applyColdDamping, applyConvection, applyTimeDilation, applyDimensionality, applyChaos, applyOrder, advanceFateClock, getFateTime, applyFate, applyWill, applySoul, applySoulDecay, applyMind, applyVoid, applyBond, applyReduction, applyAlloy, applyMelt, applyBoil, applyCondense, applyDeposit, applyExothermic, applyTelepathy, applyClairvoyance, applyPrecognition, applyAstral, applyAstralInfluence, applyGlowEffect, applyEnergyTransfer, applyRadiationDamage, applyTrackingBehavior, applyGenotypeMutation, applyPhenotype, applySolvationEffect, applyAcidityEffect, applyOxidationEffect, applyIsomerization, applyChirality, applyCrystallization, applyPhaseRadiation, applySublimation, applyChargeForce, applyFieldDrift, applyCurrentTransfer, applyResistance, applyCapacitanceStore, applyStoredChargeForce, applyInductance, applyMagneticForce, applyResonanceForce, applyFluxForce, applyIonization, applyDischarge, applyPlasma, applySuperconductivity, applyMemoryRefresh, applyMemoryDecay, applyPatternForce, applyTrailWrite, applyStigmergyForce, applySignalBoost, applyLearnAlign, applySymbolForce, applyMetricForce, applyPredictForce, applyCodeBlend, applyProtocolSync, applyFeedback, applyLanguage, applyCulture, applySingularityForce, applySingularityAbsorb, applyEntanglePair, applyEntanglement, applyHistoryWrite, applyHistoryCalc, applyHistoryForce };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/synergy.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/synergy.js', () => {// ============================================================================
// VEPA v3 — Law Synergy Computation
// When multiple laws are active simultaneously, they modify each other's
// effects through multiplier synergies. Returns a multiplier in [0.0, 2.0].
// ============================================================================

const { LAW_INDEXES, LAW_COUNT } = __import('src/constants.js');
const { isSet } = __import('src/state/lawState.js');

/**
 * Compute the synergy multiplier for a given law based on which
 * other laws are currently active.
 *
 * @param {{ lowFlags: Uint32Array, highFlags: Uint32Array, extFlags: Uint32Array }} lawState
 * @param {number} lawIndex - The law to compute synergy for
 * @returns {number} Multiplier in [0.0, 2.0]
 */
function computeSynergy(lawState, lawIndex) {
  let mult = 1.0;

  // ── Physics synergies ──

  // GRAV + PLANETARY → gravitational strength ×1.5
  if (lawIndex === LAW_INDEXES.GRAV && isSet(lawState, LAW_INDEXES.PLANETARY)) {
    mult *= 1.5;
  }
  if (lawIndex === LAW_INDEXES.PLANETARY && isSet(lawState, LAW_INDEXES.GRAV)) {
    mult *= 1.5;
  }

  // COLL + ACCR → accretion bonus ×1.2
  if (lawIndex === LAW_INDEXES.ACCR && isSet(lawState, LAW_INDEXES.COLL)) {
    mult *= 1.2;
  }

  // ── Biology synergies ──

  // LIFE + REPRO + ENERGY → biological efficiency ×1.3
  // (only fires when all three are active)
  if (
    lawIndex === LAW_INDEXES.LIFE ||
    lawIndex === LAW_INDEXES.REPRO ||
    lawIndex === LAW_INDEXES.ENERGY
  ) {
    if (
      isSet(lawState, LAW_INDEXES.LIFE) &&
      isSet(lawState, LAW_INDEXES.REPRO) &&
      isSet(lawState, LAW_INDEXES.ENERGY)
    ) {
      mult *= 1.3;
    }
  }

  // GLOW + SIGNAL → signal propagation ×1.5
  if (lawIndex === LAW_INDEXES.GLOW && isSet(lawState, LAW_INDEXES.TRACK)) {
    mult *= 1.5;
  }
  if (lawIndex === LAW_INDEXES.TRACK && isSet(lawState, LAW_INDEXES.GLOW)) {
    mult *= 1.5;
  }

  // ── Chemistry synergies ──

  // CATALYSIS + SOLVATION + ACIDITY → chemical reaction rate ×2.0
  if (
    lawIndex === LAW_INDEXES.CATALYSIS_LAW ||
    lawIndex === LAW_INDEXES.SOLVATION ||
    lawIndex === LAW_INDEXES.ACIDITY
  ) {
    if (
      isSet(lawState, LAW_INDEXES.CATALYSIS_LAW) &&
      isSet(lawState, LAW_INDEXES.SOLVATION) &&
      isSet(lawState, LAW_INDEXES.ACIDITY)
    ) {
      mult *= 2.0;
    }
  }

  // ── Thermodynamics synergies ──

  // HEAT + COLD → cancel each other (×0.5 each)
  if (lawIndex === LAW_INDEXES.HEAT && isSet(lawState, LAW_INDEXES.COLD)) {
    mult *= 0.5;
  }
  if (lawIndex === LAW_INDEXES.COLD && isSet(lawState, LAW_INDEXES.HEAT)) {
    mult *= 0.5;
  }

  // ── Metaphysics synergies ──

  // CHAOS + ORDER → cancel each other (×0.3 each)
  if (lawIndex === LAW_INDEXES.CHAOS && isSet(lawState, LAW_INDEXES.ORDER)) {
    mult *= 0.3;
  }
  if (lawIndex === LAW_INDEXES.ORDER && isSet(lawState, LAW_INDEXES.CHAOS)) {
    mult *= 0.3;
  }

  // FATE + WILL → metaphysical power ×1.8
  if (lawIndex === LAW_INDEXES.FATE && isSet(lawState, LAW_INDEXES.WILL)) {
    mult *= 1.8;
  }
  if (lawIndex === LAW_INDEXES.WILL && isSet(lawState, LAW_INDEXES.FATE)) {
    mult *= 1.8;
  }

  // ── Metaphysics: MIND hivemind synergies (batch-10) ──

  // MIND + ENERGY → hive-mind energy drain (boost ×0.5)
  if (lawIndex === LAW_INDEXES.MIND && isSet(lawState, LAW_INDEXES.ENERGY)) {
    mult *= 0.5;
  }

  // MIND + COMMS → amplified hivemind communication (×1.5)
  if (lawIndex === LAW_INDEXES.MIND && isSet(lawState, LAW_INDEXES.COMMS)) {
    mult *= 1.5;
  }

  // MIND + TELEPATHY → global thought sharing (×2.0)
  if (lawIndex === LAW_INDEXES.MIND && isSet(lawState, LAW_INDEXES.TELEPATHY)) {
    mult *= 2.0;
  }

  // MIND + POLYMER → polymerized hivemind overhead (×0.5)
  if (lawIndex === LAW_INDEXES.MIND && isSet(lawState, LAW_INDEXES.POLYMER)) {
    mult *= 0.5;
  }

  // ── Electromagnetism synergies ──

  // CHARGE_LAW + MAGNETISM → unified electromagnetic force ×1.5
  if (
    (lawIndex === LAW_INDEXES.CHARGE_LAW || lawIndex === LAW_INDEXES.MAGNETISM) &&
    isSet(lawState, LAW_INDEXES.CHARGE_LAW) && isSet(lawState, LAW_INDEXES.MAGNETISM)
  ) {
    mult *= 1.5;
  }

  // SUPERCONDUCTIVITY + COLD → true superconducting state ×1.8
  if (
    (lawIndex === LAW_INDEXES.SUPERCONDUCTIVITY || lawIndex === LAW_INDEXES.COLD) &&
    isSet(lawState, LAW_INDEXES.SUPERCONDUCTIVITY) && isSet(lawState, LAW_INDEXES.COLD)
  ) {
    mult *= 1.8;
  }

  // SUPERCONDUCTIVITY + RESISTANCE → lossless flow cancels Ohmic damping ×0.2
  if (
    (lawIndex === LAW_INDEXES.SUPERCONDUCTIVITY || lawIndex === LAW_INDEXES.RESISTANCE) &&
    isSet(lawState, LAW_INDEXES.SUPERCONDUCTIVITY) && isSet(lawState, LAW_INDEXES.RESISTANCE)
  ) {
    mult *= 0.2;
  }

  // DISCHARGE + IONIZATION → sparks strip charge harder ×1.5
  if (
    (lawIndex === LAW_INDEXES.DISCHARGE || lawIndex === LAW_INDEXES.IONIZATION) &&
    isSet(lawState, LAW_INDEXES.DISCHARGE) && isSet(lawState, LAW_INDEXES.IONIZATION)
  ) {
    mult *= 1.5;
  }

  // PLASMA + HEAT → hotter gas ionizes more ×1.5
  if (
    (lawIndex === LAW_INDEXES.PLASMA || lawIndex === LAW_INDEXES.HEAT) &&
    isSet(lawState, LAW_INDEXES.PLASMA) && isSet(lawState, LAW_INDEXES.HEAT)
  ) {
    mult *= 1.5;
  }

  // CURRENT + RESISTANCE → ohmic heating ×1.4
  if (
    (lawIndex === LAW_INDEXES.CURRENT || lawIndex === LAW_INDEXES.RESISTANCE) &&
    isSet(lawState, LAW_INDEXES.CURRENT) && isSet(lawState, LAW_INDEXES.RESISTANCE)
  ) {
    mult *= 1.4;
  }

  // ── Information synergies ──

  // MEMORY + FEEDBACK → amplified memory loop ×1.6
  if (
    (lawIndex === LAW_INDEXES.MEMORY || lawIndex === LAW_INDEXES.FEEDBACK) &&
    isSet(lawState, LAW_INDEXES.MEMORY) && isSet(lawState, LAW_INDEXES.FEEDBACK)
  ) {
    mult *= 1.6;
  }

  // SIGNAL_BOOST + PROTOCOL → relayed synchronization ×1.5
  if (
    (lawIndex === LAW_INDEXES.SIGNAL_BOOST || lawIndex === LAW_INDEXES.PROTOCOL) &&
    isSet(lawState, LAW_INDEXES.SIGNAL_BOOST) && isSet(lawState, LAW_INDEXES.PROTOCOL)
  ) {
    mult *= 1.5;
  }

  // LANGUAGE + CODE → words spread genes ×1.5
  if (
    (lawIndex === LAW_INDEXES.LANGUAGE || lawIndex === LAW_INDEXES.CODE) &&
    isSet(lawState, LAW_INDEXES.LANGUAGE) && isSet(lawState, LAW_INDEXES.CODE)
  ) {
    mult *= 1.5;
  }

  // CULTURE + GENOTYPE → soft heredity ×1.4
  if (
    (lawIndex === LAW_INDEXES.CULTURE || lawIndex === LAW_INDEXES.GENOTYPE) &&
    isSet(lawState, LAW_INDEXES.CULTURE) && isSet(lawState, LAW_INDEXES.GENOTYPE)
  ) {
    mult *= 1.4;
  }

  // PREDICT + TRACK → interception ×1.5
  if (
    (lawIndex === LAW_INDEXES.PREDICT || lawIndex === LAW_INDEXES.TRACK) &&
    isSet(lawState, LAW_INDEXES.PREDICT) && isSet(lawState, LAW_INDEXES.TRACK)
  ) {
    mult *= 1.5;
  }

  // STIGMERGY + LEARN → learned trail following ×1.3
  if (
    (lawIndex === LAW_INDEXES.STIGMERGY || lawIndex === LAW_INDEXES.LEARN) &&
    isSet(lawState, LAW_INDEXES.STIGMERGY) && isSet(lawState, LAW_INDEXES.LEARN)
  ) {
    mult *= 1.3;
  }

  // LEARN + SYMBOL → species schooling ×1.4
  if (
    (lawIndex === LAW_INDEXES.LEARN || lawIndex === LAW_INDEXES.SYMBOL) &&
    isSet(lawState, LAW_INDEXES.LEARN) && isSet(lawState, LAW_INDEXES.SYMBOL)
  ) {
    mult *= 1.4;
  }

  // ── New law type synergies ──

  // SINGULARITY + ACCR → mass concentrates until collapse ×1.5
  if (
    (lawIndex === LAW_INDEXES.SINGULARITY || lawIndex === LAW_INDEXES.ACCR) &&
    isSet(lawState, LAW_INDEXES.SINGULARITY) && isSet(lawState, LAW_INDEXES.ACCR)
  ) {
    mult *= 1.5;
  }

  // SINGULARITY + GRAV → the hole bends space itself ×1.4
  if (
    (lawIndex === LAW_INDEXES.SINGULARITY || lawIndex === LAW_INDEXES.GRAV) &&
    isSet(lawState, LAW_INDEXES.SINGULARITY) && isSet(lawState, LAW_INDEXES.GRAV)
  ) {
    mult *= 1.4;
  }

  // ENTANGLEMENT + TELEPATHY → minds linked across any distance ×1.6
  if (
    (lawIndex === LAW_INDEXES.ENTANGLEMENT || lawIndex === LAW_INDEXES.TELEPATHY) &&
    isSet(lawState, LAW_INDEXES.ENTANGLEMENT) && isSet(lawState, LAW_INDEXES.TELEPATHY)
  ) {
    mult *= 1.6;
  }

  // ENTANGLEMENT + COMMS → correlated pairs coordinate through the comms channel ×1.5
  if (
    (lawIndex === LAW_INDEXES.ENTANGLEMENT || lawIndex === LAW_INDEXES.COMMS) &&
    isSet(lawState, LAW_INDEXES.ENTANGLEMENT) && isSet(lawState, LAW_INDEXES.COMMS)
  ) {
    mult *= 1.5;
  }

  // HISTORY + MEMORY → collective memory deepens the field ×1.6
  if (
    (lawIndex === LAW_INDEXES.HISTORY || lawIndex === LAW_INDEXES.MEMORY) &&
    isSet(lawState, LAW_INDEXES.HISTORY) && isSet(lawState, LAW_INDEXES.MEMORY)
  ) {
    mult *= 1.6;
  }

  // HISTORY + PATTERN → remembered geometry aligns drift ×1.5
  if (
    (lawIndex === LAW_INDEXES.HISTORY || lawIndex === LAW_INDEXES.PATTERN) &&
    isSet(lawState, LAW_INDEXES.HISTORY) && isSet(lawState, LAW_INDEXES.PATTERN)
  ) {
    mult *= 1.5;
  }

  // Clamp to [0.0, 2.0]
  if (mult < 0.0) mult = 0.0;
  if (mult > 2.0) mult = 2.0;

  return mult;
}

/**
 * Precompute every law's synergy multiplier for a fixed law state.
 *
 * The law state never changes mid-tick, so synergy values are constant for
 * the whole solve. Computing them once (128 entries) instead of per particle
 * or per neighbor pair removes tens of thousands of branch chains per tick
 * from the solver hot loop. Uses a plain array (not Float32Array) so the
 * float64 results are bit-identical to repeated computeSynergy calls.
 *
 * @param {object} lawState - Active-law bitmask state
 * @returns {number[]} 128-element synergy multiplier table
 */
function createSynergyCache(lawState) {
  const cache = new Array(LAW_COUNT);
  for (let i = 0; i < LAW_COUNT; i++) cache[i] = computeSynergy(lawState, i);
  return cache;
}

  return { computeSynergy, createSynergyCache };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/lawgroups/physicsLaws.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/lawgroups/physicsLaws.js', () => {// ============================================================================
// VEPA4 — Physics Law Group
// TIDE / FRICTION / ELASTICITY / TURBULENCE / CENTRIPETAL / ROTATION
// Stateless per-particle and pairwise law functions over the flat particle
// buffer. Force laws return {ax, ay, az} for the solver to integrate; state
// mutations are written directly to the buffer. Never write NaN/Infinity.
// ============================================================================

const { PARTICLE_STRIDE, STRIDE_INDEXES: S, DNA_INDEXES: D } = __import('src/constants.js');

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

/**
 * TIDE — long-range tidal pull on i toward j, ∝ massJ * k / dist.
 * Not inverse-square: reaches much farther than gravity.
 */
function applyTide(view, iBase, jBase, dx, dy, dz, dist, k) {
  const massJ = nanGuard(view[jBase + S.MASS]);
  const mag = (massJ * k) / dist;
  const invDist = 1 / dist;
  return {
    ax: clamp(nanGuard(dx * invDist * mag), -50, 50),
    ay: clamp(nanGuard(dy * invDist * mag), -50, 50),
    az: clamp(nanGuard(dz * invDist * mag), -50, 50),
  };
}

/**
 * FRICTION — velocity-dependent drag: force = -v * k, scaled by VISCOSITY DNA
 * (batch-20, match irl). The removed kinetic energy is converted to heat:
 * real friction dissipates motion as temperature. Higher viscosity = more
 * damping (and more heating).
 */
function applyFriction(view, iBase, k) {
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const visRaw = view[iBase + S.DNA_CACHE_START + D.VISCOSITY];
  const viscosity = Number.isFinite(visRaw) ? visRaw : 0.98;
  const damp = k * viscosity;
  if (speed > 1e-6) {
    view[iBase + S.TEMPERATURE] = Math.min(1, (view[iBase + S.TEMPERATURE] || 0) + speed * damp * 0.5);
  }
  return {
    ax: clamp(-vx * damp, -50, 50),
    ay: clamp(-vy * damp, -50, 50),
    az: clamp(-vz * damp, -50, 50),
  };
}

/**
 * ELASTICITY — soft restitution on contact. When dist < rI + rJ, push i away
 * from j along the normal; magnitude ∝ overlap * k / (combined mass) so light
 * particles bounce harder.
 */
function applyElasticity(view, iBase, jBase, dx, dy, dz, dist, k) {
  const rI = view[iBase + S.RADIUS];
  const rJ = view[jBase + S.RADIUS];
  const overlap = rI + rJ - dist;
  if (overlap <= 0) return null;
  const mI = Math.max(nanGuard(view[iBase + S.MASS]), 0.001);
  const mJ = Math.max(nanGuard(view[jBase + S.MASS]), 0.001);
  // Coefficient of restitution from ELASTICITY DNA (0..1, default 0.5) —
  // real materials bounce less when less elastic (batch-20).
  const restRaw = view[iBase + S.DNA_CACHE_START + D.ELASTICITY];
  const rest = Number.isFinite(restRaw) ? restRaw : 0.5;
  const mag = (overlap * k * rest) / (mI + mJ);
  return {
    ax: clamp(nanGuard((-dx / dist) * mag), -50, 50),
    ay: clamp(nanGuard((-dy / dist) * mag), -50, 50),
    az: clamp(nanGuard((-dz / dist) * mag), -50, 50),
  };
}

/**
 * TURBULENCE — perpendicular pseudo-random kick. Picks a unit vector
 * perpendicular to the current velocity (or a random axis when nearly at
 * rest) and scales it by k.
 */
function applyTurbulence(view, iBase, k, prng) {
  const vx = view[iBase + S.VEL_X];
  const vy = view[iBase + S.VEL_Y];
  const vz = view[iBase + S.VEL_Z];
  const speed = Math.hypot(vx, vy, vz);
  let nx, ny, nz;
  if (speed < 1e-6) {
    const theta = prng() * Math.PI * 2;
    const z = prng() * 2 - 1;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    nx = r * Math.cos(theta);
    ny = r * Math.sin(theta);
    nz = z;
  } else {
    let tx = 1, ty = 0, tz = 0;
    if (Math.abs(vx) / speed > 0.9) {
      tx = 0;
      ty = 1;
      tz = 0;
    }
    nx = ty * vz - tz * vy;
    ny = tz * vx - tx * vz;
    nz = tx * vy - ty * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
  }
  return {
    ax: clamp(nanGuard(nx * k), -50, 50),
    ay: clamp(nanGuard(ny * k), -50, 50),
    az: clamp(nanGuard(nz * k), -50, 50),
  };
}

/**
 * CENTRIPETAL — harmonic pull toward (cx, cy, cz), ∝ distance.
 */
function applyCentripetal(view, iBase, cx, cy, cz, k) {
  const px = view[iBase + S.POS_X];
  const py = view[iBase + S.POS_Y];
  const pz = view[iBase + S.POS_Z];
  return {
    ax: clamp(nanGuard((cx - px) * k), -50, 50),
    ay: clamp(nanGuard((cy - py) * k), -50, 50),
    az: clamp(nanGuard((cz - pz) * k), -50, 50),
  };
}

/**
 * ROTATION — tangential force around the vertical axis through (cx, cy, cz):
 * rotate the (x, y) offset vector by 90° and scale by k.
 */
function applyRotation(view, iBase, cx, cy, cz, k) {
  const ox = view[iBase + S.POS_X] - cx;
  const oy = view[iBase + S.POS_Y] - cy;
  return {
    ax: clamp(nanGuard(-oy * k), -50, 50),
    ay: clamp(nanGuard(ox * k), -50, 50),
    az: 0,
  };
}

  return { applyTide, applyFriction, applyElasticity, applyTurbulence, applyCentripetal, applyRotation };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/lawgroups/thermoLaws.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/lawgroups/thermoLaws.js', () => {// ============================================================================
// VEPA4 — Thermodynamics Law Group
// ADIABATIC / COMPRESSION / EXPANSION / EQUILIBRIUM / LATENT_HEAT / RUNAWAY
// Stateless per-particle and pairwise law functions over the flat particle
// buffer. These laws mutate buffer state directly and return null. Never
// write NaN/Infinity.
// ============================================================================

const { PARTICLE_STRIDE, STRIDE_INDEXES: S, DNA_INDEXES: D } = __import('src/constants.js');

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

/**
 * ADIABATIC — convert kinetic energy to TEMPERATURE, conserving total energy:
 * damp speed by a small fraction and add the removed kinetic energy to the
 * particle's temperature. Returns the velocity-reduction force.
 */
function applyAdiabatic(view, iBase, k) {
  const vx = view[iBase + S.VEL_X];
  const vy = view[iBase + S.VEL_Y];
  const vz = view[iBase + S.VEL_Z];
  const speed = Math.hypot(vx, vy, vz);
  if (speed < 1e-9 || k <= 0) return null;
  const mass = Math.max(nanGuard(view[iBase + S.MASS]), 0.001);
  const dv = Math.min(speed * k, speed * 0.9);
  const newSpeed = speed - dv;
  const removed = 0.5 * mass * (speed * speed - newSpeed * newSpeed);
  view[iBase + S.TEMPERATURE] = nanGuard((view[iBase + S.TEMPERATURE] || 0) + removed);
  const damp = dv / speed;
  return {
    ax: clamp(nanGuard(-vx * damp), -50, 50),
    ay: clamp(nanGuard(-vy * damp), -50, 50),
    az: clamp(nanGuard(-vz * damp), -50, 50),
  };
}

/**
 * COMPRESSION — when dist < (rI + rJ) * 2, shrink both RADII slightly and
 * raise both TEMPERATUREs (pressure squeeze).
 */
function applyCompression(view, iBase, jBase, dist, k) {
  const rI = view[iBase + S.RADIUS];
  const rJ = view[jBase + S.RADIUS];
  if (dist >= (rI + rJ) * 2) return null;
  const shrinkI = Math.min(rI * k, rI * 0.25);
  const shrinkJ = Math.min(rJ * k, rJ * 0.25);
  const dT = k;
  view[iBase + S.RADIUS] = nanGuard(Math.max(0.02, rI - shrinkI));
  view[jBase + S.RADIUS] = nanGuard(Math.max(0.02, rJ - shrinkJ));
  view[iBase + S.TEMPERATURE] = nanGuard((view[iBase + S.TEMPERATURE] || 0) + dT);
  view[jBase + S.TEMPERATURE] = nanGuard((view[jBase + S.TEMPERATURE] || 0) + dT);
  return null;
}

/**
 * EXPANSION — when TEMPERATURE < 0.3, grow RADIUS toward the DNA BASE_RADIUS
 * (clamped) and cool slightly.
 */
function applyExpansion(view, iBase, k) {
  const t = view[iBase + S.TEMPERATURE];
  if (t >= 0.3) return null;
  const r = view[iBase + S.RADIUS];
  const base = view[iBase + S.DNA_CACHE_START + D.BASE_RADIUS];
  if (base > r) {
    const growth = clamp((base - r) * k, 0, base - r);
    view[iBase + S.RADIUS] = nanGuard(r + growth);
  }
  view[iBase + S.TEMPERATURE] = nanGuard(t - k * 0.1);
  return null;
}

/**
 * EQUILIBRIUM — symmetric conduction: exchange TEMPERATURE toward the pair
 * mean, conserving total.
 */
function applyEquilibrium(view, iBase, jBase, k) {
  const tI = view[iBase + S.TEMPERATURE] || 0;
  const tJ = view[jBase + S.TEMPERATURE] || 0;
  const dt = (tJ - tI) * k;
  view[iBase + S.TEMPERATURE] = nanGuard(tI + dt);
  view[jBase + S.TEMPERATURE] = nanGuard(tJ - dt);
  return null;
}

/**
 * LATENT_HEAT — phase buffering: hot particles convert TEMPERATURE to ENERGY,
 * cold particles convert ENERGY back to TEMPERATURE.
 */
function applyLatentHeat(view, iBase, k) {
  const t = view[iBase + S.TEMPERATURE] || 0;
  const energy = view[iBase + S.ENERGY] || 0;
  if (t > 1.0) {
    const dT = clamp((t - 1.0) * k, 0, t - 1.0);
    view[iBase + S.TEMPERATURE] = nanGuard(t - dT);
    view[iBase + S.ENERGY] = nanGuard(energy + dT);
  } else if (t < -0.5) {
    const want = clamp((-0.5 - t) * k, 0, -0.5 - t);
    const dT = Math.min(want, Math.max(0, energy));
    view[iBase + S.TEMPERATURE] = nanGuard(t + dT);
    view[iBase + S.ENERGY] = nanGuard(energy - dT);
  }
  return null;
}

/**
 * RUNAWAY — positive feedback: TEMPERATURE > 0.8 grows quadratically.
 */
function applyRunaway(view, iBase, k) {
  const t = view[iBase + S.TEMPERATURE] || 0;
  if (t > 0.8) {
    const excess = t - 0.8;
    view[iBase + S.TEMPERATURE] = nanGuard(t + excess * excess * k);
  }
  return null;
}

  return { applyAdiabatic, applyCompression, applyExpansion, applyEquilibrium, applyLatentHeat, applyRunaway };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/lawgroups/biologyLaws.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/lawgroups/biologyLaws.js', () => {// ============================================================================
// VEPA4 — Biology Laws (lawgroups)
// Stateless pairwise/per-particle law functions for the biology category.
// ============================================================================

const { PARTICLE_STRIDE, STRIDE_INDEXES: S, DNA_INDEXES: D } = __import('src/constants.js');

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

function applySymbiosis(view, iBase, jBase, k) {
  if (view[iBase + S.SPECIES_ID] === view[jBase + S.SPECIES_ID]) return null;
  const eI = view[iBase + S.ENERGY];
  const eJ = view[jBase + S.ENERGY];
  const d = (eI - eJ) * k * 0.5;
  view[iBase + S.ENERGY] = clamp(nanGuard(eI - d), 0, 200);
  view[jBase + S.ENERGY] = clamp(nanGuard(eJ + d), 0, 200);
  return null;
}

function applyParasite(view, iBase, jBase, k) {
  const massI = view[iBase + S.MASS];
  const massJ = view[jBase + S.MASS];
  if (massI >= massJ) return null;
  const eJ = view[jBase + S.ENERGY];
  // IMMUNITY synergy (batch-23 RRP): host ARMOR (0-5) resists extraction —
  // at the cap the drain is halved (1 - ARMOR * 0.1).
  const armorResist = 1 - clamp(nanGuard(view[jBase + S.ARMOR]), 0, 5) * 0.1;
  const drain = Math.max(0, Math.min(0.05 * massJ, eJ - 5) * k * armorResist);
  view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] + drain * 0.9), 0, 200);
  view[jBase + S.ENERGY] = clamp(nanGuard(eJ - drain), 0, 200);
  return null;
}

function applyHibernation(view, iBase, k) {
  const energy = view[iBase + S.ENERGY];
  if (energy >= 30) return null;
  view[iBase + S.ENERGY] = clamp(nanGuard(energy + 0.05 * k), 0, 30);
  const damp = 0.2 * k;
  return {
    ax: nanGuard(-view[iBase + S.VEL_X] * damp),
    ay: nanGuard(-view[iBase + S.VEL_Y] * damp),
    az: nanGuard(-view[iBase + S.VEL_Z] * damp),
  };
}

function applyImmunity(view, iBase, k) {
  view[iBase + S.ARMOR] = clamp(nanGuard(view[iBase + S.ARMOR] + 0.02 * k), 0, 5);
  if (view[iBase + S.ARMOR] > 0) {
    view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] + 0.01 * k), 0, 200);
  }
  return null;
}

  return { applySymbiosis, applyParasite, applyHibernation, applyImmunity };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/lawgroups/chemistryLaws.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/lawgroups/chemistryLaws.js', () => {// ============================================================================
// VEPA4 — Chemistry Laws (lawgroups)
// Stateless pairwise/per-particle law functions for the chemistry category.
// ============================================================================

const { PARTICLE_STRIDE, STRIDE_INDEXES: S, DNA_INDEXES: D } = __import('src/constants.js');

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

function applyElectrolysis(view, iBase, jBase, k) {
  const chargeI = view[iBase + S.CHARGE];
  const chargeJ = view[jBase + S.CHARGE];
  if (Math.abs(chargeI - chargeJ) <= 0.5) return null;
  // Batch-24 RRP: decomposition scales with CONDUCTIVITY DNA (real materials
  // need an electrolyte) and the reaction sheds a little heat.
  const conductivity = Math.max(0, Math.min(1, nanGuard(view[iBase + S.DNA_CACHE_START + D.CONDUCTIVITY])));
  const dm = Math.min(0.01 * view[iBase + S.MASS], 0.5) * k * conductivity;
  view[iBase + S.MASS] = Math.max(0.001, nanGuard(view[iBase + S.MASS] - dm));
  view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] + dm * 20), 0, 200);
  view[iBase + S.SIGNAL] = Math.max(0, nanGuard(view[iBase + S.SIGNAL] + dm * 5));
  view[iBase + S.TEMPERATURE] = nanGuard(view[iBase + S.TEMPERATURE] + dm * 0.25);
  return null;
}

function applyPhotolysis(view, iBase, k) {
  if (view[iBase + S.SIGNAL] <= 0.5) return null;
  // Batch-24 RRP: conversion scales with CATALYSIS DNA (light-powered
  // chemistry is catalysed; CATALYSIS range 1-10, default 1.0).
  const catalysis = Math.max(0.1, nanGuard(view[iBase + S.DNA_CACHE_START + D.CATALYSIS]));
  const dm = Math.min(0.01 * view[iBase + S.MASS], 0.5) * k * catalysis;
  view[iBase + S.MASS] = Math.max(0.001, nanGuard(view[iBase + S.MASS] - dm));
  view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] + dm * 15), 0, 200);
  view[iBase + S.SIGNAL] = nanGuard(view[iBase + S.SIGNAL] * 0.9);
  return null;
}

function applyPrecipitation(view, iBase, jBase, k) {
  if (view[iBase + S.ENERGY] <= 80 || view[jBase + S.ENERGY] <= 80) return null;
  view[iBase + S.MASS] = nanGuard(view[iBase + S.MASS] + 0.005 * k);
  view[iBase + S.RADIUS] = Math.max(0.1, nanGuard(view[iBase + S.RADIUS] * 0.998));
  view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] - 0.1 * k), 0, 200);
  // Batch-24 RRP: both partners condense symmetrically (saturation is a
  // pair property, not a one-sided drain).
  view[jBase + S.MASS] = nanGuard(view[jBase + S.MASS] + 0.005 * k);
  view[jBase + S.RADIUS] = Math.max(0.1, nanGuard(view[jBase + S.RADIUS] * 0.998));
  view[jBase + S.ENERGY] = clamp(nanGuard(view[jBase + S.ENERGY] - 0.1 * k), 0, 200);
  return null;
}

function applyNeutralization(view, iBase, jBase, k) {
  const cI = view[iBase + S.CHARGE];
  const cJ = view[jBase + S.CHARGE];
  if (Math.abs(cI) <= 0.1 || Math.abs(cJ) <= 0.1 || Math.sign(cI) === Math.sign(cJ)) return null;
  const step = 0.05 * k;
  view[iBase + S.CHARGE] = nanGuard(cI - Math.sign(cI) * Math.min(step, Math.abs(cI)));
  view[jBase + S.CHARGE] = nanGuard(cJ - Math.sign(cJ) * Math.min(step, Math.abs(cJ)));
  // Batch-24 RRP: heat released is proportional to the product of the charges
  // (annihilation energy scales with the opposing field strength).
  const heat = Math.abs(cI * cJ) * k * 0.04;
  view[iBase + S.TEMPERATURE] = nanGuard(view[iBase + S.TEMPERATURE] + heat);
  view[jBase + S.TEMPERATURE] = nanGuard(view[jBase + S.TEMPERATURE] + heat);
  return null;
}

function applyStoichiometry(view, iBase, jBase, k) {
  const massI = view[iBase + S.MASS];
  const massJ = view[jBase + S.MASS];
  const d = (massI - massJ) * 0.005 * k;
  view[iBase + S.MASS] = Math.max(0.001, nanGuard(massI - d));
  view[jBase + S.MASS] = Math.max(0.001, nanGuard(massJ + d));
  return null;
}

function applyAutocatalysis(view, iBase, jBase, k) {
  if (view[iBase + S.SPECIES_ID] !== view[jBase + S.SPECIES_ID]) return null;
  // REACTION_THRESHOLD DNA (37): mass limit for the phase change — the
  // catalytic reaction only fires once both bodies clear the threshold mass.
  const thrI = nanGuard(view[iBase + S.DNA_CACHE_START + D.REACTION_THRESHOLD]);
  const thrJ = nanGuard(view[jBase + S.DNA_CACHE_START + D.REACTION_THRESHOLD]);
  const threshold = Math.max(0, Math.min(1000, thrI || 0));
  if (view[iBase + S.MASS] < threshold || view[jBase + S.MASS] < (thrJ || threshold)) return null;
  const catI = clamp(nanGuard(view[iBase + S.DNA_CACHE_START + D.CATALYSIS]), 0.1, 2);
  const catJ = clamp(nanGuard(view[jBase + S.DNA_CACHE_START + D.CATALYSIS]), 0.1, 2);
  view[iBase + S.ENERGY] = clamp(nanGuard(view[iBase + S.ENERGY] + 0.1 * k * catI), 0, 200);
  view[jBase + S.ENERGY] = clamp(nanGuard(view[jBase + S.ENERGY] + 0.1 * k * catJ), 0, 200);
  return null;
}

  return { applyElectrolysis, applyPhotolysis, applyPrecipitation, applyNeutralization, applyStoichiometry, applyAutocatalysis };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/lawgroups/emLaws.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/lawgroups/emLaws.js', () => {// ============================================================================
// VEPA4 — Electromagnetism Law Group (EM)
// Per-particle and pairwise law functions: Antenna, Shielding, Polarization.
// Each function returns a force object {ax, ay, az} or null. State mutations
// are NaN-guarded and clamped before being written back to the buffer.
// ============================================================================

const { PARTICLE_STRIDE, STRIDE_INDEXES: S, DNA_INDEXES: D } = __import('src/constants.js');

function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

/**
 * Antenna — directional emission along velocity.
 * Particles carrying an active SIGNAL broadcast additional signal energy
 * scaled by speed, so moving emitters transmit louder (SIGNAL capped at 10).
 */
function applyAntenna(view, iBase, k) {
  const signal = view[iBase + S.SIGNAL];
  if (!(signal > 0.05)) return null;
  const vx = view[iBase + S.VEL_X];
  const vy = view[iBase + S.VEL_Y];
  const vz = view[iBase + S.VEL_Z];
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const boost = Math.min(speed, 5) * 0.01 * k;
  view[iBase + S.SIGNAL] = clamp(nanGuard(signal + boost), 0, 10);
  return null;
}

/**
 * Shielding — Faraday-cage dissipation.
 * Stored ENERGY is spent to bleed off stored CHARGE, damping electrostatic
 * influence at a small energy cost (charge drained toward zero).
 */
function applyShielding(view, iBase, k) {
  const energy = view[iBase + S.ENERGY];
  const charge = view[iBase + S.CHARGE];
  if (!(energy > 5) || !(Math.abs(charge) > 0)) return null;
  const delta = Math.sign(charge) * Math.min(0.01 * k, Math.abs(charge));
  view[iBase + S.CHARGE] = nanGuard(charge - delta);
  view[iBase + S.ENERGY] = clamp(energy - 0.05 * k, 0, 200);
  return null;
}

/**
 * Polarization — channel-filtered signal exchange.
 * Particles tuned to the same TUNING_CH1 channel exchange SIGNAL toward the
 * pair mean; mismatched channels absorb the transmission instead (damp).
 */
function applyPolarization(view, iBase, jBase, k) {
  const dnaBase = S.DNA_CACHE_START;
  const t1i = view[iBase + dnaBase + D.TUNING_CH1];
  const t1j = view[jBase + dnaBase + D.TUNING_CH1];
  const si = view[iBase + S.SIGNAL];
  const sj = view[jBase + S.SIGNAL];
  if (t1i === t1j) {
    const mean = (si + sj) * 0.5;
    const t = clamp(k, 0, 1);
    view[iBase + S.SIGNAL] = clamp(nanGuard(si + (mean - si) * t), 0, 10);
    view[jBase + S.SIGNAL] = clamp(nanGuard(sj + (mean - sj) * t), 0, 10);
  } else {
    const damp = 1 - 0.01 * k;
    view[iBase + S.SIGNAL] = clamp(nanGuard(si * damp), 0, 10);
    view[jBase + S.SIGNAL] = clamp(nanGuard(sj * damp), 0, 10);
  }
  return null;
}

  return { applyAntenna, applyShielding, applyPolarization };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/lawgroups/infoLaws.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/lawgroups/infoLaws.js', () => {// ============================================================================
// VEPA4 — Information Law Group (INFO)
// Pairwise and per-particle law functions: Navigation, Encryption.
// Each function returns a force object {ax, ay, az} or null. State mutations
// are NaN-guarded and clamped before being written back to the buffer.
// ============================================================================

const { PARTICLE_STRIDE, STRIDE_INDEXES: S, DNA_INDEXES: D } = __import('src/constants.js');

function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

/**
 * Navigation — memory gradient steering.
 * If the neighbor's stored MEMORY exceeds this particle's, produce a force
 * toward the neighbor proportional to the memory difference, normalized by
 * distance.
 */
function applyNavigation(view, iBase, jBase, dx, dy, dz, dist, k) {
  const memI = view[iBase + S.MEMORY];
  const memJ = view[jBase + S.MEMORY];
  if (!(memJ > memI)) return null;
  const strength = (memJ - memI) * k;
  const invDist = 1 / dist;
  return {
    ax: nanGuard(dx * invDist * strength),
    ay: nanGuard(dy * invDist * strength),
    az: nanGuard(dz * invDist * strength),
  };
}

/**
 * Encryption — keyed cipher carrier (v4.6.29).
 * Scrambles the carrier: the particle's PHASE_2 is rotated by its cipher key
 * (folded from TUNING_CH1-4) and its SIGNAL amplitude is encoded by the key.
 * Decoding happens in the COMMS exchange (laws.js applySignalExchange), which
 * only relays intelligible signal between matching keys. Persistence is NOT
 * encryption — the old decay-floor behaviour is gone.
 */
function applyEncryption(view, iBase, k) {
  const signal = view[iBase + S.SIGNAL];
  if (!(signal > 0.01)) return null;
  const key = cipherKeyFromStride(view, iBase);
  view[iBase + S.PHASE_2] = nanGuard((view[iBase + S.PHASE_2] || 0) + (key / 8) * k);
  const enc = signal * (0.6 + 0.4 * Math.sin((key / 8) * Math.PI * 2));
  view[iBase + S.SIGNAL] = clamp(nanGuard(enc), 0, 10);
  return null;
}

/** Fold TUNING_CH1-4 into a 0..7 cipher key (shared with laws.js). */
function cipherKeyFromStride(view, base) {
  const d = S.DNA_CACHE_START;
  const sum = (view[base + d + D.TUNING_CH1] || 0)
    + (view[base + d + D.TUNING_CH2] || 0)
    + (view[base + d + D.TUNING_CH3] || 0)
    + (view[base + d + D.TUNING_CH4] || 0);
  return Math.floor(Math.max(0, Math.min(1, sum / 4)) * 7);
}

  return { applyNavigation, applyEncryption };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/lawgroups/metaLaws.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/lawgroups/metaLaws.js', () => {// ============================================================================
// VEPA4 — Metaphysics Law Group (META)
// Per-particle and pairwise law functions: Consciousness, Perception,
// Synchronicity.
// Each function returns a force object {ax, ay, az} or null. State mutations
// are NaN-guarded and clamped before being written back to the buffer.
// ============================================================================

const { PARTICLE_STRIDE, STRIDE_INDEXES: S, DNA_INDEXES: D } = __import('src/constants.js');

function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

/**
 * Consciousness — predictive self-model (v4.6.29).
 * The particle maintains a running estimate of its own speed
 * (SELF_MODEL_SPEED). When actual motion deviates from the model
 * (prediction error) it 'attends': MEMORY rises, the error broadcasts as
 * SIGNAL (global-workspace flavour via COMMS/MIND), and attention costs
 * ENERGY. Low error → efficient self-maintenance regen. A computational
 * proxy for predictive processing; consciousness itself is unresolved, so
 * this is an honest approximation.
 */
function applyConsciousness(view, iBase, k) {
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const model = view[iBase + S.SELF_MODEL_SPEED] || 0;
  const updated = model * 0.95 + speed * 0.05;
  view[iBase + S.SELF_MODEL_SPEED] = nanGuard(updated);
  const err = Math.abs(speed - updated);
  if (err > 0.3) {
    // Attention: prediction error drives the self-model, costs energy.
    view[iBase + S.MEMORY] = clamp(nanGuard((view[iBase + S.MEMORY] || 0) + err * 0.02 * k), 0, 1);
    view[iBase + S.SIGNAL] = clamp(nanGuard((view[iBase + S.SIGNAL] || 0) + err * 0.01 * k), 0, 10);
    view[iBase + S.ENERGY] = clamp(nanGuard((view[iBase + S.ENERGY] || 0) - err * 0.05 * k), 0, 200);
  } else {
    // Efficient self-maintenance while the world matches the model.
    view[iBase + S.ENERGY] = clamp(nanGuard((view[iBase + S.ENERGY] || 0) + 0.01 * k), 0, 200);
  }
  return null;
}

/**
 * Perception — extended sensing.
 * Within twice the NEIGHBORHOOD_RADIUS, gently align this particle's velocity
 * toward the neighbor's velocity (awareness at a distance).
 */
function applyPerception(view, iBase, jBase, dist, k) {
  const radius = view[iBase + S.DNA_CACHE_START + D.NEIGHBORHOOD_RADIUS];
  if (!(dist < radius * 2)) return null;
  return {
    ax: nanGuard((view[jBase + S.VEL_X] - view[iBase + S.VEL_X]) * 0.01 * k),
    ay: nanGuard((view[jBase + S.VEL_Y] - view[iBase + S.VEL_Y]) * 0.01 * k),
    az: nanGuard((view[jBase + S.VEL_Z] - view[iBase + S.VEL_Z]) * 0.01 * k),
  };
}

/**
 * Synchronicity — resonant phase alignment.
 * When PHASE_1 values are close (< 0.3), pull velocities together and move
 * both phases toward the pair mean (resonant entrainment).
 */
function applySynchronicity(view, iBase, jBase, k) {
  const p1i = view[iBase + S.PHASE_1];
  const p1j = view[jBase + S.PHASE_1];
  if (!(Math.abs(p1i - p1j) < 0.3)) return null;
  const mean = (p1i + p1j) * 0.5;
  const t = clamp(k, 0, 1);
  view[iBase + S.PHASE_1] = nanGuard(p1i + (mean - p1i) * t);
  view[jBase + S.PHASE_1] = nanGuard(p1j + (mean - p1j) * t);
  return {
    ax: nanGuard((view[jBase + S.VEL_X] - view[iBase + S.VEL_X]) * 0.02 * k),
    ay: nanGuard((view[jBase + S.VEL_Y] - view[iBase + S.VEL_Y]) * 0.02 * k),
    az: nanGuard((view[jBase + S.VEL_Z] - view[iBase + S.VEL_Z]) * 0.02 * k),
  };
}

  return { applyConsciousness, applyPerception, applySynchronicity };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/lawgroups/quantumLaws.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/lawgroups/quantumLaws.js', () => {// ============================================================================
// VEPA4 — Quantum Law Group
// 16 stateless quantum laws (SUPERPOSITION .. ANTIMATTER). Per-particle laws
// return a force object {ax, ay, az} or null and may mutate state directly;
// pairwise laws act on the i-j pair. All buffer writes are NaN-guarded.
// ============================================================================

const { PARTICLE_STRIDE, STRIDE_INDEXES: S, DNA_INDEXES: D } = __import('src/constants.js');

const FORCE_LIMIT = 50;
const ENERGY_MAX = 200;
const SIGNAL_MAX = 10;
const BOUND_MAX = 1e4;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function nanGuard(v) {
  return Number.isFinite(v) ? v : 0;
}

function applySuperposition(view, iBase, k, prng) {
  // Superposition (v4.6.29): a spread of 4 basis amplitudes over candidate
  // velocities (stay, +perp, −perp, boost). Phases rotate each tick; a
  // collapse event picks one basis with probability |a|² (Born rule), then
  // renormalises (L2) — the real quantum measurement mechanism in a discrete
  // toy. Amplitudes are stored unnormalised; the collapse draw always uses
  // p_b = |a_b|² / Σ|a|², never the raw amplitude.
  let a1 = view[iBase + S.SUPER_AMP_1] || 0;
  let a2 = view[iBase + S.SUPER_AMP_2] || 0;
  let a3 = view[iBase + S.SUPER_AMP_3] || 0;
  let a4 = view[iBase + S.SUPER_AMP_4] || 0;
  if (a1 * a1 + a2 * a2 + a3 * a3 + a4 * a4 <= 1e-6) {
    a1 = 0.7; a2 = 0.1; a3 = 0.1; a4 = 0.1;
    view[iBase + S.SUPER_AMP_1] = a1;
    view[iBase + S.SUPER_AMP_2] = a2;
    view[iBase + S.SUPER_AMP_3] = a3;
    view[iBase + S.SUPER_AMP_4] = a4;
  }
  const phase = (view[iBase + S.SUPER_PHASE] || 0) + 0.05 * k;
  view[iBase + S.SUPER_PHASE] = phase;

  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  let px = 1, py = 0, pz = 0;
  if (speed > 0.01) { px = -vy / speed; py = vx / speed; pz = 0; }
  const offsets = [
    { x: 0, y: 0, z: 0 },
    { x: px * 0.3, y: py * 0.3, z: pz * 0.3 },
    { x: -px * 0.3, y: -py * 0.3, z: -pz * 0.3 },
    { x: vx * 0.15, y: vy * 0.15, z: vz * 0.15 },
  ];

  if (prng() < 0.02 * k) {
    // Born-rule collapse: sample basis b with p_b = |a_b|² / Σ|a|² (L2
    // normalisation), then collapse to the measured eigenstate plus a tiny
    // symmetric re-spread so interference can rebuild.
    const amps = [a1, a2, a3, a4];
    let norm2 = 0;
    for (let b = 0; b < 4; b++) norm2 += amps[b] * amps[b];
    if (norm2 > 1e-12) {
      const r = prng() * norm2;
      let acc = 0, basis = 0;
      for (let b = 0; b < 4; b++) {
        acc += amps[b] * amps[b];
        if (r <= acc) { basis = b; break; }
      }
      const o = offsets[basis];
      const eps = 0.05;
      view[iBase + S.SUPER_AMP_1] = basis === 0 ? 1 - 3 * eps : eps;
      view[iBase + S.SUPER_AMP_2] = basis === 1 ? 1 - 3 * eps : eps;
      view[iBase + S.SUPER_AMP_3] = basis === 2 ? 1 - 3 * eps : eps;
      view[iBase + S.SUPER_AMP_4] = basis === 3 ? 1 - 3 * eps : eps;
      return {
        ax: clamp(nanGuard(o.x * k), -FORCE_LIMIT, FORCE_LIMIT),
        ay: clamp(nanGuard(o.y * k), -FORCE_LIMIT, FORCE_LIMIT),
        az: clamp(nanGuard(o.z * k), -FORCE_LIMIT, FORCE_LIMIT),
      };
    }
  }
  // No collapse: gentle interference drift from the rotating phase.
  return {
    ax: clamp(nanGuard(Math.sin(phase) * 0.05 * k), -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp(nanGuard(Math.cos(phase) * 0.05 * k), -FORCE_LIMIT, FORCE_LIMIT),
    az: 0,
  };
}

function applyTunneling(view, iBase, k, prng) {
  if (prng() < 0.005 * k) {
    const hop = nanGuard(view[iBase + S.RADIUS]) * 6;
    view[iBase + S.POS_X] = clamp(nanGuard(view[iBase + S.POS_X]) + (prng() < 0.5 ? -hop : hop), 0, BOUND_MAX);
    view[iBase + S.POS_Y] = clamp(nanGuard(view[iBase + S.POS_Y]) + (prng() < 0.5 ? -hop : hop), 0, BOUND_MAX);
    view[iBase + S.POS_Z] = clamp(nanGuard(view[iBase + S.POS_Z]) + (prng() < 0.5 ? -hop : hop), 0, BOUND_MAX);
  }
  return null;
}

function applyDecoherence(view, iBase, k) {
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  view[iBase + S.SIGNAL] = clamp(nanGuard(view[iBase + S.SIGNAL]) + 0.001 * k, 0, SIGNAL_MAX);
  return {
    ax: clamp(-vx * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp(-vy * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
    az: clamp(-vz * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
  };
}

function applyWaveParticle(view, iBase, k) {
  // Duality is measurement-gated (v4.6.29), not speed-gated: an unmeasured
  // particle spreads as a wave (de Broglie, λ ∝ 1/p); once measured
  // (collision or OBSERVER neighbour, tracked in WAVE_MEASURED) it behaves
  // as a localised particle until the flag decays.
  const measured = view[iBase + S.WAVE_MEASURED] || 0;
  view[iBase + S.WAVE_MEASURED] = measured * 0.95;
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (measured > 0.1) {
    // Particle mode: localised, ballistic — accelerate along velocity.
    return {
      ax: clamp(vx * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp(vy * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
      az: clamp(vz * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
    };
  }
  // Wave mode: de Broglie spread — perpendicular drift, stronger at low
  // momentum (λ ∝ 1/p). PLANCK sets the quantum scale via synergy.
  if (speed < 0.01) {
    const phase = view[iBase + S.PHASE_1] || 0;
    return {
      ax: clamp(Math.sin(phase) * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp(Math.cos(phase) * 0.01 * k, -FORCE_LIMIT, FORCE_LIMIT),
      az: 0,
    };
  }
  const inv = Math.min(2, 1 / speed);
  const perpX = -vy / speed;
  const perpY = vx / speed;
  const phase = view[iBase + S.PHASE_1] || 0;
  const amp = inv * 0.02 * k * (0.5 + 0.5 * Math.sin(phase));
  return {
    ax: clamp(nanGuard(perpX * amp), -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp(nanGuard(perpY * amp), -FORCE_LIMIT, FORCE_LIMIT),
    az: 0,
  };
}

function applyUncertainty(view, iBase, k, prng) {
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  // Batch-30 RRP (match docs): the Heisenberg tradeoff is speed-gated —
  // fast particles jitter position only, slow particles get velocity kicks
  // only. Threshold mirrors WAVE_PARTICLE's 0.5 wave speed.
  if (speed >= 0.5) {
    view[iBase + S.POS_X] = clamp(nanGuard(view[iBase + S.POS_X]) + (prng() - 0.5) * 0.02 * k, 0, BOUND_MAX);
    view[iBase + S.POS_Y] = clamp(nanGuard(view[iBase + S.POS_Y]) + (prng() - 0.5) * 0.02 * k, 0, BOUND_MAX);
    view[iBase + S.POS_Z] = clamp(nanGuard(view[iBase + S.POS_Z]) + (prng() - 0.5) * 0.02 * k, 0, BOUND_MAX);
    return null;
  }
  return {
    ax: clamp((prng() - 0.5) * 0.05 * k, -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp((prng() - 0.5) * 0.05 * k, -FORCE_LIMIT, FORCE_LIMIT),
    az: clamp((prng() - 0.5) * 0.05 * k, -FORCE_LIMIT, FORCE_LIMIT),
  };
}

function applyTeleport(view, iBase, k, prng) {
  // Quantum state teleportation (v4.6.29): the state is transferred to an
  // entangled partner through a classical channel; the sender collapses — no
  // clone remains, and nothing moves through space. Requires ENTANGLE_ID.
  const partnerIdx = view[iBase + S.ENTANGLE_ID];
  if (partnerIdx < 0) return null;
  if (prng() >= 0.002 * k) return null;
  const energy = view[iBase + S.ENERGY] || 0;
  if (energy < 10) return null;
  const jBase = partnerIdx * PARTICLE_STRIDE;
  if (view[jBase + S.DEAD] >= 0.5 || (view[jBase + S.MASS] || 0) <= 0) {
    view[iBase + S.ENTANGLE_ID] = -1;
    view[iBase + S.ENTANGLE_PHASE] = 0;
    return null;
  }
  // Classical channel cost (one-tick delayed signalling is the sender's ENERGY).
  view[iBase + S.ENERGY] = Math.max(0, energy - 5);
  // Transfer the state to the entangled partner.
  view[jBase + S.VEL_X] = view[iBase + S.VEL_X];
  view[jBase + S.VEL_Y] = view[iBase + S.VEL_Y];
  view[jBase + S.VEL_Z] = view[iBase + S.VEL_Z];
  view[jBase + S.ENERGY] = Math.min(ENERGY_MAX, (view[jBase + S.ENERGY] || 0) + energy * 0.3);
  // Sender collapses to a jittered ground state — no clone remains.
  view[iBase + S.VEL_X] = (prng() - 0.5) * 0.4;
  view[iBase + S.VEL_Y] = (prng() - 0.5) * 0.4;
  view[iBase + S.VEL_Z] = (prng() - 0.5) * 0.4;
  // Link consumed.
  view[iBase + S.ENTANGLE_PHASE] = 0;
  view[iBase + S.ENTANGLE_ID] = -1;
  view[jBase + S.ENTANGLE_ID] = -1;
  view[jBase + S.ENTANGLE_PHASE] = 0;
  return null;
}

function applyObserver(view, iBase, jBase, k) {
  const memI = nanGuard(view[iBase + S.MEMORY]);
  if (memI > 0.5) {
    const vIx = nanGuard(view[iBase + S.VEL_X]);
    const vIy = nanGuard(view[iBase + S.VEL_Y]);
    const vIz = nanGuard(view[iBase + S.VEL_Z]);
    const vJx = nanGuard(view[jBase + S.VEL_X]);
    const vJy = nanGuard(view[jBase + S.VEL_Y]);
    const vJz = nanGuard(view[jBase + S.VEL_Z]);
    view[jBase + S.VEL_X] = vJx + (vIx - vJx) * 0.01 * k;
    view[jBase + S.VEL_Y] = vJy + (vIy - vJy) * 0.01 * k;
    view[jBase + S.VEL_Z] = vJz + (vIz - vJz) * 0.01 * k;
    view[jBase + S.MEMORY] = Math.max(nanGuard(view[jBase + S.MEMORY]), memI * 0.1);
  }
  return null;
}

function applyPlanck(view, iBase, k) {
  const q = Math.max(0.02, 0.1 * k);
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  view[iBase + S.VEL_X] = Math.sign(vx) * Math.round(Math.abs(vx) / q) * q;
  view[iBase + S.VEL_Y] = Math.sign(vy) * Math.round(Math.abs(vy) / q) * q;
  view[iBase + S.VEL_Z] = Math.sign(vz) * Math.round(Math.abs(vz) / q) * q;
  return null;
}

function applyCoherence(view, iBase, jBase, k) {
  const vIx = nanGuard(view[iBase + S.VEL_X]);
  const vIy = nanGuard(view[iBase + S.VEL_Y]);
  const vIz = nanGuard(view[iBase + S.VEL_Z]);
  const vJx = nanGuard(view[jBase + S.VEL_X]);
  const vJy = nanGuard(view[jBase + S.VEL_Y]);
  const vJz = nanGuard(view[jBase + S.VEL_Z]);
  const ddx = vIx - vJx;
  const ddy = vIy - vJy;
  const ddz = vIz - vJz;
  const diff = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
  if (diff < 1) {
    return {
      ax: clamp((vJx - vIx) * 0.02 * k, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp((vJy - vIy) * 0.02 * k, -FORCE_LIMIT, FORCE_LIMIT),
      az: clamp((vJz - vIz) * 0.02 * k, -FORCE_LIMIT, FORCE_LIMIT),
    };
  }
  return null;
}

function applyBosonic(view, iBase, jBase, dx, dy, dz, dist, k) {
  if (dist < 3) {
    const scale = (3 - dist) * k;
    const invDist = 1 / dist;
    return {
      ax: clamp(dx * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp(dy * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
      az: clamp(dz * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
    };
  }
  return null;
}

function applyFermionic(view, iBase, jBase, dx, dy, dz, dist, k) {
  const rSum = nanGuard(view[iBase + S.RADIUS]) + nanGuard(view[jBase + S.RADIUS]);
  if (dist < rSum) {
    const scale = (1 - dist / rSum) * k * 5;
    const invDist = 1 / dist;
    return {
      ax: clamp(-dx * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp(-dy * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
      az: clamp(-dz * invDist * scale, -FORCE_LIMIT, FORCE_LIMIT),
    };
  }
  return null;
}

function applySpin(view, iBase, k, prng) {
  const vx = nanGuard(view[iBase + S.VEL_X]);
  const vy = nanGuard(view[iBase + S.VEL_Y]);
  const vz = nanGuard(view[iBase + S.VEL_Z]);
  const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
  const sign = Math.floor(iBase / PARTICLE_STRIDE) % 2 === 0 ? 1 : -1;
  const amp = 0.1 * k * sign;
  if (speed > 0.1) {
    return {
      ax: clamp((-vy / speed) * amp, -FORCE_LIMIT, FORCE_LIMIT),
      ay: clamp((vx / speed) * amp, -FORCE_LIMIT, FORCE_LIMIT),
      az: 0,
    };
  }
  return {
    ax: clamp((prng() - 0.5) * 2 * amp, -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp((prng() - 0.5) * 2 * amp, -FORCE_LIMIT, FORCE_LIMIT),
    az: clamp((prng() - 0.5) * 2 * amp, -FORCE_LIMIT, FORCE_LIMIT),
  };
}

function applySpectral(view, iBase, k) {
  const species = nanGuard(view[iBase + S.SPECIES_ID]);
  view[iBase + S.SIGNAL] = clamp(nanGuard(view[iBase + S.SIGNAL]) + (0.001 + 0.001 * (species % 5)) * k, 0, SIGNAL_MAX);
  return null;
}

function applyWavefunction(view, iBase, k) {
  const q = Math.max(0.25, 0.5 * k);
  const px = nanGuard(view[iBase + S.POS_X]);
  const py = nanGuard(view[iBase + S.POS_Y]);
  const pz = nanGuard(view[iBase + S.POS_Z]);
  view[iBase + S.POS_X] = Math.round(px / q) * q;
  view[iBase + S.POS_Y] = Math.round(py / q) * q;
  view[iBase + S.POS_Z] = Math.round(pz / q) * q;
  return null;
}

function applyHyperplane(view, iBase, k) {
  return {
    ax: clamp(0.001 * k, -FORCE_LIMIT, FORCE_LIMIT),
    ay: clamp(0.0005 * k, -FORCE_LIMIT, FORCE_LIMIT),
    az: clamp(0.0002 * k, -FORCE_LIMIT, FORCE_LIMIT),
  };
}

function applyAntimatter(view, iBase, jBase, k) {
  const chargeI = nanGuard(view[iBase + S.CHARGE]);
  const chargeJ = nanGuard(view[jBase + S.CHARGE]);
  if ((chargeI > 0.1 && chargeJ < -0.1) || (chargeJ > 0.1 && chargeI < -0.1)) {
    view[iBase + S.DEAD] = 1;
    view[jBase + S.DEAD] = 1;
    view[iBase + S.SIGNAL] = Math.min(SIGNAL_MAX, nanGuard(view[iBase + S.SIGNAL]) + 10 * k);
    view[jBase + S.SIGNAL] = Math.min(SIGNAL_MAX, nanGuard(view[jBase + S.SIGNAL]) + 10 * k);
  }
  return null;
}

  return { applySuperposition, applyTunneling, applyDecoherence, applyWaveParticle, applyUncertainty, applyTeleport, applyObserver, applyPlanck, applyCoherence, applyBosonic, applyFermionic, applySpin, applySpectral, applyWavefunction, applyHyperplane, applyAntimatter };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/physics/solver.js
// ══════════════════════════════════════════════════════════════════════
__define('src/physics/solver.js', () => {// ============================================================================
// VEPA v3 — Physics Solver
// Processes one tick of the simulation: grid → pairwise forces → integration
// → lifecycle. All particle state lives in the Float32Array buffer.
// ============================================================================

const { PARTICLE_STRIDE, STRIDE_INDEXES, DNA_INDEXES, LAW_INDEXES, LAW_COUNT, WORLD_SIZE } = __import('src/constants.js');
const { runtimeConfig } = __import('src/state/runtimeConfig.js');
const { isAlive } = __import('src/state/particleBuffer.js');
const { isSet } = __import('src/state/lawState.js');
const { createGrid, clear, insert, getNeighbors } = __import('src/physics/spatialGrid.js');
const { applyGravity, applyCollision, applyAccretion, applyPlanetary, applyLifeCycle, applySignalDecay, applyAffinity, applyReproduction, applyChemistry, applyPolymer, applyHeatTransfer, applyThermalJitter, applyColdDamping, applyConvection, applyTimeDilation, applyDimensionality, applyChaos, applyOrder, applyFate, advanceFateClock, applyWill, applySoul, applySoulDecay, applyMind, applyVoid, applyBond, applyReduction, applyAlloy, applyTelepathy, applyClairvoyance, applyPrecognition, applyMelt, applyBoil, applyCondense, applyDeposit, applyExothermic, applyAstral, applyAstralInfluence, applyGlowEffect, applyEnergyTransfer, applyRadiationDamage, applyTrackingBehavior, applyPredation, applyGenotypeMutation, applyPhenotype, applySolvation, applySolvationEffect, applyAcidityEffect, applyOxidationEffect, applyIsomerization, applyChirality, applyCrystallization, applyPhaseRadiation, applySublimation, applySignalExchange, applyChargeForce, applyFieldDrift, applyCurrentTransfer, applyResistance, applyCapacitanceStore, applyStoredChargeForce, applyInductance, applyMagneticForce, applyResonanceForce, applyFluxForce, applyIonization, applyDischarge, applyPlasma, applySuperconductivity, applyMemoryRefresh, applyMemoryDecay, applyPatternForce, applyTrailWrite, applyStigmergyForce, applySignalBoost, applyLearnAlign, applySymbolForce, applyMetricForce, applyPredictForce, applyCodeBlend, applyProtocolSync, applyFeedback, applyLanguage, applyCulture, applySingularityForce, applySingularityAbsorb, applyEntanglePair, applyEntanglement, applyHistoryWrite, applyHistoryForce, applyHistoryCalc, setBuffer } = __import('src/physics/laws.js');
const { createSynergyCache } = __import('src/physics/synergy.js');
const { applyTide, applyFriction, applyElasticity, applyTurbulence, applyCentripetal, applyRotation } = __import('src/physics/lawgroups/physicsLaws.js');
const { applyAdiabatic, applyCompression, applyExpansion, applyEquilibrium, applyLatentHeat, applyRunaway } = __import('src/physics/lawgroups/thermoLaws.js');
const { applySymbiosis, applyParasite, applyHibernation, applyImmunity } = __import('src/physics/lawgroups/biologyLaws.js');
const { applyElectrolysis, applyPhotolysis, applyPrecipitation, applyNeutralization, applyStoichiometry, applyAutocatalysis } = __import('src/physics/lawgroups/chemistryLaws.js');
const { applyAntenna, applyShielding, applyPolarization } = __import('src/physics/lawgroups/emLaws.js');
const { applyNavigation, applyEncryption } = __import('src/physics/lawgroups/infoLaws.js');
const { applyConsciousness, applyPerception, applySynchronicity } = __import('src/physics/lawgroups/metaLaws.js');
const { applySuperposition, applyTunneling, applyDecoherence, applyWaveParticle, applyUncertainty, applyTeleport, applyObserver, applyPlanck, applyCoherence, applyBosonic, applyFermionic, applySpin, applySpectral, applyWavefunction, applyHyperplane, applyAntimatter } = __import('src/physics/lawgroups/quantumLaws.js');

// ── Solver Constants ──

const MAX_FORCE = 50.0;
const MAX_INTERACTIONS = 500;
const MAX_VELOCITY = 10.0;
// Gravity scaled with world size so gravitational pull stays effective at the
// larger inter-particle distances of a bigger world (baseline: 240³ world).
const G = 0.2 * (WORLD_SIZE / 240) ** 2;   // lower gravity so particles don't instantly clump
const DEFAULT_DT = 1.0;

/** Blend a neighbor's color into a subject particle (dissolution). */
function blendColor(view, subjBase, nbBase, ratio) {
  const si = STRIDE_INDEXES;
  view[subjBase + si.COLOR_R] += (view[nbBase + si.COLOR_R] - view[subjBase + si.COLOR_R]) * ratio;
  view[subjBase + si.COLOR_G] += (view[nbBase + si.COLOR_G] - view[subjBase + si.COLOR_G]) * ratio;
  view[subjBase + si.COLOR_B] += (view[nbBase + si.COLOR_B] - view[subjBase + si.COLOR_B]) * ratio;
}

// Preallocated neighbor buffer (avoids GC during solve)
const NEIGHBOR_BUF_SIZE = 2000;
const _neighborBuf = new Array(NEIGHBOR_BUF_SIZE);

// ── Spatial Grid (module-scoped, reused across ticks) ──

let _grid = null;

function ensureGrid() {
  if (!_grid) _grid = createGrid();
  return _grid;
}

// ── Read DNA cache from particle stride ──

function readDNAFromCache(view, base, dnaOut) {
  const start = STRIDE_INDEXES.DNA_CACHE_START;
  for (let d = 0; d < 42; d++) {
    dnaOut[d] = view[base + start + d];
  }
}

// ── Main Solver Entry ──

/**
 * Run one full physics tick.
 *
 * @param {Float32Array} particleBuffer - Particle state buffer (writable directly)
 * @param {number} particleCount - Number of particles in the buffer
 * @param {number} stride - Floats per particle (PARTICLE_STRIDE)
 * @param {{ lowFlags: Uint32Array, highFlags: Uint32Array, extFlags: Uint32Array }} lawState - Active laws
 * @param {Uint16Array} dnaBuffer - Species DNA buffer [64 × 64] (unused — DNA read from stride cache)
 * @param {number} worldSize - World boundary size
 * @param {number} dt - Time step (default 1.0)
 * @param {Function} prng - PRNG function returning [0,1)
 */
function solve(particleBuffer, particleCount, stride, lawState, dnaBuffer, worldSize, dt, prng) {
  const grid = ensureGrid();
  setBuffer(particleBuffer);
  const view = particleBuffer; // Float32Array or SharedArrayBuffer view
  const S = STRIDE_INDEXES;
  const halfWorld = worldSize * 0.5;
  dt = dt || DEFAULT_DT;

  // Zero laws active → hard freeze. Nothing moves, decays, reproduces, or
  // interacts: no integration, no friction, no signal emission/exchange, no
  // lifecycle. Movement and interaction only exist while a law governs them.
  if (
    lawState.lowFlags[0] === 0 &&
    lawState.highFlags[0] === 0 &&
    (lawState.extFlags ? lawState.extFlags[0] === 0 : true) &&
    (lawState.quadFlags ? lawState.quadFlags[0] === 0 : true)
  ) return;

  // Per-tick law cache — the law state is fixed for the whole tick, so the
  // synergy multipliers and on/off flags are pure functions of it. Computing
  // them once (128 entries) instead of per particle/pair removes tens of
  // thousands of branch chains per tick from the hot loops.
  const syn = createSynergyCache(lawState);
  const active = new Uint8Array(LAW_COUNT);
  for (let i = 0; i < LAW_COUNT; i++) active[i] = isSet(lawState, i) ? 1 : 0;

  // World parameters (WORLD panel sliders) — read live from runtimeConfig.
  const WP = runtimeConfig.worldParams || {};
  const effG = G * (Number.isFinite(WP.GLOBAL_G) ? WP.GLOBAL_G : 1);

  // Fate clock — advances once per tick so species destiny points wander.
  advanceFateClock(dt);

  // Reusable DNA cache array (avoids allocation per particle)
  const dnaI = new Array(42);
  const _dnaJ = new Array(42);

  // ── Phase 1: Build spatial grid from alive particles ──

  clear(grid);

  for (let i = 0; i < particleCount; i++) {
    const base = i * stride;
    if (view[base + S.DEAD] >= 0.5) continue; // skip dead/soul
    if (view[base + S.MASS] <= 0) continue;

    const px = view[base + S.POS_X];
    const py = view[base + S.POS_Y];
    const pz = view[base + S.POS_Z];

    if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz)) {
      insert(grid, i, px, py, pz, worldSize);
    }
  }

  // ── Phase 2: Compute time dilation per particle ──
  // v4.6.29: gravitational time dilation — the grid snapshot from Phase 1
  // feeds a softened potential (capped neighbourhood) so local time slows
  // beside massive bodies. Empty space runs at full speed.

  const localDt = new Float32Array(particleCount);
  const timeDilActive = active[LAW_INDEXES.TIME_DILATION];
  for (let i = 0; i < particleCount; i++) {
    const base = i * stride;
    let nBuf = null, nCount = 0;
    if (timeDilActive) {
      const px = view[base + S.POS_X];
      const py = view[base + S.POS_Y];
      const pz = view[base + S.POS_Z];
      if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz)) {
        nCount = Math.min(getNeighbors(grid, px, py, pz, worldSize, _neighborBuf), 24);
        nBuf = _neighborBuf;
      }
    }
    localDt[i] = applyTimeDilation(
      lawState, view, base,
      syn[LAW_INDEXES.TIME_DILATION], nBuf, nCount, worldSize
    );
  }

  // ── Phase 2b: Astral souls — ghosts persist and fade. Soul particles
  //    (DEAD=0.5) are excluded from the pairwise/integration loop, so they
  //    are processed here when the ASTRAL law governs them. ──
  if (active[LAW_INDEXES.ASTRAL]) {
    const astralSynergy = syn[LAW_INDEXES.ASTRAL];
    for (let i = 0; i < particleCount; i++) {
      const base = i * stride;
      if (view[base + S.DEAD] >= 0.5) {
        applyAstral(lawState, view, base, dt, astralSynergy);
        // Ghost influence on living neighbours (bounded by the spatial grid,
        // which only contains alive particles).
        const gx = view[base + S.POS_X];
        const gy = view[base + S.POS_Y];
        const gz = view[base + S.POS_Z];
        if (!Number.isFinite(gx) || !Number.isFinite(gy) || !Number.isFinite(gz)) continue;
        const soul = view[base + S.SOUL];
        if (!Number.isFinite(soul) || soul < 0.01) continue;
        const gCount = getNeighbors(grid, gx, gy, gz, worldSize, _neighborBuf);
        const gLimit = Math.min(gCount, MAX_INTERACTIONS);
        for (let n = 0; n < gLimit; n++) {
          const l = _neighborBuf[n];
          const lBase = l * stride;
          if (view[lBase + S.DEAD] >= 0.5) continue;
          let gdx = view[lBase + S.POS_X] - gx;
          let gdy = view[lBase + S.POS_Y] - gy;
          let gdz = view[lBase + S.POS_Z] - gz;
          if (gdx > halfWorld) gdx -= worldSize;
          else if (gdx < -halfWorld) gdx += worldSize;
          if (gdy > halfWorld) gdy -= worldSize;
          else if (gdy < -halfWorld) gdy += worldSize;
          if (gdz > halfWorld) gdz -= worldSize;
          else if (gdz < -halfWorld) gdz += worldSize;
          const gDist = Math.sqrt(gdx * gdx + gdy * gdy + gdz * gdz);
          if (gDist < 1 || gDist > 80) continue;
          applyAstralInfluence(lawState, view, base, lBase, gdx, gdy, gdz, gDist, astralSynergy, dt);
        }
      }
    }
  }

  // ── Phase 3: Pairwise interactions + integration ──

  for (let i = 0; i < particleCount; i++) {
    const iBase = i * stride;

    // Skip dead particles
    if (view[iBase + S.DEAD] >= 0.5) continue;
    if (view[iBase + S.MASS] <= 0) continue;

    const localTimeStep = dt * localDt[i];
    if (localTimeStep <= 0) continue;

    // Read particle i DNA from stride cache (already decoded floats)
    readDNAFromCache(view, iBase, dnaI);

    // Current position and velocity
    let px = view[iBase + S.POS_X];
    let py = view[iBase + S.POS_Y];
    let pz = view[iBase + S.POS_Z];
    let vx = view[iBase + S.VEL_X];
    let vy = view[iBase + S.VEL_Y];
    let vz = view[iBase + S.VEL_Z];
    let mass = view[iBase + S.MASS];
    if (mass <= 0) mass = 0.001;
    // Defensive: reset any corrupted position before grid lookups
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
      px = worldSize * 0.5 + (prng() - 0.5) * 10;
      py = worldSize * 0.5 + (prng() - 0.5) * 10;
      pz = worldSize * 0.5 + (prng() - 0.5) * 10;
      vx = 0; vy = 0; vz = 0;
    }

    // Accumulated force
    let ax = 0;
    let ay = 0;
    let az = 0;
    // DISCHARGE aim: net direction toward the most opposite stored charge.
    let ddx = 0;
    let ddy = 0;
    let ddz = 0;
    let iAbsorbed = false; // consumed by a singularity's event horizon

    // ── Pairwise neighbor loop ──

    const nCount = getNeighbors(grid, px, py, pz, worldSize, _neighborBuf);
    const limit = Math.min(nCount, MAX_INTERACTIONS);

    for (let n = 0; n < limit; n++) {
      const j = _neighborBuf[n];
      if (j === i) continue;

      const jBase = j * stride;

      // Skip dead neighbors
      if (view[jBase + S.DEAD] >= 0.5) continue;
      if (view[jBase + S.MASS] <= 0) continue;

      // Toroidal distance
      let dx = view[jBase + S.POS_X] - px;
      let dy = view[jBase + S.POS_Y] - py;
      let dz = view[jBase + S.POS_Z] - pz;

      // Wrap distance to [-halfWorld, halfWorld]
      if (dx > halfWorld) dx -= worldSize;
      else if (dx < -halfWorld) dx += worldSize;
      if (dy > halfWorld) dy -= worldSize;
      else if (dy < -halfWorld) dy += worldSize;
      if (dz > halfWorld) dz -= worldSize;
      else if (dz < -halfWorld) dz += worldSize;

      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq);

      // ── Gravity ──

      if (active[LAW_INDEXES.GRAV]) {
        const gravSynergy = syn[LAW_INDEXES.GRAV];
        const gravForce = applyGravity(iBase, jBase, dx, dy, dz, dist, effG * gravSynergy);
        if (gravForce) {
          // Gravitational collapse: stars pull nearby matter much harder
          const mI = view[iBase + S.MASS];
          const mJ = view[jBase + S.MASS];
          const bigM = Math.max(mI, mJ);
          if (bigM > runtimeConfig.starMass) {
            const collapseMult = 1.0 + (bigM - runtimeConfig.starMass) * 0.08;
            ax += gravForce.ax * collapseMult;
            ay += gravForce.ay * collapseMult;
            az += gravForce.az * collapseMult;
          } else {
            ax += gravForce.ax;
            ay += gravForce.ay;
            az += gravForce.az;
          }
        }
      }

      // ── Collision + Accretion + Fragmentation ──
      // COLL and ACCR are independent laws (confirmed batch-02 semantics):
      //  - COLL: softbody push + elastic bounce on overlap.
      //  - ACCR: mass fusion on overlap. FUSION_MOMENTUM DNA is the MINIMUM
      //    relative momentum required to fuse on impact — slower pairs bounce
      //    instead. FUSION_TIME DNA is how long sub-threshold pairs must stay
      //    in very close proximity before they fuse anyway (proximity dwell,
      //    tracked in the free MITOSIS_TIMER / PARTNER_ID stride fields).
      if (active[LAW_INDEXES.COLL] || active[LAW_INDEXES.ACCR]) {
        const m1 = view[iBase + S.MASS];
        const m2 = view[jBase + S.MASS];
        if (m1 <= 0 || m2 <= 0) continue;
        const r1 = view[iBase + S.RADIUS];
        const r2 = view[jBase + S.RADIUS];
        const overlap = (r1 + r2) - dist;
        const collOn = active[LAW_INDEXES.COLL];
        const accrOn = active[LAW_INDEXES.ACCR];

        // ACCR proximity-dwell bookkeeping: reset the timer whenever the
        // tracked partner leaves overlap range so "very close proximity"
        // means continuous contact, not a sum of separate grazes.
        if (accrOn) {
          const dwellPartner = view[iBase + S.PARTNER_ID] || -1;
          if (dwellPartner === j && !(overlap > 0 && dist > 0.01)) {
            view[iBase + S.MITOSIS_TIMER] = 0;
            view[iBase + S.PARTNER_ID] = -1;
          }
        }

        if (overlap > 0 && dist > 0.01) {
          // Collision normal (i → j)
          const invDist = 1.0 / dist;
          const nx = dx * invDist;
          const ny = dy * invDist;
          const nz = dz * invDist;

          // Relative velocity along normal
          const dvx = view[iBase + S.VEL_X] - view[jBase + S.VEL_X];
          const dvy = view[iBase + S.VEL_Y] - view[jBase + S.VEL_Y];
          const dvz = view[iBase + S.VEL_Z] - view[jBase + S.VEL_Z];
          const relVelN = dvx * nx + dvy * ny + dvz * nz;
          const relSpeed = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);

          // ── ACCR fusion gating (confirmed batch-02 semantics) ──
          // FUSION_MOMENTUM (DNA 16): minimum relative momentum to fuse on
          // impact; below it the pair bounces. FUSION_TIME (DNA 17): seconds
          // of continuous close proximity required for sub-threshold pairs
          // to fuse anyway.
          let fusing = false;
          if (accrOn) {
            const fusionMom = dnaI[DNA_INDEXES.FUSION_MOMENTUM] ?? 1.0;
            const fusionTime = dnaI[DNA_INDEXES.FUSION_TIME] ?? 2;
            const relMomentum = relSpeed * Math.min(m1, m2);
            fusing = relMomentum >= fusionMom;
            let dwell = view[iBase + S.MITOSIS_TIMER] || 0;
            if (!fusing) {
              if ((view[iBase + S.PARTNER_ID] || -1) === j) {
                dwell += localTimeStep;
              } else {
                dwell = localTimeStep;
                view[iBase + S.PARTNER_ID] = j;
              }
              if (dwell >= fusionTime) fusing = true;
            } else {
              dwell = 0;
              view[iBase + S.PARTNER_ID] = -1;
            }
            view[iBase + S.MITOSIS_TIMER] = dwell;
          }

          // ── COLL: softbody push + elastic bounce ──
          // Massive bodies squish instead of rigidly bouncing; fusing pairs
          // coalesce instead of bouncing apart.
          if (collOn && !fusing) {
            const isStarI = m1 > runtimeConfig.starMass;
            const isStarJ = m2 > runtimeConfig.starMass;
            const push = overlap * (isStarI || isStarJ ? 0.2 : 0.5);
            px -= nx * push;
            py -= ny * push;
            pz -= nz * push;

            // Bounce if approaching (relVelN > 0 along the i→j normal means
            // the pair is closing; a negative impulse along n separates them)
            if (relVelN > 0) {
              const elasticity = dnaI[DNA_INDEXES.ELASTICITY] || 0.5;
              const impulse = -(1 + elasticity) * relVelN / (m1 + m2);
              const bounceForce = impulse * m2;
              ax += bounceForce * nx;
              ay += bounceForce * ny;
              az += bounceForce * nz;
              // A collision is a measurement — collapse the wave (v4.6.29).
              if (active[LAW_INDEXES.WAVE_PARTICLE]) {
                view[iBase + S.WAVE_MEASURED] = 1;
                view[jBase + S.WAVE_MEASURED] = 1;
              }
            }
          } else if (accrOn && !collOn && relVelN > 0) {
            // Sub-threshold ACCR-only contact: the pair "bounces" — a gentle
            // elastic separation so matter does not silently pass through
            // while the dwell timer decides whether they fuse.
            const elasticity = dnaI[DNA_INDEXES.ELASTICITY] || 0.5;
            const impulse = -(1 + elasticity) * relVelN / (m1 + m2);
            const bounceForce = impulse * m2;
            ax += bounceForce * nx;
            ay += bounceForce * ny;
            az += bounceForce * nz;
          }

          // ── ACCR: softbody dissolution + gravitational collapse ──
          if (accrOn && fusing) {
            const isStarI = m1 > runtimeConfig.starMass;
            const isStarJ = m2 > runtimeConfig.starMass;
            // FUSION DNA (9): mass-merging efficiency multiplier (0..1 → 0.5..1.5).
            const fusionMult = 0.5 + (dnaI[DNA_INDEXES.FUSION] || 0.5);
            if (isStarI) {
              // Collapse: star pulls overlapping matter in and dissolves it
              const gain = (m2 * 0.04 + 0.02 * (m1 / runtimeConfig.starMass)) * fusionMult;
              view[iBase + S.MASS] += gain;
              view[jBase + S.MASS] = Math.max(0, m2 - gain);
              if (view[jBase + S.MASS] <= 0.05) view[jBase + S.DEAD] = 1.0;
              blendColor(view, iBase, jBase, gain / Math.max(view[iBase + S.MASS], 0.001));
              mass = view[iBase + S.MASS];
            } else if (isStarJ) {
              // Neighbor star dissolves this particle
              const loss = m1 * 0.04 * fusionMult;
              view[iBase + S.MASS] = Math.max(0, m1 - loss);
              view[jBase + S.MASS] += loss;
              if (view[iBase + S.MASS] <= 0.05) view[iBase + S.DEAD] = 1.0;
              mass = view[iBase + S.MASS];
            } else if (m1 > m2 * 2.0) {
              // Bigger body slowly absorbs the smaller (partial dissolution)
              const gain = m2 * 0.04 * fusionMult;
              view[iBase + S.MASS] += gain;
              view[jBase + S.MASS] = Math.max(0, m2 - gain);
              if (view[jBase + S.MASS] <= 0.05) view[jBase + S.DEAD] = 1.0;
              blendColor(view, iBase, jBase, gain / Math.max(view[iBase + S.MASS], 0.001));
              mass = view[iBase + S.MASS];
            } else if (m2 > m1 * 2.0) {
              // This particle dissolves into the bigger neighbor
              const loss = m1 * 0.04 * fusionMult;
              view[iBase + S.MASS] = Math.max(0, m1 - loss);
              view[jBase + S.MASS] += loss;
              if (view[iBase + S.MASS] <= 0.05) view[iBase + S.DEAD] = 1.0;
              mass = view[iBase + S.MASS];
            } else {
              // Similar size: mutual dissolution — blend mass and color
              const diff = (m2 - m1) * 0.02 * fusionMult;
              view[iBase + S.MASS] += diff;
              view[jBase + S.MASS] -= diff;
              mass = view[iBase + S.MASS];
              const cR = (view[iBase + S.COLOR_R] + view[jBase + S.COLOR_R]) * 0.5;
              const cG = (view[iBase + S.COLOR_G] + view[jBase + S.COLOR_G]) * 0.5;
              const cB = (view[iBase + S.COLOR_B] + view[jBase + S.COLOR_B]) * 0.5;
              view[iBase + S.COLOR_R] += (cR - view[iBase + S.COLOR_R]) * 0.1;
              view[iBase + S.COLOR_G] += (cG - view[iBase + S.COLOR_G]) * 0.1;
              view[iBase + S.COLOR_B] += (cB - view[iBase + S.COLOR_B]) * 0.1;
              view[jBase + S.COLOR_R] += (cR - view[jBase + S.COLOR_R]) * 0.1;
              view[jBase + S.COLOR_G] += (cG - view[jBase + S.COLOR_G]) * 0.1;
              view[jBase + S.COLOR_B] += (cB - view[jBase + S.COLOR_B]) * 0.1;
            }
          }
        }
      }

      // ── Affinity ──

      if (active[LAW_INDEXES.AFFINITY]) {
        const affinityForce = applyAffinity(lawState, view, iBase, jBase, dx, dy, dz, distSq, syn[LAW_INDEXES.AFFINITY]);
        if (affinityForce) {
          ax += affinityForce.ax;
          ay += affinityForce.ay;
          az += affinityForce.az;
        }
      }

      // ── Chemistry modifier ──

      if (
        active[LAW_INDEXES.CATALYSIS_LAW] ||
        active[LAW_INDEXES.SOLVATION] ||
        active[LAW_INDEXES.ACIDITY] ||
        active[LAW_INDEXES.CRYSTALLIZATION]
      ) {
        const chemMult = applyChemistry(lawState, view, iBase, jBase, distSq, syn[LAW_INDEXES.CATALYSIS_LAW]);
        if (chemMult !== 1.0) {
          ax *= chemMult;
          ay *= chemMult;
          az *= chemMult;
        }
      }

      // ── Polymer ──

      if (active[LAW_INDEXES.POLYMER]) {
        const polySynergy = syn[LAW_INDEXES.POLYMER];
        applyPolymer(lawState, view, iBase, jBase, dx, dy, dz, dist, polySynergy, stride);
      }



      // ── Bond ──

      if (active[LAW_INDEXES.BOND]) {
        const bondSynergy = syn[LAW_INDEXES.BOND];
        const bondForce = applyBond(lawState, view, iBase, jBase, stride, dx, dy, dz, dist, bondSynergy, nCount);
        if (bondForce) {
          ax += bondForce.ax;
          ay += bondForce.ay;
          az += bondForce.az;
        }
      }

      // ── Reduction ──

      if (active[LAW_INDEXES.REDUCTION]) {
        const redSynergy = syn[LAW_INDEXES.REDUCTION];
        applyReduction(iBase, jBase, stride, redSynergy);
      }

      // ── Alloy ──

      if (active[LAW_INDEXES.ALLOY]) {
        const alloySynergy = syn[LAW_INDEXES.ALLOY];
        applyAlloy(lawState, view, iBase, jBase, stride, dist, alloySynergy);
      }

      // ── Heat Transfer ──

      if (active[LAW_INDEXES.HEAT] || active[LAW_INDEXES.COLD]) {
        const heatSynergy = syn[LAW_INDEXES.HEAT];
        applyHeatTransfer(lawState, view, iBase, jBase, dist, localTimeStep, heatSynergy);
      }

      // ── Order ──

      if (active[LAW_INDEXES.ORDER]) {
        const orderForce = applyOrder(lawState, view, iBase, jBase, distSq, syn[LAW_INDEXES.ORDER]);
        if (orderForce) {
          ax += orderForce.ax;
          ay += orderForce.ay;
          az += orderForce.az;
        }
      }

      // ── Soul ──

      if (active[LAW_INDEXES.SOUL_LAW]) {
        const soulSynergy = syn[LAW_INDEXES.SOUL_LAW];
        applySoul(lawState, view, iBase, jBase, distSq, soulSynergy);
      }

      // ── Mind ──

      if (active[LAW_INDEXES.MIND]) {
        const mindSynergy = syn[LAW_INDEXES.MIND];
        const mindEffect = applyMind(lawState, view, iBase, jBase, distSq, mindSynergy);
        if (mindEffect && mindEffect.signalBoost) {
          view[iBase + S.SIGNAL] += mindEffect.signalBoost;
        }
      }

      // ── Energy Transfer ──
      if (active[LAW_INDEXES.ENERGY]) {
        const energySynergy = syn[LAW_INDEXES.ENERGY];
        applyEnergyTransfer(lawState, view, iBase, jBase, distSq, energySynergy);
      }

      // ── Solvation ──
      if (active[LAW_INDEXES.SOLVATION]) {
        const solvSynergy = syn[LAW_INDEXES.SOLVATION];
        const solvMult = applySolvationEffect(lawState, view, iBase, jBase, distSq, solvSynergy);
        if (solvMult !== 1.0) {
          ax *= solvMult;
          ay *= solvMult;
          az *= solvMult;
        }
        // Real-world solvation: solvent charge forces — opposite charges
        // attract, like charges repel (ions disperse through the medium).
        const solvForce = applySolvation(iBase, jBase, stride, dx, dy, dz, dist, solvSynergy);
        if (solvForce) {
          ax += solvForce.ax;
          ay += solvForce.ay;
          az += solvForce.az;
        }
      }

      // ── Acidity ──
      if (active[LAW_INDEXES.ACIDITY]) {
        const acidSynergy = syn[LAW_INDEXES.ACIDITY];
        applyAcidityEffect(lawState, view, iBase, jBase, localTimeStep, acidSynergy);
      }

      // ── Chirality ──
      if (active[LAW_INDEXES.CHIRALITY]) {
        const chirSynergy = syn[LAW_INDEXES.CHIRALITY];
        const chirForce = applyChirality(lawState, view, iBase, jBase, dx, dy, dz, dist, chirSynergy);
        if (chirForce) {
          ax += chirForce.ax;
          ay += chirForce.ay;
          az += chirForce.az;
        }
      }

      // ── Crystallization ──
      if (active[LAW_INDEXES.CRYSTALLIZATION]) {
        const crysSynergy = syn[LAW_INDEXES.CRYSTALLIZATION];
        const crysForce = applyCrystallization(lawState, view, iBase, jBase, dx, dy, dz, dist, crysSynergy);
        if (crysForce) {
          ax += crysForce.ax;
          ay += crysForce.ay;
          az += crysForce.az;
        }
      }

      // ── Signal exchange (communication DNA, gated by COMMS law) ──
      if (active[LAW_INDEXES.COMMS] && ((view[iBase + S.SIGNAL] || 0) > 0.01 || (view[jBase + S.SIGNAL] || 0) > 0.01)) {
        readDNAFromCache(view, jBase, _dnaJ);
        const sigForce = applySignalExchange(lawState, view, iBase, jBase, dx, dy, dz, dist, dnaI, _dnaJ, localTimeStep);
        if (sigForce) {
          ax += sigForce.ax;
          ay += sigForce.ay;
          az += sigForce.az;
        }
      }

      // ── Track ──
      if (active[LAW_INDEXES.TRACK]) {
        const trackSynergy = syn[LAW_INDEXES.TRACK];
        const trackForce = applyTrackingBehavior(lawState, view, iBase, jBase, dx, dy, dz, dist, trackSynergy);
        if (trackForce) {
          ax += trackForce.ax;
          ay += trackForce.ay;
          az += trackForce.az;
        }
      }

      // ── Predation (mass-difference pursuit + gene absorption) ──
      if (active[LAW_INDEXES.PREDATION]) {
        const predForce = applyPredation(iBase, jBase, stride, dx, dy, dz, dist, prng);
        if (predForce) {
          ax += predForce.ax;
          ay += predForce.ay;
          az += predForce.az;
        }
      }

      // Telepathy
      if (active[LAW_INDEXES.TELEPATHY]) {
        const telepathySynergy = syn[LAW_INDEXES.TELEPATHY];
        applyTelepathy(lawState, view, iBase, jBase, distSq, telepathySynergy, localTimeStep);
      }

      // Clairvoyance
      if (active[LAW_INDEXES.CLAIRVOYANCE]) {
        const clairvoyanceSynergy = syn[LAW_INDEXES.CLAIRVOYANCE];
        const clairForce = applyClairvoyance(lawState, view, iBase, jBase, dx, dy, dz, dist, clairvoyanceSynergy, localTimeStep);
        if (clairForce) {
          ax += clairForce.ax;
          ay += clairForce.ay;
          az += clairForce.az;
        }
      }

      // Precognition
      if (active[LAW_INDEXES.PRECOGNITION]) {
        const precogSynergy = syn[LAW_INDEXES.PRECOGNITION];
        const precogForce = applyPrecognition(lawState, view, iBase, jBase, dx, dy, dz, dist, precogSynergy, localTimeStep);
        if (precogForce) {
          ax += precogForce.ax;
          ay += precogForce.ay;
          az += precogForce.az;
        }
      }

      // ── Electromagnetism (pairwise) ──
      if (active[LAW_INDEXES.CHARGE_LAW]) {
        const chargeForce = applyChargeForce(iBase, jBase, dx, dy, dz, dist, 0.8 * syn[LAW_INDEXES.CHARGE_LAW]);
        if (chargeForce) {
          ax += chargeForce.ax;
          ay += chargeForce.ay;
          az += chargeForce.az;
        }
      }
      if (active[LAW_INDEXES.CAPACITANCE]) {
        const capForce = applyStoredChargeForce(iBase, jBase, dx, dy, dz, dist, 0.4);
        if (capForce) {
          ax += capForce.ax;
          ay += capForce.ay;
          az += capForce.az;
        }
      }
      if (active[LAW_INDEXES.MAGNETISM]) {
        const magForce = applyMagneticForce(iBase, jBase, dx, dy, dz, dist, 0.4 * syn[LAW_INDEXES.MAGNETISM]);
        if (magForce) {
          ax += magForce.ax;
          ay += magForce.ay;
          az += magForce.az;
        }
      }
      if (active[LAW_INDEXES.RESONANCE]) {
        const resForce = applyResonanceForce(iBase, jBase, dx, dy, dz, dist, 0.2);
        if (resForce) {
          ax += resForce.ax;
          ay += resForce.ay;
          az += resForce.az;
        }
      }
      if (active[LAW_INDEXES.FLUX]) {
        const fluxForce = applyFluxForce(iBase, jBase, dx, dy, dz, dist, 0.4);
        if (fluxForce) {
          ax += fluxForce.ax;
          ay += fluxForce.ay;
          az += fluxForce.az;
        }
      }
      if (active[LAW_INDEXES.INDUCTANCE]) applyInductance(iBase, jBase, dist, 0.05 * syn[LAW_INDEXES.INDUCTANCE]);
      if (active[LAW_INDEXES.CURRENT]) applyCurrentTransfer(iBase, jBase, distSq, 0.05 * syn[LAW_INDEXES.CURRENT]);
      if (active[LAW_INDEXES.IONIZATION]) {
        const relSpeed = Math.sqrt(
          (view[iBase + S.VEL_X] - view[jBase + S.VEL_X]) ** 2 +
          (view[iBase + S.VEL_Y] - view[jBase + S.VEL_Y]) ** 2 +
          (view[iBase + S.VEL_Z] - view[jBase + S.VEL_Z]) ** 2,
        );
        applyIonization(iBase, jBase, dist, relSpeed, 0.6 * syn[LAW_INDEXES.IONIZATION]);
      }
      if (active[LAW_INDEXES.DISCHARGE]) {
        // Spark direction: toward the neighbor whose stored charge is most
        // opposite to this particle's (the potential difference it will bridge).
        const ci = view[iBase + S.CHARGE] || 0;
        if (Math.abs(ci) >= 0.5) {
          const cj = view[jBase + S.CHARGE] || 0;
          const dq = cj - ci;
          const weight = (ci > 0 ? -dq : dq) / (dist + 1.0);
          if (weight > 0) {
            ddx += dx * weight;
            ddy += dy * weight;
            ddz += dz * weight;
          }
        }
      }

      // ── Information (pairwise) ──
      if (active[LAW_INDEXES.SYMBOL]) {
        const symForce = applySymbolForce(iBase, jBase, dx, dy, dz, dist, 0.3 * syn[LAW_INDEXES.SYMBOL]);
        if (symForce) {
          ax += symForce.ax;
          ay += symForce.ay;
          az += symForce.az;
        }
      }
      if (active[LAW_INDEXES.METRIC]) {
        const metForce = applyMetricForce(iBase, jBase, dx, dy, dz, dist, 0.2);
        if (metForce) {
          ax += metForce.ax;
          ay += metForce.ay;
          az += metForce.az;
        }
      }
      if (active[LAW_INDEXES.PREDICT]) {
        const predForce = applyPredictForce(iBase, jBase, dx, dy, dz, dist, 0.3 * syn[LAW_INDEXES.PREDICT]);
        if (predForce) {
          ax += predForce.ax;
          ay += predForce.ay;
          az += predForce.az;
        }
      }
      if (active[LAW_INDEXES.PATTERN]) {
        const patForce = applyPatternForce(iBase, jBase, dx, dy, dz, dist, 0.2);
        if (patForce) {
          ax += patForce.ax;
          ay += patForce.ay;
          az += patForce.az;
        }
      }
      if (active[LAW_INDEXES.STIGMERGY]) {
        const stigForce = applyStigmergyForce(iBase, jBase, 0.3 * syn[LAW_INDEXES.STIGMERGY]);
        if (stigForce) {
          ax += stigForce.ax;
          ay += stigForce.ay;
          az += stigForce.az;
        }
      }
      if (active[LAW_INDEXES.LEARN]) applyLearnAlign(iBase, jBase, 0.05 * syn[LAW_INDEXES.LEARN]);
      if (active[LAW_INDEXES.MEMORY]) applyMemoryRefresh(iBase, jBase);
      if (active[LAW_INDEXES.CODE]) applyCodeBlend(iBase, jBase, distSq, 0.05 * syn[LAW_INDEXES.CODE]);
      if (active[LAW_INDEXES.PROTOCOL]) applyProtocolSync(iBase, jBase, 0.1 * syn[LAW_INDEXES.PROTOCOL]);
      if (active[LAW_INDEXES.SIGNAL_BOOST]) applySignalBoost(iBase, jBase, 0.08 * syn[LAW_INDEXES.SIGNAL_BOOST]);
      if (active[LAW_INDEXES.SUPERCONDUCTIVITY]) {
        const scForce = applySuperconductivity(iBase, jBase, 0.05 * syn[LAW_INDEXES.SUPERCONDUCTIVITY]);
        if (scForce) {
          ax += scForce.ax;
          ay += scForce.ay;
          az += scForce.az;
        }
      }
      if (active[LAW_INDEXES.LANGUAGE]) applyLanguage(iBase, jBase, 0.25 * syn[LAW_INDEXES.LANGUAGE]);
      if (active[LAW_INDEXES.CULTURE]) applyCulture(iBase, jBase, 0.5 * syn[LAW_INDEXES.CULTURE]);

      // ── 8x16 expansion (pairwise) ──

      // Physics
      if (active[LAW_INDEXES.TIDE]) {
        const tideForce = applyTide(view, iBase, jBase, dx, dy, dz, dist, 0.3);
        if (tideForce) { ax += tideForce.ax; ay += tideForce.ay; az += tideForce.az; }
      }
      if (active[LAW_INDEXES.ELASTICITY]) {
        const elasForce = applyElasticity(view, iBase, jBase, dx, dy, dz, dist, 1.0);
        if (elasForce) { ax += elasForce.ax; ay += elasForce.ay; az += elasForce.az; }
      }

      // Biology
      if (active[LAW_INDEXES.SYMBIOSIS]) applySymbiosis(view, iBase, jBase, 0.5);
      if (active[LAW_INDEXES.PARASITE]) applyParasite(view, iBase, jBase, 0.5);

      // Chemistry
      if (active[LAW_INDEXES.ELECTROLYSIS]) applyElectrolysis(view, iBase, jBase, 0.5);
      if (active[LAW_INDEXES.PRECIPITATION]) applyPrecipitation(view, iBase, jBase, 0.5);
      if (active[LAW_INDEXES.NEUTRALIZATION]) applyNeutralization(view, iBase, jBase, 0.5);
      if (active[LAW_INDEXES.STOICHIOMETRY]) applyStoichiometry(view, iBase, jBase, 0.5);
      if (active[LAW_INDEXES.AUTOCATALYSIS]) applyAutocatalysis(view, iBase, jBase, 0.5);

      // Thermodynamics
      if (active[LAW_INDEXES.COMPRESSION]) applyCompression(view, iBase, jBase, dist, 0.5);
      if (active[LAW_INDEXES.EQUILIBRIUM]) applyEquilibrium(view, iBase, jBase, 0.3);

      // Electromagnetism
      if (active[LAW_INDEXES.POLARIZATION]) applyPolarization(view, iBase, jBase, 0.5);

      // Information
      if (active[LAW_INDEXES.NAVIGATION]) {
        const navForce = applyNavigation(view, iBase, jBase, dx, dy, dz, dist, 0.5);
        if (navForce) { ax += navForce.ax; ay += navForce.ay; az += navForce.az; }
      }

      // Metaphysics
      if (active[LAW_INDEXES.PERCEPTION]) {
        const perForce = applyPerception(view, iBase, jBase, dist, 0.5);
        if (perForce) { ax += perForce.ax; ay += perForce.ay; az += perForce.az; }
      }
      if (active[LAW_INDEXES.SYNCHRONICITY]) {
        const syncForce = applySynchronicity(view, iBase, jBase, 0.5);
        if (syncForce) { ax += syncForce.ax; ay += syncForce.ay; az += syncForce.az; }
      }

      // Quantum
      if (active[LAW_INDEXES.COHERENCE]) {
        const cohForce = applyCoherence(view, iBase, jBase, 0.5);
        if (cohForce) { ax += cohForce.ax; ay += cohForce.ay; az += cohForce.az; }
      }
      if (active[LAW_INDEXES.BOSONIC]) {
        const bosForce = applyBosonic(view, iBase, jBase, dx, dy, dz, dist, 0.5);
        if (bosForce) { ax += bosForce.ax; ay += bosForce.ay; az += bosForce.az; }
      }
      if (active[LAW_INDEXES.FERMIONIC]) {
        const ferForce = applyFermionic(view, iBase, jBase, dx, dy, dz, dist, 0.5);
        if (ferForce) { ax += ferForce.ax; ay += ferForce.ay; az += ferForce.az; }
      }
      if (active[LAW_INDEXES.OBSERVER]) {
        // WAVE_PARTICLE: a high-MEMORY observer measures the neighbour.
        if (active[LAW_INDEXES.WAVE_PARTICLE] && (view[iBase + S.MEMORY] || 0) > 0.5) {
          view[jBase + S.WAVE_MEASURED] = 1;
        }
        applyObserver(view, iBase, jBase, 0.5);
      }
      if (active[LAW_INDEXES.ANTIMATTER]) applyAntimatter(view, iBase, jBase, 0.5);

      // ── New law types (pairwise) ──

      // Singularity — extreme inward pull from a supermassive neighbour,
      // then absorption if i crosses the hole's event horizon.
      if (active[LAW_INDEXES.SINGULARITY]) {
        const singSynergy = syn[LAW_INDEXES.SINGULARITY];
        const singForce = applySingularityForce(iBase, jBase, dx, dy, dz, dist, 0.5 * singSynergy);
        if (singForce) {
          ax += singForce.ax;
          ay += singForce.ay;
          az += singForce.az;
        }
        if (applySingularityAbsorb(iBase, jBase, dist, singSynergy)) {
          iAbsorbed = true;
          break; // i was consumed — stop interacting with neighbours
        }
      }

      // Entanglement — touching particles forge a non-local quantum link.
      if (active[LAW_INDEXES.ENTANGLEMENT]) {
        applyEntanglePair(iBase, jBase, dist);
      }
    }

    // Consumed by an event horizon this tick — skip integration/lifecycle.
    if (iAbsorbed) continue;

    // Pairwise laws may mutate mass in-place (PREDATION absorption); fold any
    // such change into the local mass before integration and writeback.
    mass = view[iBase + S.MASS];
    if (!Number.isFinite(mass) || mass <= 0) mass = 0.001;

    // The collision/softbody pass pushes the local position directly; capture
    // that delta so per-particle position mutations can be folded in later
    // without discarding the push.
    const softbodyDX = px - view[iBase + S.POS_X];
    const softbodyDY = py - view[iBase + S.POS_Y];
    const softbodyDZ = pz - view[iBase + S.POS_Z];

    // ── Non-pairwise laws ──

    // Planetary gravity
    const planetSynergy = syn[LAW_INDEXES.PLANETARY];
    const planetForce = applyPlanetary(lawState, view, iBase, px, py, pz, worldSize, planetSynergy);
    if (planetForce) {
      ax += planetForce.ax;
      ay += planetForce.ay;
      az += planetForce.az;
    }

    // Void
    const voidSynergy = syn[LAW_INDEXES.VOID];
    const voidForce = applyVoid(lawState, view, iBase, px, py, pz, worldSize, voidSynergy);
    if (voidForce) {
      ax += voidForce.ax;
      ay += voidForce.ay;
      az += voidForce.az;
    }

    // Dimensionality
    vz += applyDimensionality(lawState, view, iBase, prng, localTimeStep,
      syn[LAW_INDEXES.DIMENSIONALITY]);

    // Chaos (deterministic Lorenz map — v4.6.29, no PRNG)
    applyChaos(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.CHAOS]);

    // Soul decay — souls dissipate slowly unless replenished
    applySoulDecay(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.SOUL_LAW]);

    // Fate — per-species drifting destiny point
    const fateForce = applyFate(lawState, view, iBase, px, py, pz, worldSize,
      syn[LAW_INDEXES.FATE]);
    if (fateForce) {
      ax += fateForce.ax;
      ay += fateForce.ay;
      az += fateForce.az;
    }

    // ── Electromagnetism (per-particle) ──
    if (active[LAW_INDEXES.FIELD]) {
      const fieldForce = applyFieldDrift(iBase, 0.3 * syn[LAW_INDEXES.FIELD]);
      if (fieldForce) {
        ax += fieldForce.ax;
        ay += fieldForce.ay;
        az += fieldForce.az;
      }
    }
    if (active[LAW_INDEXES.RESISTANCE]) {
      const resForce = applyResistance(iBase, vx, vy, vz, 0.03 * syn[LAW_INDEXES.RESISTANCE]);
      if (resForce) {
        ax += resForce.ax;
        ay += resForce.ay;
        az += resForce.az;
      }
    }
    if (active[LAW_INDEXES.CAPACITANCE]) {
      applyCapacitanceStore(iBase, 0.002);
    }
    if (active[LAW_INDEXES.DISCHARGE]) {
      const discForce = applyDischarge(iBase, prng, 0.8 * syn[LAW_INDEXES.DISCHARGE], ddx, ddy, ddz);
      if (discForce) {
        ax += discForce.ax;
        ay += discForce.ay;
        az += discForce.az;
      }
    }
    if (active[LAW_INDEXES.PLASMA]) {
      applyPlasma(iBase, 0.02 * syn[LAW_INDEXES.PLASMA]);
    }

    // ── Information (per-particle) ──
    if (active[LAW_INDEXES.STIGMERGY]) {
      applyTrailWrite(iBase, px, py, pz, vx, vy, vz);
    }
    if (active[LAW_INDEXES.MEMORY]) {
      applyMemoryDecay(iBase, 0.995, 0.5);
    }
    if (active[LAW_INDEXES.FEEDBACK]) {
      const fbForce = applyFeedback(iBase, 0.5 * syn[LAW_INDEXES.FEEDBACK]);
      if (fbForce) {
        ax += fbForce.ax;
        ay += fbForce.ay;
        az += fbForce.az;
      }
    }

    // ── 8x16 expansion (per-particle) ──
    const center = worldSize * 0.5;

    // Physics
    if (active[LAW_INDEXES.FRICTION]) {
      const frForce = applyFriction(view, iBase, 0.05);
      if (frForce) { ax += frForce.ax; ay += frForce.ay; az += frForce.az; }
    }
    if (active[LAW_INDEXES.TURBULENCE]) {
      const tbForce = applyTurbulence(view, iBase, 0.05, prng);
      if (tbForce) { ax += tbForce.ax; ay += tbForce.ay; az += tbForce.az; }
    }
    if (active[LAW_INDEXES.CENTRIPETAL]) {
      const cpForce = applyCentripetal(view, iBase, center, center, center, 0.0005);
      if (cpForce) { ax += cpForce.ax; ay += cpForce.ay; az += cpForce.az; }
    }
    if (active[LAW_INDEXES.ROTATION]) {
      const rotForce = applyRotation(view, iBase, center, center, center, 0.002);
      if (rotForce) { ax += rotForce.ax; ay += rotForce.ay; az += rotForce.az; }
    }

    // Biology
    if (active[LAW_INDEXES.HIBERNATION]) {
      const hibForce = applyHibernation(view, iBase, 0.5);
      if (hibForce) { ax += hibForce.ax; ay += hibForce.ay; az += hibForce.az; }
    }
    if (active[LAW_INDEXES.IMMUNITY]) applyImmunity(view, iBase, 0.5);

    // Chemistry
    if (active[LAW_INDEXES.PHOTOLYSIS]) applyPhotolysis(view, iBase, 0.5);

    // Thermodynamics
    if (active[LAW_INDEXES.ADIABATIC]) {
      const adForce = applyAdiabatic(view, iBase, 0.1);
      if (adForce) { ax += adForce.ax; ay += adForce.ay; az += adForce.az; }
    }
    if (active[LAW_INDEXES.LATENT_HEAT]) applyLatentHeat(view, iBase, 0.1);
    if (active[LAW_INDEXES.RUNAWAY]) applyRunaway(view, iBase, 0.1);

    // Metaphysics
    if (active[LAW_INDEXES.CONSCIOUSNESS]) applyConsciousness(view, iBase, 0.5);

    // Electromagnetism
    if (active[LAW_INDEXES.ANTENNA]) applyAntenna(view, iBase, 0.5);
    if (active[LAW_INDEXES.SHIELDING]) applyShielding(view, iBase, 0.5);

    // Information
    if (active[LAW_INDEXES.ENCRYPTION]) applyEncryption(view, iBase, 0.5);

    // Quantum
    if (active[LAW_INDEXES.SUPERPOSITION]) {
      const supForce = applySuperposition(view, iBase, 0.05, prng);
      if (supForce) { ax += supForce.ax; ay += supForce.ay; az += supForce.az; }
    }
    if (active[LAW_INDEXES.TUNNELING]) applyTunneling(view, iBase, 0.5, prng);
    if (active[LAW_INDEXES.DECOHERENCE]) {
      const decForce = applyDecoherence(view, iBase, 0.1);
      if (decForce) { ax += decForce.ax; ay += decForce.ay; az += decForce.az; }
    }
    if (active[LAW_INDEXES.WAVE_PARTICLE]) {
      const wpForce = applyWaveParticle(view, iBase, 0.1);
      if (wpForce) { ax += wpForce.ax; ay += wpForce.ay; az += wpForce.az; }
    }
    if (active[LAW_INDEXES.UNCERTAINTY]) {
      const uncForce = applyUncertainty(view, iBase, 0.1, prng);
      if (uncForce) { ax += uncForce.ax; ay += uncForce.ay; az += uncForce.az; }
    }
    if (active[LAW_INDEXES.TELEPORT]) applyTeleport(view, iBase, 0.5, prng);
    if (active[LAW_INDEXES.PLANCK]) applyPlanck(view, iBase, 0.5);
    if (active[LAW_INDEXES.SPIN]) {
      const spinForce = applySpin(view, iBase, 0.05, prng);
      if (spinForce) { ax += spinForce.ax; ay += spinForce.ay; az += spinForce.az; }
    }
    if (active[LAW_INDEXES.SPECTRAL]) applySpectral(view, iBase, 0.5);
    if (active[LAW_INDEXES.WAVEFUNCTION]) applyWavefunction(view, iBase, 0.5);
    if (active[LAW_INDEXES.HYPERPLANE]) {
      const hypForce = applyHyperplane(view, iBase, 1.0);
      if (hypForce) { ax += hypForce.ax; ay += hypForce.ay; az += hypForce.az; }
    }

    // Per-particle laws may mutate position in-place (TUNNELING, UNCERTAINTY,
    // TELEPORT, WAVEFUNCTION); fold those changes into the local position so
    // later phases and the final writeback see them — while keeping the
    // collision/softbody push captured above.
    px = view[iBase + S.POS_X] + softbodyDX;
    py = view[iBase + S.POS_Y] + softbodyDY;
    pz = view[iBase + S.POS_Z] + softbodyDZ;

    // ── New law types (per-particle) ──

    // Entanglement — correlated link lifecycle only (no-signaling): no forces,
    // no signal relay; the pair's shared phase decoheres and collapses on both
    // sides when a partner dies or the correlation expires.
    if (active[LAW_INDEXES.ENTANGLEMENT]) {
      applyEntanglement(iBase);
    }

    // History — write presence into the spatial memory field, then drift
    // along the local memory-field gradient (archaeology as a force).
    if (active[LAW_INDEXES.HISTORY]) {
      applyHistoryWrite(iBase, px, py, pz, worldSize);
      const histForce = applyHistoryForce(iBase, px, py, pz, worldSize, 0.8 * syn[LAW_INDEXES.HISTORY]);
      if (histForce) {
        ax += histForce.ax;
        ay += histForce.ay;
        az += histForce.az;
      }
    }

    // ── Drag ──

    if (active[LAW_INDEXES.DRAG]) {
      const viscosity = (dnaI[DNA_INDEXES.VISCOSITY] || 0.98) * (Number.isFinite(WP.VISCOSITY) ? WP.VISCOSITY : 1);
      const dragFactor = Math.pow(viscosity, localTimeStep);
      ax -= vx * (1 - dragFactor) * 10;
      ay -= vy * (1 - dragFactor) * 10;
      az -= vz * (1 - dragFactor) * 10;

      // FRICTION DNA = velocity-dependent drag — same law family (kinetic
      // dampening). Gated with DRAG so no movement effect runs lawless.
      const friction = dnaI[DNA_INDEXES.FRICTION] || 0.01;
      ax -= vx * friction;
      ay -= vy * friction;
      az -= vz * friction;
    }

    // Entropy (jitter)
    if (active[LAW_INDEXES.ENTR]) {
      const jitter = (dnaI[DNA_INDEXES.JITTER] || 0.05) * (Number.isFinite(WP.ENTROPY) ? WP.ENTROPY : 1);
      const jitterMult = syn[LAW_INDEXES.ENTR];
      ax += (prng() - 0.5) * jitter * jitterMult * localTimeStep;
      ay += (prng() - 0.5) * jitter * jitterMult * localTimeStep;
      az += (prng() - 0.5) * jitter * jitterMult * 0.3 * localTimeStep;
    }

    // ── Force clamping (goal-engine tunable ceiling + global force scale) ──

    ax *= runtimeConfig.forceScale;
    ay *= runtimeConfig.forceScale;
    az *= runtimeConfig.forceScale;
    const forceMag = Math.sqrt(ax * ax + ay * ay + az * az);
    const forceCap = Math.min(MAX_FORCE, Math.max(0.1, runtimeConfig.maxForce));
    if (forceMag > forceCap) {
      const scale = forceCap / forceMag;
      ax *= scale;
      ay *= scale;
      az *= scale;
    }

    // ── Integration: velocity (apply forces) ──

    const inertia = dnaI[DNA_INDEXES.INERTIA] || 1.0;
    const invMass = 1.0 / mass;
    // Laws that wrote velocity deltas directly to the buffer during force
    // accumulation (CHAOS, DIMENSIONALITY, thermal currents) must be folded
    // into the local velocity before integration.
    vx = view[iBase + S.VEL_X];
    vy = view[iBase + S.VEL_Y];
    vz = view[iBase + S.VEL_Z];
    vx += (ax * localTimeStep * invMass) / inertia;
    vy += (ay * localTimeStep * invMass) / inertia;
    vz += (az * localTimeStep * invMass) / inertia;

    // Will — self-propulsion (applies boost along current velocity)
    const preWillVx = view[iBase + S.VEL_X];
    const preWillVy = view[iBase + S.VEL_Y];
    const preWillVz = view[iBase + S.VEL_Z];
    applyWill(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.WILL]);
    // Fold Will's in-place boost into the local velocity copy.
    vx += view[iBase + S.VEL_X] - preWillVx;
    vy += view[iBase + S.VEL_Y] - preWillVy;
    vz += view[iBase + S.VEL_Z] - preWillVz;

    // ── Global drag multiplier (goal-engine tunable) — gated by DRAG ──

    if (active[LAW_INDEXES.DRAG]) {
      vx *= runtimeConfig.dragMultiplier;
      vy *= runtimeConfig.dragMultiplier;
      vz *= runtimeConfig.dragMultiplier;
    }

    // ── World params: WIND (constant +X drift) + DAMPING (global decay) ──

    const worldDamp = Math.pow(1 - (Number.isFinite(WP.DAMPING) ? WP.DAMPING : 0) / 100, localTimeStep);
    if (worldDamp !== 1) {
      vx *= worldDamp;
      vy *= worldDamp;
      vz *= worldDamp;
    }
    if (WP.WIND) vx += WP.WIND * 0.5 * localTimeStep;

    // ── TORQUE DNA: rotational momentum — gently rotate the velocity vector
    //    around the Z axis (higher |TORQUE| = faster spin; sign = direction) ──
    const torque = dnaI[DNA_INDEXES.TORQUE] || 0;
    if (Math.abs(torque) > 0.001) {
      const ang = torque * 0.02 * localTimeStep;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const tvx = vx * c - vy * s;
      const tvy = vx * s + vy * c;
      vx = tvx;
      vy = tvy;
    }

    // ── Integration: position ──

    px += vx * localTimeStep;
    py += vy * localTimeStep;
    pz += vz * localTimeStep;

    // ── Velocity clamping ──
    // Runs AFTER the position step so wall-bounce velocities (set in the soft-
    // wall block below, e.g. WALL_REFLECT 2 → 200% bounce) get to move the
    // particle for one tick before the hard MAX_VELOCITY cap reins them in.

    const dnaMaxVel = dnaI[DNA_INDEXES.MAX_VELOCITY] || MAX_VELOCITY;
    const velLimit = Math.min(dnaMaxVel, MAX_VELOCITY);
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed > velLimit) {
      const vScale = velLimit / speed;
      vx *= vScale;
      vy *= vScale;
      vz *= vScale;
    }

    // ── Toroidal wrapping ──

    if (active[LAW_INDEXES.WRAP]) {
      px = ((px % worldSize) + worldSize) % worldSize;
      py = ((py % worldSize) + worldSize) % worldSize;
      pz = ((pz % worldSize) + worldSize) % worldSize;
    } else {
      // Clamp to world bounds (soft wall). WALL_REFLECT slider: 0 = 100%
      // absorption, 1 = 100% reflect (default), 2 = 200% reflect.
      const wallReflect = Number.isFinite(WP.WALL_REFLECT) ? WP.WALL_REFLECT : 1;
      if (px < 0) { px = 0; vx = Math.abs(vx) * wallReflect; }
      else if (px >= worldSize) { px = worldSize - 0.01; vx = -Math.abs(vx) * wallReflect; }
      if (py < 0) { py = 0; vy = Math.abs(vy) * wallReflect; }
      else if (py >= worldSize) { py = worldSize - 0.01; vy = -Math.abs(vy) * wallReflect; }
      if (pz < 0) { pz = 0; vz = Math.abs(vz) * wallReflect; }
      else if (pz >= worldSize) { pz = worldSize - 0.01; vz = -Math.abs(vz) * wallReflect; }
    }

    // ── NaN guard ──

    if (
      !Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz) ||
      !Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz) ||
      !Number.isFinite(mass)
    ) {
      px = worldSize * 0.5 + (prng() - 0.5) * 10;
      py = worldSize * 0.5 + (prng() - 0.5) * 10;
      pz = worldSize * 0.5 + (prng() - 0.5) * 10;
      vx = 0;
      vy = 0;
      vz = 0;
      mass = 1.0;
    }

    // ── Write back to buffer ──

    // Bond/Polymer non-overlap constraint
    if (active[LAW_INDEXES.BOND] || active[LAW_INDEXES.POLYMER]) {
      const nCount2 = getNeighbors(grid, px, py, pz, worldSize, _neighborBuf);
      for (let n2 = 0; n2 < Math.min(nCount2, MAX_INTERACTIONS); n2++) {
        const bj = _neighborBuf[n2];
        if (bj === i) continue;
        const bPtr = bj * stride;
        if (view[bPtr + S.DEAD] >= 0.5) continue;
        
        let bx = view[bPtr + S.POS_X] - px;
        let by = view[bPtr + S.POS_Y] - py;
        let bz = view[bPtr + S.POS_Z] - pz;
        
        if (bx > halfWorld) bx -= worldSize; else if (bx < -halfWorld) bx += worldSize;
        if (by > halfWorld) by -= worldSize; else if (by < -halfWorld) by += worldSize;
        if (bz > halfWorld) bz -= worldSize; else if (bz < -halfWorld) bz += worldSize;
        
        const bd2 = bx*bx + by*by + bz*bz;
        const bd = Math.sqrt(bd2 + 0.001);
        const rA = view[iBase + S.RADIUS] || 1.0;
        const rB = view[bPtr + S.RADIUS] || 1.0;
        const minDist = (rA + rB) * 1.0;
        
        if (bd < minDist) {
          const overlap = minDist - bd;
          const mTotal = mass + view[bPtr + S.MASS];
          const ratio = view[bPtr + S.MASS] / Math.max(mTotal, 0.001);
          px -= (bx/bd) * overlap * ratio;
          py -= (by/bd) * overlap * ratio;
          pz -= (bz/bd) * overlap * ratio;
        }
        
        // Bond equilibrium distance
        if (active[LAW_INDEXES.BOND]) {
          const sI = view[iBase + S.SPECIES_ID];
          const sB = view[bPtr + S.SPECIES_ID];
          const aff = dnaI[DNA_INDEXES.SPECIES_AFFINITY] || 0;
          if ((sI === sB && aff >= 0) || (sI !== sB && aff < 0)) {
            // BOND_ANGLE DNA (31): favoured cluster geometry — wider angles
            // reach farther, so the equilibrium bond distance stretches.
            const bondAngle = dnaI[DNA_INDEXES.BOND_ANGLE] || 0;
            const angleScale = 1 + Math.min(1, Math.abs(bondAngle) / 120);
            const eqDist = ((dnaI[DNA_INDEXES.BASE_RADIUS] || 5) * 2.5 + (view[bPtr + S.DNA_CACHE_START + DNA_INDEXES.BASE_RADIUS] || 5) * 2.5) * angleScale;
            if (bd > eqDist && bd > 0.1) {
              const stiffness = dnaI[DNA_INDEXES.STIFFNESS] || 0.5;
              const pull = (bd - eqDist) * stiffness * 0.15;
              px += (bx/bd) * pull * 0.5;
              py += (by/bd) * pull * 0.5;
              pz += (bz/bd) * pull * 0.5;
            }
          }
        }
      }
    }

    // Final NaN guard — the bond/polymer block runs after the first guard
    if (
      !Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz) ||
      !Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz) ||
      !Number.isFinite(mass)
    ) {
      px = worldSize * 0.5; py = worldSize * 0.5; pz = worldSize * 0.5;
      vx = 0; vy = 0; vz = 0; mass = 1.0;
    }
    view[iBase + S.POS_X] = px;
    view[iBase + S.POS_Y] = py;
    view[iBase + S.POS_Z] = pz;
    view[iBase + S.VEL_X] = vx;
    view[iBase + S.VEL_Y] = vy;
    view[iBase + S.VEL_Z] = vz;
    // Laws may have modified particle mass in-place during the pair loop
    // (ALLOY fusion, accretion, chemistry mass transfer); fold the buffer
    // value back into the local copy so the writeback and radius update
    // reflect it.
    mass = view[iBase + S.MASS];
    view[iBase + S.MASS] = mass;
    // Age is the particle's own time coordinate (frame count since birth),
    // advanced here so oscillator phases and lifecycle gating progress with
    // or without the LIFE law. Frozen entirely when no laws are active.
    view[iBase + S.AGE] = (view[iBase + S.AGE] || 0) + localTimeStep;

    // ── Signal decay (emission + decay, gated by COMMS law) ──

    if (active[LAW_INDEXES.COMMS]) {
      applySignalDecay(lawState, view, iBase, dnaI, localTimeStep);
    }

    // ── Life cycle ──

    applyLifeCycle(lawState, view, iBase, dnaI, localTimeStep, prng,
      syn[LAW_INDEXES.LIFE] * runtimeConfig.deathRate, dnaBuffer);

    // ── Glow ──
    applyGlowEffect(lawState, view, iBase, dnaI, localTimeStep,
      syn[LAW_INDEXES.GLOW]);

    // ── Genotype ──
    applyGenotypeMutation(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.GENOTYPE], prng, dnaBuffer);

    // ── Radiation ──
    applyRadiationDamage(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.RADIATION], prng);

    // ── Phenotype ──
    applyPhenotype(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.PHENOTYPE]);

    // ── Oxidation ──
    applyOxidationEffect(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.OXIDATION]);

    // ── Isomerization ──
    applyIsomerization(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.ISOMERIZATION], prng, stride);

    // ── Phase Radiation ──
    applyPhaseRadiation(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.PHASE_RADIATION]);

    // ── Sublimation ──
    applySublimation(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.SUBLIMATION], prng);

    // ── Thermal jitter (HEAT) ──

    applyThermalJitter(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.HEAT], prng);

    // ── Cold damping (COLD) ──

    applyColdDamping(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.COLD]);

    // ── Convection ──

    applyConvection(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.CONVECTION]);

    // ── Reproduction ──

    const offspring = applyReproduction(lawState, view, iBase, dnaI, prng,
      syn[LAW_INDEXES.REPRO] * runtimeConfig.birthRate, dnaBuffer, localTimeStep);
    if (offspring) {
      _offspringRing[_ringWrite] = offspring;
      _ringWrite = (_ringWrite + 1) % OFFSPRING_RING_SIZE;
    }

    // ── Update radius from mass ──

    const baseRadius = dnaI[DNA_INDEXES.BASE_RADIUS] || 2.0;
    let radiusOut = baseRadius * Math.pow(mass, 0.333);
    if (active[LAW_INDEXES.PHENOTYPE]) {
      const energy = view[iBase + S.ENERGY];
      if (Number.isFinite(energy)) {
        radiusOut *= 1 + (energy / 200 - 0.5) * 0.5 * syn[LAW_INDEXES.PHENOTYPE];
      }
    }
    view[iBase + S.RADIUS] = radiusOut;

    // ── Expansion (runs after the mass-derived radius update so its growth
    //    toward the DNA base radius is not overwritten) ──
    if (active[LAW_INDEXES.EXPANSION]) applyExpansion(view, iBase, 0.1);

    // ── Melt ──
    applyMelt(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.MELT], dnaBuffer);

    // ── Boil ──
    applyBoil(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.BOIL], prng);

    // ── Condense ──
    applyCondense(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.CONDENSE]);

    // ── Deposit ──
    applyDeposit(lawState, view, iBase, localTimeStep,
      syn[LAW_INDEXES.DEPOSIT]);

    // ── Exothermic ──
    applyExothermic(lawState, view, iBase,
      localTimeStep, syn[LAW_INDEXES.EXOTHERMIC]);

  }

  // ── History — advance the memory-field clock once per solve ──
  if (active[LAW_INDEXES.HISTORY]) {
    applyHistoryCalc();
  }
}

// ── Offspring Ring Buffer ──

const OFFSPRING_RING_SIZE = 256;
const _offspringRing = new Array(OFFSPRING_RING_SIZE);
let _ringWrite = 0;
let _ringRead = 0;

/**
 * Drain any offspring produced during the last solve tick.
 * @returns {object[]} Array of offspring data objects
 */
function drainOffspring() {
  const result = [];
  while (_ringRead !== _ringWrite) {
    const offspring = _offspringRing[_ringRead];
    if (offspring) result.push(offspring);
    _offspringRing[_ringRead] = null;
    _ringRead = (_ringRead + 1) % OFFSPRING_RING_SIZE;
  }
  return result;
}

/**
 * Reset the offspring ring (call on init/restart).
 */
function resetOffspringRing() {
  _ringWrite = 0;
  _ringRead = 0;
  for (let i = 0; i < OFFSPRING_RING_SIZE; i++) {
    _offspringRing[i] = null;
  }
}

/**
 * Read DNA parameters for a species from the DNA buffer.
 * Returns an array of 42 float values.
 *
 * @param {Uint16Array} dnaBuffer - Species DNA buffer [64 × 64]
 * @param {number} speciesId - Species index (0-63)
 * @returns {number[]}
 */
function readSpeciesDNA(dnaBuffer, speciesId) {
  const base = speciesId * 64;
  const dna = new Array(42);
  for (let d = 0; d < 42; d++) {
    dna[d] = dnaBuffer[base + d] || 0;
  }
  return dna;
}

  return { solve, drainOffspring, resetOffspringRing, readSpeciesDNA };
});

// ══════════════════════════════════════════════════════════════════════
// FILE: src/spawn/distribution.js
// ══════════════════════════════════════════════════════════════════════
__define('src/spawn/distribution.js', () => {/**
 * VEPA4 — Spawn distribution sampling (pure, testable)
 *
 * The WORLD panel distribution sliders (SHAPE / SPAWN_CENTRES /
 * SPAWN_CENTRE_RANDOM / SPAWN_CENTRE_BIAS / GROUND_HEIGHT) drive these
 * functions. Kept free of DOM/main-thread state so the audit suite can
 * validate each slider deterministically.
 */
const { DEFAULT_PARTICLES_PER_SPECIES } = __import('src/constants.js');

/**
 * Compute spawn cluster centres across the world volume.
 * count 1 → single centre at the middle of the dish.
 * random 0 → centres evenly spaced on a grid; 1 → random placement.
 */
function buildSpawnCentres(count, random, worldSize, prng) {
  const r = Math.max(0, Math.min(1, random));
  const centres = [];
  if (count <= 1) {
    centres.push({ x: worldSize * 0.5, y: worldSize * 0.5, z: worldSize * 0.5 });
    return centres;
  }
  const gridDim = Math.max(2, Math.ceil(Math.cbrt(count)));
  const cellSize = (worldSize - 20) / gridDim;
  for (let c = 0; c < count; c++) {
    const gx = c % gridDim;
    const gy = Math.floor(c / gridDim) % gridDim;
    const gz = Math.floor(c / (gridDim * gridDim));
    const bx = 10 + gx * cellSize + cellSize * 0.5;
    const by = 10 + gy * cellSize + cellSize * 0.5;
    const bz = 10 + gz * cellSize + cellSize * 0.5;
    const rx = prng.nextFloat ? prng.nextFloat(0, worldSize) : prng() * worldSize;
    const ry = prng.nextFloat ? prng.nextFloat(0, worldSize) : prng() * worldSize;
    const rz = prng.nextFloat ? prng.nextFloat(0, worldSize) : prng() * worldSize;
    centres.push({
      x: bx + (rx - bx) * r,
      y: by + (ry - by) * r,
      z: bz + (rz - bz) * r,
    });
  }
  return centres;
}

/**
 * Sample a random spawn point from the configured distribution.
 * cfg: world params object (SHAPE, SPAWN_CENTRES, SPAWN_CENTRE_RANDOM,
 *      SPAWN_CENTRE_BIAS, GROUND_HEIGHT).
 * shape 0 = even grid, 1 = fully random; centreBias 0 = uniform,
 * 1 = pinned to centres; GROUND_HEIGHT keeps z inside the ground band.
 */
function sampleSpawnPosition(cfg, worldSize, prng) {
  const perSpecies = DEFAULT_PARTICLES_PER_SPECIES;
  const gridDim = Math.max(2, Math.ceil(Math.cbrt(perSpecies)));
  const cellSize = (worldSize - 10) / gridDim;
  const cell = Math.floor(rand01(prng) * gridDim * gridDim * gridDim);
  const gx = cell % gridDim;
  const gy = Math.floor(cell / gridDim) % gridDim;
  const gz = Math.floor(cell / (gridDim * gridDim));
  const jit = () => (rand01(prng) - 0.5) * cellSize * 0.4;
  let px = 5 + gx * cellSize + cellSize * 0.5 + jit();
  let py = 5 + gy * cellSize + cellSize * 0.5 + jit();
  let pz = 5 + gz * cellSize + cellSize * 0.5 + jit();
  const shape = Number.isFinite(cfg.SHAPE) ? cfg.SHAPE : 0;
  if (shape > 0) {
    px = px + (rand01(prng) * worldSize - px) * shape;
    py = py + (rand01(prng) * worldSize - py) * shape;
    pz = pz + (rand01(prng) * worldSize - pz) * shape;
  }
  const centreBias = Number.isFinite(cfg.SPAWN_CENTRE_BIAS) ? cfg.SPAWN_CENTRE_BIAS : 0;
  if (centreBias > 0) {
    const centres = buildSpawnCentres(
      Math.max(1, Math.min(64, Math.round(cfg.SPAWN_CENTRES) || 1)),
      Number.isFinite(cfg.SPAWN_CENTRE_RANDOM) ? cfg.SPAWN_CENTRE_RANDOM : 0.5,
      worldSize,
      prng,
    );
    if (centres.length) {
      const c = centres[Math.floor(rand01(prng) * centres.length)];
      px = px + (c.x - px) * centreBias;
      py = py + (c.y - py) * centreBias;
      pz = pz + (c.z - pz) * centreBias;
    }
  }
  // GROUND_HEIGHT: keep spawns inside the ground band (z ∈ [0, worldSize * h]).
  const groundH = Math.max(0, Math.min(1, Number.isFinite(cfg.GROUND_HEIGHT) ? cfg.GROUND_HEIGHT : 0.9));
  if (groundH < 1) pz = Math.min(pz, Math.max(0, worldSize * groundH));
  return { x: px, y: py, z: pz };
}

function rand01(prng) {
  return prng && typeof prng.nextFloat === 'function' ? prng.nextFloat(0, 1) : prng();
}

/**
 * Total initial population from INITIAL_POP, capped by the hard cap.
 */
function initialPopulationTarget(cfg, caps) {
  return Math.min(Math.max(1, Math.round(cfg.INITIAL_POP)), caps.hardCap);
}

/**
 * Per-species allocation (even split, rounded up) of a population target.
 */
function perSpeciesAllocation(target, speciesCount) {
  return Math.max(1, Math.ceil(target / Math.max(1, speciesCount)));
}

  return { buildSpawnCentres, sampleSpawnPosition, initialPopulationTarget, perSpeciesAllocation };
});

// ══════════════════════════════════════════════════════════════════════
// HEADLESS SMOKE DRIVER — runs the core end-to-end and prints a summary.
// ══════════════════════════════════════════════════════════════════════
const {
  PARTICLE_STRIDE, STRIDE_INDEXES: S, DNA_RANGES, LAW_INDEXES, WORLD_SIZE,
} = __import('src/constants.js');
const { createLawState, set: lawSet, getActiveCount } = __import('src/state/lawState.js');
const { createDNABuffer, loadDefaults, getDNAFloat } = __import('src/dna/dnaBuffer.js');
const { createWorldParams } = __import('src/state/worldParams.js');
const { runtimeConfig } = __import('src/state/runtimeConfig.js');
const { SplitMix32 } = __import('src/core/prng.js');
const { solve, drainOffspring, resetOffspringRing } = __import('src/physics/solver.js');

const DEFAULT_LAWS = ['GRAV', 'DRAG', 'ENTR', 'WRAP', 'COLL', 'LIFE', 'GLOW', 'REPRO', 'PHENOTYPE', 'GENOTYPE'];

const dnaBuffer = createDNABuffer();
loadDefaults(dnaBuffer, DNA_RANGES);
runtimeConfig.worldParams = createWorldParams();

function makeWorld(count, seed = 20260810) {
  const view = new Float32Array(count * PARTICLE_STRIDE);
  const rng = new SplitMix32(seed);
  for (let i = 0; i < count; i++) {
    const b = i * PARTICLE_STRIDE;
    view[b + S.POS_X] = rng.nextFloat(0, WORLD_SIZE);
    view[b + S.POS_Y] = rng.nextFloat(0, WORLD_SIZE);
    view[b + S.POS_Z] = rng.nextFloat(0, WORLD_SIZE);
    view[b + S.VEL_X] = rng.nextFloat(-1, 1);
    view[b + S.VEL_Y] = rng.nextFloat(-1, 1);
    view[b + S.VEL_Z] = rng.nextFloat(-1, 1);
    view[b + S.MASS] = 1.0;
    view[b + S.SPECIES_ID] = i % 5;
    view[b + S.ENERGY] = 50;
    view[b + S.AGE] = 0;
    view[b + S.DEAD] = 0;
    view[b + S.RADIUS] = 0.6;
    view[b + S.ALPHA] = 0.8;
    view[b + S.TEMPERATURE] = 0.5;
    view[b + S.CHARGE] = 0;
    for (let d = 0; d < 42; d++) {
      const r = DNA_RANGES[d] || { min: -1, max: 1 };
      view[b + S.DNA_CACHE_START + d] = getDNAFloat(dnaBuffer, view[b + S.SPECIES_ID], d, r.min, r.max);
    }
  }
  return view;
}

function lawStateFor(names) {
  const state = createLawState();
  for (const name of names) {
    if (LAW_INDEXES[name] !== undefined) lawSet(state, LAW_INDEXES[name]);
  }
  return state;
}

const COUNT = 500;
const TICKS = 60;
const view = makeWorld(COUNT);
const state = lawStateFor(DEFAULT_LAWS);
const rng = new SplitMix32(0x9e3779b9);
const next = () => rng.next();

for (let t = 0; t < 20; t++) solve(view, COUNT, PARTICLE_STRIDE, state, dnaBuffer, WORLD_SIZE, 1.0, next); // warmup
const t0 = performance.now();
for (let t = 0; t < TICKS; t++) solve(view, COUNT, PARTICLE_STRIDE, state, dnaBuffer, WORLD_SIZE, 1.0, next);
const msPerTick = (performance.now() - t0) / TICKS;

let alive = 0, nan = 0, energy = 0, temp = 0;
for (let i = 0; i < COUNT; i++) {
  const b = i * PARTICLE_STRIDE;
  if (view[b + S.DEAD] === 0) alive++;
  for (let f = 0; f < PARTICLE_STRIDE; f++) if (!Number.isFinite(view[b + f])) nan++;
  energy += view[b + S.ENERGY];
  temp += view[b + S.TEMPERATURE];
}
const offspring = drainOffspring().length;
resetOffspringRing();

console.log('VEPA4 concatenated core — smoke run');
console.log('  particles      :', COUNT);
console.log('  laws active    :', getActiveCount(state), '(' + DEFAULT_LAWS.join(', ') + ')');
console.log('  ticks          :', TICKS, '| warmup 20');
console.log('  ms/tick        :', msPerTick.toFixed(3));
console.log('  alive          :', alive, '/', COUNT);
console.log('  mean energy    :', (energy / COUNT).toFixed(2));
console.log('  mean temp      :', (temp / COUNT).toFixed(3));
console.log('  NaN cells      :', nan);
console.log('  offspring      :', offspring);
if (nan > 0 || alive === 0) { console.error('SMOKE FAIL'); process.exitCode = 1; }
else console.log('SMOKE OK');
