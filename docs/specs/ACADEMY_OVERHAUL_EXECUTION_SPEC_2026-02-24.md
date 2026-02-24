# TradeITM Academy Overhaul: Unified Execution Specification

> **Document Type:** Master Execution Specification
> **Date:** 2026-02-24
> **Status:** Final (Ready for Implementation)
> **Audience:** Implementation Agents, Product, Engineering
> **Phase:** Full Multi-Phase Rollout (18 weeks)

---

## EXECUTIVE SUMMARY

This document synthesizes 5 Phase 0 research documents into a single, actionable execution specification for the complete TradeITM Academy overhaul. The project encompasses:

- **Scope:** 6 learning tracks, 24 modules, 80 lessons, 12 new interactive activity types, comprehensive gamification and reporting
- **Scale:** 400+ media assets (hero images, module covers, track covers, inline illustrations, badges)
- **Timeline:** 18 weeks (7 phases), phased vertical slices to ship value incrementally
- **Complexity:** Database schema extensions, backend API expansion, comprehensive UX redesign, AI-driven content generation
- **Target Outcome:** World-class trading education platform with mastery-driven progression, engagement mechanics, rich analytics, and photorealistic visual identity

### Synthesized Scope

| Component | Curriculum | UX | Activities | Reporting | Media |
|-----------|-----------|----|-----------|---------|----|
| **6 Tracks** | ✓ (24 modules, 80 lessons) | ✓ (redesigned dashboard, catalog, viewer) | ✓ (integrated) | ✓ (track-level analytics) | ✓ (6 track covers) |
| **Gamification** | — | ✓ (streaks, XP, badges, levels) | — | ✓ (XP tracking, engagement metrics) | ✓ (30+ badges) |
| **Activity Types** | — | — | ✓ (12 new types prioritized) | ✓ (activity performance) | ✓ (inline illustrations) |
| **Reporting** | — | ✓ (progress views) | — | ✓ (comprehensive dashboards) | — |
| **Media Pipeline** | ✓ (150+ lesson heroes) | — | ✓ (200+ inline illustrations) | — | ✓ (DALL-E 3 + CDN) |

---

## CONFLICT RESOLUTION

During Phase 0 research, agents proposed slightly different phasing strategies. This section documents decisions:

### Conflict 1: Phase 1 Curriculum Scope (Curriculum vs. UX vs. Database)

**Issue:** Curriculum Plan proposed seeding all 6 tracks, 24 modules, 80 lessons in Phase 2. UX Overhaul proposed starting with 1 complete track (4 modules, 10 lessons) for MVP validation.

**Decision:** Adopt **vertical slice strategy** per CLAUDE.md Section 6.2 (Spec-First Autonomous Delivery). Seed all 6 tracks at database level in Phase 2 (establishes schema), but complete full implementation (UX + activities + media) for **Track 1 (Trading Foundations)** in Phase 3–4, then expand to other tracks in Phase 5+.

**Rationale:** Shipping one polished, complete track with end-to-end UX, activities, and analytics is more valuable than 6 half-done tracks. Allows early user validation and iteration.

### Conflict 2: Activity Priority Order (Activities Spec vs. UX Spec)

**Issue:** Activities Spec listed 12 new activity types without priority ranking. UX Spec implied certain activities (Greeks slider, scenario simulator) should ship early.

**Decision:** **Prioritize by curriculum usage frequency and learning impact.** Implement in this order:

**Phase 4A (Weeks 9–10):** Options Chain Simulator, Payoff Diagram Builder, Greeks Dashboard (covers ~45% of Track 1 lessons)
**Phase 4B (Weeks 11–12):** Trade Scenario Tree, Strategy Matcher, Position Builder (covers ~30% of lessons)
**Phase 4C (Future, post-Phase 7):** Flashcards, Timed Challenges, Market Context Tagger, Order Entry Sim, What Went Wrong, Journal Prompts

### Conflict 3: Reporting Dashboard Widgets (Reporting vs. UX)

**Issue:** Reporting Spec proposed 6 major student dashboards + 1 admin dashboard. UX Spec proposed 5 cards on the main dashboard.

**Decision:** **Stagger dashboard delivery:**
- **Phase 3 (UX):** Core 5 dashboard cards (streak, XP, continue learning, weekly summary, achievements) go live
- **Phase 5 (Reporting):** Deep-dive dashboards (learning analytics, competency radar, progress page) added later for students who want detailed insight
- **Admin dashboards:** Phase 6+ (low priority for initial launch)

### Conflict 4: Media Asset Count (Media Strategy vs. Curriculum Plan)

**Issue:** Curriculum Plan outlined 80 lessons (needing 80+ hero images). Media Strategy budgeted 150 lesson heroes + 30 module covers + 6 track covers + 200 inline illustrations = 386 total assets. Cost estimates differed.

**Decision:** **Finalize asset count as 150 lesson heroes (covers all lessons + some redundancy for aesthetic variety), 30 module covers, 6 track covers, and prioritized inline illustrations (200 initial, expandable).** Total: ~400 assets. Cost: $500–750 one-time setup + $25–50/month ongoing.

### Conflict 5: Component Naming Conventions (Activities vs. UX)

**Issue:** Activities Spec used component names like `OptionsChainSimulator`, `PayoffDiagramBuilder`. UX Spec implied naming convention `AcademyGreekVisualizer`, `AcademyChartWalkthrough`.

**Decision:** **All new academy components adopt `Academy*` prefix + descriptive name (e.g., `AcademyOptionsChainSimulator`, `AcademyPayoffBuilder`).** Maintains consistency with existing `AcademyStreakBanner`, `AcademyContinueLearningHero`.

---

## IMPLEMENTATION PHASES & SLICES

### PHASE 1: Schema Extensions & Infrastructure (Weeks 1–2)

**Owner:** Database Agent + Backend Agent
**Objective:** Extend Supabase schema and build API endpoints to support all new features

#### Database Changes (Migration Files Required)

