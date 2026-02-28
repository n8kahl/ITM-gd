# SPX Command Center Expert — Phase 2 Slice P2-S4
Date: 2026-02-28
Slice: `P2-S4` (decision-surface dedupe + read-only interaction safety)
Status: Completed
Owner: Codex

## 1. Slice Objective
Eliminate dual decision surfaces by hiding the legacy setup list when Expert Trade Stream has rows, while preserving legacy fallback for empty/unavailable stream payloads and preventing read-only surfaces from selecting/staging via trade-stream row interactions.

## 2. Scope
1. `/Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx`
3. `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE2_SLICE_P2-S4_2026-02-28.md`

## 3. Deliverables
1. Added read-only safety guard to trade-stream handlers in setup feed:
   - row select/action no-op when `readOnly === true`.
2. Added legacy list boundary:
   - wrapped existing setup-card/watchlist block with `data-testid="spx-legacy-setup-list"`.
3. Deduplicated decision surface:
   - when feature flag is on and stream has rows, show `spx-trade-stream` and hide `spx-legacy-setup-list`.
   - when stream is empty/unavailable, hide panel and show legacy fallback list.
4. Left triggered alerts, in-trade summary, and standby blocks unchanged.
5. Extended Playwright coverage:
   - flag on + non-empty stream => panel visible, legacy list hidden.
   - flag on + empty stream => legacy list visible fallback.

## 4. Files Touched
1. `/Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx`
2. `/Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts`
3. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE2_SLICE_P2-S4_2026-02-28.md`

## 5. Validation Gates

### 5.1 Required commands and exact evidence
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx /Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx /Users/natekahl/ITM-gd/e2e/spx-trade-stream-panel.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ NEXT_PUBLIC_SPX_EXPERT_TRADE_STREAM_ENABLED=true pnpm exec playwright test e2e/spx-trade-stream-panel.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:45947) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:45952) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:45972) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:03:24.537Z","error":{"status":"NOT_AUTHORIZED","request_id":"c38ca83ef64c7e7a4409010cbf548bd0","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:03:24.541Z","error":{"status":"NOT_AUTHORIZED","request_id":"2142474031d4fcdb7b46fedc7ba14458","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T04:03:24.542Z","error":"Real-time data unavailable"}

Running 4 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-trade-stream-panel.spec.ts:7:7 › SPX Expert Trade Stream panel selectors › does not render trade stream panel when feature flag is off (7.9s)
  ✓  2 [chromium] › e2e/spx-trade-stream-panel.spec.ts:20:7 › SPX Expert Trade Stream panel selectors › renders now-focus, lifecycle groups, dynamic row selectors, and row expansion when feature flag is on (2.6s)
  ✓  3 [chromium] › e2e/spx-trade-stream-panel.spec.ts:51:7 › SPX Expert Trade Stream panel selectors › falls back to legacy setup list when trade stream is empty (1.4s)
  ✓  4 [chromium] › e2e/spx-trade-stream-panel.spec.ts:64:7 › SPX Expert Trade Stream panel selectors › recommended STAGE row action stages matching setup into in-trade mode (2.4s)

  4 passed (21.9s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:46023) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:46028) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:46048) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:03:50.910Z","error":{"status":"NOT_AUTHORIZED","request_id":"b4980334fb2209abef7b2d0190dcf2e8","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T04:03:50.916Z","error":{"status":"NOT_AUTHORIZED","request_id":"a10ef7770ced6c126adf6a5101509c51","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T04:03:50.917Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.7s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (3.4s)

  2 passed (19.4s)
```

### 5.2 Gate result summary
1. ESLint: pass.
2. TypeScript (`tsc --noEmit`): pass.
3. Playwright trade-stream panel spec: pass (`4 passed`).
4. Playwright baseline command-center spec: pass (`2 passed`).

## 6. Findings
1. No new defects discovered after implementing P2-S4 requirements.

## 7. Risks and Notes
1. Legacy list is intentionally hidden whenever stream has items, so experts only see one active decision surface at a time.
2. If stream endpoint returns empty/unavailable payload while setup snapshot still has rows, fallback legacy list remains active by design.
3. External provider entitlement warnings remain in Playwright webserver logs but do not fail the test gates.

## 8. Rollback
1. Revert `setup-feed.tsx` legacy-list boundary and stream-first list gating.
2. Revert read-only guards in trade-stream row callbacks.
3. Revert added fallback visibility test in `e2e/spx-trade-stream-panel.spec.ts`.
4. Remove this slice report.
