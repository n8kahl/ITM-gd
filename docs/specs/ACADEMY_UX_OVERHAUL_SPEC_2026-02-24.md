# Academy UX Overhaul Specification
**Date:** February 24, 2026
**Version:** 1.0
**Status:** Design Research & Specification Document
**Audience:** Design, Frontend, Product

---

## Executive Summary

TradeITM's Academy is a structured learning platform for trading education, but the current UX treats lessons as static text and blocks as checkboxes rather than engaging, interactive learning experiences. This spec proposes a world-class interactive learning platform that combines:

- **Engagement mechanics** from Duolingo (streaks, XP, leaderboards)
- **Interactive content design** from Brilliant.org (step-by-step exploration, low-stakes quizzes)
- **Mastery-based progression** from Khan Academy (competency tracking, adaptive recommendations)
- **Options-specific interactivity** (Greeks visualizations, payoff diagrams, position builders)

The redesign maintains the Emerald Standard aesthetic while transforming the academy into a habit-forming, visually rich, and educationally rigorous experience.

---

## 1. Current UX Audit

### What Works

1. **Clear Navigation Structure**
   - Sub-nav (Dashboard → Modules → Review → Progress) is intuitive
   - Module catalog organized by track is logical
   - Lesson viewer shows block-by-block progression with visual indicators

2. **Foundation Components**
   - Academy Shell and Card components provide consistent styling
   - Glass-card-heavy aesthetic is applied consistently
   - Dark mode with Emerald/Champagne palette is properly implemented

3. **Progress Tracking**
   - Block completion dots show learner progress visually
   - Lesson row status indicators (Done/Next/In Progress/Locked) are clear
   - Progress overview tracks completed lessons and competency breakdown

4. **Data Management**
   - Client-side data fetching with error states
   - Resume functionality to return to last active lesson
   - Recommendation engine suggests next steps

### Critical Gaps

1. **Lesson Viewer is Textbook-Like**
   - Blocks are just images + markdown text
   - No interactive elements beyond clicking "Complete & Continue"
   - Learners are passive readers, not active problem-solvers
   - No celebration or feedback on completion
   - Block types (hook, concept_explanation, worked_example, guided_practice, independent_practice, reflection) exist but don't map to distinct interactive patterns

2. **No Gamification or Habit Formation**
   - No daily streak system
   - No XP/points accumulation
   - No achievement badges or milestones
   - No leaderboard integration with Trade Social
   - Learning feels obligatory, not rewarding

3. **Module Catalog Lacks Context**
   - No difficulty indicators (Beginner / Intermediate / Advanced)
   - No estimated time-to-completion prominently displayed
   - No visual prerequisite chains
   - No "quick win" modules to build initial momentum

4. **Dashboard Doesn't Compel Continuation**
   - "Continue Learning" is a secondary card
   - No daily streak visible
   - No motivational messaging
   - Progress ring is small and not prominent
   - No "today's milestone" or next recommended action

5. **Progress View Lacks Actionability**
   - Competency breakdown is list-based, not visual (no radar chart)
   - No learning velocity metric (lessons/week)
   - No predicted completion date
   - No clear remediation pathways for weak competencies

6. **Missing Options-Domain Interactivity**
   - No Greeks visualizations (Delta, Gamma, Theta, Vega, Rho)
   - No payoff diagram builders
   - No animated Greeks curves showing volatility/time/strike sensitivity
   - No options chain simulators
   - No real-time SPX mini-chart context
   - Lessons about options concepts are passive reading, not hands-on exploration

7. **Activity Types Are Homogeneous**
   - Every block is "read markdown + click complete"
   - No fill-in-the-blank exercises
   - No flashcards or spaced repetition
   - No timed quizzes with immediate feedback
   - No drag-and-drop position builders
   - No "spot the mistake" scenario drills

8. **Review Queue Lacks Engagement**
   - Simple textarea for answers
   - No spaced-repetition algorithm visible
   - No confidence rating feedback loop
   - Feels like homework, not reinforcement

9. **Mobile Experience is Text-Heavy**
   - Long markdown blocks don't scale well
   - No touch-optimized interactive activities
   - No swipe-through progression
   - Buttons are small and hard to tap

10. **No Visual Hierarchy in Content**
    - Hero images per lesson exist but aren't leveraged
    - Inline diagrams/charts missing
    - Typography is consistent but lacks personality
    - No animated entry/exit transitions

---

## 2. Dashboard Redesign

### Problem It Solves
Current dashboard buries the "continue learning" action and provides no motivational context or sense of momentum.

### New Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ACADEMY DASHBOARD                                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ HERO SECTION (Prominent) ─────────────────────────────┐ │
│  │                                                          │ │
│  │  "Welcome back, [Name]"                                │ │
│  │                                                          │ │
│  │  🔥 STREAK: 12 days     ⭐ LEVEL 8     🎯 545 XP      │ │
│  │  (animated flame icon if streak > 7)                   │ │
│  │                                                          │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ YOUR NEXT MILESTONE: Complete 10 lessons        │  │ │
│  │  │ Progress: ████████░░ 8/10   (+2 XP when done)  │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                          │ │
│  │  [CONTINUE LEARNING →] [BROWSE MODULES] [VIEW STATS]  │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ CONTINUE LEARNING (Large Card with CTA) ──────────────┐ │
│  │                                                          │ │
│  │  Lesson: "Greeks Explained: Delta & Gamma"             │ │
│  │  Module: Options Fundamentals · 4/12 lessons           │ │
│  │  Progress: ●●●●●●○○○○○○ Block 6 of 12                 │ │
│  │  Est. time: 12 minutes                                 │ │
│  │                                                          │ │
│  │  [RESUME LESSON] [NEW LESSON] [BROWSE MODULES]        │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ GRID (3 Cards) ──────────────────────────────────────┐  │
│  │                                                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │ THIS WEEK    │  │ NEXT TOPIC   │  │ QUICK WINS   │ │  │
│  │  │              │  │              │  │              │ │  │
│  │  │ 3 lessons    │  │ Implied Vol. │  │ 5 min each   │ │  │
│  │  │ 45 min       │  │ Volatility   │  │ 3 modules    │ │  │
│  │  │ +15 XP       │  │ Strategies   │  │ Start now →  │ │  │
│  │  │              │  │              │  │              │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │  │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Streak & Achievement Banner
- **Component:** `AcademyStreakBanner`
- **Location:** Top of dashboard
- **Features:**
  - Animated flame icon (Lucide Flame, 1.5px stroke) that scales up on hover
  - Display: "🔥 12-day streak" with milestone unlock at 7, 30, 100 days
  - Level indicator (Level 1–20, unlocked as learner progresses through modules)
  - XP counter with weekly breakdown
  - Streak Freeze button (one free skip per week, Duolingo-style)
  - Color: Emerald elite for active streaks, Amber/200 for "at risk" (< 1 day left)

#### 2. Milestone Progress Card
- **Component:** `AcademyMilestoneCard`
- **Features:**
  - Displays next 3 milestones (Complete 10 lessons → 20 → 50, etc.)
  - Linear progress bar with animated fill on load
  - XP reward shown next to each milestone
  - Confetti animation when milestone is unlocked (only on continued sessions)
  - Estimated days to completion based on learning velocity

#### 3. Continue Learning CTA
- **Component:** `AcademyContinueLearningHero`
- **Features:**
  - Large glass card (not a secondary item)
  - Lesson hero image as background (with gradient overlay)
  - Lesson title, module context, progress dots
  - Estimated time to completion (e.g., "12 min left in this block")
  - Primary button: "Resume Lesson" with chevron icon
  - Secondary: "Start New Lesson" / "Browse Modules"

