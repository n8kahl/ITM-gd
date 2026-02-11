BEGIN;

CREATE OR REPLACE FUNCTION public.compute_trader_dna(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  top_symbols_arr TEXT[] := '{}';
  preferred_strategy_value TEXT;
  avg_hold_minutes_value INTEGER;
  trading_style_value TEXT;
  result JSONB;
BEGIN
  SELECT COALESCE(array_agg(symbol ORDER BY trades_count DESC), '{}')
  INTO top_symbols_arr
  FROM (
    SELECT
      je.symbol,
      COUNT(*) AS trades_count
    FROM public.journal_entries je
    WHERE je.user_id = target_user_id
    GROUP BY je.symbol
    ORDER BY trades_count DESC, je.symbol ASC
    LIMIT 5
  ) ranked_symbols;

  SELECT je.strategy
  INTO preferred_strategy_value
  FROM public.journal_entries je
  WHERE je.user_id = target_user_id
    AND je.strategy IS NOT NULL
    AND je.strategy <> ''
  GROUP BY je.strategy
  ORDER BY COUNT(*) DESC, je.strategy ASC
  LIMIT 1;

  SELECT ROUND(AVG(je.hold_duration_min))::INTEGER
  INTO avg_hold_minutes_value
  FROM public.journal_entries je
  WHERE je.user_id = target_user_id
    AND je.hold_duration_min IS NOT NULL;

  trading_style_value := CASE
    WHEN avg_hold_minutes_value IS NULL THEN NULL
    WHEN avg_hold_minutes_value < 15 THEN 'scalper'
    WHEN avg_hold_minutes_value < 390 THEN 'day_trader'
    WHEN avg_hold_minutes_value < 2880 THEN 'swing_trader'
    ELSE 'position_trader'
  END;

  INSERT INTO public.member_profiles (
    user_id,
    top_symbols,
    preferred_strategy,
    avg_hold_minutes,
    trading_style
  )
  VALUES (
    target_user_id,
    top_symbols_arr,
    preferred_strategy_value,
    avg_hold_minutes_value,
    trading_style_value
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    top_symbols = EXCLUDED.top_symbols,
    preferred_strategy = EXCLUDED.preferred_strategy,
    avg_hold_minutes = EXCLUDED.avg_hold_minutes,
    trading_style = EXCLUDED.trading_style;

  result := jsonb_build_object(
    'top_symbols', to_jsonb(top_symbols_arr),
    'preferred_strategy', preferred_strategy_value,
    'avg_hold_minutes', avg_hold_minutes_value,
    'trading_style', trading_style_value
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_trader_dna(UUID) TO authenticated;

COMMENT ON FUNCTION public.compute_trader_dna IS 'Computes and stores Trader DNA fields in member_profiles for a user';

COMMIT;
