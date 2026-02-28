# SPX Command Center Expert — Phase 3 Slice P3-S1
Date: 2026-02-28
Slice: `P3-S1` (Coach Facts Rail scaffold)
Status: Completed
Owner: Codex

## 1. Slice Objective
Introduce a facts-first coach presentation layer behind `SPX_COACH_FACTS_MODE_ENABLED` / `NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED`, while preserving legacy `AICoachFeed` behavior when the flag is off.

## 2. Scope
1. `/Users/natekahl/ITM-gd/components/spx-command-center/coach-facts-rail.tsx` (new)
2. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx`
3. `/Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts` (new)
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE3_SLICE_P3-S1_2026-02-28.md` (new)

## 3. Deliverables
1. Added new `CoachFactsRail` component with required selector contract:
   - `spx-coach-facts-rail`
   - `spx-coach-facts-verdict`
   - `spx-coach-facts-confidence`
   - `spx-coach-facts-invalidation`
   - `spx-coach-facts-risk-constraint`
   - `spx-coach-facts-next-review`
   - `spx-coach-facts-details-toggle`
   - `spx-coach-facts-details` (rendered only when expanded)
2. Implemented concise above-fold facts block (5 lines): verdict, confidence, invalidation, risk constraint, next review trigger.
3. Added details disclosure with factual expansion sections (`Why`, `Counter-Case`, `Risk Checklist`, `History`) sourced from existing coach decision/message/setup context when available.
4. Added deterministic fallback facts for missing decision payloads (no empty mount/crash).
5. Wired desktop/spatial shell sidebar surfaces to render:
   - `CoachFactsRail` when facts flag is enabled,
   - legacy `AICoachFeed` when facts flag is disabled.
6. Added webdriver-only runtime override support:
   - `window.__spxCoachFactsModeEnabled`
   - honored only when `navigator.webdriver === true`.
7. Added targeted Playwright coverage for:
   - legacy fallback when facts mode disabled,
   - selector + details contract when enabled,
   - deterministic fallback behavior when coach decision endpoint fails.

## 4. Two-Session QA Rigor
1. Session A (authoring): implemented scoped UI and E2E changes only for P3-S1 files.
2. Session B (validation): ran required lint/type/playwright gates and resolved one memoization lint violation before final green run.

## 5. Files Touched
1. `/Users/natekahl/ITM-gd/components/spx-command-center/coach-facts-rail.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx`
3. `/Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE3_SLICE_P3-S1_2026-02-28.md`

## 6. Validation Gates

### 6.1 Required commands and exact evidence
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/coach-facts-rail.tsx /Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx /Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED=true pnpm exec playwright test e2e/spx-coach-facts-rail.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:48922) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:48927) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:48947) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:15:24.788Z","error":{"status":"NOT_AUTHORIZED","request_id":"499e34d934c80130cd8f5df0d340b50d","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:15:24.792Z","error":{"status":"NOT_AUTHORIZED","request_id":"abb381ac798d699ca60f56b257083e33","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T04:15:24.792Z","error":"Real-time data unavailable"}

