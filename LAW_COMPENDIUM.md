# VEPA Law Compendium

> **Snapshot:** VEPA 9.1.10 · **Registry:** 136 laws · **Categories:** 9 · **Particle stride:** 100 floats · **DNA parameters:** 64
>
> **Document status:** source-derived technical reference. Names, indexes, category membership, dependencies, parameter links, and implementation claims are based on the live source tree at the time of extraction. Where a law is implemented as a bounded simulation proxy rather than a physical model, that distinction is called out.

## Table of Contents

- [1. Reading This Compendium](#1-reading-this-compendium)
  - [1.1 Evidence and status notation](#11-evidence-and-status-notation)
  - [1.2 Runtime execution model](#12-runtime-execution-model)
- [2. Registry and Architecture](#2-registry-and-architecture)
  - [2.1 Registry summary](#21-registry-summary)
  - [2.2 Category index](#22-category-index)
  - [2.3 State and storage layout](#23-state-and-storage-layout)
  - [2.4 Dependency model](#24-dependency-model)
- [3. Category Reports](#3-category-reports)
  - [3.1 Physics](#31-physics)
  - [3.2 Mechanics](#32-mechanics)
  - [3.3 Biology](#33-biology)
  - [3.4 Chemistry](#34-chemistry)
  - [3.5 Thermodynamics](#35-thermodynamics)
  - [3.6 Metaphysics](#36-metaphysics)
  - [3.7 Electromagnetism](#37-electromagnetism)
  - [3.8 Information](#38-information)
  - [3.9 Quantum](#39-quantum)
- [4. Complete Law Matrix](#4-complete-law-matrix)
  - [4.1 Physics laws](#41-physics-laws)
  - [4.2 Mechanics laws](#42-mechanics-laws)
  - [4.3 Biology laws](#43-biology-laws)
  - [4.4 Chemistry laws](#44-chemistry-laws)
  - [4.5 Thermodynamics laws](#45-thermodynamics-laws)
  - [4.6 Metaphysics laws](#46-metaphysics-laws)
  - [4.7 Electromagnetism laws](#47-electromagnetism-laws)
  - [4.8 Information laws](#48-information-laws)
  - [4.9 Quantum laws](#49-quantum-laws)
- [5. Related Data](#5-related-data)
  - [5.1 Parameter namespaces](#51-parameter-namespaces)
  - [5.2 Important stride fields](#52-important-stride-fields)
  - [5.3 Law state and bitmasks](#53-law-state-and-bitmasks)
  - [5.4 Runtime safeguards](#54-runtime-safeguards)
- [6. Verification and Known Boundaries](#6-verification-and-known-boundaries)
- [7. Glossary](#7-glossary)
- [8. Source Index](#8-source-index)

## 1. Reading This Compendium

### 1.1 Evidence and status notation

- **Implemented:** the solver or a law-group module contains a runtime dispatch path for the law.
- **Gated:** execution is conditional on the corresponding law-state bit, and may additionally be subject to a hard dependency.
- **Proxy:** the implementation intentionally approximates a named phenomenon using bounded forces, state changes, or signal operations; it is not a claim of physical completeness.
- **Parameter links:** names in parentheses identify the live storage namespace: `DNA`, `Stride`, or `World`.
- **Source annotations:** the registry and metadata originate in `src/constants.js`; category-specific behavior is organized in `src/physics/lawgroups/*.js`; the orchestration loop is `src/physics/solver.js`; state representation is in `src/state/lawState.js`.

### 1.2 Runtime execution model

1. The UI selects law bits and serializes them into the law state.
2. The solver builds an active-law view and iterates particles and neighbor pairs.
3. Pairwise laws read positions, velocities, mass, radius, energy, DNA cache, bonds, signal, and other stride fields.
4. Per-particle laws modify accumulated acceleration or particle state.
5. Integration applies bounded acceleration, drag, velocity limits, toroidal/world constraints, and finite-value guards.
6. Biology, chemistry, thermal, information, and quantum passes update state fields and lifecycle outcomes.
7. The HUD reports particle count and tick telemetry; the law info module resolves four-tier help metadata.

## 2. Registry and Architecture

### 2.1 Registry summary

| Item | Live value | Source |
|---|---:|---|
| Law count | 136 | `LAW_COUNT` |
| Law indexes | 0–135 | `LAW_INDEXES` |
| Categories | 9 | `LAW_CATEGORIES` |
| Particle stride | 100 floats | `PARTICLE_STRIDE` |
| DNA count | 64 | `DNA_COUNT` |
| Mechanics range | 128–135 | `LAW_INDEXES` |
| Law state storage | low/high/extended bit arrays | `src/state/lawState.js` |
| Primary solver | pairwise + per-particle passes | `src/physics/solver.js` |

### 2.2 Category index

| Category | Color | Count | Index range / members |
|---|---|---:|---|
| Physics | RED | 16 | 0–6, 38–39, 79, 82–87 |
| Mechanics | SLATE | 8 | 128–135 |
| Biology | ORANGE | 16 | 7–16, 51–52, 88–91 |
| Chemistry | YELLOW | 16 | 17–24, 40–41, 92–97 |
| Thermodynamics | GREEN | 16 | 25–29, 42–46, 98–103 |
| Metaphysics | TEAL | 16 | 30–37, 47–50, 80, 104–106 |
| Electromagnetism | BLUE | 16 | 53–65, 107–109 |
| Information | VIOLET | 16 | 66–78, 81, 110–111 |
| Quantum | PURPLE | 16 | 112–127 |

### 2.3 State and storage layout

The first seven stride values are position and velocity (`POS_X/Y/Z`, `VEL_X/Y/Z`), followed by `MASS` and `SPECIES_ID`. DNA cache values occupy stride 8–49 and correspond to the first 42 DNA parameters. Core dynamic fields include `ENERGY` 50, `AGE` 51, `DEAD` 52, color 53–55, `RADIUS` 56, `SIGNAL` 57, bond count 58, bond partners 59–60 and 81–84, `MEMORY` 61, `HUNGER` 62, `ARMOR` 63, temperature 66, charge 67, quantum phase/state 68–76, energy reservoirs 77–78, radiation exposure 80, deterministic chaos state 85–87, symbol/superposition state 88–95, group fields 96–97, and `ACCR_LINK_MASK` 98. The ACCR mask classifies individual partner slots as persistent rigid seams; an unmarked partner slot remains a flexible BOND/POLYMER relationship.

### 2.4 Dependency model

Hard dependencies currently include: `SENESCENCE → LIFE`, `TELEPORT → ENTANGLEMENT`, `ENCRYPTION → COMMS`, `FEEDBACK → MEMORY`, `OBSERVER → MEMORY`, `NAVIGATION → MEMORY`, and `ISOMERIZATION → (BOND or POLYMER)`. Soft dependencies document synergies without disabling the dependent law: LANGUAGE and SIGNAL_BOOST use signal sources; ANTENNA and POLARIZATION use signal channels; MIND uses COMMS or TELEPATHY; WAVE_PARTICLE uses OBSERVER for measurement semantics.

## 3. Category Reports

### 3.1 Physics

**Role:** foundational attraction, damping, contact, gravity-adjacent, and field primitives. Physics contains the oldest core laws plus later environmental and singularity additions. Its pairwise forces are generally bounded and use mass/radius-aware falloffs. `FIELD` is a central-gradient primitive; `ELECTRIC_FIELD` belongs to Electromagnetism.

**Members:** GRAV, DRAG, ENTR, BUOYANCY, COLL, ACCR, PLANETARY, VOID, BOND, SINGULARITY, FRICTION, TIDE, HORIZON, RADIATION_PRESSURE, MASS_INERTIA, FIELD.

**Interactions:** GRAV/PLANETARY/ACCR shape aggregation; ACCR creates edge-to-edge structural seams without mass merging; COLL/BOND/FIELD constrain local structure; HORIZON/SINGULARITY provide extreme-mass behavior; TIDE and RADIATION_PRESSURE introduce gradients and outward energy transfer. Physics is the main substrate for all other categories.

### 3.2 Mechanics

**Role:** the slate structural and motion layer introduced at indexes 128–135. Mechanics is deliberately separate from legacy names `TURBULENCE`, `CENTRIPETAL`, `ROTATION`, and `ELASTICITY` as law indexes; elasticity remains a DNA material parameter used by collision response. The active set is CONTACT, MOMENTUM, INERTIA, TORQUE, CONSTRAINT, FRAGMENTATION, TOPOLOGY, and ADHESION.

**Members:** CONTACT, MOMENTUM, INERTIA, TORQUE, CONSTRAINT, FRAGMENTATION, TOPOLOGY, ADHESION.

**Interactions:** CONTACT and CONSTRAINT manage geometry; MOMENTUM and INERTIA govern response; TORQUE supplies tangential rotation; FRAGMENTATION opposes over-fast structural impacts; TOPOLOGY reads bond connectivity; ADHESION attracts without mass merging. Mechanics is displayed first in the UI with a small divider and has dedicated help records.

### 3.3 Biology

**Role:** energy-driven lifecycle, ecological interaction, signaling, genetics, and survival. Biology changes particle state and can create, merge, modify, or remove entities, so it is more lifecycle-sensitive than force-only categories.

**Members:** LIFE, GLOW, AFFINITY, REPRO, TRACK, SENESCENCE, ENERGY, RADIATION, GENOTYPE, PHENOTYPE, PREDATION, COMMS, SYMBIOSIS, PARASITE, HIBERNATION, IMMUNITY.

**Interactions:** LIFE/ENERGY maintain metabolism; REPRO/SENESCENCE govern population turnover; AFFINITY/PREDATION/SYMBIOSIS/PARASITE create ecological pressure; GENOTYPE/PHENOTYPE/RADIATION alter inheritance and expression; GLOW/COMMS/TRACK expose signal pathways.

### 3.4 Chemistry

**Role:** local reaction, medium, redox, molecular structure, and material transformation. Chemistry predominantly reads reaction thresholds, conductivity, polarity, temperature, bonds, and energy reservoirs.

**Members:** CATALYSIS_LAW, SOLVATION, ACIDITY, OXIDATION, POLYMER, ISOMERIZATION, CHIRALITY, CRYSTALLIZATION, REDUCTION, ALLOY, ELECTROLYSIS, PHOTOLYSIS, PRECIPITATION, NEUTRALIZATION, STOICHIOMETRY, AUTOCATALYSIS.

**Interactions:** ACIDITY/NEUTRALIZATION and OXIDATION/REDUCTION form reaction pairs; POLYMER/ISOMERIZATION/CRYSTALLIZATION/ALLOY alter structure; CATALYSIS and AUTOCATALYSIS alter rates; ELECTROLYSIS and PHOTOLYSIS bridge electromagnetic/thermal inputs.

### 3.5 Thermodynamics

**Role:** temperature, heat transfer, phase change, pressure, and thermal feedback. Thermal laws operate on `TEMPERATURE`, `ENERGY`, `STORED_ENERGY`, heat capacity, phase thresholds, and neighborhood gradients.

**Members:** HEAT, COLD, CONVECTION, PHASE_RADIATION, SUBLIMATION, MELT, BOIL, CONDENSE, DEPOSIT, EXOTHERMIC, ADIABATIC, COMPRESSION, EXPANSION, EQUILIBRIUM, LATENT_HEAT, RUNAWAY.

**Interactions:** HEAT/COLD/EQUILIBRIUM/CONVECTION move thermal energy; phase laws use critical thresholds and latent buffers; ADIABATIC/COMPRESSION/EXPANSION model density-pressure response; RUNAWAY and EXOTHERMIC add positive feedback, subject to bounds.

### 3.6 Metaphysics

**Role:** time/space abstractions, agency, mind, soul, psychic channels, and synchrony. These are simulation constructs implemented through phase, memory, signal, position, and velocity rather than claims about literal metaphysics.

**Members:** TIME_DILATION, DIMENSIONALITY, CHAOS, ORDER, FATE, WILL, SOUL_LAW, MIND, TELEPATHY, CLAIRVOYANCE, PRECOGNITION, ASTRAL, ENTANGLEMENT, CONSCIOUSNESS, PERCEPTION, SYNCHRONICITY.

**Interactions:** CHAOS/ORDER shape organization; TIME_DILATION/PRECOGNITION affect temporal proxies; MIND/TELEPATHY/CLAIRVOYANCE/PERCEPTION use signal and neighborhood state; SOUL/ASTRAL/SYNCHRONICITY use persistent identity and phase; ENTANGLEMENT is a correlation substrate used by QUANTUM teleportation.

### 3.7 Electromagnetism

**Role:** charge, fields, conduction, magnetic coupling, radiation, ionization, and signal polarization. This category uses `CHARGE`, `ELECTRIC_ENERGY`, `STORED_ENERGY`, `POLARITY`, conductivity, and magnetic moment.

**Members:** CHARGE_LAW, ELECTRIC_FIELD, CURRENT, RESISTANCE, CAPACITANCE, INDUCTANCE, MAGNETISM, RESONANCE, FLUX, IONIZATION, DISCHARGE, PLASMA, SUPERCONDUCTIVITY, ANTENNA, SHIELDING, POLARIZATION.

**Interactions:** CHARGE_LAW/ELECTRIC_FIELD/FLUX provide forces; CURRENT/RESISTANCE/CAPACITANCE/INDUCTANCE transport or store energy; MAGNETISM/RESONANCE/ANTENNA organize fields and signals; IONIZATION/DISCHARGE/PLASMA bridge impacts, temperature, and charge; SHIELDING/POLARIZATION filter effects.

### 3.8 Information

**Role:** memory, learning, signaling, symbols, prediction, code, protocol, language, culture, history, and navigation. Information laws commonly alter `MEMORY`, `SIGNAL`, trail fields, phase, or DNA rather than applying direct mechanical force.

**Members:** MEMORY, PATTERN, STIGMERGY, SIGNAL_BOOST, LEARN, SYMBOL, METRIC, PREDICT, CODE, PROTOCOL, FEEDBACK, LANGUAGE, CULTURE, HISTORY, NAVIGATION, ENCRYPTION.

**Interactions:** MEMORY/HISTORY provide persistence; PATTERN/STIGMERGY/NAVIGATION turn traces into gradients; LEARN/FEEDBACK alter motion and retention; SIGNAL_BOOST/PROTOCOL/LANGUAGE/ENCRYPTION regulate communication; SYMBOL/CODE/CULTURE transmit identity and traits.

### 3.9 Quantum

**Role:** discrete state, wave/particle behavior, observation, tunneling, coherence, spin, spectra, dimensionality, and antimatter proxies. Quantum state is stored in dedicated stride fields and is intentionally bounded/discrete where possible.

**Members:** SUPERPOSITION, TUNNELING, DECOHERENCE, WAVE_PARTICLE, UNCERTAINTY, TELEPORT, OBSERVER, PLANCK, COHERENCE, BOSONIC, FERMIONIC, SPIN, SPECTRAL, WAVEFUNCTION, HYPERPLANE, ANTIMATTER.

**Interactions:** SUPERPOSITION/WAVEFUNCTION/UNCERTAINTY model spread; OBSERVER/DECOHERENCE collapse it; ENTANGLEMENT enables TELEPORT; COHERENCE/BOSONIC/FERMIONIC balance clustering and exclusion; PLANCK quantizes changes; SPIN/SPECTRAL/HYPERPLANE/ANTIMATTER supply specialized state effects.

## 4. Complete Law Matrix

The following matrix is the compact complete registry. Each entry includes its index, category, runtime logic, principal data, and implementation note. “Bounded proxy” means the effect is intentionally an in-engine approximation.

### 4.1 Physics laws

| # | Law | Logic / effect | Principal data | Status |
|---:|---|---|---|---|
| 0 | GRAV | Newton-style mass attraction with signed FORCE modulation and inverse-square falloff. | DNA FORCE/HIDDEN_MASS; World GLOBAL_G; Stride MASS/RADIUS | Implemented, gated |
| 1 | DRAG | Damp velocity according to viscosity, damping, friction, and speed limits. | DNA VISCOSITY/MAX_VELOCITY; World DAMPING | Implemented, gated |
| 2 | ENTR | Adds bounded stochastic/thermal disorder and entropy-like motion. | DNA JITTER; World ENTROPY; Stride TEMPERATURE | Implemented proxy |
| 3 | BUOYANCY | Produces thermal/density-dependent lift and velocity response. | Stride TEMPERATURE/MASS/VEL; DNA HEAT_OUTPUT | Implemented proxy |
| 4 | COLL | Resolves overlap with stiffness and elasticity/restitution; exchanges impact response. | DNA STIFFNESS/ELASTICITY; Stride RADIUS/MASS | Implemented, gated |
| 5 | ACCR | Persistent structural attachment: close particles adjoin edge-to-edge after momentum/dwell thresholds and remain separate identities and masses; explicit seam topology is maintained after contact. | DNA FUSION/FUSION_TIME; World ACCRETION_RADIUS; Stride MASS/BOND_COUNT/ACCR_LINK_MASK | Implemented, persistent structural lifecycle |
| 6 | PLANETARY | Adds large-body/global gravitational influence using hidden mass and inertia. | DNA FORCE/HIDDEN_MASS/INERTIA; World GLOBAL_G | Implemented, gated |
| 38 | VOID | Applies bounded outward/rarefaction pressure toward world boundaries/empty regions. | World VOID_PRESSURE/WORLD_SIZE; Stride RADIUS | Implemented proxy |
| 39 | BOND | Creates flexible, breakable spring links; it does not classify or break explicit ACCR seams. | DNA STIFFNESS/BOND_ANGLE; World BOND_STRENGTH; Stride bond fields | Implemented, flexible lifecycle |
| 79 | SINGULARITY | Supermassive bodies pull strongly and absorb particles crossing a horizon. | World SINGULARITY_HORIZON; DNA FORCE/HIDDEN_MASS; Stride MASS/DEAD | Implemented proxy |
| 82 | TIDE | Applies gravity-gradient-like differential force across a particle pair. | DNA TIDAL/FORCE; World TIDAL_SCALE/GLOBAL_G | Implemented |
| 83 | FRICTION | Converts relative motion into bounded damping, with viscosity interaction. | DNA FRICTION/VISCOSITY; Stride velocity | Implemented |
| 84 | HORIZON | Massive bodies create a radius/falloff capture force toward their center. | Stride MASS/RADIUS; World GLOBAL_G; DNA HIDDEN_MASS | Implemented proxy |
| 85 | RADIATION_PRESSURE | Energy-bearing neighbors transfer bounded outward inverse-square momentum. | Stride ENERGY/ELECTRIC_ENERGY/STORED_ENERGY; World RADIATION_LEVEL | Implemented |
| 86 | MASS_INERTIA | Scales accumulated acceleration by `1/(1+k·mass)` before integration. | Stride MASS; DNA INERTIA/FORCE/MAX_VELOCITY | Implemented |
| 87 | FIELD | Applies a bounded central field gradient distinct from ELECTRIC_FIELD. | Stride POS_X/Y/Z; World WORLD_SIZE; DNA FORCE/NEIGHBORHOOD_RADIUS | Implemented |

### 4.2 Mechanics laws

| # | Law | Logic / effect | Principal data | Status |
|---:|---|---|---|---|
| 128 | CONTACT | Separates overlapping particles using radius, mass, and stiffness. | Stride RADIUS/MASS; DNA STIFFNESS | Implemented, gated |
| 129 | MOMENTUM | Relaxes relative velocity toward mass-weighted shared motion. | Stride MASS/VEL_X/Y/Z; World MOMENTUM_GAIN | Implemented, gated |
| 130 | INERTIA | Makes mass resist accumulated force/acceleration. | Stride MASS; DNA INERTIA/FORCE | Implemented, gated |
| 131 | TORQUE | Converts tangential relative motion around a separation vector into rotation. | DNA TORQUE; Stride POS/VEL | Implemented, gated |
| 132 | CONSTRAINT | Applies an explicit solver-level distance relationship only to an already linked pair; it does not create attraction or topology. | Stride RADIUS/BOND_COUNT; World CONSTRAINT_STRENGTH | Implemented, gated |
| 133 | FRAGMENTATION | High relative speed over armor threshold creates separation impulse. | Stride VEL/ARMOR/MASS | Implemented, gated |
| 134 | TOPOLOGY | Uses bond-count imbalance as a small graph-geometry correction. | Stride BOND_COUNT/BOND_PARTNER_1-6; World TOPOLOGY_GAIN | Implemented, gated |
| 135 | ADHESION | Attracts near-contact particles without merging their mass. | Stride RADIUS/BOND_COUNT; World ADHESION_RANGE | Implemented, gated |

### 4.3 Biology laws

| # | Law | Logic / effect | Principal data | Status |
|---:|---|---|---|---|
| 7 | LIFE | Converts energy efficiency and light/environment into metabolic survival. | DNA ENERGY_EFFICIENCY; World DECAY_RATE/LIGHT_LEVEL; Stride ENERGY | Implemented |
| 8 | GLOW | Converts energy/alpha into visible color and signal emission. | DNA ALPHA; World LIGHT_LEVEL; Stride ENERGY/COLOR | Implemented |
| 9 | AFFINITY | Makes species compatibility influence interactions and grouping. | DNA SPECIES_AFFINITY; World SPECIES_INTERACTION; Stride SPECIES_ID | Implemented |
| 10 | REPRO | Creates offspring when energy, rate, and reproduction conditions permit. | DNA BIRTH_RATE/SEX_CHANCE; World thresholds; Stride ENERGY | Implemented, lifecycle |
| 11 | TRACK | Follows signals and biases pursuit according to predation/tracking sensitivity. | DNA SIGNAL_RESP/PREDATION_BIAS; Stride SIGNAL | Implemented |
| 12 | SENESCENCE | Ages living particles and increases death pressure over lifecycle time. | DNA DEATH_RATE/TELOMERE_LENGTH; World SENESCENCE_RATE; Stride AGE | Implemented, requires LIFE |
| 13 | ENERGY | Transfers/metabolizes energy and uses reserve pools for activity. | DNA ENERGY_EFFICIENCY; World ENERGY_TRANSFER; Stride ENERGY/STORED_ENERGY | Implemented |
| 14 | RADIATION | Accumulates exposure and applies damage/mutation pressure. | Stride RADIATION_EXPOSURE; DNA MUTAGEN_SENSITIVITY/REPAIR_EFFICIENCY | Implemented |
| 15 | GENOTYPE | Applies inheritance, allele, ploidy, crossover, and mutation behavior. | DNA GENOTYPE expansion 43–63 | Implemented |
| 16 | PHENOTYPE | Expresses regulatory/genetic values into visible and physical traits. | DNA DOMINANCE/GENE_SILENCING/REGULATORY_DEPTH/BASE_RADIUS | Implemented |
| 51 | PREDATION | Hunger and bias drive energy transfer from prey-like neighbors. | DNA PREDATION_BIAS; World PREDATION_EFFICIENCY; Stride HUNGER | Implemented |
| 52 | COMMS | Exchanges decaying signals within propagation and tuning constraints. | DNA SIGNAL_STRENGTH/SIGNAL_DECAY/PROPAGATION_SPEED; Stride SIGNAL | Implemented |
| 88 | SYMBIOSIS | Compatible neighbors receive mutual energy/interaction benefit. | DNA SPECIES_AFFINITY; World SYMBIOSIS_BOOST/ENERGY_TRANSFER | Implemented |
| 89 | PARASITE | Drains energy from neighbors with predation-style bias. | DNA PREDATION_BIAS; World PARASITE_DRAIN; Stride HUNGER | Implemented |
| 90 | HIBERNATION | Reduces activity/metabolic cost under low energy or temperature conditions. | World HIBERNATION_SAVINGS/HEAT_CAPACITY; Stride ENERGY/TEMPERATURE | Implemented |
| 91 | IMMUNITY | Uses repair/shield state to reduce damage and radiation effects. | DNA REPAIR_EFFICIENCY; World IMMUNITY_SHIELD; Stride exposure | Implemented |

### 4.4 Chemistry laws

| # | Law | Logic / effect | Principal data | Status |
|---:|---|---|---|---|
| 17 | CATALYSIS_LAW | Lowers reaction barriers and increases reaction speed. | DNA CATALYSIS/REACTION_THRESHOLD; World CATALYSIS_SPEED; Stride TEMPERATURE | Implemented |
| 18 | SOLVATION | Polarity and medium properties govern dissolution/charge interaction. | DNA POLARITY/VISCOSITY; World SOLVATION_RATE; Stride CHARGE | Implemented |
| 19 | ACIDITY | pH-like state changes reaction and conductivity behavior. | DNA REACTION_THRESHOLD/CONDUCTIVITY; World ACIDITY_PH; Stride PHASE_1 | Implemented proxy |
| 20 | OXIDATION | Transfers charge/energy and creates heat above reaction conditions. | DNA REACTION_THRESHOLD/HEAT_OUTPUT; World OXIDATION_RATE; Stride CHARGE | Implemented |
| 21 | POLYMER | Forms/maintains multi-bond chains within a polymer limit. | DNA STIFFNESS/BOND_ANGLE; World POLYMER_LIMIT; Stride bonds | Implemented |
| 22 | ISOMERIZATION | Rearranges bonded state in response to jitter, temperature, and phase. | DNA JITTER/REACTION_THRESHOLD; Stride PHASE_1 | Implemented, requires BOND or POLYMER |
| 23 | CHIRALITY | Uses symmetry/polarity/angle to bias handed structural outcomes. | DNA SYMMETRY/POLARITY/BOND_ANGLE; Stride PHASE_2 | Implemented proxy |
| 24 | CRYSTALLIZATION | Encourages stiff lattice-like clustering below thermal conditions. | DNA STIFFNESS/BASE_RADIUS; World CRYSTAL_LATTICE; Stride TEMPERATURE | Implemented |
| 40 | REDUCTION | Opposes oxidation through conductivity and charge transfer. | DNA CONDUCTIVITY/REACTION_THRESHOLD; World OXIDATION_RATE | Implemented |
| 41 | ALLOY | Blends compatible species/material properties into composite behavior. | DNA SPECIES_AFFINITY/STIFFNESS/CONDUCTIVITY; World interaction | Implemented |
| 92 | ELECTROLYSIS | Conductivity and external power split/transport charge. | DNA CONDUCTIVITY; World ELECTROLYSIS_POWER; Stride energy/charge | Implemented |
| 93 | PHOTOLYSIS | Light/energy breaks or transforms nearby chemical state. | World LIGHT_LEVEL; DNA threshold/alpha; Stride ENERGY | Implemented |
| 94 | PRECIPITATION | Reaction conditions create radius/mass-bearing deposited material. | DNA threshold; World SOLVATION_RATE; Stride MASS/RADIUS | Implemented |
| 95 | NEUTRALIZATION | Opposing acidity/charge states reduce each other and release heat. | World ACIDITY_PH; DNA threshold/heat; Stride CHARGE | Implemented |
| 96 | STOICHIOMETRY | Bounds reaction transfers by mass, bonds, and threshold ratios. | DNA threshold/catalysis; Stride MASS/BOND_COUNT | Implemented |
| 97 | AUTOCATALYSIS | Existing reaction activity increases subsequent reaction/birth rate. | DNA CATALYSIS/BIRTH_RATE; World AUTOCATALYSIS_GAIN; Stride ENERGY | Implemented |

### 4.5 Thermodynamics laws

| # | Law | Logic / effect | Principal data | Status |
|---:|---|---|---|---|
| 25 | HEAT | Raises temperature from heat output and energy dissipation. | DNA HEAT_OUTPUT; World HEAT_CAPACITY/ENTROPY; Stride TEMPERATURE | Implemented |
| 26 | COLD | Removes heat and drives cooling toward critical conditions. | World HEAT_CAPACITY/CRITICAL_TEMP/DECAY_RATE; Stride TEMPERATURE | Implemented |
| 27 | CONVECTION | Moves heat through neighborhood flow and buoyant transport. | DNA HEAT_OUTPUT/VISCOSITY; World CONVECTION_RATE; Stride velocity | Implemented |
| 28 | PHASE_RADIATION | Converts thermal/phase energy into radiative output. | DNA HEAT_OUTPUT/ALPHA; World factor; Stride TEMPERATURE | Implemented |
| 29 | SUBLIMATION | Transitions material directly across solid/gas-like phase proxy. | World BOIL_TEMP_POINT/CRITICAL_TEMP; Stride phase | Implemented proxy |
| 42 | MELT | Reduces structural stiffness or changes phase above melt point. | DNA HEAT_OUTPUT/STIFFNESS; World MELT_TEMP_POINT | Implemented |
| 43 | BOIL | Converts heated material into a high-motion phase. | DNA HEAT_OUTPUT/VISCOSITY; World BOIL_TEMP_POINT | Implemented |
| 44 | CONDENSE | Returns hot/diffuse material toward compact state below threshold. | World BOIL_TEMP_POINT/CRITICAL_TEMP; DNA BASE_RADIUS | Implemented |
| 45 | DEPOSIT | Forms stable material where cooling/phase conditions permit. | World MELT_TEMP_POINT/CRITICAL_TEMP; DNA STIFFNESS; Stride mass | Implemented |
| 46 | EXOTHERMIC | Reaction releases stored energy as heat. | DNA HEAT_OUTPUT/REACTION_THRESHOLD; Stride STORED_ENERGY/TEMPERATURE | Implemented |
| 98 | ADIABATIC | Couples density/occupancy to temperature with gamma-style response. | World HEAT_CAPACITY/ADIABATIC_GAMMA; DNA VISCOSITY; World RHO_REF | Implemented |
| 99 | COMPRESSION | Applies density/overlap pressure and heating. | DNA STIFFNESS; World ADIABATIC_GAMMA; Stride MASS/RADIUS | Implemented |
| 100 | EXPANSION | Applies outward thermal/density response and spatial spreading. | World ADIABATIC_GAMMA/WORLD_SIZE; DNA JITTER/HEAT_OUTPUT | Implemented |
| 101 | EQUILIBRIUM | Diffuses temperature toward neighbor mean. | World HEAT_CAPACITY/ENTROPY/DAMPING; Stride TEMPERATURE | Implemented |
| 102 | LATENT_HEAT | Buffers energy during phase changes instead of instant temperature jumps. | World HEAT_CAPACITY/LATENT_HEAT_BUFFER; Stride STORED_ENERGY | Implemented |
| 103 | RUNAWAY | Amplifies heat above a threshold, creating bounded thermal cascades. | DNA HEAT_OUTPUT; World RUNAWAY_MULT/MUTATION_RATE; Stride ENERGY | Implemented |

### 4.6 Metaphysics laws

| # | Law | Logic / effect | Principal data | Status |
|---:|---|---|---|---|
| 30 | TIME_DILATION | Mass/field conditions alter the effective rate of temporal updates. | World TIME_WARP_FACTOR; DNA FORCE/HIDDEN_MASS; Stride MASS | Implemented proxy |
| 31 | DIMENSIONALITY | Adds hidden-axis drift/shear to spatial motion. | World DIMENSIONAL_FOLD/WORLD_SIZE; DNA SYMMETRY; Stride position | Implemented proxy |
| 32 | CHAOS | Evolves deterministic chaotic state and injects sensitive perturbations. | World CHAOS_LYAPUNOV/ENTROPY; DNA JITTER/EPIGENETIC_DRIFT; Stride chaos state | Implemented |
| 33 | ORDER | Aligns symmetry, stiffness, signal, and resonance into coherent structure. | DNA SYMMETRY/STIFFNESS; World RESONANCE_Q; Stride SIGNAL | Implemented proxy |
| 34 | FATE | Biases trajectory toward deterministic position/velocity outcomes. | DNA FORCE/INERTIA; Stride position/velocity | Implemented proxy |
| 35 | WILL | Uses energy and force to preserve/redirect an agent's existing motion. | DNA FORCE/ENERGY_EFFICIENCY; Stride ENERGY/velocity | Implemented proxy |
| 36 | SOUL_LAW | Preserves identity-like continuity through soul, affinity, energy, and memory. | Stride SOUL/MEMORY/ENERGY; DNA affinity | Implemented proxy |
| 37 | MIND | Builds a signal/memory-mediated cognitive interaction layer. | World CONSCIOUSNESS_PHI; DNA neighborhood/memory decay; Stride MEMORY | Implemented proxy |
| 47 | TELEPATHY | Exchanges memory/signal beyond physical contact within a range. | World TELEPATHY_RANGE; DNA tuning/signal; Stride MEMORY | Implemented proxy |
| 48 | CLAIRVOYANCE | Extends sensing and signal interpretation beyond local neighbors. | World range; DNA neighborhood/propagation; Stride SIGNAL | Implemented proxy |
| 49 | PRECOGNITION | Uses temporal/memory state to bias response toward predicted outcomes. | World TIME_WARP_FACTOR; DNA memory decay/propagation; Stride MEMORY | Implemented proxy |
| 50 | ASTRAL | Applies phase-like separation/visibility through an astral state. | World ASTRAL_PHASE; DNA ALPHA; Stride phase/energy | Implemented proxy |
| 80 | ENTANGLEMENT | Creates correlated partner IDs/phases without force or signaling; phase decays. | Stride ENTANGLE_ID/ENTANGLE_PHASE; DNA tuning/affinity | Implemented, requires link semantics |
| 104 | CONSCIOUSNESS | Maintains a self-speed model; prediction error updates memory/signal and costs energy. | World CONSCIOUSNESS_PHI; DNA regulatory/memory; Stride SELF_MODEL_SPEED | Implemented proxy |
| 105 | PERCEPTION | Extends sensing radius and responds to otherwise distant neighbors. | DNA SIGNAL_RESP/NEIGHBORHOOD_RADIUS; World phi; Stride SIGNAL | Implemented proxy |
| 106 | SYNCHRONICITY | Aligns phases and velocities of signal-compatible particles. | World SYNCHRONICITY_RATE/RESONANCE_Q; DNA tuning; Stride PHASE_1 | Implemented proxy |

### 4.7 Electromagnetism laws

| # | Law | Logic / effect | Principal data | Status |
|---:|---|---|---|---|
| 53 | CHARGE_LAW | Signed Coulomb-like attraction/repulsion from polarity plus stored charge. | DNA POLARITY/CONDUCTIVITY; Stride CHARGE | Implemented |
| 54 | ELECTRIC_FIELD | Uniform polarity-directed drift scaled by charge magnitude. | DNA POLARITY/MAGNETIC_MOMENT; World field scale; Stride CHARGE | Implemented |
| 55 | CURRENT | Conductive neighbors exchange charge down a gradient. | DNA CONDUCTIVITY; Stride CHARGE/velocity | Implemented |
| 56 | RESISTANCE | Damps motion and converts kinetic activity to temperature; conductivity lowers damping. | DNA CONDUCTIVITY/HEAT_OUTPUT; Stride TEMPERATURE | Implemented |
| 57 | CAPACITANCE | Stores surplus energy as charge and feeds later force behavior. | Stride STORED_ENERGY/ELECTRIC_ENERGY/CHARGE; DNA polarity | Implemented |
| 58 | INDUCTANCE | Magnetically coupled conductive particles align velocity. | DNA MAGNETIC_MOMENT/CONDUCTIVITY; Stride velocity/electric energy | Implemented |
| 59 | MAGNETISM | Signed magnetic moments attract when aligned and repel when opposed. | DNA MAGNETIC_MOMENT/FORCE; Stride CHARGE | Implemented |
| 60 | RESONANCE | Active signalers with matching pulse/phase attract and amplify weaker signals. | DNA PULSE_RATE; World RESONANCE_Q; Stride SIGNAL/phase | Implemented |
| 61 | FLUX | Converts stored-charge gradient into charge-sign-dependent directed drift. | DNA magnetic/polarity; Stride CHARGE/STORED_ENERGY | Implemented |
| 62 | IONIZATION | High-energy close impacts create conserved opposite-charge ion pairs. | DNA reaction threshold; World ionization energy; Stride CHARGE | Implemented |
| 63 | DISCHARGE | High stored charge releases a directed impulse, heat, then resets charge. | DNA conductivity; World arc threshold; Stride CHARGE/TEMPERATURE | Implemented |
| 64 | PLASMA | Hot particles ionize; cooled charged particles recombine with hysteresis. | World plasma threshold; DNA conductivity/heat; Stride charge/temp | Implemented |
| 65 | SUPERCONDUCTIVITY | Cold conductive pairs align motion and equalize charge with low loss. | World critical temperature; DNA conductivity/magnetic moment | Implemented |
| 107 | ANTENNA | Emits stronger directional signals along velocity. | DNA pulse/signal/propagation; Stride SIGNAL/velocity | Implemented proxy |
| 108 | SHIELDING | Charge-bearing particles attenuate incoming EM forces at an energy cost. | World attenuation; DNA conductivity/stiffness; Stride charge/armor | Implemented proxy |
| 109 | POLARIZATION | Filters signal by tuning-channel alignment and turns mismatch into noise/energy. | DNA polarity/alpha/tuning; Stride CHARGE/SIGNAL | Implemented proxy |

### 4.8 Information laws

| # | Law | Logic / effect | Principal data | Status |
|---:|---|---|---|---|
| 66 | MEMORY | Refreshes contact traces and retains motion/state with decay. | DNA MEMORY_DECAY; Stride MEMORY/AGE/ENERGY | Implemented |
| 67 | PATTERN | Dense/structured neighborhoods receive cohesion and reinforce existing form. | DNA neighborhood/symmetry/affinity; Stride MEMORY | Implemented proxy |
| 68 | STIGMERGY | Moving particles leave predicted trails; followers follow fresh trail gradients. | DNA SIGNAL_DECAY; World trail decay; Stride TRAIL/SIGNAL | Implemented |
| 69 | SIGNAL_BOOST | Relays and amplifies active signal between contacts. | DNA SIGNAL_STRENGTH/propagation; World gain; Stride SIGNAL | Implemented |
| 70 | LEARN | Aligns velocity toward neighborhood motion and supports adaptive behavior. | DNA ADAPTATION_RATE/MEMORY_DECAY; World learning rate | Implemented |
| 71 | SYMBOL | Memory-authority particles imprint discrete symbol tokens; matching tokens attract. | DNA codon/regulatory; Stride SYMBOL_TOKEN/MEMORY/SIGNAL | Implemented |
| 72 | METRIC | Moves particles up an energy/fitness gradient. | Stride ENERGY; DNA neighborhood/symmetry | Implemented proxy |
| 73 | PREDICT | Aims at extrapolated neighbor positions for interception. | Stride position/velocity; DNA propagation; World prediction | Implemented |
| 74 | CODE | Exchanges sampled DNA loci during close contact. | DNA regulatory/codon; Stride DNA cache | Implemented |
| 75 | PROTOCOL | Synchronizes nearby signal values/phases. | DNA signal decay; World protocol; Stride SIGNAL | Implemented |
| 76 | FEEDBACK | Memory amplifies motion while motion refreshes memory. | DNA memory decay; Stride MEMORY/velocity | Implemented |
| 77 | LANGUAGE | Actively signaling pairs exchange/converge memory traces. | DNA signal strength; Stride SIGNAL/MEMORY | Implemented |
| 78 | CULTURE | Same-species contacts blend traits and preserve in-group norms. | DNA affinity/regulation; Stride SPECIES_ID/DNA cache | Implemented |
| 81 | HISTORY | Decaying coarse spatial memory field creates a local historical gradient. | Stride TRAIL/position; DNA memory; World history decay | Implemented |
| 110 | NAVIGATION | Steers toward memory-rich or historically significant regions. | DNA memory/neighborhood; Stride MEMORY; World navigation | Implemented, requires MEMORY |
| 111 | ENCRYPTION | Derives keys from tuning channels; only matching keys exchange intelligible signal. | DNA TUNING_CH1-4; Stride PHASE_2/SIGNAL | Implemented, requires COMMS |

### 4.9 Quantum laws

| # | Law | Logic / effect | Principal data | Status |
---:|---|---|---|---|
| 112 | SUPERPOSITION | Stores four amplitudes/phases and probabilistically collapses to a velocity basis. | Stride SUPER_AMP_1-4/SUPER_PHASE; World collapse factor | Implemented proxy |
| 113 | TUNNELING | Gives a small energy/speed-dependent chance to bypass local barriers. | DNA force/jitter; Stride energy/velocity | Implemented proxy |
| 114 | DECOHERENCE | Damps variance/spread and emits excess state as signal. | Stride phase/velocity/signal; World decoherence factor | Implemented proxy |
| 115 | WAVE_PARTICLE | Unmeasured particles spread as waves; measured particles localize until flag decays. | Stride WAVE_MEASURED; World Planck scale; Stride velocity | Implemented, soft OBSERVER synergy |
| 116 | UNCERTAINTY | Trades position jitter against velocity uncertainty based on motion. | DNA jitter; World stability; Stride position/velocity | Implemented proxy |
| 117 | TELEPORT | Transfers velocity/energy through an entangled link, consumes the link, and does not move position. | Stride ENTANGLE_ID/phase/velocity/energy; World probability | Implemented, requires ENTANGLEMENT |
| 118 | OBSERVER | High-memory particles collapse nearby spread and imprint observation. | Stride MEMORY/velocity; DNA neighborhood; World observation | Implemented, requires MEMORY |
| 119 | PLANCK | Quantizes energy and velocity changes to discrete steps. | World quantum step; Stride energy/velocity | Implemented proxy |
| 120 | COHERENCE | Phase/velocity-locks neighboring particles. | World RESONANCE_Q; Stride phase/velocity; DNA tuning | Implemented |
| 121 | BOSONIC | Creates short-range clustering/glue-like attraction. | DNA affinity/stiffness; Stride radius/position | Implemented proxy |
| 122 | FERMIONIC | Applies exclusion-like repulsion to prevent state/space stacking. | DNA stiffness/radius; Stride position | Implemented proxy |
| 123 | SPIN | Adds intrinsic phase-driven perpendicular motion/precession. | DNA TORQUE/MAGNETIC_MOMENT; Stride PHASE_1/velocity | Implemented proxy |
| 124 | SPECTRAL | Emits species-specific signal tones based on identity and energy. | Stride SPECIES_ID/ENERGY/SIGNAL; DNA heat | Implemented proxy |
| 125 | WAVEFUNCTION | Smooths/rounds position into a probability-cloud-like wave grid. | Stride position/velocity; DNA jitter; World wave scale | Implemented proxy |
| 126 | HYPERPLANE | Adds hidden-axis drift and global shear. | World DIMENSIONAL_FOLD/WORLD_SIZE; DNA dimensionality; Stride position | Implemented proxy |
| 127 | ANTIMATTER | Opposite charge parity contacts annihilate both and release energy/signal. | Stride CHARGE/MASS/DEAD/ENERGY; World yield | Implemented, lifecycle |

## 5. Related Data

### 5.1 Parameter namespaces

**DNA parameters** are species/genome values, with 64 indexes covering force, viscosity, torque, jitter, polarity, alpha, symmetry, hidden mass, stiffness, fusion, lifecycle rates, signal controls, neighborhood radius, tuning channels, inertia, friction, velocity limits, radius, elasticity, bond angle, conductivity, magnetic moment, energy efficiency, reproductive/ecological traits, reaction/thermal traits, memory, affinity, dominance, crossover, epigenetic and regulatory expansion.

**Stride parameters** are per-particle runtime fields. They hold physical state, lifecycle state, bonds, memory, signal, energy reservoirs, thermal/electromagnetic state, quantum state, trails, and group membership.

**World parameters** are global controls. Names referenced by the law map include GLOBAL_G, DAMPING, FRICTION_COEFF, ENTROPY, HEAT_CAPACITY, LIGHT_LEVEL, DECAY_RATE, reaction/phase thresholds, signal ranges, magnetic/quantum scales, and law-specific gain/limit factors. The authoritative list and defaults are in `src/state/worldParams.js`.

### 5.2 Important stride fields

| Range | Fields | Role |
|---|---|---|
| 0–7 | position, velocity, mass, species | geometry and identity |
| 8–49 | DNA cache | fast per-particle trait reads |
| 50–67 | energy, lifecycle, visual, bonds, memory, armor, temperature, charge | core dynamics |
| 68–76 | phases, soul, trails, entanglement | quantum/metaphysical/information state |
| 77–84 | energy reservoirs, reproductive/radiation state, extra bonds | EM, lifecycle, polymer support |
| 85–95 | chaos, symbol, superposition, measurement, self-model | expanded law state |
| 96–97 | group ID/role | civilization/group registry state |

### 5.3 Law state and bitmasks

`LAW_COUNT` is 136, so the state representation must cover indexes beyond the original 128-bit documentation. The UI and solver use the same index registry; inactive bits prevent dispatch. Multi-state UI controls are separate from the ordinary on/off law bit and cycle their configured state values.

### 5.4 Runtime safeguards

The solver uses finite-value guards, bounded force/acceleration clamps, nonzero-distance checks, mass/radius floors, temperature/energy limits, and velocity caps. These safeguards are part of the implementation contract: they keep proxy laws composable and prevent a single extreme interaction from producing NaN/Infinity propagation.

## 6. Verification and Known Boundaries

- Registry invariant: indexes are contiguous 0–135 and `LAW_COUNT` is 136.
- Category invariant: the nine category arrays cover the registry exactly once.
- Help coverage: the canonical help table provides `hint`, `explanation`, and `system` records for the full registry; 62 laws currently also provide the optional `advanced` fourth tier. The eight Mechanics laws and four later Physics/EM additions are included in the canonical merge.
- Current unit verification recorded during extraction: **88 test files, 870 tests, all passing**.
- Syntax verification recorded during extraction: all JavaScript files under `src` and `tests` passed `node --check`.
- The compendium describes source behavior, not an independent scientific validation. Several names are metaphorical or toy-model proxies; their implementation notes intentionally state the actual state transitions rather than implying real-world equivalence.
- Legacy names `TURBULENCE`, `CENTRIPETAL`, and `ROTATION` remain in some explanatory/parameter/icon compatibility text but are not current `LAW_INDEXES` entries. `ELASTICITY` remains a DNA material parameter and is used by collision logic.

## 7. Glossary

| Term | Meaning |
|---|---|
| Acceleration accumulator | Temporary per-particle force result assembled before integration. |
| Active law | A law whose state bit is enabled and whose dependencies permit execution. |
| Bounded proxy | An intentionally simplified effect constrained to finite, stable ranges. |
| DNA | Species/genome parameter vector; some entries are cached into each particle stride. |
| Extended bitmask | Law-state storage needed for indexes 128–135 in addition to legacy low/high words. |
| Falloff | Distance-based reduction of a force or signal. |
| Gated | Conditional on a law-state bit or dependency. |
| Hard dependency | A required law without which a dependent law is disabled or inert. |
| Law group | Source module containing implementations for a broad category, such as `physicsLaws.js`. |
| Law index | Stable integer identifier used by state, solver, UI, presets, and tests. |
| Neighbor pair | Two particles selected for pairwise interaction. |
| Proxy | A simulation approximation of a named physical, biological, or conceptual phenomenon. |
| Stride | Fixed 100-float per-particle record. |
| Synergy | A soft interaction or gain documented between laws without hard gating. |
| TPS | Physics ticks per second, derived from tick event timing. |
| FPS | Render frames per second, derived from animation-frame timing. |
| World parameter | Global simulation control shared by particles. |
| Zero-distance guard | Defensive path preventing division by zero when particles overlap exactly. |

## 8. Source Index

- `src/constants.js` — `LAW_INDEXES`, `LAW_COUNT`, categories, category colors, dependencies, law parameters, DNA indexes/ranges, help database, stride indexes.
- `src/physics/solver.js` — active-law orchestration, pairwise dispatch, per-particle dispatch, integration and safeguards.
- `src/physics/lawgroups/physicsLaws.js` — foundational physics, horizon, radiation-pressure, inertia, and field primitives.
- `src/physics/lawgroups/mechanicsLaws.js` — CONTACT through ADHESION implementation set.
- `src/physics/lawgroups/mechanicsHelp.js` — Mechanics parameter/help records.
- `src/physics/lawgroups/biologyLaws.js` — lifecycle, ecology, genetics, and communication primitives.
- `src/physics/lawgroups/chemistryLaws.js` — reaction and material primitives.
- `src/physics/lawgroups/thermoLaws.js` — thermal and phase primitives.
- `src/physics/lawgroups/metaLaws.js` — metaphysical, cognition, and synchrony primitives.
- `src/physics/lawgroups/emLaws.js` — charge, field, magnetic, and signal primitives.
- `src/physics/lawgroups/infoLaws.js` — memory, signal, culture, prediction, and history primitives.
- `src/physics/lawgroups/quantumLaws.js` — quantum state and measurement proxies.
- `src/state/lawState.js` — law bitmask state operations.
- `src/state/worldParams.js` — global parameter definitions and defaults.
- `src/ui/tooltip.js` — law info module, four-tier descriptions, selection/toggle display.
- `src/ui/paramHelp.js` — long-press parameter documentation popup.
- `src/ui/hud.js` — tick/TPS/FPS and population telemetry.
