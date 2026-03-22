# Admin CMS Operational Runbook

> **Last Updated:** 2026-03-22
> **Owner:** Platform Operations
> **Scope:** Admin dashboard, member access control, course management, notifications, settings, system diagnostics

---

## 1. Architecture Overview

### Admin Route Structure

| Route | Page | API Endpoint(s) |
|-------|------|-----------------|
| `/admin` | Command Center Dashboard | `/api/admin/analytics`, `/api/admin/leads`, `/api/admin/system` |
| `/admin/analytics` | Analytics Dashboard | `/api/admin/analytics` |
| `/admin/members-access` | Member Access Control | `/api/admin/members/*` |
| `/admin/trade-review` | Trade Review Queue | `/api/admin/trade-review/*` |
| `/admin/courses` | Course Management | `/api/admin/courses` |
| `/admin/notifications` | Push Notifications | `/api/admin/notifications` |
| `/admin/roles` | Discord Role Mapping | `/api/admin/roles` |
| `/admin/settings` | Configuration Center | `/api/admin/settings` |
| `/admin/system` | System Diagnostics | `/api/admin/system` |
| `/admin/alerts` | Alert Console | `/api/admin/alerts/*` |
| `/admin/leads` | Lead Management | `/api/admin/leads` |

### Authentication

All admin routes require the `x-e2e-bypass-auth` header (E2E) or valid admin session via Supabase Auth + Discord role verification. Admin access is determined by `lib/access-control/admin-access.ts`.

### Key Dependencies

- **Supabase:** Database, auth, storage (journal screenshots)
- **Discord API:** Role verification, guild integration, bot notifications
- **OpenAI:** AI Coach analysis for trade reviews
- **Redis:** Session caching, rate limiting

---

## 2. Common Operations

### 2.1 Member Access Management

**View member directory:**
```
GET /api/admin/members/directory?search=<query>&page=1&limit=20
```

**Force-sync a member's Discord roles:**
```
POST /api/admin/members/<discordUserId>/sync
```

**Apply access override:**
```
POST /api/admin/members/<discordUserId>/overrides
Body: { tab_id, grant: true/false, reason, expires_at? }
```

**Bulk sync all members:**
```
POST /api/admin/members/sync-bulk
```

### 2.2 Trade Review Workflow

1. Member requests review via journal → appears in `/admin/trade-review` queue
2. Coach opens review → views trade entry, market snapshot, member screenshots
3. Coach generates AI draft → `POST /api/admin/trade-review/ai-coach`
4. Coach edits/saves private notes → `PATCH /api/admin/trade-review/<id>/notes`
5. Coach publishes feedback → `POST /api/admin/trade-review/<id>/publish`
6. Member receives feedback on their journal entry

**Dismiss without review:**
```
POST /api/admin/trade-review/<id>/dismiss
Body: { reason: "..." }
```

### 2.3 Course Management

**Create course:**
```
POST /api/admin/courses
Body: { title, description, slug, is_published, discord_role_required? }
```

**Toggle publish status:**
```
PATCH /api/admin/courses
Body: { id, is_published: true/false }
```

**Delete course (cascades to lessons):**
```
DELETE /api/admin/courses?id=<courseId>
```

### 2.4 Push Notifications

**Send to all users:**
```
POST /api/admin/notifications
Body: { title, body, url, targetType: "all" }
```

**Send to specific tiers:**
```
POST /api/admin/notifications
Body: { title, body, url, targetType: "tier", targetTiers: ["pro", "executive"] }
```

**Send to individual users:**
```
POST /api/admin/notifications
Body: { title, body, url, targetType: "individual", targetUserIds: ["uuid1", "uuid2"] }
```

---

## 3. System Health Diagnostics

**Run diagnostics:**
```
GET /api/admin/system
```

Returns status for: Database Connection, Edge Functions, OpenAI Integration, Discord Bot, Storage.

### Health Status Interpretation

| Status | Meaning | Action |
|--------|---------|--------|
| `pass` | Service operational | None |
| `warning` | Degraded but functional | Investigate within 24h |
| `fail` | Service unavailable | Immediate attention required |

### Common Failure Scenarios

