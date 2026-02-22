# SPX Command Center Phase 12 - Slice P12-S1

Date: 2026-02-22  
Owner: Codex implementation run  
Scope: Profile-driven setup geometry optimization + realtime setup-trigger notification slice.

## Objectives

1. Add optimization-profile geometry controls that can shape live setup stop/T1/T2 behavior by setup family, regime, and session time bucket.
2. Extend backtest geometry override resolution so sweeps can evaluate scoped keys (`setup|regime|bucket`) with deterministic fallback behavior.
3. Add production notification policy for setup triggers in SPX Command Center (low-latency, deduped, preference-aware).

## Files Changed

1. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
2. `/Users/natekahl/ITM-gd/backend/src/services/spx/setupDetector.ts`
3. `/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts`
4. `/Users/natekahl/ITM-gd/contexts/SPXCommandCenterContext.tsx`
5. `/Users/natekahl/ITM-gd/lib/spx/flags.ts`
6. `/Users/natekahl/ITM-gd/lib/spx/__tests__/flags.test.ts`
7. `/Users/natekahl/ITM-gd/app/api/members/dashboard/notification-preferences/route.ts`
8. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_GOLD_STANDARD_CONFIG_2026-02-22.md`
9. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_RELEASE_NOTES_2026-02-21.md`

## Implementation Summary

1. Added `geometryPolicy` to `SPXOptimizationProfile` with three levels:
   - `bySetupType`
   - `bySetupRegime`
   - `bySetupRegimeTimeBucket`
2. Added normalization/clamping for geometry fields (`stopScale`, `target1Scale`, `target2Scale`, `t1/t2 min/max R`) to harden profile integrity.
3. Updated `setupDetector` to resolve effective geometry policy using precedence:
   1. `setupType|regime|bucket`
   2. `setupType|regime`
   3. `setupType`
4. Applied geometry policy directly in live setup generation:
   - stop distance scaling
   - trend-family and mean/fade target scaling + bounded R envelopes
5. Extended backtest geometry override lookup in `winRateBacktest`:
   - resolves scoped geometry keys with setup/regime/time bucket fallback logic.
6. Added SPX realtime setup-trigger notification behavior in command center context:
   - emits in-app toast on `ready -> triggered`
   - optional browser notification when tab is backgrounded + permission granted + user preference enabled
   - dedupe/cooldown safeguards (toast `90s`, browser `180s`)
7. Added `setupRealtimeAlertsV1` UX flag for controlled rollout.
8. Added member API route to read `ai_coach_user_preferences.notification_preferences` for setup-notification gating.

## Validation Gates

Executed and passed:

1. `pnpm --dir backend exec tsc --noEmit`
2. `pnpm exec tsc --noEmit`
3. `pnpm --dir backend test -- src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/winRateBacktest.test.ts src/services/spx/__tests__/optimizer-confidence.test.ts`
4. `pnpm exec vitest run lib/spx/__tests__/flags.test.ts`
5. `pnpm --dir backend build`
6. `pnpm --dir backend backtest:last-week instances second`

Notes:

1. `pnpm --dir backend exec eslint ...` was not runnable in this workspace because backend package does not expose eslint in its local toolchain.
2. Root eslint ignores backend paths by project configuration, so backend lint is enforced via backend TypeScript/tests/build gates in this slice.

## Current Strict Replay Snapshot

From `backtest:last-week` after this slice (same strict window, second-bar Massive replay):

1. `triggered=17`
2. `T1=76.47%`
3. `T2=70.59%`
4. `failure=17.65%`
5. `expectancyR=+1.0587`
6. `usedMassiveMinuteBars=false`

Result: notification slice and geometry-policy plumbing shipped without degrading current strict-week baseline metrics.
