# AI Coach Prompt/Widget Hardening: Risk Register & Decision Log

## Risk Register

| ID | Risk | Severity | Mitigation | Status |
|----|------|----------|------------|--------|
| R1 | Over-relaxed contract requirements reduce response rigor | Medium | Keep strict checks on high-risk setup/strategy intents | Mitigated |
| R2 | Beginner-first copy reduces advanced discoverability | Low | Keep one explicit advanced quick prompt | Mitigated |
| R3 | Chart context notes become noisy or stale | Medium | Dedupe + cap notes; clear on symbol/timeframe sync reset | Mitigated |
| R4 | Watchlist UX introduces state mismatch with chart symbol | Medium | Normalize symbols and sync fallback on remove/select | Mitigated |
| R5 | Targeted AI Coach E2E flake due default timeout | Low | Use explicit `--timeout=120000` for targeted audit spec | Mitigated |

## Decision Log

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| 2026-02-24 | Remove generic `what is/what does` from company profile intent triggers | Prevent educational misroutes for new traders | Intent quality |
| 2026-02-24 | Rewrite only on blocking contract violations | Reduce unnecessary rewrites on informational prompts | Response stability |
| 2026-02-24 | Promote beginner-first quick prompts/chips | Improve onboarding clarity and reduce cognitive load | UX |
| 2026-02-24 | Carry context notes through widget->mobile->chart flow | Increase visual coherence between chat answers and chart | Chart experience |
| 2026-02-24 | Keep watchlist local in preferences for this slice | Avoid backend surface expansion during refactor hardening | Maintainability |
