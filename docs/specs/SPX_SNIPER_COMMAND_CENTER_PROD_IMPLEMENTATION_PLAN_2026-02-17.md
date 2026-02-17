# SPX Sniper Command Center: Production Implementation Plan
**Date:** February 17, 2026  
**Scope:** `/members/spx-command-center` UX transformation with reliability guardrails

## 1. Outcomes and Success Criteria
- Reduce time-to-first-action for active traders.
- Make setup validity unambiguous (`actionable now` vs `forming watchlist`).
- Prevent noisy failure loops when upstream SPX services degrade.

## 2. KPIs (Required for rollout)
- `ttfa_seconds`: median seconds from page load to first setup select.
- `actionable_select_rate`: % sessions selecting a `ready|triggered` setup.
- `contract_recommendation_success_rate`: `200` recommendations / requests.
- `snapshot_degraded_rate`: % snapshots flagged degraded.
- `coach_alert_ack_latency_ms`: time to acknowledge top alert.
- `ui_error_log_rate`: browser console/network error volume per session.

## 3. Feature Flags
All flags are env-driven for controlled rollout.

- `NEXT_PUBLIC_SPX_BRIEFING_BAR_V1`
- `NEXT_PUBLIC_SPX_ACTION_STRIP_V1`
- `NEXT_PUBLIC_SPX_TWO_TIER_LAYOUT_V1`
- `NEXT_PUBLIC_SPX_SETUP_CARD_V2`
- `NEXT_PUBLIC_SPX_FLOW_V2`
- `NEXT_PUBLIC_SPX_LEVEL_MAP_V2`
- `NEXT_PUBLIC_SPX_COACH_V2`
- `NEXT_PUBLIC_SPX_MOBILE_BRIEF_V1`

Implementation source: `/Users/natekahl/ITM-gd/lib/spx/feature-flags.ts`

## 4. Phased Delivery Plan
### Phase 0: Reliability and Safety Gates
- [x] Add SPX feature-flag framework.
- [x] Add data-health state in context (`healthy | degraded | stale`).
- [x] Add proxy stale-cache/degraded fallback behavior for snapshot and contract-select.
- [x] Prevent degraded snapshot payloads from throwing hard client errors.
- [ ] Add per-endpoint telemetry counters (snapshot/contract-select success, degraded, timeout).
- [ ] Add alert thresholds and dashboard monitors.

### Phase 1: Mission Briefing + Action Strip
- [x] Implement briefing-bar variant in header (action summary + posture + prediction pills).
- [x] Implement action strip with top coach alert + actionable count + flow bias.
- [x] Wire into page with feature flags and keep fallback legacy components.
- [ ] Add dismissal persistence for top alert in session storage.
- [ ] Add click-through analytics events for strip interactions.

### Phase 2: Layout IA Refactor (Two-Tier)
- [ ] Replace 3-panel split with Tier 1 briefing strip + Tier 2 action layout.
- [ ] Keep contract selector above fold in default desktop viewport.
- [ ] Move level matrix to drawer/overlay.

### Phase 3: Setup Card v2 + Contract Inline
- [ ] Entry thermometer and proximity-first card layout.
- [ ] Inline contract preview for selected actionable setup.
- [ ] Confluence source chips promoted above fold.

### Phase 4: Tactical Flow + Coach
- [ ] Setup-aware flow alignment score.
- [ ] Pinned coach alert, quick-action prompts, setup-scoped message view.

### Phase 5: Advanced Visuals + Mobile Brief
- [ ] Level proximity map (replace table view).
- [ ] Probability cone setup markers.
- [ ] GEX landscape sizing/price marker.
- [ ] Mobile `Brief` tab.

## 5. Test Matrix
### Automated
- Unit: setup ranking/selection, flow alignment, health-state reducers.
- Integration: degraded snapshot and contract-select fallback handling.
- E2E: actionable setup select -> contract recommendation -> coach quick action.

### Manual
- Desktop resolutions: 1366x768, 1440x900, 1920x1080.
- Mobile read-only behavior: iPhone/Android common breakpoints.
- Failure drills: upstream 502, timeout, ws disconnect, stale snapshot.

## 6. Rollout and Rollback
### Rollout
1. Deploy with all new UX flags off in production.
2. Enable internal cohort only.
3. Enable canary cohort (5-10%).
4. Ramp to 25%, 50%, 100% with KPI gates.

### Rollback
- Toggle off any failing UX flag instantly.
- Keep Phase 0 reliability hardening enabled.
- If data errors exceed threshold, force legacy header/layout flags off.

## 7. Definition of Done
- No console/network error flood under degraded upstream.
- Trader can identify actionable setups in <3 seconds.
- Contract recommendation errors are explicit, rate-limited, and non-blocking.
- KPI dashboards validate equal or better conversion and lower confusion metrics.
