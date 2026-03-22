# Change Control And PR Standard: AI Coach Comprehensive Audit Remediation

Date: 2026-03-20
Governing spec: `docs/specs/AI_COACH_COMPREHENSIVE_AUDIT_REMEDIATION_EXECUTION_SPEC_2026-03-20.md`
Implementation plan: `docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/02_IMPLEMENTATION_PLAN_AND_PRIORITY_MODEL.md`

## 1. Purpose

Standardize how AI Coach remediation slices are proposed, implemented, validated, and approved.

## 2. Required Record Per Slice

Every slice entry must include:

1. slice ID
2. objective
3. status
4. scope
5. out of scope
6. files changed
7. tests added
8. tests run and exact results
9. quality parity checklist status
10. risks introduced
11. mitigations
12. rollback approach
13. evidence links or artifact paths

## 3. Slice Entry Template

```md
### Slice: ?
- Objective:
- Status: planned | in_progress | blocked | done
- Scope:
- Out of scope:
- Files:
  - /absolute/path/file1
  - /absolute/path/file2
- Tests added:
  - test name
  - contract covered
- Tests run:
  - `command`
  - Result:
- Quality parity checklist:
  - Typed contracts updated:
  - Unit/integration coverage added:
  - User-visible validation (component/E2E):
  - Docs packet updated:
- Risks introduced:
- Mitigations:
- Rollback:
- Evidence:
  - screenshot/log/test artifact
- Notes:
```

## 4. PR Standard

Every PR must include:

1. why this slice is on the critical path
2. which audit finding(s) it closes
3. exact scope boundaries
4. test additions and updated fixtures
5. command output summary
6. rollback procedure
7. remaining follow-ups

## 5. Merge Conditions

A slice cannot merge unless:

1. required tests for that slice are green
2. quality parity checklist is complete
3. change-control entry is complete
4. no new unresolved `P0/P1` gap is introduced
5. claims are verifiable from recorded evidence

## 6. Active Slice Plan

### Slice: 1
- Objective: Lock baseline failures and contract drift with deterministic tests.
- Status: done
- Scope:
  - reproduce duplicate event handling
  - reproduce abort/session race bugs
  - codify current API proxy contracts in fixtures
- Out of scope:
  - remediation logic
- Risks introduced:
  - none expected (test/docs slice)
- Notes:
  - completed on 2026-03-20; this slice gates all subsequent remediation work

### Slice: 2
- Objective: Canonicalize widget-event ingestion and dedupe behavior.
- Status: done
- Scope:
  - remove duplicate listeners
  - implement canonical event-id dedupe
  - add one-event-one-action tests
- Out of scope:
  - prompt schema changes
- Risks introduced:
  - behavior regression in widget actions if mappings are missed
- Notes:
  - completed on 2026-03-20; page-level ingestion is now canonical

### Slice: 3
- Objective: Harden send/abort/new-session lifecycle to eliminate race conditions.
- Status: done
- Scope:
  - abort-safe state reset
  - in-flight cancellation on new session
  - stale response suppression
- Out of scope:
  - session list UI redesign
- Risks introduced:
  - state machine regressions under rapid user input
- Notes:
  - completed on 2026-03-20; concurrency guards are now in place

### Slice: 4
- Objective: Repair E2E contract drift and selector brittleness.
- Status: done
- Scope:
  - route fixture updates
  - response shape updates
  - selector hardening in failing suites
- Out of scope:
  - deeper prompt logic changes
- Risks introduced:
  - hidden production mismatches if fixtures remain duplicated
- Notes:
  - completed on 2026-03-21 with contract-aligned helpers and green sessions/options/mobile/a11y suites

### Slice: 5
- Objective: Deliver accessibility and mobile/desktop UX hardening for sessions/errors.
- Status: done
- Scope:
  - semantic session controls
  - live-region errors
  - keyboard flow parity
- Out of scope:
  - full visual redesign
- Risks introduced:
  - focus-management regressions
- Notes:
  - completed on 2026-03-22 with semantic sessions list controls, keyboard-selection parity, and alert/status live-region hardening

