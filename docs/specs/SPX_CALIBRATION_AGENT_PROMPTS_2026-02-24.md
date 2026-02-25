# SPX Calibration Tuning — Agent Session Prompts

**Date:** 2026-02-24
**Usage:** Each section below is a standalone prompt to paste into a fresh Claude Code session. Never carry one phase into the next session. Each session starts clean.

**Execution Order:**
1. Phase 1 (W1) and Phase 2 (W3) can run in parallel — they touch different files
2. Phase 1 QA runs after Phase 1 completes
3. Phase 2 QA runs after Phase 2 completes
4. Phase 3a runs after Phase 1 QA passes (you need the heat analysis data)
5. Phase 3b runs after Phase 3a passes (tests written first, then implementation)
6. Phase 3 QA runs after Phase 3b completes
7. Phase 4 runs after Phase 3 QA passes
8. Phase 4 QA runs after Phase 4 completes
9. Closing Loop runs after everything ships

---

## PHASE 1: Stop-Loss Heat Analysis Script (Workstream 1)

```
You are implementing a stop-loss heat analysis script for the SPX Command Center trading system. This is a NEW script — you are not modifying any production code.

## GOVERNING SPEC
Read `docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md`, Section 2 (Workstream 1: Stop-Loss Heat Analysis). Follow it exactly.

## OBJECTIVE
Create `backend/src/scripts/spxStopHeatAnalysis.ts` that analyzes stopped-out trades to determine how many were "shakeouts" (price reversed toward T1 after the stop was hit).

## CODEBASE CONTEXT — READ THESE FILES FIRST
Before writing any code, read all of the following:

1. `backend/src/services/spx/stopEngine.ts` — understand AdaptiveStopInput, AdaptiveStopOutput, calculateAdaptiveStop, DEFAULT_ATR_STOP_MULTIPLIER (0.9), MEAN_REVERSION_STOP_CONFIG
2. `backend/src/services/spx/winRateBacktest.ts` — reuse its bar-fetching logic, evaluateSetupAgainstBars pattern, and SPXBacktestExecutionModel
3. `backend/src/services/spx/outcomeTracker.ts` — understand the spx_setup_instances table schema, persistSetupInstancesForWinRate function, the metadata JSONB column where gateStatus/gateReasons live
4. `backend/src/scripts/spxBacktestWalkforward.ts` — follow its pattern for CLI script structure, argument parsing, and output formatting
5. `backend/src/services/spx/types.ts` — Setup interface, Regime type ('trending'|'ranging'|'compression'|'breakout'), SetupType

## WHAT THE SCRIPT MUST DO

Accept CLI args: --from (date), --to (date), --post-stop-window-minutes (default 30)

1. Query spx_setup_instances for all rows where final_outcome = 'stop_before_t1' in the date range
2. For each stopped-out trade:
   a. Extract entry_price (from entryZone mid), stop_price (from stop), target1_price (from target1.price), regime, setup_type, stop_hit_at timestamp
   b. Fetch second-level bars from Massive API for the post-stop window (stop_hit_at to stop_hit_at + post_stop_window_minutes)
   c. Compute post_stop_extreme: the maximum favorable price excursion toward T1 after the stop was hit
   d. Compute post_stop_t1_travel_pct: (post_stop_extreme - stop_price) / (target1_price - stop_price) × 100
   e. Compute effective_atr_multiplier: actual stop distance / ATR14 (ATR14 from setup metadata if available)
   f. Flag as "marginal stop" if price exceeded stop by less than 0.5 points before reversing

3. Produce 4 outputs (all printed as JSON to stdout):

   Output 1 — Shakeout Histogram:
   Bucket trades by post_stop_t1_travel_pct into: 0-10%, 10-25%, 25-50%, 50-75%, 75-100%+
   Report count and percentage per bucket.

   Output 2 — Minimum Additional Stop Distance:
   For trades in 50-100%+ buckets, compute how many additional points of stop width would have survived the shakeout.
   Report: median, mean, p75, p90 of additional points needed.

   Output 3 — Regime-Stratified Shakeout Rates:
   Break down by regime: total stops, shakeouts (50%+ bucket), shakeout rate, median additional points needed.

   Output 4 — ATR Multiplier Sensitivity Curve:
   For hypothetical multipliers 0.5 to 3.0 (step 0.1), compute what percentage of shakeouts would have been avoided at each multiplier.
   Report as array of {multiplier, avoidedPct}.

4. CRITICAL DATA INTEGRITY RULES:
   - Only use bars AFTER stop_hit_at for post-stop analysis (no look-ahead bias)
   - Limit forward window to the setup's original TTL or post_stop_window_minutes, whichever is shorter
   - Exclude trades with ambiguous bars (where both stop and target were touched in same bar)
   - Report the total sample size, excluded count, and exclusion reasons

## CONSTRAINTS
- Do NOT modify any existing production files
- Do NOT create database migrations
- Follow the CLI script pattern from spxBacktestWalkforward.ts (ts-node/tsx compatible)
- Use the existing Supabase client from backend/src/config/database.ts
- Use the existing Massive API client for bar fetching
- Output format: structured JSON with clear section headers
- Include a summary block at the top of output with: date range, total stopped trades, exclusions, sample size per regime

## VALIDATION
After writing the script:
1. Run `pnpm exec tsc --noEmit` — must pass with zero errors
2. Run `pnpm exec eslint backend/src/scripts/spxStopHeatAnalysis.ts` — must pass
3. Do a dry-run with --from 2026-02-01 --to 2026-02-22 to verify it executes

## WHAT NOT TO DO
- Do NOT modify stopEngine.ts, executionCoach.ts, setupDetector.ts, or any other production file
- Do NOT create new database tables or migrations
- Do NOT change any test files
- Do NOT widen stops or change any parameters — this script only ANALYZES, it does not CHANGE anything
```

