# TITM Academy: Training System Proposal

## A Comprehensive, Personalized Learning Platform for TradeITM Members

**Prepared for:** Nate Kahl, TradeITM
**Date:** February 9, 2026
**Version:** 1.0 — Draft for Scope Alignment

---

## Executive Summary

This proposal outlines a full-featured learning management system (LMS) called **TITM Academy**, embedded directly within the existing TradeITM members area. It transforms the current empty `/members/library` page into a personalized, AI-powered education platform that takes members from "What is an option?" to executing advanced multi-leg strategies with confidence.

The system is designed to integrate deeply with what already exists — your AI Coach, Trading Journal, permission system, knowledge base, and Trade Cards — creating a unified learning-to-trading pipeline where education isn't a separate silo but part of every member interaction.

**Core Principles:**

- **Learn by doing, not just watching.** Every module ends with a hands-on activity, not just a quiz.
- **Your AI Coach becomes your AI Tutor.** Contextual help within every lesson, aware of TITM strategies.
- **Progress that means something.** Trade Cards become shareable proof of mastery, not participation trophies.
- **Sustainable by design.** AI-assisted content authoring means you can maintain and expand the curriculum without hiring a content team.

---

## Part 1: What Already Exists (Foundation Audit)

Before proposing anything new, here's what your codebase already has that this system builds on top of:

### Ready to Use (No Changes Needed)

| Asset | Status | How Training Uses It |
|-------|--------|---------------------|
| `courses` table | Schema exists, 0 rows | Becomes the backbone of the module system |
| `lessons` table | Schema exists, 0 rows | Each lesson gets content, video, quizzes |
| Admin course editor | Fully functional UI | Admins already have CRUD for courses + lessons |
| `knowledge_base` (18 entries) | Active, categorized | Seeds the AI Tutor's TITM-specific context |
| `ai_coach_sessions` / `ai_coach_messages` | 27 sessions, 117 messages | AI Tutor shares this infrastructure |
| `pricing_tiers` (3 tiers) | Core / Pro / Executive | Gates which learning paths are available |
| `app_permissions` (17 permissions) | Includes `access_course_library` | Permission already exists for course access |
| `discord_role_permissions` | Role → Permission mapping | Tier access auto-syncs from Discord |
| Member sidebar tab system | Dynamic, tier-gated | "Library" tab already configured for Pro+ |
| Trading Journal | Full implementation | Bridges learning to practice (log what you learn) |
| Trade Cards / Widget system | 40+ card types | Foundation for shareable certification cards |

### Needs Extension (Modify Existing)

| Asset | What Changes |
|-------|-------------|
| `lessons` table | Add columns for quiz data, activity type, estimated duration, prerequisites |
| `courses` table | Add columns for difficulty level, learning path association, estimated total hours |
| `/members/library` page | Replace "Coming Soon" with full course catalog and learning dashboard |
| Knowledge base categories | Add `training` category for lesson-specific AI context |
| AI Coach system prompt | Extend to include tutor mode when invoked from a lesson context |

### Needs to Be Built (New)

| Component | Purpose |
|-----------|---------|
| Learning Paths engine | Defines sequences of courses per tier and skill level |
| Quiz/Assessment engine | Multiple choice, scenario-based, drag-and-drop matching |
| Progress tracking tables | Per-user completion, scores, streaks, time spent |
| Onboarding Assessment | Entry quiz that places members into the right starting point |
| AI Tutor panel | Contextual AI sidebar within lesson view |
| Trade Card credentials | Shareable completion cards with member stats |
| Content authoring pipeline | AI-assisted lesson drafting from outlines |
| Gamification system | XP, badges, streaks, leaderboard |
| Practice Activities | Paper trading scenarios, position sizing calculators, Greek visualizers |

---

## Part 2: Learning Architecture (Instructional Design)

### 2.1 — The TITM Learning Model

The curriculum follows a **"Learn → Understand → Practice → Prove"** loop at every level:

```
┌──────────────────────────────────────────────────┐
│                  TITM Academy                     │
│                                                   │
│   ┌─────────┐    ┌───────────┐    ┌──────────┐  │
│   │  LEARN  │───▶│UNDERSTAND │───▶│ PRACTICE │  │
│   │ (Video/ │    │  (Quiz/   │    │(Activity/│  │
│   │  Text)  │    │   Check)  │    │  Sim)    │  │
│   └─────────┘    └───────────┘    └──────────┘  │
│        │                                │        │
│        │         ┌──────────┐           │        │
│        └────────▶│  PROVE   │◀──────────┘        │
│                  │  (Trade  │                     │
│                  │   Card)  │                     │
│                  └──────────┘                     │
└──────────────────────────────────────────────────┘
```

### 2.2 — Curriculum Map

