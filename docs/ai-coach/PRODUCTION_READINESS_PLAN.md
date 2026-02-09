# AI Coach — Production Readiness Plan (Codex Spec + Prompt Pack)

**Date:** 2026-02-09  
**Owner:** Non-technical founder / fractional CTO workflow  

This document is a **single source of truth** for taking this repo from **prototype/MVP** to **production-ready**.

It contains:
- A hard, prioritized roadmap (what to fix first and why)
- A **Codex Execution Spec** (how to run work safely in PR-sized chunks)
- A **Prompt Pack** (copy/paste prompts per module)

---

## 1) What is broken / unsafe today (P0 blockers)

### P0-1 — Journal data integrity is split-brain
**Symptom:** Members Journal saves to one table; dashboard reads another.

- Members Journal API uses legacy table: `trading_journal_entries` (see `app/api/members/journal/route.ts`)
- Dashboard RPC functions query `journal_entries` (see `supabase/migrations/20260209000006_dashboard_rpc_functions.sql`)
- Frontend types + UI logic expect `journal_entries` fields like `direction` and `pnl` (`lib/types/journal.ts`), but legacy schema uses `trade_type` and `profit_loss` (`supabase/migrations/20260201100000_create_trading_journal.sql`).

**Production consequence:**
- Users create trades that do **not** show up in dashboard stats/equity/calendar.
- Editing can silently overwrite fields with defaults (data corruption risk).

---

### P0-2 — Multiple Supabase Edge Functions are unauthenticated / abusable
These functions are currently **not production safe**:

- `supabase/functions/create-team-member` (unauthenticated; can create users/team members)
- `supabase/functions/cron-archive-conversations` (unauthenticated; can trigger archive job)
- `supabase/functions/send-push-notification` (unauthenticated; can trigger Zapier/SMS)
- `supabase/functions/notify-team-lead` (no strict auth/abuse controls)
- `supabase/functions/analyze-trade-screenshot` (trusts `userId` from body)
- `supabase/functions/send-chat-transcript` (JWT verified but missing authorization to the conversation; can exfiltrate)

**Production consequence:**
- Account creation abuse
- Spam and operational abuse
- Transcript/data exfiltration
- Runaway cost (AI endpoints)

---

### P0-3 — RLS policies allow broad reads (`USING (true)`)
Legacy journal migrations include permissive policies:
- `trading_journal_entries`: `FOR SELECT USING (true)`
- `journal_streaks`: `FOR SELECT USING (true)`

**Production consequence:**
- With an anon key in the browser, authenticated users may query other users’ rows (data leak).

---

### P0-4 — Screenshot uploads are not real
Members Journal screenshot feature currently:
- Uses a local preview `blob:` URL in UI (`URL.createObjectURL(file)`)
- Never uploads to Storage
- Sends `blob:` URLs to server analysis (`/api/members/journal/analyze`) which cannot be fetched server-side

**Production consequence:**
- “Image upload” appears to work but analysis fails or is inconsistent.

---

## 2) Roadmap to Production

### HIGH priority (release blockers)

#### H1 — Security lockdown (Edge Functions + RLS + debug endpoints + CSP)
**Do first.**

- Lock down / remove dangerous edge functions (see P0-2)
- Fix Edge Function CORS/header issues (e.g., `handle-chat-message` CORS header spread bug)
- Fix RLS policies (remove `USING (true)` and restrict to `user_id = auth.uid()`)
- Remove or hard-admin-gate `GET /api/admin/debug-roles` (currently not admin-only)
- Tighten CSP in `middleware.ts` (currently includes `unsafe-eval` / `unsafe-inline`)

**Acceptance criteria:**
- No unauthenticated edge function can mutate data
- Journal tables protected by RLS
- Debug admin routes not accessible to non-admin
- CSP no longer includes `unsafe-eval`

---

#### H2 — Journal unification (canonical table + migration)
- Choose canonical schema: **`journal_entries`**
- Create a Supabase migration to transform/migrate from `trading_journal_entries` → `journal_entries`
- Update `app/api/members/journal/route.ts` to read/write `journal_entries`
- Fix `replay` route to query real columns (legacy select includes `direction` which doesn’t exist)
- Update Trade Entry Sheet payload mapping so it matches canonical schema

