# TITM Academy Training System - API Route Specifications

**Version:** 1.0
**Target Platform:** Next.js 16 App Router + Supabase
**Status:** Ready for Implementation (Codex)

---

## SECTION 1: API ROUTE SPECIFICATIONS

All routes follow the existing pattern in the codebase:
- **Response format:** `{ data?: T, error?: string }` or `{ success: boolean, data?: T, error?: string }`
- **Auth:** Member routes require valid Supabase session; admin routes require `isAdminUser()` check
- **Error handling:** Consistent error object with message and optional status code
- **Database:** Supabase PostgreSQL tables: `courses`, `lessons`, `lesson_progress`, `quiz_responses`, `user_learning_profiles`, `achievements`, `ai_tutor_sessions`

---

### MEMBER-FACING ROUTES

#### 1. `GET /api/academy/onboarding-status`

**Purpose:** Check if user has completed academy onboarding. Used to conditionally redirect on first visit.

**Auth:** Required (Supabase session)

**Request:**
```
GET /api/academy/onboarding-status
Headers: Authorization: Bearer {session.access_token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "completed": true,
    "profile_id": "uuid",
    "tier": "core|pro|executive",
    "learning_path_id": "uuid",
    "learning_path_name": "Options Scalping Fundamentals"
  }
}
```

**Response (404 - Not Started):**
```json
{
  "success": false,
  "data": {
    "completed": false,
    "profile_id": null
  }
}
```

**Supabase Query:**
```sql
SELECT id, tier, learning_path_id FROM user_learning_profiles
WHERE user_id = auth.uid() LIMIT 1;
```

**Error Cases:**
- 401: Unauthorized (invalid session)
- 500: Database error

---

#### 2. `POST /api/academy/onboarding`

**Purpose:** Submit onboarding assessment (5-step wizard). Creates `user_learning_profile`, determines initial learning path, creates first lesson assignment.

**Auth:** Required

**Request Body:**
```json
{
  "experience_level": "beginner|intermediate|advanced",
  "knowledge_quiz_answers": [
    { "question_id": 1, "answer": "A" },
    { "question_id": 2, "answer": "C" }
  ],
  "goals": ["scalping", "swing_trading", "income"],
  "time_per_week_minutes": 300,
  "broker_status": "no_account|have_account|prop_account",
  "broker_name": "thinkorswim|td_direct|interactive_brokers|null"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "profile_id": "uuid",
    "learning_path_id": "uuid",
    "learning_path_name": "Options Scalping Fundamentals",
    "tier": "core",
    "xp_earned": 50,
    "first_lesson_id": "uuid",
    "message": "Welcome! You're all set to begin your trading education."
  }
}
```

**Supabase Operations:**

1. **Insert into `user_learning_profiles`:**
```sql
INSERT INTO user_learning_profiles (
  user_id,
  experience_level,
  knowledge_score,
  tier,
  learning_path_id,
  goals_json,
  broker_status,
  broker_name,
  onboarded_at
) VALUES (
  auth.uid(),
  $1,
  $2,
  $3,
  $4,
  $5,
  $6,
  $7,
  NOW()
);
```

2. **Score knowledge quiz:** Calculate score from answers (number correct / total * 100)

3. **Determine tier:** Based on experience_level:
   - beginner → "core"
   - intermediate → "pro"
   - advanced → "executive"

4. **Select learning path:** Query `learning_paths` table based on goals (highest match). Example: if "scalping" in goals, select SPX Options Scalping Fundamentals path.

5. **Create first lesson assignment** (insert into `lesson_progress`):
```sql
INSERT INTO lesson_progress (
  user_id,
  learning_path_id,
  lesson_id,
  status,
  created_at
) VALUES (auth.uid(), $1, $2, 'not_started', NOW());
```

6. **Award XP:** Insert into `user_achievements` with 50 XP for "Onboarding Complete" achievement.

**Error Cases:**
- 400: Missing required fields
- 401: Unauthorized
- 500: Database error

---

#### 3. `GET /api/academy/dashboard`

**Purpose:** Get personalized dashboard data: current lesson, stats (XP, level, streak), recommendations, upcoming lessons.

**Auth:** Required

**Request:**
```
GET /api/academy/dashboard
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "xp_total": 1250,
      "level": 5,
      "level_name": "Trader",
      "xp_to_next_level": 450,
      "streak_days": 7,
      "streak_frozen": false
    },
    "current_lesson": {
      "id": "uuid",
      "title": "Greeks: Delta Explained",
      "course_id": "uuid",
      "course_name": "Options Fundamentals",
      "progress_percent": 45,
      "time_spent_minutes": 23,
      "status": "in_progress",
      "thumbnail_url": "https://...",
      "next_button_label": "Continue"
    },
    "learning_path": {
      "id": "uuid",
      "name": "Options Scalping Fundamentals",
      "description": "Master scalping strategies on SPX/NDX options",
      "courses": [
        {
          "id": "uuid",
          "title": "Options Fundamentals",
          "progress_percent": 60,
          "lesson_count": 8,
          "completed_count": 5
        }
      ]
    },
    "stats": {
      "total_lessons_completed": 12,
      "total_courses_completed": 1,
      "total_time_spent_hours": 8.5,
      "average_quiz_score": 82
    },
    "achievements": {
      "recent": [
        {
          "id": "uuid",
          "code": "first_lesson",
          "title": "First Step",
          "description": "Complete your first lesson",
          "icon_emoji": "🚀",
          "earned_at": "2025-02-09T10:30:00Z"
        }
      ],
      "total_count": 3,
      "next_achievement": {
        "code": "quiz_master",
        "title": "Quiz Master",
        "description": "Score 90+ on 5 quizzes",
        "progress": 3,
        "target": 5
      }
    },
    "recommendations": [
      {
        "lesson_id": "uuid",
        "title": "Vega and Volatility Risk",
        "reason": "Recommended based on your goals in scalping",
        "difficulty": "intermediate",
        "estimated_minutes": 18
      }
    ]
  }
}
```

**Supabase Queries:**

1. **User stats:**
```sql
SELECT
  ulp.user_id,
  COALESCE(SUM(a.xp_value), 0) as xp_total,
  COUNT(DISTINCT lp.id) as lessons_completed
FROM user_learning_profiles ulp
LEFT JOIN achievements a ON a.user_id = ulp.user_id
LEFT JOIN lesson_progress lp ON lp.user_id = ulp.user_id AND lp.status = 'completed'
WHERE ulp.user_id = auth.uid()
GROUP BY ulp.user_id;
```

2. **Current lesson in progress:**
```sql
SELECT l.id, l.title, l.course_id, c.title as course_title,
       lp.progress_percent, lp.time_spent_minutes, lp.status
FROM lesson_progress lp
JOIN lessons l ON l.id = lp.lesson_id
JOIN courses c ON c.id = l.course_id
WHERE lp.user_id = auth.uid() AND lp.status = 'in_progress'
ORDER BY lp.updated_at DESC LIMIT 1;
```

3. **Achievements (recent 3):**
```sql
SELECT id, code, title, description, icon_emoji, earned_at
FROM achievements
WHERE user_id = auth.uid()
ORDER BY earned_at DESC LIMIT 3;
```

4. **Recommendations:** Call `/api/academy/recommendations` and return top 2.

5. **Streak calculation:**
   - Query `lesson_progress` for last 7 days where status='completed'
   - Count consecutive days (starting today)
   - If today has no completed lessons, streak is frozen

**Error Cases:**
- 401: Unauthorized
- 500: Database error

---

#### 4. `GET /api/academy/paths`

**Purpose:** List available learning paths filtered by user's tier.

**Auth:** Required

