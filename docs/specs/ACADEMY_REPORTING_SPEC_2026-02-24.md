# Academy Reporting & Analytics Specification
**Version:** 1.0
**Date:** 2026-02-24
**Status:** Design Specification (Pre-Implementation)
**Scope:** Student-facing and admin-facing learning analytics dashboards

---

## Executive Summary

This specification defines comprehensive learning analytics and reporting for TradeITM's trading academy. The system tracks learning progression, competency mastery, engagement patterns, and content effectiveness—enabling both students to optimize their learning and admins to improve curriculum and retention.

Current state: Basic progress cards (lesson count, remediation flags, competency bars) with no historical trends, cohort analysis, or content performance metrics.

Desired state: Rich dashboards with time-series analytics, predictive insights, cohort funnel tracking, and actionable content recommendations.

---

## Part 1: Student-Facing Analytics

### 1.1 Learning Dashboard (Landing Widget Suite)

**Purpose:** Give students a daily snapshot of momentum, learning streak, XP progress, and predicted completion.

**Location:** `/members/academy/progress` (enhanced existing page)
**Component:** `components/academy/academy-learning-dashboard.tsx` (new)
**Update Frequency:** Real-time (dashboard) + Daily aggregations (streaks, XP)
**Mobile Layout:** Stack vertically; cards become full-width. Charts collapse to numeric summary on small screens.

#### 1.1.1 Daily Study Time Widget

**Data Source:** `academy_learning_events` (event_type, occurred_at)
**Visualization:** Line chart (7-day rolling window) + current week total
**Metric Logic:**
- Sum of all block_completed events per day
- Time estimate from `academy_lessons.estimated_minutes` × completion rate
- Current week total in hours (hover tooltip shows daily breakdown)

**SQL Pattern:**
```sql
SELECT
  DATE(occurred_at) as date,
  COUNT(*) as events,
  COUNT(*) * 5 as estimated_minutes  -- rough estimate per event
FROM academy_learning_events
WHERE user_id = $1
  AND event_type IN ('lesson_started', 'block_completed', 'assessment_submitted')
  AND occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(occurred_at)
ORDER BY date ASC;
```

**Visualization Type:** Area chart (Recharts), Emerald gradient fill
**Component Name:** `StudyTimeWidget.tsx`
**Update Frequency:** Real-time (on event emission) + hourly aggregation

#### 1.1.2 Lesson Completion Velocity

**Data Source:** `academy_user_lesson_attempts` (completed_at), aggregated over time windows
**Visualization:** Velocity burndown (lessons/week, lessons/month trend)
**Metric Logic:**
- Lessons completed in current week, last 2 weeks, last month
- Trend arrow (↑ accelerating, → stable, ↓ decelerating)
- Projected completion date based on current velocity

**SQL Pattern:**
```sql
SELECT
  TRUNC((NOW() - COMPLETED_AT) / '7 days'::interval)::int as week_offset,
  COUNT(*) as lessons_completed
FROM academy_user_lesson_attempts
WHERE user_id = $1
  AND status = 'passed'
  AND completed_at IS NOT NULL
GROUP BY week_offset
ORDER BY week_offset ASC;
```

**Visualization Type:** Metric card + sparkline
**Component Name:** `VelocityCard.tsx`
**Update Frequency:** Daily (9 AM UTC)

#### 1.1.3 Competency Radar Chart

**Data Source:** `academy_user_competency_mastery` (current_score for all 6 competencies)
**Visualization:** 6-axis radar chart with historical overlay (current + 30 days ago)
**Metric Logic:**
- Show all 6 competencies: market_context, entry_validation, position_sizing, trade_management, exit_discipline, review_reflection
- Current score (filled polygon, Emerald)
- 30-day historical score (dotted polygon, Champagne)
- Color coding: < 50% (red), 50-70% (amber), > 70% (emerald)
- Hover shows competency title + score + "Needs Remediation" flag

**SQL Pattern:**
```sql
SELECT
  ac.key as competency_key,
  ac.title as competency_title,
  aucm.current_score,
  aucm.last_evaluated_at,
  LAG(aucm.current_score) OVER (ORDER BY aucm.last_evaluated_at) as prev_score
FROM academy_user_competency_mastery aucm
JOIN academy_competencies ac ON aucm.competency_id = ac.id
WHERE aucm.user_id = $1
ORDER BY ac.title ASC;
```

**Visualization Type:** Recharts Radar component with dual datasets
**Component Name:** `CompetencyRadarChart.tsx`
**Update Frequency:** Real-time (on mastery update) + caching for 1 hour
**Mobile Layout:** Collapses to vertical bar chart (Competency | Score %)

#### 1.1.4 Streak Tracker

**Data Source:** `academy_learning_events` (daily activity)
**Visualization:** Calendar heatmap (90-day) + current/longest streak badges
**Metric Logic:**
- Current streak: consecutive days with ≥1 learning event (any type)
- Longest streak: max consecutive days in user's history
- Calendar shows day color intensity by event count (pale = 1 event, bright emerald = 5+ events)
- Breaks reset on 24h gaps

**SQL Pattern:**
```sql
WITH daily_activity AS (
  SELECT DISTINCT DATE(occurred_at) as activity_date
  FROM academy_learning_events
  WHERE user_id = $1
  ORDER BY activity_date DESC
),
streaks AS (
  SELECT
    activity_date,
    activity_date - ROW_NUMBER() OVER (ORDER BY activity_date) * INTERVAL '1 day' as streak_group
  FROM daily_activity
)
SELECT
  streak_group,
  COUNT(*) as streak_length,
  MIN(activity_date) as streak_start,
  MAX(activity_date) as streak_end
FROM streaks
GROUP BY streak_group
ORDER BY streak_end DESC;
```

**Visualization Type:** Calendar heatmap (react-calendar-heatmap style) + two badge cards
**Component Name:** `StreakTracker.tsx`
**Update Frequency:** Daily (1 AM UTC)
**Mobile Layout:** Heatmap shrinks to 4-week view; badges remain prominent

#### 1.1.5 XP Progress Bar & Level

**Data Source:** `academy_learning_events` + XP rules (derived)
**Visualization:** Horizontal progress bar + level badge
**Metric Logic:**
- XP earned per event type:
  - lesson_started: +5 XP
  - block_completed: +10 XP
  - assessment_passed: +50 XP
  - review_completed (correct): +15 XP
- Levels: 0-500 (L1), 500-1500 (L2), 1500-3000 (L3), 3000-5000 (L4), 5000+ (L5)
- Show current level, XP to next level, total XP (life-time)
- Animated progress bar on level-up event

**SQL Pattern:**
```sql
SELECT
  SUM(CASE
    WHEN event_type = 'lesson_started' THEN 5
    WHEN event_type = 'block_completed' THEN 10
    WHEN event_type = 'assessment_passed' THEN 50
    WHEN event_type = 'assessment_failed' THEN 0
    WHEN event_type = 'review_completed' THEN 15
    ELSE 0
  END) as total_xp
FROM academy_learning_events
WHERE user_id = $1;
```

**Visualization Type:** Card with progress bar + badges
**Component Name:** `XPProgressCard.tsx`
**Update Frequency:** Real-time (on event insertion)

#### 1.1.6 Predicted Completion Date

**Data Source:** `academy_user_lesson_attempts`, velocity calculation
**Visualization:** Metric card with date + confidence band
**Metric Logic:**
- Total lessons in program (from `academy_lessons` WHERE is_published = true)
- Lessons completed to date
- Lessons remaining
- Average completion time (from velocity)
- Predict date: today + (remaining / avg_per_week * 7 days)
- Show confidence: "On track" (↑5% weekly), "Steady" (→same), "Slowing" (↓5% weekly)

**Visualization Type:** Card + date input (for goal-setting)
**Component Name:** `CompletionPredictorCard.tsx`
**Update Frequency:** Weekly (Monday 9 AM UTC)

---

### 1.2 Competency Deep Dive Page

**Purpose:** Detailed view per competency showing mastery trend, linked lessons, remediation path, and AI-generated narrative.

