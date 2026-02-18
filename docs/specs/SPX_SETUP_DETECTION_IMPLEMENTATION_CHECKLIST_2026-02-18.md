# SPX Setup Detection Implementation Checklist

**Date:** February 18, 2026  
**Branch:** `codex/spx-setup-detection-spec`  
**Parent spec:** `docs/specs/SPX_SETUP_DETECTION_PRODUCTION_SPEC_2026-02-18.md`

## 1. Delivery Strategy

- Sequencing model: backend-first consistency, then frontend surfacing, then monitoring hardening.
- Rollout style: gated rollout with explicit feature flags and fallback behavior.
- Priority: correctness and trust > feature breadth.

## 2. Phase Plan

## Phase 0: Flags, contracts, and telemetry scaffolding

### Backend tasks
- Add SPX setup-detection feature flags and thresholds to config.
  - Files:
    - `backend/src/config/index.ts`
    - `backend/src/config/env.ts`
- Define shared event payload contracts for setup lifecycle transitions.
  - Files:
    - `backend/src/services/spx/types.ts`
    - `backend/src/services/websocket.ts`

### Frontend tasks
- Add client capability flags and safe defaults.
  - Files:
    - `contexts/SPXCommandCenterContext.tsx`
    - `components/spx-command-center/spx-header.tsx`

### Telemetry tasks
- Add counters and timing for:
  - transition latency
  - invalidation reason
  - setup count after filtering
  - top-2 selection stability
- Files:
  - `backend/src/services/spx/setupDetector.ts`
  - `backend/src/services/spx/tickEvaluator.ts`
  - `backend/src/services/websocket.ts`
  - frontend analytics entry points in `components/spx-command-center/*`

### Exit gate
- Feature flags off by default.
- No behavior change in production path when flags are off.

## Phase 1: Lifecycle + invalidation engine

### Backend tasks
- Implement full setup state machine transitions:
  - `forming -> ready -> triggered -> invalidated/closed`
- Implement TTL expiry and reason codes.
- Implement invalidation rules (stop breach confirmation, regime break, flow contradiction).
- Files:
  - `backend/src/services/spx/setupDetector.ts`
  - `backend/src/services/spx/tickEvaluator.ts`
  - `backend/src/services/spx/utils.ts`
  - `backend/src/services/spx/types.ts`

### Data/output tasks
- Include `statusUpdatedAt`, `invalidationReason`, `ttlExpiresAt` in setup payload.
- Files:
  - `backend/src/services/spx/types.ts`
  - `backend/src/services/spx/index.ts`

### Tests
- Add/expand state-machine monotonicity and invalidation tests.
  - `backend/src/services/spx/__tests__/setupDetector.test.ts`
  - `backend/src/services/spx/__tests__/tickEvaluator.test.ts`

### Exit gate
- No stale setup survives past TTL.
- Invalidation events are deduped and monotonic.

## Phase 2: EV ranking and calibrated actionability tiers

### Backend tasks
- Add EV calculator and actionability tiering (`sniper_primary`, `sniper_secondary`, `watchlist`, `hidden`).
- Add regime-specific weight tables and scoring penalties.
- Files:
  - `backend/src/services/spx/setupDetector.ts`
  - `backend/src/services/spx/regimeClassifier.ts`
  - `backend/src/services/spx/types.ts`

### Data tasks
- Add fields to setup payload:
  - `score`, `evR`, `pWinCalibrated`, `tier`, `rank`
- Files:
  - `backend/src/services/spx/types.ts`
  - `backend/src/services/spx/index.ts`

### Tests
- Ranking deterministic tests with fixed fixtures.
  - `backend/src/services/spx/__tests__/setupDetector.test.ts`

### Exit gate
- Feed ranking is deterministic for same input snapshot.
- Tier boundaries match spec thresholds.

## Phase 3: Top-2 sniper UI and hyper-focus flow

### Frontend tasks
- Show only top 2 actionable setups by default.
- Add collapsed “other setups” queue.
- Keep compression-day opposite-direction suppression logic.
- Files:
  - `components/spx-command-center/setup-feed.tsx`
  - `components/spx-command-center/setup-card.tsx`
  - `contexts/SPXCommandCenterContext.tsx`

### Hyper-focus tasks
- Enforce scoped mode when user enters trade focus.
- Restrict coach panel and right-rail content to focused setup plus one hedge candidate.
- Files:
  - `contexts/SPXCommandCenterContext.tsx`
  - `components/spx-command-center/ai-coach-feed.tsx`
  - `components/spx-command-center/action-strip.tsx`
  - `components/spx-command-center/spx-header.tsx`