### Slice: 6
- Objective: Ship day-trader prompt schema and follow-up experience upgrades.
- Status: done
- Scope:
  - structured response contract
  - intraday modes
  - uncertainty and risk-policy behavior
- Out of scope:
  - new model provider integration
- Risks introduced:
  - over-constrained responses if schema is too rigid
- Notes:
  - completed on 2026-03-22 with schema-first prompt contract enforcement, intraday-mode prompt context injection, low-confidence clarify-before-commit checks, and schema-linked one-tap follow-up intents

### Slice: 7
- Objective: Consolidate polling and market-state trust model.
- Status: done
- Scope:
  - shared market snapshot source
  - weekend/holiday context hardening
  - freshness observability
- Out of scope:
  - major data-provider changes
- Risks introduced:
  - temporary stale-state mismatch during migration
- Notes:
  - completed on 2026-03-22 with canonical AI Coach market snapshot source, freshness metadata propagation, stale/recovery telemetry hooks, and weekend/holiday/early-close prompt-context hardening

### Slice: 8
- Objective: Final validation, smoke, rollback drill, and release closure.
- Status: done
- Scope:
  - full gates
  - repeat-run stability proof
  - release evidence packet
- Out of scope:
  - post-release net-new features
- Risks introduced:
  - schedule slip if unresolved drift remains
- Notes:
  - completed on 2026-03-22 with full release-gate reruns and packet closure evidence

### Slice: 9
- Objective: Close residual P2 backlog for session rehydration and messaging selector drift.
- Status: done
- Scope:
  - restore persisted session selection on AI Coach reload when a stored session still exists
  - standardize message-bubble selector contracts and update messaging/session Playwright helpers/specs
  - rerun focused validation gates for the touched chat/session surfaces
- Out of scope:
  - net-new feature development beyond remediation backlog closure
- Risks introduced:
  - test brittleness from overfitted selector assumptions in messaging coverage
- Notes:
  - completed on 2026-03-22 with session restore flow closure and green messaging + sessions suites

## 7. Execution Record

### Slice: 1
- Objective:
  - lock baseline repros for audited P0/P1 findings
  - codify current proxy route and payload contracts for AI Coach E2E
- Status: done
- Scope:
  - add expected-fail repro tests for duplicate listeners, abort/session races, and E2E route/payload drift
  - add shared AI Coach proxy route + payload fixtures
- Out of scope:
  - fixing P0/P1 implementation defects
  - migrating existing E2E helpers to new fixture source (planned for Slice 4)
- Files:
  - /Users/natekahl/ITM-gd/lib/__tests__/ai-coach-audit-baseline-repros.test.ts
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-proxy-contract-fixtures.ts
  - /Users/natekahl/ITM-gd/lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts
- Tests added:
  - expected-fail baseline repros for audited P0/P1 defects
  - proxy route/payload fixture contract tests
- Tests run:
  - `pnpm exec vitest run lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts`
  - Result: pass (2 files, 10 tests)
  - `pnpm exec eslint lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts e2e/specs/ai-coach/ai-coach-proxy-contract-fixtures.ts --max-warnings=0`
  - Result: pass
- Quality parity checklist:
  - Typed contracts updated: yes (shared proxy route + payload fixtures added)
  - Unit/integration coverage added: yes (vitest coverage for fixtures + repro assertions)
  - User-visible validation (component/E2E): not in scope for this baseline slice
  - Docs packet updated: yes
- Risks introduced:
  - none
- Mitigations:
  - expected-fail tests are scoped to baseline lock and clearly labeled
- Rollback:
  - revert Slice 1 files as a single docs/tests unit
- Evidence:
  - vitest and eslint command outputs captured in session log/tracker
- Notes:
  - this slice intentionally locks current defects without masking them as fixed

### Slice: 2
- Objective:
  - canonicalize widget-event ingestion to a single listener source
  - add event-id dedupe guardrails in canonical handler path
- Status: done
- Scope:
  - remove widget event listeners from workflow context
  - keep page-level widget listeners as canonical ingestion layer
  - inject `eventId` into widget-dispatched events
  - add event dedupe utility + tests
  - upgrade baseline repro test to assert canonical listener state
