# AGENTS.md — VEPA Workspace Initialization & Codebase Audit

> **Project:** VEPA — Vector Emergent Physics Automata
> **Active Target:** **VEPA4 v9.1.1** (legacy label `4.8.17`; HEAD `42c5a5f`, 2026-08-22 — v8.16.2 is the deterministic worker + exhaustive benchmark release, committed and tagged; Set P "Synthetic Life" (O·P·Q build 2): non-DNA synthetic organisms born from advanced HUBs (8 archetype programs), species intelligence-threshold uploaded consciousness, machine groups in the F.1 registry; stride offsets 98–99 claimed; plus per-law solver profiling (persistent content-addressed law caches, saved neighbour list, bench-mode timing) and main-thread cadence throttles that fix UI lag at high population; v8.15.1 = perf overhaul (density-scaled AUTO_TUNE grid + allocation-free pairwise hot path, ~9× at 100k); v8.15.0 = Set O "Stellar Physics" (O·P·Q build 1): stars fuse accreted mass into radiant output, collapse to black holes past the horizon (Hawking re-emission), detonate as supernovae past the mass cap (shockwave + exotic element seeding); plus the rich PRIME_DEFAULT substrate (COMMS/LEARN/CULTURE/AFFINITY/STIGMERGY + thermal/info fields + gravity wells + clustered spawn) and `MAX_PARTICLES` 2500→100000 with a renderer off-screen cull; **RRP trilogies** (E·F·A: E.1 v8.2.0 @ `eae1f58` · F v8.3.0 @ `d70ad1b` · A v8.4.0 @ `1e5eead`; D·G·H: D v8.6.0 · G v8.7.0 · H v8.8.0; I·J·K: I v8.9.0 · J v8.10.0 · K v8.11.0 — **complete**; L·M·N: L v8.12.0 · M v8.13.0 · N v8.14.0 — **complete** — O·P·Q: O v8.15.0 · P v8.16.0 **complete** — Q v8.17.0 next); designs in `docs/dev/rrp-trilogy/` + `docs/dev/rrp-trilogy-2/` + `docs/dev/rrp-trilogy-3/` + `docs/dev/rrp-trilogy-4/5/6/` (O·P·Q + R·S·T designs locked — the full 18-set lifecycle))
> **Layout:** the `` tree was promoted to the repo root on 2026-08-10 (legacy trees
> archived into `gemquota/vepa-archive`); ALL paths below are root-relative.
> **Working Branch:** `freebuff/changes-a58d34pq`
> **Audit Hash:** `AGENTS_SYNC_v9.1.1_2026-08-26`
>
> This file is the canonical initialization prompt for any agent entering this workspace. It contains the codebase audit, architectural SSOT, conventions, and operational workflows. All agents **must** read this file first before any code modification. Version control is **strict** — read §10.4 (Version History Control Protocol) before any changelog edit or deploy.
>
> ⚠️ **Live workspace:** concurrent agent sessions commit releases frequently (4.6.11 → 4.6.18 all landed on 2026-08-06; the 4.6.19+ DNA-64 / law-RRP / multiplex WIP is uncommitted). This file is a **snapshot** — re-run the §10.4 sync check and `git log --oneline -3` before every task. **The code is the truth; this file is the map.**
>
> **Keep the map current (mandatory):** if the live git state differs from what this file records — HEAD hash, current branch, working-tree contents, or any version/date token — **update this file to match before doing any other work**. Concretely: refresh the **Active Target** / **Working Branch** lines in this header, the **§1 Branches** row, and the **§2.3 Git State** table (Current Branch, HEAD, Working tree, Backup branches); bump the **Audit Hash** above to `AGENTS_SYNC_<version>_<YYYY-MM-DD>` to record the re-sync; and correct any other stale references you touch. Never proceed on a stale map — the file must describe the commit you are actually working from. If you cannot verify the live state, say so rather than guessing.

---

## 1. PROJECT IDENTITY

VEPA is a **GPU-accelerated (Web Workers + PixiJS/Canvas2D) emergent physics simulation** — a synthetic petri dish where particles governed by DNA profiles interact under global laws. A **Narrative Consciousness** layer acts as the functional "ink," rewriting physics based on the unfolding story of simulated species.

| Attribute | Value |
|-----------|-------|
| **Repository** | `github.com/gemquota/vepa.git` |
| **Active version** | **VEPA4 v8.16.2** (legacy label `4.8.17`) — deterministic worker + exhaustive benchmark release, committed and tagged `v8.16.2` |
| **Active tree** | repo root (VEPA v4 — "Integrated Intelligence"; `v4/` promoted to root 2026-08-10) |
| **Legacy trees** | archived 2026-08-10 → `gemquota/vepa-archive` (root `src/` v2.5.0-era · `v3/`, `v3-backup/`, `v3-persistence-design/` · `vaa/`) |
| **Branches** | `master` (stable — **current**) · `new` · `feature/slider-controls` · `feature/multiplayer-investigation` · `feature/nuclear-rewrite` (remote) |
| **Backup branches** | `backup/pre-*` — cut before risky work (see §10.4) |
| **License** | ISC (`package.json`) |
| **Package Manager** | npm (`package-lock.json`, `node_modules/` installed) |
| **Runtime** | Browser (ESM) + Node.js (scripts, `bench/`, `audit-suite/`) |
| **Key Dependencies** | `pixi.js` ^8.18.1 · `vite` ^8.0.8 · `vitest` ^3.2.7 · `@playwright/test` ^1.60.0 |
| **Module System** | ESM (`"type": "module"`) |
| **Deploys** | Vercel prod `https://vepa-seven.vercel.app/` · GitHub Pages `https://gemquota.github.io/vepa/` (both auto-deploy from pushes to `master`) |

**Version alignment (new schema since 2026-08-10):** the product is **VEPA4**; versions use `major.minor.build` (npm-semver-native). `VERSION`, the top section of `CHANGELOG.md` (arrow token), `package.json#version`, and this file **must all read 8.16.1** (hotfix over 8.16.0). Since the 2026-08-10 restructure the root manifest IS the v4 manifest (the legacy v2 root `package.json` was archived with the legacy trees).

**GEMINI.md mandates (take precedence over this file):** every significant change must sync `CHANGELOG.md`, `README.md`, `SPEC.md`/`PLAN.md`, `GUIDE.md`, `LAW_HELP_DB`, and `audit-suite/` per GEMINI.md §1.1 (legacy `ENGINE_SSOT.md` / `docs/fullaudit.md` / `codex/` parity were archived 2026-08-10); the B-4RK principle (documentation as a feature — 4-tier `LAW_HELP_DB` for every law); bitmask discipline (`LAW_INDEXES` never hardcoded); and verify doc sync before declaring completion or you incur **Documentation Debt**. Read `GEMINI.md` on entry (§10.1).

