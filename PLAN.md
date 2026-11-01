# Implementation Plan: VEPA4 — Integrated Intelligence

**Date**: 2026-08-26 | **Status**: Complete | **Spec**: `SPEC.md`

> **Standards (2026-08-10):** product **VEPA4**, versions `major.minor.build`
> (current `9.1.2`; legacy v4-line mapping old `4.M.N` → `M.N.0`), commits
> Conventional Commits 1.0.0 — see `AGENTS.md` §10.4.

## Milestone note (v9.1.2 — 2026-08-26)

- Added `scripts/generate-spec.mjs`, a deterministic Node procedure that extracts live constants, category/law metadata, source structure, UI/simulation/state boundaries, test and audit evidence, and duplicate-concept review data.
- Generated `docs/spec/` as a hierarchical tree with cross-cutting documents, category/law records, module records, a manifest, and byte-for-byte `spec:check` drift detection.

## Steps

1. **Audit** — verified current v3 state against the stale 2026-07-29 audit;
   identified real gaps: engines unwired, PREDATION law missing, comm-DNA inert,
   no lineage anchors. → `audit/FULL_AUDIT_2026-08-01.md`
2. **Backup** — `backup/pre-vepa4-20260801` git branch (commit `a341d2b`,
   captured the dirty working tree incl. sparse-world WIP) + file snapshot
   `v3-backup/pre-vepa4-20260801/`.
3. **Fork** — `cp -r v3 v4`; merged the sparse-world/larger-world WIP from the
   backup branch into v4; bumped to `vepa-v4` 4.0.0.
4. **Constants** — added `PREDATION: 51` (+`LAW_COUNT=52`), biology category
   membership, `LAW_HELP_DB` 4-tier entry.
5. **Signals** — rewrote `applySignalDecay` (unconditional pulse + decay +
   memory decay), added `applySignalExchange` + `channelMatch` in `laws.js`;
   added `runtimeConfig.signalScale`.
6. **Solver** — wired signal exchange into the pairwise loop, PREDATION
   dispatch under its own bit, force-scale/clamp knobs, global drag multiplier,
   REPRO/LIFE synergy scaling, and `parentId` in offspring payloads.
7. **Engine wiring** — imported and instantiated all five engines in `main.js`;
   added `updateIntelligence()` (insight, narrative, lineage death-scan,
   timeline recording, goal evaluation), `computeMetrics()`, `wireGoalEvents()`
   (goal application + timeline record/scrub/clear), `resetIntelligence()`.
8. **UI** — new `src/ui/intelPanel.js` (clusters, births/deaths, lineage depth,
   snapshots, REC toggle, scrub slider, goal log) rendered into `#world-intel`
   in the WORLD tab; CSS added.
9. **Tests** — `tests/unit/engines.test.js` (insight cluster detection +
   trend, lineage stats, timeline snapshot/scrub, goal adjustments) and
   `tests/unit/signal.test.js` (pulse, propagation, channel filtering);
   vitest timeout 15s.
10. **Docs** — v4 `README.md`, `SPEC.md`, `PLAN.md`, `CHANGELOG.md`; root
    `CHANGELOG.md`/`README.md` pointer notes.

## Validation

```bash
cd v4
find src tests -name '*.js' -exec node --check {} +   # syntax
npm test                                              # 39/39 pass
npx vite build                                        # clean bundle
```

## Risks & Notes

- WORLD_SIZE 2000 × 250 particles is intentionally sparse; gravity scales with
  world size so structure still forms. Watch cluster density when tuning
  insight defaults.
- Timeline snapshots are raw buffer copies; with recording on and large
  populations, memory grows (20 snapshots × buffer). REC is off by default.
- Main-thread physics remains the compatibility fallback; deterministic worker mode is active when SharedArrayBuffer is available.

## Milestone note (v4.6.24 — 2026-08-07)

