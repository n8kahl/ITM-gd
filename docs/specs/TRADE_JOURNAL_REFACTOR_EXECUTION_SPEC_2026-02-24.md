# Trade Journal Refactor — Master Execution Spec

> **Status:** Approved for Autonomous Execution
> **Date:** 2026-02-24
> **Governing Proposal:** `docs/trade-journal/TRADE_JOURNAL_CRITIQUE_AND_REFACTOR_PROPOSAL_2026-02-24.md`
> **Foundation Spec:** `docs/specs/TRADE_JOURNAL_V2_SPEC.md`
> **Orchestration System:** `scripts/journal-refactor/orchestrate.ts`
> **Branch:** `claude/trade-journal-refactor-prep-qNfAS`

---

## 1. Objective

Add three intelligence layers to the existing Journal V2 foundation without breaking current functionality:

1. **Layer 1 — Smart Capture:** Auto-draft on position close, enhanced screenshot extraction, psychology prompt timing
2. **Layer 2 — Behavioral Analytics:** Bias detection (5 cognitive biases), regime-aware performance, setup-type performance
3. **Layer 3 — Workflow Integration:** Pre-trade context widget, active-trade nudges, post-trade auto-review, dual journal resolution

## 2. Constraints

- **Foundation Preserved:** The V2 schema, validation, import pipeline, and offline storage remain untouched unless explicitly enhanced
- **Additive Only:** All schema changes are nullable column additions or new tables — no breaking migrations
- **No Regressions:** All existing E2E tests must pass after every phase
- **Dark Mode Only:** All new UI follows the Emerald Standard (CLAUDE.md Section 2)
- **TypeScript Strict:** Zero `any` types in new code
- **No Over-Engineering:** Each phase delivers a shippable increment

## 3. In-Scope / Out-of-Scope

### In-Scope
- Delete duplicate AI Coach journal components
- Add `setup_type` column and regime tag structure
- Build bias detection, regime tagging, context builder services
- Build journal slide-over, bias cards, regime breakdown, setup performance components
- Build pre-trade context API and widget
- Wire auto-draft to SPX CC position lifecycle
- Enhance AI grading with journal history context
- Full E2E test coverage for new features

### Out-of-Scope
- Broker API auto-sync (deferred to future)
- Real-time position monitoring via external APIs
- Push notifications / PWA install prompts
- Multi-leg position journal entries
- Journal versioning / audit log

## 4. Phase Plan

### Phase 1: Foundation Cleanup (Slices 1A–1D)

| Slice | Objective | Target Files | Agent |
|-------|-----------|-------------|-------|
| 1A | Delete AI Coach duplicate journal | `components/ai-coach/trade-journal.tsx`, `components/ai-coach/journal-insights.tsx` | Frontend |
| 1B | Remove AI Coach journal API client functions | `lib/api/ai-coach.ts` | Frontend |
| 1C | Schema migration: add `setup_type`, `is_draft`, regime documentation | `supabase/migrations/` | Database |
| 1D | Create journal slide-over component | `components/journal/journal-slide-over.tsx` | Frontend |

**Phase 1 Gate:**
```bash
pnpm exec tsc --noEmit                    # Zero errors
pnpm exec eslint components/journal/ components/ai-coach/ lib/api/ --max-warnings=0
pnpm vitest run lib/journal/__tests__      # All pass
pnpm vitest run lib/validation/__tests__   # All pass
# Verify: zero imports of deleted files
```

**Phase 1 Spec Compliance Checks:**
- [ ] `components/ai-coach/trade-journal.tsx` deleted
- [ ] `components/ai-coach/journal-insights.tsx` deleted (if only used by above)
- [ ] `getTrades()`, `createTrade()`, `deleteTrade()`, `getTradeAnalytics()` removed from `lib/api/ai-coach.ts`
- [ ] `analyzeScreenshot()` preserved in `lib/api/ai-coach.ts`
- [ ] `setup_type` column added as nullable TEXT with index on `(user_id, setup_type)`
- [ ] `is_draft`, `draft_status`, `draft_expires_at` columns exist (from guardrails migration)
- [ ] Journal slide-over component created, reusing `JournalTableView`/`JournalCardView`
- [ ] All existing E2E tests pass