---

## 2. COMPLETE CODEBASE AUDIT

### 2.1 Active Tree (repo root — v4 promoted here 2026-08-10)

```
.                            ← repo root
├── CHANGELOG.md            ← RELEASE LEDGER — single source of truth (§10.4)
├── README.md               ← v4 overview, commands, deploy targets
├── SPEC.md                 ← v4 architecture spec (4.0.0 base)
├── PLAN.md                 ← v4 plan + milestone history
├── GUIDE.md / GEMINI.md    ← user design guide + project mandates
├── index.html              ← app shell
├── style.css
├── package.json            ← v4 manifest (8.16.1 — MUST match changelog top)
├── package-lock.json
├── vercel.json             ← Vercel static build + COOP/COEP headers
├── vite.config.js / vitest.config.js
├── vepa4                   ← launcher: dev|build|preview|test|syntax|bench
│
├── src/                    ← v4 application source (65 JS files, ~20k LOC)
│   ├── main.js             ← orchestrator, law shuffling, worker bridge
│   ├── constants.js        ← SSOT: STRIDE_INDEXES, DNA_INDEXES (64) / DNA_COUNT
│   │                          (64), DNA_META, DNA_RANGES, LAW_INDEXES (128),
│   │                          LAW_CATEGORIES, LAW_SPECTRUM
│   │                          (4pt bands), LAW_HUE_BY_INDEX, LAW_HELP_DB (4 tiers),
│   │                          LAW_SUBGROUPS, LAW_DEPENDENCIES, DNA_RANGES
│   ├── debug.js            ← on-canvas debug overlay
│   ├── core/               ← eventBus.js, prng.js (SplitMix32)
│   ├── state/              ← lawState.js (128-bit bitmask), particleBuffer.js,
│   │                          worldParams.js, runtimeConfig.js, worldSave.js
│   │                          (save/load/compare/undo), defaultPresets.js,
│   │                          presetManager.js, groupRegistry.js (F.1 groups),
│   │                          construction.js (F.2 nests/roads), economy.js (F.3),
│   │                          memoryBuffers.js (G.1 species/group memory),
│   │                          artifacts.js (I.1 TOOL/WEAPON/BARRIER crafting),
│   │                          governance.js (J.1 policy vector + relations),
│   │                          exoticMatter.js (L.1 EXOTIC zones + states),
│   │                          synthetic.js (P.1-P.3 organisms + uploads + machine groups),
│   │                          relativity.js (M.1 curvature + lensing + E=mc²),
│   │                          quantumMacro.js (N.1 superposition + entangle + tunnel),
│   │                          infrastructure.js (K.1 extraction/grids/mega)
│   ├── dna/                ← dnaBuffer.js (species genome), expression.js
│   ├── physics/            ← solver.js (MAX_FORCE 50, MAX_INTERACTIONS 500),
│   │   │                      laws.js, synergy.js, spatialGrid.js (GRID_DIM 12),
│   │   │                      fields.js (E.1 field grid: vectors/scalars/walls/wells/portals)
│   │   └── lawgroups/      ← 8 per-category law files + SPEC.md (law SSOT)
│   ├── render/             ← renderer.js, spriteSync.js (PixiJS)
│   ├── ui/                 ← 16 files: world, law, species, dna, dnaAnalytics, groupAnalytics (F.4),
│   │                          ecoPanel (A.2),
│   │                          preset, save (World States tab + toolbar
│   │                          quick-save/undo), settings, intel, narrative,
│   │                          hud, camera, tooltip + ui.js
│   ├── engines/            ← goal, insight, lineage, narrative, timeline,
│   │                          speciation (A.1), ecoEngine (A.2), worldEvents (A.3),
│   │                          epochEngine (D.1), agencyEngine (H.1), goalBehavior (H.2)
│   ├── multiplex/          ← multiplex.js + multiplexUI.js + multiplexHelp.js (chaos multiplex)
│   ├── spawn/              ← distribution.js (initial population)
│   └── worker/             ← physics.worker.js (SharedArrayBuffer loop)
│
├── tests/                  ← vitest: 85 files / 839 tests (unit + audit + params);
│                               legacy `run.mjs` node:test runner — do not use
├── bench/                  ← headless solver benchmark (vepa4 bench; --scale/--knobs/--report)
├── public/bench-report/    ← benchmark report SPA (served at /bench-report/)
├── docs/                   ← v4 docs (mechanics/, dev/)
├── audit-suite/            ← law fidelity audit (fidelity-audit-v4.6.29.md + historical/)
├── node_modules/           ← installed (vite/vitest/playwright/pixi)
└── .dist/                  ← vite build output (gitignored)
```

### 2.2 Archived Legacy Trees (read-only — in `gemquota/vepa-archive`)

- **Root `src/` (v2.5.0-era)**, **`v3/` / `v3-backup/` / `v3-persistence-design/`** and
  **`vaa/`** were archived on 2026-08-10 (compressed into `vepa-archive-20260810.tar.gz`,
  hosted in the `gemquota/vepa-archive` repo; also recoverable from git history).
  Notable v2-era differences to never reintroduce: `PARTICLE_STRIDE = 64` (v4 uses 100)
  and nested `this.laws.pure/biol/chem/thermo/meta` config objects — **v4 replaced that
  with the `lawState` bitmask (§3.5); never write v2-style nested law config**.
- The legacy root `package.json` (name `vepa2`, dead `test` script) and root
  `README.md`/`CHANGELOG.md`/`VERSION` were archived too; the root manifest is now the v4 one.
- **Archived support dirs:** `codex/` (in-engine encyclopedia app), `scripts/`
  (build_codex.js, build_ssot.py, …), `archive/`, `audit/`, `public/` (legacy).
- **Restored docs (2026-08-10):** `docs/` now holds only v4-appropriate docs
  (`docs/mechanics/chaos_multiplex.md`, `docs/dev/`); legacy audit
  docs (`docs/fullaudit.md`, `docs/lawaudit.md`, `docs/LAW_AUDIT.md`, `docs/arch/`, …)
  were re-archived individually — the v4 law audit lives in `audit-suite/`.

### 2.3 Git State

