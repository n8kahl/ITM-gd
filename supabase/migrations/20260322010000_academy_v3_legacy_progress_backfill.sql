-- Backfill legacy academy progress/activity data into academy_v3 user progression tables.
-- Idempotent by design:
-- - enrollments + lesson attempts use ON CONFLICT upserts
-- - learning events skip rows already inserted via legacy_activity_id payload marker

begin;

-- 1) Backfill program enrollments from legacy user progress/activity footprint.
with program_target as (
  select coalesce(
    (select id from academy_programs where code = 'titm-core-program' limit 1),
    (select id from academy_programs where is_active = true order by created_at asc limit 1)
  ) as program_id
),
legacy_users as (
  select user_id from user_course_progress
  union
  select user_id from user_lesson_progress
  union
  select user_id from user_learning_activity_log
),
course_agg as (
  select
    user_id,
    min(started_at) as first_course_started_at,
    max(completed_at) as last_course_completed_at,
    bool_or(status = 'completed') as any_course_completed,
    count(*) as legacy_course_progress_rows,
    sum(case when status = 'completed' then 1 else 0 end) as legacy_completed_courses
  from user_course_progress
  group by user_id
),
lesson_agg as (
  select
    user_id,
    min(started_at) as first_lesson_started_at
  from user_lesson_progress
  group by user_id
),
activity_agg as (
  select
    user_id,
    min(created_at) as first_activity_at
  from user_learning_activity_log
  group by user_id
)
insert into academy_user_enrollments (
  user_id,
  program_id,
  status,
  started_at,
  completed_at,
  metadata
)
select
  u.user_id,
  p.program_id,
  case
    when coalesce(c.any_course_completed, false) then 'completed'::academy_enrollment_status
    else 'active'::academy_enrollment_status
  end as status,
  coalesce(
    c.first_course_started_at,
    l.first_lesson_started_at,
    a.first_activity_at,
    now()
  ) as started_at,
  case
    when coalesce(c.any_course_completed, false) then c.last_course_completed_at
    else null
  end as completed_at,
  jsonb_build_object(
    'legacy_backfilled', true,
    'legacy_source', 'course_lesson_activity_union',
    'legacy_course_progress_rows', coalesce(c.legacy_course_progress_rows, 0),
    'legacy_completed_courses', coalesce(c.legacy_completed_courses, 0)
  ) as metadata
from legacy_users u
cross join program_target p
left join course_agg c on c.user_id = u.user_id
left join lesson_agg l on l.user_id = u.user_id
left join activity_agg a on a.user_id = u.user_id
where p.program_id is not null
on conflict (user_id, program_id) do update
set
  status = case
    when academy_user_enrollments.status = 'completed'::academy_enrollment_status
      or excluded.status = 'completed'::academy_enrollment_status
      then 'completed'::academy_enrollment_status
    else academy_user_enrollments.status
  end,
  started_at = coalesce(
    least(academy_user_enrollments.started_at, excluded.started_at),
    academy_user_enrollments.started_at,
    excluded.started_at
  ),
  completed_at = coalesce(
    greatest(academy_user_enrollments.completed_at, excluded.completed_at),
    academy_user_enrollments.completed_at,
    excluded.completed_at
  ),
  metadata = coalesce(academy_user_enrollments.metadata, '{}'::jsonb) || excluded.metadata;

-- 2) Backfill lesson attempts by matching legacy lessons/courses to v3 via slugs.
with legacy_lesson_map as (
  select
    l.id as legacy_lesson_id,
    l.slug as legacy_lesson_slug,
    c.id as legacy_course_id,
    c.slug as legacy_course_slug,
    am.id as module_id,
    al.id as lesson_id
  from lessons l
  join courses c
    on c.id = l.course_id
  join academy_modules am
    on am.slug = c.slug
  join academy_lessons al
    on al.slug = l.slug
   and al.module_id = am.id
),
legacy_attempts as (
  select
    ulp.id as legacy_progress_id,
    ulp.user_id,
    ulp.status as legacy_status,
    ulp.started_at,
    ulp.completed_at,
    ulp.time_spent_seconds,
    ulp.quiz_score,
    ulp.quiz_attempts,
    ulp.quiz_responses,
    ulp.activity_completed,
    ulp.notes,
    ulp.course_id as legacy_course_id,
    ulp.lesson_id as legacy_lesson_id,
    map.module_id,
    map.lesson_id
  from user_lesson_progress ulp
  join legacy_lesson_map map
    on map.legacy_lesson_id = ulp.lesson_id
   and map.legacy_course_id = ulp.course_id
  where ulp.status in ('in_progress', 'completed')
)
insert into academy_user_lesson_attempts (
  user_id,
  lesson_id,
  status,
  progress_percent,
  started_at,
  completed_at,
  metadata
)
select
  a.user_id,
  a.lesson_id,
  case
    when a.legacy_status = 'completed' then 'passed'::academy_attempt_status
    else 'in_progress'::academy_attempt_status
  end as status,
  case
    when a.legacy_status = 'completed' then 100::numeric
    else least(
      95::numeric,
      greatest(5::numeric, coalesce(a.time_spent_seconds, 0)::numeric / 30.0)
    )
  end as progress_percent,
  coalesce(a.started_at, a.completed_at, now()) as started_at,
  a.completed_at,
  jsonb_build_object(
    'legacy_backfilled', true,
    'legacy_progress_id', a.legacy_progress_id,
    'legacy_course_id', a.legacy_course_id,
    'legacy_lesson_id', a.legacy_lesson_id,
    'legacy_time_spent_seconds', coalesce(a.time_spent_seconds, 0),
    'legacy_quiz_score', a.quiz_score,
    'legacy_quiz_attempts', coalesce(a.quiz_attempts, 0),
    'legacy_quiz_responses', coalesce(a.quiz_responses, '{}'::jsonb),
    'legacy_activity_completed', coalesce(a.activity_completed, false),
    'legacy_notes', a.notes
  ) as metadata
