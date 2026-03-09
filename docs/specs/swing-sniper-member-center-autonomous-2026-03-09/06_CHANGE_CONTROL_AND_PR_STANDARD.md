# Change Control & PR Standard - Swing Sniper Member Center

**Workstream:** Swing Sniper Member Center
**Date:** 2026-03-09
**Governing Spec:** `docs/specs/SWING_SNIPER_MEMBER_CENTER_EXECUTION_SPEC_2026-03-09.md`
**Branch:** `codex/swing-sniper-member-center`

---

## 1. Branch Strategy

| Branch | Purpose | Lifecycle |
|--------|---------|-----------|
| `codex/swing-sniper-member-center` | Primary workstream | Created at kickoff, merged after release gates |
| `codex/swing-sniper-member-center-slice-X.Y` | Optional per-slice branch | Merged to primary branch after slice gates |

Rules:

1. No direct commits to `main`.
2. One slice per PR unless the governing spec explicitly bundles adjacent slices.
3. Rebase with `main` before final release gates.

---

## 2. Commit and PR Convention

### Commit Message Format

```text
<type>(swing-sniper): <outcome> [SWING-S<X.Y>]
```

Examples:

- `feat(swing-sniper): add route shell and health preflight [SWING-S1.1]`
- `feat(swing-sniper): rank opportunity board from IV and catalyst scores [SWING-S1.2]`
- `test(swing-sniper): add dossier and structure lab regressions [SWING-S2.4]`

### PR Title Format

`[Swing Sniper] Slice X.Y: <outcome>`

### PR Body Required Sections

1. Slice scope and boundaries.
2. Files changed.
3. Gate commands with pass/fail output.
4. Risks or deviations.
5. Rollback procedure.

---

## 3. Review Protocol

| Reviewer | Responsibility |
|----------|----------------|
| Orchestrator | Scope control, spec compliance, release gate integrity |
| Frontend Agent | UI behavior correctness and design-system alignment |
| Backend Agent | Data contract, dependency fallback, auth correctness |
| QA Agent | Regression risk and test quality |

Checklist:

1. In-scope files only.
2. Slice acceptance criteria met.
3. Slice gates green.
4. Tracker and risk log updated.
5. Rollback remains viable.

---

## 4. Merge Policy

1. Slice-level gates must pass before merge.
2. At least one reviewer approval required.
3. Any spec deviation requires a decision-log entry before merge.
4. Squash merge slice branches into `codex/swing-sniper-member-center`.
5. Final merge to `main` only after full release gates pass.

---

## 5. Change Control Log

| Date | Slice | Change | Author | Approved By | Notes |
|------|-------|--------|--------|-------------|-------|
| 2026-03-09 | Planning | Authored Swing Sniper execution spec, runbook, release notes scaffold, phase reports, autonomous packet, and local mockup | Orchestrator | Pending product approval | No product code changes |
| 2026-03-09 | 1.1 | Added Swing Sniper member tab seeding, route shell, same-origin health proxy, backend preflight route, and targeted validation coverage | Codex | Product approval implicit via implementation request | No broker integration; optional Benzinga checks degrade cleanly |
| 2026-03-09 | 2.1-2.4 | Added Structure Lab service, structure recommendation endpoint, dossier integration, structure tab contract cards, payoff/distribution rendering, and targeted backend/E2E coverage | Codex | Product approval implicit via implementation request | Deterministic scenario math with explicit decision-support framing; no brokerage flow |
| 2026-03-09 | 3.1-3.3 | Added Risk Sentinel monitoring service/route/proxy, thesis health scoring, portfolio exposure summary, exit-alert guidance, and risk-tab/memo-rail UI integration with targeted backend/E2E coverage | Codex | Product approval implicit via implementation request | Alerts remain advisory and broker-free; portfolio context can include non-Swing-Sniper open positions |
| 2026-03-09 | 4.1-4.3 | Added signal snapshot archive migration + persistence, offline backtest service/route/proxy, and adaptive confidence reporting in dossier risk + memo rail with targeted backend/E2E coverage | Codex | Product approval implicit via implementation request | Backtest confidence is explicitly caveated and advisory; low-sample outputs are labeled limited/unavailable |

---

## 6. Emergency Path

If a regression lands:

1. Stop current slice work.
2. Branch from `main` for hotfix.
3. Ship minimal fix with release gates.
4. Rebase workstream branch on updated `main`.
5. Record incident and mitigation in the risk/decision log.