- **Chaos Multiplex expansion** implemented: world import on exit (`copyShardToWorld`),
  a 14-metric weighted fitness engine (`computeShardMetrics` / `getFitnessReport`), LIVE/FIT
  drawer tabs with per-aspect variation, POP SCALE, SEED, SUBSTEPS, AFTER ITERATE
  (NONE/FITTEST/FOLLOW), KEEP SELECTED, and IMPORT ON EXIT. See `v4/CHANGELOG.md` [4.6.24]
  and `docs/mechanics/chaos_multiplex.md` §4.

## Milestone note (v4.6.25 — 2026-08-07)

- **GPU performance & multiplex metrics drawer**: zero-copy particle views
  (`asParticleView`) on the main + multiplex render paths, DPR caps (main 2×, previews
  1.25×), ECO render mode (no grid/halo) with a live GPU ECO toggle in the LIVE tab, and
  a collapsible metrics bottom drawer with per-shard fitness chips and an
  ALIVE/CAP/ΔSEL/ΔAVG/ITER stats line. See `v4/CHANGELOG.md` [4.6.25] and
  `docs/mechanics/chaos_multiplex.md` §5.

## Milestone note (v4.6.26 — 2026-08-07)

- **Solver performance**: per-tick synergy cache (`createSynergyCache`) + active-law
  byte cache in `solve()` cut per-particle/pair branch chains, delivering 2.8–5× solver
  throughput (benchmarked: 2500 particles 428.7 → 103.6 ms/tick on the default law set).
- **`vepa4 bench`** headless harness (throughput / per-law / all-law stress / JSON).
- **Debug perf stats** in the debug overlay (f/t/r ms) and `· MS` in the multiplex
  metrics drawer. See `v4/CHANGELOG.md` [4.6.26].

## Milestone note (v8.16.2 — 2026-08-22)

- **Deterministic worker execution:** the live solver now uses the existing
  physics worker over SharedArrayBuffer when available, with one serialized
  request in flight and completion-driven population/intelligence updates.
  Law, DNA, and world-parameter edits resync before the next tick; the
  synchronous solver remains the compatibility fallback.
- **Exhaustive benchmark report:** full-stress scaling compares the default
  ten-law profile with all 128 laws on both execution paths, including worker
  response overhead, an all-128 per-law sweep, and restored matrix/knob views.
  The SPA labels overlapping leave-one-out attribution explicitly.

## Milestone note (v8.15.1 — 2026-08-19)

- **Performance overhaul (hotfix rebuild of 8.15.0):** `AUTO_TUNE` world param
  (PERFORMANCE, default on) scales the spatial-grid resolution with particle
  density (dim ≈ ∛(N/1.4), floored at the classic 12³) so the neighbour gather
  and total pairwise work stay ~flat as N grows instead of exploding. The
  gravity/affinity/stigmergy pairwise path is allocation-free (scratch `out`
  objects) and the per-tick `localDt` buffer is reused. Headless scaling curve
  re-measured: 10k 146→60 ms/tick, 25k 932→154 ms/tick, 100k ~8.1 s→0.91 s —
  ~6× at 25k, ~9× at 100k, μs/particle ~flat. See `CHANGELOG.md` [8.15.1].

## Milestone note (v8.15.0 — 2026-08-19)

- **Set O — Stellar Physics** (build 1, OPENING the RRP O·P·Q trilogy —
  "The World Goes Cosmic"): a deterministic stellar substrate pass
  (`src/state/stellar.js`) seeds **stars** where particle mass + energy
  converge (E=mc² from Set M pays off), fuses their accreted mass into
  radiant THERMAL/INFO + a warm ENERGY feed, collapses them into
  **black holes** past BLACK HOLE HORIZON (wider accretion, no radiant
  feed, slow Hawking re-emission), and **detonates** them past SUPERNOVA
  MASS — a radial shockwave (scatter + damage) + exotic heavy-element
  seeding + a remnant on cooldown. New MATTER > STELLAR world-param
  subgroup (7 knobs). No new laws (128/128 budget — decision O.1).
