# Change Control & PR Standard — Mobile UX + PWA Workstream

**Workstream:** Mobile Reachability, Native-Feel UX, and PWA Installability
**Date:** 2026-03-01
**Governing Spec:** `docs/specs/MOBILE_PWA_EXECUTION_SPEC_2026-03-01.md`

---

## 1. Branch Strategy

| Branch | Purpose | Lifecycle |
|--------|---------|-----------|
| `codex/mobile-pwa` | Primary workstream branch | Created at workstream start, merged to `main` at release |
| `codex/mobile-pwa-slice-X.Y` | Per-slice branches (optional) | Short-lived, merged to `codex/mobile-pwa` after slice gates pass |

**Rules:**
- All work happens on `codex/mobile-pwa` or child branches.
- No direct commits to `main`.
- Rebase on `main` weekly to prevent drift.

---

## 2. Commit Message Format

```
<type>(<scope>): <outcome>

[Optional body with context]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**Types:** `feat`, `fix`, `test`, `docs`, `refactor`, `style`, `chore`

**Scopes for this workstream:**
- `mobile-nav` — Slices 1.1, 1.2
- `spx-mobile` — Slice 1.3
- `studio-mobile` — Slice 1.4
- `ai-coach-mobile` — Slice 2.1
- `mobile-ux` — Slices 2.2, 2.3
- `pwa` — Slices 3.1, 3.2, 3.4, 3.5, 3.6
- `push` — Slice 3.3
- `e2e` — Slices 4.1, 4.2

**Examples:**
```
feat(mobile-nav): uncap getMobileTabs to restore feature reachability
fix(pwa): switch /api/* SW caching to network-only
test(e2e): add PWA installability and offline journal regression tests
```

---

## 3. PR Standard

Every PR must include:

### Title
`[Mobile-PWA] Slice X.Y: <outcome>`

### Body Template

```markdown
## Slice
Slice X.Y — <name> (Phase N)

## Changes
- [ file list with one-line description per file ]

## Validation
- `pnpm exec eslint <files>`: PASS/FAIL
- `pnpm exec tsc --noEmit`: PASS/FAIL
- `pnpm run build`: PASS/FAIL (phase gates only)
- `pnpm exec playwright test <specs>`: PASS/FAIL (if applicable)

## Acceptance Criteria Status
- [ ] Criterion 1 — MET/NOT MET
- [ ] Criterion 2 — MET/NOT MET

## Risks / Notes
- <any deviations from spec, pre-existing failures, or discovered issues>

## Rollback
<exact rollback procedure>

## Screenshots / Evidence
<mobile viewport screenshots if UI changed>
```

---

## 4. Review Protocol

| Reviewer | Responsibility |
|----------|---------------|
| Orchestrator | Spec compliance, scope adherence, cross-slice consistency |
| QA Agent | Test coverage, selector quality, regression risk |
| Domain Agent (author) | Implementation correctness, performance impact |

**Review checklist:**
1. Only in-scope files modified.
2. Acceptance criteria met with evidence.
3. Validation commands pass.
4. No unrelated changes.
5. Rollback plan is viable.
6. Execution tracker updated.

---

## 5. Merge Policy

1. All slice-level validation gates must pass.
2. At least one reviewer approval (Orchestrator or QA Agent).
3. No unresolved comments.
4. Execution tracker updated before merge.
5. Squash merge to `codex/mobile-pwa` (preserve slice boundaries in commit message).
6. Final merge to `main` uses merge commit (preserves full history).

---

## 6. Change Control Log

| Date | Slice | Change | Author | Approved By | Notes |
|------|-------|--------|--------|-------------|-------|
| | | | | | |

*This table is updated with every PR merge or spec deviation.*

---

## 7. Emergency Change Process

If a production regression is discovered during this workstream:

1. **Stop** current slice work.
2. **Branch** from `main` (not `codex/mobile-pwa`).
3. **Fix** with minimal scope.
4. **Validate** with full release gates.
5. **Merge** directly to `main`.
6. **Rebase** `codex/mobile-pwa` onto updated `main`.
7. **Document** in change control log and risk register.
