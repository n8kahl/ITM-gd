# Trade Journal Review — Release Notes (2026-03-01)

## Summary
Implemented the Trade Journal Review admin and member coaching workflow for EPIC-COACH, replacing the dead admin journal config link with a production route and full request/review/publish flow.

## Delivered
- New coach-review schema, permission seed, and screenshot storage migration.
- Admin queue + browse APIs with filtering, stats API, detail API, notes CRUD, publish, dismiss, screenshots, and AI generation endpoint.
- Admin `/admin/trade-review` queue/browse UI and `/admin/trade-review/[id]` coaching workspace.
- Member request-review and published feedback endpoints.
- Member entry detail integration for request button and published coach feedback section.
- Real-time pending badge in admin sidebar for Trade Review.
- Validation schemas and unit tests for coach-review payloads.
- Admin Playwright spec + helper for trade-review flows.

## AI/Market Context
- AI route uses GPT-4o (`temperature: 0.3`) with strict JSON schema validation.
- Massive.com market context snapshot includes minute/daily bars, SPX/VIX context, options snapshot attempt for options trades, and frozen snapshot persistence.
- AI generation upserts draft + market snapshot and writes audit log entry (`ai_generated`).

## Validation Evidence
- `pnpm exec eslint <trade-review touched files>`: pass
- `pnpm exec tsc --noEmit`: pass
- `pnpm vitest run lib/validation/__tests__/coach-review.test.ts`: pass
- `pnpm run build`: pass
- `pnpm exec playwright test e2e/specs/admin/trade-review.spec.ts --project=chromium --workers=1`: blocked in sandbox (`listen EPERM 127.0.0.1:3000`)

## Security Advisor Snapshot
Supabase `security` advisor ran successfully. Reported findings are pre-existing project-wide items (RLS/function-policy issues outside this feature scope). No new coach-review-specific linter failures were introduced by this slice.

## Known Follow-up
- Execute the new admin Playwright spec in an environment that allows local web server binding.
