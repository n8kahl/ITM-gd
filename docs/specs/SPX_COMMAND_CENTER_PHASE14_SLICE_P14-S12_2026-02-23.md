# Phase 14 — Slice P14-S12: Direction-Aware Sweep Library

## Date: 2026-02-23

## Objective

Enable per-direction (bullish/bearish) geometry optimization by adding a directional sweep wrapper around the existing family sweep.

## Scope

### In Scope
- New types: `SweepDirection`, `DirectionSweepFamilyResult`
- New constant: `MIN_DIRECTION_SAMPLE_SIZE = 5`
- New function: `sweepGeometryForFamiliesDirectional()`
- Per-direction splits with minimum sample threshold

### Out of Scope
- Optimizer integration (S13)
- Profile assembly changes (S13)

## Target Files
- `backend/src/services/spx/geometrySweep.ts` — types, function

## Key Types
```typescript
export type SweepDirection = 'bullish' | 'bearish';

export interface DirectionSweepFamilyResult {
  bullish: SweepFamilyResult | null;
  bearish: SweepFamilyResult | null;
  combined: SweepFamilyResult | null;
}
```

## Algorithm
1. Run undirected sweep per family (reuses existing `sweepGeometryForFamilies()`)
2. Split setups by direction for each family
3. Run per-direction sweep if sample >= MIN_DIRECTION_SAMPLE_SIZE (5)
4. Return combined + per-direction results

## Risks & Rollback
- **Risk**: Direction splits may be too small for meaningful optimization. **Mitigation**: 5-sample minimum; null returned for insufficient data.
- **Rollback**: Revert optimizer to call `sweepGeometryForFamilies()` instead of directional variant.

## Validation Gates
```
pnpm --dir backend exec tsc --noEmit   → PASS (0 errors)
pnpm --dir backend exec jest src/services/spx/__tests__/ --no-coverage → 71/71 PASS
```

## Status: COMPLETE
