# VEPA Roadmap v4

**Status:** Interview decisions consolidated
**Scope:** Product, simulation, architecture, verification, delivery, hosting and deferred research
**Decision authority:** The current accepted decisions in this document supersede earlier formulations where they conflict.

## Relationship to `PLAN.md`

> This document is a product roadmap and acceptance target, not a statement that these capabilities are currently implemented. Treat every unchecked item as proposed until verified against the code and evidence.


`PLAN.md` is chiefly an implementation ledger: it records shipped milestones, code paths, historical validation and the project’s completed audit/remediation work. This roadmap is a broader product and acceptance target. It overlaps with the existing plan on a deterministic physics foundation, modular laws, multiplexing, civilisation systems, history, persistence, architecture and testing, but makes the desired progression and release evidence much more explicit.

The main difference is status: milestones recorded as implemented in `PLAN.md` are not automatically evidence that the stronger acceptance criteria below are met. The roadmap requires per-transition evidence, clear distinctions among observed/derived/inferred claims, replay and recovery guarantees, experimental isolation, explicit privacy defaults, and operational proof for hosted-world economics and rollback. Items not demonstrated by the implementation should remain roadmap targets rather than being represented as shipped. Keep `PLAN.md` as the historical implementation plan; use this document as the product direction and acceptance framework.

## 1. Vision and governing principles

VEPA begins as a physics sandbox and gradually reveals an abstract, high-fidelity civilisation simulation through emergent transitions:

**Particles → molecules → hunting clusters → metastructures → fictional awakening → minds → tribes, technology and culture.**

Each transition is a designed simulation rule, not evidence of real consciousness. The system must distinguish simulated states and behaviours from inferred interpretations and from claims about consciousness in the real world.

### Governing principles

1. **Emergence over scripted outcomes.** Events such as learning, cooperation, conflict, cultural divergence, technology discovery and settlement must arise from explicit mechanics and the simulated history.
2. **Determinism and provenance.** Seeds, laws, configuration, state, version metadata, event history and interventions must be recorded sufficiently to reproduce runs within documented compatibility limits.
3. **Honest uncertainty.** Distinguish observations, derived metrics, inferred explanations and uncertain interpretations. Never present best-effort detection as guaranteed.
4. **No silent simulation changes.** Performance adaptations may simplify only designated rendering layers. They must not alter simulation state, laws, event outcomes or deterministic progression.
5. **Inspectable rules.** Laws and consequential parameters should be discoverable and linked to their assumptions, implementation, affected entities, tests and observable consequences.
6. **Progressive discovery without spoilers.** Teach the initial physics sandbox first. Reveal clearer help and rung names only after the corresponding progression milestone is reached.
7. **Recoverability.** Protect useful save data, checkpoints and event history. Explain destructive actions before execution.
8. **Evidence-based acceptance.** Every requirement has an explicit completion criterion and the appropriate evidence type.
9. **Experimental isolation.** Experimental features run only in separate experimental worlds or saves, not in stable worlds.
10. **Privacy by explicit choice.** Worlds are unlisted by default. Publishing publicly requires an explicit action.

## 2. Product experience and visual direction

### 2.1 Visual language
- Minimal glowing particles with a cyberpunk neon palette.
- Optional, independently configurable overlays and visual layers.
- Tribe colour, territory halos, faint member links, event effects and other cues must reflect actual simulation state.
- Rendering complexity may adapt only through explicitly designated visual layers. The system must explain cost-related degradation and never change the underlying simulation to preserve frame rate.
- Do not add dedicated accessibility-control features to this roadmap. Maintain clear interaction, readable explanations and usable core flows without introducing a separate accessibility-control subsystem.

### 2.2 Secret progression and help
- Cryptic tooltips and law descriptions are the initial hints.
- A cryptic glyph changes as the world reaches a new rung; the rung's name is revealed only after reaching it.
- The initial tutorial teaches the physics sandbox only and should take less than two minutes.
- Clearer contextual help and reference material unlock as rungs are reached.
- Provide searchable reference and optional advanced detail without revealing future progression.

