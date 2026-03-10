# Discord Member Access Runbook (2026-03-06)

## Purpose
Operate, verify, and recover Discord member access and tab visibility with consistent role-gated behavior.

## Preconditions
- Latest app deployment live.
- Migration `20260306090000_members_gate_role_config_and_claims.sql` applied.
- Edge Function `sync-discord-roles` deployed from latest repo source.
- Discord settings configured: `discord_bot_token`, `discord_guild_id`.

## Configuration Checklist
1. Admin → Settings → Discord Integration:
   - Verify bot token and guild ID.
   - Verify Members Required Roles has at least one valid Discord role ID.
2. Admin → Roles:
   - Confirm role→permission mappings include intended capabilities.
3. Admin → Tabs:
   - Confirm each role-gated tab has valid required Discord roles.

## Runtime Verification
1. Admin → Member Access Debugger:
   - Lookup by email or Discord user ID.
   - Confirm `Members gate role = PASS`.
   - Confirm expected tab IDs in `allowed_tabs`.
2. Member flow:
   - Log in with Discord.
   - If redirected to `/join-discord`, run Retry Sync and confirm state outcome.

## Recovery Steps (User Locked Out)
1. Lookup user in `/admin/members-access`.
2. Run `Force Discord Role Sync`.
3. If still failing, verify configured members gate roles match actual Discord roles.
4. Validate Discord bot permission to call `/guilds/{guild}/members/{user}`.

## Validation Commands
```bash
pnpm exec eslint lib/discord-role-access.ts proxy.ts app/api/auth/callback/route.ts app/api/admin/members/access/route.ts app/api/admin/members/force-sync/route.ts app/api/admin/settings/route.ts app/admin/settings/page.tsx app/join-discord/page.tsx app/api/members/sync-discord/route.ts app/admin/tabs/page.tsx app/actions/test-discord.ts lib/discord-permission-sync.ts lib/academy-v3/access-control.ts
pnpm exec tsc --noEmit
pnpm vitest run lib/__tests__/discord-role-access.test.ts lib/__tests__/discord-permission-sync.test.ts lib/academy-v3/__tests__/access-control.test.ts
pnpm run build
```

## Rollback
1. Revert deployment to previous release tag.
2. Reset `members_required_role_ids` to prior defaults.
3. Restore previous claims sync function definition if needed.
4. Re-sync impacted users.
