# TradeITM Academy Overhaul — Autonomous Claude Code Implementation Prompt

> **Copy this entire prompt into a Claude Code session to execute the full academy overhaul autonomously.**
> **Pre-requisite:** The branch `academy-overhaul` must be created first. Run `git checkout -b academy-overhaul` before pasting.

---

```
You are the Orchestrator Agent for the TradeITM Academy Overhaul — a 7-phase, 24-slice autonomous implementation. You will coordinate specialized sub-agents (via the Task tool) that build, test, and validate each slice. Every slice is self-gated: no slice merges without passing its validation gates.

## PRIME DIRECTIVES

1. Read `CLAUDE.md` at project root before ANY action. Follow it exactly.
2. Read the execution spec: `docs/specs/ACADEMY_OVERHAUL_EXECUTION_SPEC_2026-02-24.md`
3. Read all 5 Phase 0 research specs in `docs/specs/ACADEMY_*.md` — these are your source of truth for curriculum, UX, activities, reporting, and media.
4. Work on branch `academy-overhaul`. Never push to main.
5. After EACH slice: run validation gates, commit only if green, update the tracker at `docs/specs/academy-overhaul-autonomous-2026-02-24/08_AUTONOMOUS_EXECUTION_TRACKER.md`.
6. If a gate fails: fix it, re-run, do NOT skip. Log failures in the risk register at `docs/specs/academy-overhaul-autonomous-2026-02-24/07_RISK_REGISTER_AND_DECISION_LOG_TEMPLATE.md`.
7. Generate AI images (DALL-E via OpenAI API or programmatic SVG) when Phase 6 requires it.
8. Use `pnpm` exclusively. Never npm or yarn.

## AGENT SPAWNING PATTERN

For each slice, spawn a Task agent with the appropriate model and specialization. Use this exact pattern:

### Database Agent (for Phases 1A, 1B, 2A-2D)
- subagent_type: "general-purpose"
- model: "sonnet"
- Scope: supabase/migrations/*, scripts/seed-*.sql, scripts/validate-*.sql
- NEVER touch: app/**, components/**, backend/src/**

### Backend Agent (for Phases 1C, 4A-4B backend, 5A)
- subagent_type: "general-purpose"
- model: "sonnet"
- Scope: backend/src/routes/academy-*.ts, backend/src/services/academy-*.ts, backend/src/types/academy.ts, backend/__tests__/academy-*.ts
- NEVER touch: app/**, components/**, supabase/migrations/**

### Frontend Agent (for Phases 3A-3D, 4A-4B frontend, 5B)
- subagent_type: "general-purpose"
- model: "sonnet"
- Scope: components/academy/**, app/members/academy/**, hooks/useAcademy*.ts, contexts/academy*.tsx
- NEVER touch: backend/**, supabase/migrations/**

### QA Agent (for Phases 1D, 7A-7D)
- subagent_type: "general-purpose"
- model: "sonnet"
- Scope: e2e/academy-*.spec.ts, __tests__/academy-*, docs/phase-*-report.md
- NEVER modifies production code — only tests and reports

### Media Agent (for Phase 6)
- subagent_type: "general-purpose"
- model: "sonnet"
- Scope: scripts/generate-media.*, public/academy-media/**, SVG badge generation
- Uses OpenAI DALL-E 3 API for hero images, programmatic SVG for badges/diagrams

## EXECUTION SEQUENCE

Execute phases strictly in order. Within a phase, slices may run in parallel ONLY where noted. After each slice, run its gate and commit before proceeding.

---

### ═══════════════════════════════════════════
### PHASE 1: SCHEMA EXTENSIONS & INFRASTRUCTURE
### ═══════════════════════════════════════════

#### SLICE 1A: Gamification & Activity Schema
Spawn: Database Agent

```prompt
You are the Database Agent for TradeITM Academy Overhaul Phase 1, Slice 1A.

READ FIRST:
- /CLAUDE.md (project rules)
- /docs/specs/ACADEMY_OVERHAUL_EXECUTION_SPEC_2026-02-24.md (master spec)
- /docs/specs/ACADEMY_ACTIVITIES_SPEC_2026-02-24.md (activity schema changes)
- /supabase/migrations/20260319000000_academy_v3_schema.sql (existing schema)

CREATE migration file: supabase/migrations/20260224100000_academy_overhaul_phase1a.sql

This migration must:

1. EXTEND the academy_block_type enum with 12 new values:
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'options_chain_simulator';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'payoff_diagram_builder';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'greeks_dashboard';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'trade_scenario_tree';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'strategy_matcher';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'position_builder';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'flashcard_deck';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'timed_challenge';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'market_context_tagger';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'order_entry_simulator';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'what_went_wrong';
   ALTER TYPE academy_block_type ADD VALUE IF NOT EXISTS 'journal_prompt';

2. EXTEND academy_learning_event_type enum:
   ADD 'activity_completed', 'achievement_unlocked', 'streak_milestone', 'xp_earned'

3. CREATE gamification tables:

   academy_user_xp (
     id uuid PK DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     total_xp integer NOT NULL DEFAULT 0,
     current_level integer NOT NULL DEFAULT 1,
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now(),
     UNIQUE(user_id)
   );

   academy_user_streaks (
     id uuid PK DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     current_streak_days integer NOT NULL DEFAULT 0,
     longest_streak_days integer NOT NULL DEFAULT 0,
     last_activity_date date,
     streak_freeze_available boolean NOT NULL DEFAULT true,
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now(),
     UNIQUE(user_id)
   );

   academy_achievements (
     id uuid PK DEFAULT gen_random_uuid(),
     key text NOT NULL UNIQUE,
     title text NOT NULL,
     description text,
     icon_url text,
     category text NOT NULL DEFAULT 'general',
     unlock_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
     xp_reward integer NOT NULL DEFAULT 0,
     is_active boolean NOT NULL DEFAULT true,
     created_at timestamptz DEFAULT now()
   );

   academy_user_achievements (
     id uuid PK DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     achievement_id uuid NOT NULL REFERENCES academy_achievements(id) ON DELETE CASCADE,
     unlocked_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE(user_id, achievement_id)
   );