---

## PHASE 1 QA: Verify Heat Analysis Script

```
You are a QA agent verifying a newly created script. You did NOT write this code. Your job is to find problems.

## WHAT WAS IMPLEMENTED
A stop-loss heat analysis script at: backend/src/scripts/spxStopHeatAnalysis.ts

## YOUR TASKS

1. Read the script: backend/src/scripts/spxStopHeatAnalysis.ts
2. Read the governing spec: docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md, Section 2

3. Verify against spec — check each of these explicitly:
   a. Does it query spx_setup_instances for final_outcome = 'stop_before_t1'? (not some other outcome)
   b. Does it only use bars AFTER stop_hit_at? (no look-ahead bias)
   c. Does it limit forward window to min(TTL, post_stop_window_minutes)?
   d. Does it exclude ambiguous bars and report exclusion count?
   e. Does it produce all 4 outputs (histogram, additional distance, regime-stratified, ATR sensitivity curve)?
   f. Does it flag marginal stops (< 0.5 points beyond stop)?
   g. Does the ATR sensitivity curve cover 0.5 to 3.0 in 0.1 steps?

4. Run validation gates:
   pnpm exec tsc --noEmit
   pnpm exec eslint backend/src/scripts/spxStopHeatAnalysis.ts

5. Verify NO production files were modified:
   git diff --name-only
   The only new/changed file should be backend/src/scripts/spxStopHeatAnalysis.ts

6. Report findings as a checklist:
   [PASS/FAIL] each item above with specific line numbers if there's an issue

## CONSTRAINTS
- Do NOT fix any issues you find. Report them only.
- Do NOT modify any files.
- If you find issues, list them with exact file paths and line numbers so the implementing agent can fix them in a new session.
```

---

## PHASE 2: Phase-Aware Coach Tone (Workstream 3)

