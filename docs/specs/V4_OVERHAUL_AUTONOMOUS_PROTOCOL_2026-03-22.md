# V4 Overhaul — Autonomous Execution Protocol

> **Date:** 2026-03-22
> **Governing Spec:** `docs/specs/V4_OVERHAUL_EXECUTION_SPEC_2026-03-22.md`
> **CLAUDE.md Reference:** Section 14 (Context Discipline), Section 13 (Session Boundaries)

---

## Purpose

This protocol enables unattended execution of the V4 Overhaul via Claude Code in tmux sessions. Each phase has a scope lock, run-log format, blocker handling procedure, and copy-paste commands for autonomous runs.

---

## 1. Per-Phase Scope Locks

Each phase has an explicit scope lock that prevents the agent from modifying files outside its boundary. These locks are enforced via the prompt, not tooling — the agent MUST respect them.

### Phase 1: Admin CMS Overhaul
```
SCOPE LOCK — Phase 1
ALLOWED TO MODIFY:
  app/admin/**
  components/admin/**
  app/api/admin/**
  e2e/specs/admin/**
  docs/specs/ADMIN_CMS_RUNBOOK_*.md

ALLOWED TO READ:
  lib/types/**
  lib/access-control/**
  Everything else (read-only)

NEVER MODIFY:
  backend/**
  supabase/migrations/**
  lib/spx/**
  app/members/**
  components/academy/**
```

### Phase 2: Content Revolution
```
SCOPE LOCK — Phase 2
ALLOWED TO MODIFY:
  lib/academy-v3/**
  app/api/academy-v3/**
  components/admin/academy/**
  components/academy/**
  supabase/migrations/*_content_versioning*.sql

ALLOWED TO READ:
  lib/types/academy.ts
  backend/src/routes/academy-*.ts
  Everything else (read-only)

NEVER MODIFY:
  app/admin/** (except academy subdir)
  backend/** (except academy routes)
  lib/spx/**
```

### Phase 3: Interactive Activities
```
SCOPE LOCK — Phase 3
ALLOWED TO MODIFY:
  components/academy/activities/**
  backend/src/services/academy-scoring.ts
  backend/src/routes/academy-activities.ts
  backend/src/routes/academy-admin.ts (analytics only)
  backend/src/services/__tests__/academy-scoring*
  e2e/specs/members/academy-activities*.spec.ts

ALLOWED TO READ:
  lib/types/academy.ts
  components/academy/** (read for patterns)
  Everything else (read-only)

NEVER MODIFY:
  app/admin/**
  lib/spx/**
  supabase/migrations/** (no schema changes in this phase)
```

### Phase 4: Gamification Enhancement
```
SCOPE LOCK — Phase 4
ALLOWED TO MODIFY:
  backend/src/services/academy-xp.ts
  backend/src/routes/academy-gamification.ts
  lib/types/academy.ts (XP/achievement types only)
  components/academy/academy-achievements.tsx
  components/social/leaderboard-table.tsx
  supabase/migrations/*_gamification*.sql
  lib/web-push-service.ts (notification additions only)

ALLOWED TO READ:
  Everything (read-only)

NEVER MODIFY:
  app/admin/**
  lib/spx/**
  backend/src/routes/chat.ts
```

### Phase 5: Platform Integration Hardening
```
SCOPE LOCK — Phase 5
ALLOWED TO MODIFY:
  backend/src/middleware/**
  backend/src/config/**
  backend/src/services/discord/**
  app/admin/system/page.tsx
  app/api/admin/system/**
  supabase/functions/**
  docs/specs/INTEGRATION_RUNBOOK_*.md

ALLOWED TO READ:
  Everything (read-only)

NEVER MODIFY:
  app/members/**
  components/academy/**
  lib/spx/engine.ts
  lib/spx/decision-engine.ts
```

### Phase 6: Legacy Deprecation
```
SCOPE LOCK — Phase 6
ALLOWED TO MODIFY:
  Files listed in V4_OVERHAUL_LEGACY_DEPRECATION_PLAN_2026-03-22.md ONLY
  supabase/migrations/*_drop_*.sql (new migration files only)
  docs/archive/** (move targets)
  docs/specs/V4_OVERHAUL_RELEASE_NOTES_*.md

ALLOWED TO READ:
  Everything (verification reads)

NEVER MODIFY:
  Any production code not listed in the deprecation plan
  Any active database tables
```

