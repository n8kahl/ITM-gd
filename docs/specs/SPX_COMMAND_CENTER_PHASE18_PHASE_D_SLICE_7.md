# SPX Command Center Phase 18 — Phase D Slice 7

**Date:** 2026-02-23  
**Owner:** Codex  
**Status:** Completed (Code + Live Rollout Applied)

## Scope

Move visitor chat reads from direct anon table access to token-scoped Edge Function access, with a safe rollout path.

## Changes Implemented

### 1) Widget moved to token-scoped sync endpoint

File: `/Users/natekahl/ITM-gd/components/ui/chat-widget.tsx`

- Replaced direct `chat_messages` / `chat_conversations` reads + realtime subscriptions with polling to:
  - `POST /functions/v1/chat-visitor-sync`
- Added local chat session storage:
  - `tradeitm_chat_session_v1` with `{ conversationId, conversationToken }`
- Added secure sync loop (2s interval) with dedupe/merge logic for messages.
- Added invalid token handling (401/403 clears stale local chat session).

### 2) Handle-chat-message token issuance + validation

File: `/Users/natekahl/ITM-gd/supabase/functions/handle-chat-message/index.ts`

- Added `conversationToken` request input.
- Bound existing conversation lookups to both `conversationId` and `visitor_id`.
- Added per-conversation token hash validation when token is present.
- Auto-issues token for legacy conversations missing hash.
- Returns `conversationToken` in success payloads.
- Added rollout flag:
  - `ENFORCE_VISITOR_CONVERSATION_TOKEN=true` to require token on every existing conversation request.
- **Deployment status:** deployed live as Supabase Edge Function `handle-chat-message` version `36`.

### 3) New visitor sync Edge Function

File: `/Users/natekahl/ITM-gd/supabase/functions/chat-visitor-sync/index.ts`

- Validates `{ conversationId, conversationToken }`.
- Verifies SHA-256 token hash against `chat_conversations.access_token_hash`.
- Returns only required visitor-safe data:
  - conversation status/escalation fields
  - chat messages for full or incremental sync (`since`)
  - optional team typing indicator
- Includes bootstrap mode for cutover:
  - when `conversationToken` is missing, can mint a token if `visitorId` matches `chat_conversations.visitor_id`
  - controlled by `CHAT_SYNC_ALLOW_BOOTSTRAP` (default enabled)

### 4) New migrations

- `/Users/natekahl/ITM-gd/supabase/migrations/20260327054000_chat_conversation_access_tokens.sql`
  - Adds `chat_conversations.access_token_hash`
  - Adds unique partial index for non-null hashes
- `/Users/natekahl/ITM-gd/supabase/migrations/20260327055000_chat_remove_anon_table_read_access.sql`
  - Drops visitor anon read policies
  - Revokes anon `SELECT` on chat tables
  - **Applied live**

## Live DB Application Status

### Applied
- `chat_conversation_access_tokens`
- `chat_remove_anon_table_read_access`
- Edge Function `chat-visitor-sync` deployed and active (`version: 2`)
- Edge Function `handle-chat-message` deployed and active (`version: 36`)

## Validation

- `pnpm exec tsc --noEmit` ✅
- `pnpm exec eslint components/ui/chat-widget.tsx` ✅ (existing `no-img-element` warning only)
- `pnpm run build` ✅ (Next.js production build completed successfully)
- Live DB verification:
  - `chat_conversations.access_token_hash` exists
  - `idx_chat_conversations_access_token_hash_unique` exists
  - Visitor-read policies on `chat_conversations` and `chat_messages` are removed
  - Anon `SELECT` grants on `chat_conversations` and `chat_messages` are revoked
- Live function verification:
  - `chat-visitor-sync` present and active in Supabase Edge Functions list
  - `handle-chat-message` present and active in Supabase Edge Functions list

## Post-Cutover Actions

1. Confirm frontend deployment includes `/Users/natekahl/ITM-gd/components/ui/chat-widget.tsx` token-sync changes.
2. Monitor function and client errors during the stabilization window.
3. Set `CHAT_SYNC_ALLOW_BOOTSTRAP=false` after stable resume behavior is confirmed.
4. Set `ENFORCE_VISITOR_CONVERSATION_TOKEN=true` in `handle-chat-message` after bootstrap disable is complete.
5. Validate:
   - new visitor conversation creation
   - existing conversation resume
   - message sync + typing indicator
   - no direct anon table reads.