```
You are modifying the execution coach tone in the SPX Command Center. This is a content-string-only change with one new function.

## GOVERNING SPEC
Read `docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md`, Section 4 (Workstream 3: Phase-Aware Coach Tone). Follow it exactly.

## OBJECTIVE
Change the coach message content strings to use phase-appropriate tone:
- Pre-trade (triggered): Observational — "Observation: ..."
- In-trade (T1 hit): NO CHANGE — keep commanding tone exactly as-is
- In-trade (T2 hit): Minor change — "Action: EXIT remainder..."
- Stop hit: Protective — "Risk protocol: ..."
- NEW: Post-trade reflective message — "Review: ..."

## CODEBASE CONTEXT — READ THESE FILES FIRST
1. `backend/src/services/spx/executionCoach.ts` — the file you will modify
2. `backend/src/services/spx/types.ts` — CoachingType = 'pre_trade' | 'in_trade' | 'behavioral' | 'post_trade' | 'alert', CoachingPriority, CoachMessage interface
3. `backend/src/services/spx/tickEvaluator.ts` — SetupTransitionEvent interface (lines 24-35)

## EXACT CHANGES REQUIRED

### Change 1: buildTriggeredDirective content string (line ~45)

Current:
"Execution command: ENTER ${setup.direction.toUpperCase()} ${humanizeSetupType(setup.type)}. Entry ${setup.entryZone.low.toFixed(2)}-${setup.entryZone.high.toFixed(2)} (ref ${entryMid.toFixed(2)}), stop ${setup.stop.toFixed(2)}, T1 ${setup.target1.price.toFixed(2)}, T2 ${setup.target2.price.toFixed(2)}."

New:
"Observation: SPX ${setup.direction === 'bullish' ? 'testing support at' : 'approaching resistance at'} ${humanizeSetupType(setup.type)} zone. ${setup.direction.charAt(0).toUpperCase() + setup.direction.slice(1)} setup, confluence ${setup.confluenceScore}/5. Entry ${setup.entryZone.low.toFixed(2)}-${setup.entryZone.high.toFixed(2)} (ref ${entryMid.toFixed(2)}), stop ${setup.stop.toFixed(2)}, T1 ${setup.target1.price.toFixed(2)}, T2 ${setup.target2.price.toFixed(2)}."

### Change 2: buildTarget1Directive — DO NOT TOUCH
Leave the entire function exactly as-is. Do not change a single character.

### Change 3: buildTarget2Directive content string (line ~103)

Current:
"Execution command: EXIT remainder at T2 ${setup.target2.price.toFixed(2)}. Setup objective complete."

New:
"Action: EXIT remainder at T2 ${setup.target2.price.toFixed(2)}. Full objective reached."

### Change 4: buildStopDirective content string (line ~129)

Current:
"Execution command: EXIT now. Stop condition confirmed near ${setup.stop.toFixed(2)}; stand down and preserve capital."

New:
"Risk protocol: Stop ${setup.stop.toFixed(2)} confirmed. Exit and preserve capital. Discipline held."

### Change 5: Add new function buildReflectiveDirective

Add a new internal function after buildStopDirective:

function buildReflectiveDirective(event: SetupTransitionEvent): { content: string; directive: ExecutionDirective; type: CoachMessage['type']; priority: CoachMessage['priority']; } | null

Logic:
- If event.reason === 'target2': content = "Review: Trade captured T2 at ${setup.target2.price.toFixed(2)}. ${humanizeSetupType(setup.type)} in ${setup.regime} regime — note conditions for future setups."
- If event.reason === 'stop': content = "Review: Stop hit at ${setup.stop.toFixed(2)}. ${humanizeSetupType(setup.type)} in ${setup.regime} — review entry timing post-session."
- If event.reason === 'target1': content = "Review: Partial taken at T1 ${setup.target1.price.toFixed(2)}. Runner still active."
- type: 'post_trade'
- priority: 'guidance'
- directive.command: event.reason === 'stop' ? 'EXIT_STOP' : 'EXIT_T2'
- directive.actionId: 'EXIT_TRADE_FOCUS'

### Change 6: Update buildExecutionCoachMessageFromTransition

After the existing switch/if chain that handles transitions, add logic to emit a reflection message:
- When toPhase results in a terminal state (target2 hit or stop hit), also return a reflective message
- Implementation options:
  a. Simple: return the reflective message as a second call (the caller batches them)
  b. If the function can only return one CoachMessage, add a setTimeout wrapper that emits the reflection after 5 seconds via a callback parameter

Choose whichever approach is simpler given the existing caller pattern. Read how buildExecutionCoachMessageFromTransition is called to determine this.

## ABSOLUTE CONSTRAINTS — READ CAREFULLY

1. DO NOT modify the structuredData payload structure. The ExecutionDirective interface must remain byte-identical.
2. DO NOT modify buildTarget1Directive. Not one character.
3. DO NOT change the CoachMessage interface in types.ts (the existing CoachingType union already includes 'post_trade').
4. DO NOT add new npm dependencies.
5. DO NOT modify any frontend files.
6. DO NOT modify any other backend files besides executionCoach.ts.

## VALIDATION
After making changes:
1. pnpm exec tsc --noEmit — must pass
2. pnpm exec eslint backend/src/services/spx/executionCoach.ts — must pass
3. Run any existing tests: pnpm vitest run --reporter=verbose 2>&1 | grep -i coach (run whatever tests exist for this file)

## VERIFICATION STEP
After implementation, diff the file and verify:
- buildTarget1Directive is UNCHANGED (git diff should show zero changes in that function)
- No imports were added to types.ts
- The ExecutionDirective interface is unchanged
- Only content strings changed in buildTriggeredDirective, buildTarget2Directive, buildStopDirective
- One new function added: buildReflectiveDirective
```

