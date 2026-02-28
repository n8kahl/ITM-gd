# SPX Command Center Expert — Phase 5 Slice P5-S2
Date: 2026-02-28  
Slice: `P5-S2` (E2E contracts for stream order, now focus, and coach facts mode)  
Status: Completed  
Owner: Codex

## 1. Slice Objective
Harden release-grade E2E contract coverage for:
1. Lifecycle order (`forming -> triggered -> past`)
2. Deterministic now-focus behavior, including fallback when `nowFocusItemId` is missing/unmatched
3. Coach facts mode default/expanded behavior and gating
4. Stage-path dedupe desktop contract continuity

## 2. Scope
1. `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-contract.spec.ts`
2. `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts`
3. `/Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts`
4. `/Users/natekahl/ITM-gd/e2e/spx-stage-pathways-dedupe.spec.ts` (validated for contract alignment, no code change required)
5. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S2_2026-02-28.md` (new)

## 3. Out of Scope Confirmation
1. No production logic changes.
2. No backend route/service changes.
3. No release-notes/runbook packet work (reserved for P5-S3).

## 4. Deliverables
1. Strengthened trade-stream contract assertions for deterministic lifecycle sequence and exact ordered payload identity.
2. Added UI-level strict lifecycle sequence assertion in trade-stream panel when backend ordering is intentionally disabled in mocks.
3. Added explicit now-focus fallback coverage for:
   - `nowFocusItemId = null`
   - `nowFocusItemId` unmatched
4. Aligned stage-path panel contract with current desktop dedupe behavior (row action suppressed, primary CTA owns stage path).
5. Strengthened coach facts details disclosure contract by asserting canonical section labels and close/re-collapse behavior.

## 5. Implementation Summary
1. `e2e/spx-trade-stream-contract.spec.ts`
   - Added exact ID-order assertion against `expectedOrdered`.
   - Added strict lifecycle sequence assertion (`forming, forming, triggered, triggered, past, past`) on mocked endpoint payload.
2. `e2e/spx-trade-stream-panel.spec.ts`
   - Added reusable page-open helpers.
   - Updated stage-path test to match desktop dedupe contract (no row STAGE action; stage via primary CTA).
   - Added strict UI lifecycle-row sequence test using intentionally unordered fixture payload (`disableTradeStreamOrdering: true`).
   - Added deterministic now-focus fallback tests for missing and unmatched `nowFocusItemId`.
3. `e2e/spx-coach-facts-rail.spec.ts`
   - Added details contract assertions for `Why`, `Counter-Case`, `Risk Checklist`, `History`.
   - Added close/re-collapse assertions to verify stable details disclosure state transitions.
4. `e2e/spx-stage-pathways-dedupe.spec.ts`
   - No code changes required; rerun and confirmed desktop dedupe contract remains true.

## 6. Two-Session QA Rigor
1. Session A: implemented contract hardening and executed full required validation sequence.
2. Session B: reran full required validation sequence independently with all gates green.

## 7. Files Touched
1. `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-contract.spec.ts`
2. `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts`
3. `/Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S2_2026-02-28.md`

## 8. Validation Gates

### 8.1 Session A command evidence (exact)
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/e2e/spx-trade-stream-contract.spec.ts /Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts /Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts /Users/natekahl/ITM-gd/e2e/spx-stage-pathways-dedupe.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ pnpm exec playwright test e2e/spx-trade-stream-contract.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:81600) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:81623) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:81643) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:21:54.391Z","error":{"status":"NOT_AUTHORIZED","request_id":"9f319b09606cc9ca0ae73867cab4dd82","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:21:54.400Z","error":{"status":"NOT_AUTHORIZED","request_id":"427ef265da8527d38f1f6bc158c8153c","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T06:21:54.401Z","error":"Real-time data unavailable"}

Running 4 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-trade-stream-contract.spec.ts:15:7 › SPX Expert Trade Stream contract › selector contract fixture is deterministic and complete (10ms)
  ✓  2 [chromium] › e2e/spx-trade-stream-contract.spec.ts:34:7 › SPX Expert Trade Stream contract › fixture payload order contract enforces lifecycle and now-focus rules (2ms)
  ✓  3 [chromium] › e2e/spx-trade-stream-contract.spec.ts:48:7 › SPX Expert Trade Stream contract › now-focus tie-break does not prioritize lifecycle rank (3ms)
  ✓  4 [chromium] › e2e/spx-trade-stream-contract.spec.ts:68:7 › SPX Expert Trade Stream contract › mocked trade-stream endpoint returns lifecycle-ordered payload (1.3s)

  4 passed (8.7s)

$ pnpm exec playwright test e2e/spx-trade-stream-panel.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:81711) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:81735) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:81755) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

Running 7 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-trade-stream-panel.spec.ts:40:7 › SPX Expert Trade Stream panel selectors › does not render trade stream panel when feature flag is off (8.3s)
  ✓  2 [chromium] › e2e/spx-trade-stream-panel.spec.ts:51:7 › SPX Expert Trade Stream panel selectors › renders now-focus, lifecycle groups, dynamic row selectors, and row expansion when feature flag is on (2.6s)
  ✓  3 [chromium] › e2e/spx-trade-stream-panel.spec.ts:80:7 › SPX Expert Trade Stream panel selectors › falls back to legacy setup list when trade stream is empty (1.5s)
  ✓  4 [chromium] › e2e/spx-trade-stream-panel.spec.ts:91:7 › SPX Expert Trade Stream panel selectors › recommended STAGE pathway is suppressed in row and delegated to desktop primary CTA (1.8s)
  ✓  5 [chromium] › e2e/spx-trade-stream-panel.spec.ts:174:7 › SPX Expert Trade Stream panel selectors › enforces strict lifecycle row order (forming -> triggered -> past) even with unordered payload (1.6s)
  ✓  6 [chromium] › e2e/spx-trade-stream-panel.spec.ts:196:7 › SPX Expert Trade Stream panel selectors › falls back to first row for now-focus when nowFocusItemId is missing (1.5s)
  ✓  7 [chromium] › e2e/spx-trade-stream-panel.spec.ts:217:7 › SPX Expert Trade Stream panel selectors › falls back to first row for now-focus when nowFocusItemId is unmatched (1.5s)

  7 passed (26.0s)

$ pnpm exec playwright test e2e/spx-coach-facts-rail.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:81890) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:81915) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:81935) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:22:42.064Z","error":{"status":"NOT_AUTHORIZED","request_id":"86d365e1dd6141e8e24ccbec90fd712e","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:22:42.067Z","error":{"status":"NOT_AUTHORIZED","request_id":"2f621b2f5dc5016ea62ec1de403c9748","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T06:22:42.068Z","error":"Real-time data unavailable"}

Running 5 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-coach-facts-rail.spec.ts:6:7 › SPX Coach Facts Rail selectors › keeps legacy AI coach feed when coach facts mode is disabled (8.2s)
  ✓  2 [chromium] › e2e/spx-coach-facts-rail.spec.ts:19:7 › SPX Coach Facts Rail selectors › renders coach facts rail selectors and details disclosure when enabled (2.8s)
  ✓  3 [chromium] › e2e/spx-coach-facts-rail.spec.ts:65:7 › SPX Coach Facts Rail selectors › renders deterministic fallback facts when decision payload is unavailable (1.8s)
  ✓  4 [chromium] › e2e/spx-coach-facts-rail.spec.ts:90:7 › SPX Coach Facts Rail selectors › sends coach message from details composer when details are expanded (2.8s)
  ✓  5 [chromium] › e2e/spx-coach-facts-rail.spec.ts:118:7 › SPX Coach Facts Rail selectors › filters invalid-context facts actions and renders empty action state (1.4s)

  5 passed (24.5s)

$ pnpm exec playwright test e2e/spx-stage-pathways-dedupe.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:82046) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82069) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82089) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:23:13.564Z","error":{"status":"NOT_AUTHORIZED","request_id":"ddb6f2f8a23e83e0323715afdd006513","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:23:13.568Z","error":{"status":"NOT_AUTHORIZED","request_id":"6e0b39f8eb60ad40ff8c29676a163f46","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T06:23:13.568Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-stage-pathways-dedupe.spec.ts:66:7 › SPX stage pathway dedupe › keeps only one active stage pathway in legacy setup-list mode (8.4s)
  ✓  2 [chromium] › e2e/spx-stage-pathways-dedupe.spec.ts:81:7 › SPX stage pathway dedupe › keeps only one active stage pathway in trade-stream mode while stage row action is suppressed (1.5s)

  2 passed (17.3s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:82176) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82199) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82220) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:23:38.240Z","error":{"status":"NOT_AUTHORIZED","request_id":"a30fcba21b9b84290f2beae7e889ea39","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:23:38.247Z","error":{"status":"NOT_AUTHORIZED","request_id":"fdb7676d6cd9adde975bbe3338bd8299","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T06:23:38.248Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.8s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (2.9s)

  2 passed (19.2s)
```

