# PR #18 — Unified energy ledger and conservation contracts

## Scope

This change introduces a versioned, deterministic energy-accounting foundation and exposes it through the authoritative in-process execution adapter. It provides typed accounts, atomic transactions, a provenance event journal, replayable snapshots, compensated aggregate summaries and account-level reconciliation.

## Delivered contracts

1. **Versioned schema** — snapshots identify `vepa.energy-ledger` version 1.
2. **Typed accounts** — kinetic, thermal, chemical-potential, gravitational-potential, electric-potential, magnetic-field, radiation, dissipation, deformation, rest-mass and external-source accounts are initialized by the execution adapter.
3. **Custom accounts** — subsystems may create additional named accounts with an explicit type.
4. **Explicit transfers** — each event stores source, destination, positive amount, cause, tick and optional structured metadata.
5. **Atomic batch transactions** — all entries validate and project before any account or event is committed.
6. **Overdraw protection** — ordinary accounts cannot become negative; signed potential accounts explicitly opt in.
7. **Finite-value validation** — invalid amounts and non-finite projected balances are rejected.
8. **Tick ordering** — ledger ticks are monotonic; stale transfer timestamps are rejected.
9. **Deterministic event sequence** — accepted events receive monotonically increasing sequence numbers.
10. **Bounded event history** — configurable event capacity fails closed rather than silently dropping provenance.
11. **Compensated totals** — total and per-account-type summaries use compensated summation.
12. **Account reconciliation** — audit output reports opening, incoming, outgoing and closing balances per account, plus the net transfer residual.
13. **Filtered journal reads** — callers can resume event reads after a sequence cursor.
14. **Snapshot persistence** — complete accounts, event history, schema version, sequence and tick are checkpointed.
15. **Strict restore validation** — duplicate accounts, invalid events, unsupported schema versions, inconsistent sequence numbers and future-dated events are rejected.
16. **Adapter integration** — energy account creation, transfer, batch transaction, summary, audit and event-read methods are exposed by the execution adapter.
17. **Simulation tick integration** — the ledger tick advances only after a successful simulation step.
18. **Replay coverage** — tests verify snapshot continuation produces identical subsequent transfer events.
19. **Failure atomicity tests** — invalid later entries leave earlier projected transfers unapplied.
20. **Compatibility path** — restoring an older adapter snapshot without a ledger creates an empty ledger at that snapshot's tick.

## Example

```js
runtime.transferEnergy({
  source: 'external',
  destination: 'thermal',
  amount: 4,
  cause: 'external-heating',
  metadata: { sourceId: 'heater-1' },
});

runtime.transactEnergy([
  { source: 'thermal', destination: 'kinetic', amount: 1, cause: 'thermal-work' },
  { source: 'thermal', destination: 'deformation', amount: 0.5, cause: 'plastic-work' },
]);

const summary = runtime.getEnergySummary();
const audit = runtime.auditEnergy();
const events = runtime.readEnergyEvents({ afterSequence: 10 });
```

## Physical-model boundaries and outstanding integration

This PR deliberately distinguishes an auditable accounting mechanism from a claim that the current simulator conserves physical energy.

- The current particle layout stores several energy-like quantities (`ENERGY`, `STORED_ENERGY`, `ELECTRIC_ENERGY`, mass and velocity), but their units and ownership are not yet governed by one dimensional/physical contract. They are not silently summed into the ledger.
- The adapter currently initializes typed accounts and exposes validated transfer APIs. Existing solver stages are **not yet comprehensively instrumented** to emit ledger transfers for drag, contact restitution/friction, SPH viscosity, thermal conduction, latent heat, chemistry, radioactive decay, radiation work or particle retirement.
- Kinetic-energy diagnostics from the numerical layer remain measurements. They are not automatically booked as a source or sink, because a delta alone cannot reliably distinguish internal exchange, external work, numerical integration error, boundary work or modelled dissipation.
- Gravitational and electric pair potentials require an explicit agreement on cutoff, softening, periodic-image convention and the exact force law. The current solver uses finite interaction radii and softened forces; a naive all-pairs potential formula would not exactly match that force model.
- The magnetic implementation is a prescribed external field Lorentz-force stage, not an evolving Maxwell field. No magnetic field-energy conservation claim is made.
- Rest-mass and nuclear reaction energy require a unit convention for (c^2), product/radiation bookkeeping and a consistent mass-energy policy. Existing configurable decay rules are not silently reinterpreted.
- The audit residual currently checks the event journal's internal transfer balance. It does not compare the ledger against all live particle and field energy.

The next integration step is to make each solver subsystem produce typed transfer intents and commit them atomically with its state mutation. A full conservation residual can only be enabled for a declared physical profile after its boundary conditions, external work and account ownership are specified.

## Verification

The contract suite covers account validation, transfer provenance, batch atomicity, signed accounts, tick ordering, event sequencing, snapshot validation, replay continuation, adapter integration and account reconciliation. The repository CI run is the authoritative test result; this document does not claim local execution.
