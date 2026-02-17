# Academy UI Redesign Plan

**Date:** 2026-02-17
**Status:** Implemented (2026-02-17)
**Scope:** Replace the 3-column developer scaffold with a production learning experience

---

## Implementation Update (2026-02-17)

Completed implementation in phased delivery with verification:

- Route migration to canonical `/members/academy/*`
- Redirect compatibility from `/members/academy-v3/*` and `/members/library`
- New dashboard, track-grouped modules catalog, module detail route, and full-width lesson viewer
- Review/progress migration with responsive layout updates and track-level progress section
- Supporting APIs for resume target, progress summary, module lesson-status, and lesson attempt state
- Unit + Playwright coverage updates with passing runs

See `/Users/natekahl/ITM-gd/docs/ACADEMY_REDESIGN_AUDIT_2026-02-17.md` for post-implementation spec audit.

## Problem Statement

The current Academy modules page uses a 3-column "Step 1 → Step 2 → Step 3" layout that:

- **Collapses on mobile.** Three columns can't stack into a usable phone experience. Content gets truncated or hidden.
- **Looks like a developer tool, not a learning platform.** Labels like "Step 1 · Select Module" read as scaffolding, not a product.
- **Crams lesson content into a narrow column.** Markdown, tables, callouts, and images render poorly at 33% viewport width.
- **Has no sense of progression.** No completion states, no track grouping, no "you are here" indicator.
- **Ignores the data hierarchy.** The V3 schema has Programs → Tracks → Modules → Lessons → Blocks, but the UI flattens everything into one undifferentiated list.

---

## Design Principles

1. **Route-per-view, not panel-per-view.** Each major action (browse modules, read a lesson) gets its own page with full-width layout.
2. **Track-first organization.** The 4 tracks (Foundations → Strategy & Execution → Risk & Analytics → Performance & Mastery) provide natural curriculum sections.
3. **Mobile-first.** Every layout must work as a single-column stack first, then expand on desktop.
4. **Consistent with the rest of the app.** Use `FeatureSubNav`, `glass-card-heavy`, emerald theme, and the same responsive patterns as Journal and Social.
5. **Progressive disclosure.** Show module cards first → tap into a module to see lessons → tap a lesson to read content full-width.

---

## Proposed Information Architecture

```
/members/academy                    ← Dashboard (learning plan overview)
/members/academy/modules            ← Module catalog (track-grouped cards)
/members/academy/modules/[slug]     ← Module detail (lesson list for one module)
/members/academy/lessons/[id]       ← Lesson viewer (full-width content)
/members/academy/review             ← Spaced repetition review queue
/members/academy/progress           ← Competency & mastery overview
```

**Key change:** Lessons get their own dedicated route instead of being crammed into a side panel. This gives markdown, tables, callouts, and images the full viewport width they need.

**Route consolidation:** Moving from `/members/academy-v3/*` to `/members/academy/*` (with redirects for existing bookmarks). This also simplifies the URL structure and drops the "v3" versioning from user-facing paths.

---

## Page-by-Page Design

### 1. Dashboard (`/members/academy`)

**Purpose:** "Where am I? What should I do next?"

**Layout:** Single column, stacked cards.

| Section | Content |
|---|---|
| **Welcome Banner** | "Your Learning Plan" with program title, overall progress ring, and module/lesson counts |
| **Continue Learning** | Card showing last-touched lesson with one-tap resume (pulls from `academy_user_lesson_attempts`) |
| **Recommended Next** | 1–3 recommendation cards from the adaptive engine |
| **Quick Actions** | Horizontal row of icon buttons: Browse Modules, Review Queue, View Progress |

**Mobile:** Stacks naturally. Welcome banner becomes a compact header. Continue Learning card is hero-sized for easy thumb reach.

**Desktop:** Max-width container (`max-w-4xl mx-auto`). Welcome banner spans full width, cards use `grid grid-cols-1 md:grid-cols-2 gap-4` where appropriate.

---

### 2. Module Catalog (`/members/academy/modules`)

**Purpose:** Browse all modules, organized by learning track.

**Layout:** Vertical sections, one per track. Each section contains a horizontal or grid set of module cards.

```
┌──────────────────────────────────────────────────┐
│  FeatureSubNav: [Dashboard] [Modules] [Review] [Progress] │
├──────────────────────────────────────────────────┤
│                                                  │
│  🟢 FOUNDATIONS  ─────────────────── Track 1 of 4│
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Welcome  │  │Options   │  │ Market   │       │
│  │ to ITM   │  │  101     │  │ Context  │       │
│  │          │  │          │  │          │       │
│  │ 5 lessons│  │ 6 lessons│  │ 2 lessons│       │
│  │ ████░░░  │  │ ░░░░░░░  │  │ ░░░░░░░  │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                  │
│  ⚡ STRATEGY & EXECUTION  ──────── Track 2 of 4 │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ TITM Day │  │ Reading  │  │  SPX     │       │
│  │ Trading  │  │  Alerts  │  │ Mastery  │       │
│  │          │  │          │  │          │       │
│  │ 6 lessons│  │ 6 lessons│  │ 6 lessons│       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                  │
│  ... Risk & Analytics ...                        │
│  ... Performance & Mastery ...                   │
└──────────────────────────────────────────────────┘
```

