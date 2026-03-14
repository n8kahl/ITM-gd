# Implementation Plan And Priority Model: Money Maker V2 Execution Guidance

Date: 2026-03-11
Governing spec: `docs/specs/MONEY_MAKER_V2_EXECUTION_GUIDANCE_SPEC_2026-03-11.md`

## 1. Purpose

Translate the Money Maker V2 spec and the day-trader feature sweep into a concrete delivery plan with:
- explicit priority tiers
- implementation slices
- acceptance criteria
- required tests
- release validation steps

This document is the working plan for implementation. It is stricter than the master spec and should be used to decide what is release-blocking versus useful but deferrable.

## 2. Release Objective

Ship Money Maker as a trustworthy intraday execution-guidance tool for KCU traders, not only a signal board.

At release, a trader must be able to:
1. understand the setup in plain language
2. know whether the setup is still valid right now
3. see the exact trigger, stop, invalidation, and target ladder
4. know whether the setup is too extended to chase
5. see the cleanest single-leg call or put candidates
6. know what should lead them to hold, trim, or exit
7. trust the freshness and reliability of the data on screen

## 3. Definition Of Done

Money Maker V2 is not done until all of the following are true:
1. The board no longer exposes raw engine jargon or duplicate level labels.
2. Each symbol can open a planner workspace with `Setup Map`, `Trade Plan`, `Contracts`, and `Exit Playbook`.
3. The underlying execution plan is fully deterministic from the canonical Money Maker signal.
4. Contract guidance is single-leg only:
   - calls for bullish setups
   - puts for bearish setups
5. Contract or chain-data failure does not blank the underlying plan.
6. Entry quality, chase state, target progress, and invalidation are visible and tested.
7. The deployed environment is smoke-validated with evidence.

## 4. Priority Model

### 4.1 Must-Have For Day-Trader Release

These are release-blocking. If any are missing, the feature is still a scan board rather than an execution tool.

1. Board correctness and trader-language cleanup
   - remove duplicate hourly labels
   - dedupe clustered hourly levels into a support/resistance ladder
   - replace raw labels like `fortress` with trader-facing descriptions
   - stop rendering synthetic `0.00` indicators as real levels
   - fix NY session clock labeling and freshness trust cues
2. Execution state model
   - `watching`
   - `armed`
   - `triggered`
   - `extended`
   - `target1_hit`
   - `target2_in_play`
   - `failed`
   - `closed`
3. Trade-plan model
   - trigger
   - ideal entry zone
   - do-not-chase cutoff
   - invalidation
   - target 1 and target 2
   - time-of-day caution
4. Planner workspace
   - `Setup Map`
   - `Trade Plan`
   - `Contracts`
   - `Exit Playbook`
5. Single-leg contract guidance
   - long calls only for bullish setups
   - long puts only for bearish setups
   - deterministic liquidity and spread filters
   - primary / conservative / lower-cost candidates
6. Exit guidance
   - hold, reduce, and exit rules tied to KCU structure
   - target progress rendering
7. Data trust surfaces
   - stale-data warning
   - degraded options-state warning
   - last successful refresh timestamp

### 4.2 Strong Add For Initial Adoption

These materially improve usability and should be included if they fit without destabilizing the must-have path.

1. In-app transition alerts
   - armed
   - triggered
   - target 1 hit
   - failed
2. Mini-chart or price ladder with visual overlays
3. Per-symbol plan persistence for last-generated workspace snapshots
4. Quick-glance board summaries
   - trigger distance
   - entry quality
   - target progress
5. Plain-English reason strings for invalidation and contract ranking

### 4.3 Later / Non-Blocking

Do not let these delay the must-have path.

1. Browser notifications when tab is backgrounded
2. User notes or plan journaling inside the workspace
3. Historical workspace playback
4. Personalized watchlist presets
5. Advanced contract comparison analytics beyond the three required candidates

## 5. Implementation Slices

### Slice 2.1: Board Correctness And Trader-Language Hardening

### Objective

Remove current board defects and convert the board from engine diagnostics into readable trade context.

### Scope

1. Normalize confluence-level source labels so sources never include embedded prices.
2. Build a deduped hourly ladder:
   - nearest support
   - next support
   - nearest resistance
   - next resistance
3. Translate zone labels:
   - internal `moderate|strong|fortress`
   - trader-facing descriptions like `Moderate support cluster`, `Heavy resistance cluster`
4. Replace `200 SMA 0.00` and similar synthetic values with unavailable/null rendering.
5. Replace the current NY clock label with a correct ET display.
6. Add freshness badges:
   - `live`
   - `delayed`
   - `stale`
7. Preserve current scan-board speed and compactness.

### Acceptance Criteria