#### 4. Weekly Summary Grid
- **Component:** `AcademyWeeklySummary`
- **Cards:**
  - **This Week:** Lessons completed, total time spent, XP earned
  - **Recommended Next:** AI-recommended module based on weak competencies
  - **Quick Wins:** Modules < 15 min to complete (habit stacking)

#### 5. Achievement Badges Section
- **Component:** `AcademyAchievementGrid`
- **Features:**
  - Displays unlocked and locked badges (e.g., "First 5 Lessons", "Week Warrior", "Greeks Master")
  - Locked badges show progress toward unlock
  - Click to see unlock criteria
  - Slide-in animation on new unlock

### Emerald Standard Compliance
- Streak banner uses `var(--emerald-elite)` for active state
- Glass cards use `glass-card-heavy` with `border-white/10`
- Flame icon is emerald-colored when active
- XP counter uses Geist Mono for numeric consistency
- Confetti uses emerald + champagne color palette
- All typography follows Playfair (headings) / Inter (body) rules

### Accessibility Notes
- Streak counter is announced as "12 day streak" for screen readers
- Milestone progress bar has `aria-valuenow`, `aria-valuemax` attributes
- Badge unlock animations respect `prefers-reduced-motion`
- All CTAs have clear focus states (ring: Emerald Elite)

---

## 3. Module Catalog Redesign

### Problem It Solves
Current catalog lacks visual hierarchy, difficulty signaling, and time expectations, making it hard for learners to pick the right module or understand commitment.

### New Catalog Layout