- **Rich prime substrate:** PRIME_DEFAULT gains COMMS / LEARN / CULTURE /
  AFFINITY / STIGMERGY so groups, hebbian learning, cultural transmission,
  communication and speciation are live from first boot; a boot overlay
  (`applyPrimeWorldConfig`) turns on thermal + info fields (0.5 each),
  3 gravity wells and 4 clustered spawn centres — kept out of
  `WORLD_PARAM_DEFS` defaults so the audit suite's neutral baseline is
  untouched.
- **Population cap 2,500 → 100,000:** `MAX_PARTICLES` raised; WORLD-panel
  caps follow (PARTICLE COUNT / MAX POP 100k, INITIAL POP 50k, NEIGHBOR
  BUFFER 32,768); the renderer culls off-screen particles (perf overhaul).
  Benchmark scaling curve regenerated to 100k (`/bench-report/`). See
  `CHANGELOG.md` [8.15.0].

## Milestone note (v8.14.1 — 2026-08-19)

- **Hotfix (blank-canvas regression):** the dish renders again. Set J/K's
  `runGovernance` / `runInfrastructure` calls passed one argument too many,
  so `getFields()` landed in the `opts` slot and threw `Cannot read
  properties of null (reading 'force')` every frame once the v8.11.1 boot
  fix enabled laws — killing the frame's render before `syncSprites` and
  leaving an empty canvas. Calls corrected to the 5-param signatures, and
  `updateIntelligence()` is now a guarded wrapper so a bad pass can never
  blank the canvas again. Browser-verified: ~6,000 lit pixels, zero page
  errors. See `CHANGELOG.md` [8.14.1].

## Milestone note (v8.14.0 — 2026-08-19)

- **Set N — Quantum Macroscale** (build 3, CLOSING the RRP L·M·N trilogy —
  the physics frontier is complete): slow, isolated particles enter a
  deterministic superposition (`src/state/quantumMacro.js`) — a hash-offset
  alternate position that collapses to one branch on the first interaction
  (neighbour within radius, speed burst, or lifetime expiry); superposed
  pairs entangle macro-style through the existing stride 75–76 offsets
  (sharing ENERGY across distance, momentum drag, measurement collapses
  both — breaks cleanly if the ENTANGLEMENT law takes the offsets over);
  high-ENERGY particles tunnel through impassable wall bands (probability ×
  energy gate, energy cost); and species with high SELECTION_SENSITIVITY /
  REGULATORY_DEPTH DNA observe, collapsing nearby superpositions. New
  MATTER > QUANTUM world-param subgroup (8 knobs). No new laws (128/128
  budget — decision N.1). The L·M·N trilogy is complete — the second 3×3 of
  the trilogy³ lifecycle moves to O·P·Q ("The World Goes Cosmic", from
  v8.15.0): stars/black holes/supernovae, synthetic life + uploaded
  consciousness, and the multiplex as an interacting multiverse. See
  `CHANGELOG.md` [8.14.0].

## Milestone note (v8.13.0 — 2026-08-19)

- **Set M — Relativity** (build 2 of the RRP L·M·N trilogy — the physics
  frontier): a mass-warped CURVATURE scalar field (`src/physics/fields.js`
  + `src/state/relativity.js`) buckets particle mass into the grid (SET
  semantics, bounded); the INFO signal medium lens-toward curvature peaks
  (gravitational lensing, exactly conserved); fast particles age and starve
  slower (velocity time dilation on AGE/HUNGER, γ = √(1 − (v/c)²), bounded
  by TIME DILATION MAX — the gravitational dilation term stays with the
  TIME_DILATION law, no double-dilution); and E = mc² converts surplus
  ENERGY ↔ MASS (rate-gated, mass capped below the star-collapse
  threshold). New MATTER > RELATIVITY world-param subgroup. No new laws
  (128/128 budget — decision M.1). Arc #2: L·M·N the substrate transforms →
  O·P·Q the world goes cosmic → R·S·T it completes. See `CHANGELOG.md`
  [8.13.0].

## Milestone note (v8.12.0 — 2026-08-19)

