# SPX Command Center Phase 18 — Phase D Slice 5

Date: 2026-02-23  
Owner: Codex autonomous hardening  
Status: Implemented

## Scope delivered

- Remediated high-risk permissive RLS write policies on core public/admin tables.
- Removed unrestricted public access from sensitive member/admin datasets.
- Preserved form ingestion behavior by replacing `WITH CHECK (true)` with validated insert predicates.

## Migration

- Added `/Users/natekahl/ITM-gd/supabase/migrations/20260327040000_security_policy_hardening_public_writes.sql`
- Applied in production as migration:
  - `security_policy_hardening_public_writes`

## Changes by table

### `team_members`

- Removed public write policies:
  - `Public can insert team members`
  - `Public can update team members`
  - `Public can delete team members`
- Replaced service-role policy with explicit role scoping (`TO service_role`).
- Added admin management policy (`is_admin` JWT claim) for authenticated admins.

### `push_subscriptions`

- Removed unrestricted policy:
  - `Public can manage push subscriptions`
- Retained scoped policies:
  - service role all
  - users manage own rows (`auth.uid()::text = user_id`)

### `cohort_applications`

- Tightened authenticated read/update to admin-only (`is_admin` JWT claim).
- Replaced permissive insert checks with validated predicates (`name/email/message` quality checks) for anon and authenticated inserts.

### `contact_submissions`

- Replaced public read with admin-only read policy.
- Replaced permissive public insert check with validated insert predicate.

### `subscribers`

- Replaced public read with admin-only read policy.
- Consolidated permissive public insert policies into one validated insert policy.

## Verification

- Queried live `pg_policies` for hardened tables and confirmed broad public write rules removed.
- Verified only expected scoped write policies remain.
- Confirmed migration appears in `supabase_migrations.schema_migrations`.

## Residual risk

- Advisor output still includes broad policy findings on other legacy analytics/chat tables not touched in this slice.
- Next hardening tranche should target:
  - `chat_messages`
  - `sessions`
  - `page_views`
  - `click_events`
  - `conversion_events`
  - `link_clicks`