```
┌─────────────────────────────────────────────────────────────┐
│ MODULES CATALOG                                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  FILTER & SORT (Horizontal)                                 │
│  [All Tracks ▼] [Beginner ▼] [Sort by: Recommended ▼]     │
│                                                               │
│  ┌─ TRACK 1: OPTIONS FUNDAMENTALS ─────────────────────────┐ │
│  │ Track 1 of 3 · Progress: ███████░░░░░ 7/12 modules     │ │
│  │                                                          │ │
│  │  ┌──────────────┬──────────────┬──────────────┐         │ │
│  │  │ CARD         │ CARD         │ CARD         │         │ │
│  │  │              │              │              │         │ │
│  │  │ [Hero Img]   │ [Hero Img]   │ [Hero Img]   │         │ │
│  │  │              │              │              │         │ │
│  │  │ Title        │ Title        │ Title        │         │ │
│  │  │ ⭐ Beginner  │ 🟢 Intermed. │ 🔴 Advanced  │         │ │
│  │  │              │              │              │         │ │
│  │  │ 8 lessons    │ 12 lessons   │ 10 lessons   │         │ │
│  │  │ ~45 min      │ ~90 min      │ ~120 min     │         │ │
│  │  │              │              │              │         │ │
│  │  │ Prerequisites│ Prerequisites│ Prerequisites│         │ │
│  │  │ (icons)      │ (icons)      │ (icons)      │         │ │
│  │  │              │              │              │         │ │
│  │  │ Progress:    │ Progress:    │ [LOCKED]     │         │ │
│  │  │ ██████░░ 75% │ ░░░░░░░░░░░░ │ Req: Module 2│         │ │
│  │  │              │              │              │         │ │
│  │  └──────────────┴──────────────┴──────────────┘         │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────┘  │ │
│                                                               │
│  ┌─ TRACK 2: ADVANCED STRATEGIES ──────────────────────────┐ │
│  │ Track 2 of 3 · Progress: ░░░░░░░░░░░░ 0/8 modules      │ │
│  │ (Unlock after completing Track 1)                       │ │
│  └──────────────────────────────────────────────────────┘  │ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Module Card Enhancement
- **Component:** `AcademyModuleCardV2`
- **Current:** Image + Title + Description + Lesson Count + Progress Bar
- **Enhanced:**
  - Hero image (with gradient overlay for text readability)
  - Difficulty badge: ⭐ Beginner (Emerald) / 🟢 Intermediate (Champagne) / 🔴 Advanced (Amber)
  - Lesson count + estimated time prominently displayed
  - Prerequisite chain shown as small icons or badge (e.g., "Requires: Module 1")
  - Progress bar only if started
  - Lock state with unlock criteria if prerequisites not met
  - Hover: Slight lift + border emerald glow + description fade-in
  - Click: Navigate to module detail or show prerequisite tooltip

#### 2. Difficulty Indicators
- **Beginner:** ⭐ (1 star) — No prerequisites, 1–15 lessons, < 90 min
- **Intermediate:** 🟢 (circle) — 1–2 prerequisites, 10–20 lessons, 90–180 min
- **Advanced:** 🔴 (circle) — 2+ prerequisites, 15+ lessons, > 180 min
- **Color-coded:** Emerald, Champagne, Amber respectively

#### 3. Estimated Time Display
- Show: "~45 min" in Geist Mono
- Add: "Typically 6 lessons/week → ~2 weeks for you"
- Calculation based on learner's historical velocity

#### 4. Prerequisite Chain Visualization
- **Component:** `AcademyPrerequisiteChain`
- **Shows:** [Module 1] → [Module 2] → [Current Module]
- **Icons:** Use Lucide `ArrowRight` (1.5px stroke)
- **Completed modules:** Emerald with checkmark
- **In progress:** Champagne outline
- **Locked:** Gray with lock icon

#### 5. Quick-Win Filters
- **Component:** `AcademyQuickWinFilter`
- **Shortcut:** "Show modules < 30 min" button
- **Purpose:** Help new learners build momentum with early wins
- **Badge on cards:** "Quick Win ⚡"

### Emerald Standard Compliance
- Card backgrounds: `glass-card-heavy` with `border-white/10`
- Difficulty badges: Emerald-500, Champagne-400, Amber-400 (no dark variant)
- Icons: Lucide, 1.5px stroke
- Typography: Playfair Display for titles, Inter for meta

### Accessibility Notes
- Difficulty level announced: "Beginner difficulty module"
- Locked cards have `aria-disabled="true"` + tooltip explaining prerequisites
- Prerequisite chain is announced as "Requires Module 1, then Module 2"
- Time estimates are announced: "Approximately 45 minutes"

---

## 4. Lesson Viewer Overhaul

### Problem It Solves
Current viewer is passive and text-heavy. Blocks should feel like interactive explorations, not chapters in a textbook. Options concepts especially need visual, hands-on learning.

### New Block Architecture

Instead of just displaying a block as image + markdown, blocks now have a **block type → activity type mapping**:

| Block Type | Activity Type | Example |
|---|---|---|
| `hook` | **Scenario Setup** | "You've sold a call. Theta is working for you. How much time decay today?" |
| `concept_explanation` | **Interactive Visualization** + **Guided Q&A** | Greeks surface with draggable sliders showing Delta/Theta/Vega changes |
| `worked_example` | **Annotated Chart Walkthrough** + **Replay Mode** | Trade entry-to-exit with pause points asking "What happens if price moves 5% here?" |
| `guided_practice` | **Drag-and-Drop Exercise** or **Fill-in-the-Blank** | "Build a call spread: [Sell Call at ___] [Buy Call at ___]" with visual feedback |
| `independent_practice` | **Scenario Simulator** + **P&L Calculator** | "You're short 2 calls at 2.50. Underlying moves to X. What's your P&L?" |
| `reflection` | **Spaced Repetition Flashcard** + **Confidence Rating** | "Explain how gamma affects your risk profile." |

### New Lesson Viewer Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ◀ Options Fundamentals | Lesson 6 of 12 (75%)               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ LESSON HERO ──────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  [Large Hero Image with Gradient Overlay]             │ │
│  │                                                         │ │
│  │  "Greeks Explained: Delta & Gamma"                    │ │
│  │  Learning Objective: Understand how Greeks measure    │ │
│  │  option sensitivity to price and volatility changes.  │ │
│  │                                                         │ │
│  │  ⏱️ ~20 min · 🎯 XP reward: +75 · 📊 Level 6 topic    │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ BLOCK 4 OF 12: "Interactive Greeks Visualization" ─────┐ │
│  │                                                          │ │
│  │  [Block Type Badge: concept_explanation]                │ │
│  │                                                          │ │
│  │  ### Understanding Delta                                │ │
│  │  Delta measures how much your option price changes      │ │
│  │  when the underlying stock moves $1.                    │ │
│  │                                                          │ │
│  │  ┌── INTERACTIVE WIDGET ────────────────────────────┐  │ │
│  │  │                                                  │  │ │
│  │  │  Drag to adjust underlying price:               │  │ │
│  │  │  ◄─────●─────► SPX @ 5370 (5350–5390)          │  │ │
│  │  │                                                  │  │ │
│  │  │  ┌─ CALL OPTION (100 delta) ─────────────────┐ │  │ │
│  │  │  │ Strike: 5350                              │ │  │ │
│  │  │  │ Delta: ███████████ 0.98 (deep ITM)        │ │  │ │
│  │  │  │ Price: $25.30 → Price change: +$2.10    │ │  │ │
│  │  │  │ (for $1 SPX move)                         │ │  │ │
│  │  │  └────────────────────────────────────────────┘ │  │ │
│  │  │                                                  │  │ │
│  │  │  ┌─ ATM CALL (50 delta) ─────────────────────┐ │  │ │
│  │  │  │ Strike: 5370                              │ │  │ │
│  │  │  │ Delta: █████░░░░░░░░ 0.50 (ATM)           │ │  │ │
│  │  │  │ Price: $2.80 → Price change: +$0.50      │ │  │ │
│  │  │  └────────────────────────────────────────────┘ │  │ │
│  │  │                                                  │  │ │
│  │  │  ┌─ OTM CALL (25 delta) ─────────────────────┐ │  │ │
│  │  │  │ Strike: 5390                              │ │  │ │
│  │  │  │ Delta: ██░░░░░░░░░░░░ 0.25 (OTM)          │ │  │ │
│  │  │  │ Price: $0.60 → Price change: +$0.15      │ │  │ │
│  │  │  └────────────────────────────────────────────┘ │  │ │
│  │  │                                                  │  │ │
│  │  │ 💡 Notice: Delta is higher for deeper ITM     │  │ │
│  │  │    options. As the option moves ITM, it       │  │ │
│  │  │    becomes more like the stock itself.        │  │ │
│  │  │                                                  │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                          │ │
│  │  ### Key Takeaway                                        │ │
│  │  Delta = sensitivity to price. Use it to hedge or       │ │
│  │  position size. Higher delta = more stock-like.        │ │
│  │                                                          │ │
│  │  [⚡ Check Your Understanding →]                        │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────┘  │ │
│                                                               │
│  BLOCK PROGRESS: ●●●●○○○○○○○○ (4/12)                        │
│                                                               │
│  ┌─ CONTROLS ────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  [⬅ Previous] [Mark Complete & Continue →] [Skip ⏩] │  │
│  │                                                        │  │
│  │  ✓ Completed blocks earn XP instantly shown above    │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Interactive Components

#### 1. **Concept Explanation Widget: Greeks Slider**
- **Component:** `AcademyGreekVisualizer`
- **Features:**
  - Horizontal slider for underlying price (5% range around current)
  - Real-time Greeks surface update (Delta, Gamma, Theta, Vega)
  - Color-coded sensitivity (green for positive, amber for negative)
  - Animated curve showing Greek behavior across strikes
  - Tooltip on hover: "Delta is 0.75 — for every $1 the stock moves, this option moves ~$0.75"
  - "Reset" button to return to initial state
  - Fullscreen option to expand visualization
- **Data Source:** Massive.com API (backend calculates Greeks in real-time)
- **Emerald Standard:** Emerald curves for Delta, Champagne for Theta, Amber for Vega

#### 2. **Worked Example: Annotated Chart with Pause Points**
- **Component:** `AcademyChartWalkthrough`
- **Features:**
  - Embedded SPX 1-min chart showing actual trade replay
  - Pause points (circles) at key moments: entry, first 5% move, exit
  - Click pause point → tooltip explains decision ("Here we entered. Price moved 2% in our favor. Theta is working for us.")
  - Play button to auto-advance through pauses
  - Annotations show Greeks values at each pause point
- **Interaction:** Drag slider to scrub through trade timeline
- **Mobile:** Swipe left/right to advance

#### 3. **Guided Practice: Fill-in-the-Blank Options Chain Reader**
- **Component:** `AcademyOptionsChainExercise`
- **Scenario:** "Given this SPX options chain, answer these questions:"
  - "What is the Delta of the 5370 Call?" → Student fills in "0.65" (auto-validate against tolerance ±0.05)
  - "Which call has more Gamma: 5350 or 5370?" → Multiple choice with explanation
  - "If SPX moves +2%, how much does the 5370 Call change?" → Calculate based on delta shown in chain
- **Feedback:** Instant green checkmark (correct) or orange retry (incorrect) with hint
- **XP:** +10 points per correct answer, streak multiplier for consecutive correct answers

#### 4. **Independent Practice: Scenario Simulator**
- **Component:** `AcademyScenarioSimulator`
- **Setup:** "You sold a 5400 call at $1.50. SPX is now 5385. Theta has decayed the premium to $1.20. What's your status?"
- **Interactive:**
  - Slider to adjust SPX price (see P&L update in real-time)
  - Display: "Unrealized P&L: +$30 per contract (Theta decay working for you)"
  - Question: "If SPX rallies to 5400, you lose how much?" → Fill in answer
  - Display: "At 5400, the option is worth $2.00, so you lose $50 per contract"
- **Challenge modes:** "Timed" (30 sec), "Zen" (unlimited), "Hardcore" (without hints)

#### 5. **Reflection: Spaced Repetition Flashcard**
- **Component:** `AcademyFlashcard`
- **Front:** "Explain how Gamma affects your P&L as the underlying approaches your strike."
- **Interaction:** Student types or voice-records answer (optional)
- **Back:** "Gamma accelerates Delta changes near ATM strikes. As price approaches your strike, Gamma increases, so your Delta sensitivity increases faster. This can work for you (long Gamma = happy moves) or against you (short Gamma = penalized on moves)."
- **Confidence Rating:** "How confident in your answer?" [😞 Unsure] [😐 Medium] [😊 Confident]
- **Spaced Repetition:** Algorithm reschedules for 1 day (unsure), 3 days (medium), 7 days (confident)

#### 6. **Inline Mini-Chart: Real-Time SPX Context**
- **Component:** `AcademyMiniSPXChart`
- **Location:** Top-right corner of lesson viewer
- **Features:**
  - Live SPX 5-min chart (small, always visible)
  - Current price + 24h change
  - Click to expand or ignore
  - Shows relevant option Greeks if applicable to lesson topic
  - Updates every 5 seconds (Supabase realtime)

#### 7. **Block Completion Celebration**
- **Component:** `AcademyBlockCompletionCelebration`
- **Trigger:** When student clicks "Complete & Continue"
- **Animation:**
  - Confetti burst (emerald + champagne colors, 50 particles)
  - "✨ +75 XP earned!" toast (2-second duration)
  - Block progress dot animates fill in Emerald
  - Optional: "You're on fire! 🔥 3-block streak!" if applicable
  - Sound effect (optional, respects system audio)
- **Timing:** 1-second animation, then auto-advance or wait for button tap

### Activity Type Mapping Table

| Block Type | Visual Treatment | Interaction | Feedback | XP Reward |
|---|---|---|---|---|
| `hook` | Bold headline + context image | Read scenario, click "I'm ready" | Encouraging message | 0 (setup) |
| `concept_explanation` | Diagram + slider widget | Drag slider, read explanations | Real-time Greek updates | +50 |
| `worked_example` | Annotated chart + pause UI | Click pauses, drag timeline | Tooltip explanations | +25 |
| `guided_practice` | Options chain + fill-in | Type answer, validate | Green/orange feedback + hint | +10 per Q |
| `independent_practice` | Scenario setup + simulator | Drag simulator, answer questions | Immediate P&L feedback | +50 |
| `reflection` | Flashcard front/back | Type/speak, rate confidence | Compare your answer to model | +25 |

### Mobile-Optimized Activity Design

1. **Vertical Layout:** Stacked widgets (slider above chart above text)
2. **Touch Targets:** Buttons ≥ 48px, sliders ≥ 44px wide
3. **Swipe Gestures:** Swipe left to advance block, swipe right to go back
4. **Responsive Sizing:** Charts scale to viewport width, text is readable at 16px+
5. **One-Hand Access:** Primary CTA buttons in bottom-right reachable zone

### Emerald Standard Compliance
- Interactive widgets use Emerald-500 for primary actions, Champagne for secondary
- All charts use Emerald + Champagne gradient for lines/fills
- Geist Mono for numeric displays (Greeks, prices, P&L)
- Glass-card-heavy for widget containers
- Animations respect `prefers-reduced-motion`

### Accessibility Notes
- Every interactive element has clear focus states (ring: Emerald Elite)
- Chart interactions have ARIA labels: "Greek Visualizer, use arrow keys to adjust price, or click slider"
- Fill-in-the-blank has `aria-label="Input field for Delta answer"`
- Flashcard has `aria-live="polite"` for answer reveal
- Confetti animation is decorative only; announcement is via toast

---

## 5. Gamification System

### Problem It Solves
Learning without feedback loops and rewards feels like work. Duolingo's streaks, XP, and leaderboards turn learning into a habit.

### XP System

**XP Earning Rules:**
- Completing a block: 50 XP base
  - Difficulty multiplier: Beginner (1x) / Intermediate (1.5x) / Advanced (2x)
  - Speed bonus: Complete within estimated time → +25% XP
  - Streak multiplier: (2–10 consecutive days) → +10–50% XP
- Passing guided practice question: 10 XP per correct answer (first try)
- Completing a module: +200 XP bonus
- 7-day streak: +100 XP milestone bonus
- 30-day streak: +500 XP milestone bonus
- 100-day streak: +2000 XP milestone bonus + badge "Commitment to Mastery"

**Example:**
- Intermediate block completed in 8 minutes (vs. 12 min estimated): 50 × 1.5 × 1.25 × 1.2 (5-day streak) = **112 XP**

### Leveling System

**Level Progression:**
- Level 1–5: 100–300 XP per level (beginner-friendly pace)
- Level 6–10: 300–500 XP per level (moderate acceleration)
- Level 11–20: 500–1000 XP per level (mastery grind)
- Soft cap at Level 20 (learners can still gain XP, just no new levels after 20)

**Level Unlocks:**
- Level 5: Unlock "Advanced Modules" section
- Level 10: Unlock "Profile Badge" and "Leaderboard Integration" with Trade Social
- Level 15: Unlock "Instructor Mode" (curate your own learning paths)

### Streak System

**Mechanics:**
- Streak increases by 1 per day if learner completes ≥ 1 block
- Streak resets to 0 if no activity for 48 hours
- Streak Freeze: Free once per week, skip 1 day without breaking streak
- Additional Freezes: 100 XP each (earned, not paid)

**Milestones:**
- 7 days: 🔥 "Week Warrior" badge
- 30 days: 🏆 "Month Master" badge + "Commitment" title
- 100 days: 👑 "Century Champion" badge + "Trading Scholar" title + Profile glow effect (Emerald aura)

**Visual Treatment:**
- Flame icon size scales: 1x (days 1–6) → 1.5x (days 7–29) → 2x (days 30+)
- Flame color: Emerald (normal) → Amber (at risk, < 24 hours left)

### Achievement Badges

**Badge System:**
- Total 20 badges across 3 categories: **Learner**, **Trader**, **Scholar**

**Learner Badges:**
- "First Steps" (Complete 1 lesson)
- "On a Roll" (3-day streak)
- "Week Warrior" (7-day streak)
- "Month Master" (30-day streak)
- "Century Champion" (100-day streak)

**Trader Badges:**
- "Greeks Scholar" (Complete Options Fundamentals module)
- "Risk Manager" (Complete Risk Management module)
- "Options Strategist" (Complete Advanced Strategies module)
- "SPX Specialist" (Complete all SPX-focused lessons)
- "Volatility Whisperer" (Complete Volatility & IV Rank module with 85%+ mastery)

**Scholar Badges:**
- "Perfect Lesson" (Complete a lesson with 100% correct answers on all practice blocks)
- "Speed Demon" (Complete 5 blocks in 1 session)
- "Deep Diver" (Spend 10+ hours in academy per week for 4 weeks)
- "Mentor" (Share 5 lessons to Trade Social leaderboard)
- "Curator" (Create custom learning path used by 10+ peers)

**Badge Unlock Notifications:**
- Toast: "🎉 Unlocked Badge: Greeks Scholar"
- Badge detail page: Criteria met, date unlocked, progress on related badges
- Profile integration: Badges visible on trader profile, ordered by unlock date

### Leaderboard Integration

**Component:** `AcademyLeaderboardWidget` (on Dashboard)
- **Connection:** Trade Social leaderboard system
- **Metrics:**
  - XP Rank: Top 100 by total XP (weekly/monthly/all-time views)
  - Streak Rank: Top 50 by active streak length
  - Module Mastery: Top 50 by avg. module score (≥80% required)
- **Display:**
  - Your rank, your score, top 3 peers
  - "View Full Leaderboard" link
  - Friend streaks visible (if following)
  - Leaderboard reset weekly (Monday) for competitive engagement

**Privacy:** Learners can opt-out of leaderboard visibility (hidden from public, visible only to friends)

### Gamification Data Model

```typescript
// User Gamification State
{
  userId: string
  totalXP: number
  currentLevel: number
  currentStreak: number
  longestStreak: number
  streakFreezeUsedThisWeek: boolean
  unlockedBadges: string[] // ["week_warrior", "greek_scholar", ...]
  lastActivityAt: DateTime
  leaderboardOptIn: boolean
}

