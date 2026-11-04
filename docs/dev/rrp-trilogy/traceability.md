# traceability.md — E·F·A Trilogy Traceability Matrix

| Goal | Constraint | Decision | Risk / note |
|---|---|---|---|
| One substrate | bus-events only | metrics-ring subscriber (single writer) | ring/bus drift — keep one writer |
| Reproducible runs | seed captured | seed in save format | solver already takes SplitMix32 |
| E: fields | adaptive grid | `fields.js`, GRID_DIM 12–24 auto+tunable | 24³ cost — bench |
| E: vector semantics | direction+magnitude | vector fields, every-tick cadence | scalar fields ride magnitude |
| E: coupling | gradient force | HISTORY-law precedent | — |
| E: solid matter | impassable particles | COLL law = hard-matter toggle (velocity-only) | tunneling — clamps/substeps |
| E: walls/biomes | field regions | IMPASSABLE flag + value bands | — |
| E: exotic space | portals+wells in E1 | cell-pair teleport + radial falloff | teleport loop risk |
| E: field writing | unified API | laws/groups/player → `writeField` | construction griefing caps |
| F: groups | declared AND detected | registry + stride 68/85 | slot collision with PHASE usage |
| F: formation | organic | contact thresholds + DNA | — |
| F: roles | 3 roles | leader/forager/builder | — |
| F: membership | open | multi-species alliances, unbounded | — |
| F: economy | full stack | trade + treasury + market prices | price-field stability |
| F: build | nests + roads | field writes | — |
| F: death | collapse | membership zero → dissolve | fission deferred |
| F: visibility | all three | overlay + network graph + Sankey | render cost — throttle |
| A: speciation | slot = taxon | threshold gate × isolation accelerator | slot exhaustion → queue |
| A: split cadence | unrestricted | any qualifying species | split storms — cap per tick |
| A: feedback | visible | burst marker + optional auto-select | — |
| A: extinctions | recyclable | journal + EXTINCT history | — |
| A: analytics | full | curves + food-web + niche, ECO sub-tab | — |
| A: events | hybrid | metrics trigger → physics confirm | false positives on restore/multiplex |
| A: event power | reversible | undo-ring nudges + field writes | event storms |
| A: multiplex | independent evolution | shards speciate; fitness sees species | perf — shard count |
| Delivery | per-release | syntax + tests + build + manual visual | — |
| Cadence | per set | full RRP before each set's releases | — |
