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
13. Phase 11 slice P11-S9 complete: live-parity backtest filtering now excludes optimizer-paused setup types/combos by default, while optimizer/backfill research paths explicitly include paused setups for analysis continuity.
14. Phase 11 slice P11-S10 complete: ORB/trend-pullback audit and gating rebalance, trend target-geometry bounds, triggered-tier visibility correction, and refreshed 2026 YTD/last-week Massive replays with improved strict last-week T1/T2/expectancy while keeping ORB quality-gated.
15. Gold Standard published: `SPX_COMMAND_CENTER_GOLD_STANDARD_CONFIG_2026-02-22.md` is now the canonical live/backtest/optimizer baseline reference for SPX win-rate governance.
16. Phase 11 slice P11-S11 complete: strict failure attribution tooling, ORB flow-quality gating, trend/mean/fade conservative target refinement, late-day contract execution hardening (including earlier 0DTE rollover), and stronger optimizer promotion guardrails (T1/T2/expectancy/failure deltas).
17. Phase 12 slice P12-S1 complete: profile-driven setup geometry policy (setup-type + optional regime/time-bucket overrides) now feeds live setup target/stop shaping, backtest geometry lookup now supports scoped override keys, and SPX realtime trigger notifications now ship with toast + browser-notification routing (dedupe/cooldown + user preference gate).
18. Phase 12 slice P12-S5 complete: setup `pWin` is now calibrated from realized `spx_setup_instances` outcomes (hierarchical setup/regime/time-bucket smoothing + conservative blending), and nightly optimization now runs replay reconstruction before scan/promotion so optimizer decisions are based on reconstructed Massive-driven actuals.

## Phase 16 Institutional Update (2026-02-23)
1. P16-S1 removed ORB sparse-flow grace per policy; low-conviction ORB bypass is no longer in the detector path.
2. P16-S2 added bounded trend-pullback recovery alternatives and widened trend timing windows without restoring ORB grace behavior.
3. P16-S3 persisted deterministic flow/microstructure evidence into setup-instance metadata for replay/attribution parity.
4. P16-S4 hardened execution realism with envelope-style Tradier credential handling, production runtime guards, and proxy-share fail/warn gates.
5. P16-S5 added promotion governance floors (resolved sample, setup-family diversity, conservative objective delta, execution fill evidence, proxy-share cap) and surfaced governance reasons in optimizer UI.
6. P16-S6 institutional promotion decision: **BLOCKED**.
7. Blocking evidence snapshot (latest strict window): `triggered=1`, `resolved=1`, `T1=0%`, `T2=0%`, `failure=100%`, `expectancyR=-1.04`; optimizer data-quality gate passed (`options replay coverage=100%`, replay universe `102`) but governance remained unqualified.
8. Gold Standard percentages remain unchanged targets for release eligibility:
   - `T1 >= 76.47%`
   - `T2 >= 70.59%`
   - `failureRate <= 17.65%`
   - `expectancyR >= +1.128`

## Phase 14 Setup Detection & Optimization Enhancement (2026-02-23)
### Phase 1: Gate Recalibration (P14-S8 through P14-S10)
1. **P14-S8**: ORB breakout rescue — flow/volume/EMA grace pattern (mirroring trend_pullback), opening range width filter (4-18pt), `SPX_ORB_FLOW_GRACE_ENABLED` env flag.
2. **P14-S9**: Strategy gate recalibration — relaxed breakout_vacuum gates (confluence 5→4, pWin 0.70→0.62, evR 0.40→0.28), tightened trend_pullback (pWin 0.58→0.62).
3. **P14-S10**: Time-bucket expansion from 3→5 (early_open/opening/midday/afternoon/close) with late-session geometry compression.

### Phase 2: Geometry Sweep Expansion (P14-S11 through P14-S13)
4. **P14-S11**: Geometry sweep expanded from 4 to all 7 setup families (added trend_continuation, breakout_vacuum, flip_reclaim).
5. **P14-S12**: Direction-aware sweep library (bullish/bearish per-family splits with MIN_DIRECTION_SAMPLE_SIZE=5).
6. **P14-S13**: Direction-aware optimizer integration — direction-qualified profile keys, 8-key geometry resolution chain with undirected fallback.

### Phase 3: Regime-Adaptive Trade Management (P14-S14 through P14-S16)
7. **P14-S14**: Regime-adaptive partial at T1 (compression:75%, ranging:70%, trending:55%, breakout:50%) + breakeven+0.15R stop converting T2 failures to micro-wins.
8. **P14-S15**: GEX-adaptive stop scaling (positive GEX: tighten 10%, negative GEX + mean-reversion: widen 10%).
9. **P14-S16**: VWAP bridge to optimizer — `vwap_alignment` confluence source, `vwap_direction_misaligned` gate (±0.15% tolerance), `SPX_VWAP_GATE_ENABLED` env flag.

### Aggregate Target Impact
| Metric | Current | Target |
|--------|---------|--------|
| T1 Win Rate | 63.16% | 68-72% |
| T2 Win Rate | 51.75% | 57-62% |
| Failure Rate | 35.96% | 28-32% |
| Expectancy | +0.48R | +0.85-1.10R |

### New Environment Flags
- `SPX_ORB_FLOW_GRACE_ENABLED` (default: true) — ORB flow/volume/EMA grace
- `SPX_VWAP_GATE_ENABLED` (default: true) — VWAP directional gate

## Quality Gate Summary
1. `pnpm exec eslint .` passed (`0` errors, existing non-blocking warnings only).
2. `pnpm exec tsc --noEmit` passed.
3. `pnpm run build` passed.
4. SPX jest suite passed (`15/15` suites, `71/71` tests).
5. Final release gate revalidated under Node `v22.22.0` (project target runtime).

## Operational Notes
1. Replay/focus controls are controller-owned and command/action-strip synchronized.
2. Trade journal capture triggers on `exitTrade` only when active trade context exists.
3. Flag lifecycle metadata is mandatory for active SPX UX flags.
4. Final E2E stabilization fixed a strict-selector ambiguity in mobile state assertions by introducing deterministic mode-chip test IDs.