### 2.3 First-run setup
- Start in simple mode with a preset picker, seed field, a few major controls and a way to reveal advanced settings.
- Provide five starter presets: primordial soup, head start, harsh world, peaceful and chaos.
- Allow preview, random seed generation and saved custom configurations.
- Convert arbitrary user text to a deterministic seed while preserving the original text and generated numeric seed.
- Explain likely behaviour and resource/performance costs without promising outcomes that the simulation cannot guarantee.

## 3. Simulation foundations and laws

### 3.1 World configuration
A canonical, validated, versioned configuration contains:
- Seed input and derived seed.
- Law modules and their parameters.
- Initial world settings and feature selections.
- Supported/experimental status and dependencies.
- Preset identity and user overrides.
- Boundary assumptions and simulation units or normalized quantities.
- Compatibility/version metadata and provenance.

Configuration must serialize deterministically, support migration, validate before execution, and show conflicts with proposed corrections. Consequential corrections require approval; preserve the original configuration for review.

### 3.2 Law modules
- Use modular, versioned, composable law modules with explicit interfaces, constraints, dependencies and tests.
- Link each law to its implementation, assumptions, parameters, affected entities, observable consequences, limitations and relevant tests.
- Record relevant physical quantities such as energy and momentum where the model claims they apply.
- Document numerical approximations and error behaviour for developers and advanced inspection, without exposing low-level numerical detail by default to ordinary users.
- Experimental laws must be isolated in experimental worlds/saves.

**Law changes require a world restart.** There is no mid-run mutation of laws or their parameters. Preserve event and configuration history so that the user can compare runs and understand which settings produced which outcomes. Observation, inspection, camera controls and replay navigation must not silently mutate simulation state.

### 3.3 Simulation and time
- Keep simulation timestep, simulation speed, wall-clock time and rendering rate separate.
- Support deterministic stepping and document interpolation or numerical limits.
- A paused simulation, checkpoint restart, same-seed reset and new world are distinct operations.
- Preview destructive consequences and preserve recoverable data where possible.
- Do not fast-forward a world to compensate for time away until replay verification is established.

### 3.4 Boundaries and physical assumptions
- Make boundary conditions and assumptions explicit, configurable where appropriate, and part of exported configuration and replay metadata.
- Separate world extent, resolution, density and population limits; state relevant units or normalized quantities and computational costs.
- Environment mechanics must be justified by the actual particle-world model. Do not assume terrestrial day/night cycles, rain, surface biomes or other Earth-like conditions without an explicit model that supports them.
- If environment-like mechanics are included, document their rules, effects, provenance and limitations. Disasters must arise from applicable simulated conditions and leave state changes that can be inspected.

## 4. Persistence, replay and provenance

### 4.1 Save and export contract
Persist or export, as selected by the user:
- Seed and canonical configuration.
- Law definitions/versions and relevant parameters.
- World state from supported simulation levels, from molecules through agents.
- Event history, intervention/configuration history and timestamps or simulation-time markers.
- Entity names, lineage, traits, relationships, memories where supported and notable histories.
- Highlights, replay references and regenerable clip metadata.
- Version, compatibility and integrity metadata.

Provide selectable compact, archival and full-fidelity profiles. Estimate storage growth, warn early, and protect recovery data when retention limits are reached. Cleanup must require explicit choices before destructive deletion.

### 4.2 Replay
- Replay should reproduce the same state exactly wherever technically feasible.
- Versioned replay must check compatibility and report incompatibility or divergence explicitly.
- Cross-version or cross-device limitations must be documented rather than concealed.
- Keep deterministic event history and checkpoints; do not promise guaranteed replay when only best-effort reconstruction is available.
- A highlight should ideally be regenerable from seed/state plus the event's simulation time and relevant location/state context rather than requiring every video to be stored.
- When exact reconstruction is not possible, identify the limitation and retain any stored clip or checkpoint available.

### 4.3 Corruption and recovery
- If a save is corrupted or incomplete, load the latest readable state.
- Preserve the original damaged save and recovery material where feasible; do not overwrite the only recoverable copy before validation.
- Use versioned local persistence, atomic writes, integrity checks, checkpoints and migration procedures.
- Diagnostics should provide actionable recovery options and an error reference suitable for support.

