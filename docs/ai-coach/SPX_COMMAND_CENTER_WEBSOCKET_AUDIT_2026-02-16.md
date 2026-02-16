# SPX Command Center WebSocket Audit (2026-02-16)

## Scope
- Audited repo-wide runtime websocket usage and SPX Command Center channel delivery.
- Verified backend websocket auth/subscription behavior.
- Validated Massive integration assumptions against Massive documentation.

## Runtime WebSocket Surface (repo-wide)
- Application runtime websocket creation is centralized in:
  - `hooks/use-price-stream.ts`
- Backend websocket endpoint:
  - `backend/src/services/websocket.ts` at `/ws/prices`
- Other websocket references are test-only/e2e-only.

## Root Causes Identified

### 1) SPX channel delivery was timer-gated, not subscription-driven
- `backend/src/services/websocket.ts` only emitted SPX channel payloads during the periodic poll loop.
- First poll is delayed by 5 seconds (`startPolling()`), and several SPX channels have longer broadcast gates (30-60 seconds).
- Result:
  - Subscriber can connect and subscribe but receive no immediate SPX channel payload.
  - Integration behavior appeared flaky and non-deterministic under timing pressure.

### 2) Integration test expected immediate data but used sequential listener windows
- `backend/src/__tests__/integration/spx-websocket.test.ts` subscribed once and then awaited channel messages sequentially.
- When messages are bursty, sequential waits can miss already-emitted events.
- Result:
  - Timeout failure at `src/__tests__/integration/spx-websocket.test.ts:293`.

### 3) Client-side close/reconnect noise amplified failures
- Prior behavior could repeatedly attempt connects when upstream failed or auth was rejected.
- This produced console storms (`WebSocket is closed before the connection is established`) and obscured root cause signals.
- Existing hardening (already implemented in this branch) materially reduces this risk:
  - failure threshold,
  - reconnect pause,
  - minimum connect interval,
  - token-auth failure lockout.

### 4) Reconnect throttle edge case (determinism gap)
- A throttled reconnect attempt could run before the `wsNextConnectAt` window and return without scheduling the eventual allowed retry.
- Result:
  - retry behavior could become non-deterministic (stalled reconnect until another lifecycle event retriggered connection logic).

## Resolution Implemented

### A) Deterministic initial SPX snapshot on subscribe
- Added one-shot initial SPX channel payload push immediately after successful subscribe.
- Implemented in:
  - `backend/src/services/websocket.ts`
- Covered channels:
  - `gex:SPX`, `gex:SPY`, `regime:update`, `basis:update`,
  - `levels:update`, `clusters:update`, `setups:update`,
  - `flow:alert`, `coach:message`.

### B) Stabilized integration assertion strategy
- Replaced sequential per-channel waits with a single capture window that matches all required channel events.
- Implemented in:
  - `backend/src/__tests__/integration/spx-websocket.test.ts`

### C) Deterministic throttled retry scheduling
- Added explicit timer scheduling at the next allowed connect boundary when reconnect is throttled.
- This guarantees retry progression without relying on incidental future lifecycle events.
- Implemented in:
  - `hooks/use-price-stream.ts`

### D) AI Coach realtime chart websocket projection
- Added deterministic realtime candle merge for AI Coach chart views and inline chart previews.
- Realtime ticks are merged into the active timeframe bucket with explicit rules for:
  - same-bucket candle update,
  - next-bucket candle append,
  - stale tick ignore,
  - daily in-place update.
- Implemented in:
  - `components/ai-coach/chart-realtime.ts`
  - `components/ai-coach/center-panel.tsx`
  - `components/ai-coach/inline-mini-chart.tsx`
  - `components/ai-coach/__tests__/chart-realtime.test.ts`

### E) Immediate symbol snapshot on websocket subscribe
- Symbol subscriptions now trigger an immediate initial `price` message, backed by stale-cache checks and in-flight fetch deduplication.
- Implemented in:
  - `backend/src/services/websocket.ts`
  - `backend/src/__tests__/integration/spx-websocket.test.ts`

## Massive.com Spec Validation

Validated code usage against Massive documentation:
- REST base URL:
  - `https://api.massive.com`
- Endpoints used by this integration match docs:
  - `GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}`
  - `GET /v2/last/trade/{ticker}`
  - `GET /v2/last/nbbo/{ticker}`
  - `GET /v1/marketstatus/now`
  - `GET /v3/reference/options/contracts`
  - `GET /v3/snapshot/options/{underlyingAsset}`
  - `GET /v3/snapshot/options/{underlyingAsset}/{optionContract}`
- Index ticker prefix requirement aligns with implementation:
  - Massive docs specify `I:` prefix for index tickers in websocket docs; code uses `formatMassiveTicker()` with `I:` for index symbols.

## Validation Status
- `pnpm -C backend exec tsc -p tsconfig.json --noEmit` passed.
- `pnpm exec tsc --noEmit` passed.
- `pnpm exec vitest run components/ai-coach/__tests__/chart-realtime.test.ts` passed.
- `pnpm -C backend test -- src/__tests__/integration/spx-api.test.ts src/__tests__/integration/spx-websocket.test.ts src/services/__tests__/websocket.authz.test.ts src/services/__tests__/websocket.test.ts --runInBand` passed.
- `pnpm -C backend test -- src/services/spx/__tests__/gexEngine.test.ts src/services/spx/__tests__/levelEngine.test.ts src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/fibEngine.test.ts src/services/spx/__tests__/aiPredictor.test.ts --runInBand` passed.

## Remaining Operational Checks (pre-deploy)
- Confirm production backend env aligns with frontend token issuer/audience (Supabase project consistency).
- Confirm production `NEXT_PUBLIC_SPX_BACKEND_URL` points to the intended backend and is reachable from the deployed frontend origin.
- Enable price-stream debug flag in one QA session to capture close codes and reasons if websocket auth failures persist.
