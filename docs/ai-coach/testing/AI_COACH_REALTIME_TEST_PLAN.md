# AI Coach Realtime Test Plan

Last Updated: 2026-02-14  
Owner: AI Coach Engineering

## Scope
- Chart realtime updates driven by `/ws/prices` with REST reconciliation.
- Chart fetch race safety (abort + latest-request-wins).
- Progressive chat stream status + function-result events.
- Screenshot analysis context persistence via canonical chat turns.

## Validation Commands
```bash
pnpm test:unit components/ai-coach/__tests__/chart-level-utils.test.ts components/ai-coach/__tests__/chart-level-labels.test.ts components/dashboard/__tests__/market-status-badge.test.tsx backend/src/services/__tests__/marketIndices.test.ts backend/src/services/__tests__/realTimePrice.test.ts backend/src/services/__tests__/stockSplits.test.ts

pnpm eslint components/ai-coach/center-panel.tsx components/ai-coach/chart-level-labels.tsx components/ai-coach/view-transition.tsx components/ai-coach/widget-action-bar.tsx hooks/use-price-stream.ts hooks/use-ai-coach-chat.ts app/members/ai-coach/page.tsx lib/api/ai-coach.ts
```

## Manual Scenarios
1. Open AI Coach chart on `SPX 5m`, verify live/delayed badge updates as websocket status changes.
2. Rapidly switch symbol/timeframe (`SPX -> NDX -> SPY`, `1m -> 5m -> 1h`), verify latest selection persists and old responses do not overwrite.
3. Click chart levels on desktop and mobile; verify selected-level action bar exposes `Open Options`, `Create Alert`, `Ask AI`.
4. Upload screenshot, wait for OCR extraction, verify resulting context appears as canonical chat turn and survives session reload.
5. During long tool-call response, verify stream status transitions and no loss of partial assistant content when stream drops mid-response.

## Known Failure Modes
- If websocket auth token is missing/expired, chart falls back to REST-only refresh and marks stream as delayed.
- Backend stream tests requiring env-backed config may fail in local CI-lite shells without OpenAI/Supabase env vars.
- Local Node < 22 emits engine warnings during test/lint commands.