**Request:**
```
GET /api/academy/paths
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Options Scalping Fundamentals",
      "description": "Master SPX/NDX 0DTE and sub-DTE scalping strategies",
      "icon_emoji": "⚡",
      "difficulty": "beginner",
      "required_tier": "core",
      "course_count": 4,
      "total_lessons": 32,
      "estimated_hours": 12,
      "thumbnail_url": "https://...",
      "progress_percent": 60
    },
    {
      "id": "uuid",
      "name": "Swing Trading with LEAPS",
      "description": "Build swing trading strategies using LEAPS contracts",
      "icon_emoji": "📈",
      "difficulty": "intermediate",
      "required_tier": "pro",
      "course_count": 3,
      "total_lessons": 18,
      "estimated_hours": 8,
      "thumbnail_url": "https://..."
    }
  ]
}
```

**Supabase Query:**
```sql
SELECT lp.*,
       COUNT(DISTINCT c.id) as course_count,
       COUNT(DISTINCT l.id) as total_lessons,
       SUM(l.estimated_minutes) / 60 as estimated_hours,
       COALESCE(AVG(lp2.progress_percent), 0) as progress_percent
FROM learning_paths lp
LEFT JOIN courses c ON c.learning_path_id = lp.id
LEFT JOIN lessons l ON l.course_id = c.id
LEFT JOIN lesson_progress lp2 ON lp2.lesson_id = l.id AND lp2.user_id = auth.uid()
WHERE lp.required_tier IN ('core', $user_tier) AND lp.is_published = true
GROUP BY lp.id
ORDER BY lp.sort_order ASC;
```

**Error Cases:**
- 401: Unauthorized
- 500: Database error

---

#### 5. `GET /api/academy/courses`

**Purpose:** List all courses available to user's tier with progress indicators.

**Auth:** Required

**Request:**
```
GET /api/academy/courses?path_id=uuid&difficulty=beginner
```

**Query Params (optional):**
- `path_id`: Filter by learning path
- `difficulty`: "beginner" | "intermediate" | "advanced"

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Options Greeks: Comprehensive Guide",
      "description": "Deep dive into delta, gamma, theta, vega, and rho",
      "thumbnail_url": "https://...",
      "difficulty": "beginner",
      "required_tier": "core",
      "lesson_count": 8,
      "estimated_hours": 4.5,
      "progress_percent": 62.5,
      "lessons_completed": 5,
      "last_lesson_id": "uuid",
      "last_lesson_title": "Greek Interactions",
      "is_completed": false
    }
  ]
}
```

**Supabase Query:**
```sql
SELECT c.*,
       COUNT(DISTINCT l.id) as lesson_count,
       SUM(l.estimated_minutes) / 60 as estimated_hours,
       COUNT(DISTINCT lp.id FILTER (WHERE lp.status = 'completed')) as lessons_completed,
       COALESCE(AVG(lp.progress_percent), 0) as progress_percent,
       MAX(lp.updated_at) FILTER (WHERE lp.status = 'completed') as last_completed_at
FROM courses c
LEFT JOIN lessons l ON l.course_id = c.id
LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = auth.uid()
WHERE c.required_tier IN ('core', $user_tier) AND c.is_published = true
  AND (c.learning_path_id = $path_id OR $path_id IS NULL)
  AND (c.difficulty = $difficulty OR $difficulty IS NULL)
GROUP BY c.id
ORDER BY c.display_order ASC;
```

**Error Cases:**
- 401: Unauthorized
- 500: Database error

---

#### 6. `GET /api/academy/courses/[slug]`

**Purpose:** Get course detail with full lesson list and user progress per lesson.

**Auth:** Required

**Request:**
```
GET /api/academy/courses/options-greeks
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "slug": "options-greeks",
    "title": "Options Greeks: Comprehensive Guide",
    "description": "Master the five Greeks and their interactions",
    "thumbnail_url": "https://...",
    "hero_image_url": "https://...",
    "difficulty": "beginner",
    "required_tier": "core",
    "estimated_hours": 4.5,
    "progress_percent": 62.5,
    "lessons": [
      {
        "id": "uuid",
        "title": "Delta: Directional Exposure",
        "slug": "delta-directional-exposure",
        "position": 1,
        "estimated_minutes": 28,
        "status": "completed",
        "progress_percent": 100,
        "time_spent_minutes": 31,
        "last_accessed": "2025-02-08T14:22:00Z",
        "quiz_taken": true,
        "quiz_score": 88,
        "thumbnail_url": "https://...",
        "description": "Learn how delta measures price sensitivity"
      },
      {
        "id": "uuid",
        "title": "Gamma: Acceleration Rate",
        "slug": "gamma-acceleration-rate",
        "position": 2,
        "estimated_minutes": 22,
        "status": "in_progress",
        "progress_percent": 45,
        "time_spent_minutes": 10,
        "quiz_taken": false,
        "thumbnail_url": "https://...",
        "description": "Understand gamma's role in delta changes"
      }
    ]
  }
}
```

**Supabase Query:**
```sql
SELECT c.*,
       COALESCE(AVG(lp.progress_percent), 0) as progress_percent
FROM courses c
LEFT JOIN lessons l ON l.course_id = c.id
LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = auth.uid()
WHERE c.slug = $slug AND c.is_published = true
GROUP BY c.id;

-- Get lessons for course
SELECT l.*,
       lp.status,
       lp.progress_percent,
       lp.time_spent_minutes,
       lp.updated_at as last_accessed,
       qr.quiz_score
FROM lessons l
LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = auth.uid()
LEFT JOIN (
  SELECT lesson_id, MAX(score) as quiz_score
  FROM quiz_responses
  WHERE user_id = auth.uid()
  GROUP BY lesson_id
) qr ON qr.lesson_id = l.id
WHERE l.course_id = $course_id
ORDER BY l.position ASC;
```

**Error Cases:**
- 401: Unauthorized
- 404: Course not found
- 500: Database error

---

#### 7. `GET /api/academy/lessons/[id]`

**Purpose:** Get full lesson content (markdown or video), quiz data, and AI tutor context.

**Auth:** Required

**Request:**
```
GET /api/academy/lessons/uuid-123
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Delta: Directional Exposure",
    "course_id": "uuid",
    "course_title": "Options Greeks",
    "lesson_type": "markdown|video|interactive|scenario|practice|guided",
    "content": "# Delta Explained\n\nDelta measures the rate of change...",
    "video_url": "https://youtube.com/embed/...",
    "estimated_minutes": 28,
    "difficulty": "beginner",
    "key_takeaways": [
      "Delta ranges from -1.0 to +1.0",
      "Delta approximates probability of expiring ITM",
      "Delta changes as stock price moves (gamma effect)"
    ],
    "quiz": {
      "id": "uuid",
      "questions": [
        {
          "id": 1,
          "type": "multiple_choice",
          "text": "What does a delta of 0.70 mean?",
          "options": [
            { "id": "A", "text": "70% probability of expiring ITM" },
            { "id": "B", "text": "Price will move $0.70" },
            { "id": "C", "text": "70% of option moves with stock" }
          ],
          "correct_answer": "A",
          "explanation": "Delta of 0.70 approximates a 70% probability of expiring in the money"
        }
      ]
    },
    "ai_tutor_context": {
      "topic": "Delta in Options Trading",
      "subtopics": ["Delta calculation", "Delta ranges", "Delta hedging"],
      "related_greek": "gamma"
    },
    "progress": {
      "status": "in_progress",
      "progress_percent": 45,
      "time_spent_minutes": 10,
      "user_viewed_at": "2025-02-08T14:12:00Z"
    }
  }
}
```

**Supabase Queries:**

1. **Lesson + course:**
```sql
SELECT l.*, c.title as course_title, c.id as course_id
FROM lessons l
JOIN courses c ON c.id = l.course_id
WHERE l.id = $lesson_id AND c.is_published = true;
```

2. **User progress:**
```sql
SELECT status, progress_percent, time_spent_minutes, updated_at
FROM lesson_progress
WHERE user_id = auth.uid() AND lesson_id = $lesson_id;
```

3. **Quiz (from `quizzes` and `quiz_questions` tables):**
```sql
SELECT q.id,
       json_agg(json_build_object(
         'id', qq.id,
         'type', qq.type,
         'text', qq.text,
         'options', qq.options,
         'correct_answer', qq.correct_answer,
         'explanation', qq.explanation
       )) as questions