### Phase 2: Smart Capture (Slices 2A–2E)

| Slice | Objective | Target Files | Agent |
|-------|-----------|-------------|-------|
| 2A | Auto-draft creation service | `backend/src/services/journal/autoDraftCreator.ts` | Backend |
| 2B | Draft notification component | `components/journal/draft-notification.tsx` | Frontend |
| 2C | Psychology prompt timing | `components/journal/psychology-prompt.tsx` | Frontend |
| 2D | Enhanced screenshot extraction | `app/api/members/journal/screenshot-url/route.ts`, `components/journal/screenshot-quick-add.tsx` | Frontend |
| 2E | Market context pre-fill from engine state | `backend/src/services/journal/contextBuilder.ts` | Backend |

**Phase 2 Gate:**
```bash
pnpm exec tsc --noEmit
pnpm exec eslint components/journal/ backend/src/services/journal/ --max-warnings=0
pnpm vitest run lib/journal/__tests__
pnpm vitest run backend/src/services/journal/__tests__   # New tests
pnpm exec playwright test e2e/specs/members/journal*.spec.ts --project=chromium --workers=1
```

**Phase 2 Spec Compliance Checks:**
- [ ] Auto-draft creates `is_draft: true` entries with pre-filled fields (symbol, direction, contract_type, prices, P&L, hold_duration)
- [ ] Auto-draft pre-fills market_context with VWAP, ATR, regime, GEX state
- [ ] Auto-draft pre-fills setup_type from setup detector when originating from SPX CC
- [ ] Draft notification shows toast: "Trade closed: {symbol}. Tap to complete your journal entry."
- [ ] Psychology prompt appears within 5-minute window after draft creation
- [ ] Psychology prompt has mood selector + single text field
- [ ] Enhanced screenshot extracts P&L, position_size, Greeks (not just symbol/direction)
- [ ] Market context pre-fill pulls from current engine state at time of entry/exit
- [ ] Only SPX CC-originated trades trigger auto-draft (not all trades)
- [ ] All existing E2E tests pass

### Phase 3: Behavioral Analytics (Slices 3A–3E)

| Slice | Objective | Target Files | Agent |
|-------|-----------|-------------|-------|
| 3A | Bias detector service (5 biases) | `backend/src/services/journal/biasDetector.ts` | Backend |
| 3B | Regime tagging service | `backend/src/services/journal/regimeTagging.ts` | Backend |
| 3C | Analytics endpoint enhancement | `app/api/members/journal/analytics/route.ts` | Backend |
| 3D | Bias insights card + regime breakdown components | `components/journal/bias-insights-card.tsx`, `components/journal/regime-breakdown.tsx` | Frontend |
| 3E | Setup performance breakdown + coaching insights | `components/journal/setup-performance.tsx`, analytics-dashboard enhancement | Frontend |

**Phase 3 Gate:**
```bash
pnpm exec tsc --noEmit
pnpm exec eslint backend/src/services/journal/ components/journal/ app/api/members/journal/ --max-warnings=0
pnpm vitest run backend/src/services/journal/__tests__
pnpm vitest run lib/journal/__tests__
pnpm exec playwright test e2e/specs/members/journal*.spec.ts --project=chromium --workers=1
```

**Phase 3 Spec Compliance Checks:**
- [ ] Bias detector analyzes: overconfidence, revenge trading, anchoring, disposition effect, recency bias
- [ ] Bias detection requires minimum 20 trades before surfacing scores
- [ ] Bias scores include confidence intervals
- [ ] Regime tagging classifies: VIX bucket (<15, 15-20, 20-30, 30+), trend state, GEX regime, time-of-day bucket
- [ ] Analytics endpoint returns regime-based breakdowns
- [ ] Analytics endpoint returns setup-type performance breakdown
- [ ] Bias insights card displays per-bias scores with evidence
- [ ] Regime breakdown shows performance by regime category
- [ ] Setup performance shows per-setup-type win rate, R:R, trade count
- [ ] "Coaching Insights" section surfaces actionable patterns
- [ ] All zero-division guards maintained in analytics
- [ ] All existing E2E tests pass

