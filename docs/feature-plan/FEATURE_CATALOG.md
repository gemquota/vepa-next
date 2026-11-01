# VEPA Feature Catalog

**Purpose:** a normalized inventory of feature concepts described across the field manual, implementation plan, and RRP intent records.

**Status:** catalogued from planning material; runtime status remains unverified unless an item is explicitly linked to current source and tests in [TRACEABILITY.md](TRACEABILITY.md).

## 1. Field-manual controls and recipes

These letter labels come from `GUIDE.md`. They are tuning/interaction concepts, not the same namespace as the RRP release sets below.

| ID | Concept | Intended effect | Important qualification |
|---|---|---|---|
| FM-A | Kinetic Buffer | Balance attraction/force with viscosity and jitter so clusters settle rather than oscillate or explode | Recipe values are starting points, not universal stable settings |
| FM-B | Geometric Lock | Combine symmetry, stiffness, and torque to encourage non-circular interlocking structures | Validate against actual solver ranges and current DNA schema |
| FM-C | Social Oscillator | Couple signal response, pulse rate, and alpha/state to produce propagating group activity | Requires signal propagation to be active and measurable |
| FM-D | Boundary Condition | Select periodic wrap, solid bounce, open/void escape, or sticky boundary behaviour | Confirm current boundary-law names and semantics in code |
| FM-E | Categorical Law Colors | Use category-based colour encoding to distinguish law families | Presentation-only unless the runtime uses colour as more than display metadata |
| FM-F | Evolutionary Coloring | Let colour reflect evolving/species state to expose change over time | Define stable mappings and accessibility expectations |

## 2. Cross-cutting world and interaction systems

| ID | Capability | Intended behaviour | Key dependencies / safeguards |
|---|---|---|---|
| X-01 | Dish as Medium | A coarse 3D field grid carries WIND, EM, THERMAL, and INFO; gradients influence particles | Field schema, bounded writes, deterministic updates, grid scaling |
| X-02 | Walls and portals | Configurable border/ring/cross barriers and paired portals | Clarify decorative vs impassable walls; cap field writes; deterministic transfer |
| X-03 | Civilizations | Detect or declare groups, assign roles, build territory structures, and trade | Group registry, membership lifecycle, treasury accounting, overlays |
| X-04 | Living world / ecology | Speciation, extinct-slot reuse, biodiversity, population trends, food webs, niche analysis | Species-slot invariants, event cooldowns, deterministic reproduction |
| X-05 | World events | Detect famine, bloom, and collapse from metrics plus confirming conditions; apply reversible responses | Event hysteresis, cooldowns, undo/checkpoint, journal |
| X-06 | Performance controls | Expose grid resolution, per-cell cap, interaction cap, and neighbour buffer | Clearly state fidelity/performance trade-offs; benchmark matrix |
| X-07 | Deep time | Tick-based epochs, restorable snapshots, time speed, extinction/recovery thresholds | Snapshot bounds, solver stability, persistence validation |
| X-08 | Memory and culture | Persistent species/group memory, transmission, condition-driven adaptation | Keep arrays aligned through births, deaths, speciation, and slot reuse |
| X-09 | Agency and narrative | Goal-directed species and bounded narrative actions; journal milestones | Rate limits, explicit permissions, reversible changes |
| X-10 | Tools and artifacts | Treasury-funded tools, weapons, and barriers with upkeep/decay | Economy bounds, ownership, write budgets |
| X-11 | Society and governance | Group policies, alliances, conflict, migration, and trade effects | Cooldowns, bounded policy changes, reversible territory effects |
| X-12 | Infrastructure and energy | Resource extraction, energy sharing, roads, and long-horizon structures | Energy conservation, construction caps, multi-tick state consistency |
| X-13 | Chaos multiplex | Independent shards, fitness metrics, variation controls, optional import/export | Isolation, deterministic seeds, explicit import semantics |
| X-14 | Intelligence/lineage/timeline | Cluster insight, births/deaths, lineage depth, snapshots, scrubbing, and goal logs | Memory cost limits, lifecycle correctness, reproducible replay |
| X-15 | Reproduction tiers | Three-tier reproduction concept described in the guide | Exact tiers and thresholds must be checked against current implementation |