### 8.2 Session B command evidence (exact)
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/e2e/spx-trade-stream-contract.spec.ts /Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts /Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts /Users/natekahl/ITM-gd/e2e/spx-stage-pathways-dedupe.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ pnpm exec playwright test e2e/spx-trade-stream-contract.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:82418) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82441) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82461) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:24:23.080Z","error":{"status":"NOT_AUTHORIZED","request_id":"32f9efffad3fb82cd4c1cf9dafab0ae3","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:24:23.089Z","error":{"status":"NOT_AUTHORIZED","request_id":"af9fe4ec568d17f4fc021e6a9583dac3","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T06:24:23.089Z","error":"Real-time data unavailable"}

Running 4 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-trade-stream-contract.spec.ts:15:7 › SPX Expert Trade Stream contract › selector contract fixture is deterministic and complete (10ms)
  ✓  2 [chromium] › e2e/spx-trade-stream-contract.spec.ts:34:7 › SPX Expert Trade Stream contract › fixture payload order contract enforces lifecycle and now-focus rules (2ms)
  ✓  3 [chromium] › e2e/spx-trade-stream-contract.spec.ts:48:7 › SPX Expert Trade Stream contract › now-focus tie-break does not prioritize lifecycle rank (3ms)
  ✓  4 [chromium] › e2e/spx-trade-stream-contract.spec.ts:68:7 › SPX Expert Trade Stream contract › mocked trade-stream endpoint returns lifecycle-ordered payload (1.3s)

  4 passed (8.8s)