**1.1 Gamification Tables**
- `academy_user_xp` (user_id, total_xp, current_level) — XP tracking and leveling
- `academy_user_streaks` (user_id, current_streak_days, longest_streak_days, last_activity_date) — Streak tracking
- `academy_achievements` (id, key, title, description, icon_url, unlock_criteria) — Achievement definitions
- `academy_user_achievements` (user_id, achievement_id, unlocked_at) — User achievement progress
- **Indexes:** (user_id) on all tables for fast player queries
- **RLS Policies:** Users can only read own data; service role can insert/update for events

**1.2 Learning Event Tracking Enhancement**
- Extend `academy_learning_events` with new event types:
  - `lesson_started`, `block_completed`, `assessment_passed`, `assessment_failed`, `review_completed`, `activity_completed`, `achievement_unlocked`, `streak_milestone`
- Add `event_metadata` (jsonb) for activity-specific data (e.g., activity_type, score, time_spent)
- **Triggers:** Auto-update gamification tables on events

**1.3 New Activity Block Types Enum**
- Extend `academy_block_type` enum with:
  - `options_chain_simulator`, `payoff_diagram_builder`, `greeks_dashboard`, `trade_scenario_tree`, `strategy_matcher`, `position_builder`, `flashcard`, `timed_challenge`, `market_context_tagger`, `order_entry_sim`, `what_went_wrong`, `journal_prompt`
- All types default to `content_json jsonb` column for storing activity-specific parameters

**1.4 Reporting Aggregation Tables**
- `academy_lesson_analytics_daily` (lesson_id, date, avg_time_minutes, completion_count, started_count)
- `academy_user_competency_mastery_history` (user_id, competency_id, score_snapshot, evaluated_at)
- **Triggers:** Nightly aggregation edge function populates these tables from raw events
- **Indexes:** (lesson_id, date), (user_id, competency_id, evaluated_at)

**1.5 Media & Badge Tables**
- `academy_lesson_media` (lesson_id, media_type, url, alt_text) — Links lessons to hero images
- `academy_badge_definitions` (id, key, title, icon_url, criteria_json) — Predefined badges
- **Indexes:** (lesson_id), (key)

#### Backend API Endpoints (Express Routes Required)

**1.6 Gamification Endpoints**
- `POST /api/academy/gamification/xp` — Record XP event, update total, check for level-up
- `GET /api/academy/gamification/user/{userId}/stats` — Return current XP, level, streak
- `POST /api/academy/gamification/streak-freeze` — One free weekly streak skip
- `GET /api/academy/achievements` — List all achievements
- `GET /api/academy/user/{userId}/achievements` — User's achievement progress

**1.7 Activity Endpoints**
- `GET /api/academy/activities/{blockId}/content` — Fetch activity content (options chain, payoff diagram, etc.)
- `POST /api/academy/activities/{blockId}/submit` — Submit activity answer, calculate score
- `GET /api/academy/activities/{blockId}/results` — Return feedback and scoring details

**1.8 Reporting Endpoints**
- `GET /api/academy/analytics/student/{userId}/dashboard` — Return all dashboard metrics
- `GET /api/academy/analytics/student/{userId}/competency/{competencyKey}` — Deep-dive competency view
- `GET /api/academy/analytics/student/{userId}/performance` — Assessment trends, time efficiency, etc.

**1.9 Media Endpoints**
- `GET /api/academy/media/lesson/{lessonId}/hero` — Fetch hero image metadata (url, alt text, responsive variants)
- `POST /api/academy/media/generate` — Trigger DALL-E batch job for missing images (internal only)

#### Validation Gates (End of Phase 1)

```bash
# TypeScript strict mode
pnpm exec tsc --noEmit

# Database migration tests
npx supabase db push --dry-run

# Endpoint type safety
pnpm exec eslint backend/src/routes --fix

# Schema audit for RLS, indexes
get_advisors(type: "security")
get_advisors(type: "performance")
```

#### Slice Breakdown

- **1A (Days 1–3):** Gamification tables, enum extensions, triggers, RLS policies
- **1B (Days 4–6):** Reporting aggregation tables, nightly edge function, indexes
- **1C (Days 7–10):** All API endpoints, type definitions, validation
- **1D (Days 11–14):** Endpoint integration testing, gate validation

---

### PHASE 2: Curriculum Seed Data (Weeks 3–4)

**Owner:** Database Agent
**Objective:** Populate all 6 tracks, 24 modules, 80 lessons, 480+ blocks with canonical curriculum data

#### Deliverables

**2.1 Seed SQL Generation**
- Script: `scripts/seed-academy-curriculum.sql` (generated from curriculum plan, manually curated for correctness)
- Includes: All track, module, lesson, block, assessment item definitions
- Competency mappings for all 80 lessons
- Prerequisite chains for all modules
- Estimated duration (in minutes) for all blocks and lessons

**2.2 Seed Data Contents by Phase**

**Track 1: Trading Foundations (Beginner)** — 4 modules, 10 lessons (~12–15 hours)
- Module 1.1: What Are Financial Markets? (4 lessons)
- Module 1.2: How the Stock Market Works (3 lessons)
- Module 1.3: Psychology of Trading (2 lessons)
- Module 1.4: First Steps in Trading (1 lesson)

**Track 2: Technical & Fundamental Analysis (Intermediate)** — 5 modules, 16 lessons (~20–25 hours)
**Track 3: Options Fundamentals (Intermediate)** — 5 modules, 18 lessons (~25–30 hours)
**Track 4: SPX Mastery (Advanced)** — 4 modules, 12 lessons (~18–20 hours)
**Track 5: Advanced Strategies & Portfolio (Advanced)** — 3 modules, 14 lessons (~20–25 hours)
**Track 6: Trading Psychology & Discipline (All Levels)** — 2 modules, 10 lessons (~15–20 hours)

**Total:** 24 modules, 80 lessons, ~120–130 hours

**2.3 Gamification Seed Data**
- Badge definitions (30 badges): First 5 Lessons, Week Warrior, Greeks Master, Risk Manager, etc.
- XP rules hardcoded in backend service (not seeded, but documented)
- Unlock criteria per badge as JSON structures