**Location:** `/members/academy/competencies/[competencyKey]` (new route)
**Component:** `components/academy/competency-deep-dive.tsx`
**Layout:** Split: left sidebar (nav), main content (trends + lessons + AI narrative)
**Update Frequency:** On-demand (API call) + daily aggregations
**Mobile Layout:** Stack layout; chart becomes smaller; sections scroll vertically.

#### 1.2.1 Per-Competency Score Trend

**Data Source:** `academy_user_competency_mastery` (historical snapshots, requires aggregation table)
**Visualization:** Line chart (90-day history) with threshold markers (70% pass line, needs-remediation < 50%)
**Metric Logic:**
- Show score at each evaluation date (usually on assessment_passed/failed events)
- Linear fit trend line (projected next 30 days)
- Confidence band (±10% shaded zone)
- Y-axis: 0-100%; X-axis: last 90 days

**Aggregation Table Requirement:** `academy_user_competency_mastery_history`
```sql
-- Proposed table (new migration):
CREATE TABLE academy_user_competency_mastery_history (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  competency_id uuid NOT NULL REFERENCES academy_competencies(id),
  score_snapshot numeric NOT NULL,
  evaluated_at timestamptz NOT NULL,
  event_source academy_learning_event_type,
  FOREIGN KEY (user_id, competency_id) REFERENCES academy_user_competency_mastery(user_id, competency_id)
);
-- Index on (user_id, competency_id, evaluated_at DESC)
```

**SQL Pattern:**
```sql
SELECT
  evaluated_at,
  score_snapshot,
  event_source
FROM academy_user_competency_mastery_history
WHERE user_id = $1
  AND competency_id = $2
  AND evaluated_at >= NOW() - INTERVAL '90 days'
ORDER BY evaluated_at ASC;
```

**Visualization Type:** Line chart with fill area + threshold markers (Recharts)
**Component Name:** `CompetencyTrendChart.tsx`
**Update Frequency:** Real-time (on assessment event)

#### 1.2.2 Linked Lessons & Assessment Performance

