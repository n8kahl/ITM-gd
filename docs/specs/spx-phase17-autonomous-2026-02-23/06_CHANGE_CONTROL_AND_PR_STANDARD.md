# Phase 17: Change Control & PR Standard

## Branch Strategy
- **Branch:** `claude/spx-phase-17-hardening-V4LdY`
- **Base:** `master`
- **Merge Strategy:** Squash merge after all gates green

## PR Standard
Every PR must include:
1. **Scope:** Which slice(s) are included
2. **Risk:** Impact assessment and blast radius
3. **Tests Run:** List of test commands and results
4. **Rollback Plan:** Feature flag(s) to disable

## Commit Format
```
<type>(spx): <description> [P17-S<N>]
```

## Change Log

| Date | Slice | Files Changed | Author | Status |
|------|-------|---------------|--------|--------|
| 2026-02-23 | S1 | Migration, executionStateStore.ts, executionEngine.ts | Claude | Pending |
| 2026-02-23 | S2 | spx.ts, client.ts, kill-switch-button.tsx | Claude | Pending |
| 2026-02-23 | S3 | orderLifecycleManager.ts, client.ts, executionEngine.ts | Claude | Pending |
| 2026-02-23 | S4 | autoFlattenJob.ts, pdtTracker.ts, executionEngine.ts | Claude | Pending |
| 2026-02-23 | S5 | Migration, executionEngine.ts | Claude | Pending |
| 2026-02-23 | S6 | optimizer.ts, engine.ts, setupDetector.ts, executionEngine.ts | Claude | Pending |
| 2026-02-23 | S7 | setupDetector.ts, optimizer.ts, engine.ts | Claude | Pending |
| 2026-02-23 | S8 | snapshotService.ts, setupDetector.ts, optimizer.ts, decision-engine.ts | Claude | Pending |
| 2026-02-23 | S9 | vwapService.ts, setupDetector.ts, snapshotService.ts, decision-engine.ts | Claude | Pending |
| 2026-02-23 | S10 | calendarService.ts, setupDetector.ts, optimizer.ts | Claude | Pending |
