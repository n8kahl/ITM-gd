# Codex Prompt — AI Coach Chat-First Rearchitecture (Mobile + Desktop)

## Setup Instructions

Before running this prompt in Codex, commit the spec to a feature branch:

```bash
git checkout -b codex/ai-coach-chat-first-rearchitect
git add docs/NAVIGATION_AND_AI_COACH_MOBILE_CODEX_SPEC.md
git commit -m "docs: add AI Coach mobile + desktop rearchitecture Codex spec v3.0"
git push -u origin codex/ai-coach-chat-first-rearchitect
```

---

## Codex Prompt

```
You are implementing a complete UI rearchitecture of the AI Coach feature for a Next.js 16 trading platform (TypeScript strict, Tailwind, Framer Motion, react-resizable-panels).

Read `docs/NAVIGATION_AND_AI_COACH_MOBILE_CODEX_SPEC.md` in its entirety — it is the single source of truth. It contains 14 implementation phases (7 mobile, 6 desktop, 1 widget optimization), full TypeScript code for every new file, modification instructions for every existing file, complete Vitest unit tests, and a Playwright E2E spec.

Execute every phase in order (1 → 14). For each phase:

1. Create all new files listed in that phase with the exact code from the spec.
2. Apply all modifications to existing files as described — the spec gives exact line references, before/after context, and replacement code.
3. After each phase, run `pnpm tsc --noEmit` and fix any type errors before proceeding.

### Phase-by-phase checklist:

**PART A — MOBILE (Phases 1-7)**

Phase 1: Create `hooks/use-mobile-tool-sheet.ts` and its test file. This is the event bridge hook that intercepts widget CustomEvents on mobile and maps them to tool sheet views.

Phase 2: Create `components/ai-coach/inline-mini-chart.tsx` and its test file. Modify `hooks/use-ai-coach-chat.ts` to attach `chartRequest` to individual `ChatMessage` objects. Modify `components/ai-coach/chat-message.tsx` to render `InlineMiniChart` when a message has chart data.

Phase 3: Create `components/ai-coach/mobile-tool-sheet.tsx` and its test file. This is the full-screen sheet overlay that renders CenterPanel with a `forcedView` prop. Modify `components/ai-coach/center-panel.tsx` to accept and honor `forcedView`, and hide tab rail/FAB when in sheet mode.

Phase 4: Modify `app/members/ai-coach/page.tsx` — delete the `mobileView` state, the binary toggle bar, swipe gesture handlers, and the conditional render. Replace with always-mounted ChatArea + tool sheet overlay. Wire `useMobileToolSheet` hook into the page.

Phase 5: Create `components/ai-coach/mobile-quick-access-bar.tsx` and its test file. Mount it in page.tsx above the chat input on mobile. It provides 5 primary tool buttons + a "More" expandable grid.

Phase 6: Create `lib/navigation-utils.ts` with shared `isLibraryPath()`. Modify `components/members/mobile-bottom-nav.tsx` to use `getMobileTabs()` from Supabase instead of the hardcoded `PRIMARY_TABS[]`.

Phase 7: Add ARIA roles to `components/ai-coach/follow-up-chips.tsx`. Add `mobile-ai-coach` project to `playwright.config.ts`. Create `e2e/specs/ai-coach/ai-coach-mobile.spec.ts` with the full Playwright E2E spec from the doc.

**PART B — DESKTOP (Phases 8-13)**

Phase 8: Create `hooks/use-panel-attention-pulse.ts` and its test file. Modify `app/members/ai-coach/page.tsx` to wrap the CenterPanel container with a pulse ring that flashes emerald on widget action events. Add a toast label that shows which view was activated.

Phase 9: Modify `app/members/ai-coach/page.tsx` to pass `onExpandChart` callback to ChatArea on desktop. When an InlineMiniChart is clicked on desktop, dispatch `ai-coach-show-chart` event so CenterPanel navigates to the chart view with the correct symbol.

Phase 10: Create `components/ai-coach/desktop-context-strip.tsx` and its test file. Mount it in `center-panel.tsx` above the tab rail. Change the CenterPanel default from `'welcome'` to `'chart'`. Add `hideContextData` prop to WelcomeView so it doesn't duplicate data already shown in the context strip.

Phase 11: Create `components/ai-coach/mini-chat-overlay.tsx` and its test file. Modify `app/members/ai-coach/page.tsx` to replace the static "Chat" collapse button with this floating, draggable mini-chat overlay that shows the last 5 messages + compact input.

Phase 12: Modify `components/ai-coach/center-panel.tsx` to make tab group labels always visible (remove the `opacity-0 group-hover` gating). Modify `components/ai-coach/preferences.ts` to add `lastActiveView`, `lastChartSymbol`, `lastChartTimeframe` fields. Wire session restore on mount.

Phase 13: Create `hooks/use-hover-coordination.ts` and its test file. Modify `components/ai-coach/widget-cards.tsx` to add `onMouseEnter`/`onMouseLeave` handlers on level rows in key_levels/gex_profile/spx_game_plan cards. Modify `center-panel.tsx` to consume highlighted level state. Modify `chat-message.tsx` to add highlight ring when its message is the hover source.

**PART C — WIDGET OPTIMIZATION (Phase 14)**

Phase 14: Widget action system overhaul. Create `components/ai-coach/widget-action-bar-v2.tsx` (tiered action bar with Radix Popover overflow menu) and its test file. Create `components/ai-coach/widget-row-actions.tsx` (tap-accessible per-row action Popover replacing right-click-only context menus) and its test file. Modify `components/ai-coach/widget-actions.ts` to unify dual chart dispatch paths into single `chartAction` with `ChartActionLevels`, add per-view icons to `viewAction`, and add `findNearestAlertLevel()` for smart alert targeting. Modify `components/ai-coach/widget-cards.tsx` to replace all `normalizeActions` calls with explicit `TieredActions`, swap `WidgetActionBar` → `WidgetActionBarV2`, swap `WidgetContextMenu` → `WidgetRowActions`, and remove `chatAction` from action bars (follow-up chips already handle it). Delete `components/ai-coach/widget-action-bar.tsx` and `components/ai-coach/widget-context-menu.tsx`.

### After all phases:

Run the full validation suite:
```bash
pnpm tsc --noEmit && pnpm vitest run && pnpm lint
```

Fix any errors. Then run E2E:
```bash
pnpm test:e2e --project=ai-coach
pnpm test:e2e --project=mobile-ai-coach
```

Commit each phase as a separate commit using conventional commit format:
- `feat(ai-coach): Phase 1 — mobile event bridge hook`
- `feat(ai-coach): Phase 2 — inline chart cards in chat`
- ...through Phase 13
- `feat(ai-coach): Phase 14 — widget action optimization`

If any phase introduces type errors that block the next phase, fix them immediately within that phase's commit. The spec has all the code — follow it precisely.
```
