# VEPA PROJECT MANDATES (GEMINI.md)

This file contains foundational mandates for the VEPA (Vector Emergent Physics Automata) project. These instructions take absolute precedence over general operational workflows.

---

## 1. CORE GOVERNANCE

### 1.1 Documentation Synchronization
Every significant code modification, law implementation, or UI refactor MUST be synchronized across the following files:
*   **CHANGELOG.md:** Accurate versioning and categorisation of changes (single source of truth for releases — see AGENTS.md §10.4).
*   **`docs/spec/`:** Regenerated hierarchical technical specifications and drift manifest for significant architecture/tooling changes.
*   **README.md:** High-level project state and quick-start updates.
*   **SPEC.md / PLAN.md:** Architecture spec + roadmap updates for major milestones.
*   **GUIDE.md:** User-facing instructional updates.
*   **`src/constants.js` `LAW_HELP_DB`:** 4-tier documentation for every law (B-4RK).
*   **`docs/audit/`:** Law fidelity audit and retained historical evidence whenever law behavior changes.

> Legacy SSOT files (`ENGINE_SSOT.md`, `docs/fullaudit.md`, `COMPENDIUM.md`) were archived on
> 2026-08-10 — their role is covered by `SPEC.md`, `src/constants.js` and `docs/audit/`.
> The active audit corpus is under `docs/audit/laws/a3/`; archived copies live in the
> `gemquota/vepa-archive` repo.

### 1.2 The "B-4RK" Principle
Documentation is not an afterthought; it is a feature. All new laws must be accompanied by `HELP_DB` entries in `src/constants.js` covering all four tiers (HINT, EXPLANATION, SYSTEM, ADVANCED).

### 1.3 Versioning & Commit Standards (adopted 2026-08-10)
- The product is **VEPA4**; every version uses the **`major.minor.build`** schema (working-tree candidate `9.3.5`; verify changelog, manifests, commit/tag and deployment independently), with legacy labels retained in `CHANGELOG.md` headers (old `4.M.N` → `M.N.0`).
- Every commit MUST follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) (`<type>(<scope>): <description>`); release commits use `chore(release): vX.Y.Z — <summary>` and tags are `vX.Y.Z`.
- The full release protocol (backup branches, changelog-first, manifest sync, tagging) is `AGENTS.md` §10.4 — no release without it.
- Roadmap progress is evidence-gated: maintain `docs/spec/rb/ROADMAP_PROGRESS.md`; distinguish verified completed groundwork from partial implementation and proposed RB sections. Keep sections 00–11 unchecked until acceptance evidence is met; DOM stubs and generated docs alone do not establish runtime/browser completion. Keep the P0–P4 actionable todos current and preserve open decisions.

---

## 2. ENGINEERING STANDARDS

### 2.1 Physics Integrity
*   **Stability First:** All spring-based or attractive forces must implement damping and action/reaction symmetry (averaging stiffness/mass constants).
*   **Bitmask Discipline:** Never hardcode law indices. Always use `LAW_INDEXES` from `constants.js`.

### 2.2 UI/UX Consistency
*   **HELP_DB Parity:** `LAW_HELP_DB` (4 tiers, `src/constants.js`) is the in-engine law documentation source of truth — keep it in sync with `lawgroups/SPEC.md` and the audit suite.
*   **Tactile Feedback:** Every playback control or parameter shift should provide visual confirmation (via Log, HUD, or tooltip).

---

## 3. WORKFLOW ENFORCEMENT
The agent must verify documentation synchronization before declaring a task complete. Failure to update the SSOT results in a "Documentation Debt" state.

---
*Verified by GEMINI_CLI_PEER*