$ pnpm exec playwright test e2e/spx-trade-stream-panel.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:82532) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82556) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82576) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

Running 7 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-trade-stream-panel.spec.ts:40:7 › SPX Expert Trade Stream panel selectors › does not render trade stream panel when feature flag is off (8.2s)
  ✓  2 [chromium] › e2e/spx-trade-stream-panel.spec.ts:51:7 › SPX Expert Trade Stream panel selectors › renders now-focus, lifecycle groups, dynamic row selectors, and row expansion when feature flag is on (2.6s)
  ✓  3 [chromium] › e2e/spx-trade-stream-panel.spec.ts:80:7 › SPX Expert Trade Stream panel selectors › falls back to legacy setup list when trade stream is empty (1.5s)
  ✓  4 [chromium] › e2e/spx-trade-stream-panel.spec.ts:91:7 › SPX Expert Trade Stream panel selectors › recommended STAGE pathway is suppressed in row and delegated to desktop primary CTA (2.0s)
  ✓  5 [chromium] › e2e/spx-trade-stream-panel.spec.ts:174:7 › SPX Expert Trade Stream panel selectors › enforces strict lifecycle row order (forming -> triggered -> past) even with unordered payload (1.6s)
  ✓  6 [chromium] › e2e/spx-trade-stream-panel.spec.ts:196:7 › SPX Expert Trade Stream panel selectors › falls back to first row for now-focus when nowFocusItemId is missing (1.5s)
  ✓  7 [chromium] › e2e/spx-trade-stream-panel.spec.ts:217:7 › SPX Expert Trade Stream panel selectors › falls back to first row for now-focus when nowFocusItemId is unmatched (1.6s)

  7 passed (26.1s)