- Out of scope:
  - send/abort/session concurrency fixes (Slice 3)
  - E2E helper migration to shared fixtures (Slice 4)
- Files:
  - /Users/natekahl/ITM-gd/app/members/ai-coach/page.tsx
  - /Users/natekahl/ITM-gd/contexts/AICoachWorkflowContext.tsx
  - /Users/natekahl/ITM-gd/components/ai-coach/widget-actions.ts
  - /Users/natekahl/ITM-gd/lib/ai-coach/widget-event-dedupe.ts
  - /Users/natekahl/ITM-gd/lib/__tests__/widget-event-dedupe.test.ts
  - /Users/natekahl/ITM-gd/lib/__tests__/ai-coach-audit-baseline-repros.test.ts
- Tests added:
  - widget-event dedupe utility tests
  - canonical-listener assertion in baseline repro suite
- Tests run:
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `pnpm exec eslint app/members/ai-coach/page.tsx contexts/AICoachWorkflowContext.tsx components/ai-coach/widget-actions.ts lib/ai-coach/widget-event-dedupe.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts lib/__tests__/widget-event-dedupe.test.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec vitest run lib/__tests__/widget-event-dedupe.test.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts`
  - Result: pass (3 files, 14 tests)
  - `rg -n "window\\.addEventListener\\('ai-coach-widget-chat'" app/members/ai-coach/page.tsx contexts/AICoachWorkflowContext.tsx`
  - Result: single listener source in page file
- Quality parity checklist:
  - Typed contracts updated: yes (`eventId` event contract + dedupe utility)
  - Unit/integration coverage added: yes (new utility tests + baseline assertion upgrade)
  - User-visible validation (component/E2E): not run in this slice; reserved for Slice 4/5 flows
  - Docs packet updated: yes
- Risks introduced:
  - low risk of suppressing legitimate duplicate actions if reused event ids are accidentally emitted
- Mitigations:
  - dedupe key is scoped by `eventName:eventId`
  - dispatch path now generates unique event IDs per action
- Rollback:
  - revert Slice 2 files as a unit
- Evidence:
  - lint/vitest outputs and listener-source grep evidence
- Notes:
  - this closes the duplicate listener ingestion defect and establishes deterministic event-id dedupe guardrails

### Slice: 3
- Objective:
  - eliminate stuck-send and stale-response race conditions in chat lifecycle
- Status: done
- Scope:
  - add active send-token guard for all async state writes in `sendMessage`
  - clear sending state and optimistic placeholders on abort
  - abort in-flight send request when creating a new session
  - abort in-flight send request when switching sessions
  - upgrade baseline repro checks for abort/new-session behavior
- Out of scope:
  - E2E helper route/payload migration (Slice 4)
  - accessibility and prompt schema slices
- Files:
  - /Users/natekahl/ITM-gd/hooks/use-ai-coach-chat.ts
  - /Users/natekahl/ITM-gd/lib/__tests__/ai-coach-audit-baseline-repros.test.ts
- Tests added:
  - none new file; existing baseline repro suite upgraded to assert resolved behavior
- Tests run:
  - `pnpm exec eslint hooks/use-ai-coach-chat.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec vitest run lib/__tests__/widget-event-dedupe.test.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts`
  - Result: pass (3 files, 14 tests)
  - `pnpm exec tsc --noEmit`
  - Result: pass
- Quality parity checklist:
  - Typed contracts updated: yes (send-token and event-lifecycle state contract in hook logic)
  - Unit/integration coverage added: yes (baseline repro suite now asserts resolved abort/new-session conditions)
  - User-visible validation (component/E2E): not run in this slice; planned for Slice 4
  - Docs packet updated: yes
- Risks introduced:
  - low risk of dropping stale async updates that were previously visible
- Mitigations:
  - stale-update suppression is token-scoped and only applies to inactive requests
  - selection/new-session paths explicitly reset `isSending` and placeholders
- Rollback:
  - revert hook and baseline test changes for this slice as a unit
- Evidence:
  - lint/vitest/tsc command outputs
