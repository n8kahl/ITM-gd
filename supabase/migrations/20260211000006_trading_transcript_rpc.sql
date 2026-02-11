BEGIN;

CREATE OR REPLACE FUNCTION public.get_trading_transcript(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_trades', COUNT(*),
    'winning_trades', COUNT(*) FILTER (WHERE pnl > 0),
    'losing_trades', COUNT(*) FILTER (WHERE pnl < 0),
    'win_rate', CASE
      WHEN COUNT(*) FILTER (WHERE pnl IS NOT NULL) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE pnl > 0)::NUMERIC /
            COUNT(*) FILTER (WHERE pnl IS NOT NULL)::NUMERIC) * 100, 1)
      ELSE NULL
    END,
    'total_pnl', COALESCE(SUM(pnl), 0),
    'profit_factor', CASE
      WHEN ABS(COALESCE(SUM(pnl) FILTER (WHERE pnl < 0), 0)) > 0
      THEN ROUND(COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0) /
            ABS(SUM(pnl) FILTER (WHERE pnl < 0)), 2)
      ELSE NULL
    END,
    'avg_pnl', ROUND(AVG(pnl), 2),
    'best_trade_pnl', MAX(pnl),
    'worst_trade_pnl', MIN(pnl),
    'most_profitable_symbol', (
      SELECT symbol FROM public.journal_entries
      WHERE user_id = target_user_id AND is_open = false
      GROUP BY symbol ORDER BY SUM(pnl) DESC LIMIT 1
    ),
    'most_traded_symbol', (
      SELECT symbol FROM public.journal_entries
      WHERE user_id = target_user_id
      GROUP BY symbol ORDER BY COUNT(*) DESC LIMIT 1
    ),
    'avg_discipline_score', ROUND(AVG(discipline_score), 1),
    'avg_hold_duration_min', ROUND(AVG(hold_duration_min)),
    'ai_grade_distribution', (
      SELECT COALESCE(jsonb_object_agg(grade, cnt), '{}'::jsonb)
      FROM (
        SELECT ai_analysis->>'grade' AS grade, COUNT(*) AS cnt
        FROM public.journal_entries
        WHERE user_id = target_user_id AND ai_analysis IS NOT NULL
        GROUP BY ai_analysis->>'grade'
      ) grades
    )
  ) INTO result
  FROM public.journal_entries
  WHERE user_id = target_user_id AND is_open = false;

  -- Add equity curve (last 90 data points)
  result = result || jsonb_build_object('equity_curve', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'date', trade_date::date,
      'cumulative_pnl', running_pnl
    ) ORDER BY trade_date), '[]'::jsonb)
    FROM (
      SELECT trade_date,
             SUM(pnl) OVER (ORDER BY trade_date) AS running_pnl
      FROM public.journal_entries
      WHERE user_id = target_user_id AND pnl IS NOT NULL AND is_open = false
      ORDER BY trade_date DESC
      LIMIT 90
    ) curve
  ));

  -- Add streak data
  result = result || jsonb_build_object(
    'current_win_streak', (
      SELECT COUNT(*)
      FROM (
        SELECT pnl, ROW_NUMBER() OVER (ORDER BY trade_date DESC) AS rn
        FROM public.journal_entries
        WHERE user_id = target_user_id AND pnl IS NOT NULL AND is_open = false
      ) recent
      WHERE pnl > 0
      AND rn = (
        SELECT MIN(rn) FROM (
          SELECT pnl, ROW_NUMBER() OVER (ORDER BY trade_date DESC) AS rn
          FROM public.journal_entries
          WHERE user_id = target_user_id AND pnl IS NOT NULL AND is_open = false
        ) inner_q WHERE pnl > 0
      ) + rn - (
        SELECT MIN(rn) FROM (
          SELECT pnl, ROW_NUMBER() OVER (ORDER BY trade_date DESC) AS rn
          FROM public.journal_entries
          WHERE user_id = target_user_id AND pnl IS NOT NULL AND is_open = false
        ) inner_q WHERE pnl > 0
      )
    ),
    'longest_win_streak', 0  -- Simplified; compute in application layer
  );

  -- Compute best month
  result = result || jsonb_build_object('best_month', (
    SELECT TO_CHAR(trade_date, 'Mon YYYY')
    FROM public.journal_entries
    WHERE user_id = target_user_id AND pnl IS NOT NULL AND is_open = false
    GROUP BY TO_CHAR(trade_date, 'Mon YYYY'), DATE_TRUNC('month', trade_date)
    ORDER BY SUM(pnl) DESC
    LIMIT 1
  ));

  -- Compute avg AI grade
  result = result || jsonb_build_object('avg_ai_grade', (
    SELECT CASE
      WHEN AVG(CASE
        WHEN ai_analysis->>'grade' = 'A' THEN 4
        WHEN ai_analysis->>'grade' = 'B' THEN 3
        WHEN ai_analysis->>'grade' = 'C' THEN 2
        WHEN ai_analysis->>'grade' = 'D' THEN 1
        WHEN ai_analysis->>'grade' = 'F' THEN 0
        ELSE NULL
      END) >= 3.5 THEN 'A'
      WHEN AVG(CASE
        WHEN ai_analysis->>'grade' = 'A' THEN 4
        WHEN ai_analysis->>'grade' = 'B' THEN 3
        WHEN ai_analysis->>'grade' = 'C' THEN 2
        WHEN ai_analysis->>'grade' = 'D' THEN 1
        WHEN ai_analysis->>'grade' = 'F' THEN 0
        ELSE NULL
      END) >= 2.5 THEN 'B'
      WHEN AVG(CASE
        WHEN ai_analysis->>'grade' = 'A' THEN 4
        WHEN ai_analysis->>'grade' = 'B' THEN 3
        WHEN ai_analysis->>'grade' = 'C' THEN 2
        WHEN ai_analysis->>'grade' = 'D' THEN 1
        WHEN ai_analysis->>'grade' = 'F' THEN 0
        ELSE NULL
      END) >= 1.5 THEN 'C'
      WHEN AVG(CASE
        WHEN ai_analysis->>'grade' = 'A' THEN 4
        WHEN ai_analysis->>'grade' = 'B' THEN 3
        WHEN ai_analysis->>'grade' = 'C' THEN 2
        WHEN ai_analysis->>'grade' = 'D' THEN 1
        WHEN ai_analysis->>'grade' = 'F' THEN 0
        ELSE NULL
      END) >= 0.5 THEN 'D'
      ELSE 'F'
    END
    FROM public.journal_entries
    WHERE user_id = target_user_id AND ai_analysis IS NOT NULL
  ));

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_trading_transcript(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_trading_transcript IS 'Compute trading transcript stats for a user from journal entries';

COMMIT;
