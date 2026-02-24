# CLAUDE.md - TradeITM Production Codex

> **AI-Maintained:** This project is built and maintained by Claude Code with minimal developer intervention.
> **Last Updated:** 2026-02-23

---

## 1. Stack & Environment

* **Runtime:** Node.js >= 22 (enforced via `.nvmrc`)
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

**Runtime requirement:** Final release evidence must be validated under Node >= 22.

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
2. Release gates are green under Node >= 22.
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

## 11. Update Log

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