### 4.4 Entity and event history
- Keep detailed histories for notable agents and compressed records for ordinary activity.
- Provide configurable retention and export.
- Event records should link to relevant entities, rules, checkpoints and replay availability.
- Distinguish observed facts from inferred causal explanations and uncertainty.
- Preserve lineage and notable events, with configurable follow-on navigation after an agent dies.

## 5. Emergence ladder

Each rung is a distinct simulation capability with inspectable criteria, reproducible evidence and visible but state-faithful presentation.

### Rung 0: particles and physical interactions
- Establish a stable physics sandbox with documented interaction laws and inspectable state.
- Allow pause, reset, deterministic stepping and seed reproduction.
- The introductory tutorial covers only this level.

### Rung 1: molecules
- A molecule qualifies through explicit stability and function criteria, such as retaining shape for a defined duration and performing a supported function.
- Criteria must be inspectable and discovered through simulation rather than asserted by a hidden label.
- Self-copying molecules provide the transition toward coordinated clusters.
- Track candidate formation, stability, failure and reproduction with lineage/provenance.

### Rung 2: hunting clusters
- Larger clusters may attract or absorb smaller ones under explicit physical and energetic constraints.
- Pursuit, contact, absorption, evasion, fragmentation and escape must be distinguishable in state and history.
- Hunting strategies and cooperation emerge from structure, local conditions and available signals; success is not guaranteed.
- Absorption may transfer material or energy and alter structure/capability only according to the implemented rules.

### Rung 3: metastructures
- Clusters dock through geometry/shape compatibility and explicit physical constraints.
- Stress failure depends on stress, geometry and connection strength, with progressive deformation where supported.
- Whole-structure reproduction is governed by explicit viability and variation rules.
- Formation, breakup, reproduction and failure are inspectable and reproducible.

### Rung 4: fictional awakening
- Awakening depends on the specified measurable conditions, including sufficient size, structural complexity, intact survival duration and memory.
- Use one fixed global threshold across worlds. Do not make it user-tunable or independently configurable per world.
- No random spark: the same compatible seed and configuration must reach the same result.
- Record the candidate, evidence, threshold-relevant state and awakening time.
- Present a brief glow or pulse, a highlight/alert and an immediate name derived from identity/lineage, followed by observable purposeful action.
- Treat awakening as a fictional game law, not proof of real consciousness.

### Rung 5: minds
- Provide rule-based minds for agents, using measurable internal states such as hunger, safety and social needs.
- Learning from experience and nearby agents must use explicit, inspectable mechanisms.
- Emotion-like internal states may influence decisions, memory and relationships when supported by the model.
- Purposeful action must be distinguished from ordinary interaction through evidence of the applicable decision rules; avoid claims about real consciousness.
- LLM-assisted minds are restricted to a small fixed set of notable agents and are experimental until their cost/benefit is profiled.
- Eligibility may include leaders, first awakeners, technology discoverers and long-lived elders, with transparent rules as roles change.
- If LLM capability is unavailable or unaffordable, offer a visible rule-based fallback that preserves identity/state and records the change. Never misattribute fallback behaviour to an LLM.
- Do not treat the original estimate of roughly 20 LLM agents or US$0.43/hour as a guaranteed budget.

## 6. Resources, populations and environmental pressure

- Resource types should include food, minerals, energy and additional types only when justified by the simulation.
- Resource patches have explicit quantities, depletion, regrowth and interaction rules. Visual intensity reflects actual quantity/state.
- Resource exchange must distinguish categories and record transfers, costs and consequences.
- Seasonal or environmental cycles may affect resource availability, behaviour, breeding or migration only where those mechanics fit the modelled environment.
- Migration emerges from local conditions and agent behaviour; record failed journeys, group movement and cultural effects.
- Species-specific tolerances, energy loss, shelter or hazard responses require explicit rules and observable effects.
- Disasters emerge from supported conditions, can be configured, and leave persistent, inspectable consequences.
- Do not hard-code farming as terrestrial crop cultivation. Model resource production appropriate to the particle world.
- Hunting, reproduction, survival and competition must be governed by explicit local interactions, population/resources, geometry and applicable environmental conditions.

## 7. Tribes, culture and civilisation

