# Gate 3 — law and backend evidence

## G3.1 explicit law gates

BUOYANCY now has an explicit solver-level law gate and finite-input checks. SENESCENCE is split from the baseline LIFE lifecycle path, is dispatched only when both LIFE and SENESCENCE are enabled, and applies a bounded age/telomere mortality probability. The helper also checks the gates itself so direct callers cannot bypass the dependency.

## G3.2 ELECTRIC_FIELD disposition

ELECTRIC_FIELD remains metadata-only. It is not an alias for FIELD or CHARGE_LAW, has no declared runtime consumer or relationship edges, is excluded from presets and bulk toggles, and is disabled in both law panels. Its help text explicitly says that toggling it has no physical effect. This is the conservative disposition until a separate field model, units, storage, boundary conditions and consumer are approved.

## G3.3 relationship ontology

The ontology now has a directional evidence record for every declared dependency, synergy and antagonism edge. Each edge carries a rationale and a runtime-consumer reference; validation rejects missing, duplicate, unknown or mismatched evidence. The expanded high-priority graph covers energy, mechanics, fields/electromagnetism, chemistry, reproduction and lifecycle. Metadata-only ELECTRIC_FIELD is prohibited from receiving executable relationship edges.

## G3.4 semantic law contracts

High-risk law parameter contracts are tied directly to canonical DNA indices and DNA_RANGES. They state units/scale, meaning and behavioral invariants for GRAV, DRAG, COLL, BUOYANCY, LIFE, REPRO, SENESCENCE, ENERGY, ALLOY, BOND, CHARGE_LAW, CURRENT, RESISTANCE and MAGNETISM. The contract deliberately distinguishes dimensionless modifiers from simulation-time and degree-valued parameters; no SI units are invented where the engine uses arbitrary world units.

Semantic fixtures exercise enabled/disabled behavior, force antisymmetry, charge conservation, resistive heating, bounded transfer, lifecycle gating, finite guards, ontology edge direction and parameter-range drift. The existing 136-law audit/dispatch suites remain the broader inventory check; a textual traceability hit alone is not treated as proof of behavior.

## G3.5 backend envelopes

- Exact direct CPU gravity remains the numerical reference and exact gravity remains the gravity-engine default.
- Barnes–Hut is accepted only for the tested population/fixture bands whose measured error fits the published envelope.
- FMM remains experimental while any measured fixture exceeds the envelope.
- WebGPU is a gravity-only pre-pass, not a replacement solver. Browser tests compare GPU output against CPU on actual hardware when available; the shared device-loss monitor is tested both with a deterministic rejected/lost promise and with a hardware-backed device destroy. Missing WebGPU hardware is reported as an environment skip, never as parity evidence.

`npm run bench:acceptance` records a fixed-seed benchmark matrix at 32, 128, 512, 1024 and 2048 particles. It reports timing and error metrics and does not change any backend selection.


## Canonical ontology vocabulary

Resource references use the product's actual stride, DNA and world-parameter names wherever a stored value exists. Derived accounting resources are explicitly distinguished from particle-buffer slots: `KINETIC_ENERGY` is derived from mass and velocity, while `DISSIPATION` names the energy sink. The ontology does not invent aliases such as a separate particle-mass field, a magnetic-field slot or a current slot when the corresponding runtime path consumes existing canonical state instead.
