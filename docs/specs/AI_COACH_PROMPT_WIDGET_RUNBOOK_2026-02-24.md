# AI Coach Prompt/Widget Experience Hardening Runbook

Date: 2026-02-24  
Status: Ready for rollout and QA verification  
Owner: Engineering

## 1. Scope
This runbook covers rollout verification for:
- intent routing hardening
- beginner-first prompt/chip surfaces
- chart context note enrichment
- watchlist and symbol-search UX polish

## 2. Pre-deploy checklist
- Confirm branch builds green.
- Run lint on touched frontend files.
- Run `pnpm exec tsc --noEmit`.
- Run `pnpm exec vitest run components/ai-coach/__tests__/use-mobile-tool-sheet.test.ts`.
- Run `npm run test --prefix backend -- src/chatkit/__tests__/intentRouter.test.ts`.
- Run `pnpm exec playwright test e2e/specs/ai-coach/ai-coach-widget-actions-audit.spec.ts --project=ai-coach --workers=1 --timeout=120000`.

## 3. Deployment procedure
1. Deploy backend service.
2. Deploy frontend app.
3. Open `/members/ai-coach` and complete onboarding bypass or flow.
4. Verify chat + chart load and symbol search/watchlist controls render.

## 4. Smoke test matrix
- Beginner flow:
  - send `Start Here` prompt
  - verify plain-language response and chart-focused guidance
- Advanced flow:
  - send advanced SPX prompt
  - verify level/GEX cards and chart actions still function
- Macro/earnings/news flow:
  - request macro context and earnings analysis
  - verify chart context badges update
- Watchlist flow:
  - add symbol in `Manage Watchlist`
  - remove symbol
  - switch chart symbol via watchlist chip and symbol search `Go`

## 5. Monitoring
Track for first 24h:
- AI Coach chat error rate (`/api/chat/stream`, `/api/chat/message`)
- client runtime errors in AI Coach route
- user interactions with symbol search and watchlist panel

## 6. Rollback criteria
Rollback if any of the following are observed:
- prompt routing regression for setup/game-plan intents
- symbol search cannot reliably switch chart symbol
- watchlist interactions break chart symbol state
- chart context notes cause repeated rendering failures

## 7. Rollback steps
1. Revert this hardening commit(s) for AI Coach prompt/widget files.
2. Redeploy frontend and backend.
3. Re-run targeted backend and frontend tests.
4. Confirm AI Coach core chat + chart baseline behavior restored.
