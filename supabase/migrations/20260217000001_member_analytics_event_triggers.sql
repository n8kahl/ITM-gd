-- Auto-populate member_analytics_events from core user activity tables.

CREATE OR REPLACE FUNCTION insert_member_analytics_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_event_type IS NULL OR p_event_type = '' THEN
    RETURN;
  END IF;

  INSERT INTO member_analytics_events (user_id, event_type, event_data)
  VALUES (p_user_id, p_event_type, COALESCE(p_event_data, '{}'::jsonb));
END;
$$;

-- Journal entry created
CREATE OR REPLACE FUNCTION trg_member_event_journal_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM insert_member_analytics_event(
    NEW.user_id,
    'journal_entry_created',
    jsonb_build_object(
      'entry_id', NEW.id,
      'symbol', NEW.symbol,
      'trade_date', NEW.trade_date
    )
  );

  IF COALESCE(NEW.screenshot_storage_path, '') <> '' OR COALESCE(NEW.screenshot_url, '') <> '' THEN
    PERFORM insert_member_analytics_event(
      NEW.user_id,
      'screenshot_uploaded',
      jsonb_build_object(
        'entry_id', NEW.id,
        'symbol', NEW.symbol,
        'storage_path', NEW.screenshot_storage_path
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_member_event_journal_created ON journal_entries;
CREATE TRIGGER tr_member_event_journal_created
  AFTER INSERT ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION trg_member_event_journal_created();

-- Journal entry analyzed (AI analysis transitions from null to non-null)
CREATE OR REPLACE FUNCTION trg_member_event_journal_analyzed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.ai_analysis IS NULL AND NEW.ai_analysis IS NOT NULL THEN
    PERFORM insert_member_analytics_event(
      NEW.user_id,
      'journal_entry_analyzed',
      jsonb_build_object(
        'entry_id', NEW.id,
        'symbol', NEW.symbol,
        'trade_date', NEW.trade_date
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_member_event_journal_analyzed ON journal_entries;
CREATE TRIGGER tr_member_event_journal_analyzed
  AFTER UPDATE OF ai_analysis ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION trg_member_event_journal_analyzed();

-- Screenshot uploaded (storage path or url transitions from null to non-null)
CREATE OR REPLACE FUNCTION trg_member_event_screenshot_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    (COALESCE(OLD.screenshot_storage_path, '') = '' AND COALESCE(NEW.screenshot_storage_path, '') <> '')
    OR (COALESCE(OLD.screenshot_url, '') = '' AND COALESCE(NEW.screenshot_url, '') <> '')
  ) THEN
    PERFORM insert_member_analytics_event(
      NEW.user_id,
      'screenshot_uploaded',
      jsonb_build_object(
        'entry_id', NEW.id,
        'symbol', NEW.symbol,
        'storage_path', NEW.screenshot_storage_path
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_member_event_screenshot_uploaded ON journal_entries;
CREATE TRIGGER tr_member_event_screenshot_uploaded
  AFTER UPDATE OF screenshot_storage_path, screenshot_url ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION trg_member_event_screenshot_uploaded();

-- AI coach session started
CREATE OR REPLACE FUNCTION trg_member_event_ai_coach_session_started()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM insert_member_analytics_event(
    NEW.user_id,
    'ai_coach_session_started',
    jsonb_build_object(
      'session_id', NEW.id,
      'message_count', NEW.message_count
    )
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.ai_coach_sessions') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tr_member_event_ai_coach_session_started ON ai_coach_sessions;
    CREATE TRIGGER tr_member_event_ai_coach_session_started
      AFTER INSERT ON ai_coach_sessions
      FOR EACH ROW
      EXECUTE FUNCTION trg_member_event_ai_coach_session_started();
  END IF;
END;
$$;

-- Trade shared
CREATE OR REPLACE FUNCTION trg_member_event_trade_shared()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM insert_member_analytics_event(
    NEW.user_id,
    'trade_shared',
    jsonb_build_object(
      'shared_trade_card_id', NEW.id,
      'journal_entry_id', NEW.journal_entry_id
    )
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.shared_trade_cards') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tr_member_event_trade_shared ON shared_trade_cards;
    CREATE TRIGGER tr_member_event_trade_shared
      AFTER INSERT ON shared_trade_cards
      FOR EACH ROW
      EXECUTE FUNCTION trg_member_event_trade_shared();
  END IF;
END;
$$;

-- Lesson completed (legacy academy table)
CREATE OR REPLACE FUNCTION trg_member_event_lesson_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    PERFORM insert_member_analytics_event(
      NEW.user_id,
      'lesson_completed',
      jsonb_build_object(
        'lesson_id', NEW.lesson_id,
        'course_id', NEW.course_id,
        'completed_at', NEW.completed_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.user_lesson_progress') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tr_member_event_lesson_completed ON user_lesson_progress;
    CREATE TRIGGER tr_member_event_lesson_completed
      AFTER UPDATE OF completed_at ON user_lesson_progress
      FOR EACH ROW
      EXECUTE FUNCTION trg_member_event_lesson_completed();
  END IF;
END;
$$;

-- Lesson completed (academy-v3 attempts table)
CREATE OR REPLACE FUNCTION trg_member_event_academy_attempt_passed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'passed' AND COALESCE(OLD.status::TEXT, '') <> 'passed' THEN
    PERFORM insert_member_analytics_event(
      NEW.user_id,
      'lesson_completed',
      jsonb_build_object(
        'lesson_id', NEW.lesson_id,
        'attempt_id', NEW.id,
        'completed_at', NEW.completed_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.academy_user_lesson_attempts') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tr_member_event_academy_attempt_passed ON academy_user_lesson_attempts;
    CREATE TRIGGER tr_member_event_academy_attempt_passed
      AFTER INSERT OR UPDATE OF status ON academy_user_lesson_attempts
      FOR EACH ROW
      EXECUTE FUNCTION trg_member_event_academy_attempt_passed();
  END IF;
END;
$$;
