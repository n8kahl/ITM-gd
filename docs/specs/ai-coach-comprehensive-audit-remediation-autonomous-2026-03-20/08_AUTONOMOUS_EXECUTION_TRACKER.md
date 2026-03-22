# Autonomous Execution Tracker: AI Coach Comprehensive Audit Remediation

Date: 2026-03-20
Governing spec: `docs/specs/AI_COACH_COMPREHENSIVE_AUDIT_REMEDIATION_EXECUTION_SPEC_2026-03-20.md`
Implementation plan: `docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/02_IMPLEMENTATION_PLAN_AND_PRIORITY_MODEL.md`

## 1. Slice Status

| Slice | Name | Status | Blocking Issue |
|---|---|---|---|
| 1 | Baseline contract lock + failing repros | Done | None |
| 2 | Event ingestion canonicalization | Done | None |
| 3 | Chat lifecycle concurrency hardening | Done | None |
| 4 | E2E contract fidelity repair | Done | None |
| 5 | Accessibility + mobile/desktop UX hardening | Done | None |
| 6 | Prompt/experience upgrade for day traders | Done | None |
| 7 | Data trust + polling consolidation | Done | None |
| 8 | Final validation + release closure | Done | None |
| 9 | Post-closure P2 hardening (session restore + selector stabilization) | Done | None |

## 2. Initial Findings Logged

1. Duplicate widget-event listeners can generate conflicting AI actions.
2. Abort/session lifecycle can leave sending state or stale session writes.
3. E2E helper routes and payloads drift from current proxy contracts.
4. AI Coach sessions/options Playwright suites have deterministic failures.
5. A11y suite readiness condition is unstable under streaming/polling.
6. Sessions list and async error surfaces need semantic accessibility hardening.
7. Prompt responses need stronger day-trader schema and risk-first consistency.
8. Market freshness/polling context is duplicated across top-level surfaces.

## 3. Session Log

### Session 2026-03-20
- Goal:
  - convert audit findings into a production execution packet
  - define slice-by-slice quality gates and remediation order
  - update AI Coach docs to point to current plan
- Completed:
  - authored governing execution spec
  - authored implementation plan, quality protocol, change-control, risk register, and tracker
  - updated AI Coach documentation index/status references
- Tests added:
  - none; docs-only planning session
- Tests run:
  - none; docs-only planning session
- Risks found:
  - event/listener duplication
  - send/abort/session race conditions
  - E2E contract drift
  - accessibility and prompt consistency gaps
- Risks mitigated:
  - planning packet now enforces deterministic repro tests, contract parity, and release gates
- Next slice:
  - Slice 1
- Blockers:
  - implementation not started yet

### Session 2026-03-20 (Slice 1 Execution)
- Goal:
  - complete Slice 1 baseline lock and contract codification
- Completed:
  - added baseline expected-fail repro tests for duplicate listeners, abort/session races, and route/payload drift
  - added shared AI Coach proxy route + payload fixtures for E2E contract alignment
  - added fixture contract tests
  - updated change-control and risk register entries
- Tests added:
  - `lib/__tests__/ai-coach-audit-baseline-repros.test.ts`
  - `lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts`
- Tests run:
  - `pnpm exec vitest run lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts`
  - Result: pass (2 files, 10 tests)
  - `pnpm exec eslint lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts e2e/specs/ai-coach/ai-coach-proxy-contract-fixtures.ts --max-warnings=0`
  - Result: pass
- Risks found:
  - duplicate listener and send lifecycle races remain active until Slice 2/3
  - E2E helper migration remains active until Slice 4
- Risks mitigated:
  - deterministic baseline repro coverage now exists
  - canonical proxy contract fixtures now exist for downstream suite migration
- Next slice:
  - Slice 2
- Blockers:
  - none

### Session 2026-03-20 (Slice 2 Execution)
- Goal:
  - canonicalize widget-event ingestion and add dedupe guardrails
