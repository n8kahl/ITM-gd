# SPX Command Center Autonomous Production Spec
Date: February 19, 2026
Owner: Product + Engineering (Autonomous Agent Execution)
Scope: `/members/spx-command-center` and supporting SPX API/proxy integration

## 1. Objective
Ship a production-grade SPX Command Center UX and reliability upgrade that:
1. Removes state contradictions (scan/evaluate/in-trade/post-trade).
2. Improves decision speed via clean hierarchy and single-primary-action flow.
3. Stabilizes real-time chart rendering (reduce jitter/clutter while preserving responsiveness).
4. Hardens degraded-path behavior under backend instability (`404/502/520/ERR_CONNECTION_RESET`).
5. Adds a live Market Clock in header (ET time + session state).

## 2. Product Outcomes (Success Metrics)
1. Reduce time-to-primary-action (setup selected -> enter trade) by >= 25%.
2. Reduce contradictory state renders to 0% (no in-trade screen with entry CTA).
3. Reduce failed contract recommendation request rate per active setup by >= 60% during backend incidents.
4. Improve chart visual stability: <= 1 focused-level set mutation per second under tick load.
5. Maintain green release gates: lint, types, build, integration, e2e smoke.

## 3. In-Scope
1. UI/UX flow and hierarchy for SPX command center panels.
2. Trade state machine enforcement across setup/feed/coach/contract surfaces.
3. Chart real-time rendering and level update behavior.
4. API call resiliency and client backoff/circuit-breakers.
5. Market clock in `SPXHeader`.
6. Telemetry for state transitions, retries, fallback usage, and user-action latency.

## 4. Out of Scope (for this spec cycle)
1. Brokerage order routing integration.
2. New backend strategy models for setup detection.
3. Mobile-native app rewrite.
4. Non-SPX command center redesign.

## 5. Current Pain Points (Must Fix)
1. In-trade mode still exposes entry actions and pre-trade coach verdicts.
2. Trade metrics can diverge across setup card, coach brief, and chart overlays.
3. Competing CTAs reduce clarity of the canonical next action.
4. Repeated endpoint retries flood logs and degrade UX during backend incidents.
5. Chart appears jumpy due to high-frequency price merges + frequent focused-level recomputation.

## 6. Design and Behavior Standards
1. One primary CTA per state.
2. One canonical source for active trade values (`entry`, `stop`, `target1`, `target2`, `risk`).
3. Contextual panel behavior by state:
- `scan`: discovery + evaluate readiness.
- `evaluate`: setup validation + contract.
- `in_trade`: management only (no entry CTA).
- `post_trade`: debrief + journal handoff.
4. Progressive disclosure for advanced metrics.
5. Accessibility baseline: 44px touch targets, visible focus, WCAG AA contrast for body text.

## 7. Chart Stability Strategy
### 7.1 Recommended Strategy (Hybrid)
1. Keep a high-frequency tick marker for immediate price visibility.
2. Commit candle body/wick updates on throttled cadence (250-500ms) or finalized microbars.
3. Recompute focused levels on fixed cadence (1000ms) with hysteresis:
- A level must remain rank-eligible for `N` cycles before replace.
4. Freeze auto-fit after user interaction (no fitContent on ongoing ticks).
5. Always keep canonical context levels visible (e.g., VWAP + active trade levels).

### 7.2 Alternative Strategies
1. Conservative mode: only finalized microbar updates + separate live last-price label.
2. Ultra-live mode: requestAnimationFrame batching + immutable lane buffers (higher complexity).

## 8. Architecture and State Model
### 8.1 Canonical Trade Plan
Create/derive a single `activeTradePlan` used by:
1. Setup summary card
2. Coach decision brief
3. Contract panel
4. Chart annotations

### 8.2 State Machine
Allowed transitions:
1. `scan -> evaluate` (select actionable setup)
2. `evaluate -> in_trade` (enter trade)
3. `in_trade -> post_trade` (exit trade)
4. `post_trade -> scan` (dismiss debrief)

Invalid UI combinations must be blocked by rendering guards.

### 8.3 Reliability Controls
1. Endpoint mode memory (GET/POST compatibility where needed).
2. Negative caching for empty recommendation results.
3. Exponential backoff for repeated coach decision failures.
4. Circuit-breaker window for non-recoverable endpoint mismatch states.

## 9. Phased Implementation Plan

## Phase 0: Baseline + Guardrails (P0)
### Deliverables
1. Baseline telemetry and error taxonomy for contract/coach/chart failures.
2. Snapshot of current UX metrics and render behavior.

### Tests
1. Unit: error classifier and backoff math.
2. Integration: proxy fallback responses (`404/502/520`).

### Exit Criteria
1. Baseline metrics logged and queryable.
2. No regression in existing tests.

## Phase 1: State Correctness + CTA Clarity (P0)
### Deliverables
1. Strict mode-gated action surfaces.
2. Remove in-trade entry controls and pre-trade verdict messaging.
3. Single dominant CTA per state.

### Tests
1. E2E: `in_trade` screen has no `Enter trade` action.
2. E2E: setup selection -> enter trade path <= 4 interactions.
3. Visual regression: right rail hierarchy snapshots.

### Exit Criteria
1. 0 contradictory state renders in QA session traces.

## Phase 2: Canonical Trade Values (P0)
### Deliverables
1. `activeTradePlan` mapping and adapter in context layer.
2. Unified bindings across setup/coach/chart/contract.

### Tests
1. Unit: trade plan derivation and rounding consistency.
2. E2E: values match across all panels.

### Exit Criteria
1. No cross-panel numerical mismatch in test scenarios.

