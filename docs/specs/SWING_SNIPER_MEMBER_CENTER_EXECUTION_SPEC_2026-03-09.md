# Swing Sniper Member Center Execution Spec

**Workstream:** Swing Sniper Member Center
**Date:** 2026-03-09
**Status:** Draft - Scope updated after product direction
**Owner:** Orchestrator
**Branch:** `codex/swing-sniper-member-center`
**Mockup:** `docs/specs/mockups/swing-sniper-member-center-mockup.html`

---

## 0. Pre-Implementation Completeness Check

| Required Artifact (CLAUDE.md Section 6.3) | Path | Status |
|------------------------------------|------|--------|
| Master execution spec | `docs/specs/SWING_SNIPER_MEMBER_CENTER_EXECUTION_SPEC_2026-03-09.md` | Present |
| Phase 1 slice report | `docs/specs/SWING_SNIPER_MEMBER_CENTER_PHASE1_SLICE_REPORT_2026-03-09.md` | Present |
| Phase 2 slice report | `docs/specs/SWING_SNIPER_MEMBER_CENTER_PHASE2_SLICE_REPORT_2026-03-09.md` | Present |
| Phase 3 slice report | `docs/specs/SWING_SNIPER_MEMBER_CENTER_PHASE3_SLICE_REPORT_2026-03-09.md` | Present |
| Phase 4 slice report | `docs/specs/SWING_SNIPER_MEMBER_CENTER_PHASE4_SLICE_REPORT_2026-03-09.md` | Present |
| Release notes | `docs/specs/SWING_SNIPER_MEMBER_CENTER_RELEASE_NOTES_2026-03-09.md` | Present |
| Runbook | `docs/specs/SWING_SNIPER_MEMBER_CENTER_RUNBOOK_2026-03-09.md` | Present |
| Change control standard | `docs/specs/swing-sniper-member-center-autonomous-2026-03-09/06_CHANGE_CONTROL_AND_PR_STANDARD.md` | Present |
| Risk register + decision log | `docs/specs/swing-sniper-member-center-autonomous-2026-03-09/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md` | Present |
| Autonomous execution tracker | `docs/specs/swing-sniper-member-center-autonomous-2026-03-09/08_AUTONOMOUS_EXECUTION_TRACKER.md` | Present |

Implementation gate: documentation packet complete as of Monday, March 9, 2026. Product sign-off is still required before Slice 1.1.

---

## 1. Product Objective

Build a new member-center tab at `/members/swing-sniper` that turns TradeITM's existing Massive.com market-data stack into a structured options decision engine for all members. Swing Sniper should not behave like a generic scanner. It should rank where volatility appears mispriced, explain which catalysts matter, pick specific contracts and structures, monitor thesis health after entry, and show adaptive confidence from historical evidence.

Implementation remains phased for engineering control, but the product target is now a **full-scope Swing Sniper release**:

1. Opportunity discovery
2. Symbol dossier and catalyst intelligence
3. Exact contract and structure selection
4. Post-entry monitoring and Risk Sentinel
5. Adaptive learning and backtest-informed confidence

---

## 2. Repo-Aligned Thesis Translation

The original Swing Sniper concept assumes Massive.com, Benzinga event intelligence, Claude reasoning, Supabase Edge Functions, and Python quant workers. This repo already has usable building blocks, but not in that exact shape.

### 2.1 What already exists

| Capability | Existing Surface | Reuse Value |
|------------|------------------|-------------|
| Member tab system | `tab_configurations`, `app/api/config/tabs/route.ts`, `contexts/MemberAuthContext.tsx` | Clean insertion point for `/members/swing-sniper` |
| Options chain + expirations | `backend/src/routes/options.ts`, `backend/src/services/options/optionsChainFetcher.ts`, `lib/api/ai-coach.ts` | Strong base for contract data |
| IV analysis | `backend/src/services/options/ivAnalysis.ts`, `GET /api/options/:symbol/iv` | Existing IV rank, skew, term structure, forecast primitives |
| Earnings analysis | `backend/src/services/earnings/index.ts`, `GET /api/earnings/:symbol/analysis` | Existing event intelligence and expected-move baseline |
| Economic calendar | `backend/src/routes/economic.ts` | Existing macro catalyst input |
| News feed | `backend/src/config/massive.ts#getTickerNews` | Existing article feed for narrative extraction |
| Morning brief pattern | `backend/src/routes/brief.ts`, `backend/src/services/morningBrief/index.ts` | Existing synthesis pattern and persistence precedent |
| Position advice | `GET /api/options/live`, `GET /api/options/advice` | Existing foundation for Swing Sniper monitoring and exit guidance |

