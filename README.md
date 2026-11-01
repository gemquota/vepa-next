# 🌌 VEPA4: Vector Emergent Physics Automata

**Integrated Intelligence** — the intelligence engines are alive.

## Versioning & Commits

- **Product:** **VEPA4**; versions use **`major.minor.build`** (npm-semver-native) —
  current: **9.1.2** (legacy label `4.9.5`). Retroactive mapping of the v4 line:
  old `4.M.N` → `M.N.0`; see `CHANGELOG.md` and `AGENTS.md` §10.4.
- **Commits:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
  — `<type>(<scope>): <description>`, release commits `chore(release): v7.0.0`,
  tags `v7.0.0`.

VEPA4 is the next major version of the emergent physics simulation. It forks
the v3 modular recreation and completes the integration gap identified in the
2026-08-01 workspace audit: the five intelligence engines (Insight, Narrative,
Lineage, Goal, Timeline) are now wired into the simulation loop, the
communication DNA group drives real physics, and predation is restored as an
explicit law.

## Quick Start

```bash
npm install
npm run dev    # Dev server with COOP/COEP headers
npm run build  # Production build
npm test       # Unit tests (88 files / 870 tests; see current pass/fail output)
npm run spec:generate # Generate the hierarchical docs/spec tree
npm run spec:check    # Fail when generated specifications drift
```

## Deployments

| Platform | URL | Notes |
|----------|-----|-------|
| Vercel (production) | https://vepa-v4.vercel.app/ | COOP/COEP headers served — `SharedArrayBuffer` enabled; true memory model |
| GitHub Pages | https://gemquota.github.io/vepa/vepar/ | No COOP/COEP on Pages — runs ArrayBuffer fallback |
| Vercel (historical Seven deployment) | https://vepa-seven.vercel.app/ | Later v8.16-era deployment recorded in `CHANGELOG.md`; not the current repository-root production URL |

Vercel deploys from the repo root using `vercel.json` (static build, root base,
COOP/COEP headers). GitHub Pages previously deployed via `.github/workflows/deploy.yml`
(base `/vepa/vepar/`); that workflow was archived with the legacy trees on
2026-08-10 — re-add it with a root layout (base `/vepa/`) when Pages deploys
are wanted again. The vite base switches on `VERCEL=1`.

### Run from anywhere

The repo-root launcher `./vepa4` works from any directory (no `cd` needed):

```bash
/path/to/vepa-feature-nuclear-rewrite/vepa4 dev      # start dev server (port 5180)
/path/to/vepa-feature-nuclear-rewrite/vepa4 dev 8080 # custom port
/path/to/vepa-feature-nuclear-rewrite/vepa4 build    # production build
/path/to/vepa-feature-nuclear-rewrite/vepa4 preview  # serve the build
/path/to/vepa-feature-nuclear-rewrite/vepa4 test     # unit tests
/path/to/vepa-feature-nuclear-rewrite/vepa4 syntax   # node --check all JS
/path/to/vepa-feature-nuclear-rewrite/vepa4 bench    # headless solver benchmark (--laws / --all / --json)
```

The exhaustive technical specification tree is generated under [`docs/spec/`](docs/spec/README.md). It separates architecture, UI (`general`, `appearance`, `function`, and surfaces), simulation (`solver`, fields, lifecycle, and similar concepts), state, law records, source inventory, testing, operations, traceability, and review findings. Regenerate it with `npm run spec:generate`; use `npm run spec:check` in verification or CI. The generated tree describes the current source contracts; it is not a substitute for the runtime test result.

The launcher can also be installed as a global command in Termux
(`/data/data/com.termux/files/usr/bin/vepa4` → repo `vepa4`), so plain
`vepa4 dev` works from any directory. If the requested port is busy it
auto-picks the next free one and opens your browser when ready. Remove the
global command with `rm /data/data/com.termux/files/usr/bin/vepa4`.

## Current capabilities and historical additions

The original v4 features remain part of the product, while the later v8/v9 additions below document capabilities added after the initial integrated-intelligence release. Some expensive systems run on controlled cadences rather than every render tick, and some features are optional or configuration-gated.

- **Intelligence engines live** — cluster detection, multi-voice narrative,
  lineage genealogy, goal self-tuning, and timeline record/scrub are wired into
  the simulation loop and publish to the World Intelligence Dashboard. Expensive
  metrics and social passes use controlled cadences rather than running fully on
  every tick.
