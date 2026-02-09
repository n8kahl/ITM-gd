# Claude Code / Codex Prompt: AI Coach UX Polish — Production Implementation

> **Copy this entire prompt into Claude Code (or Codex) to implement the AI Coach UX overhaul to production quality.**
>
> Full spec: `docs/ai-coach/AI_COACH_UX_AUDIT_AND_SPEC.md`

---

## Context

You are working on **TITM** (Trade In The Money), a Next.js 14 + Express trading platform. The **AI Coach** feature is at `/members/ai-coach` and consists of a split-panel layout: chat panel (left) and center panel (right) with 13 sub-views (chart, options, morning brief, etc.).

The AI Coach just completed its core overhaul and needs UX polish, premium touches, bug fixes, and new SPX-focused features. A comprehensive UX audit has been completed and lives at `docs/ai-coach/AI_COACH_UX_AUDIT_AND_SPEC.md` — **read that file first** before making any changes. It contains the complete issue list, implementation specs, and file-by-file change map.

### Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, `framer-motion` (already installed), `lucide-react` icons, `react-resizable-panels`
- **Backend:** Express.js (port 3001), TypeScript, OpenAI API (GPT-4) with function calling, Supabase PostgreSQL
- **Data:** Massive.com API for market data (stocks, options, indices)
- **Design System:** Dark theme (`#0A0A0B` background), emerald-500 accent (`#10B981`), champagne gold for user elements (`#F3E5AB`), glass-card pattern with `bg-white/5 border border-white/10`

### Key Architecture

- `app/members/ai-coach/page.tsx` — Main page with `ChatArea` and `CenterPanel` in resizable split layout
- `components/ai-coach/center-panel.tsx` — The master orchestrator: 13 views, tab bar, welcome view, example prompts
- `components/ai-coach/morning-brief.tsx` — Daily pre-market brief panel
- `components/ai-coach/widget-cards.tsx` — Inline data cards in chat (key levels, GEX, options, etc.)
- `components/ai-coach/chat-message.tsx` — Chat bubble renderer with markdown
- `contexts/AICoachWorkflowContext.tsx` — Central workflow state (active symbol, view, breadcrumbs)
- `hooks/use-ai-coach-chat.ts` — Chat message/session management hook
- `lib/api/ai-coach.ts` — Frontend API client
- `backend/src/chatkit/` — `chatService.ts`, `systemPrompt.ts`, `functions.ts`, `functionHandlers.ts`
- `backend/src/services/morningBrief/index.ts` — Morning brief data generation

---

## Implementation Instructions

Implement all changes described below in the order listed. Each phase is independent and should result in a working, testable state. **Read `docs/ai-coach/AI_COACH_UX_AUDIT_AND_SPEC.md` for the full detailed specs** — this prompt summarizes the work and provides the exact code-level guidance.

---

### PHASE 1: Critical Fixes (Broken Functionality)

#### 1.1 Fix Dead Buttons in Chat Empty State

**File:** `app/members/ai-coach/page.tsx`

The `EmptyState` component (around line 438) renders 4 suggestion buttons with **no onClick handlers**. Fix this:

1. Change `EmptyState` to accept `{ onSendPrompt: (prompt: string) => void }` as props
2. Where `ChatArea` renders `<EmptyState />`, change to `<EmptyState onSendPrompt={onSendMessage} />`
3. Wire each button: `onClick={() => onSendPrompt(promptText)}`
4. Replace the 4 hardcoded prompts (`'SPX levels today'`, `'AAPL options chain'`, `'What\'s TGT trading at?'`, `'Macro outlook'`) with these:

```typescript
const CHAT_QUICK_PROMPTS = [
  { text: 'SPX Game Plan', prompt: 'Give me the full SPX game plan: key levels (PDH, PDL, pivot, VWAP), GEX profile with flip point, expected move, and what setups to watch today. Show the chart.' },
  { text: 'Morning Brief', prompt: 'Show me today\'s morning brief with overnight gaps, key levels, and what to watch.' },
  { text: 'Best Setup Now', prompt: 'Scan SPX, NDX, QQQ, SPY, AAPL, TSLA, NVDA for the best setups right now. Show me the highest-probability trade with entry, target, and stop.' },
  { text: 'SPX vs SPY', prompt: 'Compare SPX and SPY right now: price levels, expected move, GEX context, and which has the better risk/reward for day trading today. Include the SPX-to-SPY price ratio.' },
]
```