// Session XP Calculation
{
  blockId: string
  blockType: string // "concept_explanation", "guided_practice", etc.
  difficulty: "beginner" | "intermediate" | "advanced"
  estimatedMinutes: number
  actualMinutes: number
  isFirstCorrect: boolean // for practice blocks
  streakMultiplier: number // 1.0 to 1.5
  xpEarned: number
  timestamp: DateTime
}
```

### Emerald Standard Compliance
- XP counter uses Geist Mono
- Level badge uses Emerald-500 text on glass background
- Streak flame icon is Emerald-500 (1.5px stroke)
- Milestone progress bar uses Emerald gradient
- Badge icons are Lucide (1.5px stroke), colored per category

---

## 6. Activity Types Design

### Problem It Solves
Current lesson blocks are all the same (image + markdown). Learners need variety and hands-on practice to develop mastery.

### 10+ Distinct Activity Types

#### 1. **Scenario Drill**
- **Format:** Situation description → Ask "What do you do?"
- **Example:** "SPX rallies 3%. Your short strangle is threatened. Do you: A) Roll up, B) Close, C) Hold, D) Add more?"
- **Interaction:** Click A/B/C/D, get immediate feedback + explanation
- **XP:** 15 per correct answer, 5 per explanation viewed (no penalty for wrong)
- **Mobile:** Large buttons, high contrast

#### 2. **Greeks Calculator Challenge**
- **Format:** "Given [params], calculate Delta" with calculator widget
- **Interaction:** Input strike, underlying, DTE, IV → system calculates Greek, compares to answer
- **Tolerance:** ±0.05 for delta, ±0.01 for theta, etc.
- **Feedback:** "Your answer: 0.65, Correct: 0.62 ✓ (within tolerance)"
- **XP:** 20 for correct, 10 for close (within tolerance)

#### 3. **Options Chain Reader**
- **Format:** Real options chain table → Fill in blanks
- **Interaction:** "The Call with highest Gamma is the ____ Call" → Click answer in chain
- **Variants:** "Rank these options by Vega," "Identify the strangle (sell 5370 Call + ___ Put)"
- **Feedback:** Visual highlight of correct answer + explanation
- **XP:** 10 per question, bonus for zero errors

#### 4. **Payoff Diagram Builder**
- **Format:** "Construct a bull call spread: Buy 5370 Call, Sell 5390 Call"
- **Interaction:** Drag calls from chain to "legs" section, diagram updates live
- **Visual:** Payoff diagram shows P&L range, max gain/loss, breakeven
- **Validation:** System checks if correct strategy constructed
- **XP:** 30 for correct structure + explanation

#### 5. **Position P&L Calculator**
- **Format:** "You're long 10 calls, underlying moves -2%, IV up 5%. What's your P&L?"
- **Interaction:** Slider adjust underlying, IV; display updates P&L in real-time
- **Math:** Greeks used to calculate (Delta * move) + (Vega * IV change) + (Theta * time decay)
- **Answer:** "Your P&L: -$450 (due to negative Delta + Vega exposure)"
- **XP:** 25 for correct calculation + reasoning

#### 6. **Fill-in-the-Blank Sentence**
- **Format:** "As time passes, a long call's Theta becomes more _______ (positive/negative)"
- **Interaction:** Multiple choice or type answer
- **Variants:** "The Greek that measures _____ sensitivity is _____"
- **Feedback:** "Correct! Theta is negative for long options—time decay hurts you."
- **XP:** 10 per blank filled correctly

#### 7. **Flashcard Spaced Repetition**
- **Format:** Front: "Define Gamma" → Back: "Rate of change of Delta, accelerates near ATM"
- **Interaction:** Card flip animation, type answer option, rate confidence
- **Algorithm:** Reschedule based on confidence (1d / 3d / 7d)
- **Batch Mode:** Review 10–20 cards in session (quiz-show format)
- **XP:** 15 per card mastered, 5 per card reviewed

#### 8. **Video Walkthrough with Checkpoints**
- **Format:** Embedded video (3–8 min) with pause points
- **Interaction:** "At 2:30, what happened to Delta?" → Fill in answer, resume video
- **Variants:** Audio-based walkthrough with chart annotations
- **Completion:** Watch full video + answer all checkpoints correctly
- **XP:** 40 for full video + all checkpoints correct

#### 9. **Drag-and-Drop Label Game**
- **Format:** Chart with unlabeled Greeks curves; drag labels to match
- **Interaction:** Drag "Delta" to the curve showing 0.5 → 0.8 as price rises
- **Variants:** "Drag Greeks to the Greeks (match symbol to definition)"
- **Feedback:** Visual snap-to-correct positions, green checkmarks
- **XP:** 20 for all labels correct, 10 for partial

#### 10. **Timed Strategy Quiz**
- **Format:** 10 rapid-fire questions, 60 seconds total (6 sec per question)
- **Questions:** "Delta of ATM call is ~?" "Theta works for shorts or longs?" "Vega + IV = ___?"
- **Interaction:** Click answer ASAP, advance to next
- **Feedback:** Score displayed: "9/10 Correct (High Confidence!)" or "6/10 (Review material)"
- **XP:** 50 base + 5 per second remaining (time bonus)

#### 11. **Trade Replay & Decision Points**
- **Format:** Historical SPX trade replay (5-min bars) with pause points
- **Interaction:** "Entry: 5370 Call @ $2.00. Stop? Take Profit? Trail?" → Make decision, see outcome
- **Variants:** "The trade gave up $500 here. Should you have exited?"
- **Feedback:** Compare your decision to optimal exit (based on Greeks + risk management)
- **XP:** 30 for good decision, 15 for reasonable decision

#### 12. **Spot the Mistake**
- **Format:** Trade analysis with error: "This call has Gamma 0.05. As price moves, Delta ____ slowly."
- **Interaction:** Find and highlight the mistake, type correction
- **Variants:** "This payoff diagram is wrong. What strategy does it show?" (options chain with error)
- **Feedback:** "Gamma is 0.08 (not 0.05), so Delta changes faster. Good catch!"
- **XP:** 25 per error found + correction provided

### Activity Scheduling & Sequencing

**Module Block Flow:**
1. `hook` → Scenario Drill (intro, low stakes)
2. `concept_explanation` → Greeks Calculator (active learning)
3. `worked_example` → Trade Replay (contextual)
4. `guided_practice` → Options Chain Reader + Payoff Diagram (multi-step)
5. `independent_practice` → Position P&L Calculator (synthesis)
6. `reflection` → Flashcard batch (retention)

**Weekly Review Queue:**
- Spaced rep. flashcards due 3–7 days after lesson completion
- Timed quizzes every Friday (optional, +100 XP if completed)

### Mobile-Optimized Activity Design

1. **Touch-Friendly Inputs:** Sliders ≥ 44px tall, buttons ≥ 48px
2. **One-Handed Use:** Quiz questions stack vertically, answers on bottom half
3. **Swipe Gestures:** Swipe to advance, pinch-to-zoom charts
4. **Responsive Canvas:** Drag-and-drop activities reflow on mobile (single column)

### Accessibility Notes
- All activities have keyboard alternatives (arrow keys for sliders, Tab for focus)
- Canvas-based activities (like drag-drop) have fallback HTML list interface
- Timed activities have `aria-live` announcement of remaining time
- Flashcard flip respects `prefers-reduced-motion` (instant reveal)

---

## 7. Progress & Reporting Redesign

### Problem It Solves
Current progress view is a list of bar charts. It lacks visual appeal, actionability, and predictive insights (e.g., "You'll finish in X weeks").

### New Progress Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ PROGRESS & MASTERY                                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ HEADLINE STATS (3-column) ────────────────────────────┐ │
│  │                                                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│ │
│  │  │ 45/156       │  │ 6.5/week     │  │ ~4 weeks     ││ │
│  │  │ LESSONS      │  │ VELOCITY     │  │ TO FINISH    ││ │
│  │  │ COMPLETED    │  │              │  │              ││ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘│ │
│  │  (29% of program)  (lessons/week)   (at current pace) │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ COMPETENCY RADAR CHART ───────────────────────────────┐ │
│  │                                                         │ │
│  │          ▲ Options Fundamentals (82%)                  │ │
│  │         /╲                                             │ │
│  │        /  ╲ Risk Management (68%) 🔴 WEAK             │ │
│  │       /    ╲                                           │ │
│  │  Greeks───  Analysis (75%)                            │ │
│  │  Mastery   \                                           │ │
│  │   (88%)     ╲ Volatility (55%) 🔴 CRITICAL            │ │
│  │             /╲                                         │ │
│  │            /  Entry Strategies (71%)                   │ │
│  │           /                                            │ │
│  │  (Interactive: hover shows %, click for remediation) │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ WEEKLY HEATMAP ───────────────────────────────────────┐  │
│  │ Your weekly activity (past 12 weeks)                   │  │
│  │                                                         │  │
│  │  M T W T F S S (row per week)                          │  │
│  │  ░░░░░░░ (week 12, light = < 1 hour)                  │  │
│  │  ███████░ (week 11, dark = 3+ hours)                  │  │
│  │  ██░░████ (week 10)                                   │  │
│  │  (hover: "Tuesday: 2.5 hours, 5 blocks")              │  │
│  │                                                         │  │
│  │  Avg/week: 12.3 hours, trending ↑ +20%               │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ TRACK PROGRESS ──────────────────────────────────────┐  │
│  │                                                        │  │
│  │  Track 1: Options Fundamentals                        │  │
│  │  ████████████░░░░░░░░░░░░░░░ 12/24 modules (50%)    │  │
│  │  Estimated completion: 2 weeks (at 6 modules/week)   │  │
│  │                                                        │  │
│  │  Track 2: Advanced Strategies                         │  │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░ 0/18 modules (locked)  │  │
│  │  Unlocks when: Track 1 → 75% completion              │  │
│  │  Current progress: 50% (14% more needed)             │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ REMEDIATION ROADMAP ─────────────────────────────────┐  │
│  │                                                        │  │
│  │  🔴 CRITICAL: Volatility & IV (Current: 55%)         │  │
│  │  → Recommended: "Volatility Surface" module           │  │
│  │  → Estimated time: 2 hours                            │  │
│  │  → Will boost competency to ~75%                      │  │
│  │  [START NOW →]                                        │  │
│  │                                                        │  │
│  │  🟡 WEAK: Risk Management (Current: 68%)              │  │
│  │  → Recommended: "Hedge & Exit Strategies" module      │  │
│  │  → Estimated time: 90 minutes                         │  │
│  │  → Will boost competency to ~80%                      │  │
│  │  [VIEW DETAILS →]                                     │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. **Headline Stats**
- **Component:** `AcademyProgressHeadline`
- **Metrics:**
  - Lessons Completed / Total (with percentage)
  - Weekly Velocity (avg. lessons completed per week)
  - Estimated Time to Program Completion (based on velocity + remaining modules)
- **Visual:** Large fonts (Playfair for numbers, Inter for labels), glass cards
- **Update Frequency:** Real-time (recalculate on page load)

#### 2. **Competency Radar Chart**
- **Component:** `AcademyCompetencyRadar`
- **Data:** 5–8 competency dimensions (Greeks, Risk Management, Entry Strategy, Volatility, Trade Management, Psychology, Exit Discipline, Analysis)
- **Visualization:** Polar chart (using Recharts or D3.js)
  - Inner ring: 0% (center)
  - Outer ring: 100% (boundary)
  - Emerald fill for completed areas, lighter Emerald outline
  - Red zone (< 60%) for weak competencies
  - Hover: Show exact percentage + mastery level (Familiar / Proficient / Mastered)
  - Click: Navigate to remediation module
- **Mobile:** Collapse to list view of competencies with progress bars

#### 3. **Weekly Activity Heatmap**
- **Component:** `AcademyActivityHeatmap`
- **Data:** Lessons completed per day, past 12 weeks (84 days)
- **Grid:** 7 columns (Mon–Sun), 12 rows (weeks)
- **Color Intensity:**
  - White: 0 hours
  - Light Emerald: 0.5–1 hour
  - Mid Emerald: 1–3 hours
  - Dark Emerald: 3+ hours
- **Hover:** Tooltip "Tuesday, Feb 18: 2.5 hours, 5 blocks completed, +112 XP"
- **Trend:** Arrow + percentage (e.g., "Trending ↑ +20% this week") based on 4-week rolling comparison
- **Mobile:** Horizontal scroll 12 weeks at a time

#### 4. **Track Progress Bars**
- **Component:** `AcademyTrackProgress`
- **Per Track:**
  - Module count + completion percentage
  - Linear progress bar (Emerald fill)
  - Estimated weeks to completion (based on velocity)
  - Lock status + unlock criteria (e.g., "Unlock at 75% of Track 1")
  - Expandable: Show all modules in track with individual progress

#### 5. **Competency Breakdown List**
- **Component:** `AcademyCompetencyList`
- **Per Competency:**
  - Title (e.g., "Delta & Gamma Mastery")
  - Current score (0–100%) with level badge (Unfamiliar / Familiar / Proficient / Mastered)
  - Color-coded: Amber (< 60%), Yellow (60–75%), Green (75–90%), Emerald (90–100%)
  - Trend: Arrow ↑ ↓ → (improving / declining / flat)
  - Last assessed: "3 days ago"
  - Action: "Remediate" button if < 75%

#### 6. **Remediation Roadmap**
- **Component:** `AcademyRemediationRoadmap`
- **Logic:**
  - Identify competencies < 75% (CRITICAL if < 60%, WEAK if 60–75%)
  - Recommend most relevant module to strengthen that competency
  - Calculate impact: "This module will boost your score from 55% → 73%"
  - Estimate time required
  - Order by impact (biggest improvement first)
- **CTA:** "Start [Module Name]" or "View Details"

#### 7. **Learning Velocity Trend**
- **Component:** `AcademyVelocityTrend`
- **Metrics:**
  - Lessons per week (line chart, 12-week view)
  - Hours per week (bar chart, 12-week view)
  - Comparison to program average: "You're 15% faster than typical learner"
- **Prediction:** "At your current pace, you'll finish in 4 weeks (vs. 6-week average)"

### Emerald Standard Compliance
- Radar chart: Emerald fills, Emerald border
- Progress bars: Emerald gradient (dark → light)
- Heatmap: Emerald intensity scale
- Stats: Playfair Display for numbers, Geist Mono for units
- Cards: Glass-card-heavy with Emerald borders on hover

### Accessibility Notes
- Radar chart has `aria-label="5-point competency radar with Greeks at 88%, Risk Management at 68%..."`
- Heatmap cells have `aria-label="Tuesday, 2.5 hours, 5 blocks"`
- Progress bars use `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Colors alone don't convey status (text labels + icons also used)

