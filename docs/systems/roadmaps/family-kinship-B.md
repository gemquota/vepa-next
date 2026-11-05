# Family / kinship — Variant B: kinship graph

> **Finalization report — complete:** Graph-first variant finalized with bounded typed edges and lineage compatibility gates.

**Summary:** Represent kin, care, recognition, and household ties as sparse relationships.

## Shared phases
1. Stable pair/kin keys.
2. Edge lifecycle and serialization.
3. Care/resource flow events.
4. Graph persistence validation.
5. Kin graph analysis/UI.
6. Large-family replay and stress.

## System emphasis
Parent, sibling, descendant, caregiver, and recognition edges; lineage remains authoritative.

## Expected outcome
A bounded kinship graph without changing particle stride semantics.