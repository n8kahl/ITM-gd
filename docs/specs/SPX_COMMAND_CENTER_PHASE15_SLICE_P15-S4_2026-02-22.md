# SPX Command Center Phase 15 Slice Report: P15-S4

**Date:** 2026-02-22
**Slice:** P15-S4
**Objective:** Make ORB setups achievable in replay with alternative confirmation when flow data is sparse.
**Status:** Completed

## 1) Scope
In scope:
1. Add `orbSparseFlowGrace` for ORB setups when no directional flow sample and flow unavailable.
2. Lower ORB flow quality score from 52 to 45 when `flowAvailability === 'sparse'`.
3. Wire into ORB-specific gate block.

Out of scope:
1. Flow/volume gate changes for non-ORB types (S2, S3).
2. Optimizer parity (S5).

## 2) Files Changed
1. `backend/src/services/spx/setupDetector.ts` — Added ORB sparse-flow grace, lowered quality threshold for sparse availability.
2. `backend/src/services/spx/__tests__/setupDetector.test.ts` — Added ORB grace unit tests.

## 3) Key Changes
1. `orbSparseFlowGrace`: `!hasDirectionalFlowSample AND flowAvailability !== 'available' AND emaAligned AND confluenceScore >= 3`.
2. Effective ORB flow quality score: 45 when sparse (vs 52 default).
3. Grace bypasses `orb_flow_or_confluence_required` block.

## 4) Validation
- `pnpm --dir backend exec tsc --noEmit`: pass
- `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts`: 19/19 pass

## 5) Rollback
Revert code changes.
