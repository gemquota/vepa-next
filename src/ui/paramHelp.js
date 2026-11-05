/**
 * VEPA4 — Parameter help popups.
 * Long-pressing (or right-clicking) any parameter name shows a comprehensive
 * popup explaining what the parameter does, its range/units, how it couples
 * to laws, and practical tuning guidance. Content is centralized here so the
 * slider factory (sliderControl.js) can stay generic.
 *
 * Lookup precedence: EXACT_KEY_HELP[key] → DNA_HELP[key] → generic fallback
 * assembled from the slider's own metadata (range, step, default).
 *
 * The popup is a reading surface: it stays open across the press that summoned
 * it, and is dismissed by the *next* tap anywhere or by Escape (see
 * tooltipDismiss.js). Tapping the parameter it is anchored to refreshes it
 * rather than closing it, so a second long press on the same name does not
 * require closing in between.
 */

import { registerTooltip } from './tooltipDismiss.js';

// ── World parameter help (key → sections) ────────────────────────────────
export const EXACT_KEY_HELP = {
  WORLD_SIZE: {
    what: 'Edge length of the cubic toroidal world in world units.',
    effect: 'All positions live in [0, WORLD_SIZE)³ and wrap at the edges (or bounce on soft walls). Density = particle count ÷ volume, so growing the world without growing the population thins everything out.',
    tuning: 'WORLD_SIZE 2000 with ~1000 particles is a sparse dish where structure forms slowly. Shrink to 800–1200 for denser, faster-moving dynamics.',
    units: 'world units (1 unit ≈ 1 renderer pixel at 1× zoom).',
  },
  PARTICLE_COUNT: {
    what: 'Hard allocation cap for the particle pool.',
    effect: 'The SharedArrayBuffer is sized from this; also the hard ceiling used by spawning.',
    tuning: 'Larger pools cost memory (100 floats × count). The current hard cap is 10,000 particles; only alive particles are simulated.',
    units: 'particles.',
  },
  INITIAL_POP: {
    what: 'How many particles exist when the world boots or restarts.',
    effect: 'Distributed according to the DISTRIBUTION / CENTRES settings.',
    tuning: 'REPRO and SPAWN_RATE will grow past this. Start small (100–500) and let the dish fill.',
    units: 'particles.',
  },
  MAX_POP: {
    what: 'Soft population cap enforced against spawning and reproduction.',
    effect: 'Births are refused once the alive count reaches this.',
    tuning: 'Keep the ceiling at or below the 10,000-particle engine cap. Pair it with PERFORMANCE knobs — physics cost scales with the alive count, not the pool size.',
    units: 'particles.',
  },
  SHAPE: {
    what: 'Initial spawn distribution shape.',
    effect: '0 = uniform cloud, higher values bias toward shells / clusters (combined with CENTRES).',
    tuning: 'Clustered starts (bias > 0) make species interaction happen sooner.',
    units: '0–1 continuous.',
  },
  SPAWN_CENTRES: {
    what: 'Number of spawn centres used by clustered starts.',
    effect: 'Particles spawn near one of these centres when CENTRE BIAS > 0.',
    tuning: 'One centre per nascent species gives each a homeland.',
    units: 'centres (1–64).',
  },
  SPAWN_CENTRE_RANDOM: {
    what: 'How far particles scatter around their chosen centre.',
    effect: '0 = all particles exactly at the centre, 1 = spread across the whole world.',
    tuning: '0.2–0.5 gives recognizable clusters without overlap piles.',
    units: '0–1 fraction of world size.',
  },
  SPAWN_CENTRE_BIAS: {
    what: 'How strongly spawns are pulled toward centres versus uniform.',
    effect: '0 ignores centres entirely; 1 pins every spawn to a centre.',
    tuning: '0.7+ makes clustered origins dominant.',
    units: '0–1 probability.',
  },
  GLOBAL_G: {
    what: 'Multiplier on the universal gravitational constant used by GRAV.',
    effect: '0 disables gravity drift; 2 pulls twice as hard.',
    tuning: '1 is the calibrated default. Raise slowly — gravity is the most destabilizing force at high values.',
    units: '× G multiplier.',
  },
  WIND: {
    what: 'Constant drift force along +X applied to every particle.',
    effect: 'Velocity gain per second ≈ 0.5 × WIND, clamped by MAX VELOCITY DNA.',
    tuning: 'Values above 2 visibly stream the dish; 0.5 is a gentle current.',
    units: 'force units.',
  },
  DAMPING: {
    what: 'Global motion damping applied after all forces.',
    effect: 'Each tick velocity is multiplied by (1 − DAMPING/100)^(dt). 50% halves speed roughly every 2 ticks.',
    tuning: 'Use 10–30% to settle turbulent dishes; 0 preserves Newtonian motion.',
    units: '% per second.',
  },
  VISCOSITY: {
    what: 'Global multiplier on the VISCOSITY DNA trait.',
    effect: 'Scales how strongly particles bleed kinetic energy on contact.',
    tuning: 'Leave at 1 to let DNA decide; below 1 makes everything slippery, above 1 makes everything sticky.',
    units: '× multiplier.',
  },
  ENTROPY: {
    what: 'Global multiplier on the JITTER DNA trait (the ENTR law noise).',
    effect: '0 freezes all random motion; 2 doubles thermal noise.',
    tuning: 'The main "temperature" dial of the dish.',
    units: '× multiplier.',
  },
  WALL_REFLECT: {
    what: 'Bounciness of soft walls (used when TOROIDAL EDGES = 0).',
    effect: '0 = perfectly absorbing walls, 1 = perfect elastic reflection, 2 = super-bounce.',
    tuning: '1 keeps energy conserved at boundaries.',
    units: 'restitution fraction.',
  },
  TOROIDAL: {
    what: 'Default boundary topology of the dish — the value the WRAP law boots with.',
    effect: '1 = torus: leaving one edge re-enters the opposite edge. 0 = box with WALL REFLECT walls. Moving this slider flips the WRAP law and vice versa.',
    tuning: 'Toroidal boundaries avoid wall artifacts in gravity experiments.',
    units: '0/1 toggle.',
  },
  RESONANCE_Q: {
    what: 'Quality factor for the RESONANCE law.',
    effect: 'Bandwidth = 1/Q — high Q is sharply selective, low Q responds broadly.',
    tuning: '10 is a good compromise; raise for narrow-band resonance cascades.',
    units: 'dimensionless Q.',
  },
  HEAT_CAPACITY: {
    what: 'How much energy a temperature change requires.',
    effect: 'High values make the thermal field sluggish; low values make it twitchy.',
    tuning: '1 is neutral.',
    units: 'energy per degree.',
  },
  LIGHT_LEVEL: {
    what: 'Ambient light available for photosynthesis (LIFE law energy income).',
    effect: '0 = no photo-energy; 2 = abundant. Fed into the THERMAL field as well.',
    tuning: 'The main "sunlight" dial — lower it to force predation economies.',
    units: 'energy flux.',
  },
  RADIATION_LEVEL: {
    what: 'Ambient ionizing radiation dose rate.',
    effect: 'Accumulates in RADIATION_EXPOSURE, drives mutation and radiation damage under the RADIATION law.',
    tuning: 'A mutator dial — small increases dramatically speed up evolution.',
    units: 'dose per second.',
  },
  CRITICAL_TEMP: {
    what: 'Shared critical temperature for SUPERCONDUCTIVITY (unbind above) and BOSONIC (condensate below).',
    effect: 'Below T_C superconductors and Bose–Einstein condensates can form; above it they break down.',
    tuning: 'Set below the dish’s ambient temperature to make superconducting states rare.',
    units: 'temperature units (0.05–0.5).',
  },
  SPAWN_RATE: {
    what: 'Background spawn rate: new particles per second placed at random spawn positions.',
    effect: 'Independent of reproduction; capped by MAX POP and PARTICLE COUNT.',
    tuning: '0 turns the dish into a closed system — only births from REPRO.',
    units: 'particles/second.',
  },
  FIELD_GRID_DIM: {
    what: 'Resolution of the E.1 field grid (WIND/EM/THERMAL/INFO, walls, wells, portals).',
    effect: '0 = auto-scaled 12³–24³ to world size. Higher = sharper fields, more memory and per-tick cost.',
    tuning: 'Leave at auto unless you are deliberately tuning the medium.',
    units: 'cells per axis (0 = auto).',
  },
  FIELD_WIND: { what: 'Strength of the ambient WIND vector field on the field grid.', effect: 'Particles feel a force along the local wind gradient; the field itself advects and diffuses.', tuning: 'Combine with portals to build conveyor routes.', units: 'field strength 0–5.' },
  FIELD_THERMAL: { what: 'Strength of the ambient THERMAL scalar field.', effect: 'Drives heat flow into particles and couples to temperature-dependent laws.', tuning: '0.5 is the PRIME_DEFAULT background.', units: 'field strength 0–5.' },
  FIELD_EM: { what: 'Strength of the ambient EM vector field.', effect: 'Pushes charged particles; interacts with CHARGE_LAW and CONDUCTIVITY DNA.', tuning: 'Nice for building particle streams.', units: 'field strength 0–5.' },
  FIELD_INFO: { what: 'Strength of the ambient INFO scalar field.', effect: 'Carries market prices, group signals and stigmergy marks; gradient forces guide particles toward information.', tuning: 'Essential for civilization behaviour — keep nonzero in group worlds.', units: 'field strength 0–5.' },
  FIELD_DIFFUSION: { what: 'Rate at which field values spread between cells each tick.', effect: 'High diffusion smears fields quickly; low keeps sharp fronts.', tuning: '0.1 is the default compromise.', units: 'diffusion fraction 0–0.5.' },
  WALLS_PRESET: { what: 'Impassable wall layout written into the field grid.', effect: '0 = off, 1 = border, 2 = ring, 3 = cross. Walls are solid only while the COLL law is on.', tuning: 'Ring walls + portals create arenas.', units: 'preset id 0–3.' },
  WALL_THICKNESS: { what: 'Thickness of generated walls in field cells.', effect: 'Thicker walls are harder to tunnel through (TUNNELING scales with energy, not thickness).', tuning: '2 cells is the default.', units: 'cells 1–5.' },
  WELL_COUNT: { what: 'Number of gravity wells placed on the field grid.', effect: 'Wells pull particles radially; pairs of wells orbit matter between them.', tuning: '3 wells (PRIME_DEFAULT) gives a lively but not chaotic dish.', units: 'wells 0–16.' },
  WELL_STRENGTH: { what: 'Pull strength of each gravity well.', effect: 'Scales the radial attraction within the well’s reach.', tuning: '1–2 keeps orbits stable; above 3 wells eat the dish.', units: 'strength 0–5.' },
  PORTAL_COUNT: { what: 'Number of paired teleport portals on the field grid.', effect: 'Entering one side exits the other with momentum intact.', tuning: 'Pairs are assigned automatically; portals ignore walls.', units: 'portal pairs 0–8.' },
  SPECIES_INTERACTION: { what: 'Global scaling of inter-species AFFINITY forces.', effect: 'Negative repels other species (xenophobia), positive attracts (symbiosis).', tuning: '0 isolates species from each other entirely.', units: '× multiplier −2…2.' },
  ENERGY_TRANSFER: { what: 'Scaling of conduction between touching particles.', effect: '0 blocks all energy flow; higher conducts faster.', tuning: 'Important for predator/prey energy economies.', units: '× multiplier 0–2.' },
  MUTATION_RATE: { what: 'Global multiplier on DNA mutation during reproduction.', effect: '0 = perfect inheritance; 5 = chaotic genomes.', tuning: 'The master evolution-speed dial.', units: '× multiplier 0–5.' },
  DECAY_RATE: { what: 'Global scaling of metabolic decay and natural death.', effect: 'Higher values burn energy faster and shorten lifespans.', tuning: 'Lower to ease survival during evolution experiments.', units: '× multiplier 0–2.' },
  TIDAL_SCALE: { what: 'Strength of the TIDE law’s gravity-gradient force.', effect: 'Scales the differential pull across a particle’s radius near massive bodies.', tuning: 'Relevant for binaries and ring formation.', units: '× multiplier.' },
  FRICTION_COEFF: { what: 'Global multiplier for the FRICTION law.', effect: 'Scales velocity-proportional drag and the associated heating.', tuning: 'Raising it calms sliding surfaces but heats the dish.', units: '× multiplier.' },
  ELASTIC_RESTITUTION: { what: 'Restitution used by contact / COLL bounces when DNA does not specify one.', effect: '1 = perfectly elastic, 0 = sticky landing.', tuning: 'Keep ≤ 1 to avoid energy injection.', units: 'restitution 0–2.' },
  TURBULENCE_KICK: { what: 'Strength of TURBULENCE-style noise kicks (legacy knob kept for the world-param API).', effect: 'Scales random velocity impulses from noise laws.', tuning: '0 disables; the ENTROPY dial usually covers this role.', units: '× multiplier.' },
  CENTRIPETAL_SCALE: { what: 'Legacy strength knob for the old CENTRIPETAL law (now the slate CONTACT/MOMENTUM set).', effect: 'No effect unless a law reads it explicitly.', tuning: 'Leave at default.', units: '× multiplier.' },
  ROTATION_SPEED: { what: 'Legacy rigid-frame swirl speed knob.', effect: 'No effect unless a law reads it explicitly.', tuning: 'Leave at default.', units: '× multiplier.' },
  ACCRETION_RADIUS: { what: 'Capture range multiplier for the ACCR law.', effect: 'Larger values let distant particles fall into fusion range.', tuning: 'Raising it accelerates planet formation.', units: '× radius multiplier.' },
  SINGULARITY_HORIZON: { what: 'Event-horizon radius for the SINGULARITY law.', effect: 'Particles inside are consumed and the singularity grows.', tuning: 'Small horizons make black holes picky eaters.', units: 'world units.' },
  BOND_STRENGTH: { what: 'Global multiplier for BOND / POLYMER link forces.', effect: 'Scales the spring stiffness of molecular bonds.', tuning: 'Too high and molecules vibrate apart; too low and they sag.', units: '× multiplier.' },
  VOID_PRESSURE: { what: 'Outward pressure the VOID law applies at the boundary.', effect: 'Higher values blow matter off the edges faster.', tuning: '0 makes VOID a no-op except for deletion.', units: 'pressure.' },
  REPRODUCTION_THRESHOLD: { what: 'Energy a particle must store before REPRO can fire.', effect: 'Higher thresholds slow population growth and select for energy efficiency.', tuning: 'The main birth-control dial.', units: 'energy units.' },
  SENESCENCE_RATE: { what: 'Scaling of age-based death under SENESCENCE.', effect: 'Damps or amplifies aging mortality (interacts with TELOMERE_LENGTH DNA).', tuning: '0 gives immortality-by-age.', units: '× multiplier.' },
  PREDATION_EFFICIENCY: { what: 'Fraction of prey energy gained by predators (PREDATION / TRACK).', effect: '0.3 means predators recover 30% of the eaten mass’s energy.', tuning: '0.1–0.3 sustains Lotka–Volterra cycles; higher crashes prey.', units: 'fraction 0–1.' },
  SYMBIOSIS_BOOST: { what: 'Energy-transfer bonus under the SYMBIOSIS law.', effect: 'Scales how much surplus the richer partner shares.', tuning: 'Watch for runaway mutualism at high values.', units: '× multiplier.' },
  PARASITE_DRAIN: { what: 'Energy drain rate of the PARASITE law.', effect: 'Parasites siphon from larger hosts per contact tick.', tuning: 'High values make parasitism a dominant strategy.', units: 'energy/tick.' },
  IMMUNITY_SHIELD: { what: 'Armor regeneration rate under the IMMUNITY law.', effect: 'Scales how fast ARMOR refills toward its cap.', tuning: 'Balance against PREDATION_EFFICIENCY.', units: 'armor/tick.' },
  HIBERNATION_SAVINGS: { what: 'Metabolic savings while HIBERNATION holds a particle still.', effect: 'Scales the energy income of sleeping particles.', tuning: 'Higher values make torpor a strong survival strategy.', units: '× multiplier.' },
  TRACKING_SENSITIVITY: { what: 'Sensitivity of the TRACK law’s pursuit behaviour.', effect: 'Scales how strongly predators steer toward prey.', tuning: 'Too high makes pursuit jittery.', units: '× multiplier.' },
  CATALYSIS_SPEED: { what: 'Rate multiplier of the CATALYSIS_LAW.', effect: 'Scales catalyst-mediated reaction acceleration.', tuning: 'Doubling roughly doubles reaction throughput.', units: '× multiplier.' },
  SOLVATION_RATE: { what: 'Strength of solvent forces under SOLVATION.', effect: 'Scales charge-mediated drag in solution.', tuning: 'Only matters when charges exist.', units: '× multiplier.' },
  ACIDITY_PH: { what: 'Global acidity setpoint for the ACIDITY law.', effect: 'Biases reaction directions around the pH setpoint.', tuning: 'Extreme values suppress most chemistry.', units: 'pH 0–14 (scaled).' },
  OXIDATION_RATE: { what: 'Rate of the OXIDATION law.', effect: 'Scales electron-transfer reactions.', tuning: 'Pairs with REDUCTION for redox couples.', units: 'reactions/second.' },
  POLYMER_LIMIT: { what: 'Maximum chain length POLYMER will grow.', effect: 'Caps how long molecular chains can become.', tuning: 'Higher limits allow longer filaments.', units: 'monomers 2–12.' },
  CRYSTAL_LATTICE: { what: 'Lattice stiffness used by CRYSTALLIZATION.', effect: 'Scales the snap-to-grid force that orders crystals.', tuning: 'Higher values make more regular crystals.', units: '× multiplier.' },
  ELECTROLYSIS_POWER: { what: 'Energy released per electrolysis event.', effect: 'Scales mass→energy conversion yield.', tuning: 'Powers energy economies from chemistry.', units: 'energy.' },
  AUTOCATALYSIS_GAIN: { what: 'Self-catalysis boost under AUTOCATALYSIS.', effect: 'Same-species contacts amplify energy gain.', tuning: 'The autocatalytic-set dial for origin-of-life experiments.', units: '× multiplier.' },
  CONVECTION_RATE: { what: 'Rate of convective heat transport under CONVECTION.', effect: 'Scales buoyant heat circulation.', tuning: 'Drives weather-like thermal cells.', units: '× multiplier.' },
  PHASE_RADIATION_FACTOR: { what: 'Radiated power under PHASE_RADIATION.', effect: 'Scales how fast hot particles shed energy as radiation.', tuning: 'The cooling coefficient of the dish.', units: '× multiplier.' },
  LATENT_HEAT_BUFFER: { what: 'Energy absorbed per phase change under LATENT_HEAT.', effect: 'Higher values make melting/boiling consume more energy.', tuning: 'Stabilizes temperature around phase transitions.', units: 'energy.' },
  MELT_TEMP_POINT: { what: 'Melting temperature used by MELT / phase laws.', effect: 'Above this particles soften.', tuning: 'Set relative to the ambient thermal field.', units: 'temperature.' },
  BOIL_TEMP_POINT: { what: 'Boiling temperature used by BOIL / phase laws.', effect: 'Above this particles vaporize.', tuning: 'Keep above MELT_TEMP_POINT.', units: 'temperature.' },
  ADIABATIC_GAMMA: { what: 'Heat-capacity ratio γ for ADIABATIC compression.', effect: 'Scales heating during compression and cooling during expansion.', tuning: '1.4 is the diatomic-gas default.', units: 'γ 1–2.' },
  RUNAWAY_MULT: { what: 'Gain of the RUNAWAY thermal feedback.', effect: 'Scales the positive temperature→reaction→temperature loop.', tuning: 'Above ~1.5 expect thermal explosions.', units: '× multiplier.' },
  TIME_WARP_FACTOR: { what: 'Legacy time-warp factor (superseded by TIME SPEED in the TIME group).', effect: 'No effect unless a law reads it explicitly.', tuning: 'Use TIME SPEED instead.', units: '× multiplier.' },
  DIMENSIONAL_FOLD: { what: 'Strength of the fourth-axis drift under DIMENSIONALITY / HYPERPLANE.', effect: 'Higher values push particles further along the folded axis.', tuning: 'Subtle at low values; surreal above 2.', units: '× multiplier.' },
  CHAOS_LYAPUNOV: { what: 'Lyapunov gain for the CHAOS law.', effect: 'Scales exponential divergence of nearby trajectories.', tuning: 'The unpredictability dial.', units: '× multiplier.' },
  CONSCIOUSNESS_PHI: { what: 'Integrated-information threshold for the CONSCIOUSNESS law.', effect: 'Groups above Φ gain narrative attention.', tuning: 'Lower to make minds common.', units: 'Φ threshold.' },
  TELEPATHY_RANGE: { what: 'Maximum range of TELEPATHY links.', effect: 'Scales how far mind-to-mind communication reaches.', tuning: 'Beyond ~200 units it approaches global comms.', units: 'world units.' },
  ASTRAL_PHASE: { what: 'Phase offset for ASTRAL projection.', effect: 'Scales how far the astral body separates from matter.', tuning: 'Cosmetic for ghost behaviour.', units: 'phase 0–1.' },
  SYNCHRONICITY_RATE: { what: 'Rate at which SYNCHRONICITY phase-locks neighbours.', effect: 'Scales the pull toward shared phase.', tuning: 'High values create firefly-style global sync.', units: '× multiplier.' },
  COULOMB_CONSTANT: { what: 'Electrostatic constant k for charge forces.', effect: 'Scales attraction/repulsion between CHARGE carriers.', tuning: 'Charge is the strongest short-range force — raise carefully.', units: '× k multiplier.' },
  MAGNETIC_FLUX_SCALE: { what: 'Scaling of MAGNETISM dipole forces.', effect: 'Scales alignment and attraction of magnetic moments.', tuning: 'High values form magnet chains quickly.', units: '× multiplier.' },
  PLASMA_IONIZATION_ENERGY: { what: 'Energy needed to ionize a particle into plasma (PLASMA law).', effect: 'Lower values make plasma easier to sustain.', tuning: 'Set relative to typical ENERGY stores.', units: 'energy.' },
  DISCHARGE_ARC_THRESHOLD: { what: 'Charge difference that triggers a DISCHARGE arc.', effect: 'Lower thresholds make arcs frequent.', tuning: 'Arcs equalize charge and add heat.', units: 'charge units.' },
  SHIELDING_ATTENUATION: { what: 'Field attenuation of SHIELDING shells.', effect: 'Scales how much exterior field a shell blocks.', tuning: '1 = perfect Faraday cage.', units: 'fraction 0–1.' },
  POLARIZATION_DISPLACEMENT: { what: 'Displacement of bound charge under POLARIZATION.', effect: 'Scales induced-dipole strength.', tuning: 'Weak dielectric effects at low values.', units: '× multiplier.' },
  STIGMERGY_DECAY_RATE: { what: 'Decay of stigmergy marks on the INFO field.', effect: 'Higher values erase pheromone trails quickly.', tuning: 'Balance against deposit rate for trail persistence.', units: 'per second.' },
  HEBBIAN_LEARNING_RATE: { what: 'Rate of the LEARN law’s Hebbian updates.', effect: 'Scales how fast memory strengthens with co-activation.', tuning: 'High values make memory jittery.', units: '× multiplier.' },
  SIGNAL_BOOST_GAIN: { what: 'Amplification of SIGNAL_BOOST repeaters.', effect: 'Scales how much a boosted signal is amplified.', tuning: 'Above 2 signals saturate.', units: '× gain.' },
  CULTURAL_TRANSMISSION: { what: 'Rate culture spreads between species under CULTURE.', effect: 'Scales cross-species memory blending.', tuning: 'The multiculturalism dial.', units: '× multiplier.' },
  ENCRYPTION_CIPHER_KEY: { what: 'Cipher complexity for ENCRYPTION.', effect: 'Scales how well encrypted signals resist eavesdropping.', tuning: 'Only matters with predators that read signals.', units: 'key strength.' },
  NAVIGATION_GRADIENT_BIAS: { what: 'Bias of NAVIGATION toward INFO-field gradients.', effect: 'Scales path-finding pull toward goals.', tuning: '0.5 balances gradient following against momentum.', units: '× multiplier.' },
  TUNNELING_PROBABILITY: { what: 'Base probability of TUNNELING through walls.', effect: 'Scaled by particle ENERGY — hot particles tunnel more.', tuning: 'Keep small; tunneling breaks containment experiments.', units: 'probability.' },
  SUPERPOSITION_PHASE_SCALE: { what: 'Phase spread of superposed states (Set N).', effect: 'Scales how far the alternate position drifts.', tuning: 'Larger spreads make collapse visible.', units: '× multiplier.' },
  DECOHERENCE_RATE_FACTOR: { what: 'Rate superpositions decohere (Set N).', effect: 'Higher values collapse superpositions faster.', tuning: '0 keeps particles quantum forever.', units: 'per second.' },
  UNCERTAINTY_SIGMA: { what: 'Position/momentum spread under UNCERTAINTY.', effect: 'Scales the jitter floor of the uncertainty principle.', tuning: 'The quantum noise floor dial.', units: 'spread.' },
  ANTIMATTER_ANNIHILATION_YIELD: { what: 'Energy released per annihilation (ANTIMATTER law).', effect: 'Scales the conserved mass→energy burst.', tuning: 'Keep bounded — large yields flatten the dish.', units: 'energy.' },
  SPIN_PRECESSION_FREQ: { what: 'Precession frequency under the SPIN law.', effect: 'Scales how fast spin axes wobble.', tuning: 'Cosmetic for magnetic dynamics.', units: 'rad/s.' },
  AUTO_TUNE: { what: 'Automatic solver tuning (Set O perf overhaul).', effect: '1 = grid resolution scales with density (dim ≈ ∛(N/1.4), clamped 12–64) and interaction budgets adapt. 0 = manual knobs below.', tuning: 'Keep on unless benchmarking a specific knob.', units: '0/1 toggle.' },
  GRID_DIM: { what: 'Manual spatial-grid resolution (used when AUTO-TUNE is off).', effect: 'dim³ cells; finer grids reduce pair work at high density but cost rebuild time.', tuning: '12 is the classic floor; 32+ only pays off above ~25k particles.', units: 'cells per axis 12–64.' },
  CELL_CAP: { what: 'Maximum particles considered per grid cell.', effect: 'Truncates dense cells — a performance/accuracy trade.', tuning: 'Raise if dense clusters behave oddly.', units: 'particles/cell.' },
  MAX_INTERACTIONS: { what: 'Per-particle interaction budget per tick.', effect: 'Lowering truncates pair physics (nearest neighbours win).', tuning: 'The strongest performance dial — halving it roughly halves pair work in dense worlds.', units: 'interactions 8–500.' },
  NEIGHBOR_BUF: { what: 'Neighbour list buffer size per particle.', effect: 'Caps how many neighbours are gathered before force evaluation.', tuning: 'Pair with MAX INTERACTIONS.', units: 'neighbours.' },
  QUALITY_MODE: { what: 'Adaptive quality that trims the interaction budget as populations grow.', effect: '1 = solver reduces budgets adaptively; 0 = exact configured caps.', tuning: 'Off for determinism-sensitive benchmarks.', units: '0/1 toggle.' },
  TARGET_FPS: { what: 'Frame-rate target used by adaptive quality.', effect: 'The solver trims work when frames exceed the budget.', tuning: 'Lower on weak hardware.', units: 'frames/second.' },
  PAIRWISE_BUDGET: { what: 'Alternative pair-budget knob exposed for tuning.', effect: 'Caps pair evaluations per particle.', tuning: 'MAX INTERACTIONS usually covers this.', units: 'pairs/particle.' },
  EXPENSIVE_LAW_CADENCE: { what: 'Tick interval between expensive law passes.', effect: 'Higher values spread heavy systems (stellar, synthetic) over more ticks.', tuning: 'Raise if the main thread hitches at high population.', units: 'ticks between passes.' },
  TIME_SPEED: { what: 'Simulation speed multiplier (Deep Time).', effect: 'Multiplies solver dt — 2× runs twice the simulated seconds per real second.', tuning: '0.1 for slow-motion study, 10 for epoch spam.', units: '× multiplier 0.1–10.' },
  EPOCH_LENGTH: { what: 'Ticks per epoch in Deep Time.', effect: 'Eras advance on this boundary and take restorable snapshots.', tuning: 'Shorter epochs churn eras faster.', units: 'ticks.' },
  EXTINCTION_THRESHOLD: { what: 'Population-collapse fraction that triggers an extinction event.', effect: 'World events respond reversibly (drought field writes).', tuning: '0.3 = collapse to 30% counts as extinction.', units: 'fraction 0–1.' },
  RECOVERY_THRESHOLD: { what: 'Population-rebound fraction that closes an extinction event.', effect: 'Fertilization reverses when the population recovers.', tuning: 'Should exceed EXTINCTION_THRESHOLD.', units: 'fraction 0–1.' },
  EXOTIC_COUNT: { what: 'Number of exotic-matter zones seeded (Set L).', effect: '0 disables the exotic substrate.', tuning: 'Each zone is a distinct ANTIMATTER/DARK/STRANGE/NEGATIVE region.', units: 'zones.' },
  EXOTIC_ZONE_SIZE: { what: 'Radius of each exotic zone.', effect: 'Scales the affected field cells.', tuning: 'Large zones dominate the dish.', units: 'field cells.' },
  EXOTIC_ANNIHILATION_RADIUS: { what: 'Blast radius of antimatter annihilation.', effect: 'Energy bursts affect particles within this range.', tuning: 'Small radii keep explosions local.', units: 'world units.' },
  EXOTIC_STRANGE_RATE: { what: 'Contagion rate of strange matter.', effect: 'Scales how fast neighbours convert to strange matter.', tuning: 'The strange-matter pandemic dial.', units: 'per second.' },
  EXOTIC_NEGATIVE_STRENGTH: { what: 'Repulsive strength of negative mass.', effect: 'Scales anti-gravity nudges away from mass concentrations.', tuning: 'Negative-matter pools repel galaxies.', units: '× multiplier.' },
  EXOTIC_HALF_LIFE: { what: 'Persistence of an exotic state on a particle.', effect: 'Higher values make exotic matter stick around longer.', tuning: 'Short half-lives keep exotic events transient.', units: 'seconds.' },
  CURVATURE_STRENGTH: { what: 'Mass-warping of the CURVATURE field (Set M relativity).', effect: 'Scales how much particle mass bends the signal medium.', tuning: 'Feeds gravitational lensing of INFO signals.', units: '× multiplier.' },
  TIME_DILATION_MAX: { what: 'Cap on gravitational time dilation.', effect: 'Bounds how slow local clocks can run near mass.', tuning: '0.3 is the floor — never fully freeze time.', units: 'min localDt.' },
  LIGHT_SPEED: { what: 'The c used by relativistic formulas (Set M).', effect: 'Scales velocity time-dilation and E=mc² rates.', tuning: 'Lower c makes relativity visible at dish speeds.', units: 'units/second.' },
  LENSING_STRENGTH: { what: 'Strength of gravitational lensing on INFO signals.', effect: 'Scales how much signals curve toward mass.', tuning: '0.5 is subtle; 2 bends comms visibly.', units: '× multiplier.' },
  MASS_ENERGY_RATE: { what: 'Rate of E=mc² conversion.', effect: 'Scales ENERGY↔MASS exchange in both directions.', tuning: 'Feeds stellar ignition (Set O).', units: 'per second.' },
  QUANTUM_SUPERPOSITION_RATE: { what: 'Rate particles enter superposition (Set N).', effect: 'Scales how often slow, isolated particles go quantum.', tuning: 'Lower sim speed and isolation make it common.', units: 'per second.' },
  QUANTUM_SPREAD: { what: 'Position spread of the superposed branch.', effect: 'Scales the distance between the two quantum positions.', tuning: 'Larger spreads are visibly ghostly.', units: 'world units.' },
  QUANTUM_COLLAPSE_RADIUS: { what: 'Range at which neighbours collapse a superposition.', effect: 'Contact collapses to one branch.', tuning: 'Smaller radii let superpositions survive crowds.', units: 'world units.' },
  QUANTUM_ENTANGLE_RATE: { what: 'Rate superposed pairs entangle.', effect: 'Entangled pairs share ENERGY and momentum across distance.', tuning: 'Feeds TELEPORT-style correlations.', units: 'per second.' },
  QUANTUM_ENERGY_SHARE: { what: 'Fraction of energy shared between entangled partners.', effect: 'Scales the conserved energy link.', tuning: '0.3 gives strong coupling.', units: 'fraction 0–1.' },
  QUANTUM_TUNNEL_RATE: { what: 'Attempt rate for tunneling through walls (Set N).', effect: 'Scaled by ENERGY — hot particles try more often.', tuning: 'Complements TUNNELING_PROBABILITY.', units: 'attempts/second.' },
  QUANTUM_TUNNEL_ENERGY: { what: 'Energy gate for tunneling.', effect: 'Particles below this energy cannot tunnel.', tuning: 'Raises the cost of breaching containment.', units: 'energy.' },
  QUANTUM_OBSERVER_RADIUS: { what: 'Radius of quantum observation by high-DNA species.', effect: 'Species with SELECTION_SENSITIVITY/REGULATORY_DEPTH collapse superpositions within this range.', tuning: 'Make observers common by widening it.', units: 'world units.' },
  STELLAR_FORM: { what: 'Mass at which a dense cell ignites a star (Set O).', effect: 'Accretion past this mass starts fusion.', tuning: 'Lower to make stars common.', units: 'mass units.' },
  STELLAR_MAX: { what: 'Maximum number of simultaneous stars.', effect: 'Caps the stellar population.', tuning: '4–8 keeps the cosmic phase lively but readable.', units: 'stars.' },
  STELLAR_SEPARATION: { what: 'Minimum separation between stars.', effect: 'Prevents immediately merged binaries.', tuning: 'Raise for a sparse cosmos.', units: 'world units.' },
  STELLAR_RADIANCE: { what: 'Radiant output of stars.', effect: 'Scales THERMAL/INFO emission and the warm ENERGY feed.', tuning: 'Stars as suns for nearby life.', units: '× multiplier.' },
  STELLAR_HORIZON: { what: 'Mass past which a star collapses into a black hole.', effect: 'Accreting past this switches fusion off and Hawking emission on.', tuning: 'Set well above STELLAR_FORM.', units: 'mass units.' },
  STELLAR_SUPERNOVA: { what: 'Mass cap that detonates a star as a supernova.', effect: 'Radial shockwave + exotic heavy-element seeding.', tuning: 'The stellar endgame threshold.', units: 'mass units.' },
  STELLAR_HAWKING: { what: 'Hawking re-emission rate of black holes.', effect: 'Scales the slow mass leak back into the dish.', tuning: 'Higher values keep black holes transient.', units: 'mass/second.' },
  CRAFT_COST: { what: 'Treasury cost to craft an artifact (Set I).', effect: 'Scales TOOL/WEAPON/BARRIER prices.', tuning: 'High costs ration artifacts to rich groups.', units: 'treasury.' },
  ARTIFACT_DECAY: { what: 'Decay rate of artifacts under maintenance.', effect: 'Scales how fast tools/weapons/barriers wear out.', tuning: '0 makes artifacts permanent.', units: 'per second.' },
  POLICY_SHIFT: { what: 'Rate group policy vectors adapt (Set J).', effect: 'Scales how fast AGGRESSION/OPENNESS/MIGRATION respond to memory and treasury.', tuning: 'Slow shifts keep policy stable.', units: 'per second.' },
  ALLIANCE_RANGE: { what: 'Maximum range for alliances between groups.', effect: 'Similar neighbours within range ally and pool treasuries.', tuning: 'Wider ranges make mega-blocs.', units: 'world units.' },
  CONFLICT_THRESHOLD: { what: 'Policy divergence that triggers border conflict.', effect: 'Opposed groups conflict when divergence exceeds this.', tuning: 'Lower = more warlike dish.', units: 'divergence 0–1.' },
  HARVEST_RATE: { what: 'Rate groups harvest ambient field energy into treasury (Set K).', effect: 'Conserved — the field loses what the treasury gains.', tuning: 'The civilization energy income.', units: 'energy/second.' },
  GRID_FEED: { what: 'Rate allied grids feed member ENERGY from treasury.', effect: 'Scales the allied energy distribution.', tuning: 'High values make alliances strong.', units: 'energy/second.' },
  MEGA_INVEST: { what: 'Treasury investment cadence for mega-structures.', effect: 'WALL/BRIDGE/HUB complete on this budget.', tuning: 'Large projects need big treasuries.', units: 'treasury/investment.' },
  SYNTHETIC_RATE: { what: 'Spawn rate of synthetic organisms from advanced HUBs (Set P).', effect: '0 disables synthetic life.', tuning: 'Deterministic hash gate — higher rates spawn sooner.', units: 'attempts/cadence.' },
  SYNTHETIC_MAX: { what: 'Maximum number of synthetic organisms.', effect: 'Caps the synthetic population.', tuning: 'Balance against UPKEEP drain.', units: 'organisms.' },
  SYNTHETIC_UPKEEP: { what: 'Energy upkeep of synthetic organisms.', effect: 'Scales decay when upkeep is unpaid.', tuning: 'High upkeep makes synthetics fragile.', units: 'energy/cadence.' },
  UPLOAD_THRESHOLD: { what: 'Species intelligence needed for consciousness upload (Set P).', effect: 'Species above the threshold upload members to the virtual layer.', tuning: 'The transhumanism dial.', units: 'intelligence score.' },
  UPLOAD_RATE: { what: 'Rate of uploads once the threshold is met.', effect: 'Scales how fast minds transfer.', tuning: 'Slow uploads spread the transition over epochs.', units: 'uploads/cadence.' },
  UPLOAD_PERSIST: { what: 'Persistence of uploaded consciousness.', effect: 'Scales how long uploads survive before expiring.', tuning: 'High values build lasting digital civilizations.', units: 'ticks.' },
  VIRTUAL_LAYER_MAX: { what: 'Maximum population of the uploaded virtual layer.', effect: 'Caps total uploaded minds.', tuning: 'The heaven capacity.', units: 'minds.' },
};

