# Phase 14 — Slice P14-S8: Rescue ORB Breakout (Flow Grace + Range Width Filter)

## Date: 2026-02-23

## Objective

Drop ORB breakout gate-blocked rate from 88% to ~25% by adding flow grace eligibility and an opening range width filter.

## Scope

### In Scope
- ORB flow grace eligibility (mirroring existing trend_pullback grace pattern)
- ORB volume grace eligibility for first 120 minutes
- ORB EMA grace for first 30 minutes (EMA-21 not meaningful with <30 bars)
- ORB range width filter: reject ranges < 4 points or > 18 points
- `orbFlowGraceApplied` telemetry field on `Setup` interface
- Env flag `SPX_ORB_FLOW_GRACE_ENABLED` (default: true)

### Out of Scope
- Changes to other setup type gates
- Geometry sweep changes
- VIX or day-of-week filters

## Target Files
- `backend/src/services/spx/setupDetector.ts` — grace logic, range width filter, telemetry
- `backend/src/services/spx/types.ts` — `orbFlowGraceApplied` field on `Setup`

## Key Constants Added
```
ORB_GRACE_MIN_CONFLUENCE_SCORE = 4
ORB_GRACE_MAX_FIRST_SEEN_MINUTE = 120
ORB_GRACE_REDUCED_FLOW_QUALITY_SCORE = 25
ORB_GRACE_REDUCED_FLOW_EVENTS = 0
ORB_RANGE_MIN_WIDTH_POINTS = 4
ORB_RANGE_MAX_WIDTH_POINTS = 18
```

## Grace Eligibility Conditions
- `orbFlowGraceEligible`: orb_breakout + firstSeenMinute <= 120 + emaAligned + confluenceScore >= max(4, minConfluenceScore)
- `orbVolumeGraceEligible`: orb_breakout + firstSeenMinute <= 120 + emaAligned + confluenceScore >= 4
- `orbEmaGraceEligible`: orb_breakout + firstSeenMinute <= ORB_WINDOW_MINUTES + confluenceScore >= 4

## Gate Integration
- Flow confirmation gate: bypassed when `orbFlowGraceEligible`
- Flow alignment gate: bypassed when `orbFlowGraceEligible`
- EMA alignment gate: bypassed when `orbEmaGraceEligible`
- Volume regime gate: bypassed when `orbVolumeGraceEligible`
- ORB-specific flow quality: thresholds reduced when grace active (events 2→0, score 58→25)

## Risks & Rollback
- **Risk**: Grace may admit low-quality setups. **Mitigation**: Requires high confluence (>=4) and EMA alignment as structural evidence.
- **Rollback**: Set `SPX_ORB_FLOW_GRACE_ENABLED=false` to disable all ORB grace.

## Validation Gates
```
pnpm --dir backend exec tsc --noEmit   → PASS (0 errors)
pnpm --dir backend exec jest src/services/spx/__tests__/ --no-coverage → 71/71 PASS
```

## Status: COMPLETE
