# CLAUDE.md - TradeITM Production Codex

> **AI-Maintained:** This project is built and maintained by Claude Code with minimal developer intervention.
> **Last Updated:** 2026-03-01

---

## 1. Stack & Environment

* **Runtime:** Node.js >= 20.19.5
* **Package Manager:** pnpm 10+ (never npm or yarn)
* **Frontend:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4
* **Backend:** Express.js (TypeScript) in `backend/`
* **Database:** Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions)
* **Testing:** Vitest (unit) + Playwright (E2E) + @axe-core/playwright (a11y)
* **Error Tracking:** Sentry (client, server, edge configs at repo root)
* **CI/CD:** GitHub Actions (`.github/workflows/`)

### Key Commands

```bash
# Development
pnpm dev                          # Next.js dev server
npm run dev --prefix backend      # Express dev server (tsx watch)

# Build & Lint
pnpm run build                    # Production build (webpack)
pnpm build:turbo                  # Turbo build (faster)
pnpm exec tsc --noEmit            # Type check
pnpm exec eslint .                # Lint entire project

# Testing
pnpm test                         # Vitest unit tests
pnpm test:e2e                     # All Playwright E2E
pnpm test:e2e:health              # Health-check suite
pnpm test:e2e:auth                # Auth flow suite

# Database
npx supabase db push              # Apply migrations
npx supabase functions deploy     # Deploy edge functions
```

---

## 2. Design System: "The Emerald Standard"

* **Primary Theme:** Emerald Green (`#10B981`) & Champagne (`#F3E5AB`).
* **Forbidden:** Do NOT use `#D4AF37` (old Gold). Refactor to Emerald on sight.
* **Aesthetic:** Private Equity / Terminal / Quiet Luxury. **Dark mode only.**
* **Full Reference:** `docs/BRAND_GUIDELINES.md`

### CSS Variables (app/globals.css)

* `var(--emerald-elite)` for primary actions.
* `var(--champagne)` for subtle accents.
* `glass-card-heavy` for all card/container surfaces.

### Typography

* Headings: `Playfair Display` (serif, luxury).
* Body: `Inter` (sans, readability).
* Data/Terminal: `Geist Mono` (prices, P&L, account IDs).

### Component Rules

* **UI Base:** Shadcn/UI, always modified with `glass-card-heavy`.
* **Icons:** Lucide React, stroke width `1.5`.
* **Images:** Always use `next/image`.
* **Imports:** Use `@/` alias for absolute imports.
* **Branding:** Use `<Image src="/logo.png" ... />`. Never use `<Sparkles />` as a logo.
* **Loading States:** Use "Pulsing Logo" skeleton (`components/ui/skeleton-loader.tsx` variant="screen"). Never a browser spinner.
* **Mobile First:** Layouts must stack on mobile. Check `hidden md:flex` patterns.

---

## 3. Market Data API: Massive.com

* **CRITICAL:** The provider is **Massive.com**. NEVER say "Polygon.io" or "Polygon" - that name is deprecated and causes significant issues.
* **API Base URL:** `https://api.massive.com`
* **Env Var:** `MASSIVE_API_KEY`
* **Config:** `backend/src/config/massive.ts`
* **Usage:** Options, Stocks, Indices data for AI Coach and SPX Command Center.

---

## 4. Architecture Map

```
ITM-gd/
  app/                    # Next.js App Router (routes, API, server actions)
    admin/                # Admin dashboard (analytics, chat, courses, members)
    members/              # Protected user features
      academy/            # Training content
      ai-coach/           # AI coaching interface
      journal/            # Trade journal
      profile/            # Trader identity hub
      social/             # Community & leaderboard
      spx-command-center/ # S&P 500 trading command center
      studio/             # Content creation tools
    api/                  # Lightweight API routes (most logic in backend/)
  backend/                # Express.js backend (separate package.json)
    src/config/           # Service configs (massive, redis, openai, etc.)
    src/routes/           # REST endpoints (spx, market, chat, etc.)
    src/services/         # Business logic (websocket, tick streams, etc.)
    src/middleware/        # Auth, rate limiting, validation
  components/             # React components (by domain: ai-coach, spx, journal, etc.)
  contexts/               # React contexts (SPX state management)
  hooks/                  # Custom React hooks
  lib/                    # Shared utilities and business logic
    spx/                  # SPX engine, decision engine, replay, optimizer
    ai-coach/             # AI Coach logic
    journal/              # Journal grading, sanitization
  supabase/               # Migrations, edge functions, seeds
  e2e/                    # Playwright E2E tests
  docs/                   # 150+ files: specs, runbooks, brand guidelines
    specs/                # Execution specs, phase/slice reports, release notes
    ai-coach/             # AI Coach implementation docs
```

### External Services

