# Academy Overhaul — Risk Register & Decision Log

> **Created:** 2026-02-24

---

## Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|----|------|-----------|--------|------------|--------|
| R1 | Existing schema enums may conflict with new values | Low | Medium | Use ADD VALUE IF NOT EXISTS | Open |
| R2 | Backend tests may fail due to missing Supabase connection in CI | Medium | High | Mock Supabase client in tests | Open |
| R3 | TypeScript strict mode may surface pre-existing any types | Medium | Low | Only fix `any` in new code per CLAUDE.md | Open |
| R4 | Large seed data migrations may be slow | Low | Low | Use ON CONFLICT for idempotency | Open |

---

## Decision Log

| ID | Decision | Rationale | Date | Phase |
|----|----------|-----------|------|-------|
| D1 | Use existing academy_v3 schema as base, extend rather than replace | Preserve existing Phase 0-3 work | 2026-02-24 | 1 |
| D2 | Backend uses Jest (not Vitest) per backend/package.json | Backend has its own test configuration | 2026-02-24 | 1 |
| D3 | heroImageUrl and coverImageUrl already exist in domain.ts | Schema migration should use IF NOT EXISTS for columns | 2026-02-24 | 1 |
