# TITM Academy V3 Autonomous Implementation Spec

Version: 1.0  
Date: February 16, 2026  
Status: Ready for autonomous execution  
Supersedes: `/Users/natekahl/ITM-gd/TITM_ACADEMY_CODEX_SPEC.md` for academy rebuild scope

## 1. Objective
Deliver a full rebuild of TITM Training Academy as a competency-based learning system with non-generic content, strong knowledge checks, and coherent UX, executed autonomously by coding agents without backward-compatibility constraints.

## 2. Product Outcomes
1. Increase perceived lesson quality and organization.
2. Improve completion and mastery rates through guided progression.
3. Replace shallow quiz behavior with measurable competency evidence.
4. Establish maintainable code architecture for rapid curriculum iteration.

## 3. Hard Constraints
1. Backward compatibility is not required.
2. New schema may replace academy v2 structures where needed.
3. No production deployment step is included in this spec; deliver implementation and verification artifacts only.
4. All new server contracts must be typed and validated.

## 4. Definition of Done
All conditions below must be true.

1. Academy data model migrated to v3 competency domain.
2. All academy APIs use shared contract schemas and service layer orchestration.
3. Lesson experience supports structured blocks and explicit mastery outcomes.
4. Knowledge checks support diagnostic, formative, performance, and summative assessments.
5. Review queue prioritizes weakest competencies.
6. Academy home becomes a guided “My Learning Plan” hub.
7. Content seeding pipeline generates non-templated lessons with required pedagogy metadata.
8. E2E and unit tests pass for all academy critical flows.
9. Technical docs updated with architecture and runbooks.
10. Legacy academy-v2 routes/components/tables are removed or archived per cleanup manifest, with no dead references.

## 5. Target Architecture

### 5.1 Domain model
Program -> Track -> Module -> Lesson -> Activity -> Assessment

### 5.2 Layering rules
1. Route handlers: auth + input parsing + service call + response mapping only.
2. Services: all business logic and progression rules.
3. Repositories: all database access.
4. Contracts: central request/response and domain schemas.
5. UI: no direct DB assumptions; consume API contracts only.

### 5.3 Required module layout
1. `/Users/natekahl/ITM-gd/lib/academy-v3/contracts/*`
2. `/Users/natekahl/ITM-gd/lib/academy-v3/services/*`
3. `/Users/natekahl/ITM-gd/lib/academy-v3/repositories/*`
4. `/Users/natekahl/ITM-gd/lib/academy-v3/mappers/*`
5. `/Users/natekahl/ITM-gd/components/academy-v3/*`
6. `/Users/natekahl/ITM-gd/app/api/academy-v3/*`

## 6. Data Model Specification (v3)

### 6.1 New/primary tables
1. `academy_programs`
2. `academy_tracks`
3. `academy_modules`
4. `academy_lessons`
5. `academy_lesson_blocks`
6. `academy_assessments`
7. `academy_assessment_items`
8. `academy_competencies`
9. `academy_lesson_competencies`
10. `academy_user_enrollments`
11. `academy_user_lesson_attempts`
12. `academy_user_assessment_attempts`
13. `academy_user_competency_mastery`
14. `academy_review_queue`
15. `academy_review_attempts`
16. `academy_learning_events`

### 6.2 Required columns and semantics
1. Lessons must include `learning_objective`, `estimated_minutes`, `difficulty`, `prerequisite_lesson_ids`.
2. Blocks must include `block_type`, `position`, and typed payload (`content_json`).
3. Assessments must include `assessment_type` (`diagnostic|formative|performance|summative`) and `mastery_threshold`.
4. Competency mastery must store `current_score`, `confidence`, `last_evaluated_at`, `needs_remediation`.
5. Review queue must include `competency_id`, `due_at`, `interval_days`, `priority_weight`.

### 6.3 Migration policy
1. Create a new migration series under `/Users/natekahl/ITM-gd/supabase/migrations` with a v3 timestamp.
2. Drop or deprecate academy v2 tables/columns in same migration chain where safe.
3. Seed canonical starter curriculum from structured JSON fixtures, not SQL string templates.
4. Produce an explicit table-level decommission list for removed academy-v2 entities.

## 7. API Contract Specification

