# Swing Sniper Member Center Release Notes

**Workstream:** Swing Sniper Member Center
**Date:** 2026-03-09
**Status:** Updated through Slice 4.3
**Governing Spec:** `docs/specs/SWING_SNIPER_MEMBER_CENTER_EXECUTION_SPEC_2026-03-09.md`

---

## Current Release Summary

Swing Sniper introduces a new member-center decision tab focused on options mispricing, catalyst convergence, exact contract selection, monitoring, and adaptive confidence. Engineering is phased, but the intended shipped product is a full Swing Sniper experience for all members.

---

## Implemented Highlights

### Slice 1.1

- Added the new `/members/swing-sniper` route shell with Lead/Admin tab visibility gating
- Added fallback and seeded tab configuration for `swing-sniper`
- Added same-origin member health endpoint at `/api/members/swing-sniper/health`
- Added backend preflight endpoint at `/api/swing-sniper/health`
- Added browser-tested preflight states for healthy and failed dependency paths

### Slices 2.1-2.4 (Structure Lab)

- Added `backend/src/services/swingSniper/structureLab.ts` for strategy candidate generation across long premium, spreads, calendars, diagonals, and butterflies
- Added deterministic contract optimization and liquidity scoring using strike fit, spread quality, open interest, and volume
- Added scenario summaries, payoff diagrams, and probability-weighted distribution output per recommendation
- Added backend endpoint `POST /api/swing-sniper/structure/recommend` with same-origin proxy route `POST /api/members/swing-sniper/structure`
- Added dossier-level Structure Lab payload integration so recommendation cards ship with the existing dossier fetch
- Replaced Structure tab placeholders with live recommendation cards, contract legs, scenario context, and payoff/distribution visualization
- Expanded backend and E2E validation coverage for Structure Lab behavior

### Slices 3.1-3.3 (Risk Sentinel)

- Added `backend/src/services/swingSniper/riskSentinel.ts` for thesis health scoring and monitoring synthesis
- Added backend endpoint `GET /api/swing-sniper/monitoring` with same-origin proxy route `GET /api/members/swing-sniper/monitoring`
- Added saved-thesis drift monitoring using save-time IV rank vs current IV rank with status, health score, and exit bias
- Added portfolio exposure summary (open positions, portfolio PnL, risk level, net Greeks, symbol concentration)
- Added exit guidance and alert feed by combining thesis-health degradation with existing position advisor output
- Integrated Risk Sentinel UI into memo rail and dossier Risk tab
- Expanded backend and E2E validation coverage for monitoring behavior

### Slices 4.1-4.3 (Adaptive Learning and Backtesting)

- Added Supabase signal-snapshot archive table `swing_sniper_signal_snapshots` with RLS, indexes, and daily uniqueness per user+symbol
- Added snapshot persistence helpers and automatic archive writes from universe and dossier routes
- Added `backend/src/services/swingSniper/backtestService.ts` for offline replay over archived snapshots and daily closes
- Added backend endpoint `GET /api/swing-sniper/backtest/:symbol` with same-origin proxy route `GET /api/members/swing-sniper/backtest/:symbol`
- Added adaptive confidence reweighting output (confidence weight, adjusted score, rationale, caveats, resolved sample quality)
- Integrated adaptive confidence into Dossier Risk tab and Memo Rail
- Updated health capabilities to mark `backtesting` available when core data dependencies are healthy
- Restricted Swing Sniper tab visibility to Lead role holders and admin users

## Planned Highlights

### Core Product

- New `/members/swing-sniper` tab and route for all members
- Ranked opportunity board
- Symbol dossier with thesis, vol map, and catalyst timeline
- Daily Swing Sniper memo
- Saved thesis / watchlist support
- Structure Lab with exact contract and structure recommendations
- Contract-selection guidance and scenario summary
- Risk Sentinel for saved theses and positions
- Exit guidance and alerting

---

## Planned Risk Notes

- Benzinga-enriched data may be partially unavailable depending on Massive.com plan support.
- LLM summaries must remain fact-grounded and will degrade to rules-based copy if reasoning is unavailable.
- Swing Sniper recommendations are research guidance, not broker execution.

---

## Validation Evidence

- `pnpm exec tsc --noEmit` -> PASS
- `npm test --prefix backend -- --runInBand src/routes/__tests__/swing-sniper.route.test.ts src/services/swingSniper/__tests__/structureLab.test.ts src/services/swingSniper/__tests__/riskSentinel.test.ts src/services/swingSniper/__tests__/backtestService.test.ts` -> PASS
- `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/members/swing-sniper.spec.ts --project=chromium --workers=1` -> PASS
