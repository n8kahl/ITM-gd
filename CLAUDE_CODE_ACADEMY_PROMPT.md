# TITM Academy — Claude Code Implementation Prompt

> Copy-paste this entire prompt into a fresh Claude Code session on the `feature/titm-academy-spec` branch.

---

## Prompt

You are implementing the **TITM Academy** — a full learning management system for the TradeITM members area. A complete development specification has already been written and committed to the repo. Your job is to implement it to production readiness, phase by phase, autonomously.

### Start Here

Read the master spec first — it is your single source of truth:

```
docs/TITM_ACADEMY_CODEX_SPEC.md
```

It references 4 companion spec documents. Read all of them before writing any code:

```
docs/TITM_ACADEMY_MIGRATION.sql          — Database migration (run this first)
docs/TITM_ACADEMY_API_SPECS.md           — 15 API routes + 25 component specs
docs/TITM_ACADEMY_INTERACTIVE_SPEC.md    — Greek Visualizer, Position Sizer, Options Chain Trainer
docs/TITM_ACADEMY_TRADE_CARDS_SPEC.md    — Multi-format Trade Card generation system
```

### Implementation Order (Critical — follow exactly)

```
PHASE 1: Database Migration
  → Run docs/TITM_ACADEMY_MIGRATION.sql against Supabase
  → Verify all tables, enums, functions, triggers, RLS policies, and indexes created
  → Verify achievement_tiers seed data inserted

PHASE 2: API Routes (15 routes)
  → All routes go in /app/api/academy/...
  → Follow existing auth pattern: createServerComponentClient from @supabase/auth-helpers-nextjs
  → Follow existing tier filtering: TIER_HIERARCHY pattern from MemberAuthContext

PHASE 3: Page & Feature Components (25 components)
  → Replace /members/library "Coming Soon" with full Academy dashboard
  → Follow existing patterns: 'use client' directives, @/ absolute imports, kebab-case files
  → Use existing UI primitives from components/ui/ (shadcn-style)
  → Use Framer Motion for animations, Lucide React for icons

PHASE 4: Interactive Components
  → Greek Visualizer with full Black-Scholes implementation
  → Position Sizer with risk calculator
  → Options Chain Trainer with mock chain generator + quiz
  → All math formulas are in docs/TITM_ACADEMY_INTERACTIVE_SPEC.md

PHASE 5: AI Integration
  → AI Tutor: Reuse existing AI Coach (hooks/use-ai-coach-chat.ts) in lesson-scoped mode
  → AI Content Generator: Admin tool to generate lesson content via Claude API
  → Extend existing knowledge_base table with academy entries

PHASE 6: Trade Card System (Multi-Format)
  → Install satori + @resvg/resvg-js
  → Implement 3 Satori JSX templates: Landscape (1200x630), Story (1080x1920), Square (1080x1080)
  → Each card shows: TITM branding, achievement title, tier badge, stats, courses completed list, watermark logo, verification URL
  → Logo assets already exist: public/hero_logo_card.png (transparent PNG), public/animated_logo.gif
  → Reference mockups: trade-card-formats.html (open in browser to see exact designs)
  → Verification page at /verify/[code] with OG meta tags
  → Watermark: 8% opacity, grayscale(100%) brightness(3), sized per format

PHASE 7: Curriculum Content Seeding
  → Create 5 learning paths, 14 courses, 71+ lessons
  → Generate all lesson content (markdown + quiz JSON) via Claude API
  → Focus: Options scalping, day trading, swing trading, LEAPS, SPX/NDX
  → Curriculum structure is in docs/TITM_ACADEMY_CODEX_SPEC.md Section 10
```

### Existing Codebase Patterns (Must Follow)

Before writing any component, read these existing files to match patterns exactly:

- `contexts/MemberAuthContext.tsx` — Auth, profile, tier, permissions, tab config
- `components/members/member-sidebar.tsx` — Dynamic tab sidebar with tier-gated navigation
- `hooks/use-ai-coach-chat.ts` — AI Coach streaming chat hook
- `lib/supabase-browser.ts` — Singleton Supabase browser client
- `middleware.ts` — Route protection, CSP headers, RBAC checks
- `app/globals.css` — All CSS variables, glass-morphism classes
- `app/layout.tsx` — Font imports (Inter, Playfair Display, Geist Mono)
- `components/ui/pricing-card.tsx` — Tier color definitions, luxury design patterns

### Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript strict mode
- **Styling:** Tailwind CSS 4.1 + CSS custom properties from globals.css
- **Database:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Hosting:** Railway
- **UI:** Radix UI + shadcn/ui-style components, Lucide React icons
- **Animation:** Framer Motion
- **Charts:** Recharts
- **Package Manager:** pnpm

### Brand Design System (TITM "Quiet Luxury")

```
Background:  #0A0A0B (Onyx)
Text:        #F5F5F0

Tier Colors:
  Core:      #10B981 (Emerald)   — glow: rgba(16, 185, 129, 0.15)
  Pro:       #F3E5AB (Champagne) — glow: rgba(243, 229, 171, 0.12)
  Executive: #E8E4D9 (Platinum)  — glow: rgba(232, 228, 217, 0.12)

Fonts:
  Headings:  Playfair Display (serif)
  Body:      Inter (sans-serif)
  Numbers:   Geist Mono (monospace)

Effects:     Glass-morphism, radial glow, grid pattern overlay, corner accents
```

### Quality Requirements

1. Every file must pass `tsc --noEmit` with zero errors
2. All Supabase queries must handle errors gracefully (no silent failures)
3. Every route must be protected by auth middleware
4. All user-facing data must respect RLS policies
5. Components must be mobile-responsive (test at 375px, 768px, 1024px, 1440px)
6. Follow existing commit message style: `feat(academy): description`
7. Create one commit per phase completion

### What NOT to Do

- Do NOT modify any existing files outside the academy feature unless the spec explicitly says to (exception: member-sidebar.tsx to add Academy tab)
- Do NOT install unnecessary dependencies
- Do NOT create a leaderboard (excluded from scope)
- Do NOT build Discord integration (future consideration)
- Do NOT use localStorage in any component
- Do NOT skip RLS policies or auth checks

### Begin

Start by reading `docs/TITM_ACADEMY_CODEX_SPEC.md` in full, then proceed through phases 1-7 sequentially. After each phase, commit your work and verify it compiles cleanly before moving to the next phase.
