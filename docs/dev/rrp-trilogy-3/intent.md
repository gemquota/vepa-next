# intent.md — "The World Builds" · The I·J·K Trilogy (trilogy³ arc)

**Session:** RRP v1.3.0 (manual mode — no runtime CLI in repo)
**Date:** 2026-08-18 · **Status:** Design complete, build order locked
**Preceded by:** E·F·A (fields → civilizations → living world, v8.2.0–v8.4.0) and D·G·H (deep time → memory → agency, v8.6.0–v8.8.0) — this is the **third trilogy**, completing the literal 3×3 "trilogy³".

## Goal
Three release sets — **I · Tools & Artifacts**, **J · Society & Governance**, **K · Infrastructure & Energy** — built on the E·F·A + D·G·H substrate. Where the first two trilogies made the world *exist* and *remember/act*, this one makes it *build and transcend*: civilizations stop being emergent clusters and become tool-using, governed, powered societies. Shipping from **v8.9.0**; each set gets the next version when it lands.

## Shared substrate (reused, unchanged)
- **Field grid + `writeField`** (E.1) — artifacts/barriers/mega-structures write into it.
- **Group registry + economy** (F.1/F.3) — treasury, trade, roles are the resource layer.
- **Undo ring** (v7.4+) — every craft/governance/infrastructure action is reversible.
- **Memory buffers + goals + agency** (G/H) — tools/governance feed goal behavior; the actor can build.
- **Epoch/event substrate** (D/A.3) — infrastructure projects progress across eras.
- Release gates: syntax + vitest + build.

## Set I — Tools & Artifacts (`src/state/artifacts.js`) — v8.9.0
- **Artifact registry:** per-group inventory of TOOL / WEAPON / BARRIER artifacts, crafted by spending treasury.
- **Crafting economy:** builders spend treasury + member energy to craft; artifacts decay over time (maintenance cost).
- **Effects:** TOOL boosts group economy income; WEAPON reduces threat (feeds H.2 flee goal); BARRIER writes impassable wall cells at the group territory edge.

## Set J — Society & Governance (`src/state/governance.js`) — v8.10.0
- **Policy vector:** per-group governance — AGGRESSION, OPENNESS (trade), MIGRATION — chosen from member memory + treasury.
- **Alliances & conflict:** close groups with similar policy ally (shared treasury pool); opposed policies conflict (territory-overlap field writes).
- **Effects:** policy shifts member behavior (aggression → foragers raid, openness → trade volume up, migration → disperse) and group stability.

## Set K — Infrastructure & Energy (`src/state/infrastructure.js`) — v8.11.0
- **Resource extraction:** groups harvest ambient INFO/THERMAL field energy at their territory into treasury.
- **Energy grids:** allied groups share power along existing F.2 roads, reducing member energy drain.
- **Mega-structures:** long-horizon coordinated builds (WALL / BRIDGE / HUB) with griefing caps, progressed across ticks/eras.

## Decisions log
| # | Decision | Choice |
|---|----------|--------|
| I.1 | artifacts | per-group inventory, treasury-funded, decaying |
| I.2 | effect | field writes + goal/memory nudges (no new physics) |
| J.1 | governance | per-group policy vector from memory + treasury |
| J.2 | relations | ally on similar policy, conflict on opposed + overlap |
| K.1 | energy | harvest field energy → treasury; grid shares it |
| K.2 | mega | capped, era-progressed constructions |

## Risks
1. **Crafting inflation** — treasury-funded crafts must be bounded (rate + cost + decay).
2. **Barrier griefing** — wall writes need caps (reuse F.2's write budget).
3. **Conflict storms** — governance conflicts must cool down + be reversible.
4. **Energy imbalance** — grid sharing must conserve energy (no free power).

## Out of scope (shelved)
- Physics frontier (exotic matter / relativity / quantum macroscale) — a candidate fourth trilogy.
- True per-particle tool sprites (effects are field/memory-based, not rendered objects).
- Golden-run tick-trace tests.
