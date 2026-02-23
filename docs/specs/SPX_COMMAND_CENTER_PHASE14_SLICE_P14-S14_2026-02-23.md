# Phase 14 — Slice P14-S14: Regime-Adaptive Partials + Breakeven+ Stop

## Date: 2026-02-23

## Objective

Replace fixed 65% partial at T1 with regime-specific values and convert "move stop to breakeven" into "breakeven + 0.15R" to convert T2 failures into micro-wins.

## Scope

### In Scope
- Regime-adaptive partial override in `resolveTradeManagementForSetup()`
- Breakeven+ stop: runner loss when stop hit after T1 = +0.15R instead of 0R
- `BREAKEVEN_PLUS_OFFSET_R = 0.15` constant

### Out of Scope
- Time-based T2 exit (deferred — requires more complex bar tracking)
- Multi-level partials

## Target Files
- `backend/src/services/spx/setupDetector.ts` — `resolveTradeManagementForSetup()` regime-adaptive partial
- `backend/src/services/spx/winRateBacktest.ts` — `realizedRForOutcome()` breakeven+ stop

## Regime-Adaptive Partials
| Regime | Partial at T1 | Rationale |
|--------|--------------|-----------|
| compression | 0.75 | Limited runway, take more off |
| ranging | 0.70 | Moderate extension |
| trending | 0.55 | Strong momentum, let runner ride |
| breakout | 0.50 | Maximum extension potential |

## Breakeven+ Stop Mechanics
- After T1 hit, stop moves to entry + 0.15R (instead of exact entry)
- If runner stop is hit after T1: realized R = partial_at_T1 + runner_fraction * 0.15R
- This converts ~100% of T2 stop-outs from 0R runner to +0.15R runner

## Expected Impact
+0.10-0.15R expectancy; +2pp effective win rate from breakeven+ stop micro-wins.

## Risks & Rollback
- **Risk**: Breakeven+ stop may cause premature exits in volatile regimes. **Mitigation**: 0.15R offset is small enough to absorb normal noise; only triggers after T1 is already banked.
- **Rollback**: Set `BREAKEVEN_PLUS_OFFSET_R = 0` to revert to exact breakeven.

## Validation Gates
```
pnpm --dir backend exec tsc --noEmit   → PASS (0 errors)
pnpm --dir backend exec jest src/services/spx/__tests__/ --no-coverage → 71/71 PASS
```

## Status: COMPLETE
