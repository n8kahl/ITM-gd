# SPX Command Center Expert — Phase 3 Slice P3-S3
Date: 2026-02-28
Slice: `P3-S3` (Details-only timeline/chat in Coach Facts mode)
Status: Completed
Owner: Codex

## 1. Slice Objective
When Coach Facts mode is enabled, keep the default coach surface facts-first and move timeline/chat interaction behind details disclosure.

## 2. Scope
1. `/Users/natekahl/ITM-gd/components/spx-command-center/coach-facts-rail.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx`
3. `/Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE3_SLICE_P3-S3_2026-02-28.md`

## 3. Out of Scope Confirmation
1. No backend route/contract changes.
2. No P3-S4 visual chrome removal.
3. No Phase 4 action-strip simplification.

## 4. Deliverables
1. Preserved default facts-first rail in facts mode (`Verdict`, `Confidence`, `Invalidation`, `Risk`, `Next review`) with max 2 context-valid actions.
2. Added details-only timeline/chat interaction in `CoachFactsRail` with selector contract:
   - `spx-coach-facts-details-history`
   - `spx-coach-facts-details-timeline`
   - `spx-coach-facts-details-composer`
   - `spx-coach-facts-details-input`
   - `spx-coach-facts-details-send`
3. Ensured details surfaces are absent while details are collapsed and visible only when details are expanded.
4. Wired details composer submit to existing `sendCoachMessage(...)` flow, issuing `POST /api/spx/coach/message`.
5. Preserved legacy behavior when facts mode is disabled (`spx-ai-coach-feed` visible, facts rail absent).
6. Preserved webdriver-only runtime override hard gate (`navigator.webdriver === true`).

## 5. Two-Session QA Rigor
1. Session A (implementation): updated `CoachFactsRail` for details-only history/timeline/composer and expanded E2E coverage for collapsed/expanded details and composer send request.
2. Session B (validation): ran required lint/type/playwright gates and verified baseline SPX command-center spec still passes.

## 6. Files Touched
1. `/Users/natekahl/ITM-gd/components/spx-command-center/coach-facts-rail.tsx`
2. `/Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts`
3. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE3_SLICE_P3-S3_2026-02-28.md`

## 7. Validation Gates

### 7.1 Required commands and exact evidence
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/coach-facts-rail.tsx /Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx /Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED=true pnpm exec playwright test e2e/spx-coach-facts-rail.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:59239) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:59250) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:59273) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:49:27.777Z","error":{"status":"NOT_AUTHORIZED","request_id":"b3a7b0f6fc6a4c7942a9865351a284bb","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:49:27.782Z","error":{"status":"NOT_AUTHORIZED","request_id":"33d09827ba8ad72d11857ebc1115106f","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T04:49:27.783Z","error":"Real-time data unavailable"}

Running 5 tests using 1 worker

  ✓  1 [chromium] › e2e/spx-coach-facts-rail.spec.ts:6:7 › SPX Coach Facts Rail selectors › keeps legacy AI coach feed when coach facts mode is disabled (8.5s)
  ✓  2 [chromium] › e2e/spx-coach-facts-rail.spec.ts:19:7 › SPX Coach Facts Rail selectors › renders coach facts rail selectors and details disclosure when enabled (1.9s)
  ✓  3 [chromium] › e2e/spx-coach-facts-rail.spec.ts:54:7 › SPX Coach Facts Rail selectors › renders deterministic fallback facts when decision payload is unavailable (1.8s)
  ✓  4 [chromium] › e2e/spx-coach-facts-rail.spec.ts:79:7 › SPX Coach Facts Rail selectors › sends coach message from details composer when details are expanded (2.7s)
  ✓  5 [chromium] › e2e/spx-coach-facts-rail.spec.ts:107:7 › SPX Coach Facts Rail selectors › filters invalid-context facts actions and renders empty action state (1.5s)

  5 passed (24.1s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:59344) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:59350) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:59370) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:50:00.885Z","error":{"status":"NOT_AUTHORIZED","request_id":"9e6d6461fd480ddc0cf2fcb35c4abbc3","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:50:00.888Z","error":{"status":"NOT_AUTHORIZED","request_id":"67fc447826615b6bae3b722d5d595728","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T04:50:00.889Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker

  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.7s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (2.7s)

  2 passed (18.9s)
```

## 8. Findings
1. No code defects found in-scope during validation.

## 9. Risks and Notes
1. Playwright execution required running outside the default sandbox due local web server bind permission (`listen EPERM: 127.0.0.1:3000` in sandbox mode).
2. Massive.com entitlement warnings continue to appear in E2E logs but do not fail required gates.

