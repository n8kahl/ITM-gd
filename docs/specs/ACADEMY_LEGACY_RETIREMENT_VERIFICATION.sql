-- Academy legacy retirement verification
-- Run after migration: 20260322020000_academy_legacy_table_retirement.sql

-- 1) Legacy runtime tables should be absent from public schema
select
  to_regclass('public.courses') as courses_table,
  to_regclass('public.lessons') as lessons_table,
  to_regclass('public.learning_paths') as learning_paths_table,
  to_regclass('public.learning_path_courses') as learning_path_courses_table,
  to_regclass('public.user_course_progress') as user_course_progress_table,
  to_regclass('public.user_lesson_progress') as user_lesson_progress_table,
  to_regclass('public.user_learning_activity_log') as user_learning_activity_log_table,
  to_regclass('public.user_learning_profiles') as user_learning_profiles_table,
  to_regclass('public.user_learning_insights') as user_learning_insights_table;

-- 2) Archive schema tables should exist
select
  to_regclass('academy_legacy_archive.courses') as archive_courses,
  to_regclass('academy_legacy_archive.lessons') as archive_lessons,
  to_regclass('academy_legacy_archive.learning_paths') as archive_learning_paths,
  to_regclass('academy_legacy_archive.learning_path_courses') as archive_learning_path_courses,
  to_regclass('academy_legacy_archive.user_course_progress') as archive_user_course_progress,
  to_regclass('academy_legacy_archive.user_lesson_progress') as archive_user_lesson_progress,
  to_regclass('academy_legacy_archive.user_learning_activity_log') as archive_user_learning_activity_log,
  to_regclass('academy_legacy_archive.user_learning_profiles') as archive_user_learning_profiles,
  to_regclass('academy_legacy_archive.user_learning_insights') as archive_user_learning_insights;

-- 3) Archive row-count snapshot
select 'courses' as table_name, count(*) as row_count from academy_legacy_archive.courses
union all
select 'lessons' as table_name, count(*) as row_count from academy_legacy_archive.lessons
union all
select 'learning_paths' as table_name, count(*) as row_count from academy_legacy_archive.learning_paths
union all
select 'learning_path_courses' as table_name, count(*) as row_count from academy_legacy_archive.learning_path_courses
union all
select 'user_course_progress' as table_name, count(*) as row_count from academy_legacy_archive.user_course_progress
union all
select 'user_lesson_progress' as table_name, count(*) as row_count from academy_legacy_archive.user_lesson_progress
union all
select 'user_learning_activity_log' as table_name, count(*) as row_count from academy_legacy_archive.user_learning_activity_log
union all
select 'user_learning_profiles' as table_name, count(*) as row_count from academy_legacy_archive.user_learning_profiles
union all
select 'user_learning_insights' as table_name, count(*) as row_count from academy_legacy_archive.user_learning_insights
order by table_name;

-- 4) Ensure academy_v3 progression data remains available
select
  (select count(*) from academy_user_enrollments) as enrollments_count,
  (select count(*) from academy_user_lesson_attempts) as lesson_attempts_count,
  (select count(*) from academy_learning_events) as learning_events_count;
