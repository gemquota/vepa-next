# 🧭 The Architect's Field Manual: Engineering Emergence

> **Status:** VEPA4-current (design guidance — DNA trait names and recipes apply
> to the v4-line 64-parameter genome; exact slider ranges live in
> `src/constants.js` `DNA_RANGES`).

This guide is not a manual for sliders; it is a strategic framework for **Universal Design**. In VEPA, the species are your clay, and the DNA rules are your tools.

### Technical specification tree
For implementation-level inspection, use the generated [`docs/spec/`](./docs/spec/README.md) tree. It separates UI appearance/function, simulation and similar concepts, state/persistence, law records, source modules, testing, operations, and traceability. Run `npm run spec:generate` after source changes and `npm run spec:check` to detect drift.

---

## 1. The Trinity of Structure

Stable macro-structures are rarely the result of a single parameter. They emerge from the "Golden Ratios" between three core pillars:

### A. The Kinetic Buffer (Force vs. Viscosity)
*   **The Problem:** High attraction leads to "Collisional Heat"—particles oscillating wildly or exploding out of clusters.
*   **The Fix:** **Viscosity** (0.95+) acts as a shock absorber. It allows particles to bleed off kinetic energy upon arrival, settling into "Molecules" instead of chaotic orbits.
*   **Recipe for Stability:** `Force: 1.0` | `Viscosity: 0.98` | `Jitter: 0.05`.

### B. The Geometric Lock (Stiffness vs. Symmetry)
*   **The Problem:** Circles are too perfect; they roll and slip past each other.
*   **The Fix:** Use **Symmetry (C3)** to warp particles into ellipses and **Stiffness** to make those edges "Hard." Non-circular shapes create mechanical interlocking, allowing for the construction of rigid beams and non-deformable crystals.
*   **Recipe for Architecture:** `Stiffness: 2.5` | `Symmetry: 0.8` | `Torque: 0.2`.

### C. The Social Oscillator (Signal vs. Pulse)
*   **The Problem:** Individual particles act as silos.
*   **The Fix:** Synchronize them. **Signal Response** allows one particle's state change to trigger its neighbors. When tuned correctly, you can create "Traveling Waves" or "Heartbeats" that ripple across an entire colony.
*   **Recipe for Neural Nets:** `Pulse Rate: 0.1` | `Signal Resp: 1.5` | `Alpha: 0.4`.

### D. The Boundary Condition (Wrap vs. Solid vs. Void vs. Sticky)
*   **The Problem:** Toroidal wrapping (Periodic) is great for infinite fields but bad for simulating containers or "Leaking" systems.
*   **The Fix:** Use the cycling **WRAP** law to shift topology:
    *   **Periodic:** Infinite toroidal space (Screen wrap).
    *   **Solid:** Elastic bounce at boundaries for high-pressure containment.
    *   **Void:** Open system where matter "evaporates" out of bounds.
    *   **Sticky:** Zero-velocity adhesion at the edge of space.

### The Dish as a Medium (v8.2 — SETUP > WORLD > ENVIRONMENT > MEDIUM)
*   **The Idea:** the world is more than a box — a coarse 3D field grid
    (12³–24³ cells, auto-scaled to WORLD SIZE) carries ambient WIND, EM,
    THERMAL and INFO fields. Particles feel them as forces: winds push along
    their flow, heat/info push down-gradient, gravity wells pull radially.
*   **Walls are a LAW now:** pick a WALLS preset (border / ring / cross) and
    thickness — the cells become impassable **only while the COLL law is on**
    (the hard-matter toggle). Without COLL the walls are decorative; ghost laws
    (TUNNELING / TELEPORT / ASTRAL) walk straight through them.
*   **Portals:** PORTALS > 0 pairs distant cells — enter one and you exit the
    other, matter and momentum intact.
*   **Field sliders are live:** turn WIND FIELD up mid-run and the breeze
    builds within a few seconds; no restart needed.

### The Rise of Civilizations (v8.3 — DATA > 🏙️ CIVILIZATIONS)
*   **Groups form organically:** dense clusters of communicative/affine
    particles (contact threshold + DNA) become detected groups; you can also
    DECLARE a group for a set of species (bus `group:declare`), and it recruits
    ungrouped particles of those species on contact.