---

## 2. Run-Log Format

Every autonomous run must produce a structured log. The agent writes this to `docs/specs/v4-run-logs/` after each session.

### File Naming
```
docs/specs/v4-run-logs/phase{N}-slice{M}-{YYYY-MM-DD-HHmm}.md
```

### Template
```markdown
# Phase {N} Slice {M} Run Log

**Date:** {ISO timestamp}
**Branch:** {branch name}
**Head Commit (start):** {SHA}
**Head Commit (end):** {SHA}

## Objective
{One sentence: what this slice set out to accomplish}

## Changed Files
- `path/to/file.ts` — {what changed}
- `path/to/file.ts` — {what changed}

## Validation Results
| Command | Result | Notes |
|---------|--------|-------|
| `pnpm exec eslint <files>` | PASS/FAIL | {error details if FAIL} |
| `pnpm exec tsc --noEmit` | PASS/FAIL | {error details if FAIL} |
| `pnpm vitest run <suite>` | PASS/FAIL | {error details if FAIL} |
| `pnpm exec playwright test <spec>` | PASS/FAIL | {error details if FAIL} |

## Pre-Existing Failures
{List any failures that existed BEFORE this slice, with evidence}

## Risks / Notes
{Anything the next session needs to know}

## Next Action
{Exact next slice to execute, with file paths}
```

---

## 3. Blocker Handling Protocol

When an autonomous run hits a blocker, it must follow this decision tree:

### Decision Tree

```
BLOCKER DETECTED
    │
    ├── Is it a TypeScript error in MY files?
    │   └── YES → Fix it. Re-run validation. Continue.
    │
    ├── Is it a lint error in MY files?
    │   └── YES → Fix it. Re-run validation. Continue.
    │
    ├── Is it a test failure in MY new tests?
    │   └── YES → Fix the test or the code. Re-run. Continue.
    │
    ├── Is it a PRE-EXISTING failure (not caused by this slice)?
    │   └── YES → Document in run log under "Pre-Existing Failures".
    │           → Continue with the slice. Do NOT fix unrelated code.
    │
    ├── Is it a failure in files OUTSIDE my scope lock?
    │   └── YES → STOP. Document blocker. Write to run log:
    │           → "BLOCKED: {description}. Requires {agent role} to fix {file}."
    │           → Do NOT modify out-of-scope files.
    │
    ├── Is it a network/infrastructure failure?
    │   └── YES → Retry up to 3 times with 10s backoff.
    │           → If still failing: STOP. Document in run log.
    │
    ├── Is it a database/migration failure?
    │   └── YES → STOP immediately. Do NOT retry destructive operations.
    │           → Document exact error. Request human review.
    │
    └── Is it an ambiguous spec requirement?
        └── YES → STOP. Document the ambiguity in run log.
                → Do NOT guess. Request clarification.
```

### Blocker Severity Levels

| Level | Action | Example |
|-------|--------|---------|
| **L1 — Self-fixable** | Fix and continue | TS error in new code, lint warning, broken import |
| **L2 — Pre-existing** | Document and continue | Failing test in unrelated module, pre-existing lint warning |
| **L3 — Cross-scope** | Stop, document, flag | Need type change in `lib/types/`, need migration from DB agent |
| **L4 — Destructive risk** | Stop immediately, request human | Migration failure, data loss risk, unclear rollback |

---

## 4. Tmux Session Commands

### 4.1 Session Setup

```bash
# Create a tmux session for V4 Overhaul
tmux new-session -d -s v4-overhaul

# Split into panes: main (left) + validation (right)
tmux split-window -h -t v4-overhaul

# Select left pane for Claude Code
tmux select-pane -t v4-overhaul:0.0
```

### 4.2 Phase 1 — Admin CMS Overhaul

