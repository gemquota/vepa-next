/**
 * VEPA4 — Help registry for tabs, sub-tabs, graphs and analytics cells.
 *
 * A single content source for every "what is this thing" string in the drawer.
 * Long-pressing a tab, a sub-tab, a graph or an analytics cell resolves an
 * entry here (see helpOverlay.js) and shows it in a modal or tooltip.
 *
 * Two rules govern this file:
 *
 *   1. It is pure data plus lookup helpers — no DOM, no bus, no listeners.
 *      That keeps the content testable and lets the overlay own all behaviour.
 *   2. Every description must be verifiable against the code that draws the
 *      thing. The graph entries below were written by reading the drawing
 *      routines in dnaAnalytics.js rather than from their titles, because
 *      several titles understate what is plotted. Where the UI label is
 *      misleading, the entry says so rather than repeating it.
 *
 * Coverage is enforced by tests/unit/helpRegistry.test.js: every tab and
 * sub-tab in index.html and every canvas in the DNA chart grid must have an
 * entry, so a new panel cannot ship undocumented.
 */

/** Top-level drawer tabs, keyed by the `data-tab` value on the button. */
export const TAB_HELP = Object.freeze({
  'tab-setup': {
    title: 'SETUP',
    icon: '⚙️',
    summary: 'Everything that changes the world. Laws, world size, species and runtime all apply live to the running simulation.',
    sections: [
      ['What lives here', 'Four sub-tabs: LAWS (the physics/biology switchboard), WORLD (world parameters and presets), SPECIES (per-species DNA and phenotype), SETTINGS (runtime and renderer knobs).'],
      ['Live or not', 'Almost everything here applies to the simulation immediately — no restart needed. The exceptions are marked in their own help entries.'],
      ['Reading the effect', 'A law toggle changes what the solver is allowed to do; it does not itself push particles around. Turn a law on in a quiet world and nothing happens until the condition it describes occurs.'],
    ],
  },
  'tab-saves': {
    title: 'WORLD STATES',
    icon: '🗃️',
    summary: 'Capture, restore, compare and roll back the entire world. Three sub-tabs: stored worlds, the undo ring, and files.',
    sections: [
      ['Three sub-tabs', 'WORLD STATES holds the named snapshots, UNDO holds this session\'s step ring, and IMPORT / EXPORT moves a world as a file.'],
      ['Quick save / undo', 'The toolbar saves a snapshot before destructive changes (restart, chaos, species change, preset load) so a single undo step reverses them.'],
      ['Stored states', 'Named snapshots keep particle buffers, DNA, law state, world parameters and the civilization ontology. Comparing two states shows what moved between them.'],
      ['Backwards compatible', 'Saves written before the civilization ontology existed simply restore without it; the missing field is not an error.'],
      ['Not the same as a preset', 'A preset (WORLD sub-tab) stores laws, DNA and world parameters. A snapshot here stores the particles too.'],
    ],
  },
  'tab-data': {
    title: 'DATA',
    icon: '📊',
    summary: 'Read-only telemetry. Nothing on this tab changes the simulation — it only measures and narrates it.',
    sections: [
      ['What lives here', 'Sub-tabs for INTELLIGENCE (population counters), DNA (the distribution and trend graphs), LOGS (narrative prose), GROUPS (social groups and their economy), ECOSYSTEM (biodiversity) and CIVILIZATION (culture, polities, regime).'],
      ['Why it is read-only', 'Every value here is derived. Editing a readout would desynchronise it from the thing it measures, so these panels deliberately expose no controls.'],
      ['Sampling', 'Charts resample on an interval rather than every frame, and the DNA panel pauses its own render loop while its tab is hidden.'],
    ],
  },
});

