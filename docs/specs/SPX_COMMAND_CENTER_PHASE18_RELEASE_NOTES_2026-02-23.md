# SPX Command Center Phase 18 Release Notes

Date: 2026-02-23  
Release type: Strategic intelligence upgrade  
Audience: Product, trading operations, engineering

## Summary

Phase 18 upgrades SPX Command Center from static setup scanning to adaptive strategy coaching with market-state gating, richer setup explainability, and improved flow intelligence.

## What shipped

### Strategic setup intelligence

- Weighted confluence model and adaptive threshold behavior.
- Multi-timeframe confluence context included in setup output.
- Adaptive EV model with regime-aware assumptions and slippage.

### Execution clarity improvements

- Trigger context surfaced on setup cards:
  - trigger time
  - latency since trigger
  - candle pattern
  - trigger volume
  - penetration depth
- Price-action trigger analysis is now modularized in `priceActionEngine` for isolated testing and faster rollback.
- Trigger-derived level touch context now persists to `spx_level_touches` for historical quality analysis.

### Standby guidance (no-trade state)

- Standby reason messaging shown directly in setup feed.
- Nearest setup and activation conditions displayed.
- Watch zones and next-check time displayed.

### Flow intelligence

- Flow ticker now surfaces 5m / 15m / 30m windows with:
  - score
  - directional bias
  - institutional count (sweeps + blocks)
- UI consumes canonical backend `flowAggregation` when available, with client fallback logic.

### Stop and risk controls

- Stop placement pipeline is now modularized in `stopEngine`.
- Adaptive stop logic now supports:
  - VIX regime scaling
  - directional GEX scaling
  - GEX-distance magnitude scaling
  - ATR floor enforcement
- New stop scaling flags:
  - `SPX_SETUP_VIX_STOP_SCALING_ENABLED`
  - `SPX_SETUP_GEX_MAGNITUDE_STOP_SCALING_ENABLED`

### Risk/event intelligence backend

- News sentiment aggregation service implemented.
- Event risk gate integrated into environment gate and standby reasoning.

## Quality gates executed

- Type checks passed (frontend + backend).
- Targeted SPX unit/integration tests passed.
- SPX E2E suite passed: `30/30`.
- Frontend build passed.
- Backend build passed.
- Weekly optimizer scan passed (baseline retained due promotion guardrails).

## Notable metrics from optimizer weekly run

- Validation objective delta: `+1.11`
- Validation conservative objective delta: `+0.69`
- Validation expectancy delta: `+0.0792R`
- `optimizationApplied=false` (guardrails prevented automatic promotion)

## Known limitations / follow-ups

- Node runtime target mismatch in local env (`package.json` requires `>=22`, local run was `v20.19.5`).
- `spx_level_touches` migration exists in repo and must be applied during deployment:
  - `20260327020000_add_spx_level_touches_table.sql`
- Service-role-only RLS policy migration applied:
  - `spx_level_touches_rls`
- Supabase advisors report pre-existing RLS/function/index policy debt that should be prioritized separately.

## Compatibility

- Backward compatible for snapshots missing optional new fields.
- New UI panels render conditionally when data is present.

## Rollout recommendation

- Enable feature flags in staged order (observe -> score -> gate).
- Monitor standby frequency, snapshot health, and flow freshness during first live session.