### 7.1 Tribe formation and visualisation
- Provide one Tribes toggle with cost shown, defaulting on when the budget allows.
- Keep a civilisation statistics panel.
- Tribe visuals can include colour tint, territory halos and faint member links, each independently configurable.
- Culture spreads through observable learning/transmission events. Symbols emerge through use and may drift; avoid a fixed universal taxonomy.
- Traditions and inherited symbols should reflect actual parent/community transmission.
- Tribe formation, fighting, trade, merging, absorption and drift splits must be separate event types with inspectable causes and consequences.
- Conflict outcomes may include intimidation, flight, displacement, surrender, death or other explicitly supported outcomes. Do not assume every fight ends in death.
- Merging can create a shared identity; absorption can preserve the absorber's identity. Outcomes depend on compatibility, power and the rules implemented.
- Cultural drift and splitting should be gradual and visible before a split. Distinguish peaceful separation from hostile schism where state/history supports that distinction.

### 7.2 Roles, technology and knowledge
- Roles emerge from behaviour, skills, resources, relationships, technology and environmental demands. Leaders may emerge, change or disappear.
- Technology progression emerges without a mandatory universal tree. Era labels summarise technologies actually present.
- Each tribe may discover different technologies. Record whether knowledge was independently discovered, observed, taught, traded, inherited or acquired through conflict.
- Trade emerges from resource/interactions and must expose exchanged goods, costs, risks and cultural consequences.
- Conflict must not automatically transfer technology; transfer requires an actual supported mechanism.
- Biological/structural inheritance and social/cultural transmission are distinct and separately recorded.
- Beliefs emerge from evidence and cultural context; they can change or disappear.
- Rituals emerge from repeated behaviour/shared conventions. Effects must come from explicit rules, not arbitrary supernatural outcomes.
- Myths about the player vary by culture, evidence and history. Law changes can affect belief only through the modelled evidence/interpretation pathway.

### 7.3 Relationships, family, towns and lost technology
- Friendships and rivalries arise from repeated interactions and may cross tribe boundaries.
- Bonds, grudges and cultural patterns may be transmitted only through explicit inheritance/learning mechanisms.
- Family-tree navigation supports ancestors, descendants, inherited traits and cultural transmission, with long or notable lineages highlighted.
- Towns emerge when population, structures and activity support a settlement; names, paths, work areas and settlement history reflect actual state.
- Structures may serve shelter, defence, storage or other implemented functions, be built collaboratively, decay and become ruins.
- Ruins and leftover tools may support rediscovery and reuse under explicit rules. Lost-technology events can become highlights.
- Taming is deferred until the underlying systems are stable.

## 8. Notable events, history and return experience

### 8.1 Event detection
Track events such as:
- New species or classifications, extinctions, population crashes and major anomalies.
- First stable molecule, first hunting cluster, first metastructure and every awakening.
- Tribe formation, splitting, fighting, merging and significant cultural change.
- First myth/shrine, first town, major rituals, technology discovery and lost technology.
- Significant structures, lineage milestones and other events supported by explicit criteria.

For every milestone, define its detection rule, evidence and replay/checkpoint link. Separate guaranteed milestone detection from best-effort anomaly detection. Define firsts by explicit per-world criteria and distinguish genuine new events from imported or replayed history.

### 8.2 Return experience
- Show a personalised text summary first, with clips on demand.
- Provide a navigable timeline with filters, entity links and jumps to relevant moments.
- Offer a story-style feed grounded in recorded events; label inferred causal links and uncertain interpretations.
- Let users follow agents, lineages, tribes, roles, families and notable events.
- On death, preserve history and offer configurable navigation to a descendant/relative, another notable agent or no follow.
- Local worlds pause when not running. Hosted worlds follow their explicit lifecycle/credit policy.
- Fast-forward after absence remains deferred until replay verification.

## 9. Sharing, hosted worlds and community

### 9.1 Sharing and portable state
- Share seeds with laws/configuration, compatibility/version details and optional previews.
- Share highlights as videos/GIFs/story cards or event links where supported, ideally with enough state/seed/event information to regenerate the moment.
- Include privacy controls. A shared seed preview should not silently publish a live world.
- Portable being cards may include identity, state snapshot, lineage, traits, memories where supported and event history.
- Validate imports against compatibility and model constraints. Reject incompatible imports rather than silently changing their meaning.

