# Trade Journal Development Spec (2026-02-14)

## Scope
Production-grade stabilization and verification of the Trade Journal V2 experience:
- Uploads
- Entry CRUD
- Labels/UI actions
- Route contracts
- Calculations and analytics integrity

## Goals
1. Eliminate known functional breaks in upload, grading, filtering, and API integration.
2. Standardize response contracts and validation semantics across create/update/import flows.
3. Enforce data integrity for journal rows and analytics.
4. Define reproducible test gates required before deployment.

## Non-Goals
- Net-new journal feature expansion outside reliability/stability fixes.
- Redesign of visual system.
- Re-architecting social/profile modules beyond journal integration touchpoints.

## Current Defect Classes
1. Screenshot upload/read URL contract mismatch.
2. Grade response contract mismatch between UI and API.
3. Update path permits states disallowed in create path.
4. Import dedupe identity over-collapses distinct trades.
5. Duplicate delete confirmations from nested modals.
6. Filter UI does not expose open/closed state despite API support.
7. Missing push subscription API route used by web notification client.
8. Inconsistent response shape handling for list totals.

## Architecture Contracts

### Journal List Route
- Endpoint: `GET /api/members/journal`
- Must return:
  - `success: true`
  - `data: JournalEntry[]`
  - `meta.total: number`
  - `meta.streaks.current_streak: number`
  - `meta.streaks.longest_streak: number`

### Journal Mutation Routes
- `POST /api/members/journal`: create entry; compute `pnl`/`pnl_percentage` if omitted.
- `PATCH /api/members/journal`: update entry; merged payload must satisfy create invariants.
- `DELETE /api/members/journal?id=<uuid>`: delete entry and associated screenshot object.

### Screenshot Route
- Endpoint: `POST /api/members/journal/screenshot-url`
- Supported payloads:
  - `{ fileName, contentType }` -> signed upload URL + storage path
  - `{ storagePath }` -> signed read URL for existing object
- Storage path must be bucket-relative and scoped to current user folder.

### Push Subscription Routes
- Endpoint: `POST /api/members/journal/push-subscriptions`
  - Upsert endpoint/subscription for authenticated user.
- Endpoint: `DELETE /api/members/journal/push-subscriptions`
  - Deactivate one endpoint or all user endpoints.

## Validation & Data Integrity Rules
1. Create and update must enforce:
  - `exit_timestamp >= entry_timestamp` when both present.
  - `is_open=true` cannot coexist with `exit_price`.
  - `contract_type=stock` cannot include options-only fields (`strike_price`, `expiration_date`).
2. `pnl` and `pnl_percentage` formulas must stay consistent across:
  - create/update route auto-calculation
  - import route default calculation
3. Import dedupe identity must include enough dimensions to avoid false duplicate collapse:
  - symbol, date, direction, contract type, entry/exit, size, strike/expiry.

## UI/UX Behavioral Requirements
1. Single confirmation step for delete.
2. Grade action updates local UI state from API response shape.
3. Filters expose open/closed state and map to `isOpen` query param.
4. "Showing X of Y" reflects server total consistently regardless response wrapper shape.

## Storage & Security Requirements
1. `journal-screenshots` bucket must exist with expected MIME/size limits.
2. `storage.objects` RLS must allow authenticated users to insert/select/delete only their own object prefix.
3. Signed URL generation must reject path traversal and cross-user path access.

## Test Plan

### Unit
- `lib/validation/__tests__/journal-entry.test.ts` (schema and constraints).
- Add route-level tests for:
  - screenshot signed upload/read request variants
  - grade response shape contract
  - update invariant enforcement with merged payloads

### Integration/API
- CRUD lifecycle against journal endpoints with authenticated fixture user.
- Import dedupe tests proving distinct trades are not collapsed incorrectly.
- Push subscriptions POST/DELETE behavior.

### E2E
- Existing suites:
  - `e2e/specs/members/journal.spec.ts`
  - `e2e/specs/members/journal-filters.spec.ts`
  - `e2e/specs/members/journal-import.spec.ts`
