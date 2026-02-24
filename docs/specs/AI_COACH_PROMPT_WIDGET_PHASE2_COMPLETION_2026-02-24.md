# AI Coach Prompt/Widget Experience - Phase 2 Completion

Date: 2026-02-24  
Owner: Codex autonomous implementation  
Status: Complete

## Objective
Complete the remaining post-Phase-1 improvements from the AI Coach prompt/widget experience audit:
- richer chart visual context
- explicit beginner progression rails
- consistent widget action hierarchy
- trust metadata standardization
- stronger mobile chart-to-chat return affordance

## Implemented Scope

### 1. Chart visual context expansion
- Extended chart request contract to support:
  - `positionOverlays`
  - `eventMarkers`
  - existing `contextNotes` retained
- Extended extraction pipeline in `use-ai-coach-chat` for:
  - scanner setups -> entry/stop/target overlays
  - analyzed positions -> overlay and context
  - earnings -> expected-move overlay + earnings marker
  - macro/economic/news -> event markers + context
- Extended mobile/desktop event bridges so chart payloads preserve overlays/markers.
- Rendered event marker strip in chart header and passed position overlays into TradingChart.
- Added timeline-style event markers directly in chart canvas (vertical dashed marker lines + impact-colored labels).

### 2. Beginner progression rails + capability hints
- Added persistent 4-step beginner rail:
  - Level 1: Read trend
  - Level 2: Define trigger
  - Level 3: Build risk plan
  - Level 4: Post-trade review
- Persisted selected rail step in local storage (`ai-coach-beginner-rail-step`).
- Added rail controls in empty state and near input area for in-session progression.
- Added rotating "You can ask me..." capability hints tied to market-session bucket.

### 3. Widget action consistency hardening
- Added global widget action prioritization helper.
- Standardized ordering preference by intent (`Show on Chart`, risk/explain intent, options, ask AI).
- Updated key analytical cards to explicitly include risk/explain actions while preserving critical direct actions.
- Updated quick-action tiering to keep key actions visible (`View Options`, `Set Alert`, `Analyze`) where present.
- Added unit tests to lock quick-action visibility policy and prevent regressions.

### 4. Trust metadata standardization
- Added shared `WidgetDataFooter` for analytical cards with:
  - `Data as of`
  - `Source`
  - `Confidence` (when available)
- Applied footer to major analytical cards (levels, price, macro, options, GEX, game plan, scanner, 0DTE, IV, economic, earnings, news).

### 5. Mobile context strip
- Added persistent context strip in mobile tool sheet with:
  - last assistant message summary
  - one-tap `Back to Chat` affordance

## Files Changed
- `app/members/ai-coach/page.tsx`
- `components/ai-coach/center-panel.tsx`
- `components/ai-coach/mobile-tool-sheet.tsx`
- `components/ai-coach/widget-action-bar.tsx`
- `components/ai-coach/widget-actions.ts`
- `components/ai-coach/widget-cards.tsx`
- `components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts`
- `hooks/use-ai-coach-chat.ts`
- `hooks/use-mobile-tool-sheet.ts`
- `contexts/AICoachWorkflowContext.tsx`

## Validation Gates
- `pnpm exec eslint app/members/ai-coach/page.tsx components/ai-coach/center-panel.tsx components/ai-coach/mobile-tool-sheet.tsx components/ai-coach/widget-action-bar.tsx components/ai-coach/widget-actions.ts components/ai-coach/widget-cards.tsx hooks/use-ai-coach-chat.ts hooks/use-mobile-tool-sheet.ts contexts/AICoachWorkflowContext.tsx components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts`
  - PASS
- `pnpm exec tsc --noEmit`
  - PASS
- `pnpm exec vitest run components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts`
  - PASS
- `pnpm exec vitest run components/ai-coach/__tests__/widget-action-bar-v2.test.ts`
  - PASS (4/4)
- Combined targeted run: `pnpm exec vitest run components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts components/ai-coach/__tests__/widget-action-bar-v2.test.ts`
  - PASS (10/10)
- `npm run test --prefix backend -- src/chatkit/__tests__/intentRouter.test.ts`
  - PASS (13/13)
- `pnpm exec playwright test e2e/specs/ai-coach/ai-coach-widget-actions-audit.spec.ts --project=ai-coach --workers=1 --timeout=120000`
  - PASS (1/1)

## Residual Risks
- Widget action density is higher on certain cards; overflow usage should be observed in production telemetry.
- Event markers currently render as chart-context strip indicators (not candle-bound markers yet).
- Additional accessibility QA (keyboard navigation in dense action bars) should be completed before broad rollout.
