# Member Access: End-to-End Audit + Improvement Spec

Date: 2026-02-11

This document audits the current Discord → Supabase → JWT → middleware/UI access pipeline, enumerates admin controls you can use to troubleshoot member access, and specifies improvements to make the system reliable and debuggable.

## Goals

- Make it obvious *why* a given user can/can’t access the Members area.
- Give admins safe, first-class tools to re-sync and adjust access configuration without database spelunking.
- Reduce drift between “tier/tabs” and “permission/claims” systems.

## Current Access Pipeline (as implemented)

### 1) Login + callback (server)

- Entry: `app/auth/callback/page.tsx` forwards to `app/api/auth/callback/route.ts`.
- `app/api/auth/callback/route.ts`:
  - Exchanges Discord OAuth code for a Supabase session cookie.
  - Calls Edge Function `sync-discord-roles`.
  - Refreshes session to pick up updated `app_metadata`.
  - Redirects to:
    - `/join-discord` if Edge returns `NOT_MEMBER`.
    - `/admin` if `is_admin` claim is true.
    - `/members` only if the user has the required Members role ID.
    - `/access-denied?area=members` otherwise.

### 2) Role sync (Edge Function)

- `supabase/functions/sync-discord-roles/index.ts`:
  - Validates user JWT.
  - Gets Discord user ID from `user.user_metadata.provider_id` (or `sub`).
  - Calls Discord API with the configured bot token + guild ID to fetch member roles.
  - Writes cached roles to `user_discord_profiles`.
  - Resolves permissions via `discord_role_permissions` → `app_permissions`.
  - Upserts effective permissions into `user_permissions`.
  - Updates Supabase Auth `app_metadata` with:
    - `is_admin` (based on `admin_dashboard` permission)
    - `is_member` (any permission)
    - `discord_roles` (role IDs from Discord)

### 3) Runtime access enforcement (middleware)

- `middleware.ts`:
  - Protects `/members/*` and now also `/api/members/*`, `/api/academy/*`, `/api/social/*`.
  - Requires authentication.
  - Requires the Discord role ID `1471195516070264863` for *all* Members area access.
  - If JWT doesn’t contain `discord_roles`, middleware falls back to `user_discord_profiles.discord_roles`.
  - Returns JSON `401/403` for API routes; redirects to `/access-denied` for page routes.

### 4) UI tab rendering (client)

- `contexts/MemberAuthContext.tsx`:
  - Fetches role→tier mapping from `GET /api/config/roles` (from `app_settings.key=role_tier_mapping`).
  - Fetches tabs from `GET /api/config/tabs` (from `tab_configurations`).
  - Derives membership tier from cached role IDs.
  - Filters visible tabs based on `required_tier`.

Important: UI tab visibility is *not* a security boundary. Server/middleware still must enforce access.

## Current Admin Controls (what exists today)

### Discord configuration

- UI: `app/admin/settings/page.tsx` (Discord Integration card).
- API: `app/api/admin/settings/route.ts` writes `app_settings` keys like:
  - `discord_bot_token`, `discord_guild_id`, `discord_client_id`, `discord_client_secret`, `discord_invite_url`.

### Role → Permission mappings (RBAC)

- UI: `app/admin/roles/page.tsx`
- API: `app/api/admin/roles/route.ts`
- Data: `discord_role_permissions` mapping Discord role IDs to `app_permissions`.

### Role → Tier mappings (for tab gating)

- UI: `app/admin/settings/page.tsx` (Membership Tier Mapping card).
- API: `app/api/admin/settings/route.ts` stores `role_tier_mapping` in `app_settings.value`.
- Used by: `GET /api/config/roles` for client tab gating.

### Tabs configuration

- UI: `app/admin/tabs/page.tsx`
- API: `app/api/admin/tabs/route.ts`
- Data: `tab_configurations`

### Member access debugging + re-sync (added)

- UI: `app/admin/members-access/page.tsx` (Member Access Debugger).
- API:
  - `GET app/api/admin/members/access/route.ts` (debugger snapshot; supports lookup by `user_id`, `email`, or `discord_user_id`).
  - `POST app/api/admin/members/force-sync/route.ts` (forces role sync using the bot token; refreshes cached profile, permissions, and JWT claims).

## Common Failure Modes (and how to diagnose)

### A) User can’t access `/members/*`

