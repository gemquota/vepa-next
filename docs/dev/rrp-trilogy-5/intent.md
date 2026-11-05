# intent.md — "The World Goes Cosmic" · The O·P·Q Trilogy (trilogy³ arc #2, build 2)

**Session:** RRP v1.3.0 (manual mode — no runtime CLI in repo)
**Date:** 2026-08-19 · **Status:** Design complete, build order locked (starts after L·M·N)
**Preceded by:** L·M·N — the substrate transforms (exotic matter, relativity, quantum macroscale). O·P·Q takes the transformed substrate and **scales it to the cosmos**: stars are born from collapsed matter, life stops being biological, and the universe itself becomes a player.

## Goal
Three release sets — **O · Stellar Physics**, **P · Synthetic Life**, **Q · Cosmology** — the second build of the second trilogy³. Where L·M·N changed what matter *is*, O·P·Q changes **what the world contains and how big it is**: gravity wells become stars, intelligence outgrows DNA, and the multiplex shards become a multiverse. Shipping from **v8.15.0**.

## Shared substrate (reused, unchanged)
- **L·M·N exotic substrate** — stars consume exotic zones; black holes feed on dark/negative matter; quantum events seed synthetic life.
- **E.1 fields + wells** — the ACCR/SINGULARITY-adjacent well machinery (already in fields.js) becomes the stellar core primitive.
- **D.1 epochs + A.3 events** — cosmic phases are epoch-driven; supernovae and phase changes are physics-confirmed events.
- **F.1/F.3 groups + K mega-structures** — HUB mega-structures birth synthetic life; groups can become star-faring.
- **Multiplex shards** — the shard boundary becomes the multiverse membrane.
- **Law budget is FULL (128/128)** — same as L·M·N: world params + state passes + field writes + memory nudges only.
- Release gates: syntax + vitest + build.

## Set O — Stellar Physics (`src/state/stellar.js`) — v8.15.0
- **Stars:** deep gravity wells (reusing the E.1 well machinery) that fuse ambient ENERGY into radiant light — a steady scalar field output that warms (raises THERMAL) and energizes the region. Stars form when enough MASS + ENERGY converge in one cell (mass-energy equivalence from M.4 pays off).
- **Black holes:** wells beyond a collapse threshold gain an event horizon — particles crossing are captured (accretion via the existing ACCR behavior) and re-emitted as ENERGY at a slow Hawking-style rate (conserved, leak-proof).
- **Supernovae:** collapsing wells detonate when they exceed a mass cap — a radial field shockwave (damage + scatter), heavy-element seeding (new DNA trait ranges unlock), and a journaled event. Era-progressed frequency (later eras have more stars → more supernovae).

## Set P — Synthetic Life (`src/state/synthetic.js`) — v8.16.0
- **Synthetic organisms:** non-DNA entities born from advanced K mega-structures (HUBs with high treasury + era) — they evolve by a different rule set (program-like traits instead of the 64 DNA params), and are immune to speciation (no slots consumed).
- **Uploaded consciousness:** species reaching an intelligence threshold (REGULATORY_DEPTH + SELECTION_SENSITIVITY + era gate) get a digital copy in a virtual layer — a parallel lineage that keeps evolving without the body's death risk.
- **Machine groups:** synthetic entities register in the F.1 group registry with their own roles; they trade, ally, and conflict with biological groups through the existing economy/relations machinery.

## Set Q — Cosmology (`src/state/cosmology.js`) — v8.17.0
- **Multiverse shards:** multiplex shards interact — ENERGY and exotic matter exchange across shard boundaries (shared field writes at the seam), so one universe's supernova seeds another's nebula.
- **Cosmic epochs:** the D.1 epoch engine scales to universe level — Big Bang (all particles condensed in one dense well, then expansion), Cooling (energy gradients flatten as the world ages), Dark Era (exotic/negative matter dominates late game).
- **Dark energy:** slow universal expansion — the world boundary pushes outward over time (cells drift apart, GRID auto-scale follows), so the dish literally grows.

## Decisions log
| # | Decision | Choice |
|---|----------|--------|
| O.1 | stars | wells + fusion of ambient ENERGY → radiant field |
| O.2 | black holes | collapse threshold + event horizon + Hawking re-emission |
| O.3 | supernovae | mass-cap detonation + shockwave + element seeding |
| P.1 | synthetic | non-DNA program-traits, no species slots |
| P.2 | uploads | digital parallel lineage at intelligence threshold |
| P.3 | machine groups | F.1 registry reuse, full economy/relations |
| Q.1 | multiverse | shard-seam field exchange |
| Q.2 | cosmic epochs | universe-level phase ladder on D.1 |
| Q.3 | dark energy | boundary expansion + drifting cells |

## Risks
1. **Star storms** — too many wells converge into one black hole; mass/energy caps + spacing rules (min star separation) keep the sky sparse.
2. **Supernova cascade** — a shockwave detonating neighboring wells; shockwave damage falloff + detonation cooldown.
3. **Synthetic runaway** — HUBs minting unbounded synthetics; treasury/era gates + upkeep cost (synthetics need energy or they decay).
4. **Shard-seam thrash** — exchange writes at multiplex boundaries could fight the shard determinism slice; rate-cap the seam and keep exchanges journaled.
5. **Boundary growth** — expanding world size re-allocates the grid; reuse the E.1 grid auto-scale path, never reallocate in place mid-tick.

## Out of scope (shelved)
- Interstellar travel / ship mechanics (groups are still territorial, not spacefaring).
- Rendered star sprites (stars are field effects, not new render objects).
- Entropy/heat-death and universe rebirth (Set R — next trilogy R·S·T).
- Golden-run tick-trace tests.
