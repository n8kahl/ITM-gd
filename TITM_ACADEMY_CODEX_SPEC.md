# TITM Academy 2.0 — Codex Autonomous Execution Spec

**Version:** 1.0
**Date:** February 10, 2026
**Scope:** Complete refactor, build, content generation, testing, documentation, and deployment
**Execution Mode:** Fully autonomous — no human intervention required between phases

---

## EXECUTION RULES

1. Execute phases in strict numerical order. Do NOT proceed to Phase N+1 until Phase N passes all verification checks.
2. Every database migration must be idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
3. Every new file must include the standard file header comment with creation date and purpose.
4. Every modified file must preserve existing functionality unless explicitly marked for removal.
5. Run `pnpm lint` after every phase. Fix all errors before proceeding.
6. Run `pnpm playwright test` after Phases 3, 5, 6, and 8. All existing tests must continue passing.
7. All new components must follow the project conventions in `CLAUDE.md` and `docs/BRAND_GUIDELINES.md`.
8. Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase, Playwright.
9. Icons: Lucide React. Fonts: Inter (body), Playfair Display (headings), Geist Mono (data).
10. Colors: Emerald `#10B981`, Champagne `#F3E5AB`, Onyx `#0A0A0B`. NEVER use `#D4AF37`.

---

## PHASE 0: PRE-FLIGHT VALIDATION

**Purpose:** Verify the environment is ready for autonomous execution.

### 0.1 Check file system structure

```bash
# Verify critical directories exist
test -d app/members/academy && echo "PASS: academy routes exist"
test -d components/academy && echo "PASS: academy components exist"
test -d lib/academy && echo "PASS: academy lib exists"
test -d supabase/migrations && echo "PASS: migrations dir exists"
test -d e2e/specs/members && echo "PASS: e2e specs exist"
test -d docs && echo "PASS: docs dir exists"
```

### 0.2 Check database schema exists

Run this SQL query against Supabase. If any table is missing, STOP and report.

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'courses', 'lessons', 'learning_paths', 'learning_path_courses',
  'user_learning_profiles', 'user_lesson_progress', 'user_course_progress',
  'user_achievements', 'user_xp', 'user_learning_activity_log',
  'achievement_tiers', 'pricing_tiers'
)
ORDER BY table_name;
```

**Expected:** All 12 tables present. If `pricing_tiers` is missing, the academy training system migration has not been applied.

### 0.3 Check existing enum types

```sql
SELECT typname FROM pg_type
WHERE typname IN ('difficulty_level', 'lesson_type', 'progress_status', 'achievement_type', 'activity_log_type');
```

**Expected:** All 5 enums present.

### 0.4 Check installed dependencies

```bash
pnpm list react-markdown remark-gfm framer-motion recharts lucide-react @supabase/supabase-js
```

**Required packages that may need installing:**

```bash
# Only install if missing from the check above
pnpm add d3 @types/d3    # For mastery arc radar chart
```

### 0.5 Verify build passes

```bash
pnpm build
```

**Gate:** Build must exit 0. If it fails, fix existing build errors first before proceeding.

---

## PHASE 1: DATABASE MIGRATIONS

**Purpose:** Extend the schema for review queue, saved items, lesson chunks, competency mapping, and intelligence layer.

### Migration File: `supabase/migrations/YYYYMMDD000000_academy_v2_schema.sql`

Use the next available timestamp after `20260312010000`. Suggested: `20260313000000`.

**Create file:** `supabase/migrations/20260313000000_academy_v2_schema.sql`

```sql
-- TITM Academy V2 Schema Extension
-- Adds: review_queue, saved_items, lesson_chunks, competency_map, intelligence layer tables
-- All operations are idempotent

-- ============================================================================
-- 1. NEW ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE competency_key AS ENUM (
    'market_context', 'entry_validation', 'position_sizing',
    'trade_management', 'exit_discipline', 'review_reflection'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE mastery_stage AS ENUM ('awareness', 'applied', 'independent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE chunk_content_type AS ENUM (
    'video', 'rich_text', 'interactive', 'annotated_chart',
    'scenario_walkthrough', 'quick_check', 'applied_drill', 'reflection'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('due', 'completed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'chunk' to lesson_type if not already present
DO $$ BEGIN
  ALTER TYPE lesson_type ADD VALUE IF NOT EXISTS 'chunk';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'review_complete' and 'bookmark' to activity_log_type
DO $$ BEGIN
  ALTER TYPE activity_log_type ADD VALUE IF NOT EXISTS 'review_complete';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE activity_log_type ADD VALUE IF NOT EXISTS 'bookmark';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. ALTER EXISTING TABLES
-- ============================================================================

-- Extend lessons table for chunk-based content
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS chunk_data jsonb;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS competency_keys competency_key[] DEFAULT '{}';
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS micro_lesson_extract jsonb;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS adaptive_variants jsonb DEFAULT '{}';

-- Extend courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS competency_map jsonb DEFAULT '{}';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS common_mistakes jsonb DEFAULT '[]';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS social_proof_count int DEFAULT 0;

-- ============================================================================
-- 3. NEW TABLES: REVIEW QUEUE SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS review_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_key competency_key NOT NULL,
  source_lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  source_course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  question_data jsonb NOT NULL,
  due_at timestamptz NOT NULL DEFAULT now(),
  interval_stage int DEFAULT 0, -- 0=24h, 1=72h, 2=7d, 3=14d, 4=30d
  status review_status DEFAULT 'due',
  difficulty_rating numeric DEFAULT 5.0, -- FSRS difficulty 1-10
  stability_days numeric DEFAULT 1.0, -- FSRS stability
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid NOT NULL REFERENCES review_queue_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_data jsonb NOT NULL,
  is_correct boolean NOT NULL,
  confidence_rating int, -- 1-5 self-rated
  latency_ms int,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 4. NEW TABLES: SAVED / BOOKMARKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('course', 'lesson')),
  entity_id uuid NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- ============================================================================
-- 5. NEW TABLES: COMPETENCY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_competency_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competency_key competency_key NOT NULL,
  mastery_stage mastery_stage DEFAULT 'awareness',
  score numeric DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  assessments_count int DEFAULT 0,
  last_assessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, competency_key)
);

