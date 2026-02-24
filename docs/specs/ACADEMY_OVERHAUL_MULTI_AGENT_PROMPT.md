# Academy Overhaul: Multi-Agent Orchestration Prompt

> **Purpose:** Paste this prompt into a fresh Claude Code session (Opus) to spin up a full academy overhaul across code, UX, curriculum, content, activities, imagery, and reporting.
> **Created:** 2026-02-24
> **Estimated Scope:** 8–12 agent sessions across 5 workstreams

---

## Master Orchestrator Prompt

```
You are the Orchestrator for a full overhaul of the TradeITM Trading Academy — code, UX, curriculum, content, activities, AI-generated imagery, and reporting. Read CLAUDE.md first, then follow this plan exactly.

## CONTEXT: CURRENT STATE

The academy lives at /members/academy and uses a v3 architecture:
- Schema: academy_programs → academy_tracks → academy_modules → academy_lessons → academy_lesson_blocks
- Block types: hook, concept_explanation, worked_example, guided_practice, independent_practice, reflection
- Assessment types: diagnostic, formative, performance, summative
- Item types: single_select, multi_select, ordered_steps, short_answer_rubric, scenario_branch
- Competencies: market_context, entry_validation, position_sizing, trade_management, exit_discipline, review_reflection
- Spaced repetition review queue with interval scheduling
- Progress tracking: lesson attempts, block completion, competency mastery scores, remediation flags
- Services in lib/academy-v3/services/, repos in lib/academy-v3/repositories/, contracts in lib/academy-v3/contracts/
- Components in components/academy/
- API routes at /api/academy-v3/*
- Current seed data: 1 program → 1 track ("Foundations") → 1 module ("Market Context Fundamentals") → 1 lesson ("Session Framing for Options") with 5 blocks

The system is structurally sound but has almost no content. The overhaul needs to fill it with a world-class SPX options trading curriculum AND upgrade the UX to be engaging and modern.

---

## PHASE 0: PARALLEL RESEARCH (All agents run simultaneously)

Spawn these 5 agents in parallel. Each agent researches and produces a deliverable doc. No code changes yet.

### Agent 1: Curriculum Architect (opus)
```
You are the Curriculum Architect for TradeITM's trading academy overhaul. Your job is to design a complete, world-class SPX options trading curriculum.

Read these files first:
- CLAUDE.md (root)
- supabase/migrations/20260319010000_academy_v3_foundations_seed.sql (existing seed)
- lib/academy-v3/contracts/ (all type definitions)
- docs/specs/ (any academy-related specs)

Then research and produce a COMPLETE curriculum plan document at:
docs/specs/ACADEMY_CURRICULUM_PLAN_2026-02-24.md

The curriculum must follow the existing schema hierarchy:
Program → Tracks → Modules → Lessons → Blocks (hook, concept, worked_example, guided_practice, independent_practice, reflection)

### Required Tracks (in learning order):

**Track 1: Trading Foundations (Beginner)**
Target: Complete beginner who has never traded
Modules should cover:
- What are financial markets (stocks, bonds, commodities, indices)
- How the stock market works (exchanges, market makers, order flow)
- Reading stock charts (candlesticks, timeframes, volume)
- Key terminology (bid/ask, spread, liquidity, volatility, open interest)
- Introduction to technical analysis (support/resistance, trends, moving averages)
- Introduction to fundamental analysis (earnings, economic data, Fed decisions)
- Risk management foundations (position sizing, risk/reward, drawdown)
- Trading psychology basics (discipline, FOMO, revenge trading, journaling)

**Track 2: Brokerage & Platform Setup (Beginner)**
Target: Getting the student trading-ready
Modules should cover:
- Choosing a brokerage for options (comparison: TastyTrade, Schwab/TOS, IBKR, Webull)
- Account types (margin vs cash, IRA options, PDT rule explained)
- Platform setup and configuration (chart layout, option chains, order entry)
- Paper trading setup and practice protocols
- Order types deep dive (market, limit, stop, stop-limit, trailing, OCO, bracket)
- Understanding commissions, fees, and tax implications (Section 1256 contracts for SPX)
- Setting up alerts and watchlists

