# AI Coach Prompt/Widget/Experience Hardening Spec

Date: 2026-02-24  
Owner: Codex autonomous implementation  
Status: Phase 1 Complete

## Objective
Improve AI Coach usability and trust for new traders while increasing chart-context fidelity.

This slice addresses four production gaps:
1. Prompt routing brittleness for novice phrasing.
2. Over-constrained response contract that can over-index on compliance text.
3. Limited chart context extraction for earnings/macro/economic workflows.
4. Discoverability and clarity issues in symbol search and watchlist editing.

## Discovery and Drift Summary
Recent baseline:
- `5f2573e` refactored AI Coach to chat+chart and removed legacy panels/routes.
- `411f100` is SPX-focused and does not materially change AI Coach prompt/widget behavior.

Current drift from intended coaching experience:
- Quick prompts and follow-up chips are advanced-first.
- Chart extraction prioritizes level/GEX flows but misses earnings/macro/economic context.
- Intent routing uses broad phrase matches (`"what is"`) that can misroute novice educational questions.
- Alert-centric action affordances still dominate several widgets despite simplified coach model.

## Constraints
- No backward compatibility requirements for unlaunched AI Coach rollout.
- Maintain production stability: no breaking API contract changes without frontend alignment.
- Keep chart as primary visual anchor.
- Keep changes deterministic and testable under Node >= 22.

## In Scope
- Backend ChatKit routing + response contract tuning.
- Frontend quick prompt/follow-up chip novice-safe defaults.
- Chart request extraction enrichment for earnings/macro/economic/news outputs.
- Chart toolbar/symbol search/watchlist UX polish.
- Targeted tests and slice gate evidence.

## Out of Scope
- New market data providers or major backend service rewrites.
- Full redesign of AI Coach layout architecture.
- Database schema migrations.
- SPX Command Center strategy logic.

## Slice Plan

### Slice A: Prompt and Routing Hardening
- Narrow `company_profile` trigger phrases to avoid generic educational misroutes.
- Add route guard for no-symbol educational prompts.
- Reduce blocking contract enforcement for non-risky educational flows.

Acceptance:
- Novice educational prompts no longer require ticker-bound tools.
- Contract rewrite frequency reduced for informational prompts.
- Existing high-risk setup/strategy flows remain constrained.

### Slice B: Beginner-First Prompt Surfaces
- Add beginner/intermediate/advanced quick prompt sets for empty state.
- Add follow-up chips that prioritize "Explain", "Show on chart", "Risk plan" before advanced scan/alerts.

Acceptance:
- Beginner mode quick prompts avoid jargon-heavy defaults.
- Chips remain context-aware but reduce advanced terminology by default.

### Slice C: Chart Context Enrichment
- Extend chart request extraction to map:
  - earnings expected move to chart levels/range lines,
  - macro/economic events to chart context summary overlays,
  - news-derived symbol context to chart focus.
- Keep non-invasive visualization in existing chart and center panel surfaces.

Acceptance:
- Earnings/macro/economic assistant responses more consistently drive chart-visible context.
- No regressions to existing level/GEX overlays.

### Slice D: Search and Watchlist UX Polish
- Improve symbol search affordance and validation feedback.
- Improve watchlist editing visibility and action clarity.
- Ensure desktop/mobile parity where applicable.

Acceptance:
- User can reliably change symbol via search without ambiguity.
- Watchlist add/remove/select operations are obvious and discoverable.

## Phase 1 Completion Summary
- Slice A complete: intent routing and contract behavior hardened for novice phrasing.
- Slice B complete: beginner-first quick prompts and follow-up chips deployed.
- Slice C complete: earnings/macro/economic/news outputs now drive chart context notes.
- Slice D complete: symbol search commit reliability and watchlist management discoverability improved.

## Gate Evidence Snapshot
- `pnpm exec eslint <touched frontend files>`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm exec vitest run components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts`: PASS
- `npm run test --prefix backend -- src/chatkit/__tests__/intentRouter.test.ts`: PASS
- `pnpm exec playwright test e2e/specs/ai-coach/ai-coach-widget-actions-audit.spec.ts --project=ai-coach --workers=1 --timeout=120000`: PASS

## Validation Gates (Slice-Level)
- `pnpm exec eslint <touched files>`
- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run <targeted tests>`
- `pnpm exec playwright test e2e/specs/ai-coach/ai-coach-widget-actions-audit.spec.ts --project=ai-coach --workers=1` (best-effort in this slice if runtime/env permits)

## Target Files (Initial)
- `backend/src/chatkit/intentRouter.ts`
- `backend/src/chatkit/systemPrompt.ts`
- `backend/src/chatkit/__tests__/intentRouter.test.ts`
- `app/members/ai-coach/page.tsx`
- `components/ai-coach/follow-up-chips.tsx`
- `hooks/use-ai-coach-chat.ts`
- `components/ai-coach/center-panel.tsx`
- `components/ai-coach/chart-toolbar.tsx`
- `components/ai-coach/symbol-search.tsx`

## Risks and Rollback
- Risk: Over-relaxing contract gates may reduce structured analysis quality.
  - Mitigation: keep strict checks for setup/strategy/high-risk intents.
- Risk: Additional chart context extraction may introduce noisy overlays.
  - Mitigation: cap and dedupe synthesized levels/events.
- Rollback: Revert touched files and keep existing chart extraction/routing behavior.
