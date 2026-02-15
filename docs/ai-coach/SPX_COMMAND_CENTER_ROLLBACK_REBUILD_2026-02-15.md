# SPX Command Center Rollback + Rebuild (2026-02-15)

## Objective
- Replace fragmented SPX data loading with a single synchronized snapshot path.
- Remove silent degraded fallback behavior that masked backend failures.
- Align SPX delivery with the same live Massive-backed backend contract used across the platform.

## Root Causes Found
1. SPX UI state was assembled from many independent polling hooks (`levels`, `gex`, `setups`, `regime`, `flow`, `fib`, `basis`, `coach`), so panels drifted out of sync and could represent different timestamps.
2. Realtime stream auth was not wired through in SPX context, causing websocket connection/auth failures and stale prices.
3. Next.js SPX proxy returned synthetic degraded `200` fallbacks on upstream failures, hiding true backend status and serving stale payloads.
4. SPX backend route group applied query-limit middleware to high-frequency command center endpoints, creating avoidable request failures under normal polling behavior.

## Implementation Decisions
- No backward compatibility shim retained for fragmented SPX hooks in the page-level data flow.
- Snapshot-first architecture is now the single source of truth for SPX command center state.
- Proxy now preserves upstream status/errors rather than fabricating fallback success responses.

## Changes Implemented

### Frontend
- `contexts/SPXCommandCenterContext.tsx`
  - Replaced multi-hook fan-out with `useSPXSnapshot()` unified query.
  - Added authenticated realtime stream usage: `usePriceStream(['SPX', 'SPY'], true, session?.access_token)`.
  - Kept context contract stable for UI components while sourcing from snapshot payload.
  - Coach sends now post to `/api/spx/coach/message` and mutate snapshot cache immediately.
- `hooks/use-spx-snapshot.ts`
  - Added unified snapshot polling hook (`/api/spx/snapshot`, 5s refresh).

### API Proxy
- `app/api/spx/[...path]/route.ts`
  - Removed stale/degraded fallback payload generation and in-memory stale cache.
  - Preserves upstream status/body for explicit observability.
  - Retains backend failover behavior and auth header retry logic.

### Backend
- `backend/src/routes/spx.ts`
  - Added `GET /api/spx/snapshot`.
  - Removed `checkQueryLimit` from SPX route group (keeps auth + tier guard).

### Tests and Mocks
- `e2e/helpers/spx-mocks.ts`
  - Added `/api/spx/snapshot` response mock.
- `backend/src/__tests__/integration/spx-api.test.ts`
  - Added snapshot route coverage and mocked `getSPXSnapshot`.

## Edge Impact Review
- Error handling: SPX failures now surface as real HTTP errors, not fallback success payloads.
- Data consistency: all command center modules share one generated snapshot timestamp.
- Performance: reduced frontend request fan-out and duplicate polling pressure.
- Realtime: stream now receives auth token consistently in SPX surface.
- Local dev behavior: if local backend is unavailable and remote fallback also fails, UI now reports explicit backend/proxy errors.

## Verification Checklist
- [x] Backend SPX route exposes `/snapshot`.
- [x] Frontend SPX context uses snapshot as single state source.
- [x] SPX websocket stream uses authenticated token.
- [x] Proxy no longer masks errors with degraded fallback `200`.
- [x] E2E and integration mock/test paths include snapshot contract.

