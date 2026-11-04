# I-vepa-next-935-super-parity: Rebuild vepa-next on vepa 9.3.5 for super parity

## Goal
Rebuild public repo `gemquota/vepa-next` so its product runtime is **DayneK/vepa v9.3.5** (consolidation tag `dayneK/v9.3.5`, SHA `d24301cdcf95a6142ffa98d9808dffaacb1d8523`) as the base, closing the critical gap where Next lagged 9.3.5 / still shipped a failing 9.1.2 rebuild. Preserve the SIM-contract foundation from `vepa-next` `main` as a plus-more layer. Aim toward **super parity**: every feature of the union of vepa versions (via the 9.3.5 line as base) plus SIM contracts Next already owns.

Gem approved in direct words (t138u, "Ye") on 5 Nov 2026 (Australia/Brisbane).

## Acceptance Criteria
- AC-1: Product root `package.json` version is **9.3.5** and `SOURCE_PIN.md` records consolidation ref `dayneK/v9.3.5` at commit `d24301cdcf95a6142ffa98d9808dffaacb1d8523`.
- AC-2: Root product tree matches the pinned 9.3.5 export for `src/` (no silent drift from the pin on core runtime paths).
- AC-3: `sim-foundation/` preserves the prior `vepa-next` SIM contracts (world-session, PRNG, energy ledger, law manifest/registry, replay/snapshot) from `main` @ `6122eb7`.
- AC-4: Root unit test suite (`npm test`) passes on the 9.3.5 product tree.
- AC-5: `sim-foundation` contract tests (`npm test` in `sim-foundation/`) pass.
- AC-6: Codey control plane present: `.codey/intent.md`, `.codey/decisions.jsonl` citing Gem's Ye of 5 Nov 2026, `.codey/lock` held during the run.
- AC-7: Fresh-context hermetic verifier marks each AC PASS/FAIL/UNVERIFIED with evidence; repair loop ≤ 3.
- AC-8: Pre-push `/usr/local/bin/gitleaks` reports 0 secrets on content being pushed; no personal/BIE/gambling *data* in the diff (keyword prose in product UI copy is noted, not blocked for this public product port).
- AC-9: Branch pushed as gemquota (no force-push); PR opened against `main`; not merged; visibility read-back remains PUBLIC; every GitHub write logged in `/workspace/governance/github-log.md` (bot=Engineer, account=gemquota).

## Scope
- `gemquota/vepa-next` working copy `/workspace/_repo-staging/vepa-next`
- Branch `rebuild/v9.3.5-super-parity`
- Donor: consolidation `dayneK/v9.3.5` (+ SIM from prior main)

## Out of Scope
- Merging the PR into `main`
- Force-push, history rewrite, visibility/settings changes, deploy, deletes outside the diff
- Fully absorbing SIM contracts into the product worker/UI in this intent (tracked as remaining open gap)
- Implementing docs roadmap phases P5–P8 product families that are not already in 9.3.5
- Importing every historical 4.x–8.x tree into Next (those live in `vepa-consolidation`; Next is the runtime, not the version vault)
- Local `/workspace/vepa` `codey/complete-plans` commits ahead of the v9.3.5 tag (remaining open gap vs fullest local tip)

## Proposed (unconfirmed)
- P-1: Point Pages deploy workflow at this rebuild branch after human acceptance.
- P-2: Follow-up intent to wire `sim-foundation` world-session into the 9.3.5 worker.
- P-3: Follow-up to port local `codey/complete-plans` deltas atop 9.3.5.
