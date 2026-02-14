# AI Coach Streaming and Realtime Architecture

Last Updated: 2026-02-14  
Owner: AI Coach Engineering

## Overview
The AI Coach realtime architecture now combines:
1. Shared websocket singleton (`use-price-stream`) for quote/status updates.
2. REST chart fetch path with request cancellation and latest-request-wins.
3. SSE chat stream with progressive status phases, token deltas, and `function_result` events.
4. Screenshot OCR flow that persists extracted context as canonical chat turns.

## Chart Data Flow
1. `CenterPanel` requests chart candles via REST (`/api/chart/:symbol`).
2. In-flight requests are aborted when symbol/timeframe changes.
3. Live websocket quote updates patch the in-memory last candle.
4. Periodic reconciliation refreshes candles from REST for integrity.
5. UI surfaces stream health (`Live` vs `Delayed`) and non-blocking update state.

## Chat Stream Flow
1. Client opens `POST /api/chat/stream`.
2. Server emits ordered events: `session`, `status`, `token`, `function_result`, `done`.
3. Client renders progressive status and tokenized content.
4. If stream fails after partial tokens, client preserves partial assistant content and marks interruption.

## WebSocket Subscription Hygiene
- Hook-level shared connection across active consumers.
- Subscription diffing sends incremental `subscribe`/`unsubscribe` deltas.
- Deterministic teardown when consumers unmount or auth/session changes.

## Operational Checks
```bash
pnpm test:unit components/ai-coach/__tests__/chart-level-utils.test.ts components/ai-coach/__tests__/chart-level-labels.test.ts
pnpm eslint hooks/use-price-stream.ts components/ai-coach/center-panel.tsx hooks/use-ai-coach-chat.ts
```

## Known Limitations
- Position/tracked-setups channels still maintain their own channel-specific websocket clients.
- Stream-service unit tests can require environment wiring depending on local test harness behavior.
