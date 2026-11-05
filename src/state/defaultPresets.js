/**
 * VEPA v3 — Default Presets
 * PRIME_DEFAULT: 5 species with distinct DNA profiles.
 * TIDAL_BLOOM: the boot world (see TIDAL_BLOOM below).
 */

export const PRIME_DEFAULT = {
    name: 'PRIME_DEFAULT',
    speciesCount: 5,
    worldParams: {
        worldSize: 800,
        entropy: 0.1,
        gravity: 0.5,
        dt: 1.0,
    },
    species: [
        {
            name: 'Predator',
            color: [255, 80, 80],
            dna: {
                FORCE: 1.2, VISCOSITY: 0.95, JITTER: 0.05,
                PREDATION_BIAS: 0.8, BIRTH_RATE: 0.3, DEATH_RATE: 0.1,
                BASE_RADIUS: 2.0, HIDDEN_MASS: 1.0,
            }
        },
        {
            name: 'Sol',
            color: [255, 200, 50],
            dna: {
                FORCE: 0.8, VISCOSITY: 0.97, JITTER: 0.02,
                FUSION: 2.0, FUSION_MOMENTUM: 0.3, BIRTH_RATE: 0.1,
                BASE_RADIUS: 3.0, HEAT_OUTPUT: 0.5,
            }
        },
        {
            name: 'Life',
            color: [80, 255, 120],
            dna: {
                FORCE: 1.0, VISCOSITY: 0.98, JITTER: 0.03,
                BIRTH_RATE: 0.5, MUTATION: 0.3, ENERGY_EFFICIENCY: 0.9,
                BASE_RADIUS: 1.5, SIGNAL_RESP: 1.0,
            }
        },
        {
            name: 'Aether',
            color: [120, 160, 255],
            dna: {
                FORCE: 0.5, VISCOSITY: 0.99, JITTER: 0.01,
                SIGNAL_RESP: 2.0, PULSE_RATE: 0.3, SIGNAL_STRENGTH: 0.95,
                BASE_RADIUS: 1.0, CONDUCTIVITY: 0.8,
            }
        },
        {
            name: 'Void',
            color: [100, 60, 140],
            dna: {
                FORCE: -0.5, VISCOSITY: 0.96, JITTER: 0.08,
                DEATH_RATE: 0.2, HIDDEN_MASS: 3.0, PREDATION_BIAS: -0.3,
                BASE_RADIUS: 2.5, ALPHA: 0.6,
            }
        },
    ],
    laws: [
        'GRAV', 'DRAG', 'ENTR', 'BUOYANCY', 'COLL',
        'LIFE', 'GLOW', 'REPRO', 'PHENOTYPE', 'GENOTYPE',
        // Richer emergent substrate (v8.15): communication + hebbian learning
        // + cultural transmission + species affinity drive the group/culture/
        // memory/speciation layers from first boot.
        'COMMS', 'LEARN', 'CULTURE', 'AFFINITY', 'STIGMERGY',
    ],
};

/**
 * TIDAL_BLOOM — the world the simulation now boots into.
 *
 * The intent is a single readable story rather than "more laws on". A tidal
 * force moves a thermal medium; the thermal medium drives phase changes and
 * catalysis; catalysis and polymerisation build persistent structure; and the
 * information layer reads that structure back as memory, stigmergy and
 * culture. The social stack — groups, tribes, polities, the codex — only
 * becomes visible once COMMS, STIGMERGY and CULTURE are actually doing
 * something, which is why they are tuned rather than merely switched on.
 *
 * Every parameter here is a real WORLD_PARAM_DEF key with a real min/max, and
 * every law is a real LAW_INDEXES entry; both are validated by
 * tests/unit/tidalBloom.test.js. Nothing is aspirational.
 *
 * What to watch for, in order:
 *   1. TIDE + CONVECTION carry visible bulk motion within the first seconds.
 *   2. LATENT_HEAT_BUFFER + CRITICAL_TEMP keep that motion from simply boiling
 *      the dish; the equilibrium is the point.
 *   3. AUTOCATALYSIS_GAIN above 1 makes reactions self-sustaining, which is
 *      where visible structure comes from.
 *   4. STIGMERGY_DECAY_RATE low + HEBBIAN_LEARNING_RATE high means trails
 *      persist and are learned from — the substrate the culture system reads.
 *   5. MUTATION_RATE above 1 with PREDATION_EFFICIENCY high gives selection
 *      something to act on, so SPECIES and BIODIVERSITY move.
 */
