-- Production parity migration: import published Academy v2 curriculum into Academy v3 schema.
-- Applied in production on 2026-02-17 as emergency content migration.

BEGIN;

INSERT INTO academy_tracks (program_id, code, title, description, position, is_active, metadata)
VALUES (
  (SELECT id FROM academy_programs WHERE code = 'titm-core-program' LIMIT 1),
  'legacy-v2-library',
  'Legacy Academy Library',
  'Imported published curriculum from Academy v2',
  2,
  true,
  '{"source":"academy_v2"}'::jsonb
)
ON CONFLICT (program_id, code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  position = EXCLUDED.position,
  is_active = EXCLUDED.is_active,
  metadata = academy_tracks.metadata || EXCLUDED.metadata,
  updated_at = now();

WITH legacy_track AS (
  SELECT id
  FROM academy_tracks
  WHERE code = 'legacy-v2-library'
    AND program_id = (SELECT id FROM academy_programs WHERE code = 'titm-core-program' LIMIT 1)
  LIMIT 1
), ordered_courses AS (
  SELECT
    c.*,
    row_number() OVER (ORDER BY coalesce(c.display_order, 999), c.created_at, c.slug) AS module_position
  FROM courses c
  WHERE c.is_published = true
)
INSERT INTO academy_modules (
  track_id,
  slug,
  code,
  title,
  description,
  learning_outcomes,
  estimated_minutes,
  position,
  is_published,
  metadata
)
SELECT
  (SELECT id FROM legacy_track),
  oc.slug,
  oc.slug,
  oc.title,
  oc.description,
  '[]'::jsonb,
  greatest(0, coalesce((oc.estimated_hours * 60)::int, 0)),
  oc.module_position,
  true,
  jsonb_build_object(
    'source', 'academy_v2',
    'source_course_id', oc.id,
    'legacy_tier_required', oc.tier_required,
    'legacy_thumbnail_url', oc.thumbnail_url,
    'coverImageUrl',
      CASE
        WHEN lower(oc.slug || ' ' || oc.title) LIKE '%risk%' THEN '/academy/illustrations/risk-sizing.svg'
        WHEN lower(oc.slug || ' ' || oc.title) LIKE '%exit%' THEN '/academy/illustrations/exit-discipline.svg'
        WHEN lower(oc.slug || ' ' || oc.title) LIKE '%entry%' THEN '/academy/illustrations/entry-validation.svg'
        WHEN lower(oc.slug || ' ' || oc.title) LIKE '%market%' OR lower(oc.slug || ' ' || oc.title) LIKE '%alert%' THEN '/academy/illustrations/market-context.svg'
        WHEN lower(oc.slug || ' ' || oc.title) LIKE '%option%' OR lower(oc.slug || ' ' || oc.title) LIKE '%greek%' OR lower(oc.slug || ' ' || oc.title) LIKE '%leaps%' THEN '/academy/illustrations/options-basics.svg'
        WHEN lower(oc.slug || ' ' || oc.title) LIKE '%management%' THEN '/academy/illustrations/trade-management.svg'
        WHEN lower(oc.slug || ' ' || oc.title) LIKE '%review%' OR lower(oc.slug || ' ' || oc.title) LIKE '%psychology%' THEN '/academy/illustrations/review-reflection.svg'
        ELSE '/academy/illustrations/training-default.svg'
      END
  )
FROM ordered_courses oc
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  estimated_minutes = EXCLUDED.estimated_minutes,
  position = EXCLUDED.position,
  is_published = EXCLUDED.is_published,
  metadata = coalesce(academy_modules.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

WITH lesson_order AS (
  SELECT
    l.*,
    row_number() OVER (PARTITION BY l.course_id ORDER BY coalesce(l.display_order, 999), l.created_at, l.slug) AS lesson_position
  FROM lessons l
  JOIN courses c ON c.id = l.course_id
  WHERE l.is_published = true
    AND c.is_published = true
)
INSERT INTO academy_lessons (
  id,
  module_id,
  slug,
  title,
  learning_objective,
  estimated_minutes,
  difficulty,
  prerequisite_lesson_ids,
  position,
  is_published,
  metadata
)
SELECT
  lo.id,
  m.id,
  lo.slug,
  lo.title,
  coalesce(nullif(array_to_string(lo.key_takeaways, ' | '), ''), lo.title),
  greatest(0, coalesce(lo.estimated_minutes, lo.duration_minutes, 0)),
  'beginner'::academy_difficulty,
  '{}'::uuid[],
  lo.lesson_position,
  true,
  jsonb_build_object(
    'source', 'academy_v2',
    'source_course_id', lo.course_id,
    'legacy_lesson_type', lo.lesson_type,
    'legacy_video_url', lo.video_url,
    'legacy_ai_tutor_context', lo.ai_tutor_context,
    'legacy_key_takeaways', lo.key_takeaways,
    'heroImageUrl',
      CASE
        WHEN lower(lo.slug || ' ' || lo.title) LIKE '%risk%' THEN '/academy/illustrations/risk-sizing.svg'
        WHEN lower(lo.slug || ' ' || lo.title) LIKE '%exit%' THEN '/academy/illustrations/exit-discipline.svg'
        WHEN lower(lo.slug || ' ' || lo.title) LIKE '%entry%' THEN '/academy/illustrations/entry-validation.svg'
        WHEN lower(lo.slug || ' ' || lo.title) LIKE '%market%' OR lower(lo.slug || ' ' || lo.title) LIKE '%alert%' THEN '/academy/illustrations/market-context.svg'
        WHEN lower(lo.slug || ' ' || lo.title) LIKE '%option%' OR lower(lo.slug || ' ' || lo.title) LIKE '%greek%' OR lower(lo.slug || ' ' || lo.title) LIKE '%leaps%' THEN '/academy/illustrations/options-basics.svg'
        WHEN lower(lo.slug || ' ' || lo.title) LIKE '%management%' THEN '/academy/illustrations/trade-management.svg'
        WHEN lower(lo.slug || ' ' || lo.title) LIKE '%review%' OR lower(lo.slug || ' ' || lo.title) LIKE '%psychology%' THEN '/academy/illustrations/review-reflection.svg'
        ELSE '/academy/illustrations/training-default.svg'
      END
  )
FROM lesson_order lo
JOIN courses c ON c.id = lo.course_id
JOIN academy_modules m ON m.slug = c.slug
ON CONFLICT (id) DO UPDATE SET
  module_id = EXCLUDED.module_id,
  slug = EXCLUDED.slug,
  title = EXCLUDED.title,
  learning_objective = EXCLUDED.learning_objective,
  estimated_minutes = EXCLUDED.estimated_minutes,
  difficulty = EXCLUDED.difficulty,
  position = EXCLUDED.position,
  is_published = EXCLUDED.is_published,
  metadata = coalesce(academy_lessons.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

WITH competency_keys AS (
  SELECT DISTINCT unnest(l.competency_keys)::text AS key
  FROM lessons l
  WHERE l.is_published = true
)
INSERT INTO academy_competencies (key, title, description, domain, metadata)
SELECT
  ck.key,
  initcap(replace(ck.key, '_', ' ')) AS title,
  'Imported from Academy v2 competency mapping',
  'legacy-v2',
  '{"source":"academy_v2"}'::jsonb
FROM competency_keys ck
WHERE ck.key IS NOT NULL
  AND length(trim(ck.key)) > 0
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  domain = EXCLUDED.domain,
  metadata = coalesce(academy_competencies.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  updated_at = now();

INSERT INTO academy_lesson_competencies (lesson_id, competency_id, weight)
SELECT
  al.id,
  ac.id,
  1.0
FROM lessons l
JOIN academy_lessons al ON al.id = l.id
CROSS JOIN LATERAL unnest(l.competency_keys) AS ck
JOIN academy_competencies ac ON ac.key = ck::text
WHERE l.is_published = true
ON CONFLICT (lesson_id, competency_id) DO NOTHING;

INSERT INTO academy_lesson_blocks (
  lesson_id,
  block_type,
  position,
  title,
  content_json
)
SELECT
  al.id,
  (
    CASE coalesce((chunk.elem->>'order_index')::int, chunk.ord::int - 1)
      WHEN 0 THEN 'hook'
      WHEN 1 THEN 'concept_explanation'
      WHEN 2 THEN 'worked_example'
      WHEN 3 THEN 'guided_practice'
      WHEN 4 THEN 'independent_practice'
      ELSE 'reflection'
    END
  )::academy_block_type,
  coalesce((chunk.elem->>'order_index')::int, chunk.ord::int - 1) + 1,
  nullif(chunk.elem->>'title', ''),
  jsonb_build_object(
    'source', 'academy_v2_chunk',
    'legacy_chunk_id', chunk.elem->>'id',
    'title', coalesce(chunk.elem->>'title', l.title),
    'content', coalesce(chunk.elem->>'content', ''),
    'content_type', chunk.elem->>'content_type',
    'duration_minutes', chunk.elem->>'duration_minutes',
    'quick_check', chunk.elem->'quick_check',
    'imageUrl',
      CASE coalesce((chunk.elem->>'order_index')::int, chunk.ord::int - 1)
        WHEN 0 THEN '/academy/illustrations/market-context.svg'
        WHEN 1 THEN '/academy/illustrations/training-default.svg'
        WHEN 2 THEN '/academy/illustrations/trade-management.svg'
        WHEN 3 THEN '/academy/illustrations/entry-validation.svg'
        WHEN 4 THEN '/academy/illustrations/risk-sizing.svg'
        ELSE '/academy/illustrations/review-reflection.svg'
      END
  )
FROM lessons l
JOIN academy_lessons al ON al.id = l.id
CROSS JOIN LATERAL jsonb_array_elements(l.chunk_data) WITH ORDINALITY AS chunk(elem, ord)
WHERE l.is_published = true
  AND l.chunk_data IS NOT NULL
  AND jsonb_typeof(l.chunk_data) = 'array'
ON CONFLICT (lesson_id, position) DO UPDATE SET
  block_type = EXCLUDED.block_type,
  title = EXCLUDED.title,
  content_json = EXCLUDED.content_json,
  updated_at = now();

INSERT INTO academy_lesson_blocks (
  lesson_id,
  block_type,
  position,
  title,
  content_json
)
SELECT
  al.id,
  'concept_explanation'::academy_block_type,
  1,
  l.title,
  jsonb_build_object(
    'source', 'academy_v2_markdown',
    'title', l.title,
    'markdown', l.content_markdown,
    'content', l.content_markdown,
    'imageUrl', '/academy/illustrations/training-default.svg'
  )
FROM lessons l
JOIN academy_lessons al ON al.id = l.id
WHERE l.is_published = true
  AND (l.chunk_data IS NULL OR jsonb_typeof(l.chunk_data) <> 'array' OR jsonb_array_length(l.chunk_data) = 0)
  AND l.content_markdown IS NOT NULL
  AND length(trim(l.content_markdown)) > 0
ON CONFLICT (lesson_id, position) DO NOTHING;

COMMIT;
