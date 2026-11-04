# VEPA4 — UI Overhaul Plan

**Status:** the first-pass scope and phases below are historical context. The approved second-pass plan is in §7; an explicitly authorized, partial implementation/review pass is recorded in §8. The overall overhaul is not complete or release-ready.
**Scope decision:** *Everything + refactors.* No tab is left as-is if the review found a defect in it.
**Companion:** `docs/systems/ui-module-report.md` (generated — never hand-edit) is the evidence base.
Every claim below that says a thing is broken cites a file and line; nothing here is inferred from
naming alone.

---

## 1. What the review found (evidence)

| # | Finding | Evidence |
|---|---------|----------|
| 1 | `INERTIA` (mechanics, law 130) is a **dead toggle** | imported at `src/physics/solver.js:121`, zero call sites; gate count for `active[LAW_INDEXES.INERTIA]` = 0 while all 7 sibling mechanics have ≥ 1. It also duplicates `MASS_INERTIA` (86), which *is* dispatched (`solver.js:1444-1447`). |
| 2 | LAWS help text is stale | `src/ui/helpRegistry.js:138` names the slate band "Elasticity, turbulence, centripetal force and rotation"; the real band is CONTACT 128, MOMENTUM 129, INERTIA 130, TORQUE 131, CONSTRAINT 132, FRAGMENTATION 133, TOPOLOGY 134, ADHESION 135. `LAW_COUNT` is **136** (`src/constants/laws.js:34`), not 128. |
| 3 | A `WRAP` law existed and was retired into a world param | `src/physics/solver.js:1676-1678` (verbatim comment): *"the WRAP law was retired into WORLD → SIMULATION RULES"*; body at ~1681 branches on `WP.TOROIDAL` with `WP.WALL_REFLECT` as the soft-wall path. |
| 4 | PRESETS is documented but renders nothing | `createPresetPanel` mounts into `#world-panel` (`src/ui/presetPanel.js:66`, `if (!panel) return;`). No such id exists in `index.html`. Consequence: `preset:refresh` / `preset:stateResponse` never arrive; `preset:saved` / `preset:deleted` / `preset:requestState` reach nothing. `src/state/presetManager.js` is unreachable. **Boot presets are unaffected** — they come from `src/state/launchSettings.js` → `presetFor()`. |
| 5 | Two owners for backend + engine | `renderBackend` and `computeEngine` are both launch-modal fields (`LAUNCH_FIELDS`) *and* SETTINGS controls (`src/ui/settingsPanel.js`), with no stated precedence. |
| 6 | `narrative:batch` has no emitter | `src/ui/narrativePanel.js:110` listens; nothing sends it. The only performance lever on a long run. |
| 7 | `group:declare` has no producer | `src/main.js:1098` subscribes; nothing emits. The "declared by the player" path GROUPS help advertises cannot happen. |
| 8 | GROUPS tooltip is self-admittedly misleading | `src/ui/helpRegistry.js:100` — *"titled 'Civilizations (Set F)' … which is misleading"*. |
| 9 | `src/ui/dnaPanel.js` (184 lines) is unreachable | a complete grouped 64-slider editor (Motion / Matter / EM / Biology / Communication / Genetics) that nothing mounts, while SPECIES shows 3 sliders + `#dna-accordion`. |
| 10 | `drawAll` never executed by tests | `src/ui/ecoPanel.js`, `src/ui/groupAnalytics.js`, `src/ui/civilizationPanel.js`. Same class of defect shipped a `ReferenceError` in `civilizationPanel` for a full release. **Blocker for editing CIVILIZATION.** |
| 11 | DNA ANALYTICS expansion is bound to double-click | `src/ui/dnaAnalytics.js` (548 lines) — a desktop gesture in a touch-first drawer. Button label "DNA" vs title "DNA ANALYTICS" mismatch. |
| 12 | `#laws-panel` lives inside SETTINGS | `index.html:160`. `lawPanel.js` *appends* its 136-tile category grid to it after `settingsPanel` has rendered. Two owners of one container — the entanglement that let the preset panel target a container that no longer exists. |

---

## 2. Updated review, per sub-tab (in light of the answers)

### SETUP → LAWS
- **Law count / band text** — correct the help string to 136 laws and the real slate band (finding 2).
- **Search / filter box** *(answer: yes)* — a text input over `LAW_INDEXES` keys + help hints, filtering tiles by substring; combined with the existing `cat-tab` category row so search **and** category compose (search narrows, a category hides).
- **Per-category all on / off** *(answer: yes)* — a small ON / OFF pair on each category header row, driven through the same `law:toggled` emit the tiles use, so `worldPanel` and `lawPanel` stay in step via `law:sync`.
- **Category headers with active counts** — `PHYSICS 7/16` style, so the grid answers "what is on?" without counting lit tiles.
- **No-dead-toggle audit test** — every `LAW_INDEXES.X` must appear in a solver gate or on an explicit allow-list. This is the test that would have caught finding 1 on day one.
- **Preset-origin dot** — tiles whose state came from a preset get a marker, so "why is this on?" has an answer.
- **WRAP** arrives in Phase 1.

