# VEPA Planning Traceability

This matrix links normalized planning areas to source records and the evidence required before claiming current implementation. Paths in the source column refer to the original repository locations.

## Status definitions

- **Designed:** present in an RRP intent/design record.
- **Historical claim:** a milestone or guide describes behaviour as present/implemented.
- **Needs verification:** current code/tests have not been independently audited as part of this document refactor.
- **Verified:** may be used only after current source and test evidence is added.

The entries below begin as **Needs verification** unless otherwise stated. This avoids turning historical documentation into an unsupported implementation claim.

## Catalog traceability

| Catalog area | Primary source | Secondary source | Evidence needed for verification |
|---|---|---|---|
| FM-A–FM-D tuning recipes and boundary modes | `GUIDE.md`, §1 | current DNA ranges and law definitions | Current trait ranges, boundary dispatch, seeded behaviour tests |
| FM-E/F colour schemes | `GUIDE.md`, §1 | UI/render modules | Current mapping and rendering tests |
| Medium, fields, walls, portals, wells | `docs/dev/rrp-trilogy/intent.md` | `PLAN.md`, v8.2 milestone | Field schema, `writeField`, solver integration, deterministic field tests |
| Civilizations and economy | `docs/dev/rrp-trilogy/intent.md` | `PLAN.md`, v8.3 milestone | Group registry, accounting paths, membership lifecycle, analytics tests |
| Ecology/speciation/events | `docs/dev/rrp-trilogy/intent.md` | `GUIDE.md`, `PLAN.md`, v8.4 milestone | Slot reuse, speciation queue, metrics, event confirmation and undo tests |
| Performance knobs | `GUIDE.md`, performance section | `PLAN.md`, v8.5/v8.15.1/v8.16.2 milestones | Actual parameter wiring, benchmark reproduction, regression thresholds |
| Deep time and epochs | `docs/dev/rrp-trilogy-2/intent.md` | `PLAN.md`, v8.6 milestone | Tick-boundary transitions, snapshot restore, memory bounds |
| Memory and culture | `docs/dev/rrp-trilogy-2/intent.md` | `GUIDE.md`, v8.7 section | Buffer alignment, transmission rules, replay tests |
| Agency and narrative | `docs/dev/rrp-trilogy-2/intent.md` | `PLAN.md`, v8.8 milestone | Action authority, caps, undo/journal tests |
| Artifacts, governance, infrastructure | `docs/dev/rrp-trilogy-3/intent.md` | `GUIDE.md`, v8.9–v8.11 milestones | Registry/economy consistency, field write caps, multi-tick construction tests |
| Exotic matter, relativity, quantum macroscale | `docs/dev/rrp-trilogy-4/intent.md` | `PLAN.md`, v8.12–v8.14 milestones | State lifecycle, deterministic transitions, conservation/bounds tests |
| Stellar physics, synthetic life, cosmology | `docs/dev/rrp-trilogy-5/intent.md` | `PLAN.md`, v8.15–v8.17 milestones | Thresholds, upkeep, shard exchange, runaway stress tests |
| Entropy, awareness, observer lifecycle | `docs/dev/rrp-trilogy-6/intent.md` | `docs/dev/rrp-trilogy-6/traceability.md` | Rebirth/replay, measurable graduation, bounded observer action tests |
| Intelligence, lineage, timeline, engine wiring | `PLAN.md`, Steps 6–9 | current engine/UI modules and unit tests | Entry-point wiring, tests for metrics/lineage/timeline/goals |
| Chaos multiplex | `PLAN.md`, v4.6.24–v4.6.26 milestones | `docs/mechanics/chaos_multiplex.md` | Shard isolation, import semantics, fitness tests, reproducible benchmarks |

## RRP design-record map

| Record | Scope | State in this collection |
|---|---|---|
| `docs/dev/rrp-trilogy/intent.md` | E, F, A | Consolidated into catalog; original remains authoritative history |
| `docs/dev/rrp-trilogy-2/intent.md` | D, G, H | Consolidated into catalog; original remains authoritative history |
| `docs/dev/rrp-trilogy-3/intent.md` | I, J, K | Consolidated into catalog; original remains authoritative history |
| `docs/dev/rrp-trilogy-4/intent.md` | L, M, N | Consolidated into catalog; original remains authoritative history |
| `docs/dev/rrp-trilogy-5/intent.md` | O, P, Q | Consolidated into catalog; original remains authoritative history |
| `docs/dev/rrp-trilogy-6/intent.md` | R, S, T | Consolidated into catalog; original traceability matrix remains useful history |

The paired `mermaid.md` files are source diagrams. They are not duplicated into this planning set because the normalized catalog and implementation plan are intended to be the maintained human-readable index. Link to or regenerate diagrams only when a concrete workflow requires them.

## Verification log

| Date | Scope | Result | Evidence |
|---|---|---|---|
| Pending | Full catalog-to-source audit | Not run as part of documentation restructuring | Add source paths, test commands/results, and commit SHA after audit |

## Change control

When a feature changes:

1. Update the catalog's intended behaviour and dependencies.
2. Update the implementation plan if order or acceptance criteria change.
3. Add or amend a decision/risk entry if architecture or safety bounds change.
4. Add source and test evidence here, including the commit tested.
5. Do not delete a historical design decision just because implementation differs; record whether it was superseded, rejected, or left incomplete.
