# TITM AI COACH — Phase 2 Implementation Specification

**Version**: 2.0
**Date**: February 8, 2026
**Author**: Nate + Claude (AI Architect)
**Classification**: Internal Engineering
**Status**: Ready for Implementation

---

## Table of Contents

1. [Executive Summary & Current State Assessment](#1-executive-summary--current-state-assessment)
2. [Architecture Principles & Decisions](#2-architecture-principles--decisions)
3. [Work Package 1: Streaming AI Responses (SSE)](#3-work-package-1-streaming-ai-responses-sse)
4. [Work Package 2: Screenshot-to-Chat Pipeline](#4-work-package-2-screenshot-to-chat-pipeline)
5. [Work Package 3: Alert Monitoring Worker](#5-work-package-3-alert-monitoring-worker)
6. [Work Package 4: User Profile & Preferences API](#6-work-package-4-user-profile--preferences-api)
7. [Work Package 5: Error Monitoring (Sentry)](#7-work-package-5-error-monitoring-sentry)
8. [Work Package 6: Frontend Polish & Integration Testing](#8-work-package-6-frontend-polish--integration-testing)
9. [Implementation Schedule & Dependency Graph](#9-implementation-schedule--dependency-graph)
10. [Testing Strategy](#10-testing-strategy)
11. [Deployment & Rollback Plan](#11-deployment--rollback-plan)
12. [Risk Register](#12-risk-register)
13. [Acceptance Criteria & Definition of Done](#13-acceptance-criteria--definition-of-done)

---

## 1. Executive Summary & Current State Assessment

### 1.1 Purpose

This document specifies the remaining implementation work to bring the TITM AI Coach from its current state to a feature-complete, production-ready trading assistant. It covers six targeted work packages that close every gap identified in the Phase 1 code audit, with the explicit decision to defer subscription tier enforcement in favor of giving all users full AI Coach access during the initial launch period.

### 1.2 Scope Exclusions

- **Subscription tier enforcement:** All users receive Elite-level access. Tier gating will be a separate future work package.
- **Training materials integration:** Phase 10 per the original roadmap. Not in scope.
- **WebSocket real-time market data:** Massive.com WebSocket streaming is deferred. HTTP polling with Redis caching is sufficient for launch.

### 1.3 Current State Audit

The following table summarizes what exists today based on the comprehensive code audit performed on February 8, 2026:

| Feature Area | Status | Details |
|---|---|---|
| Levels Engine (Phases 1–3) | **DONE** | PDH/PDL/PDC, PMH/PML, pivots, VWAP, ATR, multi-timeframe charts, basic AI chat with function calling. 22 test suites, 373 tests passing. |
| Options Analysis (Phase 5) | **DONE** | Backend complete: options chain fetcher, Black-Scholes Greeks, position/portfolio analyzer. Frontend components exist. 15 AI functions registered (spec required 7). |
| Card Widgets (Phase 4) | **DONE** | Five widget types render in chat: key_levels, position_summary, pnl_tracker, market_overview, alert_status. Triggered by AI function calls. |
| Trade Journal (Phase 7) | **DONE** | Full CRUD, CSV import, analytics endpoint. AI function get_trade_history queries real trades from database. |
| Alerts CRUD (Phase 8) | **PARTIAL** | Create/read/update/delete/cancel endpoints exist. No background monitoring worker to trigger alerts when price conditions are met. |
| Opportunity Scanner (Phase 9) | **DONE** | Technical + options scanners built. AI function scan_opportunities registered. On-demand only (no scheduled scanning). |
| LEAPS & Macro (Phase 10) | **DONE** | Greeks projection, roll calculator, macro context. Frontend dashboards built. |
| Screenshot Analysis (Phase 6) | **PARTIAL** | OpenAI Vision extraction works. Results not fed back into AI chat context for conversational analysis. |
| Streaming AI Responses | **NOT STARTED** | OpenAI called with blocking request. Full response returned at once. No SSE or streaming endpoint. |
| User Profile API | **NOT STARTED** | No GET/PATCH /api/user/profile. Preferences, experience level, and settings have no persistence endpoint. |
| Error Monitoring | **NOT STARTED** | Internal Winston logger only. No Sentry, Datadog, or external error aggregation. |
| Holiday Calendar & DST | **DONE** | Full holiday calendar (2025–2027) and correct DST offset in marketHours.ts. |
| E2E Test Suite | **DONE** | Playwright tests covering auth flows, admin dashboard, member features, RBAC. 11 E2E spec files. |
| Production Hardening | **DONE** | Structured logging, Zod validation, circuit breaker, rate limiting, request IDs, CORS, graceful shutdown. |

### 1.4 What Remains

Based on the audit, six work packages remain. These are ordered by user-facing impact and technical dependency:

| ID | Work Package | Estimate | Priority | Rationale |
|---|---|---|---|---|
| WP1 | Streaming AI Responses | 3–4 days | HIGH | Eliminates 3–10 second perceived wait. Critical UX improvement. |
| WP2 | Screenshot → Chat Pipeline | 2–3 days | HIGH | Connects existing Vision extraction to AI conversation context. |
| WP3 | Alert Monitoring Worker | 3–4 days | MEDIUM | Background price checking + notification delivery. |
| WP4 | User Profile & Preferences | 1–2 days | MEDIUM | Settings persistence, experience level, notification prefs. |
| WP5 | Error Monitoring (Sentry) | 1 day | HIGH | Production visibility. Must-have before launch. |
| WP6 | Frontend Polish & E2E | 3–4 days | MEDIUM | Integration tests, loading states, mobile polish. |

**Total estimated effort:** 13–18 engineering days (approximately 3–4 calendar weeks with testing).

---

## 2. Architecture Principles & Decisions

### 2.1 Guiding Principles

1. **Extend, never rewrite.** Every work package builds on existing code. No architectural refactors. The Express/Supabase/OpenAI stack is final.
2. **Each WP is independently deployable.** Merge and ship each work package separately. No big-bang release. Feature flags where needed.
3. **Backward compatibility guaranteed.** Existing API consumers must not break. New endpoints are additive. Streaming is opt-in via Accept header.
4. **Observable by default.** Every new feature includes structured logging, error reporting, and health check integration from day one.
5. **Test at the boundary.** Integration tests at API boundaries are more valuable than unit tests of internal helpers. E2E tests validate user flows.

### 2.2 Key Technical Decisions

#### Streaming: Server-Sent Events over WebSocket

SSE is chosen over WebSocket for AI response streaming because: (a) SSE works over standard HTTP, requiring no infrastructure changes to the Express server or Railway deployment; (b) OpenAI natively returns streaming responses as SSE-compatible chunks; (c) the data flow is unidirectional (server to client), which is exactly what SSE is designed for; (d) automatic reconnection is built into the EventSource browser API. WebSocket remains reserved for a future real-time market data feature if Massive.com WebSocket integration is pursued.

#### Alert Worker: In-Process Interval over BullMQ

The alert monitoring worker will run as a setInterval loop inside the Express process rather than a separate BullMQ worker. This avoids adding Redis queue infrastructure complexity for what is fundamentally a periodic database check. The worker polls active alerts every 30 seconds, fetches current prices from the Massive.com REST API (which is already cached in Redis), and triggers notifications via Supabase database inserts. If alert volume exceeds 1,000 concurrent alerts, we can migrate to BullMQ as a future optimization.

#### Sentry over Datadog

Sentry is chosen for error monitoring because: (a) it has a generous free tier (5K errors/month) suitable for launch; (b) the @sentry/node SDK integrates with Express in under 10 lines; (c) source maps upload integrates with the existing build pipeline; (d) Sentry captures both backend errors and frontend React errors with a single platform.

---

## 3. Work Package 1: Streaming AI Responses (SSE)

### 3.1 Problem Statement

Currently, the `POST /api/chat/message` endpoint calls OpenAI with a blocking request, waits for the complete response (including all function call loops), and returns the entire payload at once. For complex queries that trigger multiple function calls, this creates 3–10 second delays where the user sees no feedback. This is the single most impactful UX gap.

### 3.2 Target Architecture

The endpoint will support two response modes based on the Accept header, maintaining full backward compatibility:

- **`Accept: text/event-stream`** → SSE stream with chunked tokens, function call progress, and final message
- **`Accept: application/json` (default)** → Current blocking behavior, unchanged. Existing clients continue to work.

### 3.3 SSE Event Protocol

The streaming endpoint emits the following event types:

| Event Type | Data Shape | Purpose |
|---|---|---|
| `stream_start` | `{ sessionId, messageId }` | Emitted once at connection. Client uses messageId to associate streamed chunks. |
| `token` | `{ content: "partial text" }` | Individual token or small chunk from OpenAI. Client appends to message bubble in real-time. |
| `function_call_start` | `{ name, arguments }` | AI is calling a function. Client shows "Analyzing key levels..." spinner. |
| `function_call_result` | `{ name, result, widget? }` | Function completed. If widget data present, client renders card immediately. |
| `message_complete` | `{ message, functionCalls }` | Final assembled message with all function results. Client reconciles streamed content. |
| `error` | `{ code, message }` | Error occurred. Client shows error state. Stream closes. |
| `stream_end` | `{}` | Clean stream termination signal. |

### 3.4 Backend Implementation

#### 3.4.1 Changes to `backend/src/chatkit/chatService.ts`

A new function `sendChatMessageStreaming` will be added alongside the existing `sendChatMessage`. Both will share the same session management, conversation history loading, and function execution logic via extracted helper functions.

```typescript
// New export in chatService.ts
export async function sendChatMessageStreaming(
  res: Response,           // Express response for SSE
  userId: string,
  message: string,
  sessionId?: string
): Promise<void>
```

Key implementation details:

- Call OpenAI with `stream: true`. The openai SDK returns an AsyncIterable of ChatCompletionChunk objects.
- Iterate chunks: accumulate content deltas, detect tool_calls in progress, and emit SSE events for each chunk.
- When a function call is fully accumulated, emit `function_call_start`, execute the handler (reusing existing `executeFunctionCall`), emit `function_call_result`, then re-call OpenAI with the function result appended to messages.
- The circuit breaker wraps each OpenAI call, but the streaming variant catches errors and emits an `error` SSE event rather than throwing.
- Message persistence happens in `message_complete`: save the final assembled assistant message and any function call results to Supabase, identical to the non-streaming path.

#### 3.4.2 Changes to `backend/src/routes/chat.ts`

The existing `POST /api/chat/message` route handler will check the Accept header:

```typescript
if (req.headers.accept === "text/event-stream") {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  await sendChatMessageStreaming(res, userId, message, sessionId);
} else {
  // existing blocking path unchanged
}
```

### 3.5 Frontend Implementation

#### 3.5.1 Changes to `lib/api/ai-coach.ts`

A new `sendMessageStreaming` function will use the native EventSource API or a fetch-based SSE reader (since EventSource does not support POST). The recommended approach is fetch with ReadableStream:

```typescript
const response = await enhancedFetch(`${BASE}/api/chat/message`, {
  method: "POST",
  headers: { Accept: "text/event-stream", ... },
  body: JSON.stringify({ message, sessionId })
});
const reader = response.body.getReader();
const decoder = new TextDecoder();
// Parse SSE events from chunks, yield to callback
```

#### 3.5.2 Changes to `hooks/use-ai-coach-chat.ts`

The `sendMessage` function will switch to the streaming API. A new state field `streamingContent: string` tracks the in-progress text for the current response. The UI renders this in the message bubble with a blinking cursor indicator. When `message_complete` arrives, the streamed content is replaced with the final canonical message.

#### 3.5.3 Changes to `components/ai-coach/message-bubble.tsx`

Add support for a "streaming" message type that renders partial content with a typing indicator. Widget cards appear immediately when `function_call_result` events arrive, even before the text response is complete.

### 3.6 Testing

- Unit test: Mock OpenAI streaming response, verify correct SSE events emitted in order.
- Unit test: Verify function_call_start/result events during multi-tool conversations.
- Unit test: Verify error event emitted when OpenAI call fails mid-stream.
- Integration test: Full POST with `Accept: text/event-stream`, verify chunked response headers and parseable SSE body.
- Frontend test: Verify message bubble updates progressively during streaming.
- Regression test: Verify `Accept: application/json` path is completely unchanged.

### 3.7 Acceptance Criteria

1. First token appears within 500ms of sending a message.
2. Function call progress (e.g., "Checking key levels...") shown within 200ms of AI deciding to call a function.
3. Widget cards render immediately when function results return, not waiting for text completion.
4. Non-streaming clients (`Accept: application/json`) work identically to today.
5. AbortController cancellation terminates the SSE stream and OpenAI request.

---

## 4. Work Package 2: Screenshot-to-Chat Pipeline

### 4.1 Problem Statement

The screenshot analysis system works end-to-end as a standalone feature: the user uploads an image, OpenAI Vision extracts positions with confidence scores, and the frontend displays them. However, the extracted positions are not fed back into the AI chat conversation. The user cannot ask follow-up questions like "What is my portfolio delta?" or "Should I close the losing positions?" because the AI has no awareness of the screenshot results.

### 4.2 Target Flow

1. User uploads a screenshot via the `screenshot-upload.tsx` component in the center panel.
2. Frontend calls `POST /api/screenshot/analyze` (existing endpoint). Receives `ExtractedPosition[]` with confidence scores.
3. Frontend shows the confirmation dialog (existing UI). User reviews and confirms/adjusts positions.
4. **NEW:** On confirmation, frontend sends a chat message with the confirmed positions as structured context, e.g., "I just uploaded a screenshot with these positions: [structured JSON]. Please analyze my portfolio."
5. **NEW:** Backend injects the positions into the system prompt context for the session so subsequent messages can reference them.
6. **NEW:** AI responds with portfolio analysis using the `analyze_position` function on the extracted data.

### 4.3 Backend Changes

#### 4.3.1 New Endpoint: `POST /api/chat/screenshot-context`

This endpoint saves confirmed screenshot positions to the session context. It is called by the frontend after the user confirms extracted positions.

```
POST /api/chat/screenshot-context
Body: { sessionId: string, positions: ExtractedPosition[] }
Response: { message: AssistantMessage }
```

Implementation: The endpoint inserts a system-level message into the session's conversation history containing the confirmed positions as structured data. It then immediately triggers a `sendChatMessage` call with an auto-generated user message asking the AI to analyze the portfolio, so the user sees an immediate analysis response.

#### 4.3.2 Changes to `backend/src/chatkit/chatService.ts`

Add a helper function `injectScreenshotContext` that appends a system message with the position data to the conversation history for the session. The system prompt already instructs the AI to use `analyze_position` when it sees position data—this change simply makes the data available in the conversation.

### 4.4 Frontend Changes

#### 4.4.1 Changes to `components/ai-coach/screenshot-upload.tsx`

The `onPositionsConfirmed` callback currently does nothing with the confirmed data. Wire it to:

1. Call the new `POST /api/chat/screenshot-context` endpoint with the confirmed positions.
2. Switch the center panel to the chat tab so the user sees the AI's analysis response.
3. Show a toast notification: "Positions sent to AI Coach for analysis."

### 4.5 Testing

- Integration test: Upload screenshot, confirm positions, verify AI receives position context and responds with analysis.
- Unit test: Verify `injectScreenshotContext` correctly formats positions into conversation history.
- E2E test (Playwright): Full flow from screenshot upload to AI portfolio analysis response.

### 4.6 Acceptance Criteria

1. After confirming screenshot positions, the AI automatically responds with portfolio analysis.
2. Follow-up questions like "What is my total delta?" work correctly because the AI has position context.
3. Positions persist in the session—reloading the page and continuing the conversation retains awareness of the uploaded positions.

---

## 5. Work Package 3: Alert Monitoring Worker

### 5.1 Problem Statement

Users can create price alerts via the AI or the alerts panel, but alerts are stored as static database records. No background process monitors current prices against alert conditions. Alerts never trigger.

### 5.2 Design

#### 5.2.1 Worker Architecture

An in-process worker runs inside the Express server as a setInterval loop with a 30-second cadence. Each tick:

1. Query all active alerts from `ai_coach_alerts` where `status = 'active'`, grouped by unique symbol.
2. For each unique symbol, fetch the current price from the Massive.com API (leveraging the existing Redis cache with 60-second TTL).
3. Compare each alert's `target_price` and `condition` (above/below/crosses) against the current price.
4. For triggered alerts: update `status` to `'triggered'`, set `triggered_at` timestamp, and insert a notification record.
5. Emit a Supabase database insert into a new `ai_coach_notifications` table so the frontend can display alerts.

#### 5.2.2 New Database Table

```sql
CREATE TABLE ai_coach_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  alert_id UUID REFERENCES ai_coach_alerts(id),
  type TEXT NOT NULL DEFAULT 'alert_triggered',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 5.2.3 Frontend Notification Display

The frontend polls `GET /api/notifications?unread=true` every 60 seconds (or uses Supabase Realtime subscription on the notifications table). Notifications appear as a badge on the alerts tab and as toast messages. Clicking a notification navigates to the alerts panel with the triggered alert highlighted.

#### 5.2.4 Market Hours Awareness

The worker skips price checks outside market hours using the existing `getMarketStatus()` function from `services/marketHours.ts`. During pre-market and after-hours, the worker checks at reduced frequency (every 2 minutes) since price movement is lower.

### 5.3 Health Check Integration

The `/health/ready` endpoint will report the alert worker's status: last tick time, number of active alerts being monitored, and any errors from the last cycle. This integrates with the existing `HealthCheck` interface in `routes/health.ts`.

### 5.4 Testing

- Unit test: Worker correctly triggers alert when price crosses threshold.
- Unit test: Worker skips alerts outside market hours.
- Unit test: Worker handles Massive.com API failure gracefully (logs error, retries next tick).
- Integration test: Create alert via API, mock price data, verify notification created in database.

### 5.5 Acceptance Criteria

1. Active alerts trigger within 60 seconds of price meeting the condition during market hours.
2. Triggered alerts update status and create notification records.
3. Frontend displays notification badge and toast when an alert triggers.
4. Worker reports health status on `/health/ready` endpoint.
5. Worker gracefully handles API failures without crashing or blocking other alerts.

---

## 6. Work Package 4: User Profile & Preferences API

### 6.1 Problem Statement

The AI Coach has no endpoint for storing or retrieving user preferences. The system prompt's user context validation (experience level, preferred symbols, notification settings) has no backing API. Every user gets identical behavior regardless of their trading style or experience.

### 6.2 API Design

#### 6.2.1 `GET /api/user/profile`

Returns the authenticated user's AI Coach profile. Creates a default profile on first access if none exists (upsert pattern matching the existing session creation approach).

```typescript
Response: {
  userId: string,
  displayName: string,
  experienceLevel: "beginner" | "intermediate" | "advanced",
  preferredSymbols: string[],     // e.g., ["SPX", "NDX"]
  defaultTimeframe: string,        // e.g., "5m"
  notificationPrefs: {
    alertsEnabled: boolean,
    emailAlerts: boolean,
    browserNotifications: boolean
  },
  tradingStyle: "day" | "swing" | "leaps" | "mixed",
  queriesUsedThisMonth: number,
  createdAt: string,
  updatedAt: string
}
```

#### 6.2.2 `PATCH /api/user/profile`

Partial update of any profile fields. Validated with Zod schema. Returns the updated profile.

### 6.3 Integration with System Prompt

The chatService will fetch the user's profile at the start of each conversation and inject relevant fields into the system prompt context. The existing `getSystemPrompt()` function already accepts user context parameters—this change simply provides real data instead of defaults. For example, if a user sets `experienceLevel: "advanced"`, the AI will skip basic explanations of Greeks and focus on nuanced analysis.

### 6.4 Database

The `ai_coach_users` table already exists with `query_count` and `tier` fields from the original migration. This work package adds columns: `experience_level`, `preferred_symbols` (JSONB), `default_timeframe`, `notification_prefs` (JSONB), and `trading_style`. A new migration file will be created.

### 6.5 Testing

- Unit test: GET returns default profile for new user.
- Unit test: PATCH updates fields and returns updated profile.
- Unit test: PATCH rejects invalid experience levels.
- Integration test: Profile data flows into system prompt and affects AI response style.

---

## 7. Work Package 5: Error Monitoring (Sentry)

### 7.1 Problem Statement

The application uses Winston for structured logging to stdout, which is visible in Railway logs. However, there is no error aggregation, alerting, or stack trace analysis. Production errors in the OpenAI integration, Massive.com API, or database queries would require manually searching Railway logs—an unacceptable workflow for a paid product.

### 7.2 Implementation

#### 7.2.1 Backend: `@sentry/node`

Install `@sentry/node` and initialize in `server.ts` before any other middleware. The Sentry Express integration automatically captures:

- Unhandled exceptions and rejections
- Express route errors (via the Sentry error handler middleware)
- Performance traces for all API endpoints
- Breadcrumbs from console.log, HTTP requests, and database queries

Additional manual instrumentation:

- **Circuit breaker events:** When the OpenAI circuit breaker opens, capture a Sentry event with context about the failure pattern.
- **Rate limit events:** When a user hits rate limits, log to Sentry as a warning (not error) with user context.
- **Request ID correlation:** Attach the existing requestId from the requestIdMiddleware as a Sentry tag for cross-referencing.

#### 7.2.2 Frontend: `@sentry/react`

Install `@sentry/react` and wrap the application with `Sentry.ErrorBoundary`. The existing `error-boundary.tsx` component will integrate with Sentry's error reporting. React component errors, network failures, and unhandled promise rejections will be automatically captured.

#### 7.2.3 Source Maps

Configure the build pipeline to upload source maps to Sentry so stack traces point to original TypeScript source, not compiled JavaScript. For the backend (tsc), use `@sentry/cli`. For the frontend (Next.js), use `@sentry/nextjs` which handles this automatically.

### 7.3 Environment Configuration

```bash
# Add to .env
SENTRY_DSN=https://<key>@sentry.io/<project>
SENTRY_ENVIRONMENT=production|staging
SENTRY_TRACES_SAMPLE_RATE=0.2  # 20% of transactions
```

### 7.4 Acceptance Criteria

- Backend errors appear in Sentry dashboard within 30 seconds.
- Frontend React errors appear with component stack traces.
- Source maps resolve to TypeScript source.
- Circuit breaker open/close events are tracked.

---

## 8. Work Package 6: Frontend Polish & Integration Testing

### 8.1 Scope

This work package addresses frontend integration gaps and polish items that span multiple features. It is intentionally scheduled last because it depends on WP1–5 being complete.

### 8.2 Items

#### 8.2.1 Loading States

Audit every async operation in the AI Coach UI and ensure proper loading indicators exist. Key areas: chat message send (streaming cursor from WP1), screenshot upload progress bar, alert creation spinner, trade journal save indicator.

#### 8.2.2 Error States

Audit every API call and ensure error boundaries + user-friendly error messages exist for: network failures, 429 rate limit with retry countdown, 503 service unavailable with circuit breaker context, 401 session expired with re-auth prompt.

#### 8.2.3 Mobile Responsiveness

The AI Coach page uses resizable panels (desktop) and a toggle view (mobile). Verify all center panel tabs render correctly on mobile viewport sizes (375px, 414px). Key issues to check: chart canvas sizing, options chain table horizontal scroll, screenshot upload camera integration.

#### 8.2.4 Keyboard Shortcuts

Add keyboard shortcuts for power users: Enter to send message (existing), Cmd+K to start new session, Cmd+/ to toggle center panel, Escape to cancel current request (triggers AbortController).

### 8.3 Integration Tests (Playwright)

Add E2E test specs covering the complete AI Coach user journey. These tests complement the existing 11 Playwright specs by adding AI-Coach-specific flows:

- `ai-coach-chat.spec.ts`: Send message, receive response, verify card widget rendered.
- `ai-coach-screenshot.spec.ts`: Upload image, confirm positions, verify AI analysis response.
- `ai-coach-alerts.spec.ts`: Create alert, verify appears in alerts panel.
- `ai-coach-journal.spec.ts`: Create trade entry, verify in journal, ask AI about trade history.
- `ai-coach-streaming.spec.ts`: Verify progressive token rendering during streaming response.

---

## 9. Implementation Schedule & Dependency Graph

### 9.1 Dependency Order

Work packages have the following dependencies:

- **WP5 (Sentry) has zero dependencies** and should be completed first so all subsequent work is monitored.
- **WP1 (Streaming) and WP4 (User Profile) are independent** and can be developed in parallel after WP5.
- **WP2 (Screenshots) depends on WP1** because the screenshot analysis auto-response should stream.
- **WP3 (Alerts) is independent** but benefits from WP5 being in place for error monitoring.
- **WP6 (Polish) depends on WP1–5** and must be done last.

### 9.2 Gantt Schedule (3.5 Week Sprint)

| Timeline | Work Package | Notes |
|---|---|---|
| Week 1, Days 1–2 | WP5: Sentry Integration | Observability foundation for everything that follows. |
| Week 1, Days 2–5 | WP4: User Profile API | Parallel with WP1. Small, self-contained. |
| Week 1, Day 3 – Week 2, Day 2 | WP1: Streaming (Backend) | SSE endpoint, OpenAI streaming, circuit breaker integration. |
| Week 2, Days 2–4 | WP1: Streaming (Frontend) | SSE reader, progressive message rendering, AbortController. |
| Week 2, Day 4 – Week 3, Day 1 | WP2: Screenshot Pipeline | Leverage streaming from WP1 for auto-analysis response. |
| Week 2, Day 4 – Week 3, Day 2 | WP3: Alert Worker | Parallel with WP2. Backend-only. |
| Week 3, Days 2–5 | WP6: Frontend Polish + E2E | Final integration, mobile polish, Playwright tests. |
| Week 4, Day 1 | Release Candidate | Full regression, staging deployment, smoke tests. |

---

## 10. Testing Strategy

### 10.1 Test Pyramid

The testing approach follows a practical pyramid weighted toward integration tests, which provide the best coverage-to-effort ratio for an API-centric application:

| Layer | Count | Framework | Coverage |
|---|---|---|---|
| Unit Tests | ~30 new | Jest | Individual functions: streaming chunk parser, alert condition matcher, profile validation, SSE event formatter. |
| Integration Tests | ~15 new | Jest + Supertest | Full API endpoint tests with mocked external services (OpenAI, Massive.com). Verify request/response contracts. |
| E2E Tests | ~5 new | Playwright | Complete user flows: send message with streaming, upload screenshot, create and trigger alert. |
| Existing Tests | 373 passing | Jest | Maintain green. All new code must not break existing suite. |

### 10.2 Mock Strategy

External services are mocked at the HTTP boundary using nock (for REST APIs) and custom stream mocks (for OpenAI streaming). The mock fixtures live in `backend/src/__tests__/fixtures/` and represent real API responses captured during development. This ensures tests validate against actual API shapes without requiring API keys or network access in CI.

### 10.3 CI Pipeline

Every pull request runs: TypeScript compilation (`tsc --noEmit`), ESLint, Jest unit + integration tests, and Playwright E2E tests against a local Next.js dev server. The pipeline blocks merge on any failure. Test results are reported to the PR as GitHub check annotations.

---

## 11. Deployment & Rollback Plan

### 11.1 Deployment Strategy

Each work package is deployed independently via the existing Railway CI/CD pipeline. The deployment order matches the dependency graph from Section 9. Each deployment follows this checklist:

1. Merge PR to main after CI passes.
2. Railway auto-deploys the backend service.
3. Verify `/health` and `/health/ready` endpoints return healthy status.
4. Run a manual smoke test for the feature (documented per WP).
5. Monitor Sentry for 30 minutes for any new errors.
6. If errors spike, execute rollback (see 11.2).

### 11.2 Rollback Procedure

Railway supports instant rollback to any previous deployment. The rollback procedure is:

1. In the Railway dashboard, select the backend service.
2. Navigate to Deployments, find the previous stable deployment.
3. Click "Redeploy" to restore the previous version.
4. If the deployment included a database migration, run the corresponding down migration via Supabase dashboard.

### 11.3 Feature Flags

For WP1 (Streaming), the Accept header acts as a natural feature flag—non-streaming clients are unaffected. For WP3 (Alert Worker), an environment variable `ALERT_WORKER_ENABLED=true/false` controls whether the worker starts. This allows deploying the code without activating the worker, useful for staged rollout.

---

## 12. Risk Register

| ID | Risk | Prob. | Impact | Mitigation |
|---|---|---|---|---|
| R1 | OpenAI streaming API changes behavior | LOW | HIGH | Pin openai SDK version. Integration tests validate stream format. Fallback to non-streaming on parse errors. |
| R2 | SSE connection drops on Railway (proxy timeout) | MEDIUM | MEDIUM | Set keep-alive headers, send heartbeat events every 15s. Frontend auto-reconnects with last event ID. |
| R3 | Alert worker creates too many Massive.com API calls | MEDIUM | LOW | Batch alerts by symbol (1 API call per unique symbol, not per alert). Redis cache limits actual API calls. |
| R4 | Sentry free tier insufficient | LOW | LOW | Free tier: 5K errors + 10K transactions/month. At 100 users with 20 messages/day, this is ~60K transactions. May need paid plan ($26/mo) at scale. |
| R5 | Screenshot Vision API cost spike | MEDIUM | MEDIUM | Monitor per-user screenshot count. Already capped at 5/day in the Vision handler. Add cost tracking to user profile. |
| R6 | Database migration conflicts with production data | LOW | HIGH | All migrations are additive (new columns, new tables). No column drops or renames. Test on Supabase branch before production. |

---

## 13. Acceptance Criteria & Definition of Done

### 13.1 Global Definition of Done

Every work package is considered complete when ALL of the following are true:

1. All acceptance criteria for the WP (defined in Sections 3–8) are met.
2. TypeScript compiles with zero errors (`tsc --noEmit`).
3. All existing 373 tests pass with no regressions.
4. New tests written and passing for the WP's functionality.
5. PR reviewed and merged to main.
6. Successfully deployed to Railway with healthy `/health` endpoint.
7. Sentry confirms no new unhandled errors for 30 minutes post-deploy.
8. Manual smoke test completed using the documented test plan.

### 13.2 Launch Readiness Checklist

After all six work packages are complete, the following must be verified before opening AI Coach to users:

- **End-to-end flow:** Send message → streaming response with card widgets → follow-up question about displayed data.
- **Screenshot flow:** Upload screenshot → confirm positions → AI analyzes portfolio → ask "what is my delta?"
- **Alert flow:** Create alert via chat ("alert me when SPX hits 6000") → alert triggers → notification appears.
- **Journal flow:** Log a trade → ask AI "analyze my last 10 trades" → AI provides data-driven analysis.
- **Observability:** Sentry dashboard shows zero unhandled errors. `/health/ready` returns all checks passing.
- **Performance:** First streaming token under 500ms. Non-chat API responses under 1 second (p95).

---

*End of Specification*
