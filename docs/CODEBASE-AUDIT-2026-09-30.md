# VEPA4 Codebase Audit — Redundancy, Symbol Map, Abstraction Opportunities & Feature Verification

**Audit date:** 2026-09-30
**Version under audit:** 9.1.22
**Scope:** `src/` (101 JS modules, 29,187 LOC), `tests/`, `scripts/`, `exports/`, `bench/`, and repository hygiene
**Method:** static analysis (brace-matched function-body normalization + regex symbol extraction), byte-level file comparison, and execution of the repository's own verification gates.
**Status:** remediation applied same-day. See **§6 Resolution Log** for what was
fixed, what was deliberately left, and two findings this audit got wrong.

---

## 0. Verification Evidence (all commands run in-repo)

> State below is **as audited**, before remediation. See §6 for the post-fix
> result — `spec:check` now passes and the duplication counts are reduced.

| Gate | Command | Result (as audited) |
|---|---|---|
| Unit + audit tests | `bun run test` (vitest) | ✅ **PASS** — 109 files, **951 tests**, 47.5 s |
| Repository contract | `node scripts/check-repository.mjs` | ✅ **PASS** — 136 laws, 136 ontology records, provenance + signoff manifests valid |
| Provenance | `node scripts/validate-provenance.mjs` | ✅ **PASS** — 2 manifests |
| Export publication | `node scripts/check-export-publication.mjs` | ✅ **PASS** — "configured-not-published" |
| Audit corpus report | `node scripts/audit-corpus-report.mjs` | ✅ 398 files, 2.0 MB, 0 exact duplicate groups |
| Artifact inventory | `node scripts/repository-artifact-report.mjs` | ⚠️ 2 artifacts flagged (see §4.2) |
| **Spec drift** | `bun run spec:check` | ❌ **FAIL** — 10 changed files (see §3.1) — **FIXED in §6.1** |

The codebase is in **substantively healthy** condition: 951 green tests, a passing repository contract, and 136 laws with a valid provenance trail. The problems documented below are **structural and hygiene** problems, not correctness failures.

---

## 1. Symbol Map

### 1.1 Module inventory by area

| Area | Files | Lines | Exported fns | Role |
|---|---:|---:|---:|---|
| `src/physics/` | 16 | 8,307 | ~200 | Solver, laws, fields, spatial structures, relationship model |
| `src/physics/lawgroups/` | 10 | 1,203 | 66 exported of 78 | Decomposed per-category law groups (newer architecture) |
| `src/state/` | 24 | 5,569 | ~120 | Buffers, save/load, subsystems (stellar, quantum, synthetic…) |
| `src/ui/` | 19 | 4,959 | ~55 | Panels, analytics dashboards, slider control, camera |
| `src/multiplex/` | 3 | 2,817 | 38 | Evolutionary shard search (A/B/C/D variants) |
| `src/engines/` | 11 | 1,881 | ~55 | Insight, narrative, goal, lineage, timeline, epoch, speciation |
| `src/constants/` | 5 | 661 | data | Stride layout, DNA ranges, law index/help catalogs |
| `src/dna/` | 2 | 411 | ~21 | Genome buffer + gene expression |
| `src/render/` | 3 | 978 | 28 | Canvas2D renderer + PixiJS renderer + sprite sync |
| `src/` (root) | 4 | 1,791 | ~28 | `main.js` orchestrator, `debug`, React entry |
| `src/core/` | 2 | 66 | 2 | Event bus, PRNG |
| `src/worker/` | 1 | 437 | 0 | Deterministic Web Worker solver |
| `src/spawn/` | 1 | 107 | 5 | Spawn distribution |
| **Total** | **101** | **29,187** | **460 exported fns / 112 exported consts** | |

### 1.2 Largest modules (candidates for decomposition)

| Module | Lines | Exported fns | Note |
|---|---:|---:|---|
| `src/physics/laws.js` | **2,800** | 103 of 117 | God-module; single law implementation |
| `src/physics/solver.js` | 1,988 | 13 | Expected for a solver; internal cohesion OK |
| `src/main.js` | 1,537 | 28 | Expected for an orchestrator; owns 30+ module-level mutable singletons |
| `src/multiplex/multiplex.js` | 1,522 | 38 | Shard lifecycle + metrics + rendering + snapshotting |
| `src/ui/ui.js` | 485 | 18 | Tab/drawer chrome |
| `src/ui/dnaAnalytics.js` | 541 | 10 | Dashboard |
| `src/ui/worldPanel.js` | 553 | 9 | Largest single `createElement` user (16 calls) |