### 2.2 What does not exist yet

1. A universe-scale volatility mispricing scanner.
2. A unified per-symbol catalyst timeline that merges earnings, macro, and narrative shifts.
3. A structure and contract recommender tuned for swing options setups.
4. A portfolio-level Swing Sniper risk workspace.
5. A clean persistence model for saved Swing Sniper watchlists, theses, and signal snapshots.

### 2.3 Architectural correction vs original idea

1. **Reasoning layer:** the repo currently uses OpenAI-oriented infrastructure, not Claude API transport. Swing Sniper should therefore use a provider-agnostic `swingSniperReasoningService` interface so the UX and backend contracts do not care whether the LLM is OpenAI first or Claude later.
2. **Heavy quant:** Phase 1-3 should remain TypeScript-first inside the existing Express backend. Python workers are deferred until Phase 4 if backtest volume or SVI/SABR calibration proves too slow in Node.
3. **Realtime:** use current Next + Express + Supabase stack. Do not introduce Edge Functions as the primary Swing Sniper compute path unless a later slice proves they are needed for fan-out or schedule isolation.
4. **Data dependency:** Swing Sniper should rely on Massive.com-driven market and event intelligence. Brokerage integration is explicitly not required.

---

## 3. Route, Access, and Navigation Recommendation

### 3.1 New member tab

| Field | Recommended Value |
|-------|-------------------|
| `tab_id` | `swing-sniper` |
| Label | `Swing Sniper` |
| Icon | `Radar` |
| Path | `/members/swing-sniper` |
| Required tier | `core` |
| Badge | `New` / `champagne` |
| Mobile visible | `true` |
| Initial sort order | `5` |

### 3.2 Placement rationale

Recommended nav order:

1. Dashboard
2. Journal
3. SPX Command Center
4. AI Coach
5. Swing Sniper
6. Academy
7. Social
8. Studio
9. Profile

This positions Swing Sniper as an institutional research surface adjacent to AI Coach, not buried as an education or social feature.

### 3.3 Access policy

1. Swing Sniper is available to all authenticated members.
2. All Swing Sniper modules are in scope for launch; no feature-tier gating inside the tab.
3. Do not make Swing Sniper admin-only. It is a member product surface, not an internal tool.

---

## 4. Scope Recommendation

### 4.1 Locked launch scope: Full Swing Sniper release

The approved product target is a full Swing Sniper system released as one cohesive member-center tab after all engineering phases are complete.

Launch scope includes:

1. A ranked opportunity board that surfaces mispriced-volatility ideas.
2. A symbol dossier that explains the thesis in plain language.
3. A catalyst stack showing event timing, expected move context, and narrative shifts.
4. A structure engine that picks exact contracts, strikes, expirations, and preferred trade expression.
5. A monitoring layer that scores thesis health and risk after entry.
6. A backtest and confidence layer that explains why Swing Sniper trusts or distrusts a setup.
7. A research-memory layer so users can save ideas and revisit them.

Engineering still proceeds phase-by-phase, but those phases are execution milestones rather than separate public rollout boundaries.

### 4.2 Explicitly in scope

| Area | Included |
|------|----------|
| New member route and tab | Yes |
| Universe scanner | Yes, on a capped liquid-symbol universe |
| Opportunity ranking | Yes |
| Catalyst timeline | Yes |
| Narrative summary with LLM reasoning | Yes |
| Exact contract selection | Yes |
| Strategy and scenario engine | Yes |
| Saved watchlist / saved thesis | Yes |
| Risk Sentinel and monitoring | Yes |
| Backtesting and adaptive confidence | Yes |

### 4.3 Out of scope