**Track 3: Options Trading Fundamentals (Beginner → Intermediate)**
Target: Understanding how options work mechanically
Modules should cover:
- What are options (calls, puts, rights vs obligations, contracts, expiration)
- Options pricing (intrinsic value, extrinsic value, moneyness: ITM/ATM/OTM)
- The Greeks explained (Delta, Gamma, Theta, Vega, Rho — with visual intuition)
- Options chain reading and interpretation
- Single-leg strategies (long call, long put, covered call, cash-secured put)
- Multi-leg strategies intro (vertical spreads: bull call, bear put, credit spreads)
- Options lifecycle (opening, managing, rolling, closing, assignment/exercise)
- Implied volatility and the VIX (what it means, IV rank, IV percentile)

**Track 4: SPX Options Mastery (Intermediate)**
Target: Specifically trading SPX and understanding its unique characteristics
Modules should cover:
- Why SPX (cash-settled, European exercise, Section 1256 tax, liquidity, no early assignment)
- SPX vs SPY vs ES futures comparison
- 0DTE (zero days to expiration) trading concepts and risks
- SPX session structure (pre-market, open, morning chop, lunch, power hour, close)
- Reading SPX market context (session modes: trend, range, reversal)
- SPX entry validation (confirming setups, avoiding false signals)
- Credit spreads on SPX (iron condors, put credit spreads, call credit spreads)
- Debit spreads on SPX (directional plays, risk-defined entries)
- SPX position sizing and capital allocation
- Managing SPX trades (adjustments, rolling, stop-loss strategies, profit targets)
- SPX exit discipline (when to hold, when to cut, mechanical vs discretionary)

**Track 5: Advanced SPX Strategies (Advanced)**
Target: Sophisticated multi-leg and volatility strategies
Modules should cover:
- Iron butterflies and broken-wing butterflies on SPX
- Calendar spreads and diagonal spreads (exploiting term structure)
- Ratio spreads (1x2, 1x3 for aggressive directional plays)
- Straddles and strangles (volatility plays around events)
- Advanced Greeks management (gamma risk, vega exposure, theta decay curves)
- Volatility skew trading (put skew, call skew, smile dynamics)
- Event trading (FOMC, CPI, NFP, earnings-adjacent SPX moves)
- Portfolio-level hedging with SPX options
- Combining SPX with VIX options for tail risk

**Track 6: Trading as a Business (Advanced)**
Target: Treating trading professionally
Modules should cover:
- Building a trading plan (rules-based system design)
- Trade journal mastery (linking to TradeITM journal feature)
- Performance analytics (win rate, R-multiple, expectancy, Sharpe)
- Psychological frameworks (process over outcome, dealing with losses)
- Scaling a trading account (compounding, risk-adjusted growth)
- Tax optimization for options traders (Section 1256, mark-to-market)
- Creating routines (pre-market, intraday, post-market review)

### For EVERY lesson, specify:
1. Title, slug, difficulty, estimated duration (minutes)
2. Learning objectives (2-3 per lesson)
3. Competencies mapped (from the 6 existing + propose new ones if needed)
4. All 6 block types with content summaries:
   - Hook: engaging scenario, question, or real-trade story
   - Concept: clear explanation with analogies
   - Worked Example: step-by-step walkthrough of a real SPX trade or analysis
   - Guided Practice: interactive exercise with scaffolding
   - Independent Practice: student does it alone
   - Reflection: journal prompt or self-assessment
5. Assessment items (2-3 per lesson, varied types)
6. AI image prompt suggestion for the lesson hero image
7. Prerequisites (which lessons must be completed first)

### Additional deliverables in the doc:
- Proposed new competencies beyond the existing 6
- Estimated total hours for full program completion
- Suggested pacing guide (8-week, 12-week, 16-week tracks)
- Cross-references to TradeITM features (AI Coach, Trade Journal, SPX Command Center)
```

### Agent 2: UX/Frontend Researcher (sonnet)
```
You are the UX Researcher for TradeITM's trading academy overhaul. Your job is to audit the current academy UX and design a world-class learning experience.

