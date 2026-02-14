# Massive.com Enhancements Remediation Spec
**Version:** 1.0  
**Date:** 2026-02-14  
**Status:** Ready for Autonomous Implementation  
**Scope:** Resolve all gaps identified in the latest 5-commit audit, with emphasis on Massive.com integration correctness, real-timeness, testability, and documentation parity.

---

## 1) Executive Summary

The current Massive.com enhancements are **partially integrated** but not yet production-complete.  
Core gaps are:

1. "Live" indices are sourced from previous-session aggregates (`/prev`) instead of true live data.
2. Market status/session contracts are inconsistent between backend and frontend.
3. Stock splits integration is speculative and silently degrades.
4. Placeholder/stub logic remains in market constants and options IV rank.
5. Frontend test coverage for new widgets is effectively missing (and one placeholder test is committed).
6. AI-coach docs tracking files are stale relative to implemented behavior.
7. Fibonacci chart integration remains a documented open item and needs closure/verification against spec.

This document defines the implementation plan, file-level changes, tests, rollout gates, and documentation updates to close all items.

---

## 2) Source of Truth

Primary docs this remediation must align with:

- `/Users/natekahl/ITM-gd/docs/ai-coach/AI_COACH_V2_REBUILD_SPEC.md`
- `/Users/natekahl/ITM-gd/docs/ai-coach/AI_COACH_PROFESSIONAL_ENHANCEMENT_SPEC.md`
- `/Users/natekahl/ITM-gd/docs/ai-coach/CODEX_PROMPT_UX_POLISH.md`
- `/Users/natekahl/ITM-gd/docs/ai-coach/PUNCH_LIST.md`
- `/Users/natekahl/ITM-gd/docs/ai-coach/ENHANCEMENT_GAP_ANALYSIS.md`

---

## 3) Remediation Goals

### Functional Goals

- Use true live Massive.com price sources for dashboard indices and AI prompt context.
- Establish a canonical market status contract with consistent UI mapping for pre-market/regular/after-hours/closed.
- Eliminate silent failure paths for critical market widgets (splits, indices, status).
- Remove placeholder/stubbed financial inputs where they affect user-visible analysis.
- Close remaining Fibonacci chart integration requirements from AI Coach spec docs.

### Quality Goals

- Add/restore reliable test coverage for backend + frontend integration points.
- Keep backward compatibility for existing API consumers where possible.
- Update repository docs so implementation status and instructions are accurate.

---

## 4) Non-Goals

- No full redesign of AI Coach layout.
- No replacement of Massive.com as primary market data source.
- No broad refactor of unrelated dashboard/journal/academy features.

---

## 5) Workstreams and Required Changes

## WS1: True Live Index Snapshot (Massive Integration Correctness)

### Problem
`marketIndices` currently uses `/v2/aggs/ticker/I:SPX/prev` and `/I:NDX/prev`, which are prior-session values and not live.

### Files

- `/Users/natekahl/ITM-gd/backend/src/services/marketIndices.ts`
- `/Users/natekahl/ITM-gd/backend/src/services/realTimePrice.ts`
- `/Users/natekahl/ITM-gd/backend/src/routes/market.ts`
- `/Users/natekahl/ITM-gd/hooks/useMarketData.ts`
- `/Users/natekahl/ITM-gd/components/dashboard/live-market-ticker.tsx`
- `/Users/natekahl/ITM-gd/backend/src/chatkit/promptContext.ts`

### Implementation

1. Refactor `getMarketIndicesSnapshot()` to:
   - Pull live last-trade/last-quote via `getRealTimePrice('I:SPX')`, `getRealTimePrice('I:NDX')`.
   - Pull previous close via Massive `/prev` only for baseline comparison.
   - Compute change and changePercent as `livePrice - prevClose`.
2. Add freshness metadata to response:
   - `asOf`, `isRealtime`, `staleMs`, `source`.
3. Preserve current fields (`quotes`, `metrics`) for backward compatibility.
4. Update `promptContext` to consume live fields for SPX/NDX context.
5. Update ticker UI to display stale state when freshness threshold exceeded.

### Acceptance Criteria

- During market hours, indices refresh ≤ 5s behind latest cached fetch.
- `source` and `asOf` visible in API response.
- No UI component labels stale data as "live" when freshness gate fails.

---

## WS2: Canonical Market Status Contract (Frontend/Backend Alignment)

### Problem
Backend and frontend disagree on `status` and `session` semantics, causing incorrect labels/colors.

### Files

- `/Users/natekahl/ITM-gd/backend/src/services/marketHours.ts`
- `/Users/natekahl/ITM-gd/backend/src/routes/market.ts`
- `/Users/natekahl/ITM-gd/hooks/useMarketData.ts`
- `/Users/natekahl/ITM-gd/components/dashboard/market-status-badge.tsx`
- `/Users/natekahl/ITM-gd/components/dashboard/live-market-ticker.tsx`

