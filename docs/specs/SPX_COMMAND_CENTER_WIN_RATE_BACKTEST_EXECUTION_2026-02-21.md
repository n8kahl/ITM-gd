# SPX Command Center Win-Rate Backtest Execution

Date: February 21, 2026  
Owner: AI implementation run  
Scope: SPX Command Center setup win-rate (T1/T2) with strict Massive historical replay.

## 1. Discovery (Last 5 Hours Commit Drift)

Reviewed commits:

1. `2dfead2` - Stabilize SPX spatial HUD overlays and coach actions (`2026-02-20 22:11:27 -0600`)
2. `794d90b` - stabilize overlays and suppress ghost alert noise (`2026-02-20 21:16:32 -0600`)
3. `d1040c6` - codify spec-first autonomous delivery (`2026-02-20 20:39:48 -0600`)
4. `7b5905c` - production recovery release packet (`2026-02-20 20:38:06 -0600`)

Conclusion: recent drift is UI/process focused; win-rate trust required backend replay and persistence hardening.

## 2. Implemented Production Changes

### 2.1 Strict canonical source (no source fallback)

File: `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`

1. Backtest now defaults to `spx_setup_instances`.
2. No automatic fallback to legacy tracked setups when instances are empty.
3. Source override remains explicit: `source=legacy` only if requested.

### 2.2 Strict high-fidelity bar resolution