/** Sub-tabs, keyed by the `data-sub` value on the button. */
export const SUBTAB_HELP = Object.freeze({
  // ── DATA ────────────────────────────────────────────────────────────────
  'data-intel': {
    title: 'INTELLIGENCE',
    icon: '🧠',
    summary: 'High-level counters for the current world: clusters, births, deaths, lineage depth and snapshots.',
    sections: [
      ['CLUSTERS', 'Particle clusters detected by the insight engine, which groups particles that are close together and behaving alike.'],
      ['BIRTHS / DEATHS', 'Cumulative reproduction and death counts for the world, not per second.'],
      ['LINEAGE DEPTH', 'How many generations of descent the tracker has observed. A flat value across a long run usually means reproduction is not sustaining.'],
      ['SNAPSHOTS / RECORDING', 'Saved history samples and whether the timeline engine is currently recording.'],
    ],
  },
  'data-dna': {
    title: 'DNA ANALYTICS',
    icon: '🧬',
    summary: 'Nine graphs describing the current population and its history, plus per-species trait tables and click-through history.',
    sections: [
      ['Reading the graphs', 'Four are histograms of the *current* population; three are trends over time; one is a scatter of two traits against each other.'],
      ['Selecting a species', 'Click a species in the trait table to isolate it in the multi-series charts.'],
      ['Per-species history', 'Click any DNA statistic in the panel above to open its history for the chosen species.'],
      ['Gestures', 'Long-press any graph for this kind of help. Double-click a graph to expand it full-width; press CLOSE GRAPH or double-click again to shrink it.'],
    ],
  },
  'data-logs': {
    title: 'LOGS',
    icon: '📜',
    summary: 'The narrative voice: emergent events, milestones and the running story of the world.',
    sections: [
      ['What writes here', 'The narrative engine and the world-event engine both emit entries — extinctions, regime shifts, milestones, recoveries.'],
      ['Not a debug log', 'This is a story written from measurements, not a dump of internal state. It will be silent in a world with nothing worth saying.'],
      ['Relationship to the timeline', 'The timeline engine (under WORLD) records restorable world states; this panel only describes them in words.'],
    ],
  },
  'data-groups': {
    title: 'GROUPS',
    icon: '🏙️',
    summary: 'Social groups: how many exist, how many members they hold, their treasuries and their trade volume.',
    sections: [
      ['Where groups come from', 'Two paths. A group can be declared by the player, or detected organically when particles of similar species cluster densely enough to sustain.'],
      ['TREASURY', 'Each group accumulates a shared treasury from its foragers, and spends it on artifacts, upkeep and trade.'],
      ['TRADE VOLUME', 'How much moved between groups in the last economy pass.'],
      ['Where this ends', 'These are individual groups. The multi-group CIVILIZATION sub-tab is the one with tribes, polities and culture.'],
    ],
  },
  'data-eco': {
    title: 'ECOSYSTEM',
    icon: '🌿',
    summary: 'Biodiversity and population balance across species.',
    sections: [
      ['BIODIVERSITY', 'A 0–1 measure of how evenly the living population is spread across species. A value near 0 means one species has taken over.'],
      ['OSCILLATION', 'How much the population is cycling rather than settling — boom-and-bust dynamics show up here.'],
      ['POPULATION', 'Total living particles across all species.'],
      ['Extinction', 'When a species hits zero it is recorded as extinct here and the epoch engine may open an extinction window.'],
    ],
  },
  'data-civilization': {
    title: 'CIVILIZATION',
    icon: '🏛️',
    summary: 'The social layer above individual groups: culture, kinship, tribes, polities, structures, era continuity and the observer\'s codex.',
    sections: [
      ['CULTURES', 'Each detected group is founded one culture holding a pool of symbols and norms. Cultures transmit between peers on alliance and between parent and child on birth, at different fidelities.'],
      ['KIN EDGES', 'Recorded kinship between particles, derived from lineage. It drives household formation and kin resource flow.'],
      ['TRIBES / POLITIES', 'Federations group several groups under a shared identity; polities add territory, citizenship, provinces and institutions with succession.'],
      ['STRUCTURES', 'Buildings with an owner, a treasury-funded upkeep cost and dependencies. A structure whose dependency collapses goes dormant but is not destroyed.'],
      ['REGIME + CONFIDENCE', 'At each era boundary the social world is fingerprinted and compared with the previous era, naming one of seven regimes: thriving, settled, strained, fragmenting, collapsing, empty or emergent. Confidence reflects how much of the fingerprint actually moved.'],
      ['CODEX', 'The observer\'s own statement about the world, built only from measured evidence. When the evidence is thin it says so instead of guessing — it never explains a state by which laws happen to be on.'],
      ['Honest limits', 'These are proxy-level models. They record what was observed and who owns what; they do not model culture or cognition.'],
    ],
  },

  // ── SAVES ────────────────────────────────────────────────────────────────
  'saves-states': {
    title: 'WORLD STATES',
    icon: '🗃️',
    summary: 'Named snapshots of the whole world, with load, compare and delete.',
    sections: [
      ['What a snapshot holds', 'Particles, DNA, the law bitmask, world parameters and the civilization record. Restoring one replaces all of it.'],
      ['The list', 'Each entry shows when it was saved, how many particles and species it holds, its tick, how many laws were on, and its size on disk.'],
      ['COMPARE', 'Compares the saved world against the live one, or several saved worlds against each other, and marks the best value per row.'],
    ],
  },
  'saves-undo': {
    title: 'UNDO',
    icon: '↶',
    summary: 'Step backwards and forwards through this session, and see what is in the ring.',
    sections: [
      ['What commits a step', 'Chaos, Restart, Reset, preset loads, species edits and world-parameter changes each commit an undo step — when AUTO is on.'],
      ['The history list', 'The ring is shown oldest first with the current position marked. The UNDO button was previously a button with no history attached to it; now you can see what stepping back will cost you.'],
      ['UNDO does not leave the page', 'These steps live in this session only. SAVES > WORLD STATES is what survives a reload.'],
    ],
  },
  'saves-io': {
    title: 'IMPORT / EXPORT',
    icon: '⇄',
    summary: 'Move a world in and out as a single .vepa.json file.',
    sections: [
      ['The file', 'One file per world: particles, laws, DNA, world parameters and the civilization record, as JSON.'],
      ['EXPORT LIVE WORLD', 'Writes the world on screen right now without saving it into the list first — useful before a Chaos run you might want to walk back.'],
      ['IMPORT FILE', 'Reads a .vepa.json back into the saved-world list. It does not load it; load it from WORLD STATES afterwards, so you can compare first.'],
    ],
  },

  // ── SETUP ───────────────────────────────────────────────────────────────
  'setup-laws': {
    title: 'LAWS',
    icon: '⚖️',
    summary: 'The law switchboard: 136 physics, biology, chemistry, thermodynamic, metaphysical, electromagnetic, information and quantum laws across nine categories.',
    sections: [
      ['How a law works', 'A law is a permission, not an instruction. Enabling it lets the solver apply that force or rule; it does not by itself move anything.'],
      ['Reading a law', 'Press a law to open its info bar: a one-line hint, a plain-language explanation, and the actual system the solver runs. Long-press a parameter label for its own help.'],
      ['Spectrum colours', 'Each category occupies a 4-point band of the colour wheel and each law gets a distinct hue, so neighbouring toggles stay tellable apart.'],
      ['Mechanics', 'Contact, momentum, wrap, torque, constraint, fragmentation, topology and adhesion sit in a visually separate slate group: they are classical mechanics rather than a new physics category.'],
    ],
  },
  'setup-world': {
    title: 'WORLD',
    icon: '🌍',
    summary: 'World parameters, presets and the network panel: size, physics tuning, epoch length and thresholds.',
    sections: [
      ['Live parameters', 'Changing a world parameter applies immediately and is captured in the undo ring.'],
      ['Presets', 'A preset is a named bundle of laws, DNA and parameters. Loading one is undoable.'],
      ['EPOCH LENGTH', 'How many ticks pass before an era boundary. Each boundary is where continuity is sampled and the codex is allowed to speak.'],
      ['EXTINCTION / RECOVERY THRESHOLDS', 'What population fraction opens an extinction window, and what restores it.'],
    ],
  },
  'setup-species': {
    title: 'SPECIES',
    icon: '🦠',
    summary: 'Per-species genome: the 64 DNA parameters that drive morphology, behaviour and reproduction.',
    sections: [
      ['64 parameters', '42 core traits are cached onto each particle for fast reads; the remaining 22 genetics and regulatory traits live only in the species genome.'],
      ['Live editing', 'Edits apply to the species immediately. The world is snapshotted first, so a bad edit is a single undo away.'],
      ['Metastability warning', 'Changing species mid-run re-seeds the population, so history recorded before the change is no longer comparable.'],
    ],
  },
  'setup-settings': {
    title: 'SETTINGS',
    icon: '🎛️',
    summary: 'Runtime and renderer options: backend selection, performance knobs and display preferences.',
    sections: [
      ['Renderer backend', 'PixiJS and Canvas2D are both selectable, with a parity harness and a published benchmark report comparing them.'],
      ['Performance knobs', 'Grid density, interaction budget and main-thread cadence. These trade visual detail for frame rate on large populations.'],
      ['Applies on reload', 'A few renderer choices need the world to be rebuilt to take full effect; the entry says which.'],
    ],
  },
});

