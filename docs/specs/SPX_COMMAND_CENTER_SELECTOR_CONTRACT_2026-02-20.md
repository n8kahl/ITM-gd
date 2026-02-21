# SPX Command Center Selector Contract Manifest
Date: February 20, 2026
Scope route: `/members/spx-command-center`

## 1. Purpose
Freeze critical selector and behavior contracts used by SPX E2E tests before refactor/repair work.

## 2. Contract Sources
1. `/Users/natekahl/ITM-gd/e2e/spx-command-center.spec.ts`
2. `/Users/natekahl/ITM-gd/e2e/spx-command-palette.spec.ts`
3. `/Users/natekahl/ITM-gd/e2e/spx-coach-messages.spec.ts`
4. `/Users/natekahl/ITM-gd/e2e/spx-setup-interaction.spec.ts`

## 3. Critical Selector Contracts

| Contract ID | Selector / Locator | Expected Behavior | Primary Surface | Status (2026-02-20 baseline) |
|---|---|---|---|---|
| SC-001 | Text `SPX Command Center` | Visible on page render | Header identity | Drifted |
| SC-002 | Heading `Setup Feed` | Visible in decision rail | Setup panel | Passing |
| SC-003 | Heading `AI Coach` | Visible in decision rail | Coach panel | Passing |
| SC-004 | Heading `Contract Selector` | Visible in decision rail | Contract panel | Passing |
| SC-005 | `[data-testid="spx-command-palette-trigger"]` | Opens command palette | Header/shortcut entrypoint | Drifted |
| SC-006 | Command palette input placeholder `Search commands (enter trade, exit trade, ask coach...)` | Visible after trigger click | Command palette | Drifted via trigger missing |
| SC-007 | `[data-testid="spx-ai-coach-feed"]` | Coach feed present | Coach panel | Passing |
| SC-008 | Coach filter button `All` | Available and clickable | Coach panel | Partial drift (scope-dependent visibility) |
| SC-009 | `[data-testid="spx-ai-coach-timeline"]` | Timeline present for message scrolling contract | Coach panel | Drifted |
| SC-010 | `[data-testid="spx-ai-coach-jump-latest"]` | Appears when scrolled up and new message arrives | Coach timeline UX | Drifted |
| SC-011 | `[data-testid="spx-ai-coach-pinned-alert"]` | Pinned alert appears then auto-lifecycle clears | Coach alert lifecycle | Drifted |
| SC-012 | Coach message card with `Expand/Collapse` | Expandable long message | Coach messages | Drifted through timeline discoverability |
| SC-013 | Action chip `Hold / Wait` | Sends scoped follow-up message | Coach messages | Drifted through timeline discoverability |
| SC-014 | Button `Use AI Recommendation` | Visible after alternative contract selected, then hidden after revert | Contract selector | Drifted |
| SC-015 | `[data-testid="spx-flow-ticker"]` | Flow ticker visible | Chart/flow panel | Passing |
| SC-016 | `[data-testid="spx-flow-toggle"]` + `[data-testid="spx-flow-expanded"]` | Expanded flow pane toggles on/off | Flow ticker | Passing |

## 4. State/Behavior Contracts
1. Command palette open path must be deterministic from header trigger and keyboard shortcut.
2. Coach timeline and action chips must be discoverable without hidden dead-end path.
3. Pinned alert lifecycle must persist seen state to local storage key `spx.coach.alert.lifecycle.v2`.
4. Contract mode must expose deterministic revert action after alternative selection.

## 5. Ownership Mapping
1. Header / command trigger: `/Users/natekahl/ITM-gd/components/spx-command-center/spx-header.tsx`
2. Coach feed/timeline/alerts: `/Users/natekahl/ITM-gd/components/spx-command-center/ai-coach-feed.tsx`
3. Contract revert flow: `/Users/natekahl/ITM-gd/components/spx-command-center/contract-selector.tsx`, `/Users/natekahl/ITM-gd/components/spx-command-center/contract-card.tsx`
4. State orchestration: `/Users/natekahl/ITM-gd/contexts/SPXCommandCenterContext.tsx`
5. Page composition and panel visibility: `/Users/natekahl/ITM-gd/app/members/spx-command-center/page.tsx`

## 6. Phase 0 Exit Check
1. Selector contracts listed and traceable to source files.
2. Drift status captured for all critical contracts.
