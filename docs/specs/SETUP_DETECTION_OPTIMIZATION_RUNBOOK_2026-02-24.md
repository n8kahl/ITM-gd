# Setup Detection Optimization Runbook

Date: 2026-02-24  
Owner: Engineering  
Scope: Production rollout and rollback for optimization slices A1-D7

## 1. Scope

This runbook covers operational rollout for:

- Trigger/lifecycle correctness hardening
- Setup quality-gate recalibration
- Infrastructure reliability controls (timeouts, DLQ, circuit breaker, websocket lifecycle)
- ML-backed scoring/classification with mandatory rule-based fallbacks

## 2. Pre-Deploy Checklist

1. Confirm runtime is Node `>=22`.
2. Confirm all slice commits `A1` through `D7` are present on target branch.
3. Confirm TypeScript check passes: `pnpm exec tsc --noEmit`.
4. Confirm build passes: `pnpm run build`.
5. Confirm targeted suites pass:
   - `pnpm vitest run lib/spx/__tests__/`
   - `pnpm vitest run backend/src/services/scanner/__tests__/`
   - `pnpm vitest run backend/src/services/options/__tests__/`
6. Confirm E2E SPX tests pass:
   - `pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1`
7. Confirm DLQ unresolved count over 48h is zero.

## 3. Required Config and Safety Guards

1. Keep ML and anomaly features behind existing A/B or feature flags.
2. Ensure websocket auth timeout is configured (`AUTH_ACK_TIMEOUT_MS`, default 5000).
3. Keep scanner concurrency bounded (`SCANNER_CONCURRENCY`).
4. Keep fallback behavior active when model artifacts are unavailable.

## 4. Deployment Sequence

1. Apply DB migrations (already landed for C2/C4) on target environment.
2. Deploy backend services first.
3. Verify websocket state transitions and scanner health logs.
4. Deploy frontend/services consuming setup outputs.
5. Run post-deploy smoke checks:
   - setup feed loads and updates
   - setup status transitions occur with candle-close behavior
   - scanner continues returning opportunities under degraded upstream conditions
   - no unresolved DLQ backlog accumulation

## 5. Post-Deploy Validation

1. Run 30-day backtest and archive output under:
   - `docs/specs/evidence/setup-detection-optimization-2026-02-24/`
2. Run journal win-rate comparison (current 30d vs previous 30d).
3. Re-check DLQ unresolved counts (total + last 48h).
4. Update execution spec closure criteria with verified values.

## 6. Rollback Triggers

Rollback or disable newly introduced flags if any of the following occurs:

- Setup trigger regression (missed obvious entries or premature triggers)
- Sustained websocket auth/connect loop failures
- Scanner throughput degradation or sustained timeout errors
- Backtest/journal metrics materially worse than pre-release baseline

## 7. Rollback Procedure

1. Disable ML-dependent scoring paths (keep rule-based fallback active).
2. Disable anomaly-score influence and revert to static thresholds if needed.
3. Revert websocket auth sequencing changes only if polling fallback is healthy.
4. Redeploy last known-good release.
5. Re-run smoke tests and DLQ checks.

## 8. Evidence and Audit Trail

Store command outputs, SQL results, and backtest artifacts in:

- `docs/specs/evidence/setup-detection-optimization-2026-02-24/`

This path is the source of truth for closure criteria evidence.
