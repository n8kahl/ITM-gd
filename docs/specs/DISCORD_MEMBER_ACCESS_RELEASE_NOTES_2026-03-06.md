# Discord Member Access Release Notes (2026-03-06)

## Summary
Production hardening release for Discord membership sync, members gate enforcement, login recovery, and admin role-management surfaces.

## Added
- Configurable members gate role IDs (`members_required_role_ids`) with shared runtime resolver.
- `/join-discord` active retry sync flow and explicit access-state messaging.
- Admin settings controls for members gate role IDs.

## Changed
- Members gate checks now resolve from shared config across middleware, callback, sync paths, and admin debugger.
- Admin members-access diagnostics include configured gate role details and improved Discord ID resolution.
- Admin tabs UX now surfaces role-name context and unknown-role warnings.

## Fixed
- Users with valid Discord membership roles but stale/missing cached profile rows can now be resolved more reliably in admin diagnostics.
- Membership claim logic is aligned with members role gate config (via migration/function update).

## Operational Notes
- Apply migration: `supabase/migrations/20260306090000_members_gate_role_config_and_claims.sql`.
- Ensure `app_settings.discord_guild_id` and `app_settings.discord_bot_token` are set.
- Optionally configure `app_settings.members_required_role_ids` (JSON array). Defaults remain backward-compatible.
- Deploy updated Edge Function: `sync-discord-roles` (required to remove runtime drift from currently deployed legacy version).