### SETUP → WORLD
- **Revive presets here** *(answer: revive inside WORLD)* — mount the preset panel in a real `#world-panel` that WORLD owns, not SETTINGS. `src/state/presetManager.js` stops being dead code.
- **TOROIDAL + WALL REFLECT** grouped under a "BOUNDARIES" heading that names the WRAP law as their law-level switch.
- **Split the 553-line panel** into three sections — parameters / law grid / presets — instead of one module doing three jobs.
- **Per-section reset-to-preset.**

### SETUP → SPECIES
- **Adopt `dnaPanel.js`'s grouping** rather than leaving it unreachable — the six groups (Motion / Matter / Electromagnetism / Biology / Communication / Genetics) become the accordion's sections.
- **Expose the 22 genome-only regulatory traits** (DNA 42-63), which are currently invisible in the UI.
- **Per-species diff vs preset baseline**, **clone/reseed**, and the metastability warning surfaced in-UI instead of only in help text.

### SETUP → SETTINGS
- **Single source of truth for backend + engine** *(finding 5)* — the launch modal sets the *initial* value; SETTINGS overrides live; a "use as launch default" button writes SETTINGS back into `launchSettings`.
- **Inline "requires reload" badges** — the only honest way to show that a compute backend change is not instant.
- **Per-section reset**, **export/import**.
- **Resolve the `#laws-panel` ownership** (finding 12): the container moves to LAWS, SETTINGS stops co-owning it.

### WORLD STATES (SAVES)
- **Three sub-tabs** *(answer: three)* —
  1. **WORLD STATES** — list, compare, load, delete, per-entry size / tick / timestamp and a diff preview.
  2. **UNDO** — history plus `canUndo`/`canRedo`, lifted out of `main.js` into the panel that shows it.
  3. **IMPORT / EXPORT** — file pick and download, currently interleaved with the list.

### DATA → INTELLIGENCE
- "Since last snapshot" deltas, fold SNAPSHOTS + RECORDING into one view, jump-to-restore that hands off to SAVES.

### DATA → DNA ANALYTICS
- **Explicit EXPAND / CLOSE + pin** replacing double-click *(finding 11)*, per-species legend with visibility toggles, split into graphs / trait table / history modules, align the button label with the panel title.

### DATA → LOGS
- **Filter chips by category**, pause-autoscroll, per-category counts, and **`narrative:batch` actually emitted** as a throttled flush *(finding 6)* — the only lever that keeps a long run's log panel from becoming the bottleneck.

### DATA → GROUPS
- Fix the tooltip title *(finding 8)*; group selection + detail row (leader, treasury trend, alliances, artifacts); either wire `group:declare` to a real button or drop the claim from help *(finding 7)*.

### DATA → ECOSYSTEM
- **Species leaderboard** *(answer: leaderboard in ECO)* — top N by population with sparkline; extinction list with tick and recovery-threshold status; a one-line "who eats whom" read from `PREDATION_BIAS`.

### DATA → CIVILIZATION
- **CODEX promoted** *(answer: promoted in CIV)* to a full-width block with a "last changed" stamp; band cells CULTURE / POWER / READING.
- **Gated on finding 10** — the `drawAll` test gap closes before a single line of this panel changes.

### Shared selection context
*(answer: yes — shared context)* — one selected species or group, owned by a small module, honoured by INTELLIGENCE, DNA ANALYTICS, ECO and CIVILIZATION. Selecting in one panel filters the rest instead of making the reader cross-reference four read-only grids by eye.

---

## 3. Phases (executed in order)

Each phase is self-contained: it ends with the full 10-gate set green and a version bump.

