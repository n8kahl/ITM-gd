# Quality Protocol And Test Gates: AI Coach Comprehensive Audit Remediation

Date: 2026-03-20
Governing spec: `docs/specs/AI_COACH_COMPREHENSIVE_AUDIT_REMEDIATION_EXECUTION_SPEC_2026-03-20.md`
Implementation plan: `docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/02_IMPLEMENTATION_PLAN_AND_PRIORITY_MODEL.md`

## 1. Standard

No slice may merge on inspection alone.

Every slice must:

1. include explicit test evidence for the changed contract surface
2. include negative-path behavior checks (abort, failure, stale state, degraded mode)
3. keep frontend/backend/prompt contracts synchronized
4. update execution tracker + change-control + risk register in the same PR

## 2. Severity Model

1. `P0`
   - duplicate/conflicting AI actions from one user intent
   - stuck sending state or session corruption
   - wrong route contract causing core chat/options/session failures
   - prompt output that omits stop/invalidation on actionable trading requests
2. `P1`
   - accessibility failure in core AI Coach workflows
   - deterministic E2E flow failure in sessions/options/chat views
   - stale/incorrect market-state context for active trading guidance
3. `P2`
   - degraded but usable UX, missing secondary trust cues, non-blocking performance regressions
4. `P3`
   - cosmetic-only issues

Blocking rules:

1. no unresolved `P0` or `P1` at release candidate
2. missing test coverage for a `P0/P1` surface is treated as `P1`
3. mock contract drift from production API contracts is `P1`

## 3. Required Test Layers

### Unit

Required for:

1. event dedupe and canonical routing logic
2. send/abort/session lifecycle transitions
3. prompt schema enforcement and risk-policy helpers
4. market-state context rules (weekday/weekend/holiday)

### Integration

Required for:

1. frontend proxy API contract shape
2. backend chat stream and tool-routing contracts
3. fixture parity between API schema and E2E helpers
4. stale/degraded state propagation across chat + context surfaces

### Component

Required for:

1. sessions list semantic interactions
2. async error live-region behavior
3. mobile/desktop parity for session drawer and top-level controls
4. follow-up action controls and structured response rendering

### End-To-End

Required for:

1. open AI Coach and send/receive basic chat message
2. load session list, switch sessions, and continue thread
3. navigate to options view and render options data state
4. run mobile sheet/session interactions
5. validate widget-action flow triggers one action only

### Accessibility

Required for:

1. keyboard-only navigation through session list and message input
2. screen-reader announcement of async errors
3. deterministic a11y scan readiness without `networkidle`

### Prompt Regression

Required for:

1. pre-market, live-trade, and post-trade response schema compliance
2. actionable prompts include entry, stop, targets, invalidation, and risk caveat
3. low-confidence scenarios ask clarifying questions before hard recommendation

## 4. Mandatory Slice Gates

Every slice must pass:

1. targeted lint for touched files
2. root typecheck
3. backend typecheck if backend files changed
4. targeted unit/integration tests for touched contracts
5. targeted Playwright or component coverage for user-visible flows
6. documentation updates in the control packet

## 5. Minimum Release Commands

```bash
pnpm exec eslint <touched frontend/app/shared files>
pnpm --dir backend exec eslint <touched backend files>
pnpm exec tsc --noEmit
pnpm --dir backend exec tsc --noEmit
pnpm exec vitest run <ai-coach targeted suites>
pnpm --dir backend exec jest src/chatkit/__tests__/intentRouter.test.ts src/chatkit/__tests__/chatService.test.ts src/__tests__/integration/spx-coach-stream.test.ts --runInBand
PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-options-panel.spec.ts e2e/specs/ai-coach/ai-coach-mobile.spec.ts --project=ai-coach --workers=1
PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-a11y.spec.ts --project=ai-coach --workers=1
pnpm build
```

## 6. Release-Blocking Assertions

1. one widget event cannot trigger duplicate/conflicting assistant actions
2. abort always clears sending state and leaves chat operable
3. session reset cannot be overwritten by stale in-flight responses
4. sessions/options E2E flows pass using current proxy contracts
5. session list and async errors satisfy semantic accessibility expectations
6. prompt outputs for actionable trade guidance include structured risk-first fields
7. market snapshot and freshness status are consistent across top-level AI Coach surfaces

## 7. Post-Deploy Smoke

Required after deploy:

1. open AI Coach and send one standard query
2. cancel one in-flight response and verify immediate recovery
3. create/select session and verify no duplicate responses
4. open options panel from chat/widget action
5. execute one keyboard-only flow through sessions and message input
6. verify stale/fresh timestamps and market-state copy are coherent

## 8. No-Slop Rule

Reject implementation if it:

1. introduces a second event ingestion source
2. patches tests without aligning fixture contracts to production APIs
3. bypasses semantic controls in clickable list or error surfaces
4. claims prompt improvements without regression fixtures/evidence
