# Money Maker V2 - Execution Guidance Spec

Date: 2026-03-11
Status: Draft
Owner: Product + Engineering
Route: `/members/money-maker`
Implementation plan: `docs/specs/money-maker-v2-execution-guidance-autonomous-2026-03-11/02_IMPLEMENTATION_PLAN_AND_PRIORITY_MODEL.md`

## 0. Scope Clarification

This document defines the next product phase for Money Maker after the V1 signal-detection surface.

Important distinction:
- The original V1 spec's "Phase 2" covered backend plumbing only.
- This document defines the next product phase in the user experience: execution guidance and decision support.

This is not brokerage integration.

This phase is intended to help a trader:
- understand why a KCU setup is actionable,
- know where entry is valid or invalid,
- see which single-leg option best expresses the setup,
- and understand what should lead them to hold, trim, or exit.

## 1. Product Objective

Turn Money Maker from a detection board into a guided KCU trade-planning workspace.

The surface should remain KCU-first:
- the underlying setup is the source of truth,
- the option contract is only the trade expression,
- and every action cue must be explainable by KCU principles rather than generic options heuristics.

V2 should answer five questions for each actionable symbol:
1. Is this setup still valid right now?
2. Where is the actual KCU trigger, stop, and target ladder?
3. Is the setup still in an acceptable entry zone, or is it too extended?
4. If expressed with options, which single-leg call or put is the cleanest contract?
5. What specific KCU signals should lead the trader to stay in, take profits, or get out?

## 2. Hard Constraints

These are locked scope constraints for V2:

1. No broker integration.
2. No order routing.
3. No brokerage account sync.
4. No spreads.
5. No straddles.
6. No strangles.
7. No calendars.
8. No butterflies.
9. No diagonals.
10. No short premium strategies.
11. No automatic sizing recommendations tied to account permissions.

Allowed option expressions:
- Long call for bullish Money Maker setups.
- Long put for bearish Money Maker setups.

All contract guidance must output single-leg only.

## 3. Product Principles

### 3.1 KCU-first, options-second

The system must never recommend a contract unless the underlying KCU setup is already valid. If the underlying setup is invalid, contract guidance must collapse with it.

### 3.2 No black-box execution language

The surface must avoid vague statements like "bullish" or "take profits soon."

Every execution cue must tie back to:
- patience candle trigger,
- confluence zone,
- VWAP / EMA structure,
- ORB regime,
- hourly target ladder,
- or time-of-day degradation.

### 3.3 Guidance, not automation

The system may guide a trader toward an entry or exit, but it must not imply an order is being placed or managed.

### 3.4 Graceful degradation

If option-chain data is missing, stale, unauthorized, or rate-limited:
- Money Maker must still show the underlying execution plan.
- Contract guidance should degrade to an unavailable state without breaking the rest of the workspace.

## 4. Current-State Baseline and Reuse

This phase should reuse the current Money Maker and options infrastructure rather than invent a parallel stack.

### 4.1 Existing Money Maker surfaces to extend

| Surface | Current file(s) | Reuse |
|---|---|---|
| Shared signal contract | `lib/money-maker/types.ts` | Extend with execution-planning payloads |
| Snapshot engine | `backend/src/services/money-maker/snapshotBuilder.ts` | Continue as source for signal and symbol state |
| Member routes | `app/api/members/money-maker/*` | Add workspace/detail proxies using same auth pattern |
| Backend controller | `backend/src/controllers/money-maker/index.ts` | Add workspace/detail endpoints under same admin policy |
| Frontend polling/shell | `hooks/use-money-maker-polling.ts`, `components/money-maker/*` | Keep snapshot board lightweight; load detail on demand |

### 4.2 Existing option-data surfaces to reuse

| Surface | Current file(s) | Reuse |
|---|---|---|
| Options chain route | `backend/src/routes/options.ts` | Use existing chain and expiration data |
| Chain fetcher | `backend/src/services/options/optionsChainFetcher.ts` | Reuse for contract candidates |
| Option types | `backend/src/services/options/types.ts` | Reuse `OptionContract` shape |
| IV analysis | `backend/src/services/options/ivAnalysis.ts` | Optional tie-break / timing input |
| Existing contract scoring patterns | `backend/src/services/spx/contractSelector.ts` | Borrow liquidity/spread scoring concepts only |