| Phase | Contents | Why here |
|-------|----------|----------|
| **0 — Audit infrastructure** | No-dead-toggle law test; `drawAll` coverage for eco / group / civilization; LAWS help text correction; GROUPS tooltip title. | The tests that catch the next dead toggle and the next `ReferenceError` must exist *before* the code they guard changes. Cheap, and it makes every later phase verifiable. |
| **1 — Mechanics swap** | Delete `INERTIA`: `applyInertia` + `diagnoseInertia`, `MECHANICS_HELP.INERTIA`, `MECHANICS_PARAMETERS.INERTIA`, `LAW_DEPENDENCIES[130]`, `MECHANICS_ICONS.INERTIA`, the ontology records, and the solver import. Add **WRAP at 130**: a stateless `applyWrapBoundary` in `mechanicsLaws.js` holding the wrap-vs-soft-wall body, gated by `active[LAW_INDEXES.WRAP]` in the solver; `WP.TOROIDAL` stays as the *default* that seeds the bit at world load; 4-tier help + dependencies + icon. | A mechanic swap is the one change here that alters the simulation, so it gets its own phase and its own tests rather than riding along inside a UI phase. |
| **2 — Shared selection context** | New selection module + `selection:changed` on the bus; adopted by INTELLIGENCE / DNA ANALYTICS / ECO / CIVILIZATION. | Every later data-panel phase builds on it; landing it second means the drill-down work in Phase 4 has one mechanism to plug into instead of three. |
| **3 — SAVES + presets** | SAVES three sub-tabs; preset panel revived inside WORLD; `#laws-panel` ownership resolved; WORLD split into parameters / law grid / presets. | Structural, and it unblocks the SETTINGS precedence work in Phase 6 (which currently depends on knowing who owns which container). |
| **4 — Data panels** | Drill-down on the shared selection; ECO leaderboard; LOGS filter chips + `narrative:batch` flush; CODEX promotion; DNA ANALYTICS expand/pin + legend; GROUPS selection detail and the `group:declare` decision. | Depends on Phase 2 for selection and Phase 0 for the `drawAll` safety net. |
| **5 — LAWS grid** | Search / filter box; per-category all on / off; active counts; preset-origin dot. | Pure grid work, no data dependency — sequenced last among the UI phases because it is the easiest to verify in isolation and the easiest to regress silently. |
| **6 — SETTINGS precedence + docs** | Backend/engine single owner, reload badges, per-section reset, export/import; then the documentation sync across `CHANGELOG.md`, `SPEC.md`, `PLAN.md`, `GUIDE.md`, `audit-suite/`, `docs/spec/`. | Closes the plan with the cross-cutting concern and the ledger, so one release covers the whole overhaul. |

**Release:** one version for the whole plan (minor bump from 9.1.28 — the change set is large and lands together).

---

## 4. Verification, per phase

The 10 gates, unchanged:

```
npm run syntax-check · npm run test · npm run spec:generate · npm run spec:check
npm run repository:check · node scripts/validate-provenance.mjs
node scripts/validate-signoff.mjs · node scripts/check-export-publication.mjs
node scripts/audit-corpus-report.mjs · npm run build
```

Any source change makes `docs/spec/` stale, so `spec:generate` runs **after** the version bump and
before `spec:check` / `repository:check`.

**Standing limitation, stated honestly in the changelog:** there is no real-browser verification in this
environment (Chromium cannot launch, vitest runs `environment: 'node'`, no DOM library). UI work is
covered by the `tests/helpers/domStub.js` harness and by structural assertions on markup — not by
clicking anything.

**Standing blind spot that Phase 0 closes:** `ecoPanel.drawAll` and `groupAnalytics.drawAll` have never
been executed by a test. A `ReferenceError` of exactly that shape shipped in `civilizationPanel` for a
full release.

---

## 5. Decisions taken, with reasons

| Decision | Reason |
|----------|--------|
| WRAP gates the *existing* toroidal body rather than adding a new one | The physics is already correct and already documented as having been a law. The defect was that it became a world param and lost its toggle. Re-adding the toggle restores the intent without touching the simulation's behaviour. |
| `WP.TOROIDAL` remains, as the default | The world param is how a saved world records its boundary mode. The law bit is the live switch; the param is the initial value. Collapsing them would break world saves. |
| `dnaPanel.js` is adopted, not deleted | It is a finished grouped editor. Deleting it would remove the SPECIES grouping the review asks for; adopting it costs one import. |
| Phase 0 exists at all | Findings 1, 6, 7 and 10 are all *the same defect class* — a toggle or a code path that nothing exercises. Fixing instances without fixing the class just moves the bug to the next release. |

---

## 6. Second-pass decision ledger — 2026-10-01

**Status:** questionnaire complete — 80 of 80 decisions recorded (16 of 16 surfaces complete). DNA-1 is clarified as the custom tab title `DNA`.
**Baseline:** VEPA4 9.2.0, `main` at `faea148`.
This section records decisions, not implemented features. The first-pass phases above are
historical intended scope, not proof of full completion. No second-pass application changes,
release, commit, push, or deployment are authorized by these questionnaire answers alone.
Unanswered questions retain no assumed default; questionnaire option A is a recommendation only.

### SETUP — main tab (section 1)

User response: `A, C, A, A, A`.

| ID | Choice | Decision |
|----|--------|----------|
| SET-1 | A | Icons with text on the active tab. |
| SET-2 | C | Apply every setup operation immediately; do not silently substitute staged APPLY or disruptive-operation previews. Reconcile any later surface-specific confirmation choices explicitly. |
| SET-3 | A | One undo step per completed gesture or bulk action. Capture pre-change state and coalesce intermediate updates. |
| SET-4 | A | Essential controls first, advanced sections expandable. |
| SET-5 | A | Visible contextual help control plus existing hold/right-click help. |

### SETUP → LAWS (section 2)

User response: `A, A, B, C, A`.

