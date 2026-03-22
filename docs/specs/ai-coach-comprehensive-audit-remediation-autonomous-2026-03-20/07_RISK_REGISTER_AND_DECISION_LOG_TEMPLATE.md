# Risk Register And Decision Log: AI Coach Comprehensive Audit Remediation

Date: 2026-03-20
Governing spec: `docs/specs/AI_COACH_COMPREHENSIVE_AUDIT_REMEDIATION_EXECUTION_SPEC_2026-03-20.md`
Implementation plan: `docs/specs/ai-coach-comprehensive-audit-remediation-autonomous-2026-03-20/02_IMPLEMENTATION_PLAN_AND_PRIORITY_MODEL.md`

## 1. Usage

Update this file whenever:

1. a new material risk is found
2. a risk is mitigated or accepted
3. a decision changes implementation scope or sequencing

## 2. Risk Register

| ID | Date | Severity | Area | Description | Mitigation | Owner | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| AICR-R1 | 2026-03-20 | P0 | Event Orchestration | Duplicate widget-event listeners can trigger conflicting or duplicated AI actions. | Move to one canonical listener path with event-id dedupe and deterministic tests. | Frontend Eng | Mitigated | Slice 2 removed workflow listener duplication and added event-id dedupe guardrails in the canonical page path. |
| AICR-R2 | 2026-03-20 | P0 | Chat Lifecycle | Abort and new-session race conditions can leave UI stuck or state-corrupted. | Enforce abort-safe state resets and stale-response suppression tokens. | Frontend Eng | Mitigated | Slice 3 added active-send token guards, abort-safe cleanup, and in-flight cancellation on new/select session paths. |
| AICR-R3 | 2026-03-20 | P1 | Test Contracts | E2E mocks drifted from proxy routes and payload contracts, causing false failures and hidden regressions. | Shared typed fixtures and contract-sourced mock helpers. | QE + Frontend | Mitigated | Slice 4 completed helper migration to proxy contract constants and aligned response shapes/selectors across sessions/options/mobile/a11y suites. |
| AICR-R4 | 2026-03-20 | P1 | Accessibility | Sessions list and async errors are not fully semantic/announced for assistive technology. | Semantic controls, live regions, keyboard-flow regression tests, a11y gate updates. | Frontend + UX | Mitigated | Slice 5 completed semantic sessions listbox/option controls, keyboard-selection parity, and live-region error/status banners with green a11y + sessions coverage. |
| AICR-R5 | 2026-03-20 | P1 | Prompt Quality | Day-trader responses may be inconsistent or under-specified on risk controls. | Structured prompt schema with regression evals and risk-policy checks. | AI Eng + Product | Mitigated | Slice 6 delivered schema-first contract checks, intraday mode prompt context, low-confidence clarify-before-commit enforcement, and schema-linked follow-up intents. |
| AICR-R6 | 2026-03-20 | P2 | Context Accuracy | Weekend/holiday market-state classification can skew prompt guidance. | Use market-hours/holiday-aware context rules and tests. | Backend + AI Eng | Mitigated | Slice 7 updated prompt session context to consume market-hours state (weekend/holiday/early-close aware) and added dedicated prompt-context regressions. |
| AICR-R7 | 2026-03-20 | P2 | Data Trust | Duplicate SPX polling sources can produce conflicting freshness context. | Consolidate to one shared snapshot source and propagate timestamps consistently. | Frontend Eng | Mitigated | Slice 7 replaced duplicated SPX poll loops with shared AI Coach market snapshot source and explicit freshness metadata/telemetry propagation. |
| AICR-R8 | 2026-03-20 | P1 | Release Confidence | Flaky readiness assumptions (`networkidle`) hide real regressions and block reliable gates. | Replace readiness with deterministic UI signals and stable suite setup. | QE | Mitigated | Slice 4 replaced implicit readiness with explicit UI checks and restored stable green a11y/session/options/mobile gates. |
| AICR-R9 | 2026-03-22 | P2 | QE Coverage | Playwright messaging suite selector drift (`[data-role="user"]`) is still out of sync with current chat DOM. | Align selector contracts with canonical message test IDs/roles and rerun messaging + sessions gates. | QE + Frontend | Mitigated | Slice 9 added canonical `ai-coach-message-*` selector contracts and helper-level visible-message locators; messaging + sessions suites are green. |

