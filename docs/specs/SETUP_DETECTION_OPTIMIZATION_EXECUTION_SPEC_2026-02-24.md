# Setup Detection System Optimization — Execution Spec

| Field | Value |
|-------|-------|
| **Document** | SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24 |
| **Date** | 2026-02-24 |
| **Status** | PROPOSED |
| **Owner** | Orchestrator Agent |
| **Approver** | Product Owner |
| **Stakeholders** | Frontend Agent, Backend Agent, SPX Engine Agent, Database Agent, QA Agent, Docs Agent |
| **Source** | Multi-Agent Audit Report (SETUP_DETECTION_AUDIT_2026-02-24.md) |
| **Findings** | 41 total — 7 Critical, 18 High, 9 Medium, 7 Low |

---

## Executive Summary

The Multi-Agent Audit of 2026-02-24 identified 41 findings across the SPX Command Center setup detection pipeline. This execution spec defines the implementation plan to resolve all findings across four phases, organized by severity and dependency chain.

The core problem: data pipeline reliability issues compound with overly relaxed trading logic gates to produce an estimated **15-25% false positive rate**. Cross-agent analysis revealed four compound issues where defects in separate subsystems multiply each other's impact.

### Expected Impact

| Metric | Baseline (Current) | Target (Post-Optimization) | Measurement |
|--------|-------------------|---------------------------|-------------|
| False positive rate | 15-25% | 5-8% | Backtest + journal outcome tracking |
| Win rate (triggered setups) | ~52% estimated | 57-62% | Trade journal 30-day rolling |
| Expected value per setup | ~0.15R | 0.50-0.80R | Journal EV calculation |
| Setups surfaced per session | 18-25 | 28-38 (with VWAP patterns) | Scanner telemetry |
| Silent scanner failures | Unknown (0 visibility) | 0 unlogged failures | Logger + dead-letter audit |
| Data feed recovery time | 60s+ (cascading) | <10s (circuit breaker) | Feed health telemetry |

### Timeline

| Phase | Duration | Focus | Slices |
|-------|----------|-------|--------|
| Phase 1: Critical Fixes | Week 1 (5 days) | Entry timing, data integrity, scanner visibility | A1-A7 |
| Phase 2: Trading Logic | Weeks 2-3 (10 days) | New setups, regime awareness, risk management | B1-B11 |
| Phase 3: Infrastructure | Week 3-4 (7 days) | Concurrency, indexing, memory, resilience | C1-C9 |
| Phase 4: AI/ML Enhancement | Weeks 5-8 (20 days) | ML models, anomaly detection, adaptive scoring | D1-D7 |

---

## Phase 1: Critical Fixes (Week 1)

### Objective

Eliminate the 7 critical findings that directly degrade setup detection accuracy and system reliability. These are the highest-impact, lowest-effort fixes.

### Success Metrics

| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|
| False trigger rate | 18-25% | 8-12% | Replay engine backtest |
| Scanner error visibility | 0% | 100% | Logger grep for scanner warn/error |
| Tick gap detection accuracy | Misses single drops | Catches all gaps | Unit test suite |
| ORB false positive rate | ~60% unconfirmed | <30% | Backtest ORB setups last 30 days |

### Quality Gates (Phase 1 Release)

```bash
pnpm exec eslint lib/spx/engine.ts lib/spx/market-data-orchestrator.ts backend/src/services/scanner/ backend/src/services/setupPushChannel.ts
pnpm exec tsc --noEmit
pnpm vitest run lib/spx/__tests__/setupLifecycle.test.ts lib/spx/__tests__/market-data-orchestrator.test.ts lib/spx/__tests__/feed-health.test.ts
pnpm vitest run backend/src/services/scanner/__tests__/scanner.test.ts backend/src/services/__tests__/setupPushChannel.test.ts
```

---

### Slice A1: Candle-Close Entry Confirmation

**Audit Finding:** #1 (Critical) — Entry timing: touch vs confirmation close
**Agent:** 2 (Quant)
**Status:** pending

#### Objective

Replace price-touch triggering with candle-close confirmation in `transitionSetupStatus()`. Only transition to `triggered` when the confirming bar has closed within the entry zone.

#### Scope

**Files Modified:**
- `lib/spx/engine.ts` — Add `barConfirmed` parameter to `transitionSetupStatus()` context
- `lib/types/spx-command-center.ts` — Extend `Setup` status transition context type if needed
- `lib/spx/__tests__/setupLifecycle.test.ts` — Add tests for bar-confirmed transitions

**Files Read (context only):**
- `lib/spx/decision-engine.ts`
- `contexts/spx/` — Understand how transitionSetupStatus is called from UI

#### Implementation

In `lib/spx/engine.ts`, line 263, modify `transitionSetupStatus()`:

```typescript
export function transitionSetupStatus(
  setup: Setup,
  context: {
    currentPrice: number
    nowIso?: string
    invalidated?: boolean
    confluenceScore?: number
    barConfirmed?: boolean      // NEW: true when current bar has closed
    latestBarClose?: number     // NEW: close price of the confirming bar
  },
): SetupStatus {
  const now = new Date(context.nowIso ?? new Date().toISOString())
  const createdAt = new Date(setup.createdAt)
  const ageMs = now.getTime() - createdAt.getTime()

  if (context.invalidated) return 'invalidated'

  // Use bar close price if available, otherwise fall back to current price
  const confirmationPrice = context.latestBarClose ?? context.currentPrice
  const inEntryZone = confirmationPrice >= setup.entryZone.low && confirmationPrice <= setup.entryZone.high

  // CHANGED: Only trigger when bar has confirmed (closed) in the entry zone
  // If barConfirmed is undefined (legacy callers), fall back to current behavior
  const isConfirmed = context.barConfirmed !== false // backwards-compatible default
  if (inEntryZone && isConfirmed && (setup.status === 'ready' || setup.status === 'forming')) {
    return 'triggered'
  }

  if (setup.status === 'forming' && (context.confluenceScore ?? setup.confluenceScore) >= 3) {
    return 'ready'
  }

  if (setup.status !== 'triggered' && ageMs > 30 * 60 * 1000) {
    return 'expired'
  }

  return setup.status
}
```

#### Acceptance Criteria

- [ ] `transitionSetupStatus` accepts `barConfirmed` and `latestBarClose` in context
- [ ] When `barConfirmed === true` and close is in entry zone → status becomes `triggered`
- [ ] When `barConfirmed === false` and price is in entry zone → status remains `ready` (no trigger)
- [ ] When `barConfirmed` is undefined → backwards-compatible behavior (existing callers unaffected)
- [ ] Unit tests cover: confirmed trigger, unconfirmed hold, legacy fallback, zone boundary
- [ ] All existing `setupLifecycle.test.ts` tests still pass

#### Validation Gates

```bash
pnpm exec eslint lib/spx/engine.ts
pnpm exec tsc --noEmit
pnpm vitest run lib/spx/__tests__/setupLifecycle.test.ts
```

#### Risks

- Callers in `contexts/spx/` that don't pass `barConfirmed` will use legacy behavior until updated in Slice B (acceptable — no regression)
- Slightly delayed entry signals in fast markets (by design — reduces false triggers)

#### Rollback

Revert `lib/spx/engine.ts` to previous version. No database changes. No API changes.

---

### Slice A2: Sequence Gap Off-By-One Fix

**Audit Finding:** #5 (Critical) — Sequence gap off-by-one error
**Agent:** 1 (Massive)
**Status:** pending

#### Objective

Fix the off-by-one error in `detectSPXSequenceGap()` so that single dropped ticks are correctly flagged.