| Property | Value |
|----------|-------|
| **Current Branch** | `master` |
| **HEAD** | `42c5a5f` — `chore(release): v8.16.2 — deterministic worker physics and exhaustive benchmarks` (tagged `v8.16.2`) |
| **Previous releases** | `7e937ec` — `docs(agents): sync map to v8.15.1` · `7f5b2fa` — `chore(release): v8.15.1 — performance overhaul (auto-tuned grid + allocation-free pairwise hot path)` (v8.15.1) · `1ea3201` — `chore(release): v8.15.0 — Set O "Stellar Physics" (stars/black holes/supernovae) + rich prime substrate + MAX_PARTICLES 2500→100000` (v8.15.0) · `e7d9a50` — `chore(release): v8.14.1 — blank-canvas hotfix (Set J/K arity + guarded updateIntelligence)` (v8.14.1) · `499cbc0` — `chore(release): v8.14.0 — Set N "Quantum Macroscale"` (v8.14.0) · `d64be99` — `chore(release): v8.13.0 — Set M "Relativity"` (v8.13.0) · `69a2b71` — `chore(release): v8.12.0 — Set L "Exotic Matter"` (v8.12.0) · `5cbea88` — `chore(release): v8.11.1 — boot with PRIME_DEFAULT starter laws` (v8.11.1 hotfix) · `8a39ce9` — `chore(release): v8.11.0 — Set K "Infrastructure & Energy"` (v8.11.0) · `ce691cb` — `chore(release): v8.10.0 — Set J "Society & Governance"` (v8.10.0) · `2472bac` — `chore(release): v8.9.0 — Set I` (v8.9.0) · `81d19c7` — `feat(ui): full-screen multiplex controls` (v8.1.0) |
| **Release tags** | `v8.16.2`, `v8.16.0`, `v8.15.1`, `v8.15.0`, `v8.14.1`, `v8.14.0`, `v8.13.0`, `v8.12.0`, `v8.11.1`, `v8.11.0`, `v8.10.0`, `v8.9.0`, `v8.8.0`, `v8.7.0`, `v8.6.0`, `v8.5.0`, `v8.4.0`, `v8.3.0`, `v8.2.0`, `v8.1.1`, `v8.1.0`, `v8.0.0` (repo tagging adopted at v8.0.0, 2026-08-18) |
| **Backup branches** | `backup/pre-8160-20260820` (cut before v8.16.0 Set P) · `backup/pre-8151-20260819` (cut before v8.15.1 perf overhaul) · `backup/pre-8150-20260819` (cut before v8.15.0 Set O) · `backup/pre-8141-20260819` (cut before v8.14.1 hotfix) · `backup/pre-8140-20260819` (cut before v8.14.0 Set N) · `backup/pre-8130-20260819` (cut before v8.13.0 Set M) · `backup/pre-8120-20260819` (cut before v8.12.0 Set L) · `backup/pre-8111-20260819` (cut before v8.11.1 hotfix) · `backup/pre-master-switch-20260811` (cut before the master-switch attempt) · `backup/pre-archive-restructure-20260810` (cut before the 2026-08-10 restructure) · `backup/pre-multiplex-20260807` · `backup/pre-metrics-20260807` · `backup/pre-perf-20260807` · `backup/pre-cleanup-20260726` · `backup/pre-lpsbs-20260728` · `backup/pre-vepa4-20260801` · `backup/v47-multiplex-f6900f0` (pre-force-push v4.7 multiplex evolution, preserved for reference) |
| **Working tree** | clean for tracked release files; untracked `v4-worktree/` + changelog snapshots untouched |
| **Remote** | `origin` → `github.com:gemquota/vepa.git` (`origin/HEAD` → `master`) |

**Release cadence:** 4.6.11 → … → 4.6.18 all landed 2026-08-06; 4.6.24-4.6.26 landed 2026-08-07/08. The 4.6.27/4.6.28 changelog sections, the v4.6.29 law RRP WIP and the 7.0.0 release draft are uncommitted (not yet released). Always re-check HEAD and the changelog top on entry — do not assume this table is current.

---

## 3. MEMORY & DATA ARCHITECTURE (THE STRIDE SYSTEM)

**Critical:** all particle state lives in flat `SharedArrayBuffer` / `Float32Array` buffers. **In v4, each particle occupies exactly 100 floats (`PARTICLE_STRIDE = 100`, `src/constants.js:9`).** The legacy root tree uses 64 — never mix the two. Base pointer is always `index * PARTICLE_STRIDE`.

### 3.1 Particle Stride Layout (v4 — offsets 0-84, 85-99 reserved)

Source of truth: `STRIDE_INDEXES` in `src/constants.js` and `src/physics/lawgroups/SPEC.md`.

| Offset(s) | Key | Description |
|-----------|-----|-------------|
| 0-2 | `POS_X/Y/Z` | Toroidal position |
| 3-5 | `VEL_X/Y/Z` | Velocity |
| 6 | `MASS` | Physical mass |
| 7 | `SPECIES_ID` | Species index (0-63) |
| 8-49 | `DNA_CACHE_START..END` | 42 cached DNA floats (normalized) |
| 50 | `ENERGY` | Metabolic/life energy pool |
| 51 | `AGE` | Frame count since birth |
| 52 | `DEAD` | 0 alive / 1 dead |
| 53-55 | `COLOR_R/G/B` | Color channels |
| 56 | `RADIUS` | Physical extent |
| 57 | `SIGNAL` | Pulse/signal strength |
| 58 | `BOND_COUNT` | Active valence bonds |
| 59-60 | `BOND_PARTNER_1/2` | Primary bond partners |
| 61 | `MEMORY` | Internal memory state |
| 62 | `HUNGER` | Starvation counter |
| 63 | `ARMOR` | Defense rating |
| 64 | `MITOSIS_TIMER` | Dual-system countdown |
| 65 | `PARTNER_ID` | Breeding partner |
| 66 | `TEMPERATURE` | Thermal state |
| 67 | `CHARGE` | Electrical charge |
| 68-69 | `PHASE_1/2` | Phase/state fields |
| 70 | `SOUL` | Soul-state marker |
| 71-73 | `TRAIL_X/Y/Z` | Trail/persistence |
| 74 | `ALPHA` | Transparency |
| 75-76 | `ENTANGLE_ID/PHASE` | Quantum entanglement |
| 77 | `ELECTRIC_ENERGY` | Electrical potential energy |
| 78 | `STORED_ENERGY` | Reserve pool (capacitance/fusion) |
| 79 | `REPRO_DRIVE` | Reproduction drive (REPRO law gate) |
| 80 | `RADIATION_EXPOSURE` | Accumulated radiation dose |
| 81-84 | `BOND_PARTNER_3-6` | Polymer chain expansion (max 6 bonds) |
| 85-99 | *(reserved)* | Future expansion |