1. No card or panel shows duplicate hourly labels.
2. No card shows raw `fortress`, `strong`, or `moderate` without translation.
3. Missing long-lookback indicators render as unavailable, not `0.00`.
4. The board shows a trustable ET time/freshness context.
5. The strongest confluence presentation explains what the zone means for trade bias.

### Required Tests

Unit:
1. Confluence translator maps internal labels to trader-facing copy.
2. Hourly-level normalizer removes duplicate source/price rendering.
3. Indicator formatter renders unavailable instead of zero when lookback is insufficient.

Integration:
1. `buildSnapshot()` returns normalized level sources and deduped hourly ladder fields.
2. Snapshot payload preserves old fields needed by V1 UI while adding translated fields.

Component:
1. Board card renders translated zone copy.
2. Board card never renders duplicated hourly text.
3. Board card renders unavailable indicators correctly.

### Slice 2.2: Underlying Execution-Plan Engine

### Objective

Introduce the canonical execution-plan model that turns a Money Maker signal into an actionable intraday plan.

### Scope

1. Extend shared types for:
   - execution state
   - trigger distance
   - entry quality
   - target ladder
   - invalidation reason
   - hold / reduce / exit guidance
2. Add execution-state evaluator.
3. Add execution-plan builder.
4. Add target 2 selection logic from the next level beyond target 1.
5. Add chase-threshold and time-of-day evaluation.

### Acceptance Criteria

1. Every active signal can produce a deterministic execution plan.
2. Plan values are derived only from canonical underlying signal fields plus current price context.
3. The state machine behaves deterministically across watching, armed, triggered, extended, target, and failed conditions.
4. Every plan includes a structural invalidation reason.

### Required Tests

Unit:
1. long and short trigger derivation
2. ideal / acceptable / late entry quality
3. extended-state threshold
4. target 1 and target 2 selection
5. late-session policy
6. invalidation and failed-state transitions

Integration:
1. plan builder derives from actual snapshot fixtures
2. target ladder is correct for both directions
3. execution plan remains stable when no contracts are requested

### Slice 2.3: Single-Leg Contract-Guidance Engine

### Objective

Add deterministic contract guidance that expresses the underlying KCU plan using only long calls or long puts.

### Scope

1. Reuse options-chain infrastructure through a Money Maker contract-guide builder.
2. Enforce:
   - calls only for bullish
   - puts only for bearish
3. Apply DTE, delta, liquidity, volume, OI, and spread filters.
4. Rank at most three candidates:
   - primary
   - conservative
   - lower_cost
5. Return plain-English explanation strings.
6. Add degraded-mode response when no valid candidates survive.

### Acceptance Criteria

1. No bearish plan can surface a call.
2. No bullish plan can surface a put.
3. No spreads or multi-leg language can appear anywhere in payloads or UI.
4. Illiquid or stale candidates are filtered out.
5. Failure to fetch valid chain data preserves the underlying execution plan.

### Required Tests

Unit:
1. direction mapping
2. DTE and delta filters
3. spread rejection
4. OI/volume exceptions
5. candidate ranking explanations

Integration:
1. mocked-chain route tests for bullish calls only
2. mocked-chain route tests for bearish puts only
3. degraded chain-data response contract

### Slice 2.4: Workspace APIs And Persistence

### Objective

Expose per-symbol execution guidance through explicit APIs and optional persistence of guidance snapshots.

### Scope

1. Add backend endpoints for:
   - workspace
   - plan
   - contracts
2. Add Next member proxy routes with existing access-control pattern.
3. Add persistence tables for:
   - guidance snapshots
   - contract-guidance snapshots
4. Keep `snapshot` lightweight and unchanged as the fast board feed.

### Acceptance Criteria

1. Workspace requests are on-demand and symbol-scoped.
2. Route auth matches existing Money Maker admin/member boundaries exactly.
3. Degraded chain data returns a successful workspace payload with plan data intact.
4. Persistence is append-safe and traceable by symbol and generated time.

### Required Tests

Integration:
1. backend auth tests
2. member proxy auth tests
3. workspace payload shape tests
4. degraded-mode route tests
5. persistence contract tests

Migration validation:
1. table existence
2. indexes
3. insert/read contract

### Slice 2.5: Board Upgrade And Planner Workspace UI

### Objective

Add the visual workspace and upgrade the board so a trader can move from scan to plan without leaving the product.

### Scope

Board:
1. entry-state badge
2. trigger distance
3. entry-quality pill
4. target-progress summary
5. `Open Plan` action

Workspace:
1. `Setup Map`
2. `Trade Plan`
3. `Contracts`
4. `Exit Playbook`

Visual requirements:
1. intraday ladder or compact chart overlay
2. price lines for trigger, stop, VWAP, 8 EMA, 21 EMA, ORB, open, target 1, target 2
3. plain-English KCU explanation blocks
4. degraded-state panels when contracts are unavailable

### Acceptance Criteria