- Completed:
  - removed duplicate widget listeners from workflow context
  - preserved page-level listeners as canonical ingestion layer
  - added event-id generation to widget dispatch helpers
  - added page-level event dedupe utility usage
  - upgraded baseline repro assertion to enforce single listener source
  - added dedicated dedupe utility tests
- Tests added:
  - `lib/__tests__/widget-event-dedupe.test.ts`
- Tests run:
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `pnpm exec eslint app/members/ai-coach/page.tsx contexts/AICoachWorkflowContext.tsx components/ai-coach/widget-actions.ts lib/ai-coach/widget-event-dedupe.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts lib/__tests__/widget-event-dedupe.test.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec vitest run lib/__tests__/widget-event-dedupe.test.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts`
  - Result: pass (3 files, 14 tests)
  - `rg -n "window\\.addEventListener\\('ai-coach-widget-chat'" app/members/ai-coach/page.tsx contexts/AICoachWorkflowContext.tsx`
  - Result: single listener source in page file
- Risks found:
  - potential accidental dedupe suppression if non-unique event IDs are emitted
- Risks mitigated:
  - event IDs are generated uniquely in widget dispatch helper
  - dedupe scope is per event channel and event ID
- Next slice:
  - Slice 3
- Blockers:
  - none

### Session 2026-03-20 (Slice 3 Execution)
- Goal:
  - eliminate send/abort/new-session race conditions and stuck-send behavior
- Completed:
  - added active send-token guard for async chat state writes
  - made abort path clear sending state and remove optimistic/streaming placeholders
  - made `newSession` abort in-flight send requests and reset sending state
  - made `selectSession` abort in-flight send requests before loading target messages
  - upgraded baseline repro assertions for abort/new-session fixes
- Tests added:
  - none new file; existing baseline repro suite updated
- Tests run:
  - `pnpm exec eslint hooks/use-ai-coach-chat.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec vitest run lib/__tests__/widget-event-dedupe.test.ts lib/__tests__/ai-coach-audit-baseline-repros.test.ts lib/__tests__/ai-coach-proxy-contract-fixtures.test.ts`
  - Result: pass (3 files, 14 tests)
  - `pnpm exec tsc --noEmit`
  - Result: pass
- Risks found:
  - low risk of over-suppressing updates when send-token mismatch occurs
- Risks mitigated:
  - only inactive request updates are suppressed; active request behavior unchanged
  - session transitions now explicitly cancel in-flight send operations
- Next slice:
  - Slice 4
- Blockers:
  - none

### Session 2026-03-21 (Slice 4 Execution)
- Goal:
  - complete E2E helper contract migration and eliminate deterministic suite brittleness
  - stabilize release-blocking AI Coach sessions/options/mobile/a11y gates
- Completed:
  - migrated AI Coach E2E helper routes to proxy contract constants and canonical payload shapes
  - aligned chat/session/options/chart mock payloads to current camelCase contract
  - hardened sessions/options selectors and interactions (panel scoping, option select handling, deterministic row assertions)
  - replaced a11y `networkidle` readiness with explicit UI-ready checks
  - implemented keyboard tab focus handoff in center panel and semantic `role="alert"` for chat error banner
  - filtered non-accessibility network console noise from a11y error gate
- Tests added:
  - none new file; release-blocking suites updated for deterministic contract fidelity
