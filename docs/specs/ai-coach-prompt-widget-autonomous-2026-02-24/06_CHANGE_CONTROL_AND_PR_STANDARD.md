# AI Coach Prompt/Widget Hardening: Change Control & PR Standard

## Branch Strategy
- Branch: `codex/ai-coach-prompt-widget-hardening`
- Base: `master`
- Merge strategy: squash merge after slice gates are green

## PR Standard
Each PR must include:
1. Slice(s) included and scope boundaries.
2. Risk and blast-radius statement.
3. Exact gate commands and outcomes.
4. Rollback procedure.

## Commit Format
```
<type>(ai-coach): <description> [PW-S<N>]
```

## Change Log

| Date | Slice | Files Changed | Author | Status |
|------|-------|---------------|--------|--------|
| 2026-02-24 | S1 | `intentRouter.ts`, `intentRouter.test.ts` | Codex | Complete |
| 2026-02-24 | S2 | `page.tsx`, `center-panel.tsx`, `follow-up-chips.tsx` | Codex | Complete |
| 2026-02-24 | S3 | `use-ai-coach-chat.ts`, `widget-actions.ts`, `widget-cards.tsx`, `use-mobile-tool-sheet.ts` | Codex | Complete |
| 2026-02-24 | S4 | `symbol-search.tsx`, `chart-toolbar.tsx`, `center-panel.tsx` | Codex | Complete |
