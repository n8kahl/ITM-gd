# Swing Sniper Member Center Runbook

**Workstream:** Swing Sniper Member Center
**Date:** 2026-03-09
**Status:** Updated through Slice 4.3
**Governing Spec:** `docs/specs/SWING_SNIPER_MEMBER_CENTER_EXECUTION_SPEC_2026-03-09.md`

---

## 1. Purpose

This runbook defines the expected operating model for Swing Sniper. Phase 1 through Phase 4 are now implemented, including route wiring, health preflight, ranked board/dossier surfaces, Structure Lab contract recommendations, Risk Sentinel monitoring, and adaptive backtest confidence overlays.

---

## 2. Preflight Checks

Before enabling Swing Sniper in any environment:

1. Confirm `MASSIVE_API_KEY` is configured for backend services.
2. Confirm member tab config migration has seeded `swing-sniper`.
3. Confirm `swing-sniper` tab requires Lead Discord role (`1465515598640447662`) and admin bypass is intact.
4. Confirm backend Swing Sniper health endpoint returns dependency status.
5. Confirm optional Benzinga earnings probe degrades to `optional` when unsupported.
6. Confirm Supabase tables and RLS policies are applied.
7. Confirm no brokerage dependency is required anywhere in the Swing Sniper route flow.

---

## 3. Dependency Expectations

| Dependency | Requirement | Failure Behavior |
|------------|-------------|------------------|
| Massive.com options | Required | Swing Sniper board returns degraded status |
| Massive.com news | Preferred | Dossier falls back to non-news thesis copy |
| Benzinga add-on | Optional | Catalyst enrichments marked unavailable |
| LLM reasoning provider | Preferred | Rules-based summary fallback |
| Supabase | Required for saved theses | Page remains read-only if write path fails |

Current implemented endpoints:

1. `GET /api/swing-sniper/health`
2. `GET /api/swing-sniper/universe`
3. `GET /api/swing-sniper/dossier/:symbol`
4. `POST /api/swing-sniper/structure/recommend`
5. `GET /api/swing-sniper/monitoring`
6. `GET /api/swing-sniper/backtest/:symbol`
7. `GET /api/members/swing-sniper/health`
8. `POST /api/members/swing-sniper/structure`
9. `GET /api/members/swing-sniper/monitoring`
10. `GET /api/members/swing-sniper/backtest/:symbol`
11. `/members/swing-sniper`

---

## 4. Validation Commands

Slice-level:

```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
pnpm vitest run <targeted tests>
pnpm exec playwright test <targeted specs> --project=chromium --workers=1
```

Release-level:

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run
pnpm exec playwright test e2e/specs/members/dashboard-navigation.spec.ts --project=chromium --workers=1
```

---

## 5. Operational Fallbacks

1. If universe scan fails, continue serving last successful snapshot with a stale label.
2. If LLM reasoning fails, show structured facts and a rules-based explanation.
3. If Benzinga fields are unavailable, use earnings + economic + news fallback inputs.
4. If persistence writes fail, keep Swing Sniper read-only and surface a non-blocking toast.
5. If monitoring or backtest subsystems fail, keep opportunity and dossier views available while labeling those modules degraded.

---

## 6. Rollback Strategy

1. Disable the Swing Sniper tab in `tab_configurations`.
2. Keep backend routes behind route-level health/dependency guard.
3. Revert the latest Swing Sniper slice branch if regression is isolated.
4. Preserve saved thesis data unless a schema rollback is explicitly required.
5. Brokerage rollback is not applicable because brokerage integration is out of scope.

---

## 7. Post-Launch Monitoring Targets

1. Load success rate for `/members/swing-sniper`
2. Universe scan duration
3. Dossier build duration
4. LLM reasoning failure rate
5. Watchlist save success rate
6. Backtest payload success rate and median latency
7. User interaction with thesis save / dismiss actions