### Implementation

1. Define canonical DTO returned by `/api/market/status`:
   - `status`: `open | pre-market | after-hours | closed | early-close`
   - `session`: `regular | extended | weekend | holiday | none`
   - `message`, `nextOpen`, `closingTime`, `timeSinceOpen`, `timeUntilOpen`
2. Normalize early-close representation (no ambiguous hybrid states).
3. Update hook types to exact backend contract.
4. Update UI label/color mapping to use canonical `status` first, then `session`.

### Acceptance Criteria

- Pre-market and after-hours render correctly in both widgets.
- No default-to-open behavior for unknown sessions.
- Contract tests protect mapping and status transitions.

---

## WS3: Stock Splits Endpoint Hardening (No Silent Degradation)

### Problem
Endpoint assumptions are documented inline and failures collapse to `[]`, hiding integration breakage.

### Files

- `/Users/natekahl/ITM-gd/backend/src/services/stockSplits.ts`
- `/Users/natekahl/ITM-gd/backend/src/routes/market.ts`
- `/Users/natekahl/ITM-gd/hooks/useMarketData.ts`
- `/Users/natekahl/ITM-gd/components/dashboard/stock-splits-calendar.tsx`

### Implementation

1. Add response schema validation for Massive splits payload.
2. Promote transport/schema failures to explicit API degradation response:
   - Return `502` with typed error body on upstream failure (do not silently return empty data).
3. In frontend hook/component, show explicit error state with retry affordance.
4. Keep empty list only for genuine "no upcoming splits" from valid payload.

### Acceptance Criteria

- Upstream failure is visible in logs + API response + UI error state.
- Empty list only used for validated successful zero-result responses.

---

## WS4: Remove Placeholder Financial Inputs (Stub Removal)

### Problem
Placeholders remain in market constants and options IV rank computation.

### Files

- `/Users/natekahl/ITM-gd/backend/src/services/marketConstants.ts`
- `/Users/natekahl/ITM-gd/backend/src/services/options/optionsChainFetcher.ts`
- `/Users/natekahl/ITM-gd/docs/MARKET_DATA_SERVICES.md`

### Implementation

1. Replace placeholder-only refresh flow in `marketConstants`:
   - Implement actual refresh for dividend yields and risk-free rate from configured provider path.
   - Keep fallback values only as controlled, observable fallback with reason code.
2. Remove "For now ... placeholder" IV rank behavior:
   - Either compute true IV Rank from maintained historical ATM IV series, or
   - If unavailable, return `ivRank: null` plus `ivRankAvailable: false` and never fake it.
3. Add structured logging for fallback paths (`provider_unavailable`, `schema_error`, `cache_miss_bootstrap`).

### Acceptance Criteria

- No TODO/placeholder markers remain in production paths for these functions.
- `ivRank` semantics are truthful: real metric or null/unavailable, never proxy-labeled as rank.

---

## WS5: Testing Infrastructure and Coverage Completion

### Problem
Frontend widget tests are not discovered by Vitest include rules, and one placeholder assertion exists.

### Files

- `/Users/natekahl/ITM-gd/vitest.config.ts`
- `/Users/natekahl/ITM-gd/components/dashboard/__tests__/market-status-badge.test.tsx`
- `/Users/natekahl/ITM-gd/backend/src/services/__tests__/realTimePrice.test.ts`
- `/Users/natekahl/ITM-gd/backend/src/services/__tests__/stockSplits.test.ts`
- `/Users/natekahl/ITM-gd/backend/src/routes/__tests__/` (new market route tests)

### Implementation

1. Split Vitest into explicit backend + frontend projects (or equivalent include/env strategy):
   - Backend tests in `node` environment.
   - Frontend component tests in `jsdom`.
2. Replace placeholder badge test with real render assertions:
   - pre-market/regular/after-hours/closed/early-close labels
   - loading state
3. Add integration tests for `/api/market/indices`, `/status`, `/splits`, `/analytics`.
4. Add regression tests for stale/live flag behavior.

### Acceptance Criteria

- Frontend dashboard tests are executed in CI.
- All new market endpoints have route-level tests.
- No placeholder assertion tests remain.

---

## WS6: Documentation Parity and Repo-Wide Updates

### Problem
Tracking docs are out of date versus actual implementation status.

### Files to Update

- `/Users/natekahl/ITM-gd/docs/ai-coach/PUNCH_LIST.md`
- `/Users/natekahl/ITM-gd/docs/ai-coach/ENHANCEMENT_GAP_ANALYSIS.md`
- `/Users/natekahl/ITM-gd/docs/MARKET_DATA_SERVICES.md`
- `/Users/natekahl/ITM-gd/README.md`

### Implementation