### 1.3 Notable non-code inventory

- `docs/audit/laws/a3/` — 398 Markdown files, 2.0 MB, 3 audit stages × 128 laws + rollups
- `laws/` — **398 files, 3.0 MB, 397/398 byte-identical to `docs/audit/laws/a3/`**
- `docs/systems/` — 90 files; `dist/docs/systems/` — **90/90 byte-identical copies**
- `exports/` — three 2.2–2.3 MB generated concatenation artifacts (4.8 MB total)
- `style.css` — 79,860 bytes; `index.html` — 12,822 bytes with 2 inline `<style>` blocks

---

## 2. Redundant Code

### 2.1 Exact duplicate function bodies (machine-verified)

A brace-matched extractor normalized each function body (comments stripped, literals → placeholders, whitespace collapsed) and grouped by hash. **9 duplicated bodies** exist:

| # | Body | Locations | Assessment |
|---|---|---|---|
| DUP-1 | `isAccretionLink` / `isAccretionPair` (15 lines) | `physics/laws.js`, `physics/mergePhysics.js` | **Dead duplicate** — solver imports only the `mergePhysics` copy |
| DUP-2 | `fallbackCopy` / `fallbackCopyText` (10 lines) | `debug.js:71`, `ui/settingsPanel.js:199` | Byte-identical, **should be one `core/clipboard.js`** |
| DUP-3 | `cipherKey` / `cipherKeyFromStride` (8 lines) | `physics/lawgroups/infoLaws.js`, `physics/laws.js` | Duplicated crypto-key derivation |
| DUP-4 | `clamp` (5 lines) | `lawgroups/{em,info,meta}Laws.js` + 22 more | **25 modules** each define a local `clamp` |
| DUP-5 | `hash2` (5 lines) | `state/{stellar,exoticMatter,quantumMacro}.js` | Byte-identical 32-bit hash, **3 copies** |
| DUP-6 | `setVal` (4 lines) | `ui/ecoPanel.js`, `ui/groupAnalytics.js` | DOM value setter |
| DUP-7 | `asView` / `asParticleView` (3 lines) | `render/pixiRenderer.js`, `render/renderer.js` | Zero-copy buffer view, byte-identical |
| DUP-8 | `dist2` / `centroidDist2` (3 lines) | `state/construction.js`, `state/governance.js`, `state/infrastructure.js` | Squared-distance helper, **3 copies** |
| DUP-9 | `num` (2 lines) | `state/{stellar,exoticMatter,quantumMacro,relativity,synthetic}.js` | Coercion-with-default, **5 copies** |

### 2.2 Duplicated *patterns* (not byte-identical, same intent)

**P-1 — `clamp(nanGuard(x), -50, 50)` force shape: 64 occurrences across 8 law modules.**

```
return {
  ax: clamp(nanGuard(<expr>), -50, 50),
  ay: clamp(nanGuard(<expr>), -50, 50),
  az: clamp(nanGuard(<expr>), -50, 50),
};
```

| Module | Occurrences |
|---|---:|
| `lawgroups/physicsLaws.js` | 20 |
| `lawgroups/quantumLaws.js` | 15 |
| `lawgroups/chemistryLaws.js` | 8 |
| `lawgroups/biologyLaws.js` | 8 |
| `lawgroups/emLaws.js` | 5 |
| `lawgroups/metaLaws.js` | 4 |
| `lawgroups/thermoLaws.js` | 3 |
| `lawgroups/infoLaws.js` | 1 |

**Assessment:** this is the single highest-value abstraction target. 64 hand-written triples = ~190 lines that should be one function. A physics-emitter bug fix currently requires finding and editing up to 64 sites.

**P-2 — DNA quantize/dequantize: 5 independent implementations.**