### 4.3 Access policy

This spec does not change the current Money Maker access policy.

If Money Maker remains admin-only in the current release:
- all V2 routes and UI states remain admin-only,
- unless product explicitly changes the access policy in a separate decision.

## 5. User Experience Overview

V2 should add a second layer to the existing board:
- the board remains the fast scan,
- the workspace becomes the execution-guidance layer.

### 5.1 Board-level upgrades

Each symbol card should retain the current monitoring summary but add:
1. Entry status badge:
   - `Watching`
   - `Armed`
   - `Triggered`
   - `Extended`
   - `Invalid`
2. Trigger distance:
   - distance to trigger in dollars and percent
3. Entry quality pill:
   - `ideal`
   - `acceptable`
   - `late`
4. Target progress summary:
   - `T1 pending`
   - `At T1`
   - `T2 in play`
   - `Failed after trigger`
5. Quick action:
   - `Open Plan`

### 5.2 Execution workspace

Opening a symbol should reveal a detailed planner workspace with four tabs:

1. `Setup Map`
2. `Trade Plan`
3. `Contracts`
4. `Exit Playbook`

### 5.3 Setup Map

This tab should visually answer "Why is this actionable?"

Required visuals:
1. Intraday price ladder or mini-chart with:
   - current price
   - patience candle high/low
   - entry trigger
   - stop line
   - confluence zone band
   - VWAP
   - 8 EMA
   - 21 EMA
   - ORB high / low
   - open price
   - target 1
   - target 2 if available
2. Confluence stack list with weights and prices.
3. Patience-candle rule checklist:
   - body ratio
   - wick dominance
   - volume ratio
   - preceding trend
   - relative size
4. Regime banner:
   - `Trending Up`
   - `Trending Down`
   - `Choppy`
5. Strategy banner:
   - `King & Queen`
   - `EMA Bounce`
   - `VWAP Strategy`
   - other KCU label

### 5.4 Trade Plan

This tab should answer "What exactly am I waiting for or acting on?"

Required blocks:
1. `Trigger`
   - exact underlying trigger price
   - whether trigger is above or below patience candle
2. `Ideal Entry Zone`
   - narrow underlying zone around trigger
3. `Do Not Chase Zone`
   - explicit threshold where new entry quality becomes poor
4. `Invalidation`
   - stop price
   - structural reason for failure
5. `Target Ladder`
   - target 1 = next hourly level
   - target 2 = next level beyond target 1 when available
6. `Time Context`
   - whether time-of-day still favors new entry
7. `R:R`
   - current plan R:R from the underlying signal

### 5.5 Contracts

This tab should answer "If I want to express this with options, which single-leg call or put is best?"

Required blocks:
1. Primary contract candidate
2. Conservative alternative
3. Lower-cost alternative

Each contract card must show:
- option symbol
- expiry
- strike
- call/put
- bid
- ask
- mid
- spread percent
- delta
- theta
- implied volatility
- open interest
- volume
- premium per contract
- DTE
- contract-quality badge
- explanation for why it was ranked

### 5.6 Exit Playbook

This tab should answer "What should lead me to stay in or get out?"

Required blocks:
1. `Hold while`
   - structural reasons to stay in
2. `Reduce or take gains when`
   - target-based or extension-based cues
3. `Exit immediately if`
   - invalidation rules
4. `Late-day warning`
   - when the setup may still be valid on the underlying but options quality degrades materially

## 6. Execution Guidance Model

### 6.1 Canonical setup states

Add a dedicated execution-guidance state machine distinct from the current raw signal lifecycle.

```ts
type MoneyMakerExecutionState =
  | 'watching'
  | 'armed'
  | 'triggered'
  | 'extended'
  | 'target1_hit'
  | 'target2_in_play'
  | 'failed'
  | 'closed'
```

Definitions:
- `watching`: valid setup context exists, but trigger has not armed tightly enough.
- `armed`: setup is valid and current price is close enough to trigger to matter.
- `triggered`: trigger price has been breached in the intended direction.
- `extended`: price has traveled too far beyond the trigger for a fresh entry.
- `target1_hit`: first hourly target has been reached.
- `target2_in_play`: extension target is active after target 1.
- `failed`: stop/invalidation or structural failure occurred.
- `closed`: end-of-day or explicit user dismissal state.

