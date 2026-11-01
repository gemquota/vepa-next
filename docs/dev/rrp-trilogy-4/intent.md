# intent.md — "The Substrate Transforms" · The L·M·N Trilogy (trilogy³ arc #2, build 1)

**Session:** RRP v1.3.0 (manual mode — no runtime CLI in repo)
**Date:** 2026-08-19 · **Status:** Design complete, build order locked
**Preceded by:** E·F·A (the world *exists*, v8.2.0–v8.4.0), D·G·H (it *remembers & acts*, v8.6.0–v8.8.0), I·J·K (it *builds*, v8.9.0–v8.11.0) — this is the **fourth trilogy**, opening the second literal 3×3 "trilogy³": **L·M·N → O·P·Q → R·S·T**.

## Goal
Three release sets — **L · Exotic Matter**, **M · Relativity**, **N · Quantum Macroscale** — that push the **physics frontier** (shelved as a candidate fourth trilogy in the I·J·K intent). The I·J·K trilogy made civilizations *build*; this one makes the **substrate itself transform**: matter is no longer a single substance, space is no longer flat, and particles are no longer classical. Shipping from **v8.12.0**; each set gets the next version when it lands.

## Shared substrate (reused, unchanged)
- **E.1 field grid + `writeField`** — exotic zones, curvature, and shockwaves are field-encoded; every effect writes through the unified API (undo-ring reversible).
- **Group registry + economy** (F.1/F.3) — treasury funds containment/cleanup; societies respond to exotic phenomena.
- **Memory buffers + goals + agency** (G/H) — exotic events nudge species memory; the actor can react.
- **Epoch/event substrate** (D.1/A.3) — exotic zones intensify across eras; events are metrics-triggered + physics-confirmed.
- **Multiplex shards** — exotic state is per-shard, so shards explore different matter regimes independently.
- **Law budget is FULL (128/128)** — no new laws. All effects ride world params + state passes + field writes + memory nudges (the I·J·K pattern).
- Release gates: syntax + vitest + build.

## Set L — Exotic Matter (`src/state/exoticMatter.js`) — v8.12.0
- **Exotic zones:** the field grid gains an EXOTIC field (magnitude encodes zone kind: 1 ANTIMATTER, 2 DARK, 3 STRANGE, 4 NEGATIVE). Zones seed at world start from the PRNG (deterministic — the save-seed slice), intensify with era, and are user-tunable via world params.
- **Matter states:** a parallel per-particle state array (memoryBuffers pattern, main-thread owned) tags particles inside zones; the tag persists briefly after leaving (half-life decay) so boundaries don't flicker.
- **Annihilation:** antimatter + normal matter overlapping within a radius annihilate — both release a conserved ENERGY burst into the field (writeField, energy in = energy out), the antimatter particle dies, the normal one takes heavy damage. Griefing cap per tick.
- **Dark matter:** dark-tagged particles are invisible to predation/foraging (PREDATION_BIAS skips them), render at low alpha, and only gravity-class motion applies — they ghost through the living world.
- **Strange conversion:** strange particles convert normal neighbors at STRANGE_RATE (contagious); converted particles gain high effective mass (slow) + predation immunity. Rate-capped so conversion can't cascade the whole dish in a tick.
- **Negative mass:** negative-tagged particles feel **inverted gravity** — repelled from mass wells (opposite the gradient force), giving self-propelling "repulsor" motion.
- World params: EXOTIC SEED RATE, ZONE SIZE, ANNIHILATION RADIUS, STRANGE RATE, NEGATIVE STRENGTH, STATE HALF-LIFE — a new **MATTER > EXOTIC** subgroup in the setup drawer.

## Set M — Relativity (`src/state/relativity.js`) — v8.13.0
- **Spacetime curvature:** a new E.1 field type (CURVATURE, scalar) warped by mass — dense regions curve space around them; wells and mega-structures add curvature.
- **Gravitational lensing:** SIGNAL propagation bends along curvature (PULSE/INFO beams curve around mass) — communication paths visibly bend.
- **Time dilation:** AGE, decay, and mitosis timers scale by a dilation factor (velocity- and curvature-dependent) — fast or deep-gravity particles age slower; reproduction and senescence slow accordingly.
- **Mass–energy equivalence:** world-param-driven ENERGY ↔ MASS conversion (the E=mc² slider): surplus ENERGY condenses to MASS, mass loss releases ENERGY. Bounded and conserved.

## Set N — Quantum Macroscale (`src/state/quantumMacro.js`) — v8.14.0
- **Superposition:** particles in low-interaction regions hold two position states; the first interaction **collapses** the pair (one position chosen, journal "observed"). Doubles the visual ghosting for superposed particles.
- **Entanglement upgrade:** the existing ENTANGLE stride offsets (75–76) get macro meaning — entangled pairs share ENERGY/momentum across distance; measuring one collapses both.
- **Tunneling:** high-ENERGY particles pass IMPASSABLE walls with probability TUNNEL_RATE (the TUNNELING law stays untouched; this is the macro-probability variant, bounded by ENERGY).
- **Observer effect:** species with high SELECTION_SENSITIVITY/REGULATORY_DEPTH DNA *observe* — proximity collapses nearby superpositions (observation is itself a measurement; feedback into the narrative).

## Decisions log
| # | Decision | Choice |
|---|----------|--------|
| L.1 | representation | EXOTIC field + per-particle state array (no new laws — budget full) |
| L.2 | annihilation | conserved energy burst via writeField; cap per tick |
| L.3 | dark matter | interaction ghosting (predation skip + dim render + gravity-only) |
| L.4 | strange | contagious conversion, rate-capped |
| L.5 | negative mass | inverted gravity (opposite gradient force) |
| M.1 | curvature | new E.1 scalar field type, mass-warped |
| M.2 | lensing | signal paths bend along curvature |
| M.3 | dilation | AGE/timers scale by velocity+curvature factor |
| M.4 | E=mc² | world-param ENERGY ↔ MASS conversion, conserved |
| N.1 | superposition | dual position + collapse on interaction |
| N.2 | entanglement | reuse stride 75–76 macro semantics |
| N.3 | tunneling | ENERGY-gated probability pass through walls |
| N.4 | observer | high-sensitivity DNA collapses nearby superpositions |

## Risks
1. **Per-particle state drift** — the exotic state array must stay index-aligned with the particle buffer across spawn/death; reuse the memoryBuffers alignment discipline.
2. **Annihilation storms** — overlapping antimatter blobs could cascade; radius + per-tick caps + field conservation keep it bounded.
3. **Strange contagion runaway** — rate cap + zone-limited seeding; converted particles are slow so they can't outrun cleanup.
4. **Dilation complexity** — scaling timers means touching AGE/mitosis/decay reads in the solver; keep the factor clamp tight (1.0–0.25) to avoid frozen particles.
5. **Superposition bookkeeping** — dual positions need a second coordinate pair; collapse must be deterministic (PRNG) so saves stay reproducible.

## Out of scope (shelved)
- New law slots (budget is full at 128 — any future law needs a bitmask widening decision).
- True rendered spacetime distortion (lensing is signal-path only, not visual warping).
- Stellar/black-hole physics (Set O — next trilogy O·P·Q).
- Golden-run tick-trace tests.
