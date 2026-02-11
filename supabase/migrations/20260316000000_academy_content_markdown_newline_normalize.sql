-- ============================================================================
-- File: 20260316000000_academy_content_markdown_newline_normalize.sql
-- Purpose: Normalize mistakenly-escaped newlines in Academy lesson markdown.
-- Notes: Some lessons have literal "\n" sequences in content_markdown, which
--        renders as backslash-n in the UI. This migration converts them to
--        real newline characters.
-- ============================================================================

BEGIN;

UPDATE public.lessons
SET content_markdown = replace(content_markdown, chr(92) || 'n', chr(10))
WHERE content_markdown LIKE ('%' || chr(92) || 'n' || '%');

COMMIT;
