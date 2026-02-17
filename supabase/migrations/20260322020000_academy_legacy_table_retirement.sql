-- Retire legacy academy tables after academy_v3 cutover and backfill.
-- Strategy:
-- 1) Snapshot legacy tables into academy_legacy_archive schema (idempotent upsert-style inserts)
-- 2) Remove known FK/function dependencies on legacy course/lesson tables
-- 3) Drop retired legacy tables

begin;

create schema if not exists academy_legacy_archive;

-- ---------------------------------------------------------------------------
-- 1) ARCHIVE SNAPSHOTS
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.courses') is not null then
    execute 'create table if not exists academy_legacy_archive.courses (like public.courses including all)';
    execute 'insert into academy_legacy_archive.courses select * from public.courses on conflict do nothing';
  end if;

  if to_regclass('public.lessons') is not null then
    execute 'create table if not exists academy_legacy_archive.lessons (like public.lessons including all)';
    execute 'insert into academy_legacy_archive.lessons select * from public.lessons on conflict do nothing';
  end if;

  if to_regclass('public.learning_paths') is not null then
    execute 'create table if not exists academy_legacy_archive.learning_paths (like public.learning_paths including all)';
    execute 'insert into academy_legacy_archive.learning_paths select * from public.learning_paths on conflict do nothing';
  end if;

  if to_regclass('public.learning_path_courses') is not null then
    execute 'create table if not exists academy_legacy_archive.learning_path_courses (like public.learning_path_courses including all)';
    execute 'insert into academy_legacy_archive.learning_path_courses select * from public.learning_path_courses on conflict do nothing';
  end if;

  if to_regclass('public.user_course_progress') is not null then
    execute 'create table if not exists academy_legacy_archive.user_course_progress (like public.user_course_progress including all)';
    execute 'insert into academy_legacy_archive.user_course_progress select * from public.user_course_progress on conflict do nothing';
  end if;

  if to_regclass('public.user_lesson_progress') is not null then
    execute 'create table if not exists academy_legacy_archive.user_lesson_progress (like public.user_lesson_progress including all)';
    execute 'insert into academy_legacy_archive.user_lesson_progress select * from public.user_lesson_progress on conflict do nothing';
  end if;

  if to_regclass('public.user_learning_activity_log') is not null then
    execute 'create table if not exists academy_legacy_archive.user_learning_activity_log (like public.user_learning_activity_log including all)';
    execute 'insert into academy_legacy_archive.user_learning_activity_log select * from public.user_learning_activity_log on conflict do nothing';
  end if;

  if to_regclass('public.user_learning_profiles') is not null then
    execute 'create table if not exists academy_legacy_archive.user_learning_profiles (like public.user_learning_profiles including all)';
    execute 'insert into academy_legacy_archive.user_learning_profiles select * from public.user_learning_profiles on conflict do nothing';
  end if;

  if to_regclass('public.user_learning_insights') is not null then
    execute 'create table if not exists academy_legacy_archive.user_learning_insights (like public.user_learning_insights including all)';
    execute 'insert into academy_legacy_archive.user_learning_insights select * from public.user_learning_insights on conflict do nothing';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2) DROP KNOWN DEPENDENCIES
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.user_lesson_progress') is not null then
    execute 'drop trigger if exists tr_member_event_lesson_completed on public.user_lesson_progress';
  end if;
  if to_regclass('public.courses') is not null then
    execute 'drop trigger if exists courses_updated_at on public.courses';
  end if;
  if to_regclass('public.lessons') is not null then
    execute 'drop trigger if exists lessons_updated_at on public.lessons';
  end if;
end
$$;

drop function if exists get_course_progress_stats(uuid, uuid);
drop function if exists seed_review_items_for_lesson(uuid, uuid);
drop function if exists trg_member_event_lesson_completed();
drop function if exists update_courses_updated_at();
drop function if exists update_lessons_updated_at();

alter table if exists public.review_queue_items
  drop constraint if exists review_queue_items_source_lesson_id_fkey;
alter table if exists public.review_queue_items
  drop constraint if exists review_queue_items_source_course_id_fkey;

-- ---------------------------------------------------------------------------
-- 3) DROP RETIRED LEGACY TABLES
-- ---------------------------------------------------------------------------

drop table if exists public.user_lesson_progress;
drop table if exists public.user_course_progress;
drop table if exists public.user_learning_activity_log;
drop table if exists public.learning_path_courses;
drop table if exists public.user_learning_profiles;
drop table if exists public.lessons;
drop table if exists public.courses;
drop table if exists public.learning_paths;
drop table if exists public.user_learning_insights;

commit;
