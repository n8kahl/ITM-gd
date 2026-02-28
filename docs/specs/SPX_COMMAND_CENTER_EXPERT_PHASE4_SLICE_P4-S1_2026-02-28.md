# SPX Command Center Expert — Phase 4 Slice P4-S1
Date: 2026-02-28  
Slice: `P4-S1` (Reduce default visible action-strip controls to core six)  
Status: Completed  
Owner: Codex

## 1. Slice Objective
Reduce default desktop action-strip visible controls to the core six for expert flow:
1. Timeframe
2. Levels toggle
3. Primary CTA
4. Why
5. State chip
6. View mode

## 2. Scope
1. `/Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-surface-orchestrator.tsx` (verified, no code change required)
3. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-mobile-surface-orchestrator.tsx` (verified, no code change required)
4. `/Users/natekahl/ITM-gd/e2e/spx-action-strip-core-controls.spec.ts` (new)
5. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE4_SLICE_P4-S1_2026-02-28.md` (new)

## 3. Out of Scope Confirmation
1. No backend route/contract changes.
2. No P4-S2 migration of non-core controls into new advanced drawer behavior.
3. No P4-S3 stage-trade pathway dedupe.
4. No P4-S4 breakpoint verification work.

## 4. Deliverables
1. Added desktop core-controls selector container: `spx-action-core-controls`.
2. Added desktop core-control wrappers:
   - `spx-action-core-timeframe`
   - `spx-action-core-levels`
   - `spx-action-core-primary-cta`
   - `spx-action-core-why`
   - `spx-action-core-state-chip`
   - `spx-action-core-view-mode`
3. Preserved baseline selectors on inner controls (`spx-action-overlay-levels`, `spx-action-primary-cta-desktop`, `spx-action-primary-why-desktop`, `spx-action-decision-state`, `spx-view-mode-toggle`, etc.).
4. Non-core desktop default-strip controls are not visible in default strip:
   - `spx-action-advanced-hud-toggle` is retained in DOM and hidden.
   - `spx-action-guided-status` is retained and hidden when present.
5. CTA safety gating semantics preserved (disabled CTA and blocked reason chip behavior unchanged).
6. Added E2E contract for core-six desktop strip behavior.

## 5. Two-Session QA Rigor
1. Session A (implementation): refactored desktop action-strip layout to core-six wrappers and added new E2E core-controls spec.
2. Session B (validation): ran required lint/type/playwright gates, fixed one assertion scope in the new E2E (non-core strip assertion), and re-ran all required gates to green.

## 6. Files Touched
1. `/Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx`
2. `/Users/natekahl/ITM-gd/e2e/spx-action-strip-core-controls.spec.ts`
3. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE4_SLICE_P4-S1_2026-02-28.md`

## 7. Validation Gates

### 7.1 Required commands and exact evidence
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx /Users/natekahl/ITM-gd/components/spx-command-center/spx-desktop-surface-orchestrator.tsx /Users/natekahl/ITM-gd/components/spx-command-center/spx-mobile-surface-orchestrator.tsx /Users/natekahl/ITM-gd/e2e/spx-action-strip-core-controls.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ pnpm exec playwright test e2e/spx-action-strip-core-controls.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:65679) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:65687) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:65730) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:18:04.274Z","error":{"status":"NOT_AUTHORIZED","request_id":"29d895321a38e4cb32d446b06949024f","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:18:04.290Z","error":{"status":"NOT_AUTHORIZED","request_id":"8ea66b0a9737e89ae4b58888f10f27dc","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:18:04.291Z","error":"Real-time data unavailable"}

Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/spx-action-strip-core-controls.spec.ts:15:7 › SPX action strip core controls › exposes only core-six controls in default desktop action strip (9.2s)

  1 passed (16.9s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:65783) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:65788) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:65809) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:18:28.493Z","error":{"status":"NOT_AUTHORIZED","request_id":"ba329646494bf531862350f9f5c876c0","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:18:28.500Z","error":{"status":"NOT_AUTHORIZED","request_id":"ea1be401a8e3c6ac2c575aad96900926","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:18:28.500Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker

  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (9.1s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (2.7s)

  2 passed (19.2s)
```