| Area | Reason |
|------|--------|
| Broker execution or order routing | Product direction explicitly excludes brokerage integration |
| Auto-imported broker positions | Not required without brokerage integration |
| Full-universe 4,000+ ticker scan at launch | Unnecessary cost and performance risk |
| One-click trade UX | Not aligned with current members architecture |
| Mandatory Python worker migration in Phase 1 | Keep Node-first unless evidence requires heavier compute |

---

## 5. Discovery and Drift Analysis

### 5.1 Current-state strengths

1. Dynamic member navigation already supports a clean new tab insertion.
2. The backend already exposes secure, authenticated options and earnings APIs.
3. Existing market-data services already include enough primitives to build a meaningful first Swing Sniper surface.
4. Morning brief and AI Coach patterns show how synthesis and persistence can fit into this repo.

### 5.2 Current-state gaps

1. Intelligence is fragmented across routes and pages; no single member surface combines IV, catalysts, and structure.
2. Existing IV analysis is symbol-at-a-time, not universe-ranked.
3. Existing earnings analysis is event-specific, not convergence-oriented.
4. Existing position advice is reactive, not thesis-aware.
5. There is no Swing Sniper-specific persistence schema.

### 5.3 Scope lock decisions from discovery

1. Launch universe is capped to a liquid set rather than "all tickers."
2. The reasoning layer remains provider-agnostic so the repo can reuse current LLM plumbing.
3. Contract selection is mandatory; Swing Sniper cannot stop at generic strategy labels.
4. Benzinga-dependent enrichments must degrade cleanly because Massive add-on availability is not guaranteed.

---

## 6. Experience Design

### 6.1 Primary desktop layout

The approved desktop shell should have three persistent columns with low-friction navigation and clear visual hierarchy:

1. **Signal Board**
   - Ranked cards with symbol, setup type, opportunity score, catalyst countdown, IV status, liquidity badge.
2. **Dossier Workspace**
   - Selected symbol detail with tabs: Thesis, Vol Map, Catalysts, Structure, Risk.
3. **Swing Sniper Memo Rail**
   - Daily AI memo, saved ideas, monitoring alerts, and action queue.

### 6.2 Mobile layout

Mobile should not try to preserve a three-column desktop grid. It should stack into:

1. Sticky Swing Sniper header and universe filter.
2. Horizontal chip strip for sort/filter.
3. Opportunity cards.
4. Collapsible dossier sections.
5. Bottom-pinned quick actions for Save Thesis and View Contract Picks.

### 6.3 Required visual devices

These are not optional polish items. They are core comprehension aids:

1. **Vol Map overlay chart**
   - A 30-day IV vs realized-vol overlay must sit inside the Vol Map tab so users can see mispricing, not infer it from numbers alone.
2. **Structure payoff diagram**
   - Every recommended structure card must include a simple payoff visual so users can immediately understand shape differences between candidate trades.
3. **Catalyst density strip**
   - The Catalysts tab must include a compact horizontal timeline showing event clustering, not just a vertical list.
4. **Regime context pill**
   - The memo rail must show current market regime in one line or pill before users interpret individual ideas.
5. **Saved-thesis state cues**
   - Saved ideas should retain baseline metrics such as IV rank at save and current edge drift so the later monitoring layer has continuity from day one.

### 6.4 Key user flows

#### Flow A: Daily research

1. Member opens `/members/swing-sniper`.
2. Swing Sniper loads the daily memo and ranked opportunity board.
3. Member taps a top idea.
4. Dossier explains why the idea is interesting.
5. Member saves or dismisses the thesis.

#### Flow B: Thesis drill-down

1. Member selects symbol.
2. Swing Sniper shows volatility anomalies, catalyst timeline, and narrative summary.
3. Member switches to Structure tab.
4. Swing Sniper proposes exact contracts, preferred structure, and scenario summary.

#### Flow C: Ongoing monitoring

1. Member saves a thesis or marks a trade as active.
2. Swing Sniper tracks health scoring, exit guidance, and portfolio-level exposure context inside the same tab.

---

## 7. Data and Domain Model

### 7.1 Launch universe

Recommended initial universe:

1. S&P 100 names.
2. Core index and macro ETFs.
3. High-liquidity event names with reliable options markets.
4. User watchlist additions, capped per account.