/**
 * Graphs, keyed by canvas id.
 *
 * Written from the drawing routines, not the chart titles:
 *   drawHistogram(...)      -> the four distribution charts
 *   drawLineChart(...)      -> pop-line-graph (one line per species)
 *   drawLineChartSimple(...)-> diversity / avg energy / avg mass (single line)
 *   drawScatterPlot(...)    -> mass-nrg-scatter (mass vs energy, per species)
 */
export const GRAPH_HELP = Object.freeze({
  'pop-line-graph': {
    title: 'POPULATION_TRENDS',
    kind: 'multi-series line',
    summary: 'Living population per species over time. One line per species, coloured to match that species everywhere else in the UI.',
    sections: [
      ['What to watch', 'Lines that cross mean one species is out-competing another. A line that reaches zero is an extinction, not a rendering glitch.'],
      ['Sampling', 'Resampled on an interval, not every frame, so short-lived spikes may not appear.'],
    ],
  },
  'mass-nrg-scatter': {
    title: 'STATE_SCATTER [MASS/NRG]',
    kind: 'scatter, one point per particle',
    summary: 'Every living particle plotted as mass against energy, coloured by species. A cloud, not a time series.',
    sections: [
      ['How to read it', 'The cloud shows the spread of states. A tight cluster means the population is uniform; a wide diagonal means mass and energy are coupled.'],
      ['Empty plot', 'An empty scatter usually means no living particles, not a broken renderer.'],
    ],
  },
  'mass-histogram': {
    title: 'MASS_HISTOGRAM',
    kind: 'histogram of the current population',
    summary: 'How living particles are distributed across mass values, bucketed.',
    sections: [
      ['Direction of travel', 'Growing AGGREGATION law weights push mass upward; without it, mass spreads out.'],
      ['It is a snapshot', 'This is the population right now — it does not accumulate over time.'],
    ],
  },
  'energy-distribution': {
    title: 'ENERGY_DISTRIBUTION',
    kind: 'histogram of the current population',
    summary: 'How living particles are distributed across energy values, bucketed.',
    sections: [
      ['Energy lifecycle', 'Energy is spent on motion and metabolism and replenished by laws such as ENERGY and GLOW.'],
      ['Bimodal shape', 'Two distinct peaks usually mean the population has split into producers and consumers.'],
    ],
  },
  'age-demographics': {
    title: 'AGE_DEMOGRAPHICS',
    kind: 'histogram of the current population',
    summary: 'Distribution of particle age — how long each living particle has existed.',
    sections: [
      ['Pile-up at zero', 'A spike at the youngest bucket means reproduction is outpacing survival.'],
      ['Empty right tail', 'No old particles means nothing is surviving long enough to age.'],
    ],
  },
  'velocity-distribution': {
    title: 'VELOCITY_DISTRIBUTION',
    kind: 'histogram of the current population',
    summary: 'Distribution of particle speed, bucketed.',
    sections: [
      ['Reading the tail', 'A long right tail is a few particles moving far faster than the bulk.'],
      ['Forces vs damping', 'A distribution that keeps narrowing usually means drag and friction are dominating the driving laws.'],
    ],
  },
  'diversity-trend-graph': {
    title: 'DIVERSITY_TREND',
    kind: 'single line over time',
    summary: 'Genetic diversity over time, normalised to 0–1.',
    sections: [
      ['How it is measured', 'The variance of five sampled DNA traits — FORCE, POLARITY, BIRTH_RATE, MUTATION and TIDAL — over up to 500 living particles, averaged and scaled into 0–1.'],
      ['What moves it', 'Mutation, crossover and gene flow raise it; selection pressure lowers it.'],
      ['Saturating scale', 'The scaling factor of 50 means real-world-scale trait variance saturates this chart well before 1.0. Read it as relative change, not an absolute score.'],
    ],
  },
  'nrg-trend-graph': {
    title: 'NRG_TREND',
    kind: 'single line over time',
    summary: 'Mean energy per living particle over time.',
    sections: [
      ['Definition', 'Total energy divided by total living particles each sample.'],
      ['Interpretation', 'A rising line is a population being fed faster than it spends; a falling line is approaching a collapse.'],
    ],
  },
  'mass-trend-graph': {
    title: 'MASS_TREND',
    kind: 'single line over time',
    summary: 'Mean mass per living particle over time.',
    sections: [
      ['Definition', 'Total mass divided by total living particles each sample.'],
      ['What moves it', 'FUSION and ALLOY raise mass per particle; BOND and BIRTH_RATE change how many particles share it.'],
    ],
  },
});

