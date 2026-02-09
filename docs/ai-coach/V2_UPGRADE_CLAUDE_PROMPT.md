# Claude Code Prompt — V2 Upgrade Implementation

Copy and paste this entire prompt into a new Claude Code session to begin the V2 upgrade.

---

## PROMPT START

You are a senior full-stack engineer implementing the V2 upgrade for the TradeITM AI Coach platform. This is a production codebase with 373 passing backend tests, circuit breakers, rate limiting, and Zod validation. **You must not break anything that already works.**

### Your Mission

Surgically upgrade this repo to match `docs/ai-coach/AI_COACH_V2_REBUILD_SPEC.md`, using the phased execution plan in `docs/ai-coach/V2_UPGRADE_FEASIBILITY_ANALYSIS.md`. You will work **one phase at a time**, verifying each phase is complete and all existing tests pass before moving to the next.

### Required Reading (Do This First)

Before writing ANY code, read these documents in order. They are your source of truth:

1. `docs/ai-coach/AI_COACH_V2_REBUILD_SPEC.md` — **CANONICAL IMPLEMENTATION SPEC** (markdown import of the approved rebuild PDF). This is the feature/build target and acceptance reference for AI Coach V2.

2. `docs/ai-coach/V2_UPGRADE_FEASIBILITY_ANALYSIS.md` — **EXECUTION/DELIVERY GUIDE**. Contains the phased upgrade plan, overlap matrix, migration strategy, estimates, risk register, and what NOT to touch. Use this for sequencing and scope control.

3. `docs/ai-coach/PHASE_2_IMPLEMENTATION_SPEC.md` — AI Coach Phase 2 remaining work (SSE streaming, screenshot-to-chat, alert worker, user profile, Sentry, E2E). Phase 2 WP1 (SSE Streaming) is a **prerequisite** for V2 Phase B. WP2 (Screenshot-to-Chat) should be done before Phase D.

4. `docs/specs/TITM_MEMBER_ADMIN_REDESIGN_SPEC.md` — The full V2 Member/Admin Redesign specification (134KB, 22 sections). This is the **detailed feature spec** for everything you're building. Reference specific sections when implementing each phase:
   - Section 7: Trade Journal (Phase C, D, E)
   - Section 8: Social Trade Cards (Phase G)
   - Section 9: Massive.com Integration (Phase A, B, C, D)
   - Section 10: AI Coach Integration Points (Phase A, D)
   - Section 6: Member Dashboard (Phase F)
   - Sections 11-15: Admin Platform (Phase H)
   - Sections 2-3: Design System (Phase I)
   - Section 16: Database Schema (Phase A)
   - Section 17: API Routes (Phase C)

5. `docs/ai-coach/MASTER_SPEC.md` — Original AI Coach spec. Understand what was built and why.

### Codebase Orientation

**Backend** (`backend/src/`):
- `server.ts` — Express app entry point
- `routes/` — All REST endpoints (chat, journal, options, levels, leaps, chart, alerts, macro, screenshot)
- `chatkit/functions.ts` — 15 AI function definitions for GPT-4 function calling
- `chatkit/functionHandlers.ts` — Function execution logic (Massive.com queries, DB lookups)
- `chatkit/systemPrompt.ts` — AI Coach system prompt
- `config/massive.ts` — Massive.com API client with Redis caching (7 methods)
- `middleware/` — Auth, rate limiting, Zod validation
- `__tests__/` — 22 test suites, 373 tests

**Frontend** (`app/`, `components/`):
- `app/members/` — Member-facing pages
- `app/admin/` — Admin pages (analytics, chat, leads, team, courses, knowledge base)
- `components/ai-coach/` — AI Coach trading interface (charts, options, LEAPS, scanner)
- `components/ui/` — Shared UI components (chat-widget, message-bubble, etc.)
- `contexts/MemberAuthContext.tsx` — Auth state management

**Database**: Supabase PostgreSQL with RLS. Migrations in `backend/migrations/`.

**Key Tech**: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, TradingView Lightweight Charts 5, Recharts, Zustand 5, Supabase, Express.js, OpenAI GPT-4, Redis, Massive.com API.

### Critical Rules

1. **EXTEND, DON'T REPLACE.** The existing backend is production-hardened. Add new routes/services alongside existing ones. Never rewrite working code unless the feasibility analysis explicitly says "REWRITE".

2. **DO NOT TOUCH these files** (unless the feasibility analysis explicitly says to make a minor update):
   - `chatkit/functions.ts` — AI function definitions
   - `routes/chat.ts` — Chat endpoints
   - `routes/options.ts`, `routes/levels.ts`, `routes/leaps.ts`, `routes/chart.ts`, `routes/macro.ts`
   - `components/ui/chat-widget.tsx`, `components/ui/message-bubble.tsx`
   - `components/ai-coach/*` — All AI Coach trading components

