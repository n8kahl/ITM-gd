# Risk Register & Decision Log — Discord Member Access Hardening

**Workstream:** Discord membership sync, gate enforcement, and admin role-management reliability
**Date:** 2026-03-06

## Risk Register
| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|------------|--------|------------|--------|
| R1 | Empty/invalid members gate config locks out users | Medium | High | Validation + default fallback role IDs | Open |
| R2 | Middleware settings lookup adds latency | Medium | Medium | TTL cache + env/default fallback | Open |
| R3 | Claims SQL function behavior differs across envs | Medium | High | Idempotent migration + explicit fallback values | Open |
| R4 | Admin operators set unknown tab role IDs | High | Medium | Role-name resolution + unknown-role warnings in tabs UI | Open |

## Decision Log
### D-001: Members gate source of truth
- Date: 2026-03-06
- Decision: use `app_settings.members_required_role_ids` as canonical runtime gate config with env/default fallback.
- Rationale: allows production config changes without deploy while preserving fail-safe defaults.

### D-002: Keep role-tier model intact
- Date: 2026-03-06
- Decision: do not replace tier/tab model in this release; harden operability first.
- Rationale: minimizes blast radius while resolving access incident.
