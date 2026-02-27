# WebSocket Architecture Hardening — Execution Spec

| Field | Value |
|-------|-------|
| **Date** | 2026-02-27 |
| **Status** | PROPOSED |
| **Owner** | Orchestrator Agent |
| **Stakeholders** | Backend Agent, QA Agent |
| **Governing Audit** | WebSocket Architecture Audit (2026-02-27) |
| **Priority** | High — single-connection Massive.com plan constraint makes any upstream leak a service-impacting event |

---

## Executive Summary

The WebSocket architecture audit confirmed the correct single-upstream / fan-out pattern is in place. However, it surfaced four actionable gaps that, if left unaddressed, could cause Massive.com connection-limit violations, silent degradation under load, or scaling dead-ends. This spec defines bounded slices to close each gap with minimal blast radius.

**Gaps addressed:**

1. Reconnect race in `connectStream()` — no guard against overlapping upstream connections.
2. No max-client cap on the member-facing `WebSocketServer`.
3. No structured telemetry for connection counts, broadcast health, or provider state.
4. Horizontal scaling constraint undocumented and unprotected.

**Out of scope:** Client-side `use-price-stream.ts` changes (audit confirmed it is sound), poll-fallback batching, new Massive.com plan upgrades, Prometheus/Grafana infrastructure provisioning.

---

## 1. Objectives & Success Metrics

### 1.1 Primary Objectives

| # | Objective | Rationale |
|---|-----------|-----------|
| O-1 | Eliminate any possibility of > 1 concurrent WebSocket to Massive.com | Plan allows exactly 1. A second connection triggers `max_connections` rejection and degrades all members. |
| O-2 | Cap concurrent member WebSocket connections with configurable limit | Unbounded fan-out creates CPU risk during broadcast loops and memory pressure from `clients` Map growth. |
| O-3 | Add structured telemetry for WebSocket subsystem health | Current state is log-only; no alertable metrics for connection count, broadcast latency, provider state transitions. |
| O-4 | Document and enforce single-process constraint for the upstream Massive stream | Prevents accidental plan violation if backend is ever scaled horizontally. |

### 1.2 Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Max concurrent Massive.com WS connections | 1 (by convention) | 1 (by invariant) | Guard + unit test |
| Reconnect race window | Non-zero (no guard) | Zero | Deterministic test covering overlapping `connectStream()` calls |
| Member connection cap | Unlimited | Configurable (default 200) | `WS_MAX_CLIENTS` env var, enforced at `connection` event |
| Telemetry coverage | 0 exported metrics | 6 core gauges/counters | `/health/ws` endpoint returns structured JSON |
| Horizontal scale guard | None | Startup assertion + docs | Process fails fast if duplicate instance detected via Redis lock |

### 1.3 Quality Gates

- `pnpm exec tsc --noEmit` — zero errors in touched files.
- `pnpm exec eslint backend/src/services/massiveTickStream.ts backend/src/services/websocket.ts` — zero warnings.
- New unit tests pass: `pnpm vitest run backend/src/services/__tests__/massiveTickStream.test.ts backend/src/services/__tests__/websocket*.test.ts`
- Existing integration tests unbroken: `pnpm vitest run backend/src/__tests__/integration/spx-websocket.test.ts`
- Manual verification: start backend, confirm `/health/ws` returns expected JSON shape.

---

## 2. Slice Plan

### Slice 1: Reconnect Race Guard

**Objective:** Make it impossible for `connectStream()` to open a second WebSocket while one is already CONNECTING or OPEN.

**Target file:** `backend/src/services/massiveTickStream.ts`

**Change:**

Add a guard at the top of `connectStream()` (currently line 501) that checks whether `wsClient` is non-null and in a non-terminal state. If so, log a warning and return without opening a new connection.

