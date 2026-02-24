# Claude Code Orchestrator Prompt: Setup Detection Optimization

> **Usage:** Copy everything below the line into a Claude Code session at the repo root.
> **Prerequisites:** Node >= 22, pnpm 10+, all env vars configured, Supabase MCP connected.
> **Governing Spec:** `docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md`
> **Audit Report:** `docs/specs/SETUP_DETECTION_AUDIT_2026-02-24.md`

---

## PROMPT START

You are the **Orchestrator Agent** for the Setup Detection System Optimization workstream. Your job is to implement all 34 slices across 4 phases defined in `docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md`, coordinating specialized sub-agents while maintaining production quality gates.

Read these files before doing anything else:
1. `CLAUDE.md` — Full project codex (stack, conventions, multi-agent rules, quality gates)
2. `docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md` — The governing execution spec
3. `docs/specs/SETUP_DETECTION_AUDIT_2026-02-24.md` — The audit findings for context

### YOUR OPERATING RULES

1. **Spec is law.** Every slice has defined scope, files, acceptance criteria, and validation gates. Do not deviate. If a slice is ambiguous, read the referenced source files to resolve ambiguity before coding.
2. **One slice at a time.** Complete the current slice's implementation, tests, and validation gate before advancing. Never batch multiple slices.
3. **File ownership is strict.** See Section 7.2 of CLAUDE.md. Delegate to sub-agents by domain. Never let a backend agent touch `app/**` or a frontend agent touch `backend/**`.
4. **Tests are mandatory.** Every slice must add or update tests. No slice is complete without green validation gates.
5. **Commit per slice.** Each completed slice gets its own git commit with a descriptive message referencing the slice ID (e.g., "A1: Add candle-close entry confirmation").
6. **No silent failures.** If a validation gate fails, stop, diagnose, fix, and re-run. Do not proceed with red gates.

---

### PHASE 1: CRITICAL FIXES (Slices A1-A7)

Execute these sequentially. Each slice has explicit file paths, implementation details, and acceptance criteria in the spec.

#### Slice A1 — Candle-Close Entry Confirmation

Spawn an **SPX Engine Agent** (opus):

```
You are the SPX Engine Agent. Implement Slice A1 from the execution spec.

OBJECTIVE: Replace price-touch triggering with candle-close confirmation in transitionSetupStatus().

READ FIRST:
- docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md (Slice A1 section)
- lib/spx/engine.ts (full file — this is your primary target)
- lib/spx/__tests__/setupLifecycle.test.ts (existing tests you must not break)
- lib/types/spx-command-center.ts (Setup type definition for context)

IMPLEMENT:
1. Add `barConfirmed?: boolean` and `latestBarClose?: number` to the context parameter of transitionSetupStatus()
2. Use latestBarClose (when provided) instead of currentPrice for entry zone check
3. Only transition to 'triggered' when barConfirmed is not explicitly false
4. When barConfirmed is undefined, preserve existing behavior (backwards compatibility)

TESTS — Add these cases to setupLifecycle.test.ts:
- barConfirmed=true + close in zone → triggered
- barConfirmed=false + price in zone → stays ready (NOT triggered)
- barConfirmed=undefined + price in zone → triggered (legacy behavior)
- latestBarClose outside zone + currentPrice inside zone + barConfirmed=true → stays ready
- Zone boundary: close exactly at entryZone.low and entryZone.high

VALIDATION GATE:
pnpm exec eslint lib/spx/engine.ts
pnpm exec tsc --noEmit
pnpm vitest run lib/spx/__tests__/setupLifecycle.test.ts

Run the gate. All must pass. Report exact results.

DO NOT modify any files outside lib/spx/engine.ts and lib/spx/__tests__/setupLifecycle.test.ts.
```

