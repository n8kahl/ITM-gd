# P16-S7: Full Telemetry Persistence for Continuous Improvement

## Objective
Close 3 telemetry gaps so that every setup persisted to `spx_setup_instances` carries the full signal context needed for optimizer learning and continuous improvement: flow quality details, volume trend, and microstructure snapshot.

## Context
Setup detection computes rich telemetry (flow quality score/components, volume trend, microbar microstructure) but discards it before persistence. Only boolean proxies (`flowConfirmed`, `volumeRegimeAligned`) and string gate reasons reach the database. The optimizer cannot learn from the underlying continuous values.

## In Scope
1. Add `flowQuality`, `volumeTrend`, `minutesSinceOpen`, `emaFastSlope`, and `microstructureSnapshot` fields to the `Setup` interface
2. Inject computed telemetry into setup objects during building in `setupDetector.ts`
3. Persist all telemetry fields in `outcomeTracker.ts` `toTrackedRow()` metadata JSONB

## Out of Scope
- Schema migration (metadata is JSONB, no DDL needed)
- Optimizer consumption of new fields (future slice)
- User-facing gating feedback dashboard

## Target Files
| File | Change |
|------|--------|
| `backend/src/services/spx/types.ts` | Add telemetry fields to `Setup` interface |
| `backend/src/services/spx/setupDetector.ts` | Inject `flowQuality`, `volumeTrend`, `minutesSinceOpen`, `emaFastSlope`, microstructure snapshot into setup return |
| `backend/src/services/spx/outcomeTracker.ts` | Persist new fields in `toTrackedRow()` metadata |

## Risks
- **Low**: Adding fields to existing JSONB — no schema migration, fully backwards-compatible
- **Low**: Microbar data may be null if tick stream is not active — handled with null defaults

## Rollback
Revert the 3 files. Existing persisted data is unaffected.

## Validation Gates
- `pnpm --dir backend exec tsc --noEmit`
- `pnpm --dir backend test`