**2.4 Competency Mapping**
- Link all 80 lessons to 6 core + 4 specialized competencies with weights
- Example: Lesson 1.1.1 (Stocks/Bonds/Commodities) → market_context (1.0), trading_psychology (0.5)

#### Validation Gates (End of Phase 2)

```bash
# Seed data integrity checks
psql -d supabase_db -f scripts/validate-curriculum-integrity.sql

# Competency coverage check (all lessons must map to ≥1 competency)
SELECT lesson_id FROM academy_lessons WHERE id NOT IN (
  SELECT DISTINCT lesson_id FROM academy_lesson_competencies
);

# Prerequisite chain validation (no circular dependencies)
WITH RECURSIVE prereq_chain AS (
  SELECT id, prerequisite_module_id, 1 as depth FROM academy_modules WHERE prerequisite_module_id IS NOT NULL
  UNION ALL
  SELECT pc.id, am.prerequisite_module_id, depth + 1 FROM prereq_chain pc
  JOIN academy_modules am ON am.id = pc.prerequisite_module_id
  WHERE depth < 10
)
SELECT id FROM prereq_chain WHERE depth > 10;  -- Should return 0 rows
```

#### Slice Breakdown

- **2A (Days 1–4):** Track 1 seed (4 modules, 10 lessons, assessments)
- **2B (Days 5–7):** Tracks 2–3 seed (10 modules, 34 lessons)
- **2C (Days 8–10):** Tracks 4–6 seed (10 modules, 36 lessons)
- **2D (Days 11–14):** Competency mappings, validation, data QA

---

### PHASE 3: UX Overhaul (Weeks 5–8)

**Owner:** Frontend Agent
**Objective:** Redesign academy dashboard, module catalog, lesson viewer, and progress pages

#### 3A: Dashboard Redesign (Weeks 5–6)

**Components to Build:**
- `AcademyStreakBanner` — Animated flame icon, streak counter, level badge, XP display
- `AcademyMilestoneCard` — Milestone tracker (Complete 10 lessons → 20 → 50, etc.) with progress bar and confetti animation
- `AcademyContinueLearningHero` — Large CTA card showing next lesson with hero image, progress, and action buttons
- `AcademyWeeklySummary` — 3-card grid: This Week (lessons + time + XP), Recommended Next (AI-driven module suggestion), Quick Wins (sub-15-min modules)
- `AcademyAchievementGrid` — Unlocked and locked achievement badges

**Route:** `/members/academy` (replace existing dashboard)

**Data Dependencies:**
- Gamification APIs: `/api/academy/gamification/user/{userId}/stats`
- Progress API: Current lesson, completion status
- Achievement API: User achievements + progress

**Design Specs:**
- Hero section: Prominent, motivational, uses Emerald Elite + Champagne palette
- Cards: `glass-card-heavy` styling, 1.5px stroke borders
- Icons: Lucide (flame for streak, star for level, etc.)
- Animation: Confetti on milestone unlock, smooth transitions
- Mobile: Stack vertically; hero scales appropriately

**Validation Gates:**
```bash
pnpm exec eslint components/academy/academy-dashboard.tsx
pnpm exec tsc --noEmit
pnpm exec playwright test e2e/academy-dashboard.spec.ts --project=chromium --workers=1
pnpm exec axe-core components/academy/academy-dashboard.tsx
```

#### 3B: Module Catalog Redesign (Weeks 5–6)

**Components to Build:**
- `AcademyModuleCardV2` — Enhanced card with difficulty badge, time estimate, prerequisite chain, lock state
- `AcademyPrerequisiteChain` — Visual prerequisite flow with arrows
- `AcademyQuickWinFilter` — Shortcut to show modules < 30 min

**Route:** `/members/academy/modules` (replace existing catalog)

**Features:**
- Track grouping with collapsible headers
- Difficulty indicators: ⭐ Beginner, 🟢 Intermediate, 🔴 Advanced
- Time estimates with learner velocity: "~2 weeks for you based on your pace"
- Locked module cards with "Requires Module X" badge
- Search/filter bar

**Validation Gates:**
```bash
pnpm exec playwright test e2e/academy-catalog.spec.ts --project=chromium --workers=1
pnpm exec axe-core components/academy/module-catalog.tsx
```

#### 3C: Lesson Viewer Overhaul (Weeks 6–7)

**Route:** `/members/academy/lessons/[lessonId]` (replace existing viewer)

**Components to Build:**
- Lesson hero section with title, objectives, time estimate, XP reward
- Block progression indicator (●●○○○○○○○○○○ 2/12)
- Block type badge (shows "concept_explanation", "guided_practice", etc.)
- Interactive block renderer:
  - `Hook` → Scenario setup text (no interactivity)
  - `Concept Explanation` → Markdown + inline visualizations
  - `Worked Example` → Annotated chart walkthrough (click pause points)
  - `Guided Practice` → Fill-in-the-blank exercises
  - `Independent Practice` → Scenario simulator with slider
  - `Reflection` → Flashcard with confidence rating
- Block completion celebration (confetti, XP display)
- Navigation controls (Previous, Mark Complete & Continue, Skip)
- Miniature SPX chart in top-right corner (live, updates every 5s)

**Data Dependencies:**
- Lesson data API: blocks, competencies, estimated time
- SPX realtime chart: Supabase realtime subscriptions
- XP calculation on block completion

**Design Specs:**
- Hero image prominent at top (with gradient overlay)
- Blocks full-width, responsive text sizing
- Interactive widgets use Emerald Elite + Champagne
- Mobile: Stack vertically; charts collapse to numeric summary
- Accessibility: All interactive elements keyboard-navigable, ARIA labels

**Validation Gates:**
```bash
pnpm exec playwright test e2e/academy-lesson-viewer.spec.ts --project=chromium --workers=1
pnpm exec axe-core --include=".academy-lesson-viewer"
```

#### 3D: Progress & Reporting Views (Weeks 7–8)

**Route:** `/members/academy/progress` (new page)

