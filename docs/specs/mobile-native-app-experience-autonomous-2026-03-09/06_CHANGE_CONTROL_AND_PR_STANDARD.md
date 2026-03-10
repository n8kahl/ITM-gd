# Change Control & PR Standard — Mobile Native App Experience Hardening

**Workstream:** Members iPhone Native-Feel Hardening  
**Date:** 2026-03-09  
**Governing Spec:** `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_EXECUTION_SPEC_2026-03-09.md`

---

## 1. Branch Strategy

| Branch | Purpose | Lifecycle |
|--------|---------|-----------|
| `codex/mobile-pwa` | Primary workstream branch | Created at workstream start and merged after release gates pass |
| `codex/mobile-pwa-slice-X.Y` | Optional per-slice branch | Short-lived; merged to `codex/mobile-pwa` once slice gates are green |

Rules:
- All implementation work occurs on `codex/mobile-pwa` or a `codex/mobile-pwa-slice-X.Y` child branch.
- No direct commits to `main`.
- Rebase from `main` at phase boundaries to reduce drift.

---

## 2. Commit Message Format

```text
<type>(<scope>): <outcome>

[Optional context body]
```

Types:
- `feat`
- `fix`
- `test`
- `docs`
- `refactor`
- `chore`

Scopes for this workstream:
- `mobile-nav` for slices `1.1`, `1.2`, `1.3`
- `market-continuity` for slices `2.1`, `2.2`, `2.3`
- `mobile-shell` for slices `3.1`, `3.2`, `3.3`
- `ai-coach-mobile` for slice `4.1`
- `e2e-mobile` for slice `4.2`
- `docs` for slice `4.3`

Examples:
```text
fix(mobile-nav): remove hard-reload fallback from members tab transitions
feat(market-continuity): render last-known-good market payload with stale timestamp
test(e2e-mobile): add members tab-storm regression coverage for mobile shells
```

---

## 3. PR Standard

PR title:
`[Mobile-Native] Slice X.Y: <outcome>`

PR body template:

```markdown
## Slice
Slice X.Y — <name> (Phase N)

## Changes
- [file path]: one-line purpose

## Validation
- `pnpm exec eslint <files>`: PASS/FAIL
- `pnpm exec tsc --noEmit`: PASS/FAIL
- `pnpm vitest run <tests>`: PASS/FAIL (if applicable)
- `pnpm exec playwright test <spec>`: PASS/FAIL (if applicable)

## Acceptance Criteria
- [ ] Criterion 1 — MET/NOT MET
- [ ] Criterion 2 — MET/NOT MET

## Risks / Notes
- Deviations, deferrals, or constraints

## Rollback
- Exact rollback command/path
```

---

## 4. Review Protocol

| Reviewer | Responsibility |
|----------|---------------|
| Orchestrator | Scope control, spec compliance, and phase readiness |
| Frontend/Backend Author | Functional correctness and regression surface review |
| QA Agent | Test reliability, selector quality, and release gate integrity |

Review checklist:
1. Only in-scope files changed.
2. Slice acceptance criteria are met with evidence.
3. Required validation commands passed.
4. Rollback path is explicit and viable.
5. Tracker + risk/decision docs were updated in the same slice.

---

## 5. Merge Policy

1. Slice-level validation gates must pass before merge.
2. At least one reviewer sign-off is required.
3. No unresolved P0/P1 review comments.
4. Change control log and execution tracker must be updated before merge.
5. Use squash merges into `codex/mobile-pwa` to keep slice boundaries clear.
6. Merge to `main` only after final release gates pass.

---

## 6. Change Control Log

| Date | Slice | Change | Author | Approved By | Notes |
|------|-------|--------|--------|-------------|-------|
| 2026-03-09 | Planning | Authored full §6.3 autonomous documentation packet and phase/slice plan for members iPhone native-feel hardening | Orchestrator | Pending spec approval | No product code changes |

This table must be updated for every slice completion, deferment, or rollback.

---

## 7. Emergency Change Process

If a production regression appears during execution:

1. Pause current slice work.
2. Create a hotfix branch from `main`.
3. Implement minimal-scope corrective fix.
4. Run impacted release gates.
5. Merge hotfix to `main`.
6. Rebase `codex/mobile-pwa` onto updated `main`.
7. Record incident + decision in change control and risk register before resuming planned slices.
