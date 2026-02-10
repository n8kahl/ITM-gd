# TITM Single-Leg Options Implementation (Production)

## Scope Decision
TITM strategy support is now constrained to single-leg instruments:
- `call`
- `put`
- `stock`

Explicitly excluded:
- Spreads (call/put verticals, credit/debit spreads)
- Iron condors
- Spread-conversion flows from position management

## Audit Findings and Applied Fixes

### 1. Position Contract Drift (multi-leg types still accepted)
Issue:
- API/input contracts still accepted spread and condor position types.

Fix:
- Narrowed position type enums and TypeScript types to `call | put | stock` across backend and frontend.
- Removed `strike2` from position input contracts.

### 2. Exit Advice Drift (spread conversion and roll suggestions)
Issue:
- Exit advisor suggested converting winners into spreads and rolling.

Fix:
- Removed `spread_conversion` and `roll` advice types from live day-trade position advice.
- Replaced with single-leg compatible advice:
  - take-profit trimming
  - stop-loss reassessment
  - theta-decay risk reduction
  - stop tightening on profitable option positions

### 3. Risk Model Bug (stock max loss/max gain)
Issue:
- Stock max loss used `strike` instead of entry-cost basis and did not handle short-stock asymmetry.

Fix:
- Long stock: `maxGain = unlimited`, `maxLoss = entryPrice * shares`
- Short stock: `maxGain = entryPrice * shares`, `maxLoss = unlimited`

### 4. Gap Fill Target Direction Bug
Issue:
- Half-fill target advanced in the wrong direction for continuation to full fill.

Fix:
- Corrected 50% stage target to project toward 75% fill progression.

### 5. Levels Completeness / Side Assignment
Issue:
- Level engine omitted or misclassified important levels (e.g., PMH only when below price, no PML output, VWAP only as support).

Fix:
- Added side-aware routing for all key levels based on signed distance from current price.
- Added both `PMH` and `PML` when premarket data exists.
- Added both `PWH` and `PWL` when available.
- Included VWAP on the correct side dynamically.

### 6. Holiday Calendar Accuracy
Issue:
- Incorrect early-close vs closed flags for observed holidays (notably 2026/2027).

Fix:
- Corrected observed-holiday entries:
  - 2026-07-03 set to `closed`
  - 2027-07-05 set to `closed`
  - 2027-12-24 set to `closed`
  - 2028-01-03 added as observed New Year holiday
- Improved regular close time formatting output.

## Production Code Areas Updated

Backend:
- `backend/src/services/options/types.ts`
- `backend/src/schemas/optionsValidation.ts`
- `backend/src/routes/options.ts`
- `backend/src/services/options/positionAnalyzer.ts`
- `backend/src/services/positions/exitAdvisor.ts`
- `backend/src/services/setupDetector/gapFill.ts`
- `backend/src/services/levels/index.ts`
- `backend/src/services/marketHours.ts`
- `backend/src/services/screenshot/analyzer.ts`
- `backend/src/chatkit/functions.ts`
- `backend/src/services/scanner/optionsScanner.ts`
- `backend/src/services/scanner/index.ts`
- `backend/src/services/earnings/index.ts`
- `backend/src/schemas/journalValidation.ts`
- `backend/src/routes/journal.ts`

Frontend/shared:
- `lib/api/ai-coach.ts`
- `components/ai-coach/position-form.tsx`
- `components/ai-coach/position-tracker.tsx`
- `components/ai-coach/widget-cards.tsx`
- `components/ai-coach/trade-journal.tsx`
- `lib/types/journal.ts`
- `lib/journal/sanitize-entry.ts`
- `lib/journal/offline-storage.ts`
- `components/journal/trade-entry-types.ts`
- `components/journal/full-entry-form.tsx`
- `components/journal/journal-filter-bar.tsx`

Tests:
- `backend/src/services/options/__tests__/positionAnalyzer.test.ts`
- `backend/src/services/positions/__tests__/exitAdvisor.test.ts`
- `backend/src/services/scanner/__tests__/scanner.test.ts`
- `backend/src/services/earnings/__tests__/index.test.ts`
- `backend/src/chatkit/__tests__/functionHandlers.test.ts`
- `backend/src/schemas/__tests__/validation.test.ts`

## Remaining Hardening Items
- Add dedicated tests for side-aware level placement (`PMH/PML`, `VWAP`, `PWH/PWL`) in levels service.
- Add explicit unit tests for corrected observed holiday dates (2026-07-03, 2027-07-05, 2027-12-24, 2028-01-03).
- Add detector tests asserting corrected gap-fill half-stage target math.
