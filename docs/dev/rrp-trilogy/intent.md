# intent.md — "Three Worlds" · The E·F·A Trilogy of Trilogies

**Session:** RRP v1.3.0 (manual mode — no runtime CLI in repo) · U5 → U2/U1/U3 · 9 rounds · D2 · 5 questions/round
**Date:** 2026-08-18 · **Status:** Design complete, build order locked

## Goal
Three interleaved release sets — **E · Matter & Medium**, **F · Civilizations**, **A · Living World** — built on one shared substrate, shipping from **v8.2.0** with no fixed ladder (each release gets the next version when it lands).

## 1. Shared substrate (locked U5)
- **EventBus + one thin metrics-ring subscriber** — nothing else owns aggregate state; trends/events read the ring.
- Sequencing **interleaved**; release gates = syntax + vitest + build + manual visual check.
- **Determinism slice (locked R9):** the simulation **seed is captured in saves** (solver already takes an rng — SplitMix32).

## 2. Set E — Matter & Medium (`src/physics/fields.js`)
**Builds first: E.1 is v8.2.0** (R9 decision — A.2's isolation gate depends on it).
- **Vector fields** (direction + magnitude per cell), named fields allocated at world start; **every-tick** full-grid cadence; **generalized advection** (any vector field advects any scalar field).
- Particle coupling = **gradient force** (HISTORY-law precedent); **unified `writeField(cell, delta)` API** for laws / groups / player.
- **Walls = IMPASSABLE cell flag; biomes = field regions**; **portals** (teleporting cell-pair) + **gravity wells** (radial falloff) ship in E.1.
- Grid **auto-scaled with WORLD_SIZE + user-tunable** (GRID_DIM 12–24, default 16).
- **Hard collisions via the COLL law (R9):** the existing collision law becomes the opt-in hard-matter model (default off) — velocity-only response, particles impassable, penetrable only during ACCR/ALLOY/breeding merges + ghost laws (TUNNELING/ASTRAL/TELEPORT).

## 3. Set F — Civilizations (`src/state/groupRegistry.js`, group id → stride 68, role → 85)
- Groups **declared AND detected** (territory + shared memory + roles/hierarchy; registry also records emergent clusters); formation by **contact thresholds + DNA**; **leader/forager/builder roles**; **multi-species alliances**; **unbounded membership**.
- **Construction:** nests/hives + roads written into fields via the unified API; death by **membership collapse** (fission deferred — one-liner to add).
- **Full economy:** pairwise trade + group treasury + market prices on the grid.
- **Analytics:** live group overlay + network graph + economy Sankey.

## 4. Set A — Living World (DNA slot = taxon; extinct slots recycled)
- **Speciation:** `SPECIATION_THRESHOLD` divergence gate **accelerated by field isolation** (E fields create the barriers); **unrestricted** cadence (any qualifying species splits); parent keeps its slot, child claims an extinct-freed slot, **queue at cap**; visible **burst marker** at the split + optional newborn auto-select; **EXTINCT history** in the species panel.
- **Ecosystem analytics:** population curves + oscillation detection + biodiversity + **food-web graph** + **niche analysis**, in a new **ECO sub-tab** of the Data tab.
- **World events:** **metrics-triggered + physics-confirmed**; they **nudge laws/params through the undo ring** and **write E-field conditions** (droughts, blooms); feed the narrative journal.
- **Multiplex:** shards evolve species independently; fitness sees species count.

## Decisions log
| # | Decision | Choice |
|---|----------|--------|
| U5.1 | E representation | field module (grids, walls/biomes from cells) |
| U5.2 | F group state | group registry + stride 68/85 |
| U5.3 | A taxonomy | DNA slot = taxon, extinct slots reused |
| U5.4 | substrate | bus events + one metrics subscriber |
| U5.5 | sequencing | interleaved, no fixed ladder |
| U5.6 | grid | auto-scaled + tunable GRID_DIM |
| U5.7 | gates | syntax + tests + build + manual visual |
| U2.1 | group nature | declared AND detected |
| U2.2 | construction | nests/hives + roads |
| U2.3 | group death | membership collapse |
| U2.4 | economy | trade + treasury + market prices |
| U2.5 | analytics | overlay + network graph + Sankey |
| U2.6 | formation | contact thresholds + DNA |
| U2.7 | roles | leader + forager + builder |
| U2.8 | membership | multi-species alliances, unbounded |
| U1.1 | field semantics | vector fields |
| U1.2 | coupling | gradient force |
| U1.3 | walls/biomes | IMPASSABLE flag + field regions |
| U1.4 | collisions | hard by default (COLL law), velocity-only |
| U1.5 | exotic space | portals + wells in E1 |
| U1.6 | write API | unified writeField |
| U1.7 | cadence | every tick |
| U1.8 | field coupling | generalized advection |
| U1.9 | bypasses | merges + ghost laws |
| U3.1 | speciation trigger | threshold gated by isolation |
| U3.2 | slot policy | parent keeps, child takes extinct slot, queue |
| U3.3 | analytics scope | full (curves + food-web + niche) |
| U3.4 | events | metrics-trigger + physics-confirm |
| U3.5 | event power | undo-ring nudges + field writes |
| U3.6 | split cadence | unrestricted |
| U3.7 | split feedback | burst marker (+ optional auto-select) |
| U3.8 | extinctions | journal + EXTINCT history, slots reused |
| U3.9 | analytics home | ECO sub-tab in Data |
| U3.10 | multiplex | shards evolve independently |
| R9.1 | build order | E.1 first (v8.2.0) |
| R9.2 | determinism | seed captured in saves |
| R9.3 | artifacts | write to docs/dev/rrp-trilogy/, commit with next release |
| R9.4 | cadence | full RRP per set before each set's releases |
| R9.5 | collision rollout | COLL law as the opt-in hard-matter toggle |

## Risks
1. **COLL-as-hard-matter** touches the solver core — velocity-only response must be tuned against MAX_FORCE/MAX_VELOCITY + substeps to avoid tunneling.
2. **Speciation slot queue** — splits back up if all 64 species are live; slot recycling keeps it rare.
3. **Scalar fields** (THERMAL/INFO) vs the vector-field choice — scalar rides as field magnitude (resolved in E.1).
4. **Group construction griefing** — nests/roads writing into fields needs sanity caps.
5. **Event storms** — hybrid confirm gate + undo-ring nudges keep events bounded and reversible.

## Out of scope (shelved)
- Set D (Deep Time) — only the determinism slice (seed in saves) survived; time manipulation/epochs deferred.
- Fission (group reproduction) — one-line add if wanted.
- Golden-run tick-trace tests (gates R9 excluded them).
