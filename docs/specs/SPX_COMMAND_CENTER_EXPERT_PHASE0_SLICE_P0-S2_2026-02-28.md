# SPX Command Center Expert — Phase 0 Slice P0-S2
Date: 2026-02-28
Slice: `P0-S2` (Session 2)
Status: Completed
Owner: Codex
Baseline Commit: `b7fd209`

## 1. Slice Objective
Create the Expert Trade Stream selector contract and fixture payload set with deterministic lifecycle-order assertions, then validate the contract with targeted Playwright tests.

## 2. Scope
1. Define explicit Expert Trade Stream selector IDs and lifecycle ordering rules.
2. Add fixture payload set for unordered, expected-ordered, and empty trade-stream snapshots.
3. Add Playwright contract coverage for selector fixture integrity and lifecycle-order enforcement.
4. Expose mocked `/api/spx/trade-stream` payload contract in SPX E2E mocks.

## 3. Out of Scope
1. Frontend Trade Stream UI implementation.
2. Backend `/api/spx/trade-stream` production route implementation.
3. Coach facts-rail or action-strip simplification work.

## 4. Files Touched
1. `docs/specs/SPX_COMMAND_CENTER_EXPERT_TRADE_STREAM_SELECTOR_CONTRACT_2026-02-28.md`
2. `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE0_SLICE_P0-S2_2026-02-28.md`
3. `e2e/fixtures/spx-trade-stream/selector-contract.json`
4. `e2e/fixtures/spx-trade-stream/trade-stream.unordered.json`
5. `e2e/fixtures/spx-trade-stream/trade-stream.expected-ordered.json`
6. `e2e/fixtures/spx-trade-stream/trade-stream.empty.json`
7. `e2e/helpers/spx-trade-stream-contract.ts`
8. `e2e/helpers/spx-mocks.ts`
9. `e2e/spx-trade-stream-contract.spec.ts`

## 5. Deliverables
1. Human-readable Expert Trade Stream selector contract doc.
2. Canonical fixture payload set for lifecycle ordering and now-focus assertions.
3. Reusable helper utilities for fixture loading, deterministic sort, counts, and now-focus selection.
4. Targeted Playwright contract suite for selector and lifecycle-order coverage.

## 6. Validation Gates

### 6.1 Planned commands
```bash
pnpm playwright test e2e/spx-trade-stream-contract.spec.ts --project=chromium --workers=1
```

### 6.2 Results
1. `pnpm playwright test e2e/spx-trade-stream-contract.spec.ts --project=chromium --workers=1`: pass (`3 passed`)
2. `pnpm exec playwright test e2e/spx-trade-stream-contract.spec.ts --project=chromium --workers=1`: pass (`4 passed`) after now-focus tie-break guard addition.
2. Executed assertions:
   - Selector fixture uniqueness and lifecycle-group completeness.
   - Lifecycle sort contract from unordered fixture to expected ordered fixture.
   - Mocked `/api/spx/trade-stream` response ordering, counts, and `nowFocusItemId` contract.
   - Cross-lifecycle urgency tie for now-focus does not use lifecycle rank as tie-break.
3. Runtime notes captured during execution:
   - Node engine warning: package wants `>=22.0.0`, local run used `v20.19.5`.
   - Existing external data entitlement warnings (`NOT_AUTHORIZED`) were present in startup logs but did not affect contract tests.

### 6.3 Independent QA Session 2 Evidence (2026-02-28)
```bash
$ node -v
v20.19.5

$ pnpm exec eslint /Users/natekahl/ITM-gd/e2e/helpers/spx-trade-stream-contract.ts /Users/natekahl/ITM-gd/e2e/helpers/spx-mocks.ts /Users/natekahl/ITM-gd/e2e/spx-trade-stream-contract.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ pnpm exec playwright test e2e/spx-trade-stream-contract.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:9320) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:9347) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:9367) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:04:05.741Z","error":{"status":"NOT_AUTHORIZED","request_id":"46b14e4e85f1e38cf2a69ddc23a61f25","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:04:05.753Z","error":{"status":"NOT_AUTHORIZED","request_id":"08aee480aa7e57a3bdab2b6720293ffe","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T03:04:05.753Z","error":"Real-time data unavailable"}
Running 4 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-trade-stream-contract.spec.ts:15:7 › SPX Expert Trade Stream contract › selector contract fixture is deterministic and complete (10ms)
  ✓  2 [chromium] › e2e/spx-trade-stream-contract.spec.ts:34:7 › SPX Expert Trade Stream contract › fixture payload order contract enforces lifecycle and now-focus rules (2ms)
  ✓  3 [chromium] › e2e/spx-trade-stream-contract.spec.ts:48:7 › SPX Expert Trade Stream contract › now-focus tie-break does not prioritize lifecycle rank (1ms)
  ✓  4 [chromium] › e2e/spx-trade-stream-contract.spec.ts:68:7 › SPX Expert Trade Stream contract › mocked trade-stream endpoint returns lifecycle-ordered payload (1.3s)
  4 passed (8.4s)

$ pnpm playwright test e2e/spx-trade-stream-contract.spec.ts
WARN Unsupported engine: wanted: {"node":">=22.0.0"} (current: {"node":"v20.19.5","pnpm":"10.29.1"})
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:9395) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:9400) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:9421) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
Running 4 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-trade-stream-contract.spec.ts:15:7 › SPX Expert Trade Stream contract › selector contract fixture is deterministic and complete (9ms)
  ✓  2 [chromium] › e2e/spx-trade-stream-contract.spec.ts:34:7 › SPX Expert Trade Stream contract › fixture payload order contract enforces lifecycle and now-focus rules (2ms)
  ✓  3 [chromium] › e2e/spx-trade-stream-contract.spec.ts:48:7 › SPX Expert Trade Stream contract › now-focus tie-break does not prioritize lifecycle rank (2ms)
  ✓  4 [chromium] › e2e/spx-trade-stream-contract.spec.ts:68:7 › SPX Expert Trade Stream contract › mocked trade-stream endpoint returns lifecycle-ordered payload (1.2s)
  4 passed (8.1s)
```

## 7. Risks and Notes
1. Local gate evidence remains on Node `v20.19.5`; release evidence must be re-run under Node `>=22`.
2. Selector contract is now frozen in fixtures/docs; future UI implementation must map 1:1 to these IDs to avoid E2E contract drift.
3. Mock `/api/spx/trade-stream` now returns ordered contract payloads, but production route behavior is still pending Phase 1.

## 8. Rollback
Revert the P0-S2 artifacts:
1. Remove `docs/specs/SPX_COMMAND_CENTER_EXPERT_TRADE_STREAM_SELECTOR_CONTRACT_2026-02-28.md`.
2. Remove `e2e/fixtures/spx-trade-stream/*`.
3. Revert `e2e/helpers/spx-mocks.ts`.
4. Remove `e2e/helpers/spx-trade-stream-contract.ts` and `e2e/spx-trade-stream-contract.spec.ts`.
5. Remove this slice report.

## 9. Next Slice
`P1-S1`: define `TradeStreamItem` and `TradeStreamSnapshot` types in backend/shared contracts for production route implementation.
