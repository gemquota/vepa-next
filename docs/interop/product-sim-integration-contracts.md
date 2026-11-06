# Product/SIM boundary integration contracts

Scope: G1.3 worker boundary, G1.4 random-stream ownership, G1.5 persistence conversion, and G2.1 solver phase contract.
Baseline: VEPA 9.3.5 remains the production runtime; SIM remains isolated.

## Worker protocol (G1.3)

The product worker is an unversioned protocol. The SIM worker uses its own request/response protocol. The new adapter emits the exact SIM worker envelope shape (protocolVersion, id, type, payload), maps command names with established counterparts, and tracks response IDs to reject duplicates and stale replies while allowing out-of-order completions. Supported mappings are INIT→INIT, CONFIG→CONFIGURE, TICK→STEP, GET_STATE→READ_STATE, RESTORE→RESTORE, PING→STATUS. TOGGLE_LAW fails closed because product law indices are not SIM law IDs. The G4 shadow adapter now performs the typed-state/config translation and is connected to the actual product worker behind a disabled-by-default runtime flag. It remains diagnostic-only and fails closed when active product laws are not mapped; it does not replace the product worker solver.

## Random ownership (G1.4)

The product worker now uses a checkpointable SplitMix32 compatibility adapter with the exact legacy sequence. Main-thread and worker PRNG states are captured separately in an additive optional v1 save field. SIM named streams are independently keyed by domain/entity and serialized in SIM snapshots; product consumers are not yet redistributed across those named streams.

## Persistence conversion (G1.5)

Product in-memory save v1 converts to a checksummed SIM snapshot v2 and back. Particle and DNA buffers are copied and validated; law masks remain opaque product-indexed words. WRAP at product index 130 is never reinterpreted as historical INERTIA. New product v1 saves may include an additive main/worker SplitMix32 checkpoint. Legacy v1 saves without the field remain valid and convert with prngState=null, explicitly marking deterministic continuation unavailable. Exported JSON/base64 saves must first pass through the product parser/decoder.

## Solver phase ownership (G2.1)

The phase contract names preparation, field cadence, backend selection, neighbor construction, force evaluation, mechanics/boundaries, integration, lifecycle, main-thread post-tick work and render projection. It records ownership and write domains. It is descriptive and tested for ordering/ownership drift; it does not instrument or reorder the production solver.

## Safety

- No production worker is replaced or redirected.
- No solver phase is moved or reordered.
- No save writer/version is changed.
- No existing world is rewritten.
- No stochastic consumer changes its draw order or domain allocation; the compatibility wrapper preserves the legacy sequence.
- Adapters are explicit, copy-based and opt-in. The opt-in shadow now supplies an initial browser-worker integration and checkpoint path; production solver promotion still requires full law parity, worker failure/fallback coverage and numeric acceptance evidence.