#### Scope

**Files Modified:**
- `lib/spx/market-data-orchestrator.ts` — Fix gap detection comparison (line 26)
- `lib/spx/__tests__/market-data-orchestrator.test.ts` — Add edge case tests

#### Implementation

In `lib/spx/market-data-orchestrator.ts`, line 26:

```typescript
// BEFORE (buggy — tolerance=0 means gap must be > 1, misses single drops)
export function detectSPXSequenceGap(
  previousSequence: number | null,
  nextSequence: number | null,
  tolerance = DEFAULT_OPTIONS.sequenceGapTolerance,
): boolean {
  if (previousSequence == null || nextSequence == null) return false
  return nextSequence > previousSequence + tolerance + 1
}

// AFTER (fixed — tolerance=0 means gap detected when nextSequence > previousSequence + 1)
export function detectSPXSequenceGap(
  previousSequence: number | null,
  nextSequence: number | null,
  tolerance = DEFAULT_OPTIONS.sequenceGapTolerance,
): boolean {
  if (previousSequence == null || nextSequence == null) return false
  const expectedNext = previousSequence + 1
  return nextSequence > expectedNext + tolerance
}
```

#### Acceptance Criteria

- [ ] Sequence 100 → 102 with tolerance=0: gap detected (true)
- [ ] Sequence 100 → 101 with tolerance=0: no gap (false)
- [ ] Sequence 100 → 103 with tolerance=1: gap detected (true)
- [ ] Sequence 100 → 102 with tolerance=1: no gap (false)
- [ ] Null inputs: no gap (false)
- [ ] All existing `market-data-orchestrator.test.ts` tests still pass

#### Validation Gates

```bash
pnpm exec eslint lib/spx/market-data-orchestrator.ts
pnpm vitest run lib/spx/__tests__/market-data-orchestrator.test.ts
```

#### Rollback

Single-file revert. No side effects.

---

### Slice A3: Scanner Error Logging

**Audit Finding:** #18 (High, elevated to Critical for Phase 1) — Silent errors in all scanner functions
**Agent:** 4 (Backend)
**Status:** pending

#### Objective

Add structured logging to all 9 scanner catch blocks. Every failure must produce a log entry with symbol, scanner type, error message, and stack trace.

#### Scope

**Files Modified:**
- `backend/src/services/scanner/technicalScanner.ts` — Add logger.warn to 7 catch blocks
- `backend/src/services/scanner/optionsScanner.ts` — Add logger.warn to 2 catch blocks
- `backend/src/services/scanner/index.ts` — Log rejected promises from `Promise.allSettled()`

#### Implementation

For each scanner function (example pattern):

```typescript
import { logger } from '../../lib/logger';

export async function scanSupportBounce(symbol: string): Promise<TechnicalSetup | null> {
  try {
    // ... existing logic
  } catch (error) {
    logger.warn('Scanner failed: support_bounce', {
      scanner: 'support_bounce',
      symbol,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}
```

In `index.ts`, add rejection logging:

```typescript
const results = await Promise.allSettled(scanPromises);
for (const result of results) {
  if (result.status === 'fulfilled') {
    opportunities.push(...result.value);
  } else {
    logger.warn('Symbol scan failed', {
      reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  }
}
```

#### Acceptance Criteria

- [ ] All 7 functions in technicalScanner.ts have structured logger.warn in catch blocks
- [ ] All 2 functions in optionsScanner.ts have structured logger.warn in catch blocks
- [ ] index.ts logs rejected promise reasons from Promise.allSettled
- [ ] Log entries include: scanner name, symbol, error message, stack trace
- [ ] No functional behavior change (still returns null on error)

#### Validation Gates

```bash
pnpm exec eslint backend/src/services/scanner/
pnpm exec tsc --noEmit
pnpm vitest run backend/src/services/scanner/__tests__/scanner.test.ts
```

#### Rollback

Revert scanner files. Logging-only change, no behavior impact.

---

### Slice A4: Setup Push Channel Race Condition Fix

**Audit Finding:** #7 (Critical) — Race condition in setup push broadcasting
**Agent:** 4 (Backend)
**Status:** pending

#### Objective

Fix iterator invalidation in `setupPushChannel.ts` by copying the listener set before iteration.

#### Scope

**Files Modified:**
- `backend/src/services/setupPushChannel.ts` — Copy listeners before broadcast iteration
- `backend/src/services/__tests__/setupPushChannel.test.ts` — Add concurrent subscribe/broadcast test

#### Implementation

```typescript
function publishEvent(event: SetupPushEvent): void {
  if (listeners.size === 0) return;

  // Snapshot listeners to prevent iterator invalidation during concurrent subscribe/unsubscribe
  const snapshot = Array.from(listeners);

  for (const listener of snapshot) {
    try {
      listener(event);
    } catch (error) {
      logger.warn('Setup push listener failed', {
        error: error instanceof Error ? error.message : String(error),
        eventKind: event.kind,
      });
    }
  }
}
```

#### Acceptance Criteria

- [ ] Listeners are copied to array before iteration
- [ ] Individual listener errors are caught and logged (no cascade)
- [ ] Test: subscribing during broadcast doesn't cause crash
- [ ] Test: unsubscribing during broadcast doesn't cause crash
- [ ] All existing setupPushChannel tests pass

#### Validation Gates

```bash
pnpm exec eslint backend/src/services/setupPushChannel.ts
pnpm vitest run backend/src/services/__tests__/setupPushChannel.test.ts
```

#### Rollback

Single-file revert. No API changes.

---

### Slice A5: WebSocket Auth-Before-Subscribe Sequencing

**Audit Finding:** #2 (Critical) — WebSocket subscription race condition
**Agent:** 1 (Massive)
**Status:** pending

#### Objective

Ensure Massive.com WebSocket auth completes with acknowledgment before sending subscription messages. Prevent silent subscription failures.

#### Scope

**Files Modified:**
- `backend/src/services/websocket.ts` — Add auth-ack waiting before subscribe, add subscription confirmation tracking

#### Implementation

Add state machine for WebSocket connection lifecycle:

```typescript
type MassiveWsState = 'connecting' | 'authenticating' | 'authenticated' | 'subscribing' | 'active' | 'error';

let wsState: MassiveWsState = 'connecting';
const AUTH_ACK_TIMEOUT_MS = 5000;
const SUBSCRIBE_ACK_TIMEOUT_MS = 3000;

// On WebSocket open:
function onMassiveWsOpen(ws: WebSocket): void {
  wsState = 'authenticating';
  ws.send(JSON.stringify({ action: 'auth', params: process.env.MASSIVE_API_KEY }));

  const authTimeout = setTimeout(() => {
    if (wsState === 'authenticating') {
      logger.error('Massive.com WebSocket auth timeout — scheduling reconnect');
      wsState = 'error';
      ws.close();
      scheduleReconnect();
    }
  }, AUTH_ACK_TIMEOUT_MS);

  // Store timeout reference for cleanup
  pendingAuthTimeout = authTimeout;
}

// On message — check for auth confirmation before subscribing:
function onMassiveWsMessage(ws: WebSocket, data: string): void {
  const msg = JSON.parse(data);

  if (msg[0]?.ev === 'status' && msg[0]?.status === 'auth_success') {
    clearTimeout(pendingAuthTimeout);
    wsState = 'authenticated';
    sendSubscriptions(ws);
    return;
  }

  if (msg[0]?.ev === 'status' && msg[0]?.status === 'auth_failed') {
    clearTimeout(pendingAuthTimeout);
    wsState = 'error';
    logger.error('Massive.com WebSocket auth failed', { message: msg[0]?.message });
    ws.close();
    scheduleReconnect();
    return;
  }

  // Process normal tick/aggregate messages only when state is 'active'
  if (wsState === 'active') {
    processTickMessage(msg);
  }
}

function sendSubscriptions(ws: WebSocket): void {
  wsState = 'subscribing';
  ws.send(JSON.stringify({ action: 'subscribe', params: subscribedSymbols.join(',') }));

  setTimeout(() => {
    if (wsState === 'subscribing') {
      wsState = 'active'; // Assume subscribed after timeout (Massive doesn't always ack)
      logger.info('Massive.com WebSocket subscriptions assumed active');
    }
  }, SUBSCRIBE_ACK_TIMEOUT_MS);
}
```

