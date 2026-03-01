# Risk Register & Decision Log — Trade Review UX Hardening

**Workstream:** Trade Review Detail UX Hardening  
**Date:** 2026-03-01  
**Governing Spec:** `docs/specs/TRADE_REVIEW_UX_HARDENING_EXECUTION_SPEC_2026-03-01.md`

---

## 1. Risk Register

### Active Risks

| ID | Risk | Likelihood | Impact | Severity | Mitigation | Owner | Status |
|----|------|-----------|--------|----------|------------|-------|--------|
| R1 | Autosave introduces race conditions that overwrite newer edits | Medium | High | P0 | Use request versioning and save guards; keep last-write timestamp in client state | Frontend Agent | Open |
| R2 | Replacing `window.confirm` breaks existing E2E flow and creates false negatives | High | Medium | P1 | Update E2E assertions in same slice as modal change | QA Agent | Open |
| R3 | Publish server validation blocks valid drafts unexpectedly | Medium | High | P0 | Align server validator with UI minimum-content contract and add unit tests | API Agent | Open |
| R4 | Added context bar fields drift from API contract over time | Medium | Medium | P1 | Strong typing + targeted contract test for detail API payload shape | API Agent | Open |
| R5 | Layout rebalance causes mobile regressions on admin page | Medium | Medium | P1 | Preserve mobile-first stack and add responsive assertions in Playwright | Frontend Agent | Open |
| R6 | Keyboard shortcuts conflict with browser/native text editing behavior | Medium | Low | P2 | Scope shortcuts to page context and ignore while focus is inside text inputs where needed | Frontend Agent | Open |
| R7 | Concurrent admin actions publish/dismiss inconsistent states | Medium | High | P0 | Enforce assignment/concurrency checks server-side and log conflict outcomes | API Agent | Open |
| R8 | Activity log actor name resolution adds N+1 query overhead | Low | Medium | P2 | Batch actor profile lookup by unique actor IDs | API Agent | Open |

### Retired Risks

| ID | Risk | Resolution | Date |
|----|------|-----------|------|
| | | | |

---

## 2. Decision Log

### D-001: P0 Safety Before Visual Polish

- **Date:** 2026-03-01
- **Context:** UX audit includes both safety and polish work.
- **Options Considered:**
  1. Start with typography/cards first.
  2. Start with state safety and publish guardrails.
- **Decision:** Option 2.
- **Rationale:** Draft-loss and invalid publish are higher-risk than visual inconsistencies.
- **Consequences:** P0 safety slices are gated before P1/P2 polish.
- **Revisit Trigger:** None unless product owner re-prioritizes risk posture.

### D-002: Keep Scope to `/admin/trade-review/[id]` for First Cut

- **Date:** 2026-03-01
- **Context:** Some recommendations imply queue page and broader workflow changes.
- **Options Considered:**
  1. Expand to queue/browse redesign now.
  2. Restrict first release to detail page + supporting API contract extensions.
- **Decision:** Option 2.
- **Rationale:** Faster controlled release with lower blast radius.
- **Consequences:** Queue-level enhancements remain follow-up work.
- **Revisit Trigger:** After first hardening release stabilizes.

### D-003: Additive API Evolution Only

- **Date:** 2026-03-01
- **Context:** Context bar and activity log improvements require additional API data.
- **Options Considered:**
  1. Break payload shape and version endpoint.
  2. Add fields without breaking existing consumers.
- **Decision:** Option 2.
- **Rationale:** Minimizes integration risk and supports incremental rollout.
- **Consequences:** Client must tolerate missing fields during partial deployment.
- **Revisit Trigger:** If contract complexity becomes unmanageable.

---

## 3. Open Issues

| ID | Slice | Issue | Severity | Assigned To | Status |
|----|-------|-------|----------|-------------|--------|
| I-001 | 0.2 | Confirm exact minimum-content contract expected for publish endpoint | P0 | Product/Orchestrator | Open |
| I-002 | 2.1 | Decide autosave conflict resolution strategy (last-write-wins vs compare-and-merge) | P1 | Frontend/API | Open |
