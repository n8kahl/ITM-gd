# SPX Command Center Phase 1 Recovery Report
Date: February 20, 2026
Phase: 1 (Regression Recovery)
Slice: `P1-S1`

## 1. Objective
Restore broken SPX command-center user/test contracts without broad redesign.

## 2. Contract Gaps Addressed
1. Missing command palette trigger selector.
2. Header title contract mismatch.
3. Coach timeline/action-chip discoverability regressions.
4. Pinned coach alert lifecycle lane missing from active coach surface.
5. Revert-to-AI contract CTA visibility drift after alternative selection.

## 3. Files Changed
1. `/Users/natekahl/ITM-gd/components/spx-command-center/spx-header.tsx`
2. `/Users/natekahl/ITM-gd/components/spx-command-center/ai-coach-feed.tsx`
3. `/Users/natekahl/ITM-gd/components/spx-command-center/contract-card.tsx`
4. `/Users/natekahl/ITM-gd/components/spx-command-center/contract-selector.tsx`

## 4. Implementation Summary
1. Restored `data-testid="spx-command-palette-trigger"` and normalized header title copy to `SPX Command Center`.
2. Reintroduced coach alert lifecycle integration in `AICoachFeed`:
   - lifecycle load/sync from `spx.coach.alert.lifecycle.v2`
   - pinned alert lane (`data-testid="spx-ai-coach-pinned-alert"`)
   - automatic seen marking for routine/warning alerts
3. Restored coach history/timeline discoverability:
   - timeline opened by default
   - `All` mode control always present
   - timeline test id consistently available in default path
4. Stabilized contract revert behavior:
   - contract selector now keeps AI recommendation as display base when user selects alternatives
   - `Use AI Recommendation` CTA remains available whenever selection differs from AI base recommendation

## 5. Test Evidence
Command:
```bash
pnpm exec playwright test e2e/spx-command-palette.spec.ts e2e/spx-command-center.spec.ts e2e/spx-coach-messages.spec.ts e2e/spx-setup-interaction.spec.ts --project=chromium --workers=1
```

Result:
1. 9 passed
2. 0 failed

## 6. Risk Notes
1. Coach timeline default-open behavior was adjusted to satisfy discoverability and test contracts; if product preference changes later, tests must be updated together with UX contract.
2. Contract selector now depends on cached AI recommendation as canonical card model when user chooses alternatives; this prevents revert dead-ends but should be revisited in Phase 2 command/surface consolidation.

## 7. Rollback Notes
If regressions appear:
1. Revert `P1-S1` files only (listed above).
2. Re-run the same 4-file SPX E2E baseline suite to verify rollback parity.

