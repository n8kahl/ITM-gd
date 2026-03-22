# Integration Runbook — TradeITM Platform

> **Last Updated:** 2026-03-22
> **Phase:** 5.6 — Platform Integration Hardening
> **Audience:** Operators, on-call engineers, orchestrator agents

---

## 1. Purpose

This runbook covers operational procedures for all external service integrations in the TradeITM platform: API key rotation, circuit breaker tuning, Discord bot restart, edge function redeployment, dead letter queue processing, and incident response.

---

## 2. Service Inventory

| Service | Purpose | Auth Method | Env Var | Circuit Breaker |
|---------|---------|-------------|---------|-----------------|
| **Massive.com** | Market data (options, stocks, indices) | Bearer token | `MASSIVE_API_KEY` | `massiveCircuit` |
| **OpenAI** | AI Coach LLM backend | API key (`sk-*`) | `OPENAI_API_KEY` | `openaiCircuit` |
| **FRED** | Macroeconomic indicators | Query param | `FRED_API_KEY` | `fredCircuit` |
| **FMP** | Financial modeling / earnings | Query param | `FMP_API_KEY` | `fmpCircuit` |
| **Supabase** | Database, auth, realtime, storage | Service role key | `SUPABASE_SERVICE_ROLE_KEY` | None |
| **Redis** | Caching, rate limiting, tick lock | URL auth | `REDIS_URL` | Exponential backoff |
| **Discord** | Community notifications | Bot token / webhook | `DISCORD_BOT_TOKEN` | None |

---

## 3. Circuit Breaker Configuration

All circuit breakers are defined in `backend/src/lib/circuitBreaker.ts` and registered in `circuitBreakerRegistry`.

| Circuit | Failure Threshold | Cooldown | Call Timeout | Key |
|---------|-------------------|----------|-------------|-----|
| OpenAI | 3 failures | 30s | 60s | `openai` |
| Massive.com | 3 failures | 30s | 15s | `massive` |
| FRED | 3 failures | 30s | 15s | `fred` |
| FMP | 3 failures | 30s | 15s | `fmp` |

### State Machine

```
CLOSED  ──(N failures)──>  OPEN  ──(cooldown elapsed)──>  HALF_OPEN
  ^                                                          │
  └──────────(success)───────────────────────────────────────┘
  └──────────(failure)──────────> OPEN (reset cooldown)
```

### Monitoring Circuit States

**Admin UI:** `/admin/system` — each service card shows circuit state badge (CLOSED/OPEN/HALF_OPEN).

**Backend API:** `GET /api/health/circuits`
```json
{
  "circuits": {
    "openai": { "state": "CLOSED", "failureCount": 0 },
    "massive": { "state": "CLOSED", "failureCount": 0 },
    "fred": { "state": "CLOSED", "failureCount": 0 },
    "fmp": { "state": "CLOSED", "failureCount": 0 }
  }
}
```

### Manual Circuit Reset

If a circuit is stuck OPEN after an upstream recovery, reset via backend:
```bash
# Connect to backend container/process
curl -X POST http://localhost:3001/api/health/circuits/reset -H "Content-Type: application/json" -d '{"circuit": "openai"}'
```

Or restart the backend process (all circuits reset to CLOSED on startup).

### Tuning Circuit Breakers

Edit `backend/src/lib/circuitBreaker.ts`. Suggested adjustments:

| Scenario | Change |
|----------|--------|
| Frequent false-positive OPEN | Increase `failureThreshold` to 5 |
| Slow upstream recovery | Increase `cooldownMs` to 60000 |
| Timeout-sensitive calls | Decrease `timeoutMs` |
| Non-critical service (FRED/FMP) | Increase `failureThreshold` to 10 |

---

## 4. API Key Rotation

### General Procedure

1. Generate new key in the provider's dashboard.
2. Update the environment variable in the deployment platform.
3. Restart the backend process (keys are read at startup).
4. Verify via admin health dashboard (`/admin/system`).
5. Revoke the old key in the provider's dashboard.

### Provider-Specific Notes

