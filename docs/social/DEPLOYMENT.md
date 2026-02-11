# Profile Hub + Trade Social Deployment

## Pre-Deployment Checklist
- Apply all profile/social migrations in order.
- Verify `get_trading_transcript` and `compute_trader_dna` RPCs exist.
- Confirm RLS behavior for authenticated, owner, admin, and service role access.
- Configure `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, and `WHOP_COMPANY_ID`.
- Configure cron secret (`LEADERBOARD_CRON_SECRET` or shared `CRON_SECRET`) for scheduled leaderboard execution.
- Deploy `compute-leaderboards` edge function.
- Confirm Social tab exists in `tab_configurations` (or API fallback).
- Run `pnpm test:unit`, `pnpm test:e2e`, and `pnpm build`.

## Migration Order
1. `profile_social_member_profiles`
2. `profile_social_feed`
3. `profile_social_leaderboards`
4. `profile_social_affiliate_referrals`
5. `profile_social_profile_views`
6. `profile_social_trading_transcript_rpc`
7. `profile_social_trader_dna_rpc`

## Post-Deployment Steps
1. Backfill trader DNA for existing users.
2. Execute first leaderboard computation.
3. Verify empty-state and populated feed renders.
4. Validate journal share flow from entry detail sheet.
5. Monitor Sentry and API logs for first 24 hours.