// ── DNA trait help (name → sections) ─────────────────────────────────────
// Shared record for the four channel-filter sliders
const TUNING_CH_HELP = { what: 'Channel filter (4 channels: TUNING_CH1–CH4).', effect: 'Delivery is the normalized dot product of receiver × sender tuning — matched channels hear each other.', tuning: 'Channel separation enables private "languages".', units: '0–1 per channel.' };

export const DNA_HELP = {
  Force: { what: 'Base strength of attraction/repulsion forces this species exerts.', effect: 'Scales nearly every pairwise force the solver computes for the particle.', tuning: 'With Viscosity 0.98 it forms stable molecules; with low Viscosity it makes hot chaos.', units: 'force scale (default 1.0).' },
  Viscosity: { what: 'Kinetic-energy bleed on contact.', effect: '0.98+ acts as a shock absorber letting particles settle; low values keep orbits hot.', tuning: 'The single most important stability trait — the "Kinetic Buffer".', units: 'damping 0–1.' },
  Torque: { what: 'Rotational momentum of the velocity vector.', effect: 'Gently rotates velocity each tick; with MAGNETISM/SPIN drives alignment.', tuning: '0.2 adds organic curl to motion.', units: 'rad/tick.' },
  Jitter: { what: 'Random thermal noise added to velocity.', effect: 'Scaled globally by ENTROPY; the temperature of the species.', tuning: '0.05 keeps matter calm; high jitter mimics a gas.', units: 'velocity/tick.' },
  Polarity: { what: 'Charge-like sign and strength (−1…1).', effect: 'Drives CHARGE_LAW, SOLVATION and polarity-sorted affinity forces.', tuning: 'Opposite polarities bond; identical repel.', units: '−1…1.' },
  Alpha: { what: 'Render transparency and social "loudness".', effect: 'Visual opacity plus a small bias in signal reception.', tuning: '0.4 is the sweet spot for visible-but-not-glaring colonies.', units: '0–1.' },
  Symmetry: { what: 'Body-shape warping away from a perfect circle.', effect: 'Ellipses interlock mechanically — the "Geometric Lock" for rigid beams.', tuning: '0.8 with high Stiffness builds crystals.', units: '0–1.' },
  'Hidden Mass': { what: 'Extra mass beyond the visual radius.', effect: 'Affects gravity and collision response without changing size.', tuning: 'Dense cores for compact heavy particles.', units: 'mass units.' },
  Stiffness: { what: 'Rigidity of shape and contact response.', effect: 'High values make hard edges that resist deformation.', tuning: '2.5 for structural material.', units: 'stiffness scale.' },
  Fusion: { what: 'Mass-merging efficiency when ACCR fuses particles.', effect: '0.5–1.5 multiplier on combined mass after a merger.', tuning: '1.0 conserves mass exactly.', units: '× multiplier.' },
  'Birth Rate': { what: 'Intrinsic fecundity under LIFE/REPRO.', effect: 'Scales mitosis probability when energy is sufficient.', tuning: 'Balance with Death Rate for carrying capacity.', units: 'births/second.' },
  'Death Rate': { what: 'Intrinsic mortality under LIFE.', effect: 'Baseline energy decay and death probability.', tuning: '0 makes starvation the only killer.', units: 'deaths/second.' },
  Mutation: { what: 'Per-birth DNA mutation magnitude.', effect: 'Scaled globally by MUTATION_RATE; deviates child genomes.', tuning: 'The raw material of evolution.', units: 'mutation step.' },
  'Signal Response': { what: 'Sensitivity to received signals.', effect: 'Converts signal delivery into attraction force + energy — the "Social Oscillator".', tuning: '1.5 creates travelling colony waves.', units: 'response scale.' },
  'Pulse Rate': { what: 'Oscillator frequency of signal emission.', effect: 'Phase = sin(age·0.01·(0.1+pulseRate)) gates emission.', tuning: '0.1 for heartbeats, higher for chatter.', units: 'Hz (scaled).' },
  Tidal: { what: 'Sensitivity to gravity gradients (TIDE).', effect: 'Scales the differential pull across the particle radius.', tuning: 'Relevant for tidal locking and ring formation.', units: 'sensitivity.' },
  'Fusion Momentum': { what: 'Minimum relative momentum to fuse on impact (ACCR).', effect: 'Fast pairs merge instantly below/above this threshold; slow pairs dwell instead.', tuning: 'High values make accretion impact-driven.', units: 'momentum (0–50).' },
  'Fusion Time': { what: 'Seconds of close proximity before sub-threshold pairs cement.', effect: 'Dwell past half the time adjoins the pair; past the full time they would fuse (composites supersede).', tuning: '2–3 s gives rubble-pile growth.', units: 'seconds (0–100).' },
  'Neighborhood Radius': { what: 'Range of social/signal perception.', effect: 'Gates signal exchange and neighbour awareness.', tuning: 'The social reach of the species.', units: 'world units.' },
  'Signal Strength': { what: 'Amplitude of emitted pulses.', effect: 'Gates emission and scales delivery at receivers.', tuning: 'The "voice volume" of the species.', units: '0–1.' },
  'Signal Decay': { what: 'Exponential decay of the pulse envelope.', effect: 'Higher values shorten each emission burst.', tuning: 'Sharp pulses carry timing information.', units: 'per second.' },
  'Propagation Speed': { what: 'Multiplier on received signal strength.', effect: 'Acts as receiver gain in the delivery formula.', tuning: 'Tuned ears vs deaf ears.', units: '× gain.' },
  'Tuning Ch1': TUNING_CH_HELP,
  'Tuning Ch2': TUNING_CH_HELP,
  'Tuning Ch3': TUNING_CH_HELP,
  'Tuning Ch4': TUNING_CH_HELP,
  Inertia: { what: 'Resistance to acceleration (the MASS_INERTIA law).', effect: 'Force response divides by effective inertia.', tuning: '1.0 is neutral.', units: 'inertia 0.1–5.' },
  Friction: { what: 'Material surface friction.', effect: 'Under FRICTION law, drag scales with this and motion converts to heat.', tuning: '0.01 is near-frictionless ice.', units: 'coefficient.' },
  'Max Velocity': { what: 'Per-particle speed cap.', effect: 'Clamps integration output; also the fallback for MAX_VELOCITY DNA.', tuning: '10 is the global default cap.', units: 'units/second.' },
  'Base Radius': { what: 'Physical size of the particle.', effect: 'Contact, bonding and fusion all scale from this.', tuning: '5 is standard; large particles dominate space.', units: 'world units.' },
  Elasticity: { what: 'Bounciness on contact (0–1).', effect: 'Sets the restitution used by COLL and contact responses.', tuning: 'Light particles still bounce harder (inverse-mass weighting).', units: 'restitution 0–1.' },
  'Bond Angle': { what: 'Preferred angle between bonds.', effect: 'Shapes molecular geometry under BOND/POLYMER.', tuning: '120° makes hexagonal lattices.', units: 'degrees (scaled).' },
  Conductivity: { what: 'Electrical and thermal conduction.', effect: 'Gates ELECTROLYSIS and conduction speed.', tuning: '1 makes an electrolyte; 0 an insulator.', units: 'conductance 0–1.' },
  'Magnetic Moment': { what: 'Dipole strength under MAGNETISM/SPIN.', effect: 'Scales alignment forces.', tuning: 'Pairs with Torque for compass behaviour.', units: 'moment 0–1.' },
  'Energy Efficiency': { what: 'Fraction of energy income retained.', effect: 'High efficiency slows metabolic decay under LIFE.', tuning: 'The trophic-efficiency dial.', units: '0–1.' },
  'Sex Chance': { what: 'Probability of sexual vs asexual reproduction.', effect: 'Sexual reproduction mixes two parents’ genomes.', tuning: 'Doubles genetic recombination when high.', units: 'probability 0–1.' },
  'Predation Bias': { what: 'Tendency to hunt other species.', effect: 'Gates PREDATION pursuit behaviour.', tuning: '0.5+ makes an active hunter.', units: 'bias 0–1.' },
  'Reaction Threshold': { what: 'Energy/charge barrier for chemical reactions.', effect: 'Reactions below the threshold do not fire.', tuning: 'Low thresholds make reactive species.', units: 'energy.' },
  Catalysis: { what: 'Catalytic multiplier on reaction rates.', effect: 'Under CATALYSIS_LAW/AUTOCATALYSIS, scales the speed-up given to reactions.', tuning: '1.5 doubles nearby reaction throughput.', units: '× multiplier.' },
  'Heat Output': { what: 'Metabolic heat produced.', effect: 'Feeds the THERMAL field and BUOYANCY lift.', tuning: 'Warm species rise — literal social mobility.', units: 'heat/tick.' },
  'Memory Decay': { what: 'Decay of internal MEMORY state.', effect: 'Slower decay retains learned information longer.', tuning: 'Pairs with MEMORY_DECAY (DNA 40) semantics.', units: 'per second.' },
  'Species Affinity': { what: 'Attraction to conspecifics.', effect: 'Drives flocking and group cohesion.', tuning: '0.8 forms tight colonies.', units: 'affinity 0–1.' },
  Dominance: { what: 'Genetic dominance of this species’ alleles.', effect: 'Biases inheritance in mixed offspring.', tuning: 'High dominance spreads traits faster.', units: '0–1.' },
  'Crossover Rate': { what: 'Rate of genetic recombination during sexual reproduction.', effect: 'Higher rates shuffle parental chromosomes more.', tuning: 'The genetic-mixing dial.', units: 'rate 0–1.' },
  'Epigenetic Drift': { what: 'Slow drift of gene expression without DNA change.', effect: 'Phenotypes adapt without mutation.', tuning: 'Lamarckian wiggle room.', units: 'rate.' },
  Heterozygosity: { what: 'Genetic diversity maintained in the genome.', effect: 'High values resist inbreeding depression.', tuning: 'Buffer against founder effects.', units: '0–1.' },
  'Gene Flow': { what: 'Rate of gene exchange between species.', effect: 'Hybridization strength.', tuning: 'Blurs species boundaries when high.', units: 'rate.' },
  Repressor: { what: 'Gene-silencing strength.', effect: 'Suppresses expression of some traits.', tuning: 'Epigenetic volume knob.', units: '0–1.' },
  'Allele Count': { what: 'Number of alleles per locus (REPRO input).', effect: 'More alleles widen the mutation search space.', tuning: '2–4 is diploid-to-tetraploid range.', units: 'alleles 1–8.' },
  'Epigenetic Rate': { what: 'Rate of epigenetic marker changes.', effect: 'Scales expression-level adaptation speed.', tuning: 'Fast epigenetics = quick acclimatization.', units: 'per second.' },
  'HGT Rate': { what: 'Horizontal gene transfer rate.', effect: 'Species swap genes on contact (REPRO).', tuning: 'The bacterial promiscuity dial.', units: 'rate.' },
  'Repair Efficiency': { what: 'DNA repair quality (REPRO input).', effect: 'High efficiency undoes mutations before reproduction.', tuning: 'The mutation-correction dial.', units: '0–1.' },
  'Drift Rate': { what: 'Genetic drift magnitude (GENOTYPE).', effect: 'Random allele-frequency changes.', tuning: 'Strong drift in small populations.', units: 'rate.' },
  'Selection Sensitivity': { what: 'Environmental selection pressure (GENOTYPE).', effect: 'Also scales quantum observation (Set N).', tuning: 'Doubles as the "observer" trait.', units: 'sensitivity.' },
  'Speciation Threshold': { what: 'Isolation level that splits the species (Set A.1).', effect: 'Lower thresholds make speciation frequent.', tuning: 'The evolvability dial for the living world.', units: 'threshold.' },
  'Adaptation Rate': { what: 'Speed of adaptive allele shifts (GENOTYPE).', effect: 'Scales directed response to selection.', tuning: 'High values make evolution fast but prone to overshoot.', units: 'rate.' },
  'Transposon Rate': { what: 'Jumping-gene activity (REPRO input).', effect: 'Transposons shuffle genome chunks.', tuning: 'A mutagenic wildcard.', units: 'rate.' },
  'Gene Silencing': { what: 'Rate genes switch off (GENOTYPE).', effect: 'Silenced genes stop being expressed.', tuning: 'Prunes unused traits.', units: 'rate.' },
  'Recombination Bias': { what: 'Bias in crossover positions (REPRO).', effect: 'Biases where chromosomes swap.', tuning: 'Hotspots vs uniform crossover.', units: 'bias −1…1.' },
  'Mutagen Sensitivity': { what: 'Response to RADIATION_LEVEL (GENOTYPE).', effect: 'Scales mutation increase under radiation.', tuning: 'Sensitive species evolve fast in hot zones.', units: 'sensitivity.' },
  'Telomere Length': { what: 'Aging buffer (SENESCENCE input).', effect: 'Longer telomeres delay aging death.', tuning: 'The lifespan dial.', units: 'length.' },
  'Ploidy Level': { what: 'Chromosome sets per cell (REPRO input).', effect: 'Higher ploidy adds genetic redundancy.', tuning: '1 = haploid, 2 = diploid.', units: 'sets 1–4.' },
  'Codon Bias': { what: 'Codon usage preference (GENOTYPE).', effect: 'Biases which genes are read efficiently.', tuning: 'Subtle expression-level effect.', units: 'bias.' },
  'Regulatory Depth': { what: 'Depth of gene-regulatory networks (GENOTYPE).', effect: 'Also scales quantum observation (Set N).', tuning: 'Deep regulation means complex phenotypes.', units: 'depth 0–1.' },
};// ── Popup infrastructure ─────────────────────────────────────────────────
let popupEl = null;
let hideTimer = null;
let currentAnchor = null;
let unregister = null;
let paramHelpDismissReady = false;