## 3. RRP release-set catalogue

The RRP letters below refer to planned release sets. They are distinct from FM-A–FM-F above. The design narrative describes an 18-set lifecycle across six three-set documents. The sequence is a dependency map, not proof that every set shipped.

### E · F · A: Matter, civilizations, living world

| Set | Focus | Main design elements |
|---|---|---|
| E / E.1 | Matter and medium | Vector/scalar fields, generalized advection, wall flags, biomes, portals, gravity wells, opt-in hard collisions through COLL |
| F | Civilizations | Group registry, construction, treasury/trade, market fields, group analytics |
| A | Living world | Isolation-driven speciation, recycled species slots, ecosystem analytics, confirmed world events, shard-level evolution |

### D · G · H: Memory and agency

| Set | Focus | Main design elements |
|---|---|---|
| D | Deep time and epochs | Tick-boundary eras, snapshots, extinction/recovery events, solver-time controls |
| G | Memory and culture | Persistent species/group memory, cultural transmission, field-driven behavioural adaptation |
| H | Agency and narrative | Bounded narrative actions, species goals, journaled milestones |

### I · J · K: Tools and societies

| Set | Focus | Main design elements |
|---|---|---|
| I | Tools and artifacts | Per-group inventories, treasury-funded crafting, upkeep/decay, tool/weapon/barrier effects |
| J | Society and governance | Policy vectors, alliances, conflicts, and policy-driven behaviour |
| K | Infrastructure and energy | Resource extraction, energy grids, roads, and capped mega-structures |

### L · M · N: Transforming the substrate

| Set | Focus | Main design elements |
|---|---|---|
| L | Exotic matter | Antimatter, dark/strange/negative-mass zones, particle state tags, bounded interactions |
| M | Relativity | Curvature field, signal lensing, time dilation, bounded mass-energy conversion |
| N | Quantum macroscale | Superposition, entanglement semantics, energy-gated tunnelling, observer-triggered collapse |

### O · P · Q: Cosmic scale

| Set | Focus | Main design elements |
|---|---|---|
| O | Stellar physics | Stellar wells, energy/radiance, black-hole thresholds, supernova shockwaves |
| P | Synthetic life | Non-DNA organisms, digital lineage copies, machine groups |
| Q | Cosmology | Cross-shard exchange, cosmic epochs, slow expansion/dark-energy model |

### R · S · T: Completion and rebirth

| Set | Focus | Main design elements |
|---|---|---|
| R | Entropy and rebirth | Heat death, contraction/reboot, upkeep-driven structural decay |
| S | Simulation awareness | Threshold-based in-world awareness, journaled player interventions, inspection UI |
| T | The observer | Bounded god-mode edits, measurable graduation predicate, new-game-plus seeded from prior runs |

## 4. Shared system contracts

All feature sets should reuse shared infrastructure where practical rather than creating competing state owners:

- **Fields:** one canonical field-write API; explicit field type and units; bounded writes and deterministic update cadence.
- **Events and metrics:** one event/metrics path; separate detection from confirmation; hysteresis and cooldowns for recurring events.
- **Reversibility:** world-changing automation and observer actions checkpoint before mutation where the undo system supports it.
- **Determinism:** seed all random decisions; define tick boundaries; ensure replay and save/load cover all authoritative state.
- **Lifecycle:** births, deaths, slot reuse, imports, and shard resets update every parallel state structure consistently.
- **Performance:** benchmark the actual hot path; separate solver, worker, render, memory, and persistence costs.
- **Presentation:** analytics must disclose their inputs and definitions; colour and overlays must not imply scientific certainty the model does not provide.

## 5. Scope cautions

Some RRP items explicitly reserve true sentience claims, rendered spacetime warping, unlimited cosmic scale, interstellar travel, and new law slots as out of scope or deferred. Preserve those boundaries unless a new decision record changes them.

The 128-law ceiling appears in later RRP plans as a constraint. Treat it as a design-time constraint to verify against the current law representation before extending the model.
