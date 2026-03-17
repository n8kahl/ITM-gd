# Trade Journal QE Traceability Matrix

Last updated: 2026-03-17

## How To Use This

This file is the release checklist for non-developers and developers.

Rules:
- Every customer-visible feature must have automated coverage, manual staging coverage, or both.
- Screenshot processing and CSV processing are P0. They block release if unverified.
- If any P0 or P1 row is red, do not allow customers into the feature.
- Automated evidence comes from GitHub Actions plus local commands in `package.json`.
- Manual evidence is recorded in `TRADE_JOURNAL_RELEASE_EVIDENCE_TEMPLATE_2026-03-17.md`.

## Release Commands

```bash
pnpm typecheck
pnpm lint:journal:release
pnpm test:coverage
pnpm test:backend:journal-contract
pnpm test:journal:e2e
pnpm test:journal:release
pnpm trade-journal:release:preflight
pnpm trade-journal:release:run
```

## Surface Matrix

| Priority | Surface | Customer Risk | Automated Coverage | Manual Staging Certification |
| --- | --- | --- | --- | --- |
| P0 | Authenticated journal shell and route access | Customers cannot open journal or see the wrong account | `e2e/specs/members/journal.spec.ts`, `e2e/specs/auth/*.spec.ts`, `proxy.ts` access rules | Log in with staging member, confirm `/members/journal` loads and no other user's data is visible |
| P0 | Create, edit, delete trade entries | Core journaling breaks or data corruption | `e2e/specs/members/journal.spec.ts`, `app/api/members/journal/route.ts` | Create one trade, edit fields, delete it, confirm exact row change in UI and database |
| P0 | Screenshot upload URL signing | Uploads fail or cross-user files leak | `app/api/members/journal/screenshot-url/route.ts`, `e2e/specs/members/journal-screenshot.spec.ts` | Upload PNG and JPEG in staging, confirm signed upload works and stored path stays under the current user folder |
| P0 | Screenshot processing single-position flow | Wrong symbol or wrong extracted fields create bad trades | `components/journal/screenshot-quick-add.tsx`, `e2e/specs/members/journal-screenshot.spec.ts` | Upload a real broker screenshot with one position, verify symbol, contract type, and screenshot attachment on saved trade |
| P0 | Screenshot processing multi-position flow | Ambiguous screenshots can create the wrong trade | `e2e/specs/members/journal-screenshot.spec.ts` | Upload a screenshot with multiple positions, confirm the app forces explicit selection before save |
| P0 | Screenshot processing no-position / low-confidence flow | OCR/parsing failures silently create junk entries | `e2e/specs/members/journal-screenshot.spec.ts` | Upload an unsupported or empty screenshot and confirm the flow requires manual symbol entry or blocks save cleanly |
| P0 | Screenshot validation and security | Unsupported files, path traversal, and cross-user reads | `app/api/members/journal/screenshot-url/route.ts` schema rules, `e2e/specs/members/journal-screenshot.spec.ts` | Attempt unsupported file type and invalid path, verify friendly failure and no object created |
| P0 | CSV parsing and preview | Imported trades can be misread before save | `components/journal/import-wizard.tsx`, `e2e/specs/members/journal-import.spec.ts` | Import one valid broker CSV and confirm preview row count, field mapping, and validity badges |
| P0 | CSV import write path | Batch import can corrupt or drop trades | `app/api/members/journal/import/route.ts`, `e2e/specs/members/journal-import.spec.ts` | Import a real CSV file in staging, verify inserted count, duplicate count, error count, and resulting journal rows |
| P0 | CSV dedupe identity | Distinct trades can collapse into one row | `app/api/members/journal/import/route.ts`, `lib/journal/import-normalization.ts`, `e2e/specs/members/journal-import.spec.ts` | Re-import the same file to prove duplicates are blocked, then import a near-identical file with one changed field to prove distinct trades persist |
| P0 | CSV malformed-file handling | Broken files can crash the flow or create partial junk | `e2e/specs/members/journal-import.spec.ts` | Try empty CSV, malformed CSV, and missing-column CSV; confirm safe error messaging and no unintended writes |
| P0 | AI trade grading request/response contract | Users see broken grade UI or invalid analysis payloads | `app/api/members/journal/grade/route.ts`, `e2e/specs/members/journal-ai-grade.spec.ts`, `lib/journal/__tests__/trade-grading.test.ts` | Grade a real closed trade in staging and confirm badge, detail text, and persisted analysis render correctly |
| P0 | AI fallback behavior | OpenAI outage should degrade safely, not block journaling | `app/api/members/journal/grade/route.ts` heuristic fallback, `e2e/specs/members/journal-ai-grade.spec.ts` error coverage | Temporarily disable or throttle OpenAI in staging only if safe, confirm graceful failure or fallback response |
| P1 | Filters, sorting, pagination, and view modes | Users cannot find trades or totals are misleading | `e2e/specs/members/journal-filters*.spec.ts`, `journal-pagination.spec.ts`, `journal-mobile.spec.ts` | Apply date, symbol, open/closed, and P&L sorts in staging and verify visible rows plus “showing X of Y” consistency |
| P1 | Detail sheet and screenshot zoom | Hidden data or broken controls in review flow | `e2e/specs/members/journal-detail-sheet.spec.ts`, `journal.spec.ts` | Open detail sheet for trade with screenshot, verify all fields and zoom modal |
| P1 | Draft banners and psychology prompts | Prompt timing/state bugs create noise or data loss | `e2e/specs/members/journal-drafts.spec.ts`, `journal-psychology.spec.ts` | Close a trade that should trigger prompts, verify save, dismiss, and repeat behavior |
| P1 | Analytics, bias insights, and pre-trade context | Wrong metrics erode trust and coaching quality | `app/api/members/journal/analytics/route.ts`, `app/api/members/journal/biases/route.ts`, `app/api/members/journal/context/route.ts`, `e2e/specs/members/journal-analytics.spec.ts` | Compare staging analytics against seeded trades with known outcomes; verify totals, win rate, and bias cards |
| P1 | Share-trade card generation and Discord handoff | Users share wrong P&L or broken cards | `app/api/social/share-trade/route.ts`, `lib/social/__tests__/trade-card-generator.test.ts`, `e2e/specs/members/journal.spec.ts` | Share one closed trade in staging, confirm image renders correctly and Discord handoff result is clear |
| P1 | Coach review request and published feedback | Premium review workflows can dead-end | `app/api/members/journal/[id]/request-review/route.ts`, `app/api/members/journal/[id]/coach-feedback/route.ts`, `e2e/specs/admin/trade-review.spec.ts` | Submit a trade for review, confirm admin queue, generate draft, publish, then confirm member sees published feedback |
| P1 | SPX replay and auto-capture journal paths | Journal integrations can write malformed rows | `backend/src/__tests__/integration/spx-replay-journal-api.test.ts`, `lib/spx/__tests__/trade-journal-capture.test.ts` | Save one replay session or SPX-originated trade to the journal in staging and verify fields on the resulting row |
| P1 | Mobile layout and touch interactions | High-usage mobile flows can be unusable | `e2e/specs/members/journal-mobile.spec.ts`, `journal-a11y.spec.ts` | Run screenshot, import, filter, and quick-entry flows on mobile viewport and one real phone |
| P1 | Accessibility basics | Keyboard and screen-reader blockers impact customers immediately | `e2e/specs/members/journal-a11y.spec.ts` | Keyboard-only pass across create, import, screenshot, detail, and analytics views |
| P2 | Offline cached viewing | Users may see stale cache without clear state | `lib/journal/offline-storage.ts`, `app/members/journal/page.tsx` | Toggle offline after a successful load and confirm cached read-only behavior is understandable |
| P2 | Performance under load | Large histories can make analytics or import unusable | `docs/specs/TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md` notes, release gate timing | Measure import latency, analytics latency, and screenshot latency with large seeded datasets |