/**
 * Analytics cells, keyed by the cell's value element id.
 *
 * These are the label/value pairs in the intel grids. They are grouped under
 * the same help gesture as graphs because they answer the same question —
 * "what am I looking at?" — and a user reaching for one will reach for the
 * other.
 */
export const CELL_HELP = Object.freeze({
  // INTELLIGENCE
  'intel-clusters': { title: 'CLUSTERS', summary: 'Particle clusters detected this scan by the insight engine.', sections: [['Definition', 'A group of nearby particles that cluster detection considers cohesive. Rescanned on an interval, so the count lags the simulation slightly.']] },
  'intel-largest': { title: 'LARGEST CLUSTER', summary: 'Size of the biggest single detected cluster.', sections: [['Why it matters', 'A cluster holding most of the population means the world has organised into one body rather than many. Compare against CLUSTERS to see whether one dominates or many are similar.']] },
  'intel-cluster-energy': { title: 'CLUSTER ENERGY', summary: 'Total energy summed across every detected cluster.', sections: [['Same pass', 'Derived from the same detection scan as CLUSTERS, so the two cannot disagree.'], ['Interpretation', 'High total energy with few clusters means dense, energetic bodies; the same energy spread over many clusters means a diffuse world.']] },
  'intel-net': { title: 'NET GROWTH', summary: 'Births minus deaths, signed.', sections: [['Signed, not absolute', 'Shown signed so the direction is readable at a glance. BIRTHS and DEATHS sit beside it, so you would otherwise have to subtract them yourself.'], ['Caveat', 'These are cumulative lineage events since the last reset, not a per-second rate, and they lag the actual population.']] },
  'intel-births': { title: 'BIRTHS', summary: 'Cumulative reproduction events in this world.', sections: [['Cumulative, not per second', 'This only resets when the world is reset. Divide by elapsed ticks for a rate.']] },
  'intel-deaths': { title: 'DEATHS', summary: 'Cumulative death events in this world.', sections: [['Cumulative, not per second', 'Compare against BIRTHS on the same panel: births minus deaths is the net direction of the population.']] },
  'intel-lineage': { title: 'LINEAGE DEPTH', summary: 'Deepest generation of descent observed by the lineage tracker.', sections: [['Stalled', 'A depth that never grows while births continue means offspring are not surviving into the tracked lineage.']] },
  'intel-snapshots': { title: 'SNAPSHOTS', summary: 'History samples retained by the timeline engine.', sections: [['Bounded', 'The timeline engine keeps a capped ring. Raising the cap costs memory, since each sample holds a full world state.']] },
  'intel-rec': { title: 'RECORDING', summary: 'Whether the timeline engine is recording new history samples.', sections: [['Toggle', 'Turn recording off to stop accumulating snapshots; the simulation itself is unaffected.']] },

  // GROUPS
  'ga-groups': { title: 'GROUPS', summary: 'Number of social groups currently detected.', sections: [['Two origins', 'Declared groups come from the player or a preset; detected groups form organically and dissolve when their membership collapses.']] },
  'ga-members': { title: 'MEMBERS', summary: 'Total particles assigned to any group.', sections: [['Ungrouped particles', 'Particles not in a group are not counted here, so this can be lower than the total population.']] },
  'ga-treasury': { title: 'TREASURY', summary: 'Total currency held across all group treasuries.', sections: [['Income and sinks', 'Foragers earn income and the leader takes a tithe. Groups spend on artifacts, structure upkeep and trade.']] },
  'ga-volume': { title: 'TRADE VOLUME', summary: 'How much moved between groups in the last economy pass.', sections: [['Directional', 'Exchange is proportional to the difference between two groups\' treasuries, so value flows from rich to poor.']] },
  'ga-leaders': { title: 'LEADERS', summary: 'Total leader-role particles across all groups.', sections: [['Role, not species', 'Leadership is a role assigned on group membership, not a species trait. A leader earns a tithe of its group\'s income.'], ['Zero leaders', 'Groups with no leader collect no tithe, so their treasury grows more slowly.']] },
  'ga-artifacts': { title: 'ARTIFACTS', summary: 'Crafted TOOL / WEAPON / BARRIER items held across all groups.', sections: [['What they do', 'Tools pay an income dividend, weapons damp threat memory, barriers write impassable wall cells at the territory edge.'], ['Treasury-funded', 'Crafting spends the treasury, so a rich group out-produces a poor one.']] },
  'ga-alliances': { title: 'ALLIANCES', summary: 'Distinct allied group pairs.', sections: [['Halved on purpose', 'Each pair is recorded from both sides, so this is pairs, not stored edges. Allied groups pool treasuries.']] },
  'ga-conflicts': { title: 'CONFLICTS', summary: 'Distinct group pairs currently in conflict.', sections: [['Halved on purpose', 'As with alliances, each pair is stored from both sides. Conflicts raise threat memory at the border and can escalate into raids.']] },

  // ECOSYSTEM
  'eco-species': { title: 'SPECIES', summary: 'Species currently present in the world.', sections: [['Slots', 'The world carries a bounded number of species slots. Once all are filled, new ones must split from existing ones.']] },
  'eco-bio': { title: 'BIODIVERSITY', summary: 'How evenly the living population is spread across species, 0–1.', sections: [['Reading it', 'Near 0 means one species dominates; higher is a more even spread. It responds slowly to extinction events.']] },
  'eco-osc': { title: 'OSCILLATION', summary: 'Degree to which the population is cycling rather than settling.', sections: [['Meaning', 'High values indicate boom-and-bust dynamics; a value that decays to zero means the world has found a steady state.']] },
  'eco-pop': { title: 'POPULATION', summary: 'Total living particles across all species.', sections: [['Compared to EPOCH', 'The extinction window opens when this falls below a configured fraction of its baseline.']] },
  'eco-peak': { title: 'PEAK POP', summary: 'Highest population seen within the retained ring window.', sections: [['Window, not lifetime', 'The eco ring is a bounded buffer, so this is the peak over recent history only. A world that just booted will show a low peak that says nothing about its eventual size.'], ['Use it against POPULATION', 'POPULATION near PEAK means the world is near its recent high; a large gap means it has declined.']] },
  'eco-extinct': { title: 'EXTINCTIONS', summary: 'Species extinctions recorded in this world.', sections: [['Bounded feed', 'The engine keeps a capped list of recent extinctions with the tick they happened on.'], ['Permanent', 'An extinct species slot does not refill. Sustained loss here is what eventually opens an extinction window.']] },
  'eco-predators': { title: 'PREDATOR EDGES', summary: 'Predation relationships detected in the food web.', sections: [['How edges form', 'Species A is recorded as preying on B when A is larger and overlaps B\'s niche. Structural, not behavioural — it reflects size and spatial overlap.']] },
  'eco-splits': { title: 'SPLITS', summary: 'Speciation events, where one species became two.', sections: [['Driven by GENOTYPE', 'A split happens when a species\' trait distribution separates enough for the speciation engine to declare a new one.'], ['See the feed below', 'The species panel lists each split with its parent, isolation and tick.']] },

  // CIVILIZATION
  'civ-cultures': { title: 'CULTURES', summary: 'Number of cultures founded, one per detected group.', sections: [['What a culture holds', 'A pool of symbols and norms, plus a ledger recording what was inherited, mutated, reinvented or lost in transfer.']] },
  'civ-federations': { title: 'TRIBES', summary: 'Federations — multi-group identities that can fission and fuse.', sections: [['Viability', 'A federation that drops below its viability threshold fissions back into its constituent groups.']] },
  'civ-polities': { title: 'POLITIES', summary: 'Polities holding territory, citizenship, provinces and institutions.', sections: [['Succession', 'Polities nominate and install successors on a term, so a polity can outlive the group that founded it.']] },
  'civ-kin': { title: 'KIN EDGES', summary: 'Recorded kinship relationships between particles.', sections: [['Source', 'Derived from lineage data — this module stores and weights edges without changing lineage semantics.']] },
  'civ-structures': { title: 'STRUCTURES', summary: 'Standing structures over total built.', sections: [['Dormant vs collapsed', 'A structure whose dependency collapsed still counts as standing but is reported dormant. Falling below the integrity threshold closes it.']] },
  'civ-regime': { title: 'REGIME', summary: 'Name of the civilizational regime observed at the last era boundary.', sections: [['Derived, not declared', 'Chosen by comparing the social world against the previous era: thriving, settled, strained, fragmenting, collapsing, empty or emergent.']] },
  'civ-confidence': { title: 'CONFIDENCE', summary: 'How much evidence supports the current regime name, 0–1.', sections: [['Read it with the name', 'Low confidence means the observer has too little to say. Below the evidence threshold the codex states its uncertainty instead of a conclusion.']] },
  'civ-codex-block': { title: 'CODEX', summary: 'The observer’s own statement about the world, with the tick it was last written at.', sections: [['Never law-derived', 'Statements are built from measured social evidence only. If the evidence is insufficient, the codex declines rather than inventing a reason.'], ['The stamp', 'A codex with no visible age reads as current no matter how long ago it was written, so the block carries the tick it was last changed at.']] },
  'civ-households': { title: 'HOUSEHOLDS', summary: 'Households formed from kin edges.', sections: [['What a household is', 'A caregiving unit built from recorded kinship. Households are what kin resource flow operates through.'], ['Forms over time', 'A household exists only once kin edges have been recorded, so this stays at zero early in a world.']] },
  'civ-citizens': { title: 'CITIZENS', summary: 'Particles holding citizenship in a polity.', sections: [['Distinct from members', 'Citizenship is membership of a polity, not of a group. A group member is not automatically a citizen.'], ['Revocable', 'Citizenship can be granted and revoked, so this can fall as well as rise.']] },
  'civ-generations': { title: 'FED GEN', summary: 'Deepest generation number reached by any federation.', sections: [['What it counts', 'Increments each time a federation splits and re-fuses. A high number means the social structure has repeatedly reorganised itself rather than settling.']] },
});