**Module Card Design:**
- `glass-card-heavy` container with `rounded-xl`
- Module thumbnail or gradient placeholder at top (16:9 or square)
- Title (semibold, white)
- Description (one line, truncated, `text-white/60`)
- Lesson count badge: "6 lessons · ~30 min"
- Progress bar at bottom (if user has progress data)
- Hover: subtle lift + emerald border glow
- Click → navigates to `/members/academy/modules/[slug]`

**Track Section Design:**
- Track name as a small uppercase label with emerald dot indicator
- Optional: track position badge ("Track 1 of 4")
- Divider between tracks (subtle `border-white/5`)

**Mobile:** Cards stack in a single column within each track section. Track headers remain visible as scroll anchors. Full-width cards with smaller thumbnails.

**Desktop:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` within each track section.

---

### 3. Module Detail (`/members/academy/modules/[slug]`)

**Purpose:** Show all lessons in a single module with clear ordering and status.

**Layout:** Full-width header + vertical lesson list.

```
┌──────────────────────────────────────────────────┐
│  ← Back to Modules                               │
├──────────────────────────────────────────────────┤
│                                                  │
│  Options 101: Understanding the Basics           │
│  Master calls, puts, strikes, expiration...      │
│  6 lessons · ~36 min · Track: Foundations         │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  1  What Are Options?              12 min  │  │
│  │     Learn the fundamentals of...    ✓ Done │  │
│  ├────────────────────────────────────────────┤  │
│  │  2  Calls vs Puts                   8 min  │  │
│  │     Understand the difference...   → Start │  │
│  ├────────────────────────────────────────────┤  │
│  │  3  Strike Prices & Expiration      6 min  │  │
│  │     How strike selection...         🔒     │  │
│  ├────────────────────────────────────────────┤  │
│  │  4  Reading the Options Chain       8 min  │  │
│  │     Navigate a real chain...        🔒     │  │
│  ├────────────────────────────────────────────┤  │
│  │  5  Placing Your First Order        6 min  │  │
│  │     Paper trade workflow...         🔒     │  │
│  ├────────────────────────────────────────────┤  │
│  │  6  Risk-Aware Practice             6 min  │  │
│  │     Apply position sizing...        🔒     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Lesson Row Design:**
- Position number (large, emerald for completed, zinc for locked)
- Title (white, semibold)
- Learning objective (one line, `text-white/55`)
- Duration estimate on right
- Status indicator: checkmark (completed), arrow (next up), lock (locked/future)
- Click → navigates to `/members/academy/lessons/[id]`

**Mobile:** Lesson rows are full-width cards stacked vertically. Module header is compact. Back button is prominent.

**Desktop:** `max-w-3xl mx-auto` centered column. Lesson rows have more horizontal breathing room.

---

### 4. Lesson Viewer (`/members/academy/lessons/[id]`)

**Purpose:** Read lesson content with full-width markdown rendering and step-through blocks.

**This is the biggest improvement.** Instead of cramming lesson content into a narrow 33%-width panel, the lesson gets the entire viewport.

**Layout:**