FROM quizzes q
LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
WHERE q.lesson_id = $lesson_id
GROUP BY q.id;
```

**Error Cases:**
- 401: Unauthorized
- 404: Lesson not found
- 500: Database error

---

#### 8. `POST /api/academy/lessons/[id]/progress`

**Purpose:** Update lesson progress (mark viewed, mark complete, update time spent).

**Auth:** Required

**Request Body:**
```json
{
  "action": "view|complete",
  "time_spent_minutes": 31
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "lesson_id": "uuid",
    "status": "completed",
    "progress_percent": 100,
    "time_spent_minutes": 31,
    "xp_earned": 25,
    "message": "Great job completing this lesson!",
    "achievements_unlocked": [
      {
        "code": "complete_10_lessons",
        "title": "Lesson Enthusiast",
        "xp": 50
      }
    ]
  }
}
```

**Supabase Operations:**

1. **Update or insert `lesson_progress`:**
```sql
INSERT INTO lesson_progress (
  user_id, lesson_id, status, progress_percent, time_spent_minutes, updated_at
) VALUES (auth.uid(), $lesson_id, $status, $progress_percent, $time_spent, NOW())
ON CONFLICT (user_id, lesson_id) DO UPDATE SET
  status = $status,
  progress_percent = $progress_percent,
  time_spent_minutes = time_spent_minutes + $time_spent,
  updated_at = NOW();
```

2. **If action='complete':**
   - Award 25 XP: Insert into `achievements` table with `xp_value=25`
   - Check for milestone achievements (every 5 lessons, 10 lessons, 25 lessons)
   - If streaks enabled: Increment/update streak if this is the first completion today

3. **Update user streak:**
```sql
UPDATE user_learning_profiles
SET streak_days =
  CASE
    WHEN last_completed_date = CURRENT_DATE THEN streak_days
    WHEN last_completed_date = CURRENT_DATE - INTERVAL '1 day' THEN streak_days + 1
    ELSE 1
  END,
last_completed_date = CURRENT_DATE
WHERE user_id = auth.uid();
```

**Error Cases:**
- 400: Invalid action
- 401: Unauthorized
- 404: Lesson not found
- 500: Database error

---

#### 9. `POST /api/academy/lessons/[id]/quiz`

**Purpose:** Submit quiz answers. Return score, feedback, XP/achievement rewards.

**Auth:** Required

**Request Body:**
```json
{
  "quiz_id": "uuid",
  "answers": [
    { "question_id": 1, "selected_answer": "A" },
    { "question_id": 2, "selected_answer": "C" }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "quiz_id": "uuid",
    "lesson_id": "uuid",
    "score": 88,
    "score_percent": 88.0,
    "passed": true,
    "questions_correct": 7,
    "questions_total": 8,
    "xp_earned": 50,
    "feedback": "Excellent! You scored 88%. Your understanding of delta is strong.",
    "answer_breakdown": [
      {
        "question_id": 1,
        "text": "What does a delta of 0.70 mean?",
        "selected_answer": "A",
        "correct_answer": "A",
        "is_correct": true,
        "explanation": "Delta of 0.70 approximates a 70% probability..."
      },
      {
        "question_id": 2,
        "text": "Which Greek measures time decay?",
        "selected_answer": "B",
        "correct_answer": "C",
        "is_correct": false,
        "explanation": "Theta measures time decay, not vega..."
      }
    ],
    "achievements_unlocked": [
      {
        "code": "quiz_master_5",
        "title": "Quiz Master: 5 Perfect Scores",
        "xp": 100
      }
    ]
  }
}
```

**Supabase Operations:**

1. **Insert into `quiz_responses`:**
```sql
INSERT INTO quiz_responses (
  user_id, quiz_id, lesson_id, score, score_percent, answers_json, taken_at
) VALUES (auth.uid(), $quiz_id, $lesson_id, $score, $score_percent, $answers, NOW());
```

2. **Calculate score:** Iterate answers, compare to correct answers in `quiz_questions`, count correct.

3. **Award XP:**
   - Base: 50 XP for passing (score >= 70%)
   - Perfect score (100%): 100 XP
   - Cumulative checks: After 5 perfect scores, unlock "Quiz Master" achievement (100 XP)

4. **Update lesson progress:**
```sql
UPDATE lesson_progress
SET status = 'completed', progress_percent = 100
WHERE user_id = auth.uid() AND lesson_id = $lesson_id;
```

**Error Cases:**
- 400: Invalid answers format
- 401: Unauthorized
- 404: Quiz not found
- 500: Database error

---

#### 10. `GET /api/academy/achievements`

**Purpose:** List user's achievements with earned dates and statistics.

**Auth:** Required

**Request:**
```
GET /api/academy/achievements?limit=20&offset=0
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "achievements": [
      {
        "id": "uuid",
        "code": "first_lesson",
        "title": "First Step",
        "description": "Complete your first lesson",
        "icon_emoji": "🚀",
        "xp_value": 25,
        "earned_at": "2025-02-01T10:30:00Z",
        "rarity": "common"
      },
      {
        "id": "uuid",
        "code": "quiz_master_5",
        "title": "Quiz Master",
        "description": "Score 100% on 5 quizzes",
        "icon_emoji": "🧠",
        "xp_value": 100,
        "earned_at": "2025-02-05T14:15:00Z",
        "rarity": "rare"
      }
    ],
    "total_count": 8,
    "total_xp_from_achievements": 425,
    "next_achievement": {
      "code": "course_master",
      "title": "Course Master",
      "description": "Complete 3 courses",
      "progress": 1,
      "target": 3
    }
  }
}
```

**Supabase Query:**
```sql
SELECT id, code, title, description, icon_emoji, xp_value, earned_at, rarity
FROM achievements
WHERE user_id = auth.uid()
ORDER BY earned_at DESC
LIMIT $limit OFFSET $offset;

-- Total XP calculation
SELECT COALESCE(SUM(xp_value), 0) as total_xp
FROM achievements
WHERE user_id = auth.uid();
```

**Error Cases:**
- 401: Unauthorized
- 500: Database error

---

#### 11. `GET /api/academy/achievements/[code]`

**Purpose:** Public achievement verification endpoint (used for sharing achievement badges). No auth required.

**Request:**
```
GET /api/academy/achievements/quiz-master-5?user_id=uuid
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "code": "quiz_master_5",
    "title": "Quiz Master: 5 Perfect Scores",
    "description": "Score 100% on 5 quizzes",
    "icon_emoji": "🧠",
    "earned_by_user": true,
    "earned_at": "2025-02-05T14:15:00Z",
    "user_display_name": "john_trader",
    "verification_url": "https://academy.titm.com/verify/quiz-master-5?code=abc123..."
  }
}
```

**Supabase Query:**
```sql
SELECT a.id, a.code, a.title, a.description, a.icon_emoji, a.earned_at,
       u.discord_username
