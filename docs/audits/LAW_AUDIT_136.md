# VEPA 136-Law Semantic, Scientific, and Implementation Audit

**Audit date:** 2026-10-21  
**Stable source:** `gemquota/vepa@master`, `src/constants.js` blob `be2162548e0aed180ee262b941ebb1eedb544ff8`  
**Target:** `gemquota/vepa-next`  
**Scope:** law-by-law semantic coherence, scientific status, implementation plausibility, overlap/dependency concerns, and migration priority.

## Important distinction

This is a **semantic and model-design audit**, not a claim that every historical stable equation has been independently validated. The stable repository contains executable implementations and law-specific audit documents, but several laws are explicitly abstractions or fictional mechanisms. A passing unit test demonstrates code behavior, not physical validity.

The stable source currently declares **136 slots, indices 0–135**. Older documentation still describes a 128-law system. The 136-slot source inventory is authoritative for this audit.

### Rating key

- **Science:** `EST` established science; `APP` defensible approximation/abstraction; `ABS` computational abstraction; `SPEC` speculative/poorly defined as science; `FICTION` intentionally fictional/metaphysical.
- **Plausibility:** `HIGH` straightforward to implement coherently; `MED` requires a substantial state/model layer; `LOW` requires a specialized solver or is only plausible as an abstraction.
- **Priority:** `P0` foundational; `P1` high-value migration after substrate; `P2` useful secondary system; `P3` experimental/fictional.
- **Overlap:** important semantic collision or dependency with another law, not necessarily a reason to delete it.

## Executive findings

1. **136 is reasonable as an experimental mechanism catalogue, but not as 136 equivalent physical laws.** The catalogue mixes forces, state properties, thermodynamic processes, chemical mechanisms, information processes, higher-order biological behavior, mathematical concepts, and fictional rules.
2. **The strongest physical core is roughly the first classical-mechanics/thermodynamics/electromagnetism subset.** Those can be made scientifically defensible within explicit domains.
3. **The biology and information layers are highly implementable as artificial-life mechanisms**, but their realism depends on causal state, resource accounting, inheritance, information transfer and learning rules rather than the names of the toggles.
4. **The quantum and metaphysics groups must not be represented as literal equivalents of real quantum mechanics or established metaphysics.** Several can become useful quantum-inspired or fictional world-model rules.
5. **The largest architectural problem is semantic overlap.** `COLL`/`CONTACT`, `MASS_INERTIA`/`INERTIA`, `DRAG`/`FRICTION`, `FIELD`/the various field laws, and `RESONANCE`/`COHERENCE`/`SYNCHRONICITY` need explicit ownership.
6. **Do not port all 136 as independent solver callbacks.** Several are better represented as shared state models, constraints, derived phenomena, or higher-level engines.

## Law-by-law matrix

