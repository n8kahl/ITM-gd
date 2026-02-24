# SPX Command Center Phase 18 — Phase D Slice 1

Date: 2026-02-23  
Owner: Codex autonomous implementation  
Status: Implemented (feature-flagged rollout)

## Scope delivered

- Added `newsSentimentService` for SPX ecosystem headline ingestion and sentiment scoring.
- Added `eventRiskGate` as a dedicated risk layer for macro + news-driven gating.
- Integrated event-risk output into `environmentGate` while preserving default behavior behind flags.

## Backend changes

- `backend/src/services/spx/newsSentimentService.ts` (new)
  - Pulls Massive news for `SPX`, `SPY`, `VIX`.
  - Classifies article sentiment and market-moving impact.
  - Produces cached aggregate snapshot:
    - `bias`, `score`, `marketMovingCount`, `recentHighImpactCount`.
  - Includes optional polling helper (`startSPXNewsSentimentPolling`).

- `backend/src/services/spx/eventRiskGate.ts` (new)
  - Evaluates macro/news risk into a normalized decision:
    - `passed`, `caution`, `blackout`, `riskScore`, `source`, `reason`.
  - Supports blackout escalation for breaking high-impact extreme news flow.

- `backend/src/services/spx/environmentGate.ts`
  - Added optional input overrides:
    - `newsSentiment`
    - `eventRiskOverride`
  - Added feature flags:
    - `SPX_EVENT_RISK_GATE_ENABLED`
    - `SPX_NEWS_SENTIMENT_ENABLED`
  - Integrates event-risk into:
    - pass/fail decision
    - reason stack
    - caution status
    - dynamic threshold caution input
  - Extends standby reason mapping for news-flow conditions.

- `backend/src/services/spx/types.ts`
  - Added optional `breakdown.eventRisk` on `SPXEnvironmentGateDecision`.

- `lib/types/spx-command-center.ts`
  - Added matching optional `breakdown.eventRisk` shape.

- `backend/src/config/env.ts`
  - Added:
    - `SPX_EVENT_RISK_GATE_ENABLED`
    - `SPX_NEWS_SENTIMENT_ENABLED`

- `backend/.env.example`
  - Added both new env examples.

## Tests

- Added:
  - `backend/src/services/spx/__tests__/newsSentimentService.test.ts`
  - `backend/src/services/spx/__tests__/eventRiskGate.test.ts`

- Updated:
  - `backend/src/services/spx/__tests__/environmentGate.test.ts`
    - event-risk blackout override path coverage

## Validation run

- `pnpm --dir backend exec tsc --noEmit`
- `pnpm exec tsc --noEmit`
- `pnpm --dir backend test -- --runInBand src/services/spx/__tests__/environmentGate.test.ts src/services/spx/__tests__/eventRiskGate.test.ts src/services/spx/__tests__/newsSentimentService.test.ts src/services/spx/__tests__/marketSessionService.test.ts src/services/spx/__tests__/flowAggregator.test.ts src/services/spx/__tests__/zoneQualityEngine.test.ts src/services/spx/__tests__/memoryEngine.test.ts src/services/spx/__tests__/outcomeTracker.test.ts src/services/spx/__tests__/multiTFConfluence.test.ts src/services/spx/__tests__/evCalculator.test.ts src/services/spx/__tests__/setupDetector.test.ts`

All commands passed (`11` suites, `48` tests).

## Rollout guidance

- Defaults are off:
  - `SPX_EVENT_RISK_GATE_ENABLED=false`
  - `SPX_NEWS_SENTIMENT_ENABLED=false`
- Enable staged:
  1. `SPX_NEWS_SENTIMENT_ENABLED=true` (observe sentiment snapshots only)
  2. `SPX_EVENT_RISK_GATE_ENABLED=true` (activate risk gating behavior)
- Monitor:
  - standby frequency and reason mix
  - dynamic threshold changes during headline spikes
  - false trigger rate in high-news windows
