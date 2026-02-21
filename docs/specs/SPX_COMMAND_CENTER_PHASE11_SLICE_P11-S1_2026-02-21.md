# SPX Command Center Phase 11 - Slice P11-S1

Date: 2026-02-21  
Owner: Codex implementation run  
Scope: Contract selection quality, R:R enforcement, and mechanical exit management.

## Objective

Implement production-grade upgrades for:

1. Regime-aware contract selection (including late-day 0DTE rollover to 1DTE).
2. Trade suggestion R:R enforcement with feasibility gate.
3. Mechanical exit framework (1R/2R scaling plus trailing stop guidance).

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/contractSelector.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/__tests__/contractSelector.test.ts`
3. `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/tradeBuilder.ts`
4. `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/types.ts`
5. `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/__tests__/tradeBuilder.test.ts`
6. `/Users/natekahl/ITM-gd/backend/src/services/positions/exitAdvisor.ts`
7. `/Users/natekahl/ITM-gd/backend/src/services/positions/__tests__/exitAdvisor.test.ts`

## Implementation Summary

### 1) Contract selector hardening

1. Added regime-aware delta targeting (higher delta in ranging/compression, lower in breakout/trending momentum setups).
2. Added strict quote-quality gates (absolute spread caps by premium bucket and bid/ask balance floor).
3. Added hard 0DTE rollover behavior after ET cutoff (`13:30 ET`) by resolving a forward expiry using Massive expirations.
4. Added terminal 0DTE block in candidate filtering after cutoff.
5. Tightened strict spread threshold and shifted max-risk debit estimate to `ask` for conservative risk.

### 2) Trade suggestion R:R gate

1. Added minimum R:R enforcement (`minRiskReward`, default `2.0`) in `buildTradeSuggestion`.
2. Added feasibility ceiling (`maxFeasibleMove` / ATR-range proxy cap) and reject path when required reward is unrealistic.
3. Added metadata outputs: `riskReward` and `rrQualified`.

### 3) Exit advisor mechanics

1. Added R-multiple framework (`riskUnit` estimation + realized `R`).
2. Added mechanical scale-out advice:
   1. `>=1R`: first scale.
   2. `>=2R`: larger scale with runner.
3. Added trailing stop logic with tighter runner trail after 2R.
4. Preserved pre-1R positive-PnL protective stop guidance for compatibility.

## Validation Gates

Executed:

1. `pnpm --dir backend test -- src/services/spx/__tests__/contractSelector.test.ts` ✅
2. `pnpm --dir backend test -- src/services/setupDetector/__tests__/tradeBuilder.test.ts` ✅
3. `pnpm --dir backend test -- src/services/positions/__tests__/exitAdvisor.test.ts` ✅
4. `pnpm --dir backend test -- src/services/setupDetector/__tests__/detectors.test.ts src/services/setupDetector/__tests__/levelTest.test.ts` ✅
5. `pnpm --dir backend build` ✅

## Backtest (Strict Massive Path)

Executed:

1. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second`

Result (2026-02-16 to 2026-02-20):

1. `sourceUsed=spx_setup_instances`
2. `resolutionUsed=second`
3. `usedMassiveMinuteBars=false`
4. `triggeredCount=9`
5. `t1WinRatePct=33.33`
6. `t2WinRatePct=0.00`
7. `failureRatePct=66.67`
8. `expectancyR=0.1355`

## Notes

1. This slice upgrades execution quality and signal gating mechanics; it does not by itself diversify setup-type mix in the historical sample window (still dominated by `fade_at_wall`), so last-week win-rate headline remained unchanged.
2. Next optimization slice should target setup-generation mix and gate thresholds in `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts` to materially move T1/T2 rates.
