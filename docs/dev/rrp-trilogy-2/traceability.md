# traceability.md — D·G·H Trilogy Traceability Matrix

| Goal | Constraint | Decision | Risk / note |
|---|---|---|---|
| D: eras | navigable history | tick-boundary epochs + restorable snapshots | 1 MB/snapshot — cap 16, evict oldest |
| D: time | real solver speed | TIME_SPEED → runtimeConfig.simSpeed | extreme dt — clamp envelope |
| D: extinction | bounded + reversible | threshold on population delta | undo checkpoint first |
| D: recovery | bounded + reversible | threshold on rebound | field write + journal |
| G: memory | survives generations | per-species/per-group Float32Array (JS) | sync on speciation/extinction |
| G: culture | non-genetic | parent→offspring + group→recruit copy | gated by CULTURAL_TRANSMISSION |
| G: adaptation | responsive not chaotic | metric+field driven activity shift | bounded nudges |
| H: agency | observer becomes actor | bounded writes (law/param/field) via undo ring | rate-limit + one journal per action |
| H: goals | directed behavior | post-solve velocity nudges | under MAX_FORCE/MAX_VELOCITY |
| H: milestones | emergent quests | metric-triggered, once-only, journaled | dedupe by id |
| Delivery | per set | syntax + vitest + build | no fixed ladder |
| Cadence | per set | full design before each set's releases | — |
