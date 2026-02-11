# AI Coach Widget Card UX Audit (2026-02-11)

## Scope
Comprehensive UX audit of all AI Coach inline widget cards and shared action primitives.

### Audited files
- `components/ai-coach/widget-cards.tsx`
- `components/ai-coach/widget-action-bar.tsx`
- `components/ai-coach/widget-context-menu.tsx`
- `components/ai-coach/opportunity-scanner.tsx`
- `components/ai-coach/chat-message.tsx`

## Method
- Code-path audit of all 17 card renderers and `extractWidgets(...)` mappings.
- Interaction model audit (click targets, action bars, context menu discoverability).
- Accessibility/readability audit (keyboard affordance, text sizing density).
- Action consistency audit (chart/options/alerts behavior coherence).

## Already Improved In This Iteration
- Scan Results rows now open chart with setup overlays (entry/stop/target/spot).
- Opportunity Scanner cards now open chart with setup overlays on card click.
- Key Levels card now opens chart with full level set on card click.

## Key Findings

### P0 - Fix before production polish

1. Inconsistent primary interaction model across cards.
- Root cause: some cards are now card-clickable, most remain action-row-only.
- Impact: users cannot predict what clicking a card does.
- Evidence:
  - Clickable pattern present: `components/ai-coach/widget-cards.tsx:363`, `components/ai-coach/widget-cards.tsx:1301`, `components/ai-coach/opportunity-scanner.tsx:607`
  - Non-clickable pattern on most cards: e.g. `components/ai-coach/widget-cards.tsx:446`, `components/ai-coach/widget-cards.tsx:529`, `components/ai-coach/widget-cards.tsx:719`
- Recommendation:
  - Standardize card-level click intent: "Open center view with highest-value context" for every card.
  - Keep action bar for secondary actions.

2. Silent data coercion to `0` creates misleading UI states.
- Root cause: `parseNumeric(...)` returns `0` for invalid values instead of null.
- Impact: cards can display `$0.00` for missing/invalid upstream data, which looks real.
- Evidence: `components/ai-coach/widget-cards.tsx:67`
- Recommendation:
  - Move card display to null-safe formatter path by default.
  - Reserve zero display only for explicit numeric zero.

3. Context menu is powerful but low-discoverability.
- Root cause: right-click-only affordance with no visible hint per card.
- Impact: many users never discover advanced actions.
- Evidence: `components/ai-coach/widget-context-menu.tsx:19`
- Recommendation:
  - Add a visible overflow/menu affordance in card header (three-dots) that opens same menu.
  - Keep right-click support as secondary path.

### P1 - High-impact UX upgrades

4. Readability is too dense for rapid decision-making.
- Root cause: heavy use of `text-[10px]` / `text-[11px]` and compact spacing across cards.
- Impact: scan speed drops under load; mobile readability suffers.
- Evidence: repeated tiny text classes across all cards (examples: `components/ai-coach/widget-cards.tsx:431`, `components/ai-coach/widget-cards.tsx:895`, `components/ai-coach/widget-cards.tsx:1459`)
- Recommendation:
  - Raise body minimum to 12px equivalent for primary data lines.
  - Keep 10px only for tertiary metadata.

5. Action bar label hiding in compact mode reduces clarity.
- Root cause: compact mode hides labels for many secondary actions.
- Impact: icon-only actions are ambiguous under stress.
- Evidence: `components/ai-coach/widget-action-bar.tsx:45-70`
- Recommendation:
  - Keep labels visible for top 2 actions at all breakpoints.
  - Move overflow actions to a "More" control.

6. No explicit action feedback after route-changing actions.
- Root cause: actions dispatch events without UI confirmation.
- Impact: users may think click failed when panel transition is subtle.
- Recommendation:
  - Add short "Opened Chart/Options/Alerts" toast with symbol context.