## 8. Findings
1. No code defects found in P4-S1 in-scope files during validation.

## 9. Risks and Notes
1. Repo no longer has `spx-mobile-surface.tsx`; active mobile surface file is `spx-mobile-surface-orchestrator.tsx`.
2. Massive.com entitlement warnings continue during Playwright webserver logs but did not fail gates.
3. Existing specs that expect visible `spx-action-advanced-hud-toggle` in default strip may need phase-aligned updates outside this slice.

## 10. Rollback
1. Revert:
   - `components/spx-command-center/action-strip.tsx`
   - `e2e/spx-action-strip-core-controls.spec.ts`
   - `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE4_SLICE_P4-S1_2026-02-28.md`

## 11. Independent Session 2 QA Evidence
Date: 2026-02-28  
Mode: Validation-only (no feature work)

### 11.1 Contract consistency check (doc vs code vs e2e)
1. Core-six selector contract present in code: pass.
   - `spx-action-core-controls` and all six wrappers are implemented in `action-strip.tsx` lines 223, 225, 251, 290, 309, 319, 327.
2. Default desktop strip exposes only core-six controls: pass.
   - Desktop strip is explicitly labeled as core-six-only in `action-strip.tsx` line 219.
   - Non-core `spx-action-advanced-hud-toggle` is retained but hidden (`hidden`, `aria-hidden`) in `action-strip.tsx` lines 390-413.
   - E2E validates six visible core wrappers and no in-strip non-core controls in `e2e/spx-action-strip-core-controls.spec.ts` lines 27-55.
3. Baseline SPX command-center suite still passes: pass.
   - `e2e/spx-command-center.spec.ts` rerun green (2/2 passing) in Session 2.
4. No backend changes in this slice: pass.
   - P4-S1 scope and touched files remain frontend + e2e + docs only; no backend files in slice scope.
5. Mobile path context note alignment: pass.
   - Doc references active mobile path `spx-mobile-surface-orchestrator.tsx` and acknowledges `spx-mobile-surface.tsx` absence.

### 11.2 Required command evidence (exact)
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx /Users/natekahl/ITM-gd/e2e/spx-action-strip-core-controls.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ pnpm exec playwright test e2e/spx-action-strip-core-controls.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:67118) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:67123) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:67143) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:21:43.713Z","error":{"status":"NOT_AUTHORIZED","request_id":"e9793fb0dcee332da804dc66d45094a9","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:21:43.716Z","error":{"status":"NOT_AUTHORIZED","request_id":"6af8c51761252ede723cdfc730950e3a","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:21:43.716Z","error":"Real-time data unavailable"}

Running 1 test using 1 worker
  ✓  1 [chromium] › e2e/spx-action-strip-core-controls.spec.ts:15:7 › SPX action strip core controls › exposes only core-six controls in default desktop action strip (8.5s)
  1 passed (16.1s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:67175) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:67180) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:67222) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.9s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (2.8s)
  2 passed (19.3s)

$ node -v
v20.19.5
```

### 11.3 Additional regression probe (legacy selector assumption)
```bash
$ pnpm exec playwright test e2e/spx-overlay-packaging.spec.ts --project=chromium --workers=1
Running 1 test using 1 worker
  ✘  1 [chromium] › e2e/spx-overlay-packaging.spec.ts:6:7 › SPX overlay packaging › keeps presets deterministic and advanced controls in HUD drawer (30.3s)

Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('spx-action-advanced-hud-toggle')
  - locator resolved to <button ... data-testid="spx-action-advanced-hud-toggle" ...>Advanced HUD</button>
  - attempting click action
    ...
    - element is not visible

    at /Users/natekahl/ITM-gd/e2e/spx-overlay-packaging.spec.ts:26:29
```

### 11.4 Session 2 finding summary
1. P2 regression confirmed: legacy overlay-packaging spec assumes visible default-strip advanced HUD toggle and now fails due to intentional P4-S1 hidden-state behavior.
