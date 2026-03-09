# Risk Register & Decision Log - Swing Sniper Member Center

**Workstream:** Swing Sniper Member Center
**Date:** 2026-03-09
**Governing Spec:** `docs/specs/SWING_SNIPER_MEMBER_CENTER_EXECUTION_SPEC_2026-03-09.md`

---

## 1. Risk Register

### Active Risks

| ID | Risk | Likelihood | Impact | Severity | Mitigation | Owner | Status |
|----|------|------------|--------|----------|------------|-------|--------|
| R1 | Universe scanner grows beyond launch budget and becomes slow or rate-limit prone | Medium | High | P1 | Cap launch universe to 150 symbols initially and cache ranked results | Backend Agent | Open |
| R2 | LLM explanations drift from fact inputs and create false precision | Medium | High | P1 | Use grounded structured prompts and rules-based fallback summaries | Backend Agent | Open |
| R3 | Benzinga-enhanced fields are unavailable on current Massive.com plan | High | Medium | P1 | Gate enrichments behind availability checks and surface clear degraded copy | Backend Agent | Open |
| R4 | Exact contract picks still appear too complex for members without adequate context | Medium | Medium | P2 | Keep structure output readable with plain-language rationale and concise leg summaries | Frontend + Backend Agent | Open |
| R5 | New tab insertion causes mobile-nav overflow or discoverability regression | Low | Medium | P2 | Validate sidebar, top bar, and bottom-nav behavior with targeted E2E coverage | Frontend Agent | Open |
| R6 | Persistence schema for saved theses introduces auth/RLS drift | Medium | High | P1 | Add explicit user-owned RLS and route tests for 401/403 paths | Backend + Database Agent | Open |
| R7 | Opportunity scoring appears arbitrary without enough explanation | Medium | High | P1 | Show factor breakdown and narrative summary for every top-ranked idea | Frontend Agent | Open |
| R8 | Full-scope launch becomes visually dense and hard to navigate | Medium | High | P1 | Enforce progressive disclosure, clear tab hierarchy, and card-level summaries | Frontend Agent | Open |
| R9 | Documentation packet drift blocks clean autonomous implementation later | Medium | Medium | P1 | Keep tracker, slice reports, and decision log updated every slice | Docs Agent | Open |
| R10 | Backtest confidence can be misread as predictive certainty when sample history is thin | Medium | High | P1 | Archive daily snapshots, show resolved sample counts, and surface explicit caveats plus limited/unavailable status | Backend + Frontend Agent | Mitigated |

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
  1. Option A - pros/cons
  2. Option B - pros/cons