---

## PHASE 2 QA: Verify Coach Tone Changes

```
You are a QA agent verifying coach tone changes. You did NOT write this code.

## WHAT WAS IMPLEMENTED
Modifications to: backend/src/services/spx/executionCoach.ts
Spec: docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md, Section 4

## YOUR TASKS

1. Read backend/src/services/spx/executionCoach.ts

2. Run: git diff backend/src/services/spx/executionCoach.ts
   Analyze the diff carefully.

3. CRITICAL CHECKS:

   a. [PASS/FAIL] buildTarget1Directive is COMPLETELY UNCHANGED — zero diff lines in that function
   b. [PASS/FAIL] buildTriggeredDirective content starts with "Observation:" not "Execution command:"
   c. [PASS/FAIL] buildTarget2Directive content starts with "Action:" not "Execution command:"
   d. [PASS/FAIL] buildStopDirective content starts with "Risk protocol:" not "Execution command:"
   e. [PASS/FAIL] buildReflectiveDirective function exists and returns type: 'post_trade'
   f. [PASS/FAIL] No changes to ExecutionDirective interface
   g. [PASS/FAIL] No changes to types.ts
   h. [PASS/FAIL] No changes to any file OTHER than executionCoach.ts

4. Verify the structuredData payloads are unchanged:
   - Check that the directive object construction in buildTriggeredDirective still has: command, actionId, phase, transitionId, transitionTimestamp, reason, fromPhase, toPhase, setupStatus
   - Same fields, same values derived from the same sources

5. Run validation gates:
   pnpm exec tsc --noEmit
   pnpm exec eslint backend/src/services/spx/executionCoach.ts

6. Run: git diff --name-only
   Only backend/src/services/spx/executionCoach.ts should appear.

## CONSTRAINTS
- Do NOT fix any issues. Report them only with exact line numbers.
- Do NOT modify any files.
```

---

## PHASE 3a: Write Tests for Stop Tuning (Workstream 2 — Tests First)

```
You are writing tests BEFORE implementation. The implementation does not exist yet. You are defining the correctness contract.

## GOVERNING SPEC
Read `docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md`, Section 3 (Workstream 2: Regime-Aware Stop Parameter Tuning). Follow it exactly.

## CODEBASE CONTEXT — READ THESE FILES FIRST
1. `backend/src/services/spx/stopEngine.ts` — current implementation with DEFAULT_ATR_STOP_MULTIPLIER = 0.9
2. Any existing tests: search for test files matching *stopEngine* or *stop-engine* in the codebase
3. `backend/src/services/spx/types.ts` — Regime type: 'trending' | 'ranging' | 'compression' | 'breakout'

## WHAT TO WRITE

Create or extend the test file for stopEngine. Write tests for the PROPOSED behavior (these tests should FAIL against the current code — that's intentional):

### Test Group 1: getRegimeBaseAtrMultiplier (new function)
- Test: trending regime returns 1.3 (these exact values will be calibrated by heat analysis — use these as defaults)
- Test: breakout regime returns 1.5
- Test: ranging regime returns 1.0
- Test: compression regime returns 0.85
- Test: null/undefined regime returns 1.0 (fallback)

### Test Group 2: calculateAdaptiveStop regime-aware behavior
- Test: With regime='trending' and NO explicit atrStopMultiplier, the effective multiplier is 1.3 (not 0.9)
- Test: With regime='compression' and NO explicit atrStopMultiplier, the effective multiplier is 0.85
- Test: With explicit atrStopMultiplier=2.0 and regime='trending', the explicit value (2.0) takes precedence over regime default
- Test: With regime=null and NO explicit atrStopMultiplier, fallback to 1.0 (not 0.9)

### Test Group 3: Post-composition ceiling
- Test: When all scale factors compound to produce riskPoints > 3.0 × ATR14, the result is capped at 3.0 × ATR14
- Test: When riskPoints < 3.0 × ATR14, no capping occurs (result is unchanged)
- Test: When ATR14 is null/undefined, no capping occurs (ceiling requires valid ATR)

### Test Group 4: Updated MEAN_REVERSION_STOP_CONFIG
- Test: compression maxPoints is 8-10 (not lower than 8, not higher than 10)
- Test: ranging maxPoints is 12-15
- Test: trending maxPoints is 13-16
- Test: breakout maxPoints is 15-20

## IMPORTANT NOTES
- These tests define the CONTRACT. The implementing agent in Phase 3b must make these tests pass.
- Use the existing test framework (vitest). Match the test file naming/location pattern of existing tests.
- Import from the actual source file path.
- These tests WILL FAIL if you run them now — that is expected and correct.
- Do NOT modify stopEngine.ts. Only create/modify test files.

## VALIDATION
1. pnpm exec tsc --noEmit — tests must compile even if the functions don't exist yet (use type assertions or conditional imports as needed)
2. pnpm exec eslint <test-file-path> — must pass
3. Run the tests to confirm they FAIL: pnpm vitest run <test-file-path> — expect failures
4. git diff --name-only — only test files should be changed
```

