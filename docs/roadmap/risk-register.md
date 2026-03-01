# SPX Risk Register

Updated: 2026-03-01
Owner model: each risk has a DRI and review cadence

| ID | Risk | Severity | Domain | Trigger | Mitigation | Detection | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | Position filled without protective stop | Critical | Execution | Entry fill before stop attached | Bracket/OCO v2 with hard invariant checks | Execution telemetry + reconciliation alerts | Open |
| R-002 | Non-SPX tick corrupts setup transitions | Critical | Setup pipeline | SPY/VIX tick processed as SPX | Symbol gate in websocket and evaluator | Transition audit logs by symbol | Open |
| R-003 | Cross-user execution data exposure | Critical | DB/RLS | Broad table policy | Owner-scoped policies + service-role boundaries | RLS integration tests | Open |
| R-004 | VWAP setup persistence failures | High | DB/schema | Constraint mismatch | Constraint migration + SetupType contract tests | Error-rate monitor on insert failures | Open |
| R-005 | PDT check fail-open under schema drift | High | Execution/risk | Column mismatch or query error | Schema fix + fail-closed rule for unknown PDT under <25k | PDT audit logs + alert | Open |
| R-006 | Snapshot fallback hides degradation | High | Data quality | Stage timeout returns neutral object | `dataQuality` contract + degraded reasons in payload | Stage fallback counters | Open |
| R-007 | Multi-instance snapshot stampede | Medium | Scale/perf | Concurrent cold refreshes | Redis advisory lock + cache | Massive request volume alerts | Open |
| R-008 | Optimizer gate advisory only | High | Optimizer/execution | Blocked gate ignored by execution | Enforce gate server-side before order placement | Gate rejection telemetry | Open |
| R-009 | Kill switch fails to neutralize open exposure | High | Execution ops | Cancel succeeds but position remains | Cancel + flatten + verify workflow | Kill-switch result report + pager | Open |
| R-010 | Confluence reliability muted by insufficient history | Medium | Decisioning | 1h EMA unreliable | Pull multi-day history and mark reliability | Reliability metrics per timeframe | Open |

## Review Cadence
- Weekly risk review on Fridays during release cut
- Critical risks require explicit sign-off before production ramp expansion