The content is organized into **4 Learning Tracks**, each containing multiple **Courses**, each containing multiple **Lessons**.

---

#### TRACK 1: FOUNDATIONS (All Tiers — Required for New Members)

**Course 1.1: Welcome to TITM**
- L1: Your TITM Membership — What You Get
- L2: Navigating the Members Area (interactive walkthrough)
- L3: Setting Up Discord — Channels, Roles, and Notifications
- L4: How to Use the AI Coach
- L5: Your Trading Journal — Why It Matters and How to Start
- *Activity:* Complete your first journal entry (even if hypothetical)
- *Quiz:* Platform navigation check (5 questions)

**Course 1.2: Options Trading 101**
- L1: What Is an Option? Calls and Puts Explained
- L2: How Options Are Priced — Intrinsic vs. Extrinsic Value
- L3: The Options Chain — Reading and Understanding It
- L4: Buying vs. Selling Options — Risk Profiles
- L5: Expiration, Strike Price, and Moneyness
- L6: Your First Paper Trade — Walking Through a Call Purchase
- *Activity:* Paper trade scenario — walk through entering and exiting a call
- *Quiz:* Core concepts (10 questions)

**Course 1.3: The Greeks — Your Trading Dashboard**
- L1: Delta — Directional Exposure
- L2: Theta — Time Decay and Why It Matters
- L3: Gamma — The Accelerator
- L4: Vega — Volatility's Price Tag
- L5: Rho and How Greeks Work Together
- L6: Interactive Greek Visualizer — See How Greeks Change in Real Time
- *Activity:* Greek scenario challenge — "Given these Greeks, what happens if..."
- *Quiz:* Greek identification and impact (10 questions)

**Course 1.4: Setting Up Your Broker**
- L1: Choosing a Broker — What TITM Members Use
- L2: Account Types and Approval Levels
- L3: Platform Setup — ThinkorSwim / Tastytrade / IBKR Walkthroughs
- L4: Order Types — Market, Limit, Stop, and When to Use Each
- L5: Reading Your P&L and Account Statements
- *Activity:* Screenshot your broker setup and get AI Coach feedback
- *Quiz:* Order type matching (8 questions)

**Course 1.5: Risk Management Fundamentals**
- L1: Position Sizing — The 1-2% Rule
- L2: Stop Losses — Types and Placement
- L3: Risk/Reward Ratios — Thinking in R-Multiples
- L4: Account Management — Drawdowns and Recovery Math
- L5: The Psychology of Loss — Handling Red Days
- *Activity:* Position size calculator — input your account size, get recommended sizes
- *Quiz:* Risk scenario questions (8 questions)
- *Milestone:* **TITM Foundations Trade Card** 🎓

---

#### TRACK 2: CORE STRATEGIES (Core Tier+)

**Course 2.1: Day Trading SPX with TITM**
- L1: Why SPX? Index Options Advantages
- L2: The TITM Morning Routine — Pre-Market Prep
- L3: Reading the Morning Watchlist
- L4: Key Levels — Support, Resistance, and How TITM Identifies Them
- L5: Entry Criteria — What Makes a Sniper Setup
- L6: Managing the Trade — Scaling, Trailing, and Exits
- L7: Post-Market Review — Journaling Your SPX Trades
- *Activity:* Analyze a real past SPX setup using the AI Coach
- *Quiz:* Setup identification from chart screenshots (10 questions)

**Course 2.2: Understanding Market Structure**
- L1: Trend vs. Range — Identifying Market Regimes
- L2: Volume Profile and VWAP
- L3: GEX (Gamma Exposure) — What It Means for Price Action
- L4: Opening Range Breakouts (ORB)
- L5: Market Internals — ADD, TICK, VIX
- *Activity:* Morning brief analysis — use AI Coach to generate and interpret
- *Quiz:* Market structure identification (8 questions)

**Course 2.3: Alert Interpretation**
- L1: How TITM Alerts Work
- L2: High-Volume vs. Momentum Alerts
- L3: Filtering Noise — Which Alerts to Act On
- L4: Executing from an Alert — Speed vs. Confirmation
- *Activity:* Alert simulation — given these alerts, what would you do?
- *Quiz:* Alert triage scenarios (6 questions)
- *Milestone:* **TITM Core Sniper Trade Card** 🎯

---

#### TRACK 3: ADVANCED STRATEGIES (Pro Tier+)

**Course 3.1: Swing Trading Strategy**
- L1: Swing vs. Day Trading — Mindset Shift
- L2: Multi-Day Setups — What to Look For
- L3: Position Building — Scaling Into Trades
- L4: Overnight Risk — Managing Gap Risk
- L5: Weekly Options vs. Monthly Options
- *Activity:* Build a swing trade plan using the Playbook Builder
- *Quiz:* Swing trade management scenarios (8 questions)

