# SPX Command Center Expert — Phase 1 Slice P1-S2
Date: 2026-02-28
Slice: `P1-S2`
Status: Completed
Owner: Codex

## 1. Slice Objective
Implement a pure backend lifecycle assembly service that builds a canonical `TradeStreamSnapshot` from setups plus optional historical past/resolution records with deterministic ordering and now-focus selection.

## 2. Scope
1. Add `backend/src/services/spx/tradeStream.ts` with pure assembly helpers.
2. Add unit tests in `backend/src/services/spx/__tests__/tradeStream.test.ts`.
3. Keep this slice backend-only with no route wiring and no frontend changes.

## 3. Files Touched
1. `backend/src/services/spx/tradeStream.ts` (new)
2. `backend/src/services/spx/__tests__/tradeStream.test.ts` (new)
3. `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE1_SLICE_P1-S2_2026-02-28.md` (new)

## 4. Implementation Notes
1. Added `buildTradeStreamSnapshot(...)` as a pure assembly function with no Express or I/O dependencies.
2. Added lifecycle mapping:
   - `forming`: active non-triggered setup candidates (`forming` / `ready`).
   - `triggered`: active triggered candidates.
   - `past`: invalidated, expired, and resolved records (including optional past/resolution inputs).
3. Added deterministic sort contract:
   - Global order: `forming -> triggered -> past`.
   - Within lifecycle: `momentPriority` descending, then lifecycle-specific timing key, then `stableIdHash` ascending.
4. Added now-focus selector comparator that is urgency-first and intentionally excludes lifecycle rank as a tie-break.
5. Added `countsByLifecycle` derivation helper and snapshot composition for `nowFocusItemId` and counts.

## 5. Validation

### 5.1 Commands
```bash
pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit --strict
pnpm --dir /Users/natekahl/ITM-gd/backend test -- src/services/spx/__tests__/tradeStream.test.ts
pnpm exec tsc --noEmit
```

### 5.2 Command Outputs
```bash
$ pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit --strict
# (no output; exit 0)
```

```bash
$ pnpm --dir /Users/natekahl/ITM-gd/backend test -- src/services/spx/__tests__/tradeStream.test.ts
WARN Unsupported engine: wanted: {"node":">=22.0.0"} (current: {"node":"v20.19.5","pnpm":"10.29.1"})

> titm-ai-coach-backend@1.0.0 test /Users/natekahl/ITM-gd/backend
> jest -- src/services/spx/__tests__/tradeStream.test.ts

PASS src/services/spx/__tests__/tradeStream.test.ts
  spx/tradeStream
    ✓ orders unordered mixed input by lifecycle, urgency, timing, and stable hash deterministically (8 ms)
    ✓ selects now focus by urgency-first comparator without lifecycle-rank tie breaks (1 ms)
    ✓ derives countsByLifecycle from mapped lifecycle states
    ✓ returns an empty snapshot contract when no inputs are provided (1 ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Snapshots:   0 total
Time:        1.335 s
Ran all test suites matching /src\/services\/spx\/__tests__\/tradeStream.test.ts/i.
```

```bash
$ pnpm exec tsc --noEmit
# (no output; exit 0)
```

## 6. Risks and Notes
1. Local validation still runs under Node `v20.19.5`; package engine expects `>=22.0.0`.
2. `momentPriority` for setups defaults to a deterministic weighted fallback when not provided, but final route integration (`P1-S3`) may replace this with a dedicated urgency model.
3. Deduplication currently keys on `stableIdHash`, with past/resolution records overriding active setup entries for the same stable hash.

## 7. Next Slice
`P1-S3`: wire `/api/spx/trade-stream` route to this assembly service and map live freshness/trust metadata at runtime.
