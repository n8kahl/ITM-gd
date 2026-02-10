# Codex Implementation Prompt — Trade Journal V2

> Paste this prompt into Codex to execute the full implementation.

---

## Prompt

You are implementing a production-grade rewrite of the Trade Journal feature for a Next.js 14 (App Router) application using Supabase (Postgres + Storage), React 18, Tailwind CSS, and Zod validation. The full spec is at `docs/specs/TRADE_JOURNAL_V2_SPEC.md` — read it first. This is NOT shipped code; there is no backward compatibility concern. The goal is a clean, simple, accurate, well-tested codebase.

Execute the following phases in order. After each phase, verify your work compiles (`npm run build`) before proceeding.

---

### Phase 1: Cleanup — Delete Dead Code

Delete every file listed in the spec's Section 8. This includes:

**API routes to delete:**
```
app/api/members/journal/drafts/route.ts
app/api/members/journal/drafts/[id]/confirm/route.ts
app/api/members/journal/auto-journal/route.ts
app/api/members/journal/draft-from-session/route.ts
app/api/members/journal/push-subscriptions/route.ts
app/api/members/journal/session-context/[sessionId]/route.ts
app/api/members/journal/insights/route.ts
app/api/members/journal/analyze/route.ts
app/api/members/journal/enrich/route.ts
app/api/members/journal/replay/[entryId]/route.ts
app/api/members/journal/history/[symbol]/route.ts
app/api/members/journal/open-positions/route.ts
app/api/members/journal/close-position/route.ts
app/api/members/journal/import-history/route.ts
```

**Components to delete:**
```
components/journal/draft-entries-panel.tsx
components/journal/behavioral-insights.tsx
components/journal/journal-pwa-prompt.tsx
components/journal/entry-modal.tsx
components/journal/playbook-manager.tsx
components/journal/trade-replay-chart.tsx
components/journal/open-positions-widget.tsx
components/journal/trade-entry-types.ts
components/journal/entries-table.tsx
```

**Lib files to delete:**
```
lib/journal/ai-coach-bridge.ts
lib/journal/draft-candidate-extractor.ts
```

**Backend files to delete:**
```
backend/src/workers/journalAutoPopulateWorker.ts
backend/src/workers/journalInsightsWorker.ts
backend/src/services/journal/autoPopulate.ts
backend/src/services/journal/pushNotifications.ts
backend/src/services/journal/patternAnalyzer.ts
backend/src/workers/__tests__/journalAutoPopulateWorker.test.ts
backend/src/workers/__tests__/journalInsightsWorker.test.ts
backend/src/services/journal/__tests__/autoPopulate.test.ts
```

After deleting, fix ALL broken imports in remaining files. Remove any import statements that reference deleted files. Remove any code blocks that call deleted components or APIs. The app must compile cleanly after this phase.

---

### Phase 2: Database Migration

Create a single new migration file: `supabase/migrations/20260211000000_journal_v2_clean_schema.sql`

This migration must:

1. Drop old tables: `trading_journal_entries`, `journal_quick_tags`, `journal_notifications`, `playbooks`, `push_subscriptions`
2. Drop old materialized view: `journal_analytics_cache`
3. Drop and recreate `journal_entries` with the exact schema from Section 3.1 of the spec, including:
   - `is_winner` as a GENERATED ALWAYS STORED column (computed from pnl)
   - `direction` NOT NULL DEFAULT 'long' with CHECK constraint
   - `contract_type` NOT NULL DEFAULT 'stock' with CHECK constraint
   - `exit_timestamp >= entry_timestamp` CHECK constraint
   - `position_size > 0` CHECK constraint
   - All indexes from the spec
   - `updated_at` trigger function with `SET search_path = ''`
4. Recreate `import_history` table from spec Section 3.2
5. Recreate `journal_streaks` table from spec Section 3.3
6. Apply RLS policies from spec Section 3.4 to all three tables
7. Create the `journal-screenshots` storage bucket if it doesn't exist

Delete ALL old journal migration files listed in the spec Section 8.5.

---

### Phase 3: Type Definitions & Validation

Rewrite these files from scratch to match the spec exactly:

**`lib/types/journal.ts`** — Define:
- `JournalEntry` interface (spec Section 5.1, exactly those fields, no extras)
- `AITradeAnalysis` interface (spec Section 5.4)
- `MarketContextSnapshot` interface (keep existing but make all fields typed, not `unknown`)
- `AdvancedAnalyticsResponse` interface (spec Section 5.3)
- `JournalFilters` type for filter state
- `JournalStats` type for summary stats

