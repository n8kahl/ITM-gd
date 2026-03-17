# Member Access Control Center Execution Spec

Date: 2026-03-15
Status: Draft for implementation
Owner: Engineering
Audience: Product, Engineering, Operations

## 1. Purpose

Replace the current lookup-oriented `Member Access` admin page with a production-grade, repo-wide access-management system that allows admins to:

1. see every Discord guild member, including users who have never logged into the site
2. understand current and expected app access for every member
3. manage Discord-driven access safely from one place
4. diagnose and repair profile, role, sync, and tab-visibility issues without reading raw database state

This is not a page-only change. It is a repo-wide access-domain consolidation.

## 2. Product Decision

Backward compatibility is not a release requirement.

Nothing in this area is customer-released in a stable contract that must be preserved. The implementation may remove, rename, or replace current access/debugger behavior if the end state is cleaner, better tested, and safer.

The release requirement is:

1. production-grade code
2. non-breaking behavior for profiles, session auth, member gating, and tab visibility at cutover
3. no ambiguous or duplicated access sources after the refactor

## 3. Current Problems In Repo

The current implementation is fragmented across multiple sources of truth and duplicated evaluators.

### 3.1 Duplicated access logic

Access evaluation is currently spread across:

1. [contexts/MemberAuthContext.tsx](/Users/natekahl/ITM-gd/contexts/MemberAuthContext.tsx)
2. [app/api/auth/callback/route.ts](/Users/natekahl/ITM-gd/app/api/auth/callback/route.ts)
3. [app/api/admin/members/access/route.ts](/Users/natekahl/ITM-gd/app/api/admin/members/access/route.ts)
4. [lib/supabase-server.ts](/Users/natekahl/ITM-gd/lib/supabase-server.ts)
5. feature-specific access helpers such as [lib/money-maker/access.ts](/Users/natekahl/ITM-gd/lib/money-maker/access.ts), [lib/swing-sniper/access.ts](/Users/natekahl/ITM-gd/lib/swing-sniper/access.ts), and [lib/mentorship/access.ts](/Users/natekahl/ITM-gd/lib/mentorship/access.ts)

This creates drift risk between:

1. login redirect decisions
2. member sidebar visibility
3. admin-only surfaces
4. user-level access diagnostics

### 3.2 Multiple conflicting access sources

Current access state can be derived from:

1. `auth.users.app_metadata`
2. `auth.users.user_metadata`
3. `user_discord_profiles.discord_roles`
4. `profiles.role`
5. `pricing_tiers.discord_role_id`
6. `discord_role_permissions`
7. `app_settings.members_required_role_ids`
8. `app_settings.role_tier_mapping`
9. frontend fallback tab arrays
10. public API fallback tab arrays

This is spaghetti. It is not acceptable as the final production model.

### 3.3 Member Access is not a real operations console

The current page at [app/admin/members-access/page.tsx](/Users/natekahl/ITM-gd/app/admin/members-access/page.tsx) only supports lookup by:

1. email
2. Supabase `user_id`
3. Discord user ID

It does not support:

1. searching by Discord username, display name, or nickname
2. browsing all Discord members
3. seeing unlinked Discord-only members
4. modifying access from the same workspace
5. bulk operations

### 3.4 Guild roster is not first-class

The system stores linked/synced users in `user_discord_profiles`, but it does not maintain a canonical guild member directory for all members visible to the Discord bot.

That means:

1. admins cannot browse all guild members
2. Discord-only members are invisible
3. the system cannot preview expected access before first login

### 3.5 Frontend fallbacks hide configuration failures

Current tab resolution includes fallback tab arrays in:

1. [contexts/MemberAuthContext.tsx](/Users/natekahl/ITM-gd/contexts/MemberAuthContext.tsx)
2. [app/api/config/tabs/route.ts](/Users/natekahl/ITM-gd/app/api/config/tabs/route.ts)

This is not production-safe. Missing or broken config should surface as an operational error, not silently degrade into a second tab model.

## 4. Goals

The finished system must provide:

1. a guild-wide member directory
2. a linked-user access debugger
3. role-driven app access with explicit override support
4. one canonical access-evaluation service used everywhere
5. auditable write actions
6. deterministic tab and permission resolution
7. production-safe sync and repair workflows

