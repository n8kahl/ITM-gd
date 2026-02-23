# Phase 17: Risk Register & Decision Log

## Risk Register

| ID | Risk | Severity | Mitigation | Status |
|----|------|----------|------------|--------|
| R1 | Orphaned positions on backend restart | Critical | Supabase state persistence (S1) | Mitigating |
| R2 | Kill switch doesn't cancel orders | Critical | Tradier API cancel integration (S2) | Mitigating |
| R3 | Unknown fill status after order placement | High | Order status polling loop (S3) | Mitigating |
| R4 | 0DTE positions held past close | High | Auto-flatten scheduled job (S4) | Mitigating |
| R5 | PDT violations for small accounts | High | PDT tracking service (S4) | Mitigating |
| R6 | Duplicate orders from race condition | High | DB uniqueness constraint (S5) | Mitigating |
| R7 | T1 price miscalculation (1.35x hardcode) | Medium | Geometry-based inference (S5) | Mitigating |
| R8 | Late-session T2 degradation | Medium | Time-decay geometry (S6) | Mitigating |
| R9 | ORB 0% trigger rate | Medium | Gate relaxation (S7) | Mitigating |
| R10 | No VIX awareness | Low | VIX regime overlay (S8) | Mitigating |

## Decision Log

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2026-02-23 | Feature flags for all new functionality | Enables independent rollback per feature | All slices |
| 2026-02-23 | P0 slices (S1-S3) before P1/P2 | Safety-critical execution gaps first | Delivery order |
| 2026-02-23 | Supabase for state persistence over Redis | Durability > speed for execution state | S1 |
| 2026-02-23 | 5-second polling interval for order status | Balance between API rate limits and latency | S3 |