| ID | Choice | Decision |
|----|--------|----------|
| LAW-1 | A | Search names, categories, and help hints; compose search with category visibility. |
| LAW-2 | A | Bulk actions affect visible matches, explicitly labeled with the target count. |
| LAW-3 | B | Preserve WORLD boundary mode during bulk law changes. The WRAP exception must be explicit in bulk scope/counts/feedback rather than claiming it changed when it did not. Individual WRAP/WORLD controls remain synchronized. |
| LAW-4 | C | Plan a separate physics implementation of metadata-only ELECTRIC_FIELD as part of this overhaul; defining its distinct semantics, dispatch, dependencies, fidelity tests, four-tier help, audit, and documentation remains pending design work. Do not assume implementation is complete or merely alias FIELD. |
| LAW-5 | A | Tap toggles a law; a separate details control shows dependencies and preset/manual origin. |

### SETUP → WORLD (section 3)

User response: `B, A, A, A, B`.

| ID | Choice | Decision |
|----|--------|----------|
| WLD-1 | B | Separate built-in world and custom configuration preset sections. |
| WLD-2 | A | Preview configuration preset changes and choose configuration-only or configuration + reseed. This is an explicit surface-specific exception to SET-2's immediate-application default. |
| WLD-3 | A | Keep accordions, add search and a dedicated BOUNDARIES section. |
| WLD-4 | A | Reset sections to the applied preset baseline; provide factory reset separately. |
| WLD-5 | B | Automatically reseed when necessary for disruptive parameter changes; do not add an unrequested reseed confirmation. |

### SETUP → SPECIES (section 4)

User response: `A, C, A, A, A`.

| ID | Choice | Decision |
|----|--------|----------|
| SPC-1 | A | Improve the existing eight groups rather than mounting a second editor. All 64 traits already exist in the current editor. |
| SPC-2 | C | Keep editing selection independent of DATA analytics selection. |
| SPC-3 | A | ADD SPECIES offers a selected-species clone, template, or defaults. |
| SPC-4 | A | Show changed traits and reset options against the applied preset baseline. |
| SPC-5 | A | Preview populated-species deletion impact, confirm, and support undo. This is an explicit surface-specific exception to SET-2's immediate-application default. |

### SETUP → SETTINGS (section 5)

User response: `A, A, A, A, B`.

| ID | Choice | Decision |
|----|--------|----------|
| CFG-1 | A | Remove the SETTINGS law grid and link to LAWS. |
| CFG-2 | A | Explicit APPLY for backend changes; switch live where supported and use safe reload otherwise. This is a backend-specific exception to SET-2. |
| CFG-3 | A | Separate apply-this-session from save-launch-default; reload preserves pending choices. |
| CFG-4 | A | Show requested backend, actual backend, fallback reason, and pending changes. |
| CFG-5 | B | Per-section reset only; settings import/export is not selected. |

### SAVES — main tab (section 6)

User response: `A, C, A, A, A`.

| ID | Choice | Decision |
|----|--------|----------|
| SAV-1 | A | Name the main tab SAVES, with WORLD STATES as the first sub-tab. |
| SAV-2 | C | Offer lightweight and full snapshot types; clearly define and verify their respective payloads and restoration guarantees. Do not claim deterministic continuation without supporting state and tests. |
| SAV-3 | A | Show storage backend, estimated usage, limits, and persistence warnings. |
| SAV-4 | A | Protect named saves; evict automatic checkpoints first and explain limits. |
| SAV-5 | A | Progress/errors stay in the originating sub-tab plus a shared status strip. |

### SAVES → WORLD STATES (section 7)

User response: `A, A, B, C, A`.

| ID | Choice | Decision |
|----|--------|----------|
| STA-1 | A | Compact rows with an expandable detail preview. |
| STA-2 | A | Search, sort, and manual/automatic filters. |
| STA-3 | B | Checkpoint and load immediately, preserving pause state; no load-preview requirement. |
| STA-4 | C | Include civilization/CODEX differences as well as summary, law, DNA, and world-parameter differences. |
| STA-5 | A | Duplicate names offer REPLACE or SAVE COPY. |

### SAVES → UNDO (section 8)

Initial response: `A, C, C, n`; clarified response: `A, C, C, A, B`.

| ID | Choice | Decision |
|----|--------|----------|
| UND-1 | A | Show past → LIVE → redo steps, distinguishing LIVE from stored checkpoints. |
| UND-2 | C | Provide both stepwise undo/redo and checkpoint jump navigation. |
| UND-3 | C | User-configurable step limit rather than a fixed eight-step or memory-budgeted capacity. |
| UND-4 | A | Track all user world mutations, coalescing intermediate gesture updates into one undo step. |
| UND-5 | B | Persist the full undo ring across reloads. |

### Interaction precedence

The recorded surface-specific choices explicitly qualify SET-2: preset loads
preview changes (WLD-2), populated-species deletion previews and confirms (SPC-5),
and backend changes use APPLY (CFG-2). Ordinary edits remain immediate, and
necessary parameter reseeding is automatic (WLD-5). SPECIES editing selection
stays independent (SPC-2); DATA selection choices DAT-1–3 have now been recorded in section 10 and should be interpreted there.