```typescript
// Insert at line 502, before any timer clearing
function connectStream(): void {
  if (!shouldRun) return;

  // RACE GUARD: prevent overlapping connections to Massive.com
  if (wsClient && (wsClient.readyState === WebSocket.CONNECTING || wsClient.readyState === WebSocket.OPEN)) {
    logger.warn('connectStream called while existing connection is active — skipping', {
      readyState: wsClient.readyState,
      connectionState,
    });
    return;
  }

  // ... existing logic continues unchanged
}
```

**Additionally**, defensively nullify `wsClient` in the `close` handler before scheduling reconnect (currently line 573: `wsClient = null`). Verify this already happens — audit confirms it does.

**Test:**

Add a unit test to `backend/src/services/__tests__/massiveTickStream.test.ts`:

```typescript
describe('connectStream race guard', () => {
  it('should not open a second WebSocket if one is already CONNECTING', () => {
    // Call startMassiveTickStream() to create first connection
    // Immediately call the internal reconnect path
    // Assert WebSocket constructor was called exactly once
  });

  it('should not open a second WebSocket if one is already OPEN', () => {
    // Simulate OPEN state
    // Trigger connectStream via reconnect timer
    // Assert no new connection
  });
});
```

**Risks:** None. Guard is additive and returns early — cannot break existing behavior.

**Rollback:** Revert the guard. Behavior returns to pre-patch state.

---

### Slice 2: Member Connection Cap

**Objective:** Reject new member WebSocket connections when the server is at capacity, returning a clear close code.

**Target file:** `backend/src/services/websocket.ts`

**Change:**

1. Add a new configurable constant and env var:

```typescript
const WS_MAX_CLIENTS = parseInt(process.env.WS_MAX_CLIENTS || '200', 10);
const WS_CLOSE_CAPACITY = 4429; // Custom close code: server at capacity
```

2. Add a guard at the top of the `wss.on('connection', ...)` handler (currently line ~1718), before token extraction:

```typescript
wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
  // CONNECTION CAP: reject if at capacity
  if (clients.size >= WS_MAX_CLIENTS) {
    logger.warn('WebSocket connection rejected: at capacity', {
      current: clients.size,
      max: WS_MAX_CLIENTS,
      remoteAddress: req.socket.remoteAddress,
    });
    ws.close(WS_CLOSE_CAPACITY, 'Server at capacity');
    return;
  }

  // ... existing auth + registration logic unchanged
});
```

3. Add `WS_MAX_CLIENTS` to `backend/.env.example` with documentation comment.

**Client-side handling:** The existing `use-price-stream.ts` reconnect logic treats any non-4401/4403 close as a transient failure and retries with exponential backoff. This is correct behavior — a capacity rejection will naturally retry, and when a slot opens the client connects. No client changes needed.

**Test:**

Add to `backend/src/services/__tests__/websocket.authz.test.ts`:

```typescript
describe('connection cap', () => {
  it('should reject connections when at WS_MAX_CLIENTS', () => {
    // Fill clients Map to capacity
    // Attempt new connection
    // Assert close code 4429
  });

  it('should accept connections when below WS_MAX_CLIENTS', () => {
    // Fill to capacity - 1
    // Connect successfully
    // Assert client registered
  });
});
```

**Risks:** Low. Legitimate users could be rejected during traffic spikes. Mitigation: default of 200 is generous (current peak is well under 50), and the value is tunable without code change.

**Rollback:** Set `WS_MAX_CLIENTS=999999` via env to effectively disable.

---

### Slice 3: WebSocket Health Telemetry Endpoint

**Objective:** Expose a structured JSON endpoint at `GET /health/ws` that provides alertable metrics for the entire WebSocket subsystem.

**Target files:**
- `backend/src/services/websocket.ts` — add `getWebSocketHealth()` export
- `backend/src/services/massiveTickStream.ts` — `getMassiveTickStreamStatus()` already exists (line 654)
- `backend/src/routes/health.ts` (new file) or add to existing health route

**Change:**

1. Add a `getWebSocketHealth()` function to `websocket.ts`:

```typescript
export function getWebSocketHealth() {
  const now = Date.now();
  const clientCount = clients.size;
  const subscriptionCounts = new Map<string, number>();

  for (const [, state] of clients) {
    for (const sub of state.subscriptions) {
      subscriptionCounts.set(sub, (subscriptionCounts.get(sub) || 0) + 1);
    }
  }

  return {
    server: {
      clientCount,
      maxClients: WS_MAX_CLIENTS,
      utilizationPct: Math.round((clientCount / WS_MAX_CLIENTS) * 100),
      subscriptionsBySymbol: Object.fromEntries(subscriptionCounts),
    },
    broadcast: {
      lastTickBroadcast: Object.fromEntries(
        Array.from(lastTickBroadcastAtBySymbol).map(([sym, ts]) => [sym, { ageMs: now - ts }])
      ),
      lastMicrobarBroadcast: Object.fromEntries(
        Array.from(lastMicrobarBroadcastAtBySymbolInterval).map(([key, ts]) => [key, { ageMs: now - ts }])
      ),
      feedHealthBroadcastAgeMs: lastFeedHealthBroadcastAt ? now - lastFeedHealthBroadcastAt : null,
    },
    upstream: getMassiveTickStreamStatus(),
    timestamp: new Date(now).toISOString(),
  };
}
```

2. Add a health route:

```typescript
// In backend/src/routes/health.ts or existing health route
router.get('/health/ws', requireAuth, (req, res) => {
  res.json(getWebSocketHealth());
});
```

3. Track `lastFeedHealthBroadcastAt` timestamp in websocket.ts (add a module-level `let` and update it in `broadcastFeedHealthIfDegraded()`).

**Payload shape:**

```json
{
  "server": {
    "clientCount": 12,
    "maxClients": 200,
    "utilizationPct": 6,
    "subscriptionsBySymbol": { "SPX": 12, "SPY": 8, "NDX": 4 }
  },
  "broadcast": {
    "lastTickBroadcast": { "SPX": { "ageMs": 142 }, "SPY": { "ageMs": 310 } },
    "lastMicrobarBroadcast": { "SPX:1s": { "ageMs": 890 } },
    "feedHealthBroadcastAgeMs": 4200
  },
  "upstream": {
    "enabled": true,
    "connected": true,
    "connectionState": "active",
    "shouldRun": true,
    "subscribedSymbols": ["I:SPX", "I:NDX", "SPY"],
    "reconnectAttempt": 0,
    "lastConnectedAt": "2026-02-27T14:30:00.000Z",
    "lastMessageAt": "2026-02-27T14:35:12.345Z",
    "lastProviderStatus": "auth_success",
    "lastProviderMessage": null,
    "lastCloseCode": null,
    "lastCloseReason": null
  },
  "timestamp": "2026-02-27T14:35:12.500Z"
}
```

**Test:**

```typescript
describe('GET /health/ws', () => {
  it('should return structured health payload with all required fields');
  it('should reflect correct clientCount after connections/disconnections');
  it('should include upstream tick stream status');
  it('should require authentication');
});
```

**Risks:** Leaking internal state to unauthorized users. Mitigation: endpoint requires auth (admin-level preferred if admin middleware exists).

**Rollback:** Remove route registration. No other code affected.

---

### Slice 4: Horizontal Scale Guard

**Objective:** Prevent multiple backend instances from each opening their own Massive.com WebSocket connection. Fail fast at startup if another instance holds the upstream lock.

**Target files:**
- `backend/src/services/massiveTickStream.ts` — add Redis-based advisory lock
- `backend/src/config/env.ts` — add `MASSIVE_TICK_LOCK_ENABLED` env var

**Prerequisite:** Redis is already in use for caching/rate-limiting (`REDIS_URL` env var).

**Change:**

1. Before `connectStream()` opens the WebSocket, acquire a Redis advisory lock:

```typescript
import { redis } from '../config/redis';

const MASSIVE_LOCK_KEY = 'massive:tick:stream:lock';
const MASSIVE_LOCK_TTL_S = 60; // Auto-expires if holder crashes
let lockRenewalTimer: ReturnType<typeof setInterval> | null = null;

async function acquireUpstreamLock(): Promise<boolean> {
  if (!getEnv().MASSIVE_TICK_LOCK_ENABLED) return true; // Bypass if disabled

  const instanceId = `${process.pid}-${Date.now()}`;
  const acquired = await redis.set(MASSIVE_LOCK_KEY, instanceId, 'EX', MASSIVE_LOCK_TTL_S, 'NX');

  if (!acquired) {
    const holder = await redis.get(MASSIVE_LOCK_KEY);
    logger.error('FATAL: Another instance holds the Massive tick stream lock', {
      holder,
      thisInstance: instanceId,
    });
    return false;
  }

  // Renew lock periodically (TTL/2 interval)
  lockRenewalTimer = setInterval(async () => {
    await redis.expire(MASSIVE_LOCK_KEY, MASSIVE_LOCK_TTL_S);
  }, (MASSIVE_LOCK_TTL_S * 1000) / 2);

  return true;
}

async function releaseUpstreamLock(): Promise<void> {
  if (lockRenewalTimer) clearInterval(lockRenewalTimer);
  await redis.del(MASSIVE_LOCK_KEY);
}
```

2. Modify `startMassiveTickStream()` to be async and acquire the lock:

```typescript
export async function startMassiveTickStream(): Promise<void> {
  if (shouldRun) return;
  // ... existing env checks ...

  const lockAcquired = await acquireUpstreamLock();
  if (!lockAcquired) {
    logger.error('Massive tick stream will NOT start — another instance owns the upstream connection');
    // Do NOT set shouldRun = true; this instance runs in poll-only mode
    return;
  }

  shouldRun = true;
  connectStream();
}
```

3. Call `releaseUpstreamLock()` in `stopMassiveTickStream()`.

4. Add `MASSIVE_TICK_LOCK_ENABLED` to env config (default: `false` — opt-in for now, mandatory when scaling):

```typescript
// backend/src/config/env.ts
MASSIVE_TICK_LOCK_ENABLED: booleanFromEnv.default(false),
```

5. Document the constraint in `CLAUDE.md` Section 4 (Architecture Map → External Services table) and as a callout in Section 7.2 (File Ownership Boundaries):

```markdown
> **⚠️ Single-Process Constraint:** The Massive.com plan allows exactly 1 WebSocket
> connection. The `massiveTickStream` module assumes a single backend process. If
> horizontal scaling is required, enable `MASSIVE_TICK_LOCK_ENABLED=true` to use
> Redis advisory locking. Only the lock-holding instance opens the upstream stream;
> other instances operate in poll-fallback mode.
```

**Test:**

```typescript
describe('upstream lock', () => {
  it('should acquire lock and start stream when no other holder');
  it('should refuse to start when lock is held by another instance');
  it('should renew lock periodically');
  it('should release lock on stopMassiveTickStream()');
  it('should bypass lock when MASSIVE_TICK_LOCK_ENABLED=false');
});
```

**Risks:** Redis unavailability could prevent stream startup. Mitigation: when `MASSIVE_TICK_LOCK_ENABLED=false` (default), the lock is bypassed entirely — current behavior preserved. Lock TTL auto-expires on crash, so a dead holder doesn't permanently block.

**Rollback:** Set `MASSIVE_TICK_LOCK_ENABLED=false`. Lock code becomes inert.

---

## 3. Implementation Sequence

```
Slice 1 (Race Guard)          ─── independent, no dependencies
Slice 2 (Connection Cap)      ─── independent, no dependencies
Slice 3 (Health Endpoint)     ─── depends on Slice 1 & 2 being merged (references new constants)
Slice 4 (Scale Guard)         ─── independent, but should be last (most complex, opt-in)
```

**Recommended execution:** Slices 1 and 2 in parallel → Slice 3 → Slice 4.

---

## 4. Acceptance Criteria