## 10. Rollback
1. Disable `SPX_COACH_FACTS_MODE_ENABLED` / `NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED` to restore legacy coach feed path.
2. Revert:
   - `components/spx-command-center/coach-facts-rail.tsx`
   - `e2e/spx-coach-facts-rail.spec.ts`
   - `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE3_SLICE_P3-S3_2026-02-28.md`

## 11. Independent Session 2 QA Evidence
Date: 2026-02-28  
Mode: Validation-only (no feature work)

### 11.1 Contract consistency check (doc vs code vs e2e)
1. Facts-mode collapsed state hides details timeline/composer selectors: pass.
   - Details-only selectors (`spx-coach-facts-details-history`, `spx-coach-facts-details-timeline`, `spx-coach-facts-details-composer`, `spx-coach-facts-details-input`, `spx-coach-facts-details-send`) are rendered only inside `detailsOpen` block in `coach-facts-rail.tsx` lines 394-489.
   - E2E asserts zero count before toggle in `e2e/spx-coach-facts-rail.spec.ts` lines 39-44.
2. Expanded details state shows timeline/composer selectors: pass.
   - E2E asserts visibility after toggle in `e2e/spx-coach-facts-rail.spec.ts` lines 45-51.
3. Details composer send triggers `POST /api/spx/coach/message`: pass.
   - Component submit path calls `sendCoachMessage(nextPrompt, scopedSetupId)` in `coach-facts-rail.tsx` line 321.
   - E2E `waitForRequest` contract validates `/api/spx/coach/message` POST in `e2e/spx-coach-facts-rail.spec.ts` lines 95-100.
4. Legacy mode unchanged when facts mode disabled: pass.
   - E2E confirms `spx-ai-coach-feed` visible and `spx-coach-facts-rail` absent in `e2e/spx-coach-facts-rail.spec.ts` lines 15-16.
5. Webdriver override hard gate remains unchanged: pass.
   - Runtime override remains gated by `window.navigator.webdriver === true` in `spx-command-center-shell-sections.tsx` lines 35-39.
6. No backend route/contract changes in this slice scope: pass.
   - Scope files are frontend component, shell, e2e spec, and slice doc only.

### 11.2 Required command evidence (independent rerun)
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/coach-facts-rail.tsx /Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx /Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED=true pnpm exec playwright test e2e/spx-coach-facts-rail.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:60301) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:60306) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:60326) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:55:23.115Z","error":{"status":"NOT_AUTHORIZED","request_id":"5151842f9b0a63ec33766f789329ddb1","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:55:23.128Z","error":{"status":"NOT_AUTHORIZED","request_id":"58b9fdb19fbb9a19f8e0e0c4a8cbe22e","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T04:55:23.129Z","error":"Real-time data unavailable"}

Running 5 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-coach-facts-rail.spec.ts:6:7 › SPX Coach Facts Rail selectors › keeps legacy AI coach feed when coach facts mode is disabled (8.4s)
  ✓  2 [chromium] › e2e/spx-coach-facts-rail.spec.ts:19:7 › SPX Coach Facts Rail selectors › renders coach facts rail selectors and details disclosure when enabled (1.9s)
  ✓  3 [chromium] › e2e/spx-coach-facts-rail.spec.ts:54:7 › SPX Coach Facts Rail selectors › renders deterministic fallback facts when decision payload is unavailable (1.7s)
  ✓  4 [chromium] › e2e/spx-coach-facts-rail.spec.ts:79:7 › SPX Coach Facts Rail selectors › sends coach message from details composer when details are expanded (2.7s)
  ✓  5 [chromium] › e2e/spx-coach-facts-rail.spec.ts:107:7 › SPX Coach Facts Rail selectors › filters invalid-context facts actions and renders empty action state (1.4s)

  5 passed (23.8s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:60386) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:60391) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:60411) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:55:51.463Z","error":{"status":"NOT_AUTHORIZED","request_id":"4bae745ec9d38781661a3bb558e050dd","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:55:51.466Z","error":{"status":"NOT_AUTHORIZED","request_id":"6c725ef7bf922b8ac9bcd96fbf59de40","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T04:55:51.466Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.7s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (3.5s)

  2 passed (19.6s)

$ node -v
v20.19.5
```

### 11.3 Session 2 QA finding summary
1. No new code defects found in P3-S3 scoped files.
2. Playwright requires non-sandbox execution in this environment due local bind restrictions on `127.0.0.1:3000`.