/** Kind of help surface a target gets. Drives modal vs tooltip in the overlay. */
export const HELP_KIND = Object.freeze({
  TAB: 'tab',
  GRAPH: 'graph',
});

/**
 * Which sub-tabs belong to which tab, in display order.
 *
 * The modal needs this to offer a route out of a summary and into the detail,
 * so reading a tab's help does not end in a dead end. Display order matches
 * index.html exactly; the coverage test enforces both directions.
 */
export const TAB_SUBTABS = Object.freeze({
  'tab-setup': ['setup-laws', 'setup-world', 'setup-species', 'setup-settings'],
  'tab-data': ['data-intel', 'data-dna', 'data-logs', 'data-groups', 'data-eco', 'data-civilization'],
  'tab-saves': ['saves-states', 'saves-undo', 'saves-io'],
});

/** The sub-tab ids under a tab, or an empty list for a tab without any. */
export function subtabsForTab(tabId) {
  return TAB_SUBTABS[tabId] ? [...TAB_SUBTABS[tabId]] : [];
}

/**
 * The top-level tabs in drawer order, which is the order the switcher cycles.
 *
 * Declared rather than inferred from `Object.keys(TAB_HELP)`: key order is an
 * implementation detail of how the object literal was written, and a stray
 * reordering during an edit would silently reverse the arrows in the help
 * modal. The coverage test pins it against index.html.
 */