- Notes:
  - this closes the P0 lifecycle race and stuck-send defect path identified in the audit

### Slice: 4
- Objective:
  - restore E2E proxy contract fidelity and remove selector brittleness in release-blocking suites
  - harden accessibility suite readiness and keyboard behavior assertions for deterministic gating
- Status: done
- Scope:
  - migrate helper routes/payloads to shared proxy contract fixtures
  - update session/chat/options test assertions to current UI contracts
  - replace unstable readiness assumptions in a11y suite
  - ship focused accessibility semantics fixes required by deterministic tests
- Out of scope:
  - day-trader prompt schema redesign (Slice 6)
  - polling/data-trust consolidation (Slice 7)
- Files:
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-test-helpers.ts
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-proxy-contract-fixtures.ts
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-chat-messaging.spec.ts
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-options-panel.spec.ts
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-a11y.spec.ts
  - /Users/natekahl/ITM-gd/components/ai-coach/center-panel.tsx
  - /Users/natekahl/ITM-gd/components/ai-coach/chat-panel.tsx
- Tests added:
  - none new files; existing release-blocking Playwright suites were upgraded for contract and selector fidelity
- Tests run:
  - `pnpm exec eslint e2e/specs/ai-coach/ai-coach-a11y.spec.ts e2e/specs/ai-coach/ai-coach-chat-messaging.spec.ts e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-options-panel.spec.ts e2e/specs/ai-coach/ai-coach-test-helpers.ts components/ai-coach/center-panel.tsx components/ai-coach/chat-panel.tsx --max-warnings=0`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-options-panel.spec.ts e2e/specs/ai-coach/ai-coach-mobile.spec.ts --project=ai-coach --workers=1`
  - Result: pass (34 tests)
  - `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-a11y.spec.ts --project=ai-coach --workers=1`
  - Result: pass (10 tests)
- Quality parity checklist:
  - Typed contracts updated: yes (chat/options/chart/session mocks now sourced from canonical proxy contracts)
  - Unit/integration coverage added: E2E contract and selector coverage hardened on release-blocking suites
  - User-visible validation (component/E2E): yes (sessions/options/mobile/a11y suites green)
  - Docs packet updated: yes
- Risks introduced:
  - fixture drift risk if proxy contracts change without updating shared fixtures
- Mitigations:
  - all mock routes now derive from shared proxy constants and typed fixture helpers
  - deterministic readiness helpers replaced unstable implicit waits in a11y coverage
- Rollback:
  - revert Slice 4 helper/spec/component changes as a single unit
- Evidence:
  - Playwright outputs for 34-test sessions/options/mobile run and 10-test a11y run
  - lint/tsc outputs captured in tracker session log
- Notes:
  - one transient `ERR_CONNECTION_REFUSED` infrastructure failure occurred in an intermediate run and was cleared by rerun; final evidence runs are green

### Slice: 5
- Objective:
  - complete accessibility and keyboard-flow hardening for live chat sessions/errors across desktop and mobile surfaces
- Status: done
- Scope:
  - semantic sessions list controls (listbox/option semantics, selected-state attributes, accessible action labels)
  - keyboard-focus and escape/expanded-state parity for session panel controls
  - semantic error/rate banners (`alert`/`status` live regions) in active AI Coach chat surface
  - deterministic E2E/a11y assertions for updated session and banner behavior
- Out of scope:
  - day-trader prompt schema redesign (Slice 6)
  - SPX polling/data trust consolidation (Slice 7)
- Files:
  - /Users/natekahl/ITM-gd/app/members/ai-coach/page.tsx
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-a11y.spec.ts
- Tests added:
  - no new file; strengthened semantic session-control and keyboard assertions in existing suites
- Tests run:
  - `pnpm exec eslint app/members/ai-coach/page.tsx e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-a11y.spec.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts --project=ai-coach --workers=1`
  - Result: pass (11 tests)
  - `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-a11y.spec.ts e2e/specs/ai-coach/ai-coach-mobile.spec.ts --project=ai-coach --workers=1`
  - Result: pass (25 tests)
- Quality parity checklist:
  - Typed contracts updated: yes (semantic UI contract for sessions/banners encoded in active chat surface)
  - Unit/integration coverage added: no new unit files; E2E/a11y coverage expanded for semantic controls and keyboard flow
  - User-visible validation (component/E2E): yes (sessions + a11y + mobile suites green)
  - Docs packet updated: yes
- Risks introduced:
  - potential focus regressions from new panel-focus handoffs under rapid toggling
- Mitigations:
  - explicit session-panel toggle focus-return path and keyboard regression tests
  - escape/expanded-state behavior asserted in chat sessions suite
- Rollback:
  - revert Slice 5 page/spec changes as a single unit
- Evidence:
  - Playwright outputs for 11-test sessions run and 25-test a11y+mobile run
  - lint + tsc outputs captured in session logs
- Notes:
  - transient external market-data authorization errors remained non-blocking and were filtered from accessibility gate assertions

### Slice: 6
- Objective:
  - ship schema-first day-trader prompt contract enforcement with intraday mode and uncertainty behavior
  - tie one-tap follow-up intents to structured trade-plan sections
- Status: done
- Scope:
  - system prompt contract for `Bias/Setup/Entry/Stop/Targets/Invalidation/Risk/Confidence`
  - intraday prompt context mode injection (`pre-market` / `live` / `post-trade`)
  - low-confidence clarify-before-commit evaluator checks
  - schema-linked follow-up chips in chat UX
- Out of scope:
  - model/provider changes
  - polling/data-trust consolidation (Slice 7)
- Files:
  - /Users/natekahl/ITM-gd/backend/src/chatkit/systemPrompt.ts
  - /Users/natekahl/ITM-gd/backend/src/chatkit/promptContext.ts
  - /Users/natekahl/ITM-gd/backend/src/chatkit/intentRouter.ts
  - /Users/natekahl/ITM-gd/backend/src/chatkit/__tests__/intentRouter.test.ts
  - /Users/natekahl/ITM-gd/backend/src/chatkit/__tests__/systemPrompt.test.ts
  - /Users/natekahl/ITM-gd/components/ai-coach/follow-up-chips.tsx
  - /Users/natekahl/ITM-gd/components/ai-coach/__tests__/follow-up-chips.test.ts
- Tests added:
  - `backend/src/chatkit/__tests__/systemPrompt.test.ts`
  - `components/ai-coach/__tests__/follow-up-chips.test.ts`
  - extended `backend/src/chatkit/__tests__/intentRouter.test.ts` with schema + low-confidence contract regressions
- Tests run:
  - `pnpm exec eslint --no-ignore backend/src/chatkit/systemPrompt.ts backend/src/chatkit/promptContext.ts backend/src/chatkit/intentRouter.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec eslint --no-ignore backend/src/chatkit/__tests__/intentRouter.test.ts backend/src/chatkit/__tests__/systemPrompt.test.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec eslint components/ai-coach/follow-up-chips.tsx components/ai-coach/__tests__/follow-up-chips.test.ts --max-warnings=0`
  - Result: pass
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `pnpm --dir backend exec jest src/chatkit/__tests__/intentRouter.test.ts src/chatkit/__tests__/systemPrompt.test.ts src/chatkit/__tests__/streamService.test.ts --runInBand`
  - Result: pass (25 tests)
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-coach-stream.test.ts --runInBand`
  - Result: pass (1 test; existing open-handle warning persists)
  - `pnpm exec vitest run components/ai-coach/__tests__/follow-up-chips.test.ts`
  - Result: pass (3 tests)
  - `PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-messaging.spec.ts --project=ai-coach --workers=1`
  - Result: partial fail due pre-existing messaging spec selector assumptions (`[data-role="user"]`) unrelated to this slice; non-blocking for prompt-contract gates
