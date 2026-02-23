# Phase 14 — Slice P14-S11: Expand Geometry Sweep to 7 Families

## Date: 2026-02-23

## Objective

Add `trend_continuation`, `breakout_vacuum`, and `flip_reclaim` to the geometry sweep so all 7 setup types can be optimized.

## Scope

### In Scope
- Expand `SweepFamily` type union to all 7 setup types
- Expand `ALL_SWEEP_FAMILIES` array to 7 entries
- Update `geometryCandidateGrid()` trend classification for new families
- Convert hardcoded result records to dynamic `Object.fromEntries()` pattern
- Update CLI script (`spxSweepGeometry.ts`) for 7-family validation

### Out of Scope
- Direction-aware sweeping (S12-S13)
- Gate changes

## Target Files
- `backend/src/services/spx/geometrySweep.ts` — type, array, grid classification, results
- `backend/src/services/spx/optimizer.ts` — Stage 2 results record
- `backend/src/scripts/spxSweepGeometry.ts` — CLI validation

## Changes

### SweepFamily Type (expanded from 4 to 7)
```typescript
export type SweepFamily =
  | 'fade_at_wall'
  | 'mean_reversion'
  | 'trend_pullback'
  | 'orb_breakout'
  | 'trend_continuation'
  | 'breakout_vacuum'
  | 'flip_reclaim';
```

### Trend Classification
- `trend_continuation` → trend grid
- `breakout_vacuum` → trend grid
- `flip_reclaim` → non-trend grid

### Results Initialization
Changed from hardcoded 4-entry record to:
```typescript
Object.fromEntries(ALL_SWEEP_FAMILIES.map(f => [f, null]))
```

## Risks & Rollback
- **Risk**: New families may have insufficient samples. **Mitigation**: Sweep auto-skips families with <8 triggered setups.
- **Rollback**: Revert `ALL_SWEEP_FAMILIES` to original 4 entries.

## Validation Gates
```
pnpm --dir backend exec tsc --noEmit   → PASS (0 errors)
pnpm --dir backend exec jest src/services/spx/__tests__/ --no-coverage → 71/71 PASS
```

## Status: COMPLETE
