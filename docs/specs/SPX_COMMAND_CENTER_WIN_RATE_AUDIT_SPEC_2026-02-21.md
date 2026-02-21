# SPX Command Center Win-Rate Audit Spec

Date: February 21, 2026  
Scope: SPX Command Center setup detection, transition tracking, and win-rate measurement for T1/T2 outcomes.

## 1. Objective

Provide a trustworthy, queryable win-rate measurement for SPX setups:

1. `T1_hit_before_stop` win rate
2. `T2_hit_before_stop` win rate
3. Stop-loss failure rate before T1
4. Breakdown by setup type, direction, regime, and score tier

## 2. Current State Summary (Code-Verified)

1. Setup generation, ranking, and lifecycle are active in `backend/src/services/spx/setupDetector.ts`.
2. T1/T2 transitions are evaluated in memory via tick stream (`target1_hit`, `target2_hit`) in `backend/src/services/spx/tickEvaluator.ts`.
3. Transition events are only broadcast over WebSocket (`setups:update`) in `backend/src/services/websocket.ts`.
4. `spx_setups` persistence is snapshot-oriented and does not write engine setup IDs or transition phases in `backend/src/workers/spxDataLoop.ts`.
5. `spx_setups` schema currently lacks canonical transition/outcome fields in `supabase/migrations/20260318000000_spx_command_center.sql`.
6. Replay support in `lib/spx/replay-engine.ts` is chart playback, not historical strategy backtesting.
7. Post-trade journal win-rate in `lib/spx/trade-journal-capture.ts` is local browser storage and user-exit driven, not system-level T1/T2 outcome tracking.

## 3. Why Win Rate Is Not Reliable Today

1. No durable storage of T1/T2 transition events.
2. No canonical outcome row per setup instance.
3. Snapshot persistence deletes active rows each cycle and reinserts, preventing clean lifecycle reconstruction from DB snapshots alone.
4. Current `WIN_RATE_BY_SCORE` is a static mapping in detector code, not measured live performance.

## 4. Required Data Contract

### 4.1 New Table: `spx_setup_instances`

One row per engine setup ID + session.

Required columns:

1. `engine_setup_id text not null`
2. `session_date date not null`
3. `setup_type`, `direction`, `regime`
4. `entry_zone_low`, `entry_zone_high`, `stop_price`, `target_1_price`, `target_2_price`
5. `score`, `p_win_calibrated`, `ev_r`, `tier`
6. `first_seen_at`, `triggered_at`, `resolved_at`
7. `final_outcome` (`t2_before_stop`, `t1_before_stop`, `stop_before_t1`, `invalidated_other`, `expired_unresolved`)
8. `final_reason`

Unique key:

1. `(engine_setup_id, session_date)`

### 4.2 New Table: `spx_setup_transitions`

Append-only event stream.

Required columns:

1. `engine_setup_id text not null`
2. `event_id text not null unique`
3. `from_phase`, `to_phase`, `reason`
4. `price numeric`, `event_ts timestamptz`
5. `session_date date`

Indexes:

1. `(engine_setup_id, event_ts)`
2. `(session_date, to_phase)`

## 5. Instrumentation Plan

1. Persist/Upsert setup instances during detection in `backend/src/services/spx/setupDetector.ts` (using `setup.id` as `engine_setup_id`).
2. Persist each tick transition in `backend/src/services/websocket.ts` where transitions are produced.
3. Add outcome finalization logic:
   1. `target2_hit` => `t2_before_stop`
   2. `target1_hit` followed by no stop and terminal expiry => `t1_before_stop`
   3. stop invalidation before any T1 => `stop_before_t1`
   4. other invalidations => `invalidated_other`
   5. TTL/expiry without target hit => `expired_unresolved`
4. Ensure idempotent writes by `event_id`.

## 6. Win-Rate Definitions

Population:

1. Triggered setups only (`triggered_at is not null`)

Metrics:

1. `T1 Win Rate = (t1_before_stop + t2_before_stop) / triggered_setups`
2. `T2 Win Rate = t2_before_stop / triggered_setups`
3. `Failure Rate = stop_before_t1 / triggered_setups`
4. Report sample size beside each percentage.

## 7. API + Reporting

Add endpoint:

1. `GET /api/spx/analytics/win-rate?from=YYYY-MM-DD&to=YYYY-MM-DD`

Response fields:

1. `triggeredCount`
2. `t1Wins`
3. `t2Wins`
4. `stopsBeforeT1`
5. `t1WinRatePct`
6. `t2WinRatePct`
7. `bySetupType[]`
8. `byRegime[]`
9. `byTier[]`

## 8. Backtest Scope (Minimal, Win-Rate First)

Phase-1 backtest is event replay, not model retraining:

1. Re-run transition evaluator against recorded historical bars/ticks.
2. Produce synthetic transitions/outcomes into a backtest namespace table.
3. Compare backtest win rates to live win rates for drift.

## 9. Acceptance Criteria

1. Every triggered setup has exactly one terminal `final_outcome`.
2. Transition loss rate < 0.1% (events produced vs persisted).
3. Win-rate API returns stable results for same date range.
4. T1/T2 win-rate dashboard includes sample size and confidence caution for small N.
5. Unit + integration coverage:
   1. transition persistence idempotency
   2. outcome finalization correctness
   3. win-rate aggregation correctness

## 10. Immediate Execution Order

1. Migration: add `spx_setup_instances` + `spx_setup_transitions`.
2. Wire persistence in detector + websocket transition path.
3. Build finalization job (or inline terminal transition handler).
4. Add win-rate aggregation query + API endpoint.
5. Add automated tests and a one-page runbook query reference.

