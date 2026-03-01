# Trade Review UX Hardening Execution Spec

**Feature:** Admin Trade Review Detail UX Hardening  
**Route:** `/admin/trade-review/[id]`  
**Date:** 2026-03-01  
**Owner:** Orchestrator (multi-session)  
**Baseline references:**  
- `docs/specs/TRADE_REVIEW_UX_AUDIT_2026-03-01.md`  
- `docs/specs/TRADE_REVIEW_UX_AUDIT_COMPLETENESS_ADDENDUM_2026-03-01.md`  
- `docs/specs/TRADE_JOURNAL_REVIEW_EXECUTION_SPEC_2026-03-01.md`

---

## 1. Objective

Upgrade Trade Review Detail from a functionally complete admin screen to a premium coaching workstation by implementing P0/P1 UX findings plus production-safety gaps (state safety, concurrency, publish gates).

---

## 2. Scope

### In Scope

- Context bar with review/trade/member summary and queue age.
- Layout rebalance prioritizing coach workspace.
- AI generation flow re-ordering and regenerate semantics.
- Trader profile rendering from `member_stats`.
- Custom publish/dismiss modals and publish content validation.
- Draft safety: dirty indicator, autosave, unload warning, regenerate guard.
- Member-view preview in admin workflow.
- Visual hierarchy/typography updates aligned with Emerald Standard.
- Accessibility fixes (labels, icon button names, status semantics).
- Screenshot usability improvements (larger thumbs, zoom, no raw path).
- Activity log usability improvements.
- Prev/next review navigation.
- Keyboard shortcuts for power users.

### Out of Scope (This Workstream)

- Rich-text markdown editor for feedback.
- Reusable feedback template library.
- Full previous-review analytics dashboard beyond lightweight recent list.

---

## 3. Constraints and Non-Negotiables

1. Preserve existing API contracts for member-facing coach feedback payload.
2. `internal_notes` must never be exposed to member APIs.
3. Fail closed on admin authorization.
4. No destructive schema changes; additive only.
5. Every slice must pass gates before advancing.
6. Final release evidence must be captured under Node `>= 20.19.5`.

---

## 4. Phase and Slice Plan

## Phase 0: Contract and Safety Foundation

### Slice 0.1 — Type Contracts + Data Surface Prep

- Target files:
  - `app/admin/trade-review/[id]/page.tsx`
  - `lib/types/coach-review.ts`
  - `app/api/admin/trade-review/[id]/route.ts`
- Deliverables:
  - Strongly typed `member_stats`.
  - Context-bar fields available in response (`requested_at`, assigned actor display, draft origin).
  - Activity log includes actor display data.
- Gate:
  - `pnpm exec eslint app/admin/trade-review/[id]/page.tsx app/api/admin/trade-review/[id]/route.ts lib/types/coach-review.ts`
  - `pnpm exec tsc --noEmit`

### Slice 0.2 — Publish Validation Contract

- Target files:
  - `app/api/admin/trade-review/[id]/publish/route.ts`
  - `lib/validation/coach-review.ts`
- Deliverables:
  - Server-side minimum-content validation before publish.
  - Explicit 400 response with actionable validation message.
- Gate:
  - `pnpm exec eslint app/api/admin/trade-review/[id]/publish/route.ts lib/validation/coach-review.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm vitest run lib/validation/__tests__/coach-review.test.ts`

## Phase 1: P0 UX Flow

### Slice 1.1 — Context Bar + Hero Metrics

- Target files:
  - `app/admin/trade-review/[id]/page.tsx`
  - `components/admin/trade-review/trade-detail-panel.tsx`
- Deliverables:
  - Persistent context bar under page header.
  - Member identity, trade summary, review status, draft status, queue age.
  - Prominent mono P&L/P&L% display.
- Gate:
  - `pnpm exec eslint app/admin/trade-review/[id]/page.tsx components/admin/trade-review/trade-detail-panel.tsx`
  - `pnpm exec tsc --noEmit`

### Slice 1.2 — Layout Rebalance

- Target files:
  - `app/admin/trade-review/[id]/page.tsx`
  - `components/admin/trade-review/trade-detail-panel.tsx`
  - `components/admin/trade-review/market-context-panel.tsx`
  - `components/admin/trade-review/coach-workspace.tsx`