| # | Law | Semantic role | Science | Plausibility | Priority | Main dependency / overlap | Disposition |
|---:|---|---|---|---|---|---|---|
| 0 | GRAV | pairwise gravitational force | EST | HIGH | P0 | mass, distance, integration | migrate as canonical force |
| 1 | DRAG | velocity-dependent dissipation | EST | HIGH | P0 | medium/friction model | canonical dissipation model |
| 2 | ENTR | entrainment/alignment | APP | HIGH | P1 | velocity/phase/signal | retain as emergent interaction |
| 3 | BUOYANCY | pressure-gradient force | EST | MED | P1 | medium density, gravity | retain after field/medium model |
| 4 | COLL | collision response | EST | HIGH | P0 | radius, mass, contact | merge concept with contact semantics |
| 5 | ACCR | mass accretion | EST/APP | HIGH | P1 | collision, material model | retain as mass-transfer process |
| 6 | PLANETARY | orbital/large-body behavior | EST/APP | MED | P2 | gravity, mass, integrator | specialized orbital model |
| 7 | LIFE | viability/metabolic lifecycle | ABS | HIGH | P1 | energy, age, reproduction | biological engine, not physical law |
| 8 | GLOW | emission/visual phenotype | ABS | HIGH | P2 | energy/phenotype | presentation/phenotype mechanism |
| 9 | AFFINITY | preferential interaction | ABS | HIGH | P1 | species/genotype | interaction modifier |
| 10 | REPRO | reproduction | EST/ABS | HIGH | P1 | energy, genotype, population | lifecycle engine |
| 11 | TRACK | directional attraction/targeting | ABS | HIGH | P1 | perception, neighborhood | behavior law |
| 12 | SENESCENCE | age-related degradation | EST/ABS | HIGH | P1 | age, metabolism | biological lifecycle |
| 13 | ENERGY | metabolic energy bookkeeping | EST/APP | HIGH | energy reservoirs | canonical resource model |
| 14 | RADIATION | radiation exposure/effects | EST | MED | P1 | fields, dose, material response | physical/biological bridge |
| 15 | GENOTYPE | inherited genome state | EST/ABS | HIGH | DNA buffer, reproduction | genetics model |
| 16 | PHENOTYPE | genotype-to-state expression | EST/ABS | HIGH | genotype, environment | genetics expression layer |
| 17 | CATALYSIS_LAW | reaction-rate modification | EST | MED | chemical species/state | chemistry engine |
| 18 | SOLVATION | solvent interaction | EST | LOW/MED | material composition | requires multi-component chemistry |
| 19 | ACIDITY | pH/proton activity | EST | MED | chemical composition | chemistry state, not force |
| 20 | OXIDATION | electron-transfer chemistry | EST | MED | charge/material state | chemistry/electrochemistry |
| 21 | POLYMER | chain formation | EST | MED | bonding, chemistry | molecular graph needed |
| 22 | ISOMERIZATION | structural rearrangement | EST | LOW/MED | molecular state | molecular chemistry |
| 23 | CHIRALITY | handed molecular structure | EST | LOW/MED | molecular topology | molecular representation |
| 24 | CRYSTALLIZATION | ordered phase formation | EST | MED | temperature, composition | phase/material engine |
| 25 | HEAT | thermal energy transfer | EST | HIGH | P0 | temperature, energy | canonical thermodynamic process |
| 26 | COLD | cooling/negative heat flow | ABS | HIGH | P1 | heat | represent as heat transfer, not separate physics |
| 27 | CONVECTION | bulk heat transport | EST | MED | P1 | fluid/medium model | continuum approximation |
| 28 | PHASE_RADIATION | radiation during phase change | APP | MED | P2 | phase transitions, radiation | clarify physical definition |
| 29 | SUBLIMATION | solid-gas transition | EST | MED | P2 | phase/material state | phase engine |
| 30 | TIME_DILATION | relativistic clock-rate effect | EST | LOW/MED | P2 | velocity/gravity metric | restricted relativistic model |
| 31 | DIMENSIONALITY | active spatial dimensional model | ABS | MED | P2 | world topology | world configuration, not force |
| 32 | CHAOS | deterministic sensitivity/dynamics | EST/ABS | HIGH | P1 | nonlinear dynamics | analysis/initial-condition model |
| 33 | ORDER | ordering/self-organization bias | ABS | HIGH | P2 | entropy/information metrics | derived/emergent measure |
| 34 | FATE | deterministic destiny-point force | FICTION | HIGH | P3 | species/time | retain only as explicit fictional rule |
| 35 | WILL | goal-directed behavior abstraction | ABS/FICTION | HIGH | P2 | goals, energy, memory | agency engine, not physics |
| 36 | SOUL_LAW | persistent identity/essence | FICTION | HIGH | P3 | identity/lineage | rename as identity if scientific framing desired |
| 37 | MIND | cognition/agency abstraction | ABS | MED | P2 | memory, perception, goals | higher-order agent model |
| 38 | VOID | vacuum/absence or repulsive-space effect | SPEC | MED | P3 | field/world model | define narrowly before migration |
| 39 | BOND | persistent pair/structural connection | EST/ABS | HIGH | P1 | distance, chemistry, constraints | shared bond graph |
| 40 | REDUCTION | electron gain/reduction chemistry | EST | MED | P2 | charge/material state | chemistry engine |
| 41 | ALLOY | mixed-material composition | EST | LOW/MED | P2 | material composition | material-state model |
| 42 | MELT | solid-liquid transition | EST | MED | P1 | heat/material state | phase engine |
| 43 | BOIL | liquid-gas transition | EST | MED | P1 | pressure/temp/material | phase engine |
| 44 | CONDENSE | gas-liquid transition | EST | MED | P1 | pressure/temp/material | phase engine |
| 45 | DEPOSIT | gas/solution to solid deposition | EST | MED | P2 | chemistry/phase | clarify distinction from crystallization |
| 46 | EXOTHERMIC | reaction heat release | EST | HIGH | P1 | chemistry + heat | energy-conserving reaction process |
| 47 | TELEPATHY | direct information transfer | FICTION/ABS | HIGH | P3 | communication | model as explicit communication channel |
| 48 | CLAIRVOYANCE | information without ordinary sensing | FICTION | HIGH | P3 | perception | fictional sensor/omniscience rule |
| 49 | PRECOGNITION | future-state information | FICTION/ABS | HIGH | P3 | prediction/history | implement as prediction, not literal future access |
| 50 | ASTRAL | nonlocal agent/state representation | FICTION | HIGH | P3 | identity/world | experimental narrative mechanic |
| 51 | PREDATION | trophic interaction | EST/ABS | HIGH | P1 | energy, species, targeting | ecology engine |
| 52 | COMMS | signal exchange | EST/ABS | HIGH | P1 | signal fields, channels | canonical communication layer |
| 53 | CHARGE_LAW | particle charge state | EST | HIGH | P1 | charge, EM field | shared EM substrate |
| 54 | ELECTRIC_FIELD | electric force field | EST | MED | P1 | charge distribution | field solver |
| 55 | CURRENT | charge flow | EST | MED | P2 | conductive medium, charge | network/continuum model |
| 56 | RESISTANCE | opposition to current | EST | HIGH | P2 | conductivity/current | material property, not independent force |
| 57 | CAPACITANCE | charge storage relation | EST | MED | P2 | voltage/geometry | circuit/field state |
| 58 | INDUCTANCE | magnetic energy from current | EST | LOW/MED | P2 | current/magnetic field | field/circuit state |
| 59 | MAGNETISM | magnetic interaction | EST | MED | P1 | charge/current/spin | EM field model |
| 60 | RESONANCE | driven response at characteristic frequency | EST | MED | P1 | oscillator/phase | generic dynamical response |
| 61 | FLUX | field-through-surface quantity | EST | MED | P2 | field geometry | derived field quantity |
| 62 | IONIZATION | electron removal/addition | EST | MED | P2 | radiation/energy/material | plasma/chemistry bridge |
| 63 | DISCHARGE | rapid charge redistribution | EST | MED | P2 | charge/current/medium | EM process |
| 64 | PLASMA | ionized collective medium | EST | LOW/MED | P2 | ionization + EM + thermodynamics | specialized approximation |
| 65 | SUPERCONDUCTIVITY | zero/low resistance collective state | EST | LOW | P3 | temperature/material quantum model | specialized material model |
| 66 | MEMORY | persistent information state | EST/ABS | HIGH | P1 | storage, decay | information substrate |
| 67 | PATTERN | pattern detection/representation | ABS | HIGH | P2 | memory, perception | derived information process |
| 68 | STIGMERGY | environment-mediated coordination | EST/ABS | HIGH | P1 | field/info | ecology/agent behavior |
| 69 | SIGNAL_BOOST | signal amplification | EST/ABS | HIGH | P1 | signal, energy | communication process |
| 70 | LEARN | adaptive parameter update | EST/ABS | MED | P1 | memory, feedback | learning engine |
| 71 | SYMBOL | discrete information token | ABS | HIGH | P2 | memory/comms | information representation |
| 72 | METRIC | measured/derived quantity | ABS | HIGH | P2 | telemetry/state | should be derived infrastructure, not physics |
| 73 | PREDICT | predictive model | ABS | MED | P2 | history/memory | inference engine |
| 74 | CODE | encoded information | ABS | HIGH | P2 | symbols/comms | representation/protocol layer |
| 75 | PROTOCOL | interaction rules for communication | ABS | HIGH | P1 | comms | communication protocol layer |
| 76 | FEEDBACK | closed-loop response | EST/ABS | HIGH | sensing/action | shared control mechanism |
| 77 | LANGUAGE | compositional communication | ABS | MED | P2 | symbols, protocol, memory | agent/culture engine |
| 78 | CULTURE | intergenerational/social information | EST/ABS | MED | P2 | memory, language, groups | higher-order information engine |
| 79 | SINGULARITY | collapse at extreme density/mass | EST/APP | MED | P2 | gravity, EOS | define as threshold model, not literal singularity |
| 80 | ENTANGLEMENT | nonclassical correlated state | EST | LOW | P3 | quantum state representation | quantum-inspired until state formalism exists |
| 81 | HISTORY | persistent world/spatial memory | ABS | HIGH | P1 | snapshots/fields | derived state/history layer |
| 82 | TIDE | differential gravitational force | EST | HIGH | P1 | gravity, extended body | derive from gravity gradient |
| 83 | FRICTION | contact/medium dissipation | EST | HIGH | P0 | drag/contact | unify with dissipation semantics |
| 84 | HORIZON | causal/black-hole boundary | EST | LOW | P2 | relativity, gravity | specialized relativistic model |
| 85 | RADIATION_PRESSURE | momentum transfer from radiation | EST | MED | P2 | radiation field | field-momentum model |
| 86 | MASS_INERTIA | mass-dependent resistance to acceleration | EST | HIGH | P0 | momentum/inertia | likely property, not separate law |
| 87 | FIELD | generic spatial field substrate | ABS | HIGH | P0 | field registry | infrastructure rather than a single law |
| 88 | SYMBIOSIS | mutually beneficial species interaction | EST/ABS | HIGH | P1 | affinity, ecology, energy | ecology relation |
| 89 | PARASITE | asymmetric resource extraction | EST/ABS | HIGH | host/pathogen model | ecology relation |
| 90 | HIBERNATION | reversible metabolic suppression | EST/ABS | HIGH | energy, temperature, lifecycle | biological state transition |
| 91 | IMMUNITY | adaptive/protective resistance | EST/ABS | MED | P2 | pathogen exposure, memory | biological defense model |
| 92 | ELECTROLYSIS | electrically driven chemical separation | EST | MED | P2 | current, chemistry | coupled electrochemistry |
| 93 | PHOTOLYSIS | light-driven bond breaking | EST | MED | P2 | radiation, chemistry | coupled photochemistry |
| 94 | PRECIPITATION | solution to solid separation | EST | MED | P2 | solubility, chemistry | chemistry/phase engine |
| 95 | NEUTRALIZATION | acid-base reaction | EST | MED | P2 | acidity, stoichiometry | chemistry engine |
| 96 | STOICHIOMETRY | conserved reaction ratios | EST | HIGH | P1 | species/material inventory | constraint, not force |
| 97 | AUTOCATALYSIS | reaction catalyzes itself | EST | MED | P2 | catalysis, chemistry | reaction-network process |
| 98 | ADIABATIC | no-heat-transfer compression/expansion | EST | MED | P1 | pressure, temperature, EOS | thermodynamic state relation |
| 99 | COMPRESSION | density/volume reduction | EST | HIGH | P1 | pressure, material state | continuum/material process |
| 100 | EXPANSION | density/volume increase | EST | HIGH | P1 | pressure, material state | pair with compression |
| 101 | EQUILIBRIUM | approach to thermodynamic/chemical equilibrium | EST | MED | P1 | heat, chemistry, pressure | derived target state/process |
| 102 | LATENT_HEAT | energy at phase transition | EST | HIGH | P1 | phase, energy | phase engine |
| 103 | RUNAWAY | positive-feedback instability | EST/ABS | HIGH | P2 | feedback, energy | generic instability rule; define bounds |
| 104 | CONSCIOUSNESS | predictive self-model proxy | ABS | MED | P2 | self-model, memory, energy | explicitly proxy; do not claim consciousness |
| 105 | PERCEPTION | sensing/neighbor awareness | ABS | HIGH | P1 | neighborhood/sensors | agent perception layer |
| 106 | SYNCHRONICITY | phase/state alignment | ABS/EST | HIGH | oscillators/resonance | rename/define as synchronization if desired |
| 107 | ANTENNA | transduction between field and signal | EST/APP | MED | P2 | EM field, signal | specialized transducer |
| 108 | SHIELDING | attenuation of fields/radiation | EST | MED | P2 | material/field | material response |
| 109 | POLARIZATION | oriented EM state | EST | MED | P2 | field/charge/spin | field/material state |
| 110 | NAVIGATION | spatial path/goal selection | ABS | HIGH | P2 | perception, memory, goals | agent behavior |
| 111 | ENCRYPTION | encoded communication resistant to interception | ABS | MED | P3 | code/protocol | information-game mechanic |
| 112 | SUPERPOSITION | simultaneous quantum amplitudes | EST | LOW | P3 | quantum state vector | requires genuine state formalism |
| 113 | TUNNELING | barrier penetration probability | EST | MED | P3 | wavefunction/barrier | quantum-inspired model possible |
| 114 | DECOHERENCE | loss of quantum phase coherence | EST | LOW/MED | P3 | density matrix/open system | specialized quantum model |
| 115 | WAVE_PARTICLE | context-dependent quantum behavior | EST | LOW | P3 | wavefunction/measurement | avoid classical toggle interpretation |
| 116 | UNCERTAINTY | quantum observable uncertainty relation | EST | LOW/MED | P3 | state representation | statistical quantum model |
| 117 | TELEPORT | state transfer via quantum protocol | EST/ABS | LOW | P3 | entanglement/classical channel | do not implement as matter teleportation |
| 118 | OBSERVER | measurement interaction | EST/ABS | LOW | P3 | measurement model | define measurement operator explicitly |
| 119 | PLANCK | fundamental scale/quantization cutoff | EST | LOW | P3 | unit system | parameter/scale, not independent law |
| 120 | COHERENCE | phase correlation | EST | MED | P3 | oscillators/quantum state | distinguish classical synchronization from quantum coherence |
| 121 | BOSONIC | bosonic statistics/state behavior | EST | LOW | P3 | quantum many-body state | specialized quantum model |
| 122 | FERMIONIC | fermionic statistics/exclusion | EST | LOW | P3 | quantum many-body state | specialized quantum model |
| 123 | SPIN | intrinsic angular momentum | EST | LOW/MED | P3 | quantum state/EM | model as discrete state before force coupling |
| 124 | SPECTRAL | spectrum/energy-frequency representation | EST | MED | P3 | wave/field representation | derived analysis/state |
| 125 | WAVEFUNCTION | quantum state representation | EST | LOW | P3 | full quantum state formalism | foundational quantum subsystem |
| 126 | HYPERPLANE | higher-dimensional mathematical state/geometry | ABS | MED | P3 | dimensionality | mathematical extension, not quantum law |
| 127 | ANTIMATTER | opposite-charge particle annihilation | EST | MED | P2 | particle species, mass-energy, charge | physically grounded but needs material model |
| 128 | CONTACT | geometric contact constraint | EST | HIGH | P0 | collision/radius | unify with COLL while preserving index |
| 129 | MOMENTUM | conserved quantity/state update | EST | HIGH | P0 | forces/integration | core invariant, not optional force |
| 130 | INERTIA | resistance to acceleration | EST | HIGH | P0 | mass/momentum | property; overlaps MASS_INERTIA |
| 131 | TORQUE | angular acceleration from moment | EST | HIGH | P1 | inertia/geometry | requires orientation/angular state |
| 132 | CONSTRAINT | kinematic/dynamic restriction | EST | HIGH | P1 | contacts/bonds | solver constraint subsystem |
| 133 | FRAGMENTATION | breakup under stress/energy | EST/APP | MED | P2 | bonds, material strength | material failure process |
| 134 | TOPOLOGY | connectivity/structural relationships | EST/ABS | MED | P2 | bonds/graphs/boundaries | graph/state layer, not force |
| 135 | ADHESION | surface attraction/bonding | EST | MED | P2 | contact/material chemistry | contact/material interaction |