**Acceptance criteria:**
- Trades created in Members Journal show up in dashboard stats/equity/calendar
- Editing does not reset/zero fields

---

#### H3 — Real screenshot upload + analysis pipeline
- Implement Supabase Storage upload for journal screenshots
- Save `screenshot_url` on upload completion
- Update analysis endpoint to accept signed/public storage URL or base64 data URL
- Add per-user rate limiting to analysis endpoints to protect OpenAI costs

**Acceptance criteria:**
- Upload persists after refresh
- Analysis works reliably (no blob URL reliance)

---

#### H4 — Mobile layout correctness (remove `vh` hacks)
- Remove `calc(100vh - Xpx)` and fixed offsets that cause mobile clipping
- Use flex layouts with `min-h-0` for scroll areas
- Fix tab overflow and quick-card forced 4-column grid

**Acceptance criteria:**
- iPhone Safari + Android Chrome: input never clipped; no scroll traps; tabs reachable

---

#### H5 — Tooling reliability and consistency
- Pick one package manager (pnpm recommended) and remove conflicting lockfiles
- Add `.nvmrc` and/or `engines` in `package.json`
- Add ESLint config + dependencies so `pnpm lint` actually runs

**Acceptance criteria:**
- Fresh install is deterministic
- CI matches local
- Lint/typecheck/Build pass in clean env

---

### MEDIUM priority (strongly recommended)

- Consolidate API surface (Next API vs Express vs Edge Functions) to reduce duplicated auth logic
- Remove “ghost routes” that are defined but unused
- Performance polish: lazy-load 3D hero background on mobile; reduce always-on overlays
- Consistent error handling (remove silent catches; show user-facing toasts)
- Add e2e coverage for the core flows (journal CRUD + upload + analysis + chat)

---

### LOW priority (cleanup)

- Repo hygiene: remove `FETCH_HEAD`, `_tmp_*`, duplicate docs casing (`CLAUDE.md` vs `claude.md`)
- Feature-based folder refactor once behavior is stable
- Design tokens for consistent spacing/typography/radius

---

## 3) Codex Execution Spec

> Paste this section into Codex as the master instruction.

