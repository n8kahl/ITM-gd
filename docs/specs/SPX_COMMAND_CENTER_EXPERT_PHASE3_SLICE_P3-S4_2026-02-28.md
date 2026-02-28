# SPX Command Center Expert — Phase 3 Slice P3-S4
Date: 2026-02-28
Slice: `P3-S4` (Remove visual-heavy coach shell chrome in facts mode)
Status: Completed
Owner: Codex

## 1. Slice Objective
In Coach Facts mode, remove default visual-heavy coach shell chrome (dock/preview-style shell wrappers) so the default experience is compact facts-first while preserving legacy shell behavior when facts mode is disabled.

## 2. Scope
1. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx`
2. `/Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts`
3. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE3_SLICE_P3-S4_2026-02-28.md`

## 3. Out of Scope Confirmation
1. No backend route or contract changes.
2. No Phase 4 action-strip/layout simplification.
3. No new coach decision contract fields.

## 4. Deliverables
1. Facts mode ON now renders `CoachFactsRail` directly as default sidebar coach surface without requiring dock open state.
2. Facts mode ON no longer renders coach dock shell chrome (`spx-coach-dock-desktop`, `spx-coach-dock-toggle-desktop`) in desktop/spatial sidebar shells.
3. Facts mode OFF preserves legacy `CoachDock` + `AICoachFeed` shell behavior.
4. Webdriver-only override hard gate remains unchanged (`window.__spxCoachFactsModeEnabled` honored only when `navigator.webdriver === true`).
5. Added E2E assertion that facts mode ON has dock selectors absent while facts rail is visible.
6. Existing P3-S1/P3-S2/P3-S3 facts rail assertions remain passing.

## 5. Two-Session QA Rigor
1. Session A (implementation): updated shell gating conditions for facts mode chrome removal and extended facts rail E2E assertion coverage for dock selector absence.
2. Session B (validation): ran required lint/type/playwright gates and verified baseline SPX command center suite remains green.

## 6. Files Touched
1. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx`
2. `/Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts`
3. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE3_SLICE_P3-S4_2026-02-28.md`

## 7. Validation Gates

### 7.1 Required commands and exact evidence
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx /Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED=true pnpm exec playwright test e2e/spx-coach-facts-rail.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:61371) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:61377) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:61397) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:02:28.807Z","error":{"status":"NOT_AUTHORIZED","request_id":"2541a725771dd3b48f4608d4d3e3518e","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:02:28.810Z","error":{"status":"NOT_AUTHORIZED","request_id":"eb26862bd3738773ac255d0ec06ca6b4","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:02:28.810Z","error":"Real-time data unavailable"}