**Components to Build:**
- `CompetencyRadarChart` — 6-axis radar (all core competencies) with current + 30-day history
- `StudyTimeWidget` — 7-day rolling line chart
- `VelocityCard` — Lessons/week trend
- `StreakTracker` — 90-day calendar heatmap
- `XPProgressCard` — Horizontal progress bar with level badge
- `CompletionPredictorCard` — Predicted completion date with confidence band

**Route:** `/members/academy/analytics` (new page for deeper analytics)

**Components:**
- `AssessmentTrendChart` — Scatter plot of scores over time
- `TimeEfficiencyChart` — Horizontal bar chart (time spent vs. cohort avg)
- `ReviewAccuracyChart` — Competency-wise accuracy %
- `TopMissedTopicsCard` — List of frequently-wrong assessment items

**Data Dependencies:**
- All dashboard metrics from `/api/academy/analytics/student/{userId}/dashboard`
- Deep-dive metrics from `/api/academy/analytics/student/{userId}/performance`

**Validation Gates:**
```bash
pnpm exec playwright test e2e/academy-progress.spec.ts --project=chromium --workers=1
```

#### Phase 3 Validation Summary

```bash
# Full UX validation
pnpm exec eslint components/academy --fix
pnpm exec tsc --noEmit
pnpm vitest run components/academy/__tests__
pnpm exec playwright test e2e/academy-*.spec.ts --project=chromium --workers=1
pnpm exec axe-core /members/academy
pnpm exec lighthouse https://localhost:3000/members/academy
```

---

### PHASE 4: Interactive Activities (Weeks 9–12)

**Owner:** Frontend Agent + Backend Agent
**Objective:** Build 12 new activity types with interactive components and scoring algorithms

#### 4A: Core Activities (Weeks 9–10)

**1. Options Chain Simulator**
- Component: `AcademyOptionsChainSimulator`
- Renders options chain table with call/put sides
- Tap to expand Greeks, inspect bid/ask spreads
- Multiple-choice questions below chain
- Scoring: Match answer to expectedAnswer, partial credit for close calls
- Mobile: Card layout (calls stacked above puts)

**2. Payoff Diagram Builder**
- Component: `AcademyPayoffBuilder`
- Drag-and-drop available legs onto canvas
- Real-time SVG payoff curve update
- Greeks summary panel (position delta, gamma, theta, vega)
- Assessment questions: max profit, breakeven, max loss
- Scoring: Position accuracy + assessment item accuracy

**3. Greeks Dashboard**
- Component: `AcademyGreekVisualizer`
- Horizontal slider to adjust underlying price (±5% range)
- Real-time Greeks surface update: Delta, Gamma, Vega, Theta
- Color-coded sensitivity (green for positive, amber for negative)
- Animated curves across strikes
- No explicit scoring; learning-by-exploration

**Data Requirements:**
- Options chain API integration: `/api/academy/activities/options-chain/{blockId}/content`
- Greeks calculation backend (via Massive.com API)
- Activity submission and scoring: `/api/academy/activities/{blockId}/submit`

**Validation Gates:**
```bash
pnpm exec playwright test e2e/academy-activity-chain-simulator.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/academy-activity-payoff-builder.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/academy-activity-greeks.spec.ts --project=chromium --workers=1
```

#### 4B: Mid-Tier Activities (Weeks 11–12)

**4. Trade Scenario Tree**
- Component: `AcademyTradeScenarioTree`
- Branching scenario: "You enter a call spread at 5800/5900. SPX moves to X. What do you do?"
- Decision branches with consequence explanations
- Scoring: Track optimal vs. suboptimal decisions

**5. Strategy Matcher**
- Component: `AcademyStrategyMatcher`
- Market condition: "Bull call spread territory?" → Match to appropriate strategy
- Multiple-choice with rationale explanations

**6. Position Builder**
- Component: `AcademyPositionBuilder`
- Build a position from available legs with constraints
- Validate position meets criteria (max/min capital, risk limits)
- Calculate final P&L at expiration

**Data Requirements:**
- Scenario trees and strategy definitions as JSON
- Activity submission API

**Validation Gates:**
```bash
pnpm exec playwright test e2e/academy-activity-scenario.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/academy-activity-strategy-matcher.spec.ts --project=chromium --workers=1
pnpm exec playwright test e2e/academy-activity-position-builder.spec.ts --project=chromium --workers=1
```

#### Phase 4 Validation Summary

```bash
# Activity component linting
pnpm exec eslint components/academy/activities --fix

# Activity scoring algorithm tests
pnpm vitest run lib/academy/activity-scoring/__tests__

# Full activity workflow E2E
pnpm exec playwright test e2e/academy-activity-*.spec.ts --project=chromium --workers=1

# Bundle size check (new components shouldn't exceed 50KB gzipped)
pnpm analyze
```

---

### PHASE 5: Reporting & Analytics (Weeks 13–14)

**Owner:** Backend Agent + Frontend Agent
**Objective:** Deploy nightly aggregation edge functions and build student analytics dashboards

#### 5A: Backend Aggregation (Weeks 13)

**Edge Functions to Deploy:**

**`aggregate-daily-lesson-analytics`** (runs 1 AM UTC)
- Aggregates `academy_learning_events` by lesson
- Calculates: avg_time_minutes, median_time, p25/p75, completion_count, started_count
- Populates: `academy_lesson_analytics_daily`

**`aggregate-user-competency-history`** (runs every assessment completion)
- Recalculates user competency scores from recent assessments
- Takes snapshot: (user_id, competency_id, score, timestamp)
- Stores in: `academy_user_competency_mastery_history`

**`generate-ai-competency-narrative`** (on-demand, cached 24h)
- Call OpenAI API with user's competency profile
- Generate encouraging narrative about strengths/growth
- Cache result in `academy_user_narratives`

#### 5B: Student Dashboards (Weeks 13–14)

**Deep-Dive Competency Page** `/members/academy/competencies/[competencyKey]`
- Competency trend chart (90-day history)
- Linked lessons table (status, completion %, time spent, assessment score)
- Remediation recommendations (top 3 lessons to revisit)
- AI-generated narrative about strengths and growth

**Performance Analytics Page** `/members/academy/analytics`
- Assessment score trends (scatter + 7-day MA line)
- Time spent per lesson vs. cohort average (horizontal bar chart)
- Review queue accuracy by competency
- Top-missed and top-performed topics

