-- Phase 6 Slice 6.4: Drop legacy academy archive schema
-- The academy_legacy_archive schema contains 9 tables from the original
-- academy implementation. All data was migrated to the V3 schema and
-- confirmed to have zero active queries or code references.
-- Backup should be taken before applying this migration.

DROP SCHEMA IF EXISTS academy_legacy_archive CASCADE;