| Service | Purpose | Env Var |
|---------|---------|---------|
| Massive.com | Market data (options, stocks, indices) | `MASSIVE_API_KEY` |
| FRED | Macroeconomic indicators | `FRED_API_KEY` |
| FMP | Financial modeling data | `FMP_API_KEY` |
| OpenAI | AI Coach LLM backend | `OPENAI_API_KEY` |
| Supabase | Database, auth, realtime, storage | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Sentry | Error tracking | `SENTRY_DSN` |
| WHOP | Membership webhooks | `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_COMPANY_ID` |
| Redis | Caching, rate limiting | `REDIS_URL` |
| Discord | Community notifications | (see `backend/src/services/discordNotifier.ts`) |

> **Single-Process Massive WebSocket Constraint:** Massive upstream tick ingest must have exactly one active backend holder at a time. For horizontally scaled deployments, set `MASSIVE_TICK_LOCK_ENABLED=true` so Redis advisory locking elects a single upstream owner and non-owners remain poll-only.

---

## 5. Feature Registry

### SPX Command Center
* **Route:** `/members/spx-command-center`
* **Engine:** `lib/spx/engine.ts`, `decision-engine.ts`, `replay-engine.ts`
* **Tests:** `lib/spx/__tests__/`, `e2e/spx-*.spec.ts`
* **Specs:** `docs/specs/SPX_COMMAND_CENTER_*.md`

### AI Coach
* **Route:** `/members/ai-coach`
* **Backend:** `backend/src/routes/chat.ts`, `backend/src/routes/screenshot.ts`
* **Specs:** `docs/ai-coach/MASTER_SPEC.md`, `docs/ai-coach/V2_REBUILD_SPEC.md`

### Trade Journal
* **Route:** `/members/journal`
* **Logic:** `lib/journal/`
* **Specs:** `docs/specs/TRADE_JOURNAL_V2_SPEC.md`

### Trade Journal Review (Coach)
* **Admin Routes:** `/admin/trade-review`, `/admin/trade-review/[id]`
* **Admin APIs:** `/api/admin/trade-review/*`
* **Member APIs:** `/api/members/journal/[id]/request-review`, `/api/members/journal/[id]/coach-feedback`
* **Specs:** `docs/specs/TRADE_JOURNAL_REVIEW_EXECUTION_SPEC_2026-03-01.md`

### Academy
* **Routes:** `/members/academy`, `/members/academy/modules/[slug]`, `/members/academy/lessons/[id]`
* **Legacy Redirects:** `/members/library` and `/members/academy-v3/*` redirect to canonical routes.
* **API Namespace:** `/api/academy-v3/*`

### Profile Hub
* **Route:** `/members/profile`
* **APIs:** `/api/members/profile`, `/api/members/profile/transcript`, `/api/members/affiliate`

### Trade Social
* **Route:** `/members/social`
* **APIs:** `/api/social/feed`, `/api/social/leaderboard`, `/api/social/share-trade`

### WHOP Integration
* **Webhook Route:** `/api/webhooks/whop`
* **Events:** `membership.went_valid`, `membership.went_invalid`, `payment.succeeded`, `setup_intent.succeeded`

---

## 6. Standard Process: Spec-First Autonomous Delivery

This is the required process for major features, recoveries, and production hardening.

### 6.1 Discovery and Drift Analysis (Before Design)
1. Analyze recent commit history and drift for target surfaces (48-hour lookback for active incident work).
2. Map regressions by category: UX flow, state machine, command parity, selector stability, data trust.
3. Document findings before proposing implementation.

### 6.2 Architecture + Experience Design (Before Coding)
1. Produce architecture proposal and experience design first.
2. Produce a concrete execution spec with: objective, constraints, in/out scope, phase/slice plan, acceptance criteria, release gates.
3. Produce an interactive local mockup for scope validation.
4. Do not begin implementation until design/spec is approved.

### 6.3 Required Autonomous Documentation Packet
Maintain all of the following for autonomous execution:
1. Master execution spec: `docs/specs/<FEATURE>_EXECUTION_SPEC_<DATE>.md`
2. Phase slice reports: `docs/specs/<FEATURE>_PHASE*_SLICE_*.md`
3. Release notes: `docs/specs/<FEATURE>_RELEASE_NOTES_<DATE>.md`
4. Runbook: `docs/specs/<FEATURE>_RUNBOOK_<DATE>.md`
5. Autonomous control packet:
   - `docs/specs/<feature>-autonomous-<date>/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
   - `docs/specs/<feature>-autonomous-<date>/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
   - `docs/specs/<feature>-autonomous-<date>/08_AUTONOMOUS_EXECUTION_TRACKER.md`