- **Set L — Exotic Matter** (build 1, OPENING the RRP L·M·N trilogy — the
  fourth trilogy, starting the second 3×3 trilogy³: the physics frontier):
  the field grid gains an EXOTIC scalar (`src/physics/fields.js`) whose
  magnitude encodes zone kind (1 ANTIMATTER, 2 DARK, 3 STRANGE, 4 NEGATIVE);
  `src/state/exoticMatter.js` seeds zones deterministically (no PRNG),
  tags particles with a parallel per-particle matter state (half-life
  persistence), and applies conserved annihilation bursts, dark-matter
  ghosting (dim + self-powered), contagious strange conversion (mass-gain,
  capped), and negative-mass anti-gravity nudges. New MATTER > EXOTIC
  world-param subgroup. No new laws (128/128 budget — decision L.1).
  Arc #2: L·M·N the substrate transforms → O·P·Q the world goes cosmic →
  R·S·T it completes (designs in `docs/dev/rrp-trilogy-4/5/6/`).
  See `CHANGELOG.md` [8.12.0].

## Milestone note (v8.11.0 — 2026-08-18)

- **Set K — Infrastructure & Energy** (build 3, COMPLETING the RRP I·J·K
  trilogy — the literal third trilogy, closing the 3×3 trilogy³): resource
  extraction (`src/state/infrastructure.js`) turns ambient INFO/THERMAL
  field energy into treasury (conserved — the field loses what the treasury
  gains); allied energy grids feed member ENERGY from the treasury; and
  era-progressed mega-structures (WALL / BRIDGE / HUB) complete on a
  MEGA_INVEST cadence with hard write caps. SOCIETY > ENERGY knobs join the
  accordion. Arc: E·F·A the world exists → D·G·H it remembers & acts → I·J·K
  it builds. See `CHANGELOG.md` [8.11.0].

## Milestone note (v8.10.0 — 2026-08-18)

- **Set J — Society & Governance** (build 2 of the RRP I·J·K trilogy):
  per-group policy vector (`src/state/governance.js`) derived from Set G
  member memory + F.3 treasury (aggression / openness / migration, blended at
  POLICY_SHIFT); close groups with similar policy ally and pool treasuries,
  opposed groups conflict at the border (negative INFO writes + threat-memory
  nudges, cooldown-gated); policy drives bounded raids, commerce income and
  dispersal nudges. SOCIETY > GOVERNANCE knobs join the accordion. See
  `CHANGELOG.md` [8.10.0].

## Milestone note (v8.9.0 — 2026-08-18)

- **Set I — Tools & Artifacts** (build 1 of the RRP I·J·K trilogy — the literal
  third trilogy completing the 3×3 trilogy³; design in
  `docs/dev/rrp-trilogy-3/`): per-group artifact registry
  (`src/state/artifacts.js`) — TOOL / WEAPON / BARRIER inventories crafted
  from treasury by builders, decay under maintenance, and act through the
  existing substrate: TOOL dividends into the treasury, WEAPON dampens the
  group THREAT memory (Set H.2 flee), BARRIER writes impassable wall cells at
  the territory edge via the new `writeWall` API. The new SOCIETY world-param
  group (SETUP > WORLD) hosts CRAFT COST + ARTIFACT DECAY and grows across
  the trilogy. See `CHANGELOG.md` [8.9.0].

## Milestone note (v8.8.0 — 2026-08-18)

- **Set H — Agency & Narrative** (build 3, completing the RRP D·G·H trilogy):
  the narrative actor (`src/engines/agencyEngine.js`) takes bounded,
  undo-able actions (rescue nudges + field writes) on a cadence; species
  memory drives goal behavior (`src/engines/goalBehavior.js` — flee / seek /
  hold velocity nudges); once-only world milestones are detected and
  journaled. See `CHANGELOG.md` [8.8.0].

## Milestone note (v8.7.0 — 2026-08-18)

