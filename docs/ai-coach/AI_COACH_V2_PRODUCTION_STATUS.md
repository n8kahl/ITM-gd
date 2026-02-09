# AI Coach V2 Production Status

**Last Updated:** 2026-02-09  
**Branch:** `Aiupgrade`  
**Intent:** Track implementation status, production gates, and test evidence for V2 rollout.
**Canonical Implementation Spec:** `/Users/natekahl/ITM-gd/docs/ai-coach/AI_COACH_V2_REBUILD_SPEC.md` (source import from `/Users/natekahl/Desktop/AI_COACH_V2_REBUILD_SPEC.pdf`)

All phase decisions, testing gates, and acceptance criteria in this status document should be interpreted against the rebuild spec above.

## 1) Delivered on `Aiupgrade`

### Backend
- Watchlist API with default recovery:
  - `GET/POST/PUT/DELETE /api/watchlist`
  - `/Users/natekahl/ITM-gd/backend/src/routes/watchlist.ts`
- Morning brief API:
  - `GET/PATCH /api/brief/today`
  - Supports:
    - 30-min freshness cache
    - `force=true` regeneration
    - `watchlist=...` on-demand preview
  - `/Users/natekahl/ITM-gd/backend/src/routes/brief.ts`
- Morning brief generation service:
  - Builds key levels, macro events, open-position risk summary, watch items
  - `/Users/natekahl/ITM-gd/backend/src/services/morningBrief/index.ts`
- Morning brief scheduler worker:
  - Runs at/after 7:00 AM ET on trading days
  - Idempotent inserts by `(user_id, market_date)` (skips existing)
  - Startup/shutdown lifecycle integrated in server
  - `/Users/natekahl/ITM-gd/backend/src/workers/morningBriefWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/server.ts`
- Tracked setups API:
  - `GET/POST/PATCH/DELETE /api/tracked-setups`
  - Duplicate-safe behavior for active `source_opportunity_id`
  - `/Users/natekahl/ITM-gd/backend/src/routes/trackedSetups.ts`
- Scanner integration:
  - Uses user watchlist symbols when query symbols are omitted
  - `/Users/natekahl/ITM-gd/backend/src/routes/scanner.ts`
  - `/Users/natekahl/ITM-gd/backend/src/chatkit/functionHandlers.ts`
- Setup push worker scaffolding (timing + lifecycle hooks):
  - Adaptive polling worker with start/stop during server lifecycle
  - Heartbeat event channel for future setup-delivery integration
  - `/Users/natekahl/ITM-gd/backend/src/workers/setupPushWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupPushChannel.ts`
  - `/Users/natekahl/ITM-gd/backend/src/server.ts`
- Setup transition automation + targeted push delivery:
  - Evaluates `active` tracked setups against live price and suggested trade levels
  - Persists `active -> triggered|invalidated` with timestamps
  - Publishes user-targeted `setup_update` events to WebSocket channel `setups:{userId}`
  - `/Users/natekahl/ITM-gd/backend/src/workers/setupPushWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/websocket.ts`
- Worker health telemetry + endpoint:
  - In-memory lifecycle/heartbeat metrics for `alert`, `morning_brief`, `setup_push`, and `setup_detector` workers
  - Health endpoint `GET /health/workers` returns running/stale summary and per-worker stats
  - `/Users/natekahl/ITM-gd/backend/src/services/workerHealth.ts`
  - `/Users/natekahl/ITM-gd/backend/src/routes/health.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/alertWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/morningBriefWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/setupPushWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/index.ts`
- GEX profile API + AI function:
  - `GET /api/options/:symbol/gex` with validated query params (`expiry`, `strikeRange`, `maxExpirations`, `forceRefresh`) and 5-min cached calculator service
  - ChatKit function `get_gamma_exposure` wired to return regime, flip point, max GEX strike, key levels, and strike-by-strike GEX
  - `/Users/natekahl/ITM-gd/backend/src/routes/options.ts`
  - `/Users/natekahl/ITM-gd/backend/src/schemas/optionsValidation.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/options/gexCalculator.ts`
  - `/Users/natekahl/ITM-gd/backend/src/chatkit/functions.ts`
  - `/Users/natekahl/ITM-gd/backend/src/chatkit/functionHandlers.ts`
  - `/Users/natekahl/ITM-gd/backend/src/server.ts`