### SAVES → IMPORT / EXPORT (section 9)

User response: `A, A, C, C, A`.

| ID | Choice | Record |
|----|--------|--------|
| IO-1 | A | Original questionnaire option A selected. |
| IO-2 | A | Original questionnaire option A selected. |
| IO-3 | C | Original questionnaire option C selected. |
| IO-4 | C | Original questionnaire option C selected. |
| IO-5 | A | Original questionnaire option A selected. |

### DATA — main tab (section 10)

User response: `A, C, B, A, A`.

| ID | Choice | Record |
|----|--------|--------|
| DAT-1 | A | Original questionnaire option A selected. |
| DAT-2 | C | Original questionnaire option C selected. |
| DAT-3 | B | Original questionnaire option B selected. |
| DAT-4 | A | Original questionnaire option A selected. |
| DAT-5 | A | Original questionnaire option A selected. |

### DATA → INTELLIGENCE (section 11)

User response: `A, A, C, A, B`.

| ID | Choice | Record |
|----|--------|--------|
| INT-1 | A | Original questionnaire option A selected. |
| INT-2 | A | Original questionnaire option A selected. |
| INT-3 | C | Original questionnaire option C selected. |
| INT-4 | A | Original questionnaire option A selected. |
| INT-5 | B | Original questionnaire option B selected. |

### DATA → DNA ANALYTICS (section 12)

User response: `D, A, B, C, C`; clarification: `DNA`. The user intends the custom tab title `DNA` for DNA Analytics (not one of the offered A–C labels).

| ID | Choice | Record |
|----|--------|--------|
| DNA-1 | D → custom `DNA` | Use `DNA` as the tab title. |
| DNA-2 | A | Original questionnaire option A selected. |
| DNA-3 | B | Original questionnaire option B selected. |
| DNA-4 | C | Original questionnaire option C selected. |
| DNA-5 | C | Original questionnaire option C selected. |

The option letters above preserve the user’s selections verbatim; no unrecorded option meanings are inferred.

### DATA → LOGS (section 13)

User response: `B, A, A or C, C, C`, with a custom clarification for controls and behavior.

| ID | Choice | Decision |
|----|--------|----------|
| LOG-1 | B | Newest entries first; follow the top when following is enabled. |
| LOG-2 | A | Support voice and event-type filters plus text search. Provide separate Filter and Search controls, with the follow toggle in the same top-right control area. |
| LOG-3 | A or C | Provide a top-right follow toggle that lets the user choose between always following the newest entry (C) and holding their place with a new-items count and RESUME affordance (A). The initial toggle state is unspecified; do not assume one. |
| LOG-4 | C | Persist logs locally. |
| LOG-5 | C | Clearing removes the current display while retaining searchable history. |

### DATA → GROUPS (section 14)

User response: `A, A, C, C, C`.

| ID | Choice | Decision |
|----|--------|----------|
| GRP-1 | A | Original questionnaire option A selected. |
| GRP-2 | A | Original questionnaire option A selected. |
| GRP-3 | C | Original questionnaire option C selected. |
| GRP-4 | C | Original questionnaire option C selected. |
| GRP-5 | C | Original questionnaire option C selected. |

The option letters above preserve the user’s selections verbatim; no unrecorded option meanings are inferred.

### DATA → ECOSYSTEM (section 15)

User response: `C, B, C, C, A/B/C`.

| ID | Choice | Decision |
|----|--------|----------|
| ECO-1 | C | Show both the species-population leaderboard and ecosystem-health metrics, with one designated primary view. |
| ECO-2 | B | Keep species selection local to ECOSYSTEM. |
| ECO-3 | C | Include both per-species sparklines and detailed history for the selected species. |
| ECO-4 | C | Provide a separate extinction/recovery view. |
| ECO-5 | A/B/C | Include both inferred and observed food-web links, clearly distinguish inferred from observed, and let users switch/filter the view. |

### DATA → CIVILIZATION (section 16)

User response: `C, B, B and C, C, C`.

| ID | Choice | Decision |
|----|--------|----------|
| CIV-1 | C | Make CODEX collapsible and persist its open/closed state. |
| CIV-2 | B | Keep selection local to CIVILIZATION. |
| CIV-3 | B and C | Show current state and last-changed time, with a change history. |
| CIV-4 | C | Show dedicated culture/power/reading bands plus an overall summary. |
| CIV-5 | C | Explain what populates CIVILIZATION and show available systems with inactive status when applicable. |

All 80 questionnaire decisions are recorded. The section below is the approved second-pass implementation plan. The user subsequently authorized implementation and adversarial review; the current partial release scope is recorded in §8 and does not satisfy the full plan.

---

## 7. Approved second-pass implementation plan — 2026-10-05

**Authority:** This section consolidates the complete second-pass answers in §6 and supersedes the sequencing and assumptions in the earlier first-pass proposal in §3 wherever they conflict. The earlier findings and evidence in §§1–2 remain useful audit context, not proof that a finding is still present in the live code. Before implementation, re-check each finding and each first-pass deliverable against current source and tests; reuse completed work and do not regress or duplicate it.

