# Changelog: VEPA v4

## [4.6.23] - 2026-08-06

### Law RRP batches 20-22 (triple batch, 12 laws)
- FRICTION — match irl: damping now scales with VISCOSITY DNA (0.5–1.0, higher viscosity = more damping) and the removed kinetic energy converts to heat (TEMP += speed·damp·0.5, cap 1). Both doc promises ("converting motion into heat", "VISCOSITY DNA modulates it") are finally implemented.
- ELASTICITY — match irl: the overlap push is now scaled by a coefficient of restitution from ELASTICITY DNA (0–1, default 0.5) — mag = overlap·k·ELASTICITY/(mI+mJ); real materials bounce less when less elastic, light particles still bounce harder.
- FEEDBACK / LANGUAGE / CULTURE / SINGULARITY / ENTANGLEMENT / HISTORY / TIDE / TURBULENCE / CENTRIPETAL / ROTATION — confirmed as-is against docs; HELP_DB entries updated with confirmed specs and synergy notes.
- Tests: `batch_20/21/22.test.js` updated to confirmed specs (+1 FRICTION viscosity+heat case, +1 ELASTICITY restitution case; 38 total across the three files). Full suite 596/596 green; `npx vite build` clean.
- **Deploy**: production live at https://vepa-v4.vercel.app/ (Vercel, 2026-08-06).

## [4.6.22] - 2026-08-06

### Law RRP batches 17-19 (triple batch, 12 laws)
- PLASMA — hysteresis (match irl): above 0.6 surplus heat ionizes into stored CHARGE (cooling the gas); below 0.5 a cooled plasma recombines — stored charge converts back to heat (TEMP += |c|·k·2) and the ion resets. The 0.5–0.6 band prevents rapid ionize/recombine oscillation. The thermal-EM cycle now closes.
- STIGMERGY — real pheromone trails: only moving particles lay a predicted-path marker (speed ≥ 0.5); stopped particles' markers evaporate (lerp 8%/tick back to the owner); followers are pulled along the gradient — force falls off with distance to the marker and scales with freshness (stale markers pull weakly).
- SIGNAL_BOOST — relay now scales with the sender's SIGNAL_STRENGTH DNA (0.5–1.5×), consistent with GLOW/COMMS; fixed a `|| 0.5` fallback that swallowed a legitimate strength 0.
- SUPERCONDUCTIVITY / MEMORY / PATTERN / LEARN / SYMBOL / METRIC / PREDICT / CODE / PROTOCOL — confirmed as-is against docs, HELP_DB entries updated with confirmed specs and synergy notes.
- Tests: `batch_17/18/19.test.js` updated to confirmed specs (+2/+3 cases; total 50 across the three files). Full suite 594/594 green; `npx vite build` clean.

## [4.6.21] - 2026-08-06

### Law RRP batch 16 — RESONANCE / FLUX / IONIZATION / DISCHARGE confirmed
- RESONANCE — sympathetic vibration is now phase-aware (match irl): `phaseSync = 0.5+0.5·cos(Δphase·π/2)` scales the matched-rate attraction (same oscillator as GLOW/COMMS), and in-phase pairs amplify each other — the stronger pulser drives the weaker one's SIGNAL up, so synchronized swarms get louder. Out-of-phase pairs get no drive.
- FLUX — F = qE (match irl): drift direction now depends on effective charge q = POLARITY + CHARGE. Positive carriers move DOWN the stored-charge gradient, negative carriers UP it (electrons run the other way); neutrals (|q| ≤ 1e-3, includes the quantized default) still follow the field lines as documented.
- IONIZATION — hard contacts now need a threshold impact (> 0.15, ionization energy) and form a conserved +/− ion pair: q_i = impact·s, q_j = −impact·s with s = sign(POLARITY_i + POLARITY_j) || 1. Genuine charge conservation seeds CHARGE_LAW/FLUX/CURRENT with real ion pairs; already-charged pairs are not re-stripped.
- DISCHARGE — the spark now travels along the potential difference: the solver accumulates the direction toward the neighbor with the most opposite stored charge and the kick (|c|·k) is aimed that way; charge sign no longer flips the aimed kick. Random burst only with no opposite-charge field nearby. Threshold/heat/reset unchanged.
- Tests: `batch_16.test.js` rewritten to confirmed specs (9 cases: phase amplification, out-of-phase no-drive, neutral/positive/negative flux carriers, ion-pair conservation, ionization threshold, aimed discharge). Full suite 589/589 green; `npx vite build` clean.

## [4.6.20] - 2026-08-06

### Law RRP batch 15 — RESISTANCE / CAPACITANCE / INDUCTANCE / MAGNETISM confirmed
- RESISTANCE — match irl: resistance is now material-dependent and thermal-Ohmic. Damping scales with (1 − CONDUCTIVITY·0.9) so conductors glide and insulators resist, and with (1 + TEMP·2) so hotter particles slow harder — the doc's "hotter they get, the more they slow" feedback is finally wired. Kinetic→heat conversion retained (TEMP += speed·k·(1 − CONDUCTIVITY·0.9)·0.5, cap 1).
- CAPACITANCE — discharging drains toward zero only: a depleted capacitor never flips polarity from draining (negative stored charge is left alone). Accrual above ENERGY 50, ±2 breakdown clamp, and same-sign stored-charge repulsion unchanged.
- INDUCTANCE — magnetic coupling: velocity alignment now scales with |MAGNETIC_MOMENT product|/(1 + dist·0.03) (a field is required, and coupling fades with distance) and both particles must conduct (real materials, consistent with CURRENT). Momentum-conserving as before.
- MAGNETISM — MAGNETIC_MOMENT DNA widened to [−1,1] (default 0.1): the documented "opposing signs repel" was unreachable with a [0,1] range; both aligned-attract and opposing-repel now work through normal DNA. Force law unchanged (F = k·m1·m2/dist²).
- Tests: `batch_15.test.js` rewritten to confirmed specs (10 cases: material resistance, thermal feedback, bleed-to-zero + no-sign-flip, moment-gated and conductivity-gated inductance, signed-moment real-DNA magnetism); `params_batch_13.test.js` MAGNETIC_MOMENT unaffected. Full suite 584/584 green; `npx vite build` clean.

## [4.6.19] - 2026-08-06

### DNA parameter space expanded 48 → 64 — 16 new genetics & regulatory params (genome-only)
- `DNA_COUNT` 48 → 64; `DNA_INDEXES`/`DNA_META`/`DNA_RANGES` all carry 64 entries. New params (indices 48-63): ALLELE_COUNT, EPIGENETIC_RATE, HGT_RATE, REPAIR_EFFICIENCY, DRIFT_RATE, SELECTION_SENSITIVITY, SPECIATION_THRESHOLD, ADAPTATION_RATE, TRANSPOSON_RATE, GENE_SILENCING, RECOMBINATION_BIAS, MUTAGEN_SENSITIVITY, TELOMERE_LENGTH, PLOIDY_LEVEL, CODON_BIAS, REGULATORY_DEPTH.
- Genome-only: the new params live in the 64-wide species DNA buffer (`readSpeciesDNAParam`/`writeSpeciesDNAParam`), never in the per-particle stride cache (which stays 42 floats, offsets 8-49).
- REPRO — ploidy/allele/recombination wiring: PLOIDY_LEVEL raises the recombination gate, ALLELE_COUNT widens the crossover blend window, RECOMBINATION_BIAS skews dominance; mutation is scaled by REPAIR_EFFICIENCY (repair) and GENE_SILENCING, amplified by TRANSPOSON_RATE (mobile-element bursts); EPIGENETIC_RATE scales epigenetic drift; HGT_RATE enables horizontal gene transfer alongside GENE_FLOW.
- GENOTYPE — DRIFT_RATE adds neutral drift, SELECTION_SENSITIVITY strengthens heritable change, SPECIATION_THRESHOLD gates divergence write-back, ADAPTATION_RATE scales the leap, MUTAGEN_SENSITIVITY scales radiation-driven mutation, GENE_SILENCING/CODON_BIAS shape expression, REGULATORY_DEPTH stabilizes expression.
- SENESCENCE — TELOMERE_LENGTH damps aging death (`applyLifeCycle` now receives `dnaBuffer`; longer telomeres resist death, default 0.5).
- UI — new "Genetics & Regulation" slider group in the DNA panel and "GENETICS" group in the species panel covering indices 42-63.
- Tests — `dna.test.js` +3 (64-param exposure, defaults, genome round-trip); `params_batch_15.test.js` asexual-control test zeroes the new HGT_RATE noise source. Full suite 579/579 green; `vite build` clean.

