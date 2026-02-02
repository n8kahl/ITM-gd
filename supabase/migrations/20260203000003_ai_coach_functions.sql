-- Function: Reset Query Count Monthly
-- This function resets query counts for all users whose billing period has ended
CREATE OR REPLACE FUNCTION reset_query_counts()
RETURNS void AS $$
BEGIN
  UPDATE ai_coach_users
  SET
    query_count = 0,
    billing_period_start = now(),
    billing_period_end = now() + interval '1 month'
  WHERE billing_period_end < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Calculate Portfolio Greeks
-- Returns aggregated Greeks for all open positions of a user
CREATE OR REPLACE FUNCTION calculate_portfolio_greeks(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'netDelta', COALESCE(SUM((greeks->>'delta')::DECIMAL * quantity), 0),
    'netGamma', COALESCE(SUM((greeks->>'gamma')::DECIMAL * quantity), 0),
    'netTheta', COALESCE(SUM((greeks->>'theta')::DECIMAL * quantity), 0),
    'netVega', COALESCE(SUM((greeks->>'vega')::DECIMAL * quantity), 0),
    'positionCount', COUNT(*),
    'totalValue', COALESCE(SUM(current_value), 0),
    'totalPnl', COALESCE(SUM(pnl), 0)
  ) INTO result
  FROM ai_coach_positions
  WHERE user_id = p_user_id
    AND status = 'open'
    AND greeks IS NOT NULL;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Auto-Generate Trade from Closed Position
-- Trigger function that creates a trade journal entry when a position is closed
CREATE OR REPLACE FUNCTION position_to_trade()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create trade if position was just closed
  IF NEW.status = 'closed' AND OLD.status = 'open' THEN
    INSERT INTO ai_coach_trades (
      user_id,
      symbol,
      position_type,
      strategy,
      entry_date,
      entry_price,
      exit_date,
      exit_price,
      quantity,
      pnl,
      pnl_pct,
      hold_time_days,
      trade_outcome
    ) VALUES (
      NEW.user_id,
      NEW.symbol,
      NEW.position_type,
      NEW.position_type, -- Could be enhanced with strategy mapping
      NEW.entry_date,
      NEW.entry_price,
      NEW.close_date,
      NEW.close_price,
      NEW.quantity,
      NEW.pnl,
      NEW.pnl_pct,
      EXTRACT(DAY FROM (NEW.close_date - NEW.entry_date))::INTEGER,
      CASE
        WHEN NEW.pnl > 0 THEN 'win'
        WHEN NEW.pnl < 0 THEN 'loss'
        ELSE 'breakeven'
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-create trade when position is closed
CREATE TRIGGER position_closed_trigger
  AFTER UPDATE ON ai_coach_positions
  FOR EACH ROW
  EXECUTE FUNCTION position_to_trade();

-- Function: Update position metrics
-- Automatically calculate current_value, pnl, and pnl_pct when current_price changes
CREATE OR REPLACE FUNCTION update_position_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if current_price changed and position is open
  IF NEW.current_price IS NOT NULL AND NEW.status = 'open' THEN
    NEW.current_value := NEW.quantity * NEW.current_price * 100;
    NEW.pnl := (NEW.current_price - NEW.entry_price) * NEW.quantity * 100;
    NEW.pnl_pct := ((NEW.current_price - NEW.entry_price) / NEW.entry_price * 100)::DECIMAL(5,2);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update position metrics
CREATE TRIGGER update_position_metrics_trigger
  BEFORE UPDATE ON ai_coach_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_position_metrics();

-- Function: Update session message count
-- Increments message count when a new message is added to a session
CREATE OR REPLACE FUNCTION increment_session_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_coach_sessions
  SET
    message_count = message_count + 1,
    updated_at = now()
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-increment session message count
CREATE TRIGGER increment_session_message_count_trigger
  AFTER INSERT ON ai_coach_messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_session_message_count();

-- Function: Clean expired cache entries
-- Removes expired entries from levels cache
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_coach_levels_cache
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment: Schedule clean_expired_cache() to run daily using pg_cron or external scheduler