| Location | Form |
|---|---|
| `physics/laws.js:55-71` | `readSpeciesDNAParam` / `writeSpeciesDNAParam` |
| `physics/solver.js:1981` | `readSpeciesDNA` |
| `state/quantumMacro.js:87-92` | `readDNA` |
| `main.js:676-677` | inline clamp→normalize→`Math.round(*65535)` |
| `main.js:884-885` | **byte-identical inline duplicate** of the above |

The genome encoding (`min + (raw/65535)*(max-min)` ↔ `Math.round(norm*65535)`) is the project's core serialization contract and is implemented five times. `main.js:676` and `main.js:884` are the same 5 lines duplicated verbatim.

**P-3 — Engine factory contract: 4 engines share an identical preamble.**

```js
export function createXEngine(bus, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const engine = { bus, ...
```
Present in `insightEngine.js:27`, `narrativeEngine.js:124`, `goalEngine.js:86`, `timelineEngine.js:29`. Also all three of `goalEngine`, `insightEngine`, `narrativeEngine` export a function literally named `update` (aliased on import in `main.js:20,25,27`).

**P-4 — Analytics panel skeleton.** `ui/ecoPanel.js` and `ui/groupAnalytics.js` are structurally identical: module-level `host`/`lastDraw`, `create*Panel(bus)` → `getElementById` → `innerHTML` with `intel-header`/`intel-grid`/`intel-cell` → `bus.on(...)` → 500 ms throttle → `drawAll()` → `setVal()`. Only the metrics and the canvas drawing differ.

**P-5 — Renderer duplication.** `render/renderer.js` (Canvas2D, 464 lines) and `render/pixiRenderer.js` (PixiJS, 355 lines) independently re-implement projection, background, culling and the `asView` zero-copy helper, and independently import `computeColor/computeRadius/computeAlpha` + `projectPoint`. They are two backends of one renderer with no shared abstraction layer.

**P-6 — Parallel law architectures.** `physics/laws.js` (117 top-level functions, 103 exported) and `physics/lawgroups/` (78 top-level functions, 66 exported) are **two different implementations of the same concern** with incompatible contracts:
- `laws.js` uses a **module-level mutable singleton** `buffer_global` (49 references; 46 functions read it implicitly), set once via `setBuffer()`.
- `lawgroups/*` take an **explicit `view` parameter** and never touch global state.

`solver.js` imports from **both** (lines 10–116 from `laws.js`, lines 120–128 from `lawgroups/`). The two styles coexist inside one hot loop. The singleton also means `laws.js` is untestable without a global side effect and is not safe for two worlds in one process (e.g. multiplex shards).

### 2.3 Confirmed dead code

| Symbol | Location | Evidence |
|---|---|---|
| `applyAlloy` | `physics/laws.js:1424` | Exported but **not in the solver's `laws.js` import list** (line 10–116). Solver imports `applyAlloy` from `mergePhysics.js:119`. The `mergePhysics` copy is a near-verbatim duplicate (same 7 guard lines, diverging only in the merge body). **~40 lines dead.** |

### 2.4 Repository-level duplication (measured by `cmp`)

| Pair | Files | Identical | Bytes |
|---|---:|---:|---:|
| `laws/a3/**` vs `docs/audit/laws/a3/**` | 398 | **397** (1 diverges: `physics.md`) | ~3.0 MB |
| `dist/docs/systems/**` vs `docs/systems/**` | 90 | **90** | ~2.3 MB |
| `exports/vepa-codebase-full-concat.md` vs `vepa-full-codebase-concat.md` | 2 | 0 (differing md5) | 2.19 + 2.33 MB |

**`dist/` is committed to git** (116 tracked files) even though it is Vite build output (`vite.config.js` → `outDir: 'dist'`). The `.gitignore` entry is `.dist/` — a **leading-dot typo** that matches nothing real. Consequently the build output, including a 100%-duplicate copy of `docs/systems/`, is versioned.

---

## 3. Feature Implementation Verification

### 3.1 ❌ `spec:check` FAILS — spec generator parses the wrong file

```
$ node scripts/generate-spec.mjs --check
  Constants: 136 laws, 0 categories, stride 100
  Source files scanned: 233
  Test files scanned: 112
  Audit files scanned: 398
spec:check failed: { "missing": [], "changed": [10 files] }
```

**Root cause (confirmed by direct evaluation).** `scripts/generate-spec.mjs:98` does:

```js
const src = read('src/constants.js');
```

`src/constants.js` is a **6-line barrel re-export**:

```js
// Compatibility facade for the established constants module path.
export * from './constants/stride.js';
export * from './constants/dna.js';
export * from './constants/laws.js';
export * from './constants/help.js';
export * from './constants/world.js';
```

The generator then applies **regex** extraction to that barrel. Verified results against the real file contents:

| Regex | Match against `src/constants.js` | Consequence |
|---|---|---|
| `PARTICLE_STRIDE\s*=\s*(\d+)` | **no match** | falls back to hardcoded `100` |
| `DNA_COUNT\s*=\s*(\d+)` | **no match** | falls back to hardcoded `64` |
| `LAW_COUNT\s*=\s*(\d+)` | **no match** | falls back to hardcoded `136` |
| `export const LAW_INDEXES = {…}` | **no match** | `LAW_INDEXES = {}` — **empty** |
| `export const LAW_CATEGORIES = {…}` | **no match** | **`0` categories** |
| `LAW_PARAMETERS`, `LAW_HELP_DB` | **no match** | **empty** |

The three scalar values happen to be *coincidentally correct* because the hardcoded fallbacks match today's values. **The structured catalogs resolve to empty objects.** `scripts/check-repository.mjs:4` and `scripts/validate-signoff.mjs:10` do the right thing — they `import { LAW_INDEXES } from '../src/constants.js'`, which resolves through the barrel correctly and is why `repository:check` passes. `generate-spec.mjs` is the only consumer still regex-parsing the pre-split file.

**Impact:** the entire `docs/spec/` tree — including `traceability/laws.md`, `laws/implementation-status.json`, `laws/ontology-coverage.json`, and the law→implementation manifest — regenerates from an **empty law catalog**. The committed tree still contains correct content (9 categories, 136 laws) generated before the split, which is exactly why the byte-for-byte check now reports 10 changed files. **Any regeneration overwrites good traceability data with empty-catalog output.** The reported "136 laws / 0 categories" is the tell.

**Fix (one line):** `read('src/constants.js')` → read the real modules:
```js
const src = read('src/constants/laws.js') + '\n' + read('src/constants/stride.js')
          + '\n' + read('src/constants/dna.js') + '\n' + read('src/constants/help.js');
```
Then run `npm run spec:generate` and confirm `spec:check` returns to green.

### 3.2 Claimed-feature matrix

Source: `SPEC.md` §Goals, §Acceptance Criteria, §Architecture.

| # | Claimed feature | Status | Evidence |
|---|---|---|---|
| 1 | **Five engines wired into `main.js`** (Insight, Narrative, Lineage, Goal, Timeline) | ✅ **Implemented** | All five imported at `main.js:20,25,26,27,28`; all five constructed in `boot()` at `main.js:375-379`. SPEC's stated defect ("compiled factories, zero imports in `main.js`") is genuinely fixed. |
| 2 | **Communication DNA physics** — pulse emission, channel-filtered propagation, signal response, memory | ✅ **Implemented** | `laws.js` exports `applySignalDecay` and `applySignalExchange`; `cipherKey` present; covered by `tests/unit/signal.test.js` (passing). |
| 3 | **PREDATION restored as an explicit law** | ✅ **Implemented** | `LAW_INDEXES.PREDATION = 51` (`constants/laws.js:12`); dispatched at `solver.js:1021-1025` under `active[LAW_INDEXES.PREDATION]`; implementation at `laws.js:286`; tested in `tests/audit/batch_11.test.js`. |
| 4 | **World Intelligence Dashboard** (clusters, lineage, goals, timeline) | ✅ **Implemented** | `ui/{dnaAnalytics,groupAnalytics,ecoPanel,speciesPanel,narrativePanel,intelPanel}.js` + `ui/worldPanel.js`; buses `eco:analytics`, `groups:analytics` consumed. |
| 5 | **No per-frame allocations in hot loops** | ✅ **Implemented (by design)** | `asParticleView`/`asView` explicitly return the existing `Float32Array` to avoid per-frame copies; flat typed-array buffer throughout; `_cachedMetrics` + `_metricsTick` memoization at `main.js:95-96`. |
| 6 | **Deterministic Web Worker path with main-thread fallback** | ✅ **Implemented** | `src/worker/physics.worker.js` (437 lines); `main.js:127-288` manages worker lifecycle, single-tick-in-flight, `CONFIG` resync; `canUsePhysicsWorker()` at `main.js:127`. Tests: `tests/unit/backendArchitecture.test.js`, `tests/e2e/physics-worker.spec.js`. |
| 7 | **Timeline record / scrub / restore** | ✅ **Implemented** | `engines/timelineEngine.js`; wired `main.js:28`; `TIMELINE_SNAPSHOT_INTERVAL = 150` (`main.js:91`). |
| 8 | **`npm test` green** | ✅ **Exceeded** | SPEC claims 39 tests; actual is **951 tests across 109 files**, all passing. |

