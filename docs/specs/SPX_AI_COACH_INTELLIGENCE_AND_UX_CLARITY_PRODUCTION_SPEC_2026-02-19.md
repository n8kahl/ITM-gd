# SPX AI Coach Intelligence + UX Clarity Production Spec

**Date:** February 19, 2026  
**Route:** `/members/spx-command-center`  
**Primary Scope:** Replace cluttered message-heavy coach UX with a concise, evidence-backed AI decision system that is actually useful in live 0DTE execution.

## 1. Executive Decisions

1. Replace template-heavy coach outputs with a structured AI `Decision Brief` contract.
2. Reduce coach UI to one primary recommendation surface (`Now`) plus optional context (`Why`, `History`).
3. Keep deterministic risk guardrails; AI may explain and prioritize, but cannot bypass hard risk rules.
4. Add anti-repetition memory so guidance updates only when market context materially changes.
5. Gate all changes behind new feature flags with instant rollback paths.

## 2. Current Problems (Validated)

### 2.1 Message generation is largely templated

- Current backend primarily emits deterministic strings via helper builders, not contextual AI reasoning.
- Keyword routing (`includes('risk')`, `includes('regime')`) drives responses.

Reference:
- `backend/src/services/spx/aiCoach.ts:54`
- `backend/src/services/spx/aiCoach.ts:348`

### 2.2 Coach UI is cluttered for decision speed

- Alert strip + quick actions + timeline + composer are simultaneously visible in many states.
- Traders must parse too much UI before acting.

Reference:
- `components/spx-command-center/ai-coach-feed.tsx:493`
- `components/spx-command-center/ai-coach-feed.tsx:566`
- `components/spx-command-center/ai-coach-feed.tsx:615`

### 2.3 Proactive guidance is repetitive/static

- Proactive messages are client-side template strings with cooldowns, not model-evaluated briefs.

Reference:
- `contexts/SPXCommandCenterContext.tsx:828`
- `contexts/SPXCommandCenterContext.tsx:860`
- `contexts/SPXCommandCenterContext.tsx:895`

## 3. Product Goals

1. In under 3 seconds, trader understands: `Do I act now, wait, reduce, or exit?`
2. Guidance includes concrete evidence from live context (setup, flow, regime, contract, stop distance).
3. Reduce repeated/no-change messages by at least 50% vs current baseline.
4. Improve coach action conversion (`action clicked -> execution state updated`) by at least 20%.

## 4. Non-goals

1. No broker order placement integration in this phase.
2. No rewrite of non-coach SPX modules (chart, setup detector, contract pricing engine).
3. No removal of existing `/coach/message` endpoint until v2 is fully validated.

## 5. Target UX Model

## 5.1 Primary surface: `Coach Now Card`

Single dominant card with:
- Verdict chip: `ENTER`, `WAIT`, `REDUCE`, `EXIT`
- Confidence score + freshness timestamp
- 1 sentence recommendation
- One primary action button + up to 2 secondary actions

## 5.2 Secondary surface: `Why`

Compact evidence row (max 3 bullets):
- Setup quality and confluence
- Flow alignment/divergence
- Regime and stop proximity

## 5.3 Tertiary surface: `History Drawer`

- Hidden by default.
- Contains timeline, prior briefs, and free-form chat interactions.
- Keeps main surface uncluttered in scan/evaluate/in-trade modes.

## 5.4 State behavior

Desktop:
- `scan`: show only `Coach Now Card` collapsed summary + action.
- `evaluate`: show full `Now + Why + Actions` for selected setup.
- `in_trade`: pin `Now Card` near trade metrics, auto-promote risk-related actions.

Mobile:
- Keep dock + bottom sheet.
- Bottom sheet opens directly to `Now` tab, not full timeline.
- Timeline moved to `History` tab.

## 6. Target AI Architecture

## 6.1 Decision pipeline

1. **Context Builder (deterministic):**
   - setup snapshot, flow summary, regime, contract details, stop distance, trade mode, recency markers.
2. **AI Evaluator (LLM):**
   - produces structured recommendation JSON only.
3. **Policy Guardrail Layer (deterministic):**
   - validates output, enforces risk constraints, rejects unsafe/incoherent recommendations.
4. **Brief Assembler:**
   - normalizes output into client-ready `DecisionBrief`.

## 6.2 New backend modules

Add:
- `backend/src/services/spx/coachDecisionEngine.ts`
- `backend/src/services/spx/coachContextBuilder.ts`
- `backend/src/services/spx/coachPolicyGuardrails.ts`

Keep existing:
- `backend/src/services/spx/aiCoach.ts` as v1 fallback.

## 6.3 Backward compatibility

- Existing `/api/spx/coach/message` remains intact.
- New endpoint introduced for v2 decision briefs.
- Frontend switches by flag; fallback to v1 on any v2 failure.