#### 1.2 Replace Center Panel Example Prompts

**File:** `components/ai-coach/center-panel.tsx`

Replace the `EXAMPLE_PROMPTS` constant (lines 125–150) with:

```typescript
const EXAMPLE_PROMPTS = [
  {
    icon: Target,
    label: 'SPX Game Plan',
    prompt: 'Give me the full SPX game plan: key levels (PDH, PDL, pivot, VWAP), GEX profile with flip point, expected move, and what setups to watch today. Show the chart.',
    description: 'Complete SPX analysis with levels, GEX, and trade setups',
  },
  {
    icon: Sunrise,
    label: 'Morning Brief',
    prompt: '__NAVIGATE_BRIEF__', // Special flag — see handler below
    description: 'Pre-market overview, overnight gaps, key levels & events',
  },
  {
    icon: Search,
    label: 'Best Setup Now',
    prompt: 'Scan SPX, NDX, QQQ, SPY, AAPL, TSLA, NVDA for the best setups right now. Show me the highest-probability trade with entry, target, and stop.',
    description: 'AI scans 7 symbols for the highest-conviction setup',
  },
  {
    icon: Activity,
    label: 'SPX vs SPY',
    prompt: 'Compare SPX and SPY right now: price levels, expected move, GEX context, and which has the better risk/reward for day trading today. Include the SPX-to-SPY price ratio.',
    description: 'Head-to-head comparison for day trading decisions',
  },
]
```

Add `Activity` to the lucide-react import. In the `WelcomeView` button click handler, check for the special flag:

```typescript
onClick={() => {
  if (item.prompt === '__NAVIGATE_BRIEF__') {
    onShowBrief()
  } else {
    onSendPrompt?.(item.prompt)
  }
}}
```

#### 1.3 Render Overnight Gap Data in Morning Brief

**File:** `components/ai-coach/morning-brief.tsx`

The `overnightSummary` data (`futuresDirection`, `futuresChange`, `futuresChangePct`, `gapAnalysis[]`) exists in the `MorningBrief` type and is returned by the API, but is never rendered. Add a new section after the Summary card:

```tsx
{/* Overnight Gap */}
{brief?.overnightSummary && (
  <section className="glass-card-heavy rounded-lg p-3 border border-white/5">
    <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">Overnight / Pre-Market</p>
    <div className="flex items-center gap-3 mb-2">
      <div className={cn(
        'flex items-center gap-1.5 text-sm font-medium',
        brief.overnightSummary.futuresDirection === 'up' ? 'text-emerald-400' :
        brief.overnightSummary.futuresDirection === 'down' ? 'text-red-400' : 'text-white/60'
      )}>
        {brief.overnightSummary.futuresDirection === 'up' ? <TrendingUp className="w-4 h-4" /> :
         brief.overnightSummary.futuresDirection === 'down' ? <TrendingDown className="w-4 h-4" /> :
         <Minus className="w-4 h-4" />}
        <span>Futures {brief.overnightSummary.futuresDirection}</span>
        <span className="font-mono">
          {brief.overnightSummary.futuresChange >= 0 ? '+' : ''}{brief.overnightSummary.futuresChange.toFixed(2)}
          ({brief.overnightSummary.futuresChangePct >= 0 ? '+' : ''}{brief.overnightSummary.futuresChangePct.toFixed(2)}%)
        </span>
      </div>
    </div>
    {(brief.overnightSummary.gapAnalysis || []).length > 0 && (
      <div className="space-y-1.5">
        {brief.overnightSummary.gapAnalysis.map((gap) => (
          <div key={gap.symbol} className="flex items-center justify-between text-xs rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5">
            <span className="text-white/80 font-medium">{gap.symbol}</span>
            <div className="flex items-center gap-3">
              <span className={cn('font-mono', gap.gapType === 'up' ? 'text-emerald-300' : gap.gapType === 'down' ? 'text-red-300' : 'text-white/50')}>
                Gap {gap.gapPct >= 0 ? '+' : ''}{gap.gapPct.toFixed(2)}%
              </span>
              {gap.atrRatio != null && (
                <span className="text-white/40">{gap.atrRatio.toFixed(1)}x ATR</span>
              )}
              {gap.historicalFillRate != null && (
                <span className="text-white/30">{(gap.historicalFillRate * 100).toFixed(0)}% fill rate</span>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
)}
```

Add `TrendingUp`, `TrendingDown`, `Minus` to the lucide imports.