### 6.4 Implementation Cadence (Per Slice)
1. Define objective, scope, out-of-scope, target files, risks, rollback.
2. Implement code for only that slice.
3. Run validation gates.
4. Update change control, risk/decision log, execution tracker, and slice report with exact results.
5. Proceed to next slice only after current slice is green.

### 6.5 Validation Gates

**Slice-level gates:**
```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
pnpm vitest run <targeted tests>
pnpm exec playwright test <targeted specs> --project=chromium --workers=1
```

**Release-level gates:**
```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run lib/spx/__tests__
pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1
```

**Runtime requirement:** Final release evidence must be validated under Node >= 20.19.5.

### 6.6 Test Contract Rules
1. Use deterministic selectors for critical state assertions.
2. If strict-mode locator ambiguity appears, add explicit test IDs at the owning UI boundary immediately.
3. Keep command behavior parity across keyboard, palette, action strip, and mobile/desktop CTA surfaces.

### 6.7 Repo Hygiene and Commit Policy
1. Stage only intentional scope files for the release commit.
2. Keep exploratory prototypes/spec drafts out of production commits unless approved.
3. Never use destructive git cleanup unless explicitly requested.
4. Commit once release gates are green and docs are synchronized.

### 6.8 Closure Criteria
A workstream is complete only when:
1. Execution spec checklist is fully checked.
2. Release gates are green under Node >= 20.19.5.
3. Release notes + runbook are current.
4. Change control + risk/decision log + tracker are current.
5. Production deploy approval is explicitly recorded.

---

## 7. Multi-Agent Orchestration

This project is designed for autonomous multi-agent development. The following guidelines ensure safe, coordinated, high-quality delivery across parallel agent sessions.

### 7.1 Agent Roles & Specialization

| Agent Role | Scope | Tools | Model |
|------------|-------|-------|-------|
| **Orchestrator** | Coordination, spec authoring, release gates, final review | All | opus |
| **Frontend Agent** | React components, App Router pages, Tailwind, UI tests | Read, Write, Edit, Bash (lint/build), Glob, Grep | sonnet |
| **Backend Agent** | Express routes, services, middleware, backend tests | Read, Write, Edit, Bash (tsc/test), Glob, Grep | sonnet |
| **SPX Engine Agent** | `lib/spx/` modules, decision engine, optimizer, replay | Read, Write, Edit, Bash (vitest), Glob, Grep | opus |
| **Database Agent** | Supabase migrations, RLS policies, edge functions, SQL | Read, Write, Supabase MCP tools | sonnet |

---

## 8. Prompt-Driven Production Loop (Replicable Playbook)

Use this when the operator is non-technical and wants safe, production-grade delivery via short Codex sessions.

### 8.1 Operating Model
1. Work in thin slices. One prompt = one scoped change with explicit boundaries.
2. Always require validation command output before moving to next slice.
3. Keep a running "done vs remaining" list to avoid hidden drift.
4. Keep backend and frontend contracts explicit (status codes, payload shapes, units).
5. Prefer fail-closed behavior for auth and security checks.

### 8.2 Session Contract (What to Ask For Every Time)
Every implementation prompt must require this exact response format:
1. `Changed files`
2. `Command outputs (pass/fail)`
3. `Risks/notes`
4. `Suggested commit message`

If any section is missing, do not advance to next slice.

### 8.3 Prompt Template (Copy/Paste)
```md
Implement <slice name>.

Scope:
- <absolute file path 1>
- <absolute file path 2>

Requirements:
1) <requirement>
2) <requirement>
3) No unrelated changes.

Validation:
- <exact command 1>
- <exact command 2>

Return:
- changed files
- command outputs (pass/fail)
- risks/notes
- suggested commit message
```

### 8.4 Slice Ordering Pattern (Recommended)
1. Data contracts and canonical types.
2. Auth and route skeletons.
3. Core backend pipeline.
4. Proxy/transport layer.
5. Frontend shell + health preflight.
6. UI feature surfaces (charts, panels, controls).
7. Cross-surface consistency (units, limits, status mapping).
8. Test hardening (unit + route tests).
9. Auth alignment and operational drift mitigation.
10. Release evidence + runbook updates.

### 8.5 Hard Gates Before Moving Forward
1. Typecheck passes in every touched package (`root` and `backend` as needed).
2. Lint passes for touched files.
3. New behavior has at least one targeted test for non-happy-path.
4. Error handling is deterministic and user-facing where appropriate.
5. No hidden contract mismatch (units, enum values, response schema).

### 8.6 Common Failure Modes to Actively Prevent
1. Frontend/backend unit mismatch (percent vs decimal, timestamp zone assumptions).
2. Route/status mismatch (e.g., 422 vs 502 vs 500).
3. Admin gate drift between page and API layers.
4. DB constraint drift vs TypeScript unions.
5. "Config constant" mistaken as enforced runtime limiter.
6. Tests placed outside discovery pattern (`__tests__` for Jest in backend).