## Highest-priority semantic repairs

### 1. `COLL` vs `CONTACT`
These should not remain two unrelated collision implementations. `CONTACT` should own geometric contact constraints/contact manifold semantics; `COLL` can remain the stable compatibility identifier for the chosen collision response model. The two need a declared relationship.

### 2. `MASS_INERTIA` vs `INERTIA`
These are almost certainly the same physical concept at different naming levels. Mass is the inertial parameter; inertia is the dynamical property. Keep both stable indices if compatibility requires them, but make one a compatibility alias/property view rather than two independent forces.

### 3. `DRAG` vs `FRICTION`
Drag is generally velocity-dependent dissipation through a medium; friction is typically contact/interface dissipation. They should share a dissipation/energy-accounting subsystem while remaining distinct mechanisms.

### 4. `FIELD` vs individual field laws
`FIELD` should be infrastructure describing a spatial field substrate. `ELECTRIC_FIELD`, `RADIATION`, `FLUX`, etc. should instantiate specific field quantities. Treating `FIELD` as another arbitrary force would create architectural nonsense.

### 5. `COLD`, `MELT`, `BOIL`, `CONDENSE`, `SUBLIMATION`, `LATENT_HEAT`
These are not independent fundamental laws. They are state transitions and thermodynamic processes sharing temperature, pressure, material identity, phase and energy accounting. Preserve the stable toggles, but implement them through a common thermodynamics model.

