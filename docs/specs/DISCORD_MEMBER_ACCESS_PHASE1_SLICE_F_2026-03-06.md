# Discord Member Access Phase 1 Slice F (2026-03-06)

## Slice
Action 6: Admin tabs role-management hardening.

## Files Touched
- `app/api/admin/tabs/route.ts`
- `app/admin/tabs/page.tsx`
- `lib/role-tier-mapping.ts`
- `app/api/config/roles/route.ts`
- `lib/social/membership.ts`
- `lib/academy/get-user-tier.ts`
- `lib/social/__tests__/membership.test.ts`

## Delivered
- Added API validation for malformed Discord role IDs on tab config saves.
- Added tabs UI role-title resolution, quick-add role picker, and unknown-role warnings.
- Consolidated role-tier mapping source-of-truth preference to `pricing_tiers.discord_role_id` with legacy fallback.

## Validation
- `pnpm exec eslint <touched files>`: PASS
- `pnpm vitest run lib/social/__tests__/membership.test.ts`: PASS
- `pnpm exec tsc --noEmit`: PASS
