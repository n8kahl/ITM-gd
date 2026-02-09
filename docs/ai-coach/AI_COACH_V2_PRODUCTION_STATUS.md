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
- Worker health external alerting (Discord-first, Sentry optional):
  - New worker monitors `workerHealth` telemetry and sends Discord incident alerts for stale/unresolved-failure workers
  - Includes cooldown-based de-duplication and recovery notifications
  - Optional Sentry incident messages tied to worker name/type
  - Configurable via env (`WORKER_ALERTS_*`)
  - `/Users/natekahl/ITM-gd/backend/src/workers/workerHealthAlertWorker.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/workerHealthAlerting.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/discordNotifier.ts`
  - `/Users/natekahl/ITM-gd/backend/src/config/env.ts`
  - `/Users/natekahl/ITM-gd/backend/src/server.ts`
  - `/Users/natekahl/ITM-gd/backend/.env.example`
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
- Cross-widget workflow/action framework (production pass):
  - Shared workflow context with symbol/strike/expiry sync, center-view routing, breadcrumb path, and alert prefill state
  - Reusable widget action primitives (`widget-actions`, `widget-action-bar`, `widget-context-menu`) wired into key widgets
  - Key levels, options, scanner, current price, alerts, and GEX cards now expose chart/options/alert/analyze/chat actions via a unified action layer
  - Options panel now supports workflow symbol-sync prompts and workflow strike highlighting
  - Alerts panel consumes workflow prefill for one-click alert creation from widgets
  - `/Users/natekahl/ITM-gd/contexts/AICoachWorkflowContext.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/widget-actions.ts`
  - `/Users/natekahl/ITM-gd/components/ai-coach/widget-action-bar.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/widget-context-menu.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/widget-cards.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/center-panel.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/options-chain.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/alerts-panel.tsx`
  - `/Users/natekahl/ITM-gd/app/members/ai-coach/page.tsx`
- Non-widget workflow action extension (scanner/tracked/chart surfaces):
  - Opportunity Scanner cards now support context-menu + action-bar workflow handoffs (chart/options/alerts/analyze/chat)
  - Tracked Setups cards now support setup-overlay chart actions (entry/stop/target), context actions, and production handoffs to options/alerts/analyze/chat
  - Chart view now exposes native right-click workflow actions at hovered price (chart focus/options/alert/chat)
  - `/Users/natekahl/ITM-gd/components/ai-coach/opportunity-scanner.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/tracked-setups-panel.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/center-panel.tsx`
  - `/Users/natekahl/ITM-gd/components/ai-coach/trading-chart.tsx`
- E2E deterministic auth/scanner harness for middleware-protected AI Coach routes:
  - Test-only auth bypass in middleware and member auth context, enabled by explicit E2E env flags
  - Development/E2E CSP `connect-src` now allows local AI Coach backend (`localhost:3001`) outside production
  - `/Users/natekahl/ITM-gd/middleware.ts`
  - `/Users/natekahl/ITM-gd/contexts/MemberAuthContext.tsx`
  - `/Users/natekahl/ITM-gd/playwright.config.ts`
  - `/Users/natekahl/ITM-gd/e2e/helpers/member-auth.ts`

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
  - `/Users/natekahl/ITM-gd/backend/src/services/__tests__/workerHealthAlerting.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/services/__tests__/discordNotifier.test.ts`
  - `/Users/natekahl/ITM-gd/backend/src/workers/__tests__/workerHealthAlertWorker.test.ts`
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
- `npm test -- --runInBand src/workers/__tests__/workerHealthAlertWorker.test.ts src/services/__tests__/discordNotifier.test.ts src/services/__tests__/workerHealthAlerting.test.ts src/services/__tests__/workerHealth.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.codex-temp.json` (scoped frontend type-check for workflow/action framework touched files)
- `pnpm exec tsc --noEmit -p /tmp/tsconfig.codex-nextphase.json` (scoped type-check for scanner/tracked/chart workflow surface upgrades)
- `pnpm exec playwright test e2e/specs/ai-coach/ai-coach-workflow.spec.ts --project=ai-coach` (passing; scanner -> track -> tracked live updates -> brief workflow)
- `npm run build` (backend compile passes after making Sentry optional/no-op when package is not installed)
- Targeted TS checks run on changed backend/frontend files before merge.
- Playwright WebSocket smoke spec updated in `/Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-api.spec.ts` (execution environment boots in current setup).
- Added scanner workflow smoke spec `/Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-workflow.spec.ts` (mocked scanner/tracked/brief/WebSocket flow).

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
- Worker-health external alerting now live through Discord webhooks with cooldown and recovery notices.
- AI Coach workflow Playwright smoke (`ai-coach-workflow.spec.ts`) now passes end-to-end in deterministic E2E mode.

### Needs Completion
- Expand backend-integrated E2E coverage from mocked workflow smoke to authenticated staging data path:
  - scanner -> track setup -> manage tracked setup -> detector auto-track -> morning brief consume.
- Optional: add PagerDuty escalation integration on top of the current Discord/Sentry alert path if escalation policy requires paging.

## 4) Surgical Next Plan

1. Convert AI Coach E2E from mocked API routes to staging-integrated validation for scanner/tracked/brief flows with seeded test users.
2. Run AI Coach spec suite in CI and staging with production-like env wiring (`ai-coach-workflow.spec.ts`, `ai-coach-views.spec.ts`, `ai-coach-api.spec.ts`).
3. Run staging verification against pending hardening migrations from `main` before production cut.
4. If required by operations policy, add PagerDuty escalation for critical worker incidents while keeping Discord as the primary notification channel.