### Tests
- Add UI state tests for:
  - top-2 policy
  - enter/exit focus
  - blocked setup switching while focused
- Files:
  - `components/spx-command-center/__tests__/*` (create if missing)

### Exit gate
- Default surface never shows more than 2 primary setups.
- Focus mode is explicit and reversible.

## Phase 4: Contract health scoring + alternatives

### Backend tasks
- Add contract health model (spread/liquidity/theta/iv penalties).
- Return top recommendation + 2 alternatives with rationale tags.
- Files:
  - `backend/src/services/spx/contractSelector.ts`
  - `backend/src/services/spx/types.ts`
  - `backend/src/services/spx/index.ts`

### Frontend tasks
- Render health score color tier and alternative contracts list.
- Add expanded metrics for cost/quality visibility.
- Files:
  - `components/spx-command-center/contract-selector.tsx`
  - `components/spx-command-center/contract-card.tsx`
  - `components/spx-command-center/setup-card.tsx`

### Tests
- Contract scoring unit tests with fixture-based spread/liquidity cases.
  - `backend/src/services/spx/__tests__/contractSelector.test.ts`

### Exit gate
- Every recommendation includes health classification and clear tradeoffs.

## Phase 5: SPY -> SPX impact conversion and chart labeling

### Backend tasks
- Add rolling beta-based SPY impact projection in SPX points.
- Output confidence band and source metadata.
- Files:
  - `backend/src/services/spx/crossReference.ts`
  - `backend/src/services/spx/types.ts`

### Frontend tasks
- Add chart labels and side panel for SPY level -> projected SPX level.
- Replace ambiguous “derived levels” wording with point-impact wording.
- Files:
  - `components/spx-command-center/spx-chart.tsx`
  - `components/spx-command-center/decision-context.tsx`
  - `components/spx-command-center/level-matrix.tsx`

### Tests
- Unit tests for projection math.
  - `backend/src/services/spx/__tests__/crossReference.test.ts`

### Exit gate
- Users can read SPY impact in SPX points at a glance.

## Phase 6: Realtime alignment and 1m default hardening

### Backend tasks
- Enforce consistent price authority for:
  - chart updates
  - setup trigger evaluation
  - header last price
- Files:
  - `backend/src/services/massiveTickStream.ts`
  - `backend/src/services/tickCache.ts`
  - `backend/src/services/spx/tickEvaluator.ts`
  - `backend/src/services/websocket.ts`

### Frontend tasks
- Always default to 1m timeframe on mount.
- Add stale/lag diagnostics when fallback feed is active.
- Files:
  - `components/spx-command-center/spx-chart.tsx`
  - `contexts/SPXCommandCenterContext.tsx`
  - `components/spx-command-center/spx-header.tsx`

### Tests
- Integration tests for websocket + snapshot fallback and chart freshness.
  - `backend/src/__tests__/integration/spx-websocket.test.ts`
  - `backend/src/__tests__/integration/spx-api.test.ts`

### Exit gate
- Chart/setup/header price mismatch p95 <= 0.25 points.
- 1m is default after every route entry/reload.

## 3. Rollout and Environment Plan

- Dev:
  - enable all flags
  - synthetic replay validation
- Staging:
  - enable through Phase 3 first
  - run one full market session validation
- Production:
  - progressive rollout by capability flag:
    - lifecycle/ev
    - top-2 UI/focus
    - contract health
    - spy impact
    - realtime hardening

Rollback:
- Disable phase flag and revert to existing snapshot-first setup list.
- Keep websocket fallback to polling path intact.

## 4. QA Matrix

- Functional:
  - state transitions
  - focus mode
  - contract alternatives
  - SPY impact labels
- Data quality:
  - stale setup removal
  - duplicate transition suppression
  - ranking determinism
- Performance:
  - frame stability under active tick feed
  - route transition time
  - API p95 latency for snapshot and contract selection

## 5. Production Readiness Checklist

- [ ] Flags and defaults merged.
- [ ] Schema/type changes backward compatible.
- [ ] Unit/integration tests pass in CI.
- [ ] One replay runbook captured for a full market session.
- [ ] Dashboards for transition latency and feed health live.
- [ ] Alerting thresholds configured (tick gap, transition errors, contract scoring failures).
- [ ] On-call rollback steps documented.

## 6. Suggested Execution Order (Practical)

1. Phase 0 + Phase 1 in same PR set (core correctness).
2. Phase 2 (EV/tiering) next.
3. Phase 3 (top-2/focus UX) next.
4. Phase 4 and 5 parallelizable after phase 2.
5. Phase 6 last with a dedicated stability burn-in window.

