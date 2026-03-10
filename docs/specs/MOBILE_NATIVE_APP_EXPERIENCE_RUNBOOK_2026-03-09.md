# Mobile Native App Experience Runbook

**Workstream:** Members iPhone Native-Feel Hardening
**Date:** 2026-03-09
**Status:** Planning baseline
**Branch:** `codex/mobile-pwa`
**Governing Spec:** `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_EXECUTION_SPEC_2026-03-09.md`

---

## 1. Operational Scope

This runbook governs operations for:

1. Members mobile navigation reliability.
2. Mobile market/chart degraded-state continuity.
3. iPhone standalone auth handoff behavior.
4. AI Coach mobile state continuity.
5. Mobile/PWA regression and stress validation.

---

## 2. Preconditions

1. Node version is `>=20.19.5`.
2. Branch is `codex/mobile-pwa` or release branch derived from it.
3. `.env` values for Supabase and backend API endpoints are configured.
4. Slice and phase reports are up to date before each milestone gate.

---

## 3. Members Navigation Reliability Checks

1. Open members shell on iPhone viewport (`390x844` and `430x932`).
2. Rapidly tap bottom-nav tabs in sequence (`Dashboard`, `Journal`, `AI Coach`, `Academy`, `Profile`).
3. Verify:
   - no dead taps,
   - no forced full-page reload,
   - no stuck pending indicator.
4. Validate More-menu interactions are stable and no detach timeout occurs.

---

## 4. Market and Chart Continuity Checks

1. Load `/members` and `/members/ai-coach` on mobile viewport.
2. Simulate temporary upstream failure for market/chart routes.
3. Verify UI behavior:
   - stale data (if available) remains visible,
   - stale/degraded state is explicitly labeled,
   - retry behavior continues automatically.

---

## 5. Standalone iOS Auth Continuity Checks

1. Install PWA to Home Screen on iPhone.
2. Start login from standalone shell.
3. Complete OAuth handoff and return.
4. Verify user lands on intended route (redirect target or default members route).
5. Verify failure paths show actionable message and recovery action.

---

## 6. AI Coach Mobile Continuity Checks

1. On `/members/ai-coach`, send a prompt and open chart/tool sheet.
2. Switch between chat and tool views repeatedly.
3. Verify:
   - chat scroll/context is retained,
   - chart state is retained,
   - no duplicate request storms from remount loops.

---

## 7. Validation Gates

## Slice-level gates

```bash
pnpm exec eslint <touched files>
pnpm exec tsc --noEmit
pnpm vitest run <targeted tests>
pnpm exec playwright test <targeted specs> --project=chromium --workers=1
```

## Release-level gates

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run
pnpm exec playwright test e2e/mobile-navigation.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/specs/ux-stress-test.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/pwa.spec.ts --project=pwa-chromium --workers=1
```

---

## 8. Incident Response

If regression is detected during rollout:

1. Stop current slice work immediately.
2. Reproduce with targeted Playwright command and capture failure evidence.
3. Revert latest slice commit if P0/P1 impact is confirmed.
4. Record incident in:
   - change control log,
   - risk register,
   - execution tracker.
5. Resume only after passing impacted gate set.

---

## 9. Documentation Sync Requirement

Before phase advancement, update:

1. Current phase slice report.
2. `08_AUTONOMOUS_EXECUTION_TRACKER.md`.
3. `07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md` when decisions/deferments occur.
4. Release notes for visible behavior changes.
