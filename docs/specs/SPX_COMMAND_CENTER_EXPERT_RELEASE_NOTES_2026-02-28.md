# SPX Command Center Expert — Release Notes
Date: 2026-02-28
Release: Expert Workflow Consolidation (`P0-S1` through `P5-S3`)
Status: Candidate for production promotion
Owner: Product + Engineering

## 1. Scope Summary by Phase/Slice

### Phase 0 — Baseline + Contract Seed
1. `P0-S1`: Locked baseline selector/API contracts and identified initial regression envelope.
   Evidence: `SPX_COMMAND_CENTER_EXPERT_PHASE0_SLICE_P0-S1_2026-02-28.md`
2. `P0-S2`: Added trade-stream selector contract fixtures and deterministic mock payload contracts.
   Evidence: `SPX_COMMAND_CENTER_EXPERT_PHASE0_SLICE_P0-S2_2026-02-28.md`

### Phase 1 — Backend Trade Stream Read Model
1. `P1-S1`: Introduced canonical trade-stream contracts/types.
2. `P1-S2`: Implemented lifecycle assembly service.
3. `P1-S3`: Added `/api/spx/trade-stream` route and trust/freshness fields.
4. `P1-S4`: Added deterministic lifecycle/sorting/freshness test coverage.
Evidence: `SPX_COMMAND_CENTER_EXPERT_PHASE1_SLICE_P1-S1_2026-02-28.md` through `...P1-S4...`

### Phase 2 — Trade Stream UI Conversion
1. `P2-S1`: Added frontend trade-stream data plumbing and panel scaffold.
2. `P2-S2`: Completed selector-contract UI surface.
3. `P2-S3`: Hardened row-action semantics + flag behavior.
4. `P2-S4`: Completed decision-surface dedupe and read-only interaction safety.
Evidence: `SPX_COMMAND_CENTER_EXPERT_PHASE2_SLICE_P2-S1_2026-02-28.md` through `...P2-S4...`

### Phase 3 — Coach Facts Migration
1. `P3-S1`: Added coach facts rail scaffold.
2. `P3-S2`: Simplified coach facts actions.
3. `P3-S3`: Moved timeline/chat to details-only disclosure.
4. `P3-S4`: Removed visual-heavy coach shell chrome in facts mode.
Evidence: `SPX_COMMAND_CENTER_EXPERT_PHASE3_SLICE_P3-S1_2026-02-28.md` through `...P3-S4...`

### Phase 4 — Control Surface Simplification + Responsive Hardening
1. `P4-S1`: Reduced action strip to core-six controls by default.
2. `P4-S2`: Moved non-core controls into advanced drawer.
3. `P4-S3`: Enforced stage-path dedupe across surfaces.
4. `P4-S4`: Verified 375px and 1280px responsive contracts with overflow assertions.
Evidence: `SPX_COMMAND_CENTER_EXPERT_PHASE4_SLICE_P4-S1_2026-02-28.md` through `...P4-S4...`

### Phase 5 — Telemetry + Contract Hardening + Release Packet
1. `P5-S1`: Added trade-stream usage telemetry and decision-latency metrics.
2. `P5-S2`: Hardened E2E contracts for lifecycle order, now-focus fallback, coach facts mode, and dedupe continuity.
3. `P5-S3`: Completed release packet and sign-off artifacts.
Evidence: `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S1_2026-02-28.md`, `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S2_2026-02-28.md`, `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S3_2026-02-28.md`

## 2. Key Behavior Changes
1. Setup panel now supports deterministic trade-stream lifecycle presentation (`forming -> triggered -> past`) with explicit now-focus behavior.
2. Stage-trade pathways are deduped in desktop state; primary CTA owns STAGE execution when dedupe is active.
3. Coach facts mode delivers concise factual guidance by default and details-only timeline/composer disclosure.
4. Default visible controls are reduced to core-six with non-core controls moved behind advanced entrypoints.
5. Trade-stream telemetry now records render, row selection/action, stage suppression, and decision latency (`spx_decision_latency_measured`).

## 3. Known Issues / Non-Blocking Warnings
1. Playwright webserver logs may show Massive entitlement warnings (`NOT_AUTHORIZED`) in mocked test sessions; tests remain deterministic and pass.
2. Playwright webserver logs may include `baseline-browser-mapping` age warning; informational only.
3. Playwright logs may include `NO_COLOR` + `FORCE_COLOR` warning; informational only.
4. Occasional websocket connection-limit warning observed in Session B evidence; non-blocking for release gates.

## 4. Rollout Flags and Rollback Flags

### Rollout Flags
1. `SPX_TRADE_STREAM_BACKEND_SORT_ENABLED`
2. `SPX_EXPERT_TRADE_STREAM_ENABLED`
3. `SPX_COACH_FACTS_MODE_ENABLED`
4. `SPX_SIMPLIFIED_ACTION_STRIP_ENABLED`

### Recommended Rollout Order
1. Enable `SPX_TRADE_STREAM_BACKEND_SORT_ENABLED`.
2. Enable `SPX_EXPERT_TRADE_STREAM_ENABLED`.
3. Enable `SPX_COACH_FACTS_MODE_ENABLED`.
4. Enable `SPX_SIMPLIFIED_ACTION_STRIP_ENABLED`.

### Rollback Flags
1. Disable `SPX_SIMPLIFIED_ACTION_STRIP_ENABLED`.
2. Disable `SPX_COACH_FACTS_MODE_ENABLED`.
3. Disable `SPX_EXPERT_TRADE_STREAM_ENABLED`.
4. Disable `SPX_TRADE_STREAM_BACKEND_SORT_ENABLED`.

## 5. Validation Evidence Index
1. Primary contract and gate evidence: `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S2_2026-02-28.md`.
2. Telemetry contract evidence: `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S1_2026-02-28.md`.
3. Release packet sign-off evidence: `SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S3_2026-02-28.md`.
