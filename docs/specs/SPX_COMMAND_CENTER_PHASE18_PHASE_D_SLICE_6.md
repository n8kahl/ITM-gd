# SPX Command Center Phase 18 — Phase D Slice 6

**Date:** 2026-02-23  
**Owner:** Codex  
**Status:** Completed

## Scope

Harden `chat_conversations` and `chat_messages` RLS/privileges to remove broad public write access while preserving:
- Visitor widget read compatibility
- Admin chat management writes
- Edge Function (`service_role`) writes

## Changes Implemented

### 1) New migration: chat policy hardening

File: `/Users/natekahl/ITM-gd/supabase/migrations/20260327050000_chat_rls_hardening.sql`

- Dropped legacy permissive policies on `chat_conversations` and `chat_messages`
- Added explicit policies:
  - `Service role manage chat_conversations` (`FOR ALL TO service_role`)
  - `Admin manage chat_conversations` (`FOR ALL TO authenticated` with admin/privileged-discord-role claim checks)
  - `Visitor read chat_conversations` (`FOR SELECT TO anon,authenticated`)
  - `Service role manage chat_messages` (`FOR ALL TO service_role`)
  - `Admin manage chat_messages` (`FOR ALL TO authenticated` with admin/privileged-discord-role claim checks)
  - `Visitor read chat_messages` (`FOR SELECT TO anon,authenticated` with conversation existence check)
- Revoked anonymous `INSERT/UPDATE/DELETE` on both tables
- Re-granted authenticated DML (still gated by admin-only RLS)

### 2) New migration: grant tightening

File: `/Users/natekahl/ITM-gd/supabase/migrations/20260327051000_chat_rls_privilege_tightening.sql`

- Revoked legacy `TRIGGER/TRUNCATE/REFERENCES` from `anon` and `authenticated` on both chat tables
- Enforced minimal privilege model:
  - `anon`: `SELECT`
  - `authenticated`: `SELECT`, `INSERT`, `UPDATE`, `DELETE` (RLS enforces admin-only writes)

### 3) New migration: policy init-plan optimization

File: `/Users/natekahl/ITM-gd/supabase/migrations/20260327052000_chat_rls_initplan_optimization.sql`

- Recreated admin chat policies using `(SELECT auth.jwt())` form
- Prevents per-row JWT function re-evaluation warnings for the new chat admin policies
- Maintains the same admin authorization logic (`is_admin` OR privileged Discord role)

### 4) New migration: anonymous column restrictions

File: `/Users/natekahl/ITM-gd/supabase/migrations/20260327053000_chat_anon_column_restrictions.sql`

- Replaced table-level anon `SELECT` grants with column-level `SELECT` grants
- Removed anonymous access to chat PII fields such as `visitor_email`, `visitor_name`, `metadata`, `sender_id`, `knowledge_base_refs`
- Preserved required visitor-widget fields only

### 5) Frontend compatibility update

File: `/Users/natekahl/ITM-gd/components/ui/chat-widget.tsx`

- `loadConversation` now selects non-PII fields only:
  - `id, ai_handled, escalation_reason, status, updated_at`
- `loadMessages` now selects explicit non-sensitive message fields instead of `*`
- Updated `Conversation` interface to match reduced field set

## Live Database Application (Completed)

Applied via Supabase MCP:
- `chat_rls_hardening` (`version: 20260223231054`)
- `chat_rls_privilege_tightening` (`version: 20260223231127`)
- `chat_rls_initplan_optimization` (`version: 20260223231243`)
- `chat_anon_column_restrictions` (`version: 20260223231428`)

## Verification Results

### RLS policies
- `chat_conversations`: only `Service role manage`, `Admin manage`, `Visitor read`
- `chat_messages`: only `Service role manage`, `Admin manage`, `Visitor read`
- No public/anon insert policies remain on either table

### Privileges
- `anon`: `SELECT` only on both chat tables
- `authenticated`: `SELECT/INSERT/UPDATE/DELETE` on both chat tables
- `service_role`: full operational privileges retained
- anon `SELECT` is column-scoped to non-PII chat fields

### Local checks
- `pnpm exec tsc --noEmit` ✅
- `pnpm exec eslint components/ui/chat-widget.tsx` ✅ (1 existing warning: `@next/next/no-img-element`)

## Quality Gate Outcome

- ✅ Anonymous write paths removed from chat tables
- ✅ Admin chat UI write paths preserved via claim-based RLS
- ✅ Edge Function service-role write/read paths preserved
- ✅ Migration history recorded and verifiable

## Residual Risk / Next Slice

Visitor reads are still compatibility-oriented (anon read allowed via policy) because the current widget path does not use visitor-scoped auth tokens.  
**Next hardening slice:** move visitor chat reads/realtime to visitor-scoped signed access (conversation token or function-mediated fetch + scoped channel auth), then remove compatibility read policy.