from legacy_attempts a
on conflict (user_id, lesson_id) do update
set
  status = case
    when academy_user_lesson_attempts.status = 'passed'::academy_attempt_status
      or excluded.status = 'passed'::academy_attempt_status
      then 'passed'::academy_attempt_status
    when academy_user_lesson_attempts.status = 'failed'::academy_attempt_status
      then 'failed'::academy_attempt_status
    when academy_user_lesson_attempts.status = 'submitted'::academy_attempt_status
      then 'submitted'::academy_attempt_status
    else 'in_progress'::academy_attempt_status
  end,
  progress_percent = greatest(
    academy_user_lesson_attempts.progress_percent,
    excluded.progress_percent
  ),
  started_at = coalesce(
    least(academy_user_lesson_attempts.started_at, excluded.started_at),
    academy_user_lesson_attempts.started_at,
    excluded.started_at
  ),
  completed_at = coalesce(
    greatest(academy_user_lesson_attempts.completed_at, excluded.completed_at),
    academy_user_lesson_attempts.completed_at,
    excluded.completed_at
  ),
  metadata = coalesce(academy_user_lesson_attempts.metadata, '{}'::jsonb) || excluded.metadata;

-- 3) Backfill legacy XP/activity events into academy_learning_events.
with legacy_events as (
  select
    ula.id as legacy_activity_id,
    ula.user_id,
    ula.activity_type,
    ula.entity_id,
    ula.entity_type,
    ula.xp_earned,
    coalesce(ula.metadata, '{}'::jsonb) as legacy_metadata,
    ula.created_at,
    l.id as legacy_lesson_id,
    l.slug as legacy_lesson_slug,
    c.id as legacy_course_id,
    c.slug as legacy_course_slug
  from user_learning_activity_log ula
  left join lessons l
    on ula.entity_type = 'lesson'
   and l.id = ula.entity_id
  left join courses c
    on (
      ula.entity_type = 'course'
      and c.id = ula.entity_id
    ) or (
      ula.entity_type = 'lesson'
      and c.id = l.course_id
    )
),
mapped_events as (
  select
    e.legacy_activity_id,
    e.user_id,
    case e.activity_type
      when 'lesson_view' then 'lesson_started'
      when 'lesson_complete' then 'block_completed'
      when 'quiz_attempt' then 'assessment_submitted'
      when 'quiz_pass' then 'assessment_passed'
      when 'course_complete' then 'assessment_passed'
      when 'track_complete' then 'assessment_passed'
      else 'review_completed'
    end::academy_learning_event_type as event_type,
    al.id as lesson_id,
    am.id as module_id,
    e.created_at as occurred_at,
    jsonb_build_object(
      'legacy_backfilled', true,
      'legacy_activity_id', e.legacy_activity_id,
      'legacy_activity_type', e.activity_type,
      'legacy_entity_id', e.entity_id,
      'legacy_entity_type', e.entity_type,
      'xp_earned', coalesce(e.xp_earned, 0),
      'legacy_lesson_id', e.legacy_lesson_id,
      'legacy_course_id', e.legacy_course_id
    ) || e.legacy_metadata as payload
  from legacy_events e
  left join academy_modules am
    on am.slug = e.legacy_course_slug
  left join academy_lessons al
    on al.slug = e.legacy_lesson_slug
   and (am.id is null or al.module_id = am.id)
)
insert into academy_learning_events (
  user_id,
  event_type,
  lesson_id,
  module_id,
  payload,
  occurred_at
)
select
  me.user_id,
  me.event_type,
  me.lesson_id,
  me.module_id,
  me.payload,
  me.occurred_at
from mapped_events me
where not exists (
  select 1
  from academy_learning_events ale
  where ale.user_id = me.user_id
    and ale.occurred_at = me.occurred_at
    and ale.payload ->> 'legacy_activity_id' = me.legacy_activity_id::text
);

commit;