- **Communication DNA works** — particles emit oscillator pulses and exchange
  channel-filtered signals (TUNING_CH1-4 bandpass), with response forces,
  energy feed, and memory accumulation.
- **PREDATION law** restored as a proper toggle (index 51).
- **Sparse large world** — the default configuration supports 250 particles per
  species over a 2000³ torus with world-size-scaled gravity; the actual boot
  population depends on the configured species count.
- **Camera fixed** — the default view fits the whole world without the
  stretched/far-away distortion, particles keep a minimum 1.5px size so they
  never vanish, and zooming preserves depth.
- **Drawer minimize** — a dedicated `▁` button in the tab bar collapses the
  bottom drawer to a strip (`▔` restores it).
- **The dish is a field (v8.2)** — SETUP > WORLD > ENVIRONMENT gains a MEDIUM
  subgroup: WIND/THERMAL/EM/INFO field sliders, gravity wells, paired portals,
  and wall presets (border/ring/cross) that become impassable hard matter while
  the COLL law is on.
- **Civilizations (v8.3)** — groups emerge and build: dense communicative
  clusters become groups (declared or detected) with leader/forager/builder
  roles and multi-species membership; they build nests/hives + roads into the
  field grid, trade treasury between close neighbours (market prices written
  onto the INFO field), and collapse when membership dies. Watch it all in
  DATA > 🏙️ CIVILIZATIONS: territory overlay, network graph, economy Sankey.
- **A living world (v8.4)** — species diverge: when a species' isolation
  (spread + wall pinning in the E fields) exceeds its SPECIATION_THRESHOLD, a
  third of its members split into a new species that claims an extinct-freed
  slot (queued at the 64-slot cap). DATA > 🌿 ECO tracks population curves,
  biodiversity, oscillation, the food-web and niches; world events (famine /
  bloom / collapse) are metrics-triggered, physics-confirmed, and respond
  reversibly through the undo ring + field writes. Multiplex shards now
  evolve their species independently.
- **Performance knobs (v8.5)** — SETUP > WORLD > PERFORMANCE exposes the
  solver's interaction budget live: AUTO-TUNE, GRID RESOLUTION, CELL PARTICLE
  CAP, MAX INTERACTIONS and NEIGHBOR BUFFER. Lowering MAX INTERACTIONS can
  improve dense-world performance at the cost of truncated pair physics; the
  effect depends on population density and active laws. The benchmark runner
  includes matrix and knob sweeps in its normal full-report mode.
- **Performance overhaul (v8.15.1)** — AUTO-TUNE (on by default) scales the
  spatial-grid resolution with population density (current solver formula:
  `dim ≈ ∛(N/1.4)`, clamped to 12–64) to reduce dense-world pair work. The
  gravity/affinity/stigmergy hot path is allocation-free and the time-dilation
  buffer is reused across ticks. Historical benchmark numbers vary by release,
  active-law set, hardware, and population.
- **Worker physics + benchmark report (v8.16.2)** — when SharedArrayBuffer is
  available, the deterministic solver can run in a serialized Web Worker while
  the main thread renders. Law, DNA, and world-parameter changes are
  synchronized to the worker; incompatible hosts retain the main-thread
  fallback. `vepa4 bench` reports default and all-law scaling, worker response
  overhead, per-law rows, and matrix/knob sweeps at `/bench-report/`.
- **Deep Time (v8.6)** — the world remembers: SETUP > WORLD > TIME adds TIME
  SPEED (0.1–10×, a real solver-dt change), EPOCH LENGTH, and extinction /
  recovery thresholds. Eras advance on the epoch boundary with full-world
  snapshots you can restore; population collapse and rebound are detected,
  journaled, and answered reversibly with drought / fertilization field
  writes. The benchmark report SPA now serves at `/bench-report/`.
- **Memory & Culture (v8.7)** — learned traits outlive the particles that
  learned them: per-species and per-group memory buffers persist across
  generations. Child species inherit their parent's culture on speciation,
  groups blend their members' memories into a collective, and each species'
  memory adapts to energy, density and extinction epochs.
- **Stellar Physics (v8.15)** — the dish scales to the cosmos (opening the
  O·P·Q trilogy, "The World Goes Cosmic"): dense cells where mass + energy
  converge can seed **stars** that fuse accreted mass into radiant THERMAL/INFO
  plus a warm ENERGY feed; past BLACK HOLE HORIZON they can collapse into
  accreting, Hawking-emitting **black holes**; past SUPERNOVA MASS they can
  **detonate** with a radial shockwave and bounded exotic heavy-element seeding.
  The controls live under SETUP > WORLD > MATTER > STELLAR. The source supports
  a rich configurable substrate and the population cap is **100,000 particles**.
