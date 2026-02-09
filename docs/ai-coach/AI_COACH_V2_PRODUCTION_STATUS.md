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
  - Live refresh via WebSocket `setups:{userId}` subscription
  - `/Users/natekahl/ITM-gd/components/ai-coach/tracked-setups-panel.tsx`
- Typed API client coverage:
  - watchlist/brief/tracked-setups methods
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

### Commands
- `npm test -- --runInBand src/routes/__tests__/brief.test.ts src/routes/__tests__/scanner.test.ts src/routes/__tests__/watchlist.test.ts src/routes/__tests__/trackedSetups.test.ts src/services/__tests__/setupPushChannel.test.ts src/workers/__tests__/setupPushWorker.test.ts`
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

### Needs Completion
- Scheduled morning brief job (cron/worker path) with idempotency.
- Full setup detector engine (ORB/break-retest/VWAP/gap) feeding tracked setup updates at scale.
- Full E2E path:
  - scanner -> track setup -> manage tracked setup -> morning brief consume.

## 4) Surgical Next Plan

1. Add detector modules (ORB/break-retest/VWAP/gap) and feed their signals into tracked setup lifecycle.
2. Add Playwright E2E smoke for scanner -> track -> tracked-setups live update -> brief consume.
3. Implement scheduled morning brief generation job (7:00 AM ET trading days) with idempotent writes.
4. Run staging verification against pending hardening migrations from `main` before production cut.