**Data Dependencies:**
- All aggregation tables fully populated
- AI narrative API ready
- Competency mastery data real-time updated

**Validation Gates:**
```bash
# Edge function deployment
npx supabase functions deploy aggregate-daily-lesson-analytics
npx supabase functions deploy aggregate-user-competency-history

# Analytics page E2E
pnpm exec playwright test e2e/academy-analytics.spec.ts --project=chromium --workers=1

# Performance: dashboard should load in < 2s (p95)
pnpm exec lighthouse https://localhost:3000/members/academy/progress --throttling-method=simulate
```

---

### PHASE 6: AI Image Generation & Media Pipeline (Weeks 15–16)

**Owner:** Media Agent (external or internal tooling)
**Objective:** Generate all 400+ media assets using DALL-E 3 + post-processing + Supabase Storage + CDN

#### 6A: Lesson Hero Images (150+ images)

**Workflow:**
1. Generate deterministic DALL-E 3 prompts from lesson data (see Media Strategy Section 2.3)
2. Batch API calls to DALL-E (10–20 at a time, ~$7.50 total)
3. Post-process each image:
   - Color grading (emerald cast, saturation reduction, contrast boost)
   - Texture overlay (noise, grid subtly)
   - Optimization (WebP 85%, responsive variants: 640×360, 960×540, 1280×720)
4. Upload to Supabase Storage: `academy-media/lessons/{track}/{module}/{lesson}-hero.webp`
5. Generate LQIP blur placeholders for lazy loading

**Cost Estimate:** ~$7.50 (DALL-E) + $150–300 (post-processing outsource or tooling)

#### 6B: Module Cover Images (30+ images)

**Workflow:** Same as 6A, but higher resolution (1440×800) and more dramatic composition

**Cost Estimate:** ~$1.50 (DALL-E) + $30–60 (post-processing)

#### 6C: Track Cover Images (6 images)

**Workflow:** Ultra-high resolution (2560×1440), specialized prompts per track (Beginner → Intermediate → Advanced → etc.)

**Cost Estimate:** ~$0.30 (DALL-E) + $60–120 (post-processing)

#### 6D: Inline Illustrations (200+ SVG/PNG)

**Workflow:**
- Options chain screenshots: 40 images (styled SVG mockups)
- Payoff diagrams: 30 SVG (publication-quality, Greek-precision)
- Greeks visualizations: 40 SVG/Canvas (Delta, Gamma, Vega surfaces)
- Chart annotations: 30 SVG (support/resistance, candlestick analysis)
- Platform mockups: 20 SVG/PNG (TradeITM UI, Bloomberg Terminal, ThinkorSwim)
- Strategy comparisons: 20 SVG (side-by-side payoff comparisons)

**Cost:** Free (internal SVG design) + time investment

#### 6E: Achievement Badges (30+ SVG)

**Workflow:**
- Design SVG badge templates with emerald/champagne colors
- 128×128px primary, 64×64px variants for display in lists
- Store in Supabase Storage: `academy-media/badges/{badge-key}.svg`

**Cost:** Free (internal)

#### 6F: Supabase Storage & CDN Setup

**Configuration:**
- Storage bucket: `academy-media`
- Public access: Read-only for lesson heroes, badges, illustrations
- CloudFront CDN: Cache TTL = 1 year for versioned assets (include content hash in URL)
- Responsive image hosting: Use srcSet with responsive variants

**Cost:** ~$5–10/month (Supabase storage) + $20–40/month (CloudFront egress, ~500K requests/month)

#### Validation Gates

```bash
# Verify all images uploaded and accessible
for track in basics intermediate advanced; do
  curl -s https://academy-media.cdn.itm.io/lessons/$track/test.webp | wc -c
done

# Check responsive variants exist
for size in 640 960 1280; do
  curl -s https://academy-media.cdn.itm.io/lessons/basics/module-cover-${size}.webp | wc -c
done

# Verify LQIP blur placeholders available
curl -s https://academy-media.cdn.itm.io/lessons/basics/lqip.json | jq length
```

---

### PHASE 7: QA, A11y, Performance (Weeks 17–18)

**Owner:** QA Agent
**Objective:** Comprehensive testing, accessibility audit, performance optimization, and production readiness

#### 7A: E2E Test Coverage (Week 17)

**Test Scenarios:**

**Dashboard & Navigation:**
- Dashboard loads, streak/XP/milestone display correctly
- Click "Continue Learning" → resumes correct lesson
- Click "Browse Modules" → navigates to catalog
- Module card displays difficulty, time, prerequisites
- Click locked module → shows "Requires Module X" tooltip
- Click module → navigates to first lesson

**Lesson Viewer:**
- Lesson loads with hero image, title, objectives
- Block completion updates progress indicator
- Click "Mark Complete & Continue" → confetti animation, XP display
- Swipe left (mobile) → next block
- Click "View Progress" → navigates to progress page

**Activities:**
- Options Chain Simulator renders table, answer questions, submit and see feedback
- Payoff Diagram Builder drag-drop legs, payoff curve updates, submit questions
- Greeks Dashboard slider adjusts price, Greeks values update
- Trade Scenario Tree: follow branches, see consequences

**Reporting:**
- Progress page loads all widgets (study time, velocity, competency radar, streak tracker, XP, completion date)
- Competency deep-dive page shows trend chart, linked lessons, remediation
- Analytics page shows assessment trends, time efficiency, review accuracy

**Gamification:**
- Streak increments on daily learning
- XP accumulates on block completion, assessment pass, review correct
- Milestone milestones unlock with confetti
- Achievements unlock and display in grid

**Commands:**
```bash
pnpm exec playwright test e2e/academy-*.spec.ts --project=chromium --workers=1
```

#### 7B: Accessibility Audit (Week 17)

**Tools:** axe-core/playwright, manual WCAG AA spot-checks