**Slice 1.1: Extract Member Access page**
```bash
# Left pane: Claude Code
tmux send-keys -t v4-overhaul:0.0 'claude --yes-to-all <<'"'"'PROMPT'"'"'
Implement V4 Overhaul Phase 1, Slice 1.1: Extract Member Access page.

Read the governing spec: docs/specs/V4_OVERHAUL_EXECUTION_SPEC_2026-03-22.md
Read the scope lock: docs/specs/V4_OVERHAUL_AUTONOMOUS_PROTOCOL_2026-03-22.md (Phase 1)

Scope:
- app/admin/members-access/page.tsx
- components/admin/members-access/ (new directory)

Requirements:
1) Extract the 1,565-line page into 4 components: MemberDirectory, MemberAuditLog, MemberDetailSheet, MemberSyncControls
2) Page.tsx becomes a thin shell that imports and composes the 4 components
3) Each component < 500 lines
4) No behavior changes — exact same UI and functionality
5) No unrelated changes

Validation:
- pnpm exec eslint app/admin/members-access/ components/admin/members-access/
- pnpm exec tsc --noEmit
- pnpm run build

Return:
- Changed files
- Command outputs (pass/fail)
- Risks/notes
- Write run log to docs/specs/v4-run-logs/phase1-slice1.1-$(date +%Y-%m-%d-%H%M).md
- Suggested commit message
PROMPT' Enter

```

**Slice 1.2: Extract Chat page**
```bash
tmux send-keys -t v4-overhaul:0.0 'claude --yes-to-all <<'"'"'PROMPT'"'"'
Implement V4 Overhaul Phase 1, Slice 1.2: Extract Chat page.

Read the governing spec: docs/specs/V4_OVERHAUL_EXECUTION_SPEC_2026-03-22.md
Read the scope lock: docs/specs/V4_OVERHAUL_AUTONOMOUS_PROTOCOL_2026-03-22.md (Phase 1)

Scope:
- app/admin/chat/page.tsx
- components/admin/chat/ (new directory)

Requirements:
1) Extract the 1,513-line page into 3 components: ChatConversationList, ChatMessageThread, ChatToolbar
2) Page.tsx becomes a thin shell < 400 lines
3) No behavior changes
4) No unrelated changes

Validation:
- pnpm exec eslint app/admin/chat/ components/admin/chat/
- pnpm exec tsc --noEmit
- pnpm run build

Return:
- Changed files
- Command outputs (pass/fail)
- Risks/notes
- Write run log to docs/specs/v4-run-logs/phase1-slice1.2-$(date +%Y-%m-%d-%H%M).md
- Suggested commit message
PROMPT' Enter
```

**Slice 1.3: Add Zod validation to admin API routes**
```bash
tmux send-keys -t v4-overhaul:0.0 'claude --yes-to-all <<'"'"'PROMPT'"'"'
Implement V4 Overhaul Phase 1, Slice 1.3: Add Zod validation to all admin API routes.

Read the governing spec: docs/specs/V4_OVERHAUL_EXECUTION_SPEC_2026-03-22.md

Scope:
- app/api/admin/*/route.ts (all POST/PATCH/DELETE routes)

Requirements:
1) Every POST, PATCH, and DELETE route must validate request body with Zod
2) Return 422 with structured error message on validation failure
3) Use consistent pattern: const parsed = schema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 422 })
4) Do NOT change GET routes
5) Do NOT change response shapes
6) No unrelated changes

Validation:
- pnpm exec eslint app/api/admin/
- pnpm exec tsc --noEmit

Return:
- Changed files
- Command outputs (pass/fail)
- Risks/notes
- Write run log to docs/specs/v4-run-logs/phase1-slice1.3-$(date +%Y-%m-%d-%H%M).md
- Suggested commit message
PROMPT' Enter
```

**Slice 1.4: Admin API route tests**
```bash
tmux send-keys -t v4-overhaul:0.0 'claude --yes-to-all <<'"'"'PROMPT'"'"'
Implement V4 Overhaul Phase 1, Slice 1.4: Add admin API route unit tests.

Read the governing spec: docs/specs/V4_OVERHAUL_EXECUTION_SPEC_2026-03-22.md

Scope:
- app/api/admin/**/__tests__/ (new test files)

Requirements:
1) Add tests for 6 route groups: trade-review, courses, alerts, members, settings, system
2) Each group gets at least: 1 happy-path test + 1 auth-failure test (returns 401/403)
3) Use vitest with mocked Supabase client
4) Follow existing test patterns in the codebase
5) No production code changes

Validation:
- pnpm exec tsc --noEmit
- pnpm vitest run app/api/admin/

Return:
- Changed files
- Command outputs (pass/fail)
- Risks/notes
- Write run log to docs/specs/v4-run-logs/phase1-slice1.4-$(date +%Y-%m-%d-%H%M).md
- Suggested commit message
PROMPT' Enter
```