### 3.3 Stale claims and documentation drift

| Item | Claimed | Actual | Severity |
|---|---|---|---|
| `SPEC.md` Acceptance §5 | "`npm test` green (**39 tests**)" | **951 tests** | Low (understates quality) |
| `SPEC.md` Predation § | "`LAW_COUNT = 52`" | **`LAW_COUNT = 136`** (`constants/laws.js:34`) | Medium — spec is 84 laws behind |
| `SPEC.md` Non-Goals | "No changes to the v2 legacy tree (`src/`, root `index.html`)" | `src/` **is** the v4 tree; the whole repo is v4 | Medium — contradictory |
| `vepa4:5` (launcher usage) | "production build into **.dist**" | `vite.config.js` → `outDir: 'dist'` | Low (comment only; no code path mismatch) |
| `vepa4:7` | "node --check every JS file in **v4/src** and **v4/tests**" | paths are `src/` and `tests/` at repo root | Low (stale comment) |
| `.gitignore:2` | `dist/` ignored | written as `.dist/` — matches nothing; **`dist/` is tracked (116 files)** | **High** |
| CI `.github/workflows/deploy.yml` | — | runs `npm ci && npm run build` only; **no `npm test` step** | **High** |
| Package manager | `bun.lock` **and** `package-lock.json` both committed | CI uses `npm ci` + `package-lock.json`; local/dev uses `bun` | Medium — two lockfiles can diverge |

---

## 4. Areas for Improvement

### 4.1 Code abstraction / reuse — ranked

| # | Priority | Action | Est. saving | Risk |
|---|---|---|---|---|
| A1 | **P0** | Extract `force3(ax, ay, az)` into `physics/lawgroups/_shared.js` wrapping `clamp(nanGuard(·), -50, 50)`; replace **64** inline triples | ~190 LOC, removes a 64-site bug surface | Low — mechanical, covered by 951 tests |
| A2 | **P0** | Create `core/numeric.js` exporting `clamp`, `nanGuard`, `num`, `hash2`, `dist2`, `freeze`; delete the **25 + 5 + 3 + 3 + 3 = 39** local definitions | ~120 LOC | Low |
| A3 | **P0** | Delete dead `applyAlloy` in `laws.js:1424` | ~40 LOC | Very low — unreferenced |
| A4 | **P0** | Fix `generate-spec.mjs` to read `src/constants/*.js` (§3.1) and regenerate | Correctness | Low, but **do before any regeneration** |
| A5 | **P1** | Unify DNA codec: one `dna/codec.js` with `readDNAParam` / `writeDNAParam`; replace 5 implementations incl. the duplicated `main.js:676/884` block | ~60 LOC, kills 5-way contract drift | Low |
| A6 | **P1** | Unify `fallbackCopy` into `core/clipboard.js`; unify `asView` into `render/zeroCopy.js` | ~20 LOC | Very low |
| A7 | **P1** | Introduce `createEngine(name, defaults, bus, config)` factory; collapse the 4 identical engine preambles and rename the 3 colliding `update` exports to `updateInsight/updateNarrative/updateGoal` (drop the import aliases at `main.js:20,25,27`) | ~60 LOC, removes 3-way name collision | Medium |
| A8 | **P1** | Extract `createAnalyticsPanel({id, event, header, cells, canvases, draw})` from the `ecoPanel`/`groupAnalytics` pair; then migrate `dnaAnalytics`, `speciesPanel`, `narrativePanel`, `intelPanel` | ~200 LOC across 6 panels | Medium |
| A9 | **P2** | **Reconcile `laws.js` with `lawgroups/`.** Migrate `laws.js`'s 117 functions to the explicit-`view` contract, then delete the `buffer_global` singleton and `setBuffer()`. Benefits: purity, testability, per-shard isolation in multiplex | Structural | **High — stage it, don't attempt in one pass** |
| A10 | **P2** | Extract a shared `render/core.js` (projection, background, cull margin, DPR) beneath `renderer.js` and `pixiRenderer.js` | ~80 LOC | Medium |
| A11 | **P2** | Split `multiplex/multiplex.js` (1,522 lines) into `shardLifecycle` / `metrics` / `snapshot` / `render` | Structural | Medium |
| A12 | **P2** | Decompose `main.js`'s 30+ module-level singletons into a single `worldRuntime` object | Structural | Medium |

