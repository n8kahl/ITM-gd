# SPX Market-Open E2E Test Plan

Date: 2026-02-23
Target session: Tuesday, 2026-02-24 (US market open)
Scope: setup detection, confluence gating, trade management, optimizer governance, live feed readiness.

## 1. Inspection Summary (Executed 2026-02-23)

### 1.1 Passed static/build gates
1. `pnpm --dir backend exec tsc --noEmit` -> pass.
2. `pnpm --dir backend build` -> pass.
3. `pnpm exec tsc --noEmit` (repo root) -> pass.

### 1.2 Passed setup/confluence/trade-management suites
1. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/contractSelector.test.ts src/services/spx/__tests__/tickEvaluator.test.ts src/services/spx/__tests__/executionCoach.test.ts src/services/spx/__tests__/outcomeTracker.test.ts src/services/spx/__tests__/microbarAggregator.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts src/services/spx/__tests__/winRateBacktest.test.ts --runInBand` -> pass.
2. `pnpm --dir backend test -- src/services/setupDetector/__tests__/detectors.test.ts src/services/setupDetector/__tests__/service.test.ts src/services/setupDetector/__tests__/indexSpecific.test.ts src/services/setupDetector/__tests__/vwap.test.ts src/services/setupDetector/__tests__/volumeClimax.test.ts src/services/setupDetector/__tests__/tradeBuilder.test.ts src/services/setupDetector/__tests__/gammaSqueeze.test.ts src/services/setupDetector/__tests__/levelTest.test.ts --runInBand` -> pass.
3. `pnpm --dir backend test -- src/services/positions/__tests__/exitAdvisor.test.ts src/services/positions/__tests__/brokerLedgerReconciliation.test.ts src/services/__tests__/setupPushChannel.test.ts src/services/__tests__/positionPushChannel.test.ts src/services/__tests__/websocket.test.ts src/services/__tests__/websocket.authz.test.ts --runInBand` -> pass.
4. `pnpm --dir backend test -- src/__tests__/integration/spx-websocket.test.ts src/__tests__/integration/spx-coach-stream.test.ts src/workers/__tests__/setupPushWorker.test.ts --runInBand` -> pass.

### 1.3 Replay/optimizer verification
1. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second` -> pass.
2. Replay output:
   - `setupCount=22`
   - `triggeredCount=17`
   - `t1WinRatePct=76.47`
   - `t2WinRatePct=70.59`
   - `failureRatePct=17.65`
   - `usedMassiveMinuteBars=false`
3. `LOG_LEVEL=warn pnpm --dir backend exec tsx src/scripts/spxFailureAttribution.ts 2026-02-16 2026-02-20` -> pass.
4. `LOG_LEVEL=warn pnpm --dir backend spx:optimizer-weekly` -> pass (`optimizationApplied=false`, baseline retained, governance active).

### 1.4 Failing suites/gaps discovered
1. Full backend test run currently fails: `pnpm --dir backend test --runInBand`.
2. Failures:
   - `backend/src/__tests__/integration/spx-api.test.ts` (stale imports/types vs current optimizer API).
   - `backend/src/workers/__tests__/spxOptimizerWorker.test.ts` (env-coupled expectation mismatch when nightly worker disabled).
   - `backend/src/services/spx/__tests__/regimeClassifier.test.ts` (test expects no minute-bar fetch with provided trend inputs; implementation currently still fetches session bars).
3. Operational caveat: `spx:backfill-historical 2026-02-16 2026-02-20` was slow/non-deterministic in this shell session (intermittent VWAP zero-volume warnings). Treat backfill completion confirmation as mandatory before using new backfill output.

## 2. Gold-Standard Promotion Gates (Must Hold)

1. Throughput: `triggeredCount >= 10` and at least 2 triggered setup families.
2. Quality:
   - `T1 >= 76.47%`
   - `T2 >= 70.59%`
   - `failureRate <= 17.65%`
   - `expectancyR >= +1.128`
3. Fidelity: `usedMassiveMinuteBars=false`.
4. Trade management policy in active profile:
   - `partialAtT1Pct=0.65`
   - `moveStopToBreakeven=true`

## 3. Market-Open Test Procedure (2026-02-24)

### 3.1 09:15-09:25 ET pre-open checks
1. Confirm env and process flags:
   - `MASSIVE_API_KEY` present.
   - `MASSIVE_TICK_WS_ENABLED=true` for live tick ingestion.
   - `SPX_SETUP_LIFECYCLE_ENABLED=true`.
   - `SPX_SETUP_TRANSITION_TELEMETRY_ENABLED=true`.
2. Start/restart backend and verify:
   - `/health/detailed` returns `massive_tick_stream` status `pass` once market data is flowing.

### 3.2 09:30-10:15 ET live E2E checks
1. Feed + tick freshness:
   - Verify `massive_tick_stream` connected and tick age under 15s.
   - Confirm websocket price packets source is `tick` (not poll-only) for SPX/SPY.
2. Setup detection and confluence:
   - At least one setup appears in `setups:update` during first 45 minutes.
   - For each new setup, confirm confluence fields are present (`confluenceScore`, `confluenceSources`, `regime`, `probability`).
   - Validate blocked setup reasons are explicit when filtered (flow/timing/volume/confluence floors).
3. Lifecycle and execution coaching:
   - Confirm transition chain emits deterministically: `ready -> triggered -> target1_hit/invalidated -> target2_hit` as applicable.
   - Confirm `coach:message` includes structured execution directives for transitions (`ENTER`, `TAKE_PARTIAL`, `MOVE_STOP`, `EXIT`).
4. Trade-management behavior:
   - On `target1_hit`, verify partial sizing guidance is 65% and runner stop policy is breakeven.
   - Verify stop/target transitions are persisted for win-rate tracking.

### 3.3 12:00 ET intraday governance checkpoint
1. Run:
   - `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`
2. Ensure no regression from gold baseline in `T1/T2/failure` and fidelity (`usedMassiveMinuteBars=false`).
3. Run:
   - `LOG_LEVEL=warn pnpm --dir backend spx:optimizer-weekly`
4. Confirm optimizer remains fail-closed (no unsafe promotion) and reports confidence/governance metrics.

## 4. Go/No-Go Criteria For This Session

Go:
1. Live tick stream connected/fresh during market hours.
2. Deterministic setup lifecycle and execution directives observed in live channels.
3. No contradictory trade-management actions (partial/stop/final exit logic coherent).
4. Replay KPI and fidelity remain at/near gold thresholds.

No-Go:
1. Tick stream stale/disconnected for sustained market-open period.
2. Setup transitions missing or unordered.
3. Coach directives not tied to transitions.
4. KPI drop below gold thresholds without an explained data-quality event.