Recommended target size at launch: **150 symbols**.

### 7.2 Core Swing Sniper entities

```ts
export interface SwingSniperOpportunity {
  symbol: string
  asOf: string
  opportunityScore: number
  volatilityScore: number
  catalystScore: number
  liquidityScore: number
  directionBias: 'bullish' | 'bearish' | 'neutral'
  volatilityView: 'long_vol' | 'short_vol' | 'mixed'
  primaryReason: string
  ivContext: {
    currentIV: number | null
    ivRank: number | null
    ivPercentile: number | null
    skewDirection: 'put_heavy' | 'call_heavy' | 'balanced' | 'unknown'
    termStructureShape: 'contango' | 'backwardation' | 'flat'
  }
  nextCatalyst: {
    type: string
    date: string | null
    daysUntil: number | null
    expectedMovePct: number | null
  } | null
}

export interface SwingSniperDossier {
  symbol: string
  asOf: string
  thesisSummary: string
  narrativeShift: string[]
  volatilityMap: {
    current: SwingSniperOpportunity['ivContext']
    realizedVol10d: number | null
    realizedVol20d: number | null
    realizedVol30d: number | null
    realizedVsImpliedZScore: number | null
    ivVsRvTrail30d: Array<{ date: string; impliedVol: number | null; realizedVol: number | null }>
    termPoints: Array<{ expiry: string; dte: number; atmIV: number | null }>
  }
  catalysts: Array<{
    type: 'earnings' | 'macro' | 'news' | 'analyst' | 'filing'
    title: string
    date: string | null
    daysFromNow: number | null
    confidence: number
    expectedMovePct: number | null
    note: string
  }>
  structurePreview: SwingSniperStructureRecommendation[]
  monitoring: SwingSniperMonitoringSnapshot | null
  marketRegime: {
    label: string
    summary: string
  } | null
}

export interface SwingSniperStructureRecommendation {
  id: string
  strategy:
    | 'long_call'
    | 'long_put'
    | 'call_spread'
    | 'put_spread'
    | 'call_credit_spread'
    | 'put_credit_spread'
    | 'long_straddle'
    | 'long_strangle'
    | 'call_calendar'
    | 'put_calendar'
    | 'diagonal'
    | 'butterfly'
  thesisFit: number
  maxLoss: number | null
  maxProfit: number | null
  pop: number | null
  debitOrCredit: 'debit' | 'credit'
  entryWindow: string
  contractSummary: string
  contracts: Array<{
    leg: string
    side: 'buy' | 'sell'
    optionType: 'call' | 'put'
    expiry: string
    strike: number
    quantity: number
    mark: number | null
    bid: number | null
    ask: number | null
    delta: number | null
  }>
  whyThisStructure: string[]
  risks: string[]
}

export interface SwingSniperMonitoringSnapshot {
  status: 'forming' | 'active' | 'degrading' | 'invalidated' | 'closed'
  healthScore: number
  primaryRisk: string | null
  exitBias: 'hold' | 'trim' | 'take_profit' | 'close' | 'roll'
  note: string
}

export interface SwingSniperSavedThesisSnapshot {
  symbol: string
  savedAt: string
  ivRankAtSave: number | null
  ivRankNow: number | null
  edgeState: 'improving' | 'stable' | 'narrowing' | 'invalidated'
  monitorNote: string
}
```

### 7.3 Persistence tables

Recommended initial Supabase tables:

| Table | Purpose |
|-------|---------|
| `swing_sniper_watchlists` | Per-user saved symbols, sort preferences, and filters |
| `swing_sniper_saved_theses` | Saved opportunity records, member notes, and baseline metrics captured at save time |
| `swing_sniper_signal_snapshots` | Optional cached top-opportunity snapshots for replay/audit |
| `swing_sniper_alert_preferences` | Alert routing preferences |
| `swing_sniper_active_trades` | Optional user-marked active Swing Sniper trade records without broker linkage |

RLS principle: user-owned rows only; admins may read for support.

---

## 8. System Architecture

### 8.1 Frontend surfaces