**Sequencing note:** A1–A6 are all inside files with existing test coverage and can ship as one mechanical PR with the 951-test suite as the safety net. **A9 should not start until A1–A6 land**, because it will touch most of the same lines.

### 4.2 Repository hygiene

| # | Action | Rationale |
|---|---|---|
| H1 | Fix `.gitignore`: `.dist/` → `dist/`; `git rm -r --cached dist` | **High.** 116 build-output files and a 90-file duplicate of `docs/systems/` are versioned. |
| H2 | Delete `laws/` (or make it a symlink / generator output) | **High.** 397 of 398 files are byte-identical to `docs/audit/laws/a3/`; the one divergence (`physics.md`) is a live drift hazard. |
| H3 | Collapse the 3 `exports/*.md` concat artifacts to one | **High.** 4.8 MB of generated output, 2 of which are near-identical. The repo's own `repository-artifact-report.mjs` already flags `vepa-codebase-full-concat.md` as **`provenance-review-required`**. |
| H4 | Add `npm test` to `.github/workflows/deploy.yml` | **High.** 951 tests exist but never run in CI; a regression ships green. |
| H5 | ~~Remove archived tooling: `tests/run.mjs`, `scripts/patch-lawcat-test.mjs`~~ | ❌ **WITHDRAWN — this finding was wrong.** See §6.3. |
| H6 | Resolve dual lockfiles: pick npm **or** bun and delete the other | Medium — `bun.lock` + `package-lock.json` can drift. |
| H7 | Refresh `SPEC.md`: LAW_COUNT 52→136, test count 39→951, resolve the "no changes to `src/`" self-contradiction | Medium — spec is the input to traceability generation. |
| H8 | Make `generate-spec.mjs` import `LAW_INDEXES`/`LAW_CATEGORIES` (as `check-repository.mjs` does) instead of regex-parsing source text | Medium — removes the entire class of barrel-vs-file drift bug. |

---

## 5. Summary

**What is strong.** The simulation core is genuinely complete and well-evidenced: 136 laws with validated provenance and ontology coverage, 951 passing tests across 109 files, a passing repository contract, a deterministic worker path with a main-thread fallback, and all five intelligence engines verifiably wired into the orchestrator — the exact defect `SPEC.md` set out to fix. The correctness bar is high.

**What is weak.** Three structural problems dominate:

1. **Two parallel law architectures.** `laws.js` (117 fns, global-singleton buffer) and `lawgroups/` (78 fns, explicit `view`) coexist in one hot loop. This is the root cause of much of the duplication and blocks multiplex shard isolation.
2. **Hand-rolled repetition at scale.** 64 copies of the 3-axis clamped force shape, 39 local copies of 5 trivial helpers, 5 copies of the DNA serialization contract, 2 byte-identical renderers, 6 near-identical analytics panels. *(The "64 force shape" figure is corrected in §6.3 — only 30 of those 64 are force components.)*
3. **Build output and duplicate corpora in version control.** `dist/` committed via a `.gitignore` typo; `laws/` duplicating 397/398 audit files; ~7 MB of generated concats. The 3 MB `laws/` copy has *already* drifted.

**The single most urgent item is not a refactor — it is §3.1.** `scripts/generate-spec.mjs` parses the wrong file and resolves the law catalog to empty objects while reporting plausible-looking fallback numbers. The next person to run `npm run spec:generate` will silently replace a correct 136-law traceability tree with empty-catalog output. Fix that before any cleanup work.
---