---

## PHASE 3b: Implement Stop Tuning (Workstream 2 — Make Tests Pass)

```
You are implementing regime-aware stop parameter tuning. Tests have already been written for you. Your job is to make them pass.

## GOVERNING SPEC
Read `docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md`, Section 3 (Workstream 2). Follow it exactly.

## HEAT ANALYSIS RESULTS
[PASTE THE OUTPUT OF YOUR PHASE 1 HEAT ANALYSIS SCRIPT HERE]

Use these results to calibrate the exact multiplier values. If the ATR sensitivity curve shows a knee at a different point than the defaults (1.3/1.5/1.0/0.85), use the empirically-derived values instead. Update the tests from Phase 3a if needed to match the calibrated values.

## CODEBASE CONTEXT — READ THESE FILES FIRST
1. `backend/src/services/spx/stopEngine.ts` — the file you will modify
2. The test file from Phase 3a — read it to understand the exact contract you must satisfy
3. `backend/src/services/spx/types.ts` — Regime type

## EXACT CHANGES REQUIRED

### Change 1: Add getRegimeBaseAtrMultiplier function
Export a new function:
```typescript
export function getRegimeBaseAtrMultiplier(regime: Regime | null | undefined): number {
  switch (regime) {
    case 'trending':    return [VALUE FROM HEAT ANALYSIS];
    case 'breakout':    return [VALUE FROM HEAT ANALYSIS];
    case 'ranging':     return [VALUE FROM HEAT ANALYSIS];
    case 'compression': return [VALUE FROM HEAT ANALYSIS];
    default:            return 1.0;
  }
}
```

### Change 2: Update calculateAdaptiveStop to use regime-aware multiplier
In the calculateAdaptiveStop function, change:
```typescript
// Current (find this exact line):
const atrStopMultiplier = clamp(
  toFiniteNumber(input.atrStopMultiplier) ?? DEFAULT_ATR_STOP_MULTIPLIER,
  0.1, 3
);