Read these files first:
- CLAUDE.md (root)
- components/academy/ (ALL files)
- app/members/academy/ (ALL page files)
- app/globals.css
- docs/BRAND_GUIDELINES.md (if exists)

Then research modern e-learning platforms for UX inspiration. Look at:
- Brilliant.org (interactive math/science learning)
- Coursera / Udemy (course structure patterns)
- TastyTrade Learn (options-specific education)
- Duolingo (gamification, streaks, engagement)
- Khan Academy (mastery-based progression)

Produce a UX overhaul spec at:
docs/specs/ACADEMY_UX_OVERHAUL_SPEC_2026-02-24.md

Cover:
1. **Current UX Audit**: What works, what doesn't, gaps
2. **Dashboard Redesign**: Learning path visualization (not just a progress ring), daily streak, XP system, achievement badges, "continue learning" prominence
3. **Module Catalog Redesign**: Better visual hierarchy, difficulty indicators, estimated time, prerequisite chains shown visually
4. **Lesson Viewer Overhaul**:
   - Block-by-block progression needs to feel interactive, not like reading a textbook
   - Inline code/chart widgets for options concepts
   - Animated Greeks visualizations
   - Interactive payoff diagrams (draw your own P&L curve)
   - Drag-and-drop exercises for order matching
   - Fill-in-the-blank for options chain reading
   - Real-time SPX mini-chart embedded in lessons
   - Confetti/celebration on block/lesson completion
5. **Gamification System**: XP points, levels, badges, streaks, leaderboard integration with Trade Social
6. **Activity Types**: Design 10+ distinct interactive activity types beyond text:
   - Options chain simulator
   - P&L diagram builder
   - Greeks calculator widget
   - Trade scenario simulator (given this chart, what would you do?)
   - Flashcard decks (for terminology)
   - Matching exercises (strategy ↔ market condition)
   - Timed quizzes
   - Video walkthroughs with pause-and-predict
   - "Spot the mistake" in trade screenshots
   - Position builder (construct a spread from individual legs)
7. **Progress & Reporting Redesign**: Competency radar chart, learning velocity graph, time-spent analytics, predicted completion date
8. **Mobile Experience**: Touch-optimized activities, swipe through blocks, mobile-first layouts
9. **AI Integration Points**: Where AI Coach connects (ask a question about this lesson, get hints on practice, personalized difficulty adjustment)
10. **Image & Media Strategy**: Hero images per lesson, inline diagrams, chart annotations, video embed patterns

For each major UX change, provide:
- Problem it solves
- Wireframe description (ASCII or detailed text)
- Component name and location
- Emerald Standard compliance notes
- Accessibility considerations
```

### Agent 3: Activity & Assessment Designer (opus)
```
You are the Activity & Assessment Designer for TradeITM's trading academy. Your job is to design the specific interactive activities, exercises, and assessments that make learning engaging and effective.

Read these files first:
- CLAUDE.md (root)
- lib/academy-v3/contracts/ (all type definitions, especially assessment types)
- supabase/migrations/20260319000000_academy_v3_schema.sql
- components/academy/academy-lesson-viewer.tsx
- components/academy/academy-review-queue.tsx

Produce an activity design spec at:
docs/specs/ACADEMY_ACTIVITIES_SPEC_2026-02-24.md

### Current assessment item types:
- single_select, multi_select, ordered_steps, short_answer_rubric, scenario_branch

### Design these NEW activity/block types (schema extensions needed):

1. **Options Chain Simulator**
   - Student reads a simulated options chain and answers questions
   - Data: strike prices, bid/ask, volume, OI, Greeks
   - Tasks: "Which strike has the highest open interest?", "What's the bid-ask spread on the 4200 call?"

