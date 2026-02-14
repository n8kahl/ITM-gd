# AI Coach Rollout and Rollback Runbook

Last Updated: 2026-02-14  
Owner: AI Coach Engineering / On-call

## Rollout Scope
- Realtime chart updates (websocket + REST reconcile).
- Chart race-condition hardening and non-blocking loading.
- Level interaction enhancements (desktop + mobile actions).
- Progressive SSE function-result updates.
- Screenshot-context persistence into canonical chat history.

## Pre-Rollout Validation
```bash
pnpm test:unit components/ai-coach/__tests__/chart-level-utils.test.ts components/ai-coach/__tests__/chart-level-labels.test.ts components/dashboard/__tests__/market-status-badge.test.tsx backend/src/services/__tests__/marketIndices.test.ts backend/src/services/__tests__/realTimePrice.test.ts backend/src/services/__tests__/stockSplits.test.ts

pnpm eslint components/ai-coach/center-panel.tsx components/ai-coach/chart-level-labels.tsx hooks/use-price-stream.ts hooks/use-ai-coach-chat.ts app/members/ai-coach/page.tsx
```

## Rollout Steps
1. Deploy to staging.
2. Verify websocket connect/disconnect breadcrumbs and chart fetch breadcrumbs in Sentry.
3. Run manual scenarios from `docs/ai-coach/testing/AI_COACH_REALTIME_TEST_PLAN.md`.
4. Roll to production in low-traffic window.
5. Monitor error rate, websocket disconnect spikes, and chat stream failure frequency.

## Rollback Triggers
- Chart panels repeatedly show delayed state despite healthy backend websocket service.
- Elevated chat stream interruption without partial-content recovery.
- Screenshot workflow writing non-canonical/local-only messages again.

## Rollback Actions
1. Revert deployment to previous release.
2. Confirm chart still loads via baseline REST path.
3. Confirm chat non-stream fallback still operates.
4. Document incident timeline and suspected regression commit.

## Known Failure Modes
- Expired/invalid JWT prevents websocket auth; UI should degrade to delayed REST reconciliation.
- Local environments without backend env vars may fail backend stream tests.
