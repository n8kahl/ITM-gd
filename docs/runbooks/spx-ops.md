# SPX Command Center Operations Runbook

Last updated: 2026-03-01
Owners: Trading Systems / Backend

## 1) First-response checklist

1. Confirm service health: `GET /health/ready` and `GET /health/detailed`.
2. Confirm tick ingest status: `GET /health/detailed` (`massive_tick_stream`, tick age, provider status).
3. Confirm broker readiness: `tradier` check in `GET /health/ready`.
4. Confirm snapshot quality: `GET /api/spx/snapshot` and inspect `dataQuality.degraded` + stage reasons.
5. Confirm execution engine status: `GET /api/spx/broker/tradier/status`.

## 2) Massive outage / stale tick feed

Symptoms:
- `massive_tick_stream` failed or stale.
- Snapshot `dataQuality` degraded for flow/GEX/levels.
- Websocket feed health transitions to degraded/disconnected.

Immediate actions:
1. Verify Massive API key and websocket config in runtime env.
2. Check tick stream reconnect attempts and provider status logs.
3. Verify only one upstream lock owner is active (see Redis key `massive:tick:stream:lock`).
4. Keep system in degraded mode; do not disable fallback paths.

Recovery:
1. Restore Massive connectivity.
2. Confirm fresh ticks (`SPX` age <= 15s during market active sessions).
3. Force snapshot refresh once: call `GET /api/spx/snapshot?forceRefresh=true`.

## 3) Redis lock contention / coordination issues

Symptoms:
- Repeated lock acquisition failures for tick stream.
- Snapshot build lock waits timing out.

Immediate actions:
1. Check Redis connectivity and latency.
2. Check lock keys:
- `massive:tick:stream:lock`
- `spx_command_center:snapshot:build:lock:v1`
3. Confirm lock TTL expiry is progressing.

Recovery:
1. Restart only the unhealthy instance first.
2. If lock owner is orphaned and TTL is not expiring, restart Redis client/service path.
3. Verify snapshot shared cache repopulates (`spx_command_center:snapshot:shared:v1`).

## 4) Supabase degraded / unavailable

Symptoms:
- Readiness database check fails.
- Setup persistence, execution state, or reconciliation writes fail.

Immediate actions:
1. Validate Supabase status and network path.
2. Monitor critical write paths:
- `spx_setup_instances`
- `spx_execution_active_states`
- `spx_setup_execution_fills`
3. Keep fail-open snapshot serving for read UX where possible.

Recovery:
1. Restore connectivity.
2. Trigger a fresh snapshot and verify setup persistence resumes.
3. Confirm no RLS regressions using schema contract tests in CI.

## 5) Tradier rejects / execution failures

Symptoms:
- Entry or exit orders rejected, canceled, or timing out.
- Increased reject metrics and coach alert messages.

Immediate actions:
1. Check `/health/ready` tradier check.
2. Validate account credentials and sandbox/live mode.
3. Inspect execution logs for order IDs and reject statuses.

Recovery:
1. Pause auto-execution if rejects persist.
2. Use kill switch if any open exposure is uncertain.
3. Validate order lifecycle poller queue recovers and resumes from open states.

## 6) Optimizer failure or drift gate block

Symptoms:
- Optimizer scan/revert endpoints fail.
- Gate reasons indicate drift pause or blocked status.

Immediate actions:
1. Verify optimizer worker health.
2. Verify scorecard/history endpoints:
- `/api/spx/analytics/optimizer/scorecard`
- `/api/spx/analytics/optimizer/history`
3. Confirm execution engine is blocking non-eligible gate statuses.

Recovery:
1. Re-run scan in staging first.
2. Apply/revert profile only after scorecard sanity checks.
3. Confirm blocked setups are not routed to broker.

## 7) Kill switch protocol (cancel + flatten + verify)

Endpoint: `POST /api/spx/broker/tradier/kill`

Operational sequence:
1. Cancel all open execution-linked orders.
2. Flatten SPX option positions with marketable exits.
3. Verify broker state and report remaining positions/failures.
4. Confirm auto-execution is disabled in credential metadata.

Post-action verification:
1. `GET /api/spx/broker/tradier/status` shows execution disabled.
2. No open states remain in `spx_execution_active_states` for impacted user(s).
3. No remaining SPX option positions at broker.

## 8) Rollback guidelines

1. Feature-flag rollback order:
- `executionV2`
- `snapshotQualityV1`
- `optimizerGateEnforcedV1`
- `setupTickSymbolGateV1`
2. Roll back one subsystem at a time; verify health endpoints between steps.
3. Preserve audit trail of rollback event, reason, and timestamp in incident log.
