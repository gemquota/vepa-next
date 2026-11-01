/**
 * VEPA v3 — Default Presets
 * PRIME_DEFAULT: 5 species with distinct DNA profiles.
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
                SIGNAL_RESP: 2.0, PULSE_RATE: 0.3, SIGNAL_STRENGTH: 1.5,
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
