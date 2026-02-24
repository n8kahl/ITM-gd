-- Archive deprecated AI Coach tables after two-panel chat+chart refactor.
-- Keep data for a grace period before any permanent DROP migration.

DO $$
BEGIN
  IF to_regclass('public.ai_coach_alerts') IS NOT NULL
    AND to_regclass('public.archived_ai_coach_alerts') IS NULL THEN
    EXECUTE 'ALTER TABLE public.ai_coach_alerts RENAME TO archived_ai_coach_alerts';
  END IF;

  IF to_regclass('public.ai_coach_watchlists') IS NOT NULL
    AND to_regclass('public.archived_ai_coach_watchlists') IS NULL THEN
    EXECUTE 'ALTER TABLE public.ai_coach_watchlists RENAME TO archived_ai_coach_watchlists';
  END IF;

  IF to_regclass('public.ai_coach_tracked_setups') IS NOT NULL
    AND to_regclass('public.archived_ai_coach_tracked_setups') IS NULL THEN
    EXECUTE 'ALTER TABLE public.ai_coach_tracked_setups RENAME TO archived_ai_coach_tracked_setups';
  END IF;

  IF to_regclass('public.ai_coach_leaps_positions') IS NOT NULL
    AND to_regclass('public.archived_ai_coach_leaps_positions') IS NULL THEN
    EXECUTE 'ALTER TABLE public.ai_coach_leaps_positions RENAME TO archived_ai_coach_leaps_positions';
  END IF;

  IF to_regclass('public.ai_coach_opportunities') IS NOT NULL
    AND to_regclass('public.archived_ai_coach_opportunities') IS NULL THEN
    EXECUTE 'ALTER TABLE public.ai_coach_opportunities RENAME TO archived_ai_coach_opportunities';
  END IF;
END
$$;

DO $$
DECLARE
  table_name text;
  policy_record record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'archived_ai_coach_alerts',
    'archived_ai_coach_watchlists',
    'archived_ai_coach_tracked_setups',
    'archived_ai_coach_leaps_positions',
    'archived_ai_coach_opportunities'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, table_name);
    END LOOP;
  END LOOP;
END
$$;