### 6.2 Entry validity rules

Underlying price remains the only source of entry validity.

For long setups:
- `entry = patienceCandle.high + tick`
- `stop = patienceCandle.low - tick`
- `risk = entry - stop`

For short setups:
- `entry = patienceCandle.low - tick`
- `stop = patienceCandle.high + tick`
- `risk = stop - entry`

Add two derived bands:

```ts
idealEntryBuffer = min(risk * 0.15, currentPrice * 0.0010)
maxChaseBuffer = min(risk * 0.25, currentPrice * 0.0015)
```

Interpretation:
- `ideal`: price is at trigger or within the ideal buffer after trigger.
- `acceptable`: price is beyond ideal but still within max chase buffer.
- `late`: price has exceeded max chase buffer.

If price exceeds the max chase buffer:
- state becomes `extended`
- contract guidance remains viewable,
- but the workspace must show `Do not chase` as the primary guidance.

### 6.3 Exit guidance rules

Exit rules must be expressed in underlying terms first.

### Long setup guidance

Hold while:
- price remains above the trigger after confirmation,
- VWAP or 8 EMA remains supportive,
- structure continues to print higher lows,
- target 1 has not rejected hard.

Reduce / take profits when:
- target 1 is hit,
- price reaches the next hourly resistance,
- extension stalls after a fast impulse,
- or time-of-day degrades the edge materially.

Exit immediately when:
- stop is breached,
- price loses key support after trigger,
- or the underlying re-enters a failed structure state.

### Short setup guidance

Hold while:
- price remains below the trigger after confirmation,
- VWAP or 8 EMA remains overhead,
- structure continues to print lower highs,
- target 1 has not rejected hard.

Reduce / take profits when:
- target 1 is hit,
- price reaches the next hourly support,
- downside extension stalls,
- or time-of-day degrades the edge materially.

Exit immediately when:
- stop is breached,
- price reclaims failed structure,
- or overhead support turns into regained momentum.

### 6.4 Time-of-day degradation rules

This phase should introduce stronger guidance around when the option expression becomes less attractive, even if the underlying setup still exists.

Initial rules:
1. New entries after 1:30 PM ET should be marked `late_session`.
2. New entries after 2:00 PM ET should show a strong caution banner.
3. Same-day options should be excluded entirely in V2 launch.
4. If there is not enough time premium left to reasonably express the move, the workspace should keep the underlying plan visible but suppress the contract-primary CTA.

## 7. Single-Leg Contract Guidance Model

### 7.1 Direction mapping

Contract direction is not configurable:
- bullish Money Maker setup -> calls only
- bearish Money Maker setup -> puts only

No mixed-mode recommendations are allowed.

### 7.2 Expiration policy

V2 launch should favor liquid weekly expirations with enough time to avoid terminal decay without drifting too far from the intended intraday move.

Default policy:
1. Primary expiry target: 3-10 DTE
2. Conservative alternative: 7-14 DTE
3. Hard reject:
   - 0DTE
   - >21 DTE

If no chain meets the primary window cleanly:
- the system may fall back to the best liquid expiry inside 2-14 DTE,
- but must mark the result as degraded.

### 7.3 Delta policy

The contract should behave like the underlying move without becoming unusably expensive or too low-conviction.

Default delta bands:
- Primary candidate: 0.35-0.55 absolute delta
- Conservative candidate: 0.50-0.65 absolute delta
- Lower-cost candidate: 0.25-0.40 absolute delta

Contracts outside 0.20-0.70 absolute delta should be rejected for V2 launch.

### 7.4 Liquidity and quality filters

Initial launch filters:
1. Delta must be present and finite.
2. Bid and ask must both be positive.
3. Open interest >= 300, unless volume >= 100.
4. Spread percent:
   - `green`: <= 12%
   - `amber`: > 12% and <= 18%
   - reject: > 18%
5. Premium per contract must be finite and positive.
6. Contracts with obviously stale or empty quotes must be rejected.

### 7.5 Ranking model

Contract ranking should be deterministic and transparent.

