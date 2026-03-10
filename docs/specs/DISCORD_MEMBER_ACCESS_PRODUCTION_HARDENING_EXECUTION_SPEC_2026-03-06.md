# Discord Member Access Production Hardening Execution Spec (2026-03-06)

## Objective
Ship a production-grade hardening release for Discord membership sync, profile resolution, members-area gating, and admin membership/role management so Discord-authenticated members can consistently log in and see all appropriate `/members` tabs.

## Discovery And Drift (48h + Runtime)
- Recent branch drift includes auth/membership tab work (`cd37114`, `6d09dbf`) but runtime incidents show production divergence on Discord sync and claims propagation.
- Runtime diagnostics identified these failure categories:
  1. Sync drift: deployed `sync-discord-roles` edge function lags repo logic.
  2. State drift: some Discord-auth users lack `user_discord_profiles` and `user_permissions`.
  3. Gate drift: members-role checks are hard-coded in multiple surfaces.
  4. Config drift: admin flows do not expose a canonical members gate setting.
  5. UX drift: `/join-discord` cannot actively retry sync and conflates `NOT_MEMBER` vs "no role".
  6. Admin operability drift: lookup by Discord ID depends on cached profile rows and can miss auth metadata-only users.

## Architecture And Experience Design
### Architecture
- Introduce a single shared resolver for members-gate role IDs with precedence:
  1. `app_settings.members_required_role_ids` (JSON array/string/CSV supported)
  2. `DISCORD_MEMBERS_ALLOWED_ROLE_IDS` env override (CSV)
  3. backward-compatible hardcoded defaults.
- Update all gate checks (middleware/callback/admin/sync helpers) to use this shared resolver.
- Add a migration that aligns `sync_permissions_to_claims()` membership logic with configurable gate roles via `app_settings`.
- Keep role/tier tabs model intact (`tab_configurations` + role/tier mapping) while eliminating gate-role duplication.

### Experience
- `/join-discord`: add explicit status states (`NOT_MEMBER`, `NO_MEMBERSHIP_ROLE`, `SYNC_FAILED`, `SYNCED`) and real retry sync button.
- `/admin/settings`: add members gate role management card with Discord role picker + validation.
- `/admin/members-access`: improve Discord ID lookup fallback and expose configured gate role IDs in diagnostics.
- `/admin/tabs`: improve role-ID entry reliability with role title resolution and unknown-ID warnings.

## Six Proposed Actions (Implementation Slices)
1. Centralize configurable members-gate role resolution and replace hardcoded checks.
2. Harden user sync/profile identity resolution paths and claims alignment.
3. Add active retry-sync and stateful `/join-discord` UX.
4. Improve admin member-access debugger lookup and diagnostics.
5. Harden admin Discord settings/profile management validations and gate-role management.
6. Harden admin tab role-management UX and validation.

## Scope
- Auth callback + middleware membership gate enforcement.
- Discord sync helper surfaces (`sync-discord-roles`, permission recompute, academy/member gate checks).
- Admin settings/members-access/tabs management APIs and UIs.
- Supporting migration(s), docs, and targeted tests.

## Out Of Scope
- Replacing tab-tier model with `app_config.role_permissions` runtime.
- Full social/profile redesign.
- Non-Discord auth provider changes.

## Acceptance Criteria
1. Members gate role IDs are configurable without code deployment.
2. All critical gate decisions (`/members`, callback, admin debugger, sync helpers) use the same role resolver.
3. `/join-discord` supports a true sync retry and clear status messaging.
4. Admin member lookup by `discord_user_id` works even without `user_discord_profiles` rows.
5. Admin settings can configure members gate role IDs with server-side validation.
6. Tab management surfaces reveal unknown role IDs and reduce misconfiguration risk.
7. Migration aligns `is_member` claim calculation to configured members roles.

## Risks
- Misconfigured empty gate role config could lock out members.
  - Mitigation: fallback defaults + validation rejecting empty/invalid values.
- Middleware config fetch latency.
  - Mitigation: in-process TTL cache + env fallback.
- SQL function behavior differences across environments.
  - Mitigation: idempotent migration with safe fallback defaults.

## Rollback Plan
1. Revert app code changes for resolver + admin/join UX.
2. Restore prior `sync_permissions_to_claims()` definition via rollback migration.
3. Reset `app_settings.members_required_role_ids` to defaults.
4. Re-run auth sync for impacted users.

## Validation Gates
### Slice-level
- `pnpm exec eslint <touched files>`
- `pnpm exec tsc --noEmit`
- `pnpm vitest run <targeted tests>`

### Release-level
- `pnpm exec eslint .`
- `pnpm exec tsc --noEmit`
- `pnpm run build`

Node runtime validated: `v20.19.5`.