2. **Payoff Diagram Builder**
   - Interactive canvas where student drags legs to build a position
   - Show real-time P&L curve as legs are added
   - Validate: "Build a bull call spread" → check if student placed correct legs

3. **Greeks Dashboard Simulator**
   - Sliders for underlying price, time to expiration, IV
   - Watch how each Greek changes in real-time
   - Quiz: "What happens to delta as the option moves deeper ITM?"

4. **Trade Scenario Decision Tree**
   - Present a market scenario with chart screenshot
   - Branch: "SPX opens at 4520, drops 15 pts in first 10 minutes. What do you do?"
   - Multiple paths with consequences: "You entered a put spread → SPX reverses → Your P&L is..."
   - Tree visualization of decisions and outcomes

5. **Position Builder Challenge**
   - Given a market thesis, build the optimal position
   - Student selects: direction, strategy type, strikes, expiration, size
   - Score based on risk/reward optimization

6. **Market Context Tagger**
   - Show an SPX chart (AI-generated or real screenshot)
   - Student tags: session mode (trend/range/reversal), key levels, volume signature
   - Compare to "expert" answer

7. **Order Entry Simulator**
   - Simulated order ticket UI
   - Student must correctly enter: symbol, strategy, legs, quantity, price type, limit price
   - Validates all fields and explains errors

8. **Flashcard Decks**
   - Term → Definition cards with spaced repetition
   - Integrates with existing review queue
   - Category-based: Greeks, Strategies, Terminology, Platform Features

9. **Timed Challenge Rounds**
   - Speed quiz format: 10 questions, 60 seconds each
   - XP multiplier for speed + accuracy
   - Leaderboard-eligible

10. **"What Went Wrong" Analysis**
    - Show a losing trade with entry, management, and exit
    - Student identifies 3+ mistakes from a checklist
    - Compare to expert analysis

11. **Strategy Matcher**
    - Left column: market conditions (e.g., "High IV, expecting range-bound")
    - Right column: strategies (e.g., "Iron Condor")
    - Drag to match, with explanation of why each pairing works

12. **Journal Prompt Exercises**
    - Structured reflection tied to lesson content
    - Auto-creates a journal entry in the Trade Journal feature
    - Scoring rubric for self-assessment quality

### For each activity type, specify:
- Schema changes needed (new block_type values, new tables, JSON structure for content)
- React component design (props, state, user interactions)
- Scoring/grading algorithm
- Integration with competency system (which competencies it assesses)
- Mobile compatibility approach
- Accessibility requirements (keyboard navigation, screen reader support)
- AI generation potential (can an LLM create instances of this activity?)
- Example content for an SPX options lesson
```

### Agent 4: Reporting & Analytics Designer (sonnet)
```
You are the Reporting & Analytics Designer for TradeITM's trading academy. Your job is to design comprehensive learning analytics and reporting for both students and admins.

Read these files first:
- CLAUDE.md (root)
- lib/academy-v3/services/ (all service files)
- lib/academy-v3/repositories/ (all repository files)
- supabase/migrations/20260319000000_academy_v3_schema.sql (schema with learning_events)
- app/admin/ (admin dashboard structure)
- app/members/academy/progress/page.tsx
- components/academy/academy-progress-overview.tsx

Produce a reporting spec at:
docs/specs/ACADEMY_REPORTING_SPEC_2026-02-24.md

### Student-Facing Analytics:

1. **Learning Dashboard Widgets**
   - Daily/weekly study time graph
   - Lesson completion velocity (lessons/week trend)
   - Competency radar chart (6+ axes)
   - Streak tracker (current streak, longest streak, streak calendar heatmap)
   - XP progress bar to next level
   - Predicted program completion date

2. **Competency Deep Dive**
   - Per-competency score over time
   - Linked lessons and assessments for each competency
   - Remediation recommendations with priority ranking
   - "Strengths" and "Areas for Growth" narrative summary (AI-generated)

3. **Performance Analytics**
   - Assessment score trends
   - Average time per lesson vs cohort average
   - Review queue accuracy rate
   - Most-missed topics
   - Best-performing topics