Files:

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`
2. `/Users/natekahl/ITM-gd/backend/src/routes/spx.ts`
3. `/Users/natekahl/ITM-gd/backend/src/scripts/spxBacktestLastWeek.ts`

Changes:

1. Default backtest resolution is now `second`.
2. `usedMassiveMinuteBars` is now a true boolean reflecting actual fallback usage.
3. `resolution=auto` still exists but is opt-in.

### 2.3 Fuller Massive options snapshot pagination

File: `/Users/natekahl/ITM-gd/backend/src/config/massive.ts`

1. Removed low hard cap (`5 pages`) for options snapshot pagination.
2. Added configurable ceiling: `MASSIVE_OPTIONS_SNAPSHOT_MAX_PAGES` (default `200`, capped at `1000`).
3. Applied to both live and `as_of` snapshot fetch paths.

### 2.4 Historical setup reconstruction upgraded

File: `/Users/natekahl/ITM-gd/backend/src/services/spx/historicalReconstruction.ts`

1. Backfill now purges existing `spx_setup_instances` rows in-range before replay (deterministic reruns).
2. Replays minute-by-minute through each session (instead of single first-bar generation).
3. Carries `previousSetups` lifecycle state across bars.
4. Uses Massive historical data for:
   1. SPX/SPY minute bars
   2. SPX/SPY options snapshots with `as_of`
   3. Intervalized options contract minute bars for historical flow reconstruction (top premium/volume contracts)
5. Persists once per day after replay (performance-safe), via `persistForWinRate: false` during intraday loop.

Supporting detector change:

File: `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`

1. Added `persistForWinRate?: boolean` option (default `true`).

## 3. Validation Gates

Executed:

1. `pnpm --dir backend build` ✅
2. `pnpm --dir backend test -- src/services/spx/__tests__/winRateBacktest.test.ts` ✅
3. `pnpm --dir backend test -- src/__tests__/integration/spx-api.test.ts` ✅

## 4. Last-Week Backfill + Backtest (Strict)

### 4.1 Backfill command

`LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20`

Result:

1. attemptedDays: `5`
2. successfulDays: `5`
3. failedDays: `0`
4. runtime: `44.42s`

### 4.2 Backtest command

`LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`

Date range:

1. from: `2026-02-16`
2. to: `2026-02-20`

Result:

1. sourceUsed: `spx_setup_instances`
2. setupCount: `32`
3. evaluatedSetupCount: `32`
4. triggeredCount: `6`
5. resolvedCount: `6`
6. t1Wins: `1`
7. t2Wins: `1`
8. stopsBeforeT1: `4`
9. t1WinRatePct: `16.67`
10. t2WinRatePct: `16.67`
11. failureRatePct: `66.67`
12. resolutionUsed: `second`
13. usedMassiveMinuteBars: `false`

## 5. Answer: Is this using Massive historical bars for real win rate?

Yes.

Current strict run uses:

1. Massive SPX 1-second historical bars for entry/stop/target outcome replay.
2. Massive historical options snapshots (`as_of`) for historical setup reconstruction inputs.
3. Canonical setup rows in `spx_setup_instances` as replay population.

## 6. Most Accurate Current Approach

Use this sequence:

1. `spx:backfill-historical <from> <to>`
2. `backtest:last-week instances second` (or equivalent date-range API call with `source=instances&resolution=second`)

This is now the highest-fidelity path implemented in repo without introducing tick-level options flow reconstruction.

## 7. Optimization + Maintenance Recommendations

1. Keep `resolution=second` as production default for win-rate reporting.
2. Schedule nightly historical replay for only the just-finished session, and weekly full audit replay.
3. Add confidence intervals and minimum sample-size warnings (`N < 30`) to reporting surfaces.
4. Add drift alerts when 5-day T1/T2 rates deviate from 20-day baseline by threshold.
5. Persist replay run metadata (hash/version/config) for audit reproducibility.

## 8. Remaining Accuracy Limits

1. Historical options reconstruction is intervalized from contract minute bars plus snapshots, not full options tick tape replay.
2. Intrabar sequence still relies on bar-path assumptions (now at 1-second resolution, which materially reduces ambiguity).
3. Historical fib parity is now date-scoped in reconstruction; remaining gap is options-flow intraday fidelity, not fib level parity.

## 9. Production Hardening Update (Second Pass)

### 9.1 New parity/persistence upgrades

Files:

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/historicalReconstruction.ts`
3. `/Users/natekahl/ITM-gd/backend/src/services/spx/outcomeTracker.ts`
4. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`

Changes:

1. Removed future-flow lookahead in setup detection (`event_ts <= evaluation_ts` required).
2. Preserved `triggeredAt` lifecycle continuity instead of clearing on demotion.
3. Historical reconstruction now uses time-sliced intraday inputs per bar:
   1. flow events only up to the active bar timestamp
   2. intraday fib levels rebuilt from bars seen so far and merged with higher-timeframe references
4. Backfill now runs strict replay per session and persists triggered/outcome fields into `spx_setup_instances`.
5. Added schema-cache-safe fallback for optional profitability columns so outcome persistence does not fail when columns are absent.
6. Strict backtest replay no longer trusts previously persisted `triggered_at`; it re-derives trigger/outcome from historical bars for deterministic reruns.

### 9.2 Execution-quality profitability model

File:

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`

Adds:

1. Configurable execution model (`entry/target/stop slippage`, `commission R`, `partial at T1`, `move stop to breakeven`).
2. Profitability block in response:
   1. `averageRealizedR`
   2. `medianRealizedR`
   3. `cumulativeRealizedR`
   4. `expectancyR`
   5. `positiveRealizedRatePct`
   6. `bySetupType` realized-R breakdown

### 9.3 Latest strict replay results (after hardening rerun)

Range:

1. `2026-02-16` to `2026-02-20`

Backtest:

1. source: `spx_setup_instances`
2. resolution: `second`
3. usedMassiveMinuteBars: `false`
4. triggered: `9`
5. resolved: `9`
6. T1 win rate: `33.33%`
7. T2 win rate: `0.00%`
8. failure rate: `66.67%`
9. profitability expectancy: `0.1355 R`

Persistence parity check:

1. `spx_setup_instances.triggered_at` count: `9`
2. `spx_setup_instances.final_outcome` count: `9`
3. `GET /analytics/win-rate` now matches persisted historical outcomes for the same range.