#### Acceptance Criteria

- [ ] Auth message sent on open, subscription sent only after auth acknowledgment
- [ ] Auth failure triggers reconnect, not silent degradation
- [ ] Auth timeout (5s) triggers reconnect with error logging
- [ ] No tick messages processed until state is 'active'
- [ ] Existing WebSocket tests pass
- [ ] Manual test: disconnect/reconnect cycle completes within 10s

#### Validation Gates

```bash
pnpm exec eslint backend/src/services/websocket.ts
pnpm exec tsc --noEmit
pnpm vitest run backend/src/services/__tests__/websocket.test.ts  # if exists
```

#### Risks

- Massive.com may not send explicit auth_success (check actual payload format)
- 5s auth timeout may be too short in degraded network conditions (configurable via env var)

#### Rollback

Revert websocket.ts. Reconnection behavior reverts to current (simultaneous auth+subscribe).

---

### Slice A6: ORB Breakout Gate Restoration

**Audit Finding:** #3 (Critical) — ORB flow gate relaxation without compensation
**Agent:** 2 (Quant)
**Status:** pending

#### Objective

Restore ORB breakout detection gates to values that maintain signal quality while allowing the 30-minute grace window for EMA alignment.

#### Scope

**Files Modified:**
- `backend/src/services/spx/setupDetector.ts` (or equivalent ORB detection config)
- Related test files for ORB setup detection

**Files Read (context only):**
- `lib/spx/__tests__/orb-gate-relaxation.test.ts` — Understand current test expectations

#### Implementation

Locate ORB configuration constants and restore/tighten:

```typescript
// ORB Breakout Gate Configuration
const ORB_GATES = {
  minConfluenceScore: 3.5,        // Restore from 3 → 3.5
  minAlignmentPct: 52,            // Restore from 45% → 52%
  requireEmaAlignment: true,      // Re-enable (was disabled)
  emaGraceWindowMinutes: 30,      // Keep 30-min grace window for first check
  maxFirstSeenMinuteEt: 120,      // Tighten from 165 → 120 (no ORB after 11:30 ET)
  minFlowConfirmation: true,      // Require at least 1 flow event aligned with direction
} as const;
```

#### Acceptance Criteria

- [ ] ORB minConfluenceScore is 3.5 or higher
- [ ] ORB minAlignmentPct is 52% or higher
- [ ] EMA alignment required (with 30-min grace window for pre-10:00 setups)
- [ ] No ORB setups generated after 120 minutes into session (11:30 ET)
- [ ] Backtest: ORB false positive rate < 30% (down from ~60%)
- [ ] ORB gate relaxation tests updated to reflect new thresholds

#### Validation Gates

```bash
pnpm exec eslint backend/src/services/spx/setupDetector.ts  # or equivalent path
pnpm vitest run lib/spx/__tests__/orb-gate-relaxation.test.ts
```

#### Rollback

Revert setupDetector.ts ORB configuration constants.

---

### Slice A7: Confluence Score Inflation Fix

**Audit Finding:** #6 (Critical) — Confluence score inflation via memory edge
**Agent:** 2 (Quant)
**Status:** pending

#### Objective

Gate the memory edge confluence bonus on regime alignment and minimum historical sample size. Prevent unconditional +1 inflation.

#### Scope

**Files Modified:**
- `backend/src/services/spx/setupDetector.ts` — Modify memory edge confluence calculation
- Related tests

#### Implementation

```typescript
// BEFORE: Unconditional +1 memory bonus
if (memoryContext && memoryContext.winRate > 0) {
  confluenceScore += 1;
  confluenceSources.push('memory_edge');
}

// AFTER: Gated on regime alignment and minimum sample size
if (
  memoryContext
  && memoryContext.winRate >= 0.55          // At least 55% historical win rate
  && memoryContext.totalTests >= 5          // Minimum 5 historical tests
  && regimeCompatibility >= 0.65           // Must be regime-aligned
) {
  const memoryBonus = Math.min(1, (memoryContext.winRate - 0.5) * 2);  // 0-1 scaled
  confluenceScore += memoryBonus;
  confluenceSources.push('memory_edge');
  confluenceBreakdown.memory = memoryBonus;
}
```

#### Acceptance Criteria

- [ ] Memory edge requires winRate >= 0.55, totalTests >= 5, regime compatibility >= 0.65
- [ ] Memory bonus is scaled 0-1 based on win rate (not flat +1)
- [ ] Counter-trend setups with poor memory history do not receive memory bonus
- [ ] Setups with < 5 historical tests do not receive memory bonus
- [ ] Tests verify: memory bonus gated correctly, scaled correctly, breakdown populated

#### Validation Gates

```bash
pnpm exec eslint backend/src/services/spx/setupDetector.ts
pnpm vitest run lib/spx/__tests__/confluenceScore.test.ts
```

#### Rollback

Revert setupDetector.ts memory edge section.

---

## Phase 2: Trading Logic Improvements (Weeks 2-3)

### Objective

Address 11 high-severity findings related to trading logic accuracy: new setup types, regime awareness, risk management, and confluence refinement.

### Success Metrics

| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|
| Setups per session | 18-25 | 28-38 | Scanner telemetry |
| Compression trigger rate | 38% (in 30min) | 52%+ | Replay engine backtest |
| Mean reversion R:R | ~1.2R | 1.8-2.2R | Journal analytics |
| Counter-trend false positive rate | 12-15% | 4-6% | Backtest regime-conflicted setups |

### Quality Gates (Phase 2 Release)

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm vitest run lib/spx/__tests__/
pnpm vitest run backend/src/services/scanner/__tests__/
pnpm run build
```

---

### Slice B1: VWAP Reclaim & Fade Setup Types

**Audit Finding:** #8 (High) — Missing VWAP reclaim/fade setup types
**Agent:** 2 (Quant)

#### Objective

Add `vwap_reclaim` and `vwap_fade_at_band` to the setup detection system, leveraging the existing VWAP service.

#### Scope

**Files Modified:**
- `lib/types/spx-command-center.ts` — Add `'vwap_reclaim' | 'vwap_fade_at_band'` to `SetupType` union
- `backend/src/services/spx/setupDetector.ts` — Add VWAP setup detection functions
- `lib/spx/engine.ts` — Add delta target for new setup types in `chooseDeltaTarget()`
- `backend/src/services/levels/calculators/vwap.ts` — Ensure VWAP bands (1SD, 1.5SD, 2SD) are exposed
- New test file for VWAP setup detection

#### Implementation

**VWAP Reclaim Detection:**
```typescript
function detectVWAPReclaim(
  currentPrice: number,
  previousBarClose: number,
  vwap: number,
  direction: 'bullish' | 'bearish',
  vwapBand1SD: { upper: number; lower: number },
): boolean {
  if (direction === 'bullish') {
    // Price crossed above VWAP from below, confirmed by bar close
    return previousBarClose < vwap && currentPrice >= vwap && currentPrice < vwapBand1SD.upper;
  }
  // Price crossed below VWAP from above
  return previousBarClose > vwap && currentPrice <= vwap && currentPrice > vwapBand1SD.lower;
}
```

**VWAP Fade at Band Detection:**
```typescript
function detectVWAPFade(
  currentPrice: number,
  vwap: number,
  vwapBand15SD: { upper: number; lower: number },
  vwapBand2SD: { upper: number; lower: number },
): { detected: boolean; direction: 'bullish' | 'bearish' } {
  // Fade when price extends to 1.5-2SD from VWAP
  if (currentPrice >= vwapBand15SD.upper && currentPrice <= vwapBand2SD.upper) {
    return { detected: true, direction: 'bearish' }; // Fade the extension
  }
  if (currentPrice <= vwapBand15SD.lower && currentPrice >= vwapBand2SD.lower) {
    return { detected: true, direction: 'bullish' }; // Fade the extension
  }
  return { detected: false, direction: 'bullish' };
}
```

**Delta targets in engine.ts:**
```typescript
case 'vwap_reclaim':
  return 0.28
