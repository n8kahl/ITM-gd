# AI Coach Comprehensive Audit Remediation Execution Spec

Date: 2026-03-20
Status: Draft for implementation
Owner: Engineering + Product + Design
Audience: Product, Engineering, QA, Operations

## 1. Purpose

Define a production-grade remediation program for AI Coach based on the repo-wide audit completed on 2026-03-20.

This is a release-quality hardening plan, not a cosmetic cleanup.

The goal is to close correctness, UX, accessibility, prompt-quality, and test-contract gaps while enforcing one quality bar across every implementation slice.

## 2. Baseline Evidence (Audit Snapshot)

Audit execution baseline:

1. Frontend AI Coach targeted vitest suites: passing.
2. Backend AI Coach integration stream test: passing with open-handle warning.
3. Playwright AI Coach suite subset: mixed results with deterministic failures in sessions/options views.
4. Playwright AI Coach a11y suite: timeout due to unstable readiness condition (`networkidle`).

This baseline is the pre-remediation reference point for release proof.

## 3. Critical Findings To Remediate

### 3.1 P0 findings

1. Duplicate global widget-event ingestion can produce conflicting or duplicate prompt actions.
2. Abort path can leave chat state stuck in sending mode.
3. New session actions can race with in-flight requests and produce session/message drift.

### 3.2 P1 findings

1. E2E mocks drifted from live proxy routes and response contracts.
2. Timer retries in center panel are not fully tracked/cleared.
3. Sessions list and async error surfaces have accessibility gaps.
4. A11y test readiness condition is brittle and causes false failures.

### 3.3 P2 findings

1. Session ID persistence is write-only (no controlled restore).
2. Prompt context can misclassify market state on weekends/holidays.
3. SPX polling is duplicated across multiple UI surfaces.

## 4. Product Decision

Backward compatibility with stale internal contracts is not a release requirement.

Release requirement is:

1. deterministic behavior for active AI Coach user workflows
2. no unresolved P0/P1 defects
3. unified quality gates across frontend, backend, prompt, and E2E layers
4. clear runbook, rollback, and evidence trail

## 5. Release Objective

Ship AI Coach as a reliable intraday coaching workspace for day traders where:

1. user intent is ingested once and routed deterministically
2. chat lifecycle is resilient under cancel/retry/new-session behavior
3. mobile and desktop interactions are equally operable
4. prompt outputs are structured, actionable, and risk-first
5. test and mock contracts reflect production interfaces

## 6. Definition Of Done

AI Coach remediation is complete only when all are true:

1. No open P0 or P1 defects from this audit remain.
2. Widget-event handling has one canonical ingestion path.
3. `sendMessage`, abort, and session-reset behavior is race-safe and test-covered.
4. E2E mocks and fixtures use current proxy routes and current response shape.
5. Sessions panel and error surfaces pass keyboard and screen-reader checks.
6. A11y suite uses deterministic readiness checks and passes consistently.
7. Prompt response schema for day-trader workflows is enforced and regression-tested.
8. Duplicate market polling is consolidated to one canonical data source.
9. Release runbook and rollback instructions are updated and exercised.

## 7. Comprehensive Skill Matrix Required For Execution

The same production quality in every slice requires explicit capability coverage.

### 7.1 Engineering skills

1. React/Next state orchestration and async race-condition control.
2. Type-safe API contract management across frontend, proxy, and backend.
3. Stream and abort lifecycle design for chat UX.
4. Deterministic retry/backoff and timer cleanup patterns.
5. Test architecture across unit, integration, component, and E2E.

### 7.2 UX and accessibility skills

1. Mobile-first interaction design for high-frequency use.
2. Keyboard and screen-reader accessibility engineering.
3. Information hierarchy design for fast trader decision cycles.
4. Error-state and loading-state UX for high-volatility conditions.

### 7.3 AI/prompt skills

1. Structured output prompt design for intraday execution plans.
2. Risk-first response policy and uncertainty handling.
3. Intent-routing guardrails for educational vs actionable prompts.
4. Prompt evaluation and regression methodology.

### 7.4 QA and release skills

1. Contract-fidelity E2E fixture design.
2. Flake diagnosis and deterministic test gating.
3. Evidence-driven release signoff and rollback readiness.
4. Production smoke validation and observability checks.

## 8. Non-Goals

This program does not include:

1. net-new feature families unrelated to the audit findings
2. major visual redesign unrelated to usability/accessibility defects
3. broker execution automation
4. broad infra rewrites outside AI Coach contract and quality hardening

## 9. Execution Governance

Implementation must follow the control packet in:

1. `docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/02_IMPLEMENTATION_PLAN_AND_PRIORITY_MODEL.md`
2. `docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/03_QUALITY_PROTOCOL_AND_TEST_GATES.md`
3. `docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/06_CHANGE_CONTROL_AND_PR_STANDARD.md`
4. `docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`
5. `docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/08_AUTONOMOUS_EXECUTION_TRACKER.md`

No slice may close without updated entries in those files.

## 10. Acceptance Metrics

Release signoff metrics:

1. `0` unresolved P0/P1 findings in tracker.
2. Stable pass on targeted AI Coach Playwright suites over repeated runs.
3. A11y suite passes without `networkidle`-based flake dependence.
4. Prompt evaluation set passes required schema and risk-policy checks.
5. Production smoke checklist passes and is documented with timestamped evidence.
