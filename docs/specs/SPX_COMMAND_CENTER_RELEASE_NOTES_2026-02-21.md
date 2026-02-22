# SPX Command Center Release Notes
Date: February 21, 2026
Track: Production Recovery Autonomous Program

## Highlights
1. Feed-trust and fallback safety are now deterministic, reason-coded, and tied directly to command/CTA safety.
2. Decision intelligence now enriches setup ranking with alignment, confidence trend, EV(R), and explainability drivers/risks.
3. Chart experience upgraded with replay controls, scenario lanes, and focus-mode switching.
4. Post-trade loop now auto-captures journal artifacts and renders adherence/expectancy analytics.
5. Feature-flag governance now includes full lifecycle metadata coverage.

## Included Phase Milestones
1. Phase 7 complete: data orchestrator and feed-trust hardening.
2. Phase 8 complete: decision intelligence and risk-envelope gating.
3. Phase 9 complete: chart interaction, replay, scenario lanes, focus modes.
4. Phase 10 complete: journal automation and governance hardening.
5. Phase 11 slice P11-S1 complete: regime-aware contract selector hardening, R:R feasibility gate in trade suggestions, and mechanical 1R/2R trailing exit advisories.
6. Phase 11 slice P11-S2 complete: ranging setup hardening and fade target/stop geometry recalibration, improving strict last-week SPX backtest win-rate and expectancy.
7. Phase 11 slice P11-S3 complete: setup-mix diversification caps/recovery controls and actionable-only strict backtest fidelity (gate-blocked setups excluded by default).
8. Phase 11 slice P11-S4 complete: confidence-aware optimizer scoring and promotion guardrails (95% Wilson intervals + conservative objective), with scorecard CI transparency to reduce low-sample overfitting.
9. Phase 11 slice P11-S5 complete: corrected realized-R runner accounting after T1 (including no-BE stop paths and mark-to-close runner legs), then re-ran YTD Massive second-bar policy sweeps for SL/TP decision fidelity.
10. Phase 11 slice P11-S6 complete: setup-specific runner policy (fade conditional no-BE), mean-reversion target/quality retune, and rebuilt strict last-week replay with improved T2 capture and expectancy.
11. Phase 11 slice P11-S7 complete: actionable-only win-rate fidelity (hidden-tier exclusion), full intraday setup lifecycle preservation during historical reconstruction, regime trend-strength retune, and setup-type DB contract expansion for ORB/pullback families.
12. Phase 11 slice P11-S8 complete: mean-reversion quality floor uplift, breakout-vacuum gate hardening, persistent manual optimizer setup pauses, and validated last-week strict replay improvement in T1/T2/failure/expectancy.

## Quality Gate Summary
1. `pnpm exec eslint .` passed (`0` errors, existing non-blocking warnings only).
2. `pnpm exec tsc --noEmit` passed.
3. `pnpm run build` passed.
4. SPX vitest suite passed (`24/24` files, `85/85` tests).
5. SPX Playwright suite passed (`29/29`).
6. Final release gate revalidated under Node `v22.12.0` (project target runtime).

## Operational Notes
1. Replay/focus controls are controller-owned and command/action-strip synchronized.
2. Trade journal capture triggers on `exitTrade` only when active trade context exists.
3. Flag lifecycle metadata is mandatory for active SPX UX flags.
4. Final E2E stabilization fixed a strict-selector ambiguity in mobile state assertions by introducing deterministic mode-chip test IDs.