4. **Achievements & Milestones**
   - Badge gallery (earned + locked with descriptions)
   - Track completion certificates (downloadable PDF)
   - XP history and level progression

### Admin-Facing Analytics:

1. **Cohort Dashboard**
   - Total active enrollments, completions, churn rate
   - Average progress percentage
   - Engagement metrics (DAU/WAU/MAU for academy)
   - Funnel: Enrolled → Started → 25% → 50% → 75% → Completed

2. **Content Effectiveness**
   - Per-lesson completion rate and average time
   - Per-lesson drop-off rate (which lessons lose students?)
   - Assessment difficulty analysis (average scores, pass rates)
   - Most-skipped activities
   - Content quality signals (time spent, re-attempts, review accuracy)

3. **Competency Heatmap**
   - Cohort-wide competency mastery distribution
   - Identify weak competencies across all students
   - Flag content gaps (competencies with low mastery + high engagement = content problem)

4. **Learning Path Optimization**
   - Suggested curriculum reordering based on completion data
   - Prerequisite effectiveness (do prereqs actually help?)
   - Bottleneck identification (where do students get stuck?)

### Data Model Changes:
- New events to track: page_views, time_on_block, activity_interactions, hint_usage, AI_coach_questions_from_lesson
- Aggregation tables/views for dashboard performance
- Retention cohort tracking

### For each report/widget, specify:
- Data source (existing table/event or new)
- SQL query or aggregation logic
- Visualization type (chart, table, card, graph)
- Update frequency (real-time, hourly, daily)
- Component location and name
- Mobile layout
```

### Agent 5: AI Image & Media Strategist (sonnet)
```
You are the AI Image & Media Strategist for TradeITM's trading academy. Your job is to design the visual identity and media strategy for all academy content.

Read these files first:
- CLAUDE.md (root, especially Section 2: Design System)
- components/academy/academy-media.ts
- docs/BRAND_GUIDELINES.md (if exists)
- app/globals.css (CSS variables and theme)

Produce a media strategy spec at:
docs/specs/ACADEMY_MEDIA_STRATEGY_2026-02-24.md

### Image Categories to Design:

1. **Lesson Hero Images** (one per lesson, ~150+ images)
   - Style: Dark, luxurious, emerald-accented, financial/trading aesthetic
   - Consistent aspect ratio (16:9 for desktop, with crop strategy for mobile)
   - AI generation prompt template that produces consistent style
   - Example prompts for 10 different lesson topics

2. **Module Cover Images** (one per module, ~30+ images)
   - Larger, more dramatic than lesson heroes
   - Visual metaphor for the module topic
   - Consistent frame/border treatment

3. **Track Cover Images** (one per track, 6 images)
   - Most prestigious/dramatic imagery
   - Clear visual progression from beginner → advanced

4. **Activity Illustrations** (inline diagrams, ~200+ images)
   - Options chain screenshots (styled, not raw data)
   - Payoff diagram illustrations
   - Greeks visualization graphics
   - Chart annotation examples
   - Platform setup screenshots (styled mockups)
   - Strategy comparison diagrams

5. **Achievement Badges** (~30+ badges)
   - SVG-based for scalability
   - Emerald + champagne color scheme
   - Categories: completion, streak, mastery, social, special
   - Consistent icon language

6. **Animated Elements**
   - Loading animations (pulsing logo per brand)
   - Block transition animations (slide/fade between blocks)
   - Celebration animations (confetti on completion)
   - Greeks slider visual feedback
   - P&L curve drawing animation

### AI Image Generation Pipeline:
- Tool: DALL-E 3 or Midjourney (via API)
- Batch generation strategy: generate by track for visual consistency
- Prompt template system:
  ```
  Base: "Dark luxury financial trading interface, emerald green (#10B981) accents,
         champagne gold (#F3E5AB) highlights, dark background (#0A0A0A),
         professional private equity aesthetic, {SUBJECT}, {COMPOSITION},
         cinematic lighting, 16:9 aspect ratio"
  ```
