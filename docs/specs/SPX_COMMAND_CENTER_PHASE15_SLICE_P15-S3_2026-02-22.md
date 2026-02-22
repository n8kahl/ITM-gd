# SPX Command Center Phase 15 Slice Report: P15-S3

**Date:** 2026-02-22
**Slice:** P15-S3
**Objective:** Extend volume grace coverage to all trend types and add flat-volume tolerance.
**Status:** Completed

## 1) Scope
In scope:
1. Add `expandedVolumeGraceEligible` for all TREND_SETUP_TYPES with env kill switch.
2. Widen existing time-bounded graces (trend: 240→300 min, ORB: 180→240 min).
3. Wire into volume gate check.

Out of scope:
1. Flow gate changes (S2).
2. ORB-specific gate changes (S4).

## 2) Files Changed
1. `backend/src/services/spx/setupDetector.ts` — Added expanded volume grace, widened time windows.
2. `backend/src/services/spx/__tests__/setupDetector.test.ts` — Added volume grace unit tests.

## 3) Key Changes
1. `expandedVolumeGraceEligible`: `TREND_SETUP_TYPES.has(setupType) AND volumeRegimeAligned=false AND emaAligned AND confluenceScore >= max(3, minConfluenceScore)`.
2. Covers `trend_continuation` and `breakout_vacuum` (previously had NO volume grace).
3. Kill switch: `SPX_VOLUME_GRACE_EXPANDED_ENABLED` (default=true).

## 4) Validation
- `pnpm --dir backend exec tsc --noEmit`: pass
- `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts`: 19/19 pass

## 5) Rollback
Set `SPX_VOLUME_GRACE_EXPANDED_ENABLED=false` or revert code.
