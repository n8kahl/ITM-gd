# SPX Command Center Phase 18 — Phase A Slice 1 (A.PR-1 Start)

Date: 2026-02-23  
Status: in_progress

## Objective
Introduce ATR computation as a production-safe foundation primitive for volatility-adaptive stop logic, and expand default tick-stream symbol support for volatility indices.

## Scope
- Added ATR service with cache-aware retrieval and deterministic ATR-from-bars utility:
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/atrService.ts`
- Added unit coverage for ATR service:
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/atrService.test.ts`
- Wired ATR into setup detector indicator context and stop policy input (non-breaking contract):
  - `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
- Expanded recognized index symbols for stream formatting:
  - `/Users/natekahl/ITM-gd/backend/src/lib/symbols.ts`
- Expanded backend default stream symbol set:
  - `/Users/natekahl/ITM-gd/backend/src/config/env.ts`
  - `/Users/natekahl/ITM-gd/backend/.env.example`

## Out of Scope
- `STANDBY` API/state contract rollout
- Environment gate enforcement
- Flow aggregator and multi-timeframe confluence rewrite
- Event-risk/news sentiment integration

## Validation Gates
Executed:
- `pnpm --dir backend test -- src/services/spx/__tests__/atrService.test.ts` ✅
- `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts` ✅
- `pnpm exec eslint --no-warn-ignored backend/src/services/spx/atrService.ts backend/src/services/spx/__tests__/atrService.test.ts backend/src/services/spx/setupDetector.ts backend/src/lib/symbols.ts backend/src/config/env.ts` ✅
- `pnpm --dir backend exec tsc --noEmit` ⚠️ (blocked by pre-existing unrelated backend issues in `calendarService.ts` and `vwapService.ts`; no new slice-specific type errors remain)

## Risks
- ATR stop-floor is now available in setup logic and defaults enabled via env parser in detector (`SPX_SETUP_ATR_STOP_FLOOR_ENABLED=true` default in detector code path); calibration will require replay tuning before broad rollout.
- Volatility stream symbol expansion depends on provider entitlement and symbol validity in production.

## Rollback
Revert the touched files above and rerun:
- `pnpm --dir backend test -- src/services/spx/__tests__/atrService.test.ts`
- `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts`

## Next Slice
Phase A continuation:
1. Add market environment gate service with deterministic breakdown output.
2. Add gate feature flag and non-breaking detector integration (initially advisory/block-reason only).
3. Add dedicated gate unit tests with mocked market/calendar inputs.
