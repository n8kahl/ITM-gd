# Money Maker Strategy Runbook

**Date:** 2026-03-10

## Purpose

Operational checks for the admin-only Money Maker tab after the 2026-03-10 production hardening pass.

## Production Dependencies

- Supabase tables:
  - `public.money_maker_watchlists`
  - `public.money_maker_signals`
  - `public.money_maker_default_symbols`
- Remote migration:
  - `20260310033237 money_maker_tables_bootstrap`
- App tab configuration:
  - `tab_id = money-maker`
  - `path = /members/money-maker`
  - `required_tier = admin`

## Smoke Test

1. Sign in as an admin user.
2. Open `/members/money-maker`.
3. Confirm the page renders without a 404 or an authorization error.
4. Confirm the grid loads default symbols when no personal watchlist exists.
5. Add or remove a symbol in the watchlist drawer.
6. Confirm the drawer update persists after a reload.
7. Confirm the `Last updated` timestamp advances automatically.
8. Click `Refresh` and confirm the request completes without error.

## Data Checks

Run against Supabase if Money Maker appears empty or returns errors:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'money_maker_%'
order by table_name;
```

```sql
select symbol, display_order
from public.money_maker_default_symbols
order by display_order;
```

## Failure Modes

- `404` on Money Maker API calls:
  - Check the app is calling `/api/members/money-maker/*`, not `/api/money-maker/*`.
- `401` or `403` on Money Maker API calls:
  - Confirm the user is authenticated and has admin access.
- Empty watchlist for a new admin:
  - Confirm `money_maker_default_symbols` has seeded rows.
- Snapshot succeeds but persistence is missing:
  - Confirm `money_maker_signals` exists and the backend has `SUPABASE_SERVICE_ROLE_KEY`.

## Rollback Guidance

- Hide the feature by setting `tab_configurations.is_active = false` for `tab_id = 'money-maker'`.
- Revert app-layer changes if the member proxy routes need to be removed.
- Do not drop the Money Maker tables as part of a standard rollback; they are additive and safe to leave in place.
