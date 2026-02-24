# SPX Command Center Phase 18 — Phase D Slice 3

Date: 2026-02-23  
Owner: Codex autonomous hardening  
Status: Implemented

## Scope delivered

- Migrated Next.js Sentry initialization to instrumentation conventions compatible with Next 16.
- Added Node runtime alignment artifact for tooling consistency.
- Added SPX-specific FK covering-index migration for Supabase performance lint findings.

## Changes

### Sentry instrumentation migration

- Updated `/Users/natekahl/ITM-gd/instrumentation.ts`
  - Added server/edge Sentry init directly inside instrumentation flow.
  - Added idempotent initialization guard.
  - Captures request errors via `Sentry.captureException`.

- Added `/Users/natekahl/ITM-gd/instrumentation-client.ts`
  - Client Sentry init moved here from legacy client config.
  - Added required router transition hook:
    - `onRouterTransitionStart = Sentry.captureRouterTransitionStart`

- Removed deprecated config files:
  - `/Users/natekahl/ITM-gd/sentry.client.config.ts`
  - `/Users/natekahl/ITM-gd/sentry.server.config.ts`
  - `/Users/natekahl/ITM-gd/sentry.edge.config.ts`

### Node runtime alignment

- Added `/Users/natekahl/ITM-gd/.node-version` with `22`.
- Added backend engine constraint in `/Users/natekahl/ITM-gd/backend/package.json`:
  - `"engines": { "node": ">=22.0.0" }`

### SPX DB index hardening

- Added migration `/Users/natekahl/ITM-gd/supabase/migrations/20260327010000_spx_fk_covering_indexes.sql`
  - `idx_spx_setup_execution_fills_reported_by_user_id`
  - `idx_spx_setup_optimizer_history_reverted_from_history_id`

These indexes address SPX-specific unindexed FK findings identified by advisor scans.

## Validation

- `pnpm exec eslint instrumentation.ts instrumentation-client.ts next.config.mjs`
- `pnpm exec tsc --noEmit`
- `pnpm --dir backend exec tsc --noEmit`
- `pnpm run build`
- `pnpm --dir backend run build`

All commands passed.

## Notes

- Build no longer emits Sentry Next instrumentation migration warnings.
- Remaining build warning is environmental/runtime:
  - local Node is `v20.19.5` while project engine target is `>=22`.
- Migration file was added to repository and not auto-applied to database in this slice.