*   **Roles:** the strongest voice (signal + memory + energy) leads; rigid
    particles build; skittish/strong ones forage.
*   **They build:** nests/hives appear at territory centroids and roads link
    neighbouring groups — written into the E.1 field grid, so physics feels
    them (INFO gradients) and they decay naturally.
*   **They trade:** close groups exchange treasury proportional to their gap
    (mean-reverting market prices written onto the grid). Foragers produce
    income, leaders tithe.
*   **They die:** membership collapse dissolves a group; prolonged shrink does
    too. Watch the overlay, network graph, and economy Sankey in the
    CIVILIZATIONS sub-tab.

### The Living World (v8.4 — DATA > 🌿 ECO)
*   **Speciation is a physics fact:** a species splits when its isolation —
    how spread out it is, plus how many members are pinned against walls in
    the E.1 field grid — crosses its SPECIATION_THRESHOLD DNA. Lower the
    threshold in the DNA panel and evolution runs wild; raise it and the dish
    stabilises.
*   **Slots are recycled:** the parent keeps its species slot; the child takes
    the first extinct-freed slot. If all 64 are alive, the split queues until
    an extinction frees one. Watch bursts (✦) and extinctions (✖) in the ECO
    feed.
*   **The ECO sub-tab reads the dish:** population curves, biodiversity
    (Shannon), oscillation (STABLE/MILD/WILD), a food-web graph (bigger
    species preying on overlapping smaller ones), and each species' niche
    (centroid + radius).
*   **The dish narrates its own disasters:** FAMINE (population + energy
    crash), BLOOM (surge), COLLAPSE (near-total extinction). Each must
    persist across two checks (no false alarms) and cools down between
    events. The response is reversible — an undo-ring checkpoint, a world-param
    nudge, and a field write (drought / fertilization).
*   **Multiplex shards evolve on their own:** each chaos-multiplex shard runs
    its own speciation, so guided evolution explores species-level futures;
    fitness sees the species count.

### Performance Knobs (v8.5 — SETUP > WORLD > PERFORMANCE)
*   **The interaction budget is yours now:** GRID RESOLUTION (6–64), CELL
    PARTICLE CAP (1–500), MAX INTERACTIONS (8–4000) and NEIGHBOR BUFFER
    (24–16384) live in their own accordion section and take effect next tick —
    no restart.
*   **Lower MAX INTERACTIONS for dense dishes:** the pair loop is the hot
    path, so cutting it trades pair fidelity for speed. At ~10k particles the
    default 500 → 100 cut runs ~30% faster; the sparse default world barely
    notices.
*   **NEIGHBOR BUFFER caps the gather** before the pair cap applies — if it is
    smaller than MAX INTERACTIONS it binds first (fewer candidate neighbours
    are ever considered).
*   **Measure, don't guess:** `vepa4 bench --knobs` prints the full
    MAX INTERACTIONS × NEIGHBOR BUFFER matrix so you can tune against your own
    machine before touching the sliders.

### Deep Time (v8.6 — SETUP > WORLD > TIME)
*   **TIME SPEED (0.1–10×)** is a real physics change, not a UI trick — it
    multiplies the solver timestep, so slow-motion and fast-forward actually
    change how the dish evolves (and how many particles per second spawn).
*   **EPOCH LENGTH** sets how many ticks make an era. Every boundary names a
    new epoch and snapshots the whole world, so you can restore any earlier era
    (`epoch:restore`) like a save point.
*   **EXTINCTION / RECOVERY THRESH** tune when a population collapse or rebound
    is declared — each is journaled and answered reversibly (drought on
    extinction, fertilization on recovery) through the undo ring + fields.

### Memory & Culture (v8.7)
*   **Traits outlive bodies:** species and groups carry persistent memory
    buffers (activity / cohesion / exploration / threat) that survive
    individual particles and generations — unlike the per-particle cache.
*   **Speciation inherits culture:** when a species splits, the child blends
    its parent's learned memory at the CULTURAL TRANSMISSION rate (genome stays
    separate).