**Database Connection fail:**
- Check Supabase dashboard for outages
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars
- Check if connection pool is exhausted (max connections)

**Discord Bot warning/fail:**
- Verify `discord_bot_token` in admin settings
- Check Discord API status: https://discordstatus.com
- Ensure bot has required guild permissions

**OpenAI Integration fail:**
- Verify `OPENAI_API_KEY` env var
- Check OpenAI API status
- Review rate limit usage

**Storage fail:**
- Check Supabase Storage dashboard
- Verify `journal-screenshots` bucket exists and has correct RLS policies

---

## 4. Validation & Testing

### E2E Test Inventory

| Spec File | Tests | Coverage |
|-----------|-------|----------|
| `e2e/specs/admin/dashboard.spec.ts` | 7 | Command center, metrics, quick links, system status |
| `e2e/specs/admin/analytics.spec.ts` | 6 | Analytics page, period filters, metric cards, charts |
| `e2e/specs/admin/courses.spec.ts` | 7 | Course CRUD, publish/draft, gated badges, empty state |
| `e2e/specs/admin/notifications.spec.ts` | 8 | Compose form, targeting, broadcast history |
| `e2e/specs/admin/members-access.spec.ts` | ~10 | Directory, detail, roles, overrides |
| `e2e/specs/admin/trade-review.spec.ts` | ~8 | Queue, AI draft, notes, publish, dismiss, keyboard |
| `e2e/specs/admin/roles.spec.ts` | 7 | Role mapping, permissions, templates |
| `e2e/specs/admin/settings.spec.ts` | 11 | Discord config, AI prompt, tiers, masked values |
| `e2e/specs/admin/system.spec.ts` | 9 | Diagnostics, health status, warning states |

### Running Admin E2E Tests

```bash
# All admin E2E tests
pnpm exec playwright test e2e/specs/admin/ --project=chromium --workers=1

# Single spec
pnpm exec playwright test e2e/specs/admin/dashboard.spec.ts --project=chromium --workers=1

# Unit tests for admin API routes
pnpm vitest run lib/admin/__tests__/
```

### Validation Gates (Before Release)

```bash
pnpm exec eslint e2e/specs/admin/ e2e/helpers/api-mocks.ts
pnpm exec tsc --noEmit
pnpm exec playwright test e2e/specs/admin/ --project=chromium --workers=1
pnpm vitest run lib/admin/__tests__/
```

---

## 5. Zod Validation Schemas

Admin API routes use Zod validation for all incoming payloads. Schemas are located in:

- `lib/admin/validation/` — Shared admin schemas
- Individual route files for route-specific validation

### Error Response Format

All admin API routes return consistent error responses:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "VALIDATION_ERROR | AUTH_ERROR | DB_ERROR | SCHEMA_OUTDATED | INTERNAL"
}
```

---

## 6. Incident Response

### Admin Dashboard Not Loading

1. Check browser console for JS errors
2. Verify admin auth is working (check `x-e2e-bypass-auth` header or Supabase session)
3. Check API endpoints directly: `curl /api/admin/system`
4. Check Next.js server logs for SSR errors

### Member Access Control Issues

1. Run single-member sync: `POST /api/admin/members/<id>/sync`
2. Check shadow-diff for access discrepancies: `POST /api/admin/members/shadow-diff`
3. Review audit log: `GET /api/admin/members/audit`
4. If widespread: run bulk sync `POST /api/admin/members/sync-bulk`

### Trade Review Queue Stuck

1. Check if review entries exist: `GET /api/admin/trade-review`
2. Verify member's journal entry has `review_requested_at` set
3. Check AI draft endpoint for OpenAI errors
4. Dismiss stale entries if needed

---

## 7. Rollback Procedures

### Admin API Route Rollback

All admin routes are stateless Next.js API routes. Rollback by reverting the commit and redeploying.

### Database Schema Rollback

Migrations are in `supabase/migrations/`. Each migration should be idempotent and reversible. To rollback:

```bash
# List recent migrations
npx supabase db migrations list

# Reset to specific migration
npx supabase db reset --version <target_version>
```

### Feature Flag Reference

No admin-specific feature flags are currently in use. If high-risk changes are introduced, use the flags defined in CLAUDE.md Section 13.6.