function ensurePopup() {
  if (popupEl) return popupEl;
  popupEl = document.createElement('div');
  popupEl.className = 'param-help-popup hidden';
  popupEl.setAttribute('role', 'tooltip');
  document.body.appendChild(popupEl);
  return popupEl;
}

function buildSections(help, meta) {
  let html = '';
  if (meta && meta.name) {
    html += `<div class="php-title">${meta.name}`;
    if (meta.key) html += `<span class="php-key">${meta.key}</span>`;
    html += `</div>`;
  }
  if (meta && meta.range) {
    html += `<div class="php-range">range ${meta.range} · default ${meta.def}</div>`;
  }
  const rows = [['What it is', help.what], ['What it does', help.effect], ['Tuning guidance', help.tuning], ['Units / scale', help.units]];
  for (const [label, text] of rows) {
    if (!text) continue;
    html += `<div class="php-section"><div class="php-label">${label}</div><div class="php-text">${text}</div></div>`;
  }
  return html;
}

function showPopup(anchorEl, html) {
  const popup = ensurePopup();
  clearTimeout(hideTimer);
  popup.innerHTML = html;
  popup.classList.remove('hidden');
  currentAnchor = anchorEl;
  // Re-registered on every open rather than once. The bus keys its self-exemption
  // on the anchor, so a record left over from a long press on a *different*
  // parameter would let a tap on that other label pass through and leave this
  // popup stranded. Re-registering costs one Set entry and removes the class of
  // bug entirely; `install()` is idempotent, so no duplicate listeners appear.
  if (unregister) unregister();
  unregister = registerTooltip({
    name: 'param-help',
    anchor: anchorEl,
    dismiss: () => hideParamPopup(),
  });
  const rect = anchorEl.getBoundingClientRect();
  popup.style.visibility = 'hidden';
  popup.style.display = 'block';
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  popup.style.display = '';
  popup.style.visibility = '';
  let x = rect.right + 10;
  let y = rect.top - 8;
  if (x + pw > window.innerWidth - 8) x = Math.max(8, rect.left - pw - 10);
  if (y + ph > window.innerHeight - 8) y = Math.max(8, window.innerHeight - ph - 8);
  if (y < 8) y = 8;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
}