---

## 8. Mobile Experience

### Problem It Solves
Current UI is not optimized for touch: small buttons, long scrolls, no swipe gestures.

### Mobile-First Principles

1. **Single-Column Layout**
   - Stacked cards, no multi-column grids on < 768px
   - Hero section, then consecutive cards below

2. **Touch-Friendly Controls**
   - Buttons: 48px min height, 16px padding
   - Sliders: 44px tall touch target
   - Tap zones don't overlap

3. **Gesture Support**
   - Swipe left/right: Navigate between blocks
   - Swipe down: Refresh (reload progress data)
   - Pinch: Zoom on charts/diagrams
   - Long-press: Option menu (copy, share, report)

4. **Responsive Typography**
   - Base: 16px (mobile) → 18px (tablet) → 20px (desktop)
   - Headings scale: 18px → 24px → 32px
   - Code/numbers: 14px (always monospace)

5. **Input Optimization**
   - Text inputs: Large font (16px+), auto-capitalization off for codes
   - Numeric inputs: Custom keyboard (numbers + decimal)
   - Dropdowns: Native select on mobile, custom on desktop
   - Sliders: Use `<input type="range">` for native handling

### Mobile-Specific Components

#### 1. **Mobile Bottom Sheet Activity**
- **Component:** `AcademyMobileActivitySheet`
- **Behavior:** Activities slide up from bottom on mobile, takes 60% of screen
- **Header:** Swipe-down handle, close button (X)
- **Content:** Activity widget scrollable within sheet
- **Control Buttons:** Sticky at bottom of sheet (Previous / Complete / Next)

