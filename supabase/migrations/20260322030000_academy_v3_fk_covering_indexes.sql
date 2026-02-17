-- Academy v3 FK covering indexes for production query/delete performance.
-- Adds missing single-column indexes for FK columns not covered as leading
-- columns by existing multi-column indexes.

create index if not exists idx_academy_assessment_items_competency
  on academy_assessment_items(competency_id);

create index if not exists idx_academy_learning_events_lesson
  on academy_learning_events(lesson_id);

create index if not exists idx_academy_learning_events_module
  on academy_learning_events(module_id);

create index if not exists idx_academy_learning_events_assessment
  on academy_learning_events(assessment_id);

create index if not exists idx_academy_learning_events_user
  on academy_learning_events(user_id);

create index if not exists idx_academy_lesson_competencies_competency
  on academy_lesson_competencies(competency_id);

create index if not exists idx_academy_review_attempts_queue
  on academy_review_attempts(queue_id);

create index if not exists idx_academy_review_attempts_user
  on academy_review_attempts(user_id);

create index if not exists idx_academy_review_queue_competency
  on academy_review_queue(competency_id);

create index if not exists idx_academy_review_queue_source_assessment_item
  on academy_review_queue(source_assessment_item_id);

create index if not exists idx_academy_review_queue_source_lesson
  on academy_review_queue(source_lesson_id);

create index if not exists idx_academy_user_assessment_attempts_assessment
  on academy_user_assessment_attempts(assessment_id);

create index if not exists idx_academy_user_competency_mastery_competency
  on academy_user_competency_mastery(competency_id);

create index if not exists idx_academy_user_enrollments_program
  on academy_user_enrollments(program_id);

create index if not exists idx_academy_user_lesson_attempts_lesson
  on academy_user_lesson_attempts(lesson_id);
