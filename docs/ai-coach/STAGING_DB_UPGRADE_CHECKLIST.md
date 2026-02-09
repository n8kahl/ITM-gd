# AI Coach Staging DB Upgrade Checklist

Use this checklist to deploy the current upgrade safely to **staging first**.

## Scope of this upgrade

This rollout includes:
- Journal security hardening for legacy tables (`trading_journal_entries`, `journal_streaks`)
- Backfill from legacy journal table into canonical `journal_entries`
- New V2 AI Coach tables:
  - `ai_coach_morning_briefs`
  - `ai_coach_detected_setups`
  - `ai_coach_watchlists`
  - `ai_coach_tracked_setups`
  - `ai_coach_earnings_cache`
  - `ai_coach_journal_insights`
  - `ai_coach_user_preferences`
- New columns on `ai_coach_trades`:
  - `draft_status`
  - `auto_generated`
  - `session_context`
- Journal API routes switched to canonical `journal_entries`

## Files included

- `/Users/natekahl/ITM-gd/supabase/migrations/20260304100000_journal_security_and_backfill.sql`
- `/Users/natekahl/ITM-gd/supabase/migrations/20260304103000_ai_coach_v2_tables.sql`
- `/Users/natekahl/ITM-gd/supabase/migrations/20260304110000_ai_coach_tracked_setups.sql`
- `/Users/natekahl/ITM-gd/app/api/members/journal/route.ts`
- `/Users/natekahl/ITM-gd/app/api/members/journal/enrich/route.ts`
- `/Users/natekahl/ITM-gd/app/api/members/journal/replay/[entryId]/route.ts`

## Step 1: Pre-deploy safety

1. Confirm you are on the correct branch and no unrelated changes are included.
2. Create a database backup/snapshot in Supabase dashboard.
3. Confirm this target is staging, not production.

## Step 2: Preview migrations

Run:

```bash
cd /Users/natekahl/ITM-gd
supabase db push --linked --dry-run --include-all
```

Expected:
- You should see new migrations listed:
  - `20260304100000_journal_security_and_backfill.sql`
  - `20260304103000_ai_coach_v2_tables.sql`
  - `20260304110000_ai_coach_tracked_setups.sql`

Note:
- This repo currently has legacy migration-history drift (older migrations may appear "pending" even when DB objects already exist).
- If that happens, run this deployment in a controlled mode that applies only the target migrations for this release.

## Step 3: Apply migrations to staging

Run:

```bash
cd /Users/natekahl/ITM-gd
supabase db push --linked --include-all
```

## Step 4: Verify schema and security

Run these in Supabase SQL Editor (staging):

```sql
-- New V2 tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'ai_coach_morning_briefs',
    'ai_coach_detected_setups',
    'ai_coach_watchlists',
    'ai_coach_tracked_setups',
    'ai_coach_earnings_cache',
    'ai_coach_journal_insights',
    'ai_coach_user_preferences'
  )
order by table_name;

-- Trade columns exist
select column_name
from information_schema.columns
where table_name = 'ai_coach_trades'
  and column_name in ('draft_status', 'auto_generated', 'session_context')
order by column_name;

-- Legacy RLS policies are hardened (no USING true read policy)
select policyname, tablename
from pg_policies
where schemaname = 'public'
  and tablename in ('trading_journal_entries', 'journal_streaks')
order by tablename, policyname;

-- Backfill result (legacy UUID rows copied to canonical table)
select
  (select count(*) from trading_journal_entries where user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') as legacy_uuid_rows,
  (select count(*) from journal_entries) as canonical_rows;
```

## Step 5: Smoke test app behavior on staging

1. Open journal page.
2. Create a new trade entry.
3. Confirm entry appears in journal list.
4. Edit that entry and save.
5. Open replay view for the entry.
6. Trigger enrich call and confirm no API error.
7. Confirm dashboard stats still load.

## Step 6: Rollback plan (if needed)

If staging has issues:
- Revert app code deployment.
- Restore DB snapshot from Step 1.
- Investigate and patch forward with a new migration (do not edit existing migrations in place).