**Data Source:** `academy_lesson_competencies`, `academy_user_lesson_attempts`, `academy_user_assessment_attempts`
**Visualization:** Table (lessons, completion %, time spent, assessment score)
**Columns:**
- Lesson Title (link to lesson)
- Status (completed, in-progress, not-started)
- Completion % (from progress_percent)
- Time Spent (estimated, from events)
- Assessment Score (if available)
- Review Queue Size (count of due items from this lesson's competency)

**SQL Pattern:**
```sql
SELECT
  al.id as lesson_id,
  al.title as lesson_title,
  aula.status,
  aula.progress_percent,
  al.estimated_minutes,
  MAX(auaa.score) as latest_assessment_score,
  COUNT(CASE WHEN aq.status = 'due' THEN 1 END) as due_review_items
FROM academy_lessons al
LEFT JOIN academy_user_lesson_attempts aula ON aula.lesson_id = al.id AND aula.user_id = $1
LEFT JOIN academy_lesson_competencies alc ON alc.lesson_id = al.id
LEFT JOIN academy_user_assessment_attempts auaa ON auaa.user_id = $1 AND auaa.assessment_id IN (
  SELECT id FROM academy_assessments WHERE lesson_id = al.id
)
LEFT JOIN academy_review_queue aq ON aq.user_id = $1 AND aq.competency_id = $2
WHERE alc.competency_id = $2
  AND al.is_published = true
GROUP BY al.id, aula.id
ORDER BY al.position ASC;
```

**Visualization Type:** Data table (shadcn Table) with sortable columns
**Component Name:** `CompetencyLessonsTable.tsx`

#### 1.2.3 Remediation Recommendations

**Data Source:** `academy_user_competency_mastery` (needsRemediation flag) + `academy_lessons`
**Visualization:** Card list with action CTA
**Metric Logic:**
- If needsRemediation = true or currentScore < 70:
  - Fetch recommended lessons for this competency
  - Rank by difficulty (beginner first) + prerequisite completion
  - Show top 3 recommendations
  - Include estimated time to restore competency

**SQL Pattern:**
```sql
SELECT
  al.id,
  al.title,
  al.difficulty,
  al.estimated_minutes,
  CASE
    WHEN aula.status = 'passed' THEN 'completed'
    WHEN aula.status IN ('in_progress', 'submitted') THEN 'in-progress'
    ELSE 'not-started'
  END as status
FROM academy_lessons al
LEFT JOIN academy_user_lesson_attempts aula ON aula.lesson_id = al.id AND aula.user_id = $1
LEFT JOIN academy_lesson_competencies alc ON alc.lesson_id = al.id AND alc.competency_id = $2
WHERE alc.competency_id = $2
  AND al.is_published = true
  AND (aula.status != 'passed' OR aula.id IS NULL)
ORDER BY
  al.difficulty ASC,
  al.position ASC
LIMIT 3;
```

**Visualization Type:** Card stack (vertical) with "Open Lesson" CTA
**Component Name:** `RemediationRecommendations.tsx`

#### 1.2.4 AI-Generated Strengths & Growth Narrative

**Data Source:** Mastery scores, assessment performance, event history, review accuracy
**Visualization:** Prose summary card (text paragraph + bullet points)
**Logic:**
- Call AI Coach API (new endpoint) with user's competency profile
- Prompt: "Write a brief, encouraging narrative about this trader's [competency_name] mastery. Include 1-2 strengths and 1-2 areas for growth. Use trader language. Limit to 3 sentences."
- Cache result for 24 hours (invalidate on mastery update)

**Component:** `AI_CoachNarrativeCard.tsx` (calls `/api/academy-v3/ai-narrative` POST endpoint)
**Prompt Example:**
```
User competency profile:
- Competency: Entry Validation
- Current Score: 62%
- Confidence: 0.7
- Recent assessment scores: [78%, 55%, 68%, 72%]
- Review accuracy: 65%
- Days to next review: 3

Generate an encouraging narrative:
```

**Visualization Type:** Card with prose + bullet points
**Update Frequency:** On-demand (lazy load) + cache 24h

---

### 1.3 Performance Analytics Page

**Purpose:** Detailed analysis of student's assessment performance, time efficiency, review accuracy, and topics to focus on.

**Location:** `/members/academy/analytics` (new page)
**Component:** `components/academy/performance-analytics.tsx`
**Update Frequency:** Daily aggregations + real-time updates on assessment submission
**Mobile Layout:** Chart containers collapse to cards with numeric summary; tables scroll horizontally.

#### 1.3.1 Assessment Score Trends

**Data Source:** `academy_user_assessment_attempts` (score, created_at)
**Visualization:** Scatter plot (date vs. score) with moving average line
**Metric Logic:**
- X-axis: assessment submission date
- Y-axis: score (0-100%)
- Show 7-day moving average trend line
- Color-code by assessment type (diagnostic, formative, summative)
- Hover shows assessment title + score + time taken

**SQL Pattern:**
```sql
SELECT
  auaa.created_at,
  auaa.score,
  aa.title,
  aa.assessment_type,
  AVG(auaa.score) OVER (ORDER BY auaa.created_at ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as ma7
FROM academy_user_assessment_attempts auaa
JOIN academy_assessments aa ON auaa.assessment_id = aa.id
WHERE auaa.user_id = $1
ORDER BY auaa.created_at ASC;
```

**Visualization Type:** Scatter plot with line overlay (Recharts)
**Component Name:** `AssessmentTrendChart.tsx`

#### 1.3.2 Time Spent Per Lesson vs. Cohort

**Data Source:** `academy_learning_events` (timestamps), `academy_lessons` (estimated_minutes)
**Visualization:** Horizontal bar chart (lesson names on Y, actual time on X, cohort avg as reference line)
**Metric Logic:**
- Calculate time spent per lesson from event clusters (lesson_started to lesson_completed/next_lesson_started)
- Compare to program cohort average
- Flag anomalies (< 25th percentile = "Quick learner", > 75th percentile = "Needs support")
- Show top 5 time-consuming lessons

**Aggregation Table:** `academy_lesson_analytics_daily`
```sql
CREATE TABLE academy_lesson_analytics_daily (
  id uuid PRIMARY KEY,
  lesson_id uuid NOT NULL REFERENCES academy_lessons(id),
  date date NOT NULL,
  avg_time_minutes numeric,
  median_time_minutes numeric,
  p25_time_minutes numeric,
  p75_time_minutes numeric,
  completion_count integer,
  started_count integer,
  created_at timestamptz
);
```

**SQL Pattern:**
```sql
SELECT
  al.title,
  (SELECT AVG(time_spent_minutes) FROM user_lesson_timings WHERE lesson_id = al.id AND user_id = $1) as user_avg,
  alad.avg_time_minutes as cohort_avg
FROM academy_lessons al
LEFT JOIN academy_lesson_analytics_daily alad ON alad.lesson_id = al.id AND alad.date = CURRENT_DATE
WHERE al.is_published = true
ORDER BY user_avg DESC NULLS LAST
LIMIT 10;
```

**Visualization Type:** Horizontal bar chart with reference line
**Component Name:** `TimeEfficiencyChart.tsx`

#### 1.3.3 Review Queue Accuracy

**Data Source:** `academy_review_attempts` (is_correct), `academy_review_queue` (competency_id)
**Visualization:** Bar chart (competency on X, accuracy % on Y) + overall accuracy metric
**Metric Logic:**
- Group review attempts by competency
- Calculate accuracy: (correct_answers / total_attempts) * 100
- Show overall accuracy badge at top (green if > 70%, amber if 50-70%, red if < 50%)
- Include attempt count + due item count

**SQL Pattern:**
```sql
SELECT
  ac.title,
  ac.id as competency_id,
  SUM(CASE WHEN ara.is_correct THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as accuracy_pct,
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN aq.status = 'due' THEN 1 END) as due_items
FROM academy_review_attempts ara
JOIN academy_review_queue aq ON ara.queue_id = aq.id
JOIN academy_competencies ac ON aq.competency_id = ac.id
WHERE ara.user_id = $1
  AND ara.created_at >= NOW() - INTERVAL '90 days'
GROUP BY ac.id, ac.title
ORDER BY accuracy_pct DESC;
```

**Visualization Type:** Bar chart + metric badge
**Component Name:** `ReviewAccuracyChart.tsx`

#### 1.3.4 Most-Missed & Best-Performing Topics

**Data Source:** `academy_assessment_items` (prompt), `academy_user_assessment_attempts` (score/answers)
**Visualization:** Two card stacks (side-by-side) showing top 5 each
**Metric Logic:**
- Track assessment item performance (which questions are consistently wrong)
- Missed: items with accuracy < 40% across all attempts
- Best: items with accuracy > 90% across all attempts
- Show topic summary + attempt count + recommended lesson link

**SQL Pattern - Missed Items:**
```sql
SELECT
  aai.prompt,
  aai.id,
  ac.title as competency,
  COUNT(*) as attempts,
  SUM(CASE WHEN (aaa.answers_json->>'item_'||aai.id)::text = aai.answer_key_json->>'correct' THEN 1 ELSE 0 END)::float / COUNT(*) as accuracy_pct
FROM academy_assessment_items aai
LEFT JOIN academy_user_assessment_attempts aaa ON aaa.assessment_id = aai.assessment_id AND aaa.user_id = $1
LEFT JOIN academy_competencies ac ON aai.competency_id = ac.id
WHERE aaa.user_id = $1
  AND aaa.created_at >= NOW() - INTERVAL '90 days'
GROUP BY aai.id, ac.title
HAVING COUNT(*) >= 2
ORDER BY accuracy_pct ASC
LIMIT 5;
```

**Visualization Type:** Two card stacks (top-missed, top-performed)
**Component Names:** `TopMissedTopicsCard.tsx`, `TopPerformedTopicsCard.tsx`

---

### 1.4 Achievements & Milestones Page

**Purpose:** Gamification dashboard showing earned badges, certificates, XP milestones, and level progression.

**Location:** `/members/academy/achievements` (new page)
**Component:** `components/academy/achievements-gallery.tsx`
**Update Frequency:** Real-time (on badge earn)
**Mobile Layout:** Grid collapses to single column; badges enlarge; certificates show preview thumbnails.

#### 1.4.1 Badge Gallery

**Data Source:** New table `academy_user_badges` (tracks earned badges)
**Visualization:** 2x3 grid (desktop) / 2x2 (tablet) / 1x1 (mobile) of badge cards
**Badge Types:**
- Lesson Marathoner (10+ lessons)
- Master of [Competency] (competency_score >= 90%)
- Perfect Week (7-day streak)
- Review Champion (20+ correct reviews)
- Quick Learner (complete lesson in < 50% avg time)
- Data-Driven (complete 5+ assessments)
- Momentum (3+ weeks with daily activity)

**Component:** `BadgeGalleryGrid.tsx`
**Badge Card Data:**
- Badge image (SVG, Emerald + Champagne color scheme)
- Badge name
- Description
- Earned date / "Locked" state
- Progress to unlock (if not earned)

**New Migration:** `academy_user_badges` table
```sql
CREATE TABLE academy_user_badges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  badge_key text NOT NULL,
  badge_title text NOT NULL,
  badge_description text,
  icon_url text,
  earned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE (user_id, badge_key)
);
```

#### 1.4.2 Certificate Tracker & Downloads

**Data Source:** New table `academy_user_certificates`
**Visualization:** Timeline / list of completed modules with certificate actions
**Metric Logic:**
- Show certificates earned by module completion
- Generate PDF on-demand (uses `/api/academy-v3/certificate/{module_id}` endpoint)
- Include completion date, final competency scores, trainer signature (signature image), TradeITM seal

**New Migration:** `academy_user_certificates` table
```sql
CREATE TABLE academy_user_certificates (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  module_id uuid NOT NULL REFERENCES academy_modules(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  certificate_number text UNIQUE,
  pdf_storage_path text,
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE (user_id, module_id)
);
```

**Certificate Content:**
- Student name
- Module title
- Completion date
- 6 competency scores (radar chart embedded)
- TradeITM logo + seal
- Trainer signature (static image)
- Certificate number
- Security features (hashed QR code for verification)

**Component:** `CertificateTracker.tsx` + `CertificateModal.tsx` (preview) + `/api/academy-v3/certificate/[moduleId]` (PDF generation endpoint)

#### 1.4.3 XP History & Level Progression

**Data Source:** `academy_learning_events` (aggregated XP) + `academy_user_level_history` (new table)
**Visualization:** Vertical timeline of milestones + XP breakdown table
**Metric Logic:**
- Show all level-ups in chronological order
- Display XP earned per week (stacked bar: green/amber/red by event type)
- Leaderboard position at each level-up (rank among all students)

**New Migration:** `academy_user_level_history` table
```sql
CREATE TABLE academy_user_level_history (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  level integer NOT NULL,
  total_xp integer NOT NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);
```

**Component:** `XPMilestoneTimeline.tsx`

---

## Part 2: Admin-Facing Analytics

### 2.1 Cohort Dashboard

**Purpose:** High-level overview of academy engagement, retention, and progression across all enrolled students.

**Location:** `/admin/academy` (new admin section)
**Component:** `components/admin/academy-cohort-dashboard.tsx`
**Layout:** Grid layout (3 metric cards top, 2 large charts below)
**Update Frequency:** Hourly aggregation + real-time top-line metrics
**Mobile Layout:** Single-column stack; charts become card-sized with numeric summary.

#### 2.1.1 Cohort Overview Metrics

**Data Source:** `academy_user_enrollments`, `academy_user_lesson_attempts`
**Visualization:** 3 metric cards (KPI dashboard style)

**Cards:**
1. **Total Active Enrollments:** COUNT(enrollments WHERE status = 'active')
2. **Overall Completion Rate:** COUNT(passed lessons) / COUNT(active enrollments) * 100
3. **Avg Competency Score:** AVG(current_score) across all mastery records

**SQL:**
```sql
SELECT
  COUNT(DISTINCT aue.id) as active_enrollments,
  COUNT(DISTINCT CASE WHEN aula.status = 'passed' THEN aue.user_id END)::float / COUNT(DISTINCT aue.user_id) * 100 as completion_pct,
  AVG(aucm.current_score) as avg_competency_score
FROM academy_user_enrollments aue
LEFT JOIN academy_user_lesson_attempts aula ON aule.user_id = aue.user_id AND aula.status = 'passed'
LEFT JOIN academy_user_competency_mastery aucm ON aucm.user_id = aue.user_id
WHERE aue.status = 'active'
  AND aue.started_at >= NOW() - INTERVAL '90 days';
```

**Visualization Type:** 3-column metric card grid
**Component Name:** `CohortMetricsOverview.tsx`

#### 2.1.2 Churn Rate & Trend

**Data Source:** `academy_user_enrollments` (status, started_at, completed_at)
**Visualization:** Line chart (weekly churn %) + top churn drivers
**Metric Logic:**
- Churn week: (enrollments_paused + enrollments_archived) / active_enrollments * 100
- Show 12-week trend
- Flag anomalies (week-over-week spike > 5%)
- Secondary: top reasons for churn (from user feedback or event patterns)

**Aggregation Table:** `academy_cohort_churn_weekly`
```sql
CREATE TABLE academy_cohort_churn_weekly (
  id uuid PRIMARY KEY,
  week_of date NOT NULL UNIQUE,
  enrollments_active integer,
  enrollments_churned integer,
  churn_rate numeric,
  created_at timestamptz
);
```

**SQL Pattern:**
```sql
SELECT
  DATE_TRUNC('week', NOW())::date - (INTERVAL '1 week' * (row_number() OVER (ORDER BY DATE_TRUNC('week', NOW()) DESC) - 1))::int as week_of,
  COUNT(*) as enrollments_active,
  COUNT(CASE WHEN status IN ('paused', 'archived') THEN 1 END) as enrollments_churned
FROM academy_user_enrollments
WHERE started_at >= NOW() - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', NOW())
ORDER BY week_of DESC;
```

**Visualization Type:** Line chart (Recharts)
**Component Name:** `ChurnRateTrendChart.tsx`

#### 2.1.3 Average Progress & Progression Curves

**Data Source:** `academy_user_lesson_attempts` (progress_percent, status)
**Visualization:** Distribution histogram (students on X, progress % on Y)
**Metric Logic:**
- Bucket students by completion stage: 0-25%, 25-50%, 50-75%, 75-100% (use `progress_percent` average per user)
- Show count of students in each bucket
- Highlight median and mean lines
- Compare this cohort to previous cohort (if data available)

**SQL Pattern:**
```sql
SELECT
  CASE
    WHEN AVG(aula.progress_percent) < 25 THEN '0-25%'
    WHEN AVG(aula.progress_percent) < 50 THEN '25-50%'
    WHEN AVG(aula.progress_percent) < 75 THEN '50-75%'
    ELSE '75-100%'
  END as progress_bucket,
  COUNT(DISTINCT aula.user_id) as student_count
FROM academy_user_lesson_attempts aula
GROUP BY progress_bucket
ORDER BY progress_bucket ASC;
```

**Visualization Type:** Bar chart + distribution overlay
**Component Name:** `ProgressionDistributionChart.tsx`

#### 2.1.4 DAU / WAU / MAU Metrics

**Data Source:** `academy_learning_events` (user_id, occurred_at)
**Visualization:** 3 metric cards + 4-week line trend
**Metric Logic:**
- DAU: Distinct users with ≥1 event today
- WAU: Distinct users with ≥1 event this week
- MAU: Distinct users with ≥1 event this month
- Engagement rate: DAU / MAU * 100 (%)

**Aggregation Table:** `academy_engagement_daily`
```sql
CREATE TABLE academy_engagement_daily (
  id uuid PRIMARY KEY,
  date date NOT NULL UNIQUE,
  dau integer,
  wau integer,
  mau integer,
  engagement_rate numeric,
  created_at timestamptz
);
```

**Visualization Type:** 3-card metric row + line chart trend
**Component Name:** `EngagementMetricsCard.tsx`

#### 2.1.5 Enrollment Funnel

**Data Source:** `academy_learning_events` (event_type), user progression stages
**Visualization:** Funnel chart (5 stages, widths proportional to user count)
**Funnel Stages:**
1. Enrolled (status = 'active')
2. Started (lesson_started event exists)
3. 25% Progress (avg progress_percent >= 25)
4. 50% Progress (avg progress_percent >= 50)
5. 75% Progress (avg progress_percent >= 75)
6. Completed (avg progress_percent = 100)

**SQL Pattern:**
```sql
WITH user_stages AS (
  SELECT
    aue.user_id,
    CASE
      WHEN aue.status = 'active' THEN 'Enrolled'
      WHEN EXISTS (SELECT 1 FROM academy_learning_events WHERE user_id = aue.user_id AND event_type = 'lesson_started') THEN 'Started'
      WHEN (SELECT AVG(progress_percent) FROM academy_user_lesson_attempts WHERE user_id = aue.user_id) >= 25 THEN '25% Progress'
      WHEN (SELECT AVG(progress_percent) FROM academy_user_lesson_attempts WHERE user_id = aue.user_id) >= 50 THEN '50% Progress'
      WHEN (SELECT AVG(progress_percent) FROM academy_user_lesson_attempts WHERE user_id = aue.user_id) >= 75 THEN '75% Progress'
      WHEN (SELECT AVG(progress_percent) FROM academy_user_lesson_attempts WHERE user_id = aue.user_id) = 100 THEN 'Completed'
    END as stage
  FROM academy_user_enrollments aue
)
SELECT stage, COUNT(*) as user_count
FROM user_stages
GROUP BY stage
ORDER BY CASE stage
  WHEN 'Enrolled' THEN 1
  WHEN 'Started' THEN 2
  WHEN '25% Progress' THEN 3
  WHEN '50% Progress' THEN 4
  WHEN '75% Progress' THEN 5
  WHEN 'Completed' THEN 6
END;
```

**Visualization Type:** Funnel chart (recharts or custom SVG)
**Component Name:** `EnrollmentFunnelChart.tsx`

---

### 2.2 Content Effectiveness Dashboard

**Purpose:** Identify high-impact and underperforming lessons; optimize curriculum sequencing.

**Location:** `/admin/academy/content` (new admin section)
**Component:** `components/admin/academy-content-effectiveness.tsx`
**Layout:** Table + drill-down modal
**Update Frequency:** Daily aggregation (9 PM UTC)
**Mobile Layout:** Table becomes scrollable card stack; click lesson row to expand details.

#### 2.2.1 Per-Lesson Performance Metrics

**Data Source:** `academy_user_lesson_attempts`, `academy_lesson_blocks`, aggregated events
**Visualization:** Sortable data table
**Columns:**
- Lesson Title
- Module (link)
- Completion Rate (%) [COUNT(status='passed') / COUNT(*)]
- Avg Time Spent (minutes) [from event timestamps]
- Drop-off Rate (%) [started but not completed]
- Avg Assessment Score (%) [if lesson has assessments]
- Status (High-Performing, Standard, At-Risk)

**Aggregation Table:** `academy_lesson_performance_daily`
```sql
CREATE TABLE academy_lesson_performance_daily (
  id uuid PRIMARY KEY,
  lesson_id uuid NOT NULL REFERENCES academy_lessons(id),
  date date NOT NULL,
  attempts_started integer,
  attempts_passed integer,
  avg_time_minutes numeric,
  avg_assessment_score numeric,
  created_at timestamptz,
  UNIQUE (lesson_id, date)
);
```

**SQL Pattern:**
```sql
SELECT
  al.id,
  al.title,
  am.title as module_title,
  COUNT(CASE WHEN aula.status = 'passed' THEN 1 END)::float / COUNT(*) * 100 as completion_pct,
  AVG(EXTRACT(EPOCH FROM (aula.completed_at - aula.started_at))/60) as avg_time_minutes,
  COUNT(CASE WHEN aula.status IN ('in_progress', 'submitted') THEN 1 END)::float / COUNT(*) * 100 as dropout_pct,
  AVG(auaa.score) as avg_assessment_score
FROM academy_lessons al
LEFT JOIN academy_modules am ON al.module_id = am.id
LEFT JOIN academy_user_lesson_attempts aula ON aula.lesson_id = al.id
LEFT JOIN academy_assessments aa ON aa.lesson_id = al.id
LEFT JOIN academy_user_assessment_attempts auaa ON auaa.assessment_id = aa.id
WHERE al.is_published = true
  AND aula.created_at >= NOW() - INTERVAL '30 days'
GROUP BY al.id, am.title
ORDER BY completion_pct DESC;
```

**Visualization Type:** Data table (shadcn/ui Table) with expandable rows
**Component Name:** `LessonPerformanceTable.tsx`

#### 2.2.2 Drop-off Analysis & At-Risk Lessons

**Data Source:** `academy_user_lesson_attempts` (in_progress not progressing for 7+ days)
**Visualization:** Horizontal bar chart (lesson title on Y, dropout count on X)
**Metric Logic:**
- Identify lessons where students start but don't progress after 7 days
- Rank by absolute count + by percentage
- Flag lessons with > 40% dropout rate as "At-Risk"
- Suggest content improvements (break into smaller blocks, add examples, etc.)

**SQL Pattern:**
```sql
SELECT
  al.title,
  COUNT(DISTINCT aula.user_id) as students_stuck,
  COUNT(CASE WHEN aula.status = 'passed' THEN 1 END)::float / COUNT(*) * 100 as pass_rate
FROM academy_user_lesson_attempts aula
JOIN academy_lessons al ON aula.lesson_id = al.id
WHERE aula.status = 'in_progress'
  AND (NOW() - aula.updated_at) > INTERVAL '7 days'
GROUP BY al.id
HAVING COUNT(*) > 5
ORDER BY students_stuck DESC;
```

**Visualization Type:** Horizontal bar + status badge
**Component Name:** `DropoffAnalysisChart.tsx`

#### 2.2.3 Assessment Difficulty Analysis

**Data Source:** `academy_user_assessment_attempts` (score distribution)
**Visualization:** Box plot (lesson on X, score distribution on Y)
**Metric Logic:**
- Show median, Q1, Q3, min, max score per assessment
- Flag assessments with median < 60% (too hard), > 95% (too easy)
- Suggest rebalancing (adjust mastery_threshold, add formative practice, etc.)

**SQL Pattern:**
```sql
SELECT
  al.title,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY auaa.score) as q1,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY auaa.score) as median,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY auaa.score) as q3,
  MIN(auaa.score) as min_score,
  MAX(auaa.score) as max_score,
  COUNT(*) as attempt_count
FROM academy_user_assessment_attempts auaa
JOIN academy_assessments aa ON auaa.assessment_id = aa.id
LEFT JOIN academy_lessons al ON aa.lesson_id = al.id
WHERE auaa.created_at >= NOW() - INTERVAL '30 days'
GROUP BY al.id, al.title
ORDER BY median ASC;
```

**Visualization Type:** Box plot chart (recharts or custom)
**Component Name:** `AssessmentDifficultyChart.tsx`

#### 2.2.4 Most-Skipped Activities

**Data Source:** `academy_learning_events` (block_completed), lesson blocks with estimated_minutes
**Visualization:** Table (activity, module, skip count, skip rate, prerequisite)
**Metric Logic:**
- Track which blocks are skipped most (block_completed count vs total lesson_started)
- Flag blocks with > 30% skip rate
- Investigate if skipped blocks are optional (metadata flag) or required

**SQL Pattern:**
```sql
SELECT
  alb.id,
  alb.title,
  alb.block_type,
  al.title as lesson_title,
  COUNT(DISTINCT ale_started.user_id) as lesson_starts,
  COUNT(DISTINCT ale_completed.user_id) as block_completions,
  (COUNT(DISTINCT ale_started.user_id) - COUNT(DISTINCT ale_completed.user_id))::float / COUNT(DISTINCT ale_started.user_id) * 100 as skip_rate
FROM academy_lesson_blocks alb
JOIN academy_lessons al ON alb.lesson_id = al.id
LEFT JOIN academy_learning_events ale_started ON ale_started.lesson_id = al.id AND ale_started.event_type = 'lesson_started'
LEFT JOIN academy_learning_events ale_completed ON ale_completed.lesson_id = al.id AND ale_completed.event_type = 'block_completed'
GROUP BY alb.id, al.title
HAVING COUNT(DISTINCT ale_started.user_id) > 10
ORDER BY skip_rate DESC;
```

**Visualization Type:** Data table with filter
**Component Name:** `SkippedActivitiesTable.tsx`

#### 2.2.5 Content Quality Signals

**Data Source:** Review accuracy + assessment score correlation
**Visualization:** Heatmap (lesson vs competency, colored by quality score)
**Metric Logic:**
- Quality Score = (avg_review_accuracy_from_lesson * 0.4) + (avg_assessment_score * 0.3) + (completion_rate * 0.3)
- Heatmap: lesson on Y-axis, competency on X-axis
- Color: green (> 80%), amber (60-80%), red (< 60%)
- Hover shows raw metrics

**SQL Pattern:**
```sql
SELECT
  al.title,
  ac.title as competency_title,
  AVG(ara.is_correct::int) * 100 as review_accuracy,
  AVG(auaa.score) as assessment_score,
  COUNT(CASE WHEN aula.status = 'passed' THEN 1 END)::float / COUNT(DISTINCT aula.user_id) * 100 as completion_rate,
  ((AVG(ara.is_correct::int) * 0.4) + (AVG(auaa.score) * 0.3) + (COUNT(CASE WHEN aula.status = 'passed' THEN 1 END)::float / COUNT(DISTINCT aula.user_id) * 0.3)) * 100 as quality_score
FROM academy_lessons al
LEFT JOIN academy_user_lesson_attempts aula ON aula.lesson_id = al.id
LEFT JOIN academy_lesson_competencies alc ON alc.lesson_id = al.id
LEFT JOIN academy_competencies ac ON alc.competency_id = ac.id
LEFT JOIN academy_review_queue aq ON aq.competency_id = ac.id AND aq.source_lesson_id = al.id
LEFT JOIN academy_review_attempts ara ON ara.queue_id = aq.id
LEFT JOIN academy_assessments aa ON aa.lesson_id = al.id
LEFT JOIN academy_user_assessment_attempts auaa ON auaa.assessment_id = aa.id
GROUP BY al.id, ac.id
HAVING COUNT(*) > 5
ORDER BY quality_score DESC;
```

**Visualization Type:** Heatmap (d3-based or custom Canvas)
**Component Name:** `ContentQualityHeatmap.tsx`

---

### 2.3 Competency Heatmap

**Purpose:** Identify cohort-wide weak and strong competencies; prioritize content improvements.

**Location:** `/admin/academy/competencies` (new admin section)
**Component:** `components/admin/competency-cohort-heatmap.tsx`
**Update Frequency:** Daily aggregation (6 PM UTC)
**Mobile Layout:** Heatmap becomes scrollable horizontally; competency titles rotate 45 degrees.

#### 2.3.1 Cohort-Wide Mastery Distribution

**Data Source:** `academy_user_competency_mastery` (all users, all competencies)
**Visualization:** Grid heatmap (competency names on Y, score buckets on X)
**Metric Logic:**
- X-axis: score ranges (0-25%, 25-50%, 50-75%, 75-90%, 90-100%)
- Y-axis: all 6 competencies
- Cell color: count of students in that range (darker = more students)
- Hover shows exact count

**SQL Pattern:**
```sql
SELECT
  ac.title as competency,
  CASE
    WHEN aucm.current_score < 25 THEN '0-25%'
    WHEN aucm.current_score < 50 THEN '25-50%'
    WHEN aucm.current_score < 75 THEN '50-75%'
    WHEN aucm.current_score < 90 THEN '75-90%'
    ELSE '90-100%'
  END as score_bucket,
  COUNT(DISTINCT aucm.user_id) as student_count
FROM academy_user_competency_mastery aucm
JOIN academy_competencies ac ON aucm.competency_id = ac.id
GROUP BY ac.title, score_bucket
ORDER BY ac.title ASC;
```

**Visualization Type:** Heatmap grid (d3 or Recharts ScatterChart repurposed)
**Component Name:** `CompetencyMasteryHeatmap.tsx`

#### 2.3.2 Weak Competency Identification

**Data Source:** `academy_user_competency_mastery` (filtering needsRemediation)
**Visualization:** Ranked list (competency, avg score, % needing remediation, trend)
**Metric Logic:**
- Sort by: (needsRemediation count / total users) descending
- Include: avg score, median score, % needing remediation, trend (up/down/flat week-over-week)
- Flag competencies with > 30% remediation as "Priority Improvement"

**SQL Pattern:**
```sql
SELECT
  ac.id,
  ac.title,
  AVG(aucm.current_score) as avg_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY aucm.current_score) as median_score,
  COUNT(CASE WHEN aucm.needs_remediation THEN 1 END)::float / COUNT(*) * 100 as remediation_pct
FROM academy_user_competency_mastery aucm
JOIN academy_competencies ac ON aucm.competency_id = ac.id
GROUP BY ac.id
ORDER BY remediation_pct DESC;
```

**Visualization Type:** Data table with color-coded badges
**Component Name:** `WeakCompetencyTable.tsx`

#### 2.3.3 Content Gap Flags

**Data Source:** Competency mastery + lesson completion correlation
**Visualization:** Card list with action recommendations
**Logic:**
- For each competency with avg score < 65%:
  - Check: Are all lessons for this competency completed by > 70% of students?
  - If no: Flag as "content gap" (students can't access lessons)
  - If yes but score still low: Flag as "effectiveness gap" (lesson content needs improvement)
  - Recommend: Add/fix lessons, reorder prerequisites, add practice blocks

**Component:** `ContentGapAnalysis.tsx`

---

### 2.4 Learning Path Optimization

**Purpose:** Recommend curriculum reordering, prerequisite effectiveness, and bottleneck resolution.

**Location:** `/admin/academy/optimization` (new admin section)
**Component:** `components/admin/learning-path-optimizer.tsx`
**Layout:** Flowchart (module sequence) + optimization recommendations panel
**Update Frequency:** Weekly (Monday 9 AM UTC)
**Mobile Layout:** Flowchart becomes vertical scroll; recommendations panel expands below.

#### 2.4.1 Suggested Curriculum Reordering

**Data Source:** Prerequisite completion rates, competency progression order
**Visualization:** Current module sequence (drag-drop) + suggested sequence
**Metric Logic:**
- Current order: positions from `academy_modules.position`
- For each module pair (A→B):
  - Calculate: (students who completed A then B in sequence) / (total students who did both)
  - If completion rate < 60%: suggest moving A before B or adding remediation
  - Prefer ordering by prerequisite DAG (dependency graph)

**SQL Pattern:**
```sql
-- Prerequisites effectiveness
WITH module_pairs AS (
  SELECT
    LEAD(al.module_id) OVER (PARTITION BY aula.user_id ORDER BY aula.completed_at) as next_module,
    al.module_id as curr_module,
    ROW_NUMBER() OVER (PARTITION BY aula.user_id ORDER BY aula.completed_at) as seq_pos
  FROM academy_user_lesson_attempts aula
  JOIN academy_lessons al ON aula.lesson_id = al.id
  WHERE aula.status = 'passed'
)
SELECT
  am1.title as current_module,
  am2.title as next_module,
  COUNT(*) as completion_pairs,
  COUNT(*) * 100 / (SELECT COUNT(DISTINCT user_id) FROM academy_user_lesson_attempts) as completion_rate
FROM module_pairs mp
JOIN academy_modules am1 ON mp.curr_module = am1.id
LEFT JOIN academy_modules am2 ON mp.next_module = am2.id
WHERE mp.next_module IS NOT NULL
GROUP BY am1.id, am2.id
ORDER BY completion_rate DESC;
```

**Visualization Type:** Draggable flowchart (React Flow library) + suggestion cards
**Component Name:** `CurriculumReorderingTool.tsx`

#### 2.4.2 Prerequisite Effectiveness

**Data Source:** `academy_lessons.prerequisite_lesson_ids` + completion sequences
**Visualization:** Table (prerequisite, dependent lesson, effectiveness %)
**Metric Logic:**
- For each prerequisite dependency:
  - Calculate: (students with prerequisite passing → dependent passing) / (students attempting dependent with prerequisite completed)
  - Effectiveness: if > 80% ✓, if 50-80% ⚠️, if < 50% ✗
  - Suggest removal or content reinforcement

**SQL Pattern:**
```sql
SELECT
  al_prereq.title as prerequisite_lesson,
  al_dependent.title as dependent_lesson,
  COUNT(DISTINCT CASE WHEN aula_prereq.status = 'passed' AND aula_dep.status = 'passed' THEN aula_dep.user_id END)::float /
    COUNT(DISTINCT CASE WHEN aula_dep.status IS NOT NULL THEN aula_dep.user_id END) * 100 as effectiveness_pct
FROM academy_lessons al_dependent
, LATERAL (
  SELECT UNNEST(al_dependent.prerequisite_lesson_ids) as prereq_id
) as prereqs
JOIN academy_lessons al_prereq ON prereqs.prereq_id = al_prereq.id
LEFT JOIN academy_user_lesson_attempts aula_prereq ON aula_prereq.lesson_id = al_prereq.id AND aula_prereq.status = 'passed'
LEFT JOIN academy_user_lesson_attempts aula_dep ON aula_dep.lesson_id = al_dependent.id AND aula_dep.user_id = aula_prereq.user_id
GROUP BY al_prereq.id, al_dependent.id
ORDER BY effectiveness_pct ASC;
```

**Visualization Type:** Data table with status badges
**Component Name:** `PrerequisiteEffectivenessTable.tsx`

#### 2.4.3 Bottleneck Identification

**Data Source:** Module completion rates + time spent patterns
**Visualization:** Funnel chart with drop-off points highlighted
**Metric Logic:**
- Identify modules where completion drops by > 20% from previous module
- Investigate: Is it difficulty? Length? Prerequisite gap? Pacing?
- Recommend: Split module, add guided practice, reorder, add prerequisites

**SQL Pattern:**
```sql
SELECT
  am.title as module,
  COUNT(DISTINCT CASE WHEN aula.status = 'passed' THEN aula.user_id END) as completed,
  COUNT(DISTINCT aula.user_id) as started,
  COUNT(DISTINCT CASE WHEN aula.status = 'passed' THEN aula.user_id END)::float / COUNT(DISTINCT aula.user_id) * 100 as completion_rate,
  LAG(COUNT(DISTINCT CASE WHEN aula.status = 'passed' THEN aula.user_id END)::float / COUNT(DISTINCT aula.user_id) * 100) OVER (ORDER BY am.position) as prev_completion_rate
FROM academy_modules am
LEFT JOIN academy_lessons al ON al.module_id = am.id
LEFT JOIN academy_user_lesson_attempts aula ON aula.lesson_id = al.id
GROUP BY am.id
ORDER BY am.position ASC;
```

**Visualization Type:** Funnel chart with annotations
**Component Name:** `BottleneckFunnelChart.tsx`

---

## Part 3: Data Model Changes & Infrastructure

### 3.1 New Events to Track

Expand `academy_learning_event_type` enum to include:

```sql
-- Proposed additions to academy_learning_event_type enum:
'page_viewed',              -- User lands on lesson/module page
'time_on_block',            -- Track seconds spent on each block
'activity_interaction',     -- Quiz answer, drag-drop, etc.
'hint_used',                -- User requests hint/solution
'ai_coach_invoked'          -- User asks AI Coach about a lesson
```

**Implementation:**
- Add to enum in migration
- Update `SupabaseAcademyLearningEventRepository.insertEvent()` to accept new types
- Emit these events from:
  - `page_viewed`: useEffect in lesson component (track page mount)
  - `time_on_block`: useEffect with debounced cleanup (track session duration)
  - `activity_interaction`: form/input onChange handlers
  - `hint_used`: CTA button onClick
  - `ai_coach_invoked`: AI Coach modal trigger

### 3.2 New Aggregation Tables

Create materialized views or scheduled jobs (using Supabase Edge Functions) to populate:

1. **`academy_user_competency_mastery_history`** (daily snapshots)
   - Captures score history for trend analysis
   - Populated daily at 2 AM UTC
   - Retention: 1 year rolling

2. **`academy_lesson_performance_daily`** (daily aggregation)
   - Per-lesson metrics (completion rate, avg time, dropout)
   - Populated daily at 2 AM UTC

3. **`academy_engagement_daily`** (daily engagement metrics)
   - DAU, WAU, MAU, engagement rate
   - Populated daily at 2 AM UTC

4. **`academy_cohort_churn_weekly`** (weekly churn)
   - Churn rate by week
   - Populated Mondays at 1 AM UTC

5. **`academy_user_badges`** (real-time)
   - User-earned badges (gamification)
   - Trigger on assessment_passed / streak_complete / etc.

6. **`academy_user_certificates`** (on-demand)
   - Module completion certificates
   - Populated when module completion reached

7. **`academy_user_level_history`** (real-time)
   - XP milestone tracking
   - Populated on level-up event

### 3.3 Aggregation Job Implementation

Use Supabase Edge Functions (`supabase/functions/academy-aggregations/`) to run scheduled aggregations:

**`aggregation-daily.ts`:**
- Runs daily at 2 AM UTC
- Populates: `academy_user_competency_mastery_history`, `academy_lesson_performance_daily`, `academy_engagement_daily`
- Upserts to avoid duplicates
- Includes error alerting to Sentry

**`aggregation-weekly.ts`:**
- Runs Monday at 1 AM UTC
- Populates: `academy_cohort_churn_weekly`

**Monitoring:**
- Log execution start/end in Sentry
- Alert if job takes > 30 min or fails
- Store aggregation state (last_run, row_count) in `academy_system_state` table

### 3.4 Retention Cohort Tracking

**Purpose:** Understand how long students stay engaged and identify drop-off windows.

**New Table:** `academy_retention_cohorts`
```sql
CREATE TABLE academy_retention_cohorts (
  id uuid PRIMARY KEY,
  enrollment_cohort_date date NOT NULL,
  retention_window_days integer NOT NULL,
  enrolled_count integer,
  retained_count integer,
  retention_rate numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz
);
```

**Weekly Job:**
- For each past week with enrollments:
  - Count students active in week 0 (enrollment week)
  - Count students still active 1 week later, 2 weeks later, ..., 12 weeks later
  - Calculate retention rate (retained / enrolled * 100)
  - Store in `academy_retention_cohorts`

**Visualization:** Cohort retention table (Amplitude-style), showing % retention by week for each enrollment cohort.

---

## Part 4: Component Architecture & Locations

### 4.1 Directory Structure

```
components/academy/
├── academy-learning-dashboard.tsx        # Student landing (1.1)
├── study-time-widget.tsx                 # 1.1.1
├── velocity-card.tsx                     # 1.1.2
├── competency-radar-chart.tsx            # 1.1.3
├── streak-tracker.tsx                    # 1.1.4
├── xp-progress-card.tsx                  # 1.1.5
├── completion-predictor-card.tsx         # 1.1.6
├── competency-deep-dive.tsx              # 1.2
├── competency-trend-chart.tsx            # 1.2.1
├── competency-lessons-table.tsx          # 1.2.2
├── remediation-recommendations.tsx       # 1.2.3
├── ai-coach-narrative-card.tsx           # 1.2.4
├── performance-analytics.tsx             # 1.3
├── assessment-trend-chart.tsx            # 1.3.1
├── time-efficiency-chart.tsx             # 1.3.2
├── review-accuracy-chart.tsx             # 1.3.3
├── top-missed-topics-card.tsx            # 1.3.4
├── top-performed-topics-card.tsx         # 1.3.4
├── achievements-gallery.tsx              # 1.4
├── badge-gallery-grid.tsx                # 1.4.1
├── certificate-tracker.tsx               # 1.4.2
├── certificate-modal.tsx                 # 1.4.2
├── xp-milestone-timeline.tsx             # 1.4.3

components/admin/academy/
├── academy-cohort-dashboard.tsx          # Admin landing (2.1)
├── cohort-metrics-overview.tsx           # 2.1.1
├── churn-rate-trend-chart.tsx            # 2.1.2
├── progression-distribution-chart.tsx    # 2.1.3
├── engagement-metrics-card.tsx           # 2.1.4
├── enrollment-funnel-chart.tsx           # 2.1.5
├── academy-content-effectiveness.tsx     # 2.2
├── lesson-performance-table.tsx          # 2.2.1
├── dropoff-analysis-chart.tsx            # 2.2.2
├── assessment-difficulty-chart.tsx       # 2.2.3
├── skipped-activities-table.tsx          # 2.2.4
├── content-quality-heatmap.tsx           # 2.2.5
├── competency-cohort-heatmap.tsx         # 2.3
├── competency-mastery-heatmap.tsx        # 2.3.1
├── weak-competency-table.tsx             # 2.3.2
├── content-gap-analysis.tsx              # 2.3.3
├── learning-path-optimizer.tsx           # 2.4
├── curriculum-reordering-tool.tsx        # 2.4.1
├── prerequisite-effectiveness-table.tsx  # 2.4.2
├── bottleneck-funnel-chart.tsx           # 2.4.3

app/members/academy/
├── progress/page.tsx                     # Student dashboard (existing, enhanced)
├── competencies/
│   └── [competencyKey]/page.tsx          # 1.2 (new)
├── analytics/page.tsx                    # 1.3 (new)
├── achievements/page.tsx                 # 1.4 (new)

app/admin/academy/
├── page.tsx                              # 2.1 cohort dashboard (new)
├── content/page.tsx                      # 2.2 content effectiveness (new)
├── competencies/page.tsx                 # 2.3 competency heatmap (new)
├── optimization/page.tsx                 # 2.4 learning path optimizer (new)

app/api/academy-v3/
├── ai-narrative/route.ts                 # POST /api/academy-v3/ai-narrative (new)
├── certificate/[moduleId]/route.ts       # GET /api/academy-v3/certificate/:moduleId (new, PDF generation)
```

### 4.2 Styling Guidelines (per BRAND_GUIDELINES.md)

- **Color Scheme:** Emerald (#10B981) primary, Champagne (#F3E5AB) accents, Onyx (#0A0A0B) backgrounds
- **Cards:** Use `glass-card-heavy` utility class for all containers
- **Typography:**
  - Page titles: `Playfair Display` (serif)
  - Body text: `Inter` (sans)
  - Data/numbers: `Geist Mono` (monospace)
- **Icons:** Lucide React, stroke-width 1.5
- **Charts:** Emerald fill/stroke, Champagne accents, dark background
- **Mobile First:** All components must stack on small screens; use `hidden md:flex`, `md:grid-cols-3`, etc.

### 4.3 Chart Libraries

- **Recharts:** Primary charting library (line, bar, scatter, radar, funnel)
- **Heatmap:** d3 integration or custom Canvas component
- **React Flow:** For curriculum reordering flowchart
- **React Calendar Heatmap:** For streak calendar view

---

## Part 5: Update Frequency & Aggregation Strategy

| Component | Data Source | Update Frequency | Aggregation? |
|-----------|-------------|------------------|--------------|
| Daily study time | Learning events (real-time) | Hourly | No |
| Velocity | Lesson attempts | Daily (9 AM) | Yes |
| Competency radar | Mastery records | Real-time | No |
| Streak tracker | Learning events | Daily (1 AM) | Yes |
| XP progress | Learning events | Real-time | No |
| Completion predictor | Lesson attempts + velocity | Weekly (Mon 9 AM) | Yes |
| Competency trend | Mastery history snapshots | Real-time | Yes (daily snapshots) |
| Assessment trends | Assessment attempts | Real-time | No |
| Review accuracy | Review attempts | Real-time | No |
| Time efficiency | Event timestamps | Daily (9 AM) | Yes |
| Cohort metrics | Enrollments + attempts | Hourly | No |
| Churn rate | Enrollments | Weekly (Mon 1 AM) | Yes |
| Lesson performance | Attempts + events | Daily (2 AM) | Yes |
| DAU/WAU/MAU | Learning events | Daily (2 AM) | Yes |
| Content quality | Reviews + assessments | Daily (6 PM) | Yes |
| Cohort heatmap | Mastery records | Daily (6 PM) | No (aggregated query) |
| Retention cohorts | Enrollments + events | Weekly (Mon 1 AM) | Yes |

---

## Part 6: API Endpoints (New)

### 6.1 Student-Facing APIs

**POST `/api/academy-v3/ai-narrative`**
- Request: `{ competencyId: string, userId: string }`
- Response: `{ narrative: string, strengths: string[], growthAreas: string[] }`
- Cache: 24 hours (Redis key: `ai-narrative:${userId}:${competencyId}`)
- Backend: Calls OpenAI API with mastery profile

**GET `/api/academy-v3/certificate/[moduleId]`**
- Request: Query params (moduleId, userId)
- Response: PDF binary (Content-Type: application/pdf)
- Backend: Generates certificate PDF using PDFKit, embeds QR code

**GET `/api/academy-v3/analytics/dashboard`**
- Request: `{ userId: string }`
- Response: Aggregated dashboard data (study time, velocity, competency radar data, etc.)
- Cache: 1 hour

**GET `/api/academy-v3/analytics/competency/[competencyKey]`**
- Request: `{ userId: string }`
- Response: Deep-dive data (trend, lessons, recommendations, mastery history)
- Cache: 30 minutes

### 6.2 Admin-Facing APIs

**GET `/api/admin/academy/cohort-dashboard`**
- Response: Cohort metrics (enrollments, completion rate, churn, DAU/WAU/MAU, funnel)
- Cache: 1 hour

**GET `/api/admin/academy/content/performance`**
- Query params: `{ lessonId?: string, moduleId?: string, sortBy?: 'completion|time|dropout' }`
- Response: Lesson performance table data
- Cache: 1 hour

**GET `/api/admin/academy/competencies/heatmap`**
- Response: Heatmap data (competency scores by bucket)
- Cache: 1 hour

**GET `/api/admin/academy/optimization/bottlenecks`**
- Response: Funnel analysis + bottleneck identification
- Cache: 1 hour

---

## Part 7: Performance Considerations

### 7.1 Query Optimization

- **Indexes:** All aggregation queries require indexes on (user_id, created_at/occurred_at), (competency_id, user_id), (lesson_id, status)
- **Partitioning:** Consider time-series partitioning for `academy_learning_events` and `academy_user_assessment_attempts` if they grow > 10M rows
- **Materialized Views:** Use Postgres materialized views for complex aggregations; refresh daily during off-hours

### 7.2 Caching Strategy

- **Redis:** Cache dashboard API responses (1 hour TTL for student, 30 min for admin)
- **Browser Cache:** Use `Cache-Control: public, max-age=3600` for static chart/table APIs
- **Client-Side:** Implement React Query (TanStack Query) for refetch optimization

### 7.3 Real-Time Updates

- **WebSocket:** Optional—for real-time XP/badge updates, emit `academy:badge_earned`, `academy:level_up` events
- **Polling:** Fall back to 30-second polling if WebSocket unavailable
- **Optimistic Updates:** Client-side optimistic state for UX feel

---

## Part 8: Rollout Phases

### Phase 1: Student-Facing Basics (Week 1-2)
1. Deploy aggregation tables & scheduled jobs
2. Implement 1.1 (Learning Dashboard widgets)
3. Add XP/badge earning logic
4. Test with 5 beta students

### Phase 2: Student Deep Dives (Week 3-4)
1. Implement 1.2 (Competency deep dive)
2. Implement 1.3 (Performance analytics)
3. Add AI narrative endpoint
4. Beta test with 20 students

### Phase 3: Gamification (Week 5)
1. Implement 1.4 (Achievements, certificates, level progression)
2. Deploy certificate generation API
3. Add badge earning triggers
4. Full student rollout

### Phase 4: Admin Dashboard (Week 6-8)
1. Implement 2.1 (Cohort dashboard)
2. Implement 2.2 (Content effectiveness)
3. Implement 2.3 (Competency heatmap)
4. Beta test with 3 admins, gather feedback

### Phase 5: Admin Optimization (Week 9-10)
1. Implement 2.4 (Learning path optimizer)
2. Add curriculum reordering UI
3. Publish recommendations engine
4. Full admin rollout

---

## Part 9: Success Metrics & Monitoring

### 9.1 Student Engagement KPIs
- Weekly Active Users (WAU) in Academy
- Avg lessons completed per student per week
- Streak maintenance rate (% maintaining > 3-day streak)
- Review queue completion rate (% of due items completed)
- Time-to-mastery (days to 70%+ on all competencies)

### 9.2 Content Effectiveness KPIs
- Overall lesson completion rate
- Assessment pass rate (1st attempt)
- Avg competency mastery score
- Retention cohort: % retained at 4 weeks, 8 weeks, 12 weeks

### 9.3 System Health KPIs
- API response time (p95 < 500ms)
- Aggregation job success rate (> 99%)
- Dashboard load time (< 2s)
- Error rate on reporting endpoints (< 0.1%)

### 9.4 Monitoring & Alerting
- Sentry integration: Track 500 errors on new reporting endpoints
- CloudWatch (or Datadog): Monitor aggregation job duration, API latencies
- Alerts: Aggregation job fails, API response time exceeds 1s, > 1% error rate

---

## Part 10: Future Enhancements (Out of Scope)

1. **Predictive Analytics:** ML model to predict student completion probability, recommend optimal lesson sequencing
2. **Collaborative Learning:** Leaderboard (global/cohort), study groups, peer review
3. **Adaptive Content:** Dynamically adjust lesson difficulty based on student performance
4. **Mobile App:** Native mobile apps with offline learning, local progress caching
5. **LMS Integration:** Export grade/transcript to external LMS systems
6. **Third-Party Analytics:** Mixpanel/Amplitude integration for advanced funnel analysis

---

## Appendix: Implementation Checklist

### Database Changes
- [ ] Create `academy_user_competency_mastery_history` table + migration
- [ ] Create `academy_lesson_performance_daily` table + migration
- [ ] Create `academy_engagement_daily` table + migration
- [ ] Create `academy_cohort_churn_weekly` table + migration
- [ ] Create `academy_user_badges` table + migration
- [ ] Create `academy_user_certificates` table + migration
- [ ] Create `academy_user_level_history` table + migration
- [ ] Extend `academy_learning_event_type` enum with new event types
- [ ] Create covering indexes on all aggregation tables
- [ ] Create scheduled Edge Functions for daily/weekly aggregations

### Backend APIs
- [ ] `/api/academy-v3/ai-narrative` (POST) with OpenAI integration
- [ ] `/api/academy-v3/certificate/[moduleId]` (GET) with PDF generation
- [ ] `/api/academy-v3/analytics/dashboard` (GET) aggregation endpoint
- [ ] `/api/academy-v3/analytics/competency/[competencyKey]` (GET) deep-dive endpoint
- [ ] `/api/admin/academy/*` admin-facing endpoints (4x)
- [ ] Redis caching layer for all reporting endpoints
- [ ] Error handling + Sentry integration

### Frontend Components (28 components total)
- [ ] Student dashboard: 6 widgets (1.1.1-1.1.6)
- [ ] Competency deep dive: 4 components (1.2.1-1.2.4)
- [ ] Performance analytics: 4 components (1.3.1-1.3.4)
- [ ] Achievements: 3 components (1.4.1-1.4.3)
- [ ] Admin cohort: 5 components (2.1.1-2.1.5)
- [ ] Admin content: 5 components (2.2.1-2.2.5)
- [ ] Admin competencies: 3 components (2.3.1-2.3.3)
- [ ] Admin optimizer: 3 components (2.4.1-2.4.3)

### Routes (New Pages)
- [ ] `/members/academy/progress` (enhanced)
- [ ] `/members/academy/competencies/[competencyKey]` (new)
- [ ] `/members/academy/analytics` (new)
- [ ] `/members/academy/achievements` (new)
- [ ] `/admin/academy` (new)
- [ ] `/admin/academy/content` (new)
- [ ] `/admin/academy/competencies` (new)
- [ ] `/admin/academy/optimization` (new)

### Testing & QA
- [ ] Unit tests: Aggregation logic, XP calculation, badge earning
- [ ] E2E tests: Student dashboard flows, admin cohort view, drill-down interactions
- [ ] Performance tests: API response times, aggregation job duration
- [ ] Accessibility: axe-core audit on all charts and tables
- [ ] Mobile responsiveness: Test on 375px, 768px, 1024px widths

### Documentation
- [ ] API specification (OpenAPI/Swagger)
- [ ] Aggregation job runbook
- [ ] Student analytics user guide
- [ ] Admin analytics user guide
- [ ] Badge + certificate earning rules documentation

---

**End of Specification**

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-24 | Claude (Reporting Designer) | Initial comprehensive specification |

