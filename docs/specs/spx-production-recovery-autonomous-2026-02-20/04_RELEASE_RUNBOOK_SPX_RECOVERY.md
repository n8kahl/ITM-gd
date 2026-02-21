# Release Runbook: SPX Command Center Recovery
Date: February 20, 2026

## 1. Objective
Provide a deterministic release procedure for autonomous SPX recovery delivery.

## 2. Preconditions
1. Target phases for release are marked complete.
2. Blocking quality gates are green.
3. Rollback plan is validated.
4. Release branch contains only intentional SPX-recovery changes.

## 3. Release Inputs
1. Baseline recovery spec:
- `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_PRODUCTION_RECOVERY_EXECUTION_SPEC_2026-02-20.md`
2. Autonomous packet documents:
- `/Users/natekahl/ITM-gd/docs/specs/spx-production-recovery-autonomous-2026-02-20/*`
3. Latest passing CI artifacts and test reports.

## 4. Pre-Release Checklist
1. Confirm Node runtime requirement (Node >= 22 for official release run).
2. Confirm feature-flag defaults match approved release posture.
3. Confirm production environment variables for SPX endpoints are correct.
4. Confirm on-call owner and incident channel are assigned.

## 5. Release Gate Commands
Run from repository root.

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm build
pnpm vitest run lib/spx/__tests__/...
pnpm playwright test e2e/spx-*.spec.ts --project=chromium
```

## 6. Artifact Capture Requirements
Store or link:
1. Lint/type/build outputs.
2. Unit/integration/E2E summaries.
3. Manual QA checklist completion notes.
4. Final feature-flag state snapshot.
5. Release notes with included phases and known limitations.

## 7. Deployment Sequence
1. Merge approved release branch.
2. Deploy to staging.
3. Run staging smoke suite:
- state machine path
- coach lane behavior
- command palette and primary CTA behavior
- chart interactions and feed health transitions
4. If staging is green, deploy to production.
5. Run production smoke checklist (read-only + safe interactions).

## 8. Post-Deploy Verification (first 30 minutes)
1. Monitor feed health transitions and fallback counts.
2. Monitor command latency and interaction error events.
3. Monitor coach/contract endpoint error rates.
4. Validate no unexpected alert storm from retry behavior.

## 9. Go/No-Go Rules
Go only if:
1. All gates pass.
2. No active `P0/P1` defect.
3. Rollback can be executed immediately if needed.

No-Go triggers:
1. Failing critical E2E path.
2. Regression in state machine safety behavior.
3. Unbounded request retries or feed trust instability.

## 10. Release Notes Minimum Content
1. Included phases/slices.
2. User-visible improvements.
3. Risk and mitigation summary.
4. Flags changed and default states.
5. Rollback instructions reference.

## 11. Completion Criteria
Release is complete when:
1. Production smoke checks pass.
2. Monitoring confirms stability window.
3. Documentation artifacts are finalized.