After the SPX Engine Agent completes, verify the gate yourself, then commit:
```bash
git add lib/spx/engine.ts lib/spx/__tests__/setupLifecycle.test.ts
git commit -m "A1: Add candle-close entry confirmation to transitionSetupStatus

Replace price-touch triggering with bar-close confirmation. Adds barConfirmed
and latestBarClose params. Only triggers when confirming bar closes in entry
zone. Backwards-compatible when barConfirmed is undefined.

Ref: SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC slice A1
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

#### Slice A2 — Sequence Gap Off-By-One Fix

Spawn an **SPX Engine Agent** (opus):

```
You are the SPX Engine Agent. Implement Slice A2 from the execution spec.

OBJECTIVE: Fix the off-by-one error in detectSPXSequenceGap() so single dropped ticks are flagged.

READ FIRST:
- docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md (Slice A2 section)
- lib/spx/market-data-orchestrator.ts (full file)
- lib/spx/__tests__/market-data-orchestrator.test.ts (existing tests)

IMPLEMENT:
In detectSPXSequenceGap (line ~26), change:
  return nextSequence > previousSequence + tolerance + 1
To:
  const expectedNext = previousSequence + 1
  return nextSequence > expectedNext + tolerance

This ensures tolerance=0 catches sequence 100→102 as a gap (expected 101).

TESTS — Add these cases:
- Sequence 100 → 102, tolerance=0 → gap detected (TRUE) — was previously missed
- Sequence 100 → 101, tolerance=0 → no gap (FALSE)
- Sequence 100 → 103, tolerance=1 → gap detected (TRUE)
- Sequence 100 → 102, tolerance=1 → no gap (FALSE)
- Both null → no gap (FALSE)
- Previous null, next=5 → no gap (FALSE)

VALIDATION GATE:
pnpm exec eslint lib/spx/market-data-orchestrator.ts
pnpm vitest run lib/spx/__tests__/market-data-orchestrator.test.ts

Run the gate. Report exact results.

DO NOT modify files outside lib/spx/market-data-orchestrator.ts and its test file.
```

Verify gate, commit as `"A2: Fix sequence gap off-by-one in detectSPXSequenceGap"`.

---

#### Slice A3 — Scanner Error Logging

Spawn a **Backend Agent** (sonnet):

```
You are the Backend Agent. Implement Slice A3 from the execution spec.

OBJECTIVE: Add structured logging to all 9 scanner catch blocks and log rejected promises.

READ FIRST:
- docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md (Slice A3 section)
- backend/src/services/scanner/technicalScanner.ts (7 catch blocks to fix)
- backend/src/services/scanner/optionsScanner.ts (2 catch blocks to fix)
- backend/src/services/scanner/index.ts (Promise.allSettled rejection logging)
- backend/src/lib/logger.ts (understand the logger interface)

IMPLEMENT:
1. In technicalScanner.ts, replace every bare `catch { return null; }` with:
   catch (error) {
     logger.warn('Scanner failed: <scanner_name>', {
       scanner: '<scanner_name>',
       symbol,
       error: error instanceof Error ? error.message : String(error),
       stack: error instanceof Error ? error.stack : undefined,
     });
     return null;
   }
   Do this for all 7 functions: scanSupportBounce, scanResistanceRejection, scanBreakout, scanBreakdown, scanVolumeSpike, scanMACrossover, scanRSIDivergence.

2. In optionsScanner.ts, same pattern for: scanHighIV, scanUnusualActivity.

3. In index.ts, after the Promise.allSettled loop, add logging for rejected results:
   if (result.status === 'rejected') {
     logger.warn('Symbol scan failed', {
       reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
     });
   }

4. Add the logger import to any file that doesn't already have it.

VALIDATION GATE:
pnpm exec eslint backend/src/services/scanner/
pnpm exec tsc --noEmit
pnpm vitest run backend/src/services/scanner/__tests__/scanner.test.ts

DO NOT change any functional behavior. Only add logging. Return null is preserved.
DO NOT modify files outside backend/src/services/scanner/.
```

Verify gate, commit as `"A3: Add structured error logging to all scanner catch blocks"`.

---

#### Slice A4 — Setup Push Channel Race Condition

Spawn a **Backend Agent** (sonnet):

```
You are the Backend Agent. Implement Slice A4 from the execution spec.