- **Quantum Macroscale (v8.14)** — particles go non-classical (build 3,
  **closing** the L·M·N physics frontier): slow, isolated particles hold a
  deterministic second position state that collapses to one branch on the
  first interaction (speed burst, neighbour, or lifetime), superposed pairs
  entangle across distance — sharing ENERGY and momentum, measuring one
  collapses both — high-ENERGY particles tunnel through impassable walls
  (probability × energy gate), and species with high SELECTION_SENSITIVITY /
  REGULATORY_DEPTH DNA collapse nearby superpositions by observing them.
  SETUP > WORLD > MATTER > QUANTUM.
- **Relativity (v8.13)** — space curves, time slows, mass becomes energy
  (build 2 of the L·M·N physics frontier): a mass-warped CURVATURE field
  makes the INFO signal medium lens toward dense regions (conserved), fast
  particles age and starve slower (velocity time dilation, bounded), and
  surplus ENERGY condenses to MASS / scarce ENERGY converts MASS back
  (E = mc², rate-gated). SETUP > WORLD > MATTER > RELATIVITY.
- **Exotic Matter (v8.12)** — the substrate transforms (first build of the
  L·M·N physics frontier, opening the second 3×3 trilogy³): SETUP > WORLD >
  MATTER > EXOTIC seeds deterministic exotic zones on the field grid
  (ANTIMATTER / DARK / STRANGE / NEGATIVE). Antimatter annihilates with
  normal matter into conserved energy bursts, dark matter dims and
  self-powers, strange matter contagiously converts neighbours (mass-gain),
  and negative mass repels from mass concentrations.
- **Infrastructure & Energy (v8.11)** — civilizations power the dish:
  groups harvest ambient field energy into treasury (conserved), allied
  grids feed member energy along the alliance, and era-progressed
  mega-structures (WALL / BRIDGE / HUB) complete on a treasury investment
  cadence. This closes the I·J·K trilogy — the literal third trilogy of the
  3×3 trilogy³ (E·F·A exists · D·G·H remembers & acts · I·J·K builds).
- **Society & Governance (v8.10)** — civilizations govern: every group derives
  an AGGRESSION / OPENNESS / MIGRATION policy from member memory + treasury;
  similar neighbors ally (shared treasury pool), opposed neighbors conflict at
  the border (cooldown-gated); policy drives raids, commerce and dispersal.
- **Tools & Artifacts (v8.9)** — civilizations build: per-group TOOL / WEAPON /
  BARRIER inventories crafted from treasury, decaying under maintenance;
  tools pay an income dividend, weapons damp threat memory, barriers write
  impassable walls at the territory edge (SETUP > WORLD > SOCIETY).
- **Agency & Narrative (v8.8)** — the story acts: the Narrative Consciousness
  gains bounded, reversible hands (rescue nudges, field fertilization /
  cooling) through the undo ring, species memory becomes goal-driven behavior
  (flee threats / seek resources), and once-only world milestones are
  journaled as they emerge. The D·G·H trilogy is complete.

## Architecture

```
src/
├── core/           # EventBus, PRNG
├── state/          # ParticleBuffer, LawState, RuntimeConfig, Presets
├── dna/            # DNABuffer, Expression (phenotype)
├── physics/        # SpatialGrid, Laws (+signal system), Synergy, Solver
├── render/         # Canvas2D Renderer, SpriteSync
├── ui/             # HUD, Law/World/Intel/Species/DNA/Narrative panels
├── engines/        # Insight, Narrative, Goal, Lineage, Timeline (wired)
├── worker/         # Physics Web Worker (fallback path)
├── constants.js    # All indexes, ranges, defaults, LAW_HELP_DB
└── main.js         # Bootstrap, orchestration, engine wiring
```

## Debug Overlay

A collapsible **DEBUG** panel sits top-left and logs everything since the page
started. Tap its header (or `⧉ COPY`, or `SETTINGS → DEBUG → COPY LOG`) to copy
the full log as one JSON object. Hide/show it from `SETTINGS → DEBUG`; the
choice persists.

## Docs

- `SPEC.md` — feature specification for v4
- `PLAN.md` — implementation plan
- `CHANGELOG.md` — version history
- `../audit/FULL_AUDIT_2026-08-01.md` — the audit that scoped this release
