# VEPA law feasibility and migration matrix

**Audit date:** 2026-10-21  
**Source:** `gemquota/vepa/src/constants.js`, blob `be2162548e0aed180ee262b941ebb1eedb544ff8`  
**Scope:** all 136 indexed law slots in the stable-source inventory. This is a conservative migration triage, not proof that every legacy law is correct or executable.

## Decision rule

The new 3D sandbox should implement laws that have a defined, testable effect on world state or a meaningful rendering projection. A toggle must not exist unless it changes behavior. A law can be feasible without being a literal physical law: approximate/game rules must be labeled as such. Narrative, cognition, and social systems should be modeled as domain state and transitions, not disguised as forces.

## Tiers

- **Tier 1 · physical core:** force, field, boundary, contact, inertia, or structural constraints. Highest priority.
- **Tier 2 · dependent physical state:** chemistry, thermodynamics, energy, reactions, and phase changes. Feasible after the required state contracts exist.
- **Tier 3 · lifecycle/ecology/information:** executable as deterministic particle or group state transitions, not merely force terms.
- **Tier 4 · explicit approximation:** quantum-inspired behavior only where the approximation is defined and tested.
- **Tier 5 · symbolic/game law:** metaphysical or narrative names become explicit game mechanics, not claims about real physics.

## Inventory

