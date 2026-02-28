# SPX Command Center Expert — Phase 4 Slice P4-S2
Date: 2026-02-28  
Slice: `P4-S2` (Move non-core controls into accessible Advanced drawer)  
Status: Completed  
Owner: Codex

## 1. Slice Objective
Keep default desktop strip core-six focused while restoring an explicit, accessible Advanced drawer trigger for non-core controls.

## 2. Scope
1. `/Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx`
2. `/Users/natekahl/ITM-gd/e2e/spx-action-strip-core-controls.spec.ts`
3. `/Users/natekahl/ITM-gd/e2e/spx-overlay-packaging.spec.ts`
4. `/Users/natekahl/ITM-gd/e2e/spx-chart-replay-focus.spec.ts`
5. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE4_SLICE_P4-S2_2026-02-28.md`

## 3. Out of Scope Confirmation
1. No backend route or contract changes.
2. No P4-S3 stage-trade dedupe work.
3. No P4-S4 breakpoint audit work.

## 4. Deliverables
1. `spx-action-core-controls` remains exactly six core wrappers in the default desktop strip.
2. `spx-action-advanced-hud-toggle` is visible and operable on desktop, positioned outside the core-six container.
3. Advanced drawer remains default-closed (`data-state="closed"`).
4. Non-core controls remain inside `spx-action-advanced-hud-drawer` (focus/replay/presets/overlay/sidebar/immersive/full-map).
5. Legacy regression addressed: `spx-overlay-packaging.spec.ts` no longer blocks on hidden advanced toggle and now uses a stable scoped locator for levels.

## 5. Two-Session QA Rigor
1. Session A (implementation): restored visible Advanced toggle outside the core-six container and updated core-controls + overlay-packaging tests for the P4-S2 contract.
2. Session B (validation): ran required lint/type/playwright gates; fixed one strict-mode locator ambiguity in overlay packaging and reran all required commands to green.

## 6. Files Touched
1. `/Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx`
2. `/Users/natekahl/ITM-gd/e2e/spx-action-strip-core-controls.spec.ts`
3. `/Users/natekahl/ITM-gd/e2e/spx-overlay-packaging.spec.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE4_SLICE_P4-S2_2026-02-28.md`

## 7. Validation Gates

### 7.1 Required commands and exact evidence
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx /Users/natekahl/ITM-gd/e2e/spx-action-strip-core-controls.spec.ts /Users/natekahl/ITM-gd/e2e/spx-overlay-packaging.spec.ts /Users/natekahl/ITM-gd/e2e/spx-chart-replay-focus.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ pnpm exec playwright test e2e/spx-action-strip-core-controls.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:69340) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:69345) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:69365) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:37:35.661Z","error":{"status":"NOT_AUTHORIZED","request_id":"2b461e87e6afa3b9b4b079a246b232df","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:37:35.666Z","error":{"status":"NOT_AUTHORIZED","request_id":"ba99483f52d1ac85975bde73b21bceb8","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:37:35.667Z","error":"Real-time data unavailable"}

Running 1 test using 1 worker
  ✓  1 [chromium] › e2e/spx-action-strip-core-controls.spec.ts:15:7 › SPX action strip core controls › exposes only core-six controls in default desktop action strip (8.9s)
  1 passed (16.4s)

$ pnpm exec playwright test e2e/spx-overlay-packaging.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:69412) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:69417) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:69437) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.

Running 1 test using 1 worker
  ✓  1 [chromium] › e2e/spx-overlay-packaging.spec.ts:6:7 › SPX overlay packaging › keeps presets deterministic and advanced controls in HUD drawer (9.8s)
  1 passed (17.3s)

$ pnpm exec playwright test e2e/spx-chart-replay-focus.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:69509) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:69515) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:69537) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:38:16.863Z","error":{"status":"NOT_AUTHORIZED","request_id":"1e39cf5384fcb59056ee13f3e2860970","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:38:16.871Z","error":{"status":"NOT_AUTHORIZED","request_id":"21a0156877e8d29e8503fd7644d14e9c","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:38:16.871Z","error":"Real-time data unavailable"}

Running 1 test using 1 worker
  ✓  1 [chromium] › e2e/spx-chart-replay-focus.spec.ts:21:7 › SPX chart replay and focus controls › supports focus mode switching, replay controls, and scenario lanes (8.8s)
  1 passed (16.3s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:69596) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:69605) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:69625) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Maximum number of websocket connections exceeded. You have reached the connection limit for your account. Please contact support at https://polygon.io/contact to increase your limit.","timestamp":"2026-02-28T05:38:37.166Z","status":"max_connections","reconnectDelayMs":60000}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (9.0s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (2.7s)
  2 passed (19.1s)
```

## 8. Findings
1. No in-scope code defects remaining after validation.

## 9. Risks and Notes
1. `spx-action-overlay-levels` exists in both mobile and desktop surfaces; cross-surface specs should scope locators to desktop containers (or visible regions) to avoid strict-mode ambiguity.
2. Massive.com entitlement and upstream websocket limit warnings appear in logs but did not fail required gates.

## 10. Rollback
1. Revert:
   - `components/spx-command-center/action-strip.tsx`
   - `e2e/spx-action-strip-core-controls.spec.ts`
   - `e2e/spx-overlay-packaging.spec.ts`
   - `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE4_SLICE_P4-S2_2026-02-28.md`

