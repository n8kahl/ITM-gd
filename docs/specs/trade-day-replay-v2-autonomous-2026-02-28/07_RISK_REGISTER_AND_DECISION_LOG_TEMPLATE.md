# Trade Day Replay V2 — Risk Register & Decision Log

> **Created:** 2026-02-28

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|------------|--------|
| R1 | Chart marker plugin typing drift after lightweight-charts upgrades | Medium | Medium | Keep marker mapping unit tests in CI and lock major version | Residual |
| R2 | Replay admin gate mismatch between page visibility and backend gate | Low | High | Health preflight UX plus enforced `profiles.role='admin'` provisioning | Residual |
| R3 | External market/AI services fail during replay build | Medium | Medium | Deterministic error statuses + user-facing degraded messages | Residual |
| R4 | Day-level options context interpreted as point-in-time data | Low | Medium | Explicit "Day-of Greeks" labeling in trade card UI | Residual |
| R5 | False-green from broad test commands with no matching files | Low | Medium | Run targeted replay file paths under Node 22 gates | Closed |

## Final Residual Risks + Rollback Points (V2)

| Residual Risk | Trigger Signal | Rollback Point |
|---|---|---|
| Native marker/price-line rendering regression | Replay markers or stops desync from pan/zoom/replay cursor | Revert `components/trade-day-replay/replay-chart.tsx` and `components/trade-day-replay/trade-chart-markers.ts` to pre-V2 marker path |
| Prior-day aggregates unavailable or unstable | Missing/erratic `priorDayBar` for normal trading days | Remove `priorDayBar` enrichment from `backend/src/routes/trade-day-replay.ts` and mirrored payload typing |
| External provider outages (Massive/OpenAI) | Replay build errors spike (`422`/`502`) or repeated provider auth failures | Keep V2 UI, rollback only new provider-dependent surface additions if error budget exceeded |
| Day-granularity options context misunderstood as point-in-time | User reports mismatch between intraday candle and options context | Temporarily suppress/options-context block in trade cards while preserving core replay |

---

## Decision Log

| ID | Decision | Rationale | Date | Phase |
|----|----------|-----------|------|-------|
| D1 | Keep native chart markers over HTML overlays | Marker/line overlays must pan/zoom with chart and replay cursor | 2026-02-27 | V2 Slice 3 |
| D2 | Include prior-day high/low as optional payload field | Key levels improve context but replay should not hard-fail when unavailable | 2026-02-27 | V2 Slice 4 |
| D3 | Use deterministic session grading utility in `lib/` | Consistent reusable scoring for UI and tests | 2026-02-27 | V2 Slice 5 |
| D4 | Add explicit replay unit tests + focused Playwright suite | Close production-hardening gap for non-happy paths and mapping logic | 2026-02-28 | V2 Hardening |
| D5 | Close Session C with Node 22 targeted gate transcript as release authority | Avoid false-green from broad suites and keep replay closeout reproducible | 2026-02-28 | V2 Release Closeout |
