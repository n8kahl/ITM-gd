# Trade Journal Implementation Status

Source of truth: `docs/specs/TRADE_JOURNAL_V2_SPEC.md`
Status date: 2026-02-10

## Version Status
- V1 (`docs/TITM_TRADE_JOURNAL_SPEC_V1.md`): **Deprecated**
- V2 (`docs/specs/TRADE_JOURNAL_V2_SPEC.md`): **Implemented**

## V2 Completion
- [x] Phase 1: Removed draft/auto-journal/session-context/push/replay/open-position legacy routes and UI components.
- [x] Phase 2: Replaced incremental journal migrations with single clean schema migration.
- [x] Phase 3: Rebuilt journal types, validation, sanitization, and offline storage for read-only cache.
- [x] Phase 4: Rewrote journal API surface to the reduced V2 endpoint set.
- [x] Phase 5: Rebuilt journal page/forms/views/import/analytics components for V2 UX.
- [x] Phase 6: Simplified server actions and removed legacy backend journal route/worker dependencies.
- [x] Phase 7: Replaced journal E2E suite with V2 core/import/filter scenarios.
- [x] Phase 8: Updated implementation docs and README references to V2 journal scope.
- [x] Phase 9: Validation pipeline executed (`tsc`, `lint`, `build`, unit tests, journal Playwright suite).

## Removed From V1 (And Why)
- Draft workflow (`drafts`, confirm, draft-from-session): removed for manual-first reliability and lower complexity.
- Auto-journal generation + workers: removed to eliminate speculative writes and background drift.
- AI Coach bridge/session prefill: removed to keep journaling independent and deterministic.
- Push subscription/prompt flows: removed from journal scope to reduce operational surface.
- Behavioral insights/pattern analyzer stack: removed to avoid stale derived state and worker coupling.
- Playbook management in journal: removed to keep V2 focused on core entry/import/analytics flows.
- Replay/open-positions journal widgets: removed to avoid external dependency coupling and UX bloat.
- Offline mutation queue: removed; offline mode is now read-only cached viewing.

## Canonical V2 Deliverables
- Clean schema migration: `supabase/migrations/20260211000000_journal_v2_clean_schema.sql`
- Canonical journal endpoints:
  - `app/api/members/journal/route.ts`
  - `app/api/members/journal/import/route.ts`
  - `app/api/members/journal/analytics/route.ts`
  - `app/api/members/journal/screenshot-url/route.ts`
  - `app/api/members/journal/grade/route.ts`
- Canonical types/validation:
  - `lib/types/journal.ts`
  - `lib/validation/journal-entry.ts`
  - `lib/journal/sanitize-entry.ts`
  - `lib/journal/offline-storage.ts`
- Canonical journal UI:
  - `app/members/journal/page.tsx`
  - `components/journal/trade-entry-sheet.tsx`
  - `components/journal/quick-entry-form.tsx`
  - `components/journal/full-entry-form.tsx`
  - `components/journal/entry-detail-sheet.tsx`
  - `components/journal/journal-table-view.tsx`
  - `components/journal/journal-card-view.tsx`
  - `components/journal/journal-filter-bar.tsx`
  - `components/journal/journal-summary-stats.tsx`
  - `components/journal/import-wizard.tsx`
  - `components/journal/analytics-dashboard.tsx`