OBJECTIVE: Fix iterator invalidation in setupPushChannel.ts by snapshotting listeners before broadcast.

READ FIRST:
- docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md (Slice A4)
- backend/src/services/setupPushChannel.ts (full file)
- backend/src/services/__tests__/setupPushChannel.test.ts (existing tests)

IMPLEMENT:
Find the function(s) that iterate over the listeners set and broadcast events. Modify to:
1. Create a snapshot: `const snapshot = Array.from(listeners);`
2. Iterate over the snapshot instead of the live set
3. Wrap each listener call in try-catch with logger.warn

TESTS — Add:
- Test that subscribing a new listener during broadcast doesn't crash
- Test that unsubscribing during broadcast doesn't skip listeners or crash
- Test that a throwing listener doesn't prevent other listeners from receiving the event

VALIDATION GATE:
pnpm exec eslint backend/src/services/setupPushChannel.ts
pnpm vitest run backend/src/services/__tests__/setupPushChannel.test.ts

DO NOT modify files outside backend/src/services/setupPushChannel.ts and its test file.
```

Verify gate, commit as `"A4: Fix race condition in setup push channel listener iteration"`.

---

#### Slice A5 — WebSocket Auth-Before-Subscribe

Spawn a **Backend Agent** (opus — this is architecturally complex):

```
You are the Backend Agent. Implement Slice A5 from the execution spec.

OBJECTIVE: Ensure Massive.com WebSocket auth completes before sending subscriptions.

READ FIRST:
- docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md (Slice A5)
- backend/src/services/websocket.ts (full file — find the Massive.com WS connection logic)
- backend/src/config/massive.ts (API config, understand auth params)

