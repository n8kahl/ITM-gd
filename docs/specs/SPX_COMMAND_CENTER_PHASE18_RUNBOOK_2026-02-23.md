# SPX Command Center Phase 18 Runbook

Date: 2026-02-23  
Status: Draft for release execution  
Owner: Engineering

## 1. Scope in production

Phase 18 introduces strategic intelligence and quality gating for SPX 0DTE coaching, including:

- environment-aware standby gating
- weighted + multi-timeframe confluence
- adaptive EV model
- trigger context capture and latency display
- persisted level-touch history (`spx_level_touches`)
- flow intelligence windows (5m/15m/30m)
- optimizer profile refresh / walk-forward guardrails

## 2. Pre-deploy checklist

- Verify branch CI/build status is green.
- Confirm frontend build success (`pnpm run build`).
- Confirm backend build success (`pnpm --dir backend run build`).
- Confirm SPX E2E suite pass (`e2e/spx-*.spec.ts`).
- Confirm backend SPX critical tests pass (`setupDetector`, `flowAggregator`).
- Confirm environment flags exist and are set for staged rollout.
- Confirm migration `20260327020000_add_spx_level_touches_table.sql` is applied before market-open rollout.

## 3. Required environment flags

Backend:

- `SPX_MULTI_TF_CONFLUENCE_ENABLED`
- `SPX_WEIGHTED_CONFLUENCE_ENABLED`
- `SPX_ADAPTIVE_EV_ENABLED`
- `SPX_EVENT_RISK_GATE_ENABLED`
- `SPX_NEWS_SENTIMENT_ENABLED`
- `SPX_EV_SLIPPAGE_R`
- `SPX_SETUP_VIX_STOP_SCALING_ENABLED`
- `SPX_SETUP_GEX_MAGNITUDE_STOP_SCALING_ENABLED`

Rollout order:

1. Enable read/observe flags first (`SPX_NEWS_SENTIMENT_ENABLED=true`).
2. Enable scoring/model flags (`SPX_MULTI_TF_CONFLUENCE_ENABLED=true`, `SPX_WEIGHTED_CONFLUENCE_ENABLED=true`, `SPX_ADAPTIVE_EV_ENABLED=true`).
3. Enable adaptive stop scaling (`SPX_SETUP_VIX_STOP_SCALING_ENABLED=true`, `SPX_SETUP_GEX_MAGNITUDE_STOP_SCALING_ENABLED=true`) after confirming stop-width behavior.
4. Enable hard gate (`SPX_EVENT_RISK_GATE_ENABLED=true`) after confirming standby frequency and reason quality.

## 4. Deployment procedure

1. Deploy backend first.
2. Verify `/api/spx/snapshot` returns:
   - `setups`
   - `environmentGate`
   - `standbyGuidance`
   - `flowAggregation`
3. Deploy frontend.
4. Validate UI on `/members/spx-command-center`:
   - setup card shows trigger context when available
   - weighted/multi-TF/adaptive EV panels render when data is present
   - standby block shows nearest setup + conditions + next check
   - flow ticker displays 5m/15m/30m windows

## 5. Smoke test matrix (post deploy)

- Scan mode:
  - actionable setup cards render
  - one-click stage trade still works
- Standby mode:
  - standby reason text is readable/actionable
  - watch zones and next check time display
- In-trade mode:
  - setup selection lock and exit behavior unchanged
- Flow panel:
  - window cards update and primary window selection is stable

## 6. Monitoring and alerting

Track for first 48 hours:

- setup detector failures / snapshot 5xx
- flow aggregation missing or stale
- zero actionable setups for extended market-open periods
- unexpected standby saturation
- increased frontend runtime errors on setup card rendering

Recommended alert thresholds:

- snapshot error rate > 2% over 5 minutes
- no flow events for > 10 minutes during market hours
- no setups for > 30 minutes while market is open

## 7. Rollback criteria

Trigger rollback if any of the following occur:

- setup snapshot instability or crash loop
- gating behavior blocks nearly all setups unexpectedly
- severe UI regressions in command center workflows
- win-rate degradation > 3% vs baseline for two consecutive sessions

## 8. Rollback procedure

1. Immediate mitigation (flags):
   - disable `SPX_EVENT_RISK_GATE_ENABLED`
   - disable `SPX_WEIGHTED_CONFLUENCE_ENABLED`
   - disable `SPX_MULTI_TF_CONFLUENCE_ENABLED`
   - disable `SPX_ADAPTIVE_EV_ENABLED`
2. If issues persist, roll back deployment to previous backend/frontend release.
3. Re-run SPX E2E suite and snapshot smoke checks.

## 9. Known operational debt

- Node engine target is `>=22`; local execution in this checkpoint was Node `v20.19.5`.
- `spx_level_touches` migration (`20260327020000_add_spx_level_touches_table.sql`) has been generated and still needs to be applied in deployment flow.
- `spx_level_touches` is configured for backend service-role access only (`spx_level_touches_rls` migration applied on 2026-02-23).
- public-write RLS hardening tranche applied (`security_policy_hardening_public_writes`, 2026-02-23).
- Supabase advisor scans report pre-existing security/performance findings outside this slice.

## 10. Sign-off template

- Product Owner: [ ]
- Backend Lead: [ ]
- QA Lead: [ ]
- Deployment time (ET): [ ]
- Rollback owner on call: [ ]