| Index | Canonical source ID | Source category | Feasibility tier | New sandbox status |
|---:|---|---|---|---|
| 0 | `GRAV` | physics | Tier 1 · physical core | Prototype law exists (approximate) |
| 1 | `DRAG` | physics | Tier 1 · physical core | Prototype law exists (approximate) |
| 2 | `ENTR` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 3 | `BUOYANCY` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 4 | `COLL` | physics | Tier 1 · physical core | Prototype law exists (approximate) |
| 5 | `ACCR` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 6 | `PLANETARY` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 7 | `LIFE` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 8 | `GLOW` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 9 | `AFFINITY` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 10 | `REPRO` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 11 | `TRACK` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 12 | `SENESCENCE` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 13 | `ENERGY` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 14 | `RADIATION` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 15 | `GENOTYPE` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 16 | `PHENOTYPE` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 17 | `CATALYSIS_LAW` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 18 | `SOLVATION` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 19 | `ACIDITY` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 20 | `OXIDATION` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 21 | `POLYMER` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 22 | `ISOMERIZATION` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 23 | `CHIRALITY` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 24 | `CRYSTALLIZATION` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 25 | `HEAT` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 26 | `COLD` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 27 | `CONVECTION` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 28 | `PHASE_RADIATION` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 29 | `SUBLIMATION` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 30 | `TIME_DILATION` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 31 | `DIMENSIONALITY` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 32 | `CHAOS` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 33 | `ORDER` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 34 | `FATE` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 35 | `WILL` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 36 | `SOUL_LAW` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 37 | `MIND` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 38 | `VOID` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 39 | `BOND` | physics | Tier 1 · physical core | Prototype analogue exists (proximity only) |
| 40 | `REDUCTION` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 41 | `ALLOY` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 42 | `MELT` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 43 | `BOIL` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 44 | `CONDENSE` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 45 | `DEPOSIT` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 46 | `EXOTHERMIC` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 47 | `TELEPATHY` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 48 | `CLAIRVOYANCE` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 49 | `PRECOGNITION` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 50 | `ASTRAL` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 51 | `PREDATION` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 52 | `COMMS` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 53 | `CHARGE_LAW` | electromagnetism | Tier 1 · physical core | Prototype law exists (approximate) |
| 54 | `ELECTRIC_FIELD` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 55 | `CURRENT` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 56 | `RESISTANCE` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 57 | `CAPACITANCE` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 58 | `INDUCTANCE` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 59 | `MAGNETISM` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 60 | `RESONANCE` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 61 | `FLUX` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 62 | `IONIZATION` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 63 | `DISCHARGE` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 64 | `PLASMA` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 65 | `SUPERCONDUCTIVITY` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 66 | `MEMORY` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 67 | `PATTERN` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 68 | `STIGMERGY` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 69 | `SIGNAL_BOOST` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 70 | `LEARN` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 71 | `SYMBOL` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 72 | `METRIC` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 73 | `PREDICT` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 74 | `CODE` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 75 | `PROTOCOL` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 76 | `FEEDBACK` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 77 | `LANGUAGE` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 78 | `CULTURE` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 79 | `SINGULARITY` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 80 | `ENTANGLEMENT` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 81 | `HISTORY` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 82 | `TIDE` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 83 | `FRICTION` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 84 | `HORIZON` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 85 | `RADIATION_PRESSURE` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 86 | `MASS_INERTIA` | physics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 87 | `FIELD` | physics | Tier 1 · physical core | Prototype analogue exists (central field) |
| 88 | `SYMBIOSIS` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 89 | `PARASITE` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 90 | `HIBERNATION` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 91 | `IMMUNITY` | biology | Tier 3 · particle lifecycle/ecology | Not yet implemented in new sandbox |
| 92 | `ELECTROLYSIS` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 93 | `PHOTOLYSIS` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 94 | `PRECIPITATION` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 95 | `NEUTRALIZATION` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 96 | `STOICHIOMETRY` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 97 | `AUTOCATALYSIS` | chemistry | Tier 2 · reaction substrate | Not yet implemented in new sandbox |
| 98 | `ADIABATIC` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 99 | `COMPRESSION` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 100 | `EXPANSION` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 101 | `EQUILIBRIUM` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 102 | `LATENT_HEAT` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 103 | `RUNAWAY` | thermodynamics | Tier 2 · energy/thermal state | Not yet implemented in new sandbox |
| 104 | `CONSCIOUSNESS` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 105 | `PERCEPTION` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 106 | `SYNCHRONICITY` | metaphysics | Tier 5 · symbolic/game law | Not yet implemented in new sandbox |
| 107 | `ANTENNA` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 108 | `SHIELDING` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 109 | `POLARIZATION` | electromagnetism | Tier 1 · physical core | Not yet implemented in new sandbox |
| 110 | `NAVIGATION` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 111 | `ENCRYPTION` | information | Tier 3 · information/domain state | Not yet implemented in new sandbox |
| 112 | `SUPERPOSITION` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 113 | `TUNNELING` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 114 | `DECOHERENCE` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 115 | `WAVE_PARTICLE` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 116 | `UNCERTAINTY` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 117 | `TELEPORT` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 118 | `OBSERVER` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 119 | `PLANCK` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 120 | `COHERENCE` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 121 | `BOSONIC` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 122 | `FERMIONIC` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 123 | `SPIN` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 124 | `SPECTRAL` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 125 | `WAVEFUNCTION` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 126 | `HYPERPLANE` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 127 | `ANTIMATTER` | quantum | Tier 4 · explicit approximation | Not yet implemented in new sandbox |
| 128 | `CONTACT` | mechanics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 129 | `MOMENTUM` | mechanics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 130 | `INERTIA` | mechanics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 131 | `TORQUE` | mechanics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 132 | `CONSTRAINT` | mechanics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 133 | `FRAGMENTATION` | mechanics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 134 | `TOPOLOGY` | mechanics | Tier 1 · physical core | Not yet implemented in new sandbox |
| 135 | `ADHESION` | mechanics | Tier 1 · physical core | Prototype analogue exists (proximity only) |

## Implementation order

1. Complete and test the physical core: gravity, drag, inertia/momentum, contact/collision, charge/fields, friction, constraints, boundaries, and selected orbital/accretion behavior.
2. Add conserved or explicitly budgeted energy and thermal state before heat, radiation, phase transitions, compression/expansion, or runaway behavior.
3. Add persistent bond topology and particle identity before chemistry, stoichiometry, polymers, crystallization, and reaction networks.
4. Add species/DNA, energy, age, reproduction, predation, immunity, and symbiosis as lifecycle systems with deterministic fixtures.
5. Add information, memory, signals, pattern, protocol, and culture as bounded derived/domain state.
6. Consider quantum-inspired and symbolic laws only as separately labeled models with explicit assumptions and acceptance tests.

## Acceptance rule for a migrated law

A law is not marked implemented until it has a stable ID/version, inputs/outputs and units, deterministic execution order, parameter bounds, defined failure behavior, an executable implementation, focused tests, and a visible or measurable effect. Visual polish alone does not count. The current prototype implements only a small initial slice and does not claim full legacy parity.