| File | Purpose |
|------|---------|
| `app/members/swing-sniper/page.tsx` | Route shell |
| `app/members/swing-sniper/loading.tsx` | Pulsing-logo load state |
| `app/members/swing-sniper/error.tsx` | User-facing degraded state |
| `components/swing-sniper/swing-sniper-shell.tsx` | Page orchestration |
| `components/swing-sniper/opportunity-board.tsx` | Ranked list |
| `components/swing-sniper/dossier-panel.tsx` | Symbol detail |
| `components/swing-sniper/structure-preview.tsx` | Strategy cards |
| `components/swing-sniper/swing-sniper-memo-rail.tsx` | AI memo and saved theses |
| `lib/swing-sniper/types.ts` | Shared frontend interfaces |

### 8.2 Next.js proxy layer

Recommended same-origin routes:

| Route | Backend target |
|-------|----------------|
| `app/api/members/swing-sniper/health/route.ts` | `GET /api/swing-sniper/health` |
| `app/api/members/swing-sniper/brief/route.ts` | `GET /api/swing-sniper/brief` |
| `app/api/members/swing-sniper/universe/route.ts` | `GET /api/swing-sniper/universe` |
| `app/api/members/swing-sniper/dossier/[symbol]/route.ts` | `GET /api/swing-sniper/dossier/:symbol` |
| `app/api/members/swing-sniper/structure/route.ts` | `POST /api/swing-sniper/structure/recommend` |
| `app/api/members/swing-sniper/monitoring/route.ts` | `GET /api/swing-sniper/monitoring` |
| `app/api/members/swing-sniper/backtest/[symbol]/route.ts` | `GET /api/swing-sniper/backtest/:symbol` |
| `app/api/members/swing-sniper/watchlist/route.ts` | `GET/POST /api/swing-sniper/watchlist` |

### 8.3 Backend route surface

| Route | Purpose |
|-------|---------|
| `GET /api/swing-sniper/health` | Preflight and dependency status |
| `GET /api/swing-sniper/brief` | Daily Swing Sniper memo and summary cards |
| `GET /api/swing-sniper/universe` | Ranked opportunity board |
| `GET /api/swing-sniper/dossier/:symbol` | Full symbol dossier |
| `POST /api/swing-sniper/structure/recommend` | Strategy preview for a chosen thesis |
| `GET /api/swing-sniper/monitoring` | Saved-thesis and active-trade health summary |
| `GET /api/swing-sniper/backtest/:symbol` | Historical setup evidence and confidence overlays |
| `GET /api/swing-sniper/watchlist` | Load user watchlist |
| `POST /api/swing-sniper/watchlist` | Save watchlist/preferences |

### 8.4 Backend service modules

| Module | Purpose |
|--------|---------|
| `backend/src/services/swingSniper/universeScanner.ts` | Universe scan and ranking |
| `backend/src/services/swingSniper/catalystEngine.ts` | Event stack builder |
| `backend/src/services/swingSniper/dossierBuilder.ts` | Merges vol + catalyst + reasoning output |
| `backend/src/services/swingSniper/structureLab.ts` | Contract and structure recommendation |
| `backend/src/services/swingSniper/riskSentinel.ts` | Thesis health scoring and exit guidance |
| `backend/src/services/swingSniper/backtestService.ts` | Historical evidence and confidence layer |
| `backend/src/services/swingSniper/reasoningService.ts` | Provider-agnostic LLM adapter |
| `backend/src/services/swingSniper/persistence.ts` | Supabase read/write helpers |

### 8.5 Core dependency graph

```text
Massive.com options + news + earnings
  -> backend/src/services/options/*
  -> backend/src/services/earnings/*
  -> backend/src/config/massive.ts#getTickerNews
  -> backend/src/routes/swingSniper.ts
  -> app/api/members/swing-sniper/*
  -> app/members/swing-sniper/page.tsx
```

---

## 9. Intelligence Pipeline

### 9.1 Universe scanner scoring

Launch scoring model:

1. **Volatility score (45%)**
   - IV rank / percentile
   - realized vs implied divergence
   - skew imbalance
   - term structure abnormality
2. **Catalyst score (35%)**
   - days to earnings or major macro event
   - expected-move significance
   - news velocity / narrative shift
   - analyst or filing activity if available
3. **Liquidity and execution score (20%)**
   - options volume / open interest
   - bid-ask friction
   - strike availability around target structure