### 8.7 Review Rhythm (One-Line Status Rule)
After each completed slice, produce:
1. What changed.
2. What remains (highest-risk item next).
3. Next exact prompt.

### 8.8 Safety Rules for Non-Developers Running Sessions
1. Never accept "done" without validation command output.
2. Never merge slices that modify out-of-scope files.
3. Never skip auth/error-path tests for privileged routes.
4. Prefer additive migrations and fail-closed auth behavior.
5. Keep prompts explicit: file paths, commands, and "no unrelated changes".

### 8.9 Release Checklist (Prompt-Run Projects)
1. Route contracts documented and tested.
2. Admin/auth consistency documented with operational runbook note.
3. Timeouts and size limits enforced both server and UI.
4. External dependency failures mapped to explicit status codes.
5. At least one route test for each privileged endpoint: 401, 403, and happy path.
6. Final summary includes:
   - implemented slices,
   - residual risks,
   - rollback points,
   - suggested commit grouping.
| **QA Agent** | E2E tests, integration tests, a11y audits, validation | Read, Bash (playwright/vitest), Glob, Grep | sonnet |
| **Docs Agent** | Spec authoring, release notes, runbooks, tracker updates | Read, Write, Edit, Glob | haiku |
| **Explorer Agent** | Codebase investigation, drift analysis, file discovery | Read, Glob, Grep (read-only) | haiku |

### 7.2 File Ownership Boundaries

Agents must respect file ownership to prevent merge conflicts and unintended side effects.

```
Frontend Agent:
  owns:     app/**, components/**, styles/**, public/**
  reads:    lib/types/**, lib/validation/**
  never:    backend/**, supabase/migrations/**, lib/spx/engine*

Backend Agent:
  owns:     backend/src/**
  reads:    lib/types/**, lib/api/**
  never:    app/**, components/**, e2e/**

SPX Engine Agent:
  owns:     lib/spx/**, contexts/spx/**
  reads:    backend/src/routes/spx.ts, backend/src/services/massive*
  never:    app/admin/**, components/academy/**

Database Agent:
  owns:     supabase/**, scripts/**/db-*, scripts/**/migrate-*
  reads:    lib/types/**, backend/src/config/database.ts
  never:    app/**, components/**

QA Agent:
  owns:     e2e/**, __tests__/**, *.spec.ts, *.test.ts
  reads:    Everything (read-only for non-test files)
  never:    Modifies production code (report issues, don't fix)

Docs Agent:
  owns:     docs/specs/**, docs/ai-coach/**, docs/BRAND_GUIDELINES.md
  reads:    Everything
  never:    Modifies code files
```

**Shared files** (sequential modification only, coordinate via Orchestrator):
- `lib/types/**` - Type definitions
- `package.json` - Dependencies
- `app/globals.css` - Global styles
- `.env.example` - Environment variable documentation

> **Horizontal Scaling Callout:** `backend/src/services/massiveTickStream.ts` owns single-upstream coordination for Massive WebSocket ingest. When running multiple backend instances, `MASSIVE_TICK_LOCK_ENABLED=true` is required so only one instance opens the upstream socket.

### 7.3 Orchestration Patterns

**Pattern 1: Parallel Investigation**
Use when: Starting a new workstream or auditing drift.
```
Orchestrator spawns:
  - Explorer Agent: "Map all files touched in last 48h for <surface>"
  - QA Agent: "Run full validation gates, report status"
  - Docs Agent: "Review spec currency for <feature>"
All report back to Orchestrator for synthesis.
```

**Pattern 2: Sequential Slice Delivery**
Use when: Implementing a phase/slice from an approved spec.
```
Orchestrator:
  1. Assigns slice to domain agent (Frontend/Backend/SPX)
  2. Domain agent implements and runs slice-level gates
  3. QA Agent validates (E2E, a11y, regression)
  4. Docs Agent updates slice report and tracker
  5. Orchestrator verifies and advances to next slice
```

**Pattern 3: Parallel Feature Build**
Use when: Multiple independent slices can proceed simultaneously.
```
Orchestrator assigns:
  - Frontend Agent: UI components (Slice A)
  - Backend Agent: API endpoints (Slice B)
  - Database Agent: Migrations (Slice C)
Sync point: All three complete → QA Agent runs integration tests.
```

**Pattern 4: Incident Recovery**
Use when: Production regression detected.
```
Orchestrator:
  1. Explorer Agent: Identify regression source and blast radius
  2. Domain agent: Implement fix (bounded scope)
  3. QA Agent: Verify fix + run regression suite
  4. Docs Agent: Update risk register and change control
  5. Orchestrator: Release gate check → deploy approval
```