## 7. API Contracts

## 7.1 New endpoint: `POST /api/spx/coach/decision`

Request:

```json
{
  "setupId": "setup-2",
  "tradeMode": "evaluate",
  "question": "optional user question",
  "selectedContract": {
    "description": "6020P 2026-03-20",
    "bid": 26.5,
    "ask": 27.0,
    "riskReward": 2.35
  },
  "clientContext": {
    "layoutMode": "evaluate",
    "surface": "desktop_panel"
  }
}
```

Response:

```json
{
  "decisionId": "coach_decision_1739959800000",
  "verdict": "ENTER",
  "confidence": 78,
  "primaryText": "Enter on confirmation above 6020 with risk fixed at 6024.",
  "why": [
    "Confluence 5/5 with breakout vacuum structure",
    "Flow alignment 67% in trade direction",
    "Regime confidence 74% with supportive momentum"
  ],
  "riskPlan": {
    "invalidation": "Lose 6024 with opposing flow >55%",
    "stop": 6024,
    "maxRiskDollars": 2700,
    "positionGuidance": "1 contract max until second confirmation"
  },
  "actions": [
    {
      "id": "ENTER_TRADE_FOCUS",
      "label": "Enter Trade Focus",
      "style": "primary",
      "payload": { "setupId": "setup-2" }
    },
    {
      "id": "REVERT_AI_CONTRACT",
      "label": "Use AI Contract",
      "style": "secondary",
      "payload": { "setupId": "setup-2" }
    },
    {
      "id": "ASK_FOLLOW_UP",
      "label": "Why now?",
      "style": "ghost",
      "payload": { "prompt": "Explain timing and invalidation in 2 bullets." }
    }
  ],
  "severity": "warning",
  "freshness": {
    "generatedAt": "2026-02-19T15:31:12.000Z",
    "expiresAt": "2026-02-19T15:32:12.000Z",
    "stale": false
  },
  "contextHash": "sha256:...",
  "source": "ai_v2"
}
```

## 7.2 Error/fallback contract

On v2 generation failure:

```json
{
  "source": "fallback_v1",
  "verdict": "WAIT",
  "confidence": 0,
  "primaryText": "Coach v2 unavailable. Use risk-first execution rules.",
  "why": ["Temporary fallback engaged"],
  "actions": [{ "id": "OPEN_HISTORY", "label": "Open Coach History", "style": "secondary" }]
}
```

## 8. Frontend Contract + UI Changes

## 8.1 New components

Add:
- `components/spx-command-center/coach-now-card.tsx`
- `components/spx-command-center/coach-why-row.tsx`
- `components/spx-command-center/coach-history-drawer.tsx`

Refactor:
- `components/spx-command-center/ai-coach-feed.tsx` into thin orchestrator with tabs: `Now` and `History`.

## 8.2 Context additions

Update `contexts/SPXCommandCenterContext.tsx` to include:
- `latestCoachDecision: CoachDecisionBrief | null`
- `requestCoachDecision(options)`
- `executeCoachAction(actionId, payload)`

## 8.3 Action wiring (must be stateful)

Supported action IDs:
- `ENTER_TRADE_FOCUS`
- `EXIT_TRADE_FOCUS`
- `REVERT_AI_CONTRACT`
- `TIGHTEN_STOP_GUIDANCE`
- `REDUCE_SIZE_GUIDANCE`
- `ASK_FOLLOW_UP`
- `OPEN_HISTORY`

`REVERT_AI_CONTRACT` must call existing contract choice reset path to restore AI-recommended contract.

## 9. Anti-repetition + Memory

## 9.1 Deduping rules

- Store `lastDecisionBySetupId` with `contextHash` and `generatedAt`.
- If new context hash unchanged within 60s, return `NO_CHANGE` variant and avoid duplicate timeline spam.

## 9.2 Material-change thresholds

Trigger fresh brief if any true:
- setup status transition (forming -> ready -> triggered)
- flow alignment delta >= 8%
- stop distance crosses risk threshold (e.g. <= 3 points)
- contract R:R delta >= 0.2
- regime confidence delta >= 10 points

## 10. Deterministic Guardrails

Hard rules before emitting final verdict:
- If data stale or degraded, cannot emit `ENTER`.
- If setup confluence < threshold and no confirming flow, default `WAIT`.
- In-trade near stop with divergence must include `REDUCE` or `EXIT` candidate action.
- Never emit contradictory risk plan fields (e.g. stop beyond invalidation).

## 11. Feature Flags

Add flags in `lib/spx/flags.ts`:
- `coachDecisionV2`
- `coachSurfaceV2`
- `coachHistoryDrawerV1`
- `coachMemoryV1`
- `coachTrustSignalsV1`