#### 2. **Swipe Navigation**
- **Component:** `AcademySwipeController`
- **Left Swipe:** Jump to next block (with loading state)
- **Right Swipe:** Jump to previous block
- **Visual Feedback:** Subtle gray overlay during swipe, snap-back if <30% threshold

#### 3. **Mobile Progress Indicator**
- **Component:** `AcademyMobileProgressBar`
- **Location:** Sticky at top (below status bar)
- **Style:** Thin bar (2px), Emerald fill, no labels (save space)
- **Behavior:** Animate fill when advancing blocks

#### 4. **Touch-Optimized Charts**
- **Component:** `AcademyResponsiveChart`
- **Behavior:**
  - Charts scale to 100% of viewport width on mobile
  - Pinch-to-zoom enabled by default
  - Tap to focus data point (shows tooltip, no hover needed)
  - Double-tap to reset zoom

#### 5. **Bottom Navigation for Academy**
- **Component:** Uses existing `FeatureSubNav` (bottom bar on mobile)
- **Items:** Dashboard, Modules, Review, Progress (same as desktop)
- **Layout:** Horizontal scroll on ultra-mobile (< 320px)

### Mobile Dashboard Layout

```
┌─────────────────────────────────┐
│ Status Bar (System)             │
├─────────────────────────────────┤
│ ★★★★★★★★★★ (Streak: 12 days)  │
│ Level 8 · 545 XP                │
├─────────────────────────────────┤
│ MILESTONE PROGRESS              │
│ ████████░░ 8/10 lessons        │
│ +2 XP when done                 │
├─────────────────────────────────┤
│ [CONTINUE LEARNING HERO CARD]   │
│ with small hero image           │
│ [Resume] [Browse] [Stats]       │
├─────────────────────────────────┤
│ THIS WEEK        · NEXT         │
│ 3 lessons        · Volatility   │
│ +15 XP           · Strategies   │
├─────────────────────────────────┤
│ [Academy Sub Nav - Sticky]      │
│ Dashboard Modules Review Prog... │
├─────────────────────────────────┤
```