## Current Automation Inventory

Automated today:
- Journal browser regressions in `e2e/specs/members/journal*.spec.ts`
- Admin review regressions in `e2e/specs/admin/trade-review.spec.ts`
- Backend replay/journal integrations in `backend/src/__tests__/integration/*.test.ts`
- Journal domain/unit tests in `lib/journal/__tests__` and `lib/validation/__tests__`

Added by this QE pack:
- CI unit and contract lane in `.github/workflows/unit-and-contract-tests.yml`
- Explicit Trade Journal release-gate workflow in `.github/workflows/trade-journal-release-gates.yml`
- Coverage thresholds in `vitest.config.ts` and `backend/jest.config.js`
- Preflight and dispatch scripts in `scripts/trade-journal/`

Release-gate backend scope:
- The automated journal gate runs the backend replay-to-journal contract tests that are directly tied to journal data flow.
- The full backend Jest suite currently contains unrelated SPX test debt and is not used as a journal release blocker.

## Blocking Rules

Release is blocked when any of these are true:
- `pnpm test:journal:release` fails
- Screenshot certification set is incomplete
- CSV certification set is incomplete
- A P0 or P1 row in this matrix has no evidence for the candidate build
- Staging evidence is missing from `TRADE_JOURNAL_RELEASE_EVIDENCE_TEMPLATE_2026-03-17.md`