```md
# TITM / AI Coach — Production Readiness Remediation Spec (Codex)

## Goal
Bring the repository from MVP/prototype to production-ready by fixing:
1) Security vulnerabilities (Edge Functions, RLS, debug endpoints, CSP)
2) Journal data integrity (unify tables + types + endpoints)
3) Screenshot upload + analysis pipeline (real uploads + rate limiting)
4) Mobile responsiveness + layout correctness (remove vh hacks, fix nav overflow)
5) Tooling reliability (package manager, Node version, lint)

## Non-negotiables / Definition of Done
- No unauthenticated Edge Function can mutate data or create users.
- RLS prevents cross-user access for journal data when using anon key.
- Members Journal uses ONE canonical table and shows in dashboard RPC outputs.
- Screenshot analysis works without relying on blob URLs.
- Mobile Safari/Chrome: chat input never clipped; no double-scroll traps.
- Single package manager + repeatable installs; lint and typecheck run in CI.

## Repo Setup Commands
### Frontend (Next.js)
- Install: `pnpm install`
- Dev: `pnpm dev`
- Build: `pnpm build`
- E2E: `pnpm test:e2e`

### Backend (Express in /backend)
- Install: (choose one)
  - Option A: migrate backend to pnpm and use `pnpm -C backend install`
  - Option B: keep npm but document `npm ci` in backend
- Dev: `cd backend && npm run dev`
- Build: `cd backend && npm run build`
- Test: `cd backend && npm test`

## Environment Variables
Use `.env.example` at repo root and `backend/.env.example`.
Do not hardcode secrets. Do not print secrets in logs.

## PR Slicing Plan (must follow)
PR1: Security Hotfixes
- Lock down Edge Functions:
  - create-team-member, send-push-notification, cron-archive-conversations, notify-team-lead, analyze-trade-screenshot, send-chat-transcript
- Fix handle-chat-message CORS/header bug
- Fix RLS policies for trading_journal_entries + journal_streaks (and any other permissive tables)
- Remove or admin-gate /api/admin/debug-roles
- Tighten CSP to remove unsafe-eval

PR2: Journal Unification
- Choose journal_entries as canonical
- Write migration to move/transform trading_journal_entries into journal_entries
- Update app/api/members/journal to read/write journal_entries
- Fix replay route field selection
- Add validation (zod) and consistent error handling

PR3: Screenshot Upload + Analysis
- Implement Supabase Storage uploads for journal screenshots
- Update trade-entry-sheet to upload file and save screenshot_url
- Update analysis endpoint to accept storage URL or base64 data URL
- Add per-user rate limiting to analysis endpoint

PR4: Mobile Layout + Navigation
- Remove calc(100vh - Xpx) hacks
- Fix AI coach tab overflow
- Fix quick card grid responsiveness
- Default journal to card view on mobile; make filter bar responsive
- Fix chat auto-scroll side effects (move to useEffect)

PR5: Tooling & Cleanup
- Choose one package manager; remove conflicting lockfiles
- Add Node version contract (.nvmrc + engines)
- Add ESLint config and dependency so `pnpm lint` actually works
- Remove ghost routes or wire them up
- Repo hygiene cleanup (FETCH_HEAD, _tmp_*, duplicate docs)

## Implementation Rules
- Every change must include:
  - updated tests OR a manual QA checklist in the PR description
  - clear error handling (no silent catch for critical operations)
  - no new hardcoded pixel-based viewport hacks
- Prefer incremental refactors over rewrites.
- Do not change user-visible copy unless needed for clarity or errors.

## Output per PR
- Summarize changes
- List touched files
- Provide commands run and pass/fail results
- Provide QA steps
```

---

## 4) Prompt Pack (copy/paste prompts per module)

### Prompt 1 — Lock down dangerous Supabase Edge Functions (CRITICAL)

```text
You are a senior security-focused full-stack engineer. Audit and patch Supabase Edge Functions in this repo to be production-safe.

Targets:
- supabase/functions/create-team-member/index.ts (currently unauthenticated, uses service role)
- supabase/functions/cron-archive-conversations/index.ts (unauthenticated, triggers archive job)
- supabase/functions/send-push-notification/index.ts (unauthenticated, can spam Zapier/SMS)
- supabase/functions/notify-team-lead/index.ts (ensure auth + rate limiting)
- supabase/functions/analyze-trade-screenshot/index.ts (currently trusts userId from body/form)
- supabase/functions/send-chat-transcript/index.ts (JWT verified but no authorization to conversation)
- supabase/functions/handle-chat-message/index.ts (fix header bug: spreads ...corsHeaders instead of calling corsHeaders(origin))

Requirements:
1) Any function that uses SUPABASE_SERVICE_ROLE_KEY must require one of:
   - a verified JWT AND an authorization check (admin/team-member permission), OR
   - a shared secret header (e.g. X_CRON_SECRET) for cron-only endpoints
2) Replace permissive CORS with allowlist using ALLOWED_ORIGINS env var.
3) For send-chat-transcript: enforce that only admin/team members can send transcripts; do NOT allow random logged-in users. Also prevent sending to arbitrary emails unless explicitly allowed for admins.
4) For analyze-trade-screenshot: ignore userId from request body and derive userId from verified JWT user.id.
5) Add basic abuse protection: rate-limit per user/IP where applicable.
6) Provide a concise test plan (how to validate each function) and show diffs.

Deliverable:
- Patch code in those files
- Add clear error responses (401/403/429)
- Document required env vars and how to call securely.
```

---

### Prompt 2 — Fix RLS for journal tables (CRITICAL data leak)