case 'vwap_fade_at_band':
  return 0.20
```

#### Acceptance Criteria

- [ ] `SetupType` includes `vwap_reclaim` and `vwap_fade_at_band`
- [ ] VWAP reclaim detects cross from below/above VWAP with bar-close confirmation
- [ ] VWAP fade detects extension to 1.5-2SD bands
- [ ] Entry zone: VWAP +/- 0.5 points for reclaim; band level +/- 1 point for fade
- [ ] Stop: 2 points beyond VWAP (reclaim) or 2SD band (fade)
- [ ] T1: VWAP +/- 1SD (reclaim); VWAP (fade)
- [ ] T2: VWAP +/- 1.5SD (reclaim); VWAP +/- 0.5SD (fade)
- [ ] Delta targets added to `chooseDeltaTarget()`
- [ ] Tests cover: reclaim bullish/bearish, fade at upper/lower band, edge cases

---

### Slice B2: Regime-Aware Setup TTL

**Audit Finding:** #12 (High) — 30-min setup expiry too aggressive
**Agent:** 2 (Quant)

#### Objective

Replace the fixed 30-minute TTL with regime-dependent expiry times.

#### Scope

**Files Modified:**
- `lib/spx/engine.ts` — Replace hardcoded 30-min TTL in `transitionSetupStatus()`
- `lib/spx/__tests__/setupLifecycle.test.ts` — Add regime-aware TTL tests

#### Implementation

```typescript
const REGIME_TTL_MS: Record<Regime, Record<SetupStatus, number>> = {
  trending:    { forming: 15 * 60_000, ready: 25 * 60_000, triggered: 20 * 60_000, invalidated: 0, expired: 0 },
  breakout:    { forming: 10 * 60_000, ready: 20 * 60_000, triggered: 15 * 60_000, invalidated: 0, expired: 0 },
  compression: { forming: 30 * 60_000, ready: 50 * 60_000, triggered: 30 * 60_000, invalidated: 0, expired: 0 },
  ranging:     { forming: 25 * 60_000, ready: 45 * 60_000, triggered: 25 * 60_000, invalidated: 0, expired: 0 },
}

// In transitionSetupStatus():
const regime = setup.regime ?? 'ranging'
const ttlMs = REGIME_TTL_MS[regime]?.[setup.status] ?? 30 * 60_000
if (setup.status !== 'triggered' && ageMs > ttlMs) {
  return 'expired'
}
```

#### Acceptance Criteria

- [ ] Compression setups: 50-min TTL in ready state (vs current 30-min)
- [ ] Trending setups: 25-min TTL in ready state
- [ ] Breakout setups: 20-min TTL in ready state
- [ ] Ranging setups: 45-min TTL in ready state
- [ ] Tests cover all regime × status combinations
- [ ] Backwards-compatible: setups without regime use 30-min default

---

### Slice B3: Regime Conflict Penalty Strengthening

**Audit Finding:** #11 (High) — Regime conflict penalty weak for counter-trend
**Agent:** 2 (Quant)

#### Objective

Strengthen the regime conflict penalty in the decision engine to properly penalize counter-trend setups.

#### Scope

**Files Modified:**
- `lib/spx/decision-engine.ts` — Enhance `regimeCompatibility()` and confidence calculation
- `lib/spx/__tests__/decision-engine.test.ts` — Add counter-trend penalty tests

#### Implementation

```typescript
function regimeCompatibility(setupRegime: Regime, activeRegime: Regime | null): number {
  if (!activeRegime) return 0.5
  if (setupRegime === activeRegime) return 1

  // Adjacent regimes (partially compatible)
  if (
    (setupRegime === 'trending' && activeRegime === 'breakout')
    || (setupRegime === 'breakout' && activeRegime === 'trending')
    || (setupRegime === 'compression' && activeRegime === 'ranging')
    || (setupRegime === 'ranging' && activeRegime === 'compression')
  ) {
    return 0.65
  }

  // Counter-trend (strongly incompatible) — NEW: harsher penalty
  if (
    (setupRegime === 'trending' && activeRegime === 'ranging')
    || (setupRegime === 'ranging' && activeRegime === 'trending')
    || (setupRegime === 'breakout' && activeRegime === 'compression')
    || (setupRegime === 'compression' && activeRegime === 'breakout')
  ) {
    return 0.15  // Was 0.3 — now much harsher
  }

  return 0.2  // Was 0.3 — slightly harsher default
}

// In confidence calculation, enhance regime penalty:
const regimePenalty = regimeScore < 0.45 ? 12 : regimeScore < 0.3 ? 18 : 0
// Was: regimePenalty = regimeScore < 0.45 ? 6 : 0
```

#### Acceptance Criteria

- [ ] Counter-trend regime compatibility returns 0.15 (down from 0.3)
- [ ] Regime penalty scales: 0 (aligned), 12 (mild conflict), 18 (strong conflict)
- [ ] Bearish fade during trending regime scores < 45% confidence
- [ ] Tests verify counter-trend penalty at each conflict level

---

### Slice B4: Mean Reversion Stop Distance Tightening

**Audit Finding:** #10 (High) — Mean reversion stop distance excessive
**Agent:** 2 (Quant)

#### Objective

Implement regime-aware adaptive stops for mean reversion setups, capping max stop distance.

#### Scope

**Files Modified:**
- Stop calculation logic (locate via grep for `mean_reversion` + `stop`)
- `lib/spx/risk-envelope.ts` (if stop logic resides here)
- Related test files

#### Implementation

```typescript
const MEAN_REVERSION_STOP_CONFIG: Record<Regime, { maxPoints: number; atrMultiple: number }> = {
  compression: { maxPoints: 8, atrMultiple: 0.8 },
  ranging:     { maxPoints: 9, atrMultiple: 1.0 },
  trending:    { maxPoints: 10, atrMultiple: 1.2 },
  breakout:    { maxPoints: 12, atrMultiple: 1.5 },
}

