-- Same-Day Replay Session 1b (Phase 1 closeout hotfix)
-- Add SPX symbol profile seed and FK covering indexes.

INSERT INTO public.symbol_profiles (
  symbol,
  display_name,
  round_number_interval,
  opening_range_minutes,
  level_cluster_radius,
  gex_scaling_factor,
  gex_cross_symbol,
  gex_strike_window,
  flow_min_premium,
  flow_min_volume,
  flow_directional_min,
  mtf_ema_fast,
  mtf_ema_slow,
  mtf_1h_weight,
  mtf_15m_weight,
  mtf_5m_weight,
  mtf_1m_weight,
  regime_breakout_threshold,
  regime_compression_threshold,
  massive_ticker,
  massive_options_ticker,
  is_active
)
VALUES (
  'SPX',
  'S&P 500 Index',
  50,
  30,
  3.0,
  0.1,
  'SPY',
  220,
  10000,
  10,
  50000,
  21,
  55,
  0.55,
  0.20,
  0.15,
  0.10,
  0.7,
  0.65,
  'I:SPX',
  'O:SPX*',
  true
)
ON CONFLICT (symbol)
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  round_number_interval = EXCLUDED.round_number_interval,
  opening_range_minutes = EXCLUDED.opening_range_minutes,
  level_cluster_radius = EXCLUDED.level_cluster_radius,
  gex_scaling_factor = EXCLUDED.gex_scaling_factor,
  gex_cross_symbol = EXCLUDED.gex_cross_symbol,
  gex_strike_window = EXCLUDED.gex_strike_window,
  flow_min_premium = EXCLUDED.flow_min_premium,
  flow_min_volume = EXCLUDED.flow_min_volume,
  flow_directional_min = EXCLUDED.flow_directional_min,
  mtf_ema_fast = EXCLUDED.mtf_ema_fast,
  mtf_ema_slow = EXCLUDED.mtf_ema_slow,
  mtf_1h_weight = EXCLUDED.mtf_1h_weight,
  mtf_15m_weight = EXCLUDED.mtf_15m_weight,
  mtf_5m_weight = EXCLUDED.mtf_5m_weight,
  mtf_1m_weight = EXCLUDED.mtf_1m_weight,
  regime_breakout_threshold = EXCLUDED.regime_breakout_threshold,
  regime_compression_threshold = EXCLUDED.regime_compression_threshold,
  massive_ticker = EXCLUDED.massive_ticker,
  massive_options_ticker = EXCLUDED.massive_options_ticker,
  is_active = EXCLUDED.is_active,
  updated_at = now();

CREATE INDEX IF NOT EXISTS idx_discord_parsed_trades_entry_snapshot_id
  ON public.discord_parsed_trades (entry_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_replay_drill_results_parsed_trade_id
  ON public.replay_drill_results (parsed_trade_id);
