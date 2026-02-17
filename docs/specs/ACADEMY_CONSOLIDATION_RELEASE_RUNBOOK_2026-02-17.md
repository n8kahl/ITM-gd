# Academy Consolidation Release Runbook (2026-02-17)

## Goal

Complete academy cutover to `academy_*` tables, preserve legacy data via archive snapshots, and retire legacy academy runtime tables.

## Preconditions

- Service role credentials available for migration execution.
- Full database backup/snapshot created before destructive DDL.
- Application release containing academy_v3 runtime/admin changes is deployed first.

## Migration Order

1. Apply backfill migration:
   - `supabase/migrations/20260322010000_academy_v3_legacy_progress_backfill.sql`
2. Run backfill verification SQL:
   - `docs/specs/ACADEMY_V3_LEGACY_BACKFILL_VERIFICATION.sql`
3. Review results and confirm:
   - `legacy_users_missing_in_v3 = 0`
   - dedupe check returns zero rows
4. Apply retirement migration:
   - `supabase/migrations/20260322020000_academy_legacy_table_retirement.sql`
5. Run retirement verification SQL:
   - `docs/specs/ACADEMY_LEGACY_RETIREMENT_VERIFICATION.sql`

## App-Level Validation

Run:

```bash
pnpm exec tsc --noEmit
```

```bash
pnpm exec vitest run lib/__tests__/member-navigation.test.ts lib/academy-v3/__tests__/frontend-contracts.test.ts lib/academy-v3/__tests__/admin-api-targets.test.ts lib/academy-v3/__tests__/consolidation-integrity.test.ts lib/academy-v3/__tests__/no-legacy-runtime-references.test.ts
```

Optional smoke e2e:

```bash
pnpm exec playwright test e2e/specs/members/academy-layout.spec.ts --project=chromium --workers=1
```

## Rollback Notes

- Runtime rollback: redeploy previous app build.
- Data rollback: restore backup snapshot taken pre-retirement.
- Archived tables remain in `academy_legacy_archive` after retirement migration for historical recovery.