### 9.2 Catalyst engine input waterfall

1. Earnings calendar and earnings analysis from existing service.
2. Economic calendar for macro-sensitive names.
3. Massive news articles for narrative extraction.
4. Benzinga-enhanced fields only if `checkBenzingaAvailability()` confirms support.

### 9.3 Reasoning layer contract

The reasoning layer must consume structured facts only. Prompting must never invent strikes, IV levels, or event dates. The Swing Sniper summary should explain the tradeoff, not create fake certainty.

Input shape:

1. Symbol facts.
2. IV metrics.
3. Catalyst stack.
4. Candidate contracts and structure candidates.

Output shape:

1. Thesis summary.
2. Why now.
3. What would invalidate it.
4. Which structure and contract set best matches the setup.

---

## 10. Structure Lab Scope

### 10.1 Required strategy coverage

Swing Sniper should evaluate and rank at least these structure classes:

1. Long calls and puts
2. Call and put debit spreads
3. Call and put credit spreads
4. Long straddles and strangles
5. Calendars
6. Diagonals
7. Butterflies

Explicitly excluded:

1. Multi-step broker automation
2. Broker-specific routing instructions
3. Uncovered naked short options as a default recommendation surface for all members

### 10.2 Contract picker requirement

The Structure Lab is not complete unless it outputs:

1. Exact expiration selection
2. Exact strikes
3. Exact leg directions and quantities
4. Mark, bid, ask, and spread quality
5. Entry window and invalidation note
6. Scenario summary tied to the chosen contracts
7. A simplified payoff diagram for each recommended structure

### 10.3 Scenario engine level

1. Phase 1: deterministic scenario bands and Greeks-aware payoff summaries
2. Phase 2: probability-weighted payoff distribution
3. Phase 4: deeper historical replay and confidence calibration

---

## 11. Phase Plan

These phases are implementation sequencing only. Public release is not considered complete until all four phases are shipped and validated.

## Phase 1: Swing Sniper Brief and Opportunity Board

**Goal:** Ship the research and intelligence foundation.

### Slices

1. **1.1 Route + tab shell + health preflight**
2. **1.2 Universe scanner service + ranked board contract**
3. **1.3 Dossier builder + thesis tab + IV vs RV overlay**
4. **1.4 Catalyst timeline + density strip + memo rail regime context**
5. **1.5 Watchlist persistence + targeted UI/E2E coverage**

**Exit criteria:** Members can open `/members/swing-sniper`, review ranked ideas, inspect a symbol dossier, and save a thesis.

## Phase 2: Structure Lab

**Goal:** Make Swing Sniper actionable with exact contract selection.

### Slices

1. **2.1 Strategy candidate generation**
2. **2.2 Exact contract optimization and liquidity filters**
3. **2.3 Scenario summary, payoff diagrams, and payoff distribution**
4. **2.4 UX hardening and validation**

**Exit criteria:** Top ideas include exact contract picks, structure rationale, and scenario summaries with clearly labeled tradeoffs.

## Phase 3: Risk Sentinel

**Goal:** Extend Swing Sniper past the idea stage with native monitoring.

### Slices

1. **3.1 Saved-thesis health scoring**
2. **3.2 Position and exposure summary**
3. **3.3 Exit guidance and alerts**

**Exit criteria:** Members can monitor saved Swing Sniper trades, see why risk changed, and receive in-product exit bias guidance.

## Phase 4: Adaptive Learning and Backtesting

**Goal:** Calibrate confidence from historical evidence.

### Slices

1. **4.1 Signal snapshot archive**
2. **4.2 Offline backtest pipeline**
3. **4.3 Confidence reweighting and surface-level reporting**

**Exit criteria:** Swing Sniper shows historical hit-rate context, confidence weighting, and transparent caveats without pretending backtests are guarantees.

---

## 12. Acceptance Criteria

### 12.1 Product acceptance

