# Phase 14 — Slice P14-S16: VWAP Bridge to Optimizer

## Date: 2026-02-23

## Objective

Wire existing VWAP calculator infrastructure into setup gating and confluence scoring to filter against institutional flow.

## Scope

### In Scope
- Import `calculateVWAP` and `analyzeVWAPPosition` from `services/levels/calculators/vwap.ts`
- Add `vwapPrice: number | null` and `vwapDeviation: number | null` to `SetupIndicatorContext`
- Compute VWAP from session bars in `buildIndicatorContextFromBars()`
- VWAP alignment as confluence source in `calculateConfluence()`
- VWAP directional filter gate in `evaluateOptimizationGate()`
- Add VWAP fields to `PreparedOptimizationRow` in optimizer
- Update `buildHistoricalIndicatorContext()` in historical reconstruction

### Out of Scope
- VWAP bands (standard deviation bands around VWAP)
- Anchored VWAP from specific events
- VWAP as sweepable geometry dimension

## Target Files
- `backend/src/services/spx/setupDetector.ts` — VWAP computation, confluence, gate
- `backend/src/services/spx/optimizer.ts` — `PreparedOptimizationRow` fields
- `backend/src/services/spx/historicalReconstruction.ts` — historical indicator context

## VWAP Confluence Source
- Bullish setups: +1 confluence when price >= VWAP
- Bearish setups: +1 confluence when price <= VWAP
- Source label: `vwap_alignment`

## VWAP Directional Gate
- Gate reason: `vwap_direction_misaligned`
- Bullish blocked when: VWAP deviation < -0.15% (price meaningfully below VWAP)
- Bearish blocked when: VWAP deviation > +0.15% (price meaningfully above VWAP)
- Env flag: `SPX_VWAP_GATE_ENABLED` (default: true)
- Tolerance: ±0.15% allows setups near VWAP to pass (avoids over-filtering at VWAP cross)

## PreparedOptimizationRow Extensions
```typescript
vwapPrice: number | null;    // from metadata.vwapPrice
vwapDeviation: number | null; // from metadata.vwapDeviation
```

## Expected Impact
+3-6pp directional win rate from filtering against institutional flow.

## Risks & Rollback
- **Risk**: VWAP filter may reduce sample size for counter-trend strategies (fade_at_wall). **Mitigation**: 0.15% tolerance allows meaningful counter-trend setups near VWAP.
- **Risk**: VWAP may not be meaningful with sparse volume data. **Mitigation**: Returns null when volume is zero; gate is null-safe.
- **Rollback**: Set `SPX_VWAP_GATE_ENABLED=false` to disable VWAP gate.

## Validation Gates
```
pnpm --dir backend exec tsc --noEmit   → PASS (0 errors)
pnpm --dir backend exec jest src/services/spx/__tests__/ --no-coverage → 71/71 PASS
Node v22.22.0 — PASS
pnpm run build — PASS
```

## Status: COMPLETE