### 3.2 Species DNA Buffers

- `DNA_INDEXES` — **64 parameters, indices 0-63** (`DNA_COUNT = 64`): the 42 core traits (0-41) plus 22 genetics & regulatory traits (42-63). Genetics 42-47: DOMINANCE, CROSSOVER_RATE, EPIGENETIC_DRIFT, HETEROZYGOSITY, GENE_FLOW, REPRESSOR; genetics & regulatory 48-63: ALLELE_COUNT, EPIGENETIC_RATE, HGT_RATE, REPAIR_EFFICIENCY, DRIFT_RATE, SELECTION_SENSITIVITY, SPECIATION_THRESHOLD, ADAPTATION_RATE, TRANSPOSON_RATE, GENE_SILENCING, RECOMBINATION_BIAS, MUTAGEN_SENSITIVITY, TELOMERE_LENGTH, PLOIDY_LEVEL, CODON_BIAS, REGULATORY_DEPTH.
- `DEFAULT_DNA_STRIDE = 64` — **allocation width of the species genome buffer** (Uint16Array, `species * 64 + index`). The stride width and the parameter count both equal 64 since v4.6.19; do not confuse it with the v2-era 64-parameter DNA set (22 genetics traits) — v4's 22 genetics traits live at indices 42-63.
- Per-particle cache: the stride holds **42** normalized floats (offsets 8-49); all 22 genetics traits (42-63) live **only** in the species genome (`readSpeciesDNAParam`/`writeSpeciesDNAParam` in `src/physics/laws.js`). Per-particle cache copies stay at 42 — never widen them.
- `MAX_SPECIES = 64`; `MAX_PARTICLES = 100000`.

### 3.3 Concurrency Model

- **Main thread:** UI (PixiJS sprites), orchestrator (`src/main.js`), render loop.
- **Worker thread:** physics loop (`src/worker/physics.worker.js`), solver (`src/physics/solver.js`), spatial grid, lawgroups.
- **Shared memory:** `SharedArrayBuffer` zero-copy particle state; worker writes, main reads via double-buffering with Transferable objects.
- **Sync protocol:** `postMessage` with `{type, data, config, version}` envelope; law state passed to the worker (INIT / TOGGLE_LAW / CONFIG messages).

### 3.4 Spatial Grid & Solver

- `GRID_DIM = 12` → 12×12×12 cells (`src/physics/spatialGrid.js:8`).
- `MAX_INTERACTIONS = 500` per particle; `MAX_FORCE = 50.0` stability clamp (`src/physics/solver.js:123-124`).
- Forces computed for neighborhood cells; toroidal coordinate remapping.

### 3.5 Law State (Bitmask) System — VERIFIED v4 ARCHITECTURE

Laws are bit flags in a **128-bit state: four `Uint32Array(1)` words — `lowFlags` (0-31), `highFlags` (32-63), `extFlags` (64-95), `quadFlags` (96-127)** (`src/state/lawState.js`). This covers `LAW_COUNT = 128`. Never hardcode law indices — always use `LAW_INDEXES` from `src/constants.js` (128 keys).

- **Helpers:** `createLawState()`, `set()`, `clear()`, `toggle()`, `isSet()`, `getActiveCount()` (popcount), `getStateVector()`, `fromVector()`, `serialize()` (`{low,high,ext,quad}`), `deserialize()` (accepts legacy 3-word objects, quad defaults 0).
- **Worker consumption:** `src/worker/physics.worker.js` imports the lawState helpers, keeps its own `lawState`, and passes it to `solve(particleView, particleCount, stride, lawState, dnaBuffer, worldSize, dt, rng)`.
- **Dispatch:** `src/physics/solver.js` gates every law with `isSet(lawState, LAW_INDEXES.X)` and calls the stateless lawgroup functions (`applyTide`, `applySuperposition`, … imported from `lawgroups/*.js`); per-law forces live in `src/physics/laws.js`.
- **Synergy:** multipliers come from `computeSynergy()` in `src/physics/synergy.js` (returns [0.0, 2.0], e.g. GRAV+PLANETARY ×1.5). The v2-era fixed-penalty synergy table is gone.
- **⚠ Do not backport:** v4 has **no** nested `this.laws.pure/biol/chem/thermo/meta` config object (that is the v2-era pattern). `LAW_INDEXES` and `isSet()` are **live v4 modules**, not deleted root-`src/` methods; `computeFlags()` does not exist anywhere in this repo.

### 3.6 Worker Message Protocol (`src/worker/physics.worker.js`)

Messages use the `{type, ...}` envelope. The worker owns the physics loop and replies on every command.

| Direction | Type | Payload / purpose |
|-----------|------|-------------------|
| → worker | `INIT` | `{buffer, count, config, dnaBuffer}` — `SharedArrayBuffer` (or `ArrayBuffer` fallback) + species genome; replies `INIT_COMPLETE` |
| → worker | `CONFIG` | `{config, buffer?, dnaBuffer?}` — config may set `particleCount`/`worldSize`/`dt`/`stride`, restore lawState from serialized `{low,high,ext,quad}` or a 128-boolean `laws` array; replies `CONFIG_COMPLETE` |
| → worker | `TOGGLE_LAW` | `{lawIndex, forceOn?, forceOff?}` — `forceOn`=set, `forceOff`=clear, else toggle; replies `LAW_TOGGLED {lawIndex, active, lawState}` |
| → worker | `TICK` | `{dt?, particleCount?}` — runs `solve(...)`; replies `TICK_COMPLETE` with `tickCount`, `tickDuration`, optional `offspring` |
| → worker | `GET_STATE` | replies `STATE` with `particleCount`, `worldSize`, … |
| → worker | `RESTORE` | restore serialized state; replies `RESTORE_COMPLETE` |
| → worker | `PING` | replies `PONG {tickCount}` |
| ← worker | `WORKER_READY` | posted once at worker startup |
| ← worker | `ERROR` | unknown message type or invalid payload |

The main thread wires this in `src/main.js` (`sendToWorker`/`worker.onmessage`); the worker owns its lawState copy and receives serialized law state via `CONFIG` + per-law changes via `TOGGLE_LAW`.

---