function calculateMeanReversionStop(
  entryPrice: number,
  direction: 'bullish' | 'bearish',
  atr: number,
  regime: Regime,
): number {
  const config = MEAN_REVERSION_STOP_CONFIG[regime] ?? MEAN_REVERSION_STOP_CONFIG.ranging
  const atrStop = atr * config.atrMultiple
  const clampedStop = Math.min(atrStop, config.maxPoints)

  return direction === 'bullish'
    ? entryPrice - clampedStop
    : entryPrice + clampedStop
}
```

#### Acceptance Criteria

- [ ] Mean reversion stops capped: 8pts compression, 9pts ranging, 10pts trending, 12pts breakout
- [ ] Stop distance uses min(ATR × multiple, max points)
- [ ] Tests verify each regime cap
- [ ] R:R improvement measurable in backtest (+0.25-0.40R average)

---

### Slice B5: Confluence Age Decay

**Audit Finding:** #16 (High) — Confluence age not decayed
**Agent:** 2 (Quant)

#### Objective

Implement time-based decay for confluence components so older signals lose weight.

#### Scope

**Files Modified:**
- `backend/src/services/spx/setupDetector.ts` — Add age-based decay to confluence scoring
- Related tests

#### Implementation

```typescript
function decayFactor(ageMs: number, halfLifeMs: number): number {
  if (ageMs <= 0) return 1
  return Math.exp(-0.693 * (ageMs / halfLifeMs))  // exponential decay with half-life
}

const CONFLUENCE_HALF_LIVES_MS = {
  flow: 2 * 60_000,       // Flow signals: 2-minute half-life
  gex: 15 * 60_000,       // GEX: 15-minute half-life
  regime: 10 * 60_000,    // Regime: 10-minute half-life
  ema: 5 * 60_000,        // EMA alignment: 5-minute half-life
  zone: 30 * 60_000,      // Zone quality: 30-minute half-life (structural, slow decay)
  memory: 60 * 60_000,    // Memory: 1-hour half-life (persistent)
}

// Apply decay to each confluence component before summing:
function computeDecayedConfluence(
  components: ConfluenceBreakdown,
  componentTimestamps: Record<string, number>,
  nowMs: number,
): number {
  let total = 0
  for (const [key, score] of Object.entries(components)) {
    const halfLife = CONFLUENCE_HALF_LIVES_MS[key] ?? 10 * 60_000
    const ageMs = nowMs - (componentTimestamps[key] ?? nowMs)
    total += score * decayFactor(ageMs, halfLife)
  }
  return Math.min(5, total)
}
```

#### Acceptance Criteria

- [ ] Each confluence component has a defined half-life
- [ ] Flow signals at 4-min age contribute 25% of original weight
- [ ] Zone quality at 30-min age contributes 50% of original weight
- [ ] Tests verify decay math and per-component half-lives
- [ ] Confluence score never exceeds 5 (capped)

---

### Slice B6: 0DTE IV Rank Calibration

**Audit Finding:** #13 (High) — 0DTE IV rank miscalibration
**Agent:** 2 (Quant)

#### Objective

Add terminal-velocity-aware IV scoring for 0DTE contracts within 60 minutes of market close.

#### Scope

**Files Modified:**
- `backend/src/services/options/ivAnalysis.ts` — Add 0DTE-specific IV acceleration model
- `backend/src/services/options/__tests__/ivAnalysis.test.ts` — Add 0DTE tests

#### Implementation

```typescript
function adjustIVRankFor0DTE(
  rawIVRank: number,
  minutesToClose: number,
  dte: number,
): number {
  if (dte > 0 || minutesToClose > 60) return rawIVRank

  // 0DTE within 60min of close: IV acceleration factor
  // IV rank becomes less meaningful as gamma dominates
  // Apply acceleration: IV rank matters less, realized vol matters more
  const accelerationFactor = 1 + (60 - minutesToClose) / 60 * 0.5  // 1.0-1.5x
  const gammaAdjustment = minutesToClose < 30 ? 0.8 : 0.9  // Discount IV rank in final 30min

  return Math.min(100, rawIVRank * gammaAdjustment * accelerationFactor)
}
```

#### Acceptance Criteria

- [ ] 0DTE contracts at 60+ minutes to close: IV rank unchanged
- [ ] 0DTE contracts at 30 minutes: IV rank discounted by 10% (gamma dominance)
- [ ] 0DTE contracts at 15 minutes: IV rank discounted by 20%
- [ ] Non-0DTE contracts: completely unaffected
- [ ] Tests cover boundary conditions

---

### Slice B7: Flow Bias EWMA Recency Weighting

**Audit Finding:** #31 (Medium, elevated to Phase 2) — Flow bias recency bias needs EWMA
**Agent:** 2 (Quant)

#### Objective

Replace flat averaging of flow events with exponentially weighted moving average so recent flow has more influence.

#### Scope

**Files Modified:**
- `lib/spx/decision-engine.ts` — Modify `flowAlignmentBias()` to use EWMA

#### Implementation

```typescript
function flowAlignmentBias(
  direction: Setup['direction'],
  flowEvents: FlowEvent[],
): number {
  const scoped = flowEvents.slice(0, 24)
  if (scoped.length === 0) return 0

  const decayFactor = 0.85  // More recent events weighted higher
  let weightedAligned = 0
  let weightedOpposing = 0
  let totalWeight = 0

  for (let i = 0; i < scoped.length; i++) {
    const weight = Math.pow(decayFactor, i)  // Most recent = index 0 = highest weight
    totalWeight += weight
    if (scoped[i].direction === direction) {
      weightedAligned += weight
    } else {
      weightedOpposing += weight
    }
  }

  return clamp((weightedAligned - weightedOpposing) / totalWeight, -1, 1)
}
```

#### Acceptance Criteria

- [ ] Most recent flow event has weight 1.0; 5th event ~0.44; 10th event ~0.20
- [ ] EWMA produces same sign as flat average for strongly directional flow
- [ ] Mixed flow converges to 0 faster than flat average
- [ ] Tests verify weighting and boundary conditions

---

### Slice B8: ORB Entry Zone Width Cap

**Audit Finding:** #32 (Medium) — ORB entry zone width uncapped
**Agent:** 2 (Quant)

#### Scope

**Files Modified:**
- ORB setup creation logic in setupDetector.ts

#### Implementation

```typescript
const ORB_ENTRY_ZONE_MAX_WIDTH_POINTS = 6  // Cap at 6 SPX points

function clampEntryZoneWidth(entryZone: { low: number; high: number }, maxWidth: number): { low: number; high: number } {
  const width = entryZone.high - entryZone.low
  if (width <= maxWidth) return entryZone
  const center = (entryZone.low + entryZone.high) / 2
  return { low: center - maxWidth / 2, high: center + maxWidth / 2 }
}
```

#### Acceptance Criteria

- [ ] ORB entry zones capped at 6 SPX points wide
- [ ] Wide ORBs are centered and clamped, not shifted
- [ ] Tests verify clamping behavior

---

### Slice B9: Trend Pullback EMA Fix

**Audit Finding:** #30 (Medium) — Trend pullback EMA check uses current price instead of bar close
**Agent:** 2 (Quant)

#### Scope

**Files Modified:**
- Trend pullback detection logic in setupDetector.ts

#### Implementation

Use `latestBarClose` instead of `currentPrice` for EMA alignment checks in trend_pullback detection.

#### Acceptance Criteria

- [ ] EMA alignment check uses bar close, not live price
- [ ] No behavior change for other setup types

---

### Slice B10: Display Policy Probability Metric Fix

**Audit Finding:** #29 (Medium) — Display policy uses wrong probability metric
**Agent:** 2 (Quant)

#### Scope

**Files Modified:**
- `lib/spx/setup-display-policy.ts` — Use `pWinCalibrated` instead of raw `probability`

#### Implementation

In display policy filtering, replace:
```typescript
// BEFORE
setup.probability >= REGIME_CONFLICT_CONFIDENCE_THRESHOLD
// AFTER
(setup.pWinCalibrated ?? setup.probability / 100) * 100 >= REGIME_CONFLICT_CONFIDENCE_THRESHOLD
```

#### Acceptance Criteria

- [ ] Display policy uses calibrated probability when available
- [ ] Fallback to raw probability when pWinCalibrated is null
- [ ] Tests updated

---

### Slice B11: Live Level/VWAP Updates from Tick Feed

**Audit Finding:** #9 (High) — Levels/VWAP not updated on live tick flow
**Agent:** 1 (Massive)

#### Objective

Update VWAP and intraday levels incrementally from live tick data instead of re-fetching via HTTP on every scan.

#### Scope

**Files Modified:**
- `backend/src/services/levels/calculators/vwap.ts` — Add incremental VWAP update function
- `backend/src/services/websocket.ts` — Feed ticks into VWAP updater
- Scanner functions — Read from cache instead of HTTP re-fetch

#### Implementation

```typescript
// Incremental VWAP update (O(1) per tick)
interface RunningVWAP {
  cumulativeTPV: number  // sum(typical_price × volume)
  cumulativeVolume: number
  value: number
  variance: number  // for bands
}

