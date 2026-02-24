# SPX Command Center Phase 18 Closeout Audit

- Date: 2026-02-24
- Branch: `main`
- Commit: `411f100`
- Auditor: Codex
- Scope: Verification against `SPX_COMMAND_CENTER_PHASE18_EXECUTION_SPEC_2026-02-23.md`

## Completion Verdict

Phase 18 is **partially complete**. Core implementation exists, but release-close criteria are not fully met.

## Implemented (Verified)

- Setup detector overhaul foundation present:
  - `backend/src/services/spx/setupDetector.ts`
  - `backend/src/services/spx/environmentGate.ts`
  - `backend/src/services/spx/zoneQualityEngine.ts`
  - `backend/src/services/spx/stopEngine.ts`
  - `backend/src/services/spx/flowAggregator.ts`
  - `backend/src/services/spx/multiTFConfluence.ts`
  - `backend/src/services/spx/priceActionEngine.ts`
  - `backend/src/services/spx/atrService.ts`
  - `backend/src/services/spx/evCalculator.ts`
  - `backend/src/services/spx/memoryEngine.ts`
  - `backend/src/services/spx/newsSentimentService.ts`
  - `backend/src/services/spx/eventRiskGate.ts`
  - `backend/src/services/spx/marketSessionService.ts`
- Standby/environment response exposed by API:
  - `backend/src/routes/spx.ts` (`/setups` response includes `environmentGate` and `standbyGuidance`)
- UI surfaces for trigger context, standby, weighted confluence, flow, and settings accuracy:
  - `components/spx-command-center/setup-card.tsx`
  - `components/spx-command-center/setup-feed.tsx`
  - `components/spx-command-center/flow-ticker.tsx`
  - `components/spx-command-center/spx-settings-sheet.tsx`
- Migrations and runbook/release notes exist:
  - `supabase/migrations/20260327020000_add_spx_level_touches_table.sql`
  - `supabase/migrations/20260327030000_spx_level_touches_rls.sql`
  - `docs/specs/SPX_COMMAND_CENTER_PHASE18_RUNBOOK_2026-02-23.md`
  - `docs/specs/SPX_COMMAND_CENTER_PHASE18_RELEASE_NOTES_2026-02-23.md`

## Remaining / Partial

- Spec path mismatches (implemented in equivalent paths, not exact spec tree):
  - Missing exact paths: `backend/src/services/websocket/massiveWebSocketClient.ts`, `lib/spx/types.ts`, `lib/spx/utils.ts`, `components/spx/*`.
- Flow ingestion diverges from spec:
  - Spec expected tick-trade polling style (`/v3/trades/...` every 5s).
  - Current implementation is snapshot+aggregate derived flow in `flowEngine.ts` and `flowAggregator.ts`.
- Several Tier 2/3 integrations from matrix are not fully wired into SPX detector path:
  - NOI, short-interest/short-volume, LULD, FMV.
- Feature-flag posture defaults key Phase 18 modules to off until env enables:
  - `SPX_ENVIRONMENT_GATE_ENABLED`
  - `SPX_MULTI_TF_CONFLUENCE_ENABLED`
  - `SPX_MEMORY_ENGINE_ENABLED`
  - `SPX_WEIGHTED_CONFLUENCE_ENABLED`
  - `SPX_ADAPTIVE_EV_ENABLED`
  - `SPX_EVENT_RISK_GATE_ENABLED`
  - `SPX_NEWS_SENTIMENT_ENABLED`

## Quality Gate Evidence (2026-02-24)

- `pnpm exec tsc --noEmit`: pass
- `pnpm --dir backend exec tsc --noEmit --strict`: pass
- `pnpm --dir backend test -- src/services/spx/__tests__`: pass (29 suites / 140 tests)
- `pnpm run backtest:spx:walkforward -- --weeks=4 --instrument=SPX --bars=minute`: pass (execution), but performance target fails
- `pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1`: fail (29 passed / 1 failed)
  - Failing spec: `e2e/spx-command-center.spec.ts` ("auto-sees routine coach alert and persists lifecycle across reload")
  - Failure detail: `spx-ai-coach-pinned-alert` expected count `0`, received `1`
- `pnpm exec eslint backend/src/`: not directly runnable in current root ESLint configuration (backend files ignored by root lint config)

## Performance Snapshot (Current)

- YTD backtest (`2026-01-01` to `2026-02-24`, source=`spx_setup_instances`, bars=`second`):
  - T1 win rate: `51.11%`
  - T2 win rate: `37.78%`
  - Failure rate: `48.89%`
  - Expectancy: `0.5086R`
- Current does not meet spec target (`64%+` win rate).
- 4-week walk-forward (`2026-01-26` to `2026-02-20`, source=`spx_setup_instances`, bars=`minute`):
  - T1 win rate: `48.84%`
  - T2 win rate: `41.86%`
  - Failure rate: `51.16%`
  - Expectancy: `0.7015R`
  - Current does not meet walk-forward target criteria.

## Closeout Actions Added This Slice

- Added missing gate scripts so spec-style commands exist:
  - Root:
    - `backtest:spx`
    - `backtest:spx:walkforward`
  - Backend:
    - `backtest:spx` -> `backend/src/scripts/spxBacktestRange.ts`
    - `backtest:spx:walkforward` -> `backend/src/scripts/spxBacktestWalkforward.ts`
- Wired news sentiment poller into server lifecycle behind existing feature flag:
  - Startup when `SPX_NEWS_SENTIMENT_ENABLED=true`
  - Graceful shutdown cleanup
  - File: `backend/src/server.ts`
- Added production startup warning for disabled Phase 18 flags and validated missing env key:
  - Added `SPX_ENVIRONMENT_GATE_ENABLED` to validated schema in `backend/src/config/env.ts`
  - Added startup warning list for disabled Phase 18 flags in `backend/src/server.ts`

## Supabase Advisor Snapshot (2026-02-24)

- Security advisors: **open errors/warnings remain** (project-wide)
  - Includes `rls_disabled_in_public` errors on public tables (example: `ai_coach_earnings_cache`, `ai_coach_levels_cache`, `ai_coach_detected_setups`, `achievement_tiers`)
  - Includes broad `function_search_path_mutable` warnings and permissive RLS policy warnings
- Performance advisors: **open warnings remain** (project-wide)
  - Includes unindexed foreign keys, RLS initplan issues, and multiple permissive policy warnings

These advisor issues are not all Phase 18-owned, but they still block a strict "all release gates passed" declaration at the platform level.

## Final Close Criteria Still Open

- Achieve target metrics in walk-forward validation window.
- Resolve Supabase security/performance advisor blockers relevant to production go-live.
- Finalize explicit product/engineering/QA sign-off checklist in execution spec.