## 5. Non-Goals

The initial release will not:

1. become a general Discord community management suite
2. manage billing or Whop subscription entitlements directly
3. auto-create site users for every Discord member
4. support silent DB-only role edits that bypass Discord

## 6. Target Product Surface

The admin area should expose one coherent `Member Access Control Center` with four major surfaces.

### 6.1 Guild Directory

Default landing screen.

Shows every Discord guild member known to the bot and cached in the app.

Each row must display:

1. avatar
2. Discord display name
3. Discord username
4. Discord user ID
5. linked site account status
6. resolved tier
7. high-level access status
8. role summary
9. last sync time

Supported filters:

1. search by Discord username
2. search by nickname
3. search by global/display name
4. search by Discord user ID
5. search by email when linked
6. search by Supabase `user_id` when linked
7. filter by linked/unlinked
8. filter by stale sync
9. filter by tier
10. filter by admin/privileged
11. filter by blocked/override state

### 6.2 Member Detail Workspace

Opens from a directory row.

Sections:

1. Identity
2. Discord Roles
3. App Access
4. Tab Matrix
5. Profile and Sync Health
6. Overrides
7. Audit History

This view must answer:

1. who is this member
2. what Discord roles do they currently have
3. is their site account linked
4. what tier was resolved
5. what tabs do they currently get
6. why is each tab allowed or denied
7. what is stale or broken
8. what admin actions are available

### 6.3 Overrides And Suspensions

Overrides are explicit exceptions to role-driven access.

Allowed override types:

1. `suspend_members_access`
2. `allow_members_access`
3. `allow_specific_tabs`
4. `deny_specific_tabs`
5. `temporary_admin`

Every override must include:

1. actor
2. reason
3. created_at
4. optional expires_at
5. revocation history

### 6.4 Audit Log

All write actions must be reviewable.

Required audit events:

1. guild sync requested
2. single-member sync requested
3. Discord role add/remove requested
4. override created
5. override revoked
6. access policy updated
7. tab configuration changed

## 7. Canonical Access Model

The refactor must converge the repo on one source of truth hierarchy.

### 7.1 Canonical tables and services

Canonical sources:

1. `discord_guild_roles`
2. `discord_guild_members` (new)
3. `user_discord_profiles`
4. `pricing_tiers.discord_role_id`
5. `discord_role_permissions`
6. `tab_configurations`
7. `member_access_overrides` (new)
8. `access_control_settings` (new)
9. shared access-evaluation service in `lib/access-control/*` (new)

### 7.2 Non-canonical caches and derived state

These may exist, but they must not be treated as authoritative for authorization decisions:

1. `auth.users.app_metadata`
2. `auth.users.user_metadata`
3. `user_permissions`
4. frontend tab arrays
5. ad hoc route-local access logic

### 7.3 Rule precedence

Access must be resolved in this order:

1. suspension override
2. explicit admin or tab override
3. privileged/admin Discord role
4. members-area role policy
5. tier resolution from pricing tier role mapping
6. tab eligibility from `tab_configurations`
7. role-gated tab constraints

## 8. Required Schema Changes

### 8.1 `discord_guild_members` table

Purpose:

1. store the full guild roster known to the bot
2. support directory browsing for Discord-only members
3. support search by username/nickname before login

Required fields:

1. `discord_user_id` primary key
2. `username`
3. `global_name`
4. `nickname`
5. `avatar`
6. `discord_roles` text[]
7. `is_in_guild` boolean
8. `joined_at` timestamptz nullable
9. `last_synced_at` timestamptz
10. `linked_user_id` uuid nullable
11. `sync_source`
12. `sync_error` nullable

Indexes:

1. `discord_user_id`
2. trigram or lowercased search indexes for `username`, `global_name`, `nickname`
3. GIN index on `discord_roles`
4. `linked_user_id`

### 8.2 `member_access_overrides` table

Purpose:

1. support audited exceptions without mutating the canonical role model

Required fields:

1. `id`
2. `discord_user_id` nullable
3. `user_id` nullable
4. `override_type`
5. `payload` jsonb
6. `reason`
7. `created_by_user_id`
8. `created_at`
9. `expires_at` nullable
10. `revoked_at` nullable
11. `revoked_by_user_id` nullable
12. `revocation_reason` nullable