## [4.6.18] - 2026-08-06

### Law RRP batch 14 — COMMS / CHARGE_LAW / FIELD / CURRENT confirmed
- COMMS — the sender pays: signal delivery still gives the receiver homing force + memory, but the free receiver energy gain is gone and the sender pays ENERGY −= delivered×0.5 per delivered signal (floor 0).
- CHARGE_LAW — match irl: real Coulomb on effective charge = POLARITY DNA + stored stride CHARGE with no weighting — qq = (q1+c1)×(q2+c2), opposite signs attract, like repel.
- FIELD — uniform 3D drift (was az=0 with an x/y asymmetry): POLARITY sets the sign, stored CHARGE scales the drift k×(1+|c|×0.5) so charged particles feel the field harder.
- CURRENT — both sides must conduct: charge diffusion uses min(CONDUCTIVITY_i, CONDUCTIVITY_j) so a conductor can't drain an insulator (real materials); high→low flow + 17-unit range unchanged.
- Tests: `batch_14.test.js` rewritten to confirmed specs (9 cases); `signal.test.js` + `params_batch_13/16/17/18` regressions updated (COMMS DNA tests assert delivered SIGNAL, not receiver energy; CURRENT needs both conductive). Full suite 576/576 green; `npx vite build` clean.
- ⚠️ Preserved a concurrent session's uncommitted "DNA 64" genetics WIP (genome params 48-63, REPRO/lifecycle rewrite) to `.concurrent-dna64-wip-20260806.patch` + `.concurrent-dna64-backup-20260806/` and reverted it so this release ships clean — re-apply with `git apply`.
## [4.6.17] - 2026-08-06