Running 3 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-coach-facts-rail.spec.ts:6:7 › SPX Coach Facts Rail selectors › keeps legacy AI coach feed when coach facts mode is disabled (8.3s)
  ✓  2 [chromium] › e2e/spx-coach-facts-rail.spec.ts:19:7 › SPX Coach Facts Rail selectors › renders coach facts rail selectors and details disclosure when enabled (1.8s)
  ✓  3 [chromium] › e2e/spx-coach-facts-rail.spec.ts:41:7 › SPX Coach Facts Rail selectors › renders deterministic fallback facts when decision payload is unavailable (1.8s)

  3 passed (19.8s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:48999) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:49006) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:49027) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:15:48.167Z","error":{"status":"NOT_AUTHORIZED","request_id":"421eaaef320b236873819b919f91a8dd","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:15:48.191Z","error":{"status":"NOT_AUTHORIZED","request_id":"6f3715fc5a7ec9b855dee0d54bbb66d7","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T04:15:48.192Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (10.2s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (3.6s)

  2 passed (21.2s)
```

### 6.2 Gate result summary
1. ESLint: pass.
2. TypeScript (`tsc --noEmit`): pass.
3. Playwright coach facts rail spec: pass (`3 passed`).
4. Playwright baseline command center spec: pass (`2 passed`).

## 7. Findings
1. No new defects discovered after implementing P3-S1 requirements.

## 8. Risks and Notes
1. This slice is intentionally presentation-only and does not alter backend contracts/routes.
2. Legacy coach behavior remains the default path when the facts flag is off.
3. Provider entitlement warnings (`Massive.com NOT_AUTHORIZED`) still appear in webserver logs during E2E but do not fail test gates.

## 9. Rollback
1. Disable `SPX_COACH_FACTS_MODE_ENABLED` / `NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED` to immediately restore legacy `AICoachFeed`.
2. Revert:
   - `components/spx-command-center/coach-facts-rail.tsx`
   - `components/spx-command-center/spx-command-center-shell-sections.tsx`
   - `e2e/spx-coach-facts-rail.spec.ts`
   - this slice report.

## 10. Independent Session 2 QA Evidence
Date: 2026-02-28
Mode: Validation-only (no feature work)

### 10.1 Contract consistency check (doc vs implementation vs spec)
1. Selector contract alignment: pass.
   - Spec/doc selectors (`spx-coach-facts-rail`, `spx-coach-facts-verdict`, `spx-coach-facts-confidence`, `spx-coach-facts-invalidation`, `spx-coach-facts-risk-constraint`, `spx-coach-facts-next-review`, `spx-coach-facts-details-toggle`, `spx-coach-facts-details`) are all present in `coach-facts-rail.tsx`.
   - `spx-coach-facts-details` is only rendered inside `detailsOpen` conditional block.
2. Flag gating alignment: pass.
   - Facts mode render path uses `SPX_COACH_FACTS_MODE_ENABLED` in `spx-command-center-shell-sections.tsx`.
   - Legacy `AICoachFeed` render path remains active when flag resolves false.
3. Webdriver override hardening: pass.
   - Runtime override `window.__spxCoachFactsModeEnabled` is gated by `window.navigator.webdriver === true`.
4. Fallback behavior: pass.
   - Playwright fallback test verifies decision endpoint failure still mounts facts rail with deterministic fallback content.
5. Backend contract/route surface: pass.
   - P3-S1 scope contains frontend component/shell/e2e/doc files only; no backend route/contract files were edited in this slice.

### 10.2 Runtime check
```bash
$ node -v
v20.19.5
```
Result: **Risk** — local runtime is below required Node >= 22 gate baseline in `CLAUDE.md`.

### 10.3 Required command evidence (independent rerun)
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/coach-facts-rail.tsx /Users/natekahl/ITM-gd/components/spx-command-center/spx-command-center-shell-sections.tsx /Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ NEXT_PUBLIC_SPX_COACH_FACTS_MODE_ENABLED=true pnpm exec playwright test e2e/spx-coach-facts-rail.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:50468) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:50473) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:50493) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:20:54.265Z","error":{"status":"NOT_AUTHORIZED","request_id":"ac42b41dcbd384063b1a96ced33273de","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:20:54.290Z","error":{"status":"NOT_AUTHORIZED","request_id":"a5ead33edd974f1dce3986dfbd5b1a09","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T04:20:54.290Z","error":"Real-time data unavailable"}

Running 3 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-coach-facts-rail.spec.ts:6:7 › SPX Coach Facts Rail selectors › keeps legacy AI coach feed when coach facts mode is disabled (8.5s)
  ✓  2 [chromium] › e2e/spx-coach-facts-rail.spec.ts:19:7 › SPX Coach Facts Rail selectors › renders coach facts rail selectors and details disclosure when enabled (1.8s)
  ✓  3 [chromium] › e2e/spx-coach-facts-rail.spec.ts:41:7 › SPX Coach Facts Rail selectors › renders deterministic fallback facts when decision payload is unavailable (1.7s)

  3 passed (19.5s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:50526) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:50531) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:50551) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:21:18.253Z","error":{"status":"NOT_AUTHORIZED","request_id":"85c40a7336308033518a99fdb62db0a0","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:21:18.262Z","error":{"status":"NOT_AUTHORIZED","request_id":"2a7d44494b2ae122f619c8e883d56886","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T04:21:18.263Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.7s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (3.5s)

  2 passed (19.6s)
```

### 10.4 Session 2 QA finding summary
1. No new code defects found in-scope.
2. Environment finding: local Node runtime below required gate version (v20.19.5 < 22).
