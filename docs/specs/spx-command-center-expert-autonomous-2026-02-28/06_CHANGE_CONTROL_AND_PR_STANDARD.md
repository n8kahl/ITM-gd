# SPX Expert Autonomous Packet — 06 Change Control and PR Standard
Date: 2026-02-28
Feature: SPX Command Center Expert

## 1. Branch and Commit Hygiene
1. Branch naming standard: `codex/spx-expert-<phase-or-slice>`.
2. One slice per commit group; avoid mixed-scope commits.
3. Stage only intended scope files for each slice.
4. Do not include exploratory scratch artifacts in production commits.
5. Do not use destructive git cleanup unless explicitly approved.

## 2. PR Content Standard
1. PR description must include:
   - objective,
   - in-scope files,
   - out-of-scope confirmation,
   - validation commands,
   - rollback plan,
   - risks/notes.
2. PR must link corresponding slice report doc in `docs/specs/`.
3. PR must include exact command outputs (or explicit link to evidence doc containing them).
4. PR must call out feature-flag defaults and rollout impact.

## 3. Gate Policy

### Slice-Level Gate Policy
1. Required for each slice before merge:
   - `pnpm exec eslint <touched files>`
   - `pnpm exec tsc --noEmit`
   - targeted test gates required by slice contract
2. Evidence must be captured in slice report doc with exact output snippets.

### Release-Level Gate Policy
1. Required before production promotion:
   - release docs packet complete,
   - execution tracker complete,
   - sign-off checklist complete,
   - runtime evidence includes explicit Node version.
2. If gate outputs are unchanged from immediately prior slice, release packet may reference exact evidence links instead of rerunning all suites.

## 4. Promotion Approvals
1. Technical Approval: Engineering owner validates gate evidence and rollback readiness.
2. Product Approval: Product owner validates UX/contract intent and rollout sequence.
3. Operational Approval: On-call/operator validates runbook readiness and incident paths.
4. Promotion decision must be recorded as `GO` or `NO-GO` with dated rationale in `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S3_2026-02-28.md`.

## 5. Rollback Governance
1. Flag-first rollback order:
   - `SPX_SIMPLIFIED_ACTION_STRIP_ENABLED`
   - `SPX_COACH_FACTS_MODE_ENABLED`
   - `SPX_EXPERT_TRADE_STREAM_ENABLED`
   - `SPX_TRADE_STREAM_BACKEND_SORT_ENABLED`
2. If flag rollback is insufficient, revert to previous release artifact.
3. Any rollback must include:
   - trigger condition,
   - impacted surface,
   - approver,
   - timestamp,
   - follow-up remediation owner.