Constraints:

1. at least one of `discord_user_id` or `user_id` must be present
2. expired or revoked overrides must not be treated as active

### 8.3 `access_control_settings` table

Purpose:

1. replace generic app-setting usage for access policy

Required fields:

1. `members_allowed_role_ids`
2. `privileged_role_ids`
3. `admin_role_ids`
4. `default_linked_user_status`
5. `allow_discord_role_mutation`

This removes access-policy dependence on:

1. `app_settings.members_required_role_ids`
2. `app_settings.members_required_role_id`

### 8.4 Typed access snapshot view or function

Add one canonical access-evaluation entry point:

1. SQL view or RPC for admin directory reads
2. shared server-side TypeScript evaluator for route handlers and UI

The exact implementation may vary, but the repo must not continue using unrelated route-local evaluators.

## 9. Canonical Access Evaluation Service

Create a new shared domain module under `lib/access-control/`.

Required modules:

1. `identity.ts`
2. `tiers.ts`
3. `roles.ts`
4. `tabs.ts`
5. `overrides.ts`
6. `evaluate-member-access.ts`
7. `admin-access.ts`

Required outputs:

1. link status
2. effective Discord roles
3. resolved tier
4. admin status
5. member-gate status
6. allowed tabs
7. per-tab allow/deny reason
8. active overrides
9. health warnings

Every consumer must call the same service.

Consumers to migrate:

1. auth callback
2. member auth context
3. admin tabs route
4. admin members access route
5. feature-specific tab guards
6. `isAdminUser()`
7. profile page/profile API surfaces that expose Discord-linked access state

## 10. Mandatory Cleanup

The implementation is not complete unless these spaghetti paths are removed or demoted.

### 10.1 Remove fallback tab arrays as a production path

Delete or explicitly dev-only gate fallback tabs in:

1. [contexts/MemberAuthContext.tsx](/Users/natekahl/ITM-gd/contexts/MemberAuthContext.tsx)
2. [app/api/config/tabs/route.ts](/Users/natekahl/ITM-gd/app/api/config/tabs/route.ts)

If tab config is missing in production, surface an admin-visible degraded state instead of silently inventing tabs.

### 10.2 Remove route-local access resolution drift

Replace duplicated logic in:

1. [app/api/auth/callback/route.ts](/Users/natekahl/ITM-gd/app/api/auth/callback/route.ts)
2. [app/api/admin/members/access/route.ts](/Users/natekahl/ITM-gd/app/api/admin/members/access/route.ts)
3. [lib/supabase-server.ts](/Users/natekahl/ITM-gd/lib/supabase-server.ts)
4. admin tab routes and feature-specific access helpers

### 10.3 Stop using `profiles.role` as an admin fallback

Admin access should resolve from:

1. canonical privileged/admin role set
2. explicit active override

Any profile-table admin fallback must be removed unless it becomes part of the formal access policy.

### 10.4 Remove tier-mapping fallback from generic settings

`pricing_tiers.discord_role_id` must be the only tier-mapping source.

`app_settings.role_tier_mapping` should be removed from the access path after migration.

### 10.5 Stop treating auth metadata as canonical

JWT/app metadata may be synchronized for convenience, but must not be the root authority for final access evaluation.

## 11. Admin Actions

### 11.1 Read actions

1. browse directory
2. search by all relevant identity keys
3. inspect tab reasoning
4. inspect linked/unlinked status
5. inspect sync health
6. inspect audit history

### 11.2 Repair actions

1. force single-member sync from Discord
2. bulk sync selected members
3. refresh guild roster snapshot
4. relink a Discord member to a site user
5. unlink a bad linkage
6. regenerate derived permissions

### 11.3 Access actions

1. create override
2. revoke override
3. suspend app access
4. restore app access

### 11.4 Discord role actions

Allowed only if:

1. bot permissions are verified
2. role is within manageable range
3. action is audited

Supported:

1. add role
2. remove role
3. preview resulting tier and tabs before confirm

DB-only role edits are forbidden.

## 12. API Surface

Replace the current single-purpose debugger flow with dedicated admin APIs.

### 12.1 Directory APIs

1. `GET /api/admin/members/directory`
2. `GET /api/admin/members/directory/:discordUserId`