**Course 3.2: LEAPS — Long-Term Options Strategy**
- L1: What Are LEAPS and Why Use Them?
- L2: Selecting LEAPS — Delta, Expiration, and Strike
- L3: The TITM LEAPS Framework
- L4: Position Management — Rolling, Adjusting, and Exiting
- L5: LEAPS + Covered Calls — The Hybrid Approach
- *Activity:* LEAPS position builder — configure a position and analyze Greeks
- *Quiz:* LEAPS selection and management (10 questions)

**Course 3.3: Advanced Market Structure**
- L1: Multi-Timeframe Analysis
- L2: Options Flow and Unusual Activity
- L3: Sector Rotation and Correlation
- L4: Earnings Season Strategy
- L5: Capital Allocation — Portfolio Construction
- *Activity:* Multi-timeframe analysis project using AI Coach
- *Quiz:* Advanced structure scenarios (10 questions)
- *Milestone:* **TITM Pro Sniper Trade Card** 📈

---

#### TRACK 4: ELITE EXECUTION (Executive Tier)

**Course 4.1: NDX Advanced Execution**
- L1: NDX vs. SPX — Different Characteristics
- L2: Real-Time NDX Alert System — How to Use It
- L3: High-Conviction Setups — Entry and Management
- L4: Speed of Execution — Reducing Latency
- *Activity:* NDX trade simulation

**Course 4.2: Portfolio-Level Thinking**
- L1: Risk Scaling — From Single Trades to Portfolio Management
- L2: Correlation Risk — When Everything Moves Together
- L3: Portfolio Greek Management
- L4: The Executive Mindset — Trading as a Business
- *Activity:* Portfolio review session with AI Coach
- *Milestone:* **TITM Executive Sniper Trade Card** 🔥

---

#### TRACK 5: TRADING PSYCHOLOGY (All Tiers — Ongoing)

**Course 5.1: The Trader's Mindset**
- L1: Emotional Discipline — Why Smart People Make Bad Trades
- L2: FOMO, Revenge Trading, and Overtrading
- L3: Building a Pre-Trade Checklist
- L4: Journal-Based Self-Coaching
- L5: The Process Over Outcomes Mindset
- *Activity:* Write your personal trading rules (saved to your profile)
- *Quiz:* Self-assessment — trading psychology inventory

---

### 2.3 — Lesson Types

Each lesson can be one or a combination of:

| Type | Description | Example |
|------|-------------|---------|
| **Video** | Recorded walkthrough, screencast, or lecture | "How to read the options chain" |
| **Rich Text** | Markdown content with images, callouts, and code | "Position sizing formulas" |
| **Interactive** | Embedded calculators, visualizers, or simulators | "Greek Visualizer" — drag sliders, watch Greeks change |
| **Scenario** | "What would you do?" decision trees | "SPX drops 1% at open — walk through your decision" |
| **Screenshot Review** | Upload a chart/position screenshot, get AI analysis | "Upload your broker P&L, AI breaks it down" |
| **Guided Practice** | Step-by-step walkthrough with AI Coach | "Let's walk through entering a LEAPS position together" |

### 2.4 — Assessment Types

| Type | Use Case | Grading |
|------|----------|---------|
| **Multiple Choice** | Knowledge checks | Auto-graded, immediate feedback |
| **Scenario-Based** | "Given this chart, which setup is this?" | Auto-graded with explanation |
| **Drag-and-Drop Matching** | Match Greeks to their descriptions | Auto-graded |
| **Free Response** | "Explain your thesis for this trade" | AI-graded with rubric |
| **Trade Review** | Submit a real journal entry for analysis | AI-graded against course criteria |
| **Practical Checkpoint** | "Complete 5 journal entries this week" | System-verified from journal data |

---

## Part 3: Personalization Engine

### 3.1 — Onboarding Assessment

When a member first visits TITM Academy, they complete a **5-minute placement assessment**:

1. **Experience Level** — "How would you describe your trading experience?"
   (Never traded / Paper traded only / 0-1 years / 1-3 years / 3+ years)

2. **Options Knowledge** — 5 diagnostic questions covering basic options concepts
   (Scored out of 5 — determines starting course)

3. **Goals** — "What do you most want to learn?"
   (Day trading / Swing trading / LEAPS / Risk management / All of the above)

4. **Time Commitment** — "How much time can you dedicate to learning per week?"
   (15 min/day / 30 min/day / 1 hour/day / Binge on weekends)

5. **Broker Status** — "Do you already have a brokerage account set up?"
   (Yes, funded / Yes, not funded / No, need help choosing)

**Output:** A personalized learning path with a clear starting point, recommended pace, and estimated time to each milestone.

### 3.2 — Adaptive Recommendations

The system continuously adjusts recommendations based on:

| Signal | What It Tells Us | How It Adapts |
|--------|------------------|---------------|
| Quiz scores | Knowledge gaps | Recommends review lessons for weak areas |
| Lesson completion speed | Engagement level | Suggests more/less content depth |
| Journal entries | What they're actually trading | Recommends courses relevant to their trades |
| AI Coach conversations | What they're asking about | Surfaces relevant lessons as "Recommended for you" |
| Time since last activity | Engagement drop-off | Sends re-engagement nudges with "pick up where you left off" |
| Tier changes | Upgrade/downgrade | Unlocks/adjusts available learning paths |

### 3.3 — The AI Tutor

The AI Tutor is **not a separate system** — it's the existing AI Coach operating in **lesson context mode**. When a member opens the AI Tutor from within a lesson:

- The AI receives the lesson's content, learning objectives, and the member's progress as context
- It can answer questions about the lesson material
- It references TITM-specific strategies and terminology from the knowledge base
- It knows what the member has already completed and what's next
- It can generate additional examples tailored to the member's experience level

**Key difference from standalone AI Coach:** The Tutor is scoped. It stays focused on the lesson topic and gently redirects off-topic questions: *"Great question about LEAPS — you'll cover that in Course 3.2. For now, let's make sure you've got the Greeks down."*

**Implementation:** A new `context_type` field on `ai_coach_sessions` — `'tutor'` vs `'coach'` — with a modified system prompt that includes the current lesson context.

---

## Part 4: UX Design

### 4.1 — Information Architecture

```
/members/academy                    ← Main Academy Hub (replaces /members/library)
  /members/academy/onboarding       ← Placement assessment (first visit only)
  /members/academy/path             ← My Learning Path (personalized view)
  /members/academy/courses          ← Browse All Courses
  /members/academy/courses/[slug]   ← Course detail + lesson list
  /members/academy/learn/[slug]     ← Lesson player (full-screen immersive)
  /members/academy/achievements     ← Badges, Trade Cards, progress stats
  /members/academy/leaderboard      ← Community progress (opt-in)
```

### 4.2 — Academy Hub (Main Page)

The hub is the member's personalized learning dashboard. Layout adapts between mobile and desktop:

**Desktop Layout:**
```
┌──────────────────────────────────────────────────┐
│  TITM Academy                     [Browse All]   │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌─ Continue Learning ─────────────────────────┐ │
│  │ Course 1.3: The Greeks                      │ │
│  │ Lesson 3 of 6 • "Gamma — The Accelerator"  │ │
│  │ ████████████░░░░░ 50%         [Resume →]    │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ Your Stats ─────┐  ┌─ Streak ────────────┐  │
│  │ 12 Lessons Done   │  │ 🔥 5 Day Streak     │  │
│  │ 2 Courses Done    │  │ Best: 14 days       │  │
│  │ 450 XP            │  │ M T W T F S S       │  │
│  │ Rank: Rising Bull │  │ ● ● ● ● ● ○ ○       │  │
│  └───────────────────┘  └─────────────────────┘  │
│                                                   │
│  ┌─ Recommended Next ──────────────────────────┐ │
│  │ [Card] [Card] [Card]                        │ │
│  │ Greeks  Risk   SPX                          │ │
│  │ Quiz    Mgmt   Setups                       │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ Your Achievements ─────────────────────────┐ │
│  │ [🎓 Foundations] [🎯 Core] [🔒 Pro] [🔒 Exec]│ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Mobile Layout:**
- Stacked single-column
- "Continue Learning" card is prominent and sticky
- Swipeable achievement badges
- Bottom sheet for AI Tutor

### 4.3 — Lesson Player

The lesson player is an immersive, distraction-free experience:

**Desktop:**
```
┌──────────────────────────────────────────────────┐
│ ← Back to Course    Lesson 3 of 6    [AI Tutor] │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌─ Main Content Area (70%) ──────────────────┐  │
│  │                                             │  │
│  │  [Video Player or Rich Text Content]        │  │
│  │                                             │  │
│  │  ─────────────────────────────────────────  │  │
│  │                                             │  │
│  │  Key Takeaways:                             │  │
│  │  • Gamma measures how fast delta changes    │  │
│  │  • Highest at-the-money, near expiration    │  │
│  │  • "Gamma risk" = sudden large moves        │  │
│  │                                             │  │
│  │  ─────────────────────────────────────────  │  │
│  │                                             │  │
│  │  [Interactive: Greek Visualizer]            │  │
│  │                                             │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─ Sidebar (30%) ────────────────────────────┐  │
│  │ Course Progress                             │  │
│  │ ✅ L1: Delta                                │  │
│  │ ✅ L2: Theta                                │  │
│  │ 📖 L3: Gamma ← You are here                │  │
│  │ ○  L4: Vega                                 │  │
│  │ ○  L5: Rho                                  │  │
│  │ 🔒 L6: Visualizer                           │  │
│  │ 🎯 Quiz: Greeks                             │  │
│  │                                             │  │
│  │ ─────────────────────                       │  │
│  │ Estimated: 8 min                            │  │
│  │ ─────────────────────                       │  │
│  │ [Mark as Complete ✓]                        │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─ Navigation ───────────────────────────────┐  │
│  │ [← Previous: Theta]    [Next: Vega →]      │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Mobile:**
- Full-width content, no sidebar
- Course progress becomes a collapsible top bar with progress dots
- AI Tutor opens as a bottom sheet (half-screen, expandable)
- Swipe left/right for previous/next lesson