**Slice 1.5: Admin E2E test baseline**
```bash
tmux send-keys -t v4-overhaul:0.0 'claude --yes-to-all <<'"'"'PROMPT'"'"'
Implement V4 Overhaul Phase 1, Slice 1.5: Admin E2E test baseline.

Read the governing spec: docs/specs/V4_OVERHAUL_EXECUTION_SPEC_2026-03-22.md
Read the Gold Standard QA process: CLAUDE.md Section 12

Scope:
- e2e/specs/admin/ (new directory)
- e2e/specs/admin/admin-test-helpers.ts
- e2e/specs/admin/admin-dashboard.spec.ts
- e2e/specs/admin/admin-courses.spec.ts
- e2e/specs/admin/admin-members.spec.ts

Requirements:
1) Create test helpers with mock factories and route handlers
2) Test admin dashboard loads with health checks
3) Test course CRUD (create, edit, publish, delete)
4) Test member directory view and search
5) Minimum 10 tests total across 3 spec files
6) Follow the established E2E patterns (enableBypass, setupShellMocks, serial mode, 60s timeout)

Validation:
- pnpm exec tsc --noEmit
- pnpm exec playwright test e2e/specs/admin/ --project=chromium --workers=1

Return:
- Changed files
- Command outputs (pass/fail)
- Risks/notes
- Write run log to docs/specs/v4-run-logs/phase1-slice1.5-$(date +%Y-%m-%d-%H%M).md
- Suggested commit message
PROMPT' Enter
```

**Slice 1.6: Admin runbook**
```bash
tmux send-keys -t v4-overhaul:0.0 'claude --yes-to-all <<'"'"'PROMPT'"'"'
Implement V4 Overhaul Phase 1, Slice 1.6: Admin operational runbook.

Read the governing spec: docs/specs/V4_OVERHAUL_EXECUTION_SPEC_2026-03-22.md

Scope:
- docs/specs/ADMIN_CMS_RUNBOOK_2026-03-22.md (new file)

Requirements:
1) Document all admin workflows: access control, member management, course management, trade review, alerts/discord, analytics, system diagnostics
2) Include common troubleshooting: locked accounts, sync failures, Discord reconnection, chat issues
3) Include emergency procedures: disable member access, force sync, clear cache
4) Reference the relevant API routes and admin pages for each workflow
5) No code changes

Return:
- Changed files
- Suggested commit message
PROMPT' Enter
```

### 4.3 Running a Full Phase Unattended

To run an entire phase as a sequence of slices:

```bash
#!/bin/bash
# v4-phase1-runner.sh — Run Phase 1 slices sequentially
# Usage: tmux send-keys -t v4-overhaul:0.0 'bash docs/specs/v4-phase1-runner.sh' Enter

set -e
BRANCH="claude/improve-code-quality-Inxjl"
LOG_DIR="docs/specs/v4-run-logs"
mkdir -p "$LOG_DIR"

echo "=== V4 Overhaul Phase 1 — Starting $(date -Iseconds) ==="

for SLICE in 1.1 1.2 1.3 1.4 1.5 1.6; do
  echo "--- Slice $SLICE — $(date -Iseconds) ---"

  # Run Claude Code with the slice prompt
  claude --yes-to-all -p "$(cat docs/specs/v4-prompts/phase1-slice${SLICE}.md)"

  # Validate after each slice
  echo "--- Validating Slice $SLICE ---"
  pnpm exec tsc --noEmit || { echo "BLOCKED: tsc failed after slice $SLICE"; exit 1; }
  pnpm exec eslint app/admin/ components/admin/ app/api/admin/ --quiet || { echo "BLOCKED: lint failed after slice $SLICE"; exit 1; }

  # Commit
  git add -A
  git commit -m "feat(admin): V4 Phase 1 Slice $SLICE — $(date +%Y-%m-%d)"

  echo "--- Slice $SLICE COMPLETE ---"
done

# Phase-level validation
echo "=== Phase 1 Final Validation ==="
pnpm run build || { echo "BLOCKED: build failed"; exit 1; }
echo "=== Phase 1 COMPLETE — $(date -Iseconds) ==="

# Push
git push -u origin "$BRANCH"
```

