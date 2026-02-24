# SPX Command Center Phase 18 — Phase B Slice 2
Date: 2026-02-23
Owner: Codex (autonomous implementation)
Status: Implemented (local)

## Slice Objective
Add first-pass cross-session structural memory so setup quality can incorporate historical level behavior from `spx_setup_instances`.

## Scope Implemented
1. Added `memoryEngine` service:
   - Queries `spx_setup_instances` by setup type/direction
   - Filters by level proximity (default ±2.5 points)
   - Scopes to last N sessions (default 5)
   - Computes tests/resolved/wins/losses/win-rate/confidence/score
   - Redis caching with short TTL for fast repeated setup recalculation
2. Integrated memory signal into `setupDetector` (feature-flagged):
   - `SPX_MEMORY_ENGINE_ENABLED` controls activation (default `false`)
   - Memory context adds bounded score and pWin calibration adjustments
   - Memory edges add setup drivers/risk notes
   - Adds `memoryContext` payload on setup output
3. Extended setup contracts:
   - Backend and frontend setup types now include optional `memoryContext`.
4. Added tests:
   - `memoryEngine` unit tests (cache path, computed stats path, error fallback path)
   - Regression suite rerun with detector, flow, environment, session, zone quality.

## Rollout Safety
- Feature is opt-in via env flag and defaults off.
- Neutral fallback is used on query failures.
- No schema migrations required for this slice.

## Files Changed
- `backend/src/services/spx/memoryEngine.ts` (new)
- `backend/src/services/spx/setupDetector.ts`
- `backend/src/services/spx/types.ts`
- `backend/src/services/spx/__tests__/memoryEngine.test.ts` (new)
- `backend/src/config/env.ts`
- `backend/.env.example`
- `lib/types/spx-command-center.ts`

## Validation Gates Executed
1. Unit/integration tests:
   - `pnpm --dir backend test -- src/services/spx/__tests__/memoryEngine.test.ts src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/zoneQualityEngine.test.ts src/services/spx/__tests__/flowAggregator.test.ts src/services/spx/__tests__/environmentGate.test.ts src/services/spx/__tests__/marketSessionService.test.ts`
   - Result: **pass** (29/29 tests)
2. Type checks:
   - `pnpm --dir backend exec tsc --noEmit`
   - `pnpm exec tsc --noEmit`
   - Result: **pass**
3. Lint checks:
   - `pnpm exec eslint --no-warn-ignored backend/src/services/spx/setupDetector.ts backend/src/services/spx/zoneQualityEngine.ts backend/src/services/spx/memoryEngine.ts backend/src/services/spx/types.ts backend/src/services/spx/__tests__/setupDetector.test.ts backend/src/services/spx/__tests__/zoneQualityEngine.test.ts backend/src/services/spx/__tests__/memoryEngine.test.ts backend/src/config/env.ts`
   - `pnpm exec eslint lib/types/spx-command-center.ts`
   - Result: **pass**

## Notes / Deviations
1. Memory weighting is intentionally bounded to avoid destabilizing current live confluence behavior.
2. Since the feature is opt-in, rollout can be validated in soak mode before enabling in production.

## Next Recommended Slice
Phase B Slice 3: introduce trigger-bar context capture + latency surfacing and wire it through API/UI contracts.