$ pnpm exec playwright test e2e/spx-coach-facts-rail.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:82690) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82713) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82734) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:25:09.362Z","error":{"status":"NOT_AUTHORIZED","request_id":"79f725707bed7a87e5d23c4dc021cdd3","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:25:09.366Z","error":{"status":"NOT_AUTHORIZED","request_id":"65336bd1ed5f6a851f5af0024f8d4050","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T06:25:09.366Z","error":"Real-time data unavailable"}

Running 5 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-coach-facts-rail.spec.ts:6:7 › SPX Coach Facts Rail selectors › keeps legacy AI coach feed when coach facts mode is disabled (8.5s)
  ✓  2 [chromium] › e2e/spx-coach-facts-rail.spec.ts:19:7 › SPX Coach Facts Rail selectors › renders coach facts rail selectors and details disclosure when enabled (2.9s)
  ✓  3 [chromium] › e2e/spx-coach-facts-rail.spec.ts:65:7 › SPX Coach Facts Rail selectors › renders deterministic fallback facts when decision payload is unavailable (1.8s)
  ✓  4 [chromium] › e2e/spx-coach-facts-rail.spec.ts:90:7 › SPX Coach Facts Rail selectors › sends coach message from details composer when details are expanded (2.8s)
[WebServer] {"level":"error","message":"Maximum number of websocket connections exceeded. You have reached the connection limit for your account. Please contact support at https://polygon.io/contact to increase your limit.","timestamp":"2026-02-28T06:25:27.485Z","status":"max_connections","reconnectDelayMs":60000}
  ✓  5 [chromium] › e2e/spx-coach-facts-rail.spec.ts:118:7 › SPX Coach Facts Rail selectors › filters invalid-context facts actions and renders empty action state (1.4s)

  5 passed (24.9s)

$ pnpm exec playwright test e2e/spx-stage-pathways-dedupe.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:82844) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82868) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:82888) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:25:41.311Z","error":{"status":"NOT_AUTHORIZED","request_id":"9a2e1b3b6b67f2bcc2a17b4bbfa6954a","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:25:41.315Z","error":{"status":"NOT_AUTHORIZED","request_id":"52bf9f7c8e3468f9abc65c06ba017dc6","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T06:25:41.315Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-stage-pathways-dedupe.spec.ts:66:7 › SPX stage pathway dedupe › keeps only one active stage pathway in legacy setup-list mode (9.0s)
  ✓  2 [chromium] › e2e/spx-stage-pathways-dedupe.spec.ts:81:7 › SPX stage pathway dedupe › keeps only one active stage pathway in trade-stream mode while stage row action is suppressed (1.5s)

  2 passed (18.0s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:82980) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:83004) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] (node:83046) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:26:04.384Z","error":{"status":"NOT_AUTHORIZED","request_id":"3f581bc04158e11e275eb08d6be52240","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T06:26:04.390Z","error":{"status":"NOT_AUTHORIZED","request_id":"7d565399eb5d3de7fcfc87107f5cd944","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T06:26:04.390Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (9.0s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (3.0s)

  2 passed (19.5s)
```

## 9. Findings
1. Resolved test-contract defect: panel spec previously expected clickable STAGE row action in desktop mode, which conflicts with dedupe ownership by primary CTA. Updated assertion to enforce suppression + primary CTA pathway instead.

## 10. Risks and Notes
1. Repeated Massive.com entitlement warnings continue in webserver logs; gates still pass.
2. A websocket max-connections warning appeared during Session B coach-facts run and did not affect test outcomes.

## 11. Rollback
1. Revert:
   - `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-contract.spec.ts`
   - `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts`
   - `/Users/natekahl/ITM-gd/e2e/spx-coach-facts-rail.spec.ts`
   - `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE5_SLICE_P5-S2_2026-02-28.md`