### 4.4 Monitoring an Autonomous Run

```bash
# Watch the run from another terminal
tmux attach-session -t v4-overhaul

# Check run logs
ls -la docs/specs/v4-run-logs/

# Check git log for progress
git log --oneline -10

# Check for blockers (grep run logs for BLOCKED)
grep -r "BLOCKED" docs/specs/v4-run-logs/ 2>/dev/null

# Kill a stuck run
tmux send-keys -t v4-overhaul:0.0 C-c
```

---

## 5. Session Boundary Rules (from CLAUDE.md Section 13.8)

### Start a New Session When:

1. **Phase change** — Always start fresh for a new phase.
2. **After 4-5 slices** — Context quality degrades after ~5 slices (Section 14.10).
3. **After a blocker** — If an L3/L4 blocker was hit, start fresh after resolution.
4. **After context compaction** — If the agent notices context was compressed.
5. **After heavy validation failures** — 3+ consecutive validation failures suggest stale context.

### Session Handoff Block (Required)

Every session must end with:

```markdown
## Session Handoff

**Branch:** claude/improve-code-quality-Inxjl
**Head Commit:** {SHA}
**Phase/Slice:** Phase {N}, Slice {M}
**Files Touched:** {list}
**Validation:**
- eslint: PASS/FAIL
- tsc: PASS/FAIL
- vitest: PASS/FAIL
- playwright: PASS/FAIL
**Pre-Existing Failures:** {list or "none"}
**Next Action:** Phase {N}, Slice {M+1}: {description}
```

---

## 6. Autonomous Run Checklist

Before starting any autonomous run:

- [ ] Branch is up to date: `git pull origin claude/improve-code-quality-Inxjl`
- [ ] No uncommitted changes: `git status` is clean
- [ ] Run log directory exists: `mkdir -p docs/specs/v4-run-logs`
- [ ] Node version correct: `node -v` shows >= 20.19.5
- [ ] Dependencies installed: `pnpm install` succeeds
- [ ] Build baseline passes: `pnpm run build` succeeds
- [ ] TypeScript baseline: `pnpm exec tsc --noEmit` passes (or pre-existing failures documented)

---

## 7. Recovery Procedures

### Agent Produces Bad Code (Quality Degradation Detected)

Signals per CLAUDE.md Section 14.8:
- `any` types appearing
- Growing TODO comments
- Duplicated logic
- Weak test assertions

**Recovery:**
```bash
# 1. Stop the run
tmux send-keys -t v4-overhaul:0.0 C-c

# 2. Review what changed
git diff --stat HEAD~3

# 3. If quality is bad, reset to last good commit
git log --oneline -5  # find last good commit
git reset --soft HEAD~N  # unstage bad commits (keep files for review)

# 4. Start a fresh session with explicit re-anchoring
claude --yes-to-all -p "Review the last 3 commits on this branch. Identify any quality issues per CLAUDE.md Section 14. Report findings."
```

### Database Migration Failure

```bash
# 1. STOP — do not retry
# 2. Check migration status
npx supabase db push --dry-run

# 3. If migration partially applied, check state
npx supabase db reset --linked  # WARNING: destructive on linked DB

# 4. Restore from backup if needed (manual — not automatable)
```

### Build Failure After Multiple Slices

```bash
# 1. Find which slice broke the build
git bisect start
git bisect bad HEAD
git bisect good <last-known-good-sha>
# git bisect will binary search for the breaking commit

# 2. Fix the breaking slice
# 3. Cherry-pick good slices on top
```

---

## 8. Phase Completion Criteria

A phase is COMPLETE only when ALL are true:

1. All slices in the phase are committed
2. Phase-level validation gates pass (see execution spec per phase)
3. Run logs exist for every slice in `docs/specs/v4-run-logs/`
4. No L3/L4 blockers remain unresolved
5. Session handoff block written
6. Branch pushed to remote
7. PR created (or existing PR updated) with:
   - Phase summary
   - Changed file count
   - Validation evidence
   - Known pre-existing failures
   - Rollback plan
