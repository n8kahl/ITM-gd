# AI Coach Prompt/Widget Hardening - Slice D Report

Date: 2026-02-24  
Owner: Codex autonomous implementation  
Status: Complete

## Slice Objective
Make symbol switching and watchlist management explicit, discoverable, and reliable for both new and advanced users.

## Scope
- Improve symbol search commit behavior.
- Add explicit watchlist management UI in chart toolbar.
- Ensure watchlist changes persist through AI Coach preferences state.

## Out of Scope
- Server-side watchlist persistence.
- Legacy watchlist panel reintroduction.

## Files
- `components/ai-coach/symbol-search.tsx`
- `components/ai-coach/chart-toolbar.tsx`
- `components/ai-coach/center-panel.tsx`

## Implementation Notes
- Added explicit `Go` action in symbol search to commit typed symbols.
- Added manual-symbol fallback when query is syntactically valid but not in suggestion list.
- Added watchlist management panel in chart toolbar:
  - add/remove/select symbols
  - symbol count and capacity
  - quick watchlist chips for fast switching (desktop XL)
- Added `Manage Watchlist` affordance and helper copy for discoverability.
- Wired toolbar watchlist edits to center-panel preferences state for persistence.

## Validation Gate Results
- `pnpm exec eslint components/ai-coach/symbol-search.tsx components/ai-coach/chart-toolbar.tsx components/ai-coach/center-panel.tsx`
  - PASS
- `pnpm exec tsc --noEmit`
  - PASS
- `pnpm exec playwright test e2e/specs/ai-coach/ai-coach-widget-actions-audit.spec.ts --project=ai-coach --workers=1 --timeout=120000`
  - PASS (1/1)

## Risks / Decisions
- Decision: keep watchlist client-local via preferences for now to avoid backend re-expansion during refactor.
- Residual risk: toolbar watchlist panel may require additional keyboard/accessibility refinement after QA pass.