FROM achievements a
JOIN user_learning_profiles ulp ON ulp.user_id = a.user_id
JOIN auth.users u ON u.id = a.user_id
WHERE a.code = $code AND a.user_id = $user_id;
```

**Error Cases:**
- 404: Achievement not found or not earned by user
- 400: Invalid params
- 500: Database error

---

#### 12. `POST /api/academy/tutor/session`

**Purpose:** Create AI tutor session scoped to lesson. Stores lesson_id in session metadata for context-aware responses.

**Auth:** Required

**Request Body:**
```json
{
  "lesson_id": "uuid",
  "lesson_title": "Delta: Directional Exposure",
  "topic": "Options Greeks",
  "initial_message": "I'm confused about delta hedging"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid",
    "lesson_id": "uuid",
    "ai_coach_session_id": "ai-session-uuid",
    "title": "Delta Help - Session 1",
    "created_at": "2025-02-09T10:15:00Z",
    "system_prompt_category": "academy_tutor_lesson_context",
    "first_message": {
      "id": "msg-uuid",
      "role": "assistant",
      "content": "Great question! Delta hedging is the practice of offsetting delta risk in an options position..."
    }
  }
}
```

**Supabase Operations:**

1. **Create `ai_tutor_sessions` record (academy-specific):**
```sql
INSERT INTO ai_tutor_sessions (
  user_id, lesson_id, lesson_title, topic, session_type, created_at
) VALUES (auth.uid(), $lesson_id, $lesson_title, $topic, 'lesson_tutor', NOW())
RETURNING id, created_at;
```

2. **Call AI Coach backend** to create session with special system prompt (see Section 1.14 for prompt details).

3. **Store initial message** (optional, depends on if user sends initial question).

**Error Cases:**
- 400: Missing lesson_id
- 401: Unauthorized
- 404: Lesson not found
- 500: Database error

---

#### 13. `GET /api/academy/recommendations`

**Purpose:** Get AI-powered next lesson recommendations based on user profile, progress, and TITM learning progression.

**Auth:** Required

**Request:**
```
GET /api/academy/recommendations?limit=5
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "lesson_id": "uuid",
        "title": "Vega and Volatility Risk",
        "course_id": "uuid",
        "course_name": "Options Greeks",
        "reason": "Natural next lesson after Delta — completes Greeks foundation",
        "difficulty": "beginner",
        "estimated_minutes": 24,
        "match_score": 95
      },
      {
        "lesson_id": "uuid",
        "title": "Theta in High IV Environments",
        "course_id": "uuid",
        "course_name": "Time Decay Strategies",
        "reason": "Recommended based on your interest in scalping strategies",
        "difficulty": "intermediate",
        "estimated_minutes": 32,
        "match_score": 82
      }
    ]
  }
}
```

**Algorithm:**

1. **Get user profile** (learning_path, goals, experience_level)
2. **Get completed lessons** and in-progress status
3. **Query next lessons in sequence** from user's learning path
4. **Score based on:**
   - Sequential position in learning path (highest)
   - Relevance to user's stated goals
   - Difficulty match (don't jump too far ahead)
5. **Return top 5 by score**

**Supabase Query (conceptual):**
```sql
WITH user_progress AS (
  SELECT ulp.learning_path_id, ulp.goals_json, ulp.experience_level,
         ARRAY_AGG(lp.lesson_id) FILTER (WHERE lp.status = 'completed') as completed
  FROM user_learning_profiles ulp
  LEFT JOIN lesson_progress lp ON lp.user_id = auth.uid()
  WHERE ulp.user_id = auth.uid()
  GROUP BY ulp.user_id
)
SELECT l.id, l.title, l.course_id, c.title as course_title,
       l.difficulty, l.estimated_minutes,
       CASE
         WHEN l.position = (SELECT MIN(position) FROM lessons WHERE course_id = l.course_id) THEN 95
         WHEN l.goals_tags @> user_progress.goals_json THEN 85
         ELSE 70
       END as match_score
FROM lessons l
JOIN courses c ON c.id = l.course_id
CROSS JOIN user_progress
WHERE l.learning_path_id = user_progress.learning_path_id
  AND l.id NOT IN (SELECT lesson_id FROM lesson_progress WHERE user_id = auth.uid())
  AND l.position > (SELECT MAX(position) FROM lessons WHERE id IN (user_progress.completed))
ORDER BY match_score DESC
LIMIT 5;
```

**Error Cases:**
- 401: Unauthorized
- 500: Database error

---

### ADMIN-FACING ROUTES

#### 14. `POST /api/admin/academy/generate-lesson`

**Purpose:** AI-generate lesson content from outline using Claude API. Admin provides topic, TITM generates full lesson markdown, key takeaways, and quiz questions.

**Auth:** Required + Admin role

**Request Body:**
```json
{
  "title": "Delta: Directional Exposure",
  "course_id": "uuid",
  "target_difficulty": "beginner",
  "target_audience": "New options traders",
  "key_topics": ["delta definition", "delta range", "delta probability", "delta hedging"],
  "titm_knowledge_base_keys": ["delta_scalping", "option_basics"],
  "estimated_minutes": 25,
  "include_interactive_section": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "lesson_id": "uuid",
    "title": "Delta: Directional Exposure",
    "content": "# Delta: Directional Exposure\n\n## What is Delta?\n\nDelta measures the rate of change...",
    "key_takeaways": [
      "Delta ranges from -1.0 to +1.0",
      "Delta approximates probability of expiring ITM",
      "Delta changes as stock price moves (gamma effect)",
      "Delta is the hedge ratio in a delta-neutral portfolio"
    ],
    "quiz_questions": [
      {
        "type": "multiple_choice",
        "text": "What does a delta of 0.70 mean?",
        "options": [
          "70% probability of expiring ITM",
          "Price will move $0.70",
          "70% of option moves with stock"
        ],
        "correct_answer": 0,
        "explanation": "Delta of 0.70 approximates a 70% probability of expiring in the money"
      }
    ],
    "generation_time_seconds": 45,
    "tokens_used": 2847
  }
}
```

**System Prompt Sent to Claude API:**

```
You are an expert options trading instructor for TITM Academy, specializing in short-dated options and scalping strategies on SPX/NDX.

Your task: Generate a comprehensive lesson on the following topic:

LESSON DETAILS:
- Title: {title}
- Target Difficulty: {target_difficulty} (beginner|intermediate|advanced)
- Target Audience: {target_audience}
- Estimated Length: {estimated_minutes} minutes
- Key Topics to Cover: {key_topics as comma-separated list}

TITM TRADING CONTEXT:
TITM specializes in:
1. **0DTE (Zero Days to Expiration) Scalping on SPX/NDX**: Short-term, high-frequency trading on daily expiration options. Focus on gamma, theta decay, and quick directional moves.
2. **Sub-DTE Strategies (1-4 DTE)**: Multi-day holding periods with controlled risk. Emphasis on IV crush and earnings events.
3. **Swing Trading with LEAPS**: Longer-duration directional bets using LEAPS contracts (> 1 month to expiration). Focus on trend following and technical setups.
4. **Key Metrics**: Expected move, IV rank, gamma exposure (GEX), time decay curves.
5. **Risk Management**: Position sizing based on account size, 1-2% risk per trade maximum, stop-loss discipline.

KNOWLEDGE BASE CONTEXT (from TITM courses):
{knowledge_base_entries}

OUTPUT FORMAT:
Return a JSON object with the following fields:

{
  "content": "Full lesson markdown with:\n- H1 title\n- H2 sections for major concepts\n- Practical examples from TITM trading\n- Real market scenarios\n- Callout boxes for key insights\n- Code/formulas where applicable",
  "key_takeaways": ["Array of 4-5 key learning points, each 1-2 sentences"],
  "quiz_questions": [
    {
      "type": "multiple_choice",
      "text": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Why this is correct and why others are wrong"
    }
  ]
}

