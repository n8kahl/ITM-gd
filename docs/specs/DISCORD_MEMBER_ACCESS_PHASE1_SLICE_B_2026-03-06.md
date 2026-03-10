# Discord Member Access Phase 1 Slice B (2026-03-06)

## Slice
Action 2: Harden sync/profile identity resolution and claims alignment.

## Files Touched
- `supabase/functions/sync-discord-roles/index.ts`
- `supabase/migrations/20260306090000_members_gate_role_config_and_claims.sql`

## Delivered
- Edge sync now reads configurable members-role gate from `app_settings` with default fallback.
- Sync response now includes effective `members_allowed_role_ids` for downstream diagnostics/UX.
- SQL claims function now computes `is_member` against configurable members-role IDs.

## Validation
- `pnpm exec eslint supabase/functions/sync-discord-roles/index.ts`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm run build`: PASS