- Must execute against clean server process started with E2E bypass enabled.

## Deployment Gates
1. All journal unit tests green.
2. Journal API integration tests green.
3. Journal E2E suite green.
4. Manual smoke:
  - upload screenshot
  - create/edit/delete trade
  - import CSV and verify dedupe semantics
  - grade trade and verify UI update
  - apply open/closed filter

## Rollout
1. Apply DB migration for screenshot storage policies.
2. Deploy API and UI together (screenshot/grading contracts are coupled).
3. Run post-deploy smoke on staging.
4. Promote to production with journal monitoring (4xx/5xx rate + upload errors).

## Implementation Status (2026-02-14)

### Completed Fixes
1. Screenshot URL route now supports both upload-sign and read-sign payload modes with user-scoped path enforcement.
2. Upload client now consumes Supabase `signedUrl` response shape correctly.
3. Journal list/get responses standardized with `successResponse(..., meta)` and total fallback handling in UI.
4. Journal update path now enforces merged-payload create invariants in API + server action.
5. Grade route + entry detail sheet now use aligned response keys (`grade`, `ai_analysis`) and single write path.
6. Import dedupe identity expanded to prevent false duplicate collapse.
7. Filter bar now exposes open/closed control.
8. Push subscription POST/DELETE route implemented.
9. R-multiple bucket sort fixed numeric ordering.
10. Screenshot storage bucket/RLS migration added.
11. Backend Sentry bootstrap now initializes before Express import to restore instrumentation order.
12. Root dependency graph now pins `import-in-the-middle@2.0.6` to match Sentry/OpenTelemetry expectations and avoid Next external package skew warnings.
13. Next.js route-guard file migrated from deprecated `middleware.ts` convention to `proxy.ts` with equivalent behavior and matcher coverage.

### Test Evidence
1. `pnpm test:unit` -> pass (`8` files passed, `1` skipped).
2. `pnpm exec tsc --noEmit` -> pass.
3. `pnpm --dir backend build` -> pass.
4. `pnpm --dir backend test --runInBand --silent` -> pass for runnable suites (`57` passed, `17` skipped in socket-restricted environment).
5. `pnpm --dir backend test src/lib/__tests__/circuitBreaker.test.ts src/chatkit/__tests__/functionHandlers.test.ts --runInBand --detectOpenHandles --silent` -> pass (open-handle timeout leaks resolved).
6. `pnpm test:e2e:health` -> pass (`14` passed).
7. `pnpm test:e2e:auth` -> pass (`30` passed, `1` skipped).
8. `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/journal.spec.ts e2e/specs/members/journal-filters.spec.ts e2e/specs/members/journal-import.spec.ts --project=chromium --workers=1` -> pass (`17` passed).
9. Post-remediation warning verification:
   - `pnpm test:e2e:auth` -> pass (`30` passed, `1` skipped), with no Sentry Express instrumentation warning and no `import-in-the-middle` external-package mismatch warning.
10. Proxy migration verification:
   - `pnpm test:e2e:health` -> pass (`14` passed), with no middleware-convention deprecation warning.
   - `pnpm test:e2e:auth` -> pass (`30` passed, `1` skipped).
   - `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/journal.spec.ts e2e/specs/members/journal-filters.spec.ts e2e/specs/members/journal-import.spec.ts --project=chromium --workers=1` -> pass (`17` passed).

### Environment Note
Socket-bound integration suites (supertest/ws) are now guarded by runtime socket capability probing in `backend/jest.setup.js` and `backend/src/testUtils/socketDescribe.ts`.  
They run normally in environments that allow bind/listen, and auto-skip only in restricted sandboxes.

### Residual Operational Risks (Non-blocking for Journal CRUD)
1. Node runtime in this environment is `v20.19.5` while project engine requires Node `>=22`; deployment/runtime parity must be enforced in CI and production.
2. `baseline-browser-mapping` package-age warning appears during webserver startup and should be refreshed in normal dependency maintenance.
