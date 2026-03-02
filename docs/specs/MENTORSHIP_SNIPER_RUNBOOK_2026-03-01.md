# Sniper Mentorship Runbook (2026-03-01)

## Purpose
Operate and verify the mentorship surface after deployment.

## Preconditions
- Latest app code deployed.
- Migration `20260330010000_mentorship_tab_role_gate.sql` applied.
- `tab_configurations` contains `mentorship` row.

## Configuration Checks
1. Verify `tab_configurations.required_discord_role_ids` exists.
2. Verify mentorship row:
   - `tab_id='mentorship'`
   - `path='/members/mentorship'`
   - `is_active=true`
   - `required_discord_role_ids` includes intended role IDs.
3. In Admin > Tabs, confirm role IDs are editable and persist after save.

## Functional Checks
1. Authorized member:
   - Mentorship tab visible in member nav.
   - `/members/mentorship`, `/week-1`, and `/resources` load correctly.
2. Unauthorized member:
   - Mentorship tab hidden.
   - Deep-link to `/members/mentorship/week-1` shows access-denied state.
3. Mobile:
   - Week 1 renders card-style data blocks for core comparisons instead of requiring horizontal table scroll.
   - Primary actions are comfortably tappable.

## Test Commands
```bash
pnpm exec eslint app/members/mentorship/page.tsx app/members/mentorship/layout.tsx app/members/mentorship/resources/page.tsx app/members/mentorship/week-1/page.tsx app/members/mentorship/week-1/journal-guide/page.tsx components/mentorship/mentorship-access-gate.tsx components/mentorship/mentorship-sub-nav.tsx components/members/feature-sub-nav.tsx app/admin/tabs/page.tsx app/api/admin/tabs/route.ts app/api/config/tabs/route.ts app/api/admin/members/access/route.ts contexts/MemberAuthContext.tsx lib/mentorship/access.ts lib/mentorship/__tests__/access.test.ts e2e/specs/members/mentorship.spec.ts
pnpm exec tsc --noEmit
pnpm vitest run lib/mentorship/__tests__/access.test.ts
PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/mentorship.spec.ts --project=chromium --workers=1
```

## Rollback
1. Disable mentorship tab (`is_active=false`) via Admin > Tabs.
2. Revert feature commit(s) if route gate or UI causes regression.
3. Re-run validation gates and redeploy stable revision.