### 7.4 Handoff Protocol

When agents hand off work:
1. **State Summary:** Agent documents what was done, what files changed, what tests pass/fail.
2. **Blocker Declaration:** If blocked, state exactly what is needed and from which agent role.
3. **Context Preservation:** Include the minimal context the next agent needs (file paths, error messages, spec references).
4. **Never Assume:** Don't assume another agent's work is complete. Verify before building on it.

### 7.5 Conflict Resolution

1. **Type conflicts:** Domain agent that introduced the type owns the fix.
2. **Import conflicts:** Frontend Agent owns component imports; Backend Agent owns service imports.
3. **Test failures from another agent's code:** QA Agent reports to Orchestrator; Orchestrator assigns fix to the owning domain agent.
4. **Spec ambiguity:** Orchestrator resolves and updates the spec before any agent proceeds.

### 7.6 Context Compaction Survival

When context compacts mid-session, the agent must preserve:
- Current slice objective and scope
- Files modified and their purposes
- Test status (what passes, what fails)
- Active branch and commit strategy
- Blockers and pending handoffs
- Reference to the governing spec document

---

## 8. Hooks Configuration

### Recommended hooks for `.claude/settings.local.json`:

```jsonc
{
  "hooks": {
    "PreToolUse": [
      {
        // Block modifications to critical config without explicit approval
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "bash -c 'INPUT=$(cat); FILE=$(echo $INPUT | jq -r \".tool_input.file_path // empty\"); if echo \"$FILE\" | grep -qE \"(next\\.config|supabase/migrations|backend/src/config/database)\"; then echo \"CRITICAL FILE: $FILE - requires orchestrator approval\" >&2; exit 2; fi; exit 0'"
        }]
      }
    ],
    "PostToolUse": [
      {
        // Auto-lint after file writes
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "bash -c 'INPUT=$(cat); FILE=$(echo $INPUT | jq -r \".tool_input.file_path // empty\"); if echo \"$FILE\" | grep -qE \"\\.(ts|tsx)$\"; then pnpm exec eslint \"$FILE\" --fix 2>/dev/null || true; fi'"
        }]
      },
      {
        // TypeScript type-check agent: runs tsc --noEmit after every git commit.
        // Only reports errors in files that were part of the commit (ignores pre-existing errors).
        // If committed files have TS errors, the hook fails (exit 1) and the agent must fix them.
        // Script: .claude/tsc-check-commit.sh
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "bash -c 'INPUT=$(cat); CMD=$(echo \"$INPUT\" | jq -r \".tool_input.command // empty\"); if echo \"$CMD\" | grep -qE \"git commit\"; then /home/user/ITM-gd/.claude/tsc-check-commit.sh; fi; exit 0'"
        }]
      }
    ]
  }
}
```

---

## 9. Quality Standards for Production Grade

### 9.1 Code Quality Gates (Every PR)
- TypeScript strict mode: zero `any` types in new code.
- ESLint: zero warnings in touched files.
- Build: `pnpm run build` succeeds without errors.
- Unit tests: all pass, coverage >= 80% for new modules.
- E2E tests: all targeted specs pass.
- A11y: no critical axe-core violations in new UI.

### 9.2 Performance Standards
- Lighthouse score >= 90 for member-facing routes.
- No client-side bundle increase > 10KB without justification.
- API response time < 500ms p95 for non-data-intensive endpoints.
- WebSocket reconnection within 3 seconds.
- Use `pnpm analyze` to audit bundle size before major releases.

### 9.3 Security Standards
- All Supabase tables must have RLS policies. Run `get_advisors(type: "security")` after DDL changes.
- No secrets in client-side code or git history.
- All API endpoints require authentication unless explicitly public.
- Rate limiting on all public-facing endpoints.
- Input validation (Zod schemas) on all API inputs.

### 9.4 Database Standards
- Every schema change requires a migration file in `supabase/migrations/`.
- Migrations must be idempotent and reversible.
- No raw SQL in application code; use Supabase client or typed queries.
- Index all foreign keys and frequently-queried columns.
- Run `get_advisors(type: "performance")` after adding tables or indexes.

### 9.5 Documentation Standards
- Every major feature has an execution spec in `docs/specs/`.
- API changes documented in route file JSDoc comments.
- Breaking changes noted in release notes.
- Runbook updated for any new operational procedures.

---

## 10. Collaboration Defaults: SPX Optimization

These defaults apply to SPX-related workstreams unless explicitly overridden:

