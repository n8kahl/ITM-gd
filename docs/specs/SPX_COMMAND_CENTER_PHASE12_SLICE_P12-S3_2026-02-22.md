# SPX Command Center Phase 12 Slice P12-S3 (2026-02-22)

## Objective
Add institutional optimizer governance controls:
1. Persist nightly optimizer runtime status across backend restarts.
2. Record immutable optimizer audit history for scan/revert actions.
3. Add reversible optimizer profile controls from SPX Settings.

## Scope
In scope:
1. Backend optimizer history + revert APIs.
2. Backend persisted nightly status in optimizer state row.
3. SPX Settings UI history and per-entry revert action.
4. Migration for optimizer history table + state column extension.

Out of scope:
1. Setup detection algorithm changes.
2. New optimization objective math.
3. Non-SPX settings surfaces.

## Files Changed
1. `/Users/natekahl/ITM-gd/backend/src/services/spx/optimizer.ts`
2. `/Users/natekahl/ITM-gd/backend/src/workers/spxOptimizerWorker.ts`
3. `/Users/natekahl/ITM-gd/backend/src/routes/spx.ts`
4. `/Users/natekahl/ITM-gd/hooks/use-spx-optimizer.ts`
5. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-settings-sheet.tsx`
6. `/Users/natekahl/ITM-gd/backend/src/workers/__tests__/spxOptimizerWorker.test.ts`
7. `/Users/natekahl/ITM-gd/backend/src/__tests__/integration/spx-api.test.ts`
8. `/Users/natekahl/ITM-gd/supabase/migrations/20260323050000_spx_optimizer_history_audit.sql`

## API Additions
1. `GET /api/spx/analytics/optimizer/history?limit=20`
2. `POST /api/spx/analytics/optimizer/revert` with `{ historyId, reason? }`

## Behavior Changes
1. Every optimizer scan appends an audit row (mode, action, scorecard deltas, previous/next profile snapshots).
2. Revert action appends an audit row linking to the reverted history id.
3. Nightly worker status fields are persisted in DB and loaded by schedule endpoint.
4. Settings now shows audit history with inline revert controls.

## Validation Gates
1. `pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit` ✅
2. `pnpm --dir /Users/natekahl/ITM-gd/backend test -- src/workers/__tests__/spxOptimizerWorker.test.ts src/__tests__/integration/spx-api.test.ts` ✅
3. `pnpm --dir /Users/natekahl/ITM-gd exec tsc --noEmit` ✅
4. `pnpm --dir /Users/natekahl/ITM-gd exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1` ✅

## Audit / Revert Contract
1. History is append-only and ordered by `id DESC`.
2. Revert target is deterministic: selected history entry's `previous_profile`.
3. Revert records include `reverted_from_history_id` for chain-of-custody.
4. Settings exposes source metadata, reason, mode, and scorecard deltas for each history row.

## Risk and Rollback
Risk:
1. Revert can intentionally change live gating/profile behavior.
2. Persisted scorecard after revert may need immediate re-scan for perfect profile/metrics alignment.

Rollback:
1. Revert to the most recent pre-change history entry via UI/API.
2. Disable nightly scheduler via `SPX_OPTIMIZER_NIGHTLY_ENABLED=false` if needed.
3. Revert this slice commit if full rollback required.