export function hideParamPopup() {
  if (popupEl) popupEl.classList.add('hidden');
  currentAnchor = null;
  if (unregister) { unregister(); unregister = null; }
}

/** True when a parameter popup is currently open. Test seam. */
export function isParamPopupVisible() {
  return Boolean(popupEl) && !popupEl.classList.contains('hidden');
}

/**
 * Install the Escape-to-close listener once.
 *
 * The bus closes the popup on any press, but the press that *opens* it is
 * consumed by the 500ms long-press timer and so never reaches the bus; Escape
 * remains the cheapest confirmation that the popup is dismissible at all.
 * Called from the UI bootstrap rather than at import time so a headless import
 * stays side-effect free.
 */
export function initParamHelpDismiss() {
  if (typeof document === 'undefined' || paramHelpDismissReady) return false;
  paramHelpDismissReady = true;
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (isParamPopupVisible()) hideParamPopup();
  });
  return true;
}

/**
 * Attach long-press (500 ms) + right-click help behaviour to a parameter
 * label. Used by sliderControl.js and the DNA panel.
 *
 * @param {HTMLElement} labelEl - the label element users press
 * @param {object} lookup - { key, name, min, max, def, step }
 */
export function attachParamHelp(labelEl, lookup) {
  if (!labelEl) return;
  const help = EXACT_KEY_HELP[lookup.key] || DNA_HELP[lookup.name] || null;
  const meta = {
    name: lookup.name || lookup.key,
    key: lookup.key || '',
    range: lookup.min !== undefined ? `${formatNum(lookup.min)} … ${formatNum(lookup.max)}` : '',
    def: lookup.def !== undefined ? formatNum(lookup.def) : '',
  };

  let pressTimer = null;
  let pressed = false;

  const open = (e) => {
    if (e) e.preventDefault();
    pressed = true;
    const content = buildSections(help || {
      what: `Runtime parameter (${lookup.key || lookup.name}).`,
      effect: 'Adjusts the simulation live — no restart needed.',
      tuning: 'No curated guidance is recorded for this parameter yet; it follows the standard range semantics.',
      units: '',
    }, meta);
    showPopup(labelEl, content);
  };
  const cancel = () => {
    clearTimeout(pressTimer);
    // The popup deliberately does NOT hide here. It used to hide 120ms after
    // release, which meant a long press flashed a wall of text and then took
    // it away before it could be read. It now stays until the next tap
    // anywhere (see tooltipDismiss.js) or Escape. The pointerup that ends the
    // long press is not a tap — the popup is not even open when it fires — so
    // it is safe to ignore.
  };

  // Long-press with mouse / touch / pen
  labelEl.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return; // right-click handled separately
    pressTimer = setTimeout(() => open(e), 500);
  });
  labelEl.addEventListener('pointerup', cancel);
  labelEl.addEventListener('pointerleave', cancel);
  labelEl.addEventListener('pointercancel', cancel);
  // Right-click = instant help
  labelEl.addEventListener('contextmenu', open);
  // Suppress the click that follows a long-press
  labelEl.addEventListener('click', (e) => {
    if (pressed) { e.preventDefault(); e.stopPropagation(); pressed = false; }
  }, true);
}

function formatNum(n) {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US');
  return String(parseFloat(n.toFixed(3)));
}