```text
You are a Supabase security engineer. Fix Row Level Security policies in the migrations for the journal tables.

Evidence:
- supabase/migrations/20260201100000_create_trading_journal.sql contains FOR SELECT USING (true) for trading_journal_entries and journal_streaks.

Tasks:
1) Write a new Supabase migration that:
   - Enables RLS for trading_journal_entries and journal_streaks (if not already)
   - Replaces permissive policies with:
     - SELECT/UPDATE/DELETE only when user_id = auth.uid()
     - INSERT only when user_id = auth.uid() or user_id is set by trigger (choose safest)
2) Ensure anon key + authenticated users can only see their own rows.
3) If trading_journal_entries is being deprecated, still secure it until removed.
4) Provide SQL migration and explain how to test in Supabase SQL editor.

Output:
- A single migration file with safe policies
- A verification checklist (queries to run to confirm RLS works).
```

---

### Prompt 3 — Unify Members Journal to use `journal_entries` (CRITICAL integrity)

```text
You are a senior full-stack engineer. Unify the Members Journal data model so it uses ONE canonical table: journal_entries.

Current broken state:
- app/api/members/journal/route.ts reads/writes trading_journal_entries (legacy)
- Dashboard RPC functions use journal_entries (supabase/migrations/20260209000006_dashboard_rpc_functions.sql)
- Frontend types expect JournalEntry fields like direction and pnl (lib/types/journal.ts)
- replay endpoint selects direction from legacy table (app/api/members/journal/replay/[entryId]/route.ts)

Tasks:
1) Decide and document the canonical schema for journal entries (use journal_entries).
2) Create a Supabase migration to migrate/transform data from trading_journal_entries -> journal_entries:
   - Map trade_type -> direction
   - Map profit_loss -> pnl
   - Map profit_loss_percent -> pnl_percentage
   - Preserve notes/tags/rating/screenshot_url
3) Update app/api/members/journal/route.ts to query journal_entries and return data matching lib/types/journal.ts.
4) Update components/journal/trade-entry-sheet.tsx payload fields so they match the API/table (direction, pnl, etc.) and do not misuse trade_type.
5) Fix app/api/members/journal/replay/[entryId]/route.ts to select existing columns.
6) Remove or explicitly mark legacy endpoints/columns as deprecated.

Acceptance criteria:
- A trade created in Members Journal shows up in dashboard RPC stats/equity/calendar.
- Editing a trade does not reset fields to 0/null due to schema mismatch.
- Typescript compiles without casting hacks.

Provide:
- Migration SQL file
- Code changes list and why each change is needed.
```

---

### Prompt 4 — Fix the broken enrich endpoint

```text
You are a senior backend engineer. Fix app/api/members/journal/enrich/route.ts.

Current issue:
- entryPrice line is logically broken (always becomes 0 due to precedence/ternary).

Tasks:
1) Rewrite enrich logic so it uses real values (entry_price/exit_price) and produces meaningful marketContext/verification outputs.
2) Add validation for MASSIVE_API_KEY and required fields.
3) Add error handling and timeouts for external fetch calls.
4) Ensure endpoint cannot be abused (rate limit, auth check).
5) Ensure any computed fields are saved back to canonical journal table (journal_entries after unification).

Deliver:
- Correct code with tests or a clear manual QA checklist.
```

---

### Prompt 5 — Implement real screenshot uploads (Supabase Storage)

```text
You are a senior full-stack engineer. Implement production-ready screenshot uploads for the Members Journal.

Current issue:
- components/journal/trade-entry-sheet.tsx uses URL.createObjectURL(file) and never uploads.
- It sends blob URLs to /api/members/journal/analyze which cannot be fetched server-side or by OpenAI.

Tasks:
1) Create a Supabase Storage bucket strategy for journal screenshots (e.g. `journal-screenshots`).
2) Add a client-side upload helper in lib/ (e.g. lib/uploads/supabaseStorage.ts).
3) In components/journal/trade-entry-sheet.tsx:
   - on drop, upload screenshotFile to storage
   - store returned public URL or signed URL in form.screenshot_url
   - show upload progress and handle failure (no silent catch)
4) Enforce constraints: max 5MB, allowed mime types, unique filename per user and entry.
5) Security: ensure bucket is private and use signed URLs OR strict RLS policies if public.

Acceptance criteria:
- After refresh, screenshot still loads from screenshot_url.
- Analyze uses screenshot_url (not blob).
- Users cannot access other users’ screenshots.

Output:
- Implemented upload pipeline
- Any necessary Supabase SQL/policies for storage
- Minimal UI feedback for upload status.
```