## 6. Resolution Log (2026-09-30)

All code-level findings (A1–A8) and the hygiene fixes (H1, H4, H7, H8) were applied
the same day. Verification after every step.

### 6.1 Fixed — verification gates

| Gate | Before | After |
|---|---|---|
| `npm test` | 951 / 109 files green | ✅ 951 / 109 files green (no regressions) |
| `npm run spec:check` | ❌ **FAIL** (10 changed files) | ✅ **PASS** (180 generated files) |
| `npm run repository:check` | pass | ✅ pass (136 laws, provenance + signoff valid) |
| `validate-provenance` / `validate-signoff` / `exports:check` | pass | ✅ pass |
| `npm run build` | pass | ✅ pass (`dist/` emitted) |
| CI: tests before deploy | ❌ none | ✅ `npm test` + `repository:check` gate the deploy |

**§3.1 fixed (A4/H8).** `scripts/generate-spec.mjs` now reads the five defining
modules via `CONSTANTS_SOURCE_FILES` instead of the 6-line barrel, and a new
**parse-integrity guard** cross-checks the regex result against the live
`LAW_COUNT` / `LAW_INDEXES` / `LAW_CATEGORIES` (imported, not parsed). If a
constants file is ever split, renamed, or reformatted, the generator now
**throws** rather than silently emitting an empty law catalog. The tell —
`136 laws, 0 categories` — is gone; it now reports `136 laws, 9 categories`.

### 6.2 Fixed — new shared modules

| Module | Lines | Replaces | Local copies eliminated |
|---|---:|---|---|
| `src/core/numeric.js` | 96 | `clamp`/`clampForce`/`clamp01`/`clampTreasury`/`nanGuard`/`finite`/`num`/`hash2`/`centroidDist2`/`deepFreeze` | 25+9+5+3+3+3+2 → **2** |
| `src/physics/force.js` | 43 | `force3()` guarded force triple | 11 blocks / 30 components |
| `src/dna/codec.js` | 82 | `readDNAParam`/`writeDNAParam`/`quantizeDNA` | 5 → **1** |
| `src/core/clipboard.js` | 42 | `copyText`/`fallbackCopy` | 2 → **1** |
| `src/render/zeroCopy.js` | 25 | `asParticleView` | 2 → **1** (re-exported; renderer test API preserved) |
| `src/ui/analyticsPanel.js` | 105 | `mountAnalyticsPanel` panel shell | 3 × `setVal` → **1** |

**Traps found and avoided (these would have been silent breakage):**

- **`mechanicsLaws.js` called `clamp(expr)` with ONE argument**, relying on both
  the ±50 default bounds *and* a folded `Number.isFinite` check. Substituting the
  plain 3-arg `clamp` yields `clamp(x, undefined, undefined) → NaN`, poisoning
  every mechanics law. Resolved by exporting a distinct `clampForce` and aliasing
  it, so all 20 call sites are untouched.
- **`laws.js`'s `nanGuard` is narrower than the lawgroups'** — `(v !== v)` catches
  only NaN, while `Number.isFinite` also rejects ±Infinity. These are NOT the same
  function. `laws.js` keeps its local guard, now with a comment explaining the
  difference; unifying it is a physics-semantics change, deferred to the A9 pass.
- **64 → 30, not 64 (see §6.3).** Only 30 of the 64 `clamp(nanGuard(…))` sites
  are force components; the other 34 clamp *state scalars* (ENERGY 0–200, SIGNAL,
  POSITION bounds, ARMOR) against unrelated ranges. A blanket replace would have
  corrupted them.

Also fixed: dead `applyAlloy` removed from `laws.js` (A3, ~40 LOC, unreferenced —
the live copy is in `mergePhysics.js`); colliding engine `update` exports renamed
to `updateInsight`/`updateNarrative`/`updateGoal` and `setCurrentValue` →
`setGoalValue`, dropping 5 import aliases in `main.js` and 2 in
`tests/unit/engines.test.js` (A7); `SPEC.md` refreshed (LAW_COUNT 52→136, test
count 39→951, legacy-tree self-contradiction removed, verification-gate table
added) and the stale `vepa4` `.dist`/`v4/src` comments corrected (H7).