1. Swing Sniper appears as a first-class member tab.
2. Top opportunities render in under a reasonable member-dashboard tolerance on warm loads.
3. Every opportunity has a fact-based explanation, not just a numeric score.
4. Every top idea includes exact contract selection, not just strategy labels.
5. Monitoring and Risk Sentinel are present in the launch product.
6. Backtest and confidence context are present in the launch product.
7. Benzinga-dependent enrichments degrade cleanly when unavailable.
8. Vol Map includes a trailing IV vs RV overlay visual.
9. Structure cards include simplified payoff diagrams.
10. Catalysts tab includes a catalyst-density timeline strip.
11. Saved thesis records preserve baseline metrics needed for monitoring continuity.
12. The memo rail includes explicit market-regime context.
13. The UI remains clean, easy to scan, and does not require horizontal scrolling for core workflows.

### 12.2 Engineering acceptance

1. Tab config, member auth, and mobile nav all recognize the new route.
2. Browser requests flow through same-origin routes or approved backend access paths.
3. New persistence tables have RLS and indexes.
4. New tests cover at least one degraded-state case and one auth path.
5. LLM summaries are grounded in tool-provided facts.

---

## 13. Validation Gates

Slice-level gates:

```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
pnpm vitest run <targeted tests>
pnpm exec playwright test <targeted specs> --project=chromium --workers=1
```

Release-level gates:

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run lib/__tests__/member-navigation.test.ts
pnpm exec playwright test e2e/specs/members/dashboard-navigation.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/specs/members/fast-tab-navigation.spec.ts --project=chromium --workers=1
```

Additional Swing Sniper-targeted tests will be added once implementation files exist.

---

## 14. Open Sign-Off Decisions

Resolved scope locks:

1. Swing Sniper is available to all members.
2. All phases are part of the launch product scope.
3. Contract and structure picking are required.
4. Brokerage integration is explicitly excluded.
5. The mockup must include IV/RV overlay, payoff diagrams, catalyst density, regime context, and saved-thesis drift cues.

Remaining open decisions:

1. Is the launch universe capped at 150 symbols, or do you want a larger first-pass scan?
2. Should saved theses remain private-only, or eventually shareable into Social?
3. Is the preferred reasoning provider still Claude, or should implementation reuse the existing OpenAI transport first and stay provider-agnostic?
4. Should the daily Swing Sniper memo read like a desk note, a PM note, or a trader checklist?

---

## 15. Mockup Review Checklist

The mockup should be approved against these criteria:

1. The three-column desktop layout feels like a member-center tab, not a separate product site.
2. Opportunity cards communicate "why this matters" before the user opens detail.
3. The Dossier tabs are the right mental model: Thesis, Vol Map, Catalysts, Structure, Risk.
4. Vol Map makes IV vs RV mispricing obvious without mental math.
5. Structure cards make payoff shape differences obvious at a glance.
6. Catalyst clustering is visible before the user reads each event row.
7. The right rail feels useful rather than decorative.
8. Mobile retains the same information hierarchy with stacked cards.
9. The page feels premium and institutional, not retail-gamified.

---

## 16. Operator Handoff Prompt Template

Use this once scope is approved:

```md
Implement Swing Sniper Member Center Phase 1 Slice 1.1.

Scope:
- /Users/natekahl/ITM-gd/app/members/swing-sniper/page.tsx
- /Users/natekahl/ITM-gd/app/members/swing-sniper/loading.tsx
- /Users/natekahl/ITM-gd/app/members/swing-sniper/error.tsx
- /Users/natekahl/ITM-gd/app/api/members/swing-sniper/health/route.ts
- /Users/natekahl/ITM-gd/backend/src/routes/swingSniper.ts
- /Users/natekahl/ITM-gd/contexts/MemberAuthContext.tsx
- /Users/natekahl/ITM-gd/lib/member-navigation.ts

Requirements:
1. Add the Swing Sniper route shell and health preflight only.
2. Do not implement scanner logic yet.
3. Add no unrelated changes.

Validation:
- pnpm exec eslint <touched files>
- pnpm exec tsc --noEmit

Return:
- changed files
- command outputs (pass/fail)
- risks/notes
- suggested commit message
```

---

## 17. Recommendation

Approve the Swing Sniper tab as a full-scope decision engine executed in phases. The implementation should stay disciplined, but the shipped member experience should include discovery, dossier, contract picking, monitoring, and adaptive-confidence layers in one coherent product.