**`lib/validation/journal-entry.ts`** — Define:
- `journalEntryCreateSchema` — Zod schema matching spec Section 5.2 exactly, including all three `.refine()` cross-field validators
- `journalEntryUpdateSchema` — partial version with required `id`
- `importTradeRowSchema` — for CSV import row validation
- Helper: `sanitizeString(input: string, maxLength: number): string` — HTML-escapes `<`, `>`, `"`, `'` and trims/truncates

Delete `lib/validation/journal-api.ts` (merge relevant schemas into `journal-entry.ts`).

**`lib/journal/sanitize-entry.ts`** — Rewrite to:
- Use the `sanitizeString` helper from validation for ALL text fields
- Normalize direction to lowercase ('long' | 'short')
- Normalize contract_type to lowercase ('stock' | 'call' | 'put')
- Normalize mood values
- Validate AI analysis against `AITradeAnalysis` schema (reject unknown shapes)
- Remove all draft-related normalization
- Remove `normalizeDirection` — use Zod enum instead
- Remove `normalizeContractType` — use Zod enum instead

**`lib/journal/offline-storage.ts`** — Simplify to read-only cache:
- Keep: `readCachedJournalEntries()`, `writeCachedJournalEntries(entries)`, `clearCachedJournalEntries()`
- Remove: all offline mutation queue functions (`readOfflineJournalMutations`, `writeOfflineJournalMutations`, `enqueueOfflineMutation`, `buildOptimisticEntryFromMutation`, `mergeServerEntriesWithPendingOffline`)
- Remove: all sync_status and offline_queue_id logic

Delete `lib/journal/trade-grading.ts` — move AI grading logic into the grade API route directly.

---

### Phase 4: API Routes

Rewrite the 8 API routes to match spec Section 4. Each route must:
- Start with auth check: `const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`
- Validate input with Zod (return 400 with `error.flatten()` on failure)
- Sanitize all string inputs before database write
- Return consistent response format: `{ success: true, data: ... }` or `{ success: false, error: string }`
- Handle errors with try/catch and return 500 with generic message (log details server-side)

**`app/api/members/journal/route.ts`** (GET/POST/PATCH/DELETE):
- GET: Apply all query param filters from spec Section 4.2. Use parameterized queries. Return paginated results with total count.
- POST: Validate with `journalEntryCreateSchema`. Auto-calculate P&L if entry/exit prices provided but pnl missing. Update streaks.
- PATCH: Validate with `journalEntryUpdateSchema`. Re-calculate P&L if price fields change. If setting exit_price on open position, set is_open=false.
- DELETE: Require `id` query param. Delete screenshot from storage if exists. Recalculate streaks.

**`app/api/members/journal/import/route.ts`** (POST):
- Validate broker name against enum
- Normalize rows per broker (see spec Section 4.6)
- Use database upsert for duplicate prevention (NOT check-then-insert)
- Create `import_history` record
- Limit 500 rows

**`app/api/members/journal/analytics/route.ts`** (GET):
- Compute ALL metrics from spec Section 5.3
- Guard every division with `isFinite()` check — return `null` not `Infinity`
- Sharpe/Sortino return `null` when < 2 trades
- Use America/New_York timezone for hourly aggregation

**`app/api/members/journal/screenshot-url/route.ts`** (POST):
- Validate contentType against allowlist
- Generate path: `journal-screenshots/{userId}/{uuid}/{fileName}`
- Reject paths containing `..`
- Return signed upload URL

**`app/api/members/journal/grade/route.ts`** (POST):
- Accept `{ entryIds: string[] }` max 10
- Call AI for analysis
- Validate AI response against `AITradeAnalysis` schema before storing
- Store in `ai_analysis` JSONB field

---

### Phase 5: Frontend Components

Rewrite components to match spec Section 6. Key requirements:

**`app/members/journal/page.tsx`:**
- Remove all imports of deleted components (drafts panel, PWA prompt, open positions widget, AI coach bridge)
- Remove offline mutation queue logic — keep only read cache for offline viewing
- Add "You're offline" banner when `!navigator.onLine`
- Disable create/edit/delete buttons when offline
- Remove all draft-related state and filtering
- Use single `useReducer` for filter state instead of multiple `useState`

**`components/journal/trade-entry-sheet.tsx`:**
- Remove session prefill logic
- Remove all draft-related props and state
- Keep quick form + full form toggle
- Add inline validation errors (red text below fields) for required fields
- Add loading state on save button
- On save error, keep form open with data preserved

**`components/journal/quick-entry-form.tsx`:**
- Show inline error message when symbol is empty and user tries to save
- Auto-uppercase symbol input
- Tab order: symbol → direction → entry price → exit price → P&L → save

**`components/journal/full-entry-form.tsx`:**
- Remove placeholder rotation interval (unnecessary complexity)
- Remove all draft/session-related fields
- Group fields into collapsible sections: Trade Details, Options, Psychology, Notes

