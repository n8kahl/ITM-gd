-- Journal Refactor Phase 1C: Add setup_type column and regime tag documentation
-- Governing spec: docs/specs/TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md
-- This migration is additive only — no breaking changes.

-- Add setup_type column (nullable TEXT, no constraint — values come from SPX setup detector)
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS setup_type TEXT;

-- Index for setup-type queries (filtered to non-null for efficiency)
CREATE INDEX IF NOT EXISTS idx_journal_user_setup_type
  ON public.journal_entries(user_id, setup_type)
  WHERE setup_type IS NOT NULL;

-- Document the expected regime tag structure in market_context JSONB
COMMENT ON COLUMN public.journal_entries.market_context IS
  'JSONB containing market context at time of trade. '
  'Expected regime fields (added by regime tagging service): '
  'vix_bucket (text: "<15", "15-20", "20-30", "30+"), '
  'trend_state (text: "trending_up", "trending_down", "ranging"), '
  'gex_regime (text: "positive_gamma", "negative_gamma", "near_flip"), '
  'time_bucket (text: "open", "mid_morning", "lunch", "power_hour", "close"), '
  'regime_confidence (text: "high", "low"). '
  'Existing fields preserved: entryContext, exitContext, optionsContext, dayContext.';

-- Document setup_type column
COMMENT ON COLUMN public.journal_entries.setup_type IS
  'Setup type from SPX Command Center setup detector. '
  'Common values: Bull Bounce, Bear Rejection, Breakout, Fade, VWAP Reclaim, etc. '
  'Nullable — only populated for trades originating from SPX CC or manually tagged.';
