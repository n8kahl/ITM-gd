# Risk Register And Decision Log: Money Maker Production Remediation

Date: 2026-03-10

## 1. Usage

Update this file whenever:
- a new material risk is found
- a risk is mitigated or accepted
- an architecture or rollout decision changes the remediation path

## 2. Risk Register

| ID | Date | Severity | Area | Description | Mitigation | Owner | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| MM-R1 | 2026-03-10 | P1 | Auth | Backend Money Maker routes do not enforce admin-only access. | Add backend admin gate and direct-backend auth tests. | Eng | Closed | Closed in `P1-S1`; direct backend auth tests now enforce `401/403/200` contracts. |
| MM-R2 | 2026-03-10 | P1 | Engine | R:R target selection uses placeholder +/-1 percent math. | Replace with actual next hourly support/resistance selection and fixture tests. | Eng | Mitigated | Closed for the baseline fixture harness in `P2-S1`; broader engine regression coverage still expands in later slices. |
| MM-R3 | 2026-03-10 | P1 | Engine | Confluence inputs are incomplete and Fibonacci wiring is broken. | Implement spec-required levels and deterministic fixture coverage. | Eng | Mitigated | ORB/open/hourly/fib inputs now exist in `snapshotBuilder`; further phase-level validation remains. |
| MM-R4 | 2026-03-10 | P2 | UI/Data Flow | Polling can overlap with long-running snapshots and create stale-race conditions. | Add single-flight or abort behavior and last-good-state retention tests. | Eng | Closed | Closed in `P3-S1`; polling now uses single-flight snapshot fetches and retains the last good render while degraded. |
| MM-R5 | 2026-03-10 | P1 | Release Process | Existing release evidence is too shallow to justify production-readiness. | Require route, engine, UI, E2E, and post-deploy evidence. | Eng | Open | Local route, engine, UI, and Playwright evidence now exist; post-deploy smoke and deployed-SHA evidence still block closure. |
| MM-R6 | 2026-03-10 | P2 | Deployment Drift | Validated branch may not match deployed environment. | Add deployed SHA verification and live smoke gate. | Eng | Open | Release-blocking until smoke protocol exists. |

## 3. Decision Log

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| MM-D1 | 2026-03-10 | Treat Money Maker as a remediation program, not a hardening patch. | Current defects span auth, engine correctness, test depth, and deployment trust. | Work is phased and release claims are blocked until all critical gates are satisfied. |
| MM-D2 | 2026-03-10 | Require failing or missing-contract tests to be added before fixing behavior in each phase. | Prior process allowed implementation changes without proving the defect at the correct layer. | Baseline test authoring becomes Phase 0. |
| MM-D3 | 2026-03-10 | Require post-deploy smoke evidence for release closure. | The UI screenshot indicates validated local behavior may not match deployed behavior. | Release notes must include environment and commit evidence. |
| MM-D4 | 2026-03-10 | Do not accept "known gaps" for P0/P1 test layers. | This feature is a trading signal surface and cannot rely on optimistic interpretation. | Missing E2E or engine fixtures blocks release. |
| MM-D5 | 2026-03-10 | Add an E2E-only admin role override to the bypass auth harness. | Playwright needed a way to exercise authorized admin-only member flows without weakening the real runtime contract. | Admin-path E2E coverage is possible while the override remains gated behind `NEXT_PUBLIC_E2E_BYPASS_AUTH=true`. |

## 4. Update Template

```md
### Risk Update
- ID:
- Date:
- Change:
- Why:
- New status:
- Evidence:
```

```md
### Decision Update
- ID:
- Date:
- Decision:
- Reason:
- Consequence:
```