1. Prioritize measurable win-rate and R:R outcomes over feature breadth.
2. Prefer Massive second-bar historical replay as canonical backtest fidelity (`usedMassiveMinuteBars=false` target for strict runs).
3. Avoid fallback-mode conclusions when true Massive historical coverage is requested; fail closed and report data-quality gaps.
4. Keep optimizer governance visible in-product: nightly automation status, manual `Run Scan & Optimize`, audit history, profile revert controls.
5. Present optimizer outcomes with actionable detail (by-strategy breakdowns, weighted averages, objective/expectancy deltas), not just headline T1/T2.
6. Maintain spec-driven cadence: slice spec first, bounded implementation, gates, then governance doc updates.
7. Performance claims must include exact date range, sample counts/trades, and whether results are strict replay vs mixed/fallback.
8. Keep collaboration loop tight: frequent progress updates, direct accuracy answers, and explicit next-step recommendations tied to measurable impact.
9. Always report execution-actual coverage and slippage (non-proxy vs proxy) for optimizer credibility.

---

## 11. Gold Standard: Incremental Development & QA Process

This is the proven process for building, testing, and hardening any feature surface. It separates **authoring** from **validation** across sessions to ensure clean, reproducible results.

### 11.1 Process Overview

The workflow has three distinct phases, each in its own session:

1. **Session A — Plan & Author:** Explore the surface, identify gaps, design the test matrix, write all code/tests.
2. **Session B — Validate & Fix:** Run validation gates (tsc, eslint, playwright), fix selector issues iteratively.
3. **Session C — Harden & Commit:** Final green run, commit, update docs.

Separating authoring from validation prevents resource exhaustion and ensures each phase gets a clean environment.

### 11.2 Session A: Plan & Author

**Step 1 — Enter Plan Mode and explore the surface.**
Read every component, hook, API route, and type file for the target feature. Map the full surface area: what exists, what's tested, what's not.

**Step 2 — Identify coverage gaps.**
Compare existing E2E tests against the component/route inventory. Categorize gaps by priority: Critical (core user journeys with zero coverage), High (important interactions), Medium (edge cases, a11y).

**Step 3 — Design the test matrix.**
Produce a phased plan document with exact spec file names, test counts per file, and mock requirements. Example structure:

```
Phase 1: Mock Infrastructure (helpers file)
Phase 2: Critical Coverage (3 spec files, ~19 tests)
Phase 3: Detail & Navigation (3 spec files, ~16 tests)
Phase 4: Edge Cases & Pagination (2 spec files, ~12 tests)
Phase 5: Accessibility (1 spec file, ~4 tests)
```

**Step 4 — Build mock infrastructure first.**
Create or expand the `*-test-helpers.ts` file with all factories and setup functions before writing any spec files. This ensures every spec file imports from a single, consistent source.

**Step 5 — Write spec files in priority order.**
Use sub-agents for parallel creation when files are independent. Each spec file follows the project's established patterns:

```typescript
test.describe.configure({ mode: 'serial' })
test.beforeEach(async ({ page }) => {
  test.setTimeout(60_000)
  await enableBypass(page)
  await setupShellMocks(page)
  await setupFeatureMocks(page)
})
```

**Step 6 — Verify imports and exports.**
Before ending the session, run a read-only verification pass across all new files to confirm every import resolves and every exported helper is actually used.

### 11.3 Session B: Validate & Fix

**Step 1 — Type check.**
```bash
pnpm exec tsc --noEmit
```
Fix any TypeScript errors in the new files. Common issues: missing type exports, incorrect mock shapes, import paths.

**Step 2 — Lint.**
```bash
pnpm exec eslint e2e/specs/members/<feature>*.spec.ts e2e/specs/members/<feature>-test-helpers.ts
```
Fix lint errors. Common issues: unused imports, missing return types, formatting.

**Step 3 — Run Playwright tests.**
```bash
pnpm exec playwright test e2e/specs/members/<feature>*.spec.ts --project=chromium --workers=1
```
Expect some failures on the first run — this is normal. The iteration loop is:

1. **Read the failure output.** Identify the failing selector or assertion.
2. **Check the actual component.** Read the source file to find the correct selector (class name, aria-label, role, text content).
3. **Update the spec file.** Fix the selector to match the actual DOM.
4. **Re-run the single failing spec.** `pnpm exec playwright test <file> --project=chromium --workers=1 -g "test name"`
5. **Repeat** until all tests pass.

**Step 4 — Add test IDs if needed.**
If a component's DOM is ambiguous (multiple elements match a selector), add `data-testid` attributes at the component boundary. This is the only time production code should change during QA.

### 11.4 Session C: Harden & Commit

**Step 1 — Full green run.**
```bash
pnpm exec playwright test e2e/specs/members/<feature>*.spec.ts --project=chromium --workers=1
```
All tests must pass. No skips, no flaky re-runs.

**Step 2 — Run broader regression.**
Ensure the new tests haven't broken existing tests:
```bash
pnpm exec playwright test e2e/specs/members/ --project=chromium --workers=1
```