**Current boundary:** §7 remains the full acceptance target; the user authorized the current workspace changes for release. The delivered slice implements only a subset and does not satisfy the overall plan. The untracked `docs/spec/laws/mechanics/130_WRAP.md` is retained; see §8 for remaining gaps and verification limitations.

### 7.1 Product-wide interaction contract

- Show icons with text on the active top-level tab; keep advanced controls expandable and contextual help visible.
- Ordinary edits apply immediately and each completed gesture or bulk action creates one undo step. Preserve the explicit exceptions: WORLD preset application previews configuration-only vs. configuration-plus-reseed; deleting a populated species previews impact and asks for confirmation; backend changes use an explicit APPLY flow. Disruptive world-parameter changes reseed automatically when required, without an extra confirmation.
- Maintain distinct selection ownership. SPECIES editing does not follow DATA selection; ECOSYSTEM and CIVILIZATION keep their selections local; GROUPS selection follows GRP-1's requested cross-panel highlight/filter behavior. Do not infer broader synchronization for other DATA panels from an unavailable option description.
- Across controls, never claim a bulk action changed a setting it excluded. For LAWS bulk actions, preserve WORLD boundary mode and explain WRAP scope/count/feedback; keep individual WRAP and WORLD controls synchronized.
- Do not claim full deterministic continuation for saves unless the captured/restored state and tests establish it. Preserve pause state on immediate world-state load and provide compare coverage for civilization/CODEX.

### 7.2 Phased implementation sequence

| Phase | Scope and required outcomes | Exit criteria |
|---|---|---|
| **0 — Live-state reconciliation and safety net** | Re-audit the §1 findings against live code; inventory first-pass changes already shipped; identify current routes, ownership, message flows, state formats, and actual npm scripts. Add/fix tests that execute `drawAll` for ECO, GROUPS, and CIVILIZATION; establish a no-dead-law-dispatch check; fix confirmed stale LAWS/GROUPS help. Do not repeat already-satisfied work. | Evidence table links each finding to current source and a regression test or documented non-applicability. Tests fail for the defect and pass for its repair. Browser-verification limitation remains explicit. |
| **1 — Mechanics contracts: WRAP and ELECTRIC_FIELD** | Verify the live law map and the user’s untracked WRAP spec before touching them. Preserve the current five-word law-state format and `LAW_INDEXES` SSOT. Confirm WRAP's law/world-setting precedence and ensure individual controls and bulk-operation messaging agree. Separately design ELECTRIC_FIELD's unique physics semantics, inputs/outputs, solver dispatch, dependencies, stability bounds, interactions with FIELD, four-tier help, law spec, audit/fidelity cases, and docs before implementing it; do not alias FIELD or invent behavior by name. | WRAP control/worker/save-load behavior is tested end-to-end at unit/integration level. ELECTRIC_FIELD has an accepted precise behavior spec and meaningful on/off/differential tests before its solver implementation is considered complete. |
| **2 — SETUP structure and application semantics** | **WORLD:** distinguish built-in worlds from custom configuration presets; revive/verify preset UI under WORLD; preview preset changes and offer configuration-only or configuration + reseed; preserve accordions while adding search; provide BOUNDARIES; section reset returns to applied-preset baseline and factory reset is separate. **SPECIES:** improve the existing editor’s eight groups (do not create a duplicate editor); expose all 64 traits, including 22 genome-only traits; clone/template/defaults on add; show diffs against applied-preset baseline; preview/confirm populated deletion and offer undo. **SETTINGS:** remove duplicate law grid and link to LAWS; backend edits have explicit APPLY and report requested/actual/fallback/pending states; distinguish session settings from launch defaults and preserve pending choices on reload; reset per section only, no settings import/export. | UI tests cover each reset baseline, preset preview/apply mode, deletion preview/undo, settings pending/apply/reload behavior, all 64 DNA controls, and sole ownership of law controls. No duplicate or hidden container ownership remains. |
| **3 — SAVES, restore, and transfer** | Use SAVES as the top-level name and maintain WORLD STATES / UNDO / IMPORT-EXPORT surfaces. Support lightweight and full snapshot offerings only with their payloads/restoration guarantees defined and tested; show backend, usage, limits, warnings; protect named saves and evict automatic checkpoints first. WORLD STATES: compact expandable rows, search/sort/type filters, immediate checkpoint-and-load while preserving pause state, compare summary/law/DNA/world parameters plus civilization/CODEX, and duplicate-name REPLACE or SAVE COPY. UNDO: past → LIVE → redo, stepwise plus checkpoint jump, configurable limit, all user world mutations with gesture coalescing, persist full ring across reloads. IMPORT/EXPORT behavior must implement the recorded IO selections only after their original option wording is recovered (see §7.4). | Save/restore tests prove each advertised guarantee, including all law-state words and relevant world/civilization state; undo round-trip survives reload and obeys capacity; compare includes requested fields; named saves are never evicted by automatic cleanup. Transfer formats validate malformed/unsupported input and report failures without corrupting current state. |
| **4 — DATA panels and long-running telemetry** | **INTELLIGENCE:** implement the recorded INT selections after recovering their question/option wording. **DNA:** label the tab `DNA`; use explicit expand/close and pin rather than double-click; provide per-species visibility legend and recorded DNA-2..5 choices once their original option wording is recovered. **LOGS:** newest-first; Filter (voice + event type) and Search controls plus top-right follow toggle; toggle between following newest and holding scroll position with new-item count/RESUME; initial toggle state remains unspecified until decided or made an explicit implementation detail; persist logs locally; clear display but retain searchable history; ensure `narrative:batch` is emitted as a throttled flush. **GROUPS:** group list first; selection highlights/filters relevant other DATA panels; show both leader/membership/species and treasury/policy/trade details in expandable detail; support manual creation and automatic detection with origin labels; switch relationship layer between alliances/conflicts and trade flows. **ECOSYSTEM:** show both population leaderboard and health metrics with one primary view; selection stays local; provide per-species sparklines and selected-species history; separate extinction/recovery view; distinguish inferred from observed food-web links and provide a switch/filter. **CIVILIZATION:** CODEX collapsible with open state saved; selection local; current state + last-changed time + change history; dedicated CULTURE/POWER/READING bands and overall summary; explain population conditions and mark available inactive systems. | Each panel’s `drawAll` path is exercised; event flows have producer/consumer tests; log persistence/clear/filter/follow behavior is covered; shared vs local selection behavior follows the per-surface contract, not a global implicit selection. ECO and CIV findings remain subject to Phase 0 test gate. |
| **5 — LAWS experience** | Put law grid under LAWS only; search names/categories/help hints combined with category filtering; bulk operations apply only to visible matches and announce target count; preserve boundary mode with explicit WRAP scope; category active counts; separate tile-toggle and detail action; detail shows dependencies and preset/manual origin; correct all stale law-count/category help. | UI tests cover search/category composition, Enter/keyboard use, visible-match bulk counts, boundary exception feedback, law detail access, and bitmask synchronization through `LAW_INDEXES` helpers. |
| **6 — Integration, documentation, and release readiness** | Run cross-panel and full-regression testing; sync CHANGELOG, README, SPEC/PLAN, GUIDE, law/spec docs, LAW_HELP_DB, and audit-suite as applicable. Resolve all unresolved acceptance details before source work; verify version alignment and follow release protocol only if a separately authorized release is requested. | All applicable repository gates pass; any failures are fixed rather than bypassed; browser/manual verification is reported honestly. No deploy or Git delivery unless explicitly requested. |