## 4. DNA PARAMETER SYSTEM (64 INDICES)

All indices are defined in `DNA_INDEXES` (`src/constants.js`); ranges live in `DNA_RANGES` (64 entries `[min, max, default]`) and display names in `DNA_META`. The 42 core traits (0-41) match the classic layout below; genetics traits 42-63 are listed in §4.6.

### 4.1 Physics & Motion (0-3, 15, 26-28)
- `FORCE(0)` · `VISCOSITY(1)` · `TORQUE(2)` · `JITTER(3)` · `TIDAL(15)` · `INERTIA(26)` · `FRICTION(27)` · `MAX_VELOCITY(28)`

### 4.2 Matter & Morphology (6-9, 16-17, 29-31)
- `SYMMETRY(6)` · `HIDDEN_MASS(7)` · `STIFFNESS(8)` · `FUSION(9)` · `FUSION_MOMENTUM(16)` · `FUSION_TIME(17)` · `BASE_RADIUS(29)` · `ELASTICITY(30)` · `BOND_ANGLE(31)`

### 4.3 Electromagnetism & Chemistry (4-5, 32-33, 37-39)
- `POLARITY(4)` · `ALPHA(5)` · `CONDUCTIVITY(32)` · `MAGNETIC_MOMENT(33)` · `REACTION_THRESHOLD(37)` · `CATALYSIS(38)` · `HEAT_OUTPUT(39)`

### 4.4 Biology & Life (10-12, 34-36, 41)
- `BIRTH_RATE(10)` · `DEATH_RATE(11)` · `MUTATION(12)` · `ENERGY_EFFICIENCY(34)` · `SEX_CHANCE(35)` · `PREDATION_BIAS(36)` · `SPECIES_AFFINITY(41)`

### 4.5 Communication & Memory (13-14, 18-25, 40)
- `SIGNAL_RESP(13)` · `PULSE_RATE(14)` · `NEIGHBORHOOD_RADIUS(18)` · `SIGNAL_STRENGTH(19)` · `SIGNAL_DECAY(20)` · `PROPAGATION_SPEED(21)` · `TUNING_CH1-CH4(22-25)` · `MEMORY_DECAY(40)`

### 4.6 Genetics & Regulation (42-63) — genome-only
- **Classic genetics (42-47):** `DOMINANCE(42)` · `CROSSOVER_RATE(43)` · `EPIGENETIC_DRIFT(44)` · `HETEROZYGOSITY(45)` · `GENE_FLOW(46)` · `REPRESSOR(47)`
- **Genetics & regulatory (48-63, added v4.6.19):** `ALLELE_COUNT(48)` · `EPIGENETIC_RATE(49)` · `HGT_RATE(50)` · `REPAIR_EFFICIENCY(51)` · `DRIFT_RATE(52)` · `SELECTION_SENSITIVITY(53)` · `SPECIATION_THRESHOLD(54)` · `ADAPTATION_RATE(55)` · `TRANSPOSON_RATE(56)` · `GENE_SILENCING(57)` · `RECOMBINATION_BIAS(58)` · `MUTAGEN_SENSITIVITY(59)` · `TELOMERE_LENGTH(60)` · `PLOIDY_LEVEL(61)` · `CODON_BIAS(62)` · `REGULATORY_DEPTH(63)`

**Engine wiring:** REPRO consumes ploidy/allele/recombination/mutation-scale params (48-51, 56-58, 61); GENOTYPE consumes drift/selection/speciation/adaptation/mutagen/silencing/codon/regulation (52-55, 57, 59, 62-63); SENESCENCE damps aging death with TELOMERE_LENGTH (60) — `applyLifeCycle` receives `dnaBuffer` from the solver.

---

## 5. LAW SYSTEM (128 GLOBAL LAWS — 8 CATEGORIES × 16)

Laws are multi-state toggles in the 128-bit `lawState` bitmask (§3.5), each with a 4-tier `LAW_HELP_DB` entry (hint, explanation, system, advanced) in `src/constants.js` (export name is **`LAW_HELP_DB`**). Categories are implemented as **stateless functions** in `src/physics/lawgroups/*.js` (see `lawgroups/SPEC.md`).

| Category | Spectrum color | Lawgroup file |
|----------|---------------|---------------|
| Physics | RED | `physicsLaws.js` (GRAV, DRAG, ENTR, WRAP, COLL, ACCR, PLANETARY, VOID, BOND, SINGULARITY, TIDE, FRICTION, ELASTICITY, TURBULENCE, CENTRIPETAL, ROTATION) |
| Biology | ORANGE | `biologyLaws.js` |
| Chemistry | YELLOW | `chemistryLaws.js` |
| Thermodynamics | GREEN | `thermoLaws.js` |
| Metaphysics | TEAL | `metaLaws.js` |
| Electromagnetism | BLUE | `emLaws.js` |
| Information | VIOLET | `infoLaws.js` |
| Quantum | PURPLE | `quantumLaws.js` |

The law grid renders as a top-to-bottom rainbow in this order (v4.6.11+). `LAW_CATEGORIES` (category → color + 16 indices) and `LAW_SPECTRUM` + `LAW_HUE_BY_INDEX` (128 hues, hue = spectrum position × 3.6) hold the mapping. Since v4.6.14 each category band is **4 spectrum points wide** (center ± 2; RED wraps 98%→102% through 0 — was 10 points before); all 128 laws keep distinct hues. An earlier EM-spectrum draft mapping (physics=BLUE, etc.) was superseded — the verified current mapping is the table above.

---

## 6. CODING CONVENTIONS & STANDARDS

### 6.1 JavaScript
- **Commits:** Conventional Commits 1.0.0 — `<type>(<scope>): <description>` (types `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`; `!`/`BREAKING CHANGE:` for breaking). Never write bare-subject or legacy `vX.Y.Z:` prefixed commits — see §10.4.
- **Module system:** ESM (`import`/`export`) throughout; no file extensions in import paths.
- **Naming:** classes `PascalCase`, functions/vars `camelCase`, constants `UPPER_SNAKE_CASE`, files `snake_case.js`.
- **Events:** use `bus` (`src/core/eventBus.js`) for decoupled communication.
- **PRNG:** use `SplitMix32` (`src/core/prng.js`) — never `Math.random()` for simulation-critical randomness.
- **Laws:** always `LAW_INDEXES.X`; state via `lawState.js` helpers (`set`/`clear`/`toggle`); test with `isSet()`. Never v2-style nested `this.laws.*` config.
- **Stride access:** always `index * PARTICLE_STRIDE + STRIDE_INDEXES.X` — no magic numbers.
- **NaN guards:** every physics sub-step validates coordinates and velocities; clamp `MAX_FORCE`/`MAX_VELOCITY`.
- **Law functions are stateless** — no module-level mutable state (per `lawgroups/SPEC.md`).

