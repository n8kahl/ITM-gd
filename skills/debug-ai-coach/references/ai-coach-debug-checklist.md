# AI Coach Debug Checklist

## Symptom Types

- Wrong ticker in assistant response
- Wrong ticker in quick actions or follow-up chips
- Chart and assistant message disagree
- Session switch keeps prior chart or overlays
- Screenshot follow-up routes to the wrong symbol
- Widget action opens the wrong tool or symbol

## File Map

- Backend routing: `backend/src/chatkit/intentRouter.ts`
- Backend prompt-context symbol extraction: `backend/src/chatkit/symbolExtraction.ts`
- Backend non-streaming loop: `backend/src/chatkit/chatService.ts`
- Backend streaming loop: `backend/src/chatkit/streamService.ts`
- Frontend session/chat state: `hooks/use-ai-coach-chat.ts`
- Frontend chart request helpers: `lib/ai-coach-chat-state.ts`
- Frontend quick actions: `components/ai-coach/follow-up-chips.tsx`
- Frontend message rendering: `components/ai-coach/chat-message.tsx`
- Frontend center panel and active symbol sync: `components/ai-coach/center-panel.tsx`
- Page-level screenshot and widget events: `app/members/ai-coach/page.tsx`

## Common Root Causes

### 1. Symbol Drift

- Plain-English words are treated as symbols in prompt-context extraction.
- Assistant history contaminates later requests.
- Model emits tool calls for a symbol outside the routed symbol scope.
- Frontend content parsing infers chips from prose instead of tool metadata.

### 2. Session/State Drift

- `chartRequest` persists across new sessions.
- Session selection loads messages but not the latest assistant chart request.
- Deleting the active session leaves old chart state alive.

### 3. Screenshot Ambiguity

- User prompt omits the ticker and relies on chart/image context.
- OCR/vision sees multiple symbols or unrelated uppercase words.
- The active chart symbol is not passed through to routing.

## Debug Sequence

1. Reproduce with the smallest prompt that still fails.
2. Inspect saved function calls before trusting UI text.
3. Compare routed symbol set vs executed symbol args.
4. Verify whether the center panel received the expected `chartRequest`.
5. Add a regression test at the exact failed layer.

## Verification Commands

```bash
pnpm --dir backend exec jest src/chatkit/__tests__/intentRouter.test.ts src/chatkit/__tests__/symbolExtraction.test.ts --runInBand
pnpm exec vitest run components/ai-coach/__tests__/follow-up-chips.test.ts lib/__tests__/ai-coach-chat-state.test.ts
pnpm exec tsc --noEmit --pretty false
```
