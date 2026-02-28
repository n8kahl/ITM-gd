# SPX Command Center Expert — Phase 4 Slice P4-S3
Date: 2026-02-28  
Slice: `P4-S3` (Remove duplicated stage-trade pathways)  
Status: Completed  
Owner: Codex

## 1. Slice Objective
Ensure there is no duplicate stage-trade pathway in the same desktop viewport state while preserving canonical Action Strip CTA semantics and execution safety gating.

## 2. Scope
1. `/Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx` (verified, no code change required)
3. `/Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx`
4. `/Users/natekahl/ITM-gd/e2e/spx-stage-pathways-dedupe.spec.ts` (new)
5. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE4_SLICE_P4-S3_2026-02-28.md` (new)

## 3. Out of Scope Confirmation
1. No backend route or data contract changes.
2. No responsive breakpoint audit (P4-S4).
3. No coach behavior changes.

## 4. Deliverables
1. Desktop stage pathway deduped so primary stage path stays canonical in Action Strip.
2. Trade Stream stage row action can be suppressed when local primary CTA is canonical for the viewport state.
3. Safety gating behavior remains unchanged:
   - No stage execution when feed/broker trust gate blocks execution.
   - No stage execution when surface is read-only.
4. Feature flag behavior unchanged (`SPX_EXPERT_TRADE_STREAM_ENABLED` and runtime override remain authoritative).
5. Added deterministic E2E coverage for dedupe across:
   - legacy setup-list mode (trade stream off)
   - trade-stream mode (trade stream on with stage recommendation)

## 5. Implementation Summary
1. `setup-feed.tsx`
   - Added `suppressTradeStreamStagePathway` derived from `suppressLocalPrimaryCta`.
   - Guarded trade-stream row stage handling so STAGE row action is ignored when suppressed.
   - Passed suppression prop through to `TradeStreamPanel`.
2. `trade-stream-panel.tsx`
   - Added `suppressStageAction?: boolean` prop.
   - When `suppressStageAction` is true and row action is `STAGE`, renders non-interactive marker `spx-trade-stream-row-stage-via-primary-cta` instead of actionable button.
3. `spx-stage-pathways-dedupe.spec.ts`
   - New deterministic assertions that only one active stage pathway exists in both required desktop states.
   - Explicitly verifies stage row action suppression in trade-stream mode.

## 6. Two-Session QA Rigor
1. Session A (implementation): applied dedupe behavior in setup feed + trade stream panel and added dedicated stage-pathway dedupe E2E spec.
2. Session B (validation): reran required lint/type/playwright gates and confirmed baseline command-center suite remains green.

## 7. Files Touched
1. `/Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx`
3. `/Users/natekahl/ITM-gd/e2e/spx-stage-pathways-dedupe.spec.ts`
4. `/Users/natekahl/ITM-gd/docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE4_SLICE_P4-S3_2026-02-28.md`

## 8. Validation Gates

### 8.1 Required commands and exact evidence
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx /Users/natekahl/ITM-gd/components/spx-command-center/action-strip.tsx /Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx /Users/natekahl/ITM-gd/e2e/spx-stage-pathways-dedupe.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ pnpm exec playwright test e2e/spx-stage-pathways-dedupe.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:72653) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:72659) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:72681) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:50:36.475Z","error":{"status":"NOT_AUTHORIZED","request_id":"b23edf229e8a15791508cf97c7ff429a","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:50:36.569Z","error":{"status":"NOT_AUTHORIZED","request_id":"ed62b416f4a8c559a2f5912ad17ca4db","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:50:36.570Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-stage-pathways-dedupe.spec.ts:66:7 › SPX stage pathway dedupe › keeps only one active stage pathway in legacy setup-list mode (8.5s)
  ✓  2 [chromium] › e2e/spx-stage-pathways-dedupe.spec.ts:81:7 › SPX stage pathway dedupe › keeps only one active stage pathway in trade-stream mode while stage row action is suppressed (1.6s)

  2 passed (17.8s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:72732) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:72737) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:72757) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:50:58.352Z","error":{"status":"NOT_AUTHORIZED","request_id":"22f6ccea56831718bf4d00b6454ddbb0","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:50:58.366Z","error":{"status":"NOT_AUTHORIZED","request_id":"53970b357f4e802baa0c502eea6ae28c","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:50:58.366Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (9.3s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (3.5s)

  2 passed (20.3s)
```

## 9. Findings
1. No in-scope defects found after implementation and validation gates.

## 10. Risks and Notes
1. The stage pathway dedupe currently suppresses Trade Stream stage action when `suppressLocalPrimaryCta` is active; if future surfaces rewire primary CTA ownership, this suppression mapping must be revisited.
2. Massive.com entitlement warnings continue in Playwright webserver logs but did not impact gate outcomes.