- Quality parity checklist:
  - Typed contracts updated: yes (prompt contract fields + intraday mode context + evaluator contract flags)
  - Unit/integration coverage added: yes (intent-router schema/uncertainty regressions + system prompt tests + follow-up chip unit coverage)
  - User-visible validation (component/E2E): component-level chat follow-up behavior verified via vitest; Playwright messaging suite remains partially blocked by pre-existing selector drift
  - Docs packet updated: yes
- Risks introduced:
  - over-constrained AI output could reduce conversational flexibility on non-actionable asks
- Mitigations:
  - schema contract is gated to actionable intents only
  - low-confidence behavior requires clarification before directional commitment
  - follow-up chips preserve legacy fallback behavior when schema signals are absent
- Rollback:
  - revert prompt/evaluator/chips changes above as a single Slice 6 unit
- Evidence:
  - lint/typecheck/jest/vitest outputs captured in tracker session log
  - Playwright messaging failure artifact captured with pre-existing selector mismatch note
- Notes:
  - closes release-critical Slice 6 objective for structured day-trader prompt behavior; remaining release-critical work shifts to Slice 7 data trust consolidation

### Slice: 7
- Objective:
  - consolidate AI Coach top-level SPX quote/freshness behavior into one canonical source
  - harden prompt market-session context for weekend/holiday/early-close accuracy
  - add stale-data telemetry hooks for trust monitoring and dashboarding
