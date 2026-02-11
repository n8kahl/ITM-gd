# AI Coach Layout + Timeframe Patch Spec

## Scope
Fix three production UX regressions in AI Coach:
1. `SPX Live` and `Next Best Setup` cards consume too much vertical space and hide lower workflow options.
2. Chat header does not adapt cleanly when chat panel is resized.
3. Chart view defaults to `1D` in multiple action flows; required default is `5m`.

## Root Cause Analysis

### 1) Command Center card footprint
- The welcome hero in `components/ai-coach/center-panel.tsx` used stacked full-width cards (`SPX Live`, `Next Best Setup`) with larger vertical padding and multi-line setup text.
- Result: the top section consumed too much vertical space, forcing users to scroll before seeing workflow options.

### 2) Chat header rigidity
- The chat header in `app/members/ai-coach/page.tsx` used a single non-wrapping row with many controls (session toggle, title, SPX quick action, shortcut hint, new session, collapse control).
- Under narrower panel widths (resizable split), right-side controls competed for space and caused clipping/crowding.

### 3) Timeframe default drift (`1D` vs `5m`)
- Chart timeframe defaults were inconsistent across workflow/action dispatch paths:
  - `components/ai-coach/widget-actions.ts`
  - `contexts/AICoachWorkflowContext.tsx`
  - `hooks/use-ai-coach-chat.ts`
  - card-triggered dispatchers (`components/ai-coach/widget-cards.tsx`, `components/ai-coach/options-chain.tsx`)
- Result: users often landed on daily charts even when intraday context was expected.

## Implementation Plan

### A) Compact Command Center hero
- Reduce top section padding and typography density.
- Convert status cards to a compact responsive grid on desktop.
- Reduce internal spacing and clamp setup description to one line.
- Preserve all actions (`Refresh`, `Build Trade Plan`) and status metadata.

### B) Flexible chat header
- Refactor header into wrap-aware layout:
  - left cluster: session toggle + icon + title
  - right cluster: actions in wrap-capable row
- Keep keyboard/quick-action hints but only show them on larger widths.
- Keep `New` and collapse actions accessible at all sizes.

### C) Enforce `5m` as default chart timeframe
- Set all default chart fallbacks from `1D` to `5m` in workflow and action emitters.
- Update explicit chart actions that were hardcoded to `1D` to `5m` where those represent default navigation actions.
- Preserve intentional non-default overrides (e.g. `15m` setup-specific flows).

## Files Changed
- `components/ai-coach/center-panel.tsx`
- `app/members/ai-coach/page.tsx`
- `components/ai-coach/widget-actions.ts`
- `contexts/AICoachWorkflowContext.tsx`
- `hooks/use-ai-coach-chat.ts`
- `components/ai-coach/options-chain.tsx`
- `components/ai-coach/widget-cards.tsx`

## Validation Plan

### Automated
1. Run static validation:
   - `pnpm lint`
   - `pnpm exec tsc --noEmit`
2. Run production build:
   - `pnpm build`

### Manual UI validation
1. Desktop split view:
   - Resize chat panel from wide to narrow; verify header wraps cleanly without clipping.
2. Welcome panel:
   - Verify `SPX Live` + `Next Best Setup` occupy less vertical space and workflow options are visible earlier.
3. Chart actions:
   - Trigger chart from key widgets (key levels, GEX, options chain, alerts, earnings, trade history).
   - Verify initial timeframe is `5m` unless flow explicitly requests otherwise.

## Production Readiness Checklist
- [ ] No TypeScript/lint failures.
- [ ] `pnpm build` passes.
- [ ] No regression in widget action routing (chart/options/alerts/position tabs).
- [ ] Manual resize test completed on desktop.
- [ ] Manual smoke test completed on mobile AI Coach view toggle.
