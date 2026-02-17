-- Academy v3 legacy backfill verification queries
-- Run after migration: 20260322010000_academy_v3_legacy_progress_backfill.sql

-- 1) Legacy vs v3 user footprint
with legacy_users as (
  select user_id from user_course_progress
  union
  select user_id from user_lesson_progress
  union
  select user_id from user_learning_activity_log
),
v3_users as (
  select user_id from academy_user_enrollments
  union
  select user_id from academy_user_lesson_attempts
  union
  select user_id from academy_learning_events
)
select
  (select count(*) from legacy_users) as legacy_users,
  (select count(*) from v3_users) as v3_users,
  (select count(*) from legacy_users l left join v3_users v on v.user_id = l.user_id where v.user_id is null) as legacy_users_missing_in_v3;

-- 2) Legacy lesson progress rows that map to v3 lessons by slug
with mapped as (
  select ulp.id
  from user_lesson_progress ulp
  join lessons l on l.id = ulp.lesson_id
  join courses c on c.id = ulp.course_id
  join academy_modules am on am.slug = c.slug
  join academy_lessons al on al.slug = l.slug and al.module_id = am.id
  where ulp.status in ('in_progress', 'completed')
)
select
  (select count(*) from user_lesson_progress where status in ('in_progress', 'completed')) as legacy_attempt_rows,
  (select count(*) from mapped) as mappable_attempt_rows;

-- 3) Backfilled lesson attempts (legacy marker present)
select count(*) as v3_backfilled_lesson_attempts
from academy_user_lesson_attempts
where coalesce(metadata ->> 'legacy_backfilled', 'false') = 'true';

-- 4) Backfilled learning events (legacy marker present)
select
  count(*) as v3_backfilled_events,
  count(*) filter (where payload ? 'legacy_activity_id') as events_with_legacy_activity_id
from academy_learning_events
where coalesce(payload ->> 'legacy_backfilled', 'false') = 'true';

-- 5) Event dedupe sanity check (should return zero rows)
select
  user_id,
  occurred_at,
  payload ->> 'legacy_activity_id' as legacy_activity_id,
  count(*) as duplicate_count
from academy_learning_events
where payload ? 'legacy_activity_id'
group by user_id, occurred_at, payload ->> 'legacy_activity_id'
having count(*) > 1;

-- 6) Enrollments backfilled from legacy footprint
select count(*) as v3_backfilled_enrollments
from academy_user_enrollments
where coalesce(metadata ->> 'legacy_backfilled', 'false') = 'true';
