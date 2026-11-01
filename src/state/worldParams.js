/**
 * VEPA4 — World parameter state (single source of truth)
 *
 * All sliders in the WORLD panel map 1:1 onto these definitions. The UI
 * (worldPanel.js) renders from WORLD_PARAM_DEFS, the main thread stores the
 * live state via createWorldParams()/applyWorldParam(), and the solver reads
 * the same state through runtimeConfig.worldParams (shared module instance —
 * VEPA runs the solver on the main thread).
 */
import { WORLD_SIZE, MAX_PARTICLES } from '../constants.js';

export const WORLD_PARAM_DEFS = [
  // ── SPACE ──
  { key: 'WORLD_SIZE', label: 'WORLD SIZE', min: 50, max: 20000, default: WORLD_SIZE, step: 100, group: 'SPACE', subgroup: 'WORLD' },
  { key: 'GROUND_HEIGHT', label: 'GROUND HEIGHT', min: 0, max: 1, default: 0.9, step: 0.05, group: 'SPACE', subgroup: 'WORLD' },
  { key: 'PARTICLE_COUNT', label: 'PARTICLE COUNT', min: 100, max: 100000, default: 1000, step: 100, group: 'SPACE', subgroup: 'POPULATION' },
  { key: 'INITIAL_POP', label: 'INITIAL POPULATION', min: 10, max: 50000, default: 250, step: 10, group: 'SPACE', subgroup: 'POPULATION' },
  { key: 'MAX_POP', label: 'MAX POPULATION', min: 100, max: 100000, default: 5000, step: 100, group: 'SPACE', subgroup: 'POPULATION' },
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
  { key: 'TOROIDAL', label: 'TOROIDAL EDGES', min: 0, max: 1, default: 1, step: 1, group: 'PHYSICS', subgroup: 'MOTION' }, // 1 = wrap around edges (was the WRAP law), 0 = soft walls governed by WALL REFLECT
  { key: 'RESONANCE_Q', label: 'RESONANCE Q', min: 1, max: 20, default: 10, step: 1, group: 'PHYSICS', subgroup: 'SIGNAL' }, // resonance bandwidth = 1/Q (law-RRP RESONANCE gate)
  // ── ENVIRONMENT ──
  { key: 'HEAT_CAPACITY', label: 'HEAT CAPACITY', min: 0.1, max: 10, default: 1, step: 0.5, group: 'ENVIRONMENT', subgroup: 'THERMAL' },
  { key: 'LIGHT_LEVEL', label: 'LIGHT LEVEL', min: 0, max: 2, default: 0.5, step: 0.1, group: 'ENVIRONMENT', subgroup: 'THERMAL' },
  { key: 'RADIATION_LEVEL', label: 'RADIATION LEVEL', min: 0, max: 5, default: 1, step: 0.5, group: 'ENVIRONMENT', subgroup: 'THERMAL' },
  { key: 'CRITICAL_TEMP', label: 'CRITICAL TEMP', min: 0.05, max: 0.5, default: 0.2, step: 0.05, group: 'ENVIRONMENT', subgroup: 'THERMAL' }, // T_C shared by SUPERCONDUCTIVITY (unbind above) + BOSONIC (BEC below)
  { key: 'SPAWN_RATE', label: 'REGULAR SPAWN /S', min: 0, max: 100, default: 5, step: 1, group: 'ENVIRONMENT', subgroup: 'POPULATION' },
  // ── MEDIUM (v8.2 E.1 — Matter & Medium field substrate) ──
  // The dish itself: a coarse 3D field grid (12³–24³ cells) with named vector
  // fields (WIND/EM), scalar fields (THERMAL/INFO), impassable walls, gravity
  // wells, and paired portals. Field forces apply when a strength is nonzero;
  // walls are impassable only while the COLL law is on (the hard-matter toggle).
  { key: 'FIELD_GRID_DIM', label: 'FIELD GRID DIM', min: 0, max: 24, default: 0, step: 1, group: 'ENVIRONMENT', subgroup: 'MEDIUM' }, // 0 = auto (12–24 scaled to world size)
  { key: 'FIELD_WIND', label: 'WIND FIELD', min: 0, max: 5, default: 0, step: 0.5, group: 'ENVIRONMENT', subgroup: 'MEDIUM' },
  { key: 'FIELD_THERMAL', label: 'THERMAL FIELD', min: 0, max: 5, default: 0, step: 0.5, group: 'ENVIRONMENT', subgroup: 'MEDIUM' },
  { key: 'FIELD_EM', label: 'EM FIELD', min: 0, max: 5, default: 0, step: 0.5, group: 'ENVIRONMENT', subgroup: 'MEDIUM' },
  { key: 'FIELD_INFO', label: 'INFO FIELD', min: 0, max: 5, default: 0, step: 0.5, group: 'ENVIRONMENT', subgroup: 'MEDIUM' },
  { key: 'FIELD_DIFFUSION', label: 'FIELD DIFFUSION', min: 0, max: 0.5, default: 0.1, step: 0.05, group: 'ENVIRONMENT', subgroup: 'MEDIUM' },
  { key: 'WALLS_PRESET', label: 'WALLS', min: 0, max: 3, default: 0, step: 1, group: 'ENVIRONMENT', subgroup: 'MEDIUM' }, // 0 = off, 1 = border, 2 = ring, 3 = cross — impassable with COLL
  { key: 'WALL_THICKNESS', label: 'WALL THICKNESS', min: 1, max: 5, default: 2, step: 1, group: 'ENVIRONMENT', subgroup: 'MEDIUM' },
  { key: 'WELL_COUNT', label: 'GRAVITY WELLS', min: 0, max: 16, default: 0, step: 1, group: 'ENVIRONMENT', subgroup: 'MEDIUM' },
  { key: 'WELL_STRENGTH', label: 'WELL STRENGTH', min: 0, max: 5, default: 1, step: 0.5, group: 'ENVIRONMENT', subgroup: 'MEDIUM' },
  { key: 'PORTAL_COUNT', label: 'PORTALS', min: 0, max: 8, default: 0, step: 1, group: 'ENVIRONMENT', subgroup: 'MEDIUM' },
  // ── BIOLOGY ──
  { key: 'SPECIES_INTERACTION', label: 'SPECIES INTERACTION', min: -2, max: 2, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'INTERACTION' },
  { key: 'ENERGY_TRANSFER', label: 'ENERGY TRANSFER', min: 0, max: 2, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'INTERACTION' },
  { key: 'MUTATION_RATE', label: 'MUTATION RATE', min: 0, max: 5, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'LIFE CYCLE' },
  { key: 'DECAY_RATE', label: 'DECAY RATE', min: 0, max: 2, default: 1, step: 0.05, group: 'BIOLOGY', subgroup: 'LIFE CYCLE' },

  // ── DEDICATED LAW PARAMETERS (PHYSICS) ──
  { key: 'TIDAL_SCALE', label: 'TIDAL SCALE', min: 0, max: 5, default: 1, step: 0.1, group: 'PHYSICS', subgroup: 'FORCES' },
  { key: 'FRICTION_COEFF', label: 'FRICTION COEFF', min: 0, max: 2, default: 1, step: 0.05, group: 'PHYSICS', subgroup: 'MOTION' },
  { key: 'ELASTIC_RESTITUTION', label: 'ELASTIC RESTITUTION', min: 0, max: 1, default: 0.5, step: 0.05, group: 'PHYSICS', subgroup: 'MOTION' },
  { key: 'TURBULENCE_KICK', label: 'TURBULENCE KICK', min: 0, max: 5, default: 1, step: 0.1, group: 'PHYSICS', subgroup: 'MOTION' },
  { key: 'CENTRIPETAL_SCALE', label: 'CENTRIPETAL SCALE', min: 0, max: 5, default: 1, step: 0.1, group: 'PHYSICS', subgroup: 'FORCES' },
  { key: 'ROTATION_SPEED', label: 'ROTATION SPEED', min: 0, max: 5, default: 1, step: 0.1, group: 'PHYSICS', subgroup: 'MOTION' },
  { key: 'ACCRETION_RADIUS', label: 'ACCRETION RADIUS', min: 0.1, max: 10, default: 2, step: 0.1, group: 'PHYSICS', subgroup: 'FORCES' },
  { key: 'SINGULARITY_HORIZON', label: 'SINGULARITY HORIZON', min: 1, max: 50, default: 10, step: 1, group: 'PHYSICS', subgroup: 'FORCES' },
  { key: 'BOND_STRENGTH', label: 'BOND STRENGTH', min: 0, max: 10, default: 1, step: 0.1, group: 'PHYSICS', subgroup: 'FORCES' },
  { key: 'VOID_PRESSURE', label: 'VOID PRESSURE', min: 0, max: 5, default: 1, step: 0.1, group: 'PHYSICS', subgroup: 'FORCES' },

  // ── DEDICATED LAW PARAMETERS (BIOLOGY) ──
  { key: 'REPRODUCTION_THRESHOLD', label: 'REPRODUCTION THRESH', min: 10, max: 100, default: 50, step: 5, group: 'BIOLOGY', subgroup: 'LIFE CYCLE' },
  { key: 'SENESCENCE_RATE', label: 'SENESCENCE RATE', min: 0, max: 2, default: 1, step: 0.05, group: 'BIOLOGY', subgroup: 'LIFE CYCLE' },
  { key: 'PREDATION_EFFICIENCY', label: 'PREDATION EFFICIENCY', min: 0, max: 2, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'INTERACTION' },
  { key: 'SYMBIOSIS_BOOST', label: 'SYMBIOSIS BOOST', min: 0, max: 2, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'INTERACTION' },
  { key: 'PARASITE_DRAIN', label: 'PARASITE DRAIN', min: 0, max: 2, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'INTERACTION' },
  { key: 'IMMUNITY_SHIELD', label: 'IMMUNITY SHIELD', min: 0, max: 2, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'LIFE CYCLE' },
  { key: 'HIBERNATION_SAVINGS', label: 'HIBERNATION SAVINGS', min: 0, max: 1, default: 0.8, step: 0.05, group: 'BIOLOGY', subgroup: 'LIFE CYCLE' },
  { key: 'TRACKING_SENSITIVITY', label: 'TRACKING SENSITIVITY', min: 0, max: 5, default: 1, step: 0.1, group: 'BIOLOGY', subgroup: 'INTERACTION' },

  // ── DEDICATED LAW PARAMETERS (CHEMISTRY) ──
  { key: 'CATALYSIS_SPEED', label: 'CATALYSIS SPEED', min: 0, max: 5, default: 1, step: 0.1, group: 'CHEMISTRY', subgroup: 'REACTIONS' },
  { key: 'SOLVATION_RATE', label: 'SOLVATION RATE', min: 0, max: 2, default: 1, step: 0.1, group: 'CHEMISTRY', subgroup: 'STATES' },
  { key: 'ACIDITY_PH', label: 'ACIDITY PH', min: 0, max: 14, default: 7, step: 0.5, group: 'CHEMISTRY', subgroup: 'REACTIONS' },
  { key: 'OXIDATION_RATE', label: 'OXIDATION RATE', min: 0, max: 2, default: 1, step: 0.1, group: 'CHEMISTRY', subgroup: 'REACTIONS' },
  { key: 'POLYMER_LIMIT', label: 'POLYMER LIMIT', min: 2, max: 10, default: 6, step: 1, group: 'CHEMISTRY', subgroup: 'BONDS' },
  { key: 'CRYSTAL_LATTICE', label: 'CRYSTAL LATTICE', min: 0.1, max: 5, default: 1, step: 0.1, group: 'CHEMISTRY', subgroup: 'STATES' },
  { key: 'ELECTROLYSIS_POWER', label: 'ELECTROLYSIS POWER', min: 0, max: 5, default: 1, step: 0.1, group: 'CHEMISTRY', subgroup: 'REACTIONS' },
  { key: 'AUTOCATALYSIS_GAIN', label: 'AUTOCATALYSIS GAIN', min: 0, max: 5, default: 1, step: 0.1, group: 'CHEMISTRY', subgroup: 'REACTIONS' },

  // ── DEDICATED LAW PARAMETERS (THERMODYNAMICS) ──
  { key: 'CONVECTION_RATE', label: 'CONVECTION RATE', min: 0, max: 5, default: 1, step: 0.1, group: 'THERMODYNAMICS', subgroup: 'HEAT' },
  { key: 'PHASE_RADIATION_FACTOR', label: 'PHASE RADIATION FACTOR', min: 0, max: 2, default: 1, step: 0.1, group: 'THERMODYNAMICS', subgroup: 'RADIATION' },
  { key: 'LATENT_HEAT_BUFFER', label: 'LATENT HEAT BUFFER', min: 0, max: 5, default: 1, step: 0.1, group: 'THERMODYNAMICS', subgroup: 'PHASE' },
  { key: 'MELT_TEMP_POINT', label: 'MELT TEMP POINT', min: 0, max: 100, default: 30, step: 1, group: 'THERMODYNAMICS', subgroup: 'PHASE' },
  { key: 'BOIL_TEMP_POINT', label: 'BOIL TEMP POINT', min: 50, max: 200, default: 100, step: 5, group: 'THERMODYNAMICS', subgroup: 'PHASE' },
  { key: 'ADIABATIC_GAMMA', label: 'ADIABATIC GAMMA', min: 1, max: 2, default: 1.4, step: 0.05, group: 'THERMODYNAMICS', subgroup: 'HEAT' },
  { key: 'RUNAWAY_MULT', label: 'RUNAWAY MULTIPLIER', min: 1, max: 10, default: 2, step: 0.5, group: 'THERMODYNAMICS', subgroup: 'HEAT' },

  // ── DEDICATED LAW PARAMETERS (METAPHYSICS) ──
  { key: 'TIME_WARP_FACTOR', label: 'TIME WARP FACTOR', min: 0.1, max: 10, default: 1, step: 0.1, group: 'METAPHYSICS', subgroup: 'TIME' },
  { key: 'DIMENSIONAL_FOLD', label: 'DIMENSIONAL FOLD', min: 1, max: 4, default: 3, step: 0.1, group: 'METAPHYSICS', subgroup: 'SPACE' },
  { key: 'CHAOS_LYAPUNOV', label: 'CHAOS LYAPUNOV', min: 0, max: 5, default: 1, step: 0.1, group: 'METAPHYSICS', subgroup: 'ENTROPY' },
  { key: 'CONSCIOUSNESS_PHI', label: 'CONSCIOUSNESS PHI', min: 0, max: 10, default: 1, step: 0.1, group: 'METAPHYSICS', subgroup: 'MIND' },
  { key: 'TELEPATHY_RANGE', label: 'TELEPATHY RANGE', min: 10, max: 500, default: 100, step: 10, group: 'METAPHYSICS', subgroup: 'MIND' },
  { key: 'ASTRAL_PHASE', label: 'ASTRAL PHASE', min: 0, max: 1, default: 0.5, step: 0.05, group: 'METAPHYSICS', subgroup: 'SPACE' },
  { key: 'SYNCHRONICITY_RATE', label: 'SYNCHRONICITY RATE', min: 0, max: 5, default: 1, step: 0.1, group: 'METAPHYSICS', subgroup: 'ENTROPY' },

  // ── DEDICATED LAW PARAMETERS (ELECTROMAGNETISM) ──
  { key: 'COULOMB_CONSTANT', label: 'COULOMB CONSTANT', min: 0, max: 10, default: 1, step: 0.1, group: 'ELECTROMAGNETISM', subgroup: 'CHARGE' },
  { key: 'MAGNETIC_FLUX_SCALE', label: 'MAGNETIC FLUX SCALE', min: 0, max: 5, default: 1, step: 0.1, group: 'ELECTROMAGNETISM', subgroup: 'FIELD' },
  { key: 'PLASMA_IONIZATION_ENERGY', label: 'PLASMA IONIZATION EN', min: 0.1, max: 10, default: 2, step: 0.1, group: 'ELECTROMAGNETISM', subgroup: 'FIELD' },
  { key: 'DISCHARGE_ARC_THRESHOLD', label: 'DISCHARGE ARC THRESH', min: 1, max: 50, default: 10, step: 1, group: 'ELECTROMAGNETISM', subgroup: 'CHARGE' },
  { key: 'SHIELDING_ATTENUATION', label: 'SHIELDING ATTENUATION', min: 0, max: 1, default: 0.8, step: 0.05, group: 'ELECTROMAGNETISM', subgroup: 'FIELD' },
  { key: 'POLARIZATION_DISPLACEMENT', label: 'POLARIZATION DISPL', min: 0, max: 2, default: 1, step: 0.1, group: 'ELECTROMAGNETISM', subgroup: 'FIELD' },

  // ── DEDICATED LAW PARAMETERS (INFORMATION) ──
  { key: 'STIGMERGY_DECAY_RATE', label: 'STIGMERGY DECAY RATE', min: 0.001, max: 0.1, default: 0.01, step: 0.005, group: 'INFORMATION', subgroup: 'SIGNALS' },
  { key: 'HEBBIAN_LEARNING_RATE', label: 'HEBBIAN LEARNING RATE', min: 0, max: 1, default: 0.1, step: 0.01, group: 'INFORMATION', subgroup: 'LEARNING' },
  { key: 'SIGNAL_BOOST_GAIN', label: 'SIGNAL BOOST GAIN', min: 1, max: 10, default: 2, step: 0.5, group: 'INFORMATION', subgroup: 'SIGNALS' },
  { key: 'CULTURAL_TRANSMISSION', label: 'CULTURAL TRANSMISSION', min: 0, max: 1, default: 0.5, step: 0.05, group: 'INFORMATION', subgroup: 'MEMETICS' },
  { key: 'ENCRYPTION_CIPHER_KEY', label: 'ENCRYPTION CIPHER KEY', min: 1, max: 256, default: 128, step: 1, group: 'INFORMATION', subgroup: 'SIGNALS' },
  { key: 'NAVIGATION_GRADIENT_BIAS', label: 'NAV GRADIENT BIAS', min: 0, max: 5, default: 1, step: 0.1, group: 'INFORMATION', subgroup: 'SIGNALS' },

  // ── DEDICATED LAW PARAMETERS (QUANTUM) ──
  { key: 'TUNNELING_PROBABILITY', label: 'TUNNELING PROB', min: 0, max: 0.5, default: 0.05, step: 0.005, group: 'QUANTUM', subgroup: 'PROBABILITY' },
  { key: 'SUPERPOSITION_PHASE_SCALE', label: 'SUPERPOSITION PHASE', min: 0, max: 2, default: 1, step: 0.1, group: 'QUANTUM', subgroup: 'STATE' },
  { key: 'DECOHERENCE_RATE_FACTOR', label: 'DECOHERENCE RATE', min: 0, max: 2, default: 1, step: 0.1, group: 'QUANTUM', subgroup: 'STATE' },
  { key: 'UNCERTAINTY_SIGMA', label: 'UNCERTAINTY SIGMA', min: 0.01, max: 1, default: 0.1, step: 0.01, group: 'QUANTUM', subgroup: 'PROBABILITY' },
  { key: 'ANTIMATTER_ANNIHILATION_YIELD', label: 'ANNIHILATION YIELD', min: 0, max: 10, default: 5, step: 0.5, group: 'QUANTUM', subgroup: 'ENERGY' },
  { key: 'SPIN_PRECESSION_FREQ', label: 'SPIN PRECESSION FREQ', min: 0, max: 10, default: 1, step: 0.5, group: 'QUANTUM', subgroup: 'STATE' },

  // ── PERFORMANCE ── (solver spatial-grid & interaction knobs)
  { key: 'AUTO_TUNE', label: 'AUTO-TUNE GRID & INTERACTIONS', min: 0, max: 1, default: 1, step: 1, group: 'PERFORMANCE', subgroup: 'GRID' },
  { key: 'GRID_DIM', label: 'GRID RESOLUTION', min: 6, max: 64, default: 12, step: 1, group: 'PERFORMANCE', subgroup: 'GRID' },
  { key: 'CELL_CAP', label: 'CELL PARTICLE CAP', min: 1, max: 500, default: 100, step: 1, group: 'PERFORMANCE', subgroup: 'GRID' },
  { key: 'MAX_INTERACTIONS', label: 'MAX INTERACTIONS', min: 8, max: 4000, default: 500, step: 8, group: 'PERFORMANCE', subgroup: 'INTERACTIONS' },
  { key: 'NEIGHBOR_BUF', label: 'NEIGHBOR BUFFER', min: 24, max: 32768, default: 2000, step: 8, group: 'PERFORMANCE', subgroup: 'INTERACTIONS' },
  { key: 'QUALITY_MODE', label: 'ADAPTIVE QUALITY', min: 0, max: 1, default: 1, step: 1, group: 'PERFORMANCE', subgroup: 'QUALITY' }, // 1 = scale pair budget as population grows
  { key: 'TARGET_FPS', label: 'TARGET FPS', min: 15, max: 60, default: 60, step: 15, group: 'PERFORMANCE', subgroup: 'QUALITY' },
  { key: 'PAIRWISE_BUDGET', label: 'PAIRWISE BUDGET / PARTICLE', min: 8, max: 500, default: 96, step: 8, group: 'PERFORMANCE', subgroup: 'QUALITY' },
  { key: 'EXPENSIVE_LAW_CADENCE', label: 'EXPENSIVE LAW CADENCE', min: 1, max: 12, default: 1, step: 1, group: 'PERFORMANCE', subgroup: 'QUALITY' },

  // ── TIME (v8.6 D.2 — Deep Time & Epochs) ──
  { key: 'TIME_SPEED', label: 'TIME SPEED', min: 0.1, max: 10, default: 1, step: 0.1, group: 'TIME', subgroup: 'TIME' },
  { key: 'EPOCH_LENGTH', label: 'EPOCH LENGTH', min: 60, max: 6000, default: 600, step: 60, group: 'TIME', subgroup: 'ERAS' },
  { key: 'EXTINCTION_THRESHOLD', label: 'EXTINCTION THRESH', min: 0.05, max: 0.9, default: 0.35, step: 0.05, group: 'TIME', subgroup: 'ERAS' },
  { key: 'RECOVERY_THRESHOLD', label: 'RECOVERY THRESH', min: 0.2, max: 1, default: 0.7, step: 0.05, group: 'TIME', subgroup: 'ERAS' },

  // ── MATTER (v8.12 L.1 — Exotic Matter, the L·M·N physics frontier) ──
  // Exotic zones are regions of the EXOTIC scalar field (magnitude = zone
  // kind: 1 ANTIMATTER, 2 DARK, 3 STRANGE, 4 NEGATIVE); particles inside a
  // zone are tagged with an exotic matter state that persists briefly after
  // leaving. 0 zones = exotic matter off (the dish stays mundane).
  { key: 'EXOTIC_COUNT', label: 'EXOTIC ZONES', min: 0, max: 16, default: 3, step: 1, group: 'MATTER', subgroup: 'EXOTIC' },
  { key: 'EXOTIC_ZONE_SIZE', label: 'ZONE SIZE', min: 1, max: 4, default: 2, step: 1, group: 'MATTER', subgroup: 'EXOTIC' },
  { key: 'EXOTIC_ANNIHILATE_RADIUS', label: 'ANNIHILATION RADIUS', min: 0, max: 200, default: 30, step: 5, group: 'MATTER', subgroup: 'EXOTIC' },
  { key: 'EXOTIC_STRANGE_RATE', label: 'STRANGE RATE', min: 0, max: 1, default: 0.02, step: 0.01, group: 'MATTER', subgroup: 'EXOTIC' },
  { key: 'EXOTIC_NEGATIVE_STRENGTH', label: 'NEGATIVE STRENGTH', min: 0, max: 5, default: 1, step: 0.1, group: 'MATTER', subgroup: 'EXOTIC' },
  { key: 'EXOTIC_HALF_LIFE', label: 'STATE HALF LIFE', min: 1, max: 100, default: 20, step: 1, group: 'MATTER', subgroup: 'EXOTIC' },
  // Set M — Relativity (v8.13 M.1–M.4): mass-warped CURVATURE field,
  // gravitational lensing of the INFO medium, velocity time dilation, and
  // E=mc² mass–energy conversion. The gravitational dilation term is already
  // served by the TIME_DILATION law — these knobs tune Set M's ambient terms.
  { key: 'CURVATURE_STRENGTH', label: 'CURVATURE STRENGTH', min: 0, max: 5, default: 1, step: 0.1, group: 'MATTER', subgroup: 'RELATIVITY' },
  { key: 'TIME_DILATION_MAX', label: 'TIME DILATION MAX', min: 0.25, max: 1, default: 0.25, step: 0.05, group: 'MATTER', subgroup: 'RELATIVITY' },
  { key: 'LIGHT_SPEED', label: 'LIGHT SPEED (C)', min: 100, max: 2000, default: 600, step: 50, group: 'MATTER', subgroup: 'RELATIVITY' },
  { key: 'LENSING_STRENGTH', label: 'LENSING STRENGTH', min: 0, max: 1, default: 0.1, step: 0.05, group: 'MATTER', subgroup: 'RELATIVITY' },
  { key: 'MASS_ENERGY_RATE', label: 'MASS-ENERGY RATE', min: 0, max: 1, default: 0.02, step: 0.01, group: 'MATTER', subgroup: 'RELATIVITY' },
  // Set N — Quantum Macroscale (v8.14 N.1–N.4): deterministic superposition
  // with collapse-on-interaction, macro entanglement (reuses stride 75–76),
  // ENERGY-gated wall tunneling, and DNA-gated observer collapse. The
  // TUNNELING / SUPERPOSITION laws stay untouched — these knobs tune the
  // ambient macroscale pass.
  { key: 'QUANTUM_SUPERPOSITION_RATE', label: 'SUPERPOSITION RATE', min: 0, max: 1, default: 0.15, step: 0.05, group: 'MATTER', subgroup: 'QUANTUM' },
  { key: 'QUANTUM_SPREAD', label: 'SUPERPOSITION SPREAD', min: 0, max: 100, default: 25, step: 5, group: 'MATTER', subgroup: 'QUANTUM' },
  { key: 'QUANTUM_COLLAPSE_RADIUS', label: 'COLLAPSE RADIUS', min: 0, max: 200, default: 30, step: 5, group: 'MATTER', subgroup: 'QUANTUM' },
  { key: 'QUANTUM_ENTANGLE_RATE', label: 'ENTANGLE RATE', min: 0, max: 1, default: 0.1, step: 0.05, group: 'MATTER', subgroup: 'QUANTUM' },
  { key: 'QUANTUM_ENERGY_SHARE', label: 'ENERGY SHARE', min: 0, max: 1, default: 0.02, step: 0.01, group: 'MATTER', subgroup: 'QUANTUM' },
  { key: 'QUANTUM_TUNNEL_RATE', label: 'TUNNEL RATE', min: 0, max: 1, default: 0.02, step: 0.01, group: 'MATTER', subgroup: 'QUANTUM' },
  { key: 'QUANTUM_TUNNEL_ENERGY', label: 'TUNNEL ENERGY GATE', min: 5, max: 200, default: 40, step: 5, group: 'MATTER', subgroup: 'QUANTUM' },
  { key: 'QUANTUM_OBSERVER_RADIUS', label: 'OBSERVER RADIUS', min: 0, max: 200, default: 40, step: 5, group: 'MATTER', subgroup: 'QUANTUM' },
  // Set O — Stellar Physics (v8.15 O.1–O.3): dense cells seed stars that fuse
  // accreted mass into radiant THERMAL/INFO + a warm ENERGY feed; past BLACK
  // HOLE HORIZON they collapse to accreting, Hawking-emitting black holes;
  // past SUPERNOVA MASS they detonate (shockwave + exotic element seeding).
  { key: 'STELLAR_FORM', label: 'STAR FORM MASS', min: 0, max: 100, default: 20, step: 5, group: 'MATTER', subgroup: 'STELLAR' },
  { key: 'STELLAR_MAX', label: 'MAX STARS', min: 0, max: 16, default: 4, step: 1, group: 'MATTER', subgroup: 'STELLAR' },
  { key: 'STELLAR_SEPARATION', label: 'STAR SEPARATION', min: 1, max: 8, default: 3, step: 1, group: 'MATTER', subgroup: 'STELLAR' },
  { key: 'STELLAR_RADIANCE', label: 'STAR RADIANCE', min: 0, max: 5, default: 1, step: 0.1, group: 'MATTER', subgroup: 'STELLAR' },
  { key: 'STELLAR_HORIZON', label: 'BLACK HOLE HORIZON', min: 50, max: 1000, default: 250, step: 25, group: 'MATTER', subgroup: 'STELLAR' },
  { key: 'STELLAR_SUPERNOVA', label: 'SUPERNOVA MASS', min: 100, max: 2000, default: 400, step: 25, group: 'MATTER', subgroup: 'STELLAR' },
  { key: 'STELLAR_HAWKING', label: 'HAWKING RATE', min: 0, max: 1, default: 0.05, step: 0.01, group: 'MATTER', subgroup: 'STELLAR' },

  // ── SOCIETY (v8.9 I.1 · v8.10 J.1 · v8.11 K.1 — the I·J·K trilogy) ──
  // Crafting economy (Set I), governance + relations (Set J) and infrastructure
  // extraction/grids (Set K) all live here — one accordion that grows across
  // the trilogy. Values are read live by the per-set passes.
  { key: 'CRAFT_COST', label: 'CRAFT COST', min: 10, max: 200, default: 40, step: 10, group: 'SOCIETY', subgroup: 'CRAFTING' },
  { key: 'ARTIFACT_DECAY', label: 'ARTIFACT DECAY', min: 0, max: 0.1, default: 0.004, step: 0.001, group: 'SOCIETY', subgroup: 'CRAFTING' },
  // Set J — governance + relations
  { key: 'POLICY_SHIFT', label: 'POLICY SHIFT', min: 0, max: 1, default: 0.1, step: 0.05, group: 'SOCIETY', subgroup: 'GOVERNANCE' },
  { key: 'ALLIANCE_RANGE', label: 'ALLIANCE RANGE', min: 100, max: 1000, default: 350, step: 25, group: 'SOCIETY', subgroup: 'GOVERNANCE' },
  { key: 'CONFLICT_THRESHOLD', label: 'CONFLICT THRESH', min: 0.1, max: 1, default: 0.5, step: 0.05, group: 'SOCIETY', subgroup: 'GOVERNANCE' },
  // Set K — infrastructure + energy
  { key: 'HARVEST_RATE', label: 'HARVEST RATE', min: 0, max: 1, default: 0.1, step: 0.05, group: 'SOCIETY', subgroup: 'ENERGY' },
  { key: 'GRID_FEED', label: 'GRID FEED', min: 0, max: 0.5, default: 0.05, step: 0.01, group: 'SOCIETY', subgroup: 'ENERGY' },
  { key: 'MEGA_INVEST', label: 'MEGA INVEST', min: 5, max: 100, default: 20, step: 5, group: 'SOCIETY', subgroup: 'ENERGY' },
  // Set P — Synthetic Life (v8.16 P.1–P.3): synthetic organisms born from
  // advanced HUBs evolve by program-like traits (no species slots consumed);
  // species reaching an intelligence threshold get uploaded consciousness;
  // machine groups register in F.1 with their own roles.
  { key: 'SYNTHETIC_RATE', label: 'SYNTHETIC RATE', min: 0, max: 1, default: 0.3, step: 0.05, group: 'SOCIETY', subgroup: 'SYNTHETIC' },
  { key: 'SYNTHETIC_MAX', label: 'MAX SYNTHETICS', min: 0, max: 100, default: 50, step: 5, group: 'SOCIETY', subgroup: 'SYNTHETIC' },
  { key: 'SYNTHETIC_UPKEEP', label: 'SYNTHETIC UPKEEP', min: 0, max: 5, default: 0.5, step: 0.1, group: 'SOCIETY', subgroup: 'SYNTHETIC' },
  { key: 'UPLOAD_THRESHOLD', label: 'UPLOAD THRESHOLD', min: 0, max: 5, default: 1.2, step: 0.1, group: 'SOCIETY', subgroup: 'SYNTHETIC' },
  { key: 'UPLOAD_RATE', label: 'UPLOAD RATE', min: 0, max: 0.5, default: 0.02, step: 0.01, group: 'SOCIETY', subgroup: 'SYNTHETIC' },
  { key: 'UPLOAD_PERSIST', label: 'UPLOAD PERSIST', min: 30, max: 2000, default: 300, step: 30, group: 'SOCIETY', subgroup: 'SYNTHETIC' },
  { key: 'VIRTUAL_LAYER_MAX', label: 'VIRTUAL LAYER MAX', min: 0, max: 100, default: 20, step: 5, group: 'SOCIETY', subgroup: 'SYNTHETIC' },
];