### 9.2 Hosted worlds and credits
- Hosted simulation may be paid; the price must not exceed approximately three times hosting cost.
- Credits may be earned or bought under a transparent, configurable policy. Potential earning actions include daily play, sharing, inviting friends and verified milestones, with anti-abuse safeguards.
- Show live or estimated costs, resource use and cost attribution.
- When credits expire, preserve the specified grace behaviour: 1% simulation tick rate for up to 48 hours, then pause and save; topping up resumes from the saved state. Explain this lifecycle before launch.
- Local worlds pause; hosted worlds continue only while their hosting/lifecycle rules allow.
- Rollback capability is mandatory before hosted worlds launch.
- Publicly visible worlds require explicit publication. Default world status is unlisted. Owners control link sharing and visitor permissions; visitors are read-only by default.

### 9.3 Gallery and social features
- Provide a gallery to browse and watch worlds and copy/fork them into independent runs.
- Include seed/configuration, version, compatibility and provenance metadata for shared worlds.
- Defer gallery ranking until verification is reliable.
- Defer public leaderboards until replay/results can be verified.
- Challenges are deferred until replay verification.
- Comments and likes are later hosted/community scope and require moderation.
- Verified and unverified results must never be presented as equivalent.

## 10. Monetisation and telemetry

- Open source is the baseline.
- Hosting is the primary chargeable service. Optional paid tools, sponsorships or affiliate arrangements may be considered without placing core simulation functionality behind a paywall.
- Donations may provide cosmetic options only: a small initial set of palettes, themes, glyph styles or supporter presentation.
- No paid functionality, simulation advantage or competitive advantage.
- Hosting prices must remain at or below the approximately 3× cost ceiling.
- Anonymous usage analytics are enabled by default with a clear opt-out.
- Diagnostics are separate from analytics, with explicit data categories and retention controls.
- Publish benchmark methodology, configuration, hardware and results so performance claims can be interpreted.

## 11. Architecture and implementation contracts

### 11.1 System architecture
- Separate a modular simulation core from rendering adapters and UI.
- Define stable interfaces and explicit state/event contracts.
- UI actions must not silently mutate simulation state.
- Use Web Workers for simulation work where supported.
- GPU-rendered 3D is the selected rendering direction.
- Keep subsystems independently testable, with documented dependencies and capability requirements.
- Use explicit extension/package interfaces for user-created law/configuration packages. Record dependency versions and compatibility even though extension packaging can evolve.

### 11.2 Resource budgets and degradation
- Measure simulation throughput, rendering, memory and storage independently.
- Use one fixed reference hardware target, with separate metrics for each dimension.
- Show estimated frame-rate impact, battery drain, budget share and hosted credits/hour where applicable.
- Warn before heavy features are enabled and remember user choices where appropriate.
- If actual costs rise, warn again and explain the cause.
- Protect core simulation correctness and responsiveness through budget planning, but do not silently change laws, state or outcomes.
- If a capability is unavailable, explain the loss and offer explicit disable/fallback choices.

### 11.3 Browser and release targets
- Mobile browser first.
- Official support is limited to the current primary mobile browser; other browsers are best-effort.
- Use a versioned release pipeline with automated tests, reproducible artifacts where feasible, compatibility checks, release notes, deployment validation and recovery planning.
- Rollback is optional for early releases and mandatory before hosted-world launch.

## 12. Verification, acceptance and release governance

### 12.1 Requirement tracking
- Maintain a consolidated requirement checklist linked to implementation issues.
- Organise requirements into coherent systems with explicit sub-requirements, dependencies, risk and acceptance criteria.
- Maintain a navigable master roadmap, phased summaries, implementation-ready feature trees, a dependency graph and a ranked backlog.
- Separate current baseline, target behaviour and acceptance evidence.
- Record assumptions and revisit them during implementation.
- Ask for clarification only when the decision could materially affect architecture, cost, safety or user outcomes.