function updateVWAP(running: RunningVWAP, tick: { price: number; volume: number }): RunningVWAP {
  const newTPV = running.cumulativeTPV + tick.price * tick.volume
  const newVol = running.cumulativeVolume + tick.volume
  const newVWAP = newVol > 0 ? newTPV / newVol : tick.price

  // Running variance for bands
  const newVariance = running.cumulativeVolume > 0
    ? running.variance + tick.volume * (tick.price - running.value) * (tick.price - newVWAP)
    : 0

  return {
    cumulativeTPV: newTPV,
    cumulativeVolume: newVol,
    value: newVWAP,
    variance: newVariance,
  }
}
```

#### Acceptance Criteria

- [ ] VWAP updates incrementally from each tick (no HTTP re-fetch)
- [ ] VWAP bands (1SD, 1.5SD, 2SD) computed from running variance
- [ ] Scanner reads cached VWAP instead of calling HTTP endpoint
- [ ] VWAP resets at session open (9:30 ET)
- [ ] Tests verify incremental accuracy matches batch calculation

---

## Phase 3: Infrastructure & Resilience (Weeks 3-4)

### Objective

Address 9 findings related to system architecture: concurrency control, database performance, memory management, and resilience patterns.

### Success Metrics

| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|
| Scanner concurrent requests | Unbounded | Max 5 parallel | Telemetry |
| Failed event visibility | 0% | 100% (DLQ) | Dead-letter table count |
| Query time (tracked_setups) | Full scan | Index seek | EXPLAIN ANALYZE |
| Memory growth (24h) | Unknown | < 50MB growth | Process monitoring |

### Quality Gates (Phase 3 Release)

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm vitest run
pnpm run build
```

---

### Slice C1: Scanner Concurrency Limiter

**Audit Finding:** #17 (High)
**Agent:** 4 (Backend)

#### Scope

**Files Modified:**
- `backend/src/services/scanner/index.ts` — Add semaphore-based concurrency limiter

#### Implementation

```typescript
class Semaphore {
  private current = 0
  private queue: Array<() => void> = []

  constructor(private readonly max: number) {}

  acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++
      return Promise.resolve()
    }
    return new Promise(resolve => this.queue.push(resolve))
  }

  release(): void {
    this.current--
    const next = this.queue.shift()
    if (next) {
      this.current++
      next()
    }
  }
}

const SCANNER_CONCURRENCY = parseInt(process.env.SCANNER_CONCURRENCY ?? '5', 10)

export async function scanOpportunities(
  symbols: string[] = [...POPULAR_SYMBOLS],
  includeOptions = true,
): Promise<ScanResult> {
  const startTime = Date.now()
  const opportunities: Opportunity[] = []
  const semaphore = new Semaphore(SCANNER_CONCURRENCY)

  const scanPromises = symbols.map(async (symbol) => {
    await semaphore.acquire()
    try {
      const symbolOpps: Opportunity[] = []
      const technicalSetups = await runTechnicalScan(symbol)
      for (const setup of technicalSetups) symbolOpps.push(technicalToOpportunity(setup))
      if (includeOptions) {
        const optionsSetups = await runOptionsScan(symbol)
        for (const setup of optionsSetups) symbolOpps.push(optionsToOpportunity(setup))
      }
      return symbolOpps
    } finally {
      semaphore.release()
    }
  })

  const results = await Promise.allSettled(scanPromises)
  // ... (existing aggregation with logging from A3)
}
```

#### Acceptance Criteria

- [ ] Max 5 concurrent symbol scans (configurable via SCANNER_CONCURRENCY env var)
- [ ] All symbols eventually scanned (no starvation)
- [ ] Tests verify concurrency limit respected

---

### Slice C2: Dead-Letter Queue for Failed Events

**Audit Finding:** #19 (High)
**Agent:** 4 (Backend)

#### Scope

**Files Modified:**
- `supabase/migrations/YYYYMMDDHHMMSS_dead_letter_queue.sql` — Create DLQ table
- `backend/src/services/setupPushChannel.ts` — Write failed events to DLQ
- `backend/src/services/scanner/index.ts` — Write failed scans to DLQ

#### Migration

```sql
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  error_message text,
  error_stack text,
  source text NOT NULL,
  created_at timestamptz DEFAULT now(),
  retried_at timestamptz,
  retry_count int DEFAULT 0,
  resolved boolean DEFAULT false
);

CREATE INDEX idx_dlq_unresolved ON dead_letter_queue(resolved, created_at DESC) WHERE NOT resolved;

ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY dlq_service_role ON dead_letter_queue FOR ALL TO service_role USING (true);
```

#### Acceptance Criteria

- [ ] DLQ table created with RLS (service_role only)
- [ ] Failed publish events written to DLQ with full payload and error context
- [ ] Failed scans written to DLQ with symbol and scanner type
- [ ] Index on unresolved events for admin queries

---

### Slice C3: Circuit Breaker Threshold Adjustment

**Audit Finding:** #20 (High)
**Agent:** 4 (Backend)

#### Scope

**Files Modified:**
- `backend/src/lib/circuitBreaker.ts` — Adjust Massive.com circuit breaker parameters

#### Implementation

```typescript
export const massiveCircuit = new CircuitBreaker({
  name: 'Massive.com',
  failureThreshold: 3,      // Down from 5
  cooldownMs: 30_000,       // Up from 15s to 30s
  timeoutMs: 15_000,        // Up from 10s to 15s
});
```

#### Acceptance Criteria

- [ ] Circuit opens after 3 failures (not 5)
- [ ] Cooldown period is 30 seconds
- [ ] Request timeout is 15 seconds
- [ ] Tests verify threshold and cooldown behavior

---

### Slice C4: Database Index for Tracked Setups

**Audit Finding:** #22 (High)
**Agent:** 4 (Backend)

#### Scope

**Files Modified:**
- New migration: `supabase/migrations/YYYYMMDDHHMMSS_tracked_setups_status_index.sql`

#### Migration

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracked_setups_status_active
  ON ai_coach_tracked_setups(status, tracked_at DESC)
  WHERE status = 'active';
```

#### Acceptance Criteria

- [ ] Partial index created on status='active' with tracked_at DESC
- [ ] EXPLAIN ANALYZE shows index scan for status-only queries
- [ ] Existing queries unaffected

---

### Slice C5: WebSocket Listener Cleanup

**Audit Finding:** #21 (High)
**Agent:** 4 (Backend)

#### Scope

**Files Modified:**
- `backend/src/services/websocket.ts` — Add cleanup on disconnect and SIGTERM

#### Implementation

```typescript
// Track per-client subscriptions
const clientSubscriptions = new Map<WebSocket, Set<() => void>>();