- [ ] **AC-1:** `connectStream()` returns without creating a new WebSocket if `wsClient.readyState` is CONNECTING or OPEN. Covered by unit test.
- [ ] **AC-2:** Backend rejects WebSocket connections with close code 4429 when `clients.size >= WS_MAX_CLIENTS`. Covered by unit test.
- [ ] **AC-3:** `GET /health/ws` returns JSON with `server.clientCount`, `server.maxClients`, `upstream.connectionState`, and `broadcast.lastTickBroadcast`. Covered by integration test.
- [ ] **AC-4:** When `MASSIVE_TICK_LOCK_ENABLED=true`, a second backend instance logs a FATAL error and does not open a Massive.com WebSocket. Covered by unit test.
- [ ] **AC-5:** When `MASSIVE_TICK_LOCK_ENABLED=false` (default), behavior is identical to pre-patch. No lock acquired, no Redis dependency for stream startup.
- [ ] **AC-6:** All existing tests pass: `pnpm vitest run backend/src/services/__tests__/ backend/src/__tests__/integration/spx-websocket.test.ts`
- [ ] **AC-7:** `pnpm exec tsc --noEmit` and `pnpm exec eslint backend/src/services/massiveTickStream.ts backend/src/services/websocket.ts` — zero errors/warnings.
- [ ] **AC-8:** `CLAUDE.md` updated with single-process constraint documentation.

---

## 5. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R-1 | Race guard rejects legitimate reconnect after clean close | Low | Medium (delayed reconnect) | Guard checks `readyState` — after close event, state is CLOSED, guard passes through. Unit test covers this path. |
| R-2 | Connection cap too low for production traffic | Low | High (users rejected) | Default 200 is 4x current peak. Tunable via env without deploy. |
| R-3 | Health endpoint exposes sensitive internal state | Medium | Low | Requires auth. Payload contains no secrets (no API keys, no user data). |
| R-4 | Redis lock prevents stream startup during Redis outage | Low | High (no tick data) | Lock is opt-in (`MASSIVE_TICK_LOCK_ENABLED=false` default). When disabled, zero Redis dependency for stream startup. |
| R-5 | Lock TTL too short, expires during GC pause | Very Low | Medium (brief dual connection) | 60s TTL with 30s renewal is conservative. Node GC pauses are typically < 1s. |

---

## 6. File Manifest

| File | Action | Slice |
|------|--------|-------|
| `backend/src/services/massiveTickStream.ts` | Edit — add race guard (S1), add lock (S4) | 1, 4 |
| `backend/src/services/websocket.ts` | Edit — add connection cap (S2), add `getWebSocketHealth()` (S3) | 2, 3 |
| `backend/src/routes/health.ts` | Create or edit — add `/health/ws` route | 3 |
| `backend/src/config/env.ts` | Edit — add `MASSIVE_TICK_LOCK_ENABLED`, `WS_MAX_CLIENTS` | 2, 4 |
| `backend/.env.example` | Edit — document new env vars | 2, 4 |
| `backend/src/services/__tests__/massiveTickStream.test.ts` | Edit — add race guard + lock tests | 1, 4 |
| `backend/src/services/__tests__/websocket.authz.test.ts` | Edit — add connection cap tests | 2 |
| `backend/src/services/__tests__/websocket.health.test.ts` | Create — health endpoint tests | 3 |
| `docs/specs/WEBSOCKET_HARDENING_EXECUTION_SPEC_2026-02-27.md` | This document | — |
| `CLAUDE.md` | Edit — add single-process constraint callout | 4 |

---

## 7. Release Gates

```bash
# Slice-level (run after each slice)
pnpm exec tsc --noEmit
pnpm exec eslint backend/src/services/massiveTickStream.ts backend/src/services/websocket.ts
pnpm vitest run backend/src/services/__tests__/massiveTickStream.test.ts
pnpm vitest run backend/src/services/__tests__/websocket.authz.test.ts

# Release-level (run after all slices)
pnpm exec tsc --noEmit
pnpm exec eslint .
pnpm vitest run backend/
pnpm run build
```