## 11. Independent Session 2 QA Evidence
Date: 2026-02-28  
Mode: Validation-only (no feature work)

### 11.1 Contract consistency check (doc vs code vs e2e)
1. `spx-action-core-controls` remains core-six only: pass.
   - Core wrapper selectors are present exactly once each in desktop strip (`spx-action-core-timeframe`, `spx-action-core-levels`, `spx-action-core-primary-cta`, `spx-action-core-why`, `spx-action-core-state-chip`, `spx-action-core-view-mode`) in `action-strip.tsx` lines 223, 225, 251, 290, 309, 319, 327.
   - `e2e/spx-action-strip-core-controls.spec.ts` asserts visible core wrapper count is `6` (line 53).
2. `spx-action-advanced-hud-toggle` visible + operable on desktop: pass.
   - Toggle renders outside core container in `action-strip.tsx` lines 372-392 and drives drawer state.
   - E2E confirms visible toggle and open/close behavior in `spx-action-strip-core-controls.spec.ts` lines 28-33 and 61-64.
3. Non-core controls reachable via drawer, not default clutter in core-six: pass.
   - Drawer default closed via state attr `data-state="closed"` asserted in `spx-action-strip-core-controls.spec.ts` line 32.
   - In-strip exclusion assertions for non-core controls (`cone/coach/gex/sidebar/immersive`) in `spx-action-strip-core-controls.spec.ts` lines 55-59.
   - Overlay packaging test validates non-core preset and overlay interactions after opening drawer in `spx-overlay-packaging.spec.ts` lines 23-30 and onward.
4. Prior regression resolved (`spx-overlay-packaging.spec.ts`): pass.
   - Spec rerun green; no strict-mode ambiguity failure after scoping levels locator to desktop core-level wrapper (`spx-overlay-packaging.spec.ts` line 32).
5. Baseline compatibility:
   - `e2e/spx-chart-replay-focus.spec.ts`: pass.
   - `e2e/spx-command-center.spec.ts`: pass.
6. No backend changes in this slice scope: pass.
   - Session 2 reviewed scope files only under `components/`, `e2e/`, and `docs/`; no backend file edits required or performed for P4-S2.

### 11.2 Required command evidence (exact)
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx /Users/natekahl/ITM-gd/e2e/spx-action-strip-core-controls.spec.ts /Users/natekahl/ITM-gd/e2e/spx-overlay-packaging.spec.ts /Users/natekahl/ITM-gd/e2e/spx-chart-replay-focus.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ pnpm exec playwright test e2e/spx-action-strip-core-controls.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:71028) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:71033) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:71053) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:42:08.419Z","error":{"status":"NOT_AUTHORIZED","request_id":"b43a615dc90094d60a95a40d6ce28ee3","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:42:08.446Z","error":{"status":"NOT_AUTHORIZED","request_id":"50aeede86876a2353143f0b329aebfd1","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:42:08.446Z","error":"Real-time data unavailable"}

Running 1 test using 1 worker
  ✓  1 [chromium] › e2e/spx-action-strip-core-controls.spec.ts:15:7 › SPX action strip core controls › exposes only core-six controls in default desktop action strip (9.4s)
  1 passed (17.0s)

$ pnpm exec playwright test e2e/spx-overlay-packaging.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:71086) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:71091) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:71113) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:42:29.496Z","error":{"status":"NOT_AUTHORIZED","request_id":"790ea170475c4a2b6466491aa0237d3a","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:42:29.504Z","error":{"status":"NOT_AUTHORIZED","request_id":"6d11ed6841edbc3fbb08c9918654bf93","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:42:29.505Z","error":"Real-time data unavailable"}

Running 1 test using 1 worker
  ✓  1 [chromium] › e2e/spx-overlay-packaging.spec.ts:6:7 › SPX overlay packaging › keeps presets deterministic and advanced controls in HUD drawer (9.8s)
  1 passed (17.2s)

$ pnpm exec playwright test e2e/spx-chart-replay-focus.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:71158) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:71163) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:71183) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:42:51.248Z","error":{"status":"NOT_AUTHORIZED","request_id":"df630f09e534623067c15e72baddc37b","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:42:51.251Z","error":{"status":"NOT_AUTHORIZED","request_id":"2841e170269d69e0610975cf394f4723","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:42:51.251Z","error":"Real-time data unavailable"}

Running 1 test using 1 worker
  ✓  1 [chromium] › e2e/spx-chart-replay-focus.spec.ts:21:7 › SPX chart replay and focus controls › supports focus mode switching, replay controls, and scenario lanes (8.7s)
  1 passed (16.2s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:71215) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:71220) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:71241) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:43:12.649Z","error":{"status":"NOT_AUTHORIZED","request_id":"4fc0845e5ceacb052b2e54fedaaf6944","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:43:12.653Z","error":{"status":"NOT_AUTHORIZED","request_id":"8d5a609fbabbcd17c2547b8a482d3cdc","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:43:12.653Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.8s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (2.7s)
  2 passed (19.0s)

$ node -v
v20.19.5
```

### 11.3 Session 2 finding summary
1. No new in-scope defects found.