Likely causes:
- Missing required Discord role ID `1471195516070264863`.
- Discord role sync never ran, or role cache is stale.
- Discord config missing/invalid (bot token or guild ID).
- User is not in the guild (`NOT_MEMBER`).

How to diagnose:
- Use `/admin/members-access`:
  - Check `Members gate role: PASS/FAIL`.
  - Check `Effective roles source` (JWT vs `user_discord_profiles`).
  - Check `Last role sync`.
  - Click “Force Discord Role Sync”.

### B) Tabs don’t match expectations

Likely causes:
- `role_tier_mapping` missing an expected Discord role ID.
- Tab `required_tier` mismatches your tier model.
- User has roles but no tier mapping → `resolved_tier` becomes null.

How to diagnose:
- Use `/admin/members-access`:
  - Check `resolved_tier` and `allowed_tabs`.
- Verify:
  - `/admin/settings#membership-tier-mapping`
  - `/admin/tabs`

### C) Admin access not working

Likely causes:
- Role→permission mapping doesn’t grant `admin_dashboard`.
- Role sync didn’t propagate `is_admin` claim yet.

How to diagnose:
- Use `/admin/members-access` on yourself:
  - `permissions.current` includes `admin_dashboard`.
  - `auth_metadata.is_admin_claim` is true.

## Known Gaps / Tech Debt (should be addressed)

### 1) Two RBAC systems exist in the database

- `discord_role_permissions` / `user_permissions` / `app_permissions` (used by sync + admin roles page).
- `app_config.role_permissions` / `get_user_allowed_tabs()` (created by `20260302000000_simple_rbac.sql`, but not currently used by the runtime tab system).

Spec:
- Pick one model and delete/retire the other. Recommended: keep `discord_role_permissions` for “capabilities” and `tab_configurations` + `role_tier_mapping` (or tier table) for navigation, unless you want “tabs as permissions”.

### 2) Members gate role is hard-coded in multiple places

- `middleware.ts`
- `app/api/auth/callback/route.ts`
- Admin debugger endpoints

Spec:
- Move this to a single config source:
  - `app_settings.key=members_required_role_id` (preferred for fast ops),
  - or a typed “security settings” table.
- Middleware should read a cached value (edge-friendly) or require deploy-time env var.

### 3) `app_settings` schema + policies need review

The migration that created `app_settings` uses `value TEXT` and permissive RLS, while the admin API expects additional fields (e.g. `description`) and also should *not* be writable by non-admin clients.

Spec:
- Add a migration to:
  - Add `description TEXT`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` if you want them.
  - Tighten RLS: only admins can write; allow read as needed (some settings are public).
- Consider splitting “public config” and “secret config” tables.

### 4) Tier mapping source-of-truth is inconsistent

There are multiple tier-related systems:
- `role_tier_mapping` in `app_settings` (used by client tab gating).
- `pricing_tiers.discord_role_id` (used by academy tier resolution logic).

Spec:
- Choose one source-of-truth.
  - Recommended: `pricing_tiers` as canonical (already stores tier IDs and can store Discord role IDs).
  - Then derive `role_tier_mapping` from it (or delete `role_tier_mapping`).

### 5) “Join Discord” UX conflates “not in guild” with “no paid role”

`NOT_MEMBER` strictly means “user not found in guild”. The copy currently suggests “no membership role”.

Spec:
- Update `/join-discord` copy + logic:
  - Show “Join the server” for `NOT_MEMBER`.
  - Show “Roles not yet synced” vs “No qualifying role” for other cases.
  - Add a “Retry sync” action that triggers a role sync rather than just reloading.

## Suggested Roadmap (practical)

1) Short-term (now)
   - Use `/admin/members-access` + “Force Discord Role Sync” to debug real users.
   - Ensure required role `1471195516070264863` is assigned correctly in Discord.
   - Verify `discord_role_permissions` mappings include the intended permissions.
   - Verify `role_tier_mapping` includes all tier roles.

2) Medium-term
   - Make Members gate role configurable via `app_settings`.
   - Unify tier mapping source-of-truth (`pricing_tiers` vs `role_tier_mapping`).
   - Fix `app_settings` schema + RLS.

3) Long-term
   - Add a small “Access timeline” log table:
     - when sync ran, what roles were found, what claims were set, and by whom (user vs admin force-sync).
   - Consider enforcing tier-based access server-side for sensitive endpoints (AI coach, premium content).

