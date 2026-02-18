# Curriculum Architecture Reference

## Table of Contents
1. [Target Track Structure](#target-track-structure)
2. [Existing Content Inventory](#existing-content-inventory)
3. [Competency Framework](#competency-framework)
4. [Assessment Strategy](#assessment-strategy)
5. [New Content Needed](#new-content-needed)

---

## Target Track Structure

The curriculum should be reorganized from the current 2-track (Foundations + Legacy dump) into 4 progressive tracks. Each track represents a phase of the trader's development.

### Track 1: Foundations (Position 1)
**Code:** `foundations`
**Description:** Core concepts every trader needs before placing a single trade. Covers platform orientation, options mechanics, and market context reading.

**Modules (3):**
1. Welcome to TradeITM (existing — 5 lessons, 90 min)
2. Options 101: Understanding the Basics (existing — 6 lessons, 180 min)
3. Market Context Fundamentals (existing — 2 lessons, 70 min — NEEDS 2 empty lessons filled)

**Exit Gate:** Diagnostic assessment covering all 6 competencies at beginner level

### Track 2: Strategy & Execution (Position 2)
**Code:** `strategy-execution`
**Description:** The TITM day trading methodology — from reading alerts to executing trades with discipline. This is where traders learn to apply concepts under live market pressure.

**Modules (3):**
1. TITM Day Trading Methodology (existing — 6 lessons, 180 min)
2. Reading the Alerts (existing — 6 lessons, 180 min)
3. SPX Execution Mastery (existing — 6 lessons, 180 min)

**Exit Gate:** Summative assessment testing entry validation, trade management, and exit discipline

### Track 3: Risk & Analytics (Position 3)
**Code:** `risk-analytics`
**Description:** Deep understanding of the Greeks, risk management frameworks, and long-term positioning strategies. The analytical foundation for consistent profitability.

**Modules (3):**
1. The Greeks Decoded (existing — 6 lessons, 180 min)
2. Risk Management Fundamentals (existing — 6 lessons, 180 min)
3. LEAPS and Long-Term Positioning (existing — 6 lessons, 180 min)

**Exit Gate:** Summative assessment testing position sizing, market context analysis, and Greek risk scenarios

### Track 4: Performance & Mastery (Position 4)
**Code:** `performance-mastery`
**Description:** The mental game, journaling discipline, and continuous improvement habits that separate breakeven traders from profitable ones.

**Modules (1 existing + 2 NEW):**
1. Trading Psychology and Performance (existing — 6 lessons, 180 min)
2. **SPX & NDX Advanced Strategies** (NEW — needs full creation)
3. **NDX Trading Specialization** (NEW — needs full creation)

**Exit Gate:** Summative assessment testing review reflection, professional mindset, and advanced index strategies

---

## Existing Content Inventory

### Modules and Lessons (Current State)
| Module | Track | Lessons | Blocks | Missing |
|--------|-------|---------|--------|---------|
| Welcome to TradeITM | Foundations | 5 | 20 | — |
| Options 101 | Foundations | 6 | 25 | — |
| Market Context Fundamentals | Foundations | 2 | 0 | 2 lessons have 0 blocks |
| TITM Day Trading | Strategy | 6 | 28 | — |
| Reading the Alerts | Strategy | 6 | 24 | — |
| SPX Execution Mastery | Strategy | 6 | 26 | — |
| The Greeks Decoded | Risk | 6 | 24 | — |
| Risk Management Fundamentals | Risk | 6 | 26 | — |
| LEAPS and Long-Term Positioning | Risk | 6 | 25 | — |
| Trading Psychology | Performance | 6 | 24 | — |

### Blocks per Lesson (Typical: 4)
- Position 1: hook ("Concept Brief") — always present
- Position 2: concept_explanation ("Quick Check") — always present
- Position 3: worked_example (Scenario/Drill) — always present
- Position 4: guided_practice ("Reflection") — always present
- Position 5: independent_practice — present in only 10/53 lessons

---

## Competency Framework

### Current Competencies (6)
| Key | Title | Current Domain | Suggested Domain | Mapped Lessons |
|-----|-------|---------------|-----------------|----------------|
| market_context | Market Context | legacy-v2 | analysis | 12 |
| entry_validation | Entry Validation | legacy-v2 | execution | 8 |
| review_reflection | Review Reflection | legacy-v2 | performance | 14 |
| trade_management | Trade Management | legacy-v2 | execution | 7 |
| position_sizing | Position Sizing | legacy-v2 | risk | 7 |
| exit_discipline | Exit Discipline | legacy-v2 | execution | 5 |

### Proposed New Competencies (for SPX/NDX content)
| Key | Title | Domain | Rationale |
|-----|-------|--------|-----------|
| index_mechanics | Index Product Mechanics | analysis | SPX/NDX cash settlement, European style, Section 1256 |
| flow_reading | Options Flow Reading | analysis | GEX interpretation, Put/Call Wall, institutional positioning |
| spread_construction | Spread Construction | execution | Verticals, butterflies, iron condors on index products |
| volatility_assessment | Volatility Assessment | analysis | IV percentile, VIX regime, vol-adjusted sizing |

---

## Assessment Strategy

### Assessment Types Needed

**1. Diagnostic Assessment (1 total)**
- Purpose: Initial placement when user enrolls
- Covers: All 6 (or 10) competencies
- Items: 15-20 questions (2-3 per competency)
- Types: Mix of single_select and scenario_branch
- Threshold: 0.75 (75%)
- No max attempts (can retake after learning)

**2. Formative Assessments (1 per module = 10+)**
- Purpose: Check understanding after completing a module
- Covers: 2-3 competencies relevant to the module
- Items: 5-10 questions
- Types: Varied (single_select, multi_select, ordered_steps, short_answer_rubric)
- Threshold: 0.75
- Max attempts: 3

**3. Summative Assessments (1 per track = 4)**
- Purpose: Gate to next track
- Covers: All competencies taught in the track
- Items: 10-15 questions
- Types: Heavy on scenario_branch and ordered_steps
- Threshold: 0.80 (higher bar)
- Max attempts: 3

### Assessment Item Guidelines
- Questions should test APPLICATION, not recall
- Use realistic market scenarios with specific numbers
- Wrong answers should include plausible mistakes (not obviously wrong)
- Feedback should explain WHY, not just "correct/incorrect"
- Scenario branches should mirror real trading decision trees
- Reference the same terminology used in lessons

---

## New Content Needed

### Priority 1: Fill Existing Gaps
1. Content blocks for "Session Framing for Options" (Market Context module)
2. Content blocks for "Invalidations and Key Levels" (Market Context module)
3. Learning outcomes for all 9 legacy modules (3-5 per module)
4. Independent practice blocks for 43 lessons missing them
5. Track descriptions for all 4 tracks

### Priority 2: Assessment Creation
1. 10 formative assessments (1 per existing module)
2. 4 summative assessments (1 per track)
3. 1 diagnostic assessment (placement)
4. Assessment items for each (5-15 per assessment)

### Priority 3: New Modules (SPX & NDX)
**SPX & NDX Advanced Strategies** (6 lessons):
1. SPX vs NDX: Choosing Your Battlefield
2. Advanced SPX 0DTE Structures (butterflies, condors)
3. NDX Directional Plays and Tech Catalysts
4. Cross-Index Hedging (SPX + NDX combinations)
5. Earnings Week Index Strategies
6. End-of-Week SPX/NDX Flow Patterns

**NDX Trading Specialization** (6 lessons):
1. NDX Market Microstructure
2. Reading NDX Flow vs SPX Flow
3. NDX Premium and Spread Management
4. Tech Sector Rotation and NDX Impact
5. NDX Volatility Events (NVDA earnings, Fed days)
6. Building an NDX Trading Playbook

### Priority 4: Competency Mapping
- Map all new lessons to competencies (existing + new)
- Ensure every competency has at least 5 lesson mappings
- Weight lessons appropriately (primary topic = 0.8-1.0, secondary = 0.3-0.5)