### 4.4 — AI Tutor Panel

When the member clicks "AI Tutor" from within a lesson:

**Desktop:** Slides in from the right as a 30% width panel (pushing content to 70%)

**Mobile:** Bottom sheet, half-screen default, expandable to full

```
┌─ AI Tutor ─────────────────────┐
│ 🧠 Lesson: Gamma — The Accel.  │
│ ──────────────────────────────  │
│                                 │
│ [AI]: What would you like to    │
│ know about gamma? I can explain │
│ any concept from this lesson or │
│ walk through examples.          │
│                                 │
│ Quick questions:                │
│ [Why is gamma highest ATM?]     │
│ [Gamma vs delta — how related?] │
│ [Show me a gamma risk example]  │
│                                 │
│ ──────────────────────────────  │
│ [Ask anything about this lesson]│
└─────────────────────────────────┘
```

**Quick question chips** are auto-generated per lesson based on common misconceptions and learning objectives.

### 4.5 — Quiz Interface

```
┌──────────────────────────────────────────────────┐
│  Quiz: The Greeks                 Question 3/10  │
│  ████████░░░░░░░░░░ 30%                          │
├──────────────────────────────────────────────────┤
│                                                   │
│  An SPX 4500 call has a delta of 0.45.            │
│  The underlying moves from 4500 to 4510.          │
│                                                   │
│  Approximately how much does the option price      │
│  change? (Ignore other Greeks for now)             │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ ○  $4.50                                    │  │
│  │ ○  $10.00                                   │  │
│  │ ○  $0.45                                    │  │
│  │ ○  $45.00                                   │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  [Submit Answer]                                  │
│                                                   │
│  ── After answering ──                            │
│                                                   │
│  ✅ Correct! $4.50                                │
│  Delta of 0.45 × $10 move = $4.50 change.        │
│  Remember: delta approximates the dollar change   │
│  per $1 move in the underlying.                   │
│                                                   │
│  [💡 Ask AI Tutor to explain more]   [Next →]    │
│                                                   │
└──────────────────────────────────────────────────┘
```

**Key quiz UX decisions:**
- Immediate feedback after each question (not at the end)
- Every wrong answer shows the explanation + offers AI Tutor help
- Passing score: 70% (can retake unlimited times)
- Best score is recorded for Trade Card generation

---

## Part 5: Gamification & Trade Cards

### 5.1 — XP System

| Action | XP |
|--------|----|
| Complete a lesson | 10 XP |
| Pass a quiz (first attempt) | 50 XP |
| Pass a quiz (retake) | 25 XP |
| Complete a course | 100 XP |
| Complete a full track | 500 XP |
| Daily streak (per day) | 5 XP |
| Journal entry on same day as lesson | 15 XP (bonus) |
| Help in AI Tutor chat (ask a question) | 2 XP |

### 5.2 — Ranks

| XP Range | Rank | Badge |
|----------|------|-------|
| 0–99 | Rookie | 🌱 |
| 100–499 | Rising Bull | 📈 |
| 500–1,499 | Sniper Apprentice | 🎯 |
| 1,500–3,999 | Certified Sniper | 💎 |
| 4,000+ | Elite Operator | 🔥 |

### 5.3 — Trade Cards (Shareable Credentials)

Trade Cards are the crown jewel of the gamification system. They serve dual purpose: member achievement AND marketing for TITM.

**Card Types:**

1. **Track Completion Cards** — Earned when completing a full track (Foundations, Core, Pro, Executive)
2. **Milestone Cards** — Earned at key achievements (first journal entry, 30-day streak, 100th trade)
3. **Monthly Recap Cards** — Auto-generated monthly with stats (trades, win rate, lessons completed)

**Card Content:**
```
┌──────────────────────────────────────┐
│  ┌──────────────────────────────┐    │
│  │     TITM ACADEMY             │    │
│  │     ─────────────            │    │
│  │     🎯 CORE SNIPER           │    │
│  │     CERTIFIED                │    │
│  │                              │    │
│  │     Nate K.                  │    │
│  │     @NateKahl                │    │
│  │                              │    │
│  │     Courses: 5/5             │    │
│  │     Quiz Avg: 92%            │    │
│  │     Rank: Certified Sniper   │    │
│  │                              │    │
│  │     Feb 2026                 │    │
│  │     tradeitm.com/verify/abc  │    │
│  └──────────────────────────────┘    │
│                                      │
│  [Share to Twitter]  [Download PNG]  │
│  [Copy Link]                         │
└──────────────────────────────────────┘
```

