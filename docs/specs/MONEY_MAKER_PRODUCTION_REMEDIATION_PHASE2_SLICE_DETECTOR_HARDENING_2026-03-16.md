# Money Maker Production Remediation: Phase 2 Detector Hardening

Date: 2026-03-16
Slice ID: `P2-S2`
Status: Done

## Objective

Bring the live Money Maker setup detector closer to the KCU execution spec by removing placeholder routing inputs and making setup qualification depend on real confluence zones, real completed candles, and real trend context.

## Defects Closed

1. Patience-candle detection was using the raw close price instead of the confluence zone.
2. The detector only checked the newest bar and could miss a setup on the immediately prior completed candle.
3. Advanced VWAP, EMA bounce, fib, and hourly-trend routing depended on hardcoded placeholder flags.
4. The fetch layer did not include `2Min` bars even though the spec requires a 2-minute trading window after the open.

## Scope

- Add detector-context helper functions for:
  - active timeframe rotation
  - completed-bar filtering
  - running VWAP state
  - VWAP reclaim detection
  - previous-day trend detection
  - hourly-trend filtering
  - steep-trend detection
  - trend-strength scoring
  - morning-trend detection
- Add Ripster 34/50 EMA cloud inputs on the afternoon 10-minute chart.
- Wire those helpers into the live snapshot builder.
- Pass confluence zones into patience-candle detection.
- Scan the most recent completed candidate bars instead of only the latest bar.
- Fetch `2Min` bars for the opening window.
- Add deterministic regression tests around the new behavior.

## Out Of Scope

- front-end execution workspace changes
- deployed-environment smoke verification

## Files Changed

- `/Users/natekahl/ITM-gd/backend/src/services/money-maker/detectorContext.ts`
- `/Users/natekahl/ITM-gd/backend/src/services/money-maker/snapshotBuilder.ts`
- `/Users/natekahl/ITM-gd/backend/src/services/money-maker/symbolDataFetcher.ts`
- `/Users/natekahl/ITM-gd/backend/src/services/money-maker/__tests__/detectorContext.test.ts`
- `/Users/natekahl/ITM-gd/backend/src/services/money-maker/__tests__/snapshotBuilder.test.ts`
- `/Users/natekahl/ITM-gd/backend/src/services/money-maker/__tests__/symbolDataFetcher.test.ts`
- `/Users/natekahl/ITM-gd/backend/src/lib/money-maker/patience-candle-detector.ts`
- `/Users/natekahl/ITM-gd/backend/src/lib/money-maker/kcu-strategy-router.ts`
- `/Users/natekahl/ITM-gd/lib/money-maker/patience-candle-detector.ts`
- `/Users/natekahl/ITM-gd/lib/money-maker/kcu-strategy-router.ts`
- `/Users/natekahl/ITM-gd/lib/money-maker/patience-candle-detector.js`
- `/Users/natekahl/ITM-gd/lib/money-maker/kcu-strategy-router.js`

## Tests Added

- `detectorContext` helper suite
- zone-aware patience-candle tests
- router tests for hourly trend gating and Advanced VWAP directionality
- snapshot regression for latest-valid completed bar emission
- snapshot regression for afternoon Ripster cloud inputs
- fetcher regression for `2Min` timeframes

## Tests Run

- `pnpm exec vitest run lib/money-maker/__tests__/patience-candle-detector.test.ts lib/money-maker/__tests__/kcu-strategy-router.test.ts lib/money-maker/__tests__/confluence-detector.test.ts lib/money-maker/__tests__/rr-calculator.test.ts lib/money-maker/__tests__/signal-ranker.test.ts lib/money-maker/__tests__/orb-calculator.test.ts`
  - Result: passed
- `pnpm --dir backend exec jest src/services/money-maker/__tests__/detectorContext.test.ts src/services/money-maker/__tests__/snapshotBuilder.test.ts src/services/money-maker/__tests__/symbolDataFetcher.test.ts --runInBand`
  - Result: passed
- `pnpm exec tsc --noEmit`
  - Result: passed
- `pnpm --dir backend exec tsc --noEmit`
  - Result: passed
- `pnpm exec eslint --no-warn-ignored lib/money-maker/patience-candle-detector.ts lib/money-maker/kcu-strategy-router.ts lib/money-maker/__tests__/patience-candle-detector.test.ts lib/money-maker/__tests__/kcu-strategy-router.test.ts`
  - Result: passed
- `pnpm exec eslint --no-warn-ignored backend/src/services/money-maker/snapshotBuilder.ts backend/src/services/money-maker/symbolDataFetcher.ts backend/src/services/money-maker/detectorContext.ts backend/src/services/money-maker/__tests__/snapshotBuilder.test.ts backend/src/services/money-maker/__tests__/symbolDataFetcher.test.ts backend/src/services/money-maker/__tests__/detectorContext.test.ts backend/src/lib/money-maker/patience-candle-detector.ts backend/src/lib/money-maker/kcu-strategy-router.ts`
  - Result: passed

## Residual Risk

The detector phase is materially cleaner after this slice. The remaining release risk is no longer detector fidelity; it is deployment proof. Post-deploy smoke evidence and deployed-SHA verification are still outside this slice and remain required for a production release claim.

## Rollback

Revert the `P2-S2` detector-helper, snapshot-builder, fetcher, and shared-lib changes as one unit.
