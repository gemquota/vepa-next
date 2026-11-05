# Systems analysis and theorycrafting framework

Use this worksheet for every proposed system, from mating to civilization. It is deliberately more precise than a feature checklist.

## 1. Semantic decomposition

1. **Referent:** What is the system naming—body, relation, population, institution, pattern, or observer category?
2. **Participants:** Which entities can enter it? Are roles symmetric, asymmetric, or many-body?
3. **Identity:** What makes the same entity persist across ticks, death, reproduction, snapshot restore, and species split?
4. **Formation:** Which triggers are allowed—proximity, collision, contact duration, field, state compatibility, internal threshold, external event, probability, history, or network topology?
5. **State:** Which values belong to the entity, which belong to an edge, and which are aggregate observations?
6. **Flows:** Does it move mass, energy, health, information, DNA, memory, territory, or authority?
7. **Geometry:** Is it coincident, edge-to-edge, elastic, lattice-like, territorial, route-based, or independent of space?
8. **Topology:** What degree, role, chain, ring, tree, mesh, federation, or hierarchy is possible?
9. **Time:** Is it instantaneous, dwell-gated, hysteretic, decaying, episodic, generational, or epoch-scale?
10. **Failure:** What breaks it—force, distance, health, scarcity, incompatibility, loss of members, decay, or institutional collapse?
11. **Consequence:** Does it alter motion, identity, material, population, memory, topology, or future eligibility?
12. **Observer interpretation:** Which labels are causal and which are assigned after measurement?

## 2. Ontology mapping

Create a record with these fields:

```text
system_id
scale
entity_type
participants
roles
formation_triggers
state_owner
edge_state
flows
geometry
topology
persistence
hysteresis
failure_conditions
lifecycle_events
inheritance_channel
recognition_channel
measurement_features
runtime_sources
status
known_gaps
```

Use `src/physics/relationshipState.js` for edge-state vocabulary and `src/physics/relationshipExplorer.js` for experiment dimensions. Do not add a new stride field until the state cannot be represented safely in an existing registry or bounded side buffer.

## 3. Measurement protocol

For each candidate system, log:

- formation count and rate;
- attachment duration and dwell distribution;
- mean/max force and preferred distance/angle;
- mass, energy, health, and DNA flow in both directions;
- reciprocity and asymmetry;
- partner count and graph degree;
- memory reinforcement and recognition accuracy;
- role differentiation and specialization;
- territory overlap and migration;
- construction, artifact, treasury, trade, and policy changes;
- birth, death, split, merge, and dissolution events;
- persistence across epochs and snapshot restore;
- independent reappearance across lineages.

Normalize features, retain the raw event trace, and cluster trajectories before naming them. This is the intended use of `relationshipExplorer` rather than adding hard-coded predator/parasite/civilization classifiers.

## 4. Enabling a system from primitives

Prefer this sequence:

1. **Substrate:** verify position, momentum, contact, energy, mass, DNA, information, memory, topology, creation, destruction, and mutation primitives.
2. **Relationship:** add only the minimal attach/detach/transfer/constrain/signal/capture/release operation.
3. **Parameters:** expose range, strength, threshold, rate, duration, bias, and break/recovery behavior.
4. **Genomic modulation:** map existing DNA loci before adding new ones; preserve the 42-value cache boundary.
5. **Developmental adaptation:** use species/group memory and feedback before creating individual learning state.
6. **Observation:** add metrics, event logs, trajectories, and regime clustering.
7. **Interpretation:** assign family, tribe, nation, or civilization labels only after evidence exists.
8. **Promotion:** make a discovered regime first-class only when it has stable causal state, tests, save/load behavior, and bounded performance.

## 5. Theorycrafting scenarios

| Scenario | Required primitives | Expected measurable signature |
|---|---|---|
| Binary mating | compatibility, recognition, contact, temporary attachment, DNA exchange | repeated pair formation before offspring; asymmetric investment possible |
| Family care | lineage, recognition, resource transfer, memory, group membership | offspring survival improves with kin proximity/resource flow |
| Tribe | groups, shared memory, alliance, territory, culture transmission | multiple groups share identity and exchange while retaining local units |
| Clan | lineage graph, affinity, recognition, fission/fusion | kin-correlated membership persists across group changes |
| Nation | polity registry, territory, governance, economy, conflict/alliance | durable multi-group jurisdiction with policy and resource feedback |
| Civilization | cumulative culture, specialization, infrastructure, economy, governance, epochs | complexity survives member turnover and persists across epoch boundaries |
| Superorganism | dense internal graph, differentiated roles, low external coupling | collective survival/energy function exceeds isolated members |
| Cultural evolution | signal, memory, learning, symbols, imitation, lineage | strategies spread horizontally and vertically independent of DNA |

## 6. Acceptance criteria for a new runtime system

- deterministic under a fixed seed;
- explicit state owner and lifecycle transitions;
- no magic stride offsets or law numbers;
- bounded memory and work per tick;
- save/restore semantics defined;
- tests for formation, maintenance, failure, and no-op gates;
- metrics distinguish causal state from inferred label;
- docs matrix and role file updated;
- existing interaction semantics remain unchanged unless intentionally versioned.
