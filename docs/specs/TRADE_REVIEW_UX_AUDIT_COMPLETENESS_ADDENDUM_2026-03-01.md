# Trade Review UX Audit — Completeness Addendum

**Surface:** `/admin/trade-review/[id]`  
**Date:** 2026-03-01  
**Source Audit:** `docs/specs/TRADE_REVIEW_UX_AUDIT_2026-03-01.md`  
**Code Baseline Reviewed:** `app/admin/trade-review/[id]/page.tsx`, `components/admin/trade-review/*`, `app/api/admin/trade-review/[id]/*`

---

## Completeness Verdict

The UX audit is strong on interaction and visual hierarchy, and it correctly identifies the highest-friction UI issues.  
For production implementation readiness, it needs additional coverage in **state safety**, **concurrency rules**, and **gate/test contract changes**.

---

## Confirmed Accurate Findings

- Three equal columns (`xl:grid-cols-3`) under-prioritize the workspace.
- `member_stats` is fetched and returned but not rendered.
- `window.confirm()` is used for publish/dismiss.
- Coach screenshots are small (`h-24`) and expose raw storage paths.
- Grade/confidence are plain `<select>` controls without visible labels.
- Loading state is plain text instead of branded skeleton.

---

## Missing or Under-Specified Items

| Priority | Gap | Why It Matters | Implementation Note |
|----------|-----|----------------|---------------------|
| **P0** | Draft clobber risk on refetch/remount | Unsaved edits can be lost after generate/upload/save cycles due remount + reload flow | Remove remount key dependency and add dirty-state persistence guard |
| **P0** | Publish quality gate contract | Current publish route can mark review complete with no meaningful draft content | Add server-side minimum-content validation on publish route |
| **P0** | Multi-admin ownership/concurrency rule | Any admin can publish/dismiss regardless of assignment context | Enforce claim/assignment rule or explicit override model |
| **P1** | Regenerate safety policy | AI regenerate may overwrite in-progress manual edits without explicit confirmation | Add "unsaved changes" modal before regenerate |
| **P1** | Context bar data contract completeness | Queue-time and draft-status indicators need explicit API fields | Add `requested_at`, derived queue age, and draft-origin metadata |
| **P1** | Modal migration test impact | Replacing `window.confirm` invalidates existing E2E dialog hooks | Update Playwright tests to assert custom modal behavior |
| **P1** | Operational telemetry | No event instrumentation for generate/save/publish/dismiss latencies and failures | Add lightweight admin event telemetry for regression monitoring |
| **P2** | Responsive admin behavior details | Audit is desktop-centric; mobile/tablet treatment is undefined | Define breakpoint behavior and sticky action bar policy |

---

## Recommended Scope Additions Before Implementation

1. Add a **state-safety slice** (dirty tracking, autosave, unload warning, regenerate safety).
2. Add an **API contract slice** for context bar metadata and publish validation rules.
3. Add a **concurrency policy decision** (strict assignment vs soft warning override).
4. Add a **test migration slice** for dialog-to-modal and keyboard shortcuts.
5. Add **release telemetry acceptance criteria** for admin workflow reliability.