QUALITY GUARDRAILS:
- All statistics and percentages must be realistic (no made-up data like "95% win rates")
- Reference actual TITM methodology (scalping, IV crush, gamma dynamics)
- Include practical examples: "When trading SPX 0DTE, a delta of 0.70..."
- Explain WHY concepts matter for scalping specifically
- For beginner lessons: Start with fundamentals, use simple language
- For intermediate: Assume knowledge of Greeks, focus on application
- For advanced: Discuss edge cases, advanced scenarios
- Avoid disclaimers; assume professional trader audience
- Keep markdown clean: use bold **bold** for emphasis, not excessive formatting
```

**Supabase Operations:**

1. **Store generated lesson** (if admin clicks Save):
```sql
INSERT INTO lessons (
  course_id,
  title,
  slug,
  content,
  lesson_type,
  difficulty,
  estimated_minutes,
  is_published,
  created_at
) VALUES (
  $course_id,
  $title,
  to_tsvector('english', $title),
  $content,
  'text',
  $difficulty,
  $estimated_minutes,
  false,
  NOW()
) RETURNING id;
```

2. **Store quiz questions**:
```sql
INSERT INTO quiz_questions (quiz_id, position, type, text, options, correct_answer, explanation)
VALUES ($quiz_id, $pos, 'multiple_choice', $text, $options, $correct, $explanation);
```

**Claude API Call Setup:**

- **Model:** claude-opus-4.6 (best for detailed content generation)
- **Max tokens:** 4000
- **Temperature:** 0.7 (balance creativity with consistency)
- **Environment:** Use `ANTHROPIC_API_KEY` from environment

**Error Cases:**
- 400: Missing required fields
- 401: Unauthorized
- 403: Not an admin
- 429: Rate limited (Claude API)
- 500: Generation failed

---

#### 15. `GET /api/admin/academy/analytics`

**Purpose:** Learning analytics dashboard: completion rates, quiz scores, struggling lessons, popular courses, daily active learners.

**Auth:** Required + Admin role

**Request:**
```
GET /api/admin/academy/analytics?period=7d&course_id=uuid
```

**Query Params (optional):**
- `period`: "7d" | "30d" | "90d" | "all" (default: "30d")
- `course_id`: Filter by course

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "overview": {
      "total_learners": 342,
      "active_learners": 127,
      "lessons_started": 456,
      "lessons_completed": 312,
      "completion_rate": 68.4,
      "average_quiz_score": 79.2,
      "total_xp_awarded": 8420
    },
    "courses": [
      {
        "id": "uuid",
        "title": "Options Greeks",
        "enrollment_count": 89,
        "completion_rate": 72.1,
        "lessons_count": 8,
        "average_time_spent_hours": 4.2,
        "lessons_not_started": 3,
        "struggling_lessons": ["Rho: Interest Rate Risk"]
      }
    ],
    "struggling_lessons": [
      {
        "lesson_id": "uuid",
        "title": "Gamma: Second-Order Greeks",
        "course_name": "Options Greeks",
        "average_quiz_score": 62.3,
        "completion_rate": 55.2,
        "users_struggling": 23,
        "common_misconceptions": [
          "Gamma only affects short positions",
          "Gamma increases as option moves ITM"
        ]
      }
    ],
    "popular_courses": [
      {
        "id": "uuid",
        "title": "Options Greeks",
        "enrollments": 89,
        "trend": "up"
      }
    ],
    "daily_active_learners": [
      { "date": "2025-02-03", "active": 45 },
      { "date": "2025-02-04", "active": 52 },
      { "date": "2025-02-05", "active": 38 }
    ],
    "quiz_performance": {
      "average_score": 79.2,
      "score_distribution": {
        "90_100": 45,
        "80_89": 67,
        "70_79": 54,
        "below_70": 28
      }
    }
  }
}
```

**Supabase Queries:**

1. **Overview stats:**
```sql
SELECT
  COUNT(DISTINCT ulp.user_id) as total_learners,
  COUNT(DISTINCT CASE WHEN lp.updated_at > NOW() - INTERVAL '7 days' THEN lp.user_id END) as active_learners,
  COUNT(DISTINCT lp.id) FILTER (WHERE lp.status IN ('in_progress', 'completed')) as lessons_started,
  COUNT(DISTINCT lp.id) FILTER (WHERE lp.status = 'completed') as lessons_completed,
  ROUND(COUNT(DISTINCT lp.id) FILTER (WHERE lp.status = 'completed')::numeric /
        NULLIF(COUNT(DISTINCT lp.id), 0) * 100, 1) as completion_rate,
  ROUND(AVG(qr.score), 1) as average_quiz_score,
  COALESCE(SUM(a.xp_value), 0) as total_xp_awarded
FROM user_learning_profiles ulp
LEFT JOIN lesson_progress lp ON lp.user_id = ulp.user_id
  AND lp.updated_at > NOW() - ($period_interval)
LEFT JOIN quiz_responses qr ON qr.user_id = ulp.user_id
  AND qr.taken_at > NOW() - ($period_interval)
LEFT JOIN achievements a ON a.user_id = ulp.user_id
  AND a.earned_at > NOW() - ($period_interval);
```

2. **By course:**
```sql
SELECT c.id, c.title,
  COUNT(DISTINCT ulp.user_id) as enrollment_count,
  ROUND(COUNT(DISTINCT lp.id) FILTER (WHERE lp.status = 'completed')::numeric /
        NULLIF(COUNT(DISTINCT lp.id), 0) * 100, 1) as completion_rate,
  COUNT(DISTINCT l.id) as lessons_count,
  ROUND(AVG(lp.time_spent_minutes) / 60.0, 1) as average_time_spent_hours
FROM courses c
LEFT JOIN lessons l ON l.course_id = c.id
LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
LEFT JOIN user_learning_profiles ulp ON ulp.learning_path_id = c.learning_path_id
WHERE lp.updated_at > NOW() - ($period_interval)
GROUP BY c.id, c.title
ORDER BY enrollment_count DESC;
```

3. **Struggling lessons** (lowest scores, lowest completion):
```sql
SELECT l.id, l.title, c.title as course_name,
  ROUND(AVG(qr.score), 1) as average_quiz_score,
  ROUND(COUNT(DISTINCT lp.id) FILTER (WHERE lp.status = 'completed')::numeric /
        NULLIF(COUNT(DISTINCT lp.id), 0) * 100, 1) as completion_rate,
  COUNT(DISTINCT CASE WHEN qr.score < 70 THEN qr.user_id END) as users_struggling
FROM lessons l
JOIN courses c ON c.id = l.course_id
LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
LEFT JOIN quiz_responses qr ON qr.lesson_id = l.id
WHERE lp.updated_at > NOW() - ($period_interval)
GROUP BY l.id, l.title, c.title
HAVING ROUND(AVG(qr.score), 1) < 75
ORDER BY average_quiz_score ASC
LIMIT 10;
```

4. **Daily active learners:**
```sql
SELECT DATE(lp.updated_at) as date,
  COUNT(DISTINCT lp.user_id) as active
FROM lesson_progress lp
WHERE lp.updated_at > NOW() - ($period_interval)
GROUP BY DATE(lp.updated_at)
ORDER BY date DESC;
```

**Error Cases:**
- 401: Unauthorized
- 403: Not an admin
- 500: Database error

---

## SECTION 2: COMPONENT SPECIFICATIONS

All components follow these patterns:
- **TypeScript strict mode** with full interface definitions
- **'use client'** directive for client components
- **Tailwind CSS 4.1** for styling
- **Framer Motion** for animations (fade-in, slide, stagger)
- **Radix UI** primitives for accessible dialog/popover/dropdown
- **Lucide icons** for UI icons
- **shadcn/ui style** composable components

---

### PAGE COMPONENTS (in `/app/members/academy/`)

