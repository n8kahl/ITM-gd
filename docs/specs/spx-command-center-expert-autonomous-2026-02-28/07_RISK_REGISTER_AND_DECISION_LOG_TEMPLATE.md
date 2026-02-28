# SPX Expert Autonomous Packet — 07 Risk Register and Decision Log
Date: 2026-02-28
Feature: SPX Command Center Expert

## 1. Risk Register

### Open Risks
| ID | Risk | Severity | Owner | Mitigation | Status |
|---|---|---|---|---|---|
| R-001 | External market-data entitlement warnings can obscure signal during ops triage | Medium | Platform/Market Data | Runbook clarifies warnings are non-blocking for mocked E2E; track production entitlement separately | Open (non-blocking) |
| R-002 | Feature-flag misconfiguration could expose partial expert surface in wrong order | Medium | Release Manager | Enforce rollout sequence and approval checkpoints in change-control doc | Open (managed) |
| R-003 | Upstream websocket connection-limit warnings may appear intermittently in logs | Low | Platform | Monitor rate/impact; treat as non-blocking unless user-visible degradation appears | Open (monitoring) |

### Closed Risks
| ID | Risk | Severity | Owner | Mitigation | Closed On |
|---|---|---|---|---|---|
| R-004 | Non-deterministic lifecycle order rendering risk | High | Frontend + Backend | Added deterministic contracts + E2E strict sequence assertions | 2026-02-28 |
| R-005 | Now-focus ambiguity when `nowFocusItemId` missing/unmatched | High | Frontend | Added explicit fallback contract tests | 2026-02-28 |
| R-006 | Duplicate STAGE execution pathways in desktop workflow | High | Frontend | Enforced dedupe contract and aligned panel assertions to primary CTA ownership | 2026-02-28 |

## 2. Decision Log

| Date | Decision ID | Decision | Owner | Rationale | Outcome |
|---|---|---|---|---|---|
| 2026-02-28 | D-001 | Adopt trade-stream lifecycle ascending contract (`forming -> triggered -> past`) as canonical UI order | Product + Engineering | Reduces ambiguity and improves execution scannability | Accepted |
| 2026-02-28 | D-002 | Keep now-focus independent from lifecycle rank and allow deterministic fallback to first row when missing/unmatched | Engineering | Prevents null focus states and preserves deterministic UX | Accepted |
| 2026-02-28 | D-003 | Use coach facts mode with details-only timeline/composer disclosure | Product | Enforces facts-first expert workflow and reduces default cognitive load | Accepted |
| 2026-02-28 | D-004 | Primary CTA owns STAGE execution in dedupe desktop state; row action suppressed accordingly | Engineering | Prevents duplicate actionable pathways and accidental double-entry | Accepted |
| 2026-02-28 | D-005 | Release readiness governed by docs packet + linked evidence from P5-S1/P5-S2 when unchanged | Product + Engineering | Avoids redundant reruns while keeping traceable evidence chain | Accepted |

## 3. Update Protocol
1. Add a new row for every production-impacting risk discovery.
2. Add a decision row for every scope, contract, or rollout change.
3. Never overwrite historical entries; append only.
4. Keep owner assignment explicit for unresolved items.
