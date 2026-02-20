-- Guardrails for AI-coach detector tracked setups:
-- 1) Collapse duplicate open setups to one canonical record per user/symbol/setup_type/direction.
-- 2) Auto-invalidate stale active detector setups older than 24h.
-- 3) Enforce uniqueness for future open detector setups.

WITH ranked_open_detector_setups AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, symbol, setup_type, direction
      ORDER BY tracked_at DESC, created_at DESC, id DESC
    ) AS row_num
  FROM ai_coach_tracked_setups
  WHERE status IN ('active', 'triggered')
    AND COALESCE(opportunity_data->'metadata'->>'source', '') = 'setup_detector'
)
UPDATE ai_coach_tracked_setups AS setup
SET
  status = 'invalidated',
  invalidated_at = COALESCE(setup.invalidated_at, NOW()),
  triggered_at = NULL,
  updated_at = NOW(),
  notes = CASE
    WHEN setup.notes IS NULL OR BTRIM(setup.notes) = '' THEN 'Auto-invalidated as superseded duplicate.'
    WHEN setup.notes ILIKE '%superseded duplicate%' THEN setup.notes
    ELSE setup.notes || E'\nAuto-invalidated as superseded duplicate.'
  END
FROM ranked_open_detector_setups AS ranked
WHERE setup.id = ranked.id
  AND ranked.row_num > 1
  AND setup.status IN ('active', 'triggered');

UPDATE ai_coach_tracked_setups AS setup
SET
  status = 'invalidated',
  invalidated_at = COALESCE(setup.invalidated_at, NOW()),
  triggered_at = NULL,
  updated_at = NOW(),
  notes = CASE
    WHEN setup.notes IS NULL OR BTRIM(setup.notes) = '' THEN 'Auto-invalidated due to stale active timeout (24h).'
    WHEN setup.notes ILIKE '%stale active timeout%' THEN setup.notes
    ELSE setup.notes || E'\nAuto-invalidated due to stale active timeout (24h).'
  END
WHERE setup.status = 'active'
  AND COALESCE(setup.opportunity_data->'metadata'->>'source', '') = 'setup_detector'
  AND setup.tracked_at < NOW() - INTERVAL '24 hours';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_setups_open_detector_unique
  ON ai_coach_tracked_setups (user_id, symbol, setup_type, direction)
  WHERE status IN ('active', 'triggered')
    AND COALESCE(opportunity_data->'metadata'->>'source', '') = 'setup_detector';