#### 1.4 Build `get_spx_game_plan` Composite Function

**File:** `backend/src/chatkit/functions.ts`

Add a new function definition:

```typescript
{
  type: 'function',
  function: {
    name: 'get_spx_game_plan',
    description: 'Get a comprehensive SPX game plan: key levels, GEX profile, 0DTE structure, expected move, and SPY correlation. Use this when the user asks for SPX analysis, game plan, levels overview, or what to watch in SPX today.',
    parameters: {
      type: 'object',
      properties: {
        include_spy: {
          type: 'boolean',
          description: 'Include SPY correlation and translation (default: true)',
          default: true
        }
      }
    }
  }
}
```

**File:** `backend/src/chatkit/functionHandlers.ts`

Add the handler that orchestrates parallel calls:

```typescript
case 'get_spx_game_plan': {
  const includeSpy = args.include_spy !== false;

  const [spxLevels, spxGex, spxPrice, spyPrice] = await Promise.all([
    handleGetKeyLevels({ symbol: 'SPX', timeframe: 'intraday' }),
    handleGetGammaExposure({ symbol: 'SPX' }),
    handleGetCurrentPrice({ symbol: 'SPX' }),
    includeSpy ? handleGetCurrentPrice({ symbol: 'SPY' }) : Promise.resolve(null),
  ]);

  const spxPriceVal = spxPrice?.price || 0;
  const spyPriceVal = spyPrice?.price || 0;
  const ratio = spyPriceVal > 0 ? (spxPriceVal / spyPriceVal) : 10;

  const gammaRegime = spxGex?.flipPoint != null && spxPriceVal > 0
    ? (spxPriceVal > spxGex.flipPoint ? 'positive' : 'negative')
    : 'neutral';

  const expectedMove = spxLevels?.levels?.indicators?.expectedMove || spxLevels?.levels?.indicators?.atr14 || null;
  const spyExpectedMove = expectedMove && ratio > 0 ? expectedMove / ratio : null;

  return {
    symbol: 'SPX',
    currentPrice: spxPriceVal,
    spyPrice: spyPriceVal,
    spxSpyRatio: Number(ratio.toFixed(2)),
    gammaRegime,
    flipPoint: spxGex?.flipPoint || null,
    maxGEXStrike: spxGex?.maxGEXStrike || null,
    expectedMove: expectedMove ? Number(expectedMove.toFixed(2)) : null,
    spyExpectedMove: spyExpectedMove ? Number(spyExpectedMove.toFixed(2)) : null,
    keyLevels: spxLevels?.levels || null,
    gexProfile: spxGex || null,
    setupContext: buildSetupContext(spxPriceVal, spxLevels, spxGex, gammaRegime),
  };
}
```

Add a helper function `buildSetupContext` that generates a 1–2 sentence summary based on where price sits relative to levels and gamma regime.

**File:** `backend/src/chatkit/systemPrompt.ts`

Add to the system prompt after the TOOLS section:

```
## SPX GAME PLAN

When the user asks about SPX game plan, SPX analysis, SPX levels, or "what to watch in SPX today," ALWAYS call get_spx_game_plan. Structure your response:

1. **Setup Context** — Lead with the 1-2 sentence setup summary
2. **Key Levels** — PDH, PDL, Pivot, VWAP with distance from current price
3. **GEX Context** — Gamma regime (positive/negative), flip point, max GEX strike, implications
4. **Expected Move** — Today's expected range, how much has been used
5. **SPY Translation** — Always include SPY equivalent prices for day traders (SPX / ratio ≈ SPY)
6. **What to Watch** — 2-3 specific setups or triggers to monitor

Always call show_chart with SPX after providing the game plan.
```

#### 1.5 Add SPX/SPY Correlation to Morning Brief

**File:** `backend/src/services/morningBrief/index.ts`

In the `generateBrief` method, after calculating key levels for the watchlist, add:

```typescript
// SPX/SPY correlation
let spxSpyCorrelation = null;
const spxLevels = keyLevelsResults.find(k => k.symbol === 'SPX');
const spyLevels = keyLevelsResults.find(k => k.symbol === 'SPY');
if (spxLevels?.currentPrice && spyLevels?.currentPrice) {
  const ratio = spxLevels.currentPrice / spyLevels.currentPrice;
  const spxEM = spxLevels.expectedMoveToday;
  spxSpyCorrelation = {
    spxPrice: spxLevels.currentPrice,
    spyPrice: spyLevels.currentPrice,
    ratio: Number(ratio.toFixed(2)),
    spxExpectedMove: spxEM,
    spyExpectedMove: spxEM ? Number((spxEM / ratio).toFixed(2)) : null,
  };
}
```

