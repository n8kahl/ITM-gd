-- Backfill v3 curriculum media metadata and block illustrations.
-- Adds visual defaults for modules, lessons, and blocks when explicit media is missing.

BEGIN;

UPDATE academy_modules m
SET metadata = coalesce(m.metadata, '{}'::jsonb) || jsonb_build_object(
  'coverImageUrl',
  CASE
    WHEN lower(m.slug || ' ' || m.title) LIKE '%risk%' THEN '/academy/illustrations/risk-sizing.svg'
    WHEN lower(m.slug || ' ' || m.title) LIKE '%exit%' THEN '/academy/illustrations/exit-discipline.svg'
    WHEN lower(m.slug || ' ' || m.title) LIKE '%entry%' THEN '/academy/illustrations/entry-validation.svg'
    WHEN lower(m.slug || ' ' || m.title) LIKE '%market%' OR lower(m.slug || ' ' || m.title) LIKE '%alert%' THEN '/academy/illustrations/market-context.svg'
    WHEN lower(m.slug || ' ' || m.title) LIKE '%option%' OR lower(m.slug || ' ' || m.title) LIKE '%greek%' OR lower(m.slug || ' ' || m.title) LIKE '%leaps%' THEN '/academy/illustrations/options-basics.svg'
    WHEN lower(m.slug || ' ' || m.title) LIKE '%management%' THEN '/academy/illustrations/trade-management.svg'
    WHEN lower(m.slug || ' ' || m.title) LIKE '%review%' OR lower(m.slug || ' ' || m.title) LIKE '%psychology%' THEN '/academy/illustrations/review-reflection.svg'
    ELSE '/academy/illustrations/training-default.svg'
  END
)
WHERE m.metadata->>'coverImageUrl' IS NULL
   OR length(trim(coalesce(m.metadata->>'coverImageUrl', ''))) = 0;

UPDATE academy_lessons l
SET metadata = coalesce(l.metadata, '{}'::jsonb) || jsonb_build_object(
  'heroImageUrl',
  CASE
    WHEN lower(l.slug || ' ' || l.title) LIKE '%risk%' THEN '/academy/illustrations/risk-sizing.svg'
    WHEN lower(l.slug || ' ' || l.title) LIKE '%exit%' THEN '/academy/illustrations/exit-discipline.svg'
    WHEN lower(l.slug || ' ' || l.title) LIKE '%entry%' THEN '/academy/illustrations/entry-validation.svg'
    WHEN lower(l.slug || ' ' || l.title) LIKE '%market%' OR lower(l.slug || ' ' || l.title) LIKE '%alert%' THEN '/academy/illustrations/market-context.svg'
    WHEN lower(l.slug || ' ' || l.title) LIKE '%option%' OR lower(l.slug || ' ' || l.title) LIKE '%greek%' OR lower(l.slug || ' ' || l.title) LIKE '%leaps%' THEN '/academy/illustrations/options-basics.svg'
    WHEN lower(l.slug || ' ' || l.title) LIKE '%management%' THEN '/academy/illustrations/trade-management.svg'
    WHEN lower(l.slug || ' ' || l.title) LIKE '%review%' OR lower(l.slug || ' ' || l.title) LIKE '%psychology%' THEN '/academy/illustrations/review-reflection.svg'
    ELSE '/academy/illustrations/training-default.svg'
  END
)
WHERE l.metadata->>'heroImageUrl' IS NULL
   OR length(trim(coalesce(l.metadata->>'heroImageUrl', ''))) = 0;

UPDATE academy_lesson_blocks b
SET content_json = coalesce(b.content_json, '{}'::jsonb) || jsonb_build_object(
  'imageUrl',
  CASE b.block_type
    WHEN 'hook' THEN '/academy/illustrations/market-context.svg'
    WHEN 'concept_explanation' THEN '/academy/illustrations/training-default.svg'
    WHEN 'worked_example' THEN '/academy/illustrations/trade-management.svg'
    WHEN 'guided_practice' THEN '/academy/illustrations/entry-validation.svg'
    WHEN 'independent_practice' THEN '/academy/illustrations/risk-sizing.svg'
    ELSE '/academy/illustrations/review-reflection.svg'
  END
)
WHERE b.content_json->>'imageUrl' IS NULL
   OR length(trim(coalesce(b.content_json->>'imageUrl', ''))) = 0;

COMMIT;