function onClientDisconnect(ws: WebSocket): void {
  const subs = clientSubscriptions.get(ws);
  if (subs) {
    for (const unsub of subs) {
      try { unsub(); } catch { /* ignore cleanup errors */ }
    }
    clientSubscriptions.delete(ws);
  }
  clients.delete(ws);
}

process.on('SIGTERM', () => {
  for (const [ws, subs] of clientSubscriptions.entries()) {
    for (const unsub of subs) {
      try { unsub(); } catch { /* ignore */ }
    }
  }
  clientSubscriptions.clear();
  clients.clear();
});
```

#### Acceptance Criteria

- [ ] All subscriptions cleaned up on client disconnect
- [ ] Global cleanup on SIGTERM
- [ ] Memory growth < 50MB over 24 hours

---

### Slice C6: Scanner Timeout Wrappers

**Audit Finding:** #34 (Medium)
**Agent:** 4 (Backend)

#### Scope

**Files Modified:**
- `backend/src/services/scanner/technicalScanner.ts` — Add timeout to all API calls
- `backend/src/services/scanner/optionsScanner.ts` — Add timeout to all API calls

#### Implementation

```typescript
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ])
}

// Usage in each scanner:
const levelsData = await withTimeout(calculateLevels(symbol, 'intraday'), 5000, `Levels ${symbol}`)
```

#### Acceptance Criteria

- [ ] All external API calls wrapped with 5s timeout
- [ ] Timeout errors logged via scanner error logging (Slice A3)
- [ ] Tests verify timeout behavior

---

### Slice C7: Non-Deterministic ID Fix

**Audit Finding:** #33 (Medium)
**Agent:** 4 (Backend)

#### Scope

**Files Modified:**
- `backend/src/services/scanner/index.ts` — Use crypto.randomUUID() for opportunity IDs

#### Implementation

```typescript
import crypto from 'crypto'

id: `tech-${setup.symbol}-${setup.type}-${crypto.randomUUID()}`
id: `opt-${setup.symbol}-${setup.type}-${crypto.randomUUID()}`
```

#### Acceptance Criteria

- [ ] All opportunity IDs use UUID (no Date.now())
- [ ] No duplicate IDs possible

---

### Slice C8: Volatility Thresholds Symbol-Aware

**Audit Finding:** #35 (Medium)
**Agent:** 4 (Backend)

#### Scope

**Files Modified:**
- `backend/src/services/levels/calculators/atr.ts` — Make thresholds configurable per symbol

#### Implementation

```typescript
const VOLATILITY_THRESHOLDS: Record<string, { low: number; moderate: number; high: number }> = {
  SPX: { low: 30, moderate: 50, high: 70 },
  NDX: { low: 40, moderate: 70, high: 90 },
  SPY: { low: 3, moderate: 5, high: 7 },
  QQQ: { low: 4, moderate: 7, high: 10 },
}
```

#### Acceptance Criteria

- [ ] Thresholds defined for SPX, NDX, SPY, QQQ at minimum
- [ ] Unknown symbols fall back to SPX thresholds
- [ ] Tests verify each symbol's threshold range

---

### Slice C9: Poll Fallback Validation and Snapshot Max Age

**Audit Findings:** #26, #28 (Medium)
**Agent:** 1 (Massive)

#### Scope

**Files Modified:**
- `backend/src/services/websocket.ts` — Validate poll bar age, enforce snapshot max age
- `lib/spx/feed-health.ts` — Add snapshot age threshold

#### Implementation

```typescript
const POLL_BAR_MAX_AGE_MS = 120_000  // 2 minutes
const SNAPSHOT_MAX_AGE_MS = 300_000   // 5 minutes

function validatePollBar(bar: MassiveAggregate, nowMs: number): boolean {
  const barAge = nowMs - bar.t
  if (barAge > POLL_BAR_MAX_AGE_MS) {
    logger.warn('Poll fallback bar too old', { barAge, barTimestamp: bar.t })
    return false
  }
  return true
}
```

#### Acceptance Criteria

- [ ] Poll bars older than 2 minutes are rejected
- [ ] Snapshots older than 5 minutes transition to 'stale' health
- [ ] Tests verify age validation

---

## Phase 4: AI/ML Enhancement (Weeks 5-8)

### Objective

Replace hardcoded rule-based scoring with adaptive ML models trained on trade journal outcomes. 7 findings addressed.

### Prerequisites

- Trade journal with 500+ labeled outcomes (setup → win/loss/scratch)
- Supabase table for model weights and feature store
- Feature extraction pipeline from live and historical data

### Success Metrics

| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|
| Confidence calibration error | Unknown | < 5% | Brier score on validation set |
| Win rate lift | 0% (rule-based) | +8-15% | A/B test journal outcomes |
| Sharpe ratio | Current | +12-18% | Backtest with ML scoring |
| Anomaly detection lead time | 0 bars | 3-5 bars | Flow event backtest |

### Quality Gates (Phase 4 Release)

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm vitest run
pnpm run build
# ML-specific:
# python ml/evaluate.py --model confidence --dataset validation
# python ml/evaluate.py --model flow_anomaly --dataset validation
```

---

### Slice D1: Feature Extraction Pipeline

**Prerequisite for all ML work**

#### Objective

Build the feature extraction pipeline that transforms raw market data and setup state into ML model inputs.

#### Scope

**Files Created:**
- `lib/ml/feature-extractor.ts` — Core feature extraction functions
- `lib/ml/types.ts` — ML feature types
- `lib/ml/__tests__/feature-extractor.test.ts`

#### Implementation

```typescript
interface SetupFeatureVector {
  // Confluence features
  confluenceScore: number
  confluenceFlowAge: number
  confluenceEmaAlignment: number
  confluenceGexAlignment: number

  // Regime features
  regimeType: number  // one-hot encoded
  regimeCompatibility: number
  regimeAge: number

  // Flow features
  flowBias: number
  flowRecency: number
  flowVolume: number
  flowSweepCount: number

  // Price structure
  distanceToVWAP: number
  distanceToNearestCluster: number
  atr14: number
  atr7_14_ratio: number

  // Options features
  ivRank: number
  ivSkew: number
  putCallRatio: number
  netGex: number

  // Time features
  minutesIntoSession: number
  dayOfWeek: number
  dte: number

  // Memory features
  historicalWinRate: number
  historicalTestCount: number
  lastTestResult: number  // 1=win, 0=loss, -1=unknown
}

function extractFeatures(setup: Setup, context: SPXDecisionEngineContext): SetupFeatureVector {
  // ... extract all features from setup and context
}
```

#### Acceptance Criteria

- [ ] Feature vector defined with all 25+ features
- [ ] Extraction function handles null/missing data gracefully (defaults)
- [ ] Feature vectors serializable to JSON for training pipeline
- [ ] Tests verify extraction from sample setup + context

---

### Slice D2: ML Confidence Scoring Model

**Audit Finding:** #23 (High)
**Agent:** 3 (AI/ML)

#### Objective

Train and deploy a confidence scoring model to replace the hardcoded linear formula in `decision-engine.ts`.

#### Scope

**Files Created:**
- `lib/ml/confidence-model.ts` — Model inference (XGBoost weights loaded from Supabase)
- `lib/ml/model-loader.ts` — Load model weights from Supabase storage

**Files Modified:**
- `lib/spx/decision-engine.ts` — Use ML confidence when model available, fall back to rule-based