Add `spxSpyCorrelation` to the brief data object and the `MorningBrief` interface. Render it in the frontend morning brief component as a side-by-side SPX / SPY comparison row.

---

### PHASE 2: High-Impact UX

#### 2.1 Welcome View Hero Redesign

**File:** `components/ai-coach/center-panel.tsx` — `WelcomeView` component

1. Replace "Welcome to AI Coach" with a dynamic greeting using the user's name and current time
2. Add a live SPX price ticker (poll `get_current_price` every 60s) below the greeting
3. Show a market status pill (Pre-Market / Open / After Hours / Closed) with color coding
4. Remove the redundant header bar buttons (Chart, Options, Analyze, Brief, Prefs) — the tab bar and quick access cards handle this
5. Reduce the quick access grid from 12 to 8 cards
6. Add framer-motion stagger animations on mount

#### 2.2 Morning Brief Full Redesign

**File:** `components/ai-coach/morning-brief.tsx`

Restructure the layout per the spec in `AI_COACH_UX_AUDIT_AND_SPEC.md` Section 4.2:

1. Hero AI Summary card with larger text, emerald border accent, "Ask AI to elaborate" button
2. Overnight Gap Card (from Phase 1, enhance with bar chart)
3. SPX Focus Card with gamma regime badge and expected move bar
4. SPX/SPY Correlation Row
5. Level Ladder visualization (replace flat text)
6. Sticky bottom CTA bar: "Get SPX Game Plan", "Set Level Alerts", "Scan for Setups"
7. Remove "Mark Viewed" button — auto-mark when scrolled past 50%

Create sub-components in new files as needed:
- `components/ai-coach/overnight-gap-card.tsx`
- `components/ai-coach/level-ladder.tsx`

#### 2.3 Suggested Follow-Up Chips

**File:** Create `components/ai-coach/follow-up-chips.tsx`

After each AI response, render 2–3 contextual follow-up action chips. Parse the last AI message for symbols and function calls to determine relevant actions:

- If response mentions levels → ["Show Chart", "Set Level Alerts"]
- If response mentions options → ["View Options Chain", "Analyze Position"]
- If response mentions SPX → ["SPX Game Plan", "SPX vs SPY"]
- Default → ["Show Chart", "Scan for Setups"]

Style as small emerald-outlined pills below the AI message.

Integrate in `app/members/ai-coach/page.tsx` after the last AI message bubble.

#### 2.4 Navigation Overhaul

**File:** `components/ai-coach/center-panel.tsx` — tab bar section

1. Add `Home` icon button at the LEFT of the tab bar (always visible)
2. Group tabs with subtle dividers: ANALYZE | PORTFOLIO | MONITOR | RESEARCH
3. Add framer-motion `layoutId` animated underline on the active tab
4. On mobile, add a "Tools" FAB that opens a bottom-sheet drawer with all tabs

#### 2.5 View Transition Animations

**File:** Create `components/ai-coach/view-transition.tsx`

```tsx
import { motion, AnimatePresence } from 'framer-motion'

export function ViewTransition({ viewKey, children }: { viewKey: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

Wrap the content area in `center-panel.tsx` with this component, passing `activeView` as the key.

#### 2.6 Complete Screenshot Analysis in Chat

**File:** `app/members/ai-coach/page.tsx`

The `handleImageAnalysis` function has a TODO. Complete it:

1. When user has a staged image and sends, show the image inline as a user message
2. Call `apiAnalyzeScreenshot` (already imported) with the base64 image
3. Display the analysis result as an AI response in the chat flow
4. Clear the staged image after sending

#### 2.7 SPXGamePlanCard Widget

**File:** `components/ai-coach/widget-cards.tsx`

Add a new `SPXGamePlanCard` to the widget type switch:

```typescript
case 'spx_game_plan':
  return <SPXGamePlanCard data={widget.data} />
```

Build the card to display: price with level annotations, GEX regime badge, expected move progress bar, SPY translation, and action buttons (View Chart, Options Chain, Set Alerts).

Also update `extractWidgets` to recognize `get_spx_game_plan` function call results.

---

### PHASE 3: Polish & Premium

#### 3.1 Message Entrance Animations

**File:** `components/ai-coach/chat-message.tsx`

Wrap `ChatMessageBubble` render in framer-motion:

```tsx
<motion.div
  initial={{ opacity: 0, y: 12, scale: 0.97 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ duration: 0.25, ease: 'easeOut' }}
