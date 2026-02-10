ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS entry_timestamp TIMESTAMPTZ;

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS exit_timestamp TIMESTAMPTZ;
