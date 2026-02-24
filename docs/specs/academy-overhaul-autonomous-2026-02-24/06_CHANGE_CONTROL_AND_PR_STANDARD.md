# Academy Overhaul — Change Control & PR Standard

> **Created:** 2026-02-24

---

## Change Control Log

| ID | Phase/Slice | Files Changed | Author Agent | Gate Status | Commit SHA |
|----|------------|---------------|--------------|-------------|------------|
| — | — | — | — | — | — |

---

## PR Standard

### Commit Messages
- Format: `academy-overhaul: Phase N complete — <summary>`
- One commit per phase (consolidation commit after all slices in a phase pass gates)

### Branch Strategy
- Development: `claude/orchestrate-tradeitm-academy-OolCG`
- Never push to main/master

### Validation Gates (per commit)
1. `pnpm exec tsc --noEmit` — zero errors
2. `pnpm run build` — succeeds
3. `pnpm exec eslint <touched files>` — zero warnings in new code
4. Phase-specific tests pass