## 11. Rollback
1. Revert:
   - `components/spx-command-center/setup-feed.tsx`
   - `components/spx-command-center/trade-stream-panel.tsx`
   - `e2e/spx-stage-pathways-dedupe.spec.ts`
   - `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE4_SLICE_P4-S3_2026-02-28.md`

## 12. Independent Session 2 QA Evidence
Date: 2026-02-28  
Mode: Validation-only (no feature work)

### 12.1 Contract consistency check (doc vs code vs e2e)
1. Exactly one active stage pathway per desktop state: pass.
   - Dedupe control wiring in `setup-feed.tsx`:
     - `suppressTradeStreamStagePathway` derived from primary CTA ownership (`lines 185-187`).
     - Stage row action early-return when suppression is active (`lines 265-270`).
     - Suppression passed into stream panel (`lines 529-535`).
   - Trade Stream row behavior in `trade-stream-panel.tsx`:
     - `suppressStageAction` contract accepted (`lines 47-54`).
     - STAGE row action replaced with non-interactive marker `spx-trade-stream-row-stage-via-primary-cta` when suppressed (`lines 127, 168-174`), otherwise actionable button remains (`lines 176-186`).
2. Legacy setup-list mode dedupe: pass.
   - E2E validates legacy mode (`__spxExpertTradeStreamEnabled=false`), confirms legacy list visible and trade stream absent, then asserts stage pathway count is exactly one (`spx-stage-pathways-dedupe.spec.ts` lines 66-79).
3. Trade-stream mode dedupe with row-stage suppression: pass.
   - E2E stubs triggered STAGE snapshot and asserts no `spx-trade-stream-row-action` in stage row plus visible `spx-trade-stream-row-stage-via-primary-cta` marker (`lines 81-133`, specifically `127-130`).
4. Baseline command-center compatibility: pass.
   - `e2e/spx-command-center.spec.ts` remains green (2/2 passing) in Session 2 run.
5. Backend route/contract change check: pass.
   - Session 2 scope and touched artifacts are limited to frontend components, e2e spec, and this docs file; no backend route/contract files are in-scope or modified by this QA pass.

### 12.2 Required command evidence (exact)
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/components/spx-command-center/setup-feed.tsx /Users/natekahl/ITM-gd/components/spx-command-center/trade-stream-panel.tsx /Users/natekahl/ITM-gd/e2e/spx-stage-pathways-dedupe.spec.ts
# (no output; exit 0)

$ pnpm exec tsc --noEmit
# (no output; exit 0)

$ pnpm exec playwright test e2e/spx-stage-pathways-dedupe.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:73802) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:73807) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:73828) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:55:28.671Z","error":{"status":"NOT_AUTHORIZED","request_id":"56abef878adfa1bca0863c00ba53e32e","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:55:28.674Z","error":{"status":"NOT_AUTHORIZED","request_id":"1a3e025f6ed8735dcbe9cfa45e38a068","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:55:28.674Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-stage-pathways-dedupe.spec.ts:66:7 › SPX stage pathway dedupe › keeps only one active stage pathway in legacy setup-list mode (8.8s)
  ✓  2 [chromium] › e2e/spx-stage-pathways-dedupe.spec.ts:81:7 › SPX stage pathway dedupe › keeps only one active stage pathway in trade-stream mode while stage row action is suppressed (1.7s)

  2 passed (18.2s)

$ pnpm exec playwright test e2e/spx-command-center.spec.ts --project=chromium --workers=1
[WebServer] [baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
[WebServer] (node:73862) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:73867) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (node:73887) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:55:50.896Z","error":{"status":"NOT_AUTHORIZED","request_id":"23d810cccdf9fdd28d0d0d2a9f62e427","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Massive.com API Error","timestamp":"2026-02-28T05:55:50.902Z","error":{"status":"NOT_AUTHORIZED","request_id":"abeaf86d7a73015b560bbf0d1de84ee6","message":"You are not entitled to this data. Please upgrade your plan at https://massive.com/pricing"}}
[WebServer] {"level":"error","message":"Failed to fetch real-time price for I:SPX","timestamp":"2026-02-28T05:55:50.902Z","error":"Real-time data unavailable"}

Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e/spx-command-center.spec.ts:6:7 › SPX Command Center › renders command center surfaces and toggles flow compact mode (8.8s)
  ✓  2 [chromium] › e2e/spx-command-center.spec.ts:24:7 › SPX Command Center › auto-sees routine coach alert and persists lifecycle across reload (3.5s)

  2 passed (19.7s)

$ node -v
v20.19.5
```

### 12.3 Session 2 finding summary
1. No new in-scope defects found.
