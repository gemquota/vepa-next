# Organization ontology

## 1. Entity strata

| Stratum | Entity | Identity key | Current state owner | Ontological question |
|---|---|---|---|---|
| Physical | Particle | buffer index during a run | particle stride | What persists when a particle is recycled? |
| Genetic | Species | species slot + genome | DNA buffer | Is a species a genome, population, lineage, or all three? |
| Historical | Lineage | parent/child event chain | lineage tracker | Which ancestry relation is causal versus merely temporal? |
| Relational | Relationship | ordered/unordered particle pair | relationship state utilities; bond slots for some links | What does the edge remember? |
| Collective | Group | registry group ID | group registry | Is membership voluntary, spatial, kin, or inferred? |
| Cultural | Memory/culture pattern | species/group memory channel | memory buffers + information laws | How is a learned pattern copied and recognized? |
| Political | Polity | proposed federation ID | governance currently group-local | What makes a group sovereign or institution-bearing? |
| Material | Structure/artifact | proposed structure ID | fields, artifacts, infrastructure | Is a field mark an object, a resource, or an observation? |
| Digital | Synthetic/upload | organism/upload ID | synthetic state | Does a copied program share identity with its source? |
| Ecological | Niche/regime | analytics key or cluster ID | eco/explorer engines | Is a category discovered, assigned, or both? |

## 2. Relation vocabulary

Every relation should be described by **participants, direction, trigger, geometry, flow, persistence, history, and termination**.

| Relation | Direction | Persistence | Typical flow | Runtime analogue |
|---|---|---|---|---|
| CONTACT | none | instantaneous | impulse/position | CONTACT/COLL |
| ATTACHMENT | bilateral or directed | persistent | force/constraint | BOND, ACCR, POLYMER, ADHESION |
| KINSHIP | directed ancestry | durable | DNA/information/care | lineage events only |
| AFFINITY | bilateral tendency | decaying | attraction/recognition | compatibility + memory |
| EXCHANGE | bilateral/asymmetric | episodic or persistent | energy/resource | economy, symbiosis |
| CAPTURE | directed | until release/death | mass/energy/position | predation/singularity |
| MEMBERSHIP | particle → group | persistent | identity/role/resources | group stride fields |
| ALLIANCE | group ↔ group | cooldown/persistent | treasury/threat/info | governance |
| CONFLICT | group ↔ group | event/cooldown | damage/threat/territory | governance |
| CULTURAL TRANSMISSION | source → receiver | repeated/decaying | signal/memory/symbol | information laws + memory |
| OWNERSHIP | group → structure/resource | proposed | maintenance/control | not first-class; treasury/field proxy |
| INSTITUTION | collective → policy/role | durable | decision/enforcement | not first-class |
| TAXONOMY | observer → pattern | revisable | interpretation | eco/explorer analytics |

## 3. Scale ladder

`particle → pair → kin network → local group → federation/polity → civilization → ecology → epoch`.

A higher-scale object must not be inferred from a single name. Require measurable evidence:

- **Kin network:** connected parent/child graph with persistence and repeated co-location or transfer.
- **Group:** membership persistence, spatial cohesion, role differentiation, and dissolution rules.
- **Tribe/clan:** multiple groups or kin clusters with shared identity, memory, and exchange.
- **Polity/nation:** bounded territory, governance, inter-group relations, resource accounting, and durable membership.
- **Civilization:** polity or network with durable infrastructure, cumulative cultural memory, specialization, economy, governance, and cross-epoch persistence.

## 4. Lifecycle algebra

All systems can be decomposed into:

`formation → recognition → maintenance → adaptation → reproduction/replication → differentiation → fusion/fission → decline → dissolution → historical trace`.

For a family, formation may be birth plus care; for a tribe, alliance plus shared memory; for a civilization, group federation plus infrastructure and epoch persistence. The same lifecycle vocabulary supports comparison without collapsing distinct entities.

## 5. Ontological safety rules

1. A **species** is not automatically a family, culture, or nation.
2. A **group** is not automatically an organism or civilization.
3. A **lineage** is not automatically a family: it records descent, not caregiving or social recognition.
4. A **treasury** is not automatically an economy: production, exchange, scarcity, and decision rules must be observable.
5. A **field write** is not automatically infrastructure: persistence, ownership, function, and maintenance are required.
6. A **cluster** is not automatically a society: repeated relations and differentiated roles are required.
7. An **analytics label** must remain distinct from a runtime causal mechanism.
