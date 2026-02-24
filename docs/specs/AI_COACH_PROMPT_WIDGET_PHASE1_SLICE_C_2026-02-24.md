# AI Coach Prompt/Widget Hardening - Slice C Report

Date: 2026-02-24  
Owner: Codex autonomous implementation  
Status: Complete

## Slice Objective
Increase chart context fidelity by converting more AI tool outputs (earnings/macro/economic/news) into concrete chart requests.

## Scope
- Enrich chart request extraction in chat hook.
- Propagate chart context notes through widget actions and mobile sheet payloads.
- Render context notes in chart surface for user-visible context continuity.

## Out of Scope
- New chart rendering engine primitives.
- New backend endpoints.
- Full visual redesign.

## Files
- `hooks/use-ai-coach-chat.ts`
- `components/ai-coach/widget-actions.ts`
- `hooks/use-mobile-tool-sheet.ts`
- `components/ai-coach/widget-cards.tsx`
- `components/ai-coach/center-panel.tsx`
- `components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts`

## Implementation Notes
- Added chart extraction support for:
  - `get_earnings_analysis` (expected move high/low and context notes)
  - `get_macro_context` (symbol/fed/event context notes)
  - `get_economic_calendar` (top event context notes)
  - `get_ticker_news` (headline context notes)
- Added `contextNotes?: string[]` to chart action payloads and mobile tool-sheet mapping.
- Added chart context note rendering under toolbar as compact context badges.
- Updated macro and earnings widget card actions to pass contextual notes into chart requests.
- Added unit coverage to ensure mobile chart request preserves `contextNotes`.

## Validation Gate Results
- `pnpm exec eslint hooks/use-ai-coach-chat.ts components/ai-coach/widget-actions.ts hooks/use-mobile-tool-sheet.ts components/ai-coach/widget-cards.tsx components/ai-coach/center-panel.tsx components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts`
  - PASS
- `pnpm exec tsc --noEmit`
  - PASS
- `pnpm exec vitest run components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts`
  - PASS (6/6)

## Risks / Decisions
- Decision: cap chart context notes and dedupe to prevent noisy overlays.
- Residual risk: context notes can still become stale if user rapidly changes symbol/timeframe.
  - Mitigation: clear context notes on explicit symbol/timeframe sync changes.