- Deliverables:
  - Shift to workspace-priority layout (`2/5 + 3/5` or tabbed reference panel).
  - Maintain mobile stack behavior.
- Gate:
  - `pnpm exec eslint app/admin/trade-review/[id]/page.tsx components/admin/trade-review/trade-detail-panel.tsx components/admin/trade-review/market-context-panel.tsx components/admin/trade-review/coach-workspace.tsx`
  - `pnpm exec tsc --noEmit`

### Slice 1.3 — AI Generation Card Cohesion

- Target files:
  - `components/admin/trade-review/coach-workspace.tsx`
- Deliverables:
  - Notes field and generate button grouped in single "AI Generation" card.
  - Label switches to "Regenerate" after first generation.
  - Helper text clarifying notes influence.
- Gate:
  - `pnpm exec eslint components/admin/trade-review/coach-workspace.tsx`
  - `pnpm exec tsc --noEmit`

## Phase 2: Workflow Safety and Confidence

### Slice 2.1 — Draft Safety (Autosave + Dirty State)

- Target files:
  - `components/admin/trade-review/coach-workspace.tsx`
  - `app/admin/trade-review/[id]/page.tsx`
- Deliverables:
  - Dirty-state tracking and visible saved/unsaved indicator.
  - Debounced autosave (10s).
  - `beforeunload` protection for unsaved changes.
  - Prevent draft clobber on non-draft mutations.
- Gate:
  - `pnpm exec eslint app/admin/trade-review/[id]/page.tsx components/admin/trade-review/coach-workspace.tsx`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/specs/admin/trade-review.spec.ts --project=chromium --workers=1 --grep \"draft|save|publish\"`

### Slice 2.2 — Custom Modals for Publish/Dismiss

- Target files:
  - `components/admin/trade-review/coach-workspace.tsx`
  - `e2e/specs/admin/trade-review.spec.ts`
- Deliverables:
  - Replace `window.confirm()` with branded modal flow.
  - Publish modal shows summary and member identity.
  - Dismiss modal supports reason field (if provided).
  - E2E updated away from native dialog hooks.