IMPLEMENT:
1. Add a connection state machine: 'connecting' | 'authenticating' | 'authenticated' | 'subscribing' | 'active' | 'error'
2. On WebSocket open: send auth message, set state to 'authenticating', start 5s timeout
3. On message: if state is 'authenticating' and message is auth_success → set state 'authenticated', call sendSubscriptions()
4. On auth failure or timeout → log error, close socket, schedule reconnect
5. Only process tick/aggregate messages when state is 'active'
6. sendSubscriptions() sets state to 'subscribing', sends subscribe payload, transitions to 'active' after 3s (Massive.com doesn't always ack subscriptions)

IMPORTANT CONSTRAINTS:
- Examine the actual Massive.com WebSocket message format before implementing. The auth response format may be `[{ev: 'status', status: 'auth_success'}]` or similar — check the existing parsing code.
- Do not break the existing polling fallback. If WebSocket fails, polling must still work.
- Make AUTH_ACK_TIMEOUT_MS configurable via env var (default 5000).
- Log all state transitions at info level.

VALIDATION GATE:
pnpm exec eslint backend/src/services/websocket.ts
pnpm exec tsc --noEmit

If there are existing WebSocket tests, run them. If not, add at minimum:
- Test: auth timeout triggers reconnect (not hang)
- Test: auth failure transitions to error state
- Test: subscribe only called after auth success

DO NOT modify files outside backend/src/services/websocket.ts and its test file.
```

Verify gate, commit as `"A5: Implement auth-before-subscribe sequencing for Massive.com WebSocket"`.

---

#### Slice A6 — ORB Breakout Gate Restoration

Spawn an **SPX Engine Agent** (sonnet):

```
You are the SPX Engine Agent. Implement Slice A6 from the execution spec.

OBJECTIVE: Restore ORB breakout detection gates to quality-preserving thresholds.

READ FIRST:
- docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md (Slice A6)
- Search for ORB configuration: grep -r "orb" --include="*.ts" for minConfluenceScore, minAlignmentPct, requireEmaAlignment, maxFirstSeenMinuteEt
- lib/spx/__tests__/orb-gate-relaxation.test.ts (existing tests — read to understand what changed)

IMPLEMENT:
Find the ORB configuration constants and set:
- minConfluenceScore: 3.5 (restore from 3)
- minAlignmentPct: 52 (restore from 45)
- requireEmaAlignment: true (re-enable, was disabled)
- emaGraceWindowMinutes: 30 (keep existing grace window)
- maxFirstSeenMinuteEt: 120 (tighten from 165)

UPDATE TESTS:
- Update orb-gate-relaxation.test.ts to expect the new thresholds
- Add test: ORB with confluence 3.2 is rejected (below 3.5)
- Add test: ORB with alignment 48% is rejected (below 52%)
- Add test: ORB at minute 130 is rejected (above 120)
- Add test: ORB without EMA alignment but within 30min grace → accepted

VALIDATION GATE:
pnpm exec eslint <modified files>
pnpm vitest run lib/spx/__tests__/orb-gate-relaxation.test.ts
```

Verify gate, commit as `"A6: Restore ORB breakout gates — confluence 3.5, alignment 52%, EMA required"`.

---

#### Slice A7 — Confluence Score Inflation Fix

Spawn an **SPX Engine Agent** (sonnet):

```
You are the SPX Engine Agent. Implement Slice A7 from the execution spec.

OBJECTIVE: Gate the memory edge confluence bonus on regime alignment and minimum sample size.

READ FIRST:
- docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md (Slice A7)
- Search for memory edge in the setup detection pipeline: grep -r "memory_edge\|memoryContext\|memory.*confluence" --include="*.ts"
- lib/spx/__tests__/confluenceScore.test.ts (existing tests)

IMPLEMENT:
Find where memory edge adds to confluence and replace the unconditional +1 with:
1. Require memoryContext.winRate >= 0.55
2. Require memoryContext.totalTests >= 5
3. Require regime compatibility >= 0.65 (you'll need to pass this in or compute it)
4. Scale bonus: Math.min(1, (winRate - 0.5) * 2) instead of flat +1
5. Update confluenceBreakdown.memory with the scaled value

TESTS:
- winRate=0.60, tests=10, regime=0.8 → bonus = 0.2
- winRate=0.75, tests=8, regime=0.7 → bonus = 0.5
- winRate=0.50, tests=10, regime=0.8 → bonus = 0 (below 0.55 threshold)
- winRate=0.70, tests=3, regime=0.8 → bonus = 0 (below 5 test minimum)
- winRate=0.70, tests=10, regime=0.4 → bonus = 0 (below regime threshold)

VALIDATION GATE:
pnpm exec eslint <modified files>
pnpm vitest run lib/spx/__tests__/confluenceScore.test.ts
```

Verify gate, commit as `"A7: Gate memory edge confluence on regime alignment and sample size"`.

---

### PHASE 1 RELEASE GATE

After all A1-A7 slices are committed, run the full Phase 1 release gate:

```bash
pnpm exec eslint lib/spx/engine.ts lib/spx/market-data-orchestrator.ts backend/src/services/scanner/ backend/src/services/setupPushChannel.ts backend/src/services/websocket.ts
pnpm exec tsc --noEmit
pnpm vitest run lib/spx/__tests__/
pnpm vitest run backend/src/services/scanner/__tests__/
pnpm vitest run backend/src/services/__tests__/setupPushChannel.test.ts
pnpm run build
```

If all green, update the execution spec status for Phase 1 from PROPOSED to COMPLETE, then proceed to Phase 2.

---

### PHASE 2: TRADING LOGIC (Slices B1-B11)

For Phase 2, you have more latitude to parallelize independent slices. Here are the dependency chains:

**Independent (can run in parallel):**
- B1 (VWAP setups) — needs only type changes + new detection code
- B3 (Regime penalties) — modifies decision-engine.ts only
- B4 (Mean reversion stops) — modifies stop/risk logic only
- B6 (0DTE IV calibration) — modifies ivAnalysis.ts only
- B7 (Flow bias EWMA) — modifies decision-engine.ts flowAlignmentBias only
- B8 (ORB zone cap) — modifies setupDetector.ts ORB section only
- B9 (Trend pullback EMA) — modifies setupDetector.ts pullback section only
- B10 (Display policy fix) — modifies setup-display-policy.ts only

**Sequential (depends on earlier slices):**
- B2 (Regime-aware TTL) depends on A1 (entry timing)
- B5 (Confluence decay) depends on A7 (confluence fix)
- B11 (Live VWAP from ticks) depends on B1 (VWAP types)

#### Sub-Agent Assignments for Phase 2:

**SPX Engine Agent (opus)** — Owns: B1, B2, B3, B4, B5, B7, B10
```
You are the SPX Engine Agent for Phase 2. Implement slices B1, B2, B3, B4, B5, B7, and B10 from the execution spec, in that order. Read the full spec first.

FILE OWNERSHIP — you may only modify:
- lib/spx/** (engine.ts, decision-engine.ts, setup-display-policy.ts, risk-envelope.ts)
- lib/types/spx-command-center.ts (type additions only — SetupType union)
- lib/spx/__tests__/** (all test files in this directory)

For each slice:
1. Read the spec section
2. Read all referenced source files
3. Implement the change
4. Write or update tests per acceptance criteria
5. Run the validation gate
6. Report: slice ID, files changed, tests added, gate result (pass/fail)

Start with B1 (VWAP types) since B5 depends on A7 and B2 depends on A1 (already complete from Phase 1).
```

**Backend Agent (sonnet)** — Owns: B6, B8, B9, B11
```
You are the Backend Agent for Phase 2. Implement slices B6, B8, B9, and B11 from the execution spec, in that order. Read the full spec first.

FILE OWNERSHIP — you may only modify:
- backend/src/services/** (options/, scanner/, levels/, spx/)
- backend/src/services/**/__tests__/**

For each slice:
1. Read the spec section
2. Read all referenced source files
3. Implement the change
4. Write or update tests
5. Run the validation gate
6. Report: slice ID, files changed, tests added, gate result

Start B11 last — it depends on B1 (VWAP types) from the SPX Engine Agent.
```

After both agents complete, run the Phase 2 release gate:
```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm vitest run lib/spx/__tests__/
pnpm vitest run backend/src/services/scanner/__tests__/
pnpm vitest run backend/src/services/options/__tests__/
pnpm run build
```

Commit each slice individually with the pattern: `"B<N>: <description>"`.

---

### PHASE 3: INFRASTRUCTURE (Slices C1-C9)

Most of these are independent. Parallelize aggressively.

**Backend Agent (sonnet)** — Owns: C1, C3, C5, C6, C7, C8, C9
```
You are the Backend Agent for Phase 3. Implement slices C1, C3, C5, C6, C7, C8, C9 from the execution spec. Read the full spec first.

FILE OWNERSHIP:
- backend/src/services/scanner/** (C1, C6, C7)
- backend/src/lib/circuitBreaker.ts (C3)
- backend/src/services/websocket.ts (C5, C9)
- backend/src/services/levels/calculators/atr.ts (C8)

For each slice: read spec → implement → test → validate → report.

Priority order: C1 (concurrency) → C3 (circuit breaker) → C5 (memory) → C6 (timeouts) → C7 (UUIDs) → C8 (thresholds) → C9 (validation).
```

**Database Agent (sonnet)** — Owns: C2, C4
```
You are the Database Agent for Phase 3. Implement slices C2 and C4 from the execution spec.

FILE OWNERSHIP:
- supabase/migrations/** (new migration files only)

IMPLEMENT C2 — Dead-Letter Queue:
1. Create migration: supabase/migrations/<next_timestamp>_dead_letter_queue.sql
2. Table: dead_letter_queue with columns: id (uuid PK), event_type (text), payload (jsonb), error_message (text), error_stack (text), source (text), created_at (timestamptz), retried_at (timestamptz), retry_count (int default 0), resolved (boolean default false)
3. Index: idx_dlq_unresolved ON dead_letter_queue(resolved, created_at DESC) WHERE NOT resolved
4. RLS: Enable, service_role only policy
5. Use the apply_migration MCP tool to apply

IMPLEMENT C4 — Tracked Setups Index:
1. Create migration: supabase/migrations/<next_timestamp>_tracked_setups_status_index.sql
2. Partial index: idx_tracked_setups_status_active ON ai_coach_tracked_setups(status, tracked_at DESC) WHERE status = 'active'
3. Apply via MCP tool

After applying, run get_advisors for both security and performance to verify.
```

Phase 3 release gate:
```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm vitest run
pnpm run build
```

---

### PHASE 4: AI/ML (Slices D1-D7)

Phase 4 is sequential because each slice builds on the previous.

**SPX Engine Agent (opus)** — Owns: D1, D2, D4, D5
```
You are the SPX Engine Agent for Phase 4 (AI/ML). Implement slices D1, D2, D4, D5 from the execution spec, in order. D1 (feature extraction) must complete first as all other ML slices depend on it.

FILE OWNERSHIP:
- lib/ml/** (new directory — create it)
- lib/spx/decision-engine.ts (D2 integration point)

For D1: Create lib/ml/types.ts and lib/ml/feature-extractor.ts with the full SetupFeatureVector interface and extraction function. Add comprehensive tests.

For D2: Create lib/ml/confidence-model.ts with model inference. Modify decision-engine.ts to use ML confidence when available, falling back to rule-based. Add A/B flag.

For D4: Create lib/ml/tier-classifier.ts.
For D5: Create lib/ml/mtf-confluence-model.ts.

Each model must have: type definitions, inference function, rule-based fallback, comprehensive tests.
```

**Backend Agent (sonnet)** — Owns: D3, D6
```
You are the Backend Agent for Phase 4 (AI/ML). Implement slices D3 and D6 from the execution spec.

FILE OWNERSHIP:
- backend/src/services/scanner/flowAnomalyScanner.ts (new file, D3)
- backend/src/services/scanner/optionsScanner.ts (D3 integration)
- backend/src/services/scanner/index.ts (D3 registration)
- backend/src/services/options/ivAnalysis.ts (D6)

For D3: Create the flow anomaly detection scanner using Isolation Forest-style anomaly scoring. Replace the static 3x volume/OI threshold in scanUnusualActivity with the ML-based anomaly score.

For D6: Add IV time-series features to the options analysis pipeline.
```

Phase 4 release gate — same as full release gate in the spec.

---

### ORCHESTRATOR CHECKLIST

After each phase, update this tracker:

- [ ] Phase 1 complete — 7 slices, release gate green
- [ ] Phase 2 complete — 11 slices, release gate green
- [ ] Phase 3 complete — 9 slices, release gate green (+ DB migrations applied)
- [ ] Phase 4 complete — 7 slices, release gate green (+ ML models with fallbacks)
- [ ] Full release gate green under Node >= 22
- [ ] All 34 commits present with slice IDs
- [ ] Execution spec updated: status PROPOSED → COMPLETE
- [ ] No lint warnings in touched files
- [ ] No `any` types in new code
- [ ] Build succeeds: `pnpm run build`
- [ ] Unit tests pass: `pnpm vitest run`
- [ ] E2E tests pass: `pnpm exec playwright test e2e/spx-*.spec.ts --project=chromium --workers=1`

### CONTEXT COMPACTION SURVIVAL

If context compacts mid-session, preserve:
- Current phase and slice ID
- Files modified so far and their purposes
- Which validation gates have passed
- Active branch and commit history
- Reference: `docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md`

### BEGIN

Start with Phase 1, Slice A1. Read the governing spec now, then spawn the SPX Engine Agent for A1.