**Checks:**
- Keyboard navigation: All interactive elements reachable via Tab, Enter/Space triggers action
- Screen reader: Streak counter announced as "12 day streak", milestone progress bar has `aria-valuenow`, difficulty badges announced
- Color contrast: All text meets WCAG AA (4.5:1 for body, 3:1 for large)
- Animations: All animations respect `prefers-reduced-motion`
- Images: All hero images have descriptive alt text (e.g., "Options trader analyzing Greeks on dark dashboard")
- Forms: All form inputs labeled, error messages announced

**Commands:**
```bash
pnpm exec axe-core /members/academy --include="interactive"
pnpm exec axe-core /members/academy/modules
pnpm exec axe-core /members/academy/lessons/{lessonId}
pnpm exec axe-core /members/academy/progress
```

#### 7C: Performance Audit (Week 17–18)

**Lighthouse Targets:**
- Academy Dashboard: >= 90 (Lighthouse score)
- Module Catalog: >= 85 (many images, list rendering)
- Lesson Viewer: >= 85 (large hero image, interactive widgets)
- Progress Page: >= 90 (charts should be responsive)

**Optimizations:**
- Image lazy-loading (hero only preload for current lesson, prefetch next)
- Component code-splitting (activity components loaded only when lesson contains that block type)
- Chart re-rendering optimization (Recharts memoization)
- API response caching (1-hour cache for lesson data, analytics)

**Commands:**
```bash
pnpm exec lighthouse https://localhost:3000/members/academy --throttling-method=simulate --output=html --output-path=./lighthouse-academy.html
pnpm exec lighthouse https://localhost:3000/members/academy/modules --throttling-method=simulate
pnpm exec lighthouse https://localhost:3000/members/academy/lessons/[lessonId] --throttling-method=simulate
```

#### 7D: Content Accuracy Spot-Checks (Week 18)

**QA Checklist:**
- Curriculum plan matches seeded data (80 lessons, 24 modules, 6 tracks)
- Lesson hero image descriptions accurate (e.g., "delta-neutral option spreads" for correct lesson)
- Activity questions and answers match learning objectives
- Assessment items aligned with competencies
- Prerequisite chains logically sound (no circular, no skipped levels)
- Estimated times realistic (Track 1 should be 12–15 hours, not 50)

#### Phase 7 Validation Summary

```bash
# Full validation suite
pnpm exec eslint . --fix
pnpm exec tsc --noEmit
pnpm run build  # Production build must succeed
pnpm vitest run  # All unit tests
pnpm exec playwright test e2e/academy-*.spec.ts --project=chromium --workers=1  # All E2E
pnpm exec axe-core /members/academy  # Accessibility
pnpm exec lighthouse https://localhost:3000/members/academy  # Performance
```

---

## AGENT ASSIGNMENT MATRIX

| Phase | Slice | Primary Agent | Secondary Agent | Files Owned | Duration | Dependencies |
|-------|-------|---------------|-----------------|-------------|----------|--------------|
| 1 | 1A | Database | Backend | `supabase/migrations/*` | 3 days | None |
| 1 | 1B | Database | Backend | `supabase/migrations/*` | 3 days | 1A |
| 1 | 1C | Backend | Database | `backend/src/routes/*`, `backend/src/services/*` | 4 days | 1A, 1B |
| 1 | 1D | QA | Backend | `backend/__tests__/*` | 4 days | 1C |
| 2 | 2A | Database | — | `scripts/seed-academy-curriculum.sql` | 4 days | 1D |
| 2 | 2B | Database | — | `scripts/seed-academy-curriculum.sql` | 3 days | 2A |
| 2 | 2C | Database | — | `scripts/seed-academy-curriculum.sql` | 3 days | 2B |
| 2 | 2D | Database | QA | `scripts/validate-curriculum-integrity.sql` | 4 days | 2C |
| 3 | 3A | Frontend | Backend | `components/academy/dashboard/*`, `app/members/academy/page.tsx` | 5 days | 1D, 2D |
| 3 | 3B | Frontend | Backend | `components/academy/catalog/*`, `app/members/academy/modules/*` | 5 days | 1D, 2D |
| 3 | 3C | Frontend | Backend | `components/academy/lesson-viewer/*`, `app/members/academy/lessons/*` | 6 days | 1D, 2D |
| 3 | 3D | Frontend | Backend | `components/academy/progress/*`, `app/members/academy/progress/*` | 5 days | 1D, 2D |
| 4 | 4A | Frontend | Backend | `components/academy/activities/simulator/*`, `components/academy/activities/payoff/*`, `components/academy/activities/greeks/*` | 6 days | 3C |
| 4 | 4B | Frontend | Backend | `components/academy/activities/scenario/*`, `components/academy/activities/matcher/*`, `components/academy/activities/position/*` | 6 days | 4A |
| 5 | 5A | Backend | — | `supabase/functions/aggregate-*`, `backend/src/services/aggregation/*` | 5 days | 1D, 2D |
| 5 | 5B | Frontend | Backend | `components/academy/deep-dive/*`, `app/members/academy/competencies/*`, `app/members/academy/analytics/*` | 5 days | 5A |
| 6 | 6A–6F | Media | — | `scripts/generate-media.py`, Supabase Storage config | 10 days | 2D |
| 7 | 7A–7D | QA | Frontend, Backend | `e2e/academy-*.spec.ts`, accessibility reports | 10 days | 6F |

---

## ACCEPTANCE CRITERIA

### Phase 1: Infrastructure
- [ ] All gamification, reporting, activity tables created with RLS policies
- [ ] All enum extensions added to `academy_block_type`
- [ ] 9 new API endpoints deployed and responding correctly
- [ ] TypeScript strict mode: zero errors
- [ ] Get_advisors(security, performance): zero critical findings

### Phase 2: Curriculum
- [ ] 6 tracks, 24 modules, 80 lessons, 480+ blocks seeded into production database
- [ ] All lessons linked to ≥1 competency with weight values
- [ ] No circular prerequisite dependencies
- [ ] Lesson estimated times realistic (total curriculum ~120–130 hours)
- [ ] 30 achievement definitions seeded