const DEF_BY_KEY = new Map(WORLD_PARAM_DEFS.map((d) => [d.key, d]));

export function clampWorldParam(key, value) {
  const def = DEF_BY_KEY.get(key);
  if (!def) return value;
  let v = Number.isFinite(value) ? value : def.default;
  return Math.min(def.max, Math.max(def.min, v));
}

/** Fresh world-param state (all defaults). */
export function createWorldParams() {
  const state = {};
  for (const d of WORLD_PARAM_DEFS) state[d.key] = d.default;
  return state;
}

/** Apply one slider change, clamped to the param's range. Returns new state. */
export function applyWorldParam(state, key, value) {
  const def = DEF_BY_KEY.get(key);
  if (!def) return state;
  return { ...state, [key]: clampWorldParam(key, value) };
}

/** Caps enforced when spawning: PARTICLE_COUNT / MAX_POP bound the buffer. */
export function spawnCaps(state) {
  return {
    hardCap: Math.min(Math.round(clampWorldParam('PARTICLE_COUNT', state.PARTICLE_COUNT)), MAX_PARTICLES),
    softCap: Math.min(Math.round(clampWorldParam('MAX_POP', state.MAX_POP)), MAX_PARTICLES),
  };
}

export function worldParamDef(key) {
  return DEF_BY_KEY.get(key) || null;
}
