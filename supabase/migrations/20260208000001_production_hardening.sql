-- =============================================================
-- Production Hardening Migration
-- Addresses: REL-02 (atomic query count), H-09 (indexes),
--            H-12 (CHECK constraints), H-11 (audit trail)
-- =============================================================

-- 1. Atomic query count increment function (REL-02)
CREATE OR REPLACE FUNCTION increment_query_count_if_allowed(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_count INTEGER;
  v_limit INTEGER;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Atomic: SELECT FOR UPDATE + INCREMENT in one transaction
  UPDATE ai_coach_users
  SET query_count = query_count + 1
  WHERE user_id = p_user_id
    AND query_count < query_limit
  RETURNING query_count, query_limit, billing_period_end
  INTO v_count, v_limit, v_period_end;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'query_count', v_count,
      'query_limit', v_limit,
      'billing_period_end', v_period_end
    );
  ELSE
    -- Either user doesn't exist or limit reached
    SELECT query_count, query_limit, billing_period_end
    INTO v_count, v_limit, v_period_end
    FROM ai_coach_users
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
      -- User has no profile, allow (will be created on demand)
      RETURN jsonb_build_object('allowed', true, 'query_count', 0, 'query_limit', 0);
    END IF;

    RETURN jsonb_build_object(
      'allowed', false,
      'query_count', v_count,
      'query_limit', v_limit,
      'billing_period_end', v_period_end
    );
  END IF;
END;
$$;

-- 2. Missing composite indexes (H-09)
CREATE INDEX IF NOT EXISTS idx_ai_coach_messages_session_created
  ON ai_coach_messages (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_coach_sessions_user_updated
  ON ai_coach_sessions (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_coach_users_billing_end
  ON ai_coach_users (billing_period_end)
  WHERE billing_period_end IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_coach_trades_user_date
  ON ai_coach_trades (user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_coach_alerts_user_status
  ON ai_coach_alerts (user_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_coach_positions_user_status
  ON ai_coach_positions (user_id, status);

-- 3. CHECK constraints on financial data (H-12)
-- Use DO blocks to safely add constraints (skip if column doesn't exist)
DO $$
BEGIN
  -- Positions: quantity must be positive
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_positions_quantity_positive'
  ) THEN
    BEGIN
      ALTER TABLE ai_coach_positions
        ADD CONSTRAINT chk_positions_quantity_positive CHECK (quantity > 0);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add quantity constraint: %', SQLERRM;
    END;
  END IF;

  -- Positions: entry_price must be positive
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_positions_entry_price_positive'
  ) THEN
    BEGIN
      ALTER TABLE ai_coach_positions
        ADD CONSTRAINT chk_positions_entry_price_positive CHECK (entry_price > 0);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add entry_price constraint: %', SQLERRM;
    END;
  END IF;

  -- Alerts: target_value must be positive
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_alerts_target_positive'
  ) THEN
    BEGIN
      ALTER TABLE ai_coach_alerts
        ADD CONSTRAINT chk_alerts_target_positive CHECK (target_value > 0);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add target_value constraint: %', SQLERRM;
    END;
  END IF;

  -- Users: billing period end must be after start
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_users_billing_period_valid'
  ) THEN
    BEGIN
      ALTER TABLE ai_coach_users
        ADD CONSTRAINT chk_users_billing_period_valid
        CHECK (billing_period_end > billing_period_start);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add billing period constraint: %', SQLERRM;
    END;
  END IF;

  -- Users: query_count must be non-negative
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_users_query_count_nonneg'
  ) THEN
    BEGIN
      ALTER TABLE ai_coach_users
        ADD CONSTRAINT chk_users_query_count_nonneg CHECK (query_count >= 0);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add query_count constraint: %', SQLERRM;
    END;
  END IF;
END $$;

-- 4. Audit table for critical operations (H-11)
CREATE TABLE IF NOT EXISTS ai_coach_audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
  ON ai_coach_audit_log (table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_user
  ON ai_coach_audit_log (user_id, created_at DESC);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO ai_coach_audit_log (table_name, record_id, action, old_data, user_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), OLD.user_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO ai_coach_audit_log (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO ai_coach_audit_log (table_name, record_id, action, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), NEW.user_id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Apply audit triggers to critical tables
DO $$
BEGIN
  -- Audit trades
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_ai_coach_trades'
  ) THEN
    CREATE TRIGGER audit_ai_coach_trades
      AFTER INSERT OR UPDATE OR DELETE ON ai_coach_trades
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;

  -- Audit sessions
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_ai_coach_sessions'
  ) THEN
    CREATE TRIGGER audit_ai_coach_sessions
      AFTER INSERT OR UPDATE OR DELETE ON ai_coach_sessions
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;

  -- Audit users
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_ai_coach_users'
  ) THEN
    CREATE TRIGGER audit_ai_coach_users
      AFTER INSERT OR UPDATE OR DELETE ON ai_coach_users
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;

  -- Audit alerts
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'audit_ai_coach_alerts'
  ) THEN
    CREATE TRIGGER audit_ai_coach_alerts
      AFTER INSERT OR UPDATE OR DELETE ON ai_coach_alerts
      FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
  END IF;
END $$;

-- 5. RLS on audit log
ALTER TABLE ai_coach_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
  ON ai_coach_audit_log FOR SELECT
  USING (user_id = auth.uid());

-- 6. Data retention: scheduled cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired cache entries
  DELETE FROM ai_coach_levels_cache
  WHERE expires_at < NOW();

  -- Archive audit logs older than 1 year
  DELETE FROM ai_coach_audit_log
  WHERE created_at < NOW() - INTERVAL '1 year';

  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$;