### 12.2 Evidence types
Use the evidence appropriate to each requirement:
- Unit and integration tests for law modules and interfaces.
- Determinism and replay checks for reproducibility requirements.
- Regression tests and seed suites for progression and event detection.
- Numerical stability and conservation checks where the model claims those properties.
- Performance benchmarks for simulation throughput, rendering, memory and storage.
- Smoke tests for end-to-end paths.
- Manual review and demonstration where suitable.

Manual demonstration may establish that a feature is present, but does not replace automated checks explicitly required for determinism, numerical stability, persistence or performance. A checklist item should identify what evidence is required before it can be marked complete.

### 12.3 Defects and release gates
- Any known defect blocks a stable release, regardless of severity.
- Log conflicts between intended and actual behaviour and resolve them explicitly.
- Validate configurations before execution and require approval for consequential corrections.
- Provide diagnostics and actionable recovery options.
- Publish a changelog for each release.
- Maintainers approve contributions.
- Deprecations require migration guidance.
- Release acceptance includes core requirement checks, smoke tests, appropriate replay/determinism evidence, performance results and manual review.
- Preserve partial work and recoverable data when operations fail or time out.

## 13. Phased delivery roadmap

The phases below are dependency-driven rather than fixed calendar estimates. A phase is not complete merely because its code exists; its acceptance evidence must pass.

### Phase 0: Contracts and executable foundation

**Goal:** Make the simulation reproducible, inspectable and safe to extend.

Deliver:
- Canonical versioned configuration and deterministic seed conversion.
- Modular simulation core, renderer boundary and state/event contracts.
- Law metadata, validation, explicit boundaries and restart-required law changes.
- Versioned persistence, atomic writes, integrity checks, checkpoints and recovery.
- Event/state inspection and structured diagnostics.
- Baseline tests, seed suites and reference-device benchmarks.

**Exit criteria:** A configured world can run, save, recover, inspect and replay within declared compatibility limits; divergence and unsupported capabilities are reported rather than concealed.

### Phase 1: End-to-end emergence

**Goal:** Deliver a small but complete world that demonstrates the emergence ladder's core physical transitions and persistent history.

Deliver:
- Physics sandbox and short tutorial.
- Molecule criteria and self-copying bridge.
- Hunting clusters and metastructures.
- Candidate/awakening evidence with one global fixed threshold.
- Rule-based agent decisions and basic notable-event history.
- Minimal visual language and rendering-only budget adaptation.

**Exit criteria:** An end-to-end world can be created, run, saved, loaded, inspected and replayed. Each required transition has its own acceptance check; no single 15-minute/30-FPS combined milestone substitutes for these checks.

### Phase 2: Tribes and culture

**Goal:** Demonstrate emergent civilisation-level interaction.

Deliver:
- Tribe formation and toggle/cost display.
- Culture transmission, emergent symbols and traditions.
- Conflict, trade, merge/absorption and drift split.
- Tribe visual layers and civilisation statistics.
- Event provenance, cultural histories and lineage records.

**Exit criteria:** Each event class can be observed, recorded and inspected with evidence. Visuals match the actual event and state; the end-to-end world remains reproducible under supported conditions.

### Phase 3: Agents, relationships and technology

**Goal:** Expand the world from tribe-level events to persistent individual and collective histories.

Deliver:
- Agent following, life-event timeline, family trees and relationship links.
- Age/life stages, reproduction, mortality and structures.
- Tools, resource production appropriate to the model, roles and emergent technology.
- Knowledge transmission, myths, rituals, settlements, ruins and lost technology.
- Return summaries and event navigation.

**Exit criteria:** Individual histories, lineage, cultural transmission and technology discovery can be traced to recorded events and applicable rules. Taming remains deferred until the underlying systems are stable.

### Phase 4: Reliable replay and sharing

**Goal:** Establish trust in reproducibility before competitive or accelerated features.

Deliver:
- Versioned exports and imports.
- Seed/configuration/world sharing and portable being cards.
- Replay verification, compatibility warnings and divergence reports.
- Regenerable highlights where feasible.
- Privacy controls and unlisted-by-default world sharing.

**Exit criteria:** Compatible runs reproduce within declared guarantees; incompatible imports are rejected; shared content exposes version and provenance; recovery does not silently discard the only usable state.

### Phase 5: Hosted worlds and sustainable operations

