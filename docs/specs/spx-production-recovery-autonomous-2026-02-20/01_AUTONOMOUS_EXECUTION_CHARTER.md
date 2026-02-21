# Autonomous Execution Charter: SPX Production Recovery
Date: February 20, 2026

## 1. Mission
Execute the SPX Command Center production recovery and enhancement scope autonomously, with deterministic quality gates and auditable change control, while preserving production safety.

## 2. Scope Authority
This charter governs execution for:
1. `/members/spx-command-center`
2. SPX command center contexts, hooks, components, and supporting libraries
3. SPX test coverage and release readiness documentation

Out-of-scope work must not be executed unless explicitly approved and documented as a scope change.

## 3. Core Execution Principles
1. Correctness before speed.
2. One canonical source of truth per domain.
3. One primary user action per trade state.
4. No silent behavior changes without test updates and release notes.
5. No merge of partially verified high-risk slices.

## 4. Autonomous Operating Model
Each implementation slice must follow this sequence:
1. Pull relevant requirements from baseline recovery spec.
2. Define explicit slice objective, impacted files, and acceptance criteria.
3. Implement smallest viable code delta.
4. Run required test gates for the slice.
5. Record results in change-control documentation.
6. Advance only if slice gates pass.

## 5. Hard Stop Conditions
Autonomous execution must stop and request direction if any of the following occur:
1. Unexpected unrelated file mutations are detected.
2. A blocking test failure cannot be resolved within the current slice.
3. Required production data contracts are ambiguous.
4. A change would violate non-negotiable project constraints.
5. Rollback path cannot be clearly defined.

## 6. Branch and Commit Protocol
1. Branch prefix is required: `codex/`.
2. Preferred branch format: `codex/spx-recovery-phase-<n>-<slice>`.
3. Commits are atomic and phase-aligned.
4. Commit message format:
- `fix(spx): <behavior correction>`
- `refactor(spx): <structural cleanup>`
- `feat(spx): <approved capability>`
5. Do not amend historical commits unless explicitly requested.

## 7. Quality Governance
A slice is not complete unless all are true:
1. Acceptance criteria for the slice are satisfied.
2. Required tests for the slice pass.
3. No new P0/P1 regressions are introduced.
4. Rollback impact is documented.
5. Documentation is updated for any user-visible behavior change.

## 8. Code Safety Constraints
1. Keep state transition logic explicit and testable.
2. Avoid duplicate command execution paths.
3. Keep high-risk features behind controlled flags until gates pass.
4. Ensure degraded/fallback behavior is user-visible and deterministic.
5. Prefer additive migration and compatibility shims for large refactors.

## 9. Documentation Obligations Per Slice
For every slice, update:
1. Change control record (`06_CHANGE_CONTROL_AND_PR_STANDARD.md`).
2. Risk register updates (`07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`).
3. If behavior changed, add notes to release runbook.

## 10. Completion Definition
Autonomous execution for this initiative is complete when:
1. Planned phases for the release are delivered.
2. Blocking quality gates are green.
3. Release runbook is complete.
4. Rollback and incident runbooks are validated.
5. Final release candidate has clean, intentional diffs only.
