# CLAUDE.md - Project Context & Rules

## Design System: "The Emerald Standard"
* **Primary Theme:** Emerald Green (`#10B981`) & Champagne (`#F3E5AB`).
* **Forbidden:** Do NOT use the old Gold hex `#D4AF37`. If you see it, refactor it to Emerald.
* **Aesthetic:** Private Equity / Terminal / Quiet Luxury. Dark mode only.

## Coding Conventions
* **Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase.
* **Components:** Use Shadcn/UI base, modified with `glass-card-heavy` utility.
* **Icons:** Lucide React.
* **Images:** Always use `next/image`.
* **Imports:** Use `@/` alias for absolute imports.

## Refactoring Rules
1.  **Mobile First:** Always ensure layouts stack correctly on mobile. Check `hidden md:flex` patterns.
2.  **Branding:**
    * Use `<Image src="/logo.png" ... />` for branding.
    * Never use `<Sparkles />` as a logo placeholder.
3.  **Loading States:**
    * Use the "Pulsing Logo" skeleton pattern (`components/ui/skeleton-loader.tsx` variant="screen").
    * Never use a generic browser spinner.

## Global Variables (app/globals.css)
* Use `var(--emerald-elite)` for primary actions.
* Use `var(--champagne)` for subtle accents.
* Use `glass-card-heavy` for containers.

## Market Data API: Massive.com
* **CRITICAL:** The market data provider is **Massive.com**. NEVER refer to it as "Polygon.io" or "Polygon" — that name is deprecated and causes significant issues.
* **API Base URL:** `https://api.massive.com`
* **Env Var:** `MASSIVE_API_KEY`
* **Usage:** Options, Stocks, Indices data for the AI Coach backend (`backend/src/config/massive.ts`)

## Development Context
* **Full Documentation:** See `CLAUDE.md` for comprehensive development guidelines
* **Brand Guidelines:** See `docs/BRAND_GUIDELINES.md` for complete design system
* **AI Coach Docs:** See `docs/ai-coach/` for implementation specs and roadmap
* **Supabase MCP:** Fully configured - see architecture section in `CLAUDE.md`
* **AI-Maintained:** This project is built and maintained by Claude Code with minimal developer intervention

## Standard Process: Spec-First Autonomous Delivery (Repository Default)
This is the required process for major features, recoveries, and production hardening in this repo.

### 1) Discovery and Drift Analysis (Before Design)
1. Analyze recent commit history and drift for target surfaces (default lookback: last 48 hours for active incident/recovery work).
2. Map regressions by contract category: UX flow, state machine, command parity, selector stability, and data trust.
3. Document findings before proposing implementation.

### 2) Architecture + Experience Design (Before Coding)
1. Produce architecture proposal and detailed experience design first.
2. Produce a concrete execution spec with:
   - Objective and constraints
   - In/out of scope
   - Phase and slice plan
   - Acceptance criteria
   - Release gates
3. Produce an interactive local mockup for scope validation and iterate until approved.
4. Do not begin implementation until design/spec scope is approved.

### 3) Required Autonomous Documentation Packet
For autonomous execution, maintain all of the following:
1. Master execution spec:
   - `docs/specs/SPX_COMMAND_CENTER_PRODUCTION_RECOVERY_EXECUTION_SPEC_2026-02-20.md`
2. Phase slice reports:
   - `docs/specs/SPX_COMMAND_CENTER_PHASE*_SLICE_*.md`
3. Release notes:
   - `docs/specs/SPX_COMMAND_CENTER_RELEASE_NOTES_2026-02-21.md`
4. Runbook:
   - `docs/specs/SPX_COMMAND_CENTER_RUNBOOK_2026-02-20.md`
5. Autonomous control packet:
   - `docs/specs/spx-production-recovery-autonomous-2026-02-20/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
   - `docs/specs/spx-production-recovery-autonomous-2026-02-20/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
   - `docs/specs/spx-production-recovery-autonomous-2026-02-20/08_AUTONOMOUS_EXECUTION_TRACKER.md`

### 4) Implementation Cadence (Per Slice)
Each slice must follow this loop:
1. Define objective, scope, out-of-scope, target files, risks, and rollback.
2. Implement code for only that slice.
3. Run validation gates.
4. Update change control, risk/decision log, execution tracker, and slice report with exact commands/results.
5. Proceed to next slice only after current slice is green.