### Phase 4: Workflow Integration (Slices 4A–4E)

| Slice | Objective | Target Files | Agent |
|-------|-----------|-------------|-------|
| 4A | Pre-trade context API endpoint | `app/api/members/journal/context/route.ts` | Backend |
| 4B | Pre-trade context widget for SPX CC | `components/journal/pre-trade-context.tsx` | Frontend |
| 4C | AI Coach analyze_position journal history enhancement | `backend/src/chatkit/functionHandlers.ts` | Backend |
| 4D | AI grading with journal history context | `app/api/members/journal/grade/route.ts` | Backend |
| 4E | Chart overlay for journal entry markers | `components/journal/chart-entry-overlay.tsx` | Frontend |

**Phase 4 Gate:**
```bash
pnpm exec tsc --noEmit
pnpm exec eslint . --max-warnings=0
pnpm vitest run
pnpm exec playwright test e2e/specs/members/journal*.spec.ts --project=chromium --workers=1
```

**Phase 4 Spec Compliance Checks:**
- [ ] `GET /api/members/journal/context?setupType=...&symbol=...` returns compact context object
- [ ] Context includes: last 5 trades of setup type (win rate, avg P&L), last 5 trades of symbol, streak status, best time-of-day
- [ ] Pre-trade context widget renders in SPX CC setup cards
- [ ] Context widget lazy-loads (does not slow SPX CC rendering)
- [ ] Journal stats cached per symbol/setup (refreshed on new entry)
- [ ] AI Coach analyze_position includes journal history for active symbol/setup
- [ ] AI grading receives user's recent history for setup type (not just current trade)
- [ ] Chart overlay plots entry/exit points with P&L color coding
- [ ] All existing E2E tests pass

### Phase 5: Polish & Verify (Slices 5A–5D)

| Slice | Objective | Target Files | Agent |
|-------|-----------|-------------|-------|
| 5A | E2E tests for new features | `e2e/specs/members/journal-smart-capture.spec.ts`, `e2e/specs/members/journal-analytics-v2.spec.ts` | QA |
| 5B | Mobile responsive testing | All new components | QA |
| 5C | Performance audit (analytics with large datasets) | Analytics endpoint, bias detector | QA |
| 5D | Documentation sync | Execution spec, release notes, runbook | Docs |

**Phase 5 Gate (Release Gate):**
```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run
pnpm exec playwright test e2e/specs/members/journal*.spec.ts --project=chromium --workers=1
```

**Phase 5 Spec Compliance Checks:**
- [ ] Auto-draft -> prompt -> complete -> grade -> coaching flow works end-to-end
- [ ] Analytics accuracy verified with sample data
- [ ] All new components responsive on mobile viewports
- [ ] Analytics queries perform within 500ms p95 for 1000+ entries
- [ ] Bias detector returns within 1s for 500 trade histories
- [ ] Zero critical axe-core violations in new UI
- [ ] Release notes current
- [ ] Runbook current
- [ ] Change control log current

## 5. Acceptance Criteria

1. All five phases complete with green gates
2. Zero regressions in existing journal E2E tests
3. All spec compliance checks marked complete
4. `pnpm run build` succeeds
5. `pnpm exec tsc --noEmit` zero errors
6. `pnpm exec eslint .` zero warnings in touched files
7. Documentation packet complete (spec, release notes, runbook, change control, risk register, tracker)

## 6. Rollback Plan

Each phase is independently deployable. Rollback by reverting the phase's commits:
- Phase 1: Re-add deleted AI Coach journal files (git revert)
- Phase 2: Remove auto-draft service + components (no schema impact, columns are nullable)
- Phase 3: Remove analytics enhancements (existing analytics untouched)
- Phase 4: Remove workflow integration components + endpoints
- Phase 5: N/A (tests and docs only)

## 7. Risk Register Reference

See `docs/specs/journal-refactor-autonomous-2026-02-24/07_RISK_REGISTER_AND_DECISION_LOG.md`