4. ADD 4 new competencies:
   INSERT INTO academy_competencies (key, title, description, domain)
   VALUES
     ('volatility_mechanics', 'Volatility Mechanics', 'Understand IV, VIX, skew, and term structure.', 'analysis'),
     ('spx_specialization', 'SPX Specialization', 'Master SPX-specific trading characteristics.', 'execution'),
     ('portfolio_management', 'Portfolio Management', 'Manage portfolio-level risk and hedging.', 'risk'),
     ('trading_psychology', 'Trading Psychology', 'Maintain discipline, manage emotions, build routines.', 'improvement')
   ON CONFLICT (key) DO NOTHING;

5. ADD hero_image_url column to academy_lessons if not exists:
   ALTER TABLE academy_lessons ADD COLUMN IF NOT EXISTS hero_image_url text;
   ALTER TABLE academy_modules ADD COLUMN IF NOT EXISTS cover_image_url text;

6. ENABLE RLS on all new tables with policies:
   - Users can read/write own XP, streaks, achievements
   - Achievements table is public-read
   - Service role has full access

7. ADD indexes:
   - academy_user_xp(user_id)
   - academy_user_streaks(user_id)
   - academy_user_achievements(user_id, achievement_id)
   - academy_achievements(category, is_active)

8. ADD updated_at triggers on new tables (use existing handle_updated_at function).

Also UPDATE the TypeScript domain contracts:
- Edit lib/academy-v3/contracts/domain.ts to add new block types to academyBlockTypeSchema
- Add Zod schemas for XP, streaks, achievements

VALIDATION GATE — run these commands and verify all pass:
  pnpm exec tsc --noEmit
  pnpm exec eslint lib/academy-v3/contracts/domain.ts