### 7.3 Cross-cutting acceptance criteria

1. Existing tab/sub-tab navigation remains functional and surfaces follow the ownership rules above; no missing DOM mount target or duplicate owner silently drops events/UI.
2. All toggles and bulk operations reflect actual state, use the 136-law/five-word live architecture, and never hardcode law indices or fabricate successful changes.
3. Save, restore, undo, and transfer guarantees are backed by round-trip tests against real serialized state. Unsupported guarantees are removed from copy rather than simulated.
4. Analytics and log panels handle empty, populated, filtered, selected, and high-volume states; rendering functions that previously escaped tests execute in tests.
5. User-facing statuses explain pending, fallback, inactive, inferred, and persisted state. Destructive actions follow the surface-specific preview/confirm rules.
6. Every functional change is documented and audited under the project mandates; tests are not weakened to accommodate the implementation.

### 7.4 Decision traceability and specification gaps

The complete raw response record is in §6. Implement explicit semantic decisions listed in §7.1–7.3 as written. Some answers in SAVES → IMPORT/EXPORT (IO-1..5), DATA main tab (DAT-1..5), INTELLIGENCE (INT-1..5), and DNA ANALYTICS (DNA-2..5) are currently recorded only as option letters because the wording of those original choices is not present in the durable ledger. Before implementation of those individual decisions, recover the actual prompt/option text from the conversation or ask the user to restate it; do not infer meanings from A/B/C. This is a documentation completeness prerequisite, not an unanswered questionnaire slot. Other explicit unresolved details—such as LOG-3's initial follow-toggle state and which view is primary where the answer requests both—must be handled as reversible UI defaults and documented, not misrepresented as user-selected preferences.

---

## 8. Adversarial review and improvement ledger — 2026-10-05

**Review scope:** the actual second-pass source changes in this workspace (ECO sparkline calculation, five-word save/restore accounting, LOGS queue and controls, and LAWS search/bulk feedback), plus the save/epoch wiring they touch. Unit UI coverage here uses `tests/helpers/domStub.js`; it is not browser verification.

### 8.1 Findings and disposition

