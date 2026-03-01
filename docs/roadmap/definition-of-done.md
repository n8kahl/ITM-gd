# SPX Definition of Done

A ticket is DONE only when all criteria below pass.

## 1. Correctness
- Behavior matches documented acceptance criteria.
- Domain contracts are preserved (snapshot, execution, setup eligibility).

## 2. Tests
- Unit tests added/updated for logic changes.
- Integration tests added/updated for service boundaries.
- E2E coverage added for user-visible or execution-critical flows when applicable.
- CI is green.

## 3. Telemetry and Observability
- Production-path logs and metrics added/updated.
- Error and fallback paths are observable.
- New alerts documented if needed.

## 4. Documentation and Runbooks
- Relevant docs updated (spec, roadmap, or runbook).
- Operational behavior changes include runbook updates.

## 5. Rollout and Safety
- Risk > Low changes are behind a feature flag.
- Staging verification is completed and recorded.
- Rollback path is documented for the change.

## 6. Security and Data Integrity
- RLS impact evaluated for DB changes.
- Schema contract remains aligned across code, migrations, and tests.