**`components/journal/entry-detail-sheet.tsx`:**
- Remove trade replay chart reference
- Remove session context loading
- Add custom delete confirmation modal (NOT window.confirm)
- Delete modal: shows entry summary, red delete button, Cancel as default focus, focus trap, Escape to close

**`components/journal/journal-card-view.tsx`:**
- Remove swipe gesture handling entirely (accessibility issue)
- Replace with explicit action buttons (Edit, Delete, Favorite) in each card
- Consolidate state into single `useReducer` instead of 3 separate `useState`

**`components/journal/journal-filter-bar.tsx`:**
- Memoize onChange handlers with `useCallback`
- Remove any draft-related filter options
- Add "Clear all" button to reset filters

**`components/journal/import-wizard.tsx`:**
- Replace naive `line.split(',')` CSV parser with PapaParse: `import Papa from 'papaparse'`
- Install PapaParse: add `papaparse` and `@types/papaparse` to package.json
- Show per-row validation status in preview table
- Add error count display before confirm

**`components/journal/analytics-dashboard.tsx`:**
- Remove behavioral insights import
- Remove playbook manager import
- Add error boundary wrapper around each chart section
- Add null checks before `.slice()` operations on data arrays
- Show "Not enough data" message when analytics returns null metrics

**`components/journal/journal-summary-stats.tsx`:**
- No draft references
- Show: Total Trades, Win Rate, Total P&L, Profit Factor
- Handle null/undefined gracefully with "—" display

---

### Phase 6: Server Actions & Backend Cleanup

**`app/actions/journal.ts`:**
- Simplify to: `createEntry`, `updateEntry`, `deleteEntry`
- Remove all draft-related actions
- Each action validates with Zod, sanitizes inputs, calls Supabase

**Backend Express routes** (`backend/src/routes/journal.ts`):
- If the Next.js API routes handle everything, remove the Express journal routes entirely
- If Express routes are still needed for background jobs, keep only the minimal set and remove all draft/auto-populate references

**Backend schemas** (`backend/src/schemas/journal.ts`, `backend/src/schemas/journalValidation.ts`):
- Align with the Zod schemas in `lib/validation/journal-entry.ts`
- Remove all draft-related types and validations

---

### Phase 7: E2E Tests

Rewrite E2E tests in `e2e/specs/members/`:

**`e2e/specs/members/journal.spec.ts`** — Core tests:
```typescript
test('redirects unauthenticated users to login')
test('shows empty state when no entries exist')
test('creates entry via quick form')
test('creates entry via full form with all fields')
test('edits existing entry')
test('deletes entry with confirmation dialog')
test('cancel delete does not remove entry')
```

**`e2e/specs/members/journal-import.spec.ts`** — Import tests:
```typescript
test('imports CSV file successfully')
test('shows preview before confirming import')
test('detects and reports duplicates on re-import')
test('handles malformed CSV gracefully')
```

**`e2e/specs/members/journal-filters.spec.ts`** — Filter tests:
```typescript
test('filters by date range')
test('filters by symbol')
test('filters by direction')
test('filters by win/loss')
test('sorts by P&L ascending and descending')
test('clear all resets filters')
```

Remove `journal-resilience.spec.ts` (rewrite offline tests to match simplified offline behavior).

---

### Phase 8: Documentation Update

Update `docs/trade-journal/TRADE_JOURNAL_IMPLEMENTATION_STATUS.md`:
- Mark V1 as deprecated
- Reference the V2 spec
- List what was removed and why
- Mark all V2 items as complete

Update any README references to the journal feature.

---

### Phase 9: Final Verification

Run these commands and fix any failures:

```bash
# Type checking
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Unit tests
npm test

# E2E tests (if Playwright is configured)
npx playwright test e2e/specs/members/journal*.spec.ts
```

Verify:
- Zero TypeScript errors
- Zero lint errors
- Build succeeds
- All tests pass
- No references to deleted files remain (search for: `draft`, `auto-journal`, `autoPopulate`, `pushNotification`, `behavioralInsight`, `patternAnalyzer`, `ai-coach-bridge`, `session-context`, `trade-replay`, `playbook`)

---

## Key Constraints

1. **No new dependencies** except `papaparse` and `@types/papaparse`
2. **No draft/auto-journal code** — if you see it, delete it
3. **All string inputs must be HTML-escaped** before database storage
4. **All divisions must be guarded** against zero/Infinity
5. **`is_winner` is a generated column** — never write to it directly
6. **CSV parsing uses PapaParse** — never `line.split(',')`
7. **Delete confirmation uses a custom modal** — never `window.confirm()`
8. **Offline mode is read-only** — no offline mutation queue
9. **All DB trigger functions use `SET search_path = ''`**
10. **Screenshot paths must reject `..` sequences**