#### 1. `/app/members/academy/page.tsx` - Academy Hub

**Purpose:** Main dashboard. Shows current lesson, stats, streak, recommended lessons, achievements.

**Props:** None (page component)

**State:**
```typescript
const [onboardingComplete, setOnboardingComplete] = useState(false)
const [loading, setLoading] = useState(true)
const [dashboard, setDashboard] = useState<DashboardData | null>(null)
const [error, setError] = useState<string | null>(null)
```

**Key Behaviors:**

1. On mount:
   - Fetch `/api/academy/onboarding-status`
   - If not complete: redirect to `/members/academy/onboarding`
   - If complete: fetch `/api/academy/dashboard`
   - Store dashboard state (used by child components)

2. Render layout:
   - **Desktop:** 3-column grid (sidebar | main | right panel)
   - **Mobile:** Full-width stack, hide sidebar, collapse panels
   - Uses existing MemberAuthContext for header/nav

3. Error handling:
   - Show error banner if fetch fails
   - Provide "Retry" button

**Component Tree:**
```
page.tsx
├── LoadingSpinner (if loading)
├── ErrorBanner (if error)
└── (if onboarded)
    ├── AcademyHub (main dashboard)
    ├── ContinueLearningCard
    ├── StreakCalendar
    ├── StatsGrid
    └── RecommendedLessons
```

**Responsive Behavior:**
- **Desktop (lg):** Full layout with sidebars
- **Tablet (md):** 2-column (main | right panel)
- **Mobile (sm):** Full-width stack, simplified UI

---

#### 2. `/app/members/academy/onboarding/page.tsx` - Onboarding Wizard

**Purpose:** 5-step animated onboarding wizard. Collects experience, knowledge, goals, time commitment, broker status.

**Props:** None

**State:**
```typescript
const [currentStep, setCurrentStep] = useState(0)
const [formData, setFormData] = useState({
  experience_level: '',
  knowledge_quiz_answers: [],
  goals: [],
  time_per_week_minutes: 0,
  broker_status: '',
  broker_name: ''
})
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [completedSteps, setCompletedSteps] = useState<boolean[]>([false, false, false, false, false])
```

**Steps:**
1. **Experience Level** - Radio buttons (Beginner | Intermediate | Advanced)
2. **Knowledge Quiz** - 5 MCQ about options basics (scored internally)
3. **Goals** - Checkboxes (Scalping | Swing Trading | Income | Learning)
4. **Time Commitment** - Slider (0-1000 min/week) with preset buttons
5. **Broker Status** - Dropdown (No Account | Have Account | Prop Account) + optional broker name

**Key Behaviors:**