*   **Groups enculturate:** a group continuously blends its member species'
    memories into a collective; memory fades without rehearsal and dead
    groups' memory is pruned.
*   **Conditions shape behavior:** every 60 ticks each species' memory drifts
    toward its actual state — energy sets activity, density sets cohesion,
    sparse species explore while dense species hold, and an open extinction
    epoch raises threat.

### Agency & Narrative (v8.8)
*   **The story acts:** the Narrative Consciousness now takes bounded, reversible
    actions — when an extinction epoch is open it raises the spawn rate; when
    energy runs low it fertilizes the INFO field; when the dish overpopulates
    it writes a cooling pocket. Every move is undoable and journaled.
*   **Memory becomes behavior:** a species with high learned THREAT flees the
    centre, high EXPLORATION seeks it, otherwise it holds — small velocity
    nudges, the physics still rules.
*   **Milestones are quests:** eight species, three civilizations, 1,500 lives
    and abundant energy each fire a one-time journal entry as they emerge.

### Infrastructure & Energy (v8.11 — SETUP > WORLD > SOCIETY)
*   **Groups harvest:** every group draws ambient INFO/THERMAL field energy
    into its treasury — and the field really loses it (no free power).
*   **Allies grid:** allied groups pipe treasury into member energy pools,
    keeping their citizens fed between meals.
*   **Mega-structures:** wealthy groups start long builds — WALL (impassable
    corner ring), BRIDGE (INFO corridor to a neighbour), HUB (a warm,
    information-dense civic heart) — that advance faster in later eras and
    execute with griefing caps.
*   **The trilogy³ closes:** the world exists (E·F·A), remembers and acts
    (D·G·H), and now builds (I·J·K).

### Society & Governance (v8.10 — SETUP > WORLD > SOCIETY)
*   **Groups govern:** each group derives a policy — AGGRESSION (learned fear +
    poverty), OPENNESS (surplus + wanderlust), MIGRATION (wanderlust +
    crowding) — that shifts slowly as conditions change.
*   **Allies share:** close groups with similar policy ally and pool their
    treasuries; opposed neighbors fight at the border, cooling down between
    skirmishes.
*   **Policy is behavior:** aggressive groups raid their nearest non-ally,
    open groups earn commerce bonuses, migrating groups disperse their
    members — all bounded, all readable in the DATA panels.

### Tools & Artifacts (v8.9 — SETUP > WORLD > SOCIETY)
*   **Groups build:** any group with builders can spend treasury to craft
    TOOL / WEAPON / BARRIER artifacts (up to 12 of each, decaying under a
    maintenance cost the treasury must cover).
*   **Tools pay:** each TOOL adds an income dividend to the treasury.
*   **Weapons calm:** each WEAPON dampens the group's learned THREAT memory,
    so its species flee less and hold ground instead.
*   **Barriers fence:** each BARRIER writes impassable wall cells at the
    territory's corners — real walls the COLL law respects.

### E. The Categorical Law Colors
Laws are now color-coded by category to help you navigate the system status at a glance:
*   **BLUE (Physics):** Gravity, Drag, Entropy, Wrap, Collision, Accretion, Planetary.
*   **GREEN (Biology):** Life, Glow, Affinity, Repro, Track, Senescence, Energy, Radiation, Genotype, Phenotype.
*   **PURPLE (Chemistry):** Catalysis, Solvation, Acidity, Oxidation, Poly, Isomerization, Chirality, Crystallization.
*   **ORANGE (Thermodynamics):** Heat, Cold, Convection, Radiation, Phase changes.
*   **RED (Metaphysics):** Time Dilation, Dimensionality, Chaos, Order, Fate, Will, Soul, Mind.

### F. Evolutionary Coloring
Color in VEPA is now a direct indicator of genetic history and stability:
*   **Accretion (Mass-Weighted):** When particles merge, the survivor inherits a mass-weighted average of both parent colors.
*   **Offspring (Randomized Intermediary):** In sexual reproduction, offspring inherit a randomized value within the R,G,B range of both parents.
*   **The Variance Shift:** Offspring colors are further hue-shifted (perpendicular shift in color space) based on the magnitude of genetic mutations. A highly mutated offspring will appear color-shifted relative to its parents, providing a visual cue for evolutionary "leaps."

