# Setup Detection Optimization Closure Evidence Summary

Date: 2026-02-24  
Runtime: Node v22.22.0

## Scope

Evidence snapshot for closure criteria 5-9 from:

- `docs/specs/SETUP_DETECTION_OPTIMIZATION_EXECUTION_SPEC_2026-02-24.md`

## Criterion 5: 30-day backtest false positive rate < 8%

Status: **Not met**

- Command window used: `2026-01-25` to `2026-02-23` (last completed 30-day window)
- Artifact:
  - `backtest_2026-01-25_2026-02-23_second_actionable_node22.json`
- Result:
  - `analytics.failureRatePct = 35.29`
  - `analytics.t1WinRatePct = 64.71`
  - `analytics.triggeredCount = 34`

## Criterion 6: 30-day journal tracking win-rate improvement >= +5%

Status: **Met**

- SQL comparison windows:
  - Current: `2026-01-25` to `2026-02-23`
  - Previous: `2025-12-26` to `2026-01-24`
- Result:
  - current win rate: `45.83%`
  - previous win rate: `38.46%`
  - delta: `+7.37pp`
  - resolved sample sizes: `48` (current), `65` (previous)

## Criterion 7: DLQ unresolved events over last 48h = 0

Status: **Met**

- SQL result:
  - `unresolved_total = 0`
  - `unresolved_last_48h = 0`

## Criterion 8: Release notes and runbook are current

Status: **Met**

- `docs/specs/SETUP_DETECTION_OPTIMIZATION_RELEASE_NOTES_2026-02-24.md`
- `docs/specs/SETUP_DETECTION_OPTIMIZATION_RUNBOOK_2026-02-24.md`

## Criterion 9: Production deploy approval explicitly recorded

Status: **Met**

- `docs/specs/SETUP_DETECTION_OPTIMIZATION_DEPLOY_APPROVAL_2026-02-24.md`