// Replace with:
const atrStopMultiplier = clamp(
  toFiniteNumber(input.atrStopMultiplier) ?? getRegimeBaseAtrMultiplier(input.regime),
  0.1, 3
);
```

### Change 3: Add post-composition ceiling
After the line that computes final riskPoints, add:
```typescript
const MAX_EFFECTIVE_ATR_MULTIPLE = 3.0;
const atr14Val = toFiniteNumber(input.atr14);
if (atr14Val != null && atr14Val > 0) {
  const maxRiskFromAtr = atr14Val * MAX_EFFECTIVE_ATR_MULTIPLE;
  riskPoints = Math.min(riskPoints, maxRiskFromAtr);
}
```

### Change 4: Update MEAN_REVERSION_STOP_CONFIG maxPoints
Adjust values based on heat analysis regime-stratified data. Use the "median additional points needed" from the heat analysis to determine appropriate caps.

## CONSTRAINTS
- Modify ONLY stopEngine.ts and the test file from Phase 3a (if calibrating values)
- Do NOT modify any other production files
- Do NOT modify executionCoach.ts, setupDetector.ts, or any frontend files
- Do NOT change the AdaptiveStopInput or AdaptiveStopOutput interfaces
- The DEFAULT_ATR_STOP_MULTIPLIER constant can remain in the file (for reference) but should no longer be used in calculateAdaptiveStop

## VALIDATION — ALL MUST PASS
1. pnpm vitest run <stop-engine-test-file> — ALL tests must pass
2. pnpm exec tsc --noEmit — must pass
3. pnpm exec eslint backend/src/services/spx/stopEngine.ts — must pass
4. Run the walk-forward backtest and SAVE the output:
   npx tsx backend/src/scripts/spxBacktestWalkforward.ts > /tmp/backtest-post-tuning.json
5. Compare against baseline (you should have saved pre-tuning results). Report:
   - T1 win rate: before → after
   - Stop hit rate: before → after
   - Expectancy R: before → after
   - Any regime that got WORSE

## CRITICAL: If expectancy R decreased, do NOT commit. Report the regression and stop.
```

---

## PHASE 3 QA: Verify Stop Tuning

```
You are a QA agent verifying stop parameter tuning changes. You did NOT write this code.

## WHAT WAS IMPLEMENTED
Modifications to: backend/src/services/spx/stopEngine.ts
Spec: docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md, Section 3

## YOUR TASKS

1. Read backend/src/services/spx/stopEngine.ts
2. Run: git diff backend/src/services/spx/stopEngine.ts

3. CRITICAL CHECKS:

   a. [PASS/FAIL] getRegimeBaseAtrMultiplier exists and is exported
   b. [PASS/FAIL] calculateAdaptiveStop uses getRegimeBaseAtrMultiplier(input.regime) as fallback, NOT DEFAULT_ATR_STOP_MULTIPLIER
   c. [PASS/FAIL] Post-composition ceiling exists (MAX_EFFECTIVE_ATR_MULTIPLE = 3.0 or similar)
   d. [PASS/FAIL] Post-composition ceiling only applies when atr14 is valid (not null/undefined/0)
   e. [PASS/FAIL] MEAN_REVERSION_STOP_CONFIG maxPoints values were updated
   f. [PASS/FAIL] AdaptiveStopInput interface is UNCHANGED
   g. [PASS/FAIL] AdaptiveStopOutput interface is UNCHANGED
   h. [PASS/FAIL] No changes to any file OTHER than stopEngine.ts and the test file

4. Verify the composition chain is correct:
   - Trace through calculateAdaptiveStop with these inputs and verify the output makes sense:
     Input A: { direction: 'bullish', entryLow: 5020, entryHigh: 5021, baseStop: 5015, geometryStopScale: 1.0, atr14: 6.0, regime: 'trending' }
     Expected: atrStopMultiplier = 1.3, atrFloor = 6.0 * 1.3 = 7.8, so riskPoints >= 7.8
     Input B: { direction: 'bullish', entryLow: 5020, entryHigh: 5021, baseStop: 5015, geometryStopScale: 1.0, atr14: 6.0, regime: 'compression' }
     Expected: atrStopMultiplier = 0.85, atrFloor = 6.0 * 0.85 = 5.1
   - Verify these manually by reading the code logic.

5. Run ALL validation gates:
   pnpm vitest run (full suite, not just stop engine tests)
   pnpm exec tsc --noEmit
   pnpm exec eslint .
   pnpm run build

6. Run: git diff --name-only
   Only stopEngine.ts and test files should appear.

## CONSTRAINTS
- Do NOT fix any issues. Report them only.
- Do NOT modify any files.
```

---

## PHASE 4: Shadow Gate A/B Testing (Workstream 4)