### 7.1 Endpoint groups
1. `GET /api/academy-v3/plan`
2. `GET /api/academy-v3/modules/:slug`
3. `GET /api/academy-v3/lessons/:id`
4. `POST /api/academy-v3/lessons/:id/start`
5. `POST /api/academy-v3/lessons/:id/complete-block`
6. `POST /api/academy-v3/assessments/:id/submit`
7. `GET /api/academy-v3/review`
8. `POST /api/academy-v3/review/:queueId/submit`
9. `GET /api/academy-v3/mastery`
10. `GET /api/academy-v3/recommendations`

### 7.2 Contract requirements
1. Every endpoint has zod request/response schemas.
2. Every endpoint returns normalized error envelopes.
3. Every write endpoint emits `academy_learning_events` entries.
4. No route should contain raw SQL.

## 8. Content System Specification

### 8.1 Authoring format
Use `lesson.blueprint.json` per lesson with required sections:
1. `hook`
2. `concept_explanation`
3. `worked_example`
4. `guided_practice`
5. `independent_practice`
6. `reflection`
7. `competencies_targeted`
8. `assessment_blueprint`

### 8.2 Quality gates
A lesson is invalid if any condition is true:
1. Missing realistic scenario.
2. Missing explicit success criteria.
3. Missing competency mapping.
4. Missing at least one formative check.
5. Uses placeholder language or generic boilerplate markers.

### 8.3 Content pipeline
1. Source files in `/Users/natekahl/ITM-gd/docs/specs/academy-content/`.
2. Build script converts blueprints to DB seed payloads.
3. Validation script fails CI if required pedagogical fields are absent.

## 9. Knowledge Check Specification

### 9.1 Assessment types
1. Diagnostic: placement and prerequisite validation.
2. Formative: in-lesson retrieval checks with immediate feedback.
3. Performance: scenario-based decision sequence or short-answer rubric.
4. Summative: module gate with competency thresholds.

### 9.2 Item types
1. `single_select`
2. `multi_select`
3. `ordered_steps`
4. `short_answer_rubric`
5. `scenario_branch`

### 9.3 Scoring model
1. Score by competency, not only total percentage.
2. Mastery decision requires minimum per-target competency threshold.
3. Missed competencies auto-generate remediation tasks and review queue items.

## 10. UX Specification

### 10.1 Academy home
Replace legacy multi-entry utility view with `My Learning Plan` containing:
1. Next best action card.
2. Current module progress.
3. Competency mastery radar/graph.
4. Due review cards.
5. Recommended remediation or challenge lessons.

### 10.2 Lesson player
1. Single primary CTA per state.
2. Sticky context panel: objective, competencies, time estimate.
3. Inline feedback at block level.
4. End-of-lesson mastery summary with next-step routing.

### 10.3 Information architecture
1. Primary nav: `Plan`, `Modules`, `Review`, `Progress`.
2. Remove orphaned pages that duplicate state without guidance.

## 11. Autonomous Execution Plan

### Phase 0: Preflight and baseline capture
Deliverables:
1. Baseline test snapshots and route inventory.
2. Existing academy dependency map.

Acceptance gates:
1. `pnpm lint` passes baseline or all existing failures documented.
2. `pnpm test` and academy e2e baseline results captured.

### Phase 1: Schema and repository foundation
Deliverables:
1. v3 migrations and seed fixtures.
2. Repository layer with typed query methods.

Acceptance gates:
1. Migration applies cleanly to empty and populated local DB.
2. Seed data creates one complete program with at least two modules.

### Phase 2: Service layer and contracts
Deliverables:
1. Shared zod schemas.
2. Progression, mastery, review, and recommendation services.

Acceptance gates:
1. Unit tests for progression and mastery pass.
2. No route handler directly accesses DB client.

### Phase 3: API cutover
Deliverables:
1. `/api/academy-v3/*` endpoints implemented.
2. Legacy academy endpoints marked deprecated or removed.
3. Legacy API usage scan artifact generated (`academy-v3-cleanup-api-audit.md`).

Acceptance gates:
1. Contract tests pass for all v3 endpoints.
2. Error handling consistent and typed.
3. `rg "/api/academy/"` only matches approved compatibility shims or migration notes.

### Phase 4: Frontend IA + lesson player rebuild
Deliverables:
1. New academy plan page and v3 component set.
2. Refactored lesson player and review flow.