-- ============================================================================
-- 6. NEW TABLES: AI INTELLIGENCE LAYER
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_learning_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type text NOT NULL, -- 'journal_gap', 'quiz_weakness', 'streak_risk', 'recommended_lesson'
  insight_data jsonb NOT NULL,
  source_entity_id uuid,
  source_entity_type text,
  is_dismissed boolean DEFAULT false,
  is_acted_on boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- ============================================================================
-- 7. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_review_queue_user_due ON review_queue_items(user_id, due_at) WHERE status = 'due';
CREATE INDEX IF NOT EXISTS idx_review_queue_competency ON review_queue_items(competency_key);
CREATE INDEX IF NOT EXISTS idx_review_attempts_item ON review_attempts(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_user ON user_saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_entity ON user_saved_items(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_competency_scores_user ON user_competency_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_insights_user ON user_learning_insights(user_id, is_dismissed) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_learning_insights_expires ON user_learning_insights(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

ALTER TABLE review_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_competency_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_insights ENABLE ROW LEVEL SECURITY;

-- review_queue_items
CREATE POLICY "Users read own review items" ON review_queue_items FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role all review items" ON review_queue_items FOR ALL USING (auth.role() = 'service_role');

-- review_attempts
CREATE POLICY "Users read own review attempts" ON review_attempts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own review attempts" ON review_attempts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service role all review attempts" ON review_attempts FOR ALL USING (auth.role() = 'service_role');

-- user_saved_items
CREATE POLICY "Users manage own saved items" ON user_saved_items FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Service role all saved items" ON user_saved_items FOR ALL USING (auth.role() = 'service_role');

-- user_competency_scores
CREATE POLICY "Users read own competency scores" ON user_competency_scores FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role all competency scores" ON user_competency_scores FOR ALL USING (auth.role() = 'service_role');

-- user_learning_insights
CREATE POLICY "Users read own insights" ON user_learning_insights FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own insights" ON user_learning_insights FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Service role all insights" ON user_learning_insights FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 9. FUNCTIONS
-- ============================================================================

-- FSRS-based interval calculation
CREATE OR REPLACE FUNCTION calculate_next_review_interval(
  p_difficulty numeric,
  p_stability numeric,
  p_is_correct boolean,
  p_confidence int
) RETURNS TABLE(next_due_at timestamptz, new_difficulty numeric, new_stability numeric) AS $$
DECLARE
  v_difficulty numeric;
  v_stability numeric;
  v_interval numeric;
BEGIN
  IF p_is_correct THEN
    v_difficulty := GREATEST(1, p_difficulty - 0.5 * (p_confidence - 3));
    v_stability := p_stability * (1 + 0.5 * (11 - v_difficulty) / 10);
    v_interval := v_stability;
  ELSE
    v_difficulty := LEAST(10, p_difficulty + 1);
    v_stability := GREATEST(0.5, p_stability * 0.5);
    v_interval := 1; -- Review again tomorrow
  END IF;

  next_due_at := now() + (v_interval || ' days')::interval;
  new_difficulty := v_difficulty;
  new_stability := v_stability;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Seed review items when a lesson is completed
CREATE OR REPLACE FUNCTION seed_review_items_for_lesson(
  p_user_id uuid,
  p_lesson_id uuid
) RETURNS void AS $$
DECLARE
  v_lesson RECORD;
  v_competency competency_key;
  v_quiz_data jsonb;
BEGIN
  SELECT * INTO v_lesson FROM lessons WHERE id = p_lesson_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Seed review items from quiz_data for each competency the lesson covers
  IF v_lesson.competency_keys IS NOT NULL THEN
    FOREACH v_competency IN ARRAY v_lesson.competency_keys LOOP
      -- Create a review item due in 24h
      IF v_lesson.quiz_data IS NOT NULL AND jsonb_array_length(v_lesson.quiz_data) > 0 THEN
        INSERT INTO review_queue_items (user_id, competency_key, source_lesson_id, source_course_id, question_data, due_at)
        SELECT
          p_user_id,
          v_competency,
          p_lesson_id,
          v_lesson.course_id,
          q.value,
          now() + interval '24 hours'
        FROM jsonb_array_elements(v_lesson.quiz_data) WITH ORDINALITY AS q(value, idx)
        WHERE q.idx <= 3 -- Max 3 review items per lesson per competency
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS tr_review_queue_updated_at ON review_queue_items;
CREATE TRIGGER tr_review_queue_updated_at BEFORE UPDATE ON review_queue_items
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS tr_competency_scores_updated_at ON user_competency_scores;
CREATE TRIGGER tr_competency_scores_updated_at BEFORE UPDATE ON user_competency_scores
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

### Phase 1 Verification

```sql
-- Verify all new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'review_queue_items', 'review_attempts', 'user_saved_items',
  'user_competency_scores', 'user_learning_insights'
);
-- Expected: 5 rows

-- Verify new columns on lessons
SELECT column_name FROM information_schema.columns
WHERE table_name = 'lessons' AND column_name IN ('chunk_data', 'competency_keys', 'micro_lesson_extract');
-- Expected: 3 rows

-- Verify new enums
SELECT typname FROM pg_type WHERE typname IN ('competency_key', 'mastery_stage', 'chunk_content_type', 'review_status');
-- Expected: 4 rows

-- Verify FSRS function exists
SELECT proname FROM pg_proc WHERE proname = 'calculate_next_review_interval';
-- Expected: 1 row
```

---

## PHASE 2: NAVIGATION FIX AND DEAD CODE REMOVAL

**Purpose:** Fix the broken navigation model, remove placeholder pages, consolidate resume logic.

### 2.1 Fix Global Nav Active State

**File:** `components/members/mobile-bottom-nav.tsx`

**Change:** Update the active-state detection logic to recognize `/members/academy/*` paths as "Library" active.

Find the `isActive` check (likely `pathname === href || pathname.startsWith(href + '/')`) and extend it:

```typescript
// Add this helper or modify existing active-state logic
const isLibraryActive = (pathname: string, href: string) => {
  if (href === '/members/library' || href === '/members/academy/courses') {
    return pathname.startsWith('/members/academy') || pathname === '/members/library'
  }
  return pathname === href || pathname.startsWith(href + '/')
}
```

**File:** `components/members/member-sidebar.tsx`

Apply the same active-state fix. The sidebar "Training Library" link should show active when the user is anywhere in `/members/academy/*`.

### 2.2 Update Academy Sub-Nav

**File:** `components/academy/academy-sub-nav.tsx`

**Change:** Remove Review Queue and Saved tabs until Phase 5 implements them. They are currently placeholder dead ends.

Replace the tabs array to only include implemented surfaces:

```typescript
const TABS = [
  { label: 'Home', href: '/members/academy' },
  { label: 'Explore', href: '/members/academy/courses' },
  { label: 'Continue', href: '/members/academy/continue' },
]
```

**Note:** "Library" renamed to "Explore" per the redesign strategy. Re-add "Review" and "Saved" in Phase 5 when those surfaces are functional.

### 2.3 Update Library Redirect

**File:** `app/members/library/page.tsx`

This file currently redirects to `/members/academy/courses`. Keep this behavior but ensure the redirect is permanent (308) and add a comment explaining the canonical route.

### 2.4 Consolidate Resume API

**File (new):** `app/api/academy/resume/route.ts`

This file already exists at `app/api/academy/resume/route.ts` (69 lines). Verify it returns:

```typescript
{
  next_lesson_id: string
  course_slug: string
  course_title: string
  lesson_title: string
  lesson_position: number
  total_lessons: number
  source_reason: 'last_in_progress' | 'next_unlocked' | 'first_lesson'
}
```

If it does not return `source_reason`, refactor to include it by extending the `resolveResumeLessonTarget` function in `lib/academy/resume.ts`.

### Phase 2 Verification

```bash
# Verify sub-nav only shows implemented tabs
grep -c "Review" components/academy/academy-sub-nav.tsx
# Expected: 0 (removed)

# Verify nav active state handles academy paths
grep "members/academy" components/members/mobile-bottom-nav.tsx
# Expected: at least 1 match

# Lint check
pnpm lint --quiet
# Expected: exit 0

# Build check
pnpm build
# Expected: exit 0

# Existing e2e tests still pass
pnpm playwright test e2e/specs/members/academy-layout.spec.ts
# Expected: all pass
```

---

## PHASE 3: CORE COMPONENT REFACTORS

**Purpose:** Upgrade the lesson player to chunk-based rendering, enhance the academy hub with AI resume card, and add the mastery arc visualization.

### 3.1 Create Chunk-Based Lesson Renderer

**File (new):** `components/academy/lesson-chunk-renderer.tsx`

This component replaces the markdown-only content area in the lesson player with a sequenced micro-unit renderer. Each chunk follows the instructional arc.

**Props interface:**

```typescript
interface LessonChunkRendererProps {
  chunks: LessonChunk[]
  currentChunkIndex: number
  onChunkComplete: (index: number) => void
  onNavigate: (direction: 'prev' | 'next') => void
  lessonId: string
  className?: string
}

interface LessonChunk {
  id: string
  title: string
  content_type: 'video' | 'rich_text' | 'interactive' | 'annotated_chart' | 'scenario_walkthrough' | 'quick_check' | 'applied_drill' | 'reflection'
  content: string // markdown for rich_text, URL for video, JSON string for interactive
  duration_minutes: number
  order_index: number
  quick_check?: QuickCheckData
}

interface QuickCheckData {
  question: string
  options: string[]
  correct_index: number
  explanation: string
}
```

**Behavior:**
- Renders the current chunk based on `content_type`
- Shows chunk progress dots at the top (clickable to navigate)
- For `rich_text`: render with ReactMarkdown (lazy loaded, same as current lesson-player.tsx)
- For `video`: render YouTube embed (reuse existing extraction logic from lesson-player.tsx)
- For `quick_check`: render inline question card that must be answered before proceeding
- For `applied_drill`: render action prompt with optional journal link
- For `reflection`: render open-ended text input with "Save to Journal" button
- Swipe left/right on mobile for chunk navigation
- Keyboard arrow keys on desktop

**File (new):** `components/academy/chunk-progress-dots.tsx`

Simple horizontal dot strip showing current position in chunk sequence.

```typescript
interface ChunkProgressDotsProps {
  total: number
  current: number
  completed: number[]
  onNavigate: (index: number) => void
}
```

### 3.2 Refactor Lesson Player to Support Chunks

**File (modify):** `components/academy/lesson-player.tsx`

The existing lesson player renders markdown content directly. Refactor to:

1. Check if `lesson.chunk_data` is a non-empty array
2. If YES: render `LessonChunkRenderer` instead of raw markdown
3. If NO: render existing markdown content (backward compatible with existing lessons)

This ensures all existing lessons continue working while new chunk-based lessons use the enhanced renderer.

**Key change in the content area:**

```typescript
{lesson.chunk_data && Array.isArray(lesson.chunk_data) && lesson.chunk_data.length > 0 ? (
  <LessonChunkRenderer
    chunks={lesson.chunk_data}
    currentChunkIndex={currentChunk}
    onChunkComplete={handleChunkComplete}
    onNavigate={handleChunkNavigate}
    lessonId={lesson.id}
  />
) : (
  // Existing markdown + video rendering (keep all current code)
  <>
    {videoId && <YouTubeEmbed videoId={videoId} />}
    <Markdown remarkPlugins={[remarkGfm]}>{lesson.content || ''}</Markdown>
  </>
)}
```

### 3.3 Fix Lesson Sidebar Positioning

**File (modify):** `app/members/academy/learn/[id]/page.tsx`

Fix the P0 bug identified in the audit: lesson sidebar wrapper applies `top-14` on desktop which clips the `Mark as Complete` button.

Find the sidebar container div and change:

```typescript
// BEFORE (broken):
className="fixed top-14 left-0 bottom-0 w-72 ..."

// AFTER (fixed):
className="fixed top-14 left-0 bottom-0 w-72 lg:top-0 lg:relative lg:bottom-auto ..."
```

The sidebar should be positioned fixed on mobile (for the overlay behavior) but relative on desktop (so it participates in normal flow and does not clip).

### 3.4 Create Mastery Arc Radar Chart

**File (new):** `components/academy/mastery-arc.tsx`

A 6-axis radar chart showing competency scores. Uses Recharts (already installed).

```typescript
interface MasteryArcProps {
  scores: {
    market_context: number
    entry_validation: number
    position_sizing: number
    trade_management: number
    exit_discipline: number
    review_reflection: number
  }
  size?: number
  className?: string
}
```

**Implementation:** Use Recharts `RadarChart` component with:
- `PolarGrid` with 3 concentric rings (awareness=33, applied=66, independent=100)
- `PolarAngleAxis` with 6 competency labels
- `Radar` fill with emerald gradient (`#10B981` at 30% opacity)
- Animated on mount

### 3.5 Enhance Academy Hub with AI Resume Card

**File (modify):** `components/academy/academy-hub.tsx`

Replace the generic "Continue Learning" card at the top of the hub with an AI-powered resume card.

**New component file:** `components/academy/ai-resume-card.tsx`

```typescript
interface AIResumeCardProps {
  currentLesson: {
    id: string
    title: string
    courseTitle: string
    position: number
    totalLessons: number
    progress: number
  } | null
  insight?: {
    message: string
    source: string
  } | null
  className?: string
}
```

The card should:
- Show the lesson to resume (from `/api/academy/resume`)
- Display an AI-generated insight if available (from `user_learning_insights` table)
- Fall back to a simple "Continue where you left off" if no insight is available
- Include a prominent "Resume" button linking to the lesson

In `academy-hub.tsx`, replace the `ContinueLearningCard` with `AIResumeCard` in the main content area.

### 3.6 Replace Stats Grid with Mastery Arc

**File (modify):** `components/academy/academy-hub.tsx`

In the right sidebar, replace the 4-stat grid (Courses Completed, Lessons Done, Quizzes Passed, Overall Progress) with the `MasteryArc` radar chart component.

Keep the XP display and streak calendar below it.

Add an API call to fetch competency scores:

**File (new):** `app/api/academy/competency-scores/route.ts`

```typescript
// GET /api/academy/competency-scores
// Returns: { scores: { market_context: number, entry_validation: number, ... } }
// Each score is 0-100
// If no scores exist yet, return all zeros
```

**SQL query:**

```sql
SELECT competency_key, score
FROM user_competency_scores
WHERE user_id = $1;
```

### Phase 3 Verification

```bash
# Verify new files exist
test -f components/academy/lesson-chunk-renderer.tsx && echo "PASS"
test -f components/academy/chunk-progress-dots.tsx && echo "PASS"
test -f components/academy/mastery-arc.tsx && echo "PASS"
test -f components/academy/ai-resume-card.tsx && echo "PASS"
test -f app/api/academy/competency-scores/route.ts && echo "PASS"

# Build check
pnpm build
# Expected: exit 0

# Verify backward compatibility - existing lessons still render
pnpm playwright test e2e/specs/members/academy-layout.spec.ts
# Expected: all pass
```

---

## PHASE 4: NEW API ROUTES

**Purpose:** Build all new API endpoints required by the redesigned surfaces.

### 4.1 Review Queue API

**File (new):** `app/api/academy/review/route.ts`

```typescript
// GET /api/academy/review
// Returns due review items for the authenticated user
// Query params: ?limit=20&competency=market_context
//
// Response: {
//   items: ReviewQueueItem[]
//   stats: { total_due: number, estimated_minutes: number, weak_competencies: string[] }
// }
```

**SQL for fetching due items:**

```sql
SELECT rqi.*, l.title as lesson_title, c.title as course_title
FROM review_queue_items rqi
LEFT JOIN lessons l ON rqi.source_lesson_id = l.id
LEFT JOIN courses c ON rqi.source_course_id = c.id
WHERE rqi.user_id = $1
  AND rqi.status = 'due'
  AND rqi.due_at <= now()
ORDER BY rqi.due_at ASC
LIMIT $2;
```

### 4.2 Review Submit API

**File (new):** `app/api/academy/review/submit/route.ts`

```typescript
// POST /api/academy/review/submit
// Body: { queue_item_id: string, answer_data: object, is_correct: boolean, confidence: number, latency_ms: number }
//
// Behavior:
// 1. Insert into review_attempts
// 2. Call calculate_next_review_interval() to get next due date
// 3. Update review_queue_items with new due_at, difficulty, stability
// 4. Update user_competency_scores
// 5. Award XP (5 for correct, 2 for attempt)
// 6. Log activity
```

### 4.3 Saved Items API

**File (new):** `app/api/academy/saved/route.ts`

```typescript
// GET /api/academy/saved
// Returns all saved items for the authenticated user
//
// POST /api/academy/saved
// Body: { entity_type: 'course' | 'lesson', entity_id: string }
// Toggles save state (insert if not exists, delete if exists)
//
// Response: { saved: boolean }
```

### 4.4 Learning Insights API

**File (new):** `app/api/academy/insights/route.ts`

```typescript
// GET /api/academy/insights
// Returns active (non-dismissed, non-expired) insights for the user
// Query params: ?limit=5&type=journal_gap
//
// PATCH /api/academy/insights/[id]
// Body: { is_dismissed: true } or { is_acted_on: true }
```

### 4.5 AI Context Help API (Enhanced Tutor)

**File (modify):** `app/api/academy/tutor/session/route.ts`

Extend the existing tutor endpoint to accept chunk-level context:

Add to the accepted body:

```typescript
{
  // Existing fields:
  lesson_id: string
  question: string
  session_id?: string
  // NEW fields:
  chunk_id?: string
  competency_key?: string
  last_quiz_error?: string // What the user got wrong
  user_journal_context?: string // Relevant journal excerpt
}
```

Update the system prompt construction to include this context when provided. The AI should reference the specific chunk content and the user's specific error.

### 4.6 Explore API (Enhanced Course Search)

**File (modify):** `app/api/academy/courses/route.ts`

Add new query parameters for the redesigned Explore surface:

```typescript
// New query params:
// ?competency=market_context  (filter by competency)
// ?max_minutes=30             (filter by duration)
// ?sort=trending              (sort by recent starts)
// ?sort=recommended           (sort by AI recommendation score)
```

Add a `trending` section to the response:

```typescript
// Add to response:
{
  courses: CourseData[],
  paths: string[],
  trending: CourseData[], // Top 5 most-started courses in last 7 days
  micro_lessons: CourseData[] // Courses with micro-learning available
}
```

### Phase 4 Verification

```bash
# Verify all new API routes exist
test -f app/api/academy/review/route.ts && echo "PASS"
test -f app/api/academy/review/submit/route.ts && echo "PASS"
test -f app/api/academy/saved/route.ts && echo "PASS"
test -f app/api/academy/insights/route.ts && echo "PASS"
test -f app/api/academy/competency-scores/route.ts && echo "PASS"

# Build check
pnpm build
# Expected: exit 0
```

---

## PHASE 5: NEW PAGE SURFACES

**Purpose:** Build the Review Queue and Saved Items pages with full functionality.

### 5.1 Review Queue Page

**File (replace):** `app/members/academy/review/page.tsx`

Replace the placeholder with a full review queue implementation:

**Components needed:**

**File (new):** `components/academy/review-session.tsx`

Flashcard-style review interface:
- Shows one question at a time
- Answer options with immediate feedback
- Confidence slider (1-5) after answering
- Progress bar showing items remaining
- Session summary at the end with competency scores

**File (new):** `components/academy/review-session-header.tsx`

Shows: due count, estimated time, weak competencies, "Start Review" button.

**File (new):** `components/academy/review-summary.tsx`

End-of-session card showing: items reviewed, accuracy, competencies improved, next scheduled review.

### 5.2 Saved Items Page

**File (replace):** `app/members/academy/saved/page.tsx`

Replace the placeholder with a saved items list:
- Fetches from `GET /api/academy/saved`
- Displays saved courses and lessons in separate sections
- Each item has an "Unsave" button
- Empty state: "Save courses and lessons by clicking the bookmark icon"

### 5.3 Add Save/Bookmark Buttons to Existing Surfaces

**File (modify):** `components/academy/course-card.tsx`

Add a small bookmark icon button to each course card. Clicking toggles save state via `POST /api/academy/saved`.

**File (modify):** `app/members/academy/learn/[id]/page.tsx`

Add a bookmark icon in the lesson header area.

### 5.4 Re-add Sub-Nav Tabs

**File (modify):** `components/academy/academy-sub-nav.tsx`

Now that Review and Saved are implemented, restore the full tab list:

```typescript
const TABS = [
  { label: 'Home', href: '/members/academy' },
  { label: 'Explore', href: '/members/academy/courses' },
  { label: 'Continue', href: '/members/academy/continue' },
  { label: 'Review', href: '/members/academy/review' },
  { label: 'Saved', href: '/members/academy/saved' },
]
```

### Phase 5 Verification

```bash
# Verify review queue page is no longer placeholder
grep -c "being prepared" app/members/academy/review/page.tsx
# Expected: 0

# Verify saved page is no longer placeholder
grep -c "No saved" app/members/academy/saved/page.tsx
# Expected: 0 (the empty state message should be different now)

# Verify sub-nav has all 5 tabs
grep -c "href:" components/academy/academy-sub-nav.tsx
# Expected: 5

# Build check
pnpm build
# Expected: exit 0
```

---

## PHASE 6: CONTENT GENERATION

**Purpose:** Populate the database with production-quality training content across all four tiers.

### Migration File: `supabase/migrations/20260313100000_academy_v2_content_seed.sql`

This is a large migration that seeds all courses, lessons, and quiz data. It must be idempotent.

### 6.1 Content Architecture

**Tier 1: Onboarding (1 course, 5 lessons)**

Course: "Welcome to TradeITM"
- Lesson 1: Platform Tour (video + rich_text) — Navigate the dashboard, understand the layout
- Lesson 2: Setting Up Your Account (rich_text + applied_drill) — Discord, broker connection, journal setup
- Lesson 3: Meet Your AI Coach (interactive + rich_text) — First AI conversation, understanding coach capabilities
- Lesson 4: Your First Journal Entry (applied_drill + reflection) — Walk through creating a trade journal entry
- Lesson 5: Your Learning Path (rich_text + quick_check) — Understand competencies, set goals, explore the academy

**Tier 2: Foundations (3 courses, 18 lessons total)**

Course: "Options 101: Understanding the Basics"
- 6 lessons covering: What are options, Calls vs Puts, Strike prices and expiration, Reading an options chain, Order types, Your first paper trade
- Each lesson: 2-3 chunks, 1 quick check per chunk, 1 applied drill

Course: "The Greeks Decoded"
- 6 lessons covering: Delta (directional risk), Gamma (acceleration), Theta (time decay), Vega (volatility), Combined Greeks reading, Greek risk scenarios
- Each lesson: interactive Greek visualizer component embedded

Course: "Risk Management Fundamentals"
- 6 lessons covering: Position sizing principles, Account risk rules, Stop loss strategies, Risk/reward ratios, Correlation risk, Building a risk checklist
- Each lesson: position sizer calculator embedded

**Tier 3: Core Strategies (3 courses, 18 lessons total)**

Course: "TITM Day Trading Methodology"
- 6 lessons: Market structure reading, Key levels (support/resistance/VWAP), TITM setup criteria, Entry validation checklist, Trade management rules, Exit discipline

Course: "Reading the Alerts"
- 6 lessons: Alert anatomy, GEX interpretation, Conviction levels, Entry timing, Position sizing from alerts, Alert-to-execution workflow

Course: "SPX Execution Mastery"
- 6 lessons: SPX contract selection, 0DTE vs swing timeframes, Spread strategies, Scaling in/out, Managing losers, Weekly review process

**Tier 4: Advanced (2 courses, 12 lessons total)**

Course: "LEAPS and Long-Term Positioning"
- 6 lessons: LEAPS fundamentals, Strike and expiry selection, Portfolio LEAPS allocation, Rolling strategies, Tax considerations, LEAPS case studies

Course: "Trading Psychology and Performance"
- 6 lessons: Emotional patterns in trading, Dealing with losses, FOMO and revenge trading, Building a trading routine, Performance journaling, The professional mindset

### 6.2 Seed SQL Structure

For each course and lesson, the seed SQL must follow this pattern:

```sql
-- Course: Options 101
INSERT INTO courses (id, title, slug, description, difficulty_level, estimated_hours, passing_score, is_published, learning_path_id, competency_map, common_mistakes)
VALUES (
  gen_random_uuid(),
  'Options 101: Understanding the Basics',
  'options-101',
  'Master the fundamentals of options trading. Learn calls, puts, strikes, and how to read an options chain.',
  'beginner',
  3.0,
  70,
  true,
  (SELECT id FROM learning_paths WHERE slug = 'foundations' LIMIT 1),
  '{"market_context": "awareness", "entry_validation": "awareness"}'::jsonb,
  '[{"mistake": "Confusing buying calls with selling calls", "correction": "Buying a call gives you the RIGHT to buy. Selling a call gives someone else the right and obligates you."}, {"mistake": "Ignoring expiration date", "correction": "Time decay accelerates as expiration approaches. Always know your expiration."}, {"mistake": "Trading without understanding the spread", "correction": "The bid-ask spread is a hidden cost. Wide spreads mean you lose money immediately on entry."}]'::jsonb
) ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  competency_map = EXCLUDED.competency_map,
  common_mistakes = EXCLUDED.common_mistakes;
```

For each lesson with chunk data:

```sql
INSERT INTO lessons (id, course_id, title, slug, content, lesson_type, estimated_minutes, position, is_published, competency_keys, chunk_data, quiz_data, key_takeaways, ai_tutor_context, ai_tutor_chips)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM courses WHERE slug = 'options-101' LIMIT 1),
  'What Are Options?',
  'what-are-options',
  'Options are financial contracts that give you the right, but not the obligation, to buy or sell an underlying asset at a specific price before a specific date...',
  'chunk',
  15,
  1,
  true,
  ARRAY['market_context']::competency_key[],
  '[
    {
      "id": "chunk-1",
      "title": "What is an Option?",
      "content_type": "rich_text",
      "content": "## The Basics\\n\\nAn option is a contract between two parties...",
      "duration_minutes": 3,
      "order_index": 0
    },
    {
      "id": "chunk-2",
      "title": "Why Trade Options?",
      "content_type": "rich_text",
      "content": "## Three Reasons Traders Use Options\\n\\n**1. Leverage**...",
      "duration_minutes": 3,
      "order_index": 1,
      "quick_check": {
        "question": "A trader buys a call option on SPX at $4500 strike. The stock rises to $4600. What is their right?",
        "options": ["They must buy SPX at $4500", "They can buy SPX at $4500", "They must sell SPX at $4500", "They can sell SPX at $4500"],
        "correct_index": 1,
        "explanation": "A call option gives you the RIGHT (not obligation) to BUY at the strike price. Since SPX is at $4600 and you can buy at $4500, this option is In The Money."
      }
    },
    {
      "id": "chunk-3",
      "title": "Options vs Stocks",
      "content_type": "rich_text",
      "content": "## Key Differences\\n\\nUnlike stocks, options have an expiration date...",
      "duration_minutes": 4,
      "order_index": 2
    },
    {
      "id": "chunk-4",
      "title": "Check Your Understanding",
      "content_type": "quick_check",
      "content": "",
      "duration_minutes": 2,
      "order_index": 3,
      "quick_check": {
        "question": "Which statement about options is FALSE?",
        "options": ["Options have expiration dates", "Options always require you to buy the underlying", "Options can be used for income or hedging", "Options premiums decay over time"],
        "correct_index": 1,
        "explanation": "Options give you the RIGHT but not the OBLIGATION. You never have to exercise an option — you can let it expire or sell it before expiration."
      }
    },
    {
      "id": "chunk-5",
      "title": "Apply It",
      "content_type": "applied_drill",
      "content": "## Your Task\\n\\nOpen your broker platform (or paper trading account) and find the options chain for SPY. Identify:\\n1. The current price of SPY\\n2. The nearest ATM call option\\n3. The bid-ask spread on that option\\n4. The expiration date\\n\\nWrite down these 4 numbers. You will reference them in the next lesson.",
      "duration_minutes": 3,
      "order_index": 4
    }
  ]'::jsonb,
  '[
    {"question": "What does an option contract give you?", "options": ["An obligation to trade", "The right but not obligation to trade", "Free shares of stock", "A guaranteed profit"], "correct_index": 1, "explanation": "Options provide rights, not obligations."},
    {"question": "What happens when an option expires out of the money?", "options": ["It auto-exercises", "It expires worthless", "It converts to stock", "You get a refund"], "correct_index": 1, "explanation": "OTM options expire worthless — the premium paid is lost."}
  ]'::jsonb,
  ARRAY['Options are contracts giving rights, not obligations', 'Calls = right to buy, Puts = right to sell', 'All options have an expiration date'],
  'This is the first lesson in Options 101. The student is learning what options are for the first time. Use simple analogies (insurance, movie tickets) to explain concepts. Avoid jargon beyond what has been introduced.',
  ARRAY['What is the difference between a call and a put?', 'Can I lose more than I paid for the option?', 'Why would someone sell an option?', 'What does in the money mean?']
) ON CONFLICT (slug) DO UPDATE SET
  chunk_data = EXCLUDED.chunk_data,
  competency_keys = EXCLUDED.competency_keys,
  quiz_data = EXCLUDED.quiz_data,
  key_takeaways = EXCLUDED.key_takeaways,
  ai_tutor_context = EXCLUDED.ai_tutor_context,
  ai_tutor_chips = EXCLUDED.ai_tutor_chips;
```

### 6.3 Content Generation Instructions

**CRITICAL:** Codex must generate ALL lesson content following the patterns above. Every lesson must have:

1. **chunk_data** — minimum 3 chunks, maximum 7 chunks per lesson
2. **quiz_data** — minimum 2 questions per lesson
3. **competency_keys** — at least 1 competency per lesson
4. **key_takeaways** — 2-4 takeaways per lesson
5. **ai_tutor_context** — a paragraph describing the lesson context for the AI tutor
6. **ai_tutor_chips** — 3-5 pre-built questions

Content must be:
- Technically accurate for options trading
- Written at the appropriate difficulty level
- Focused on the TITM methodology (SPX/NDX day trading, alerts-based entries, risk-first approach)
- Actionable (drills reference real broker actions)

### 6.4 Learning Path Seeds

Ensure learning paths exist and are connected:

```sql
INSERT INTO learning_paths (name, slug, description, tier_required, difficulty_level, estimated_hours, display_order, is_published)
VALUES
  ('Onboarding', 'onboarding', 'Get started with TradeITM', 'core', 'beginner', 1.5, 0, true),
  ('Foundations', 'foundations', 'Build your options trading foundation', 'core', 'beginner', 9.0, 1, true),
  ('Core Strategies', 'core-strategies', 'Master the TITM trading methodology', 'core', 'intermediate', 9.0, 2, true),
  ('Advanced Trading', 'advanced', 'Advanced strategies and psychology', 'pro', 'advanced', 6.0, 3, true)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  estimated_hours = EXCLUDED.estimated_hours;
```

### Phase 6 Verification

```sql
-- Verify course count
SELECT COUNT(*) FROM courses WHERE is_published = true;
-- Expected: >= 9 (1 onboarding + 3 foundations + 3 core + 2 advanced)

-- Verify lesson count
SELECT COUNT(*) FROM lessons WHERE is_published = true;
-- Expected: >= 53 (5 + 18 + 18 + 12)

-- Verify all lessons have chunk_data
SELECT COUNT(*) FROM lessons WHERE chunk_data IS NULL AND is_published = true;
-- Expected: 0 (all new lessons have chunks; existing lessons may still have NULL which is fine for backward compat)

-- Verify all lessons have competency_keys
SELECT COUNT(*) FROM lessons WHERE competency_keys = '{}' AND is_published = true AND chunk_data IS NOT NULL;
-- Expected: 0

-- Verify learning paths are connected
SELECT lp.name, COUNT(lpc.course_id) as courses
FROM learning_paths lp
LEFT JOIN learning_path_courses lpc ON lp.id = lpc.learning_path_id
GROUP BY lp.name;
-- Expected: each path has the correct number of courses
```

---

## PHASE 7: TEST SUITE

**Purpose:** Write comprehensive tests covering all new and modified functionality.

### 7.1 E2E Tests

**File (new):** `e2e/specs/members/academy-review-queue.spec.ts`

```typescript
// Test cases:
// 1. Review queue shows due items when items exist
// 2. Completing a review item shows feedback
// 3. Confidence slider works
// 4. Session summary appears after completing all items
// 5. Empty state shows when no items are due
```

**File (new):** `e2e/specs/members/academy-saved.spec.ts`

```typescript
// Test cases:
// 1. Saving a course adds it to saved page
// 2. Unsaving a course removes it from saved page
// 3. Saving a lesson works
// 4. Empty state shows when nothing is saved
```

**File (new):** `e2e/specs/members/academy-chunks.spec.ts`

```typescript
// Test cases:
// 1. Chunk-based lesson renders chunk progress dots
// 2. Navigating between chunks works
// 3. Quick check inline question blocks progress until answered
// 4. Applied drill renders with journal link
// 5. Backward compatible: non-chunk lesson still renders markdown
```

**File (modify):** `e2e/specs/members/academy-layout.spec.ts`

Add tests for:
- Sub-nav shows all 5 tabs
- Active state works across all academy routes
- Mobile bottom nav highlights Library when in academy

### 7.2 Test Helpers

**File (new):** `e2e/helpers/academy-helpers.ts`

```typescript
// Helper functions:
// - seedTestCourse(supabase, overrides?) — creates a test course with lessons
// - seedTestReviewItems(supabase, userId, count?) — creates review queue items
// - seedTestSavedItems(supabase, userId) — creates saved items
// - cleanupTestData(supabase, userId) — removes test data
```

### Phase 7 Verification

```bash
# Run all academy tests
pnpm playwright test e2e/specs/members/academy-*.spec.ts --reporter=list

# Run full test suite
pnpm playwright test

# Expected: ALL tests pass
```

---

## PHASE 8: DOCUMENTATION UPDATES

**Purpose:** Update all documentation across the repo to reflect the V2 changes.

### 8.1 Update CLAUDE.md

**File (modify):** `CLAUDE.md`

Add section:

```markdown
## Academy V2 Architecture
* **Lesson Format:** Chunk-based micro-units stored in `lessons.chunk_data` (JSONB array)
* **Competency System:** 6 competencies tracked in `user_competency_scores`
* **Review Queue:** FSRS-based spaced repetition in `review_queue_items`
* **Saved Items:** Bookmarks in `user_saved_items` (entity_type + entity_id)
* **Intelligence Layer:** Insights in `user_learning_insights`
* **Content Types:** video, rich_text, interactive, annotated_chart, scenario_walkthrough, quick_check, applied_drill, reflection
```

### 8.2 Update Brand Guidelines

**File (modify):** `docs/BRAND_GUIDELINES.md`

Add section for Academy-specific design patterns:

```markdown
## 6. Academy Design Patterns
* **Lesson Chunks:** Each chunk card uses `glass-card-heavy` with emerald left-border for active chunk
* **Quick Check Cards:** Emerald border, option buttons 44px minimum height, green/red feedback states
* **Mastery Arc:** Radar chart uses emerald fill at 30% opacity, champagne accent for top scores
* **Review Cards:** Flip-card style with question on front, answer on back
* **Progress Dots:** 8px circles, emerald for completed, white/10 for remaining, emerald ring for current
```

### 8.3 Create Academy V2 Architecture Doc

**File (new):** `docs/ACADEMY_V2_ARCHITECTURE.md`

Document:
- Database schema (all tables with column descriptions)
- API routes (all endpoints with request/response)
- Component tree (which components compose which pages)
- Data flow (how lesson completion triggers review queue seeding, competency updates, XP awards)
- Content authoring guide (how to create new courses and lessons with proper chunk format)

### 8.4 Update UX Spec

**File (modify):** `docs/TITM_ACADEMY_UX_INSTRUCTIONAL_IMPLEMENTATION_SPEC_V2.md`

Add a section at the top noting that this spec has been implemented, with cross-references to the actual files.

### Phase 8 Verification

```bash
# Verify documentation files exist
test -f docs/ACADEMY_V2_ARCHITECTURE.md && echo "PASS"

# Verify CLAUDE.md mentions Academy V2
grep -c "Academy V2" CLAUDE.md
# Expected: >= 1

# Build passes (documentation changes should not break build)
pnpm build
```

---

## PHASE 9: DEPLOYMENT VERIFICATION

**Purpose:** Final verification that everything works end-to-end in production.

### 9.1 Database Health Check

Run the admin seed health check:

```sql
-- Verify no orphaned lessons (lessons without valid course)
SELECT COUNT(*) FROM lessons l
LEFT JOIN courses c ON l.course_id = c.id
WHERE c.id IS NULL;
-- Expected: 0

-- Verify no orphaned learning_path_courses
SELECT COUNT(*) FROM learning_path_courses lpc
LEFT JOIN learning_paths lp ON lpc.learning_path_id = lp.id
WHERE lp.id IS NULL;
-- Expected: 0

-- Verify all published courses have at least 1 published lesson
SELECT c.title, COUNT(l.id) as lesson_count
FROM courses c
LEFT JOIN lessons l ON c.id = l.course_id AND l.is_published = true
WHERE c.is_published = true
GROUP BY c.title
HAVING COUNT(l.id) = 0;
-- Expected: 0 rows (no courses without lessons)

-- Verify quiz data is valid JSON for all lessons that have it
SELECT COUNT(*) FROM lessons
WHERE quiz_data IS NOT NULL
AND jsonb_typeof(quiz_data) != 'array';
-- Expected: 0

-- Verify chunk_data is valid for all chunk-type lessons
SELECT COUNT(*) FROM lessons
WHERE chunk_data IS NOT NULL
AND jsonb_typeof(chunk_data) != 'array';
-- Expected: 0

-- Verify RLS policies exist on all new tables
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('review_queue_items', 'review_attempts', 'user_saved_items', 'user_competency_scores', 'user_learning_insights')
GROUP BY tablename;
-- Expected: all tables have >= 2 policies
```

### 9.2 Application Health Check

```bash
# Full build
pnpm build
# Expected: exit 0

# Lint
pnpm lint --quiet
# Expected: exit 0

# All e2e tests
pnpm playwright test
# Expected: all pass
```

### 9.3 Route Accessibility Check

Verify all academy routes return 200 (not 500) for authenticated users:

```bash
# These should be tested as part of e2e but verify explicitly:
# /members/academy — 200
# /members/academy/courses — 200
# /members/academy/continue — 200
# /members/academy/review — 200
# /members/academy/saved — 200
# /members/library — 308 redirect to /members/academy/courses
```

### 9.4 Performance Check

```bash
# Build analysis
pnpm build 2>&1 | grep "Route\|Size"
# Verify no academy page exceeds 300KB initial JS
```

---

## FILE INVENTORY: ALL CHANGES

### Files to CREATE (new):

| File | Purpose | Phase |
|------|---------|-------|
| `supabase/migrations/20260313000000_academy_v2_schema.sql` | Schema extension | 1 |
| `supabase/migrations/20260313100000_academy_v2_content_seed.sql` | Content seed | 6 |
| `components/academy/lesson-chunk-renderer.tsx` | Chunk-based lesson renderer | 3 |
| `components/academy/chunk-progress-dots.tsx` | Chunk navigation dots | 3 |
| `components/academy/mastery-arc.tsx` | Radar chart competency viz | 3 |
| `components/academy/ai-resume-card.tsx` | AI-powered resume card | 3 |
| `components/academy/review-session.tsx` | Review queue session UI | 5 |
| `components/academy/review-session-header.tsx` | Review session header | 5 |
| `components/academy/review-summary.tsx` | Review session summary | 5 |
| `app/api/academy/competency-scores/route.ts` | Competency scores API | 3 |
| `app/api/academy/review/route.ts` | Review queue GET | 4 |
| `app/api/academy/review/submit/route.ts` | Review submit POST | 4 |
| `app/api/academy/saved/route.ts` | Saved items CRUD | 4 |
| `app/api/academy/insights/route.ts` | Learning insights API | 4 |
| `e2e/specs/members/academy-review-queue.spec.ts` | Review queue tests | 7 |
| `e2e/specs/members/academy-saved.spec.ts` | Saved items tests | 7 |
| `e2e/specs/members/academy-chunks.spec.ts` | Chunk renderer tests | 7 |
| `e2e/helpers/academy-helpers.ts` | Test helpers | 7 |
| `docs/ACADEMY_V2_ARCHITECTURE.md` | Architecture doc | 8 |

### Files to MODIFY (refactor):

| File | Change | Phase |
|------|--------|-------|
| `components/academy/academy-sub-nav.tsx` | Remove placeholder tabs, then re-add | 2, 5 |
| `components/members/mobile-bottom-nav.tsx` | Fix active state for academy routes | 2 |
| `components/members/member-sidebar.tsx` | Fix active state for academy routes | 2 |
| `components/academy/lesson-player.tsx` | Add chunk rendering path | 3 |
| `components/academy/academy-hub.tsx` | Replace stats grid with mastery arc | 3 |
| `components/academy/course-card.tsx` | Add bookmark button | 5 |
| `app/members/academy/learn/[id]/page.tsx` | Fix sidebar position, add bookmark | 3, 5 |
| `app/members/academy/review/page.tsx` | Replace placeholder with full review UI | 5 |
| `app/members/academy/saved/page.tsx` | Replace placeholder with full saved UI | 5 |
| `app/api/academy/courses/route.ts` | Add trending, competency filter | 4 |
| `app/api/academy/tutor/session/route.ts` | Add chunk-level context | 4 |
| `app/api/academy/lessons/[id]/progress/route.ts` | Seed review items on completion | 4 |
| `e2e/specs/members/academy-layout.spec.ts` | Add new navigation tests | 7 |
| `CLAUDE.md` | Add Academy V2 section | 8 |
| `docs/BRAND_GUIDELINES.md` | Add Academy design patterns | 8 |
| `docs/TITM_ACADEMY_UX_INSTRUCTIONAL_IMPLEMENTATION_SPEC_V2.md` | Mark as implemented | 8 |

### Files to DELETE: None

All existing files are preserved for backward compatibility. The review and saved page files are replaced in-place (same path, new content).

---

## EXECUTION SUMMARY

| Phase | Description | New Files | Modified Files | Estimated Effort |
|-------|-------------|-----------|----------------|-----------------|
| 0 | Pre-flight validation | 0 | 0 | 5 min |
| 1 | Database migrations | 1 | 0 | 15 min |
| 2 | Navigation fix + cleanup | 0 | 3 | 20 min |
| 3 | Core component refactors | 5 | 3 | 90 min |
| 4 | New API routes | 4 | 3 | 60 min |
| 5 | New page surfaces | 3 | 4 | 60 min |
| 6 | Content generation | 1 | 0 | 120 min |
| 7 | Test suite | 4 | 1 | 45 min |
| 8 | Documentation | 1 | 3 | 30 min |
| 9 | Deployment verification | 0 | 0 | 15 min |
| **Total** | | **19** | **17** | **~7.5 hours** |

---

## POST-DEPLOYMENT: MANUAL VERIFICATION CHECKLIST

After autonomous execution completes, a human should verify:

1. Open `/members/academy` on mobile (375px) — resume card visible, one tap to lesson
2. Open a lesson with chunk_data — chunks render, quick checks work
3. Complete a lesson — verify review queue items created (check after 24h)
4. Open `/members/academy/review` — items appear when due
5. Save a course — verify it appears on `/members/academy/saved`
6. Check mastery arc — radar chart shows on Academy Home
7. Open AI Tutor from within a chunk — context is relevant to the chunk content
8. Run `pnpm playwright test` — all tests pass
9. Check Supabase dashboard — all new tables have RLS enabled
10. Check bundle size — no academy page exceeds 300KB initial JS
