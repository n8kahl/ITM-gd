---
name: debug-ai-coach
description: Debug AI Coach issues across chat routing, symbol inference, tool execution, chart sync, quick actions, session state, and screenshot-driven workflows. Use when AI Coach shows the wrong ticker, mismatched chart/widget content, stale session context, broken follow-up chips, or other behavior where the visible UI may not match the routed backend data.
---

# Debug AI Coach

## Overview

Trace AI Coach bugs from UI symptom to routed tool call. Prefer fixes that eliminate the wrong data path, then add regression tests so the same failure cannot re-enter through prompt context, session history, or widget rendering.

## Workflow

1. Reconstruct the symptom precisely.
Capture the visible mismatch: wrong ticker, wrong chart, stale widget, broken chip, or session carry-over. Note whether the symptom appears in assistant prose, function-driven widgets, quick actions, or center-panel state.

2. Identify the source of truth for the symbol and context.
Inspect these layers in order:
- Frontend active chart symbol and workflow context
- Sent user prompt and any image/screenshot payload
- Backend routing plan and symbol extraction
- Tool-call arguments and tool results
- Frontend widget/chip symbol extraction and chart-request handling

3. Distinguish inference bugs from rendering bugs.
- If the wrong ticker reaches backend tool execution, fix routing, symbol extraction, or tool-call sanitization.
- If tool execution is correct but the UI shows the wrong ticker, fix widget/chip/chart state derivation.
- If the bug only appears after switching sessions or starting a new one, inspect retained state before touching model prompts.

4. Check the highest-risk files first.
- `backend/src/chatkit/intentRouter.ts`
- `backend/src/chatkit/chatService.ts`
- `backend/src/chatkit/streamService.ts`
- `backend/src/chatkit/symbolExtraction.ts`
- `hooks/use-ai-coach-chat.ts`
- `components/ai-coach/follow-up-chips.tsx`
- `components/ai-coach/chat-message.tsx`
- `components/ai-coach/center-panel.tsx`
- `app/members/ai-coach/page.tsx`

5. Prefer deterministic guardrails over prompt-only fixes.
If the model can still emit a bad symbol, add execution-time sanitization or state-derived fallback logic. Prompt changes alone are not sufficient for ticker drift bugs.

6. Add small regression tests at the layer that failed.
- Backend symbol extraction or routing: Jest under `backend/src/chatkit/__tests__/`
- Frontend follow-up chips or session helpers: Vitest under `components/ai-coach/__tests__/` or `lib/__tests__/`
- Type-only regressions: run repo `tsc --noEmit`

## Investigation Rules

- Use explicit symbols from the current user request over symbols inferred from assistant history.
- Treat deictic words such as `here`, `this`, and `that` as suspect unless the user clearly expressed a ticker.
- Do not trust assistant prose as proof of the executed symbol; inspect recorded function calls.
- When the request omits a ticker, verify whether the active chart symbol should have been used by contract.
- When screenshots are involved, separate OCR/vision ambiguity from backend routing mistakes.

## Validation

Run the narrowest tests that prove the fix:

```bash
pnpm --dir backend exec jest src/chatkit/__tests__/intentRouter.test.ts src/chatkit/__tests__/symbolExtraction.test.ts --runInBand
pnpm exec vitest run components/ai-coach/__tests__/follow-up-chips.test.ts lib/__tests__/ai-coach-chat-state.test.ts
pnpm exec tsc --noEmit --pretty false
```

If the fix touches a different layer, add or swap targeted tests instead of defaulting to the full suite.

## References

Read [references/ai-coach-debug-checklist.md](references/ai-coach-debug-checklist.md) when you need a compact checklist of common failure modes, file ownership, and verification commands.