>
  {/* existing message content */}
</motion.div>
```

#### 3.2 Rich Typing Indicator

**File:** `components/ai-coach/chat-message.tsx` — `TypingIndicator` component

Replace 3 bouncing dots with status-aware text: "Thinking...", "Fetching data...", "Analyzing...", "Writing..." — each with its own icon and pulse animation. Accept `streamStatus?: string` prop.

#### 3.3 Skeleton Loaders

**File:** Create `components/ai-coach/skeleton-loaders.tsx`

Build skeleton components for: `ChartSkeleton`, `OptionsSkeleton`, `BriefSkeleton`, `ScannerSkeleton`. Use `animate-pulse` with `bg-white/5` shapes matching the layout of each view.

Replace all `Loader2 animate-spin` in main content areas with these skeletons.

#### 3.4 Tab Underline Animation

Use framer-motion `layoutId="activeTab"` on a `motion.div` positioned under the active tab. Spring animation with `stiffness: 500, damping: 30`.

#### 3.5 Button Micro-Interactions

Replace key `<button>` elements with `<motion.button>` and add:

```tsx
whileTap={{ scale: 0.97 }}
whileHover={{ scale: 1.02 }}
transition={{ type: 'spring', stiffness: 400, damping: 17 }}
```

#### 3.6 Collapsible Chat Panel

Add a collapse button to the chat header. When collapsed, panel shrinks to 48px showing only icons. Store preference in localStorage.

#### 3.7 Resize Handle Enhancement

Change width from 1.5px to 6px. Add 3 grip dots on hover. Improve cursor and transition styles.

#### 3.8 Rotating Chat Placeholder

Create time-aware placeholder rotation:

```typescript
const PLACEHOLDERS = {
  pre_market: ["What's the gap looking like?", "Show me overnight levels", "Morning brief"],
  session: ["How's SPX holding up?", "Best setup right now", "Check my positions"],
  after_hours: ["Recap today's session", "What worked today?", "Plan for tomorrow"],
  closed: ["Review my trade journal", "Analyze my win rate", "Study a setup"],
}
```

Rotate every 10s with fade transition.

#### 3.9 Error Message Polish

Replace all `"Failed to load X"` strings with friendly copy + auto-retry. Pattern: `"X is temporarily unavailable. Retrying..."` with 3s exponential backoff.

#### 3.10 Mobile Quick Access Grid

Change from 4-column to 2-column on mobile. Minimum 44px touch target height. Test on iPhone SE and iPad.

---

## Constraints & Quality Requirements

1. **TypeScript strict mode** — no `any` types, no `@ts-ignore`
2. **All existing tests must pass** — run `npm test` after each phase
3. **No new dependencies** — framer-motion, lucide-react, and react-markdown are already available
4. **Preserve existing functionality** — all 20+ AI functions, options chain, charting, etc. must continue working
5. **Mobile-first responsive** — test all changes at 375px (iPhone SE), 768px (iPad), and 1440px (desktop)
6. **Accessibility** — all new interactive elements need `aria-labels`, keyboard focusability, and visible focus rings
7. **Performance** — no layout thrashing from animations, use `will-change` sparingly, lazy-load new components where appropriate
8. **Error boundaries** — wrap all new components in the existing `AICoachErrorBoundary`

## Testing Checklist

After implementation, verify:

- [ ] Chat empty-state buttons send the correct prompts and receive AI responses
- [ ] Center panel example prompts fire correct functions (especially SPX Game Plan triggering `get_spx_game_plan`)
- [ ] Morning Brief "Morning Brief" prompt navigates to Brief view (not chat)
- [ ] Overnight gap data displays correctly when `overnightSummary` has data
- [ ] SPX/SPY correlation row shows in morning brief
- [ ] `get_spx_game_plan` returns unified data and the `SPXGamePlanCard` renders in chat
- [ ] View transitions animate smoothly between all 13 center panel views
- [ ] Tab bar groups are visually distinct, Home button is at the left
- [ ] Suggested follow-up chips appear after AI responses and are clickable
- [ ] Screenshot analysis works end-to-end in chat
- [ ] Mobile view works at 375px with proper touch targets
- [ ] All existing E2E tests pass (`e2e/specs/ai-coach/`)