### Phase 3: UX
- [ ] Dashboard loads with streak, XP, milestone, continue learning, weekly summary, achievements
- [ ] Module catalog displays difficulty, time estimates, prerequisites, lock states
- [ ] Lesson viewer renders hero, blocks, interactive widgets, progress indicator
- [ ] Progress page displays all analytics widgets (study time, velocity, competency radar, streaks, XP, completion date)
- [ ] All pages meet Lighthouse >= 90 (dashboard), >= 85 (catalog, lesson viewer, progress)
- [ ] Accessibility: axe-core zero critical violations

### Phase 4: Activities
- [ ] Options Chain Simulator: renders chain table, answer questions, calculate scores
- [ ] Payoff Diagram Builder: drag-drop legs, real-time payoff update, Greeks summary, assessment
- [ ] Greeks Dashboard: slider adjusts price, Greeks values update in real-time
- [ ] Trade Scenario Tree, Strategy Matcher, Position Builder: all interactive, scoring works
- [ ] Activity submission endpoint stores scores and updates competency mastery

### Phase 5: Reporting
- [ ] Nightly aggregation edge functions run and populate analytics tables
- [ ] Competency deep-dive page displays trend chart, linked lessons, remediation, AI narrative
- [ ] Performance analytics page shows assessment trends, time efficiency, review accuracy
- [ ] Dashboard load time < 2s (p95)

### Phase 6: Media
- [ ] 150 lesson heroes generated, uploaded to Supabase Storage, responsive variants created
- [ ] 30 module covers generated and uploaded
- [ ] 6 track covers generated and uploaded
- [ ] 200 inline illustrations (SVG/PNG) created for activities
- [ ] 30 achievement badges (SVG) created
- [ ] CDN configured and serving images with < 100ms latency
- [ ] All images have descriptive alt text and WCAG AA contrast ratio

### Phase 7: QA
- [ ] E2E test suite covers all major flows (dashboard, catalog, lesson, activity, reporting)
- [ ] Accessibility audit: zero axe-core violations, keyboard navigation works, screen reader friendly
- [ ] Performance: Lighthouse >= 90 on all pages
- [ ] Content accuracy spot-checks pass (curriculum matches seed data, images match lessons)
- [ ] Production build succeeds with Node >= 22

---