### Mobile Lesson Viewer

```
┌─────────────────────────────────┐
│ Options Fund. → Lesson 6/12      │
├─────────────────────────────────┤
│ [Hero Image]                    │
│ Greeks Explained: Delta & Gamma │
│ ~20 min · +75 XP                │
├─────────────────────────────────┤
│ BLOCK 4 OF 12                   │
│ [Concept Explanation]           │
│                                 │
│ Understanding Delta             │
│ (Short description)             │
│                                 │
│ [Interactive Widget Expanded]   │
│ (full-width slider, etc.)       │
│                                 │
│ [Check Your Understanding →]    │
├─────────────────────────────────┤
│ ●●●●○○○○○○○○ Progress           │
│                                 │
│ [⬅ Previous] [Complete ✓] [⏩ Skip]│
├─────────────────────────────────┤
│ Bottom Sheet (if activity open) │
│                                 │
│ [Activity Sheet Slides Up]       │
│ [Swipe Handle]                  │
│ [Activity Content]              │
│ [Submit Button - Sticky]        │
└─────────────────────────────────┘
```

### Mobile Activity Optimization

**Example: Options Chain Reader**
- On desktop: Full chain table, inline fill-in-the-blank cells
- On mobile:
  - Scrollable chain (horizontal scroll enabled)
  - Bottom sheet with question: "What is the Delta of the 5370 Call?"
  - Numeric input field (large, centered)
  - Submit button below
  - Swipe down to close, tap check mark to confirm

**Example: Payoff Diagram Builder**
- On desktop: Side-by-side (chain | diagram)
- On mobile:
  - Full-width chain at top (scrollable)
  - "Add Leg" button (expands sheet)
  - Payoff diagram below (scrollable)
  - Vertical stacking of legs instead of grid

---

## 9. AI Integration Points

### Where AI Coach Connects

1. **Dashboard Personalization**
   - AI Coach analyzes learner's profile → suggests "Start with this module" based on trading style
   - Recommendation reason: "You've been trading spreads; Greeks mastery is critical"

2. **Activity Feedback**
   - Scenario drill wrong answer → AI Coach explains: "You chose A) Hold, but that increases Gamma risk. Here's why B) Roll up is better given your position size."
   - Flashcard answer → AI Coach provides personalized hint: "Think about how Theta decays faster as DTE approaches zero"

3. **Progress Insights**
   - Weekly digest: "You've completed 3 lessons this week (below your average of 5). AI Coach noticed: Risk Management competency is weak (55%). I recommend 2 hours on the 'Hedge Strategies' module this week."

4. **Remediation Path**
   - Learner scores < 60% on Volatility competency → AI Coach suggests custom learning path:
     - "Watch: IV Rank Explained (8 min)"
     - "Practice: IV Percentile Quiz (10 min)"
     - "Trade: SPX Volatility Strategy Simulator (20 min)"

5. **Trade Scenario Analysis**
   - "You're considering a call spread. AI Coach analyzed your learning: You've completed Greeks & Strategy modules. AI Coach confidence: 85% you'll execute this trade successfully. Key risks to watch: Gamma acceleration near ATM."

### Component Integration

- **Component:** `AcademyAICoachWidget`
- **Location:** Right sidebar on desktop (sticky), below content on mobile
- **Features:**
  - Small circular avatar (chat icon)
  - "AI Coach has a suggestion for you" banner
  - Quick tip or full message (expandable)
  - Link to AI Coach chat if more detail needed
  - Dismiss option (respects preference)

---

## 10. Image & Media Strategy

### Problem It Solves
Current academy has placeholder images. Hero images should set context, inline diagrams should illustrate concepts.

### Image Asset Organization

```
/public/academy/
  /heroes/           # Lesson-level hero images (1200x600px)
    options-101.png
    greeks-delta.png
    ...
  /blocks/           # Block-level inline diagrams (800x400px)
    delta-curve.svg
    payoff-diagram.png
    ...
  /illustrations/    # Generic SVGs for fallback/themes
    training-default.svg
    options-basics.svg
    risk-sizing.svg
    ...
  /charts/          # Template charts for options Greeks
    delta-surface.png
    gamma-curve.png
    theta-decay.png
    vega-smile.png
```

### Hero Image Strategy

**Per Lesson:**
- 1200x600px, optimized PNG or WebP
- Gradient overlay (rgba(10,10,11,0.4)) for text readability
- Thematic: Options concepts → green gradient, Risk management → amber gradient
- Alt text: "Greeks concept illustration with Delta curve visualization"
- Fallback: `ACADEMY_DEFAULT_MEDIA_IMAGE` SVG

**Per Module:**
- 600x400px cover image
- Used in module card catalog
- Themed per track

### Inline Diagram Strategy

**Options Greeks:**
- Delta curve (strike vs. delta, color-coded by moneyness)
- Gamma curve (shows ATM peak)
- Theta decay (time vs. option value)
- Vega curve (volatility sensitivity)
- Use emerald for ITM, white for ATM, amber for OTM

**Payoff Diagrams:**
- Long Call: angle up-right
- Short Call: angle down-left
- Spreads: multi-segment linear
- Strangles: inverted V shape
- Interactive: Drag legs to see payoff update live

**Options Chain:**
- Table view with Greeks columns
- Color-code rows: Green (ITM), White (ATM ±1 strike), Gray (OTM)
- Animate bid-ask spread in real-time

### Chart Annotation Strategy

**Worked Example Charts:**
- Overlay arrows and annotations on price charts
- "Entry: 5370 Call, $2.00" at entry bar
- "Theta at work: -$0.20" at each timestamp
- "Exit: $1.50" at exit bar
- Use Emerald for gains, Amber for losses

---

## 11. Acceptance Criteria & Rollout Plan

### Phase 1: MVP (Weeks 1–4)
**Scope:** Dashboard redesign + Streak/XP system + Basic gamification

- [ ] Streak banner displays on dashboard (with flame icon)
- [ ] XP counter visible, updates on block completion
- [ ] Milestone progress card shows next 3 milestones
- [ ] Achievement badges system functional (10 badges)
- [ ] Dashboard redesigned per spec (3-column grid, hero card)
- [ ] Mobile responsive for all dashboard elements
- [ ] Unit tests for XP calculation (base, difficulty, streak, speed)
- [ ] E2E tests: Complete block → XP earned → Leaderboard updates
- [ ] Accessibility audit: Lighthouse 90+, axe-core 0 critical violations