### 6. Information laws
`METRIC`, `PATTERN`, `PREDICT`, `CODE`, `PROTOCOL`, and `LANGUAGE` are different abstraction levels. They should be read/derived information mechanisms, not all execute as per-particle forces.

### 7. Quantum catalogue
The quantum entries should form a separate model backend or explicit approximation profile. A classical particle buffer cannot become a faithful quantum many-body simulator merely by adding `SUPERPOSITION` and `WAVEFUNCTION` fields.

### 8. Metaphysics catalogue
Keep experimental rules if they are useful to VEPA's world-building/ALife goals, but label them as fictional or computational abstractions. `CONSCIOUSNESS` is already documented in stable code as a predictive-processing proxy, which is a good pattern: model the mechanism and explicitly avoid claiming the phenomenon itself has been simulated.

## Migration tiers

### P0: substrate and invariants
`GRAV, DRAG, COLL, HEAT, FRICTION, MASS_INERTIA, FIELD, CONTACT, MOMENTUM, INERTIA`

First make state ownership, units, integration, energy bookkeeping, contact semantics and deterministic replay correct.

### P1: coherent classical + artificial-life core
`ENTR, BUOYANCY, ACCR, LIFE, AFFINITY, REPRO, TRACK, SENESCENCE, ENERGY, RADIATION, GENOTYPE, PHENOTYPE, CATALYSIS_LAW, BOND, PREDATION, COMMS, CHARGE_LAW, ELECTRIC_FIELD, MEMORY, STIGMERGY, SIGNAL_BOOST, FEEDBACK, TIDE, SYMBIOSIS, PARASITE, HIBERNATION, STOICHIOMETRY, ADIABATIC, COMPRESSION, EXPANSION, EQUILIBRIUM, LATENT_HEAT, PERCEPTION, TORQUE, CONSTRAINT`

These form the credible bridge from particle physics to artificial life.

### P2: specialized models and higher-order systems
Most remaining established/abstract laws, including chemistry, EM circuits/materials, ecology, information, stellar/relativistic approximations and higher-order behavior.

### P3: experimental/fictional/quantum-frontier
`FATE, SOUL_LAW, TELEPATHY, CLAIRVOYANCE, PRECOGNITION, ASTRAL, VOID` where undefined, and the quantum family `SUPERPOSITION` through `HYPERPLANE` except carefully bounded approximations. These should not block the core simulation.

## What this changes for vepa-next

The migration target should **not** be "implement 136 functions." It should be:

1. preserve all 136 stable identifiers for compatibility;
2. assign each identifier an explicit semantic type and scientific status;
3. route multiple identifiers into shared physical/model subsystems where appropriate;
4. make dependencies, conflicts and execution phases explicit;
5. distinguish normative state-changing mechanisms from derived metrics and read models;
6. require domain-specific validation before an implementation can be marked `validated`;
7. keep fictional and quantum-inspired mechanisms available without representing them as established physics;
8. use the stable implementation as behavioral evidence, not as unquestionable scientific truth.

This is the basis for the next law-registry/adapter work in `vepa-next`.