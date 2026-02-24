# Trade Journal Refactor — Risk Register & Decision Log

> **Date:** 2026-02-24
> **Governing Spec:** `docs/specs/TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md`

---

## 1. Risk Register

| ID | Risk | Probability | Impact | Mitigation | Owner | Status |
|----|------|-------------|--------|------------|-------|--------|
| R-001 | Auto-draft creates noise for non-SPX trades | Medium | Medium | Only auto-draft for trades originating from SPX CC; manual entry for everything else | Backend Agent | Open |
| R-002 | Bias detection false positives on small samples | Medium | High | Require minimum 20 trades before surfacing bias scores; show confidence intervals | Backend Agent | Open |
| R-003 | Regime tagging accuracy depends on engine state quality | Medium | Medium | Validate regime tags against historical VIX/GEX data; flag "low confidence" regime tags | Backend Agent | Open |
| R-004 | Pre-trade context widget slows SPX CC rendering | Low | Medium | Lazy-load context widget; cache recent journal stats per symbol/setup | Frontend Agent | Open |
| R-005 | Psychology prompt timing annoys users | Medium | Medium | Make prompt optional (settings toggle); respect "don't ask me again" for current session | Frontend Agent | Open |
| R-006 | Journal history in AI grading increases API latency | Low | Low | Pre-aggregate journal stats into a cache table; refresh on new entry | Backend Agent | Open |
| R-007 | Deleting AI Coach journal breaks existing workflows | Low | High | Verify zero non-test imports before deletion; AI Coach slide-over replacement ready before delete | Frontend Agent | Open |
| R-008 | Schema migration fails on production data | Low | Critical | Migration is additive only (nullable columns); test against production data snapshot | Database Agent | Open |
| R-009 | Analytics query performance degrades with large datasets | Medium | Medium | Benchmark with 1000+ entries; add indexes; consider materialized view if needed | Backend Agent | Open |
| R-010 | Context compaction mid-phase loses agent state | Medium | Medium | Each agent preserves: current slice objective, files modified, test status, branch, blockers, spec reference | Orchestrator | Open |

---

## 2. Decision Log

| ID | Date | Decision | Rationale | Alternatives Considered | Made By |
|----|------|----------|-----------|------------------------|---------|
| D-001 | 2026-02-24 | Additive-only schema changes | Preserves V2 foundation, eliminates migration risk | Full schema rewrite (rejected: unnecessary risk) | Orchestrator |
| D-002 | 2026-02-24 | Five-phase sequential delivery with parallel slices within phases | Allows incremental validation while maintaining phase dependencies | Big-bang delivery (rejected: too risky), fully sequential slices (rejected: too slow) | Orchestrator |
| D-003 | 2026-02-24 | Delete AI Coach journal before building replacement | Clean break prevents confusion; slide-over uses existing journal components | Deprecate gradually (rejected: dual maintenance burden) | Orchestrator |
| D-004 | 2026-02-24 | Backend services in `backend/src/services/journal/` not `lib/journal/` | Journal intelligence services need backend context (DB access, caching); `lib/journal/` stays for shared client/server code | All in `lib/journal/` (rejected: backend-only services don't belong in shared lib) | Orchestrator |
| D-005 | 2026-02-24 | Spec-driven orchestration with automated gate validation | Ensures every phase is verified against the governing spec before proceeding | Manual review only (rejected: error-prone at scale) | Orchestrator |
