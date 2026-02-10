# AI Coach V2 Production Execution Plan

Status: In Progress  
Owner: AI Engineering  
Last Updated: 2026-02-10

## Objective
Deliver a production-grade AI Coach that is reliable, secure, and trusted as the primary in-app assistant for options day trading, market context, trade setup planning, and key level interpretation.

## Definition of Done
- Real-time and chat surfaces are authenticated, authorized, and resilient.
- AI responses are grounded in fresh data or clearly flagged when delayed/stale.
- Tool/prompt behavior is consistent with routing promises (all valid symbols supported).
- Beginner vs advanced response style adapts from user context.
- Core workflows have regression coverage in unit/integration/E2E tests.

## Delivery Phases

### Phase 0 (P0): Trust and Safety Baseline
1. WebSocket authentication and per-user channel authorization.
2. True token streaming for chat (no synthetic chunking) with circuit breaker parity.
3. Eliminate chat contract drift (`sessionId` optionality handled consistently).
4. Unify frontend WS/API base resolution to reduce environment drift.

Acceptance criteria:
- Unauthorized WS connection is rejected.
- Cross-user channel subscribe attempts are rejected.
- SSE token events arrive incrementally from OpenAI stream.
- Chat endpoints accept omitted `sessionId` and issue server-generated UUID.

### Phase 1 (P1): Accuracy and Prompt/Tool Alignment
1. Replace restrictive symbol validation in chat handlers/routes with canonical symbol validation.
2. Wire system prompt personalization from persisted user profile context (tier/experience/mobile).
3. Add explicit freshness metadata and staleness warnings in market-context responses.

Acceptance criteria:
- AI tool handlers accept valid symbols with digits, separators, and index formats.
- Prompt context includes validated tier and experience level when available.
- Responses include timestamp/source markers for current-market requests.

### Phase 2 (P2): UX Coverage and Performance
1. Expand interactive widget extraction for key tools (0DTE, IV, earnings analysis/calendar, journal insights).
2. Improve navigation speed with context-aware follow-up chips and reduced panel friction.
3. Add performance budgets for p95 first-token latency and API failure handling.

Acceptance criteria:
- Core tool responses render structured cards, not text-only fallback.
- Median time-to-first-action remains under target for new and advanced users.

### Phase 3 (P3): Validation and Release Gate
1. Add integration tests for authenticated chat and tool-call loops.
2. Add WebSocket authz tests (unauthorized/forbidden/authorized paths).
3. Update staging gate checklist to include streaming/authz/ticker parity checks.

Acceptance criteria:
- CI catches regressions in chat streaming, authz, and symbol routing.
- Release checklist passes with no critical findings.

## Work Breakdown (Current Sprint)
1. Implement shared token verification utility (HTTP + WS).
2. Harden WebSocket service and frontend WS clients.
3. Replace pseudo-streaming with OpenAI stream iterator.
4. Align chat schema/route/client for optional session IDs.
5. Align symbol validation across function handlers and chart route.
6. Wire prompt context from user profile and request headers.
7. Add and run tests.

## Risks and Mitigations
- Risk: Breaking existing clients with stricter WS auth.
  - Mitigation: pass JWT as `token` query in all in-repo WS clients and provide backward-compatible parsing.
- Risk: Streaming loop complexity with tool calls.
  - Mitigation: bounded iteration limits, token budget, and explicit fallback error events.
- Risk: Missing user profile fields for personalization.
  - Mitigation: optional context with safe defaults and strict enum normalization.

## Metrics to Track
- WS unauthorized rejection rate and forbidden channel rejection count.
- Chat success rate, p95 first-token latency, and stream interruption rate.
- Tool-call completion rate and symbol validation error rate.
- E2E pass rate for AI Coach critical workflow suite.