### 6.2 UI / CSS / HTML
- Programmatic UI in `src/ui/`; no framework.
- Interactive elements use `data-help-key` linking to `LAW_HELP_DB`.
- DNA sliders use `DNA_RANGES` from `src/constants.js`.
- HUD updates flow through `updateHUD()`.
- Setup drawer (v4.6.13): LAWS and WORLD are separate sub-tabs (network panel mounts in WORLD); the law grid can't be hidden anymore — only toggled icon/list view.
- Neon-noir aesthetic: CSS custom properties, `.bolt` corners, scanlines; law colors are per-law HSL (`--law-h`).

---

## 7. DOCUMENTATION & SSOT MANDATES

Every significant code change **MUST** be synchronized across these files:

| File | Content | Sync trigger |
|------|---------|--------------|
| `CHANGELOG.md` | Release ledger — **strict §10.4** | ANY functional change / release |
| `package.json` | Version manifest — must match changelog top | Every release |
| `README.md` | Project overview + commands | Architecture shifts, new features |
| `SPEC.md`, `PLAN.md` | Architecture spec + plan | Major milestones |
| `src/physics/lawgroups/SPEC.md` | Law implementation SSOT | Law changes |
| `src/constants.js` (LAW_HELP_DB) | 4-tier documentation | New laws or parameters |
| `GUIDE.md` | User-facing design guide | Significant parameter/DNA recipe shifts |
| `audit-suite/fidelity-audit-*.md` | Law fidelity audit (updated duplicate) | Law behavior changes (see `audit-suite/README.md`) |
| `VERSION` | Version marker — must match changelog top + `package.json` | Every release (see §10.4) |

The **B-4RK principle** stands: documentation is not an afterthought; it is a feature. New laws must ship with all four `LAW_HELP_DB` tiers. The law audit lives in `audit-suite/` (fidelity audit + frozen historical copies of `laws-rrp/batch_*.md`); legacy audit docs (`docs/fullaudit.md`, `docs/lawaudit.md`) are archived.

---

## 8. TESTING & QUALITY ASSURANCE

- **Unit/audit:** `vepa4 test` (vitest 3.2.7, `tests/`). **86 files / 860 tests** (verified 2026-08-20 — 854 green; the 6 failures are the pre-existing law-category/audit baseline: 4× `lawCategories.test.js` + `batch_08` TIME_DILATION + `batch_30` TELEPORT — untouched by v8.2.0–v8.16.0). Config: `vitest.config.js` includes `tests/**/*.test.js`, node environment, 15 s timeout. Suite layout: `tests/unit/` (30 files incl. `exoticMatter.test.js`, `relativity.test.js`, `quantumMacro.test.js`, `stellar.test.js`, `synthetic.test.js`, `drawer.test.js`, `fields.test.js`, `groupRegistry.test.js`, `constructionEconomy.test.js`, `livingWorld.test.js`, `perfKnobs.test.js`), `tests/audit/` (`batch_01-32.test.js` + `params_batch_01-18.test.js` + `paramsHelpers.js`).
- **E2E:** `npm run test:e2e` (Playwright) — ⚠️ **no `playwright.config.*` or `*.spec.js` files are committed yet**, so the script is currently unconfigured; treat e2e as aspirational until specs land.
- **Syntax:** `vepa4 syntax` (`node --check` on `src` + `tests`).
- **Audit docs:** `audit-suite/` — `fidelity-audit-v4.6.29.md` (updated duplicate for the 8 rewritten laws) + `historical/2026-08-10-v4.6.28/` (frozen pre-rewrite audit incl. `laws-rrp/batch_*.md`).
- **Build smoke:** `vepa4 build`.
- **Legacy runner:** `tests/run.mjs` (node:test) is a v3-era artifact — do not use; `vepa4 test` is the suite.
- `npm test` runs the v4 vitest suite (the legacy v2 root manifest with the dead validator was archived).

---

## 9. BUILD SYSTEM & DEPLOYMENT

- **Launcher:** `./vepa4 [dev|build|preview|test|syntax|bench] [port]` from any directory (symlinked as `vepa4` on this device). Default dev port 5180.
- **Vite config** (`vite.config.js`): base `'/'` when `VERCEL=1`; `VITE_BASE` (Pages workflow sets `/vepa/`) when provided; else `'/vepa/vepar/'` (local launcher); dev server sets COOP/COEP headers (`host: true`); worker format `es`.
- **Build:** `vepa4 build` → `.dist` (gitignored). PixiJS tree-shaken; COOP/COEP headers required for `SharedArrayBuffer`.
- **Deploys:** Vercel production (`vercel.json` — static build, COOP/COEP) → `https://vepa-seven.vercel.app/`; GitHub Pages → `https://gemquota.github.io/vepa/` via the restored root-layout `.github/workflows/deploy.yml` (`VITE_BASE=/vepa/`, gh-pages branch, peaceiris/actions-gh-pages@v4) — both auto-deploy on every push to `master`.
- **World parameters:** 23 definitions in `src/state/worldParams.js` (`WORLD_PARAM_DEFS`); live values live in `runtimeConfig.worldParams` and are passed to the worker.
- Every deploy must follow §10.4.

---

## 10. WORKFLOW & OPERATIONAL PROTOCOLS

### 10.1 Agent Entry Procedure
1. **Read this file** ✓
2. **Audit state:** `git status` + `git log --oneline -3`; verify HEAD prefix matches top of `CHANGELOG.md`
3. **Verify branch:** `master` is current — release commits are permitted here per the active release protocol
4. **Read context:** `README.md`, `SPEC.md`, `PLAN.md`
5. **Read the runtime SSOT:** `src/constants.js` (STRIDE_INDEXES, DNA_INDEXES, LAW_INDEXES, LAW_CATEGORIES)
6. **Read `src/physics/lawgroups/SPEC.md`** before touching law code
7. **Run the §10.4 version-sync check**
8. **Read `GEMINI.md`** (project mandates take precedence)
9. **Legacy trees are archived** (root `src/`, `v3/`, `vaa/` → `gemquota/vepa-archive`); never reintroduce v2-era code

