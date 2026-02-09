# TITM Academy — Complete Development Specification
## For Autonomous Codex Implementation

**Version:** 1.0
**Date:** February 9, 2026
**Author:** Claude (Sr. Instructional Designer / UX Designer / Sr. Engineer)
**Status:** READY FOR CODEX EXECUTION

---

## TABLE OF CONTENTS

1. [Project Overview & Scope](#1-project-overview--scope)
2. [Existing Codebase Context](#2-existing-codebase-context)
3. [Implementation Order (Critical)](#3-implementation-order-critical)
4. [Phase 1: Database Migration](#4-phase-1-database-migration)
5. [Phase 2: API Routes](#5-phase-2-api-routes)
6. [Phase 3: Page & Feature Components](#6-phase-3-page--feature-components)
7. [Phase 4: Interactive Components](#7-phase-4-interactive-components)
8. [Phase 5: AI Integration](#8-phase-5-ai-integration)
9. [Phase 6: Trade Card System](#9-phase-6-trade-card-system)
10. [Phase 7: Curriculum Content Seeding](#10-phase-7-curriculum-content-seeding)
11. [TypeScript Types](#11-typescript-types)
12. [Testing Requirements](#12-testing-requirements)

---

## 1. PROJECT OVERVIEW & SCOPE

### What We Are Building
A full-featured learning management system called **TITM Academy** embedded within the existing TradeITM members area. It replaces the current empty `/members/library` page with a personalized, AI-powered education platform for options trading.

### Finalized Scope Decisions
- **Video hosting:** YouTube embeds (no self-hosting)
- **Academy access:** ALL tiers (Core sees Foundations + Core tracks, Pro adds Pro tracks, Executive adds Executive tracks)
- **Leaderboard:** EXCLUDED from this build (future consideration)
- **Interactive elements:** ALL THREE included (Greek Visualizer, Position Sizer, Options Chain Trainer)
- **Content authoring:** 100% AI-generated from outlines using Claude API
- **Existing content migration:** None — clean slate
- **Discord integration:** Architecture supports it but NOT built in this phase
- **Trading context:** Options scalping (0DTE SPX/NDX), day trading, swing trading, LEAPS — all equity options

### Tech Stack (Must Match Existing)
- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS 4.1
- **UI Primitives:** Radix UI + shadcn/ui-style custom components
- **Icons:** Lucide React
- **Animations:** Framer Motion
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Hosting:** Railway
- **Charts:** Recharts (already installed)
- **Package Manager:** pnpm

### File/Naming Conventions
- **Files:** kebab-case (`lesson-player.tsx`, `use-quiz-engine.ts`)
- **Components:** PascalCase (`LessonPlayer`, `QuizEngine`)
- **Functions:** camelCase (`calculateGreeks`, `handleSubmit`)
- **Constants:** UPPER_SNAKE_CASE (`XP_THRESHOLDS`, `RANK_MAP`)
- **Types:** PascalCase interfaces (`LessonDetail`, `QuizQuestion`)
- **Imports:** Absolute with `@/` alias (`import { cn } from '@/lib/utils'`)
- **Client components:** Must include `'use client'` directive
- **API responses:** `{ success: boolean, data?: T, error?: string }`

---

## 2. EXISTING CODEBASE CONTEXT

### Existing Tables (DO NOT RECREATE — EXTEND)

**`courses`** (exists, 0 rows):
```
id (uuid PK), title (text), slug (text UNIQUE), description (text),
thumbnail_url (text), discord_role_required (text), is_published (bool default false),
display_order (int default 0), created_at (timestamptz), updated_at (timestamptz)
```

**`lessons`** (exists, 0 rows):
```
id (uuid PK), course_id (uuid FK→courses), title (text), slug (text),
video_url (text), content_markdown (text), is_free_preview (bool default false),
duration_minutes (int), display_order (int default 0), created_at, updated_at
```

**`ai_coach_sessions`** (exists, 27 rows):
```
id (uuid PK), user_id (uuid FK→auth.users), title (text),
message_count (int default 0), created_at, updated_at, ended_at, metadata (jsonb default '{}')
```

**`ai_coach_messages`** (exists, 117 rows):
```
id (uuid PK), session_id (uuid FK→ai_coach_sessions), user_id (uuid),
role (text), content (text), function_call (jsonb), function_response (jsonb),
tokens_used (int), created_at
```

**`pricing_tiers`** (exists, 3 rows):
```
id (text PK): 'core', 'pro', 'executive'
name: 'Core Sniper', 'Pro Sniper', 'Executive Sniper'
monthly_price: '$199', '$299', '$499'
```

**`knowledge_base`** (exists, 18 rows):
```
id (uuid), category (text), question (text), answer (text), context (text),
image_urls (array), priority (int), is_active (bool), metadata (jsonb), search_vector (tsvector)
Categories: escalation, faq, features, mentorship, pricing, proof, technical
```

### Existing RLS Policies
- `courses`: "Public read published courses" (SELECT where is_published=true), "Service role write" (ALL)
- `lessons`: "Public read free preview lessons" (SELECT where is_free_preview=true), "Service role write" (ALL)

### Existing Components/Patterns to Reuse
- `MemberAuthContext` — provides profile, tier, permissions, `getVisibleTabs()`
- `useAICoachChat()` hook — streaming AI chat with sessions
- `MemberSidebar` — dynamic tab-based sidebar navigation
- `MemberBottomNav` — mobile bottom navigation
- `/components/ui/` — Card, Button, Skeleton, Dialog, Tabs, etc.
- `cn()` utility from `@/lib/utils` for className merging
- `createBrowserSupabase()` from `@/lib/supabase-browser`

### Existing Routes (DO NOT MODIFY)
```
/members/page.tsx          — Dashboard
/members/journal/          — Trading Journal
/members/ai-coach/         — AI Coach
/members/library/          — Currently "Coming Soon" (REPLACE THIS)
/members/studio/           — Content Studio
/members/profile/          — Profile
/admin/courses/            — Admin course CRUD (EXTEND)
```

---

## 3. IMPLEMENTATION ORDER (CRITICAL)

Codex must implement in this exact sequence. Each phase depends on the previous.

```
PHASE 1: Database Migration
  → Run SQL migration (creates tables, enums, functions, RLS, indexes)
  → Verify all tables exist with correct schema

PHASE 2: API Routes (15 routes)
  → Member routes (13)
  → Admin routes (2)
  → Test each route manually or with basic assertions

PHASE 3: Page & Feature Components
  → Academy Hub (replaces /members/library)
  → Onboarding Wizard
  → Course Catalog
  → Course Detail
  → Lesson Player
  → Feature components (progress ring, streak, XP, etc.)

PHASE 4: Interactive Components
  → Greek Visualizer (Black-Scholes)
  → Position Sizer
  → Options Chain Trainer

PHASE 5: AI Integration
  → AI Tutor Panel (lesson-scoped AI Coach)
  → AI Content Generator (admin)
  → Knowledge base extension

PHASE 6: Trade Card System (Multi-Format)
  → Card generation API (3 formats: Landscape 1200x630, Story 1080x1920, Square 1080x1080)
  → Courses Completed display on all card formats
  → Animated logo option (GIF w/ mix-blend-mode: screen on web)
  → Verification page (tradeinthemoney.com/verify/[code])
  → Social sharing (Twitter, LinkedIn, Instagram, TikTok, Facebook)
  → Format picker for download (landscape/story/square)

PHASE 7: Curriculum Content Seeding
  → Generate all course/lesson content via AI
  → Create learning paths
  → Seed initial data
```

---

## 4. PHASE 1: DATABASE MIGRATION

**File:** `supabase/migrations/YYYYMMDDHHMMSS_academy_training_system.sql`

Run the complete migration from: `docs/TITM_ACADEMY_MIGRATION.sql`

This migration creates:
- 5 custom enums (difficulty_level, lesson_type, progress_status, achievement_type, activity_log_type)
- 6 column additions to `courses` table
- 7 column additions to `lessons` table
- 8 new tables (learning_paths, learning_path_courses, user_learning_profiles, user_lesson_progress, user_course_progress, user_achievements, user_xp, user_learning_activity_log)
- 4 database functions (increment_user_xp, update_streak, get_course_progress_stats, handle_updated_at)
- 3 updated_at triggers
- 19 RLS policies
- 13 indexes

**Verification:** After migration, confirm all tables exist and enums are registered.

---

## 5. PHASE 2: API ROUTES

Full specifications in: `docs/TITM_ACADEMY_API_SPECS.md`

### Route Summary

| # | Method | Path | Purpose | Auth |
|---|--------|------|---------|------|
| 1 | GET | `/api/academy/onboarding-status` | Check if onboarding complete | Member |
| 2 | POST | `/api/academy/onboarding` | Submit onboarding assessment | Member |
| 3 | GET | `/api/academy/dashboard` | Personalized dashboard data | Member |
| 4 | GET | `/api/academy/paths` | List learning paths (tier-filtered) | Member |
| 5 | GET | `/api/academy/courses` | List courses with progress | Member |
| 6 | GET | `/api/academy/courses/[slug]` | Course detail + lesson list | Member |
| 7 | GET | `/api/academy/lessons/[id]` | Full lesson content + quiz | Member |
| 8 | POST | `/api/academy/lessons/[id]/progress` | Update lesson progress | Member |
| 9 | POST | `/api/academy/lessons/[id]/quiz` | Submit quiz answers | Member |
| 10 | GET | `/api/academy/achievements` | List user achievements | Member |
| 11 | GET | `/api/academy/achievements/[code]` | Public verification | None |
| 12 | POST | `/api/academy/tutor/session` | Create AI tutor session | Member |
| 13 | GET | `/api/academy/recommendations` | AI next-lesson suggestions | Member |
| 14 | POST | `/api/admin/academy/generate-lesson` | AI content generation | Admin |
| 15 | GET | `/api/admin/academy/analytics` | Learning analytics | Admin |

### Key Implementation Notes

**Auth Pattern (all member routes):**
```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's tier from app_metadata
  const tier = user.app_metadata?.tier || 'core'
  // ... route logic
}
```

**Tier Filtering Logic (used by courses, paths):**
```typescript
// Tier hierarchy: core < pro < executive
const TIER_HIERARCHY = { core: 1, pro: 2, executive: 3 }

function getAccessibleTiers(userTier: string): string[] {
  const level = TIER_HIERARCHY[userTier] || 1
  return Object.entries(TIER_HIERARCHY)
    .filter(([, l]) => l <= level)
    .map(([tier]) => tier)
}
// Example: getAccessibleTiers('pro') → ['core', 'pro']
```

**XP Award Pattern (used after lesson/quiz completion):**
```typescript
async function awardXP(supabase: any, userId: string, amount: number, activityType: string, entityId?: string) {
  // 1. Call increment_user_xp function
  await supabase.rpc('increment_user_xp', { p_user_id: userId, p_xp: amount })

  // 2. Update streak
  await supabase.rpc('update_streak', { p_user_id: userId })

  // 3. Log activity
  await supabase.from('user_learning_activity_log').insert({
    user_id: userId,
    activity_type: activityType,
    entity_id: entityId,
    xp_earned: amount,
    metadata: {}
  })
}
```

### XP Award Table
| Action | XP | activity_type |
|--------|----|---------------|
| Complete onboarding | 50 | lesson_complete |
| View a lesson | 5 | lesson_view |
| Complete a lesson | 10 | lesson_complete |
| Pass quiz (first attempt) | 50 | quiz_pass |
| Pass quiz (retake) | 25 | quiz_pass |
| Perfect quiz score (100%) | 100 | quiz_pass |
| Complete a course | 100 | course_complete |
| Complete a track | 500 | track_complete |
| Daily streak bonus | 5 | streak_day |
| Ask AI Tutor question | 2 | tutor_question |

---

## 6. PHASE 3: PAGE & FEATURE COMPONENTS

Full component specifications in: `docs/TITM_ACADEMY_API_SPECS.md` (Section 2)

### Directory Structure to Create

```
app/members/academy/
  ├── page.tsx                         # Academy Hub (replaces library)
  ├── layout.tsx                       # Academy layout wrapper
  ├── onboarding/
  │   └── page.tsx                     # Onboarding wizard
  ├── courses/
  │   ├── page.tsx                     # Course catalog
  │   └── [slug]/
  │       └── page.tsx                 # Course detail
  └── learn/
      └── [id]/
          └── page.tsx                 # Lesson player

components/academy/
  ├── academy-hub.tsx                  # Dashboard layout
  ├── continue-learning-card.tsx       # Current lesson widget
  ├── course-card.tsx                  # Course preview card
  ├── course-catalog.tsx               # Course grid with filters
  ├── lesson-player.tsx                # Markdown/video/interactive renderer
  ├── lesson-sidebar.tsx               # Desktop course progress sidebar
  ├── quiz-engine.tsx                  # Multi-question quiz UI
  ├── quiz-question.tsx                # Single MCQ component
  ├── ai-tutor-panel.tsx               # Lesson-scoped AI chat panel
  ├── onboarding-wizard.tsx            # 5-step onboarding form
  ├── xp-display.tsx                   # XP bar + rank display
  ├── streak-calendar.tsx              # 7-day streak viz
  ├── achievement-card.tsx             # Badge/achievement display
  ├── trade-card-preview.tsx           # Shareable credential card
  ├── progress-ring.tsx                # Circular SVG progress
  ├── interactive/
  │   ├── greek-visualizer.tsx         # Black-Scholes Greeks tool
  │   ├── position-sizer.tsx           # Position sizing calculator
  │   └── options-chain-trainer.tsx    # Options chain quiz
  └── admin/
      ├── content-generator.tsx        # AI lesson generation
      └── learning-analytics.tsx       # Admin analytics dashboard

hooks/
  └── use-academy.ts                   # Academy-specific hooks

lib/academy/
  ├── black-scholes.ts                 # Black-Scholes math functions
  ├── xp-utils.ts                      # XP/rank calculation helpers
  ├── trade-card-generator.ts          # Trade Card PNG generation
  └── content-generator.ts             # AI lesson generation logic
```

### Critical Component: Academy Hub (`/app/members/academy/page.tsx`)

This replaces the current `/members/library/page.tsx`. The existing Library tab in the sidebar already points to this route. The page must:

1. Check onboarding status on mount
2. Redirect to `/members/academy/onboarding` if not completed
3. Fetch dashboard data from `/api/academy/dashboard`
4. Render:
   - Continue Learning card (most prominent, top of page)
   - Stats grid (lessons completed, courses completed, XP, rank)
   - Streak calendar (7-day row)
   - Recommended Next section (2-3 lesson cards)
   - Recent Achievements (earned badges)

**Desktop:** 2-column layout (main content 70% + sidebar 30%)
**Mobile:** Single column, stacked

### Critical Component: Lesson Player (`/app/members/academy/learn/[id]/page.tsx`)

The immersive lesson experience. Must support:
- **Markdown rendering:** Use `react-markdown` with `remark-gfm` for tables/strikethrough
- **YouTube embeds:** Responsive iframe from `video_url` field
- **Interactive embeds:** Render `<GreekVisualizer />`, `<PositionSizer />`, or `<OptionsChainTrainer />` based on `lesson_type`
- **Progress tracking:** Auto-save time spent every 30 seconds via POST `/api/academy/lessons/[id]/progress`
- **Quiz inline:** After content, show quiz engine with questions from `quiz_data`
- **AI Tutor:** Floating button opens slide-in panel (desktop) or bottom sheet (mobile)
- **Mark Complete:** Button in sidebar that fires POST with `action: 'complete'`

---

## 7. PHASE 4: INTERACTIVE COMPONENTS

Full specifications in: `docs/TITM_ACADEMY_INTERACTIVE_SPEC.md`

### Greek Visualizer — Black-Scholes Implementation

**File:** `/components/academy/interactive/greek-visualizer.tsx`
**Math:** `/lib/academy/black-scholes.ts`

The math library must implement these exact functions:
- `normalCDF(x)` — Standard normal CDF (Abramowitz & Stegun approximation)
- `normalPDF(x)` — Standard normal PDF
- `calculateD1(inputs)` — d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)
- `calculateD2(inputs, d1)` — d2 = d1 - σ√T
- `calculateOptionPrice(inputs, d1, d2)` — Black-Scholes call/put price
- `calculateDelta(inputs, d1)` — N(d1) for calls, N(d1)-1 for puts
- `calculateGamma(inputs, d1)` — N'(d1) / (S·σ·√T)
- `calculateTheta(inputs, d1, d2)` — Daily theta (divide yearly by 365)
- `calculateVega(inputs, d1)` — S·N'(d1)·√T / 100
- `calculateRho(inputs, d2)` — K·T·e^(-rT)·N(d2) / 100
- `calculateAllGreeks(inputs)` — Returns all values

**UI:** Sliders for S, K, T, σ, r + Call/Put toggle. Output cards for each Greek. Recharts LineChart for payoff diagram. Educational tooltips on each Greek.

### Position Sizer

**File:** `/components/academy/interactive/position-sizer.tsx`

**Formulas:**
```
Dollar Risk = Account Size × (Risk % / 100)
Risk Per Contract = |Entry - Stop Loss| × 100
Max Contracts = floor(Dollar Risk / Risk Per Contract)
Total Cost = Entry × 100 × Max Contracts
Account Risk % = (Max Loss / Account Size) × 100
```

**Warning thresholds:**
- Risk > 3%: "TITM recommends risking no more than 2% per trade"
- Position cost > 25% of account: "Position is X% of your account"

### Options Chain Trainer

**File:** `/components/academy/interactive/options-chain-trainer.tsx`

Generates mock options chain data with realistic characteristics:
- Tighter bid-ask spreads ATM, wider OTM
- Higher volume/OI near ATM
- IV smile (higher OTM put IV)
- Highlight ITM/OTM zones

Quiz questions generated from the displayed chain data.

---

## 8. PHASE 5: AI INTEGRATION

### AI Tutor Panel

The AI Tutor reuses the existing AI Coach infrastructure. The key difference is the **system prompt** which includes lesson context.

**System Prompt Template for AI Tutor:**
```
You are a TITM Academy tutor helping a member understand this lesson.

LESSON: {lesson.title}
COURSE: {course.title}
DIFFICULTY: {lesson.difficulty_level}

LESSON CONTENT SUMMARY:
{lesson.content_markdown (first 2000 chars)}

KEY TAKEAWAYS:
{lesson.key_takeaways.join('\n')}

MEMBER CONTEXT:
- Experience: {profile.experience_level}
- Current rank: {xp.current_rank}
- Courses completed: {xp.courses_completed_count}

TITM TRADING CONTEXT:
TITM specializes in options scalping (0DTE SPX/NDX), day trading, swing trading, and LEAPS.
We focus on: gamma exposure, theta decay, IV crush, position sizing (1-2% risk max),
and disciplined execution. Our members trade primarily SPX, NDX, and individual equity options.

INSTRUCTIONS:
- Stay focused on this lesson's topic
- Use TITM terminology and trading examples
- If asked about unrelated topics, redirect: "Great question — you'll cover that in [relevant course]. For now, let's focus on [current topic]."
- Explain concepts at the member's level ({profile.experience_level})
- Use practical examples: "When trading SPX 0DTE..."
- Never make up statistics or win rates
```

**Implementation:** Create AI Tutor session via `ai_coach_sessions` with `metadata: { context_type: 'tutor', lesson_id: '...' }`. Messages flow through existing `ai_coach_messages` table.

### AI Content Generator (Admin)

**System Prompt for Lesson Generation:**
See full prompt in `docs/TITM_ACADEMY_API_SPECS.md` under route #14.

Key points:
- Claude API model: Use Claude Sonnet for speed/cost balance
- Temperature: 0.7
- Output: JSON with `content` (markdown), `key_takeaways` (string[]), `quiz_questions` (array)
- Context: Include relevant knowledge_base entries
- Quality: No hallucinated stats, reference TITM methodology

---

## 9. PHASE 6: TRADE CARD SYSTEM (MULTI-FORMAT)

Full specifications in: `docs/TITM_ACADEMY_TRADE_CARDS_SPEC.md`

### Architecture
1. Achievement earned → backend creates `user_achievements` record
2. API route generates **3 PNG formats** using `satori` + `@resvg/resvg-js`
3. PNGs uploaded to Supabase Storage bucket `trade-cards` as `{userId}/{achievementId}-{format}.png`
4. Public URLs stored on achievement record (landscape used for OG tags)
5. Verification page at `/verify/[code]` shows card + confirms authenticity
6. Share dialog lets user pick format (landscape/story/square) before download

### Card Formats & Dimensions
| Format | Size | Use Case | Courses Display |
|--------|------|----------|-----------------|
| **Landscape** | 1200×630 | Twitter, LinkedIn, Discord, OG tags | Latest 3-5 + "+N more" |
| **Story/Reel** | 1080×1920 | Instagram Stories, Reels, TikTok | Up to 7 + "+N more" |
| **Square** | 1080×1080 | Instagram Feed, Facebook | Course pills wrapping + "+N more" |

### Card Design (TITM "Quiet Luxury" Aesthetic)
- Onyx (#0A0A0B) base with radial glow per tier
- Grid pattern overlay (40px, 2% white opacity)
- Tier-colored glow border (Core=#10B981 Emerald, Pro=#F3E5AB Champagne, Executive=#E8E4D9 Platinum)
- Fonts: Playfair Display (headings), Inter (body), Geist Mono (numbers/stats)
- Corner accent lines + bottom gradient accent bar
- Glass-morphism tier badge
- **Courses Completed** section with course names
- Member name, achievement title, stats (courses, quiz avg, lessons, streak), verification URL
- Transparent logo PNG (`/public/hero_logo_card.png`)
- Animated logo GIF option on web verification page (`/public/animated_logo.gif` via `mix-blend-mode: screen`)

### Dependencies to Install
```bash
pnpm add satori @resvg/resvg-js
```

### Verification Page

**File:** `/app/verify/[code]/page.tsx`

Server component. Fetches achievement by verification_code. Shows card image (landscape for OG, with format picker for download), member info, and verified badge. Shows animated logo GIF via `mix-blend-mode: screen` on dark background. Must include OG meta tags for social sharing preview.

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  // Fetch achievement and return OG tags (landscape format for link previews)
  return {
    title: `${achievement.title} — TITM Academy`,
    description: `Verified achievement earned by ${memberName}`,
    openGraph: {
      images: [{ url: achievement.trade_card_landscape_url, width: 1200, height: 630 }]
    }
  }
}
```

### Logo Assets (Pre-built)
- `/public/hero_logo_card.png` — 220×116px transparent PNG, used in all Satori-rendered PNGs
- `/public/animated_logo.gif` — 300px wide, 24fps, 1.3MB, used on web verification page only

---

## 10. PHASE 7: CURRICULUM CONTENT SEEDING

After all infrastructure is built, seed the database with the full curriculum.

### Learning Paths to Create

| Path | Tier | Tracks | Description |
|------|------|--------|-------------|
| Foundations | core | 1 | Options basics, Greeks, broker setup, risk management |
| Core Strategies | core | 2 | SPX day trading, market structure, alert interpretation |
| Advanced Strategies | pro | 3 | Swing trading, LEAPS, advanced market structure |
| Elite Execution | executive | 4 | NDX advanced, portfolio-level thinking |
| Trading Psychology | core | 5 | Mindset, emotional discipline (available to all) |

### Courses (use AI content generator for each)

**Track 1: Foundations (5 courses, ~25 lessons)**
1. Welcome to TITM (5 lessons)
2. Options Trading 101 (6 lessons)
3. The Greeks — Your Trading Dashboard (6 lessons)
4. Setting Up Your Broker (5 lessons)
5. Risk Management Fundamentals (5 lessons)

**Track 2: Core Strategies (3 courses, ~18 lessons)**
1. Day Trading SPX with TITM (7 lessons)
2. Understanding Market Structure (5 lessons)
3. Alert Interpretation (4 lessons)

**Track 3: Advanced Strategies (3 courses, ~15 lessons)**
1. Swing Trading Strategy (5 lessons)
2. LEAPS — Long-Term Options Strategy (5 lessons)
3. Advanced Market Structure (5 lessons)

**Track 4: Elite Execution (2 courses, ~8 lessons)**
1. NDX Advanced Execution (4 lessons)
2. Portfolio-Level Thinking (4 lessons)

**Track 5: Trading Psychology (1 course, ~5 lessons)**
1. The Trader's Mindset (5 lessons)

### Seeding Process
1. Create learning_paths records
2. Create courses with proper tier_required and difficulty_level
3. Use `/api/admin/academy/generate-lesson` for each lesson (AI-generated)
4. Create learning_path_courses junction records with sequence_order
5. Publish all paths and courses (set is_published=true)

---

## 11. TYPESCRIPT TYPES

**File:** `/lib/types/academy.ts`

```typescript
// ========== Enums ==========
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'
export type LessonType = 'video' | 'text' | 'interactive' | 'scenario' | 'practice' | 'guided'
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'
export type AchievementType = 'track_complete' | 'course_complete' | 'milestone' | 'streak' | 'rank_up'
export type Tier = 'core' | 'pro' | 'executive'

// ========== Rank System ==========
export const XP_THRESHOLDS = {
  'Rookie': 0,
  'Rising Bull': 100,
  'Sniper Apprentice': 500,
  'Certified Sniper': 1500,
  'Elite Operator': 4000,
} as const

export type Rank = keyof typeof XP_THRESHOLDS

// ========== Learning Paths ==========
export interface LearningPath {
  id: string
  name: string
  slug: string
  description: string | null
  tier_required: Tier
  difficulty_level: DifficultyLevel
  estimated_hours: number | null
  display_order: number
  is_published: boolean
  icon_name: string | null
  created_at: string
  updated_at: string
}

// ========== Courses (extended) ==========
export interface AcademyCourse {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  difficulty_level: DifficultyLevel
  tier_required: Tier
  estimated_hours: number | null
  passing_score: number
  is_published: boolean
  display_order: number
  // Computed fields (from joins)
  lesson_count?: number
  lessons_completed?: number
  progress_percent?: number
}

// ========== Lessons (extended) ==========
export interface AcademyLesson {
  id: string
  course_id: string
  title: string
  slug: string
  video_url: string | null
  content_markdown: string | null
  lesson_type: LessonType
  estimated_minutes: number | null
  display_order: number
  quiz_data: QuizData | null
  activity_data: Record<string, any> | null
  ai_tutor_context: string | null
  ai_tutor_chips: string[]
  key_takeaways: string[] | null
}

// ========== Quiz ==========
export interface QuizData {
  questions: QuizQuestion[]
  passing_score: number // percentage
}

export interface QuizQuestion {
  id: string
  type: 'multiple_choice' | 'scenario' | 'matching'
  text: string
  options: QuizOption[]
  correct_answer: string // option id
  explanation: string
}

export interface QuizOption {
  id: string
  text: string
}

export interface QuizResult {
  quiz_score: number
  questions_correct: number
  questions_total: number
  passed: boolean
  xp_earned: number
  answers: QuizAnswerResult[]
  achievements_unlocked: AchievementEarned[]
}

export interface QuizAnswerResult {
  question_id: string
  selected: string
  correct: string
  is_correct: boolean
  explanation: string
}

// ========== Progress ==========
export interface UserLessonProgress {
  id: string
  user_id: string
  lesson_id: string
  course_id: string
  status: ProgressStatus
  started_at: string | null
  completed_at: string | null
  time_spent_seconds: number
  quiz_score: number | null
  quiz_attempts: number
  activity_completed: boolean
}

export interface UserCourseProgress {
  id: string
  user_id: string
  course_id: string
  status: ProgressStatus
  lessons_completed: number
  total_lessons: number
  overall_quiz_average: number | null
  started_at: string | null
  completed_at: string | null
  certificate_issued: boolean
}

// ========== XP & Achievements ==========
export interface UserXP {
  total_xp: number
  current_rank: Rank
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
  lessons_completed_count: number
  courses_completed_count: number
  quizzes_passed_count: number
}

export interface AchievementEarned {
  id: string
  achievement_type: AchievementType
  achievement_key: string
  achievement_data: Record<string, any>
  xp_earned: number
  trade_card_image_url: string | null
  verification_code: string
  earned_at: string
}

// ========== Dashboard ==========
export interface AcademyDashboard {
  current_lesson: {
    id: string
    title: string
    course_title: string
    progress_percent: number
    lesson_type: LessonType
  } | null
  xp: UserXP
  stats: {
    total_lessons_completed: number
    total_courses_completed: number
    total_time_hours: number
    average_quiz_score: number
  }
  streak: {
    current: number
    longest: number
    days: boolean[] // Last 7 days, true = active
  }
  recommendations: RecommendedLesson[]
  achievements: AchievementEarned[]
}

export interface RecommendedLesson {
  lesson_id: string
  title: string
  course_title: string
  reason: string
  difficulty: DifficultyLevel
  estimated_minutes: number
}

// ========== Onboarding ==========
export interface OnboardingFormData {
  experience_level: 'never' | 'paper' | 'beginner' | 'intermediate' | 'advanced'
  knowledge_quiz_answers: { question_id: number; answer: string }[]
  goals: string[]
  weekly_time_minutes: number
  broker_status: 'choosing' | 'not_setup' | 'setup'
}

// ========== Greeks (Interactive) ==========
export interface BlackScholesInputs {
  stockPrice: number
  strikePrice: number
  daysToExpiration: number
  impliedVolatility: number // as decimal, e.g., 0.30 = 30%
  interestRate: number // as decimal, e.g., 0.05 = 5%
  optionType: 'call' | 'put'
}

export interface GreekValues {
  optionPrice: number
  delta: number
  gamma: number
  theta: number // daily
  vega: number // per 1% IV
  rho: number // per 1% rate
}
```

---

## 12. TESTING REQUIREMENTS

### Minimum Viable Tests

1. **Database:** All tables exist, enums registered, RLS policies active
2. **API Routes:** Each returns correct status codes for authenticated/unauthenticated requests
3. **Onboarding Flow:** Complete 5-step wizard → profile created → redirected to hub
4. **Lesson Player:** Render markdown content, embed YouTube video, track time
5. **Quiz Engine:** Answer questions → get score → XP awarded
6. **Greek Visualizer:** Change slider → Greeks update → chart renders
7. **Position Sizer:** Input values → correct calculations displayed
8. **Trade Card:** Trigger generation → PNG created → verification URL works
9. **Mobile:** All pages render correctly at 390px viewport width
10. **Tier Gating:** Core user cannot see Pro courses, Pro cannot see Executive

### E2E Test Path (Critical)
```
1. New member visits /members/academy → redirected to /onboarding
2. Complete onboarding → placed on learning path → see Academy Hub
3. Click "Start" on first course → see course detail with lessons
4. Open lesson → see content → video plays → read markdown
5. Open AI Tutor → ask question → get contextual answer
6. Open quiz → answer questions → pass → see score + XP earned
7. Complete course → earn achievement → see Trade Card
8. Share Trade Card → verification URL works
```

---

## APPENDIX: COMPANION SPEC FILES

All detailed specifications referenced in this document:

| File | Contents |
|------|----------|
| `docs/TITM_ACADEMY_MIGRATION.sql` | Complete database migration SQL |
| `docs/TITM_ACADEMY_API_SPECS.md` | Full API route + component specifications |
| `docs/TITM_ACADEMY_INTERACTIVE_SPEC.md` | Interactive component + Black-Scholes implementation |
| `docs/TITM_ACADEMY_TRADE_CARDS_SPEC.md` | Trade Card generation system |
| `docs/TITM_TRAINING_SYSTEM_PROPOSAL.md` | Original proposal with curriculum map |

---

**END OF SPECIFICATION**

*This document, combined with the companion spec files, contains everything needed for Codex to build TITM Academy autonomously. Each phase is self-contained and builds on the previous. Start with Phase 1 (migration) and work sequentially.*