---

### Prompt 6 — Fix `/api/members/journal/analyze` reliability + cost controls

```text
You are a senior engineer optimizing a paid AI feature. Fix app/api/members/journal/analyze/route.ts.

Current issues:
- It expects imageUrl that must be externally accessible; current UI passes blob URLs.
- No rate limiting; risk of runaway OpenAI spend.

Tasks:
1) Accept either:
   - a storage URL (signed/public), OR
   - base64 data URL (data:image/png;base64,...)
2) Add per-user rate limiting (e.g. 10 analyses / hour) using existing utilities if present (lib/rate-limit.ts).
3) Return structured errors (401, 400, 429, 503) and include safe debug info.
4) Update the frontend call site (components/journal/trade-entry-sheet.tsx) accordingly.

Deliver:
- Patched route + updated client usage
- Clear acceptance tests and cost-protection explanation.
```

---

### Prompt 7 — Fix AI Coach mobile layout + remove vh hacks

```text
You are a senior frontend engineer. Fix AI Coach layout so it works on real phones.

Targets:
- app/members/ai-coach/page.tsx uses style={{ height: 'calc(100vh - 80px)' }}
- app/members/ai-coach/page.tsx has render-time side effects for auto-scroll
- app/members/ai-coach/page.tsx uses style fieldSizing: 'content'

Tasks:
1) Replace vh subtraction hacks with a robust flex layout:
   - make the page fill available space inside members layout
   - ensure scroll container uses min-h-0
2) Move auto-scroll logic into useEffect and do not force scroll if user has scrolled up.
3) Replace fieldSizing usage with a stable textarea autosize approach.
4) Provide a mobile QA checklist (iPhone Safari + Android Chrome).

Deliver:
- Code diff
- Explanation of why the old approach breaks on mobile.
```

---

### Prompt 8 — Fix AI Coach navigation overflow + quick cards grid

```text
You are a senior UI engineer. Fix mobile navigation overflow in AI Coach.

Targets:
- components/ai-coach/center-panel.tsx tab bar has many tabs in one row with no overflow handling.
- components/ai-coach/center-panel.tsx forces quick cards grid to 4 columns always.

Tasks:
1) Make tab bar mobile-safe:
   - horizontal scroll with overflow-x-auto + scroll snapping OR collapse into a "More" menu on small screens.
2) Make quick cards responsive:
   - grid-cols-2 on mobile, grid-cols-4 on md+
   - ensure touch targets are large enough
3) Add small visual polish: consistent spacing, reduce micro text.

Deliver:
- Updated components with responsive Tailwind classes
- Before/after behavior described.
```

---

### Prompt 9 — Journal UX mobile defaults

```text
You are a senior product-focused frontend engineer. Improve Journal mobile UX.

Evidence:
- lib/types/journal.ts default filters set view: 'table'
- components/journal/journal-table-view.tsx forces min-w-[900px]
- components/journal/journal-filter-bar.tsx top row does not wrap and search is max-w-[240px]

Tasks:
1) Default to card view on small screens (breakpoint-based).
2) Keep table view for desktop; on mobile either hide table option or warn about horizontal scrolling.
3) Make filter bar responsive:
   - stack controls on mobile (flex-col) or use a filter sheet pattern
4) Verify no overflow or clipped controls on 375px width.

Deliver:
- Code changes across those files
- QA checklist.
```

---

### Prompt 10 — Typography system (remove typewriter vibe)

```text
You are a lead product designer + frontend engineer. Fix the typography system so the UI looks premium, not terminal-like.

Evidence:
- app/layout.tsx imports Geist_Mono and sets --font-geist-mono
- components/ai-coach/trading-chart.tsx forces a monospace fontFamily
- multiple components use font-mono for UI labels

Tasks:
1) Define typography rules:
   - Sans for body/UI
   - Serif for headings
   - Monospace ONLY for tickers/prices/table numbers
2) Remove font-mono from UI labels/nav; keep it only where justified.
3) Update trading-chart to use the app’s default font unless numeric alignment is required.
4) Ensure global CSS reflects the intended font stack.

Deliver:
- Updated font usage + file list
- Explain where monospace remains and why.
```

