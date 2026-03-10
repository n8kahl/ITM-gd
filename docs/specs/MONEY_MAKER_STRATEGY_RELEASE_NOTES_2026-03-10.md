# Money Maker Strategy Release Notes

**Date:** 2026-03-10  
**Release Type:** Production hardening

## Summary

Money Maker is now unblocked for production use. The missing database schema was applied, the app now exposes authenticated Money Maker member API routes, and the frontend now renders live snapshot signals instead of polling without updating UI state.

## Fixed

- Created `money_maker_watchlists`, `money_maker_signals`, and `money_maker_default_symbols` in production.
- Seeded default Money Maker symbols in production: `SPY`, `TSLA`, `AAPL`, `NVDA`, `META`.
- Restored working app-layer API access for Money Maker via `/api/members/money-maker/*`.
- Fixed frontend snapshot polling so `signals` populate the grid state.
- Added manual refresh support in the Money Maker shell.
- Reconciled the stray public `/money-maker` route by redirecting it to `/members/money-maker`.
- Prevented same-bar signal persistence collisions in `money_maker_signals`.
- Added safer watchlist fallbacks and rollback behavior for failed saves.

## Production Migration

- Applied remote migration: `20260310033237 money_maker_tables_bootstrap`

## Validation Evidence

- Frontend lint: passed
- Root typecheck: passed
- Backend typecheck: passed
- Money Maker member access test: passed
- Money Maker library unit suite: passed
- Backend Money Maker symbol data fetcher test: passed

## Known Gaps

- No dedicated Money Maker Playwright scenario exists yet for the admin-only tab flow.