Acceptance gates:
1. Playwright coverage for plan -> lesson -> assessment -> review journey.
2. No duplicate completion controls in lesson UI.

### Phase 5: Content and assessment pipeline
Deliverables:
1. Authoring blueprint templates.
2. Curriculum seed generation scripts.
3. Validation and lint rules for content quality.

Acceptance gates:
1. At least 10 non-generic lessons generated and validated.
2. Assessment items include at least 3 non-MCQ formats.

### Phase 6: Analytics and efficacy instrumentation
Deliverables:
1. Learning event instrumentation.
2. Mastery and engagement dashboards query definitions.

Acceptance gates:
1. Events emitted for all learning milestones.
2. SQL reports for activation, completion, mastery, retention pass smoke checks.

### Phase 7: Hardening and docs
Deliverables:
1. Updated academy architecture docs.
2. Runbook for future autonomous content updates.
3. Final cleanup manifest documenting all removed legacy files and schema artifacts.

Acceptance gates:
1. Lint, unit, integration, and e2e green.
2. README links to v3 docs and migration runbook.
3. Dead-code scan confirms no imports/usages of legacy academy-v2 modules.

### Phase 8: Legacy cleanup and decommission
Deliverables:
1. Remove obsolete academy-v2 routes/components/libs superseded by academy-v3.
2. Remove stale migrations/content seed logic that only supports generic v2 training patterns.
3. Add redirect or hard-fail handling for retired member routes no longer supported.
4. Publish `academy-v3-cleanup-manifest.md` with file removals and rationale.

Acceptance gates:
1. `rg "academy-v2|app/api/academy/|components/academy/"` returns only approved retained files.
2. `pnpm lint`, `pnpm test`, and academy Playwright flows pass after removals.
3. No orphan imports from deleted files remain (`tsc --noEmit` clean for academy scope).

## 12. Test Strategy

### 12.1 Unit
1. Progression unlock logic.
2. Competency scoring and mastery thresholding.
3. Review interval updates.

### 12.2 Integration
1. Lesson completion updates mastery and emits events.
2. Assessment submission generates remediation when needed.

### 12.3 E2E
1. New user onboarding -> diagnostic -> assigned module.
2. Complete lesson with mixed block types.
3. Fail summative and receive remediation.
4. Complete review queue and see mastery improvement.

### 12.4 Content validation tests
1. No missing mandatory lesson sections.
2. No placeholder phrases (`lorem`, `todo`, `insert content`).
3. Every assessment item mapped to competency.

## 13. Agent Operating Protocol (for autonomous runs)

### 13.1 Loop
1. Read phase scope.
2. Implement only current phase deliverables.
3. Run phase verification commands.
4. If gate fails, fix and rerun.
5. Commit phase checkpoint with summary.
6. Continue to next phase.

### 13.2 Stop conditions
1. Missing required env vars or secrets.
2. Migration failure with data-loss risk not accounted for.
3. Reproducible failing baseline tests unrelated to touched scope.

### 13.3 Commit policy
1. Branch name format: `codex/academy-v3-<phase>`.
2. One commit per phase minimum.
3. Commit message format: `academy-v3: phase <n> <summary>`.

## 14. Metrics and Acceptance Targets
1. Lesson completion rate +20% from baseline.
2. Module pass rate +15% from baseline.
3. Review due completion rate >= 70%.
4. Median lesson usefulness rating >= 4.2/5.
5. Time-to-first-lesson-start <= 5 minutes.

## 15. Deliverable Manifest
1. New migration files under `/Users/natekahl/ITM-gd/supabase/migrations`.
2. New academy-v3 lib and API directories.
3. New academy-v3 UI components and pages.
4. Content blueprint and validation scripts under `/Users/natekahl/ITM-gd/scripts` and `/Users/natekahl/ITM-gd/docs/specs/academy-content`.
5. Updated tests under `/Users/natekahl/ITM-gd/e2e/specs/members` and unit test directories.
6. Updated docs index and runbooks.
7. Legacy cleanup artifacts: API audit, decommission list, and final cleanup manifest.

## 16. Immediate Next Step
Start Phase 0 and create `academy-v3-baseline.md` containing:
1. Current academy route inventory.
2. Baseline test results.
3. Known failures and risk notes.
