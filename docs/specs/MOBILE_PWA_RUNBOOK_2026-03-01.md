# Mobile PWA Runbook

**Workstream:** Mobile Reachability, Native-Feel UX, and PWA Installability
**Date:** 2026-03-01
**Status:** Draft template - to be finalized at release
**Branch:** `codex/mobile-pwa`
**Governing Spec:** `docs/specs/MOBILE_PWA_EXECUTION_SPEC_2026-03-01.md`

---

## 1. Operational Scope

This runbook covers operations for:
- Mobile navigation behavior
- PWA installability and manifest validation
- Service worker update and cache behavior
- Push notification subscription troubleshooting
- iOS splash asset regeneration

---

## 2. Preconditions

1. Node version is `>=20.19.5`.
2. Branch is `codex/mobile-pwa` or release branch derived from it.
3. Environment variables for push and app runtime are set.
4. Final release gates are green.

---

## 3. Verify PWA Installability

1. Build and run the app.
2. Open Chrome DevTools > Application.
3. Confirm manifest has no warnings and includes:
   - `id`
   - complete icon set including 512 and maskable icons
   - shortcuts and screenshots
4. Confirm service worker is registered and active.
5. Run:

```bash
pnpm exec playwright test e2e/pwa.spec.ts --project=pwa-chromium --workers=1
```

---

## 4. Service Worker Update Procedure

1. Deploy updated `public/sw.js`.
2. In browser DevTools > Application > Service Workers:
   - click `Update`
   - optionally click `Skip waiting` in test environments
3. Validate `/api/*` requests are network-only.
4. Validate offline journal queue still enqueues with network disabled.

Rollback:
1. Revert the `public/sw.js` change.
2. Redeploy.
3. Hard-refresh clients to activate reverted worker.

---

## 5. Push Notification Debugging

1. Confirm browser permission state:
   - `granted`, `denied`, or `default`
2. Validate subscribe flow from Profile Settings toggle.
3. Confirm subscription payload is stored through existing push API.
4. Test `notificationclick` behavior in service worker.
5. On iOS:
   - verify app is installed to Home Screen (standalone mode)
   - verify iOS guidance UI is shown when not standalone

Common failures:
- Permission denied: show actionable UX, keep toggle deterministic.
- Subscription not stored: inspect API response and auth headers.
- No notification open behavior: verify service worker `notificationclick`.

---

## 6. Mobile Navigation Operational Checks

1. Verify all `mobile_visible` tabs are reachable on 390x844 viewport.
2. Verify overflow `More` menu scrolls and dismisses on pointer input.
3. Verify SPX route hides mobile bottom nav and still has clear escape path.
4. Verify Studio is usable on touch with select/move/resize/delete.

---

## 7. iOS Splash Screen Regeneration

Run this command after branding asset updates:

```bash
pnpm run generate:splash
```

Note: `generate:splash` is introduced in Slice 3.5.

Then:
1. Confirm generated assets are in `public/splash/`.
2. Confirm `app/layout.tsx` includes matching startup image links.
3. Build and verify splash behavior in installed iOS PWA.

---

## 8. Release Gate Checklist

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm run build
pnpm vitest run
pnpm exec playwright test e2e/mobile-*.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/pwa.spec.ts --project=pwa-chromium --workers=1
```

Record outputs in:
- `docs/specs/MOBILE_PWA_RELEASE_NOTES_2026-03-01.md`
- `docs/specs/mobile-pwa-autonomous-2026-03-01/08_AUTONOMOUS_EXECUTION_TRACKER.md`

---

## 9. Escalation

If regression is detected:
1. Stop current slice work.
2. Follow emergency process in `06_CHANGE_CONTROL_AND_PR_STANDARD.md`.
3. Document incident and mitigation in risk register and tracker.
