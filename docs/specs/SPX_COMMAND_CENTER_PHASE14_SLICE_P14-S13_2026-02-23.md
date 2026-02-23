# Phase 14 — Slice P14-S13: Direction-Aware Optimizer Integration

## Date: 2026-02-23

## Objective

Wire direction-aware geometry sweep into Stage 2 optimizer, profile assembly, scorecard notes, and backtest geometry resolution chain.

## Scope

### In Scope
- Stage 2 calls `sweepGeometryForFamiliesDirectional()` instead of `sweepGeometryForFamilies()`
- Extend `SPXGeometrySweepSummary.perFamily` with `byDirection?` breakdown
- Profile assembly writes direction-qualified keys (e.g., `fade_at_wall_bullish`)
- Geometry resolution chain with direction-qualified key priority
- Scorecard notes include per-direction deltas

### Out of Scope
- New geometry candidate dimensions
- Gate changes

## Target Files
- `backend/src/services/spx/optimizer.ts` — Stage 2, profile assembly, scorecard
- `backend/src/services/spx/winRateBacktest.ts` — geometry resolution chain

## Direction-Qualified Key Resolution Chain
```
{type}_{direction}|{regime}|{bucket}
→ {type}_{direction}|{regime}
→ {type}_{direction}|{bucket}
→ {type}_{direction}
→ {type}|{regime}|{bucket}
→ {type}|{regime}
→ {type}|{bucket}
→ {type}
```

Direction-qualified keys take precedence, falling back to undirected keys when direction-specific data is unavailable.

## New Interfaces
```typescript
interface GeometrySweepWinningConfig {
  label: string;
  target1Scale: number;
  target2Scale: number;
  stopScale: number;
  partialAtT1Pct: number;
}

interface GeometrySweepDirectionData {
  improved: boolean;
  config: GeometrySweepWinningConfig | null;
  delta: { objectiveConservative: number; expectancyR: number } | null;
  sampleSize: number;
}
```

## Risks & Rollback
- **Risk**: Direction-qualified keys may fragment optimization data too thinly. **Mitigation**: Falls back through 8-key chain to undirected geometry when direction data is unavailable.
- **Rollback**: Revert to `sweepGeometryForFamilies()` in Stage 2; remove direction keys from profile.

## Validation Gates
```
pnpm --dir backend exec tsc --noEmit   → PASS (0 errors)
pnpm --dir backend exec jest src/services/spx/__tests__/ --no-coverage → 71/71 PASS
```

## Status: COMPLETE
