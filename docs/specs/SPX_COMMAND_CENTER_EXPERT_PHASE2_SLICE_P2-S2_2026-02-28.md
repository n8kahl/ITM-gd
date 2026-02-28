# SPX Command Center Expert — Phase 2 Slice P2-S2
Date: 2026-02-28
Slice: `P2-S2` (selector-contract UI surface completion)
Status: Completed
Owner: Codex

## 1. Slice Objective
Complete the Expert Trade Stream selector-contract UI surface by adding Now Focus selectors, dynamic row selectors, and local row detail expand/collapse behavior behind the existing `SPX_EXPERT_TRADE_STREAM_ENABLED` gate.

## 2. Scope
1. `/Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx`
3. `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts` (new)
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE2_SLICE_P2-S2_2026-02-28.md`

## 3. Deliverables
1. Added selector-contract nodes in Trade Stream panel:
   - `spx-now-focus`
   - `spx-now-focus-lifecycle`
   - `spx-now-focus-action`
   - `spx-trade-stream-row-{stableIdHash}`
   - `spx-trade-stream-row-details-toggle`
   - `spx-trade-stream-row-expanded` (conditional on expanded state)
2. Now Focus render logic implemented from `snapshot.nowFocusItemId` with fallback to first stream item.
3. Local row expand/collapse state implemented inside `TradeStreamPanel` only.
4. Existing panel flag gate preserved in setup feed (`SPX_EXPERT_TRADE_STREAM_ENABLED` still controls panel rendering).
5. Added Playwright coverage for off/on panel states and row detail expansion.

## 4. Files Touched
1. `/Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx`
3. `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE2_SLICE_P2-S2_2026-02-28.md`

## 5. Validation Gates

### 5.1 Required commands and exact evidence
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx /Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx /Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ NEXT_PUBLIC_SPX_EXPERT_TRADE_STREAM_ENABLED=true pnpm exec playwright test e2e/spx-trade-stream-panel.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:42556) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:42561) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:42581) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:45:51.139Z","error":{"status":"NOT_AUTHORIZED","request_id":"a061d06af978e7837919266e3c20e4b8","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:45:51.147Z","error":{"status":"NOT_AUTHORIZED","request_id":"c0542d12faf83d5a449788ee962a7c92","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T03:45:51.147Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker

  ✓  1 [chromium] › e2e/spx-trade-stream-panel.spec.ts:7:7 › SPX Expert Trade Stream panel selectors › does not render trade stream panel when feature flag is off (8.1s)
  ✓  2 [chromium] › e2e/spx-trade-stream-panel.spec.ts:20:7 › SPX Expert Trade Stream panel selectors › renders now-focus, lifecycle groups, dynamic row selectors, and row expansion when feature flag is on (2.0s)

  2 passed (17.7s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:42654) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:42660) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:42683) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:46:16.514Z","error":{"status":"NOT_AUTHORIZED","request_id":"b01e13aef296b7ff291fd05c436c75b0","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:46:16.517Z","error":{"status":"NOT_AUTHORIZED","request_id":"0373a67b7b9f11252ffaa48c26cb2565","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T03:46:16.517Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker

  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.7s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (2.9s)

  2 passed (19.1s)
```

### 5.2 Gate result summary
1. ESLint: pass.
2. TypeScript (`tsc --noEmit`): pass.
3. Playwright trade-stream-panel spec with feature flag enabled: pass (`2 passed`).
4. Playwright baseline SPX command center spec: pass (`2 passed`).

## 6. Risks and Notes
1. `setup-feed.tsx` includes a runtime override hook (`window.__spxExpertTradeStreamEnabled`) to allow deterministic off/on assertions in one Playwright run while preserving env-flag default behavior.
2. `spx-trade-stream-row-expanded` is intentionally UI-local state and non-persistent.
3. External data entitlement warnings (`NOT_AUTHORIZED`) remain in webserver logs but do not fail tests.

## 7. Rollback
1. Revert `trade-stream-panel.tsx` selector additions and row detail toggle state.
2. Revert `setup-feed.tsx` to previous feature-flag gate implementation.
3. Remove `e2e/spx-trade-stream-panel.spec.ts`.
4. Remove this slice report.
