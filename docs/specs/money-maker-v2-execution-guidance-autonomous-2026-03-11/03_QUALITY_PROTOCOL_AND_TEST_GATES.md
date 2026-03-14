# Quality Protocol And Test Gates: Money Maker V2 Execution Guidance

Date: 2026-03-11
Governing spec: `docs/specs/MONEY_MAKER_V2_EXECUTION_GUIDANCE_SPEC_2026-03-11.md`
Implementation plan: `docs/specs/money-maker-v2-execution-guidance-autonomous-2026-03-11/02_IMPLEMENTATION_PLAN_AND_PRIORITY_MODEL.md`

## 1. Purpose

Define the blocking quality system for Money Maker V2 so execution guidance ships as a trustworthy decision-support layer rather than a visual add-on with weak contract logic.

## 2. Product-Critical Assumptions

These assumptions are release-critical and must be treated as contract surfaces:

1. The underlying KCU setup is authoritative.
2. Contract guidance is subordinate to the underlying plan.
3. Contract output is single-leg only:
   - long calls for bullish setups
   - long puts for bearish setups
4. No spreads or multi-leg outputs can appear anywhere in V2.
5. Options-chain failure must not blank the underlying execution plan.
6. Execution guidance must never imply order placement or broker management.

## 3. Severity Model

1. `P0`
   - wrong direction contract output
   - spreads or multi-leg output in V2
   - incorrect trigger / stop / target ladder
   - route auth failure
   - blank workspace on chain-data failure
   - duplicate or misleading price/level presentation that changes the meaning of a trade plan
2. `P1`
   - wrong entry-quality state
   - incorrect late-session policy
   - invalid contract quality filters
   - missing exit playbook state
   - deterministic data-contract mismatch
   - raw engine jargon or ambiguous labels on trader-facing surfaces
   - stale data presented without warning
3. `P2`
   - degraded but usable workspace behavior
   - non-blocking UI regression
   - missing secondary metric or badge
4. `P3`
   - cosmetic issues only

Blocking rules:
1. No open `P0` or `P1` issues at release candidate.
2. Missing tests for a `P0` or `P1` surface are treated as a `P1` defect.
3. Any divergence between underlying plan and contract guidance direction is `P0`.

## 4. Required Test Layers

### Layer A: Unit

Use for deterministic logic:
- level normalization and ladder dedupe
- zone-label translation
- `executionStateEvaluator`
- `executionPlanBuilder`
- `contractGuideBuilder`
- contract filter policy
- late-session suppression logic
- single-leg direction mapping

### Layer B: Integration

Use for route and persistence contracts:
- board snapshot payload shape after label/laddder normalization
- workspace builder with mocked options-chain inputs
- workspace degraded mode when options data fails
- member proxy auth behavior
- backend route auth behavior
- guidance snapshot persistence
- contract guidance persistence

### Layer C: End-To-End

Use for user-visible workflows:
- board shows translated support/resistance language and no duplicate level labels
- user opens workspace from board
- workspace shows trigger / stop / target ladder
- bullish setup shows calls only
- bearish setup shows puts only
- degraded options state still shows underlying plan
- exit playbook renders correctly

### Layer D: Post-Deploy Smoke

Use for release candidate proof:
- deployed SHA verification
- live page loads with current board data
- board shows trust/freshness cues and no raw internal zone labels
- workspace opens for one symbol
- underlying plan visible
- contract tab shows only calls or only puts based on direction
- no spread or multi-leg language appears

## 5. Slice Gates

Every implementation slice must pass:
1. Targeted lint on touched files.
2. Root typecheck.
3. Backend typecheck if backend files changed.
4. New or updated tests for the touched contract surface.
5. Change-control entry updated with exact results.

Minimum standard:
- no route or shared-type change without test coverage
- no contract-guidance logic merged without deterministic unit tests
- no UI slice merged without at least one state-contract test

## 6. Required Release Commands

```bash
pnpm exec eslint <touched frontend/app files>
pnpm exec eslint --no-ignore <touched backend files>
pnpm exec tsc --noEmit
pnpm --dir backend exec tsc --noEmit
pnpm exec vitest run <money-maker frontend/shared suites>
pnpm --dir backend exec jest <money-maker backend suites> --runInBand
pnpm exec playwright test e2e/specs/members/money-maker*.spec.ts --project=chromium --workers=1
pnpm build
```

## 7. Mandatory Assertions

Release-blocking assertions:

1. A bullish Money Maker workspace cannot render put candidates.
2. A bearish Money Maker workspace cannot render call candidates.
3. No spread, calendar, strangle, or other multi-leg language appears in V2 UI or payloads.
4. Trigger, stop, and target values match the underlying Money Maker signal contract.
5. Entry quality changes deterministically based on price position vs trigger and chase threshold.
6. Late-session suppression is deterministic and visible.
7. Options-chain failure leaves the underlying plan intact and readable.
8. Board surfaces never render duplicate level labels or duplicate embedded prices.
9. Trader-facing UI never exposes raw `moderate`, `strong`, or `fortress` labels without translation.
10. Missing long-lookback indicators render as unavailable, not `0.00`.
11. Stale data is visible through a trust cue before a trader opens the workspace.

## 8. Fixture Requirements

Required deterministic fixtures:
1. Bullish signal with valid call candidates.
2. Bearish signal with valid put candidates.
3. Signal that is already extended beyond chase threshold.
4. Triggered signal that has reached target 1.
5. Failed signal after stop breach.
6. Options-chain failure / empty-chain condition.
7. Late-session scenario where contract guidance is suppressed or strongly cautioned.
8. Snapshot with clustered hourly levels that would duplicate without normalization.
9. Snapshot with insufficient bars for 200 SMA.
10. Snapshot with stale refresh timestamp.

Fixture tests must assert:
1. direction mapping is correct
2. only single-leg output appears
3. contract filters remove illiquid candidates
4. degraded mode preserves the plan
5. exit playbook content matches state and direction
6. level translation stays trader-facing
7. staleness thresholds render correctly

## 9. Manual QA Checklist

Blocking:
1. Board card can open the execution workspace.
2. Workspace shows setup map, trade plan, contracts, and exit playbook.
3. A bullish symbol shows calls only.
4. A bearish symbol shows puts only.
5. No spreads are surfaced anywhere.
6. Contract data failure still leaves the underlying plan visible.
7. `Do not chase` appears when price is too extended.
8. Late-session warning appears when time policy requires it.
9. Board cards show no duplicate level chips and no raw engine jargon.
10. Freshness / delayed state is visible when data is stale.

## 10. Documentation Gates

Before slice close:
1. Change control updated.
2. Risk register updated.
3. Execution tracker updated.

Before release close:
1. Release notes updated with exact evidence.
2. Runbook updated if new operator steps exist.
3. Deployed SHA and smoke proof recorded.

## 11. Final Signoff Conditions

Money Maker V2 execution guidance can be called production-ready only when:
1. No unresolved `P0/P1` issues remain.
2. Single-leg-only behavior is proven in unit, integration, E2E, and smoke evidence.
3. Underlying plan remains visible during chain-data degradation.
4. No route/auth mismatch remains.
5. Final diff review confirms the shipped UX matches the approved spec.
6. Board correctness issues from the execution sweep are closed and proven.