1. Update AI Coach punch/gap docs to reflect completed items and remaining work accurately.
2. Document canonical `/api/market/*` contracts, fallback policy, and error behavior.
3. Document test commands for backend + frontend suites separately.

### Acceptance Criteria

- No stale "NOT STARTED" statuses for completed items.
- Docs describe actual runtime behavior and contracts.

---

## WS7: Fibonacci Chart Integration Closure (Spec Compliance)

### Problem
Professional enhancement docs still track Fibonacci chart integration as open.

### Files

- `/Users/natekahl/ITM-gd/components/ai-coach/trading-chart.tsx`
- `/Users/natekahl/ITM-gd/components/ai-coach/center-panel.tsx`
- `/Users/natekahl/ITM-gd/e2e/specs/ai-coach/` (existing/new assertions)
- `/Users/natekahl/ITM-gd/docs/ai-coach/PUNCH_LIST.md`
- `/Users/natekahl/ITM-gd/docs/ai-coach/ENHANCEMENT_GAP_ANALYSIS.md`

### Implementation

1. Ensure Fibonacci overlay is always rendered on chart when fib levels are available.
2. Verify fib line styling priority (38.2%/61.8% emphasis) and labels.
3. Add/refresh test coverage for fib display behavior.
4. Mark docs complete once validated.

### Acceptance Criteria

- Fib overlays visible and styled per spec.
- Corresponding docs updated from open to complete.

---

## 6) API Contract Targets

### `GET /api/market/indices` (target)

```json
{
  "quotes": [
    {
      "symbol": "SPX",
      "price": 5932.45,
      "change": 12.30,
      "changePercent": 0.21,
      "asOf": "2026-02-14T14:32:10.000Z",
      "isRealtime": true,
      "source": "last_trade"
    }
  ],
  "metrics": {
    "vwap": 5926.11
  },
  "source": "massive",
  "staleMs": 1200
}
```

### `GET /api/market/status` (target)

```json
{
  "status": "pre-market",
  "session": "extended",
  "message": "Pre-market session is active",
  "timeUntilOpen": "0h 47m"
}
```

### `GET /api/market/splits` error (target)

```json
{
  "error": "Upstream data unavailable",
  "code": "MASSIVE_SPLITS_UNAVAILABLE",
  "message": "Failed to fetch or validate splits payload."
}
```

---

## 7) Implementation Sequence (Autonomous)

1. **Contracts first**
   - Canonicalize market status + indices DTOs.
2. **Backend behavior**
   - Live index data source correction.
   - Splits hardening.
   - Placeholder removal in market constants/options inputs.
3. **Frontend wiring**
   - Hook type alignment + status label/color fixes.
   - Live/stale indicators and explicit error states.
4. **Testing**
   - Vitest project split.
   - Add route and component tests.
   - Run backend + frontend unit suites.
5. **Documentation**
   - Update punch/gap docs, market services docs, README.
6. **Final verification**
   - Confirm no placeholder/stub markers remain in affected production paths.

---

## 8) Definition of Done

- All WS1-WS7 acceptance criteria pass.
- Market widgets display correct live/stale and session states.
- No silent empty-data degradation for upstream failures.
- Frontend tests for new dashboard widgets run in CI.
- AI coach docs and implementation status documents are synchronized.

---

## 9) Validation Checklist

### Automated

- `pnpm test:unit` (backend + frontend projects both executed)
- Market route integration tests all pass
- Lint/typecheck pass for modified files

### Manual QA

1. Open member dashboard during market, pre-market, and after-hours windows.
2. Confirm status labels/colors match real session.
3. Confirm indices move with live updates and show stale indicator when applicable.
4. Force upstream split failure and confirm UI shows error (not empty normal state).
5. In AI Coach chart flow, confirm Fib overlays and emphasized levels render as specified.

---

## 10) Risks and Mitigations

- **Risk:** Massive endpoint shape drift.  
  **Mitigation:** schema validation + typed degradation responses.

- **Risk:** Increased request volume for live pricing.  
  **Mitigation:** short TTL cache + fanout from shared fetch path + optional websocket handoff.

- **Risk:** Breaking existing consumers with contract changes.  
  **Mitigation:** preserve existing fields while adding normalized fields; deprecate gradually.

---

## 11) Post-Remediation Documentation Updates (Required)

After code merge, update:

- `/Users/natekahl/ITM-gd/docs/ai-coach/PUNCH_LIST.md` (mark completed items)
- `/Users/natekahl/ITM-gd/docs/ai-coach/ENHANCEMENT_GAP_ANALYSIS.md` (recompute completion %)
- `/Users/natekahl/ITM-gd/docs/MARKET_DATA_SERVICES.md` (final contract + fallback behavior)
- `/Users/natekahl/ITM-gd/README.md` (test commands and market integration summary)

This spec is complete and suitable for autonomous implementation.