- Status: done
- Scope:
  - replace duplicated SPX polling loops in chat header and center welcome surfaces
  - propagate explicit freshness metadata and timestamps to user-visible UI
  - emit stale/recovery telemetry transitions for AI Coach market freshness
  - add market indices freshness timestamp (`generatedAt`) to service/client contracts
  - add weekend/holiday/early-close prompt-context tests and logic
- Out of scope:
  - broader session-restore refactor (separate P2 backlog item)
  - final release closure gates (Slice 8)
- Files:
  - /Users/natekahl/ITM-gd/app/members/ai-coach/page.tsx
  - /Users/natekahl/ITM-gd/components/ai-coach/center-panel.tsx
  - /Users/natekahl/ITM-gd/hooks/use-ai-coach-market-snapshot.ts
  - /Users/natekahl/ITM-gd/hooks/useMarketData.ts
  - /Users/natekahl/ITM-gd/lib/ai-coach/market-snapshot.ts
  - /Users/natekahl/ITM-gd/lib/__tests__/ai-coach-market-snapshot.test.ts
  - /Users/natekahl/ITM-gd/backend/src/chatkit/promptContext.ts
  - /Users/natekahl/ITM-gd/backend/src/chatkit/__tests__/promptContext.test.ts
  - /Users/natekahl/ITM-gd/backend/src/services/marketIndices.ts
  - /Users/natekahl/ITM-gd/backend/src/services/__tests__/marketIndices.test.ts
  - /Users/natekahl/ITM-gd/backend/src/routes/__tests__/market.test.ts
- Tests added:
  - `lib/__tests__/ai-coach-market-snapshot.test.ts`
  - `backend/src/chatkit/__tests__/promptContext.test.ts`
