# SPX Command Center Expert — Phase 2 Slice P2-S3
Date: 2026-02-28
Slice: `P2-S3` (row-action semantics + flag hardening)
Status: Completed
Owner: Codex

## 1. Slice Objective
Add row interaction semantics to the Expert Trade Stream panel (`onRowSelect`, `onRowAction`) and harden the runtime feature-flag override so only automation contexts can use `window.__spxExpertTradeStreamEnabled`.

## 2. Scope
1. `/Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx`
3. `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE2_SLICE_P2-S3_2026-02-28.md`

## 3. Deliverables
1. Added `TradeStreamPanel` callbacks:
   - `onRowSelect(item)`
   - `onRowAction(item)`
2. Wired setup-feed row behavior:
   - stream item resolves to setup by `id`, then `stableIdHash`
   - row select focuses matching setup
   - `recommendedAction === 'STAGE'` executes existing `handleOneClickEntry(setup)` only when setup is actionable (`ready`/`triggered`) and execution is not blocked
   - `WAIT`/`MANAGE`/`REVIEW` focus only (no trade side effects)
3. Hardened feature-flag runtime override:
   - env flags remain supported
   - `window.__spxExpertTradeStreamEnabled` only applies when `navigator.webdriver === true`
4. Extended Playwright coverage:
   - flag-off panel absence
   - flag-on selector contract rendering
   - details toggle expansion
   - `STAGE` row action transitions to in-trade mode for matching `setup-1`

## 4. Files Touched
1. `/Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx`
3. `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE2_SLICE_P2-S3_2026-02-28.md`

## 5. Validation Gates

### 5.1 Required commands and exact evidence
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx /Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx /Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ NEXT_PUBLIC_SPX_EXPERT_TRADE_STREAM_ENABLED=true pnpm exec playwright test e2e/spx-trade-stream-panel.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:44694) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:44699) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:44719) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:55:59.764Z","error":{"status":"NOT_AUTHORIZED","request_id":"3314f3bc552d76453891b3a8ada5e8d0","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:55:59.770Z","error":{"status":"NOT_AUTHORIZED","request_id":"bafc1bf9cbe559f6ef06cb14a5cd31c2","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T03:55:59.770Z","error":"Real-time data unavailable"}
[WebServer] {"level":"error","message":"Maximum number of websocket connections exceeded. You have reached the connection limit for your account. Please contact support at https://polygon.io/contact to increase your limit.","timestamp":"2026-02-28T03:56:01.521Z","status":"max_connections","reconnectDelayMs":60000}

Running 3 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-trade-stream-panel.spec.ts:7:7 › SPX Expert Trade Stream panel selectors › does not render trade stream panel when feature flag is off (8.0s)
  ✓  2 [chromium] › e2e/spx-trade-stream-panel.spec.ts:20:7 › SPX Expert Trade Stream panel selectors › renders now-focus, lifecycle groups, dynamic row selectors, and row expansion when feature flag is on (2.7s)
  ✓  3 [chromium] › e2e/spx-trade-stream-panel.spec.ts:50:7 › SPX Expert Trade Stream panel selectors › recommended STAGE row action stages matching setup into in-trade mode (2.6s)

  3 passed (20.7s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:44792) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:44797) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:44818) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:56:25.977Z","error":{"status":"NOT_AUTHORIZED","request_id":"6ae1c29f4f7021973ba1f19d638ce5d7","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:56:25.984Z","error":{"status":"NOT_AUTHORIZED","request_id":"185311b2edb8cc5cc5f966bad5e8fbb8","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T03:56:25.984Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.7s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (2.9s)

  2 passed (19.0s)
```

### 5.2 Gate result summary
1. ESLint: pass.
2. TypeScript (`tsc --noEmit`): pass.
3. Playwright trade-stream-panel spec: pass (`3 passed`).
4. Playwright SPX command-center regression spec: pass (`2 passed`).

## 6. Findings
1. Initial `STAGE` action test failed because a local CTA suppression guard blocked staging in this surface; corrected to follow slice contract (`actionable && !executionBlocked`).

## 7. Risks and Notes
1. Runtime override hardening intentionally keeps console toggling unavailable for normal users while preserving deterministic automation toggles.
2. Row-action staging depends on setup-resolution match (`id`, then `stableIdHash`); unmatched rows are focus/action no-ops by design.
3. External market/provider entitlement and websocket-limit warnings remain in logs but did not block gate results.

## 8. Rollback
1. Revert row callback props and action wiring in `trade-stream-panel.tsx`.
2. Revert trade-stream setup-resolution/action handlers and webdriver-only override in `setup-feed.tsx`.
3. Revert new STAGE-action test section in `e2e/spx-trade-stream-panel.spec.ts`.
4. Remove this slice report.
