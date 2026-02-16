# SPX Command Center Deterministic Stabilization (2026-02-16)

## Objective
- Remove non-deterministic SPX compute fan-out behavior.
- Stop websocket/retry storms when upstream SPX services are degraded.
- Enforce actionable setup/contract semantics consistently across backend and frontend.
- Align coach streaming behavior with the backend SSE contract.

## Implemented Changes

### 0) Deterministic snapshot graph (phase 2)
- Reworked `getSPXSnapshot()` to compute dependencies in a single explicit order and pass those precomputed values downstream:
  - GEX → Basis → Fib → Levels → Regime → Setups → Prediction → Flow/Coach
- Snapshot now avoids recursive SPX service fan-out by reusing precomputed dependency payloads across services.
- Updated:
  - `backend/src/services/spx/index.ts`
  - `backend/src/services/spx/types.ts`

### 0.1) Precomputed dependency injection support
- Added optional precomputed-input support to SPX services so callers can reuse one computed graph without nested recomputation:
  - `backend/src/services/spx/crossReference.ts`
  - `backend/src/services/spx/fibEngine.ts`
  - `backend/src/services/spx/levelEngine.ts`
  - `backend/src/services/spx/regimeClassifier.ts`
  - `backend/src/services/spx/setupDetector.ts`
  - `backend/src/services/spx/aiPredictor.ts`
  - `backend/src/services/spx/aiCoach.ts`
  - `backend/src/services/spx/flowEngine.ts`
- Added `UnifiedGEXLandscape` type in `backend/src/services/spx/types.ts`.
- Cache behavior now avoids short-circuiting to unrelated cached payloads when precomputed dependencies are explicitly supplied.

### 1) Single-flight execution for SPX compute graph
- Added in-flight promise deduplication to prevent duplicate concurrent recomputation:
  - `backend/src/services/spx/index.ts`
  - `backend/src/services/spx/gexEngine.ts`
  - `backend/src/services/spx/crossReference.ts`
  - `backend/src/services/spx/fibEngine.ts`
  - `backend/src/services/spx/levelEngine.ts`
  - `backend/src/services/spx/regimeClassifier.ts`
  - `backend/src/services/spx/setupDetector.ts`
  - `backend/src/services/spx/aiPredictor.ts`
  - `backend/src/services/spx/flowEngine.ts`
  - `backend/src/services/spx/aiCoach.ts`

### 2) Contract recommendation gating and recursion reduction
- Added setup status gating in contract selector backend (`ready` / `triggered` only):
  - `backend/src/services/spx/contractSelector.ts`
- Added optional direct setup injection to avoid redundant setup lookups when setup is already known.
- Updated call sites to pass setup directly where available:
  - `backend/src/services/spx/index.ts`
  - `backend/src/services/spx/aiCoach.ts`

### 3) Frontend setup semantics made deterministic
- Filtered `activeSetups` to actionable lifecycle states only (`forming`, `ready`, `triggered`):
  - `contexts/SPXCommandCenterContext.tsx`
- Contract panel now skips recommendation calls for non-actionable setup status:
  - `components/spx-command-center/contract-selector.tsx`

### 4) Coach SSE contract alignment
- Added SSE parser that handles multi-event payloads deterministically.
- Added `postSPXStream()` and token-refresh fallback handling.
- Updated SPX coach send flow to consume full stream and append all returned coach messages:
  - `hooks/use-spx-api.ts`
  - `contexts/SPXCommandCenterContext.tsx`

### 5) Websocket churn reduction
- Hardened reconnect controls:
  - reduced failure threshold,
  - longer retry pause window,
  - larger minimum connect interval.
- Added support for explicit `NEXT_PUBLIC_SPX_BACKEND_URL` resolution.
- Fixed throttled-reconnect scheduling so delayed retries are always executed at the next allowed connect boundary.
- Reduced false-positive coach update broadcasts by using content-based signature (instead of timestamp-driven signature):
  - `hooks/use-price-stream.ts`
  - `backend/src/services/websocket.ts`

### 5.1) Deterministic initial SPX channel delivery
- Added immediate, one-shot SPX snapshot delivery when a client subscribes to SPX public channels.
- New subscriptions to `gex:SPX`, `gex:SPY`, `regime:update`, `basis:update`, `levels:update`, `clusters:update`, `setups:update`, `flow:alert`, and `coach:message` now receive deterministic initial payloads without waiting for the periodic poll cycle.
- Updated:
  - `backend/src/services/websocket.ts`

### 5.2) Websocket integration test stabilization
- Updated SPX websocket integration test to assert channel payload delivery in a single capture window (instead of sequential waits that could miss burst messages).
- Updated:
  - `backend/src/__tests__/integration/spx-websocket.test.ts`

### 6) Safer SPX proxy behavior in local dev
- Localhost now prefers local backend only by default.
- Remote fallback from local dev now requires explicit opt-in:
  - `ALLOW_REMOTE_SPX_FALLBACK=true` or `NEXT_PUBLIC_ALLOW_REMOTE_SPX_FALLBACK=true`
- Updated:
  - `app/api/spx/[...path]/route.ts`

### 7) Deterministic synthetic flow identity
- Replaced random fallback flow IDs with stable IDs:
  - `backend/src/services/spx/flowEngine.ts`

## Cache Cadence Adjustments
- Increased cache TTL for high-churn components to reduce recomputation pressure:
  - basis: 15s
  - regime: 15s
  - prediction: 15s
  - coach state: 15s
  - flow: 20s

## Validation Run
- Passed:
  - `pnpm -C backend exec tsc -p tsconfig.json --noEmit`
  - `pnpm exec tsc --noEmit`
  - `pnpm -C backend test -- src/__tests__/integration/spx-api.test.ts --runInBand`
  - `pnpm -C backend test -- src/__tests__/integration/spx-websocket.test.ts --runInBand`
  - `pnpm -C backend test -- src/services/__tests__/websocket.authz.test.ts --runInBand`
  - `pnpm -C backend test -- src/services/__tests__/websocket.test.ts --runInBand`
  - `pnpm -C backend test -- src/services/spx/__tests__/gexEngine.test.ts src/services/spx/__tests__/levelEngine.test.ts src/services/spx/__tests__/setupDetector.test.ts src/services/spx/__tests__/fibEngine.test.ts src/services/spx/__tests__/aiPredictor.test.ts --runInBand`