## 3. Decision Log

| ID | Date | Decision | Reason | Consequence |
|---|---|---|---|---|
| AICR-D1 | 2026-03-20 | Treat remediation as release-blocking quality work, not enhancement backlog. | P0/P1 issues impact correctness and trader trust. | Slices 1-6 are release critical. |
| AICR-D2 | 2026-03-20 | Keep one canonical widget-event ingestion path. | Dual listeners create conflicting side effects. | Remove parallel listeners and enforce dedupe contract tests. |
| AICR-D3 | 2026-03-20 | Make prompt responses schema-first for actionable trading guidance. | Free-form responses can omit critical risk information. | Prompt changes require regression fixtures and schema validators. |
| AICR-D4 | 2026-03-20 | Enforce fixture parity with production proxy routes and payloads. | Contract drift invalidates E2E signal quality. | Shared route constants and typed fixtures become mandatory. |
| AICR-D5 | 2026-03-20 | Require deterministic readiness gates in a11y and E2E suites. | `networkidle` is unstable for streaming/polling surfaces. | Suites must wait on explicit UI readiness conditions. |
| AICR-D6 | 2026-03-20 | Consolidate market snapshot polling to one source. | Multiple pollers cause data trust inconsistencies. | Shared data context/cache is required before release closure. |
| AICR-D7 | 2026-03-20 | Treat AI Coach page as the canonical widget-event ingestion layer. | Centralizing ingestion removes conflicting side effects between page and workflow context listeners. | Workflow context listener bindings are removed; event-id dedupe now runs in page-level handlers. |
| AICR-D8 | 2026-03-20 | Guard chat async state updates with an active send-token and cancel in-flight work on session transitions. | Prevent stale response writes and stuck-send states after abort/new-session/select-session actions. | Only active send operations can mutate chat send state and streaming placeholders. |
| AICR-D9 | 2026-03-21 | Treat explicit UI-ready signals as mandatory for AI Coach accessibility gates. | `networkidle` and empty framework live-region nodes produced false failures and low-confidence gate signal. | A11y tests now wait on deterministic UI readiness and assert meaningful alert content. |
| AICR-D10 | 2026-03-21 | Move focus to the activated tool tab during keyboard arrow navigation. | ARIA tab keyboard expectations require focus handoff to the active tab. | Keyboard navigation parity improved and tab-focus regression tests are now deterministic. |
| AICR-D11 | 2026-03-22 | Standardize sessions panel semantics as `listbox` + `option` with explicit selected state and keyboard activation. | Div-based click targets without semantic roles undercut assistive-technology clarity and deterministic keyboard testing. | Sessions interactions now expose stable a11y semantics and expanded-state contracts used by E2E/a11y gates. |
| AICR-D12 | 2026-03-22 | Enforce schema-first day-trader response contracts with low-confidence clarification gates and schema-linked one-tap follow-up intents. | Free-form responses can drift away from actionable risk controls and confidence discipline during intraday workflows. | Intent routing/evaluator contract now blocks missing schema and missing clarification on low-confidence setups; follow-up chips map directly to entry/stop/targets/invalidation/risk refinement. |
| AICR-D13 | 2026-03-22 | Treat `useAICoachMarketSnapshot` as canonical SPX quote/freshness source for AI Coach top-level surfaces. | Separate polling loops in chat and center panels produced conflicting freshness/error states and trust drift. | Chat header and welcome panel now read one shared snapshot contract, and stale/recovery transitions emit telemetry for monitoring dashboards. |
| AICR-D14 | 2026-03-22 | Close remediation packet after full Slice 8 gate reruns while carrying messaging selector drift as a separate non-blocking QE backlog item. | Release-critical audit findings and required closure gates are complete; remaining selector issue does not impact required release gate suites. | Slices 1-8 are formally closed with explicit residual-risk tracking instead of reopening completed remediation slices. |
| AICR-D15 | 2026-03-22 | Reopen a focused post-closure Slice 9 to close residual P2 session-restore and messaging-selector debt. | Persisted session rehydration and outdated messaging selectors materially reduced QE signal quality and user continuity confidence. | Session restore-on-reload is now enforced, message selectors are canonicalized, and residual P2 backlog is cleared in the active packet. |

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
