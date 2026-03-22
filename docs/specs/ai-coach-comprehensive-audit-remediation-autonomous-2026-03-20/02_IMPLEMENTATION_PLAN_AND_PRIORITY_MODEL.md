# Implementation Plan And Priority Model: AI Coach Comprehensive Audit Remediation

Date: 2026-03-20
Governing spec: `docs/specs/AI_COACH_COMPREHENSIVE_AUDIT_REMEDIATION_EXECUTION_SPEC_2026-03-20.md`

## 1. Delivery Rule

This effort is production hardening and trust repair, not optional polish.

Every slice must:

1. close an explicit audit finding
2. ship test evidence in the same PR
3. preserve one quality bar across frontend, backend, prompt, and E2E contracts

## 2. Priority Tiers

### Must-Have (Release Blocking)

1. canonical event ingestion and dedupe for widget actions
2. race-safe chat send/abort/session lifecycle
3. E2E fixture and route-contract alignment with production proxy APIs
4. accessibility hardening for sessions list and async error states
5. deterministic a11y test readiness strategy
6. prompt schema + risk-first response contract for day-trader workflows

### Strong Add (Target In Same Release)

1. session restore with staleness controls
2. market-state context hardening for weekends/holidays
3. unified market snapshot source to remove duplicate polling
4. observability instrumentation for send failures, aborts, stale data, and prompt-schema misses

### Later (Do Not Delay Must-Have)

1. richer personalized playbooks
2. prompt personalization by trader persona
3. expanded workflow templates and journaling automations

## 3. Slice Plan

### Slice 1: Baseline Contract Lock + Failing Repros

Objective:

1. freeze current failures and contract drift before remediation code lands

Scope:

1. add failing/expected tests for duplicate event handling
2. add failing/expected tests for abort/session race conditions
3. codify current proxy route and response contracts in fixtures
4. record baseline Playwright and a11y results as evidence

Exit criteria:

1. every P0/P1 finding has deterministic repro coverage
2. contract baselines are committed and versioned

### Slice 2: Event Ingestion Canonicalization (P0)

Objective:

1. guarantee one event ingestion path for widget-driven AI actions

Scope:

1. remove duplicate listeners across page/context layers
2. implement event-id dedupe guardrails
3. preserve all current action semantics under canonical path
4. add unit/integration coverage for one-event-one-action behavior

Exit criteria:

1. no duplicate or conflicting prompt dispatch from a single widget event
2. tests prove deterministic routing under repeated events

### Slice 3: Chat Lifecycle Concurrency Hardening (P0)

Objective:

1. eliminate stuck-send and session-race failure modes

Scope:

1. make abort path always clear sending state
2. force `newSession()` to cancel in-flight operations safely
3. protect state writes with request/session tokens
4. add regression tests for cancel/retry/new-session race scenarios

Exit criteria:

1. no stuck sending state after abort
2. no stale response overwrites after session reset

### Slice 4: E2E Contract Fidelity Repair (P1)

Objective:

1. make AI Coach E2E suites reflect production endpoint and payload contracts

Scope:

1. migrate test mocks to current proxy routes
2. align mock payloads to current typed contracts
3. replace brittle broad selectors in options/session tests
4. consolidate helper fixtures to shared contract sources

Exit criteria:

1. failing AI Coach suites become deterministic and green under local gate conditions
2. mock drift is prevented by shared contract usage

### Slice 5: Accessibility + Mobile/Desktop UX Hardening (P1)

Objective:

1. close keyboard/screen-reader defects and interaction friction on core surfaces

Scope:

1. convert sessions list interactions to semantic controls
2. add live-region semantics for async/system errors
3. tighten focus order and keyboard navigation in chat/session surfaces
4. resolve mobile session drawer discoverability and parity gaps

Exit criteria:

1. core AI Coach flows are keyboard-operable
2. async failures are announced correctly to assistive tech
3. mobile and desktop critical flows behave consistently

### Slice 6: Prompt/Experience Upgrade For Day Traders (P1)

Objective:

1. improve AI output actionability, consistency, and risk discipline

Scope:

1. enforce structured output schema (`bias/setup/entry/stop/targets/invalidation/risk/confidence`)
2. add intraday mode context (`pre-market/live/post-trade`)
3. add uncertainty behavior (clarify-before-commit when confidence is low)
4. add one-tap follow-up intents tied to the schema
5. create prompt regression fixtures and evaluator checks

Exit criteria:

1. responses remain structured and risk-first across core trader prompts
2. schema regressions fail tests before merge

### Slice 7: Data Trust + Polling Consolidation (P2)

Objective:

1. remove conflicting market snapshots and tighten freshness trust cues

Scope:

1. consolidate SPX polling into one canonical cache/context source
2. add explicit freshness metadata propagation
3. harden weekend/holiday market-state context in prompt inputs
4. add stale-data monitoring hooks and dashboards

Exit criteria:

1. one market snapshot source powers all AI Coach top-level surfaces
2. stale/fresh state is consistent and testable

### Slice 8: Final Validation + Release Closure

Objective:

1. prove the remediation bundle is release-ready

Scope:

1. full quality gate run
2. repeated Playwright stability runs
3. prompt regression suite and manual day-trader scenario QA
4. production smoke, rollback drill, and release evidence publication

Exit criteria:

1. no unresolved P0/P1 risks
2. release packet includes all evidence and runbook updates

## 4. Code Quality Parity Rule (All Slices)

Every slice must satisfy the same bar:

1. typed contracts updated first
2. tests included in same change
3. lint + typecheck + targeted unit/integration + targeted E2E evidence
4. docs updated in tracker/change-control/risk register
5. rollback path documented and reversible at slice granularity

No exceptions for "small" frontend-only or prompt-only slices.

## 5. Mandatory Deletion And Cleanup List

These are required outcomes, not optional cleanup:

1. duplicate widget-event listeners that can trigger conflicting actions
2. abort-return paths that bypass UI send-state reset
3. outdated E2E mock routes and payload shapes
4. brittle `networkidle` readiness assumption in AI Coach a11y tests
5. non-semantic clickable session-list containers

## 6. Cutover Strategy

### Step 1

Lock baseline failures with deterministic tests and fixture contracts.

### Step 2

Ship P0 concurrency + event-ingestion fixes behind existing UX.

### Step 3

Repair E2E contract drift and harden selectors until suites are deterministic.

### Step 4

Ship accessibility + prompt schema + intraday mode improvements.

### Step 5

Consolidate polling/context trust model and finalize observability.

### Step 6

Run full gates, execute smoke and rollback drill, then close release.

## 7. Capability Development And Ownership Coverage

Before execution begins, assign and verify owners for these skill lanes:

1. Frontend concurrency and state integrity.
2. API and contract governance across frontend/proxy/backend.
3. Accessibility and mobile interaction quality.
4. Prompt engineering and day-trader response quality.
5. E2E contract fidelity and flake control.

Development requirement per lane:

1. define coding standards and review checklist for the lane
2. define lane-specific test heuristics and failure triage rules
3. document lane playbook updates in slice-level PR notes
4. require at least one reviewer from the lane for related slices

This is mandatory to keep code quality uniform across all slices.
