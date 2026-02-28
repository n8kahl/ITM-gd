# SPX Command Center Expert — Phase 2 Slice P2-S1
Date: 2026-02-28
Slice: `P2-S1` (frontend data plumbing + panel scaffold)
Status: Completed
Owner: Codex

## 1. Slice Objective
Implement the first frontend Expert Trade Stream slice by wiring `/api/spx/trade-stream` query support, adding a selector-contract panel scaffold, and gating render behind `SPX_EXPERT_TRADE_STREAM_ENABLED` with default-off fallback behavior.

## 2. Scope
1. `lib/types/spx-command-center.ts`
2. `hooks/use-spx-api.ts`
3. `components/spx-command-center/trade-stream-panel.tsx` (new)
4. `components/spx-command-center/setup-feed.tsx`
5. `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE2_SLICE_P2-S1_2026-02-28.md`

## 3. Deliverables
1. Added `useSPXTradeStream()` in `hooks/use-spx-api.ts` for typed frontend fetch of `GET /api/spx/trade-stream` as `TradeStreamSnapshot`.
2. Added `TradeStreamPanel` scaffold with required selectors:
   - `spx-trade-stream`
   - `spx-trade-stream-lifecycle-forming`
   - `spx-trade-stream-lifecycle-triggered`
   - `spx-trade-stream-lifecycle-past`
   - `spx-trade-stream-row`
   - `spx-trade-stream-row-lifecycle`
   - `spx-trade-stream-row-freshness`
   - `spx-trade-stream-row-action`
3. Added feature gating in setup feed using `SPX_EXPERT_TRADE_STREAM_ENABLED` (default false), with panel render only when flag is on and snapshot data exists.
4. Preserved legacy setup card flow when flag is off or stream data is absent.

## 4. Files Touched
1. `/Users/natekahl/ITM-gd/hooks/use-spx-api.ts`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx`
3. `/Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE2_SLICE_P2-S1_2026-02-28.md`

## 5. Validation Gates

### 5.1 Required commands and exact evidence
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/hooks/use-spx-api.ts /Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx /Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:40826) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:40831) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:40854) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:37:13.222Z","error":{"status":"NOT_AUTHORIZED","request_id":"ceb0d8fe19988a8ee42bf8048ac0d74d","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T03:37:13.227Z","error":{"status":"NOT_AUTHORIZED","request_id":"d7d421812874b091b1d1d78848928944","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T03:37:13.228Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker

  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.9s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (2.8s)

  2 passed (19.6s)
```

### 5.2 Gate result summary
1. ESLint: pass.
2. TypeScript (`tsc --noEmit`): pass.
3. Playwright targeted SPX command center spec: pass (`2 passed`).

## 6. Risks and Notes
1. `SPX_EXPERT_TRADE_STREAM_ENABLED` is default false; rollout requires explicit env enablement.
2. Trade stream panel in this slice is scaffold-only and intentionally does not replace legacy setup card actions/coach/action-strip behavior.
3. External entitlement warnings (`NOT_AUTHORIZED`) appear in Playwright webserver logs but did not impact test pass status.

## 7. Rollback
1. Remove `components/spx-command-center/trade-stream-panel.tsx`.
2. Revert `hooks/use-spx-api.ts` trade-stream hook addition and nullable endpoint support.
3. Revert `components/spx-command-center/setup-feed.tsx` feature-flagged panel integration.