Rollout order:
1. `coachDecisionV2` internal
2. `coachSurfaceV2` internal
3. `coachMemoryV1`
4. `coachTrustSignalsV1`
5. broader production cohort

## 12. Telemetry Contract

Add events in `lib/spx/telemetry.ts`:
- `COACH_DECISION_GENERATED`
- `COACH_DECISION_FALLBACK_USED`
- `COACH_VERDICT_RENDERED`
- `COACH_PRIMARY_ACTION_CLICKED`
- `COACH_SECONDARY_ACTION_CLICKED`
- `COACH_HISTORY_OPENED`
- `COACH_NO_CHANGE_SUPPRESSED`
- `COACH_FEEDBACK_SUBMITTED`

Payload baseline:
- `decisionId`
- `setupId`
- `tradeMode`
- `layoutMode`
- `verdict`
- `confidence`
- `source` (`ai_v2` | `fallback_v1`)
- `stale`

## 13. Phased Implementation Plan

### Phase 0: Contracts and Scaffolding

Deliverables:
- Define `CoachDecisionBrief` types in shared SPX types.
- Add flags and telemetry enums.
- Add backend route skeleton with fallback plumbing.

Gate:
- Typecheck and API schema tests passing.

### Phase 1: Backend Decision Engine v2

Deliverables:
- Implement context builder + AI evaluator + guardrails.
- Add `POST /api/spx/coach/decision`.
- Keep `/coach/message` untouched.

Gate:
- Unit tests for guardrail outcomes.
- Integration tests for success and fallback modes.

### Phase 2: Coach Surface Declutter

Deliverables:
- Introduce `Now` card and `Why` row.
- Move timeline to `History` drawer/tab by default.

Gate:
- E2E validation for scan/evaluate/in_trade and mobile sheet flows.

### Phase 3: Stateful Action Execution

Deliverables:
- Wire action IDs to SPX context operations.
- Ensure `REVERT_AI_CONTRACT` and trade focus actions mutate live state.

Gate:
- E2E tests verifying state transitions and contract reset behavior.

### Phase 4: Memory + Anti-repetition

Deliverables:
- Context hash, no-change suppression, material-change refresh triggers.

Gate:
- Unit tests for suppression logic.
- Telemetry confirms reduced repeat rate.

### Phase 5: Trust Signals + Feedback

Deliverables:
- Confidence/freshness chips.
- Per-brief helpfulness signal (`helpful/not helpful`).

Gate:
- Event integrity checks and UX acceptance review.

### Phase 6: Rollout + Hardening

Deliverables:
- staged rollout by flag
- monitor quality and fallback rates

Gate:
- KPI thresholds met for 3 consecutive sessions.

## 14. Test Plan

## 14.1 Unit

- `backend/src/services/spx/__tests__/coachDecisionEngine.test.ts`
  - verdict guardrails
  - stale/degraded handling
  - contradictory output normalization
- `lib/spx/__tests__/coachDecisionMemory.test.ts`
  - context hash suppression
  - material-change triggers

## 14.2 Integration

- `backend/src/__tests__/integration/spx-coach-decision-api.test.ts`
  - decision generation
  - fallback payload behavior

## 14.3 E2E

Add/extend:
- `e2e/spx-coach-messages.spec.ts`
  - now-card rendering and primary action
  - history drawer open/close
- `e2e/spx-setup-interaction.spec.ts`
  - `REVERT_AI_CONTRACT` action path
- `e2e/spx-layout-state-machine.spec.ts`
  - now-card behavior per state
- `e2e/spx-responsive.spec.ts`
  - mobile sheet defaults to `Now` tab

## 14.4 Regression suites

Run:
- existing SPX suite plus new decision v2 specs
- full `pnpm build`

## 15. Acceptance Criteria

1. Coach primary surface shows one clear recommendation with action and evidence.
2. Recommendation content changes when context changes; duplicate spam is suppressed.
3. Backend provides structured decision payload with deterministic guardrail validation.
4. Fallback works automatically if v2 generation fails.
5. Mobile and desktop maintain fast access and no visual clutter regressions.
6. `REVERT_AI_CONTRACT` is available and functional from coach actions.
7. Build, TS, and SPX e2e regression suite pass.

## 16. Rollback Plan

Immediate rollback by disabling:
- `coachDecisionV2`
- `coachSurfaceV2`
- `coachMemoryV1`

System reverts to existing `/coach/message` and current feed rendering.

## 17. Autonomous Delivery Checklist

Before each phase:
1. Confirm flag defaults and rollout target.
2. Confirm event schemas and dashboards.
3. Confirm stable e2e selectors.

During each phase:
1. Keep changes phase-scoped and reversible.
2. Run lint + targeted tests + build.
3. Log assumptions and deviations in this spec file.

Before merge:
1. SPX regression green.
2. No broken fallback path.
3. KPI instrumentation verified in staging.