### 12.2 Search

One query surface must support:

1. `discord_username`
2. `global_name`
3. `nickname`
4. `discord_user_id`
5. `email`
6. `user_id`

The current split between Member Access and Notifications search must be removed.

### 12.3 Actions

1. `POST /api/admin/members/:discordUserId/sync`
2. `POST /api/admin/members/sync-bulk`
3. `POST /api/admin/members/:discordUserId/roles`
4. `POST /api/admin/members/:discordUserId/overrides`
5. `POST /api/admin/members/:discordUserId/link`
6. `POST /api/admin/members/:discordUserId/unlink`
7. `GET /api/admin/members/audit`

### 12.4 Existing route treatment

The current [app/api/admin/members/access/route.ts](/Users/natekahl/ITM-gd/app/api/admin/members/access/route.ts) may be:

1. replaced by the new APIs
2. temporarily retained only as a wrapper over the new access service during migration

It must not remain a parallel implementation forever.

## 13. Profiles And Access Safety Requirements

This work touches auth, profiles, tabs, and permissions. Production safety requires explicit guardrails.

### 13.1 No blind writes

All writes must be:

1. idempotent
2. audited
3. attributable to an admin
4. reversible where applicable

### 13.2 No direct role mutation in local caches

Changing a member’s Discord role must:

1. call Discord
2. update roster cache
3. update linked profile cache
4. recompute access

### 13.3 Linked user safety

When a Discord-only member becomes linked:

1. identity linkage must be explicit
2. no duplicate link may exist
3. conflicting links must hard-fail
4. audit trail must record the link source

### 13.4 Shadow validation before cutover

Before final cutover, run the new access evaluator in shadow mode against current linked users and compare:

1. member-gate pass/fail
2. resolved tier
3. admin status
4. allowed tabs

Any unexplained diff is a release blocker.

## 14. Delivery Phases

### Phase 0: Baseline And Deletion Inventory

1. inventory all current access evaluators
2. identify legacy fallbacks
3. write failing tests against desired canonical behavior
4. define deletion list

### Phase 1: Canonical Access Data Model

1. add new tables
2. add indexes and RLS
3. backfill roster/link state
4. add search-oriented SQL contract

### Phase 2: Shared Access Evaluation Domain

1. build `lib/access-control/*`
2. centralize tier, role, tab, override logic
3. add shadow diff tooling

### Phase 3: Guild Directory And Member Detail APIs

1. directory list API
2. member detail API
3. search API
4. sync and audit APIs

### Phase 4: Admin UI

1. guild directory
2. detail workspace
3. filters
4. role/override actions
5. audit views

### Phase 5: Repo-Wide Consumer Migration

1. auth callback
2. member auth context
3. tab config fetch path
4. feature access helpers
5. admin routes
6. profile access displays

### Phase 6: Validation And Release

1. shadow diff pass
2. full integration suite
3. Playwright admin flows
4. production smoke
5. legacy code deletion

## 15. Acceptance Criteria

The refactor is complete only when:

1. an admin can browse every guild member from `Member Access`
2. Discord-only members appear before first login
3. Discord username search works in `Member Access`
4. every access decision uses the shared evaluator
5. no frontend or API fallback tab arrays remain in production code paths
6. tab reasoning is visible per member
7. overrides are audited and expire correctly
8. Discord role edits go through Discord, not DB-only shortcuts
9. root auth/profile/member flows remain green
10. shadow diff and deployed smoke have no unresolved access regressions

## 16. Release Blockers

Do not ship if any of the following remain:

1. duplicated access evaluators
2. fallback tabs still active in production
3. Discord username search missing in admin
4. guild roster incomplete or not searchable
5. unaudited write actions
6. unexplained old-vs-new access diffs
7. missing Playwright coverage for admin directory and role/override actions

## 17. Implementation Standard

This project must be treated as an access-domain rewrite, not a UI enhancement.

The implementation must prefer:

1. typed access-domain modules
2. clear source-of-truth boundaries
3. idempotent writes
4. test-first migrations
5. deletion of legacy fallbacks

The implementation must reject:

1. another lookup-only admin screen
2. another route-local access calculation
3. silent production fallbacks that hide broken config
4. DB-only role edits that bypass Discord