7. Chart-context richness is still uneven across cards.
- Root cause: many cards call `chartAction(symbol, level)` without richer level bundles.
- Impact: chart opens but lacks immediate contextual overlays.
- Recommendation:
  - Introduce a shared `openChartWithContext(...)` helper used by every card type.

### P2 - Quality/consistency improvements

8. Card-level keyboard accessibility is inconsistent.
- Root cause: only select cards use `role="button"` + keyboard handlers.
- Impact: keyboard-only workflows are fragmented.
- Recommendation:
  - Add consistent keyboard semantics to all card-level primary interactions.

9. Visual hierarchy varies too much between cards.
- Root cause: mixed badge, spacing, and metadata placement patterns.
- Impact: users re-learn each card instead of building muscle memory.
- Recommendation:
  - Standardize card anatomy: Header (symbol/status), Core metric row, Context row, Action row.

10. `extractWidgets(...)` has no normalization layer for stale/incomplete payloads.
- Root cause: direct passthrough from tool results to card rendering.
- Impact: edge payloads degrade card quality.
- Evidence: `components/ai-coach/widget-cards.tsx:1738`
- Recommendation:
  - Add per-widget normalization guards (timestamps, nullable numbers, canonical labels).

## Card-by-Card Opportunity Map

1. `KeyLevelsCard`
- Status: improved (card click opens full-level chart).
- Next: add explicit subtitle "Click card to load all levels on chart" for discoverability.

2. `PositionSummaryCard`
- Opportunity: card click should open `position` view focused on this symbol/contract.

3. `PnLTrackerCard`
- Opportunity: add top-2 risk contributors with one-click drilldown to positions.

4. `MarketOverviewCard`
- Opportunity: card click opens `brief` or `macro` based on session state.

5. `AlertStatusCard`
- Opportunity: clicking an alert row should open alert detail prefilled edit state.

6. `CurrentPriceCard`
- Opportunity: card click opens chart + auto-add spot line + quick alert CTA.

7. `MacroContextCard`
- Opportunity: event rows should optionally route to chart with event marker timestamp.

8. `OptionsChainCard`
- Opportunity: call/put rows should open options panel with strike preselected.

9. `GEXProfileCard`
- Opportunity: card click opens chart with complete GEX regime overlays by default.

10. `SPXGamePlanCard`
- Opportunity: card click opens chart + all resistance/support + flip/max-gex overlays.

11. `ScanResultsCard`
- Status: improved (row click opens setup chart overlays).
- Next: support all rows (not only top 3) via expandable list.

12. `ZeroDTEAnalysisCard`
- Opportunity: add risk-state banner (safe/caution/extended) as first visual element.

13. `IVAnalysisCard`
- Opportunity: card click opens options view with term-structure section anchored.

14. `EarningsCalendarCard`
- Opportunity: quick filter chips (today/this week/high IV) for scan speed.

15. `EarningsAnalysisCard`
- Opportunity: strategy cards should expose one-click "track this idea" flow.

16. `JournalInsightsCard`
- Opportunity: add one-click "create checklist" artifact into journal workflow.

17. `TradeHistoryCard`
- Opportunity: row click opens journal entry detail with matching date/symbol filter.

## Execution Plan (Recommended)

### Phase 1 (1-2 days)
- Standardize card-click primary action across all 17 cards.
- Add visible menu affordance (not right-click only).
- Fix numeric null/zero display semantics.

### Phase 2 (2-3 days)
- Introduce shared chart-context helper and migrate all chart actions.
- Add lightweight action feedback toasts.
- Raise typography floor for primary lines.

### Phase 3 (2 days)
- Normalize widget payloads in `extractWidgets(...)`.
- Add e2e matrix for all card primary actions and keyboard activation.

## QA Acceptance Criteria
- Every card has a documented primary click behavior.
- Every card has keyboard-accessible primary action.
- Chart-opening cards show relevant overlays by default.
- No misleading `$0.00` for missing numeric values.
- E2E coverage validates at least one primary click path per card type.