**Step 3 — Commit with scope.**
Stage only the new/modified E2E files and any `data-testid` additions to components:
```bash
git add e2e/specs/members/<feature>*.spec.ts e2e/specs/members/<feature>-test-helpers.ts
git add <any components with new data-testid attributes>
git commit -m "test(<feature>): add E2E coverage — <N> tests across <M> spec files"
```

**Step 4 — Update documentation.**
Update the feature's execution spec or release notes with the new test inventory.

### 11.5 Test File Conventions

| Convention | Pattern |
|------------|---------|
| Helpers file | `<feature>-test-helpers.ts` |
| Spec naming | `<feature>-<aspect>.spec.ts` (e.g., `journal-analytics.spec.ts`) |
| Mock factories | `createMock<Entity>(overrides?)` returns full object with sensible defaults |
| Setup functions | `setup<Feature>Mock(page, data?)` registers `page.route()` handlers |
| Bundle function | `setupAll<Feature>Mocks(page)` calls all individual setup functions |
| Selectors | Prefer `getByRole`, `getByLabel`, `getByText`; fall back to `data-testid` |
| Assertions | Use `expect.poll(() => ..., { timeout: 10_000 })` for async state |
| Timeouts | `test.setTimeout(60_000)` in every `beforeEach` |

### 11.6 Priority Tiers for Coverage Gaps

When auditing a new surface, categorize gaps into tiers to sequence work:

| Tier | Description | Examples |
|------|-------------|---------|
| **Critical** | Core user journeys with zero E2E coverage | Page loads, primary CRUD, navigation, auth |
| **High** | Important interactions users rely on daily | Detail sheets, filters, real-time updates |
| **Medium** | Edge cases, advanced features, polish | Pagination, combined filters, accessibility |

Always complete Critical tier before starting High. Always complete High before Medium. This ensures maximum value from partial progress if a session runs out of context.

### 11.7 When to Apply This Process

This process is required for:
- E2E QA audits of any member-facing feature surface
- Major feature additions with multiple components
- Recovery/hardening sprints after production regressions
- Any workstream touching more than 5 files

For smaller changes (single component fix, isolated bug), the standard slice cadence in Section 6.4 is sufficient.

---

## 12. Upgrade Execution Standard & Session Boundaries (2026-03-01)

This section is the canonical operating system for medium/large upgrades (including SPX Command Center hardening).

### 12.1 90-Day Upgrade Frame (Deterministic)

Use a release train, not ad-hoc tasking:

1. Planning window: **Monday, March 2, 2026 -> Friday, May 29, 2026**
2. Buffer/hardening day: **Saturday, May 30, 2026**
3. Cadence: **2-week sprints**, **Friday release gates**
4. Risk posture:
   - P0 work must be behind flags when blast radius is not low.
   - P0 introduced failures cannot be deferred.

### 12.2 Required In-Repo Artifacts

For any audit-driven upgrade, land these files first (or confirm they already exist and are current):

1. `docs/audits/<date>-<initiative>-audit.md`
2. `docs/roadmap/<date>_90-day-plan.md`
3. `docs/roadmap/risk-register.md`
4. `docs/roadmap/seam-gaps.md`
5. `docs/roadmap/definition-of-done.md`

These are required before implementation starts so the plan is executable and reviewable.

### 12.3 Workstream Structure (Epics)

Use explicit epics so slices remain bounded:

1. `EPIC-A` Execution Safety v2
2. `EPIC-B` Data Quality Contract
3. `EPIC-C` Setup Pipeline Correctness
4. `EPIC-D` Database/RLS Hardening + Schema Truth
5. `EPIC-E` Optimizer Enforcement + History UX
6. `EPIC-F` UX Persistence + Accessibility + Performance Budget
7. `EPIC-G` Test Harness + CI Gates + Runbooks

Each ticket must include: problem, evidence, risk, acceptance criteria, test plan, rollout plan.

### 12.4 Upgrade Delivery Standard (Per Slice)

Use this flow for every slice:

1. **Initialize**
   - Create/continue scoped branch: `codex/<initiative>`.
   - Capture baseline: branch, `git status`, unrelated dirty files.
   - Confirm in-scope and out-of-scope files.
2. **Slice**
   - One independently verifiable unit (contract/backend/UI/tests/docs).
   - Do not mix unrelated work in one commit.
3. **Implement**
   - Touch only required files.
   - Add tests in the same slice.
   - Maintain compatibility unless contract change is intentional and documented.
4. **Validate (Required order)**
```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
npm --prefix backend test -- --runInBand <targeted-backend-suites>
pnpm exec playwright test <targeted-e2e-specs> --project=chromium --workers=1
```
5. **Classify failures**
   - Introduced by slice: fix before commit.
   - Pre-existing: document explicitly in session output and PR notes.
