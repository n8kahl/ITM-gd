# Phase 14 — Slice P14-S10: Time-Bucket Expansion (3→5 Buckets + Late-Session Geometry)

## Date: 2026-02-23

## Objective

Expand from 3 to 5 geometry time buckets to enable finer-grained geometry compression in afternoon/close sessions, recovering T2 win rate.

## Scope

### In Scope
- Expand `toGeometryBucket()` from 3 buckets to 5
- Add `GeometryBucket` type alias
- Expand `DEFAULT_GEOMETRY_BY_SETUP_REGIME_TIME_BUCKET` with entries for all 5 buckets
- Late-session geometry compression (afternoon: T2 scale 0.80, close: T2 disabled for trend families)

### Out of Scope
- Geometry sweep integration (handled in S11-S13)
- New gate types

## Target Files
- `backend/src/services/spx/winRateBacktest.ts` — `toGeometryBucket()`, `GeometryBucket` type
- `backend/src/services/spx/optimizer.ts` — `DEFAULT_GEOMETRY_BY_SETUP_REGIME_TIME_BUCKET`, `DEFAULT_MAX_FIRST_SEEN_MINUTE_BY_SETUP_TYPE`

## Bucket Definitions
| Bucket | Minutes Since Open | Purpose |
|--------|-------------------|---------|
| early_open | 0-30 | Pre-ORB, highest momentum |
| opening | 31-90 | ORB active window |
| midday | 91-240 | Sweet spot, balanced T1/T2 |
| afternoon | 241-330 | T2 degradation zone |
| close | 331+ | Final hour, scalp-only |

## Default Geometry Overrides
- **early_open**: Widen T2 (target2Scale: 1.15), standard stop
- **afternoon**: Compress T2 (target2Scale: 0.80), increase partial to 80%
- **close**: T2 disabled for trend/breakout families (target2Scale: 0, partialAtT1Pct: 1.0)

## Expected Impact
+3-5pp T2 win rate in afternoon/close; +0.08-0.12R expectancy.

## Risks & Rollback
- **Risk**: 5-bucket split thins per-bucket sample sizes. **Mitigation**: Geometry sweep auto-skips families with <8 samples.
- **Rollback**: Revert `toGeometryBucket()` to 3-bucket function.

## Validation Gates
```
pnpm --dir backend exec tsc --noEmit   → PASS (0 errors)
pnpm --dir backend exec jest src/services/spx/__tests__/ --no-coverage → 71/71 PASS
```

## Status: COMPLETE
