# Change Control & PR Standard — Trade Review UX Hardening

**Workstream:** Trade Review Detail UX Hardening  
**Date:** 2026-03-01  
**Governing Spec:** `docs/specs/TRADE_REVIEW_UX_HARDENING_EXECUTION_SPEC_2026-03-01.md`  
**Branch:** `main`

---

## 1. Branch Strategy

| Branch | Purpose | Lifecycle |
|--------|---------|-----------|
| `codex/trade-review-ux-hardening` | Primary workstream | Created at kickoff, merged after release gates |
| `codex/trade-review-ux-hardening-slice-X.Y` | Optional per-slice branch | Merged to primary branch after slice gates |

Rules:
- No direct commits to `main`.
- One slice per PR unless explicitly bundled in spec.
- Rebase with `main` before final release gate.

---

## 2. Commit and PR Convention

### Commit Message Format

```
<type>(trade-review): <outcome> [TRUX-S<X.Y>]
```

Examples:
- `feat(trade-review): add persistent context bar and queue age [TRUX-S1.1]`
- `fix(trade-review): replace window.confirm publish flow with modal [TRUX-S2.2]`
- `test(trade-review): update e2e coverage for modal publish path [TRUX-S4.3]`

### PR Title Format

`[TradeReview-UX] Slice X.Y: <outcome>`

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
| QA Agent | Regression risk and test quality |
| API Agent | Contract and security correctness (if route changes) |

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
3. Any spec deviation requires decision-log entry before merge.
4. Squash merge slice branches into `codex/trade-review-ux-hardening`.
5. Final merge to `main` only after full release gates pass.

---

## 5. Change Control Log

| Date | Slice | Change | Author | Approved By | Notes |
|------|-------|--------|--------|-------------|-------|
| 2026-03-01 | Planning | Prepared completeness addendum + execution packet + autonomous control docs | Orchestrator | Pending implementation kickoff | No product code changes |
| 2026-03-01 | S0.1 / S0.2 / S1.1 | Added typed detail contract usage, persistent context status strip, and high-signal P&L summary in header context | Orchestrator | Self-reviewed | Foundation slices completed |
| 2026-03-01 | S1.2 / S1.3 / S2.1 | Shifted to reference-tab + workspace-priority layout, unified AI generation card, and added dirty-state/autosave/beforeunload protections | Orchestrator | Self-reviewed | Saves now resilient to reload/navigation errors |
| 2026-03-01 | S2.2 / S2.3 / S2.4 | Replaced `window.confirm` publish/dismiss with premium modals, added preview member view dialog, and surfaced trader profile + member notes in workspace | Orchestrator | Self-reviewed | Publish now guarded and previewable |
| 2026-03-01 | S3.1 / S3.2 / S3.3 | Introduced segmented grade/confidence controls, larger screenshot thumbnails with zoom, richer activity entries, and loading skeleton state | Orchestrator | Self-reviewed | Accessibility labels + authoring ergonomics improved |
| 2026-03-01 | S4.1 / S4.2 / S4.3 | Added prev/next review navigation with symbol/member labels, keyboard shortcuts (`Cmd/Ctrl+S/G/Enter`, `Esc`), and expanded admin trade-review E2E tests | Orchestrator | Self-reviewed | Final targeted gates passed |

---

## 6. Emergency Path

If a regression lands:
1. Stop current slice work.
2. Branch from `main` for hotfix.
3. Ship minimal fix with full release gates.
4. Rebase workstream branch on updated `main`.
5. Record incident and mitigation in risk/decision log.