1. **Navigation:**
   - Next button: Validate step, show errors if invalid
   - Back button: Allow going back (don't clear data)
   - Skip button on step 3 (optional goals)

2. **Animations:**
   - Step indicator fills as user progresses
   - Fade-in/slide-up for each step content (Framer Motion)
   - Success animation on completion

3. **Submission:**
   - On step 5 complete, POST to `/api/academy/onboarding`
   - Show loading spinner
   - On success: Redirect to `/members/academy`
   - On error: Show error banner, allow retry

**Component Structure:**
```
onboarding/page.tsx
├── OnboardingWizard
│   ├── StepIndicator
│   └── StepContent[currentStep]
│       ├── Step1ExperienceLevel
│       ├── Step2KnowledgeQuiz
│       ├── Step3Goals
│       ├── Step4TimeCommitment
│       └── Step5BrokerStatus
│   └── NavigationButtons (Back, Next/Submit)
```

**Responsive:** Full-width on mobile, centered max-width on desktop.

---

#### 3. `/app/members/academy/courses/page.tsx` - Course Catalog

**Purpose:** Browsable catalog of courses with filtering by track/difficulty.

**Props:** None

**State:**
```typescript
const [courses, setCourses] = useState<CourseCard[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [filters, setFilters] = useState({
  path_id: '' as string | undefined,
  difficulty: '' as 'beginner' | 'intermediate' | 'advanced' | undefined
})
const [paths, setPaths] = useState<LearningPath[]>([])
```

**Key Behaviors:**

1. On mount:
   - Fetch `/api/academy/paths` (for filter dropdown)
   - Fetch `/api/academy/courses` with current filters
   - Re-fetch when filters change (debounced)

2. **Filter UI:**
   - Dropdown: Select learning path (All | Options Scalping | Swing Trading | etc)
   - Tabs: Filter by difficulty (All | Beginner | Intermediate | Advanced)

3. **Layout:**
   - Grid: 3 columns on desktop, 2 on tablet, 1 on mobile
   - Each card shows: thumbnail, title, lesson count, progress ring, difficulty badge
   - Click card → navigate to `/members/academy/courses/[slug]`

4. **Empty state:** If no courses match filters, show empty state with illustration.

**Component Tree:**
```
courses/page.tsx
├── FilterBar
│   ├── PathDropdown
│   └── DifficultyTabs
├── CourseGrid
│   └── CourseCard[] (maps each course)
└── EmptyState (if no results)
```

---

#### 4. `/app/members/academy/courses/[slug]/page.tsx` - Course Detail

**Purpose:** Course overview with lesson list, hero section, start/continue button.

**Props:**
```typescript
interface Params {
  slug: string
}
```

**State:**
```typescript
const [course, setCourse] = useState<CourseDetail | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
```

**Key Behaviors:**

1. On mount:
   - Extract slug from params
   - Fetch `/api/academy/courses/[slug]`
   - Display hero section + course info
   - List all lessons with status icons

2. **Hero Section:**
   - Background image (course.hero_image_url)
   - Title overlay
   - Progress ring + "60% Complete"
   - Start/Continue button (text depends on progress_percent)

3. **Lesson List:**
   - Accordion or expandable list of lessons
   - Each lesson shows: position number, title, duration, status icon (🔒 locked | ✓ done | ▶ in progress)
   - Click lesson → navigate to `/members/academy/learn/[lesson_id]`
   - Estimated total hours

4. **CTA Button:**
   - If progress = 0: "Start Course"
   - If 0 < progress < 100: "Continue Lesson" (shows which lesson)
   - If progress = 100: "Review" or "View Certificates"

**Component Tree:**
```
courses/[slug]/page.tsx
├── ErrorBanner (if error)
├── LoadingSpinner (if loading)
└── (if loaded)
    ├── CourseHero
    ├── CourseInfo
    ├── ProgressStats
    ├── LessonList
    │   └── LessonItem[]
    └── CTAButton
```

---

#### 5. `/app/members/academy/learn/[id]/page.tsx` - Lesson Player

**Purpose:** Full lesson view with 70/30 split (desktop): content on left, sidebar on right. Mobile: full-width stacked.

**Props:**
```typescript
interface Params {
  id: string
}
```

**State:**
```typescript
const [lesson, setLesson] = useState<LessonDetail | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [showQuiz, setShowQuiz] = useState(false)
const [showAITutor, setShowAITutor] = useState(false)
const [timeSpent, setTimeSpent] = useState(0)
const [contentViewed, setContentViewed] = useState(false)
```

**Key Behaviors:**

1. On mount:
   - Fetch `/api/academy/lessons/[id]`
   - Start timer (increment `timeSpent` every 10 seconds)
   - Mark content as viewed on scroll threshold (80% down page)

2. **Content Rendering:**
   - If lesson_type = 'text': Render with react-markdown (sanitized)
   - If lesson_type = 'video': Embed YouTube iframe (from video_url)
   - If lesson_type = 'interactive': Render special component (e.g., Greeks visualizer)
   - Syntax highlighting for code blocks (Prism.js or highlight.js)

3. **Sidebar (Desktop only, 30% width):**
   - Course progress breadcrumb
   - Key takeaways list
   - Lesson navigation (Prev/Next buttons)
   - "Mark as Complete" button
   - "Ask AI Tutor" floating button

4. **Quiz Modal:**
   - Appears below content or in modal
   - Triggered by user scroll to bottom
   - One question at a time with immediate feedback
   - Final score page with "Next Lesson" button

5. **AI Tutor Panel:**
   - Slide-in from right (desktop) or bottom sheet (mobile)
   - Reuses AI Coach infrastructure
   - Shows chat history
   - Quick question chips: "Explain this", "Quiz help", "Another example"

6. **Mobile Layout:**
   - Content full-width
   - Sidebar content moved below content (collapsible sections)
   - Bottom sticky action buttons (Mark Complete, Open Quiz)

**Component Tree:**
```
learn/[id]/page.tsx
├── LessonHeader
│   ├── Breadcrumb (Course > Lesson)
│   └── Progress stats
├── LessonContent
│   ├── MarkdownRenderer or VideoEmbed
│   └── KeyTakeaways (sidebar on desktop, collapsible on mobile)
├── QuizEngine (if showQuiz)
└── AITutorPanel (if showAITutor, right sidebar/bottom sheet)
```

---

### FEATURE COMPONENTS (in `/components/academy/`)

#### 6. `academy-hub.tsx` - Dashboard Layout

**Purpose:** Main dashboard widget layout. Composes ContinueLearning, Stats, Streak, Recommendations, Achievements.

**Props:**
```typescript
interface AcademyHubProps {
  dashboard: DashboardData
  onRefresh?: () => void
}
```

**Behavior:** Renders grid layout with all dashboard widgets. Responsive grid:
- Desktop: 2-column main area + sidebar
- Tablet: 1-column with stacked widgets
- Mobile: Full-width stack

---

#### 7. `continue-learning-card.tsx` - Current Lesson Widget

**Props:**
```typescript
interface ContinueLearningCardProps {
  lesson: {
    id: string
    title: string
    course_name: string
    progress_percent: number
    thumbnail_url: string
    status: 'not_started' | 'in_progress' | 'completed'
  }
}
```

**Renders:**
- Card with thumbnail background
- Lesson title + course name
- Circular progress ring (SVG)
- Progress percentage text
- "Resume" or "Start" button
- Time spent indicator

**Click behavior:** Navigate to lesson

---

#### 8. `course-card.tsx` - Course Preview Card

**Props:**
```typescript
interface CourseCardProps {
  id: string
  title: string
  description?: string
  thumbnail_url?: string
  lesson_count: number
  progress_percent: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  lessons_completed?: number
  onClick?: () => void
}
```

**Renders:**
- Thumbnail image (with fallback background)
- Title overlay
- Difficulty badge (color-coded: green=beginner, yellow=intermediate, red=advanced)
- Progress ring
- "View Course" button

---

#### 9. `course-catalog.tsx` - Course Grid with Filters

**Props:**
```typescript
interface CourseCatalogProps {
  courses: CourseCard[]
  loading?: boolean
  onCourseClick?: (courseId: string) => void
}
```

**Renders:** Grid of CourseCard components with responsive columns.

---

#### 10. `lesson-player.tsx` - Main Lesson Content Renderer

**Props:**
```typescript
interface LessonPlayerProps {
  lesson: LessonDetail
  onProgress?: (data: ProgressUpdateData) => void
}
```

**Behavior:**
- Handles markdown rendering (sanitized, with syntax highlighting)
- Embeds YouTube iframe (auto-responsive)
- Tracks scroll progress
- Auto-saves progress every 30 seconds (via onProgress callback)

---

#### 11. `lesson-sidebar.tsx` - Desktop Sidebar (Course Progress)

**Props:**
```typescript
interface LessonSidebarProps {
  courseId: string
  lessonId: string
  lessons: LessonItem[]
  onLessonSelect?: (lessonId: string) => void
  onMarkComplete?: () => void
}
```

**Renders:**
- Course progress breadcrumb
- Key takeaways list
- Lesson list with navigation
- Mark complete button

---

#### 12. `quiz-engine.tsx` - Quiz UI (Multi-question)

**Props:**
```typescript
interface QuizEngineProps {
  questions: QuizQuestion[]
  lessonId: string
  onComplete: (result: QuizResult) => void
  onAskAITutor?: (question: QuizQuestion) => void
}
```

**Behavior:**
- Show one question at a time
- Display 4 multiple-choice options
- Show/hide answer key after submission
- Progress indicator (Q 1 of 8)
- "Next Question" or "Finish Quiz" button
- Final score screen with "Next Lesson" CTA

**Renders:** QuizQuestion components in sequence.

---

#### 13. `quiz-question.tsx` - Single Quiz Question

**Props:**
```typescript
interface QuizQuestionProps {
  question: QuizQuestion
  onAnswer: (selectedAnswer: string) => void
  showFeedback?: boolean
}
```

**Renders:**
- Question text
- 4 radio button options
- Submit button (or auto-submit on selection)
- Feedback display (correct/incorrect + explanation)

---

#### 14. `ai-tutor-panel.tsx` - AI Coach Scoped to Lesson

**Props:**
```typescript
interface AITutorPanelProps {
  lessonId: string
  lessonTitle: string
  topic: string
  isOpen: boolean
  onClose: () => void
  quickQuestions?: string[]
}
```

**Behavior:**
- Reuses `/api/academy/tutor/session` to create lesson-scoped AI session
- Reuses AI Coach chat infrastructure (streaming messages)
- Displays chat history
- Shows quick question chips for common asks
- Slide-in from right (desktop) or bottom sheet (mobile)
- Uses Framer Motion for smooth animation

---

#### 15. `onboarding-wizard.tsx` - 5-Step Form Wizard

**Props:**
```typescript
interface OnboardingWizardProps {
  onComplete: (data: OnboardingFormData) => void
  onError?: (error: string) => void
}
```

**Behavior:**
- Manages internal state for all 5 steps
- Validates each step before advancing
- Shows step indicator (progress bar)
- Animated transitions between steps (Framer Motion)
- Knowledge quiz with immediate scoring

---

#### 16. `xp-display.tsx` - XP Bar and Level

**Props:**
```typescript
interface XPDisplayProps {
  xp_total: number
  level: number
  level_name: string
  xp_to_next_level: number
}
```

**Renders:**
- Horizontal progress bar (CSS or SVG)
- Level badge (icon + name)
- XP numbers (current / next level)
- Animated bar fill on prop change

---

#### 17. `streak-calendar.tsx` - 7-Day Streak Visualization

**Props:**
```typescript
interface StreakCalendarProps {
  days: StreakDay[]
  currentStreak: number
  frozenToday: boolean
}
```

**Renders:**
- 7 circles (one per day, Mon-Sun)
- Filled circle for completed days
- Empty circle for missed days
- Current day indicator (larger/highlighted)
- Streak count display

---

#### 18. `achievement-card.tsx` - Achievement Badge

**Props:**
```typescript
interface AchievementCardProps {
  achievement: Achievement
  onShare?: () => void
}
```

**Renders:**
- Large emoji icon
- Title + description
- Earned date
- XP value
- Share button (Twitter/Copy link)

---

#### 19. `trade-card-preview.tsx` - Shareable Credential Card

**Props:**
```typescript
interface TradeCardPreviewProps {
  achievement: Achievement
  user: { name: string; avatar?: string }
  onDownload?: () => void
  onShare?: (platform: 'twitter' | 'linkedin') => void
}
```

**Renders:**
- Card preview (PNG-exportable format)
- Member name, achievement, date
- QR code linking to verification URL
- Social share buttons

---

#### 20. `progress-ring.tsx` - Circular Progress Indicator

**Props:**
```typescript
interface ProgressRingProps {
  percentage: number
  size?: number
  color?: string
  strokeWidth?: number
  children?: ReactNode // Center content
}
```

**Renders:** SVG circle with animated stroke (Framer Motion).

---

### INTERACTIVE COMPONENTS (in `/components/academy/interactive/`)

#### 21. `greek-visualizer.tsx` - Greeks Education Tool

**Purpose:** Real-time Greeks calculator with sliders and payoff diagram.

**Props:**
```typescript
interface GreekVisualizerProps {
  contractType?: 'call' | 'put'
  initialStrike?: number
  onGreeksChange?: (greeks: GreeksOutput) => void
}
```

**State:**
```typescript
const [stockPrice, setStockPrice] = useState(100)
const [strikePrice, setStrikePrice] = useState(100)
const [daysToExp, setDaysToExp] = useState(30)
const [impliedVol, setImpliedVol] = useState(20)
const [riskFreeRate, setRiskFreeRate] = useState(5)
const [greeks, setGreeks] = useState<GreeksOutput>({
  delta: 0.5, gamma: 0.01, theta: -0.03, vega: 0.15, rho: 0.02
})
```

**Behavior:**
1. Use Black-Scholes formula (JavaScript library like `jstat` or custom implementation)
2. Update Greeks in real-time as sliders change (debounced, 200ms)
3. Display Greeks numerically with color coding (positive=green, negative=red)
4. Render payoff diagram (line chart showing P&L at expiration)
5. Mobile: Stack sliders vertically

**Components:**
- Slider inputs for each parameter
- Greeks display grid
- Chart component (use Chart.js or Recharts for line chart)

---

#### 22. `position-sizer.tsx` - Risk Calculator

**Purpose:** Calculate position size given account size, risk percentage, entry/stop.

**Props:**
```typescript
interface PositionSizerProps {
  accountSize: number
  onSizeCalculate?: (size: PositionSize) => void
}
```

**State:**
```typescript
const [accountSize, setAccountSize] = useState(100000)
const [riskPercent, setRiskPercent] = useState(1)
const [entryPrice, setEntryPrice] = useState(0)
const [stopPrice, setStopPrice] = useState(0)
const [contractMultiplier, setContractMultiplier] = useState(100) // For options
```

**Behavior:**
1. Formula: `position_size = (account_size * risk_percent) / (entry_price - stop_price) * contract_multiplier`
2. Display calculated position size with dollar risk
3. Show warnings if risk > 2% or other limits
4. Educational tooltips on each input

---

#### 23. `options-chain-trainer.tsx` - Practice Quiz on Options Chains

**Purpose:** Educational tool: show mock options chain, ask questions, score answers.

**Props:**
```typescript
interface OptionsChainTrainerProps {
  symbol?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
}
```

**Behavior:**
1. Generate or fetch mock options chain (call/put columns, strike rows)
2. Display table (scrollable on mobile)
3. Show 5-10 questions like:
   - "What is the bid-ask spread of the 4500 call?" (input)
   - "Which strike has the highest open interest?" (dropdown)
   - "What is the bid-ask spread of the 4500 put?" (input)
4. Track score, show feedback
5. Explanation of correct answer with Greek context

---

### ADMIN COMPONENTS (in `/components/admin/academy/`)

#### 24. `content-generator.tsx` - AI Lesson Generator

**Purpose:** Admin UI to generate lesson content with Claude, preview, edit, save.

**Props:**
```typescript
interface ContentGeneratorProps {
  courseId: string
  onSave?: (lesson: LessonSaved) => void
}
```

**State:**
```typescript
const [form, setForm] = useState({
  title: '',
  difficulty: 'beginner',
  keyTopics: [],
  titkKB: [],
  estimatedMinutes: 25
})
const [generating, setGenerating] = useState(false)
const [generated, setGenerated] = useState<GeneratedLesson | null>(null)
const [editingContent, setEditingContent] = useState('')
```

**Behavior:**
1. Form inputs (title, difficulty, topics, KB selection, est. time)
2. Button: "Generate with AI"
3. Show loading spinner
4. On success: Display editable markdown preview + quiz questions
5. Admin can edit content in rich text editor
6. Save button: POST to `/api/admin/academy/generate-lesson`
7. On save success: Show success toast, close modal

**Components:**
- Form inputs with dropdowns/chips
- Markdown editor (for content refinement)
- Quiz question editor
- Preview pane (split view)

---

#### 25. `learning-analytics.tsx` - Analytics Dashboard

**Purpose:** Admin view of learning metrics: completion rates, quiz scores, struggling lessons.

**Props:**
```typescript
interface LearningAnalyticsProps {
  period?: '7d' | '30d' | '90d'
  courseId?: string
}
```

**Behavior:**
1. Fetch `/api/admin/academy/analytics` on mount
2. Display stat cards (total learners, completion rate, avg quiz score, XP awarded)
3. Charts:
   - Daily active learners (line chart)
   - Quiz score distribution (bar chart)
   - Course completion rates (horizontal bar chart)
4. Table: Struggling lessons with scores and user count
5. Filtering by period and course

**Components:**
- Stat card grid
- Line chart (Recharts)
- Bar charts
- Data table with sorting

---

## DATABASE TABLES (Supabase Schema)

Required tables:

```sql
CREATE TABLE learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  required_tier TEXT CHECK (required_tier IN ('core', 'pro', 'executive')),
  is_published BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id UUID REFERENCES learning_paths(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  hero_image_url TEXT,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  required_tier TEXT CHECK (required_tier IN ('core', 'pro', 'executive')),
  is_published BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,
  lesson_type TEXT CHECK (lesson_type IN ('video', 'text', 'interactive', 'scenario', 'practice', 'guided')),
  video_url TEXT,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_minutes INT DEFAULT 15,
  key_takeaways TEXT[], -- JSON array stored as text
  position INT DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lesson_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
  progress_percent INT DEFAULT 0,
  time_spent_minutes INT DEFAULT 0,
  viewed_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  position INT,
  type TEXT DEFAULT 'multiple_choice',
  text TEXT NOT NULL,
  options JSONB, -- Array of option objects {id, text}
  correct_answer TEXT, -- ID of correct option
  explanation TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id),
  lesson_id UUID REFERENCES lessons(id),
  score INT NOT NULL,
  score_percent NUMERIC(5, 2),
  answers_json JSONB,
  taken_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_learning_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  knowledge_score INT,
  tier TEXT CHECK (tier IN ('core', 'pro', 'executive')),
  learning_path_id UUID REFERENCES learning_paths(id),
  goals_json JSONB, -- Array of goal strings
  broker_status TEXT,
  broker_name TEXT,
  streak_days INT DEFAULT 0,
  last_completed_date DATE,
  onboarded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT,
  xp_value INT DEFAULT 0,
  rarity TEXT CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  earned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, code)
);

CREATE TABLE ai_tutor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id),
  lesson_title TEXT,
  topic TEXT,
  session_type TEXT CHECK (session_type IN ('lesson_tutor', 'general', 'homework')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## IMPLEMENTATION NOTES

1. **Authentication:** All member routes require valid Supabase session. Use `useMemberAuth()` context.
2. **Error Handling:** Consistent error handling with user-friendly messages and retry options.
3. **Loading States:** Show skeletons or spinners while fetching. No blank screens.
4. **Mobile Optimization:** Test on iPhone 12 (390px viewport) and tablet (768px).
5. **Accessibility:** Use Radix UI for modals/popovers, proper ARIA labels, semantic HTML.
6. **Performance:** Lazy-load components, memoize expensive calculations, debounce API calls.
7. **Analytics:** Consider tracking lesson completion, quiz scores, XP earned for admin insights.

---

**END OF SPECIFICATIONS**
