# PR 40 — law-porting parity attempt

## Scope

This increment expands the explicit product-to-SIM shadow map from 7 to 12 laws.
It ports five product physics laws into the deterministic SIM extended-law
kernel and records them as executable in the 136-law migration manifest:

| Product law | SIM ID | Ported primitive |
|---|---|---|
| TIDE | `law.tide` | Directed neighbor attraction proportional to neighbor mass / distance |
| FRICTION | `law.friction` | Velocity drag using DNA viscosity, with removed motion deposited as temperature |
| HORIZON | `law.horizon` | Bounded mass/radius capture acceleration with quadratic falloff |
| RADIATION_PRESSURE | `law.radiation-pressure` | Outward force from the neighbor's energy inventory |
| FIELD | `law.field` | Central force toward the world centre, dispatched once for each eligible neighbor pair |

## Coefficient and semantic contract

The defaults match the isolated product-law constants:
- TIDE: 0.3
- FRICTION: 0.05
- HORIZON: 0.08
- RADIATION_PRESSURE: 0.12
- FIELD: 0.02

The shadow adapter accepts explicit effective coefficients in its config payload.
This matters because HORIZON, RADIATION_PRESSURE and FIELD are multiplied by
product law-synergy values in combined product configurations. The SIM shadow
does not independently reproduce the product synergy graph. A combined-law
comparison must therefore supply the same effective coefficient or be marked
as a coefficient-mismatch diagnostic, not a parity pass.

FRICTION reads VISCOSITY from DNA cache locus 1 and converts its modeled
velocity-dependent loss into the particle temperature slot, matching the
product helper's state mutation. The SIM implementation applies the force as
acceleration using particle mass; callers comparing full product trajectories
must also match the product integrator's DNA inertia scaling.

## What this proves

- The five new laws have explicit, isolated SIM implementations.
- The product shadow mapper recognizes their canonical IDs.
- The 136-law migration manifest reports them as executable rather than
  catalog-only.
- Contract fixtures exercise each law's direction/sign and its distinctive
  state effect.
- Product law identity is kept separate from similarly named concepts:
  FIELD is not ELECTRIC_FIELD.

## What this does not prove

- Full product/SIM trajectory equivalence across arbitrary mixed-law sets.
- Automatic reproduction of product synergy multipliers or all DNA/world
  parameter derivations.
- Equivalence of the complete product and SIM integrators, workers, UI or saves.
- That every law in the 136-entry catalogue is implemented.
- That ACCR is compatible with SIM's fusion/merge primitive. Product ACCR
  remains unsupported in the shadow because it represents structural
  adjacency rather than particle fusion.
- That ELECTRIC_FIELD is executable. It remains metadata-only and is not
  aliased to FIELD, CHARGE_LAW or MAGNETISM.

## Next parity work

1. Build an automated product-reference fixture runner that captures
   pre/post state for each law under controlled DNA/world parameters.
2. Match product synergy and inertia derivation at the law boundary.
3. Port additional law families only after the product helper, dispatch gate,
   parameter sources, state writes and lifecycle/energy effects are audited.
4. Add pairwise and multi-tick differential tests, with explicit tolerances and
   deterministic seeds, before promoting any law from isolated-kernel parity
   to trajectory parity.