## Phase 3: Chart Stability Pass (P0)
### Deliverables
1. Throttled candle updates.
2. Focused-level recompute cadence + hysteresis.
3. Auto-fit freeze after user pan/zoom.
4. Declutter level label policy.

### Tests
1. Unit: focused-level selection cadence/hysteresis.
2. Performance test: update loop under simulated tick burst.
3. Manual QA: no visual flicker beyond threshold.

### Exit Criteria
1. Chart stable under 3-minute live feed run.
2. Focus-level churn <= 1 mutation/second.

## Phase 4: Coach UX Modernization (P1)
### Deliverables
1. Context-aware action groups by state.
2. Decision brief always concise + actionable.
3. History/details collapsed by default.

### Tests
1. E2E: quick-action behavior differs correctly by mode.
2. Snapshot tests for coach header/action layout.

### Exit Criteria
1. Coach panel supports primary workflow without ack/cleanup friction.

## Phase 5: Reliability Hardening (P1)
### Deliverables
1. Backoff/circuit-breaker for contract and coach requests.
2. Degraded-state UX messaging with retry controls.
3. Retry suppression to prevent request storms.

### Tests
1. Integration: forced `404/502/520` returns.
2. E2E: no repeated spam calls in 60s incident window.

### Exit Criteria
1. Request volume remains bounded during induced backend failures.

## Phase 6: Final Polish + Release (P1)
### Deliverables
1. Market clock present and readable in header.
2. Final typography/contrast/tap-target pass.
3. Release notes + runbook.

### Tests
1. Full lint/type/build.
2. Full SPX command center e2e smoke.
3. Visual diff approval pass.

### Exit Criteria
1. All gates green.
2. Stakeholder signoff completed.

## 10. Testing Matrix (Required)
1. Unit tests:
- state transitions
- activeTradePlan derivation
- retry/backoff/circuit-breaker behavior
- chart-focused-level selector
2. Integration tests:
- `/api/spx/[...path]` proxy fallback and error mapping
- contract-select mode compatibility
- coach-decision degraded behavior
3. E2E tests:
- scan -> evaluate -> in_trade -> post_trade flow
- contract selection/revert AI contract
- coach quick actions by mode
- market clock render and second-level tick
- degraded backend scenarios
4. Performance checks:
- chart update cadence
- component re-render counts (key panels)
- input responsiveness under feed load

## 11. Release Quality Gates (Blocking)
1. `pnpm exec eslint` (no errors)
2. `pnpm exec tsc --noEmit` (no errors)
3. `pnpm build` (no failures)
4. Critical e2e suite pass
5. Manual QA checklist pass (state consistency, chart stability, CTA clarity)
6. No P0/P1 open defects

## 12. Autonomous Execution Protocol
1. Branching:
- Use `codex/<feature-slice>` branch per phase or grouped slices.
2. Commit strategy:
- Atomic commits per phase objective.
- Commit message includes subsystem + intent.
3. Verification per commit:
- Run local phase-appropriate tests before commit.
4. Escalation rules:
- If unexpected unrelated file mutations appear, pause and request direction.
- If failing gate cannot be resolved in current phase, block merge and document.
5. PR body template must include:
- scope
- risk assessment
- tests run
- rollback plan

## 13. Monitoring and Observability
Track these event families:
1. `UX_LAYOUT_MODE_CHANGED`
2. `CONTRACT_REQUESTED` / `CONTRACT_RESULT`
3. `COACH_DECISION_GENERATED` / `COACH_DECISION_FALLBACK_USED`
4. `FLOW_MODE_TOGGLED`
5. `LEVEL_MAP_INTERACTION`
6. `CHART_LEVEL_SET_CHANGED`
7. `CHART_PRICE_COMMIT`

Dashboards should include:
1. endpoint error rate by status code
2. request retries per setup/session
3. action latency (selection -> enter)
4. chart stability counters (focused-level swaps/min)
5. tick commit quality (committed/no-change/stale-dropped ratios)

## 14. Rollback Plan
1. Keep feature flags for high-risk slices (`coachSurfaceV2`, chart stability behavior, smart stack behavior).
2. If degradation detected:
- disable high-risk UI flags
- keep correctness and reliability fixes active
3. Maintain prior stable rendering path for emergency fallback.

## 15. Immediate Next Work Items
1. Validate market clock behavior in QA (session labels, ET rollover, weekend handling).
2. Implement strict mode-state action guard across setup/coach/contract.
3. Implement chart focused-level hysteresis + cadence.
4. Validate with phased gates and ship incrementally.

## 16. Manual QA Checklist (Phase 3+)
1. Level churn check (focused mode):
- Keep chart in `Focus Only` for 3 minutes on `1m`.
- Expected: level labels update at controlled cadence, no rapid per-tick jumping.
- Pass criteria: <= 1 focused-level set mutation/second, no visible flicker bursts.
2. Tick jitter check:
- Observe live `SPX` during active movement for 2 minutes.
- Expected: candles update smoothly without micro-jitter on every packet.
- Pass criteria: no “strobe” effect on candle body/wick movement.
3. User-pan preservation:
- Pan/zoom away from latest bar during live feed.
- Expected: chart should not snap back to real-time while user-adjusted viewport is active.
- Pass criteria: viewport remains stable until explicit user reset.
4. VWAP/critical context persistence:
- Confirm `VWAP` and active trade levels remain visible while focused set updates.
- Expected: context levels should not disappear transiently due to ranking churn.
- Pass criteria: VWAP and trade markers remain continuously rendered.
5. Degraded feed behavior:
- Simulate tick lag/poll fallback.
- Expected: no excessive chart jump when source switches; header/source badges update correctly.
- Pass criteria: continuity preserved, no hard reset visual jumps.
