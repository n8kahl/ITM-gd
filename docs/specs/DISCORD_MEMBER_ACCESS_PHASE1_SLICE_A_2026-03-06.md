# Discord Member Access Phase 1 Slice A (2026-03-06)

## Slice
Action 1: Centralize configurable members-gate role resolution and replace hardcoded gate checks.

## Files Touched
- `lib/discord-role-access.ts`
- `proxy.ts`
- `app/api/auth/callback/route.ts`
- `app/api/admin/members/access/route.ts`
- `app/api/admin/members/force-sync/route.ts`
- `lib/academy-v3/access-control.ts`
- `lib/discord-permission-sync.ts`

## Delivered
- Added shared resolver with precedence: `app_settings.members_required_role_ids` -> env override -> defaults.
- Updated member-access checks in middleware/callback/admin and sync helpers to use a single gate resolver.
- Preserved backward compatibility with legacy `members_required_role_id` and hardcoded default IDs.

## Validation
- `pnpm exec eslint <touched files>`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm vitest run lib/__tests__/discord-role-access.test.ts lib/__tests__/discord-permission-sync.test.ts lib/academy-v3/__tests__/access-control.test.ts`: PASS
