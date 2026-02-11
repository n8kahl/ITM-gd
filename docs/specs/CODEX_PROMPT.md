# Codex Development Prompt — Profile Hub & Trade Social

Copy the prompt below and provide it to Codex (or any spec-driven autonomous coding agent).

---

## THE PROMPT

```
You are building the Profile Hub and Trade Social features for a Next.js 16 trading education platform called TITM (Trade In The Money). The complete development specification is at `docs/specs/PROFILE_SOCIAL_SPEC.md` — read it fully before writing any code.

## Critical Context

- Stack: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Supabase
- Design: Dark mode only. Primary = Emerald #10B981, Accent = Champagne #F3E5AB, Background = #0A0A0B
- NEVER use gold hex #D4AF37 — it's banned from the codebase
- All cards use the `glass-card-heavy` CSS class
- All imports use `@/` alias (e.g., `import { Button } from '@/components/ui/button'`)
- Auth pattern: always use `supabase.auth.getUser()` (never `getSession()`)
- Icons: Lucide React only
- Images: always use `next/image`
- Validation: Zod
- Market data provider is called "Massive.com" (NEVER "Polygon.io")
- Tests: Vitest for unit, Playwright for E2E

## What to Read First

1. `docs/specs/PROFILE_SOCIAL_SPEC.md` — The complete spec (start here)
2. `CLAUDE.md` — Project conventions and rules
3. `docs/BRAND_GUIDELINES.md` — Design system
4. `app/globals.css` — CSS variables and design tokens
5. `lib/supabase-server.ts` — Server-side Supabase client pattern
6. `lib/supabase-browser.ts` — Browser Supabase client pattern
7. `lib/types/journal.ts` — Example type definitions pattern
8. `lib/validation/journal-entry.ts` — Example Zod validation pattern
9. `app/api/admin/settings/route.ts` — Example API route pattern
10. `supabase/migrations/20260211000000_journal_v2_clean_schema.sql` — Example migration pattern
11. `supabase/migrations/20260209000003_shared_trade_cards.sql` — Existing shared_trade_cards table
12. `components/journal/journal-filter-bar.tsx` — Example component pattern
13. `lib/academy/trade-card-generator.ts` — Existing Satori trade card pipeline
14. `lib/error-handler.ts` — Error handling patterns
15. `lib/rate-limit.ts` — Rate limiting patterns
16. `vitest.config.ts` — Test configuration
17. `contexts/MemberAuthContext.tsx` — Auth context pattern

## Implementation Order

Execute these phases in order. Each phase should be fully complete and tested before moving to the next.

### Phase 1: Database Layer
Create all 7 database migration files as specified in the spec (Section 3).
Use the Supabase MCP tool `apply_migration` for each migration.
Include RLS policies, indexes, triggers, and constraints exactly as specified.

Migrations to create:
1. `member_profiles` table
2. `social_feed_items` + `social_likes` tables (with likes_count trigger)
3. `leaderboard_snapshots` table
4. `affiliate_referrals` table
5. `profile_views` table
6. `get_trading_transcript` RPC function
7. `compute_trader_dna` RPC function

### Phase 2: Types & Validation
Create `lib/types/social.ts` with all type definitions from spec Section 4.
Create `lib/validation/social.ts` with all Zod schemas from spec Section 5.

### Phase 3: API Routes
Create all 10 API route files as specified in spec Section 6.
Follow the exact auth pattern: `createServerSupabaseClient()` → `getUser()` → business logic.
Use Zod validation for all inputs.
Return consistent JSON: `{ success: true, data: ... }` or `{ error: '...' }`.

Routes to create:
1. `app/api/members/profile/route.ts` (GET + PATCH)
2. `app/api/members/profile/[userId]/route.ts` (GET)
3. `app/api/members/profile/transcript/route.ts` (GET)
4. `app/api/members/profile/views/route.ts` (GET)
5. `app/api/members/affiliate/route.ts` (GET)
6. `app/api/social/feed/route.ts` (GET + POST)
7. `app/api/social/feed/[itemId]/like/route.ts` (POST + DELETE)
8. `app/api/social/leaderboard/route.ts` (GET)
9. `app/api/social/share-trade/route.ts` (POST)
10. `app/api/webhooks/whop/route.ts` (POST)

### Phase 4: Profile Components
Create all 9 profile components in `components/profile/`.
Each component must:
- Use 'use client' directive
- Import from @/ paths
- Use glass-card-heavy for cards
- Use Lucide React for icons
- Handle loading states with Loader2 spinner
- Be fully responsive (mobile-first)

### Phase 5: Social Components
Create all 13 social components in `components/social/`.
The like-button must have optimistic UI with error rollback.
The social-feed must support infinite scroll (cursor-based).
The share-trade-sheet must integrate with the Satori pipeline.

### Phase 6: Pages
Completely rewrite `app/members/profile/page.tsx` to render all 6 Profile Hub sections.
Create new `app/members/social/page.tsx` with feed + sidebar layout.
Both pages must be fully responsive.

### Phase 7: Journal Integration
Modify `components/journal/entry-detail-sheet.tsx` to add a "Share to Community" button.
Create `lib/social/trade-card-generator.ts` adapting the academy pipeline for journal trades.

### Phase 8: Leaderboard Edge Function
Create `supabase/functions/compute-leaderboards/index.ts`.
Follow the existing edge function patterns in `supabase/functions/`.

### Phase 9: Tests
Create `lib/validation/__tests__/social.test.ts` with comprehensive Zod schema tests.
Create `e2e/social.spec.ts` with Playwright E2E tests.
Run `pnpm test:unit` and ensure all tests pass.

### Phase 10: Verification
Run `pnpm build` and fix any TypeScript or build errors.
Run `pnpm lint` and fix any linting issues.
Verify all migrations were applied successfully.
Check that the new pages render without errors.

## Key Patterns to Follow

### API Route Auth Check
```typescript
const supabase = await createServerSupabaseClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Component Card Pattern
```typescript
<Card className="glass-card-heavy border-white/10">
  <CardHeader>
    <CardTitle className="text-white text-lg flex items-center gap-2">
      <Icon className="w-5 h-5 text-emerald-500" />
      Title
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

### Tier Color Classes
```
core:      text-emerald-400 bg-emerald-500/10 border-emerald-500/30
pro:       text-blue-400 bg-blue-500/10 border-blue-500/30
executive: text-[#F3E5AB] bg-[#F3E5AB]/10 border-[#F3E5AB]/30
```

### Loading State
```typescript
if (loading) {
  return (
    <Card className="glass-card-heavy border-white/10">
      <CardContent className="pt-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
        </div>
      </CardContent>
    </Card>
  )
}
```

### Migration RLS Pattern
```sql
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their rows"
  ON public.table_name FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role bypass"
  ON public.table_name FOR ALL
  USING (auth.role() = 'service_role');
```

## DO NOT

- Do NOT use getSession() for auth — always getUser()
- Do NOT use gold #D4AF37 anywhere
- Do NOT use the Sparkles icon as a logo
- Do NOT refer to the market data provider as "Polygon.io" — it's "Massive.com"
- Do NOT create light mode styles
- Do NOT skip RLS policies on any table
- Do NOT use generic spinners — use Loader2 from lucide-react
- Do NOT import from relative paths — use @/ alias
- Do NOT skip mobile responsive design
- Do NOT use localStorage/sessionStorage in components meant for the main app
```

---

## Usage Notes

1. **For Codex:** Paste the entire prompt above into your Codex session. Codex will read the spec file and implement everything in order.

2. **For Claude Code:** You can use this spec with Claude Code by pointing it to the spec file: `Read docs/specs/PROFILE_SOCIAL_SPEC.md and implement all phases in order.`

3. **For any AI agent:** The spec is self-contained. The agent needs access to the repo files listed in "What to Read First" to understand existing patterns.

4. **Human review checkpoints:** After Phase 1 (migrations), Phase 6 (pages), and Phase 10 (verification), pause for human review before continuing.