**Goal:** Introduce hosted simulation with transparent costs and recovery.

Deliver:
- Credit and hosting lifecycle.
- Cost estimates and attribution.
- Grace, pause/save and resume behaviour.
- Unlisted-by-default visibility, explicit publication and read-only visitors.
- Hosting support, operational diagnostics and rollback.

**Exit criteria:** Cost ceiling is respected, credit exhaustion follows the documented lifecycle, save/recovery is tested, privacy defaults are enforced, and rollback is operational before launch.

### Phase 6: Verified community features

**Goal:** Add community systems only when their results can be trusted and moderated.

Deliver:
- Gallery browsing and world forking.
- Moderated comments/likes.
- Challenges and public leaderboards only after replay/result verification.
- Verified/unverified result distinctions and anti-abuse measures.
- Minimal donation cosmetics.

**Exit criteria:** Shared-world provenance is visible; verification status cannot be confused; moderation and abuse-handling are operational. Ranking, challenges and leaderboards remain deferred until their verification gates pass.

### Phase 7: Experimental research and deferred backlog

**Goal:** Explore costly or speculative capabilities without destabilising the stable simulation.

Candidates:
- LLM minds for a small fixed set of notable agents.
- Self-models and measurable behavioural markers.
- Emergent language and translation.
- Dialogue with beings.
- Reactive ambient music.
- Multiplex branch-tree proof of concept.

All experiments run in separate experimental worlds/saves. Each requires a stated hypothesis, measurable success criteria, cost profile, reproducibility limits and a decision to promote, revise or abandon. Self-models and behavioural markers must not be represented as proof of real consciousness.

## 14. Deferred and excluded scope

### Deferred
- Fast-forwarding time away until replay verification.
- Challenges until replay verification.
- Public leaderboards until result verification.
- Gallery ranking until verification.
- Taming until foundational systems stabilise.
- Multiplex branch tree, except a possible small proof of concept after the core.
- LLM minds until cost/benefit profiling.
- Self-models, emergent language, translation and dialogue as research extensions.

### Excluded or superseded
- Mid-run law/parameter mutation; changes require restart.
- User-configurable or per-world awakening thresholds; one fixed global threshold is used.
- Public-by-default world visibility; worlds are unlisted by default.
- Experimental features inside stable worlds/saves.
- Terrestrial environmental assumptions that are not justified by the actual simulation.
- Farming as a conventional terrestrial crop system.
- Revival; death is final.
- Dedicated accessibility-control subsystem.
- Paid gameplay functionality or competitive advantages.
- Any stable release while a known defect remains.

## 15. Final acceptance checklist

A release candidate should not be considered complete until the applicable items below are evidenced.

- [ ] Requirements are linked to issues and have explicit acceptance criteria.
- [ ] Configuration is canonical, validated, versioned and reproducibly serialized.
- [ ] Law changes require restart and are recorded in configuration/history.
- [ ] Simulation and rendering are separate; visual adaptation cannot alter simulation outcomes.
- [ ] Save writes are atomic and integrity-checked; recovery preserves the latest readable state and original recovery material where feasible.
- [ ] Replay compatibility is checked and divergence is reported.
- [ ] Required progression/event checks are individually defined and tested.
- [ ] Event records distinguish observations, derived metrics and uncertain interpretations.
- [ ] Performance, memory and storage have separate measurements on the reference device.
- [ ] Experimental features are isolated to separate worlds/saves.
- [ ] Imports reject incompatible data rather than silently transforming it.
- [ ] Worlds default to unlisted; publication requires explicit action.
- [ ] Analytics opt-out is available; diagnostics remain separate.
- [ ] Hosting costs and credit lifecycle are transparent; price remains within the agreed ceiling.
- [ ] Rollback is operational before hosted-world launch.
- [ ] A known defect blocks a stable release.
- [ ] Release notes, migration guidance and recovery procedures are present.
- [ ] Manual demonstration is supplemented by all automated checks required by the relevant acceptance criteria.

---

**Roadmap rule:** When implementation reality conflicts with this document, record the conflict, distinguish intended from actual behaviour, analyse alternatives and consequences, and obtain approval for consequential changes. Do not silently weaken a requirement or present a best-effort result as a guaranteed one.