## RISK REGISTER

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status |
|----|------|-----------|--------|-----------|-------|--------|
| R1 | Curriculum seeding has data quality issues (broken prerequisites, misaligned competencies) | High | High | Comprehensive validation SQL scripts in Phase 2D; QA spot-checks | Database Agent | Pending |
| R2 | DALL-E image generation quality inconsistent (off-brand colors, wrong composition) | Medium | Medium | Use deterministic prompt templates; post-process with color grading; iterate on first 10 images | Media Agent | Pending |
| R3 | Activity components too slow on mobile (heavy payoff diagram rendering) | Medium | Medium | Lazy-load activity components; use Canvas instead of SVG for complex charts; profile bundle size | Frontend Agent | Pending |
| R4 | XP and streak calculations have race conditions under concurrent events | Low | High | Use Postgres atomic transactions and triggers; test with concurrent load | Backend Agent | Pending |
| R5 | Aggregation edge functions fail to run nightly, breaking analytics | Medium | Medium | Monitor edge function logs; add alerting on function failure; manual backfill script | Backend Agent | Pending |
| R6 | UX redesign breaks existing user workflows (e.g., resume lesson flow) | Medium | High | Maintain backward compatibility for resume API; test with real user data pre-launch | Frontend Agent | Pending |
| R7 | Reporting page queries timeout due to large dataset | Low | High | Pre-aggregate data in nightly job; add query indexes on (user_id, competency_id, evaluated_at) | Database Agent | Pending |
| R8 | Media pipeline incomplete (images generated but not all uploaded) | Low | Medium | Use batch upload script with retry logic; verify all images in Supabase Storage | Media Agent | Pending |
| R9 | Accessibility violations missed during QA (axe-core doesn't catch all issues) | Low | Medium | Manual WCAG AA spot-checks on critical flows; screen reader testing with NVDA/JAWS | QA Agent | Pending |
| R10 | Phase timeline slippage due to blocking dependencies (e.g., API endpoints not ready before Frontend starts) | Medium | High | Overlap phases where possible (e.g., Frontend can build components in parallel while Backend builds endpoints); use stubs/mocks | Orchestrator | Pending |

---

## RELEASE GATES

### Phase 1 Gate (End of Week 2)
```bash
# Schema validation
get_advisors(type: "security")
get_advisors(type: "performance")

# API endpoint validation
curl -s http://localhost:3001/api/academy/gamification/user/test-user/stats | jq '.'
curl -s http://localhost:3001/api/academy/activities/test-block/content | jq '.'

# TypeScript strict
pnpm exec tsc --noEmit
```
**Go/No-Go:** All endpoints respond correctly, zero TypeScript errors, zero security/performance advisories

### Phase 2 Gate (End of Week 4)
```bash
# Curriculum integrity
psql -d supabase_db -f scripts/validate-curriculum-integrity.sql

# Competency coverage
SELECT COUNT(*) FROM academy_lessons WHERE id NOT IN (
  SELECT DISTINCT lesson_id FROM academy_lesson_competencies
);  -- Should be 0

# Row count verification
SELECT COUNT(*) FROM academy_lessons;  -- Should be 80
```
**Go/No-Go:** All validation queries pass, 80 lessons exist, all linked to competencies

### Phase 3 Gate (End of Week 8)
```bash
# Component linting
pnpm exec eslint components/academy --fix
pnpm exec tsc --noEmit

# Dashboard E2E
pnpm exec playwright test e2e/academy-dashboard.spec.ts --project=chromium --workers=1

# Accessibility
pnpm exec axe-core /members/academy

# Performance
pnpm exec lighthouse https://localhost:3000/members/academy --throttling-method=simulate
```
**Go/No-Go:** All components lint cleanly, E2E tests pass, axe-core zero critical violations, Lighthouse >= 90

### Phase 4 Gate (End of Week 12)
```bash
# Activity component tests
pnpm vitest run components/academy/activities

# Activity E2E tests
pnpm exec playwright test e2e/academy-activity-*.spec.ts --project=chromium --workers=1

# Scoring algorithm correctness
pnpm vitest run lib/academy/activity-scoring
```
**Go/No-Go:** All activity E2E tests pass, scoring algorithms validated

### Phase 5 Gate (End of Week 14)
```bash
# Aggregation edge functions deployed
npx supabase functions list | grep "aggregate-"

# Analytics page E2E
pnpm exec playwright test e2e/academy-analytics.spec.ts --project=chromium --workers=1

# Performance
pnpm exec lighthouse https://localhost:3000/members/academy/progress --throttling-method=simulate
```
**Go/No-Go:** Edge functions deployed, analytics page loads in < 2s (p95)

### Phase 6 Gate (End of Week 16)
```bash
# Verify all images in Supabase Storage
aws s3 ls s3://academy-media/lessons/ --recursive | wc -l  # Should be ~450 (150 × 3 variants each)

# Test CDN access
curl -I https://academy-media.cdn.itm.io/lessons/basics/module-cover.webp

# Verify alt text and metadata
curl -s https://academy-media.cdn.itm.io/lessons/basics/metadata.json | jq '.lessons | length'
```
**Go/No-Go:** All ~450 images uploaded, CDN responding, metadata complete

### Final Release Gate (End of Week 18)
```bash
# Full test suite
pnpm exec tsc --noEmit
pnpm run build  # Production build
pnpm exec eslint .
pnpm vitest run
pnpm exec playwright test e2e/academy-*.spec.ts --project=chromium --workers=1

# Accessibility + Performance
pnpm exec axe-core /members/academy
pnpm exec lighthouse https://localhost:3000/members/academy

# Production readiness
node --version  # Should be >= 22
npx supabase functions list  # All deployed
```
**Go/No-Go:** Build succeeds, all tests pass, axe-core zero violations, Lighthouse >= 90, production deploy approved

---

## DEPENDENCIES & EXTERNAL SERVICES

| Service | Purpose | Env Var | Status | Cost |
|---------|---------|---------|--------|------|
| **Massive.com** | Options Greeks calculation for activities | `MASSIVE_API_KEY` | Existing | $100–500/month |
| **DALL-E 3** | Image generation for heroes, covers, badges | `OPENAI_API_KEY` | Existing | ~$10 (one-time for full curriculum) |
| **Supabase** | Database, realtime, storage, edge functions | `SUPABASE_SERVICE_ROLE_KEY` | Existing | $25–100/month (included) |
| **OpenAI (Chat API)** | AI-generated competency narratives | `OPENAI_API_KEY` | Existing | ~$5–20/month (low usage) |
| **CloudFront CDN** | Media delivery (academy-media.cdn.itm.io) | AWS credentials | New | $20–40/month |

---

## SUCCESS METRICS (Post-Launch)

### User Engagement
- Streak completion rate: > 70% of active users maintain a daily streak
- XP accumulation: Average 50+ XP per session
- Module completion rate: > 60% of users complete at least 1 full module

### Learning Outcomes
- Competency mastery improvement: Users in Track 1 improve market_context score by >= 20% over first 4 weeks
- Assessment pass rate: > 75% of assessments passed on first attempt
- Review accuracy: > 70% accuracy on spaced-repetition reviews

### Product Performance
- Dashboard load time: < 1.5s (p95)
- Lesson viewer: < 2s (p95)
- Activity submission response: < 500ms (p95)
- Accessibility: axe-core zero violations
- Lighthouse score: >= 90 on all academy pages

### Business Metrics
- Student retention: 60% of enrolled users active after 30 days
- Course completion: 40% of enrolled users complete Track 1 within 8 weeks
- NPS (Net Promoter Score): >= 50 from academy users

---

## TIMELINE SUMMARY

| Phase | Duration | Start | End | Deliverable |
|-------|----------|-------|-----|-------------|
| 1 | 2 weeks | W1 | W2 | Database schema, API endpoints |
| 2 | 2 weeks | W3 | W4 | Curriculum seed data (80 lessons) |
| 3 | 4 weeks | W5 | W8 | UX redesign (dashboard, catalog, viewer, progress) |
| 4 | 4 weeks | W9 | W12 | Interactive activities (12 types, prioritized) |
| 5 | 2 weeks | W13 | W14 | Analytics aggregation, deep-dive dashboards |
| 6 | 2 weeks | W15 | W16 | Media generation (400+ assets) |
| 7 | 2 weeks | W17 | W18 | QA, A11y, performance testing, launch |
| **Total** | **18 weeks** | — | — | **Production-ready academy** |

---

## CHANGE CONTROL

**PR Naming Convention:** `academy-overhaul/phase-{N}-slice-{X}-{description}`

Examples:
- `academy-overhaul/phase-1-slice-a-gamification-tables`
- `academy-overhaul/phase-3-slice-c-lesson-viewer-interactive-blocks`
- `academy-overhaul/phase-6-slice-a-lesson-hero-generation`

**Required Reviewers per Phase:**
- Phase 1–2 (Database): Database Agent + Orchestrator
- Phase 3–4 (Frontend): Frontend Agent + QA Agent
- Phase 5–7: All domain agents + Orchestrator

**Merge Strategy:** Squash (single commit per slice for clean history)

**Rollback:** In case of production issue:
- If issue in Phase 3+ UX: Revert to previous main (kill switch feature flag if available)
- If issue in Phase 5+ Analytics: Disable edge function, roll back aggregation tables
- If issue in Phase 6 Media: Serve fallback placeholder images from CDN

---

## CLOSURE CRITERIA

A workstream is complete only when:

1. ✓ Execution spec checklist (this document) is fully reviewed and approved
2. ✓ All phase slices implemented and passing validation gates
3. ✓ Release notes + runbook updated and current
4. ✓ Change control + risk/decision log + tracker fully populated
5. ✓ Production deploy approved (final release gate passed)
6. ✓ Success metrics baselined post-launch

---

**Document Prepared By:** Orchestrator (Claude Code)
**Date:** 2026-02-24
**Next Review:** Weekly during Phase 1–4, bi-weekly during Phase 5–7