---

### Prompt 11 — Tighten CSP + security headers safely

```text
You are a security-focused frontend engineer. Tighten the Content Security Policy in middleware.ts.

Current state:
- middleware.ts sets CSP including script-src 'unsafe-inline' 'unsafe-eval'

Tasks:
1) Remove 'unsafe-eval' at minimum.
2) Reduce 'unsafe-inline' where possible; if inline is required, implement a nonce strategy or use hashes.
3) Ensure required integrations still work (Sentry, Supabase, OpenAI endpoints, Railway backend).
4) Provide a rollout plan:
   - start in Report-Only mode if needed
   - then enforce once verified

Deliver:
- Updated middleware.ts
- Notes on expected side effects and how to test.
```

---

### Prompt 12 — Package manager + lint reality check

```text
You are a build/tooling engineer. Fix dependency management and linting.

Evidence:
- root has both pnpm-lock.yaml and package-lock.json
- backend has package-lock.json
- root package.json has lint: "eslint ." but eslint is not in devDependencies

Tasks:
1) Choose pnpm as the standard and remove conflicting lockfiles.
2) Add pnpm-workspace.yaml if managing backend as a workspace, OR document backend install separately but consistently.
3) Add ESLint dependencies and a minimal config so lint actually runs.
4) Add Node version contract:
   - .nvmrc
   - package.json engines
5) Update CI if needed and provide commands to run locally.

Deliver:
- Tooling changes + clear instructions
- Keep changes minimal but production-grade.
```

---

### Prompt 13 — Remove ghost routes / reduce attack surface

```text
You are a senior engineer. Remove or wire up unused API routes.

Candidates:
- app/api/csrf/route.ts
- app/api/analytics/track/route.ts
- app/api/public/config/route.ts
- app/api/config/tabs/route.ts
- app/api/admin/tabs/route.ts
- app/api/admin/debug-roles/route.ts

Tasks:
1) Search for frontend references. If none exist, delete the endpoint.
2) If endpoint is required, implement it fully with auth/validation and add at least one integration usage.
3) Ensure routes are not exposing app_settings secrets.
4) Update docs / any callers and run tests.

Deliver:
- A route table “kept vs removed” with justification
- PR-friendly diff.
```

---

### Prompt 14 — Stop silent failures (UI must tell the user)

```text
You are a product-minded full-stack engineer. Remove silent catches and implement real user-visible error handling.

Targets:
- app/members/journal/page.tsx loadEntries() catches and does nothing
- components/journal/trade-entry-sheet.tsx analyze catches and does nothing

Tasks:
1) Implement consistent error handling:
   - show toast/banner on failures (fetch, save, upload, analyze)
   - keep logs for debugging without leaking secrets
2) Ensure save flow checks response.ok and handles non-200.
3) Add loading + disabled states for network operations.

Deliver:
- Updated code
- A short “UX error states” checklist.
```

---

### Prompt 15 — Performance polish

```text
You are a performance-focused frontend engineer. Reduce bundle and render cost.

Targets:
- three / @react-three/fiber / drei are used for components/hero-background.tsx
- app/globals.css uses body::before noise overlay with z-index 9999

Tasks:
1) Lazy-load 3D hero background and disable it on mobile or prefers-reduced-motion.
2) Reduce or disable noise overlay on mobile/coarse pointer devices; avoid z-index 9999 overlays.
3) Confirm improved Lighthouse metrics and less jank on mobile.

Deliver:
- Code changes + explanation
- How to verify perf improvement locally.
```

---

## 5) How to commit this document

This repo ZIP does not include the `.git` directory. Once this file is in your real repo working tree, commit it like:

```bash
git add PRODUCTION_READINESS_PLAN.md
git commit -m "Add production readiness plan + Codex execution spec"
```