---

## 2. Advanced Interaction Laws

### The Three-Tier Reproduction System (REPRO)
When the `REPRO` law is active, species can propagate through three distinct channels:
1.  **Spontaneous Cloning:** Entities spontaneously produce offspring based on their `Birth Rate`. Offspring inherit DNA with slight drift.
2.  **Sexual Reproduction:** Colliding entities with compatible energy levels have a chance to breed (via `Sex Chance`). This blends DNA from both parents and produces a randomized intermediary color.
3.  **Mitosis (High-Energy Splitting):** Mature entities ($Energy > 90$, $Mass > 1.5$) will split into two, sharing their mass and energy. This is triggered by biological success.

---

## 3. Keeping a Large Dish Responsive

At larger populations, the deterministic solver uses a serialized Web Worker
when the host provides cross-origin isolation and SharedArrayBuffer. The worker
owns the spatial-grid and pairwise physics tick; the main thread continues to
render and only applies population, intelligence, and HUD work after a tick
completes. Law, DNA, and world-parameter edits are synchronized before the
next worker tick. Hosts without SharedArrayBuffer use the safe synchronous
fallback, so reducing `MAX INTERACTIONS` or `NEIGHBOR BUFFER` in
SETUP → WORLD → PERFORMANCE may be necessary.

Use `/bench-report/` to compare the default profile with all 128 laws across
full-stress populations. The per-law table reports standalone time separately
from “Saved if OFF”; leave-one-out values overlap when laws share neighbor and
clumping work, so those percentages are not expected to sum to 100%.

---

## 4. Evolutionary Pressure (Chaos Strategy)

The **CHAOS** system is your primary tool for "Forced Evolution."

*   **Rule Drifting:** By enabling chaos on **DNA Rules** only, you can find "Island States" of stability that you would never have tuned manually. If a stable structure forms during a chaos drift, immediately **Stop** the drift to "Fossilize" the laws.
*   **Selective Extinction:** Use a high **Death Rate** in the Biology tab combined with high **Mutation**. This creates a "Red Queen" race where only species that reproduce fast enough and mutate into stable configurations survive the baseline attrition.

---

## 5. The Collapse-Rebirth Cycle

Managing a **Singularity** (Black Hole) is an advanced architect's most dangerous task.

*   **The Star Forge:** A Black Hole is a recycling center. By tuning **Gravity Pull** and **Mass Gain**, you can pull in "Inert Slop" (gray particles). If you have **Fusion** enabled, the density at the core will eventually trigger a massive outward explosion (simulated via high repulsion at high mass), scattering high-energy matter back into the void.
*   **Event Horizon Tuning:** Use **Spread Radius** in the World tab to determine how "Hungry" your central gravity well is. A wide spread creates a galaxy-style spiral; a tight spread creates a feeding frenzy.

---

## 6. Troubleshooting the Universe

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **The "Slop" Effect** | Too much attraction, no damping. | Increase **Viscosity** or **Stiffness**. |
| **Thermal Explosion** | Forces are too high for the Sim Speed. | Lower **Sim Speed** or **Force**. |
| **Species Ghosting** | Alpha is too low. | Increase **Alpha (C2)** or **Glow Intensity**. |
| **Static Death** | No energy flow or motion. | Increase **Jitter**, **Birth Rate**, or **Sim Speed**. |

---

### "Do not just observe the emergence. Direct it."

---

## 📚 Further Research: The Encyclopedia

For those requiring a total technical breakdown of the engine's core constants, refer to the **Expanded Physics Encyclopedia**:

*   **[Batch 01: World Physics Core](./docs/expansion/batches/batch_01.md)**: count, G, dt, globalViscosity, spawnRate, temperature.
*   **[Batch 02: World Environment: Spatial](./docs/expansion/batches/batch_02.md)**: pressure, windX/Y/Z, dimX/Y (World Dimensions).

These volumes contain Advanced and Expert-level deep dives into implementation logic and emergent system behaviors.
