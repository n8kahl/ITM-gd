# SPX Calibration Baseline (2026-02-24)

Captured at: 2026-02-24T21:35:04Z (UTC)

## 1) Backtest Results (Pre-Tuning)

Command executed:

```bash
npx tsx backend/src/scripts/spxBacktestWalkforward.ts > docs/specs/baseline-backtest-pre-tuning.json 2>&1
```

Result: exit code `1`

Output file: `docs/specs/baseline-backtest-pre-tuning.json` (19 lines, 1098 bytes)

Captured output:

```text
{"level":"info","message":"REDIS_URL not set - running without Redis cache","timestamp":"2026-02-24T21:34:21.426Z"}
/Users/natekahl/ITM-gd/backend/src/config/database.ts:11
  throw new Error('Missing Supabase environment variables');
        ^


Error: Missing Supabase environment variables
    at dotenv (/Users/natekahl/ITM-gd/backend/src/config/database.ts:11:9)
    at Object.<anonymous> (/Users/natekahl/ITM-gd/backend/src/config/database.ts:23:23)
    at Module._compile (node:internal/modules/cjs/loader:1521:14)
    at Object.transformer (/Users/natekahl/.npm/_npx/fd45a72a545557e9/node_modules/tsx/dist/register-D46fvsV_.cjs:3:1104)
    at Module.load (node:internal/modules/cjs/loader:1266:32)
    at Module._load (node:internal/modules/cjs/loader:1091:12)
    at Module.require (node:internal/modules/cjs/loader:1289:19)
    at require (node:internal/modules/helpers:182:18)
    at stopPrice (/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts:4:26)
    at Object.<anonymous> (/Users/natekahl/ITM-gd/backend/src/services/spx/winRateBacktest.ts:1142:1)

Node.js v20.19.5
```

## 2) Current Git State

### `git log --oneline -5`

```text
a57f5cf fix(spx): prevent trigger-history toFixed crash on legacy payloads
2bab86a spx: gate execution CTAs by feed trust and broker health
6cd9ea1 spx: add realtime flow telemetry freshness and imbalance ribbon
e08a275 spx: persist triggered alert replay with inspectable history
813e07b spx: enforce setup viability and feed-trust trade entry guard
```

### `git status`

```text
On branch codex/SPX2
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/specs/SPX_CALIBRATION_AGENT_PROMPTS_2026-02-24.md
	docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md
	docs/specs/baseline-backtest-pre-tuning.json

nothing added to commit but untracked files present (use "git add" to track)
```

## 3) `stopEngine.ts` Constants

Source: `backend/src/services/spx/stopEngine.ts`

- `DEFAULT_ATR_STOP_MULTIPLIER = 0.9`
- `MIN_STOP_DISTANCE_POINTS = 0.35`
- `MEAN_REVERSION_STOP_CONFIG`:
  - `compression`: `maxPoints = 8`, `atrMultiple = 0.8`
  - `ranging`: `maxPoints = 9`, `atrMultiple = 1.0`
  - `trending`: `maxPoints = 10`, `atrMultiple = 1.2`
  - `breakout`: `maxPoints = 12`, `atrMultiple = 1.5`

## 4) `executionCoach.ts` Coach Message Prefixes

Source: `backend/src/services/spx/executionCoach.ts`

- `buildTriggeredDirective` content prefix: `Execution command: ENTER `
- `buildTarget1Directive` content prefix: `Execution command: TAKE `
  - Branch 1 template starts: `Execution command: TAKE ${Math.round(partialPct * 100)}% at T1 ... and move stop to breakeven ...`
  - Branch 2 template starts: `Execution command: TAKE ${Math.round(partialPct * 100)}% at T1 ... and keep stop discipline at ...`
- `buildTarget2Directive` content prefix: `Execution command: EXIT remainder at T2 `
- `buildStopDirective` content prefix: `Execution command: EXIT now. Stop condition confirmed near `
