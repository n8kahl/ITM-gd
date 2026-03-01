# SPX Seam Gaps Tracker

Updated: 2026-03-01
Purpose: track cross-boundary mismatches (backend/frontend/DB/ops) that create silent failure modes.

| Gap ID | Seam | Symptom | Source of Truth | Planned Fix | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SG-001 | Detector vs DB constraints | VWAP setup types emitted but not persistable | Shared SetupType contract | Add constraint migration + alignment tests | Platform | Open |
| SG-002 | Tick stream vs transition evaluator | VIX/SPY ticks can mutate SPX setup state | SPX-only transition contract | Symbol gating in websocket + evaluator | Backend | Open |
| SG-003 | Backend fallback vs UI health state | Neutral fallback returned as healthy | Snapshot `dataQuality` contract | Include stage-level quality metadata | Backend + FE | Open |
| SG-004 | Optimizer gate vs broker execution | Blocked setups can still trade | Backend execution eligibility check | Enforce gate in execution path | Backend | Open |
| SG-005 | Execution fill source vs journal truth | Fill price sourced from underlying ticks | Tradier order detail | Persist true option fill prices | Backend | Open |
| SG-006 | Feature flags FE vs BE behavior | UI flag state diverges from backend behavior | Shared flag policy | Add server-side enforcement mapping | Platform | Open |
| SG-007 | Layout mode toggle state | Classic/spatial remount loses UI state | Persistent UI state contract | Keep mounted or snapshot/restore state | Frontend | Open |
| SG-008 | Snapshot freshness coherence | GEX/flow/levels can be from different windows | Snapshot coherence timestamp | Add coherence + freshness metadata | Backend | Open |

## Triage Policy
- Critical seam gaps are release blockers for affected domains.
- Any incident caused by a seam gap must backfill a contract test.