6. **Commit**
   - Stage only intentional files.
   - Format: `feat|fix|test|docs(<scope>): <outcome>`.
7. **Push/PR**
   - Include changed files by slice, validation outcomes, residual failures, rollback plan.

### 12.5 Correct Quality Process (Non-Negotiable DoD)

A slice is done only if all are true:

1. Acceptance criteria met.
2. Lint + typecheck pass for touched scope.
3. At least one non-happy-path test exists for new production logic.
4. Telemetry/logging added for production-path behavior changes.
5. Docs/runbook updated when operational behavior changed.
6. Rollout/rollback path defined (flag if risk > low).
7. Known pre-existing failures are captured with evidence.

### 12.6 Mandatory Flags for Risky Upgrades

For high-risk upgrade paths, implement and use:

1. `executionV2`
2. `snapshotQualityV1`
3. `optimizerGateEnforcedV1`
4. `setupTickSymbolGateV1`

Flag behavior must be consistent across backend and frontend surfaces.

### 12.7 Mandatory Session Output Contract

Every implementation session must end with:

1. `Changed files`
2. `Validation commands + pass/fail`
3. `Known pre-existing failures (if any)`
4. `Risks/notes`
5. `Suggested next slice`

### 12.8 When to Start a New Session (Decision Matrix)

Start a **new session** when any are true:

1. Phase change:
   - authoring -> validation
   - validation -> release/push
2. Objective change (new epic/slice family).
3. Domain count exceeds two major areas in one pass (for example backend + DB + frontend) and context clarity drops.
4. Clean verification pass is needed after heavy edits or context compaction.
5. Repeated tool/runtime instability blocks reliable progress.
6. High-risk operation requires isolated auditability (migrations, execution safety paths, kill switch logic).
7. You are preparing handoff to another agent/person and need deterministic continuity.

Stay in the **same session** when all are true:

1. Same slice objective.
2. Same domain/fileset.
3. Validation loop is converging.
4. No context confusion or tool instability.

### 12.9 First 72-Hour Startup Sequence (New Upgrade)

Day 1:
1. Create scoped branch.
2. Land audit/roadmap/risk/seam-gap/DoD docs.
3. Confirm ticket + PR templates are present.

Day 2:
1. Open epics and sprint-ticket breakdown.
2. Add/enable schema contract tests and setup-type alignment tests.

Day 3:
1. Ship highest-impact correctness/security fixes first.
2. Deploy to staging and run smoke validation.

### 12.10 Session Handoff Block (Required)

When starting a new session, provide:

```md
Branch:
Head commit:
Slice objective:
Files touched:
Validation run:
- <command>: pass/fail
Known pre-existing failures:
Next exact action:
```

This handoff is required for deterministic continuity across sessions.

---

## 13. Update Log

### 2026-02-27: Gold Standard Development Process
- Added Section 11: Incremental Development & QA Process.
- Documented three-session workflow (Author → Validate → Harden).
- Added test file conventions, priority tiers, and selector iteration loop.
- Proven across SPX Command Center (~35 tests), Trade Journal (~49 tests), and Dashboard (~40 tests) E2E audits.

### 2026-03-01: Upgrade Standard + Session Boundary Rules
- Added/expanded Section 12 as the canonical deterministic upgrade standard.
- Added 90-day release train framing, required audit artifacts, and 7-epic structure.
- Added non-negotiable DoD with telemetry/runbook/rollback requirements.
- Added mandatory risk flags and first-72-hour startup sequence.
- Added explicit new-session decision matrix and required handoff block.

### 2026-02-23: CLAUDE.md Upgrade
- Added multi-agent orchestration guidelines (Section 7).
- Added agent roles, file ownership boundaries, orchestration patterns, handoff protocols.
- Added hooks configuration (Section 8).
- Added production quality standards (Section 9).
- Reorganized into numbered sections for agent-parseable structure.
- Templatized autonomous documentation paths for reuse across features.

### 2026-02-14: Upload Intelligence Rollout
- AI Coach screenshot analysis returns structured intent and suggested action IDs.
- AI Coach chat supports screenshot and CSV staging with post-upload actionable chips.
- Trade Journal screenshot flows auto-analyze uploads and support form prefill.
- Implementation: `docs/ai-coach/UPLOAD_INTELLIGENCE_ROLLOUT_2026-02-14.md`.

### 2026-02-14: Screenshot UX & Monitoring Fixes
- Screenshot-based `add_to_monitor` persists extracted positions into tracked setups.
- AI Coach uploads no longer inject raw `data:image/...` payloads into chat.
- Chat bubbles force wrap for long tokens/URLs.
- Journal header Screenshot action closes import mode before launching quick entry.
