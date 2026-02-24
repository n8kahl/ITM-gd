# AI Coach Prompt/Widget Experience Hardening Release Notes

Date: 2026-02-24  
Release type: UX + routing hardening  
Audience: Product, design, engineering, QA

## Summary
This release hardens AI Coach for new-trader usability while preserving advanced chart-driven workflows. It improves prompt routing reliability, simplifies novice entry points, enriches chart context from AI outputs, and restores explicit watchlist/search ergonomics.

## What shipped

### Prompt-routing and contract hardening
- Relaxed over-strict SPX game-plan contract requirements that were over-weighting compliance text.
- Narrowed `company_profile` trigger phrases to avoid false routing on generic educational prompts.
- Added symbol-bound fallback behavior for no-symbol prompts so required calls downgrade to recommended calls.
- Changed contract rewrite trigger to blocking-only violations.

### Beginner-first conversational surfaces
- Replaced advanced-first quick prompts with beginner-first defaults (`Start Here`, `Read This Chart`, `Risk Checklist`).
- Updated center-panel starter prompts to prioritize plain-language interpretation and risk framing.
- Rebalanced follow-up chips toward explanation, chart visualization, and risk plans.

### Chart context enrichment
- Extended chart extraction to support earnings/macro/economic/news outputs with context notes.
- Added context-note propagation through widget actions and mobile tool sheet payloads.
- Added chart context badges beneath toolbar for visual continuity.

### Watchlist and symbol-search polish
- Added explicit `Go` action in symbol search and manual-symbol commit path.
- Added `Manage Watchlist` panel in chart toolbar with add/remove/select actions.
- Added quick watchlist symbol chips for fast switching on larger screens.

## Validation gates executed
- Frontend lint (touched files): PASS
- Type check: PASS
- Frontend targeted unit test (`use-mobile-tool-sheet`): PASS (6/6)
- Backend targeted test (`intentRouter`): PASS (13/13)
- Targeted AI Coach E2E audit spec: PASS with explicit timeout (`--timeout=120000`)

## Known follow-ups
- Add keyboard/accessibility-specific QA pass for watchlist panel interactions.
- Add targeted tests for symbol search commit edge cases and watchlist add/remove UX.
- Rebaseline E2E timeout defaults for AI Coach suites with local webserver startup overhead.

## Phase 2 Addendum (2026-02-24)
- Added chart payload support for event markers and position overlays.
- Added beginner progression rails with persistent step tracking.
- Added capability hint rotation for broad novice discoverability.
- Standardized widget action prioritization and quick-action visibility for core controls.
- Added trust metadata footer (`Data as of`, `Source`, `Confidence`) on major analytical cards.
- Added mobile context strip with one-tap return to chat.
