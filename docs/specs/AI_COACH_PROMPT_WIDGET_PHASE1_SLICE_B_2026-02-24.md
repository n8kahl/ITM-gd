# AI Coach Prompt/Widget Hardening - Slice B Report

Date: 2026-02-24  
Owner: Codex autonomous implementation  
Status: Complete

## Slice Objective
Shift AI Coach prompt surfaces to a beginner-first experience while preserving advanced workflows.

## Scope
- Update chat quick prompts in AI Coach page empty state.
- Update center-panel starter prompts.
- Rebalance follow-up chips to favor explainability, risk planning, and chart guidance.

## Out of Scope
- Backend tool-routing behavior.
- Chart overlay extraction logic.
- Watchlist/search ergonomics.

## Files
- `app/members/ai-coach/page.tsx`
- `components/ai-coach/center-panel.tsx`
- `components/ai-coach/follow-up-chips.tsx`

## Implementation Notes
- Replaced advanced-first quick prompt set with:
  - `Start Here`
  - `Read This Chart`
  - `Risk Checklist`
  - `Advanced SPX Plan`
- Updated placeholders to reduce jargon and better match novice intent.
- Updated center-panel example prompts to mirror beginner-first guidance while keeping one advanced path.
- Reworked follow-up chips to prioritize:
  - plain-English explanation
  - show-on-chart behavior
  - risk-plan construction
- Reduced immediate emphasis on alert/scanner style prompts.

## Validation Gate Results
- `pnpm exec eslint app/members/ai-coach/page.tsx components/ai-coach/center-panel.tsx components/ai-coach/follow-up-chips.tsx`
  - PASS
- `pnpm exec tsc --noEmit`
  - PASS
- `pnpm exec playwright test e2e/specs/ai-coach/ai-coach-widget-actions-audit.spec.ts --project=ai-coach --workers=1 --timeout=120000`
  - PASS (1/1)

## Risks / Decisions
- Decision: retain one advanced quick prompt to avoid constraining power users.
- Residual risk: prompt copy tone may still need iteration after first live-user feedback.
