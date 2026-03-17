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
| MM-R7 | 2026-03-16 | P1 | Engine | Live patience-candle detection was checking the current close price instead of the confluence zone, so setup qualification could pass without actually touching the target level. | Pass the full zone into patience-candle detection and add fixture coverage for zone-aware matching. | Eng | Closed | Closed in `P2-S2`; both backend and shared detector logic now accept a level zone and snapshot regression proves the wiring. |
| MM-R8 | 2026-03-16 | P1 | Engine | Live strategy routing hardcoded advanced context flags (`VWAP reclaim`, `previous-day trend`, `steep trend`), leaving multiple KCU branches effectively unreachable. | Derive routing inputs from fetched bars and lock them with helper-level tests. | Eng | Closed | Closed in `P2-S2`; Advanced VWAP, EMA bounce, fib, cloud, and hourly-trend gating now use derived context instead of placeholders. |
| MM-R9 | 2026-03-16 | P1 | Engine | The detector only evaluated the newest bar, so a valid patience candle from the immediately prior completed candle could be missed. | Scan the most recent completed bars and add regression coverage for the latest valid candidate. | Eng | Closed | Closed in `P2-S2`; snapshot regression now proves signal emission from the latest valid completed bar. |
| MM-R10 | 2026-03-16 | P1 | Engine | Cloud Strategy was present in the router contract but the repo did not compute Ripster cloud levels, so that branch was not live despite the strategy label existing in spec/tests. | Add a source-backed 34/50 Ripster cloud implementation on the active 10-minute chart and lock it with snapshot regression coverage. | Eng | Closed | Closed in `P2-S2`; snapshot regression now proves the afternoon detector emits Ripster Cloud 34 EMA and Ripster Cloud 50 EMA inputs when history is sufficient. |

## 3. Decision Log

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| MM-D1 | 2026-03-10 | Treat Money Maker as a remediation program, not a hardening patch. | Current defects span auth, engine correctness, test depth, and deployment trust. | Work is phased and release claims are blocked until all critical gates are satisfied. |
| MM-D2 | 2026-03-10 | Require failing or missing-contract tests to be added before fixing behavior in each phase. | Prior process allowed implementation changes without proving the defect at the correct layer. | Baseline test authoring becomes Phase 0. |
| MM-D3 | 2026-03-10 | Require post-deploy smoke evidence for release closure. | The UI screenshot indicates validated local behavior may not match deployed behavior. | Release notes must include environment and commit evidence. |
| MM-D4 | 2026-03-10 | Do not accept "known gaps" for P0/P1 test layers. | This feature is a trading signal surface and cannot rely on optimistic interpretation. | Missing E2E or engine fixtures blocks release. |
| MM-D5 | 2026-03-10 | Add an E2E-only admin role override to the bypass auth harness. | Playwright needed a way to exercise authorized admin-only member flows without weakening the real runtime contract. | Admin-path E2E coverage is possible while the override remains gated behind `NEXT_PUBLIC_E2E_BYPASS_AUTH=true`. |
| MM-D6 | 2026-03-16 | Implement Cloud Strategy from source-backed Ripster guidance rather than a guessed EMA pair. | The remediation slice needed live cloud inputs, but only if the pairings could be justified from source material. | `P2-S2` uses the 34/50 EMA cloud on the active 10-minute chart and records that assumption explicitly in code/tests/docs. |

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
