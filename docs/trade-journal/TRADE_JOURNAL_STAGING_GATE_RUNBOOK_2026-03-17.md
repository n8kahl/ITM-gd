# Trade Journal Staging Gate Runbook

Last updated: 2026-03-17

## Audience

This runbook is written for a release owner who is not a developer.

Use it before customers are allowed into the Trade Journal.

## What This Gate Proves

The gate only passes if all of the following are true:
- Automated release gates are green.
- Screenshot processing is proven with real staging files.
- CSV processing is proven with real staging files.
- Core journal CRUD is proven with a real member account.
- AI grading, sharing, and coach review paths are proven on staging where applicable.

## Important Limitation

The current journal browser regression suite is strong, but many tests use mocks for speed and determinism.

That means:
- CI proves the UI contracts and most failure handling.
- A real staging smoke pass is still required for screenshot uploads, CSV imports, and any flow that depends on authenticated server-side Supabase cookies or third-party services.

Do not skip the manual staging certification set.

## Automated Gate

Run locally if you want the full gate on your machine:

```bash
pnpm test:journal:release
```

Dispatch the GitHub workflow:

```bash
pnpm trade-journal:release:preflight
pnpm trade-journal:release:run
```

Workflow:
- `.github/workflows/trade-journal-release-gates.yml`

What the automated gate runs:
- `pnpm typecheck`
- `pnpm lint:journal:release`
- `pnpm test:coverage`
- `pnpm test:backend:journal-contract`
- `pnpm build`
- `pnpm test:journal:e2e`

## Pre-Staging Setup

Before manual staging testing, confirm all of the following:
- The candidate build is deployed to staging.
- You have one staging member account.
- You have one staging reviewer/admin account.
- You have at least three screenshot files ready:
  - single-position screenshot
  - multi-position screenshot
  - low-confidence or no-position screenshot
- You have at least three CSV files ready:
  - valid broker CSV
  - duplicate re-import CSV
  - malformed or missing-column CSV
- If Discord sharing is part of the release, the staging webhook target is safe and observable.

## Manual Staging Certification Set

### 1. Journal CRUD

Pass criteria:
- Open Trade Journal as a staging member.
- Create a trade from Quick Form.
- Create a trade from Full Form.
- Edit one saved trade.
- Delete one saved trade.

Fail criteria:
- Any save silently fails.
- Totals, row counts, or detail sheet fields do not update correctly.

### 2. Screenshot Processing

Single-position file:
- Upload the screenshot.
- Confirm the app extracts the expected symbol and trade context.
- Save the entry.
- Open the saved trade and confirm the screenshot is attached and viewable.

Multi-position file:
- Upload the screenshot.
- Confirm the app does not auto-save the wrong trade.
- Confirm the user must explicitly choose or type the intended symbol.

Low-confidence or no-position file:
- Upload the screenshot.
- Confirm the app gives a clear recovery path.
- Confirm no junk trade is created automatically.

Security checks:
- Confirm invalid file types are rejected.
- Confirm the resulting storage path belongs to the current user only.

### 3. CSV Processing

Valid broker CSV:
- Open Import.
- Upload the file.
- Verify preview counts and rows.
- Confirm import.
- Verify inserted count and resulting rows in the journal.

Duplicate re-import:
- Import the same file again.
- Verify duplicates are reported and not inserted a second time.

Malformed CSV:
- Import an empty or malformed file.
- Verify the app shows a friendly failure and does not create rows.

### 4. Filters, Pagination, and Views

Pass criteria:
- Filter by date range.
- Filter by symbol.
- Filter by open/closed state.
- Sort by P&L.
- Switch between cards and table.
- Verify total count and visible count stay coherent.

### 5. Analytics and AI Grading

Pass criteria:
- Open Analytics and verify it loads without empty-state errors for seeded data.
- Grade a closed trade.
- Confirm the badge, expanded analysis, and saved state render correctly after refresh.

If OpenAI or upstream AI services are intentionally disabled:
- Confirm the app fails gracefully and record that this was a controlled environment limitation.

### 6. Share and Review Operations

Pass criteria:
- Share one closed trade and verify the trade card looks correct.
- Submit one trade for coach review if your plan includes this feature.
- As reviewer/admin, open the review queue, generate or edit a draft, and publish.
- As member, confirm the published feedback appears on the trade.

### 7. Mobile Certification

Pass criteria:
- Repeat quick entry.
- Repeat screenshot flow.
- Repeat CSV preview and import.
- Repeat filter flow.

Use:
- browser mobile viewport in automation
- one real phone for final confidence

## Evidence To Capture

Record all results in:
- `docs/trade-journal/TRADE_JOURNAL_RELEASE_EVIDENCE_TEMPLATE_2026-03-17.md`

Capture:
- candidate commit SHA
- automated workflow URL
- date and tester name
- pass/fail per certification block
- screenshots of any failure
- exact staging URLs used
- notes on any skipped item and why

## Release Decision

Release only when all are true:
- Automated gate is green.
- Screenshot certification set is green.
- CSV certification set is green.
- No open P0 or P1 defects remain.
- Evidence document is complete.

Do not release when any of these are true:
- Screenshot upload is flaky.
- CSV import totals are inconsistent.
- AI grade payloads fail to render safely.
- Review/share paths produce partial or misleading output.