Initial weight model:
- 35% delta fit to the target band
- 25% spread quality
- 15% open-interest quality
- 10% same-session volume
- 10% theta efficiency
- 5% IV timing or premium-timing signal when available

The response must explain the ranking in plain language, for example:
- "best balance of delta and spread quality"
- "higher delta but more expensive"
- "cheaper premium but lower responsiveness"

### 7.6 Output classes

At most three candidates should be returned:
1. `primary`
2. `conservative`
3. `lower_cost`

If fewer than three valid contracts survive filtering:
- return only the surviving candidates,
- do not backfill with weak contracts just to fill the UI.

### 7.7 No sizing engine in V2 launch

The workspace may show:
- premium per contract
- contract multiplier
- max premium paid per single contract

The workspace must not output:
- recommended quantity
- portfolio-based contract count
- PDT-aware sizing logic
- buying-power-aware sizing logic

## 8. Backend Enhancements

### 8.1 Shared type extensions

Extend `lib/money-maker/types.ts` with V2-specific types:

```ts
interface MoneyMakerExecutionPlan {
  symbol: string
  signalId: string | null
  executionState: MoneyMakerExecutionState
  entry: number
  stop: number
  target1: number
  target2: number | null
  riskPerShare: number
  rewardToTarget1: number
  rewardToTarget2: number | null
  riskRewardRatio: number
  entryQuality: 'ideal' | 'acceptable' | 'late'
  idealEntryLow: number
  idealEntryHigh: number
  chaseCutoff: number
  timeWarning: 'normal' | 'late_session' | 'avoid_new_entries'
  holdWhile: string[]
  reduceWhen: string[]
  exitImmediatelyWhen: string[]
}

interface MoneyMakerContractCandidate {
  label: 'primary' | 'conservative' | 'lower_cost'
  optionSymbol: string
  expiry: string
  strike: number
  type: 'call' | 'put'
  bid: number
  ask: number
  mid: number
  spreadPct: number
  delta: number | null
  theta: number | null
  impliedVolatility: number | null
  openInterest: number | null
  volume: number | null
  premiumPerContract: number
  dte: number
  quality: 'green' | 'amber'
  explanation: string
}

interface MoneyMakerWorkspaceResponse {
  symbolSnapshot: MoneyMakerSymbolSnapshot
  activeSignal: MoneyMakerSignal | null
  executionPlan: MoneyMakerExecutionPlan | null
  contracts: MoneyMakerContractCandidate[]
  generatedAt: number
  degradedReason: string | null
}
```

### 8.2 New backend services

Add these services under `backend/src/services/money-maker/`:

1. `executionPlanBuilder.ts`
   - builds the underlying execution plan from the active signal or best monitored setup
2. `executionStateEvaluator.ts`
   - derives `watching / armed / triggered / extended / target1_hit / failed`
3. `contractGuideBuilder.ts`
   - consumes Money Maker direction + options chain and returns single-leg candidates
4. `contractTimingEvaluator.ts`
   - optional helper to penalize poor late-session or high-decay contract picks
5. `workspaceBuilder.ts`
   - aggregates symbol snapshot + signal + plan + contracts into one on-demand response

### 8.3 New backend routes

Keep the polling snapshot route lightweight. Do not attach option-chain work to the 5-second board snapshot.

Recommended new backend endpoints:

1. `GET /api/money-maker/workspace?symbol=SPY`
   - returns the full detailed workspace payload for one symbol
2. `GET /api/money-maker/contracts?symbol=SPY`
   - returns the single-leg contract candidates only
3. `GET /api/money-maker/plan?symbol=SPY`
   - returns the underlying execution plan only

Recommended Next.js member proxies:

1. `/api/members/money-maker/workspace`
2. `/api/members/money-maker/contracts`
3. `/api/members/money-maker/plan`

These must use the same member-side auth/access enforcement pattern as the current watchlist and snapshot proxies.

### 8.4 Persistence additions

V2 should persist guidance snapshots for auditability and future tuning.

Recommended tables:

