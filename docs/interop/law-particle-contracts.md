# Product ↔ SIM law and particle contracts

**Baseline:** VEPA product 9.3.5 on `main`; SIM foundation remains a separately tested subsystem.  
**Purpose:** detect identity/layout drift before any runtime adapter or solver integration is attempted.

## Law identity

The product law registry is `src/constants/laws.js` (`LAW_INDEXES`, 136 entries). The SIM migration inventory is `sim-foundation/src/sim/stable-law-inventory.js`.

- 135 product law names retain the same stable name, numeric index, and canonical SIM identity.
- The single deliberate exception is product `WRAP` at index 130.
- The historical inventory has `INERTIA` / `law.inertia` at index 130. Product 9.3.5 does not expose an `INERTIA` law at that index; it exposes `WRAP`.
- `STABLE_LAW_COMPATIBILITY.WRAP` records the product behavior as a compatibility alias to `boundaryMode`. It is not an alias to `law.inertia`.
- `MASS_INERTIA` at index 86 is a separate product law and must not be conflated with the historical `INERTIA` entry.

Never translate law state by numeric index across these registries without consulting this identity contract. Equal array positions do not establish equal semantics.

## Particle layout

The product declaration is `src/constants/stride.js`; the SIM declaration is `sim-foundation/src/sim/particle-layout.js`.

- Both declare a 100-float particle stride.
- Every named slot and offset must match exactly.
- Slot offsets must be integral and remain inside the declared stride.
- The declarations are compatibility contracts, not proof that product runtime state has been migrated into SIM ownership.

## Validation

`tests/unit/productSimCompatibility.test.js` checks:

1. Product law indices are unique, dense, and cover 0–135.
2. All 135 unchanged law identities retain their index.
3. The WRAP/INERTIA conflict remains explicit and cannot silently alias.
4. Product and SIM particle slot maps and strides remain identical.

These tests intentionally do not add runtime conversion, alter the solver, change persistence, or enable SIM as a product backend. Those require separate round-trip fixtures and behavioral parity evidence.