- Post-processing: consistent color grading, overlay with brand elements
- Storage: Supabase Storage bucket, CDN-served
- Naming convention: {track-slug}/{module-slug}/{lesson-slug}-hero.webp

### Media Component Architecture:
- Lazy loading with blur placeholder
- WebP format with fallback
- Responsive srcset for different viewport sizes
- Alt text strategy for accessibility
- Preload strategy for "next lesson" images

### For each image category, specify:
- Dimensions and format
- AI prompt template with variables
- Post-processing steps
- Storage location and URL pattern
- Component integration approach
- Fallback/placeholder strategy
- Estimated generation cost
```

---

## PHASE 1: SYNTHESIS & SPEC APPROVAL

After all 5 agents complete, the Orchestrator:

1. Reads all 5 deliverable docs
2. Synthesizes into a unified execution spec:
   `docs/specs/ACADEMY_OVERHAUL_EXECUTION_SPEC_2026-02-24.md`
3. Resolves conflicts between agent recommendations
4. Creates a phased implementation plan:
   - Phase 1: Schema extensions + new activity types (Database Agent + Backend Agent)
   - Phase 2: Curriculum seed data (all tracks, modules, lessons, blocks) (Database Agent)
   - Phase 3: UX overhaul (Frontend Agent, parallel slices)
   - Phase 4: Interactive activities (Frontend Agent + Backend Agent)
   - Phase 5: Reporting & analytics (Backend Agent + Frontend Agent + Database Agent)
   - Phase 6: AI image generation and integration (Media Agent)
   - Phase 7: QA, a11y, performance (QA Agent)
5. Produces the full autonomous documentation packet per Section 6.3 of CLAUDE.md
6. Presents for approval before any implementation begins

---

## PHASE 2+: IMPLEMENTATION (Post-Approval)

Implementation follows the slice-based cadence from CLAUDE.md Section 6.4:
1. Slice spec → implement → validate → document → next slice
2. All agents respect file ownership boundaries from Section 7.2
3. Orchestrator coordinates handoffs between agents
4. QA Agent validates after each phase completion
5. Release gates must be green before advancing phases

### Key Implementation Agents:

**Database Agent** (Phases 1-2):
- Extend schema for new activity types
- Create seed migrations for all curriculum content
- Add reporting aggregation views
- Verify RLS policies on all new tables

**Frontend Agent** (Phases 3-4):
- Dashboard redesign with gamification
- New lesson viewer with interactive blocks
- Activity components (12+ new component types)
- Progress/reporting visualizations
- Mobile-first responsive overhaul

**Backend Agent** (Phases 4-5):
- New API endpoints for interactive activities
- Scoring/grading logic for new activity types
- Analytics aggregation endpoints
- AI image generation pipeline integration

**Media Agent** (Phase 6):
- Generate all hero images via AI
- Generate badges, diagrams, illustrations
- Upload to Supabase Storage
- Update seed data with image URLs

**QA Agent** (Phase 7):
- E2E tests for all new flows
- Accessibility audit (axe-core)
- Performance audit (Lighthouse)
- Mobile testing
- Content accuracy spot-checks
```

---

## HOW TO USE THIS PROMPT

1. **Start a fresh Claude Code session** (Opus model)
2. **Paste everything between the outer triple backticks** as your first message
3. Claude will read CLAUDE.md, understand the codebase, and begin Phase 0 by spawning 5 parallel research agents
4. Each agent produces a spec document in `docs/specs/`
5. Review and provide feedback on each spec
6. Approve the unified execution spec to begin implementation
7. Implementation proceeds phase-by-phase with validation gates

### Tips:
- You can run Phase 0 agents individually if context is limited
- Each agent prompt is self-contained and can be used standalone
- Modify track/module content in Agent 1's prompt to match your curriculum vision
- The curriculum plan is the most critical deliverable — get it right before implementation
- Budget ~2-3 hours for Phase 0 research, ~8-15 hours for full implementation
