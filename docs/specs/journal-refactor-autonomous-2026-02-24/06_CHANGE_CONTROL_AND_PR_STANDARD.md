# Trade Journal Refactor — Change Control & PR Standard

> **Date:** 2026-02-24
> **Governing Spec:** `docs/specs/TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md`
> **Proposal:** `docs/trade-journal/TRADE_JOURNAL_CRITIQUE_AND_REFACTOR_PROPOSAL_2026-02-24.md`

---

## 1. Change Control Log

| ID | Date | Phase/Slice | Change Description | Files Affected | Approved By | Gate Status |
|----|------|-------------|-------------------|----------------|-------------|-------------|
| CC-001 | 2026-02-24 | Prep | Initial orchestration system, execution spec, validation gates | docs/specs/*, scripts/journal-refactor/* | Orchestrator | N/A (setup) |
| CC-002 | 2026-02-24 | P1 (1A–1D) | Foundation cleanup — delete duplicate AI Coach journal, remove API functions, schema migration, slide-over component | components/ai-coach/trade-journal.tsx (deleted), components/ai-coach/journal-insights.tsx (deleted), components/ai-coach/center-panel.tsx, lib/api/ai-coach.ts, supabase/migrations/*, components/journal/journal-slide-over.tsx | Orchestrator | PASS |
| CC-003 | 2026-02-24 | P2 (2A–2E) | Smart Capture — auto-draft, draft notification, psychology prompt, screenshot enhancement, context builder | lib/journal/auto-draft.ts, lib/journal/context-builder.ts, components/journal/draft-notification.tsx, components/journal/psychology-prompt.tsx, components/journal/screenshot-quick-add.tsx, lib/types/journal.ts, lib/journal/sanitize-entry.ts, app/members/journal/page.tsx | Orchestrator | PASS |
| CC-004 | 2026-02-24 | P3 (3A–3E) | Behavioral Analytics — bias detector, regime tagger, analytics enhancement, bias/setup cards | lib/journal/bias-detector.ts, lib/journal/regime-tagger.ts, app/api/members/journal/analytics/route.ts, app/api/members/journal/biases/route.ts, components/journal/bias-insights-card.tsx, components/journal/setup-performance-card.tsx, app/members/journal/analytics/page.tsx | Orchestrator | PASS |
| CC-005 | 2026-02-24 | P4 (4A–4E) | Workflow Integration — context API, pre-trade widget, insights enricher, grading enhancement, chart markers | app/api/members/journal/context/route.ts, components/journal/pre-trade-context.tsx, lib/journal/insights-enricher.ts, app/api/members/journal/grade/route.ts, components/journal/chart-entry-markers.tsx | Orchestrator | PASS |
| CC-006 | 2026-02-24 | P5 (5A–5D) | Polish — unit tests, barrel exports, documentation sync, final gate | lib/journal/__tests__/*.test.ts, lib/journal/index.ts, docs/specs/* | Orchestrator | PASS |

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
