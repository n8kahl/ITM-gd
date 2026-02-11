BEGIN;

CREATE OR REPLACE FUNCTION public.compute_trader_dna(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'top_symbols', (
      SELECT COALESCE(array_agg(symbol ORDER BY cnt DESC), '{}')
      FROM (
        SELECT symbol, COUNT(*) AS cnt
        FROM public.journal_entries
        WHERE user_id = target_user_id
        GROUP BY symbol
        ORDER BY cnt DESC
        LIMIT 5
      ) top
    ),
    'preferred_strategy', (
      SELECT strategy
      FROM public.journal_entries
      WHERE user_id = target_user_id AND strategy IS NOT NULL
      GROUP BY strategy
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    'avg_hold_minutes', (
      SELECT ROUND(AVG(hold_duration_min))::INTEGER
      FROM public.journal_entries
      WHERE user_id = target_user_id AND hold_duration_min IS NOT NULL
    ),
    'trading_style', CASE
      WHEN (SELECT AVG(hold_duration_min) FROM public.journal_entries
            WHERE user_id = target_user_id AND hold_duration_min IS NOT NULL) < 15
        THEN 'scalper'
      WHEN (SELECT AVG(hold_duration_min) FROM public.journal_entries
            WHERE user_id = target_user_id AND hold_duration_min IS NOT NULL) < 390
        THEN 'day_trader'
      WHEN (SELECT AVG(hold_duration_min) FROM public.journal_entries
            WHERE user_id = target_user_id AND hold_duration_min IS NOT NULL) < 2880
        THEN 'swing_trader'
      ELSE 'position_trader'
    END
  ) INTO result;

  -- Update member_profiles with computed DNA
  UPDATE public.member_profiles
  SET
    top_symbols = (result->>'top_symbols')::text[],
    preferred_strategy = result->>'preferred_strategy',
    avg_hold_minutes = (result->>'avg_hold_minutes')::integer,
    trading_style = result->>'trading_style'
  WHERE user_id = target_user_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_trader_dna(UUID) TO authenticated;

COMMIT;
