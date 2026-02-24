# AI Coach Prompt/Widget Hardening - Slice A Report

Date: 2026-02-24  
Owner: Codex autonomous implementation  
Status: Complete

## Slice Objective
Stabilize prompt routing and response-contract behavior for novice and educational AI Coach requests without regressing high-risk setup workflows.

## Scope
- Harden intent detection phrase matching.
- Prevent symbol-bound tool forcing for no-symbol educational prompts.
- Reduce excessive blocking-contract triggers on informational flows.

## Out of Scope
- UI quick prompt/chip changes.
- Chart extraction/overlay changes.
- Search/watchlist UX changes.

## Files
- `backend/src/chatkit/intentRouter.ts`
- `backend/src/chatkit/__tests__/intentRouter.test.ts`

## Implementation Notes
- Relaxed `spx_game_plan` contract requirements to avoid over-constraining educational responses:
  - removed `requiresDisclaimer`
  - removed `requiresScenarioProbabilities`
  - removed `requiresLiquidityWatchouts`
- Narrowed `company_profile` phrase matching:
  - removed generic `what is` / `what does` triggers
  - retained company-specific phrases (`company profile`, `fundamentals`, `market cap`, `business model`)
- Fixed no-symbol handling for symbol-bound tools:
  - added `get_trade_history_for_symbol` to symbol-specific function set
  - downgraded symbol-bound required tools to recommended when prompt has no symbol
- Reduced contract rewrite aggressiveness:
  - `shouldAttemptContractRewrite` now triggers only on blocking violations (not warnings-only)
- Added/updated tests for:
  - no-symbol company profile behavior
  - generic educational prompt routing safety
  - warnings-only contract audit rewrite behavior

## Validation Gate Results
- `npm run test --prefix backend -- src/chatkit/__tests__/intentRouter.test.ts`
  - PASS (13/13 tests)
- `pnpm exec tsc --noEmit`
  - PASS
- Frontend lint and Playwright are covered in slices B-D because this slice is backend-focused.

## Risks / Decisions
- Decision: keep strict contract checks for higher-risk setup/strategy intents while reducing strictness for educational and informational intents.
- Residual risk: relaxed `spx_game_plan` contract may produce less explicit risk framing in some responses.
  - Mitigation: beginner-first prompt and chip changes in slice B increase explicit risk prompts.