export const TAB_ORDER = Object.freeze(['tab-setup', 'tab-saves', 'tab-data']);

/** The id of the tab `step` places away from `currentId`, wrapping at both ends. */
export function cycleTabId(currentId, step) {
  const at = TAB_ORDER.indexOf(currentId);
  const from = at === -1 ? 0 : at;
  const next = (from + step + TAB_ORDER.length) % TAB_ORDER.length;
  return TAB_ORDER[next];
}

/**
 * The top-level tab that owns `id`, whether `id` is a tab or a sub-tab.
 * The help switcher needs this: drilling into DATA > CIVILIZATION and then
 * hitting the arrows should move to SETUP, not to "no tab".
 */
export function owningTabId(id) {
  if (Object.prototype.hasOwnProperty.call(TAB_HELP, id || '')) return id;
  for (const tab of TAB_ORDER) {
    if ((TAB_SUBTABS[tab] || []).includes(id)) return tab;
  }
  return TAB_ORDER[0];
}

/**
 * The switcher model for the help modal: the owning tab of `id` (expanded, with
 * its title) plus every other top-level tab (collapsed, icon only), in drawer
 * order. An entry carries only what the strip renders, so the overlay has no
 * content decisions of its own.
 *
 * @param {string} id the tab or sub-tab currently being explained
 * @returns {Array<{id:string,title:string,icon:string,current:boolean,own:boolean}>}
 */
