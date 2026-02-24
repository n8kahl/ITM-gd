# SPX Command Center Phase 18 — Phase D Slice 4

Date: 2026-02-23  
Owner: Codex autonomous hardening  
Status: Implemented

## Scope delivered

- Added first-class `stopEngine` module and routed setup stop calculations through it.
- Added first-class `priceActionEngine` module and routed trigger-context generation through it.
- Added missing `spx_level_touches` migration artifact to support persistent touch-history analysis.
- Wired touch-history persistence into `outcomeTracker` with idempotent upserts.

## Changes

### Stop engine modularization and adaptive scaling

- Added `/Users/natekahl/ITM-gd/backend/src/services/spx/stopEngine.ts`
  - `calculateAdaptiveStop()` centralizes stop placement math.
  - `resolveVixStopScale()` supports regime-based widening (`normal/elevated/extreme`).
  - `resolveGEXDirectionalScale()` preserves prior directional GEX behavior.
  - `resolveGEXMagnitudeScale()` adds distance-bucketed GEX scaling.
  - `deriveNearestGEXDistanceBp()` computes nearest wall/flip distance for adaptive scaling.

- Updated `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
  - `applyStopGeometryPolicy()` now delegates to `calculateAdaptiveStop()`.
  - Added wiring for:
    - `vixRegime` from environment gate
    - nearest GEX distance using call wall / put wall / flip point
  - Added feature flags for safe rollout:
    - `SPX_SETUP_VIX_STOP_SCALING_ENABLED` (default `true`)
    - `SPX_SETUP_GEX_MAGNITUDE_STOP_SCALING_ENABLED` (default `true`)

### Price action modularization

- Added `/Users/natekahl/ITM-gd/backend/src/services/spx/priceActionEngine.ts`
  - `detectCandlePattern()`
  - `calculatePenetrationDepth()`
  - `buildTriggerContext()` (latency updates + trigger snapshot)
  - `classifyApproachSpeed()`
  - `isVolumeSpike()`

- Updated `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
  - Trigger context generation now delegates to `priceActionEngine`.
  - Removed duplicated local candle/penetration helpers.

### Schema artifact completion

- Added `/Users/natekahl/ITM-gd/supabase/migrations/20260327020000_add_spx_level_touches_table.sql`
  - Creates `public.spx_level_touches` with:
    - zone and setup-instance linkage
    - outcome and candle-pattern constraints
    - volume/spread metadata
    - session/time indexes for history lookups
    - unique index on `setup_instance_id` for idempotent upsert
  - Enables RLS on the new table.

### Touch persistence integration

- Updated `/Users/natekahl/ITM-gd/backend/src/services/spx/outcomeTracker.ts`
  - `loadTrackedRows()` now fetches `spx_setup_instances.id`.
  - Added `persistLevelTouchRows()` and `toLevelTouchRow()` to write `spx_level_touches`.
  - Upsert key: `setup_instance_id` (one canonical touch record per setup instance).
  - Includes automatic safety fallback:
    - if table is not yet migrated, persistence auto-disables for the process and logs a warning (prevents repeated failures).

## Tests and gates

- `pnpm --dir backend exec tsc --noEmit` ✅
- `pnpm --dir backend exec jest src/services/spx/__tests__/stopEngine.test.ts src/services/spx/__tests__/priceActionEngine.test.ts src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/outcomeTracker.test.ts` ✅
  - 4 suites passed, 25 tests passed.
- `pnpm exec eslint backend/src/services/spx/stopEngine.ts backend/src/services/spx/priceActionEngine.ts backend/src/services/spx/setupDetector.ts backend/src/services/spx/__tests__/stopEngine.test.ts backend/src/services/spx/__tests__/priceActionEngine.test.ts` ⚠️
  - No lint errors; files are currently matched by ignore patterns in the root lint config.

## Notes

- This slice focuses on architecture completeness and testability while preserving existing setup-detector behavior paths.
- New stop-scaling components are feature-flagged and can be toggled immediately if market behavior needs fast rollback.
- Production apply status (2026-02-23):
  - `add_spx_level_touches_table_resilient` applied (fallback-safe FK logic for phased schemas).
  - `spx_fk_covering_indexes_phase18` applied.
  - `spx_level_touches_rls` applied (explicit service-role-only policy).