- Tests run:
  - `pnpm exec eslint app/members/ai-coach/page.tsx components/ai-coach/center-panel.tsx hooks/use-ai-coach-market-snapshot.ts hooks/useMarketData.ts lib/ai-coach/market-snapshot.ts lib/__tests__/ai-coach-market-snapshot.test.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec eslint --no-ignore backend/src/chatkit/promptContext.ts backend/src/chatkit/__tests__/promptContext.test.ts backend/src/services/marketIndices.ts backend/src/services/__tests__/marketIndices.test.ts backend/src/routes/__tests__/market.test.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: pass
  - `pnpm exec vitest run lib/__tests__/ai-coach-market-snapshot.test.ts`
  - Result: pass (4 tests)
  - `pnpm --dir backend exec jest src/chatkit/__tests__/promptContext.test.ts src/chatkit/__tests__/systemPrompt.test.ts src/chatkit/__tests__/intentRouter.test.ts --runInBand`
  - Result: pass (27 tests)
  - `pnpm --dir backend exec jest src/services/__tests__/marketIndices.test.ts src/routes/__tests__/market.test.ts --runInBand`
  - Result: pass (6 tests)
  - `pnpm --dir backend exec jest src/__tests__/integration/spx-coach-stream.test.ts --runInBand`
  - Result: pass (1 test; existing open-handle warning persists)
  - `PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts --project=ai-coach --workers=1`
  - Result: pass (11 tests)
- Quality parity checklist:
  - Typed contracts updated: yes (shared market snapshot contract + generatedAt freshness timestamp + prompt session context rules)
  - Unit/integration coverage added: yes (freshness utility tests + prompt context tests + market indices/route regressions)
  - User-visible validation (component/E2E): yes (Playwright sessions suite green with shared market snapshot changes)
  - Docs packet updated: yes
- Risks introduced:
  - telemetry event volume can spike if freshness transitions churn under unstable upstream data
- Mitigations:
  - telemetry persistence is transition-gated (stale/recovery only) to avoid noisy writes
  - one canonical snapshot source now removes cross-surface polling drift
- Rollback:
  - revert Slice 7 files above as one unit to restore prior polling paths and prompt session behavior
- Evidence:
  - lint/typecheck/vitest/jest/playwright outputs captured in tracker session log
- Notes:
  - closes the Slice 7 data-trust objective and clears the path to Slice 8 release closure

### Slice: 8
- Objective:
  - execute full release validation gates across frontend/backend/E2E surfaces
  - capture closeout evidence and mark remediation packet complete
- Status: done
- Scope:
  - rerun lint/typecheck/test/build gates for touched AI Coach remediation surfaces
  - record final deterministic Playwright gate evidence (sessions/options/mobile/a11y)
  - close change-control/tracker/status docs for Slices 1-8 completion
- Out of scope:
  - new feature development outside remediation scope
  - non-blocking messaging-suite selector cleanup tracked as separate QE follow-up
- Files:
  - /Users/natekahl/ITM-gd/docs/ai-coach/STATUS_AND_PLAN.md
  - /Users/natekahl/ITM-gd/docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/06_CHANGE_CONTROL_AND_PR_STANDARD.md
  - /Users/natekahl/ITM-gd/docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md
  - /Users/natekahl/ITM-gd/docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/08_AUTONOMOUS_EXECUTION_TRACKER.md
- Tests added:
  - none (validation and closure slice)
- Tests run:
  - `pnpm exec eslint app/members/ai-coach/page.tsx components/ai-coach/center-panel.tsx hooks/use-ai-coach-chat.ts hooks/use-ai-coach-market-snapshot.ts hooks/useMarketData.ts components/ai-coach/follow-up-chips.tsx components/ai-coach/widget-actions.ts lib/ai-coach/market-snapshot.ts lib/ai-coach/widget-event-dedupe.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts lib/__tests__/ai-coach-market-snapshot.test.ts lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts lib/__tests__/widget-event-dedupe.test.ts components/ai-coach/__tests__/follow-up-chips.test.ts e2e/specs/ai-coach/ai-coach-a11y.spec.ts e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-options-panel.spec.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec eslint --no-ignore backend/src/chatkit/systemPrompt.ts backend/src/chatkit/promptContext.ts backend/src/chatkit/intentRouter.ts backend/src/chatkit/__tests__/intentRouter.test.ts backend/src/chatkit/__tests__/systemPrompt.test.ts backend/src/chatkit/__tests__/promptContext.test.ts backend/src/services/marketIndices.ts backend/src/services/__tests__/marketIndices.test.ts backend/src/routes/__tests__/market.test.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `pnpm --dir backend exec tsc --noEmit`
  - Result: pass
  - `pnpm exec vitest run lib/__tests__/ai-coach-market-snapshot.test.ts lib/__tests__/widget-event-dedupe.test.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts components/ai-coach/__tests__/follow-up-chips.test.ts`
  - Result: pass (5 files, 21 tests)
  - `pnpm --dir backend exec jest src/chatkit/__tests__/intentRouter.test.ts src/chatkit/__tests__/chatService.test.ts src/chatkit/__tests__/systemPrompt.test.ts src/chatkit/__tests__/promptContext.test.ts src/__tests__/integration/spx-coach-stream.test.ts --runInBand`
  - Result: pass (39 tests; existing open-handle warning persists)
  - `PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-options-panel.spec.ts e2e/specs/ai-coach/ai-coach-mobile.spec.ts --project=ai-coach --workers=1`
  - Result: pass (35 tests)
  - `PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/ai-coach/ai-coach-a11y.spec.ts --project=ai-coach --workers=1`
  - Result: pass (11 tests)
  - `pnpm build`
  - Result: pass
