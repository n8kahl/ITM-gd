# SPX Command Center Phase 0 Baseline Report
Date: February 20, 2026
Command run time: 2026-02-20 15:47-15:52 local

## 1. Command Executed
```bash
pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1
```

## 2. Baseline Outcome
1. Total: 9 tests
2. Passed: 2
3. Failed: 7
4. Duration: ~2.5 minutes

## 3. Failure Matrix
1. `e2e/spx-coach-messages.spec.ts:18` - long streamed message visibility contract failed.
2. `e2e/spx-coach-messages.spec.ts:45` - action chip `Hold / Wait` not discoverable.
3. `e2e/spx-coach-messages.spec.ts:77` - coach timeline/jump-to-latest contract timed out.
4. `e2e/spx-command-center.spec.ts:6` - header identity text contract (`SPX Command Center`) failed.
5. `e2e/spx-command-center.spec.ts:24` - pinned coach alert lifecycle surface missing.
6. `e2e/spx-command-palette.spec.ts:6` - command palette trigger test id missing.
7. `e2e/spx-setup-interaction.spec.ts:29` - revert-to-AI recommendation visibility failed.

## 4. Likely Drift Categories
1. Selector drift: missing/renamed test IDs.
2. Visibility drift: timeline/history interaction now hidden by default.
3. Lifecycle drift: coach alert lane implementation not currently wired into active feed UI.
4. Contract action drift: alternative contract selection does not consistently expose explicit revert CTA.

## 5. Environmental Notes
1. Web server logs include repeated Massive entitlement errors (`NOT_AUTHORIZED`) and aggregate endpoint prefix errors (`PRICE:SPX`, 404), but mocks still served SPX test endpoints.
2. Failing tests generated artifacts in `/Users/natekahl/ITM-gd/test-results/*`.

## 6. Phase 0 Decision
Proceed to Phase 1 regression recovery with focused compatibility fixes for:
1. Header identity + command trigger selector.
2. Coach timeline/action-chip discoverability and pinned alert lifecycle lane.
3. Contract selector deterministic revert-to-AI path visibility.
