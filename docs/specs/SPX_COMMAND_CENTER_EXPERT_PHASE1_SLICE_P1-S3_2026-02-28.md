# SPX Command Center Expert — Phase 1 Slice P1-S3
Date: 2026-02-28
Slice: `P1-S3`
Status: Completed
Owner: Codex

## 1. Slice Objective
Wire backend route `GET /api/spx/trade-stream` to return a canonical `TradeStreamSnapshot` assembled from current SPX snapshot data using existing trade-stream assembly service.

## 2. Scope
1. Add backend route in `backend/src/routes/spx.ts`.
2. Keep route read-only and fail-safe using existing SPX `503` error pattern.
3. Add focused route test coverage in `backend/src/services/spx/__tests__/tradeStreamRoute.test.ts`.
4. No frontend changes and no `/api/spx/snapshot` response-shape changes.

## 3. Files Touched
1. `backend/src/routes/spx.ts`
2. `backend/src/services/spx/__tests__/tradeStreamRoute.test.ts` (new)
3. `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE1_SLICE_P1-S3_2026-02-28.md` (new)

## 4. Implementation Notes
1. Added `GET /trade-stream` route on SPX router (`/api/spx/trade-stream` externally).
2. Route behavior:
   - pulls current SPX snapshot via `getSPXSnapshot({ forceRefresh })`,
   - derives snapshot-level feed trust metadata from snapshot freshness timestamp,
   - assembles payload with `buildTradeStreamSnapshot(...)`,
   - returns deterministic sorted items, `nowFocusItemId`, `countsByLifecycle`, `feedTrust`, and `generatedAt`.
3. Fail-safe behavior:
   - on error, returns `503` with:
     - `error: "Data unavailable"`
     - `message: "Unable to load SPX expert trade stream."`
     - `retryAfter: 10`
4. Existing `/api/spx/snapshot` route contract remains unchanged.

## 5. Validation

### 5.1 Commands
```bash
pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit --strict
pnpm --dir /Users/natekahl/ITM-gd/backend test -- src/services/spx/__tests__/tradeStreamRoute.test.ts
pnpm exec tsc --noEmit
```

### 5.2 Command Outputs
```bash
$ pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit --strict
# (no output; exit 0)
```

```bash
$ pnpm --dir /Users/natekahl/ITM-gd/backend test -- src/services/spx/__tests__/tradeStreamRoute.test.ts
WARN Unsupported engine: wanted: {"node":">=22.0.0"} (current: {"node":"v20.19.5","pnpm":"10.29.1"})

> titm-ai-coach-backend@1.0.0 test /Users/natekahl/ITM-gd/backend
> jest -- src/services/spx/__tests__/tradeStreamRoute.test.ts

PASS src/services/spx/__tests__/tradeStreamRoute.test.ts
  SPX Trade Stream Route
    ✓ GET /api/spx/trade-stream returns deterministic sorted stream contract from snapshot setups (10 ms)
    ✓ returns 503 with retry hint when snapshot retrieval fails (1 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.421 s, estimated 2 s
Ran all test suites matching /src\/services\/spx\/__tests__\/tradeStreamRoute.test.ts/i.
```

```bash
$ pnpm exec tsc --noEmit
# (no output; exit 0)
```

## 6. Risks and Notes
1. Local validation still uses Node `v20.19.5`; package engine warning indicates expected runtime is `>=22.0.0`.
2. Route currently assembles from current snapshot setups only; persisted past/outcome history merge can be expanded in later slices once route-level persistence inputs are finalized.
3. Feed trust staleness threshold is currently fixed at 30s for this route-level trust block.

## 7. Next Slice
`P1-S4`: expand unit coverage for freshness labeling and additional lifecycle edge cases, then begin frontend integration slices.