### 10.2 Change Protocol
1. Make the change in `src`
2. `vepa4 syntax`
3. `vepa4 test` (+ targeted audit/e2e where relevant)
4. `vepa4 build` — verify no build regression
5. Update docs per §7 (minimum: `CHANGELOG.md` via §10.4)
6. Cut backup branch, commit, tag, deploy per §10.4

### 10.3 Common Pitfalls

| Pitfall | Resolution |
|---------|------------|
| **Stride mismatch** | v4 = 100, legacy root = 64 — always import `PARTICLE_STRIDE` from `src/constants.js` |
| **DNA count confusion** | v4 has **48** DNA params (0-47); `DEFAULT_DNA_STRIDE = 64` is the genome buffer width, not a param count; the 42-param claim applies to the per-particle stride cache only |
| **Law bitmask width** | The v4 law state is **128 bits** (4 × u32: low/high/ext/**quad**Flags) — not 96 bits. Serialized form is `{low, high, ext, quad}` |
| **v2 law config** | Do not write nested `this.laws.pure/biol/chem/thermo/meta` objects — that is v2-era; v4 uses `lawState` + `LAW_INDEXES` + `isSet()` |
| **Version drift (fixed 2026-08-06, re-based 2026-08-10)** | `VERSION`/changelog arrow token/`package.json#version` all read 8.16.1 (VEPA4 `major.minor.build`); keep them matched per §10.4 |
| **Stale root manifest** | The legacy v2 root manifest is archived — `npm test` / `npm run build` now run the v4 suite from the root |
| SharedArrayBuffer blocked | Serve with COOP/COEP (`vepa4 dev` handles; `vercel.json` ships them) |
| Worker postMessage limits | Use Transferable objects for buffer transfers |
| Physics NaN explosion | NaN shields in solver; MAX_FORCE/MAX_VELOCITY clamps |
| Law toggle not working | Check `LAW_INDEXES` + `lawState.js` set/clear + `isSet` in solver |
| HELP_DB / audit drift | After law changes, sync `LAW_HELP_DB` (4 tiers) + `audit-suite/fidelity-audit-*.md` (see GEMINI.md §1.1) |
| Memory/stride corruption | Every access = `index * PARTICLE_STRIDE + STRIDE_INDEXES.X` |
| Planet law key | v4 key is `LAW_INDEXES.PLANETARY` |
| Stale changelog drafts | An earlier `[4.7.0]` draft was removed from the ledger on 2026-08-06 (snapshot: `CHANGELOG.md.bak-20260806`); the current `[4.7.0]` release draft (2026-08-10) drops the planned multiplayer update entirely |

### 10.4 VERSION HISTORY CONTROL PROTOCOL (STRICT — MANDATORY)

**Product & schema (adopted 2026-08-10):** the product is **VEPA4** (formerly
styled "VEPA v4"); versions use **`major.minor.build`** (npm-semver-native, e.g.
`7.0.0`). Retroactive mapping of the v4 line: old `4.M.N` → `M.N.0` — the
generation `4` moved into the product name, the old minor became the new major,
the old patch became the new minor, and every historical release gets build `0`
(builds increment only for future same-minor rebuilds/hotfixes). Changelog
headers carry both labels: `## [4.6.28] - date → 6.28.0`. v2/v3-era entries keep
their historical labels.

**Authority:** `CHANGELOG.md` is the single source of truth for release history.
`VERSION`, the changelog top section's arrow token, and `package.json#version`
MUST all equal the newest version (`7.0.0`). From here on, drift is a release
blocker.

**Commit standard (Conventional Commits 1.0.0 — mandatory for all commits from
2026-08-10):** `<type>(<scope>): <description>` with types
`feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`; breaking changes
append `!` to the type/scope or use a `BREAKING CHANGE:` footer. Release commits
use `chore(release): v7.0.0 — <summary>`; tags are `v7.0.0`. Past commit messages
(legacy `vX.Y.Z:` prefixes) are immutable — never rewrite history; the changelog
restates releases under the new schema.

**Release checklist — every deploy, no exceptions:**
1. **Changelog first.** Add `## [4.7.0] - YYYY-MM-DD → 7.0.0` at the top of
   `CHANGELOG.md` (legacy label + arrow + new-schema token), with
   conventional-style bullets summarizing what/why/files.
2. **Sync the manifests.** Bump `package.json#version` + `VERSION` to the arrow
   token (`7.0.0`). Drift is never allowed.
3. **Back up before editing.** Cut a `backup/pre-<slug>-YYYYMMDD` git branch
   (e.g. `backup/pre-700-20260810`) before risky work. For changelog surgery
   specifically, also snapshot the file: `cp CHANGELOG.md CHANGELOG.md.bak-<date>`.
4. **Commit with Conventional Commits.** `chore(release): v7.0.0 — <summary>` —
   releases are never bare feature commits.
5. **Tag the release.** `git tag v7.0.0` (repo has no tags yet — adopt from the
   next release).
6. **Record the deploy.** Add the deployed URL(s) (Vercel/Pages) to the changelog
   entry so history maps to artifacts.
7. **Sync version markers.** Keep `VERSION` + `package.json#version` aligned with
   the changelog top (since 2026-08-10 the root manifest IS the v4 manifest —
   there are no separate root pointers anymore).

**Changelog backup rules:**
- The changelog is the release ledger — protect it like a database. Snapshot
  (step 3) before ANY bulk edit, and confirm `git diff CHANGELOG.md` shows only
  intended changes afterward.
- Never force-push, rebase, or `git reset` over a committed changelog entry. Fix
  history with a new entry, never by rewriting.
- A release is not real until committed AND tagged. Deploy without a ledger entry
  = it didn't happen.

**Post-release verification:**
```bash
grep -m1 '^## .*→ ' CHANGELOG.md | grep -oE '[0-9]+\.[0-9]+\.[0-9]+$'   # → 7.0.0
grep '"version"' package.json      # 7.0.0 — must match
cat VERSION                        # 7.0.0 — must match
git log --oneline -1               # chore(release): v7.0.0
git tag | tail -1                  # v7.0.0
```

**Non-negotiable rules:**
- **MANDATORY AUTOMATIC VERSION BUMPING PROTOCOL:** Whenever any significant feature, law audit ensemble, UI refactor, or release task is completed, agents **MUST AUTOMATICALLY INCREMENT** the version number across all manifests (`VERSION`, `package.json#version`, `CHANGELOG.md` top header, and `AGENTS.md` header/tables). Version strings must never stall.
- No release commit without a changelog section.
- No changelog section without a matching `package.json` version.
- No deploy without a `backup/pre-*` branch from the pre-release state.
- One section per release; newest version number first (branch experiments get `M.N.B-<tag>` suffixes, e.g. `7.1.0-mp`).
- Every commit (release or feature) follows Conventional Commits 1.0.0.

### 10.5 Architecture Constraints (v4)
- `PARTICLE_STRIDE` = 100 · `MAX_SPECIES` = 64 · `MAX_PARTICLES` = 100000
- `DEFAULT_DNA_STRIDE` = 64 (species genome width) · `DNA_COUNT` = 64 (42 cached per particle, 22 genome-only)
- `LAW_COUNT` = 128 (8 categories × 16) · `GRID_DIM` = 12 (12³ cells)
- `MAX_INTERACTIONS` = 500 · `MAX_FORCE` = 50.0
- Particle buffer: `Float32Array` over `SharedArrayBuffer`

### 10.6 Adding a New Law (v4)
1. Add index to `LAW_INDEXES` + `LAW_HELP_DB` (all 4 tiers) in `src/constants.js`
2. Add to `LAW_CATEGORIES` (16-per-category cap; `LAW_COUNT` ≤ 128) and confirm `LAW_SPECTRUM`/`LAW_HUE_BY_INDEX` coverage
3. Implement a stateless function in `src/physics/lawgroups/<category>Laws.js` per `lawgroups/SPEC.md`
4. Wire dispatch with `isSet(LAW_INDEXES.X)` in `src/physics/solver.js` (worker consumes via `solve()`)
5. Add the toggle in `src/ui/lawPanel.js`
6. Update `lawgroups/SPEC.md` + `audit-suite/laws-rrp/batch_*.md`
7. Update `audit-suite/fidelity-audit-*.md` + the historical batch copy if the law behavior changed
8. `vepa4 syntax` + `vepa4 test`
9. Changelog + version + backup + tag per §10.4

---

## 11. PRESET PROFILES

Built-ins live in `src/state/defaultPresets.js`: **PRIME_DEFAULT** (default world) plus species presets **PREDATOR, SOL, LIFE, AETHER, VOID**; managed by `src/state/presetManager.js` with `src/ui/presetPanel.js`. (The classic v2 table had 12 presets — verify current names in `defaultPresets.js` before relying on any.)

---

## 12. INTELLIGENCE ENGINES

- **v4 (`src/engines/`):** `goalEngine.js` (world-constraint tuning), `insightEngine.js` (cluster detection / pattern logging), `lineageTracker.js` (genealogy), `narrativeEngine.js` (narrative generation), `timelineEngine.js` (history playback), `speciationEngine.js` (A.1 DNA-slot speciation), `ecoEngine.js` (A.2 metrics ring: curves/biodiversity/food-web/niches), `worldEvents.js` (A.3 metrics-triggered + physics-confirmed events), `epochEngine.js` (D.1 eras + restorable snapshots + extinction/recovery), `agencyEngine.js` (H.1 bounded narrative actor + milestones), `goalBehavior.js` (H.2 goal-driven velocity nudges).
- **Legacy (archived):** `personalityEngine.js`, `emergentParamEngine.js`, `narrativeConsciousness.js`, `persistenceEngine.js`, `levelEngine.js`, plus v2 `engines/` — archived 2026-08-10 with the legacy trees (in `gemquota/vepa-archive`).

---

## 13. CURRENT DOCUMENTATION & WORK TRACKS

- `docs/multiplayer/` — **removed with the 4.7.0 release draft (2026-08-10)**; the LAN-hub P0 + phone-grid P1 WIP (`server/`, `multiplayer/`, `net-poc/`, `src/net/`, `src/ui/networkPanel.js`, `tests/unit/net.test.js`) is recoverable from `730f5dc` / backup branches if the multiplayer track is ever resumed.
- `audit-suite/laws-rrp/` — per-law RRP batches 01-32 (batches 01-14 shipped through v4.6.18; batches 15+ pending).
- `tests/audit/` — `batch_01-32.test.js` + `params_batch_01-18.test.js`.
- `docs/stubs.md` — legacy doc gaps; `docs/LAW_AUDIT.md`, `docs/LAW_PARAMETER_RELATIONSHIPS.md` — law/param analysis.
- `PLAN.md` — milestone plan.

---

## 14. QUICK REFERENCE

```bash
# State & version sync (run on entry — §10.4)
git status && git log --oneline -3
grep -m1 '^## .*→ ' CHANGELOG.md | grep -oE '[0-9]+\.[0-9]+\.[0-9]+$'   # → 7.0.0
grep '"version"' package.json      # must match changelog
cat VERSION                           # root marker — must match too

# Trust-but-verify (workspace moves fast — code is truth)
node -e "const c=require('./src/constants.js'); console.log(c.PARTICLE_STRIDE, c.DNA_COUNT, c.LAW_COUNT)"  # → 100 64 128
grep -c '^export const' src/constants.js
ls src/physics/lawgroups/*.js | wc -l    # → 8 lawgroup files + SPEC.md
git log --oneline -3 -- CHANGELOG.md     # confirm HEAD = changelog top

# v4 workflow
vepa4 dev                             # dev server (COOP/COEP), port 5180
vepa4 test                            # vitest unit suite (67 files / 579 tests)
vepa4 syntax                          # node --check all v4 JS
vepa4 build                           # vite build → .dist
npx playwright test          # e2e suite

# Release (strict — §10.4)
git switch -c backup/pre-<slug>-$(date +%Y%m%d)   # backup branch first
# ... edit CHANGELOG.md + package.json (+ VERSION) ...
git commit -m "chore(release): v7.0.0 — <summary>"
git tag v7.0.0

# Key constants
grep 'PARTICLE_STRIDE' src/constants.js   # → 100
grep 'LAW_COUNT'       src/constants.js   # → 128
grep 'MAX_SPECIES'     src/constants.js   # → 64
grep 'DNA_COUNT'       src/constants.js   # → 64
```

---

*Reviewed 2026-08-22 | Workspace state: v8.16.2 committed + tagged at `42c5a5f` on `master`. Deterministic SharedArrayBuffer worker execution, completion-driven main-thread orchestration, and exhaustive full-stress benchmark SPA shipped. O·P·Q at build 2 of 3 — Set Q (cosmology, v8.17.0) next. Changelog snapshots `CHANGELOG.md.bak-20260819*` + `v4-worktree/` untracked/untouched. Verify SSOT parity before any code change.*
