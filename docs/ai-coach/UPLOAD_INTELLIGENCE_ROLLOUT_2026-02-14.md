# Upload Intelligence Rollout (2026-02-14)

## Summary
This rollout adds actionable post-upload intelligence for screenshots and CSVs across AI Coach and Trade Journal flows.

## Delivered Behavior
### AI Coach Chat
- Supports screenshot uploads (`png/jpeg/webp/gif`) and CSV uploads.
- Screenshot upload now returns:
  - extracted positions
  - detected screenshot intent
  - suggested next actions
- After screenshot analysis, users get one-tap action chips directly above the chat input.
- CSV upload stages the file and sends a structured analysis prompt using a bounded preview, allowing the model to classify rows into:
  - trades to log
  - positions to monitor
  - next-step analysis requests

### AI Coach Center Screenshot Tool
- Screenshot review now displays detected intent and a "What should I do next?" action area.
- Suggested actions are one-tap and wired to:
  - monitor view
  - journal view
  - position analysis
  - targeted AI prompts for setup/alerts/journal context

### Trade Journal Screenshot Upload (Full Form)
- After screenshot upload, AI extraction runs automatically.
- Journal upload zone shows:
  - extracted position count
  - detected intent
  - action chips
- "Apply Top Position To Form" now prefills key fields:
  - symbol
  - contract type
  - size
  - direction (if negative quantity)
  - entry
  - strike
  - expiration

### Trade Journal Quick Screenshot Entry
- Screenshot now auto-analyzes before save.
- If a symbol is detected, it auto-suggests/pre-fills.
- Suggested actions are exposed as quick buttons that open AI Coach with targeted prompts.

## Backend Contract Changes
`POST /api/screenshot/analyze` now includes:
- `intent`: `single_position | portfolio | options_chain | pnl_card | chart | unknown`
- `suggestedActions`: array of structured actions
  - `add_to_monitor`
  - `log_trade`
  - `analyze_next_steps`
  - `create_setup`
  - `set_alert`
  - `review_journal_context`

The analyzer applies safe defaults when model output omits intent/actions.

## Files Updated
- `backend/src/services/screenshot/analyzer.ts`
- `lib/api/ai-coach.ts`
- `app/members/ai-coach/page.tsx`
- `components/ai-coach/chat-image-upload.tsx`
- `components/ai-coach/screenshot-upload.tsx`
- `components/ai-coach/center-panel.tsx`
- `components/journal/screenshot-upload-zone.tsx`
- `components/journal/screenshot-quick-add.tsx`
- `components/journal/full-entry-form.tsx`

## Validation Run
- `pnpm exec tsc --noEmit` ✅
- `pnpm exec playwright test e2e/specs/members/journal.spec.ts e2e/specs/members/journal-import.spec.ts --project=chromium --workers=1` ✅
- `pnpm exec playwright test e2e/specs/ai-coach/ai-coach-api.spec.ts --project=ai-coach --workers=1` ✅
- `pnpm exec eslint <modified files>` ✅ (no errors; only pre-existing warnings in untouched areas)

## Known Follow-up
- Add dedicated e2e coverage for screenshot success-path action chips (current suites mainly validate auth/import and broader workflow behavior).
