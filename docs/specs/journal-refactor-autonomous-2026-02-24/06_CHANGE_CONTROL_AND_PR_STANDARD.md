# Trade Journal Refactor — Change Control & PR Standard

> **Date:** 2026-02-24
> **Governing Spec:** `docs/specs/TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md`
> **Proposal:** `docs/trade-journal/TRADE_JOURNAL_CRITIQUE_AND_REFACTOR_PROPOSAL_2026-02-24.md`

---

## 1. Change Control Log

| ID | Date | Phase/Slice | Change Description | Files Affected | Approved By | Gate Status |
|----|------|-------------|-------------------|----------------|-------------|-------------|
| CC-001 | 2026-02-24 | Prep | Initial orchestration system, execution spec, validation gates | docs/specs/*, scripts/journal-refactor/* | Orchestrator | N/A (setup) |

---

## 2. PR Standard

### Branch Naming
```
claude/trade-journal-refactor-<phase>-<slice>-<session-id>
```

### Commit Message Format
```
journal-refactor(P<phase>-S<slice>): <imperative description>

Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md
Phase: <phase number> — <phase name>
Slice: <slice id> — <slice objective>

Changes:
- <bullet list of changes>

Gate: <PASS|FAIL> — <gate command output summary>
```

### PR Template
```markdown
## Phase/Slice
P<N>-S<N>: <Slice Title>

## Spec Compliance
- [x] Checklist item from execution spec
- [x] ...

## Gate Results
```
<paste gate command output>
```

## Files Changed
- `path/to/file.ts` — <what changed>

## Test Evidence
- Unit: <pass/fail count>
- E2E: <pass/fail count>
- Lint: clean
- Types: clean
- Build: clean

## Rollback
<How to revert this slice>
```

### Review Checklist (Automated by Orchestrator)
1. [ ] Spec compliance checks all marked complete
2. [ ] Gate commands all pass
3. [ ] No files outside ownership boundary modified
4. [ ] No `any` types introduced
5. [ ] No new ESLint warnings
6. [ ] Zero regressions in existing tests
7. [ ] New code has tests
8. [ ] UI follows Emerald Standard

---

## 3. Merge Policy

- Each slice is merged independently after its gate passes
- Slices within a phase can be parallelized if they touch disjoint files
- Cross-phase dependencies must complete before dependent slices begin
- Orchestrator validates merge readiness before each slice merge