### 6.3 Corrections — two findings this audit got wrong

**(1) "64 copies of the force shape" was an overcount.** The count came from
`rg -c 'clamp\(nanGuard\('`, which matches *any* clamped guard, not just force
components. Classifying by property name shows only **30** are `{ax,ay,az}` force
returns (in `physicsLaws`, `quantumLaws`, `thermoLaws`); the other **34** clamp
buffer state against domain bounds. The A1 saving is therefore ~90 LOC across
11 blocks, not ~190 across 64 sites. The *conclusion* (one bug fix meant editing
dozens of sites) held, but the headline number did not.

**(2) H5 ("delete `tests/run.mjs` and `scripts/patch-lawcat-test.mjs`") was
wrong.** The artifact report labels them `archived-legacy-runner` /
`historical-migration-utility`, but project policy explicitly **retains them for
provenance**: `docs/LEGACY_TOOLING_INVENTORY.md`, `docs/REPOSITORY_HYGIENE.md`,
and `docs/AUDIT_REMEDIATION_PLAN.md` all say keep them outside active
verification, and `tests/unit/batch5Reports.test.js` **asserts their status**.
Deleting them would have broken a passing test and contradicted documented
policy. **H5 is withdrawn; both files stay.**

### 6.4 Deferred — and why

| Item | Status | Reason |
|---|---|---|
| **A9** — reconcile `laws.js` with `lawgroups/` (the `buffer_global` singleton) | ⛔ **Not attempted** | 103 exported functions across 117 top-level fns. Migrating to the explicit-`view` contract is a multi-pass refactor that would touch most of the same lines as A1–A6. Still the highest-value structural item: it unblocks multiplex shard isolation. **A1–A6 are a prerequisite, not a substitute.** |
| **A10** — shared `render/core.js` beneath both renderers | ⛔ Deferred | Only the `asView` duplication was removed (A6). A real backend abstraction touches the per-frame draw path of both renderers; needs a browser-render benchmark to validate, which CI does not run. |
| **A11** — split `multiplex.js` (1,522 lines) | ⛔ Deferred | Pure structural extraction with no duplication payoff; highest regression risk per unit of benefit. |
| **A12** — decompose `main.js`'s 30+ singletons | ⛔ Deferred | Belongs with A9 — both rewrite the same wiring. |
| **H2** — delete `laws/` (398 files, 397 byte-identical to `docs/audit/laws/a3/`) | ⛔ **Needs your decision** | Real 3 MB duplication and `physics.md` has already drifted. But `laws/` is a tracked tree, so removing it is a large, reviewable-in-nothing diff. Recommend deleting it and pointing any consumer at `docs/audit/laws/a3/`. |
| **H3** — collapse 3 `exports/*.md` concats to one | ⛔ **Needs your decision** | 4.8 MB of generated output; `vepa-codebase-full-concat.md` is already flagged `provenance-review-required` by the repo's own inventory. |
| **H6** — dual lockfiles (`bun.lock` + `package-lock.json`) | ⛔ **Needs your decision** | CI uses `npm ci` + `package-lock.json`; local dev here uses bun. Removing either breaks a workflow. This is a team call, not a cleanup. |

### 6.5 One manual step remains

`.gitignore` had `.dist/` (leading-dot typo) so `dist/` was versioned. It is now
`dist/`, and `isolate/`, `test-results/`, `playwright-report/` are ignored too.
**But fixing `.gitignore` does not untrack already-committed files.** `dist/`
(116 files) and `isolate/` (99 files) are still in the index, and the build has
since renamed hashed `dist/assets/*.js` filenames. To actually untrack them:

```bash
git rm -r --cached dist isolate
```

Left for you deliberately — it stages 215 file deletions, and the Changes panel
owns delivery. Note that `npm run build` writes to `dist/`, so keeping it tracked
means every build produces a spurious diff.

### 6.6 Current gate status

```
npm test                 ✅ 951 passed (109 files)
npm run syntax-check     ✅ clean
npm run spec:check       ✅ passed (180 generated files)
npm run repository:check ✅ passed (136 laws, provenance + signoff valid)
npm run build            ✅ built
```