Running 5 tests using 1 worker

  ✓  1 [chromium] › e2e/spx-coach-facts-rail.spec.ts:6:7 › SPX Coach Facts Rail selectors › keeps legacy AI coach feed when coach facts mode is disabled (8.5s)
  ✓  2 [chromium] › e2e/spx-coach-facts-rail.spec.ts:19:7 › SPX Coach Facts Rail selectors › renders coach facts rail selectors and details disclosure when enabled (1.8s)
  ✓  3 [chromium] › e2e/spx-coach-facts-rail.spec.ts:56:7 › SPX Coach Facts Rail selectors › renders deterministic fallback facts when decision payload is unavailable (1.7s)
  ✓  4 [chromium] › e2e/spx-coach-facts-rail.spec.ts:81:7 › SPX Coach Facts Rail selectors › sends coach message from details composer when details are expanded (1.9s)
  ✓  5 [chromium] › e2e/spx-coach-facts-rail.spec.ts:109:7 › SPX Coach Facts Rail selectors › filters invalid-context facts actions and renders empty action state (1.4s)

  5 passed (23.0s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:61447) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:61452) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:61472) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:03:00.365Z","error":{"status":"NOT_AUTHORIZED","request_id":"26bd524cb5afd7487998c2086ca9627c","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:03:00.374Z","error":{"status":"NOT_AUTHORIZED","request_id":"57e655aca8fc11de2f23f19761ccd945","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:03:00.374Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker

  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (9.0s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (3.5s)

  2 passed (20.1s)
```

## 8. Findings
1. No code defects found in-scope during validation.

## 9. Risks and Notes
1. Playwright command attempts in sandbox hit `listen EPERM: operation not permitted 127.0.0.1:3000`; required rerun outside sandbox.
2. Massive.com entitlement warnings continue to appear in webserver logs during E2E runs but do not fail required gates.

## 10. Rollback
1. Disable `SPX_COACH_FACTS_MODE_ENABLED` / `NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED` to restore legacy coach shell behavior.
2. Revert:
   - `components/spx-command-center/spx-command-center-shell-sections.tsx`
   - `e2e/spx-coach-facts-rail.spec.ts`
   - `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE3_SLICE_P3-S4_2026-02-28.md`

## 11. Independent Session 2 QA Evidence
Date: 2026-02-28  
Mode: Validation-only (no feature work)

### 11.1 Contract consistency check (doc vs code vs e2e)
1. Facts mode ON renders `CoachFactsRail` directly by default: pass.
   - Desktop shell in facts mode always allows inline coach panel via `showInlineCoachFeed` in `spx-command-center-shell-sections.tsx` line 127.
   - Spatial shell in facts mode always allows inline coach panel via `showInlineCoachFeed` in `spx-command-center-shell-sections.tsx` line 231.
2. Facts mode ON does not render coach dock chrome: pass.
   - Desktop dock wrapper is gated behind `!SPX_COACH_FACTS_MODE_ENABLED` in `spx-command-center-shell-sections.tsx` line 135.
   - Spatial dock wrapper is gated behind `!SPX_COACH_FACTS_MODE_ENABLED` in `spx-command-center-shell-sections.tsx` line 239.
   - E2E asserts dock selectors absent when facts mode enabled in `e2e/spx-coach-facts-rail.spec.ts` lines 30-31.
3. Facts mode OFF preserves legacy coach behavior: pass.
   - E2E confirms legacy feed visible and facts rail absent in `e2e/spx-coach-facts-rail.spec.ts` lines 15-16.
4. Webdriver runtime override hard gate unchanged: pass.
   - Override remains hard-gated by `navigator.webdriver === true` in `spx-command-center-shell-sections.tsx` lines 35-39.
5. No backend route/contract changes introduced by P3-S4: pass.
   - P3-S4 scope remains frontend shell + e2e + docs only; no backend files were edited in this validation pass.

### 11.2 Required command evidence (independent rerun)
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx /Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED=true pnpm exec playwright test e2e/spx-coach-facts-rail.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:62725) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:62730) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:62751) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:08:08.076Z","error":{"status":"NOT_AUTHORIZED","request_id":"1b06ab895f11299dd6d6774c3b231f73","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:08:08.080Z","error":{"status":"NOT_AUTHORIZED","request_id":"c7c2e572980dd4d798eae9ca8b0581fe","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:08:08.080Z","error":"Real-time data unavailable"}

Running 5 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-coach-facts-rail.spec.ts:6:7 › SPX Coach Facts Rail selectors › keeps legacy AI coach feed when coach facts mode is disabled (10.0s)
  ✓  2 [chromium] › e2e/spx-coach-facts-rail.spec.ts:19:7 › SPX Coach Facts Rail selectors › renders coach facts rail selectors and details disclosure when enabled (1.9s)
  ✓  3 [chromium] › e2e/spx-coach-facts-rail.spec.ts:56:7 › SPX Coach Facts Rail selectors › renders deterministic fallback facts when decision payload is unavailable (2.1s)
  ✓  4 [chromium] › e2e/spx-coach-facts-rail.spec.ts:81:7 › SPX Coach Facts Rail selectors › sends coach message from details composer when details are expanded (2.7s)
  ✓  5 [chromium] › e2e/spx-coach-facts-rail.spec.ts:109:7 › SPX Coach Facts Rail selectors › filters invalid-context facts actions and renders empty action state (1.6s)

  5 passed (26.3s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:62809) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:62814) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:62836) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:08:38.539Z","error":{"status":"NOT_AUTHORIZED","request_id":"1a8d7bb6ee9532a4386d8037c1cb0494","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:08:38.571Z","error":{"status":"NOT_AUTHORIZED","request_id":"aed6d4b79209b0dbe9e5556b754110e1","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:08:38.572Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (12.5s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (3.0s)

  2 passed (23.3s)

$ node -v
v20.19.5
```

### 11.3 Session 2 QA finding summary
1. No new code defects found in P3-S4 scoped files.
2. Playwright requires non-sandbox execution in this environment due local bind restrictions on `127.0.0.1:3000`.