export const TIDAL_BLOOM = {
    name: 'TIDAL_BLOOM',
    speciesCount: 5,
    worldParams: {
        worldSize: 1200,
        entropy: 0.1,
        gravity: 0.5,
        dt: 1.0,
        // ── Substrate ──
        INITIAL_POP: 900,
        MAX_POP: 6000,
        SHAPE: 0.35,
        SPAWN_CENTRES: 6,
        SPAWN_CENTRE_RANDOM: 0.35,
        SPAWN_CENTRE_BIAS: 0.35,
        // ── The tide, and the heat it carries ──
        TIDAL_SCALE: 1.6,
        FIELD_THERMAL: 0.75,
        FIELD_INFO: 0.6,
        CONVECTION_RATE: 0.7,
        LATENT_HEAT_BUFFER: 0.85,
        CRITICAL_TEMP: 0.42,
        HEAT_CAPACITY: 0.8,
        LIGHT_LEVEL: 0.7,
        // ── Structure that persists ──
        AUTOCATALYSIS_GAIN: 1.35,
        CATALYSIS_SPEED: 1.25,
        POLYMER_LIMIT: 4.0,
        CRYSTAL_LATTICE: 1.2,
        BOND_STRENGTH: 1.3,
        // ── The information substrate the social stack reads ──
        STIGMERGY_DECAY_RATE: 0.02,
        HEBBIAN_LEARNING_RATE: 0.85,
        SIGNAL_BOOST_GAIN: 1.35,
        CULTURAL_TRANSMISSION: 0.9,
        // ── Selection, so evolution has work to do ──
        MUTATION_RATE: 1.4,
        PREDATION_EFFICIENCY: 1.25,
        SYMBIOSIS_BOOST: 1.2,
        SENESCENCE_RATE: 0.6,
        REPRODUCTION_THRESHOLD: 35,
        // ── Eras, so the continuity/codex layer gets sampled ──
        EPOCH_LENGTH: 420,
        EXTINCTION_THRESHOLD: 0.3,
        RECOVERY_THRESHOLD: 0.55,
        // ── Groups ──
        POLICY_SHIFT: 0.5,
        ALLIANCE_RANGE: 400,
        CONFLICT_THRESHOLD: 0.6,
        HARVEST_RATE: 0.7,
    },
    species: [
        {
            // Grows the substrate: high catalysis output, slow, sturdy, and it
            // seeds the polymer chemistry the rest of the world feeds on.
            name: 'Bloom',
            color: [120, 255, 180],
            dna: {
                FORCE: 0.7, VISCOSITY: 0.98, JITTER: 0.02,
                HEAT_OUTPUT: 0.95, STIFFNESS: 1.6, REACTION_THRESHOLD: 30,
                BIRTH_RATE: 0.45, DEATH_RATE: 0.08,
                BASE_RADIUS: 2.2, CATALYSIS: 1.3,
            }
        },
        {
            // The predator that keeps the ecology honest: high predation bias,
            // low birth rate, so it caps Bloom rather than replacing it.
            name: 'Stalker',
            color: [255, 90, 110],
            dna: {
                FORCE: 1.5, VISCOSITY: 0.94, JITTER: 0.06,
                PREDATION_BIAS: 1.4, BIRTH_RATE: 0.15, DEATH_RATE: 0.12,
                BASE_RADIUS: 2.6, HIDDEN_MASS: 1.6, ENERGY_EFFICIENCY: 1.2,
            }
        },
        {
            // The signal carrier: extreme COMMS response and low mass, so the
            // information layer has something light enough to move freely.
            name: 'Chorus',
            color: [140, 200, 255],
            dna: {
                FORCE: 0.4, VISCOSITY: 0.99, JITTER: 0.01,
                SIGNAL_RESP: 1.9, PULSE_RATE: 0.5, SIGNAL_STRENGTH: 0.95,
                SIGNAL_STRENGTH: 0.95, PROPAGATION_SPEED: 0.9,
                BASE_RADIUS: 1.0, ALPHA: 0.8,
            }
        },
        {
            // The dense counterweight: heavy, rigid, slow and nearly opaque.
            // Bloom emits heat (HEAT_OUTPUT 0.95) while Anchor emits none, so
            // the two separate in a thermal gradient and CONVECTION becomes
            // visible rather than uniform. ALPHA is transparency and is clamped
            // at 0, so "cold" is expressed by mass and stiffness, not by a
            // negative heat output.
            name: 'Anchor',
            color: [110, 130, 200],
            dna: {
                FORCE: 0.3, VISCOSITY: 0.995, JITTER: 0.005,
                ALPHA: 0.05, HEAT_OUTPUT: 0, BIRTH_RATE: 0.2,
                DEATH_RATE: 0.05, BASE_RADIUS: 3.4, HIDDEN_MASS: 3.2,
                STIFFNESS: 1.3,
            }
        },
        {
            // The dissolver: entropy and decay, feeding CRYSTALLIZATION and
            // REDUCTION so chemistry never fully settles.
            name: 'Drift',
            color: [220, 190, 90],
            dna: {
                FORCE: 0.6, VISCOSITY: 0.97, JITTER: 0.12,
                MUTATION: 1.5, DEATH_RATE: 0.35, FUSION: 0.3,
                BASE_RADIUS: 1.4, STIFFNESS: 0.6, CONDUCTIVITY: 0.5,
            }
        },
    ],
    laws: [
        // ── Motion: the tide and the bulk medium it drives ──
        'GRAV', 'DRAG', 'ENTR', 'BUOYANCY', 'COLL', 'ACCR', 'BOND', 'TIDE',
        'FIELD', 'FRICTION',
        // ── Heat: what makes the tide visible as a medium, not a force ──
        'HEAT', 'CONVECTION', 'LATENT_HEAT', 'EQUILIBRIUM',
        // ── Chemistry: where persistent structure comes from ──
        'CATALYSIS_LAW', 'POLYMER', 'CRYSTALLIZATION', 'AUTOCATALYSIS',
        'OXIDATION',
        // ── Life: reproduction, selection and the ecological tension ──
        'LIFE', 'GLOW', 'ENERGY', 'REPRO', 'GENOTYPE', 'PHENOTYPE',
        'SENESCENCE', 'PREDATION', 'SYMBIOSIS',
        // ── Signal and memory: the substrate the social stack reads ──
        'COMMS', 'AFFINITY',
        'MEMORY', 'PATTERN', 'STIGMERGY', 'LEARN', 'SYMBOL', 'METRIC',
        'CULTURE', 'FEEDBACK',
        // ── A thin metaphysics layer, enough for the narrative engines ──
        'SOUL_LAW', 'MIND',
    ],
};

/** The preset the simulation boots into. */
export const DEFAULT_PRESET = TIDAL_BLOOM;
