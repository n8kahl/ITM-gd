# Risk Register & Decision Log — Mobile Native App Experience Hardening

**Workstream:** Members iPhone Native-Feel Hardening  
**Date:** 2026-03-09  
**Governing Spec:** `docs/specs/MOBILE_NATIVE_APP_EXPERIENCE_EXECUTION_SPEC_2026-03-09.md`

---

## 1. Risk Register

### Active Risks

| ID | Risk | Likelihood | Impact | Severity | Mitigation | Owner | Status |
|----|------|------------|--------|----------|------------|-------|--------|
| R1 | Navigation transaction refactor introduces browser-history edge regressions | Medium | High | P1 | Add tab-storm E2E coverage and instrument nav start/success/stall events | Frontend Agent | Open |
| R2 | Route warming increases network pressure on constrained mobile devices | Medium | Medium | P1 | Use selective prefetch list for high-frequency tabs and measure request volume | Frontend Agent | Open |
| R3 | Market/chart proxy endpoints return inconsistent error payloads across routes | Medium | High | P1 | Normalize proxy error envelope and lock contract tests | Frontend + Backend Agent | Open |
| R4 | Last-known-good fallback could be mistaken for live data | Medium | High | P1 | Add explicit stale badge, timestamp, and retrying state copy | Frontend Agent | Open |
| R5 | Connectivity banner can produce false degraded/offline indicators | Medium | Medium | P2 | Combine navigator signal with lightweight heartbeat before displaying degraded state | Frontend Agent | Open |
| R6 | iOS standalone OAuth round-trip can lose redirect intent | Medium | High | P1 | Persist return intent across context switch and validate callback recovery path | Frontend Agent | Open |
| R7 | Safe-area/viewport hardening may regress desktop surfaces | Low | Medium | P2 | Scope layout changes behind mobile media queries and standalone selectors | Frontend Agent | Open |
| R8 | Persisting AI Coach chart/chat state increases memory pressure on low-end devices | Medium | Medium | P1 | Keep only active contexts mounted and prune non-essential cached state | Frontend Agent | Open |
| R9 | Mobile stress Playwright suite can be flaky under CI contention | Medium | Medium | P1 | Isolate brittle selectors, enforce deterministic waits, and run single-worker profile | QA Agent | Open |
| R10 | Documentation packet drift blocks valid release sign-off | Medium | Medium | P1 | Update tracker, phase report, change control, and release docs in same slice | Docs Agent | Open |

### Retired Risks

| ID | Risk | Resolution | Date |
|----|------|------------|------|
| | | | |

---

## 2. Decision Log

### Decision Template

```markdown
### D-XXX: <Decision Title>
- **Date:** YYYY-MM-DD
- **Context:** Why this decision was required
- **Options Considered:**
  1. Option A — pros/cons
  2. Option B — pros/cons
- **Decision:** Selected option
- **Rationale:** Why it was selected
- **Consequences:** Implementation impact
- **Revisit Trigger:** Condition to reopen decision
```

### Decisions

### D-001: Remove hard-reload fallback from standard members-tab transitions

- **Date:** 2026-03-09
- **Context:** Users report route lockups and manual refresh recovery on `/members` tab switching.
- **Options Considered:**
  1. Keep `window.location.assign` fallback for all timeout cases.
  2. Use deterministic in-app nav transaction state and expose explicit retry UX.
- **Decision:** Option 2.
- **Rationale:** Hard reloads mask transition bugs and degrade native feel; explicit nav state is observable and testable.
- **Consequences:** Nav handler and tab controls must expose in-flight and stall semantics.
- **Revisit Trigger:** If deterministic model causes unrecoverable dead-end state in production.

### D-002: Canonicalize browser-side market/chart fetches through same-origin proxies

- **Date:** 2026-03-09
- **Context:** Mobile users report intermittent market-data unavailable and chart load failures.
- **Options Considered:**
  1. Continue mixed direct backend and proxy access.
  2. Standardize browser requests through same-origin proxy routes.
- **Decision:** Option 2.
- **Rationale:** Same-origin routing reduces token/CORS drift and simplifies retry/error handling.
- **Consequences:** Proxy response contracts must be normalized across chart, levels, and market APIs.
- **Revisit Trigger:** If proxy latency becomes materially worse than direct access.

### D-003: Show stale-but-usable market state instead of blank failure cards

- **Date:** 2026-03-09
- **Context:** Mobile dashboard feels broken when transient upstream failures occur.
- **Options Considered:**
  1. Keep current unavailable-state fallback.
  2. Render last-known-good payload with stale labeling and active retry cues.
- **Decision:** Option 2.
- **Rationale:** Preserves user continuity while maintaining trust through explicit stale state communication.
- **Consequences:** Components must clearly distinguish live and stale modes.
- **Revisit Trigger:** If stale displays generate user confusion or support noise.

### D-004: Keep this workstream unflagged, but slice-revertable

- **Date:** 2026-03-09
- **Context:** Decide whether to add feature flags for each mobile hardening slice.
- **Options Considered:**
  1. Add flags to every slice.
  2. Keep changes unflagged and rely on per-slice rollback discipline.
- **Decision:** Option 2.
- **Rationale:** Scope is mostly UI and routing behavior; per-slice rollback is sufficient and faster.
- **Consequences:** Strong commit hygiene and tracker updates are mandatory.
- **Revisit Trigger:** If any slice introduces backend schema/auth model risk.

---

## 3. Issue Tracking

### Open Issues

| ID | Slice | Issue | Severity | Assigned To | Status |
|----|-------|-------|----------|-------------|--------|
| | | | | | |

### Resolved Issues

| ID | Slice | Issue | Resolution | Date |
|----|-------|-------|------------|------|
| | | | | |
