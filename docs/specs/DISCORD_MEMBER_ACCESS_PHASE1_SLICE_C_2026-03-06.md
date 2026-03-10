# Discord Member Access Phase 1 Slice C (2026-03-06)

## Slice
Action 3: `/join-discord` retry-sync endpoint + stateful UX.

## Files Touched
- `app/api/auth/sync-discord/route.ts`
- `app/join-discord/page.tsx`
- `e2e/specs/auth/join-discord.spec.ts`

## Delivered
- Added authenticated retry endpoint that invokes edge sync and classifies outcomes: `SYNCED`, `NOT_MEMBER`, `NO_MEMBERSHIP_ROLE`, `SYNC_FAILED`.
- Reworked `/join-discord` UI to provide stateful diagnosis and actionable retry.
- Updated auth E2E spec expectations for the new copy and controls.

## Validation
- `pnpm exec eslint app/api/auth/sync-discord/route.ts app/join-discord/page.tsx e2e/specs/auth/join-discord.spec.ts`: PASS
- `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/auth/join-discord.spec.ts --project=chromium --workers=1`: PASS (8/8)