Do NOT touch: app/**, components/**, backend/src/**
```

#### SLICE 1B: Reporting Aggregation Tables
Spawn: Database Agent (after 1A completes)

```prompt
You are the Database Agent for Phase 1, Slice 1B.

READ: /CLAUDE.md, /docs/specs/ACADEMY_REPORTING_SPEC_2026-02-24.md

CREATE migration: supabase/migrations/20260224100001_academy_overhaul_phase1b.sql

Tables to create:

1. academy_lesson_analytics_daily (
     id uuid PK DEFAULT gen_random_uuid(),
     lesson_id uuid NOT NULL REFERENCES academy_lessons(id) ON DELETE CASCADE,
     date date NOT NULL,
     started_count integer NOT NULL DEFAULT 0,
     completed_count integer NOT NULL DEFAULT 0,
     avg_time_minutes numeric,
     median_time_minutes numeric,
     drop_off_rate numeric,
     created_at timestamptz DEFAULT now(),
     UNIQUE(lesson_id, date)
   );

2. academy_user_competency_mastery_history (
     id uuid PK DEFAULT gen_random_uuid(),
     user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     competency_id uuid NOT NULL REFERENCES academy_competencies(id) ON DELETE CASCADE,
     score_snapshot numeric NOT NULL,
     evaluated_at timestamptz NOT NULL DEFAULT now()
   );

3. academy_cohort_metrics_daily (
     id uuid PK DEFAULT gen_random_uuid(),
     date date NOT NULL UNIQUE,
     active_users integer NOT NULL DEFAULT 0,
     lessons_started integer NOT NULL DEFAULT 0,
     lessons_completed integer NOT NULL DEFAULT 0,
     avg_session_minutes numeric,
     created_at timestamptz DEFAULT now()
   );

RLS: Users read own mastery history. Lesson analytics and cohort metrics are service-role only.
Indexes: (lesson_id, date), (user_id, competency_id, evaluated_at DESC), (date) on cohort.

VALIDATION GATE:
  pnpm exec tsc --noEmit
```

#### SLICE 1C: Backend API Endpoints
Spawn: Backend Agent (after 1A + 1B complete)

```prompt
You are the Backend Agent for Phase 1, Slice 1C.

READ: /CLAUDE.md, /docs/specs/ACADEMY_OVERHAUL_EXECUTION_SPEC_2026-02-24.md, /docs/specs/ACADEMY_ACTIVITIES_SPEC_2026-02-24.md

READ existing backend patterns:
- /backend/src/routes/ (pick any route file to understand patterns)
- /backend/src/middleware/ (auth middleware)
- /backend/src/config/ (database config)

CREATE these files:

1. backend/src/types/academy.ts — TypeScript interfaces matching the new schema tables (XP, streaks, achievements, analytics, activity content/submission/results)

2. backend/src/routes/academy-gamification.ts — Express router:
   POST /api/academy/gamification/xp — Record XP event { userId, amount, source, metadata }
   GET  /api/academy/gamification/user/:userId/stats — Return { totalXp, currentLevel, currentStreak, longestStreak, lastActivityDate, streakFreezeAvailable }
   POST /api/academy/gamification/streak-freeze — Use streak freeze { userId }
   GET  /api/academy/achievements — List all active achievements
   GET  /api/academy/user/:userId/achievements — User's unlocked achievements

3. backend/src/routes/academy-activities.ts — Express router:
   GET  /api/academy/activities/:blockId/content — Fetch activity block content (content_json from academy_lesson_blocks, enriched with any dynamic data)
   POST /api/academy/activities/:blockId/submit — Submit activity answer { userId, answer, timeSpentMs }. Score it, update competency mastery, record learning event, award XP.
   GET  /api/academy/activities/:blockId/results — Return { score, maxScore, feedback, competencyUpdates }

4. backend/src/routes/academy-analytics.ts — Express router:
   GET /api/academy/analytics/student/:userId/dashboard — Aggregate dashboard data { xp, streak, lessonsCompleted, competencyScores[], recentActivity[], predictedCompletionDate }
   GET /api/academy/analytics/student/:userId/competency/:competencyKey — Deep dive { scoreHistory[], linkedLessons[], remediationRecommendations[] }
   GET /api/academy/analytics/student/:userId/performance — { assessmentTrends[], timeEfficiency[], reviewAccuracy[] }

5. backend/src/services/academy-scoring.ts — Scoring logic for each activity type:
   - options_chain_simulator: exact match on answer key
   - payoff_diagram_builder: validate legs match target strategy, score P&L accuracy
   - greeks_dashboard: no scoring (exploration)
   - trade_scenario_tree: score path optimality
   - strategy_matcher: score correct pairings
   - position_builder: score risk/reward optimization
   - flashcard_deck: binary correct/incorrect
   - timed_challenge: accuracy * speed multiplier
   - market_context_tagger: compare tags to expert answer
   - order_entry_simulator: validate all fields
   - what_went_wrong: score identified mistakes
   - journal_prompt: rubric-based scoring (short_answer_rubric type)

6. backend/src/services/academy-xp.ts — XP calculation:
   - Block completion: 10 XP
   - Lesson completion: 50 XP
   - Assessment passed: 100 XP
   - Activity perfect score: 25 XP bonus
   - Streak milestones: 7-day=100XP, 30-day=500XP, 100-day=2000XP
   - Level thresholds: Level N requires N*500 XP

All endpoints MUST:
- Require authentication (use existing auth middleware)
- Validate input with Zod schemas
- Use Supabase client for database queries
- Return proper error responses
- Have TypeScript strict mode (zero `any`)

Register all new routers in the main Express app.

VALIDATION GATE:
  pnpm exec tsc --noEmit --project backend/tsconfig.json
  pnpm exec eslint backend/src/routes/academy-*.ts backend/src/services/academy-*.ts
  npm run build --prefix backend

Do NOT touch: app/**, components/**, supabase/migrations/**
```

#### SLICE 1D: Integration Testing
Spawn: QA Agent (after 1C completes)

```prompt
You are the QA Agent for Phase 1, Slice 1D.

READ: /CLAUDE.md, all Phase 1 files created in slices 1A-1C.

CREATE integration tests:

1. backend/__tests__/academy-gamification.integration.test.ts
   - Test XP recording and retrieval
   - Test streak calculation (consecutive days)
   - Test streak freeze usage
   - Test achievement unlocking
   - Test level-up calculation

2. backend/__tests__/academy-activities.integration.test.ts
   - Test activity content retrieval for each block type
   - Test activity submission and scoring for each activity type
   - Test competency mastery update after scoring
   - Test learning event recording

3. backend/__tests__/academy-analytics.integration.test.ts
   - Test dashboard aggregation endpoint
   - Test competency deep-dive data
   - Test performance analytics data

Use Vitest. Mock Supabase client. Test edge cases: missing user, invalid block ID, duplicate submissions, concurrent XP writes.

VALIDATION GATE:
  pnpm vitest run backend/__tests__/academy-*.integration.test.ts
  pnpm exec tsc --noEmit

Do NOT modify any production code. Only create test files.
```

### PHASE 1 GATE CHECK
After all 4 slices complete, the Orchestrator runs:
```bash
pnpm exec tsc --noEmit
pnpm run build
pnpm exec eslint .
pnpm vitest run backend/__tests__/academy-*
```
Commit: `git add -A && git commit -m "academy-overhaul: Phase 1 complete — schema extensions, API endpoints, integration tests"`

---

### ═══════════════════════════════════════════
### PHASE 2: CURRICULUM SEED DATA
### ═══════════════════════════════════════════

#### SLICE 2A: Track 1 — Trading Foundations
Spawn: Database Agent

```prompt
You are the Database Agent for Phase 2, Slice 2A.

READ: /CLAUDE.md, /docs/specs/ACADEMY_CURRICULUM_PLAN_2026-02-24.md (Track 1 section), /supabase/migrations/20260319010000_academy_v3_foundations_seed.sql (pattern to follow)

CREATE migration: supabase/migrations/20260224200000_academy_overhaul_track1_seed.sql

Seed Track 1: "Trading Foundations" (Beginner) with 4 modules:

Module 1.1: "What Are Financial Markets" — 4 lessons
Module 1.2: "How the Stock Market Works" — 3 lessons
Module 1.3: "Psychology of Trading" — 2 lessons
Module 1.4: "First Steps in Trading" — 1 lesson

For EACH lesson, create all 6 blocks (hook, concept_explanation, worked_example, guided_practice, independent_practice, reflection) with RICH content_json containing:
{
  "title": "...",
  "lessonTitle": "...",
  "lessonObjective": "...",
  "content": "... (2-4 paragraphs of actual educational content, not placeholders) ...",
  "keyTakeaways": ["...", "..."],
  "proTip": "..."
}

For hook blocks, add: "scenario": "... (a vivid real-market story) ..."
For worked_example blocks, add: "steps": [...], "tradeSetup": {...}
For guided_practice blocks, add: "exercise": {...}, "hints": [...], "correctAnswer": {...}
For independent_practice blocks, add: "challenge": {...}, "rubric": {...}
For reflection blocks, add: "journalPrompt": "...", "selfAssessmentQuestions": [...]

Also create 2-3 assessment items per lesson (varied types: single_select, multi_select, ordered_steps).

Map each lesson to competencies with weights. All Track 1 lessons map to trading_psychology and market_context.

Follow the existing seed pattern: use ON CONFLICT for idempotency, reference by slug/code not hardcoded UUIDs.

VALIDATION GATE:
  pnpm exec tsc --noEmit
  # Verify lesson count matches plan
```

#### SLICES 2B-2C: Tracks 2-6
Follow the same pattern as 2A for each track group. Spawn Database Agent sequentially.

Slice 2B creates: supabase/migrations/20260224200001_academy_overhaul_tracks2_3_seed.sql
Slice 2C creates: supabase/migrations/20260224200002_academy_overhaul_tracks4_5_6_seed.sql

#### SLICE 2D: Achievement Definitions + Validation
Spawn: Database Agent

```prompt
You are the Database Agent for Phase 2, Slice 2D.

CREATE migration: supabase/migrations/20260224200003_academy_overhaul_achievements_validation.sql

1. Seed 30 achievement definitions:

Completion achievements:
- first_lesson (Complete your first lesson, 50 XP)
- five_lessons (Complete 5 lessons, 100 XP)
- ten_lessons (Complete 10 lessons, 200 XP)
- track_complete_1 through track_complete_6 (Complete each track, 500 XP each)
- full_program (Complete all 6 tracks, 5000 XP)

Streak achievements:
- streak_7 (7-day streak, 100 XP)
- streak_30 (30-day streak, 500 XP)
- streak_100 (100-day streak, 2000 XP)

Mastery achievements:
- competency_master_X (one per competency, score >= 90, 300 XP each) — 10 total

Activity achievements:
- chain_reader (Complete 10 options chain activities, 200 XP)
- diagram_builder (Complete 10 payoff diagram activities, 200 XP)
- speed_demon (Score 100% on a timed challenge, 150 XP)
- perfect_week (Complete all daily activities for 7 days, 300 XP)

2. Run validation queries (as DO blocks with RAISE NOTICE):
   - All 80 lessons exist
   - All lessons have >= 1 competency mapping
   - No circular prerequisites
   - All block positions are sequential (no gaps)
   - All modules have at least 1 lesson
   - All tracks have at least 1 module
   - Assessment items exist for modules with summative assessments

VALIDATION GATE:
  pnpm exec tsc --noEmit
```

### PHASE 2 GATE CHECK
```bash
pnpm exec tsc --noEmit
pnpm run build
```
Commit: `git add -A && git commit -m "academy-overhaul: Phase 2 complete — 80 lessons seeded across 6 tracks with achievements"`

---

### ═══════════════════════════════════════════
### PHASE 3: UX OVERHAUL
### ═══════════════════════════════════════════

Slices 3A-3D can run in parallel (they touch different files).

#### SLICE 3A: Dashboard Redesign
Spawn: Frontend Agent

```prompt
You are the Frontend Agent for Phase 3, Slice 3A.

READ: /CLAUDE.md (especially Section 2: Design System), /docs/specs/ACADEMY_UX_OVERHAUL_SPEC_2026-02-24.md, /components/academy/academy-dashboard.tsx, /app/members/academy/page.tsx, /app/globals.css

REDESIGN the academy dashboard at /members/academy.

Create/update these components:

1. components/academy/dashboard/academy-streak-banner.tsx
   - Shows current streak (flame icon + day count), longest streak
   - Streak freeze indicator if available
   - Animated flame on milestone days (7, 30, 100)
   - Uses Geist Mono for numbers

2. components/academy/dashboard/academy-xp-level-card.tsx
   - Current XP / next level threshold progress bar
   - Level badge (emerald gradient)
   - Recent XP history (last 5 events)

3. components/academy/dashboard/academy-continue-learning-hero.tsx
   - Large card showing current/next lesson
   - Hero image (or gradient placeholder), lesson title, module name
   - Progress bar showing lesson completion %
   - "Continue" CTA button (emerald gradient, prominent)
   - If no lesson in progress, show "Start Your Journey" with Track 1

4. components/academy/dashboard/academy-weekly-summary.tsx
   - 7-day activity heatmap (GitHub-style, emerald intensity)
   - Lessons completed this week vs last week (delta arrow)
   - Time spent this week

5. components/academy/dashboard/academy-achievement-showcase.tsx
   - Last 3 unlocked achievements (badge icon + title)
   - "View All" link to achievements page
   - Locked badges shown as silhouettes

6. UPDATE app/members/academy/page.tsx
   - Layout: Continue Learning hero (full width), then 2-column grid (streak + XP left, weekly summary + achievements right), then "Browse Modules" CTA
   - Mobile: Single column stack
   - Data fetching: Use existing academy API + new gamification endpoints
   - Loading state: Pulsing logo skeleton (per CLAUDE.md)

ALL components MUST:
- Use glass-card-heavy for card surfaces
- Use Emerald (#10B981) for primary actions, Champagne (#F3E5AB) for accents
- Dark mode only (no light mode styles)
- Use Playfair Display for headings, Inter for body, Geist Mono for numbers
- Use Lucide React icons (stroke width 1.5)
- Use next/image for any images
- Be mobile-first responsive (stack on mobile, grid on desktop)
- Use @/ alias for imports
- Have zero TypeScript `any` types

VALIDATION GATE:
  pnpm exec tsc --noEmit
  pnpm exec eslint components/academy/dashboard/ app/members/academy/page.tsx

Do NOT touch: backend/**, supabase/**, lib/spx/**
```

#### SLICE 3B: Module Catalog Redesign
Spawn: Frontend Agent (parallel with 3A)

```prompt
You are the Frontend Agent for Phase 3, Slice 3B.

READ: /CLAUDE.md, /docs/specs/ACADEMY_UX_OVERHAUL_SPEC_2026-02-24.md, /components/academy/academy-module-catalog.tsx, /components/academy/academy-module-card.tsx, /app/members/academy/modules/page.tsx

REDESIGN the module catalog:

1. components/academy/catalog/academy-track-section.tsx
   - Track header with cover image (or gradient), title, description
   - Track progress bar (% of modules completed)
   - Difficulty badge: Beginner (emerald), Intermediate (champagne), Advanced (amber)
   - Expandable/collapsible module list

2. components/academy/catalog/academy-module-card-v2.tsx
   - Cover image with overlay gradient
   - Title, description (2 lines, truncated)
   - Estimated time (clock icon + "45 min")
   - Lesson count (book icon + "5 lessons")
   - Difficulty indicator
   - Progress bar if started
   - Lock icon if prerequisites not met
   - Prerequisite tooltip on hover (shows required modules)

3. components/academy/catalog/academy-prerequisite-chain.tsx
   - Visual flow: Module A → Module B → Module C (connected dots/lines)
   - Completed modules: emerald filled
   - Current module: pulsing emerald
   - Locked modules: gray outline
   - Clickable to navigate

4. UPDATE app/members/academy/modules/page.tsx
   - Group modules by track with track sections
   - Filter: All / Beginner / Intermediate / Advanced
   - Sort: Recommended (default, by prerequisite chain) / Newest / Most Popular
   - Search bar for module/lesson titles
   - Mobile: Full-width cards, vertical scroll

VALIDATION GATE:
  pnpm exec tsc --noEmit
  pnpm exec eslint components/academy/catalog/ app/members/academy/modules/
```

#### SLICE 3C: Lesson Viewer Overhaul
Spawn: Frontend Agent

```prompt
You are the Frontend Agent for Phase 3, Slice 3C.

READ: /CLAUDE.md, /docs/specs/ACADEMY_UX_OVERHAUL_SPEC_2026-02-24.md, /docs/specs/ACADEMY_ACTIVITIES_SPEC_2026-02-24.md, /components/academy/academy-lesson-viewer.tsx, /app/members/academy/lessons/[id]/page.tsx

OVERHAUL the lesson viewer:

1. components/academy/lesson-viewer/academy-lesson-hero.tsx
   - Full-width hero image with parallax scroll effect
   - Overlay: lesson title (Playfair Display), module name, estimated time, difficulty badge
   - Gradient fade to content below

2. components/academy/lesson-viewer/academy-block-renderer.tsx
   - Master renderer that dispatches to block-type-specific components
   - Block types: hook, concept_explanation, worked_example, guided_practice, independent_practice, reflection
   - ALSO renders new activity types (options_chain_simulator, payoff_diagram_builder, etc.) — for now, show a "Coming Soon" placeholder card for new types
   - Each block has: type badge (top-left), title, content area, "Mark Complete" button
   - Smooth scroll-snap between blocks
   - Block progress indicator: ●●●○○○ (filled = completed, hollow = remaining)

3. components/academy/lesson-viewer/academy-block-progress.tsx
   - Horizontal progress dots at top (sticky on scroll)
   - Current block highlighted with emerald glow
   - Click dot to navigate to block
   - Shows block type icon for each dot

4. components/academy/lesson-viewer/academy-lesson-nav.tsx
   - Bottom bar: Previous / Continue / Skip buttons
   - "Continue" is emerald gradient, primary action
   - On last block: "Complete Lesson" with confetti animation trigger
   - XP earned display (+50 XP with animated counter)

5. components/academy/lesson-viewer/academy-confetti.tsx
   - Canvas-based confetti animation (emerald + champagne particles)
   - Triggers on lesson completion
   - Auto-dismisses after 3 seconds
   - Respects prefers-reduced-motion

6. UPDATE app/members/academy/lessons/[id]/page.tsx
   - Fetch lesson + blocks from API
   - Track block completion state (local + API)
   - Handle lesson start (POST /api/academy-v3/lessons/{id}/start)
   - Handle block completion (POST /api/academy-v3/lessons/{id}/blocks)
   - On lesson complete: trigger confetti, award XP, show next lesson CTA

VALIDATION GATE:
  pnpm exec tsc --noEmit
  pnpm exec eslint components/academy/lesson-viewer/ app/members/academy/lessons/
```

#### SLICE 3D: Progress & Reporting Views
Spawn: Frontend Agent

```prompt
You are the Frontend Agent for Phase 3, Slice 3D.

READ: /CLAUDE.md, /docs/specs/ACADEMY_REPORTING_SPEC_2026-02-24.md, /docs/specs/ACADEMY_UX_OVERHAUL_SPEC_2026-02-24.md, /components/academy/academy-progress-overview.tsx, /app/members/academy/progress/page.tsx

CREATE progress and analytics views:

1. components/academy/progress/academy-competency-radar.tsx
   - Radar/spider chart with 10 competency axes
   - Use Recharts RadarChart
   - Emerald fill, champagne grid lines
   - Hover for score details
   - Mobile: Minimum 280px width, touch-friendly

2. components/academy/progress/academy-study-time-chart.tsx
   - 7-day rolling bar chart (time spent per day)
   - Uses Recharts BarChart
   - Emerald bars, goal line in champagne

3. components/academy/progress/academy-velocity-card.tsx
   - Lessons per week trend (last 4 weeks)
   - Sparkline chart
   - Delta arrow (up/down vs previous week)

4. components/academy/progress/academy-streak-calendar.tsx
   - 90-day heatmap (GitHub contribution style)
   - Emerald intensity scaling (0 = dark, 1+ activities = light to bright)
   - Current streak highlighted

5. components/academy/progress/academy-xp-progress.tsx
   - XP bar showing progress to next level
   - Level badge
   - Total XP earned
   - Breakdown: lessons, assessments, activities, streaks

6. components/academy/progress/academy-completion-predictor.tsx
   - Based on current velocity, predict program completion date
   - Visual timeline with milestones
   - "At your pace, you'll finish Track 3 by [date]"

7. UPDATE app/members/academy/progress/page.tsx
   - Layout: Competency radar (full width), 3-column grid (study time, velocity, streak), then XP + completion predictor
   - Mobile: Stack everything
   - Data: Fetch from analytics endpoints (with graceful fallbacks if no data yet)

VALIDATION GATE:
  pnpm exec tsc --noEmit
  pnpm exec eslint components/academy/progress/ app/members/academy/progress/
```

### PHASE 3 GATE CHECK
```bash
pnpm exec tsc --noEmit
pnpm run build
pnpm exec eslint components/academy/ app/members/academy/
```
Commit: `git add -A && git commit -m "academy-overhaul: Phase 3 complete — dashboard, catalog, lesson viewer, progress UX overhaul"`

---

### ═══════════════════════════════════════════
### PHASE 4: INTERACTIVE ACTIVITIES
### ═══════════════════════════════════════════

#### SLICE 4A: Core Activities (3 types)
Spawn: Frontend Agent

```prompt
You are the Frontend Agent for Phase 4, Slice 4A.

READ: /CLAUDE.md, /docs/specs/ACADEMY_ACTIVITIES_SPEC_2026-02-24.md (full detail for each activity type)

BUILD 3 interactive activity components:

1. components/academy/activities/academy-options-chain-simulator.tsx
   Props: { chainData: OptionsChainData, questions: Question[], onSubmit: (answers) => void }
   - Render tabular options chain: Strike | Bid | Ask | Volume | OI | Delta | Gamma | Theta | Vega
   - Calls side, puts side (toggleable tabs on mobile)
   - Highlight ITM/ATM/OTM zones with color coding
   - Below chain: multiple-choice questions about the data
   - Submit button scores answers against answer key
   - Show correct/incorrect with explanations
   - Mobile: Horizontal scroll on chain table, questions stack below

2. components/academy/activities/academy-payoff-diagram-builder.tsx
   Props: { targetStrategy: string, availableLegs: Leg[], onSubmit: (position) => void }
   - Left panel: available legs (calls/puts at various strikes)
   - Center: SVG canvas showing payoff diagram
   - Drag legs from left to center to build position
   - Real-time P&L curve recalculation as legs are added/removed
   - Show max profit, max loss, breakeven points
   - Below diagram: quiz questions about the position
   - Touch: Tap to add/remove legs on mobile
   - SVG rendering with smooth transitions

3. components/academy/activities/academy-greeks-dashboard.tsx
   Props: { initialState: GreeksState }
   - 3 sliders: Underlying Price (±5%), Time to Expiry (0-30 DTE), IV (10-80%)
   - 4 Greeks displays: Delta, Gamma, Theta, Vega
   - Each Greek shown as: number + color bar + trend arrow
   - Real-time updates as sliders move
   - Chart: Greeks vs Strike price curve (Recharts LineChart)
   - No scoring — exploration activity
   - Mobile: Sliders stack vertically, chart below

ALL activities must:
- Accept content_json from the lesson block as configuration
- Integrate with the block renderer from Phase 3C
- Call the scoring API on submit (POST /api/academy/activities/{blockId}/submit)
- Show XP earned animation on completion
- Follow Emerald Standard (dark mode, glass-card-heavy)
- Be keyboard accessible (Tab, Enter, Arrow keys)
- Have ARIA labels for screen readers

VALIDATION GATE:
  pnpm exec tsc --noEmit
  pnpm exec eslint components/academy/activities/
```

#### SLICE 4B: Mid-Tier Activities (3 types)
Spawn: Frontend Agent (after 4A)

```prompt
You are the Frontend Agent for Phase 4, Slice 4B.

READ: /docs/specs/ACADEMY_ACTIVITIES_SPEC_2026-02-24.md

BUILD 3 more activity components:

1. components/academy/activities/academy-trade-scenario-tree.tsx
   - Branching narrative: present scenario text + chart screenshot
   - 2-4 decision buttons per node
   - On selection: animate transition to next node
   - Show consequence: P&L outcome, explanation of why this was good/bad
   - Final node: score summary (optimal path vs student path)
   - Tree visualization: vertical flow with branches

2. components/academy/activities/academy-strategy-matcher.tsx
   - Left column: market conditions (cards with descriptions)
   - Right column: strategies (cards with names)
   - Drag from left to right to match (or tap-to-select on mobile)
   - On submit: show correct matches with explanations
   - Score: correct matches / total

3. components/academy/activities/academy-position-builder.tsx
   - Market thesis prompt at top
   - Builder panel: Direction (bullish/bearish/neutral), Strategy dropdown, Strike selection, Expiration, Size
   - Live preview: position summary, max risk, max reward, breakeven
   - Submit: compare to optimal position, score on R:R optimization
   - Show expert's position for comparison

UPDATE components/academy/lesson-viewer/academy-block-renderer.tsx
   - Replace "Coming Soon" placeholders with actual activity components for all 6 types built in 4A + 4B

VALIDATION GATE:
  pnpm exec tsc --noEmit
  pnpm exec eslint components/academy/activities/ components/academy/lesson-viewer/
```

### PHASE 4 GATE CHECK
```bash
pnpm exec tsc --noEmit
pnpm run build
pnpm exec eslint components/academy/
```
Commit: `git add -A && git commit -m "academy-overhaul: Phase 4 complete — 6 interactive activity types"`

---

### ═══════════════════════════════════════════
### PHASE 5: REPORTING & ANALYTICS
### ═══════════════════════════════════════════

#### SLICE 5A: Backend Aggregation
Spawn: Backend Agent

```prompt
You are the Backend Agent for Phase 5, Slice 5A.

READ: /CLAUDE.md, /docs/specs/ACADEMY_REPORTING_SPEC_2026-02-24.md

CREATE Supabase Edge Functions:

1. supabase/functions/aggregate-daily-lesson-analytics/index.ts
   - Query academy_learning_events for the previous day
   - Aggregate by lesson_id: count starts, count completions, avg/median time
   - Upsert into academy_lesson_analytics_daily
   - Schedule: runs at 1:00 AM UTC daily (via pg_cron or external trigger)

2. supabase/functions/aggregate-user-competency-history/index.ts
   - Triggered after assessment submission
   - Recalculate user competency scores from recent 10 assessments
   - Insert snapshot into academy_user_competency_mastery_history
   - Update academy_user_competency_mastery current score

3. backend/src/services/academy-analytics-aggregator.ts
   - Service class with methods:
     - aggregateDailyLessonAnalytics(date: Date)
     - aggregateUserCompetencyHistory(userId: string, competencyId: string)
     - generateStudentDashboardData(userId: string)
     - generateCompetencyDeepDive(userId: string, competencyKey: string)

VALIDATION GATE:
  pnpm exec tsc --noEmit
  npm run build --prefix backend
```

#### SLICE 5B: Student Analytics Dashboards
Spawn: Frontend Agent (after 5A)

```prompt
You are the Frontend Agent for Phase 5, Slice 5B.

CREATE analytics pages:

1. app/members/academy/competencies/[competencyKey]/page.tsx
   - Competency score trend chart (90-day history, Recharts LineChart)
   - Linked lessons table with status, score, time
   - Remediation recommendations (top 3 lessons to revisit)
   - "Ask AI Coach" button linking to /members/ai-coach with context

2. app/members/academy/analytics/page.tsx
   - Assessment score trends (scatter + 7-day moving average)
   - Time spent per lesson vs cohort average (horizontal bar chart)
   - Review queue accuracy by competency (grouped bar chart)
   - Most-missed and best-performing topics

3. components/academy/analytics/academy-assessment-trends.tsx
4. components/academy/analytics/academy-time-efficiency.tsx
5. components/academy/analytics/academy-review-accuracy.tsx

VALIDATION GATE:
  pnpm exec tsc --noEmit
  pnpm exec eslint app/members/academy/analytics/ app/members/academy/competencies/ components/academy/analytics/
```

### PHASE 5 GATE CHECK
```bash
pnpm exec tsc --noEmit
pnpm run build
```
Commit: `git add -A && git commit -m "academy-overhaul: Phase 5 complete — analytics edge functions and student dashboards"`

---

### ═══════════════════════════════════════════
### PHASE 6: AI IMAGE GENERATION & MEDIA
### ═══════════════════════════════════════════

Spawn: Media Agent

```prompt
You are the Media Agent for Phase 6.

READ: /CLAUDE.md, /docs/specs/ACADEMY_MEDIA_STRATEGY_2026-02-24.md

Your job is to create all visual assets for the academy. This phase has 3 sub-tasks:

TASK 1: Achievement Badge SVGs (30 badges)
Create SVG files at public/academy-media/badges/:

For each achievement from the seed data, create a 128x128 SVG badge:
- Base shape: Rounded hexagon or shield
- Color scheme: Emerald (#10B981) primary, Champagne (#F3E5AB) accent, dark background (#0A0A0A) or transparent
- Icon: Relevant Lucide icon path data (Flame for streaks, BookOpen for lessons, Trophy for mastery, Zap for speed, Star for completion)
- Title text at bottom (small, Inter font)
- Glow effect on unlocked state (emerald drop shadow)

Generate each SVG programmatically using a template. Create a script:
scripts/generate-badges.ts that outputs all 30 badges.

TASK 2: Placeholder Hero Images
Since we may not have DALL-E API access in this environment, create CSS gradient + SVG combination placeholders:

Create components/academy/media/academy-hero-placeholder.tsx:
- Accepts: trackSlug, moduleSlug, lessonSlug, title
- Renders: Dark gradient background (track-specific color accent), geometric pattern overlay, lesson title overlay, module badge
- Track color accents:
  - Track 1 (Foundations): Emerald → Teal gradient
  - Track 2 (Analysis): Emerald → Blue gradient
  - Track 3 (Options): Emerald → Purple gradient
  - Track 4 (SPX): Emerald → Gold/Champagne gradient
  - Track 5 (Advanced): Emerald → Red gradient
  - Track 6 (Psychology): Emerald → Cyan gradient
- These serve as fallbacks AND as the default until real DALL-E images are generated.

TASK 3: DALL-E Generation Script (for manual/scheduled execution)
Create scripts/generate-hero-images.ts:
- Reads all lessons from the database (or from seed SQL parsing)
- For each lesson, constructs a DALL-E 3 prompt:
  Base: "Dark luxury financial trading interface, emerald green (#10B981) accents, champagne gold (#F3E5AB) highlights, dark background (#0A0A0A), professional private equity aesthetic, cinematic lighting, 16:9 aspect ratio"
  + lesson-specific subject (e.g., "candlestick chart patterns on multiple monitors")
  + composition guidance based on block type
- Calls OpenAI API (DALL-E 3, 1792x1024)
- Saves to public/academy-media/lessons/{track-slug}/{module-slug}/{lesson-slug}-hero.webp
- Generates LQIP (low-quality image placeholder) base64 strings
- Outputs a manifest JSON with all URLs and alt text
- Has --dry-run flag to preview prompts without generating
- Has --track=N flag to generate only one track at a time
- Has rate limiting (max 5 requests per minute)

VALIDATION GATE:
  pnpm exec tsc --noEmit
  # Verify badge SVGs render (open in browser)
  ls public/academy-media/badges/*.svg | wc -l  # Should be 30
```

### PHASE 6 GATE CHECK
```bash
pnpm exec tsc --noEmit
pnpm run build
```
Commit: `git add -A && git commit -m "academy-overhaul: Phase 6 complete — 30 SVG badges, hero placeholders, DALL-E generation pipeline"`

---

### ═══════════════════════════════════════════
### PHASE 7: QA, ACCESSIBILITY, PERFORMANCE
### ═══════════════════════════════════════════

#### SLICE 7A: E2E Test Suite
Spawn: QA Agent

```prompt
You are the QA Agent for Phase 7, Slice 7A.

READ: /CLAUDE.md, /e2e/ (existing test patterns)

CREATE comprehensive E2E tests:

1. e2e/academy-dashboard.spec.ts
   - Dashboard loads with all 5 widgets
   - Continue learning card shows correct lesson
   - Streak banner displays correct count
   - XP progress bar is accurate
   - Achievement showcase shows recent unlocks
   - Mobile viewport: all widgets stack correctly

2. e2e/academy-catalog.spec.ts
   - Module catalog loads all tracks
   - Filter by difficulty works
   - Prerequisite lock states display correctly
   - Module card links to correct module page
   - Search filters modules by title

3. e2e/academy-lesson-viewer.spec.ts
   - Lesson loads with hero image
   - Block progress indicator shows correct state
   - Navigate between blocks (next/previous)
   - Mark block complete updates progress
   - Complete last block triggers confetti
   - XP award displays after completion

4. e2e/academy-activities.spec.ts
   - Options chain simulator: select answer, submit, see score
   - Payoff diagram builder: add legs, see P&L curve, submit
   - Greeks dashboard: move sliders, see Greeks update
   - Trade scenario tree: make decisions, see outcome
   - Strategy matcher: match conditions to strategies, submit
   - Position builder: build position, submit, see comparison

5. e2e/academy-progress.spec.ts
   - Progress page loads all charts
   - Competency radar renders with data
   - Streak calendar shows correct heatmap
   - XP progress bar matches actual data

Use Playwright with @axe-core/playwright for accessibility checks on each page.
Use deterministic test IDs (data-testid) — if any are missing from components, document them as needed additions.

VALIDATION GATE:
  pnpm exec playwright test e2e/academy-*.spec.ts --project=chromium --workers=1
```

#### SLICE 7B-7D: Accessibility, Performance, Production Readiness
Spawn: QA Agent (after 7A)

```prompt
You are the QA Agent for Phase 7, Slices 7B-7D.

7B: ACCESSIBILITY AUDIT
- Run axe-core on all academy routes
- Check keyboard navigation through all interactive elements
- Verify all images have alt text
- Verify all form inputs have labels
- Check color contrast meets WCAG AA (4.5:1 for body text)
- Verify animations respect prefers-reduced-motion
- Create report: docs/specs/ACADEMY_A11Y_AUDIT_2026-02-24.md

7C: PERFORMANCE AUDIT
- Run Lighthouse on: /members/academy, /members/academy/modules, /members/academy/lessons/[id], /members/academy/progress
- Target: >= 90 on dashboard, >= 85 on other pages
- Check bundle size: pnpm analyze (activity components should be code-split)
- Check image loading: lazy-load with blur placeholder
- Create report: docs/specs/ACADEMY_PERFORMANCE_AUDIT_2026-02-24.md

7D: PRODUCTION READINESS
- Verify all validation gates pass:
  pnpm exec tsc --noEmit
  pnpm run build
  pnpm exec eslint .
  pnpm vitest run
  pnpm exec playwright test e2e/academy-*.spec.ts --project=chromium --workers=1
  node --version  # >= 22
- Content spot-check: verify 10 random lessons have correct content
- Create: docs/specs/ACADEMY_PRODUCTION_READINESS_2026-02-24.md
```

### FINAL RELEASE GATE
```bash
pnpm exec tsc --noEmit
pnpm run build
pnpm exec eslint .
pnpm vitest run
pnpm exec playwright test e2e/academy-*.spec.ts --project=chromium --workers=1
```

Final commit: `git add -A && git commit -m "academy-overhaul: Phase 7 complete — E2E tests, accessibility audit, performance audit, production ready"`

---

## ORCHESTRATOR CHECKLIST

After ALL phases complete, verify:
- [ ] Branch `academy-overhaul` has clean commit history (one per phase)
- [ ] TypeScript: zero errors
- [ ] ESLint: zero warnings
- [ ] Build: succeeds
- [ ] Tests: all pass
- [ ] 80 lessons seeded with rich content
- [ ] 6 interactive activity types working
- [ ] Dashboard, catalog, lesson viewer, progress pages redesigned
- [ ] 30 SVG badges generated
- [ ] DALL-E generation script ready for manual execution
- [ ] Analytics edge functions deployed
- [ ] E2E test coverage for all major flows
- [ ] Accessibility audit: zero critical violations
- [ ] Tracker updated: docs/specs/academy-overhaul-autonomous-2026-02-24/08_AUTONOMOUS_EXECUTION_TRACKER.md

Update tracker status to COMPLETE. Generate final summary.
```