- **Decision:** Selected option
- **Rationale:** Why it was selected
- **Consequences:** Implementation impact
- **Revisit Trigger:** Condition to reopen decision
```

### Decisions

### D-001: Cap launch universe to a curated liquid set instead of full-market scanning

- **Date:** 2026-03-09
- **Context:** The original Swing Sniper concept assumes broad universe scanning, but the repo currently lacks a purpose-built background scanner pipeline.
- **Options Considered:**
  1. Launch with 4,000+ ticker coverage.
  2. Launch with a curated 150-symbol liquid universe and expand later.
- **Decision:** Option 2.
- **Rationale:** It materially lowers rate-limit, latency, and ranking-noise risk while still delivering a premium research experience.
- **Consequences:** Universe configuration becomes a deliberate product control, not an implementation shortcut.
- **Revisit Trigger:** Phase 1 proves stable and scan benchmarks justify expansion.

### D-002: Keep Swing Sniper reasoning provider-agnostic

- **Date:** 2026-03-09
- **Context:** The product vision names Claude, while the repo already contains OpenAI-oriented integrations.
- **Options Considered:**
  1. Force a Claude-only backend integration immediately.
  2. Introduce a provider-agnostic reasoning service contract.
- **Decision:** Option 2.
- **Rationale:** It preserves product intent without forcing stack drift into Phase 1.
- **Consequences:** `swingSniperReasoningService` must abstract prompt execution and fallback behavior.
- **Revisit Trigger:** Product approval requires a specific provider at launch.

### D-003: Launch includes full contract picking, but no brokerage integration

- **Date:** 2026-03-09
- **Context:** Product direction now requires Swing Sniper to pick contracts and ship the full system without any broker dependency.
- **Options Considered:**
  1. Stop at strategy labels and defer exact contracts.
  2. Require exact contract picks, but keep brokerage integration out of scope.
- **Decision:** Option 2.
- **Rationale:** Contract selection is part of the product value; broker integration is not.
- **Consequences:** Structure Lab must output concrete legs, pricing context, and invalidation logic.
- **Revisit Trigger:** Product later wants broker routing or order-entry workflows.

### D-004: Make Benzinga enhancement optional, not required for Swing Sniper go-live

- **Date:** 2026-03-09
- **Context:** Massive.com Benzinga add-on availability is not guaranteed in all environments.
- **Options Considered:**
  1. Block Swing Sniper until Benzinga partner data is confirmed.
  2. Use earnings, macro, and news fallbacks, with optional Benzinga enhancement.
- **Decision:** Option 2.
- **Rationale:** It avoids blocking the product on a dependency that is useful but not foundational.
- **Consequences:** Swing Sniper UI must label unavailable enrichment fields clearly.
- **Revisit Trigger:** Product positioning later depends on partner-exclusive data.

### D-005: Ship Slice 1.1 with a same-origin health preflight before the data engine

- **Date:** 2026-03-09
- **Context:** The user approved implementation, but the data engine slices are materially larger than simple route wiring.
- **Options Considered:**
  1. Add the tab and a blank placeholder page.
  2. Ship a shell with dependency preflight, route validation, and browser coverage first.
- **Decision:** Option 2.
- **Rationale:** It gives the member center a real, testable product surface immediately and de-risks later data work.
- **Consequences:** Slice 1.1 owns route shell, tab seeding, and health checks while later slices focus on the opportunity engine itself.
- **Revisit Trigger:** If later slices need a richer readiness contract than the current backend preflight payload.

### D-006: Use deterministic scenario/payoff approximations for Phase 2 Structure Lab

- **Date:** 2026-03-09
- **Context:** Phase 2 requires scenario summaries and payoff distribution across multi-leg and multi-expiry structures, but live option snapshots do not provide a complete path-dependent valuation surface for every leg in real time.
- **Options Considered:**
  1. Block Phase 2 until a full pricing engine (including term-value modeling) is available.
  2. Ship deterministic expiration-oriented approximations with explicit caveats and keep broker execution out of scope.
- **Decision:** Option 2.
- **Rationale:** It satisfies Phase 2 product requirements with transparent limitations while preserving delivery momentum.
- **Consequences:** Structure outputs are labeled as decision support and must not be presented as guaranteed execution outcomes.
- **Revisit Trigger:** Phase 4 confidence/backtest layer or a dedicated pricing engine introduces richer path-aware valuation.

### D-007: Build Phase 3 Risk Sentinel on top of existing position analyzer and exit advisor services

- **Date:** 2026-03-09
- **Context:** Risk Sentinel needs exposure and exit guidance quickly, but a net-new position-risk stack would duplicate existing options analytics and delay delivery.
- **Options Considered:**
  1. Build a Swing-Sniper-specific position analytics service from scratch.
  2. Reuse `positionAnalyzer` + `ExitAdvisor` outputs and normalize them into Risk Sentinel payloads.
- **Decision:** Option 2.
- **Rationale:** Existing services already provide validated exposure and advice primitives that can be safely wrapped for the Swing Sniper surface.
- **Consequences:** Monitoring alerts can include broader account risk context, including open positions created outside Swing Sniper.
- **Revisit Trigger:** Product requires strict in-scope filtering to Swing-Sniper-tagged positions only.

### D-008: Use daily signal-snapshot archive with conservative confidence reweighting for Phase 4

- **Date:** 2026-03-09
- **Context:** Phase 4 requires adaptive confidence from historical evidence, but per-refresh snapshots can be noisy and overfit when replay windows are short.
- **Options Considered:**
  1. Archive every Swing Sniper refresh and weight all observations equally.
  2. Archive one snapshot per symbol/day per user and reweight confidence with recency + data-quality + sample-size caveats.
- **Decision:** Option 2.
- **Rationale:** Daily snapshots preserve replay continuity while reducing noise and data bloat; conservative reweighting avoids false precision.
- **Consequences:** Confidence overlays can return `limited`/`unavailable` states and must display caveats when resolved samples are sparse.
- **Revisit Trigger:** Dedicated historical worker pipeline or richer intraday replay calibration is approved for post-launch optimization.

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