### Phase 2: Interactive Lesson Viewer (Weeks 5–8)
**Scope:** Block interactivity + Greeks visualizer + Practice activities

- [ ] Block type → activity type mapping implemented (concept_explanation → Greeks Slider, etc.)
- [ ] Greeks Visualizer component (Massive.com backend integration)
- [ ] Scenario Drill activity type (with 50+ scenarios)
- [ ] Options Chain Reader activity type
- [ ] Payoff Diagram Builder activity type (drag-and-drop)
- [ ] Confetti celebration on block completion (animations respect prefers-reduced-motion)
- [ ] Mobile swipe navigation (left/right to advance blocks)
- [ ] E2E tests for each activity type (fill in blank, validate answer, show feedback)
- [ ] Performance audit: Block load time < 1.5s, activity widget render < 300ms

### Phase 3: Progress & Leaderboard (Weeks 9–12)
**Scope:** Progress dashboard redesign + Leaderboard integration + AI Coach wiring

- [ ] Competency Radar chart implemented (5–8 dimensions)
- [ ] Weekly activity heatmap (12-week view, color intensity)
- [ ] Learning velocity metric (lessons/week, trending arrow)
- [ ] Predicted completion date calculation + display
- [ ] Remediation Roadmap component (recommends modules)
- [ ] Leaderboard widget on dashboard (top 3 users by XP)
- [ ] Leaderboard privacy settings (opt-out option)
- [ ] AI Coach integration points wired (suggestions on dashboard)
- [ ] Unit tests for velocity calculation + prediction logic
- [ ] E2E tests: User completes module → competency updates → radar refreshes

### Phase 4: Polish & Mobile Optimization (Weeks 13–16)
**Scope:** Mobile UX refinement, image/media rollout, performance optimization

- [ ] Mobile bottom sheet activities tested on iOS/Android
- [ ] Hero images deployed for all 30+ lessons
- [ ] Inline diagrams for options concepts (delta, gamma, theta, vega curves)
- [ ] Real-time SPX mini-chart embedded in options lessons (Supabase realtime)
- [ ] Bundle size analysis: +< 50KB for new interactive components
- [ ] Lighthouse mobile score 85+
- [ ] Touch performance (activities smooth at 60fps on mid-range phones)
- [ ] Accessibility mobile: Screen reader announces activity type, buttons labeled
- [ ] Final user testing with 10 learners: System Usability Scale > 80

### Rollout Strategy

**Week 1 Deploy:** Phase 1 MVP to 10% beta users → collect feedback
**Week 5 Deploy:** Phase 2 interactive viewer to 50% users → monitor performance
**Week 9 Deploy:** Phase 3 progress dashboard to 100% users → leaderboard live
**Week 13 Deploy:** Phase 4 polish to 100% users → hero images, mobile, final tuning

### Success Metrics

- **Engagement:** Weekly active users ↑ 40%, avg. session time ↑ 50%
- **Retention:** 7-day retention rate ↑ 25%, 30-day retention ↑ 20%
- **Learning:** Module completion rate ↑ 35%, avg. mastery score ↑ 15%
- **Streak Adoption:** 60% of active users maintain 7+ day streak
- **Leaderboard:** 40% participation in weekly XP leaderboard
- **Performance:** 99.5% uptime, P95 load time < 2s
- **Accessibility:** Zero WCAG 2.1 AA violations, Lighthouse a11y 95+

---

## 12. Design System Alignment (Emerald Standard)

### Color Usage

| Element | Color | CSS Variable | Hex |
|---|---|---|---|
| Primary CTA | Emerald Elite | `var(--emerald-elite)` | #10B981 |
| Secondary CTA | Champagne | `var(--champagne)` | #F5EDCC |
| Accent/Hover | Emerald-500 | (Tailwind) | #10B981 |
| Background | Onyx | `#0A0A0B` | #0A0A0B |
| Card Surface | Glass | `glass-card-heavy` | rgba(255,255,255,0.03) |
| Border | White/10 | `border-white/10` | rgba(255,255,255,0.1) |
| Text Primary | Ivory | `#F5F5F0` | #F5F5F0 |
| Text Muted | Zinc-400 | (Tailwind) | #A1A1AA |
| Success (Streak) | Emerald-400 | (Tailwind) | #4ADE80 |
| Warning (Weak) | Amber-300 | (Tailwind) | #FCD34D |
| Danger | Rose-500 | (Tailwind) | #F43F5E |

### Typography

| Use | Font | Weight | Size |
|---|---|---|---|
| Headings (h1, h2, h3) | Playfair Display (serif) | 600–700 | 24–48px |
| Body Copy | Inter (sans) | 400–600 | 14–18px |
| Data/Numbers | Geist Mono (mono) | 500–700 | 12–20px |
| Labels/Small Text | Inter | 500 | 10–12px |
| Button Text | Inter | 600 | 12–16px |

### Component Patterns

1. **Cards:** All cards use `glass-card-heavy` + `border-white/10` + `rounded-xl`
2. **Buttons:**
   - Primary: `bg-emerald-500/15 border-emerald-500/35 text-emerald-100 hover:bg-emerald-500/20`
   - Secondary: `border-white/10 text-zinc-200 hover:border-white/20`
3. **Inputs:** `bg-[#0b0d12] border-white/10 text-zinc-200 focus:border-emerald-500/40`
4. **Icons:** Lucide React, 1.5px stroke weight, size 16–24px
5. **Loading States:** Pulsing Logo skeleton (`components/ui/skeleton-loader.tsx`), never spinner

### Animation & Motion

- **Entrance:** Fade-in + subtle scale (100ms)
- **Hover:** Border/background color shift, slight lift (2–4px)
- **Click:** Pressed state (opacity 0.8) for 100ms
- **Confetti:** 50 particles, 1-second duration, Emerald + Champagne colors
- **Streak Flame:** Scale 1.1x on hover, rotate gently on celebration
- **Chart Animation:** Gradient fill from left-to-right (500ms easing)
- **Respect:** All animations must respect `prefers-reduced-motion` media query

### Spacing & Grid

- **Padding:** 4px, 8px, 12px, 16px, 24px, 32px (4px increments)
- **Gap:** 8px (tight), 16px (standard), 24px (loose)
- **Margin:** Same as padding, top-heavy (margin-top > margin-bottom)
- **Mobile:** Single column, 16px edges, 8px gaps (tighter)

---

## 13. Conclusion

This UX overhaul transforms TradeITM's Academy from a static learning platform into an engaging, interactive, and gamified educational experience. By combining proven engagement mechanics (Duolingo streaks, Brilliant.org interactivity, Khan Academy mastery) with domain-specific options trading education, the academy will drive:

1. **Higher Engagement:** Daily streaks and XP system create habit loops
2. **Deeper Learning:** Interactive widgets (Greeks visualizers, payoff builders, scenario simulators) enable hands-on exploration
3. **Measurable Progress:** Competency radar, learning velocity, and predicted completion dates provide clarity
4. **Mastery-Based Growth:** Spaced repetition review queue and adaptive remediation recommendations ensure retention
5. **Community Integration:** Leaderboard connection with Trade Social gamifies peer learning

The redesign maintains strict adherence to the Emerald Standard aesthetic while introducing modern web UX patterns that respect accessibility, performance, and mobile-first design principles.

**Next Steps:**
1. Review spec with product & design team
2. Prototype Phase 1 dashboard and streak system
3. Conduct user testing (5–10 learners) on interactive prototype
4. Refine based on feedback
5. Begin Phase 1 development (4 weeks)

---

**Document Generated:** February 24, 2026
**Spec Version:** 1.0 (Initial Research & Design)
**For Questions:** Contact Product Design Lead