```
┌──────────────────────────────────────────────────┐
│  ← Options 101          Lesson 2 of 6            │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  CONCEPT                                 │    │
│  │                                          │    │
│  │  [Full-width markdown content here]      │    │
│  │  - Tables render properly                │    │
│  │  - Callout boxes have room              │    │
│  │  - Images display at proper size        │    │
│  │  - Code blocks aren't cramped           │    │
│  │                                          │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Block Progress: ●●○○○  (2 of 5 completed)      │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────┐      │
│  │  ← Previous  │  │  Next: Guided Prac → │      │
│  └──────────────┘  └──────────────────────┘      │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Block Progression:**
Each lesson has up to 5 blocks (hook → concept → worked example → guided practice → independent practice). The viewer shows one block at a time with:

- Block type label at the top (styled by type: emerald for concept, champagne for example, etc.)
- Full-width `AcademyMarkdown` rendering of the block content
- Progress dots showing position in the 5-block sequence
- Previous/Next navigation buttons
- "Complete & Continue" button to mark the block done and advance

**Mobile:** Content is full-width with comfortable reading margins (`px-4`). Navigation buttons are full-width and thumb-friendly. Block progress dots are centered above the nav buttons.

**Desktop:** Content is centered in a reading column (`max-w-3xl mx-auto`). Generous whitespace. Optional sidebar for lesson outline (table of contents generated from heading structure).

---

### 5. Review Queue (`/members/academy/review`)

**Keep the current design** with minor tweaks:
- Replace `AcademyV3SubNav` with `FeatureSubNav`
- Use `max-w-3xl mx-auto` for centered content
- Mobile: stack panels vertically instead of side-by-side

---

### 6. Progress Overview (`/members/academy/progress`)

**Keep the current design** with minor tweaks:
- Replace `AcademyV3SubNav` with `FeatureSubNav`
- Add track-level progress breakdown alongside competency view
- Mobile: competency table becomes a card list instead of a table

---

## Navigation Changes

### Sub-Navigation
Replace the custom `AcademyV3SubNav` with the shared `FeatureSubNav` component:

```
[Dashboard]  [Modules]  [Review]  [Progress]
```

Items remain the same, but now use the consistent styling, sticky behavior, and ARIA patterns from the shared component.

### Sidebar & Mobile Nav
Update entry points to link to the Dashboard page (root `/members/academy`) instead of jumping directly to `/modules`:

| Location | Current | Proposed |
|---|---|---|
| Desktop sidebar | `/members/academy-v3/modules` | `/members/academy` |
| Mobile bottom nav | `/members/academy-v3/modules` | `/members/academy` |
| Library redirect | `/members/academy-v3/modules` | `/members/academy/modules` |

### Breadcrumb Trail
Each deeper page gets a back-navigation link showing where you came from:

- Module Detail: "← Back to Modules"
- Lesson Viewer: "← Options 101" (back to parent module)

---

## Component Inventory (New/Modified)

| Component | Status | Purpose |
|---|---|---|
| `academy-dashboard.tsx` | **New** | Welcome banner, continue learning, recommendations |
| `academy-module-catalog.tsx` | **Replace** `modules-catalog.tsx` | Track-grouped module cards |
| `academy-module-detail.tsx` | **New** | Lesson list for a single module |
| `academy-lesson-viewer.tsx` | **New** | Full-width block-by-block lesson reader |
| `academy-module-card.tsx` | **New** | Reusable card component for module grid |
| `academy-lesson-row.tsx` | **New** | Reusable row component for lesson list |
| `academy-v3-sub-nav.tsx` | **Delete** | Replaced by `FeatureSubNav` usage in layout |
| `academy-v3-shell.tsx` | **Keep** | `AcademyPanel` still useful for dashboard cards |

### Route Changes

| Route | Status | Component |
|---|---|---|
| `/members/academy` | **Rename** from academy-v3 | Dashboard |
| `/members/academy/modules` | **Rewrite** | Module catalog (track-grouped) |
| `/members/academy/modules/[slug]` | **New** | Module detail with lesson list |
| `/members/academy/lessons/[id]` | **New** | Full-width lesson viewer |
| `/members/academy/review` | **Rename** from academy-v3 | Review queue (minor tweaks) |
| `/members/academy/progress` | **Rename** from academy-v3 | Progress overview (minor tweaks) |
| `/members/academy-v3/*` | **Redirect** | Redirects to `/members/academy/*` |

---

## Implementation Phases

### Phase A: Route Structure & Navigation (Low risk)
1. Create `/members/academy/` route tree mirroring academy-v3
2. Set up redirects from academy-v3 paths
3. Replace `AcademyV3SubNav` with `FeatureSubNav` in layout
4. Update sidebar and mobile nav href values

### Phase B: Module Catalog Redesign (Medium effort)
5. Build `academy-module-card.tsx` component
6. Build `academy-module-catalog.tsx` with track sections
7. Wire to existing `fetchAcademyPlan()` client function
8. Test with all 4 tracks and 10 modules

### Phase C: Module Detail Page (Medium effort)
9. Create `/members/academy/modules/[slug]/page.tsx`
10. Build `academy-module-detail.tsx` with lesson list
11. Wire to existing `fetchAcademyModule()` client function
12. Add back-navigation to catalog

### Phase D: Lesson Viewer (High effort, highest impact)
13. Create `/members/academy/lessons/[id]/page.tsx`
14. Build `academy-lesson-viewer.tsx` with block progression
15. Wire to existing `fetchAcademyLesson()` + `completeLessonBlock()`
16. Full-width `AcademyMarkdown` rendering
17. Previous/Next block navigation
18. Progress dots and completion tracking

### Phase E: Dashboard Refresh (Medium effort)
19. Rebuild dashboard with continue-learning card
20. Wire recommendation cards
21. Add overall progress ring

### Phase F: Cleanup
22. Delete old `modules-catalog.tsx` (1,363 lines)
23. Delete `academy-v3-sub-nav.tsx`
24. Remove empty academy directories
25. Update `CLAUDE.md` with new routes

---

## What This Does NOT Change

- **Database schema:** No table changes. All V3 tables remain as-is.
- **API routes:** All existing `/api/academy-v3/*` endpoints remain. Frontend just calls them differently.
- **Admin panel:** Admin routes already write to V3 tables (rewritten in Phase 2 of consolidation). No changes needed.
- **Review & Progress pages:** Minor styling updates only. Core functionality stays the same.
- **AcademyMarkdown component:** Stays as-is. It's already well-built.

---

## Success Criteria

1. Module catalog shows all 10 modules grouped under 4 named tracks
2. Each module has a dedicated detail page with ordered lesson list
3. Lessons render full-width with proper markdown formatting
4. All pages work on mobile (single-column, thumb-friendly)
5. Navigation uses shared `FeatureSubNav` matching the rest of the app
6. No "Step 1 / Step 2 / Step 3" developer language visible
7. URLs use `/members/academy/*` (no "v3" in user-facing paths)
