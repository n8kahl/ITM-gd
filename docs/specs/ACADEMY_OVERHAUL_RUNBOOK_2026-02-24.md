# Academy Overhaul Runbook

**Date:** 2026-02-24
**Status:** Ready for deployment review

---

## 1. Pre-Deployment Checklist

```bash
# 1. Verify branch is up-to-date
git fetch origin claude/orchestrate-tradeitm-academy-OolCG
git log --oneline -5

# 2. Run full validation gates
pnpm exec tsc --noEmit
pnpm run build
pnpm exec eslint components/academy/ app/members/academy/ lib/academy-v3/
pnpm vitest run
pnpm vitest run lib/academy-v3/__tests__/frontend-contracts.test.ts

# 3. Verify migrations are syntactically valid
# (Review each file manually — they are idempotent SQL)
ls -la supabase/migrations/20260224*.sql
```

---

## 2. Deployment Steps

### 2.1 Database Migrations

Apply in order:
```bash
# Schema extensions (must run first)
npx supabase db push  # Applies all pending migrations in order
```

Migration order (enforced by timestamps):
1. `20260224100000` — Gamification schema
2. `20260224100001` — Reporting tables
3. `20260224200000` — Track 1 seed data
4. `20260224200001` — Tracks 2-3 seed data
5. `20260224200002` — Tracks 4-6 seed data
6. `20260224200003` — Achievement definitions

All migrations use `ON CONFLICT` / `IF NOT EXISTS` — safe to re-run.

### 2.2 Backend Deployment

New Express routes registered in `backend/src/server.ts`:
- `academy-gamification`
- `academy-activities`
- `academy-analytics`
- `academy-admin`

No new environment variables required. Uses existing Supabase connection.

### 2.3 Frontend Deployment

Standard Next.js deployment. New routes are part of the App Router:
- `/members/academy/*` (already existed, now serves v3 content)
- No new environment variables required

---

## 3. Rollback Procedure

### Quick Rollback (Frontend Only)
Revert the frontend deployment to the previous build. Academy pages will show the prior v3 implementation (pre-overhaul).

### Full Rollback (Including Database)
1. **Do NOT drop tables** — The migration creates new tables/columns alongside existing ones.
2. Revert frontend and backend deployments.
3. The seed data remains in the database but is not referenced by the reverted code.
4. Achievement and gamification tables will be empty (no user data yet).

### Partial Rollback (Disable Gamification)
If gamification causes issues but the curriculum is fine:
1. Remove the 4 new route registrations from `backend/src/server.ts`
2. Redeploy backend only
3. Frontend will gracefully handle missing gamification API (components check for data availability)

---

## 4. Monitoring

### Key Metrics to Watch
- **Academy page load time** — Should be < 2s (new components add ~28 files)
- **API response time** — Gamification/analytics endpoints should be < 500ms p95
- **Migration execution time** — Seed data inserts may take 10-30s on first run
- **Error rates** — Monitor Sentry for new academy-related errors

### Health Checks
```bash
# Verify academy routes load
curl -s -o /dev/null -w "%{http_code}" https://<domain>/members/academy
# Expected: 200 (or 302 if not authenticated)

# Verify redirect stubs work
curl -s -o /dev/null -w "%{http_code}" -L https://<domain>/members/academy-v3
# Expected: 308 -> 200

# Verify API endpoint
curl -s -o /dev/null -w "%{http_code}" https://<domain>/api/academy-v3/plan
# Expected: 401 (unauthenticated) or 200 (authenticated)
```

---

## 5. Post-Deployment Tasks

1. **Verify curriculum visibility** — Log in as a test user and confirm all 6 tracks appear in the module catalog.
2. **Test activity submission** — Complete one interactive activity and verify XP awards.
3. **Check achievement triggers** — Complete first lesson and verify "First Lesson" achievement unlocks.
4. **Validate analytics** — After 24h, run admin aggregation trigger and verify daily analytics populate.

---

## 6. Operational Notes

### Adding New Curriculum
1. Create a new seed migration: `supabase/migrations/YYYYMMDD_academy_<description>.sql`
2. Follow the pattern in existing seed files (insert tracks → modules → lessons → blocks → competency links)
3. Use `ON CONFLICT` for idempotency
4. Run `npx supabase db push` to apply

### Adding New Activity Types
1. Add the type to `academy_block_type` enum in a new migration
2. Create the React component in `components/academy/activities/`
3. Add the scorer in `backend/src/services/academy-scoring.ts`
4. Register in `components/academy/activities/index.ts`
5. Update `components/academy/lesson/academy-block-renderer.tsx`

### Adding New Achievements
1. Insert into `academy_achievements` table via migration
2. Add SVG badge to `public/academy-media/badges/`
3. Achievement unlock logic is handled by the `academy-xp` service based on `unlock_criteria` JSON