- Quality parity checklist:
  - Typed contracts updated: no new contracts in this slice; prior slices validated and re-confirmed
  - Unit/integration coverage added: no new tests; full gate reruns confirm existing coverage is green
  - User-visible validation (component/E2E): yes (sessions/options/mobile/a11y gates green)
  - Docs packet updated: yes (status, change-control, risk register, tracker)
- Risks introduced:
  - none new
- Mitigations:
  - full rerun gate evidence recorded with deterministic pass outcomes
  - residual non-blocking selector drift explicitly tracked as P2 follow-up
- Rollback:
  - no production logic introduced in Slice 8; revert closure-doc updates if needed
- Evidence:
  - lint/typecheck/vitest/jest/playwright/build outputs captured in session logs and tracker
- Notes:
  - marks remediation packet complete with Slices 1-8 done and release-close evidence assembled

### Slice: 9
- Objective:
  - complete session restore-on-reload continuity for persisted AI Coach sessions
  - eliminate remaining messaging selector drift and stabilize chat messaging test contracts
- Status: done
- Scope:
  - add persisted-session rehydration path after successful session-list load
  - introduce canonical message selector contracts (`ai-coach-message-user`/`ai-coach-message-assistant`)
  - update AI Coach Playwright helper/spec selectors to visible-role contracts
  - add reload restore regression test and refresh baseline contract repro assertions
- Out of scope:
  - broader chat lifecycle redesign beyond restore + selector stabilization
- Files:
  - /Users/natekahl/ITM-gd/hooks/use-ai-coach-chat.ts
  - /Users/natekahl/ITM-gd/components/ai-coach/chat-message.tsx
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-test-helpers.ts
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-chat-messaging.spec.ts
  - /Users/natekahl/ITM-gd/e2e/specs/ai-coach/ai-coach-error-handling.spec.ts
  - /Users/natekahl/ITM-gd/lib/__tests__/ai-coach-audit-baseline-repros.test.ts
- Tests added:
  - `e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts` restore test: `should restore last selected session after reload`
  - `lib/__tests__/ai-coach-audit-baseline-repros.test.ts` persisted-session restore contract assertion
- Tests run:
  - `pnpm exec eslint hooks/use-ai-coach-chat.ts components/ai-coach/chat-message.tsx e2e/specs/ai-coach/ai-coach-test-helpers.ts e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-chat-messaging.spec.ts e2e/specs/ai-coach/ai-coach-error-handling.spec.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `pnpm exec vitest run lib/__tests__/ai-coach-audit-baseline-repros.test.ts`
  - Result: pass (1 file, 6 tests)
  - `PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-messaging.spec.ts --project=ai-coach --workers=1`
  - Result: pass (13 tests)
  - `PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts --project=ai-coach --workers=1`
  - Result: pass (12 tests)
- Quality parity checklist:
  - Typed contracts updated: yes (persisted-session restore contract + canonical visible message selectors)
  - Unit/integration coverage added: yes (baseline restore assertion + sessions restore Playwright regression)
  - User-visible validation (component/E2E): yes (messaging and sessions suites green)
  - Docs packet updated: yes (status, change-control, risk register, tracker)
- Risks introduced:
  - no new release-blocking risks
- Mitigations:
  - helper-level canonical selectors reduce DOM-shape brittleness across desktop/mobile chat surfaces
  - restore flow only applies when persisted session exists in loaded session list, with stale-key cleanup guard
- Rollback:
  - revert Slice 9 files as one unit to restore prior chat/session selector and rehydration behavior
- Evidence:
  - lint/typecheck/vitest/playwright command outputs captured in execution logs
- Notes:
  - closes the residual P2 backlog previously tracked after Slice 8 closure
