-- Phase 6 Slice 6.3: Drop archived AI Coach tables
-- These tables were archived during the AI Coach V2 rebuild and confirmed
-- to have zero active queries or code references.
-- Backup should be taken before applying this migration.

DROP TABLE IF EXISTS archived_ai_coach_alerts;
DROP TABLE IF EXISTS archived_ai_coach_watchlists;
DROP TABLE IF EXISTS archived_ai_coach_tracked_setups;
DROP TABLE IF EXISTS archived_ai_coach_leaps_positions;
DROP TABLE IF EXISTS archived_ai_coach_opportunities;