- **Set G — Memory & Culture** (build 2 of the RRP D·G·H trilogy): persistent
  per-species / per-group memory buffers (`src/state/memoryBuffers.js`) outlive
  particles and generations; child species inherit parent culture on
  speciation, groups blend member memories into a collective, and species
  memory adapts to energy / density / extinction-epoch conditions, decaying
  without rehearsal. See `CHANGELOG.md` [8.7.0].

## Milestone note (v8.6.0 — 2026-08-18)

- **Set D — Deep Time & Epochs** (build 1 of the RRP D·G·H trilogy; design in
  `docs/dev/rrp-trilogy-2/`): the world advances through named eras on a tick
  boundary (`src/engines/epochEngine.js`) with restorable full-world snapshots
  (capped at 16); extinction / recovery are threshold-gated population deltas,
  answered reversibly via undo checkpoint + INFO field writes. The new TIME
  world-param group exposes TIME SPEED (live `runtimeConfig.simSpeed`), EPOCH
  LENGTH, and the two thresholds. The benchmark SPA now serves from
  `public/bench-report/`. See `CHANGELOG.md` [8.6.0].

## Milestone note (v8.5.0 — 2026-08-18)

- **Performance knobs**: the spatial-grid resolution / per-cell cap / neighbour
  gather cap (`src/physics/spatialGrid.js`) and the pair-interaction budget
  (`src/physics/solver.js`) are now runtime-tunable from a new SETUP > WORLD >
  PERFORMANCE accordion (`MAX_INTERACTIONS`, `NEIGHBOR_BUF`, `GRID_DIM`,
  `CELL_CAP`). `bench/solver.bench.mjs --knobs` sweeps the
  MAX_INTERACTIONS × NEIGHBOR_BUF matrix (median-of-rounds). Measured: ~30%
  throughput at 10k particles by lowering MAX_INTERACTIONS 500 → 100. See
  `CHANGELOG.md` [8.5.0].

## Milestone note (v8.4.0 — 2026-08-18)

- **Set A — Living World** (build 3, completing the E·F·A trilogy): DNA-slot
  speciation (`src/engines/speciation.js`) splits qualifying species under the
  SPECIATION_THRESHOLD × field-isolation gate, children claim extinct-freed
  slots (queue at cap), with burst/extinction events; the ECO sub-tab
  (DATA > 🌿) shows population curves, biodiversity, oscillation, food-web and
  niches via the metrics ring (`src/engines/ecoEngine.js`); world events
  (`src/engines/worldEvents.js`) are metrics-triggered + physics-confirmed and
  respond through undo-ring checkpoints + field writes; multiplex shards now
  evolve species independently. See `CHANGELOG.md` [8.4.0].

## Milestone note (v8.3.0 — 2026-08-18)

- **Set F — Civilizations** (build 2 of the RRP E·F·A trilogy): the group registry
  (`src/state/groupRegistry.js`) brings declared + detected groups with
  leader/forager/builder roles, unbounded multi-species membership (stride
  GROUP_ID 96 / GROUP_ROLE 97), and collapse death; construction
  (`src/state/construction.js`) writes nests/hives + roads into the E.1 field
  grid with griefing caps; the economy (`src/state/economy.js`) adds treasury,
  pairwise trade and grid market prices; DATA > 🏙️ CIVILIZATIONS shows the
  territory overlay, network graph and economy Sankey. See `CHANGELOG.md` [8.3.0].

## Milestone note (v8.2.0 — 2026-08-18)

- **Set E.1 — Matter & Medium** (first build of the RRP E·F·A trilogy; design in
  `docs/dev/rrp-trilogy/`): the dish becomes a field — `src/physics/fields.js` adds a
  coarse 3D field grid (12³–24³, auto-scaled) with vector (WIND/EM) + scalar
  (THERMAL/INFO) fields, COLL-gated impassable walls (hard-matter toggle), gravity
  wells, and paired portals; 11 new MEDIUM world sliders; gradient-force coupling,
  generalized advection, and the unified `writeField` API. See `CHANGELOG.md` [8.2.0].