| Severity | Adversarial finding | Evidence and action |
|---|---|---|
| High | The ECO leaderboard built sparkline data after an early return, referring to rows that did not exist on that path. | Fixed by constructing/sorting `rows` before applying one shared sparkline scale; `analyticsDrawPaths.test.js` checks ordered rows and real nonempty spark data, and invokes ECO/GROUPS/CIV draw paths. |
| High | Save summaries, restoration, export/import, and undo identity had to account for the live fifth law-state word; otherwise WRAP state could disappear or a save could be miscounted. | Capture/restore/export parse and fingerprints now carry `penta`; summary includes its popcount; tests cover WRAP, a legacy four-word payload, and penta-only fingerprint changes. |
| High | Ordinary named snapshots serialized civilization/CODEX but epoch checkpoints did not, so returning to a previous era could silently lose ontology state. | Epoch `captureFn` now includes both serialized payloads; `civilizationSequelWiring.test.js` pins this orchestrator contract. |
| Medium | LOGS declared a batch consumer without an effective producer; panel recreation could stack listeners and leave timers/listeners behind. | Queue batches both narrative/system events and can unsubscribe/drop pending work on stop; panel recreation stops prior queue and removes UI/bus listeners. Tests assert both source unsubs, same-bus recreation, one delivery, and no duplicate stored row. |
| Medium | LOGS previously had no retained-history search, event-type filter, clear-view semantics, or visible follow hold/resume feedback; outer and inner containers both scrolled. | Added persisted bounded history, search and voice/type filters, clear-view retaining searchable history, hold/new count/RESUME; CSS makes only the inner log list the scrollport. Unit coverage passes; actual browser layout/scroll has not been verified. |
| Medium | LAWS search only considered names and Enter used a non-browser `.find` on `NodeList`; bulk actions could imply hidden/excluded laws changed. | Search includes category and help hint; Enter converts NodeList to an array; bulk scope is visible matches, WRAP is excluded with count and explicit no-op/action feedback. Focused grid tests cover these cases. |
| Low | BUOYANCY's description falsely said it replaced WRAP, conflating thermal force with boundary topology. | Corrected the help text and added a regression assertion that buoyancy explicitly describes independence from WRAP. |
| Risk | The new save fingerprint compares serialized civilization/CODEX JSON; key-order variations may conservatively prevent deduplication, while cyclic payloads would throw. Current serializers produce JSON-like data; if those contracts expand, replace this with a tested canonical fingerprint. | Recorded as follow-up risk; do not treat fingerprint equality as a deep structural canonicalization guarantee. |

### 8.2 Improvement plan and completion status

The review-driven repairs above have been implemented and their focused checks rerun (see status in the task report). Remaining prioritized work is:

1. **Release blockers — finish approved scope:** implement all remaining §7 surfaces, especially presets/WORLD/BOUNDARIES, SPECIES all-64-trait workflows, SETTINGS single law ownership and apply state, complete SAVES/UNDO/IO guarantees, DNA analytics controls, GROUPS selection/details, ECO filters/history/extinction views, CIVILIZATION history/bands, and LAW detail/origin. The current patch is a partial slice, not “the UI overhaul.”
2. **Resolve decision provenance before building ambiguous behavior:** recover exact option text for IO-1..5, DAT-1..5, INT-1..5, DNA-2..5 and record it here/§6. Do not infer behaviors from letters. Choose/document LOG-3 default and the primary view choices reversibly.
3. **Close the mechanics design gate:** author and approve precise ELECTRIC_FIELD semantics before solver work; run WRAP individual-toggle, WORLD default/synchronization, worker, save/load and boundary tests.
4. **Browser acceptance:** Playwright is configured, but the local Chromium launch currently fails because `libglib-2.0.so.0` is unavailable. Restore the browser runtime in the managed environment or run the suite where its browser dependencies exist; test the real drawer, LOGS scrolling/persistence, LAWS keyboard/bulk paths, save restore and boot worker with console errors observed.
5. **Repository/doc gates:** regenerate and review technical-spec outputs without overwriting the pre-existing untracked WRAP specification, then pass `spec:check`, `repository:check`, full Vitest, syntax and build. In this release verification, `spec:check` reports 13 generated-path differences (architecture/module boundaries, six law records including mechanics/WRAP, source inventory, traceability, law implementation manifest and manifest). No generated output was accepted or written. All 88 unit files (1,081 tests) and 50 audit files (458 tests) pass separately; the combined Vitest run terminates with Tinypool `ERR_IPC_CHANNEL_CLOSED`. Syntax, build and UI report check pass.
6. **Delivery record:** v9.3.0 release includes the full authorized workspace snapshot, pre-release backup branch, and synchronized changelog/manifests. Commit, push, tag, and production deployment are recorded in the v9.3.0 changelog entry when verified; do not call this partial implementation the completed overhaul.

**Not implemented in this pass:** no full phase completion, no ELECTRIC_FIELD solver design/implementation, no ambiguous questionnaire behaviors, no generated spec refresh, and no real-browser verification. The prior untracked `docs/spec/laws/mechanics/130_WRAP.md` is preserved unchanged.