export function tabSwitcher(id) {
  const owner = owningTabId(id);
  return TAB_ORDER.map((tabId) => {
    const entry = TAB_HELP[tabId];
    return {
      id: tabId,
      title: entry ? entry.title : tabId,
      icon: entry ? entry.icon || '' : '',
      current: tabId === owner,
      // True when a sub-tab of this tab is what is actually on screen, which is
      // what tells the reader the arrows moved them away from where they were.
      own: tabId === owner && tabId !== id,
    };
  });
}

/**
 * Look up help for a tab or sub-tab button.
 * @param {string} id the `data-tab` / `data-sub` value
 * @returns {{title:string, kind:string, summary:string, sections:Array}|null}
 */
export function helpForTab(id) {
  if (!id) return null;
  const entry = TAB_HELP[id] || SUBTAB_HELP[id];
  if (!entry) return null;
  return { ...entry, icon: entry.icon || '', kind: HELP_KIND.TAB };
}

/**
 * Look up help for a graph or an analytics cell.
 *
 * Resolution is nearest-first so an element id wins over an ancestor canvas
 * id: a value cell inside a chart section should describe the cell.
 *
 * @param {HTMLElement|null} el
 * @returns {{title:string, kind:string, summary:string, sections:Array}|null}
 */
export function helpForGraph(el) {
  if (!el) return null;
  const cell = el.closest && el.closest('.intel-cell');
  if (cell) {
    const valueEl = cell.querySelector('.intel-value');
    const entry = valueEl && CELL_HELP[valueEl.id];
    if (entry) return { ...entry, kind: HELP_KIND.GRAPH, scope: 'cell' };
  }
  const canvas = el.closest && el.closest('canvas');
  const graph = canvas && GRAPH_HELP[canvas.id];
  if (graph) return { ...graph, kind: HELP_KIND.GRAPH, scope: 'graph' };
  // A .chart-section with no canvas still deserves its title's explanation.
  const section = el.closest && el.closest('.chart-section');
  if (section) {
    const titleEl = section.querySelector('.chart-title');
    const title = titleEl ? titleEl.textContent.trim() : '';
    if (title) {
      return {
        title,
        kind: HELP_KIND.GRAPH,
        scope: 'section',
        summary: 'Chart area. Long-press the graph itself for what it measures.',
        sections: [],
      };
    }
  }
  return null;
}

/** Every documented id, for coverage tests. */
export function allHelpIds() {
  return {
    tabs: Object.keys(TAB_HELP),
    subtabs: Object.keys(SUBTAB_HELP),
    graphs: Object.keys(GRAPH_HELP),
    cells: Object.keys(CELL_HELP),
  };
}