3. **RUN TESTS AFTER EVERY PHASE.** From `backend/`, run `npm test`. All 373+ tests must pass. If you break a test, fix it before continuing. Do not skip phases.

4. **ALL TICKERS, NOT JUST SPX/NDX.** The AI Coach works with any ticker symbol via Massive.com. Every new feature (WebSocket relay, enrichment, replay, verification, dashboard ticker) must support arbitrary ticker symbols. Never hardcode SPX or NDX.

5. **NO SUBSCRIPTION TIER ENFORCEMENT.** All users get full access to everything. Don't implement tier gating.

6. **COMMIT AFTER EACH PHASE.** Create a clean git commit with a descriptive message after completing each phase. Format: `feat(v2-phase-X): <description>`.

7. **FOLLOW EXISTING PATTERNS.** Look at how existing routes, middleware, and services are structured before writing new ones. Match the style exactly (Zod validation, error handling, response format, circuit breaker wrapping for OpenAI calls).

### Phase Execution Order

Complete the **prerequisite Phase 2 work packages first**, then proceed through V2 phases:

```
PREREQUISITES (from PHASE_2_IMPLEMENTATION_SPEC.md):
  → WP1: SSE Streaming (required for Phase B)
  → WP2: Screenshot-to-Chat Pipeline (required for Phase D)
  → WP5: Sentry Integration (recommended before adding 30+ endpoints)

V2 UPGRADE PHASES (from V2_UPGRADE_FEASIBILITY_ANALYSIS.md):
  → Phase A: Database Foundation & Massive.com Service Extension
  → Phase B: WebSocket Relay & SSE Infrastructure
  → Phase C: Journal Backend Extension
  → Phase D: Auto-Enrichment, Smart Tags & Verification
  → Phase E: Journal Frontend Redesign
  → Phase F: Member Dashboard Redesign
  → Phase G: Social Trade Cards
  → Phase H: Admin Platform Enhancements
  → Phase I: Design System Migration
```

### Per-Phase Workflow

For EACH phase, follow this exact workflow:

1. **Read** the phase description in `V2_UPGRADE_FEASIBILITY_ANALYSIS.md`
2. **Read** the corresponding section(s) in `TITM_MEMBER_ADMIN_REDESIGN_SPEC.md` for detailed requirements
3. **Audit** the existing code that will be touched — read the files, understand the patterns
4. **Implement** the changes, following existing code patterns
5. **Test** — run `cd backend && npm test` to verify no regressions
6. **Verify** the acceptance criteria listed for that phase
7. **Commit** — `git add <specific files> && git commit -m "feat(v2-phase-X): <description>"`
8. **Report** what was done, what was tested, any issues found

### Phase A Detailed Kickoff

Start with Phase A (Database Foundation). Here's exactly what to do:

1. Read `V2_UPGRADE_FEASIBILITY_ANALYSIS.md` Section 4 (Database Migration Strategy) and Section 5 Phase A
2. Read `TITM_MEMBER_ADMIN_REDESIGN_SPEC.md` Section 16 (Database Schema)
3. Create a new migration file in `backend/migrations/` with:
   - ALTER TABLE `trading_journal_entries` adding 10 new columns (all nullable with defaults)
   - ALTER TABLE `journal_streaks` adding 3 new columns
   - CREATE TABLE for 5 new tables with RLS policies
   - CREATE INDEX for performance indexes
   - 4 new RPC functions (get_dashboard_stats, get_equity_curve, get_trading_calendar, get_admin_analytics)
4. Seed `tab_configurations` with 6 default tabs
5. Seed `journal_quick_tags` with default categories
6. Extend `backend/src/config/massive.ts` with new methods: `getMinuteBars()`, `getMarketContextSnapshot()`, `verifyPrice()` — all supporting ANY ticker symbol
7. Update `backend/src/chatkit/functionHandlers.ts` — the `get_trade_history` handler should include new columns (market_context, smart_tags, verification) in its response
8. Run tests — all 373 must still pass
9. Commit: `feat(v2-phase-a): database foundation and massive.com service extension`

### Important Context

- The frontend is Next.js 16 with App Router (not Pages Router)
- Supabase is used for both database and auth (Discord OAuth)
- The backend Express server runs on port 3001, frontend on port 3000
- Redis is used for caching Massive.com API responses
- The AI Coach uses OpenAI function calling (not tool_use) — functions are defined in `chatkit/functions.ts`
- There are JSX mockups in `docs/specs/mockups/` for the journal and dashboard — reference these for UI implementation
- `tsconfig.json` has `noImplicitAny: true` — always add explicit type annotations

### When You Hit a Blocker

If you encounter something unclear:
1. Check all three spec documents for the answer
2. Look at how the existing codebase handles similar patterns
3. Choose the most conservative approach that doesn't break existing functionality
4. Document your decision in a code comment with `// V2 UPGRADE: <reasoning>`

Begin by reading the required documents, then start Phase A.

## PROMPT END