```sql
CREATE TABLE money_maker_guidance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  signal_id uuid NULL,
  symbol varchar(10) NOT NULL,
  direction varchar(5) NOT NULL,
  execution_state varchar(30) NOT NULL,
  entry_price numeric(10,2) NOT NULL,
  stop_price numeric(10,2) NOT NULL,
  target1_price numeric(10,2) NOT NULL,
  target2_price numeric(10,2),
  entry_quality varchar(15) NOT NULL,
  time_warning varchar(30) NOT NULL,
  plan_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE money_maker_contract_guidance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guidance_snapshot_id uuid NOT NULL REFERENCES money_maker_guidance_snapshots(id) ON DELETE CASCADE,
  candidate_label varchar(20) NOT NULL,
  option_symbol varchar(40) NOT NULL,
  expiry date NOT NULL,
  strike numeric(10,2) NOT NULL,
  option_type varchar(4) NOT NULL,
  bid numeric(10,2),
  ask numeric(10,2),
  mid numeric(10,2),
  spread_pct numeric(6,2),
  delta numeric(6,3),
  theta numeric(8,3),
  implied_volatility numeric(8,4),
  open_interest integer,
  volume integer,
  premium_per_contract numeric(10,2),
  quality varchar(10) NOT NULL,
  explanation text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

Persistence goals:
1. audit what the trader was shown,
2. compare later signal outcomes vs recommended contract quality,
3. support future tuning without relying on memory or screenshots.

### 8.5 Performance and caching rules

1. Snapshot polling must remain separate from contract generation.
2. Workspace payload should be built on demand per symbol.
3. Contract guidance cache TTL: 10-15 seconds.
4. Workspace payload cache TTL: 5-10 seconds.
5. Contract guidance must not block board render.
6. If options data is unavailable, the workspace should return `degradedReason` and still render the plan.

### 8.6 Telemetry

Add telemetry for:
1. workspace opened
2. contract tab opened
3. contract candidate copied or expanded
4. plan shown in degraded mode
5. state transitions:
   - watching -> armed
   - armed -> triggered
   - triggered -> extended
   - triggered -> target1_hit
   - triggered -> failed

## 9. Frontend Enhancements

### 9.1 Symbol card upgrades

Extend the current card to show:
1. execution-state badge
2. trigger-distance line
3. target-progress line
4. `Open Plan` action

### 9.2 Workspace container

Add a symbol-detail workspace as:
- right-side sheet on desktop,
- bottom sheet or full-screen modal on mobile.

The workspace should open from:
- symbol card click,
- active signal click,
- or direct deep-link via query param.

### 9.3 Setup Map visual contract

The setup map must provide strong visual hierarchy:
1. confluence zone as a band
2. trigger as the dominant line
3. stop in destructive color
4. target 1 / target 2 in success tones
5. current price marker

No full TradingView-style chart is required in the first slice.
A lightweight intraday ladder or mini-chart is acceptable if it clearly communicates:
- price relative to trigger,
- price relative to confluence,
- distance to stop and targets.

### 9.4 Contract cards

Each contract card must clearly separate:
1. price quality
2. responsiveness
3. time decay
4. liquidity

Suggested UI treatment:
- top line: strike + expiry + type
- mid row: bid / ask / mid / spread
- metric row: delta / theta / IV / OI / volume
- footer: explanation sentence + quality badge

### 9.5 Exit Playbook UI

The exit tab should not be generic text.

It should render:
1. `Stay in while` checklist
2. `Take gains when` checklist
3. `Get out if` checklist
4. target ladder progression marker

### 9.6 Mobile requirements

Mobile must preserve clarity without forcing dense tables.

Required mobile adaptations:
1. contract cards stack vertically
2. metrics become chips or two-column rows
3. setup map becomes a simplified ladder view
4. exit playbook remains readable in one scroll without tabs disappearing

## 10. Delivery Plan

This phase should be executed as a separate V2 delivery track.

### Slice 2.1 - Shared contracts and execution-plan engine

Scope:
- shared types
- execution plan builder
- execution state evaluator
- unit tests for guidance rules

Exit criteria:
- deterministic plan payload from signal inputs
- no options dependency yet

### Slice 2.2 - Contract guidance engine (single-leg only)

Scope:
- contract guide builder
- expiry and delta filtering
- liquidity scoring
- options integration tests

Exit criteria:
- only long calls / long puts returned
- no spread or multi-leg outputs possible

### Slice 2.3 - Workspace API and persistence

Scope:
- backend routes
- Next proxies
- persistence tables
- degraded-mode handling

Exit criteria:
- per-symbol workspace route returns plan + contracts + degrade reason cleanly

### Slice 2.4 - Planner workspace UI

Scope:
- setup map
- trade plan
- contracts tab
- board-to-workspace interaction

Exit criteria:
- trader can move from symbol card to detailed plan with zero ambiguity

### Slice 2.5 - Exit playbook and state transitions

Scope:
- state badges
- target-progress states
- exit playbook UI
- transition telemetry

Exit criteria:
- surface explains both entry and exit, not only entry

### Slice 2.6 - Validation and hardening

Scope:
- component tests
- backend integration tests
- Playwright flows
- release notes and runbook additions

Exit criteria:
- local and deployed evidence recorded

## 11. Acceptance Criteria

### Product behavior

- Every actionable Money Maker symbol can open a detailed execution workspace.
- Every workspace shows the underlying trigger, stop, target 1, and target 2 when available.
- Every workspace explicitly marks `ideal`, `acceptable`, or `late` entry quality.
- Every bullish setup recommends calls only.
- Every bearish setup recommends puts only.
- No spread or multi-leg structure is surfaced anywhere in V2.
- At least one contract candidate appears when chain data is healthy and filters pass.
- Contract data failure does not blank the underlying plan.
- Exit guidance is tied to KCU structure, not generic profit-taking text.

### Backend behavior

- Snapshot route remains lightweight and does not fetch option chains.
- Workspace route degrades gracefully on options data failure.
- Guidance snapshots and contract candidates persist for audit.
- Guidance responses are deterministic for mocked test fixtures.

### UX behavior

- The board still works as a fast scanner.
- The workspace adds detail without overwhelming the card layer.
- Mobile users can read the plan and contract guidance without horizontal overflow.

## 12. Test and Quality Gates

### Backend

- Unit tests:
  - `executionPlanBuilder.test.ts`
  - `executionStateEvaluator.test.ts`
  - `contractGuideBuilder.test.ts`
- Integration tests:
  - `money-maker-workspace-api.test.ts`
  - mocked options-chain failure tests

### Frontend

- Component tests:
  - symbol card execution-state rendering
  - setup map rendering
  - contract tab degraded state
  - exit playbook rendering

### E2E

- authorized user opens workspace from board
- workspace shows trigger / stop / target ladder
- bullish signal shows calls only
- bearish signal shows puts only
- options data degraded mode still shows underlying plan

### Release gates

1. `pnpm exec vitest run <money-maker frontend/shared suites>`
2. `pnpm --dir backend exec jest <money-maker backend suites> --runInBand`
3. `pnpm exec tsc --noEmit`
4. `pnpm --dir backend exec tsc --noEmit`
5. `pnpm exec playwright test e2e/specs/members/money-maker*.spec.ts --project=chromium --workers=1`
6. deployed smoke on the real environment with recorded SHA

## 13. Explicit Non-Goals

V2 does not include:
- broker login
- order placement
- position reconciliation from broker accounts
- automatic live P&L from actual fills
- spread construction
- trade journaling workflow replacement
- AI Coach integration as a required dependency

## 14. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Contract guidance overwhelms the clean board UX | High | Keep board lightweight; load workspace on demand |
| Options chain failures degrade trust | High | Make degraded state explicit and keep the underlying plan intact |
| Single-leg calls/puts can still be too aggressive late-day | High | Exclude 0DTE, penalize late session, show strong caution states |
| Traders over-index on the contract card and ignore the underlying plan | High | Make underlying trigger/stop/target visually primary |
| Too many candidate contracts create indecision | Medium | Limit to max 3 ranked candidates |
| Liquidity rules are too loose or too strict | Medium | Make thresholds configurable and audit candidate persistence |

## 15. Recommendation

Treat this as Money Maker V2 and keep the current V1 spec intact.

Reason:
1. The original V1 document is still a detection-first spec.
2. This next phase is a different product layer: execution guidance.
3. The distinction should stay explicit so we do not conflate signal correctness work with trader-guidance work.

If approved, the next implementation artifact should be an autonomous execution packet for this V2 scope:
- change-control standard,
- risk register,
- tracker,
- slice reports,
- runbook updates,
- and release-note template.