- Real-time setup detector service:
  - Implements ORB, break-retest, VWAP play, gap-fill, volume climax, level-test, gamma squeeze, and SPX/NDX opening-drive detectors
  - Runs on market-aware cadence and persists deduplicated detections to `ai_coach_detected_setups`
  - Auto-creates tracked setups for watchlist users (1 setup per symbol/user per 5 min) and publishes `setup_detected` events
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/index.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/detectors.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/gammaSqueeze.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/indexSpecific.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/volumeClimax.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/levelTest.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/orb.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/breakRetest.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/vwap.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/gapFill.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupPushChannel.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/websocket.ts`
  - `/Users/natekahl/ITM-gd/backend/src/server.ts`

### Frontend
- Opportunity Scanner:
  - Pulls default watchlist from API
  - Edit/save watchlist in-panel
  - Track setup actions with status states (`saving/saved/duplicate/error`)
  - `/Users/natekahl/ITM-gd/components/ai-coach/opportunity-scanner.tsx`
- Morning Brief panel:
  - Summary, watchlist chips, key levels, economic events, open-position risk, watch items
  - `/Users/natekahl/ITM-gd/components/ai-coach/morning-brief.tsx`
- Center panel wiring:
  - Morning Brief tab + home access
  - Tracked Setups tab + home quick access
  - `/Users/natekahl/ITM-gd/components/ai-coach/center-panel.tsx`
- Tracked setups management panel:
  - Status filters (`active/triggered/invalidated/archived/all`)
  - Lifecycle actions (trigger/invalidate/archive/reopen)
  - Notes editing + delete + AI follow-up action
  - Live refresh via WebSocket `setups:{userId}` for both `setup_update` and `setup_detected` events
  - `/Users/natekahl/ITM-gd/components/ai-coach/tracked-setups-panel.tsx`
- Typed API client coverage:
  - watchlist/brief/tracked-setups methods
  - `/Users/natekahl/ITM-gd/lib/api/ai-coach.ts`
- GEX frontend visualization + chart overlay wiring:
  - Reusable GEX visualization component `GEXChart`
  - Chat widget card rendering for `get_gamma_exposure` with regime/flip/max/key levels and a `Show on Chart` action
  - Options panel now loads `/api/options/:symbol/gex` and renders embedded GEX profile + chart handoff action
  - Center panel chart request plumbing now accepts GEX payloads and renders flip/max/key overlays on `TradingChart`
  - `/Users/natekahl/ITM-gd/components/ai-coach/gex-chart.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/widget-cards.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/options-chain.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/center-panel.tsx`
  - `/Users/natekahl/ITM-gd/hooks/use-ai-coach-chat.ts`
  - `/Users/natekahl/ITM-gd/lib/api/ai-coach.ts`

### Database
- Applied to staging:
  - `20260304100000_journal_security_and_backfill.sql`
  - `20260304103000_ai_coach_v2_tables.sql`
  - `20260304110000_ai_coach_tracked_setups.sql`
- Files:
  - `/Users/natekahl/ITM-gd/supabase/migrations/20260304100000_journal_security_and_backfill.sql`
  - `/Users/natekahl/ITM-gd/supabase/migrations/20260304103000_ai_coach_v2_tables.sql`
  - `/Users/natekahl/ITM-gd/supabase/migrations/20260304110000_ai_coach_tracked_setups.sql`

## 2) Test Evidence

### Backend route tests
- Existing:
  - `/Users/natekahl/ITM-gd/backend/src/routes/__tests__/brief.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/routes/__tests__/scanner.test.ts`
- Added in this pass:
  - `/Users/natekahl/ITM-gd/backend/src/routes/__tests__/watchlist.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/routes/__tests__/trackedSetups.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/__tests__/setupPushWorker.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/__tests__/setupPushChannel.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/__tests__/morningBriefWorker.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/__tests__/detectors.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/__tests__/volumeClimax.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/__tests__/levelTest.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/__tests__/gammaSqueeze.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/__tests__/indexSpecific.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/setupDetector/__tests__/service.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/__tests__/workerHealth.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/options/__tests__/gexCalculator.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/routes/__tests__/options.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/chatkit/__tests__/functionHandlers.test.ts` (`get_gamma_exposure` coverage)

### Commands
- `npm test -- --runInBand src/workers/__tests__/morningBriefWorker.test.ts src/routes/__tests__/brief.test.ts src/routes/__tests__/scanner.test.ts src/routes/__tests__/watchlist.test.ts src/routes/__tests__/trackedSetups.test.ts src/services/__tests__/setupPushChannel.test.ts src/workers/__tests__/setupPushWorker.test.ts`
- `npm test -- --runInBand src/services/setupDetector/__tests__/detectors.test.ts src/services/setupDetector/__tests__/service.test.ts src/services/__tests__/setupPushChannel.test.ts src/workers/__tests__/setupPushWorker.test.ts src/workers/__tests__/morningBriefWorker.test.ts src/routes/__tests__/brief.test.ts src/routes/__tests__/scanner.test.ts src/routes/__tests__/watchlist.test.ts src/routes/__tests__/trackedSetups.test.ts`
- `npm test -- --runInBand src/services/setupDetector/__tests__/detectors.test.ts src/services/setupDetector/__tests__/gammaSqueeze.test.ts src/services/setupDetector/__tests__/indexSpecific.test.ts src/services/setupDetector/__tests__/service.test.ts src/services/__tests__/setupPushChannel.test.ts src/workers/__tests__/setupPushWorker.test.ts src/workers/__tests__/morningBriefWorker.test.ts src/routes/__tests__/brief.test.ts src/routes/__tests__/scanner.test.ts src/routes/__tests__/watchlist.test.ts src/routes/__tests__/trackedSetups.test.ts`
- `npm test -- --runInBand src/services/setupDetector/__tests__/detectors.test.ts src/services/setupDetector/__tests__/volumeClimax.test.ts src/services/setupDetector/__tests__/levelTest.test.ts src/services/setupDetector/__tests__/gammaSqueeze.test.ts src/services/setupDetector/__tests__/indexSpecific.test.ts src/services/setupDetector/__tests__/service.test.ts src/services/__tests__/setupPushChannel.test.ts src/workers/__tests__/setupPushWorker.test.ts src/workers/__tests__/morningBriefWorker.test.ts src/routes/__tests__/brief.test.ts src/routes/__tests__/scanner.test.ts src/routes/__tests__/watchlist.test.ts src/routes/__tests__/trackedSetups.test.ts`
- `npm test -- --runInBand src/services/__tests__/workerHealth.test.ts src/services/setupDetector/__tests__/detectors.test.ts src/services/setupDetector/__tests__/volumeClimax.test.ts src/services/setupDetector/__tests__/levelTest.test.ts src/services/setupDetector/__tests__/gammaSqueeze.test.ts src/services/setupDetector/__tests__/indexSpecific.test.ts src/services/setupDetector/__tests__/service.test.ts src/services/__tests__/setupPushChannel.test.ts src/workers/__tests__/setupPushWorker.test.ts src/workers/__tests__/morningBriefWorker.test.ts src/routes/__tests__/brief.test.ts src/routes/__tests__/scanner.test.ts src/routes/__tests__/watchlist.test.ts src/routes/__tests__/trackedSetups.test.ts`
- `npm test -- --runInBand src/services/options/__tests__/gexCalculator.test.ts src/routes/__tests__/options.test.ts src/chatkit/__tests__/functionHandlers.test.ts src/chatkit/__tests__/wp8Handlers.test.ts`
- Targeted TS checks run on changed backend/frontend files before merge.
- Playwright WebSocket smoke spec updated in `/Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-api.spec.ts` (execution blocked in this environment due missing `@sentry/nextjs` dependency).

## 3) Production Gates (Current)

### Green
- Branch is mergeable with `main` and pushed.
- Core V2 APIs are implemented and covered with route-level tests.
- Staging DB has required V2 core tables and tracked setups migration.
- Tracked setups lifecycle UI is available in AI Coach center panel.
- Setup push worker is running with startup/shutdown hooks and automated status transitions.
- WebSocket setup channels now deliver user-targeted setup updates (`setups:{userId}`).
- Morning brief scheduled worker is in place with idempotent writes.
- Setup detector service is running with ORB/break-retest/VWAP/gap-fill/volume-climax/level-test/gamma-squeeze/index-opening-drive detections, DB persistence, and watchlist-driven tracked-setup auto-creation.
- WebSocket setup channels now deliver both `setup_update` and `setup_detected` events.
- GEX backend surface from rebuild spec is live (`/api/options/:symbol/gex`, `get_gamma_exposure`, calculator service + tests).

### Needs Completion
- Implement the broader interactive widget action system from spec (`widget-actions`, context menus, workflow context wiring across all widget types).
- Full E2E path:
  - scanner -> track setup -> manage tracked setup -> detector auto-track -> morning brief consume.

## 4) Surgical Next Plan

1. Add Playwright E2E smoke for scanner -> track -> tracked-setups live update (`setup_update` + `setup_detected`) -> brief consume.
2. Implement cross-widget action framework (`widget-action-bar`, context menus, workflow context) so GEX/earnings/scanner cards share consistent chart/options/alert actions.
3. Add external alerting wiring (PagerDuty/Sentry/Slack) on top of `/health/workers` telemetry for stale/failing workers.
4. Run staging verification against pending hardening migrations from `main` before production cut.
