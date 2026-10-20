# Stable README Capability Gap Audit

**Audit date:** 2026-10-21  
**Stable reference:** [gemquota/vepa README](https://github.com/gemquota/vepa/blob/master/README.md), blob `69185ff0a286e89d201e92595be709762e90b2d5`  
**Target:** `gemquota/vepa-next`  
**Rule:** README claims are migration targets, not proof that every historical feature is correct. Status below is based on the target's current source tree and implementation files inspected for this audit. "Missing" means no equivalent product/runtime implementation is present in the target tree; it does not mean the feature is impossible or that the stable implementation has been independently revalidated.

## Executive finding

VEPA Next is currently a SIM foundation/prototype, not a feature-complete successor to stable VEPA. It has a main entry point, core deterministic/event utilities, configuration transaction/session contracts, snapshots and two-slot storage, fidelity-policy helpers, spatial-grid/contact primitives, and law-registry/manifest/boundary contracts. The current source tree does **not** contain the stable app's `physics/`, `worker/`, `render/`, `ui/`, `dna/`, or `engines/` modules. As a result, almost every user-facing or higher-order capability described in the stable README is missing as an integrated runtime feature.

This is a capability inventory, not a misleading percentage: feature families differ greatly in size and evidence quality, so a single "percent complete" would imply precision we do not have.

## Capability-by-capability disposition

| Stable README capability | Next status | Required work / acceptance evidence |
|---|---|---|
| Browser app and simulation bootstrap | **Partial foundation** | `src/main.js` exists, but no complete stable-equivalent application/runtime integration. Mount and browser smoke tests required. |
| Particle memory model and 100-float stride | **Partial foundation** | Typed-array layout exists; wire authoritative buffers into a solver, worker, snapshots and renderer. Validate stride compatibility and state ownership. |
| Species DNA (64 traits), expression and inheritance | **Missing runtime** | Add DNA schema/buffer, expression, mutation/recombination and species lifecycle with deterministic fixtures. |
| Law catalogue (128 global laws, categories, synergy) | **Partial foundation** | Registry and manifest contracts exist; the stable law catalogue, category metadata, executable implementations, dependencies and synergy behavior are not migrated. Enumerate every source law and give each an implemented or explicit disposition. |
| Law toggles and V5 dead-toggle audit | **Partial foundation** | Manifest validator exists; route single and bulk mutations through one command adapter and connect validation to world-session transactions. |
| WRAP/toroidal boundary semantics | **Contract only** | Boundary proposal contract exists; integrate it with session proposals and the eventual solver/worker. Test save/replay and all-law-clear cases. |
| Core physics laws and contact behavior | **Partial foundation** | A minimal softened-gravity prototype now uses the 100-slot layout and spatial-grid candidate queries; it is not the stable solver. Complete multi-law dispatch, collision/merge/adjoin behavior and stable-source regression fixtures remain. |
| Fields, gravity wells, portals, walls and environment controls | **Missing runtime** | Migrate field buffers, update cadence, wall/portal semantics and UI through SIM-owned state. |
| Camera, particle rendering, HUD and responsive drawer | **Missing runtime** | Migrate renderer/camera and UI projections; prove visibility, zoom/depth, resize, drawer and mobile paths in browser tests. |
| World/DNA/species/law controls and sliders | **Missing runtime** | Rebuild panels as read-only projections that emit commands; migrate search, category filters, bulk controls, slider precision and help. |
| Presets and launch/live configuration precedence | **Contract substrate only** | Connect preset definitions and settings to session proposals; explicit requested/pending/active/applied states and rollback tests. |
| Save/load, world states, undo and import/export | **Contract substrate only** | Snapshot/checkpoint storage exists; still need authoritative runtime state capture/restore, undo semantics, schema migration and corruption tests against real state. |
| Deterministic Web Worker physics and fallback | **Partial foundation** | A versioned worker protocol and async facade with in-process fallback now exist. Wire it into the browser bootstrap; add failure recovery, browser isolation headers and worker-vs-local state equivalence tests. |
| Performance controls and solver auto-tuning | **Missing runtime** | Port interaction budgets/grid controls only after baseline solver parity; measure truncation effects and record reproducible benchmarks. |
| Benchmark CLI/report and stable-vs-next comparison | **Missing runtime** | Port reproducible workloads, per-law ablations, scaling and worker overhead; no parity claim before matched measurements. |
| Insight / cluster detection | **Missing runtime** | Migrate as derived engine with bounded cadence and event/snapshot provenance. |
| Narrative, logs, batching and bounded agency | **Missing runtime** | Add event-backed batching/read models, evidence age, voice/follow controls and reversible actions. |
| Lineage, goal tuning and goal-driven behavior | **Missing runtime** | Add lineage/speciation and goal engine behind deterministic state ownership. |
| Timeline, deep time, epochs and recoverable world events | **Missing runtime** | Add epoch transitions, snapshot restoration and reversible field effects with replay tests. |
| Ecology, biodiversity, food webs and niches | **Missing runtime** | Add metric read models, threshold-triggered events and cross-shard independence where applicable. |
| Communication DNA and signal exchange | **Missing runtime** | Implement oscillator/channel filtering, response forces, energy/memory effects and deterministic tests. |
| Civilizations, groups, roles, roads, nests and economy | **Missing runtime** | Add group detection/membership, construction, trade and collapse semantics; ensure costs/flows are bounded and testable. |
| Memory/culture and intergenerational inheritance | **Missing runtime** | Add persistent species/group memory and deterministic inheritance/adaptation. |
| Society, alliances, conflict and governance | **Missing runtime** | Add policy derivation, alliance/treasury rules, conflict cooldowns and migration/raid/commerce tests. |
| Tools, weapons, barriers, infrastructure and energy | **Missing runtime** | Add inventories, maintenance, treasury/field energy and construction progression with conservation checks. |
| Exotic matter, relativity and quantum macroscale | **Missing runtime** | Port as individually gated, isolated law families with conservation/bounds tests before integration. |
| Stellar physics, black holes and supernovae | **Missing runtime** | Port star seeding, accretion, emission, horizon and shockwave behavior with energy/mass accounting. |
| Synthetic-life frontier / advanced emergent laws | **Missing runtime** | Audit exact law inventory and stable-source tests; migrate only with explicit semantic owners and bounded costs. |
| Chaos Multiplex, shard evolution and fitness selection | **Missing runtime** | Add isolated shard worlds, deterministic seeds, fitness metrics, selection/iteration and import-on-exit semantics. |
| Debug log/export and evidence visibility | **Missing runtime** | Add bounded diagnostics and JSON export, derived from actual runtime events. |
| Deployment, COOP/COEP and browser capability fallback | **Missing runtime / unverified** | Configure and test deployment only after a usable app and worker exist. Do not claim live deployment before a URL is verified. |

## Source-of-truth notes

- Stable README currently describes version **9.1.2** (legacy label **4.9.5**) and includes additions across v8.2–v8.16 and v9.0. The README is used here as a feature inventory, not as a guarantee that all old descriptions remain current.
- Stable's current README says WRAP was retired/replaced by a toroidal world parameter in the v9.1.0-era law recategorization. The V5 rework restores WRAP as an explicit law. This is resolved in Next by keeping `boundaryMode` canonical, matching stable's TOROIDAL EDGES parameter; V5 `law.wrap` is a compatibility command alias and is excluded from canonical `activeLawIds`.
- The target's current law registry requires executable `step(context)` functions. The manifest allows metadata-only entries only when explicitly allow-listed. Keep those concepts separate: declared historical/source law inventory versus laws actually enabled in a given runtime.
- Stable README's advertised tests and benchmark figures are historical references. They must be rerun against the pinned stable source and matched Next workloads before any parity or performance claim.

## Implementation order

1. **Close the SIM contract loop:** single/bulk law command adapter, law manifest checks, boundary proposal through world-session and transaction tests.
2. **Define the actual runtime schema:** canonical law IDs, boundary representation, world parameters, DNA layout and versioned config schema.
3. **Build one vertical slice:** deterministic particle buffer → spatial grid → minimal solver → worker adapter → snapshot/restore → renderer → one browser control.
4. **Establish parity harness:** stable-source fixtures, deterministic replay, per-law comparisons and benchmark workload metadata.
5. **Migrate the remaining feature families** in dependency order: fields and core laws; DNA/species; worker/performance; saves/presets/UI; intelligence/ecology/civilization; exotic/relativity/quantum/stellar; multiplex and reporting.
6. Update this matrix as code and tests land. "Implemented" requires executable source and a passing focused test; browser features additionally require browser evidence.

## Current honest completion state

A minimal deterministic gravity slice now exists and CI passes, but stable README parity is not. No complete solver/worker/render/UI pipeline, no integrated stable law set, no migrated intelligence/civilization/matter systems, no stable-vs-next performance parity and no live deployment are claimed by this audit.


## Follow-up update (2026-10-21)

The sandbox entry point now uses the worker-backed prototype runtime when available and the in-process adapter otherwise. Live gravity and timestep settings are proposed through the world-session transaction boundary. The worker returns a compact render projection rather than transferring the full particle buffer every tick. CI covers the protocol and contract behavior; a real-browser smoke run and stable-source physics parity are still outstanding.
