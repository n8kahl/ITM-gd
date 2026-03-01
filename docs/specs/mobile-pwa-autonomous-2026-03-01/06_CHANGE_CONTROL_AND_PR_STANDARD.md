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
| 2026-03-01 | Planning | Completed pre-implementation documentation packet templates and aligned release gate commands with spec/test contract | Orchestrator | Pending spec approval | No product code changes |
| 2026-03-01 | 1.1 | Removed `getMobileTabs()` five-tab cap to restore full mobile-visible tab reachability | Frontend Agent | Orchestrator | Validation: eslint + tsc pass |
| 2026-03-01 | 1.2 | Hardened mobile More menu with `max-h-[60vh]`, overflow scroll, and safe-area bottom padding | Frontend Agent | Orchestrator | Validation: eslint + tsc pass |
| 2026-03-01 | 1.3 | Enabled SPX immersive mobile route mode by conditionally hiding bottom nav on `/members/spx-command-center` | Frontend Agent | Orchestrator | Validation: eslint + tsc pass |
| 2026-03-01 | 1.4 | Removed Studio mobile hard-block and converted blur controls to pointer/tap interactions with touch-sized affordances | Frontend Agent | Orchestrator | Validation: eslint + tsc pass |
| 2026-03-01 | Phase 1 Gate | Executed milestone gates (`eslint .`, `tsc`, `build`) and recorded temporary Playwright deferment until Slice 4.2 mobile suite exists | Frontend Agent | Orchestrator | `e2e/mobile-*.spec.ts` not yet present; tracked in D-006 |
| 2026-03-01 | 2.1 | Refactored options chain for mobile segmented Calls/Puts mode, sticky headers, overflow scrolling, and condensed mobile columns | Frontend Agent | Orchestrator | Validation: eslint + tsc pass |
| 2026-03-01 | 2.2 | Removed hover-only dependency for critical session delete actions and increased touch targets to mobile-safe sizing | Frontend Agent | Orchestrator | Validation: eslint + tsc pass |
| 2026-03-01 | 2.3 | Added dvh/safe-area utilities and normalized journal sheet heights/padding for mobile and standalone mode stability | Frontend Agent | Orchestrator | Validation: eslint + tsc pass |
| 2026-03-01 | Phase 2 Gate | Executed milestone gates (`eslint .`, `tsc`, `build`) and recorded temporary Playwright deferment until Slice 4.2 mobile suite exists | Frontend Agent | Orchestrator | `e2e/mobile-*.spec.ts` not yet present; tracked in D-006 |
| 2026-03-01 | 3.1 | Overhauled manifest/install metadata and added complete icon + screenshot asset pipeline for installability coverage | Frontend Agent | Orchestrator | Validation: eslint + tsc + build pass |
| 2026-03-01 | 3.2 | Updated service worker to keep `/api/*` network-only by default with explicit allowlist cache strategy for safe endpoints | Frontend Agent | Orchestrator | Validation: build pass |
| 2026-03-01 | 3.3 | Added user-facing push notification enable/disable controls with permission/install-state guidance and error handling | Frontend Agent | Orchestrator | Validation: eslint + tsc pass |
| 2026-03-01 | 3.4 | Implemented custom install CTA + hook for Chromium prompt flow and iOS add-to-home-screen guidance | Frontend Agent | Orchestrator | Validation: eslint + tsc pass |
| 2026-03-01 | 3.5 | Added iOS splash generation pipeline, startup image links, and project script/dependency wiring | Frontend Agent | Orchestrator | Validation: tsc + build pass |
| 2026-03-01 | 3.6 | Added standalone display-mode CSS hardening for safe-area nav layout and touch interaction behavior | Frontend Agent | Orchestrator | Validation: eslint + build pass |
| 2026-03-01 | Phase 3 Gate | Executed milestone gates (`eslint .`, `tsc`, `build`) and recorded temporary Playwright deferment until Slice 4.2 mobile suite exists | Frontend Agent | Orchestrator | `e2e/mobile-*.spec.ts` not yet present; tracked in D-006 |
| 2026-03-01 | 4.1 | Added `pwa-chromium` Playwright project and implemented PWA regression suite for manifest, SW registration, offline journal queue, and install prompt detection | QA Agent | Orchestrator | Validation: eslint + tsc + playwright(pwa-chromium) pass |
| 2026-03-01 | 4.2 | Added mobile regression suite + helper module for nav reachability, More menu behavior, SPX immersive nav hiding, and Studio mobile route validation | QA Agent | Orchestrator | Validation: playwright(chromium) pass (`4 passed`, `1 skipped`) |
| 2026-03-01 | 4.3 | Finalized phase reports, release notes, runbook, tracker, and risk/decision logs with Phase 4 outcomes | Docs Agent | Orchestrator | Manual review pass |
| 2026-03-01 | Phase 4 / Final Gate | Executed final release gates (`eslint .`, `tsc`, `build`, `vitest`, mobile Playwright, pwa Playwright) | QA Agent | Orchestrator | All gates pass; D-007 deferment tracked for AI Coach options-toggle fixme |

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
