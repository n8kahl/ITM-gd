# SPX Command Center Expert — Phase 1 Slice P1-S1
Date: 2026-02-28
Slice: `P1-S1`
Status: Completed
Owner: Codex

## 1. Slice Objective
Define production type contracts for the Expert Trade Stream read model in backend and shared frontend types without adding route logic.

## 2. Scope
1. Add `TradeStreamLifecycleState` (`forming | triggered | past`).
2. Add `TradeStreamRecommendedAction` (`WAIT | STAGE | MANAGE | REVIEW`).
3. Add `TradeStreamItem` with facts-first fields from Expert execution spec section 5.1.
4. Add `TradeStreamSnapshot` with `items`, `nowFocusItemId`, `countsByLifecycle`, `feedTrust`, and `generatedAt`.
5. Preserve existing `SPXSnapshot` compatibility.

## 3. Files Touched
1. `backend/src/services/spx/types.ts`
2. `lib/types/spx-command-center.ts`
3. `docs/specs/SPX_COMMAND_CENTER_EXPERT_PHASE1_SLICE_P1-S1_2026-02-28.md`

## 4. Implementation Notes
1. Added new trade stream types only; no backend route/service logic was introduced.
2. Existing `SPXSnapshot` interface remained unchanged to avoid breaking current consumers.
3. `TradeStreamItem.status` and freshness source/result fields remain string-based to preserve compatibility with current and future lifecycle outcome variants.

## 5. Validation

### 5.1 Commands
```bash
pnpm exec eslint /Users/natekahl/ITM-gd/backend/src/services/spx/types.ts /Users/natekahl/ITM-gd/lib/types/spx-command-center.ts
pnpm exec tsc --noEmit
pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit --strict
```

### 5.2 Command Outputs
```bash
$ pnpm exec eslint /Users/natekahl/ITM-gd/backend/src/services/spx/types.ts /Users/natekahl/ITM-gd/lib/types/spx-command-center.ts

/Users/natekahl/ITM-gd/backend/src/services/spx/types.ts
  0:0  warning  File ignored because of a matching ignore pattern. Use "--no-ignore" to disable file ignore settings or use "--no-warn-ignored" to suppress this warning

✖ 1 problem (0 errors, 1 warning)
```

```bash
$ pnpm exec tsc --noEmit
# (no output; exit 0)
```

```bash
$ pnpm --dir /Users/natekahl/ITM-gd/backend exec tsc --noEmit --strict
# (no output; exit 0)
```

## 6. Risks and Notes
1. Root-level ESLint currently ignores `backend/src/services/spx/types.ts`, so lint enforcement for that file is not active in this command path.
2. New trade stream contracts are defined but not yet wired into API routes; integration and runtime validation remains for later slices (`P1-S2` and `P1-S3`).