### Law RRP batch 13 — CLAIRVOYANCE / PRECOGNITION / ASTRAL / PREDATION confirmed
- CLAIRVOYANCE — slight cost: predictive steering toward 3-tick velocity-extrapolated positions stays, but sensing the future drains ENERGY −= 0.02×synergy×dt per prediction (floor 0).
- PRECOGNITION — ditto: perpendicular collision-course dodges (dist 1-50, closing pairs only) now cost ENERGY −= 0.02×synergy×dt per dodge; no drain when moving apart.
- ASTRAL — kept ghosting and expanded it: ghosts (DEAD=0.5, fading SOUL) now exert a soft soul-pull on nearby living particles (80-unit range, bounded via the spatial grid) and same-species kin receive a conserved sliver of the ghost's soul before it dissipates — the HELP_DB's "still exert forces on the living" is finally wired.
- PREDATION — jitter flee kept (JITTER DNA = erratic escape), and now matches the docs: a predator never hunts its own kind (cross-species only, per TRACK's documented ecosystem rule) and DNA trait sampling uses the sim PRNG instead of Math.random().
- Tests: `batch_13.test.js` rewritten to the confirmed specs (6 cases); `params_batch_15.test.js` PREDATION_BIAS updated to a cross-species pair. Full suite 572/572 green; `npx vite build` clean.
## [4.6.16] - 2026-08-06

### Law RRP batch 12 — CONDENSE / DEPOSIT / EXOTHERMIC / TELEPATHY confirmed + 4 more multiplexer live settings
- CONDENSE — real-life behavior: condensation is exothermic — cool particles gain vapor mass and release latent heat (TEMP += rate×2, capped 0.9 so they can't cross into boiling; mass logic unchanged).
- DEPOSIT — real-life frost: exothermic, skips the liquid phase — solid mass builds fast (rate×3 mass, rate×0.5 radius) and latent heat is released (TEMP += rate×2, capped 0.9).
- EXOTHERMIC — real-life bounded steady release while the reaction runs: ENERGY += 0.05×synergy×dt (capped 200), TEMP += 0.01×synergy×dt (capped 0.9). Replaces the old unbounded ENERGY ×= 1.1 exponential.
- TELEPATHY — same-species signal sharing now costs the receiver a slight energy toll per transfer (ENERGY −= 0.02×synergy×dt, floored 0) — user requested.
- Multiplexer — 4 more live settings, all visible in the right drawer during multiplexing: SIM SPEED (0.25–3×, scales each shard's effective timestep), PAUSE GRID (freezes shard stepping while the main sim keeps running), MAX ITERS (0 = ∞, caps auto-iteration), DRIFT (0–0.05, raises VARIATION each generation, capped at 1).
- Tests: `batch_12.test.js` rewritten (8 cases), `multiplex.test.js` +5 (new defaults, pause freeze, sim-speed scaling, iteration cap, variation drift) — full suite 570/570 green; `npx vite build` clean.
## [4.6.15] - 2026-08-06

### Law RRP batch 11 — REDUCTION / ALLOY / MELT / BOIL confirmed + multiplexer live settings
- REDUCTION — real-life behavior: opposite charges cancel toward zero on interaction (same-sign pairs untouched; the old code equalized like a conductor).
- ALLOY — real-life alloying: full mass merge + mass-weighted DNA average (hybrid composition) + colour blend; survivor keeps its species slot.
- MELT — follows HELP_DB: hot particles lose effective STIFFNESS toward a 20% floor (mass untouched) and re-solidify when cool — reversible phase change.
- BOIL — yes: ejected mass costs latent heat (ENERGY −= ejectMass×20), uses the SplitMix32 PRNG for the velocity kick, 0.02 mass floor.
- Multiplexer — the right drawer now shows every setting live during multiplexing: VARIATION slider, RANDOMIZE (LAWS/DNA/POP), DERIVE (CLONE/SPAWN), GRID (C×R, applies immediately), AUTO-ITERATE + EVERY interval, AUTO-SELECT FITTEST. New engine: `autoIterate` regenerates shards on a cadence; `selectFittestShard` picks the most alive.
- Tests: `batch_11.test.js` rewritten (8 cases), `multiplex.test.js` +4 — full suite 565/565 green; `npx vite build` clean.

## [4.6.14] - 2026-08-06

### Law colours: 10% bands tightened to 4%
- Each of the 8 law-category bands on the EM-spectrum is now 4 points wide (center ± 2) instead of 10, so the 16 laws inside a category sit closer to their category colour (RED wraps 98% → 102% through 0).
- All 128 laws still get a distinct hue; `LAW_SPECTRUM` + `LAW_HUE_BY_INDEX` recompute automatically.
- Full suite 561/561 green; `npx vite build` clean.

## [4.6.13] - 2026-08-06

### Drawer fixes — reopen after minimize, swipe up/down, LAWS + WORLD sub-tabs, laws hide button removed
- **Minimize reopen bug fixed**: the drawer control buttons (▁ minimize, ▼ hide, −/+ zoom) share the `.tab-btn` class, so the generic tab-switching handler treated them as tabs and stripped the active tab — expanding later left the drawer blank with no way back. Tab switching now only binds real tabs (`[data-tab]`), and expand restores the active tab if it was ever lost.
- **Swipe up / swipe down**: swiping up on the tab strip or top edge expands the drawer, swiping down minimizes it (touch + mouse drag). The resize handle is excluded while actively resizing.
- **LAWS and WORLD are now separate sub-tabs** in the Setup panel: ⚖️ LAWS (category filters, icon/list law grid, law-set bar) and 🌍 WORLD (world parameter sliders). The network panel still mounts in WORLD.
- **Laws panel close button removed**: the ✕ hide toggle and `lawsHidden` state are gone — the law grid can no longer be hidden, only switched between icon and list view (◈ / ABC).
- Tests: new `tests/unit/drawer.test.js` (5 cases — tab switching, minimize/expand keeps active tab, swipe down/up, tap passthrough, hide/show roundtrip). Full suite 561/561 green; `npx vite build` clean.

## [4.6.12] - 2026-08-06

### Law RRP batch 10 — SOUL conserved + decay, MIND synergy stack, VOID dark-energy scaling, BOND density bias, POLYMER chain bias
- SOUL_LAW — conserved shared field: same-species transfer drains the giver and credits the receiver (both capped to [0,1]), plus slow per-particle decay (0.2%/tick) so souls must be replenished.
- MIND — hivemind is now synergy-shaped: COMMS ×1.5, TELEPATHY ×2.0, ENERGY ×0.5 (hive-mind drain), POLYMER ×0.5 (polymerized overhead). The documented MIND+ENER −2.0 synergy was never wired before — now it is, in v4's multiplier form.
- VOID — strengthened base (0.0005 → 0.004) + dark-energy distance scaling `(0.3 + dist/(worldSize/2))`: the outward push grows from the world centre.
- BOND — molecular bonds prefer dense neighbourhoods over chain ends: bond range and spring force scale with `min(2, 1 + nCount×0.05)`, bonds break when stretched past range, registration uses all 6 bond slots.
- POLYMER — chain bias: bond range ×1.0 for free/tip partners, ×0.5 (2 bonds), ×0.25 (3+) so polymers grow linear chains instead of cross-linked webs.
- Tests: `batch_10.test.js` 14 cases; full suite 556/556 green; `npx vite build` clean.

## [4.6.11] - 2026-08-06

### Law grid recoloured top-to-bottom rainbow (user request)
- Category colours now run red → orange → yellow → green → teal → blue → violet
  → purple from the top law row to the bottom row (physics → biology → chemistry
  → thermodynamics → metaphysics → electromagnetism → information → quantum),
  replacing the old per-category colour map.
- Each category band stays 10 points wide on the 0-100 hue spectrum and the
  per-law step inside each band is unchanged, so every one of the 128 laws keeps
  its own hue — just re-ordered into a full rainbow top-to-bottom.
- `LAW_CATEGORIES` colour fields updated; `LAW_HUE_BY_INDEX` recomputes
  automatically. Category tabs and labels follow (they read the same mapping).
- Full suite 550/550 green; `vite build` clean.


## [4.6.10] - 2026-08-06

### Law RRP batch 09 — CHAOS / ORDER / FATE / WILL confirmed semantics

Interactive law audit (RRP with the user): all four laws confirmed with amendments.

- **CHAOS** — agent decision (user delegated): kinetic forcing stays plus a small
  temperature stir (+/-(prng()-0.5) x 0.02 x dt x synergy, clamped 0-1) so chaos
  flickers hot/cold pockets that feed HEAT and PHASE_RADIATION. With ORDER on,
  both run at x0.3 (mutual cancellation, unchanged).
- **ORDER** — "strongly": Vicsek alignment 0.005 -> 0.04 and range ~100 -> ~200
  units, so coherent flow actually emerges.
- **FATE** — redesigned (user: "boring and similar to existing laws"): the old
  pairwise same-species attraction duplicated AFFINITY. Each species now has a
  slowly drifting destiny point (golden-angle phase, fate clock) its members are
  gently pulled toward along the shortest toroidal path — species migrate and
  segregate toward their own fate.
- **WILL** — followed docs: energy-independent self-propulsion along current
  heading (0.01 x dt x synergy, speed gate 0.01). Unchanged.
- Tests: `batch_09.test.js` updated (CHAOS thermal stir + clamp, ORDER 0.2
  alignment + 50k range gate, FATE destiny magnitude/direction + per-species
  divergence + integration). Full suite 550/550 green; `vite build` clean.
- HELP_DB synced for CHAOS / ORDER / FATE; RRP manifest + telemetry in
  `audit-suite/laws-rrp/batch_09.md`.


## [4.6.9] - 2026-08-06

### Law RRP batch 08 — PHASE_RADIATION / SUBLIMATION / TIME_DILATION / DIMENSIONALITY + crystallization repair

Interactive law audit (RRP with the user): all four laws confirmed with amendments, plus a user-reported crystallization bug fixed.

- **CRYSTALLIZATION REPAIR** (user report: "lattices are entirely absent") — root
  cause: pairs only interacted within 30 units at a 0.01 pull while default spawn
  spacing is ~100-300 units, so lattices never formed. Range widened 30 -> 150 and
  pull strengthened 0.01 -> 0.05 (same-species 3x = 0.15); same-species pairs now
  visibly snap into the 8-unit lattice grid.
- **PHASE_RADIATION** — follows real blackbody physics: Stefan-Boltzmann T^4
  emission — every warm body (temp > 0.05) radiates, hot bodies radiate
  disproportionately (temp^4 x 0.05 x dt x synergy), cooling TEMPERATURE and
  ENERGY while boosting SIGNAL glow. The old ENERGY > 50 doc hint and the 0.6
  threshold are replaced.
- **SUBLIMATION** — documented low-mass + high-energy gate: temp > 0.5 AND
  ENERGY > 50; mass sublimes down to a 0.02 floor (near-full evaporation); the
  velocity burst now uses the sim PRNG instead of Math.random(); sublimation
  consumes extra energy (x20 sublRate) and cools.
- **TIME_DILATION** — agent decision (user delegated): kept `localDt = 1 -
  soul x 0.3 x synergy` (70% max slowdown) — a stronger cap would make
  differential aging (AGE, reproduction timers) diverge too far between souls.
- **DIMENSIONALITY** — Z-drift amplitude raised 0.1 -> 0.3 (3x) so 3D
  exploration is visible.
- Tests: `batch_07.test.js` crystallization values updated (0.2 / 0.6 / no-op
  beyond 150); `batch_08.test.js` rewritten (T^4 curve + proportionality,
  near-zero gate, sublimation energy gate + floor + PRNG, dimensionality 0.15
  kick). Full suite 550/550 green; `vite build` clean.
- HELP_DB synced for all five laws; RRP manifest + telemetry in
  `audit-suite/laws-rrp/batch_07.md` + `batch_08.md`.


## [4.6.8] - 2026-08-06

### Law RRP batch 07 — CRYSTALLIZATION / HEAT / COLD / CONVECTION confirmed semantics

Interactive law audit (RRP with the user): all four laws confirmed with amendments.

- **CRYSTALLIZATION** — same-species bonus: any pair within dist 1-30 is pulled
  toward the 8-unit lattice grid, and same-species pairs pull 3x stronger, so
  rigid clusters form between kin (cross-species keeps the original 0.01 pull).
- **HEAT** — kinetic-theory thermal noise added: particles above 0.5 TEMPERATURE
  receive random velocity kicks proportional to temperature
  (+/-(temp x 0.01 x dt x synergy) per axis), alongside the existing pairwise
  conduction.
- **COLD** — documented velocity damping added: particles below 0.5 TEMPERATURE
  have VEL_X/Y/Z multiplied by max(0, 1 - (0.5-temp) x 0.1 x dt x synergy) each
  tick, alongside the pairwise equalization.
- **CONVECTION** — kept as documented: buoyancy (temp-0.5) x 0.001 x dt x synergy
  on +VEL_Y, deliberately not scaled by HEAT_CAPACITY (conduction already encodes
  capacity into the temperature field). Note: gravity (PLANETARY) is along -Z, so
  +Y buoyancy is horizontal in VEPA's 3D space - switch to +Z on request.
- Tests: `tests/audit/batch_07.test.js` extended to 25 (crystallization
  same-species bonus, thermal jitter gate/threshold/value/integration, cold
  damping gate/threshold/value/integration). Full suite 547/547 green;
  `vite build` clean.
- HELP_DB synced for all four laws; RRP manifest + telemetry in
  `audit-suite/laws-rrp/batch_07.md`.


## [4.6.7] - 2026-08-05

### Law RRP batch 06 — OXIDATION / POLYMER / ISOMERIZATION / CHIRALITY confirmed semantics

Interactive law audit (RRP with the user): all four laws confirmed with amendments.

- **OXIDATION** is now real electron loss: CHARGE decays toward 0 (electrical
  rust) alongside the MASS erosion, and HEAT_OUTPUT DNA releases heat plus a
  glow flash (COLOR_R/G/B + ALPHA brighten while the particle burns).
- **POLYMER** matches the documentation: the particle stride grew to
  `BOND_PARTNER_1..6` (81-84 appended, existing offsets stable) for the
  documented max 6 bonds per particle; bonds are now mutual (i records j, j
  records i) so A-B-C chains hold on both ends, and partner indices use the
  real stride (the hardcoded `/100` is gone).
- **ISOMERIZATION** matches real life: same atoms, rearranged bonds — a
  particle with 3+ chain bonds occasionally breaks one connection (the freed
  partner becomes a fragment, its reciprocal cleared) and consumes a little
  energy. The sinusoidal "radius breathing" placeholder was removed.
- **CHIRALITY** uses the documented TORQUE DNA: handedness is geometric
  mirror-spin (clockwise vs counter-clockwise), same-handedness pairs deflect
  perpendicular with direction following the torque sign; opposite-handedness
  and zero-torque pairs feel nothing.
- Tests: `tests/audit/batch_06.test.js` rewritten (21) — rust + glow, mutual
  6-slot bonds + cap, isomerization rearrangement/reciprocal/energy, chirality
  handedness incl. mirror direction. Full suite 538/538 green; `vite build` clean.
- HELP_DB synced for all four laws; RRP manifest + telemetry in
  `audit-suite/laws-rrp/batch_06.md`.


## [4.6.6] - 2026-08-05

### Law RRP batch 05 — PHENOTYPE / CATALYSIS_LAW / SOLVATION / ACIDITY confirmed semantics

Interactive law audit (RRP with the user): all four laws confirmed with amendments.

- **PHENOTYPE** is gene expression: the inherited genome (DNA cache) is
  translated into the visible body every tick — POLARITY → hue, ALPHA →
  saturation, SYMMETRY → lightness — and ENERGY is the environment: well-fed
  particles (energy > 100) express a larger body, starving ones shrink.
  Offspring inherit DNA, so they inherit the look.
- **CATALYSIS_LAW** confirmed: chemistry multiplier ×(1 + CATALYSIS×0.5×synergy),
  applied to the pre-chemistry forces in the pair loop, and it is free —
  never touches energy (locked by test).
- **SOLVATION** replicates real-world behaviour: like dissolving salt in water,
  the solvent exerts charge forces — opposite charges attract, like charges
  repel (Coulomb-style |q1×q2|) — plus charge-different particles react
  faster. The force was previously dead code; now wired into the solver.
- **ACIDITY** switched to the documented behavior: particles exchange CHARGE
  when close, equalizing electrical potential; CONDUCTIVITY DNA controls the
  transfer rate and the CHARGE field is altered. The old ENERGY erosion is gone.
- Tests: `tests/audit/batch_05.test.js` rewritten (23) — phenotype colour
  expression, catalysis free + amplification, solvation attract/repel/gate,
  acidity equalization/conservation. Fixed a flaky catalysis test whose
  premise was wrong (chemMult runs before the CHARGE_LAW block — re-anchored
  to the AFFINITY pull it actually amplifies). Full suite 533/533 green;
  `vite build` clean.
- HELP_DB synced for all four laws; RRP manifest + telemetry in
  `audit-suite/laws-rrp/batch_05.md`.


## [4.6.5] - 2026-08-05

### Law RRP batch 04 — SENESCENCE / ENERGY / RADIATION / GENOTYPE confirmed semantics + GLOW backport

Interactive law audit (RRP with the user): all four laws confirmed with amendments.

- **GLOW backport (batch 03 correction):** GLOW is an emitter only — the
  oscillator raises SIGNAL (transmission strength) but never converts signal
  into life energy. Signal and metabolism stay separate channels.
- **SENESCENCE** confirmed as LIFE-dependent: age-based death stays nested
  inside the LIFE cycle (past AGE 500, death chance = DEATH_RATE×0.001×
  (1 + ageNorm×0.5)×dt); standalone SENESCENCE does nothing.
- **ENERGY** answered "what energy?": every energy reservoir conducts pairwise
  toward equilibrium — LIFE energy (ENERGY), ELECTRIC_ENERGY and STORED_ENERGY
  each transfer independently (conservation holds per channel); SIGNAL and
  REPRO_DRIVE are never touched.
- **RADIATION** gained the RADIATION_LEVEL slider scaling plus a slow exposure
  ramp: particles accumulate RADIATION_EXPOSURE (stride 80, level×dt×0.01,
  cap 100) that compounds damage over time and steadily ramps DNA mutation
  chance — more and more over time. Radiation depletion kills consistently
  with the batch-02 LIFE death. Removed the duplicate in-LIFE radiation drain
  (double-drain bug).
- **GENOTYPE** expanded as the genetics engine: REPRESSOR damps drift,
  HETEROZYGOSITY widens variance, EPIGENETIC_DRIFT adds non-heritable noise,
  GENE_FLOW pulls foreign genes, radiation exposure ramps the rate, and rare
  mutations write back into the 64×64 species genome — species-level evolution.
- Tests: `tests/audit/batch_04.test.js` rewritten (15) + batch_03 GLOW test
  corrected — full suite 521/521 green; `vite build` clean.
- HELP_DB synced for all five entries; RRP manifest + telemetry in
  `audit-suite/laws-rrp/batch_04.md`.



## [4.6.4] - 2026-08-05

### Law RRP batch 03 — GLOW / AFFINITY / REPRO / TRACK confirmed semantics + multi-energy architecture

Interactive law audit (RRP with the user): all four laws confirmed with amendments.

- **Multi-energy architecture** (stride 77-79): `ELECTRIC_ENERGY`, `STORED_ENERGY`,
  `REPRO_DRIVE` added to the particle stride — life energy (ENERGY), signal
  transmission strength (SIGNAL), electricity, storage, and reproductive drive
  are now separate channels. Initialized at spawn and in multiplex shards;
  exposed through `particleBuffer.js`.
- **GLOW** does both: an oscillator (PULSE_RATE × SIGNAL_STRENGTH DNA) emits
  signal pulses into SIGNAL, and existing signal converts into life energy.
- **AFFINITY** boosts same-species attraction (scales with positive
  SPECIES_AFFINITY, inert at 0, none for xenophobic species) — fixes the old
  `Math.abs` bug where negative affinity attracted your own kind.
- **REPRO** is now gated on REPRODUCTIVE DRIVE (stride 79): drive accumulates
  from BIRTH_RATE, spawning needs drive ≥ 60 + AGE ≥ 100, and spawning consumes
  the drive plus half the parent's life energy — raw energy is no longer the gate.
- **TRACK** only hunts across species: predators no longer chase their own kind.
- Tests: `tests/audit/batch_03.test.js` (13) + updated REPRO/AFFINITY param
  tests — full suite 515/515 green.
- HELP_DB synced for all four laws; RRP manifest + telemetry in
  `audit-suite/laws-rrp/batch_03.md`.

## [4.6.3] - 2026-08-05

### Law RRP batch 02 — COLL / ACCR / PLANETARY / LIFE confirmed semantics

Interactive law audit (RRP with the user): all four laws confirmed with amendments.

- **COLL** is now standalone from ACCR — softbody push + elastic bounce run only
  under COLL; fusing pairs coalesce instead of bouncing. Off = pass-through.
- **ACCR** gates reinterpreted: `FUSION_MOMENTUM` (DNA 16) is the MINIMUM
  relative momentum to fuse on impact (slower pairs bounce); `FUSION_TIME`
  (DNA 17) is how long sub-threshold pairs must stay in very close proximity
  before they fuse anyway. Proximity dwell is tracked per contact pair in the
  free `MITOSIS_TIMER` / `PARTNER_ID` stride fields and resets on separation.
  Sub-threshold ACCR-only contacts get a gentle elastic bounce.
- **PLANETARY** replaced the central well with constant atmospheric gravity
  toward the ground plane (z ≈ 0), mass-scaled so acceleration is
  mass-independent; ×1.5 with GRAV.
- **LIFE** now kills on metabolic energy depletion: when the LIFE metabolic
  budget hits 0 the organism dies (charge/electromagnetic energy paths are
  untouched).
- Tests: `tests/audit/batch_02.test.js` (14) + `tests/audit/params_batch_11.test.js`
  FUSION gates rewritten for the confirmed semantics — full suite 510/510 green.
- HELP_DB synced for all four laws; RRP manifest + telemetry in
  `audit-suite/laws-rrp/batch_02.md`.

## [4.6.1] - 2026-08-05

### Law RRP batch 01 — GRAV / DRAG / ENTR / WRAP spec confirmed with user
- RRP pass (per-batch spec confirmation): batch 01 behavior confirmed interactively:
  - **FORCE DNA is now pairwise with gravity**: both positive FORCE multiply the
    pull, both negative multiply negatively (repel), opposite signs cancel to a
    gravitationally neutral pair (`applyGravity` reads both particles).
  - New world slider **WALL REFLECT** (PHYSICS/MOTION, 0-2, default 1): soft-wall
    velocity effect — 0 = 100% absorption, 1 = 100% reflect, 2 = 200% reflect.
    The soft wall previously lost 50% on bounce; the default is now a full 100%
    reflect. Velocity clamp moved after the position step so super-bounces get to
    move the particle for one tick before the MAX_VELOCITY cap applies.
  - FRICTION DNA damping stays gated behind DRAG (confirmed).
- HELP_DB synced for GRAV (pairwise FORCE) and WRAP (binary + WALL REFLECT).
- Tests: `tests/audit/batch_01.test.js` 8 → 10 tests (pairwise FORCE + wall slider).
  Full suite 65 files / 505 tests green.
- RRP artifacts: `audit-suite/laws-rrp/` (README + batch_01..32 manifests),
  RSIRRP session `.rsirrp/sessions/2026-08-06/law-batch-01/20260806-001941-1c16`.

## [4.6.0] - 2026-08-05

### 72-parameter audit — every slider validated, 9 dead DNA params repaired
- Full parameter audit mirroring the law audit: 18 batches × 4 params
  (22 world sliders · 8 settings/camera · 42 DNA) with focused + gate tests in
  `v4/tests/audit/params_batch_01..18.test.js` (43 audit tests; full suite
  65 files / 503 tests green).
- Result: **63 PASS / 9 REPAIRED / 0 FAULTY** — every param functional.
- World sliders were the reported bug: 16 of 22 were `console.log` no-ops.
  New SSOT `v4/src/state/worldParams.js` (defs, clamps, `applyWorldParam`,
  min-clamped `spawnCaps`) + `v4/src/spawn/distribution.js`; all 22 sliders now
  flow into spawn, solver, and laws (`v4/src/ui/worldPanel.js` renders from the
  SSOT; `v4/src/main.js` applies `world:paramChanged` live).
- Repaired DNA params (all were dead — zero physics reads):
  FORCE (gravity scale/repel), TORQUE (velocity rotation), TIDAL (close-range
  gravity boost), FUSION + FUSION_TIME (ACCR mass-transfer efficiency +
  maturity gate), BOND_ANGLE (bond equilibrium distance), REACTION_THRESHOLD
  (autocatalysis mass gate), HEAT_OUTPUT (oxidation energy release),
  SEX_CHANCE (reproduction crossover probability).
- Additional fixes: `resetCamera()` restores focalLength/ortho/sensitivities;
  renderer `depthAlpha` now respects `runtimeConfig.globalAlpha`.
- Audit report: `audit-suite/params/` (SPEC, INDEX, 18 batch manifests,
  combined.md). World/camera/visual params default to neutral — default
  simulation behaviour unchanged; restart still preserves laws/world/species.

## [4.5.3] - 2026-08-05

### Deployment caching fix
- `vercel.json` no longer applies `max-age=31536000, immutable` to the HTML
  shell — browsers were caching the old `index.html` for a year and never
  picking up new builds. Hashed `/assets/*` bundles keep the long immutable
  cache; the HTML entry now serves `no-cache, must-revalidate` (COOP/COEP
  headers unchanged, so SharedArrayBuffer keeps working).



## [4.5.2] - 2026-08-05

### 4-agent law audit — all 128 laws validated
- All 32 batches of 4 laws audited by independent agents with integration-level
  `solve()` tests (`v4/tests/audit/batch_01..32.test.js`): 297 audit tests.
- Result: **110 PASS / 18 REPAIRED / 0 FAULTY** — every law functional.
- Repair highlights (`v4/src/physics/laws.js`, `solver.js`, `quantumLaws.js`):
  - COLD heat-transfer sign flipped (was heating the wrong particle).
  - CHARGE force sign flipped — like charges now repel, opposites attract.
  - COLL bounce condition `relVelN > 0` — approaching pairs now bounce.
  - SPIN parity uses real particle index (`floor(i/PARTICLE_STRIDE) % 2`) so the
    sign alternates per particle, not per buffer slot.
  - PHENOTYPE radius write no longer overwritten each tick by mass recompute.
  - ASTRAL processes DEAD=0.5 souls; ACCR can run standalone; PREDATION mass
    fold-in + softbody position delta; TUNNELING/UNCERTAINTY/TELEPORT/
    WAVEFUNCTION position mutations survive solver writeback.
  - Full suite: 47 files / 420 tests passing.

## [4.5.1] - 2026-08-05

### All 46 new laws implemented — 8 categories × 16 = 128 laws
- Law logic landed in `v4/src/physics/lawgroups/` (physicsLaws, thermoLaws,
  biologyLaws, chemistryLaws, emLaws, infoLaws, metaLaws, quantumLaws) and is
  dispatched from `solver.js` (pairwise + per-particle passes).
- New **quantum** law category (indigo) with 16 laws: SUPERPOSITION, TUNNELING,
  DECOHERENCE, WAVE_PARTICLE, UNCERTAINTY, TELEPORT, OBSERVER, PLANCK,
  COHERENCE, BOSONIC, FERMIONIC, SPIN, SPECTRAL, WAVEFUNCTION, HYPERPLANE,
  ANTIMATTER.
- Quantum tab (QNTE) + indigo theme in `v4/index.html` / `style.css`; 46 law
  icons added to `worldPanel.js` / `tooltip.js`.
- 8 new presets (31 total); sub-agent verification tests green (123/123 unit).

## [4.5.0] - 2026-08-05

### 128-law foundation
- 46 new `LAW_INDEXES` entries; `LAW_COUNT` 82 → 128; 8 categories × 16.
- Bitmask widened to 128 bits (`quadFlags` in `v4/src/state/lawState.js`);
  serialization stores `quad` word, deserialization accepts legacy 64-bit saves.
- 46 HELP_DB entries (HINT / EXPLANATION / SYSTEM / ADVANCED).
- Solver hard-freeze + multiplex copy/randomize extended to the 4th flags word.



## [4.4.2] - 2026-08-04

### Law-type synergy + icon parity pass
- **SINGULARITY** synergies: ×1.5 with ACCR (collapse accelerates), ×1.4 with
  GRAV (the hole bends space itself).
- **ENTANGLEMENT** synergies: ×1.6 with TELEPATHY, ×1.5 with COMMS (entangled
  signals need no channel).
- **HISTORY** synergies: ×1.6 with MEMORY (collective memory deepens the
  field), ×1.5 with PATTERN (remembered geometry aligns drift).
- World-panel law grid now shows icons for FEEDBACK / LANGUAGE / CULTURE
  (matching the tooltip module) — no more '?' placeholders for info laws.

## [4.4.1] - 2026-08-04

### Restart vs Reset semantics
- **Restart** (↻) now only respawns the population at tick 0 — laws, world
  params (spawn/distribution/thermal/force sliders, spawn rate) and species
  params (roster + DNA) are all preserved. Chaos still randomizes first, then
  restarts onto the randomized laws/DNA.
- **Reset** restores the defaults (default law set, world params, species
  profiles) via a fresh boot.
- Spawning is now safe with user-added species beyond the 5 built-in profiles
  (deterministic fallback colours instead of crashing).

## [4.4.0] - 2026-08-04

### New law types (3 more laws — 82 total)
- **SINGULARITY** (physics): supermassive particles (mass ≥ 20) exert an
  extreme inverse-square pull; any particle crossing the event horizon is
  absorbed — mass is swallowed and the hole heats up.
- **ENTANGLEMENT** (metaphysics): touching particles forge a non-local quantum
  link (new ENTANGLE_ID / ENTANGLE_PHASE stride slots, initialised to −1/0 on
  every spawn path). Momentum and signals transfer between the pair at any
  distance; the phase decays until the link snaps with a recoil kick.
- **HISTORY** (information): a 12³ spatial memory field accumulates particle
  presence (exponentially decaying); particles drift toward the field's
  centre of mass — archaeology as a force.
- HELP_DB entries, tooltip icons (⬤ / ⚭ / 📜) and solver wiring added; all
  spawn paths (main + multiplex shards) initialise the entanglement slots.

## [4.3.0] - 2026-08-04

### Law categories completed — Electromagnetism + Information (26 laws)
- **Electromagnetism (cyan) now has 13 laws**: CHARGE_LAW, FIELD, CURRENT,
  RESISTANCE, CAPACITANCE, INDUCTANCE, MAGNETISM, RESONANCE, FLUX, IONIZATION
  + **DISCHARGE** (stored charge bursts into motion/heat), **PLASMA** (hot
  particles ionize — heat becomes charge), **SUPERCONDUCTIVITY** (cold pairs
  couple into lossless velocity-aligned streams).
- **Information (gold) now has 13 laws**: MEMORY, PATTERN, STIGMERGY,
  SIGNAL_BOOST, LEARN, SYMBOL, METRIC, PREDICT, CODE, PROTOCOL + **FEEDBACK**
  (memory amplifies motion, motion refreshes memory), **LANGUAGE** (signaling
  pairs exchange memory traces), **CULTURE** (same-species contacts converge
  their DNA cache).
- **96-bit law bitmask**: `lawState` now uses three `Uint32Array` words
  (0-31 / 32-63 / 64-95) instead of two — laws 64+ previously collided with
  lower bits and could not be toggled. `getStateVector`/`fromVector` and
  `serialize`/`deserialize` extended (legacy `{low, high}` payloads still load).
- **Multiplex shards** copy and randomize the third law word (extended-range
  laws now survive shard derivation and variation).
- **New synergies** for both categories: CHARGE_LAW+MAGNETISM, SUPERCONDUCTIVITY
  +COLD, SUPERCONDUCTIVITY+RESISTANCE, DISCHARGE+IONIZATION, PLASMA+HEAT,
  CURRENT+RESISTANCE, MEMORY+FEEDBACK, SIGNAL_BOOST+PROTOCOL, LANGUAGE+CODE,
  CULTURE+GENOTYPE, PREDICT+TRACK, STIGMERGY+LEARN, LEARN+SYMBOL — all consumed
  by the solver as multipliers.
- SUPERCONDUCTOR law-set preset now includes SUPERCONDUCTIVITY.
- Law grid / tooltips updated with icons and HELP_DB entries for all six new
  laws.

### Law set bar (SETUP > WORLD)
- **3-button bar**: a dropdown selector (shows the applied set) + icon-only
  LOAD (📂) and SAVE (💾) buttons.
- **Select-then-load flow**: tapping a row in the dropdown only selects it
  (✓ highlight); LOAD applies it to the sim, SAVE overwrites it with the
  current laws. Saving without a selection opens the inline name editor for a
  brand-new set.
- **User sets override built-ins**: saved sets with the same name as a
  built-in now take precedence.
- **3 new presets** (23 total): ELECTRIC STORM (charge/field/current/
  ionization/discharge/plasma), NEURAL WEB (memory/learn/symbol/language/
  feedback/culture), CRYO CURRENT (superconductivity/cold/current/
  resistance/flux/condense).

## [4.2.1] - 2026-08-04

### Fixes
- **Accretion now requires ACCR**: the LIFE law's metabolism no longer grows or
  shrinks particle mass on its own — mass fluctuation is gated behind the ACCR
  law, so particles stop "accreting" unless accretion is enabled.

### Reproduction
- **Offspring inherit the parents' intermediate colour**: two-parent breeding
  blends the parents' colours 50/50 (with mutation); single-parent clones carry
  the parent colour instead of snapping back to the species base. Shard
  populations (multiplex) now spawn with per-species colours too.

### Population
- **REGULAR SPAWN /S setting** (SETUP > WORLD > ENVIRONMENT > POPULATION):
  spawns N particles per second at random positions drawn from the configured
  initial distribution (shape / centres / centre bias). Default 5/s.

## [4.2.0] - 2026-08-04

### Law grid (SETUP > WORLD)
- **5-colour law coding**: every law is tinted by its category (blue physics,
  green biology, purple chemistry, orange thermodynamics, red metaphysics) in
  both icon and list modes — dull when disabled, bright when enabled.
- **One row per law type**: each category renders as its own labelled row.
- **Exclusive view-mode group**: [◈ icon] [ABC list] [✕ hide] — only one mode
  selected at a time; tapping the selected mode again hides the law grid, and
  the ✕ button toggles visibility.

### Law set system
- **SAVE / LOAD + dropdown** of presets; each dropdown row shows 1/4-size law
  icons in a single line + preset name. Clicking a row applies that law set.
- **20 theorycrafted presets** (PRIME DIRECTIVE … CHAOS THEORY).
- **Inline save editor**: SAVE opens a name input prefilled with the last
  loaded/saved preset name, with ✓ / ✕ to confirm or cancel. Saving upserts
  into the dropdown and persists to localStorage (`vepa.lawsets.v1`);
  loading a preset then saving renames it.
- Manual law toggles return the label to CUSTOM.

### Drawer (already present, confirmed working)
- Swipe tabs up to open / down to close the drawer; the top edge handle can be
  held (highlighted) and dragged to resize; − / + zoom buttons scale drawer
  content.

## [4.2.0] - 2026-08-04

### Laws
- **5-category colour coding in both views**: law tiles and list rows are
  tinted by type (blue/green/purple/orange/red) even when inactive, bright
  when active.
- **Mode buttons**: ▦ (icon) and ABC (list) sit side by side, mutually
  exclusive; tapping the already-active button hides the law grid, tapping
  it again restores it.

### Drawer
- **Swipe up/down** on the drawer tabs opens/closes the drawer.
- **Resize handle** on the drawer's top edge — hold/drag to resize, glows
  blue while hovered/dragged.
- **− / + zoom buttons** in the drawer tabs scale the drawer content
  (0.6×–1.6×).

## [4.1.9] - 2026-08-04

### World params
- **Grouped params**: SETUP > WORLD sliders now nest in sub-accordions per
  group — SPACE > WORLD / POPULATION / DISTRIBUTION, PHYSICS > FORCES / MOTION,
  ENVIRONMENT > THERMAL / POPULATION, BIOLOGY > INTERACTION / LIFE CYCLE.

## [4.1.8] - 2026-08-04

### Camera
- **Straight-on default view**: the camera now starts flat against one side of
  the dish (no rotation/tilt); drag to orbit, 2-finger drag rotates.
- Zoom remains clamped (min 0.05, max 100) via wheel/pinch.

### Initial distribution controls (SETUP > WORLD > SPACE)
- **DISTRIBUTION**: 0 = perfectly even grid, 1 = fully random positions
  (replaces the inert SPAWN SHAPE slider).
- **CENTRES**: number of cluster centres, 1-64.
- **CENTRE SCATTER**: centre placement — 0 = evenly spaced, 1 = random.
- **CENTRE BIAS**: how strongly particles are pulled toward the centre(s),
  0 = uniform, 1 = pinned to centres.
- Values apply on the next Restart / Chaos respawn.

## [4.1.7] - 2026-08-04

### Chaos Multiplex (guided evolution grid)
- **Long-press Chaos ☢️ opens the Chaos Multiplex config modal**: X×Y concurrent
  simulations rendered in a grid (up to 16 shards), with checkbox toggles for
  which aspects to randomize (Laws / DNA / Population), a variation slider
  between shards, and derivation mode (clone the selected simulation vs.
  spawn a fresh population).
- **Right-edge multiplex drawer**: minimizable/expandable; while minimized it
  still shows an icon-only ⚡ iterate button. Iterate regenerates every shard
  from the currently selected shard with fresh seeds.
- **Shard selection**: tapping any concurrent simulation renders a selection
  box around it; the selected shard becomes the source for the next iteration.
- **Shared camera**: all shards share one camera, so any drag/pinch/zoom
  applies the same camera movement to every shard simultaneously.
- **Chaos button order**: short click randomizes laws/DNA first, then restarts
  on a fresh population that preserves the randomized configuration.

### Camera
- **1-finger drag pans, 2-finger drag rotates** (two-finger rotation orbits +
  pinch zooms); mouse drag pans.

### Toolbar
- Buttons named Chaos, Restart, Reset, Help (icons unchanged).

## [4.1.6] - 2026-08-04

### UI
- **Setup is the first tab**: the CONFIG tab is renamed SETUP and moved to
  position 1 (default open, WORLD subtab active); DATA is second.

## [4.1.5] - 2026-08-03

### Toolbar
- **Randomize (Chaos) ☢️ now restarts first**: short-click emits restart then
  chaos, so randomness applies to a fresh population.
- **Readme (Help) ? now works**: opens the v4 README (`help:toggle` was
  emitted but never handled).
- Toolbar right is exactly four buttons with current icons:
  Randomize (Chaos) ☢️, Restart 🔄, Reset 🗑️, Readme (Help) ?.

### Fixes
- **Restart desync fixed**: `sim:restart` created a *new* lawState object while
  the UI panels held the old reference — after restart the sim ran laws the
  toggles didn't show (and vice versa). Restart now clears the object in
  place, keeping UI and engine on the same state.
- **Narrative crash fixed**: `cluster:detected` payloads are
  `{timestamp, clusters[]}` but the narrative templates read `count` /
  `avgEnergy` directly off the payload, throwing `undefined.toFixed` at
  random intervals. The engine now narrates the largest cluster with the
  correct shape.

### Startup (confirmed)
- Initial state is all laws disabled (`DEFAULT_LAWS` empty, boot + restart).
  If the drawer still shows the old WORLD/SPECIES/DNA/LOG tabs, hard-refresh:
  4.1.4+ ships the DATA/CONFIG tab restructure with a new bundle hash.

## [4.1.4] - 2026-08-03

### Startup
- **Begin with all laws disabled**: `DEFAULT_LAWS` is empty, so the sim boots
  (and restarts) with zero laws — particles are completely static until a law
  is enabled. Presets and manual toggles turn laws on.

### UI
- **Tabs restructured**: top-level `DATA` (sub-tabs INTELLIGENCE | DNA | LOGS)
  and `CONFIG` (sub-tabs WORLD | SPECIES | SETTINGS). The intelligence
  dashboard is the primary DATA subtab; world (law grid + params) and species
  panels now live under CONFIG.
- **LOGS subtab fixed**: the narrative log panel (`#narrative-panel`) now
  actually renders — previously it targeted a container that didn't exist.
- **+ SPECIES works**: clones species 0's DNA into the next free slot (up to
  64) and selects it.
- **− SPECIES + per-card ✕**: remove the last species or any card; the DNA
  roster compacts, selection clamps, and the HUD species count syncs (min 1).

## [4.1.3] - 2026-08-03

### Law Gating (complete)
- **FRICTION now gated by DRAG**: velocity-dependent damping (FRICTION DNA)
  previously ran unconditionally whenever any law was active — a movement
  effect with no law governing it. It now lives inside the DRAG (kinetic
  dampening) block, so with DRAG off, velocity is preserved exactly.
- **dragMultiplier tunable gated by DRAG**: the goal-engine's global damping
  multiplier only applies while the DRAG law is active (default 1.0, inert).
- Full solver audit: every force, interaction, lifecycle effect, and signal
  path is now individually law-gated (verified in `apply*` bodies + call
  sites), with the zero-laws hard freeze as the outer invariant: no laws →
  no movement, no interaction, no state change of any kind.

### Tests
- lawGating.test.js: +2 tests — DRAG-off preserves velocity exactly;
  DRAG-on decays velocity.

## [4.1.2] - 2026-08-03

### Deployment
- **Vercel**: new production deployment at https://vepa-v4.vercel.app/ —
  serves COOP/COEP headers so `SharedArrayBuffer` (the true memory model) is
  enabled in production, which GitHub Pages cannot provide. Config in
  `vercel.json` (root base when `VERCEL=1`, immutable cache).

### Laws & Gating
- **NEW COMMS law** (biology, index 52): the single gate for the entire
  communication DNA group. While active, oscillator pulses (PULSE_RATE x
  SIGNAL_STRENGTH) build the SIGNAL field, neighbors within
  NEIGHBORHOOD_RADIUS exchange channel-filtered signals (TUNING_CH1-4), and
  delivery converts into response forces, energy, and memory. While off, no
  signal emits, decays, or exchanges — SIGNAL/MEMORY freeze and no comms
  forces exist. Enabled by default.
- **Zero-laws hard freeze**: the solver returns immediately when no laws are
  active — no integration, friction, signals, lifecycle, or reproduction.
  Movement and interaction only exist while a law governs them.
- **AGE moved to solver core**: age is now advanced by the solver each tick as
  a frame counter (not inside the LIFE law), so oscillator phase and lifecycle
  gating progress consistently with or without LIFE, and freeze only under the
  zero-laws gate.

### Tests
- **New lawGating.test.js**: zero-laws no-op, COMMS-off immobility, COMMS-on
  emission accumulation.
- **signal.test.js** updated to enable COMMS where signal behavior is asserted.

## [4.1.1] - 2026-08-03

### Render
- **Motion trails removed**: the simulation canvas now fully clears each frame
  so the atmospheric backdrop shows through cleanly; the previous
  `destination-out` fade is gone.


## [4.1.0] - 2026-08-02

### PIZZAZ — Atmosphere & Micro-Interactions

#### Render
- **Motion trails**: the simulation canvas now fades each frame toward
  transparency (`destination-out`, 0.22/frame) instead of an opaque clear, so
  fast-moving particles streak like bioluminescent plankton. Trails freeze
  crisply while paused.
- **Particle glow**: every non-star particle gets a soft bloom halo (~2.4×
  radius, 30% alpha) under its crisp core; gravitational stars keep their
  radial-gradient corona.
- **Atmospheric backdrop**: new `#bg-canvas` layer behind the sim paints a
  deep-space radial gradient, three accent-hued nebula blobs, a deterministic
  starfield, and a cinematic vignette. Repaints on window resize.
- **CRT scanlines**: a subtle 1px repeating scanline texture sits over the
  simulation viewport (below the UI layer) for the neon-noir lab feel.
- **GLOW law** now applies a subtle additive warm lift after the frame instead
  of a pre-pass that would have fought the motion trails.

#### UI
- **Toolbar**: drop shadow + a slowly pulsing blue→red accent sheen along the
  bottom edge; buttons lift and glow blue on hover, orange pulse while active
  (play/pause), red glow on the chaos button.
- **Tabs**: active tab text glows red; hover gains a soft white shimmer.
- **HUD**: color-coded live stats — FPS green, population blue, species
  purple, tick dim.
- **Law toggles**: active law buttons gently pulse brightness.
- **Drawer**: hide/show now slides the drawer below the viewport (transform +
  visibility transition, 0.28s) instead of snapping with `display:none`, with
  a red accent hairline along its top edge.


## [4.0.4] - 2026-08-02

### Simulation
- **Spawn NaN bug fixed — no more instant clumping**: the spawn jitter called
  `prng.nextFloat()` with no arguments, but the SplitMix32 helper signature is
  `nextFloat(min, max)` — it returns `NaN` without them. Every particle spawned
  at `NaN`, and the solver's defensive reset then teleported the whole
  population to the world center on the first tick (this was also why only a
  single particle appeared visible in earlier builds). Jitter now uses
  `nextFloat(0, 1)`; headless verification shows the 1,250-particle population
  staying spread across the full world volume through tick 100+.


## [4.0.3] - 2026-08-02

### Simulation
- **Un-clumped spawn**: each species now spawns on its own grid spanning the
  full world volume, so populations start interleaved across the dish instead
  of every species occupying a contiguous depth slab (which read as dense
  clumps at boot).

### Camera
- **Pan direction fixed**: the view now follows the fingers on both axes
  (world shifts opposite the drag); horizontal pan was previously inverted.
- **Zoom no longer pans**: two-finger centroid drift under 10px is ignored
  during a pinch, so zooming in/out keeps the view still.
- **Easier rotation**: orbit sensitivity roughly doubled — mouse drag
  `0.003 → 0.006` rad/px, one-finger touch orbit `0.005 → 0.008` rad/px
  (still scaled by the settings-panel sensitivity multipliers).


## [4.0.2] - 2026-08-02

### UI
- **Drawer hide/show**: a dedicated `▼` button on the right of the tab bar
  fully hides the bottom drawer (unlike minimize, which keeps the tab strip);
  a floating `▲` pill at the bottom-center of the screen reopens it.
- **Camera recenter on drawer toggle**: the camera resets to the default
  world-centered view whenever the drawer is hidden or shown, so the dish
  never appears cut off or off-center after a layout change.

### Render
- **Removed leftover test overlay**: the red diagnostic dot and
  `particles=N` text drawn at canvas center are gone; the red "stuck
  particle" at the top edge of the drawer was this debug artifact.

### Simulation
- **Denser default population**: `DEFAULT_PARTICLES_PER_SPECIES` raised from
  50 to 250 (1,250 particles at boot), so the world reads as populated
  instead of a handful of scattered dots. Spatial-grid solver keeps the
  per-frame cost in the same range.


## [4.0.1] - 2026-08-02

### UI
- **Drawer Minimize button**: a dedicated `▁` button on the right of the tab
  bar collapses the bottom drawer to a thin strip (click `▔` to expand it
  again). State is per-session; hidden tab content resumes where it was.

### Camera
- **Perspective stretching fixed**: perspective depth is now computed in
  pixel space (`rz2 × px/unit × PERSPECTIVE_STRENGTH`) instead of raw world
  units, so depth can never exceed the focal length and invert the projection.
  With `WORLD_SIZE=2000` the old math put world-unit depth (±1700) past the
  focal distance (1200), producing the far-away/stretched look.
- **Default view fits the whole world**: `fitZoomForWorld()` now starts at
  zoom 1 (full dish visible at any world size) instead of the legacy
  `worldSize/120` over-zoom that left ~1 particle on screen.
- **Particles always visible**: the renderer clamps particle screen radius to
  a 1.5px minimum, so sub-pixel dots no longer vanish when the whole 2000³
  world is in view; wheel/pinch zoom in for close inspection.


## [4.0.0] - 2026-08-01

### Integrated Intelligence
- **Five intelligence engines wired into the simulation loop**: Insight (cluster
  detection), Narrative (4-voice commentary), Lineage (birth/death genealogy),
  Goal (self-tuning world constraints), and Timeline (record/scrub playback).
  Engines communicate exclusively through the EventBus; none touch the DOM.
- **World Intelligence Dashboard** (WORLD tab): live cluster count, lineage
  births/deaths/depth, snapshot count, recording toggle, timeline scrub slider,
  and a goal-adjustment log.
- **PREDATION law** (index 51, biology category): mass-difference pursuit,
  prey fleeing, DNA absorption and mass transfer on contact — restored as an
  explicit law toggle with full HELP_DB entry and law-grid icon.
- **Communication DNA system**: signal oscillator emission (PULSE_RATE ×
  SIGNAL_STRENGTH), channel-filtered propagation (TUNING_CH1-4 bandpass via
  normalized tuning dot product), NEIGHBORHOOD_RADIUS gating, PROPAGATION_SPEED
  pacing, SIGNAL_RESP response force + energy feed, and MEMORY accumulation
  with MEMORY_DECAY decay. Signals are now always-on (DNA-driven), not gated
  behind GLOW/TRACK toggles.
- **Offspring lineage anchors**: `applyReproduction` now returns `parentId` so
  every birth is traceable to its parent generation.
- **Goal-engine tunables**: `maxForce`, `dragMultiplier`, `birthRate`,
  `deathRate`, `scanInterval`, `clusterRadius` in `runtimeConfig`, consumed by
  the solver (force clamp ceiling/scale, global damping, REPRO/LIFE synergy
  scaling) and the insight engine (scan cadence/radius).

### Performance
- Renderer phenotype calls pass the shared Float32Array view directly (no
  per-particle `new Float32Array` allocation) — from v3 WIP.
- HUD throttles DOM writes (changed-value + tick % 10 gating).
- DNA analytics skips collection entirely while its tab is hidden.

### World Tuning (inherited v3 WIP)
- Sparse world: 5 species × 50 = 250 initial particles; `WORLD_SIZE` 2000;
  `BASE_RADIUS` range 0.2–4; gravity scaled with world size.

### Fixes
- Predation no longer conflated with TRACK law activation.
- Timeline scrub resets lineage tracking so restored dead flags don't double-log.

### Debug Overlay
- **Unified debug overlay** (`src/debug.js`): one collapsible panel collects
  every debug message since the page started (inline probe, module load, boot,
  restarts, chaos, world changes, errors, unhandled rejections).
- **Tap-to-copy**: tap the overlay header (or ⧉ COPY, or SETTINGS → DEBUG →
  COPY LOG) to copy the whole log as a single JSON object.
- **SETTINGS toggle**: DEBUG OVERLAY SHOW/HIDE, persisted in localStorage.
- Inline `index.html` probe now logs into the shared buffer instead of drawing
  a separate banner, and falls back to a plain banner after 3s if the module
  bundle fails to load.

### Testing
- New `tests/unit/engines.test.js` (insight, lineage, timeline, goal) and
  `tests/unit/signal.test.js` (pulse, propagation, channel filtering).
- 39/39 unit tests pass; vitest timeout raised to 15s for slow CI environments.


## [3.1.0] - 2026-07-29 (VEPA v3 history retained)

### Added
- **1000 Default Particles**: DEFAULT_PARTICLES_PER_SPECIES increased from 50 → 200 (200 × 5 species = 1000 particles)
- **Accretion Gene Fusion**: When particles merge via accretion, the survivor blends DNA from the consumed particle, creating hybrid genetic lineages through mass-based gene transfer.
- **Predation Gene Absorption**: New `applyPredation` law function — larger particles pursue smaller ones via mass-difference tracking, and on contact absorb 5 random DNA traits at 5% rate plus mass transfer. Prey particles flee with jitter-based repulsion.
- **Biological Particle Variance**: Enhanced `applyLifeCycle` with age-based color drift (±mutRate per frame), mass fluctuation tied to energy metabolism, bio-rhythm energy pulses (sin wave at birthRate frequency), and age-scaled senescence probability.
- **Non-Overlapping Bond/Polymer Structures**: Added hard-sphere constraint resolution after position integration — all particles maintain minimum distance based on combined radii. Bonded particles are pulled to their equilibrium distance with stiffness-controlled spring force.
- **Expanded DNA Analytics**: New `collectAndRenderAll` function with overview stats banner (population, avg mass/energy/velocity, bonded count, max bonds), per-species breakdown with 4-metric summaries, species trait profiles showing key DNA parameter averages, genetic diversity indicator, ASCII population density heatmap (8×8), and 4 real-time histogram charts.
- **4 New Histogram Charts**: mass-histogram, energy-distribution, age-demographics, velocity-distribution canvas charts added to DNA tab, updated every 10 physics ticks.
## [3.0.0] - 2026-07-28

### Architecture
- **Clean-slate recreation** with modular ESM architecture
- **Physics Web Worker** with SharedArrayBuffer for off-main-thread simulation
- **Canvas2D renderer** with DNA-driven phenotype expression
- **EventBus architecture** — all subsystems communicate via pub/sub
- **64-law bitmask system** with 5 color-coded categories
- **42-parameter DNA system** with range-validated buffers

### Core Systems
- Spatial hash grid for O(N) neighbor queries
- Law synergy computation (9 synergy rules)
- 30+ law force functions covering physics, biology, chemistry, thermodynamics, metaphysics
- NaN guard system for numerical stability
- Velocity clamp and force magnitude limits

### Intelligence Engines
- **Insight Engine** — spatio-temporal cluster detection with Union-Find
- **Narrative Engine** — 4-voice commentary (Stabilizer, Diverger, Observer, Dissolver)
- **Goal Engine** — auto-tuning world parameters toward stability/complexity targets
- **Lineage Tracker** — evolutionary genealogy with ancestor chains
- **Timeline Engine** — state snapshots and replay

### UI
- Tabbed interface (WORLD, SPECIES, DNA, LAWS, LOG)
- 64-law toggle grid with 5-category color coding
- 42 DNA sliders with range-constrained inputs
- Species selector with colored circles
- Preset save/load via localStorage
- HUD with FPS, particle count, species count, tick
- Keyboard shortcuts (Space, R, 1-5)

### Testing
- Unit tests for PRNG, LawState, DNABuffer, ParticleBuffer, SpatialGrid, Synergy
- Vitest configuration for fast test execution
