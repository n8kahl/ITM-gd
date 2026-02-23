# Phase 14 — Slice P14-S9: Strategy Gate Recalibration

## Date: 2026-02-23

## Objective

Unblock breakout_vacuum (0% trigger rate due to unreachable gates) and tighten trend_pullback (38.71% failure rate — highest among active families).

## Scope

### In Scope
- Relax breakout_vacuum gate floors to achievable thresholds
- Tighten trend_pullback pWin floor from 0.58 to 0.62
- ORB EMA grace for first 30 minutes (moved from S8 planning into S9)

### Out of Scope
- Geometry sweep changes
- New gate types

## Target Files
- `backend/src/services/spx/setupDetector.ts` — `SETUP_SPECIFIC_GATE_FLOORS` constant values

## Changes

### breakout_vacuum gate floors (relaxed)
| Parameter | Before | After |
|-----------|--------|-------|
| minConfluenceScore | 5 | 4 |
| minPWinCalibrated | 0.70 | 0.62 |
| minEvR | 0.40 | 0.28 |
| minAlignmentPct | 60 | 55 |

### trend_pullback gate floors (tightened)
| Parameter | Before | After |
|-----------|--------|-------|
| minPWinCalibrated | 0.58 | 0.62 |

## Risks & Rollback
- **Risk**: breakout_vacuum relaxation may admit marginal setups. **Mitigation**: Still higher bar than most families; floor of 4 confluence and 0.62 pWin is top quartile.
- **Risk**: trend_pullback tightening may reduce sample size. **Mitigation**: Aligns with fade_at_wall floor; filters worst 10% of entries.
- **Rollback**: Revert SETUP_SPECIFIC_GATE_FLOORS values to prior constants.

## Validation Gates
```
pnpm --dir backend exec tsc --noEmit   → PASS (0 errors)
pnpm --dir backend exec jest src/services/spx/__tests__/ --no-coverage → 71/71 PASS
```

## Status: COMPLETE