```
You are implementing shadow gate logging for the SPX optimization gates. This adds a parallel logging path — it does NOT change what the production UI shows.

## GOVERNING SPEC
Read `docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md`, Section 5 (Workstream 4: Shadow Gate A/B Testing). Follow it exactly.

## CODEBASE CONTEXT — READ THESE FILES FIRST
1. `backend/src/services/spx/setupDetector.ts` — find evaluateOptimizationGate function (around line 2074), understand how it returns string[] of gate reasons, and find where blocked setups are currently handled
2. `backend/src/services/spx/outcomeTracker.ts` — understand persistSetupInstancesForWinRate and how gateStatus/gateReasons are stored in metadata JSONB
3. `backend/src/services/spx/types.ts` — Setup interface, specifically gateStatus?: 'eligible' | 'blocked' field
4. `backend/src/services/spx/winRateBacktest.ts` — understand includeBlockedSetups flag
5. `backend/src/scripts/spxBacktestWalkforward.ts` — follow CLI script pattern for the analysis script

## EXACT CHANGES REQUIRED

### Change 1: Add shadow logging in setupDetector.ts

Find where evaluateOptimizationGate is called and blocked setups are filtered out. After the gate check, add:

If the setup is blocked (gateReasons.length > 0) AND confluenceScore >= 3:
  - Set setup.gateStatus = 'shadow_blocked' (you'll need to extend the type)
  - Set setup.gateReasons = gateReasons
  - Add the setup to a separate shadow array
  - Call persistSetupInstancesForWinRate with the shadow array

CRITICAL: Shadow-blocked setups must NEVER appear in the production setup feed. They are only persisted for later analysis. Verify that the existing filtering logic excludes them.

### Change 2: Extend gateStatus type

In types.ts, change:
  gateStatus?: 'eligible' | 'blocked'
to:
  gateStatus?: 'eligible' | 'blocked' | 'shadow_blocked'

### Change 3: Create analysis script

Create `backend/src/scripts/spxShadowGateAnalysis.ts` that:

1. Queries spx_setup_instances where metadata->>'gateStatus' = 'shadow_blocked'
2. Runs spxResolveOutcomes or the backtest against these setups to determine what would have happened
3. Produces 3 outputs (JSON to stdout):

   Query 1 — Shadow setup outcome distribution:
   Group by final_outcome, report count and avg realized_r per outcome

   Query 2 — Gate reason effectiveness:
   For each unique gate reason in the shadow set:
   - Count of setups it blocked
   - T1 win rate of those blocked setups (from outcome resolution)
   - Average realized R
   Flag any gate reason where blocked setups have >60% T1 win rate

   Query 3 — Production vs shadow comparison:
   Side-by-side: T1 win rate, T2 win rate, stop rate, avg R, expectancy R
   For production (gateStatus = 'eligible') vs shadow (gateStatus = 'shadow_blocked')

## CONSTRAINTS
- Modify ONLY setupDetector.ts (shadow logging), types.ts (gateStatus extension), and create the new analysis script
- Do NOT change any frontend files
- Do NOT change the optimization gate logic itself — the same setups should pass/fail as before
- Do NOT change stopEngine.ts or executionCoach.ts
- Shadow logging must not noticeably impact detection cycle performance

## VALIDATION
1. pnpm exec tsc --noEmit — must pass
2. pnpm exec eslint backend/src/services/spx/setupDetector.ts backend/src/services/spx/types.ts — must pass
3. Verify shadow setups don't appear in production: search for all queries that fetch setups for the UI and confirm they filter out shadow_blocked
4. git diff --name-only — only setupDetector.ts, types.ts, and the new script should appear
```

---

## PHASE 4 QA: Verify Shadow Gate Implementation