1. A trader can open a plan from the board in one action.
2. The board stays compact and scan-first.
3. The workspace answers:
   - why actionable
   - where to enter
   - when not to chase
   - where invalid
   - what contract is best
   - when to exit
4. All labels are trader-facing and plain English.

### Required Tests

Component:
1. board card renders new state and trigger summaries
2. workspace tabs render expected content
3. degraded-state panels preserve plan visibility

E2E:
1. open plan from board
2. switch tabs
3. bullish setup shows calls-only contracts
4. bearish setup shows puts-only contracts

### Slice 2.6: Exit Playbook, Transition Alerts, And Trust Cues

### Objective

Complete the intraday execution loop with exit guidance, target progress, and alerting/trust surfaces.

### Scope

1. Add exit playbook state rendering.
2. Add target progress:
   - `T1 pending`
   - `At T1`
   - `T2 in play`
   - `Failed after trigger`
3. Add in-app transition alerts for:
   - armed
   - triggered
   - target 1 hit
   - failed
4. Add stale-data and delayed-data warnings in both board and workspace.
5. Add explicit copy when the plan should not be chased or should not be newly entered late in session.

### Acceptance Criteria

1. Transition alerts fire once per state change, not every poll cycle.
2. Exit guidance remains KCU-specific and direction-specific.
3. Stale or degraded data is obvious without reading console logs.
4. Users can distinguish between a valid hold and a bad fresh entry.

### Required Tests

Unit:
1. state-transition dedupe logic
2. stale-data thresholds

Component:
1. transition alert rendering
2. stale/degraded banners
3. exit-playbook content by state and direction

E2E:
1. simulated state change produces one alert
2. stale-data state changes the visible trust badge

### Slice 2.7: Validation, Rollout, And Release Closure

### Objective

Prove the full feature works in local, test, and deployed environments before it is called production-ready.

### Scope

1. Full targeted lint, typecheck, unit, integration, component, E2E, and build gates.
2. Post-deploy smoke on the live environment.
3. Release notes and runbook updates.
4. Deployed SHA capture.

### Acceptance Criteria

1. No unresolved P0/P1 defects remain.
2. Full test matrix is green.
3. Deployed smoke proves:
   - board loads
   - plan opens
   - calls/puts direction mapping is correct
   - degraded mode preserves plan
   - no raw engine jargon leaks
4. Release evidence is recorded in the execution tracker.

### Required Tests

Run all mandatory release gates from the quality protocol plus post-deploy smoke.

## 6. Test Matrix

| Surface | Unit | Integration | Component | E2E | Smoke |
|---|---|---|---|---|---|
| Level normalization and zone translation | Required | Required | Required | Optional | Visual verification |
| Execution-plan state model | Required | Required | Optional | Optional | Indirect |
| Contract guidance | Required | Required | Optional | Required | Required |
| Workspace routes and auth | Optional | Required | Optional | Optional | Required |
| Board upgrades | Optional | Optional | Required | Required | Required |
| Exit playbook and alerts | Required | Optional | Required | Required | Required |
| Staleness and degraded states | Required | Required | Required | Required | Required |

## 7. Validation Sequence

Implementation and validation must follow this order:

1. Add failing tests for the slice.
2. Implement the smallest change set that satisfies the slice.
3. Run targeted slice gates.
4. Update change control, risk register, and tracker.
5. After all slices are complete, run release gates.
6. Deploy to target environment.
7. Run post-deploy smoke and record evidence.

No slice may skip step 1 or step 4.

## 8. Commands

Slice-level minimum:

```bash
pnpm exec eslint <touched frontend/app files>
pnpm exec eslint --no-ignore <touched backend files>
pnpm exec tsc --noEmit
pnpm --dir backend exec tsc --noEmit
pnpm exec vitest run <targeted money-maker frontend/shared suites>
pnpm --dir backend exec jest <targeted money-maker backend suites> --runInBand
```

Release-level minimum:

```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
pnpm --dir backend exec tsc --noEmit
pnpm exec vitest run <money-maker frontend/shared suites>
pnpm --dir backend exec jest <money-maker backend suites> --runInBand
pnpm exec playwright test e2e/specs/members/money-maker*.spec.ts --project=chromium --workers=1
pnpm build
```

## 9. Release Checklist

Blocking:
1. duplicate-level-label bug fixed
2. plain-English zone copy shipped
3. execution plan visible
4. do-not-chase visible
5. target 1 and target 2 visible
6. exit playbook visible
7. calls/puts direction mapping verified
8. no multi-leg output
9. stale/degraded warnings visible
10. deployed smoke evidence recorded

## 10. Explicit Non-Goals

These are not part of this plan:
1. broker integration
2. order routing
3. automatic order staging
4. account-aware sizing
5. spreads or multi-leg option strategies
6. P&L synced to broker fills
