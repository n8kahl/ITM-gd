BEGIN;

CREATE OR REPLACE FUNCTION public.get_trading_transcript(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  transcript JSONB;
BEGIN
  WITH closed_trades AS (
    SELECT
      je.id,
      je.trade_date,
      je.created_at,
      je.symbol,
      je.pnl,
      je.discipline_score,
      je.hold_duration_min,
      je.ai_analysis
    FROM public.journal_entries je
    WHERE je.user_id = target_user_id
      AND je.is_open = false
  ),
  metrics AS (
    SELECT
      COUNT(*)::INTEGER AS total_trades,
      COUNT(*) FILTER (WHERE pnl > 0)::INTEGER AS winning_trades,
      COUNT(*) FILTER (WHERE pnl < 0)::INTEGER AS losing_trades,
      CASE
        WHEN COUNT(*) FILTER (WHERE pnl IS NOT NULL) > 0
          THEN ROUND(
            (
              COUNT(*) FILTER (WHERE pnl > 0)::NUMERIC
              / COUNT(*) FILTER (WHERE pnl IS NOT NULL)::NUMERIC
            ) * 100,
            1
          )
        ELSE NULL
      END AS win_rate,
      COALESCE(SUM(pnl), 0)::NUMERIC(12,2) AS total_pnl,
      CASE
        WHEN ABS(COALESCE(SUM(pnl) FILTER (WHERE pnl < 0), 0)) > 0
          THEN ROUND(
            COALESCE(SUM(pnl) FILTER (WHERE pnl > 0), 0)
            / ABS(SUM(pnl) FILTER (WHERE pnl < 0)),
            2
          )
        ELSE NULL
      END AS profit_factor,
      ROUND(AVG(pnl), 2) AS avg_pnl,
      MAX(pnl) AS best_trade_pnl,
      MIN(pnl) AS worst_trade_pnl,
      ROUND(AVG(discipline_score), 1) AS avg_discipline_score,
      ROUND(AVG(hold_duration_min))::INTEGER AS avg_hold_duration_min
    FROM closed_trades
  ),
  current_streak_calc AS (
    SELECT
      COALESCE(
        COUNT(*) FILTER (
          WHERE rn < COALESCE(first_non_win_rn, max_rn + 1) AND pnl > 0
        ),
        0
      )::INTEGER AS current_win_streak
    FROM (
      SELECT
        pnl,
        rn,
        MAX(rn) OVER () AS max_rn,
        MIN(CASE WHEN pnl <= 0 THEN rn END) OVER () AS first_non_win_rn
      FROM (
        SELECT
          ct.pnl,
          ROW_NUMBER() OVER (ORDER BY ct.trade_date DESC, ct.created_at DESC, ct.id DESC) AS rn
        FROM closed_trades ct
        WHERE ct.pnl IS NOT NULL
      ) ranked
    ) with_boundaries
  ),
  longest_streak_calc AS (
    SELECT COALESCE(MAX(run_len), 0)::INTEGER AS longest_win_streak
    FROM (
      SELECT
        (rn_all - rn_is_win) AS grp,
        COUNT(*)::INTEGER AS run_len
      FROM (
        SELECT
          ct.pnl,
          ROW_NUMBER() OVER (ORDER BY ct.trade_date, ct.created_at, ct.id) AS rn_all,
          ROW_NUMBER() OVER (
            PARTITION BY (ct.pnl > 0)
            ORDER BY ct.trade_date, ct.created_at, ct.id
          ) AS rn_is_win
        FROM closed_trades ct
        WHERE ct.pnl IS NOT NULL
      ) ranked
      WHERE pnl > 0
      GROUP BY (rn_all - rn_is_win)
    ) runs
  ),
  best_month_calc AS (
    SELECT TO_CHAR(month_bucket, 'Mon YYYY') AS best_month
    FROM (
      SELECT
        DATE_TRUNC('month', ct.trade_date) AS month_bucket,
        SUM(ct.pnl) AS month_pnl
      FROM closed_trades ct
      WHERE ct.pnl IS NOT NULL
      GROUP BY DATE_TRUNC('month', ct.trade_date)
    ) month_scores
    ORDER BY month_pnl DESC, month_bucket DESC
    LIMIT 1
  ),
  symbol_calc AS (
    SELECT
      (
        SELECT ct.symbol
        FROM closed_trades ct
        WHERE ct.pnl IS NOT NULL
        GROUP BY ct.symbol
        ORDER BY SUM(ct.pnl) DESC, ct.symbol ASC
        LIMIT 1
      ) AS most_profitable_symbol,
      (
        SELECT ct.symbol
        FROM closed_trades ct
        GROUP BY ct.symbol
        ORDER BY COUNT(*) DESC, ct.symbol ASC
        LIMIT 1
      ) AS most_traded_symbol
  ),
  ai_distribution AS (
    SELECT COALESCE(
      jsonb_object_agg(grade, grade_count),
      '{}'::jsonb
    ) AS ai_grade_distribution
    FROM (
      SELECT
        ct.ai_analysis->>'grade' AS grade,
        COUNT(*)::INTEGER AS grade_count
      FROM closed_trades ct
      WHERE ct.ai_analysis IS NOT NULL
        AND ct.ai_analysis->>'grade' IS NOT NULL
      GROUP BY ct.ai_analysis->>'grade'
    ) grouped
  ),
  ai_average AS (
    SELECT
      CASE
        WHEN AVG(grade_score) IS NULL THEN NULL
        WHEN AVG(grade_score) >= 3.5 THEN 'A'
        WHEN AVG(grade_score) >= 2.5 THEN 'B'
        WHEN AVG(grade_score) >= 1.5 THEN 'C'
        WHEN AVG(grade_score) >= 0.5 THEN 'D'
        ELSE 'F'
      END AS avg_ai_grade
    FROM (
      SELECT
        CASE
          WHEN ct.ai_analysis->>'grade' = 'A' THEN 4
          WHEN ct.ai_analysis->>'grade' = 'B' THEN 3
          WHEN ct.ai_analysis->>'grade' = 'C' THEN 2
          WHEN ct.ai_analysis->>'grade' = 'D' THEN 1
          WHEN ct.ai_analysis->>'grade' = 'F' THEN 0
          ELSE NULL
        END AS grade_score
      FROM closed_trades ct
      WHERE ct.ai_analysis IS NOT NULL
    ) scores
  ),
  equity_curve_calc AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', point.trade_day,
          'cumulative_pnl', ROUND(point.cumulative_pnl, 2)
        )
        ORDER BY point.trade_day
      ),
      '[]'::jsonb
    ) AS equity_curve
    FROM (
      SELECT
        ordered.trade_day,
        SUM(ordered.pnl) OVER (ORDER BY ordered.trade_day) AS cumulative_pnl
      FROM (
        SELECT
          recent.trade_day,
          recent.pnl
        FROM (
          SELECT
            ct.trade_date::date AS trade_day,
            ct.pnl
          FROM closed_trades ct
          WHERE ct.pnl IS NOT NULL
          ORDER BY ct.trade_date DESC, ct.created_at DESC, ct.id DESC
          LIMIT 90
        ) recent
        ORDER BY recent.trade_day ASC
      ) ordered
    ) point
  )
  SELECT jsonb_build_object(
    'total_trades', metrics.total_trades,
    'winning_trades', metrics.winning_trades,
    'losing_trades', metrics.losing_trades,
    'win_rate', metrics.win_rate,
    'total_pnl', metrics.total_pnl,
    'profit_factor', metrics.profit_factor,
    'avg_pnl', metrics.avg_pnl,
    'best_trade_pnl', metrics.best_trade_pnl,
    'worst_trade_pnl', metrics.worst_trade_pnl,
    'best_month', best_month_calc.best_month,
    'current_win_streak', current_streak_calc.current_win_streak,
    'longest_win_streak', longest_streak_calc.longest_win_streak,
    'avg_discipline_score', metrics.avg_discipline_score,
    'avg_ai_grade', ai_average.avg_ai_grade,
    'ai_grade_distribution', ai_distribution.ai_grade_distribution,
    'most_profitable_symbol', symbol_calc.most_profitable_symbol,
    'most_traded_symbol', symbol_calc.most_traded_symbol,
    'avg_hold_duration_min', metrics.avg_hold_duration_min,
    'equity_curve', equity_curve_calc.equity_curve
  )
  INTO transcript
  FROM metrics
  CROSS JOIN current_streak_calc
  CROSS JOIN longest_streak_calc
  CROSS JOIN ai_distribution
  CROSS JOIN ai_average
  CROSS JOIN symbol_calc
  CROSS JOIN equity_curve_calc
  LEFT JOIN best_month_calc ON true;

  RETURN transcript;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trading_transcript(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_trading_transcript IS 'Aggregates trading transcript metrics from journal_entries for a specific user';

COMMIT;