- Gate:
  - `pnpm exec eslint components/admin/trade-review/coach-workspace.tsx e2e/specs/admin/trade-review.spec.ts`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/specs/admin/trade-review.spec.ts --project=chromium --workers=1`

### Slice 2.3 — Member View Preview

- Target files:
  - `components/admin/trade-review/coach-workspace.tsx`
  - `components/journal/coach-feedback-section.tsx`
- Deliverables:
  - Admin preview toggle/modal rendering through member feedback component contract.
- Gate:
  - `pnpm exec eslint components/admin/trade-review/coach-workspace.tsx components/journal/coach-feedback-section.tsx`
  - `pnpm exec tsc --noEmit`

### Slice 2.4 — Trader Profile + Inline Member Notes

- Target files:
  - `components/admin/trade-review/trade-detail-panel.tsx`
  - `components/admin/trade-review/coach-workspace.tsx`
- Deliverables:
  - Trader profile card based on `member_stats`.
  - Inline member notes reference in workspace.
- Gate:
  - `pnpm exec eslint components/admin/trade-review/trade-detail-panel.tsx components/admin/trade-review/coach-workspace.tsx`
  - `pnpm exec tsc --noEmit`

## Phase 3: Visual and Accessibility Hardening

### Slice 3.1 — Visual Hierarchy and Typography

- Target files:
  - `components/admin/trade-review/trade-detail-panel.tsx`
  - `components/admin/trade-review/market-context-panel.tsx`
  - `components/admin/trade-review/coach-workspace.tsx`
- Deliverables:
  - Metric clustering to reduce card noise.
  - Playfair headings and mono financial data where appropriate.
  - Grade/confidence segmented controls.
  - Border opacity aligned with brand defaults.
- Gate:
  - `pnpm exec eslint components/admin/trade-review/trade-detail-panel.tsx components/admin/trade-review/market-context-panel.tsx components/admin/trade-review/coach-workspace.tsx`
  - `pnpm exec tsc --noEmit`

### Slice 3.2 — Screenshot and Activity Log Improvements

- Target files:
  - `components/admin/trade-review/coach-workspace.tsx`
  - `app/api/admin/trade-review/[id]/route.ts`
- Deliverables:
  - Larger thumbnails and zoom.
  - Remove raw screenshot path from UI.
  - Activity log readability improvements (actor + relative time + milestone styling).
- Gate:
  - `pnpm exec eslint components/admin/trade-review/coach-workspace.tsx app/api/admin/trade-review/[id]/route.ts`
  - `pnpm exec tsc --noEmit`

### Slice 3.3 — Loading Skeleton and A11y Compliance

- Target files:
  - `app/admin/trade-review/[id]/page.tsx`
  - `components/admin/trade-review/coach-workspace.tsx`
  - `components/admin/trade-review/market-context-panel.tsx`
- Deliverables:
  - Branded skeleton layout for initial load.
  - Visible labels / aria labels for all form and icon controls.
  - Non-color-only status semantics improvements.
- Gate:
  - `pnpm exec eslint app/admin/trade-review/[id]/page.tsx components/admin/trade-review/coach-workspace.tsx components/admin/trade-review/market-context-panel.tsx`
  - `pnpm exec tsc --noEmit`
  - `pnpm exec playwright test e2e/specs/ai-coach/ai-coach-a11y.spec.ts --project=chromium --workers=1`

## Phase 4: Navigation, Shortcuts, and Release Hardening

### Slice 4.1 — Prev/Next Review Navigation

- Target files:
  - `app/api/admin/trade-review/browse/route.ts`
  - `app/admin/trade-review/[id]/page.tsx`
- Deliverables:
  - Previous/next controls with member+symbol preview.
- Gate:
  - `pnpm exec eslint app/admin/trade-review/[id]/page.tsx app/api/admin/trade-review/browse/route.ts`
  - `pnpm exec tsc --noEmit`

### Slice 4.2 — Keyboard Shortcuts

- Target files:
  - `components/admin/trade-review/coach-workspace.tsx`
  - `app/admin/trade-review/[id]/page.tsx`
- Deliverables:
  - `Cmd+S`, `Cmd+G`, `Cmd+Enter`, `Escape` shortcut behavior.
  - Shortcut discoverability helper text.
- Gate:
  - `pnpm exec eslint app/admin/trade-review/[id]/page.tsx components/admin/trade-review/coach-workspace.tsx`
  - `pnpm exec tsc --noEmit`

### Slice 4.3 — Final QA + Release Evidence

- Target files:
  - `e2e/specs/admin/trade-review.spec.ts`
  - docs packet updates
- Deliverables:
  - Updated E2E coverage for modal flows, autosave, preview, and navigation.
  - Release notes and runbook updates.
- Final Gate:
  - `pnpm exec eslint .`
  - `pnpm exec tsc --noEmit`
  - `pnpm run build`
  - `pnpm test`
  - `pnpm exec playwright test e2e/specs/admin/trade-review.spec.ts --project=chromium --workers=1`

---

## 5. Multi-Session Execution Plan

| Session | Scope | Exit Criteria |
|---------|-------|---------------|
| Session A | Slices 0.1, 0.2, 1.1 | API contract and context bar in place, gates green |
| Session B | Slices 1.2, 1.3, 2.1 | Layout + AI flow + autosave completed, gates green |
| Session C | Slices 2.2, 2.3, 2.4 | Modal flow + preview + trader profile completed, gates green |
| Session D | Slices 3.1, 3.2, 3.3 | Visual hierarchy + screenshots + a11y hardening completed, gates green |
| Session E | Slices 4.1, 4.2, 4.3 | Navigation + shortcuts + release evidence completed |

Session response contract (required each run):
1. Changed files
2. Command outputs (pass/fail)
3. Risks/notes
4. Suggested commit message

---

## 6. Rollback Strategy

1. Revert per-slice commits in reverse order if regression appears.
2. If a severe regression lands mid-workstream, halt and ship a targeted hotfix branch from `main`.
3. Keep modal and shortcut changes isolated for simple rollback.
4. No destructive DB rollback expected; schema/API changes are additive only.

---

## 7. Acceptance Criteria Summary

- Coach can orient in <2 seconds from context bar without scanning all panels.
- Workspace has clear visual priority and improved authoring ergonomics.
- No draft loss when navigating, regenerating, or after transient failures.
- Publish path is premium (custom modal) and guarded against empty/incomplete payloads.
- Member preview matches member-facing rendering semantics.
- A11y defects for labels/icon buttons are resolved.
- Admin E2E flow passes with new modal/preview/shortcut behaviors.