#### Implementation

```typescript
// In decision-engine.ts:
const mlConfidence = await predictConfidence(featureVector)
const confidence = mlConfidence !== null
  ? round(clamp(mlConfidence, 5, 95), 2)  // Use ML prediction
  : calculateRuleBasedConfidence(...)       // Fallback to existing formula
```

#### Training Pipeline (separate repo/notebook)

1. Extract labeled dataset from trade journal (setup features → outcome)
2. Train XGBoost/LightGBM classifier
3. Calibrate probabilities (Platt scaling)
4. Export model weights as JSON
5. Upload to Supabase storage
6. Inference loads weights on server start, refreshes daily

#### Acceptance Criteria

- [ ] Model loads weights from Supabase storage on startup
- [ ] ML confidence used when model available
- [ ] Rule-based fallback when model unavailable
- [ ] Brier score < 0.05 on validation set
- [ ] A/B flag to enable/disable ML scoring per user

---

### Slice D3: Flow Anomaly Detection

**Audit Finding:** #24 (High)
**Agent:** 3 (AI/ML)

#### Objective

Deploy Isolation Forest for unusual options flow detection, replacing the static 3x volume/OI threshold.

#### Scope

**Files Created:**
- `lib/ml/flow-anomaly-detector.ts` — Isolation Forest inference
- `backend/src/services/scanner/flowAnomalyScanner.ts` — New scanner module

**Files Modified:**
- `backend/src/services/scanner/optionsScanner.ts` — Replace `scanUnusualActivity` with ML version
- `backend/src/services/scanner/index.ts` — Register new scanner

#### Implementation

Feature vector for flow anomaly:
- Volume/OI z-score (60-day rolling)
- Premium momentum (5-bar)
- Spread tightening ratio
- Sweep intensity (count of sweeps in last 5 bars)
- Time-of-day normalized volume

#### Acceptance Criteria

- [ ] Anomaly score replaces static 3x threshold
- [ ] Anomaly boost integrated into setup confluence when aligned
- [ ] Tests with known anomalous flow patterns
- [ ] False positive rate < 5% on historical data

---

### Slice D4: Setup Performance Classifier

**Audit Finding:** #25 (High)
**Agent:** 3 (AI/ML)

#### Objective

Train multi-class classifier for setup tier ranking (sniper_primary, sniper_secondary, watchlist, skip).

#### Scope

**Files Created:**
- `lib/ml/tier-classifier.ts` — Tier prediction model
- Related tests

**Files Modified:**
- Setup tier assignment logic — Use ML tier when available

#### Acceptance Criteria

- [ ] Model predicts tier from setup features
- [ ] Setup-type-specific thresholds (fade_at_wall different from orb_breakout)
- [ ] Fallback to rule-based tiers when model unavailable
- [ ] +12-18% Sharpe improvement in backtest

---

### Slice D5: Multi-TF Confluence Neural Network

**Audit Finding:** #36 (Medium)
**Agent:** 3 (AI/ML)

#### Objective

Learn optimal timeframe weighting for confluence scoring via shallow neural network.

#### Scope

**Files Created:**
- `lib/ml/mtf-confluence-model.ts` — Multi-TF weighting model

#### Acceptance Criteria

- [ ] Model learns optimal 1m/5m/15m/1h weights from data
- [ ] Outperforms fixed weights on validation set
- [ ] Inference time < 1ms (shallow network)

---

### Slice D6: IV Time-Series Forecasting

**Audit Finding:** #38 (Medium)
**Agent:** 3 (AI/ML)

#### Objective

LSTM model for 1-hour-ahead IV prediction, improving options entry timing.

#### Scope

**Files Created:**
- `lib/ml/iv-forecast-model.ts` — IV prediction
- Integration with options contract recommendation

#### Acceptance Criteria

- [ ] Model predicts IV 1 hour ahead
- [ ] Integrates with contract recommendation to time entries
- [ ] +5-7% improvement in options P&L in backtest

---

### Slice D7: Low-Priority AI/ML Items

**Audit Findings:** #37 (RL stops), #40 (earnings NLP), #41 (dark pool)
**Agent:** 3 (AI/ML)

These items are tracked but deferred beyond the 8-week timeline. They will be evaluated after Phase 4 core ML models prove value.

#### Tracked Items

- **RL Stop Loss Optimization (#37):** Q-learning agent for adaptive stop placement. Requires 1000+ labeled trades. Deferred to Phase 5.
- **Earnings Sentiment NLP (#40):** News/earnings catalyst integration. Low priority until core setup quality is optimized. Deferred.
- **Dark Pool Sweep Recognition (#41):** Requires dark pool data feed (not currently available from Massive.com). Deferred until data source confirmed.

---

## Validation Gates (Full Release)

After all four phases are complete, run the full release validation:

```bash
# Lint
pnpm exec eslint .

# Type check
pnpm exec tsc --noEmit

# Build
pnpm run build

# Unit tests
pnpm vitest run

# SPX-specific tests
pnpm vitest run lib/spx/__tests__/
pnpm vitest run backend/src/services/scanner/__tests__/
pnpm vitest run backend/src/services/options/__tests__/

# E2E tests
pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1

# Database advisors
# Run get_advisors(type: "security") and get_advisors(type: "performance") via Supabase MCP
```

**Runtime Requirement:** All release evidence validated under Node >= 22.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Entry timing change reduces trigger count | Medium | High | A/B test with subset of users; measure total triggered vs. win rate |
| ML model drift after market regime change | Medium | Medium | Scheduled retraining pipeline; rule-based fallback always available |
| Massive.com API changes break scanner | Low | Critical | Circuit breaker + DLQ catch failures; version-pin API endpoints |
| VWAP incremental calculation drift | Low | Medium | Daily reconciliation check vs batch VWAP |
| Phase 4 ML models require more data than available | Medium | High | Start with 500+ trades; augment with synthetic replay data |
| Concurrency limiter causes scan timeouts | Low | Medium | Configurable via env var; monitor scan duration telemetry |

---

## Decision Log

| Date | Decision | Rationale | Owner |
|------|----------|-----------|-------|
| 2026-02-24 | Entry timing is highest-leverage fix | Cross-agent compound analysis shows 18-22% false trigger reduction | Orchestrator |
| 2026-02-24 | Phase order: Critical → Logic → Infra → ML | Dependencies require critical data integrity before logic refinement | Orchestrator |
| 2026-02-24 | ML models use rule-based fallback | Zero-downtime deployment; gradual rollout with A/B testing | Orchestrator |
| 2026-02-24 | VWAP patterns added in Phase 2 | Largest untapped edge (+8-12 setups/day) but depends on tick feed reliability from Phase 1 | Orchestrator |

---

## Closure Criteria

This workstream is complete when:

1. [ ] All Phase 1 slices (A1-A7) are green under validation gates
2. [ ] All Phase 2 slices (B1-B11) are green under validation gates
3. [ ] All Phase 3 slices (C1-C9) are green under validation gates
4. [ ] Phase 4 slices (D1-D6) deployed with A/B testing enabled
5. [ ] 30-day backtest shows false positive rate < 8%
6. [ ] 30-day journal tracking shows win rate improvement of +5% or more
7. [ ] Dead-letter queue has 0 unresolved events over 48-hour window
8. [ ] Release notes and runbook are current
9. [ ] Production deploy approval explicitly recorded

---

*Spec generated: 2026-02-24*
*Source: Multi-Agent Audit Report (SETUP_DETECTION_AUDIT_2026-02-24.md)*
*Next action: Phase 1 Slice A1 implementation*
