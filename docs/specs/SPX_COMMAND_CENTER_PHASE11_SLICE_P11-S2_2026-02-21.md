# SPX Command Center Phase 11 - Slice P11-S2

Date: 2026-02-21  
Owner: Codex implementation run  
Scope: Setup mix hardening for ranging regime and realistic fade target geometry.

## Objective

Improve SPX win-rate quality by reducing low-quality fade entries and making mean-reversion target/stop geometry more live-realistic.

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`

## Implementation Details

### 1) Ranging setup diversification

Adjusted ranging setup inference to reduce unconditional fallback to `fade_at_wall`:

1. Added explicit `flip_reclaim` preference when near flip without requiring indicator context.
2. Reduced distance threshold for `mean_reversion` promotion.

### 2) Fade-specific quality gate

Added setup-specific gate reasons for `fade_at_wall|ranging`:

1. Block fade when directional flow momentum confirms too strongly (`flowConfirmed=true`).
2. Block fade when alignment is excessively pro-direction (`flowAlignmentPct >= 84`).

### 3) Realistic target/stop geometry for mean-reversion class

Added target tuning function for:

1. `fade_at_wall`
2. `mean_reversion`
3. `flip_reclaim`

Behavior:

1. Widened protective stop buffer for mean-reversion class (`>= 2.25 points`).
2. Rebased T1/T2 using risk-multiple templates instead of distant structural-only targets.
3. Anchored T1 opportunistically to nearby mean references (flip point / EMA / session-open) when directionally valid.
4. Enforced ordered target sanity (`T2` beyond `T1` in direction).

## Validation Gates

Executed:

1. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts` ✅
2. `pnpm --dir backend test -- src/services/spx/__tests__/contractSelector.test.ts` ✅
3. `pnpm --dir backend test -- src/services/setupDetector/__tests__/tradeBuilder.test.ts src/services/positions/__tests__/exitAdvisor.test.ts` ✅
4. `pnpm --dir backend build` ✅

## Strict Massive Backfill + Backtest

Executed:

1. `LOG_LEVEL=warn pnpm --dir backend spx:backfill-historical 2026-02-16 2026-02-20` ✅
2. `LOG_LEVEL=warn pnpm --dir backend backtest:last-week instances second` ✅

### Before (pre P11-S2 baseline)

1. `triggeredCount=9`
2. `T1 win rate=33.33%`
3. `T2 win rate=0.00%`
4. `failure rate=66.67%`
5. `expectancy=+0.1355R`

### After (post P11-S2)

1. `triggeredCount=8`
2. `T1 win rate=50.00%`
3. `T2 win rate=37.50%`
4. `failure rate=37.50%`
5. `expectancy=+0.3564R`

## Notes

1. Strategy type concentration remains `fade_at_wall` for this specific week’s regime realization, but entry quality and target realism materially improved outcomes.
2. Next slice should explicitly promote non-fade setup activation in ranging sessions through additional microstructure/context features and combo-level caps.
