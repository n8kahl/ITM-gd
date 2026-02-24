# AI Coach Prompt/Widget/Experience Audit

Date: 2026-02-24  
Owner: Codex  
Status: Phase 2 completed (implementation aligned to recommendations)

## Executive Summary
The AI Coach is materially improved for beginners after Phase 1 hardening, but the chart experience still underutilizes visual coaching potential. The top next-step opportunity is converting more card insights into concrete chart overlays (risk zones, event markers, scenario bands) instead of text-only context badges.

## What improved in Phase 1
- Beginner-first prompt entry points replaced advanced-first defaults.
- Follow-up chips now prioritize explanation, chart mapping, and risk planning.
- Intent router no longer over-routes generic educational prompts into ticker/company profile flows.
- Earnings/macro/economic/news flows can now push chart context notes.
- Watchlist editing and symbol commit behavior are explicit and discoverable.

## Findings and Recommendations

### P0: Chart visual translation still shallow for non-level workflows
Current state:
- Macro/economic/news flows render context badges but mostly do not draw chart objects.

Recommendation:
- Add visual overlay adapters per analysis type:
  - earnings: expected-move envelope (upper/lower bands)
  - macro/econ: timeline event markers
  - position/risk plans: entry/stop/target zone shading
  - news: catalyst marker pins with timestamp

Target files:
- `hooks/use-ai-coach-chat.ts`
- `components/ai-coach/trading-chart.tsx`
- `components/ai-coach/center-panel.tsx`

### P0: Beginner progression scaffolding is still implicit
Current state:
- Prompts are beginner-friendly, but there is no explicit progression path.

Recommendation:
- Add guided learning rails directly in chat UI:
  - `Level 1: Read trend`
  - `Level 2: Define trigger`
  - `Level 3: Build risk plan`
  - `Level 4: Post-trade review`
- Persist progression state in local preferences.

Target files:
- `app/members/ai-coach/page.tsx`
- `components/ai-coach/follow-up-chips.tsx`
- `components/ai-coach/chat-panel.tsx`

### P1: Widget action consistency remains uneven
Current state:
- Most cards expose chart actions, but some actions are mixed (chart/options/chat) without clear priority or consistent labels.

Recommendation:
- Standardize primary action order for all cards:
  1. `Show on Chart`
  2. `Risk Plan`
  3. `Explain Simply`
- Enforce action schema contract in widget builder utilities.

Target files:
- `components/ai-coach/widget-cards.tsx`
- `components/ai-coach/widget-actions.ts`
- `components/ai-coach/widget-row-actions.tsx`

### P1: Trust and explainability metadata is not uniform
Current state:
- Some cards lack explicit "as-of" timestamp/source context, which is critical for market confidence.

Recommendation:
- Add footer metadata standard to all analytical cards:
  - `Data as of`
  - `Source`
  - `Confidence/quality` (when available)

Target files:
- `components/ai-coach/widget-cards.tsx`

### P1: Mobile chart+chat transitions need stronger affordances
Current state:
- Mobile supports chart and sheet transitions but lacks a persistent explicit “return to chat context” cue during deeper interactions.

Recommendation:
- Add sticky mini-context strip with last AI thesis and quick return-to-chat action.

Target files:
- `components/ai-coach/mini-chat-overlay.tsx`
- `components/ai-coach/mobile-tool-sheet.tsx`

### P2: Capability discoverability for broad novice questions
Current state:
- Users can ask anything, but capability hints remain mostly implicit.

Recommendation:
- Add rotating “You can ask me…” hint set tied to market session and symbol context.

Target files:
- `components/ai-coach/chat-panel.tsx`
- `components/ai-coach/follow-up-chips.tsx`

## Proposed Next Tranche (Phase 2)
1. Visual Overlay Engine Expansion (earnings bands, econ markers, risk zones).
2. Beginner Progression Rails and session-aware onboarding prompts.
3. Widget Action Contract standardization + trust metadata.
4. Mobile context strip improvements.

## Phase 2 Implementation Status
- Implemented in code and validated:
  - chart request expansion with `eventMarkers` and `positionOverlays`
  - beginner progression rails with persistence
  - widget action contract prioritization and visibility safeguards
  - card-level trust metadata footer standard
  - mobile context strip with one-tap return to chat
- Completion report:
  - `docs/specs/AI_COACH_PROMPT_WIDGET_PHASE2_COMPLETION_2026-02-24.md`

## Suggested Acceptance Criteria for Phase 2
- At least 80% of macro/earnings/position widget actions produce visible chart overlays.
- All primary analytical cards expose consistent `Show on Chart` and `Risk Plan` actions.
- All analytical cards display standardized timestamp/source metadata.
- Mobile chart view always exposes a one-tap return to prior chat context.
