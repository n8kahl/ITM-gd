# Phase 14 — Slice P14-S15: GEX-Adaptive Stop Scaling

## Date: 2026-02-23

## Objective

Adjust stop width based on gamma environment: tighten in positive GEX (dealer hedging creates support), widen for mean-reversion families in negative GEX (overshoots before reverting).

## Scope

### In Scope
- Add `netGex: number | null` to `PreparedOptimizationRow`
- Populate from `metadata.netGex` in `toPreparedRow()`
- GEX-based stop multiplier in `applyStopGeometryPolicy()`
- New constants: `GEX_STOP_TIGHTEN_FACTOR`, `GEX_STOP_WIDEN_FACTOR`, `GEX_MEAN_REVERSION_FAMILIES`

### Out of Scope
- GEX as sweepable dimension (deferred)
- Extreme GEX (>2σ) confluence floor adjustment (deferred)

## Target Files
- `backend/src/services/spx/optimizer.ts` — `PreparedOptimizationRow`, `toPreparedRow()`
- `backend/src/services/spx/setupDetector.ts` — `applyStopGeometryPolicy()` GEX modifier

## GEX Stop Scaling Rules
| GEX State | Stop Adjustment | Rationale |
|-----------|----------------|-----------|
| Positive (>0) | × 0.90 (tighten 10%) | Dealer hedging creates support levels |
| Negative (<0) + mean-reversion family | × 1.10 (widen 10%) | Moves overshoot before reverting |
| Negative (<0) + trend family | × 1.00 (no change) | Trend families benefit from tight stops |
| Zero/null | × 1.00 (no change) | No GEX data, use default |

## Mean-Reversion Families
`fade_at_wall`, `mean_reversion`, `flip_reclaim`

## Risks & Rollback
- **Risk**: GEX data may be stale or missing. **Mitigation**: Null-safe; defaults to 1.0 multiplier when GEX unavailable.
- **Risk**: 10% adjustment may be too aggressive. **Mitigation**: Conservative percentage; stop still within normal range.
- **Rollback**: Set both factors to 1.0 to disable GEX-adaptive stops.

## Validation Gates
```
pnpm --dir backend exec tsc --noEmit   → PASS (0 errors)
pnpm --dir backend exec jest src/services/spx/__tests__/ --no-coverage → 71/71 PASS
```

## Status: COMPLETE