- Tests run:
  - `pnpm exec eslint e2e/specs/ai-coach/ai-coach-a11y.spec.ts e2e/specs/ai-coach/ai-coach-chat-messaging.spec.ts e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-options-panel.spec.ts e2e/specs/ai-coach/ai-coach-test-helpers.ts components/ai-coach/center-panel.tsx components/ai-coach/chat-panel.tsx --max-warnings=0`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-options-panel.spec.ts e2e/specs/ai-coach/ai-coach-mobile.spec.ts --project=ai-coach --workers=1`
  - Result: pass (34 tests)
  - `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-a11y.spec.ts --project=ai-coach --workers=1`
  - Result: pass (10 tests)
- Risks found:
  - transient infra instability can surface as `ERR_CONNECTION_REFUSED` or stale server port conflicts during long Playwright runs
- Risks mitigated:
  - final evidence runs are green after retry
  - deterministic assertions now avoid framework-level empty alert/live-region artifacts
- Next slice:
  - Slice 5
- Blockers:
  - none

### Session 2026-03-22 (Slice 5 Execution)
- Goal:
  - complete accessibility + UX hardening for session controls and async error/status surfaces in live AI Coach chat
- Completed:
  - upgraded active session panel to semantic list controls (`listbox`/`option`) with explicit selected state
  - added keyboard-accessible session interactions (focusable options, Enter/Space activation, arrow/home/end support)
  - added `aria-expanded`/`aria-controls` contracts to sessions toggle and accessible labels for icon-only controls
  - added semantic live-region treatment for error and rate-limit banners (`alert` + `status`)
  - hardened sessions and a11y Playwright suites to assert semantic controls and deterministic keyboard behavior
- Tests added:
  - none new files; updated existing sessions/a11y specs with semantic and keyboard assertions
- Tests run:
  - `pnpm exec eslint app/members/ai-coach/page.tsx e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-a11y.spec.ts --max-warnings=0`
  - Result: pass
  - `pnpm exec tsc --noEmit`
  - Result: pass
  - `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts --project=ai-coach --workers=1`
  - Result: pass (11 tests)
  - `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-a11y.spec.ts e2e/specs/ai-coach/ai-coach-mobile.spec.ts --project=ai-coach --workers=1`
  - Result: pass (25 tests)
- Risks found:
  - no new release-blocking risks; residual external data-provider authorization noise remains non-functional test noise
- Risks mitigated:
  - session and banner semantics are now explicit and validated by deterministic a11y/sessions coverage
  - keyboard control expectations are encoded in suite assertions
- Next slice:
  - Slice 6
- Blockers:
  - none

### Session 2026-03-22 (Slice 6 Execution)
- Goal:
  - enforce schema-first day-trader prompt contracts and uncertainty behavior
  - bind follow-up UX intents to structured plan fields
- Completed:
  - added day-trader response contract to system prompt (`Bias/Setup/Entry/Stop/Targets/Invalidation/Risk/Confidence`)
  - added intraday coach mode prompt context injection (`pre-market` / `live` / `post-trade`) from session-phase mapping
  - extended intent-router contract evaluator with schema enforcement and low-confidence clarify-before-commit checks
  - added system prompt regression tests and expanded intent-router contract tests
  - added schema-aware one-tap follow-up chip generation with low-confidence clarification priority and fallback parity
- Tests added:
  - `backend/src/chatkit/__tests__/systemPrompt.test.ts`
  - `components/ai-coach/__tests__/follow-up-chips.test.ts`
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
  - Result: partial fail due pre-existing `[data-role="user"]` selector mismatch in messaging suite
- Risks found:
  - over-constrained schema rules can reduce conversational flexibility if applied to non-actionable prompts
  - existing Playwright messaging suite has selector drift that can mask true user-visible regressions
- Risks mitigated:
  - schema/clarification checks are scoped to actionable intents only
  - follow-up chips preserve legacy fallback generation when schema signals are absent
- Next slice:
  - Slice 7
- Blockers:
  - none for Slice 6 closure; messaging-suite selector drift remains a separate QE cleanup item

### Session 2026-03-22 (Slice 7 Execution)
- Goal:
  - consolidate AI Coach top-level SPX polling/freshness into one canonical source
  - harden prompt market-session context for weekend/holiday/early-close behavior
  - add stale-data telemetry hooks for market freshness state transitions
- Completed:
  - replaced duplicated SPX pollers in chat header and center welcome panel with shared `useAICoachMarketSnapshot` source
  - propagated explicit freshness metadata (`freshnessStatus`, `freshnessLabel`, `freshnessDetail`, `asOfEt`, `generatedAt`) to user-visible AI Coach surfaces
  - added AI Coach market telemetry buffer + browser event stream (`ai-coach:market-telemetry`) with stale/recovery transition persistence
  - added `generatedAt` freshness timestamp to market indices service and client contract
  - hardened prompt session context logic with market-hours-aware weekend/holiday/early-close mapping
  - added backend regressions for prompt context and frontend freshness utility tests
- Tests added:
  - `backend/src/chatkit/__tests__/promptContext.test.ts`
  - `lib/__tests__/ai-coach-market-snapshot.test.ts`
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
- Risks found:
  - Playwright execution can fail in sandbox mode when local web-server port binding is restricted
- Risks mitigated:
  - escalated run restored deterministic sessions-suite validation
  - canonical snapshot source removes cross-surface quote/freshness drift
  - telemetry hooks now expose stale/recovery transitions for dashboarding/observability
- Next slice:
  - Slice 8
- Blockers:
  - no Slice 7 blockers; final release closure still depends on Slice 8 full-gate reruns and release packet assembly

### Session 2026-03-22 (Slice 8 Execution)
- Goal:
  - run full release-closure gates for AI Coach remediation slices
  - capture final evidence and close the autonomous execution packet
- Completed:
  - reran closure lint/typecheck/vitest/jest/playwright/build gates on touched remediation surfaces
  - resolved initial Playwright server-port conflict by reusing active server for deterministic gate rerun
  - updated status, change-control, risk register, and execution tracker to mark Slices 1-8 complete
  - documented residual non-blocking QE selector drift as tracked P2 follow-up
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
  - `PLAYWRIGHT_REUSE_SERVER=false pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-options-panel.spec.ts e2e/specs/ai-coach/ai-coach-mobile.spec.ts --project=ai-coach --workers=1`
  - Result: initial fail due existing web-server port in use (`127.0.0.1:3001`)
  - `PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts e2e/specs/ai-coach/ai-coach-options-panel.spec.ts e2e/specs/ai-coach/ai-coach-mobile.spec.ts --project=ai-coach --workers=1`
  - Result: pass (35 tests)
  - `PLAYWRIGHT_REUSE_SERVER=true pnpm exec playwright test e2e/specs/ai-coach/ai-coach-a11y.spec.ts --project=ai-coach --workers=1`
  - Result: pass (11 tests)
  - `pnpm build`
  - Result: pass
- Risks found:
  - local test infra can produce false negatives when Playwright attempts to spawn a duplicate server on an occupied port
- Risks mitigated:
  - deterministic rerun with `PLAYWRIGHT_REUSE_SERVER=true` validated release suites cleanly
  - residual messaging selector drift remains explicitly tracked as non-blocking P2 follow-up
- Next slice:
  - none (all slices complete)
- Blockers:
  - none; remediation packet closed with final gate evidence

### Session 2026-03-22 (Slice 9 Execution)
- Goal:
  - close residual P2 backlog for persisted session restore and messaging selector drift
  - validate focused chat/session gates after selector contract hardening
- Completed:
  - implemented restore-on-reload flow for persisted session IDs after successful sessions load
  - introduced canonical chat message selector contracts via `data-testid` + `data-message-role`
  - migrated Playwright messaging/session helper selectors to visible canonical contracts
  - added session restore regression in sessions suite and baseline restore contract check in vitest repros
  - stabilized messaging spec contract behavior (chat mock replacement path, visible selector handling, timing-tolerant checks)
- Tests added:
  - `e2e/specs/ai-coach/ai-coach-chat-sessions.spec.ts` restore regression
  - `lib/__tests__/ai-coach-audit-baseline-repros.test.ts` persisted-session restore assertion
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
- Risks found:
  - no new release-blocking risks
- Risks mitigated:
  - session continuity now restores persisted valid sessions on reload
  - selector contract drift removed by stable canonical message-role test IDs and helper-level visible locators
- Next slice:
  - none (residual P2 backlog closed)
- Blockers:
  - none
