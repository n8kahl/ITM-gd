# Rollback and Incident Runbook: SPX Command Center Recovery
Date: February 20, 2026

## 1. Purpose
Define the exact response process for production regressions during or after autonomous SPX recovery deployment.

## 2. Incident Severity Tiers
1. `SEV-1`: unsafe trade-state behavior, broken primary CTA safety, or widespread outage.
2. `SEV-2`: major functional degradation with usable fallback.
3. `SEV-3`: localized defects with workarounds.

## 3. Immediate Containment Actions
Execute in order:
1. Freeze new SPX deploys.
2. Identify active incident severity.
3. Disable high-risk flags if relevant:
- `spatialHudV1`
- `coachDecisionV2`
- `coachHistoryDrawerV1`
- other newly introduced optional capabilities
4. Switch affected capabilities to deterministic fallback modes.
5. Notify stakeholders and open incident timeline log.

## 4. Rollback Decision Rules
Rollback immediately when any condition is true:
1. State machine safety is violated (`in_trade` with entry CTA, invalid transition actions).
2. Contract recommendation path is unavailable and no safe fallback exists.
3. Feed trust logic misclassifies stale/degraded states leading to misleading UI.
4. Error rates exceed acceptable thresholds with no rapid mitigation.

## 5. Rollback Procedure
1. Revert to last known stable release tag/build.
2. Confirm feature flags are set to stable defaults.
3. Re-run production smoke checks:
- state flow
- command palette
- coach now lane
- contract alternative/revert
- chart baseline render
4. Continue monitoring for 30 minutes.

## 6. Data and Audit Preservation
During incident handling:
1. Preserve relevant logs and telemetry slices.
2. Preserve screenshots or session traces of failing behavior.
3. Preserve current flag state and recent changes.
4. Record exact rollback timestamp and operator.

## 7. Communication Protocol
1. Initial incident message within 5 minutes.
2. Status updates every 15 minutes for `SEV-1/SEV-2`.
3. Resolution summary with root cause and mitigation.
4. Follow-up action list with owners and dates.

## 8. Post-Incident Requirements
Before resuming autonomous execution:
1. Root cause documented in decision log.
2. Regression tests added for the failure class.
3. Risk register updated with preventive controls.
4. Re-entry approval against release gates.

## 9. Recovery Exit Criteria
Incident is resolved when:
1. Stable behavior verified in production.
2. No new high-severity alerts in observation window.
3. All temporary incident toggles are documented.
4. Next-step remediation plan is approved.