**Massive.com (`MASSIVE_API_KEY`)**
- API base: `https://api.massive.com`
- Auth: Bearer token in `Authorization` header
- Rate limit: 10 req/s, burst 50
- Verification: `GET /api/health/test-massive` on backend

**OpenAI (`OPENAI_API_KEY`)**
- Key format: starts with `sk-`
- Also stored in Supabase `app_settings` table (key: `openai_api_key`) for frontend config checks
- Verification: `GET /api/health/diagnose` — checks `openai_completion`

**FRED (`FRED_API_KEY`)**
- Free tier, no rate limit documented
- Auth: query parameter `api_key`
- Feature toggle: `FRED_ENABLED=true` required
- Verification: health dashboard shows "FRED API is reachable"

**FMP (`FMP_API_KEY`)**
- Free tier: 250 calls/day (warning at 200)
- Auth: query parameter `apikey`
- Feature toggle: `FMP_ENABLED=true` required
- Verification: health dashboard shows "FMP API is reachable"

**Supabase (`SUPABASE_SERVICE_ROLE_KEY`)**
- Rotate in Supabase dashboard > Settings > API
- Update both backend (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) and frontend (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Restart both frontend and backend

**Redis (`REDIS_URL`)**
- Format: `redis://[:password@]host:port`
- Optional — app degrades gracefully without Redis
- Reconnect strategy: exponential backoff, max 10 retries, max 3s delay

---

## 5. Massive.com WebSocket — Single-Process Constraint

**Critical:** Only ONE backend instance may hold the upstream Massive WebSocket connection at any time.

### Configuration

| Env Var | Default | Purpose |
|---------|---------|---------|
| `MASSIVE_TICK_WS_ENABLED` | `false` | Enable WebSocket tick stream |
| `MASSIVE_TICK_LOCK_ENABLED` | `false` | Enable Redis advisory lock for single-owner |
| `MASSIVE_TICK_WS_URL` | `wss://socket.massive.com/indices` | WebSocket endpoint |
| `MASSIVE_TICK_SYMBOLS` | `SPX,SPY,VIX,VIX9D,VVIX,SKEW` | Subscribed symbols |
| `MASSIVE_TICK_RECONNECT_BASE_MS` | `1000` | Base reconnect delay |
| `MASSIVE_TICK_RECONNECT_MAX_MS` | `30000` | Max reconnect delay |
| `MASSIVE_TICK_STALE_MS` | `5000` | Tick staleness threshold |

### Horizontal Scaling

When running multiple backend instances:

1. Set `MASSIVE_TICK_LOCK_ENABLED=true` on all instances.
2. Redis advisory lock key: `massive:tick:stream:lock` (TTL: 60s).
3. Lock holder opens upstream WebSocket and fans out ticks.
4. Non-holders remain poll-only (use REST aggregates).
5. On holder crash, lock expires and another instance acquires it.

### Reconnection Behavior

- Auth ACK timeout: 5s
- Subscribe ACK timeout: 3s
- Heartbeat interval: 30s
- Connect timeout: 15s
- Reconnect jitter: 0.7x–1.3x base delay
- Max connections reconnect: 60s (Massive `max_connections` close code)

### Troubleshooting Stale Ticks

1. Check `/api/health/ready` — look at `massive_tick_stream` status.
2. If `connected but stale ticks`: market may be closed, or upstream is lagging.
3. If `enabled but disconnected`: check `MASSIVE_API_KEY`, network, Redis lock.
4. Restart the backend process to force reconnection.

---

## 6. Discord Bot Operations

### Configuration

| Env Var | Purpose |
|---------|---------|
| `DISCORD_BOT_ENABLED` | Master toggle (default: `false`) |
| `DISCORD_BOT_TOKEN` | Bot authentication token |
| `DISCORD_BOT_GUILD_IDS` | CSV of guild IDs to operate in |
| `DISCORD_BOT_CHANNEL_IDS` | CSV of channel IDs for notifications |
| `WORKER_ALERTS_DISCORD_WEBHOOK_URL` | Webhook URL for worker health alerts |

### Restart Procedure

1. Set `DISCORD_BOT_ENABLED=false` in env.
2. Restart backend process.
3. Verify bot goes offline in Discord server.
4. Update `DISCORD_BOT_TOKEN` if rotating.
5. Set `DISCORD_BOT_ENABLED=true`.
6. Restart backend process.
7. Verify bot comes online and responds in configured channels.

### Worker Health Alerts

- Poll interval: 60s (`WORKER_ALERTS_POLL_INTERVAL_MS`)
- Stale threshold: 20 minutes (`WORKER_ALERTS_STALE_THRESHOLD_MS`)
- Startup grace: 5 minutes (`WORKER_ALERTS_STARTUP_GRACE_MS`)
- Alert cooldown: 15 minutes (`WORKER_ALERTS_COOLDOWN_MS`)
- Message limit: 2000 characters (auto-truncated)

---

## 7. Edge Function Operations

### Deployed Functions (11)

| Function | Purpose |
|----------|---------|
| `aggregate-chat-analytics` | Aggregate chat usage metrics |
| `analyze-trade-screenshot` | AI analysis of trade screenshots |
| `chat-visitor-sync` | Sync chat visitors with user records |
| `compute-leaderboards` | Calculate trading leaderboards |
| `create-team-member` | Provision new team members |
| `cron-archive-conversations` | Archive old AI Coach conversations |
| `handle-chat-message` | Process inbound chat messages |
| `notify-team-lead` | Send team lead notifications |
| `send-chat-transcript` | Email chat transcripts |
| `send-push-notification` | Send push notifications |
| `sync-discord-roles` | Sync Discord roles with membership |

### Redeployment

```bash
# Deploy a single function
npx supabase functions deploy <function-name>

# Deploy all functions
npx supabase functions deploy
```

### Monitoring

**Admin UI:** `/admin/system` — Edge Function Monitoring table shows:
- Total invocations (last 24h)
- Error count and error rate
- Average and P95 execution time
- Last invocation timestamp

**API:** `GET /api/admin/system/edge-functions?hours=24`

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error rate | > 5% | > 10% |
| P95 execution time | > 5000ms | > 10000ms |
| No invocations (expected active) | > 1 hour | > 4 hours |

### Logging

Edge functions log to `edge_function_logs` table:
- `function_name`, `status` (success/error), `execution_time_ms`, `error_message`, `invoked_at`
- Indexed on `(function_name, invoked_at)` and `(status, invoked_at)`

---

## 8. Dead Letter Queue (DLQ) Processing

### Overview

Failed events (webhook retries, sync failures, API errors) are captured in the `dead_letter_queue` table for manual review and retry.

### Schema

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `event_type` | text | Event category (e.g., `webhook_retry`, `discord_sync_failed`) |
| `payload` | JSONB | Original event data |
| `error_message` | text | Error description |
| `source` | text | Which service created the entry |
| `created_at` | timestamptz | When the failure occurred |
| `retried_at` | timestamptz | Last retry attempt |
| `retry_count` | integer | Number of retry attempts |
| `resolved` | boolean | Whether the entry is resolved |

### Admin Operations

**Admin UI:** `/admin/system` — Dead Letter Queue panel.

**API:**
- `GET /api/admin/system/dlq` — List unresolved entries
- `GET /api/admin/system/dlq?showResolved=true` — Include resolved entries
- `POST /api/admin/system/dlq` — Retry or dismiss entries

```json
// Retry entries
{ "action": "retry", "ids": ["uuid-1", "uuid-2"] }

// Dismiss entries
{ "action": "dismiss", "ids": ["uuid-1", "uuid-2"] }
```

### Processing Procedure

1. Review unresolved entries in admin UI.
2. For transient errors (timeouts, rate limits): click **Retry**.
3. For permanent errors (invalid payload, missing resource): click **Dismiss**.
4. If entries accumulate: investigate the root cause in the `source` service.
5. Bulk dismiss resolved entries periodically to keep the queue clean.

---

## 9. Rate Limiting

| Endpoint Category | Limit | Env Var |
|-------------------|-------|---------|
| General API | 100 req/window | `RATE_LIMIT_GENERAL` |
| Chat API | 20 req/window | `RATE_LIMIT_CHAT` |
| Screenshot API | 5 req/window | `RATE_LIMIT_SCREENSHOT` |

Rate limiting requires Redis. Without Redis, rate limiting is disabled (fail-open).

---

## 10. Health Check Endpoints

### Backend

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | None | Liveness probe (always 200) |
| `GET /api/health/ready` | None | Readiness probe (DB, Redis, Massive, OpenAI, Tradier, tick stream) |
| `GET /api/health/detailed` | None | Ready + service breakdown |
| `GET /api/health/circuits` | None | Circuit breaker states |
| `GET /api/health/workers` | None | Worker health + staleness |
| `GET /api/health/ws` | Token | WebSocket connection health |
| `GET /api/health/diagnose` | None | Deep diagnostic (DB tables, OpenAI completion, Redis, Massive) |
| `GET /api/health/test-massive` | None | Massive.com API endpoint tests |

### Frontend

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/admin/system` | Admin | All 9 service diagnostics + circuit states |
| `GET /api/admin/system/edge-functions` | Admin | Edge function execution metrics |
| `GET /api/admin/system/dlq` | Admin | Dead letter queue entries |

---

## 11. Incident Response

### Service Down: Massive.com

1. Check circuit state: `GET /api/health/circuits` — if `massive` is OPEN, wait for cooldown.
2. Verify API key: `GET /api/health/test-massive`.
3. Check Massive.com status page.
4. If prolonged outage: SPX Command Center degrades to stale data. No user action required.
5. On recovery: circuit auto-resets via HALF_OPEN test request.

### Service Down: OpenAI

1. Check circuit state — if `openai` is OPEN, AI Coach returns error messages.
2. Verify API key and quota in OpenAI dashboard.
3. If prolonged: AI Coach shows "temporarily unavailable" message.
4. On recovery: circuit auto-resets.

### Service Down: Supabase

1. **Critical** — affects auth, data, realtime, storage.
2. Check Supabase status page.
3. Backend health endpoint returns `unhealthy`.
4. No fallback — application is degraded until Supabase recovers.

### Service Down: Redis

1. Application degrades gracefully — cache misses, rate limiting disabled.
2. Massive tick lock unavailable — all instances fall back to poll-only.
3. Check `REDIS_URL` and Redis server status.
4. Auto-reconnects with exponential backoff (max 10 retries).

### High DLQ Volume

1. Check `/admin/system` DLQ panel for patterns (same `event_type`, same `source`).
2. If webhook retries: check upstream webhook endpoint availability.
3. If Discord sync failures: check `DISCORD_BOT_TOKEN` and rate limits.
4. Address root cause, then retry or dismiss entries in bulk.

---

## 12. Environment Variable Checklist

### Required (Production)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Massive.com
MASSIVE_API_KEY=
```

### Optional (Feature Toggles)

```bash
# Market data services
FRED_API_KEY=
FRED_ENABLED=false
FMP_API_KEY=
FMP_ENABLED=false

# Redis
REDIS_URL=

# Discord
DISCORD_BOT_ENABLED=false
DISCORD_BOT_TOKEN=
DISCORD_BOT_GUILD_IDS=
WORKER_ALERTS_DISCORD_WEBHOOK_URL=

# Massive WebSocket
MASSIVE_TICK_WS_ENABLED=false
MASSIVE_TICK_LOCK_ENABLED=false

# Monitoring
SENTRY_DSN=
LOG_LEVEL=info
```

---

## 13. Validation Commands

```bash
# Backend health (liveness)
curl -s http://localhost:3001/api/health | jq .status

# Backend readiness (all services)
curl -s http://localhost:3001/api/health/ready | jq .

# Circuit breaker states
curl -s http://localhost:3001/api/health/circuits | jq .

# Deep diagnostic
curl -s http://localhost:3001/api/health/diagnose | jq .summary

# Massive.com API tests
curl -s http://localhost:3001/api/health/test-massive | jq .summary

# Worker health
curl -s http://localhost:3001/api/health/workers | jq .summary

# Edge function deployment check
npx supabase functions list
```
