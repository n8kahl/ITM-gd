# Academy Database Cleanup Audit (2026-02-17)

## Scope
- Live `public.academy_*` tables (schema, content quality, relational integrity, telemetry quality, performance indexes).
- Frontend lesson rendering compatibility with seeded block payloads.

## Key Issues Found
1. Invalid curriculum mapping copy in `welcome-tradeitm-your-learning-path` block 5 referenced non-existent modules.
2. Two lessons had no competency mapping:
   - `session-framing-for-options`
   - `invalidations-and-levels`
3. Inactive legacy track record (`legacy-v2-library`) collided on `position=2`.
4. Missing covering FK indexes:
   - `academy_assessments.lesson_id`
   - `academy_assessments.module_id`
   - `academy_user_assessment_attempts.user_id`
5. Stringified JSON payloads exist in lesson block `content_json.content` (handled in viewer fallback).

## Remediation Applied

### Data fixes (live DB)
- Rewrote the `Learning Path Mapping Drill` content in block:
  - `academy_lesson_blocks.id = 18eb9a4d-8b16-4247-899e-af0eafbe72a8`
  - Removed non-existent module references and aligned scenarios to real module catalog.
- Added competency mappings:
  - `session-framing-for-options` -> `market_context` weight `1.0`
  - `invalidations-and-levels` -> `entry_validation` weight `1.0`
- Repositioned inactive track:
  - `legacy-v2-library` from `position=2` -> `position=99`
- Normalized stringified JSON block payloads:
  - Converted all parseable JSON strings in `academy_lesson_blocks.content_json.content` to proper JSON objects.

### Schema/performance migration
- Applied migration: `academy_fk_covering_indexes`
- Added indexes:
  - `idx_academy_assessments_lesson_id`
  - `idx_academy_assessments_module_id`
  - `idx_academy_user_assessment_attempts_user_id`

### Frontend hardening
- Updated `/Users/natekahl/ITM-gd/components/academy/academy-media.ts`:
  - `getBlockMarkdown` now detects stringified JSON content and renders readable markdown fallback.
  - Handles `component_id`, `title`, `description`, and `annotations`.
- Added tests:
  - `/Users/natekahl/ITM-gd/components/academy/__tests__/academy-media.test.ts`

## Validation Results (Post-fix)
- `lessons_missing_competency_mapping = 0`
- `track_position_duplicates_all = 0`
- Invalid phrase scan (`advanced strategies`, `technical deep dive`, `greeks mastery`) = `0` rows
- `fk_missing_covering_index = 0`
- `string_content_valid_json = 0` (no parseable JSON left as string)
- Tests:
  - `pnpm exec vitest run components/academy/__tests__/academy-media.test.ts lib/academy-v3/__tests__/database-integrity.test.ts`
  - Result: `13 passed`, `0 failed`

## Remaining Follow-up Candidates
- Legacy/backfilled learning events unresolved to program context (15 rows) remain for historical telemetry. Keep as legacy unless analytics requires canonical remap.
- Legacy source footprint still high (`academy_v2_chunk` blocks). Consider phased content modernization for consistency and pedagogy.