```
You are a QA agent verifying shadow gate logging. You did NOT write this code.

## WHAT WAS IMPLEMENTED
Modifications to: backend/src/services/spx/setupDetector.ts, backend/src/services/spx/types.ts
New file: backend/src/scripts/spxShadowGateAnalysis.ts
Spec: docs/specs/SPX_CALIBRATION_TUNING_DEV_SPEC_2026-02-24.md, Section 5

## YOUR TASKS

1. Read all modified files and the new script
2. Run: git diff --name-only — verify ONLY the expected files were touched

3. CRITICAL SAFETY CHECK — Shadow setups must not leak to production:
   a. Search the entire codebase for every query/function that fetches setups for the UI
      Search for: supabase.from('spx_setup_instances'), any function that returns Setup[] for rendering
   b. Verify each one filters out gateStatus = 'shadow_blocked'
   c. [PASS/FAIL] No UI query can return shadow_blocked setups

4. CRITICAL CHECKS:
   a. [PASS/FAIL] Shadow logging only fires when gateReasons.length > 0 AND confluenceScore >= 3
   b. [PASS/FAIL] Shadow setups are persisted via persistSetupInstancesForWinRate (not a custom DB call)
   c. [PASS/FAIL] gateStatus type in types.ts now includes 'shadow_blocked'
   d. [PASS/FAIL] The optimization gate logic itself is UNCHANGED (same pass/fail decisions)
   e. [PASS/FAIL] Analysis script produces all 3 query outputs
   f. [PASS/FAIL] Analysis script flags gate reasons with >60% T1 win rate

5. Performance concern:
   - Count how many additional database writes the shadow logging adds per detection cycle
   - If it's more than 1 bulk write per cycle, flag as potential performance issue

6. Run validation gates:
   pnpm exec tsc --noEmit
   pnpm exec eslint .
   pnpm run build

## CONSTRAINTS
- Do NOT fix any issues. Report them only.
- Do NOT modify any files.
```

---

## CLOSING LOOP: Post-Implementation Validation

```
You are running the closing validation loop after all 4 workstreams have been implemented. This verifies the entire system works together.

## TASKS

1. Run full release gates:
   pnpm exec eslint .
   pnpm exec tsc --noEmit
   pnpm run build
   pnpm vitest run

   ALL must pass. If any fail, report the exact error and stop.

2. Run the walk-forward backtest:
   npx tsx backend/src/scripts/spxBacktestWalkforward.ts

   Save the output. This is the POST-implementation baseline.

3. Run the heat analysis script with the SAME date range used in Phase 1:
   npx tsx backend/src/scripts/spxStopHeatAnalysis.ts --from [SAME DATE] --to [SAME DATE]

   Compare the shakeout rates. With the new regime-aware stops:
   - Shakeout rate should be LOWER than the Phase 1 baseline
   - If it's not lower, report this as a calibration failure

4. Verify git status:
   git diff --name-only
   Report ALL files that changed across all phases.

   Expected files:
   - backend/src/services/spx/stopEngine.ts (W2)
   - backend/src/services/spx/executionCoach.ts (W3)
   - backend/src/services/spx/setupDetector.ts (W4)
   - backend/src/services/spx/types.ts (W4)
   - backend/src/scripts/spxStopHeatAnalysis.ts (W1 — new)
   - backend/src/scripts/spxShadowGateAnalysis.ts (W4 — new)
   - Test files for stopEngine (W2)

   If ANY other production file was modified, flag it immediately.

5. Summary report:
   - T1 win rate: pre → post
   - Stop hit rate: pre → post
   - Expectancy R: pre → post
   - Shakeout rate: pre → post
   - Coach tone: verified observational/commanding/reflective split
   - Shadow gate: logging confirmed, no UI leakage
   - Files changed: list all
   - Regressions found: list any

## CONSTRAINTS
- Do NOT modify any files.
- This is a read-only verification session.
- If ANY validation gate fails, do NOT attempt to fix it. Report and stop.
```

---

## BASELINE CAPTURE: Run Before Any Implementation

```
You are capturing the pre-implementation baseline. This must be done BEFORE any code changes. Do not modify any files.

## TASKS

1. Capture current backtest results:
   npx tsx backend/src/scripts/spxBacktestWalkforward.ts > docs/specs/baseline-backtest-pre-tuning.json 2>&1

2. Capture current git state:
   git log --oneline -5
   git status

3. Record current stop engine constants by reading stopEngine.ts:
   - DEFAULT_ATR_STOP_MULTIPLIER value
   - MEAN_REVERSION_STOP_CONFIG values (all 4 regimes)
   - MIN_STOP_DISTANCE_POINTS value

4. Record current coach message prefixes by reading executionCoach.ts:
   - buildTriggeredDirective content prefix
   - buildTarget1Directive content prefix
   - buildTarget2Directive content prefix
   - buildStopDirective content prefix

5. Save all of the above to: docs/specs/SPX_CALIBRATION_BASELINE_2026-02-24.md

## CONSTRAINTS
- Do NOT modify any code files.
- Only create the baseline document.
- This session exists solely to create a reference point for later comparison.
```