### 5) Validation Gates (Required)
Run and record these gates:
1. Slice-level gates:
   - `pnpm exec eslint <touched files>`
   - `pnpm exec tsc --noEmit`
   - `pnpm vitest run <targeted tests>`
   - `pnpm exec playwright test <targeted specs> --project=chromium --workers=1`
2. Release-level gates:
   - `pnpm exec eslint .`
   - `pnpm exec tsc --noEmit`
   - `pnpm run build`
   - `pnpm vitest run lib/spx/__tests__`
   - `pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1`
3. Runtime requirement:
   - Final release evidence must be validated under Node `>=22` (project standard).

### 6) Test Contract Rules
1. Use deterministic selectors for critical state assertions.
2. If strict-mode locator ambiguity appears, add explicit test IDs at the owning UI boundary and update tests immediately.
3. Keep command behavior parity across keyboard, palette, action strip, and mobile/desktop CTA surfaces.

### 7) Repo Hygiene and Commit Policy
1. Stage only intentional scope files for the release commit.
2. Keep exploratory prototypes/spec drafts out of production commits unless explicitly approved.
3. Never use destructive git cleanup unless explicitly requested.
4. Commit once release gates are green and docs are synchronized with actual results.

### 8) Closure Criteria
A workstream is complete only when all are true:
1. Execution spec checklist is fully checked.
2. Release gates are green under Node `>=22`.
3. Release notes + runbook are current.
4. Change control + risk/decision log + tracker are current.
5. Production deploy approval is explicitly recorded.

## Profile Hub
* **Route:** `/members/profile`
* **Purpose:** Trader identity and account control center.
* **Sections:** Identity card, trading transcript, academy progress, Discord community, WHOP affiliate, settings.
* **Key APIs:** `/api/members/profile`, `/api/members/profile/transcript`, `/api/members/affiliate`, `/api/members/profile/views`.

## Trade Social
* **Route:** `/members/social`
* **Purpose:** Community feed and performance discovery.
* **Features:** Feed filters, likes, achievement gallery, community highlights, leaderboard snapshots.
* **Key APIs:** `/api/social/feed`, `/api/social/feed/[itemId]/like`, `/api/social/leaderboard`, `/api/social/share-trade`, `/api/social/community-stats`.

## WHOP Integration
* **Webhook Route:** `/api/webhooks/whop`
* **Required Env Vars:** `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_COMPANY_ID`
* **Handled Events:** `membership.went_valid`, `membership.went_invalid`, `payment.succeeded`, `setup_intent.succeeded`

## Academy
* **Canonical Routes:** `/members/academy`, `/members/academy/modules`, `/members/academy/modules/[slug]`, `/members/academy/lessons/[id]`, `/members/academy/review`, `/members/academy/progress`
* **Legacy Redirects:** `/members/library` and `/members/academy-v3/*` redirect to canonical academy routes.
* **API Namespace:** Academy runtime APIs remain under `/api/academy-v3/*`.


## Update: 2026-02-14 Upload Intelligence Rollout
- AI Coach screenshot analysis now returns structured intent and suggested action IDs.
- AI Coach chat now supports screenshot and CSV staging with post-upload actionable chips.
- AI Coach center screenshot flow now surfaces one-tap next-step actions.
- Trade Journal screenshot flows now auto-analyze uploads and support top-position form prefill.
- Implementation details: `docs/ai-coach/UPLOAD_INTELLIGENCE_ROLLOUT_2026-02-14.md`.

## Update: 2026-02-14 Screenshot UX & Monitoring Fixes
- Screenshot-based `add_to_monitor` now persists extracted positions into tracked setups and opens the tracked view.
- AI Coach screenshot uploads no longer inject raw `data:image/...` payloads into chat content.
- Chat bubbles now force wrap for long tokens/URLs to prevent layout overflow.
- AI Coach upload button now allows replacing a staged screenshot/CSV before send (only disabled while sending).
- Journal header `Screenshot` action now closes import mode before launching quick screenshot entry, and quick-add modal overlay z-index is elevated for reliable visibility.