**Key features:**
- Unique verification URL (proves it's real)
- OpenGraph meta tags so it previews beautifully when shared on social
- Branded with TITM visual identity
- Includes member stats to make it personal
- Shareable as PNG image or link

---

## Part 6: AI-Assisted Content Authoring

### 6.1 — The Authoring Pipeline

Since you want AI-assisted content creation, here's how the admin authoring workflow works:

**Step 1: Outline**
Admin creates a course outline in the existing course editor (title, description, lesson titles)

**Step 2: AI Draft**
For each lesson, the admin clicks "Generate Draft" which:
- Takes the lesson title, course context, and target audience
- Pulls relevant entries from the knowledge base
- Generates a structured lesson with: intro, key concepts, examples, key takeaways
- Generates 5-10 quiz questions with explanations
- Generates quick question chips for the AI Tutor

**Step 3: Review & Edit**
Admin reviews the generated content in a markdown editor, adjusts as needed, adds video URLs, and publishes.

**Step 4: Ongoing Refinement**
AI analyzes quiz performance data and AI Tutor conversations to identify where members struggle, suggesting content improvements.

### 6.2 — Knowledge Base Integration

The existing `knowledge_base` table (18 entries across pricing, features, proof, FAQ, technical, escalation, mentorship, affiliate categories) becomes part of the AI Tutor's context. Additionally:

- Each lesson can reference specific KB entries
- New `training` category entries are auto-generated from lesson content
- The AI Tutor can pull from both lesson content and KB entries for answers

---

## Part 7: Technical Architecture

### 7.1 — New Database Tables

```
learning_paths
  - id, name, slug, description
  - tier_required (core/pro/executive)
  - difficulty_level (beginner/intermediate/advanced)
  - estimated_hours, display_order
  - is_published, created_at, updated_at

learning_path_courses (junction table)
  - learning_path_id → learning_paths.id
  - course_id → courses.id
  - sequence_order
  - is_required (some courses could be optional)

-- Extend existing tables:
ALTER courses ADD:
  - difficulty_level (beginner/intermediate/advanced)
  - learning_path_id (nullable, for primary path association)
  - estimated_hours
  - passing_score (default 70)
  - prerequisites (uuid[] of course IDs)

ALTER lessons ADD:
  - lesson_type (video/text/interactive/scenario/practice)
  - quiz_data (jsonb — questions, answers, explanations)
  - activity_data (jsonb — activity config)
  - ai_tutor_context (text — additional context for the AI Tutor)
  - ai_tutor_chips (text[] — quick question suggestions)
  - estimated_minutes (more granular than current duration_minutes)

user_learning_profiles
  - id, user_id → auth.users.id
  - experience_level (never/paper/beginner/intermediate/advanced)
  - learning_goals (text[])
  - weekly_time_commitment (15/30/60/weekend)
  - broker_status (setup/not_setup/choosing)
  - current_learning_path_id → learning_paths.id
  - onboarding_completed (boolean)
  - onboarding_data (jsonb — full assessment results)
  - created_at, updated_at

user_lesson_progress
  - id, user_id → auth.users.id
  - lesson_id → lessons.id
  - course_id → courses.id
  - status (not_started/in_progress/completed)
  - started_at, completed_at
  - time_spent_seconds (accumulated)
  - quiz_score (nullable, best score)
  - quiz_attempts (integer)
  - quiz_data (jsonb — per-question results for analytics)
  - activity_completed (boolean)
  - notes (text — personal notes on the lesson)

user_course_progress
  - id, user_id → auth.users.id
  - course_id → courses.id
  - status (not_started/in_progress/completed)
  - lessons_completed (integer)
  - total_lessons (integer)
  - overall_quiz_average (numeric)
  - started_at, completed_at
  - certificate_issued (boolean)

user_achievements
  - id, user_id → auth.users.id
  - achievement_type (track_complete/milestone/streak/rank_up)
  - achievement_data (jsonb — details, stats at time of achievement)
  - xp_earned (integer)
  - trade_card_url (text — generated image URL)
  - verification_code (text — unique code for public verification)
  - earned_at

user_xp
  - id, user_id → auth.users.id (unique)
  - total_xp (integer)
  - current_rank (text)
  - current_streak (integer)
  - longest_streak (integer)
  - last_activity_date (date)
  - updated_at

user_learning_activity_log
  - id, user_id → auth.users.id
  - activity_type (lesson_view/lesson_complete/quiz_attempt/quiz_pass/
                    course_complete/tutor_question/achievement_earned)
  - entity_id (uuid — lesson/course/achievement ID)
  - metadata (jsonb)
  - created_at
```

### 7.2 — API Routes (New)

```
/api/academy/onboarding          POST — Submit onboarding assessment
/api/academy/path                GET — Get personalized learning path
/api/academy/courses             GET — List available courses (tier-filtered)
/api/academy/courses/[slug]      GET — Course detail with lessons and progress
/api/academy/lessons/[id]        GET — Lesson content with progress state
/api/academy/lessons/[id]/complete  POST — Mark lesson complete
/api/academy/lessons/[id]/quiz   POST — Submit quiz answers, get results
/api/academy/progress            GET — Overall progress, XP, achievements
/api/academy/achievements        GET — All earned achievements
/api/academy/achievements/[code] GET — Public verification endpoint
/api/academy/recommendations     GET — AI-powered next-step recommendations
/api/academy/tutor/context       GET — Get AI Tutor context for a lesson
/api/academy/leaderboard         GET — Community leaderboard (opt-in)

/api/admin/academy/content/generate  POST — AI-generate lesson draft
/api/admin/academy/analytics        GET — Learning analytics dashboard
```

### 7.3 — Component Architecture

```
components/academy/
  ├── academy-hub.tsx              — Main dashboard
  ├── onboarding-wizard.tsx        — Placement assessment flow
  ├── learning-path-view.tsx       — Personalized path visualization
  ├── course-catalog.tsx           — Browse all courses
  ├── course-card.tsx              — Course preview card
  ├── course-detail.tsx            — Course page with lesson list
  ├── lesson-player.tsx            — Immersive lesson viewer
  ├── lesson-content-renderer.tsx  — Renders markdown + interactive elements
  ├── video-player.tsx             — Video embed (YouTube/Vimeo/custom)
  ├── quiz-engine.tsx              — Quiz UI with all question types
  ├── quiz-question.tsx            — Individual question component
  ├── quiz-results.tsx             — Score display + recommendations
  ├── ai-tutor-panel.tsx           — Contextual AI chat (reuses AI Coach)
  ├── ai-tutor-chips.tsx           — Quick question suggestion chips
  ├── progress-tracker.tsx         — Course progress sidebar
  ├── achievement-card.tsx         — Badge/achievement display
  ├── trade-card-generator.tsx     — Shareable credential card
  ├── trade-card-preview.tsx       — Card preview before sharing
  ├── xp-display.tsx               — XP bar + rank display
  ├── streak-calendar.tsx          — Learning streak visualization
  ├── leaderboard.tsx              — Community rankings
  ├── interactive/
  │   ├── greek-visualizer.tsx     — Interactive Greek sliders
  │   ├── position-sizer.tsx       — Position size calculator
  │   ├── risk-reward-calc.tsx     — R-multiple calculator
  │   └── options-chain-trainer.tsx— Practice reading options chains
  └── admin/
      ├── content-generator.tsx    — AI lesson drafting tool
      ├── quiz-editor.tsx          — Quiz question builder
      └── learning-analytics.tsx   — Admin analytics dashboard
```

### 7.4 — AI Tutor Implementation

The AI Tutor reuses the existing AI Coach infrastructure with a modified flow:

```
1. Member opens AI Tutor from lesson view
2. Frontend calls GET /api/academy/tutor/context?lesson_id=xxx
3. Backend constructs tutor system prompt:
   - Base TITM trading context (from knowledge_base)
   - Current lesson content + learning objectives
   - Member's progress data (what they've completed, quiz scores)
   - Quick question chips for this lesson
4. Creates ai_coach_session with metadata: { context_type: "tutor", lesson_id: xxx }
5. Messages flow through existing ai_coach_messages table
6. AI responses are scoped to lesson topic + TITM knowledge
```

### 7.5 — Trade Card Generation

Trade Cards are generated as server-side rendered images:

```
1. Member completes a track/milestone → triggers achievement
2. Backend generates achievement record with verification_code
3. Edge Function generates card image (using Satori or similar):
   - Pulls member profile (name, avatar, tier)
   - Pulls achievement stats (courses completed, quiz avg, rank)
   - Renders branded card template to PNG
   - Stores in Supabase Storage
4. Public verification page: /verify/[code] → shows card + confirms legitimacy
5. OpenGraph meta tags on verification page for rich social sharing
```

---

## Part 8: Phased Rollout

### Phase 1: Foundation (Weeks 1-3)
**Goal:** Core infrastructure + first courses playable

- Database migrations (new tables + schema extensions)
- Academy hub page (replaces Coming Soon library)
- Lesson player (video + markdown content)
- Basic progress tracking (lesson completion)
- Course catalog with tier gating
- Onboarding assessment flow
- Port admin course editor to support new fields (quiz data, lesson types)
- **Content:** Course 1.1 (Welcome to TITM) + Course 1.2 (Options 101) fully authored

### Phase 2: Intelligence (Weeks 4-5)
**Goal:** AI integration + assessments

- Quiz engine (all question types)
- AI Tutor panel (contextual AI within lessons)
- AI content generation for admin (lesson drafts from outlines)
- Quick question chips per lesson
- Personalized recommendations engine
- **Content:** Courses 1.3 (Greeks) + 1.4 (Broker Setup) + 1.5 (Risk Management)

### Phase 3: Engagement (Weeks 6-7)
**Goal:** Gamification + social features

- XP system + ranks
- Achievement tracking
- Trade Card generation + sharing
- Learning streak tracking
- Leaderboard (opt-in)
- **Content:** Track 2 (Core Strategies) — courses 2.1, 2.2, 2.3

### Phase 4: Advanced Content (Weeks 8-10)
**Goal:** Full curriculum + interactive elements

- Interactive lessons (Greek visualizer, position sizer, risk calculator)
- Scenario-based lessons
- Practical checkpoints (tied to Journal data)
- Admin analytics dashboard
- **Content:** Tracks 3, 4, 5 (Pro, Executive, Psychology)

### Phase 5: Polish & Scale (Weeks 11-12)
**Goal:** Refinement based on member feedback

- Performance optimization (lazy loading, caching)
- Mobile UX refinement
- Content quality improvements based on quiz analytics
- A/B testing on lesson formats
- Push notification reminders for streaks

---

## Part 9: Sustainability & Maintenance

### Content Maintenance
- **AI-assisted updates:** When market conditions or TITM strategies change, admins describe the update and AI regenerates affected lesson sections
- **Analytics-driven:** Dashboard shows which lessons have lowest completion rates, worst quiz scores, and most AI Tutor questions — flagging content that needs improvement
- **Modular content:** Lessons are independent units. Updating one lesson doesn't require touching others

### Technical Maintenance
- **No external LMS dependency:** Everything is built on your existing Next.js + Supabase stack
- **Content as data:** All content lives in the database, not hardcoded in components
- **API-first:** Every feature accessible via API, enabling future mobile app or Discord bot integration
- **Standard patterns:** Uses the same component patterns, auth system, and permission model as the rest of the members area

### Cost Considerations (Under 500 Members)
- **AI Tutor:** ~$0.01–0.03 per conversation turn (Claude API). At 500 members averaging 5 tutor questions/week = ~$100-300/month
- **Trade Card generation:** Edge Function with image generation — minimal cost at this scale
- **Storage:** Lesson content is text/markdown — negligible. Video hosted externally (YouTube/Vimeo)
- **Database:** Well within Supabase free/pro tier limits

---

## Part 10: What This Proposal Does NOT Include (Future Considerations)

The following are explicitly out of scope for this proposal but architecturally possible later:

1. **Discord integration** — Auto-assign roles based on course completion, post achievements to a channel
2. **Live cohort classes** — Scheduled group lessons with real-time instruction
3. **Peer review** — Members review each other's trade journals
4. **Custom learning paths** — Members build their own curriculum
5. **White-label** — Selling the LMS framework to other trading communities
6. **Mobile app** — Native iOS/Android app (API-first design makes this possible)
7. **Certificate PDFs** — Downloadable formal certificates (beyond Trade Cards)
8. **Spaced repetition** — SRS-style review scheduling for key concepts

---

## Open Questions for Scope Finalization

Before converting this to a full dev spec, I'd like your input on:

1. **Video hosting:** Do you want to self-host videos (Supabase Storage / Mux) or use YouTube/Vimeo embeds? Embeds are simpler and cheaper; self-hosting gives more control.

2. **Academy access:** Should Academy be available to ALL tiers (Core sees Foundation + Core tracks, Pro sees those + Pro tracks, etc.) or only Pro+ as currently configured in the sidebar?

3. **Leaderboard privacy:** Should the leaderboard show real names/Discord usernames, or anonymous "Member #xxx" by default?

4. **Interactive elements priority:** The Greek Visualizer, Position Sizer, and Options Chain Trainer are the most complex components. Should all three be in the initial build, or should we start with one and add others in later phases?

5. **Content authoring timeline:** Do you want AI to generate ALL initial course content from outlines, or will some courses have manually authored content (videos you've already recorded, etc.)?

6. **Existing content:** Do you have any existing educational content (videos, PDFs, documents) that should be migrated into the system?

---

*This proposal is designed to be iterated on. Once we align on scope, the next deliverable is a complete development specification document with database schemas, API contracts, component specs, and implementation instructions that Codex can execute autonomously.*
