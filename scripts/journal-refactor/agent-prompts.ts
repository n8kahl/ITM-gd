/**
 * Trade Journal Refactor — Agent Prompt Templates
 *
 * Each function generates a detailed prompt for a sub-agent working on a specific slice.
 * The orchestrator calls these to brief agents before work begins.
 *
 * Usage: npx tsx scripts/journal-refactor/agent-prompts.ts <slice-id>
 *   e.g.: npx tsx scripts/journal-refactor/agent-prompts.ts 1A
 */

// ─── Common Context ─────────────────────────────────────────────────────────

const COMMON_CONTEXT = `
## Governing Documents
- Execution Spec: docs/specs/TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md
- Refactor Proposal: docs/trade-journal/TRADE_JOURNAL_CRITIQUE_AND_REFACTOR_PROPOSAL_2026-02-24.md
- V2 Foundation Spec: docs/specs/TRADE_JOURNAL_V2_SPEC.md
- Change Control: docs/specs/journal-refactor-autonomous-2026-02-24/06_CHANGE_CONTROL_AND_PR_STANDARD.md
- Tracker: docs/specs/journal-refactor-autonomous-2026-02-24/08_AUTONOMOUS_EXECUTION_TRACKER.md

## Quality Standards (Non-Negotiable)
- Zero \`any\` types in new code
- ESLint: zero warnings in touched files
- All string inputs HTML-escaped (use sanitizeString from lib/validation/journal-entry.ts)
- All divisions guarded against zero/Infinity
- Dark mode only (Emerald Standard from CLAUDE.md Section 2)
- Mobile-first layouts
- TypeScript strict mode

## Design System
- Primary: Emerald Green (#10B981) with Champagne (#F3E5AB) accents
- Surfaces: glass-card-heavy class for all cards/containers
- Headings: Playfair Display, Body: Inter, Data: Geist Mono
- Icons: Lucide React, stroke width 1.5
- Images: next/image only
- Imports: @/ alias for absolute imports
`

// ─── Slice Prompts ──────────────────────────────────────────────────────────

const SLICE_PROMPTS: Record<string, string> = {
  '1A': `
# Slice 1A: Delete AI Coach Duplicate Journal

## Objective
Delete the duplicate journal UI embedded in the AI Coach panel.

## Target Files
- DELETE: components/ai-coach/trade-journal.tsx
- DELETE: components/ai-coach/journal-insights.tsx (if no other consumers)

## Steps
1. Search for all imports of trade-journal.tsx and journal-insights.tsx across the codebase
2. For each import found:
   a. If it's in a file that renders the journal panel in AI Coach, remove the import and rendering code
   b. If it's in a test file, remove or update the test
3. Delete the files
4. Run: pnpm exec tsc --noEmit — fix any compilation errors
5. Run: pnpm exec eslint components/ai-coach/ --max-warnings=0

## Validation Checklist
- [ ] components/ai-coach/trade-journal.tsx deleted
- [ ] components/ai-coach/journal-insights.tsx deleted (if no other consumers)
- [ ] Zero compilation errors
- [ ] Zero ESLint warnings in components/ai-coach/
- [ ] No broken imports anywhere in the codebase

## Boundary
- ONLY modify files in components/ai-coach/ and their direct importers
- DO NOT modify components/journal/*, lib/*, backend/*, or supabase/*
- DO NOT add new functionality — this slice is deletion only

${COMMON_CONTEXT}
`,

  '1B': `
# Slice 1B: Remove AI Coach Journal API Client Functions

## Objective
Remove the duplicate journal API client functions from the AI Coach API module.

## Target Files
- MODIFY: lib/api/ai-coach.ts

## Steps
1. Read lib/api/ai-coach.ts
2. Identify and remove these functions: getTrades(), createTrade(), deleteTrade(), getTradeAnalytics()
3. PRESERVE analyzeScreenshot() — it is shared by both journal and AI Coach
4. Search for imports of the removed functions across the codebase
5. Remove or update all import sites
6. Run: pnpm exec tsc --noEmit
7. Run: pnpm exec eslint lib/api/ --max-warnings=0

## Validation Checklist
- [ ] getTrades, createTrade, deleteTrade, getTradeAnalytics removed from lib/api/ai-coach.ts
- [ ] analyzeScreenshot preserved and functional
- [ ] Zero broken imports
- [ ] Zero compilation errors

## Boundary
- ONLY modify lib/api/ai-coach.ts and its import sites
- DO NOT modify backend/*, components/journal/*, or API routes

${COMMON_CONTEXT}
`,

  '1C': `
# Slice 1C: Schema Migration — setup_type and Regime Documentation

## Objective
Add the setup_type column and document the regime tag structure for market_context JSONB.

## Target Files
- CREATE: supabase/migrations/YYYYMMDD_journal_setup_type_and_regime.sql

## Migration Requirements
\`\`\`sql
-- Add setup_type column (nullable, no breaking change)
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS setup_type TEXT;

-- Add index for setup-type queries
CREATE INDEX IF NOT EXISTS idx_journal_user_setup_type
  ON public.journal_entries(user_id, setup_type)
  WHERE setup_type IS NOT NULL;

-- Document regime tag structure (comment only, JSONB is already flexible)
COMMENT ON COLUMN public.journal_entries.market_context IS
  'JSONB containing market context. Expected regime fields: '
  'vix_bucket (text: <15, 15-20, 20-30, 30+), '
  'trend_state (text: trending_up, trending_down, ranging), '
  'gex_regime (text: positive_gamma, negative_gamma, near_flip), '
  'time_bucket (text: open, mid_morning, lunch, power_hour, close)';
\`\`\`

## Steps
1. Create migration file with timestamp prefix (format: YYYYMMDDHHMMSS)
2. Ensure migration is idempotent (IF NOT EXISTS)
3. Verify existing migrations for conflicts
4. Verify the is_draft, draft_status, draft_expires_at columns already exist from the guardrails migration

## Validation Checklist
- [ ] Migration file created in supabase/migrations/
- [ ] setup_type column added as nullable TEXT
- [ ] Index on (user_id, setup_type) created
- [ ] Regime tag structure documented via COMMENT
- [ ] Migration is idempotent
- [ ] No conflicts with existing migrations

## Boundary
- ONLY create/modify files in supabase/migrations/
- DO NOT modify lib/types/*, lib/validation/*, or any code files

${COMMON_CONTEXT}
`,

  '1D': `
# Slice 1D: Journal Slide-Over Component

## Objective
Create a slide-over wrapper that allows the AI Coach to display journal data using existing journal components.

## Target Files
- CREATE: components/journal/journal-slide-over.tsx

## Requirements
- Thin wrapper component that renders as a slide-over panel (right side)
- Reuses JournalTableView and JournalCardView from existing components
- Accepts props: open (boolean), onClose (callback), initialFilters (optional)
- Respects mobile viewport (cards view on mobile)
- Follows Emerald Standard design system (glass-card-heavy, dark mode)
- Lazy-loads entries on open (not pre-fetched)
- Includes close button and title bar

## Implementation Pattern
\`\`\`tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { JournalCardView } from '@/components/journal/journal-card-view'
import { JournalTableView } from '@/components/journal/journal-table-view'
import type { JournalEntry, JournalFilters } from '@/lib/types/journal'
import { DEFAULT_JOURNAL_FILTERS } from '@/lib/types/journal'
import { sanitizeJournalEntries } from '@/lib/journal/sanitize-entry'

interface JournalSlideOverProps {
  open: boolean
  onClose: () => void
  initialFilters?: Partial<JournalFilters>
}

export function JournalSlideOver({ open, onClose, initialFilters }: JournalSlideOverProps) {
  // Implementation: fetch entries on open, render table/card view, handle close
}
\`\`\`

## Validation Checklist
- [ ] Component created at components/journal/journal-slide-over.tsx
- [ ] Reuses existing JournalTableView and JournalCardView
- [ ] Slide-over panel with glass-card-heavy styling
- [ ] Mobile responsive (cards on mobile)
- [ ] Lazy-loads entries on open
- [ ] Close button functional
- [ ] Zero TypeScript errors
- [ ] Zero ESLint warnings

## Boundary
- CREATE only components/journal/journal-slide-over.tsx
- DO NOT modify existing journal components
- DO NOT modify AI Coach components (that's a separate slice)

${COMMON_CONTEXT}
`,

  '2A': `
# Slice 2A: Auto-Draft Creation Service

## Objective
Build a backend service that creates draft journal entries when the SPX Command Center detects a position close.

## Target Files
- CREATE: backend/src/services/journal/autoDraftCreator.ts
- CREATE: backend/src/services/journal/__tests__/autoDraftCreator.test.ts

## Requirements
- Receives position close data from SPX CC (symbol, direction, prices, P&L, hold_duration, setup_type)
- Creates a journal entry with is_draft: true
- Pre-fills: symbol, direction, contract_type, entry_price, exit_price, pnl, hold_duration_min, setup_type
- Pre-fills: market_context with VWAP, ATR, regime state, GEX state at entry/exit
- ONLY triggers for SPX CC-originated trades (must check origin)
- Returns the created draft entry ID
- Must validate input (Zod schema)
- Must sanitize all string inputs

## Interface
\`\`\`typescript
interface PositionCloseEvent {
  userId: string
  symbol: string
  direction: 'long' | 'short'
  contractType: 'stock' | 'call' | 'put'
  entryPrice: number
  exitPrice: number
  positionSize: number
  pnl: number
  holdDurationMin: number
  setupType?: string
  marketContext?: Record<string, unknown>
  origin: 'spx_command_center' // Must be present
}

interface AutoDraftResult {
  success: boolean
  draftId?: string
  error?: string
}

export async function createAutoDraft(event: PositionCloseEvent): Promise<AutoDraftResult>
\`\`\`

## Risk Mitigations
- R-001: Only create drafts when origin === 'spx_command_center'
- Validate all inputs with Zod before inserting
- Set draft_expires_at to 7 days from creation

## Tests Required
- Creates draft with correct fields from position close event
- Rejects events without spx_command_center origin
- Validates input schema
- Calculates pnl_percentage correctly
- Sets is_draft: true and draft_expires_at

${COMMON_CONTEXT}
`,

  '2B': `
# Slice 2B: Draft Notification Component

## Objective
Build an in-app notification component that alerts users when auto-drafts are created.

## Target Files
- CREATE: components/journal/draft-notification.tsx

## Requirements
- Toast-style notification: "Trade closed: {symbol}. Tap to complete your journal entry."
- Appears at bottom-right (desktop) or bottom-center (mobile)
- Auto-dismisses after 30 seconds
- Clicking opens the TradeEntrySheet with the draft pre-loaded
- Glass-card-heavy styling with emerald accent
- Stacks if multiple drafts arrive (max 3 visible)
- "Dismiss all" action
- Accessible: role="alert", aria-live="polite"

## Validation Checklist
- [ ] Component at components/journal/draft-notification.tsx
- [ ] Displays symbol and action prompt
- [ ] Auto-dismisses after 30 seconds
- [ ] Click opens entry sheet with draft data
- [ ] Mobile responsive positioning
- [ ] Accessible (role, aria attributes)
- [ ] Emerald Standard styling

${COMMON_CONTEXT}
`,

  '3A': `
# Slice 3A: Bias Detector Service

## Objective
Build a backend service that analyzes trade sequences to detect 5 cognitive biases.

## Target Files
- CREATE: backend/src/services/journal/biasDetector.ts
- CREATE: backend/src/services/journal/__tests__/biasDetector.test.ts

## Required Biases (all 5 must be implemented)
1. **Overconfidence**: Position size increases after winning streaks (compare avg size after 3+ wins vs baseline)
2. **Revenge trading**: Trade frequency spikes after losses (compare frequency in 2h after loss vs baseline)
3. **Anchoring**: Repeated entries near round numbers or previous day's close (within 0.1% of round/PDC)
4. **Disposition effect**: Winners closed too early, losers held too long (MFE/MAE ratio analysis)
5. **Recency bias**: Setup selection influenced by most recent outcome (same setup repeated after win)

## Interface
\`\`\`typescript
interface BiasScore {
  bias: 'overconfidence' | 'revenge_trading' | 'anchoring' | 'disposition_effect' | 'recency_bias'
  score: number // 0-100 (higher = stronger signal)
  confidence: number // 0-1 (statistical confidence)
  evidence: string // Human-readable explanation with specific data
  tradeIds: string[] // IDs of trades that contributed to this score
}

interface BiasDetectionResult {
  totalTradesAnalyzed: number
  minimumMet: boolean // false if < 20 trades
  biases: BiasScore[]
  overallHealthScore: number // 0-100 composite score
}

export async function detectBiases(userId: string, trades: JournalEntry[]): Promise<BiasDetectionResult>
\`\`\`

## Risk Mitigations
- R-002: Return minimumMet: false and empty biases if < 20 trades
- Include confidence intervals in scores
- Use rolling windows for temporal biases (revenge, recency)

## Tests Required (minimum 10)
- Returns minimumMet: false for < 20 trades
- Detects overconfidence when position size grows after wins
- No overconfidence flag when sizing is consistent
- Detects revenge trading when frequency spikes after loss
- Detects anchoring when entries cluster near round numbers
- Detects disposition effect when MFE/MAE ratio is imbalanced
- Detects recency bias when setup selection follows recent outcomes
- Confidence intervals calculated correctly
- Overall health score is weighted average of bias scores
- Empty trade array returns clean result

${COMMON_CONTEXT}
`,

  '3B': `
# Slice 3B: Regime Tagging Service

## Objective
Build a service that classifies market regime at time of trade entry.

## Target Files
- CREATE: backend/src/services/journal/regimeTagging.ts
- CREATE: backend/src/services/journal/__tests__/regimeTagging.test.ts

## Required Regime Categories (all 4)
1. **VIX bucket**: < 15, 15-20, 20-30, 30+
2. **Trend state**: trending_up, trending_down, ranging
3. **GEX regime**: positive_gamma, negative_gamma, near_flip
4. **Time-of-day bucket**: open (9:30-10:00), mid_morning (10:00-11:30), lunch (11:30-13:00), power_hour (15:00-16:00), close (15:45-16:00)

## Interface
\`\`\`typescript
interface RegimeTags {
  vix_bucket: '<15' | '15-20' | '20-30' | '30+'
  trend_state: 'trending_up' | 'trending_down' | 'ranging'
  gex_regime: 'positive_gamma' | 'negative_gamma' | 'near_flip'
  time_bucket: 'open' | 'mid_morning' | 'lunch' | 'power_hour' | 'close'
  confidence: 'high' | 'low' // R-003: Flag low confidence
}

export function classifyRegime(marketData: MarketDataSnapshot): RegimeTags
\`\`\`

## Risk Mitigations
- R-003: Flag low confidence when engine data is stale or missing

${COMMON_CONTEXT}
`,

  '4A': `
# Slice 4A: Pre-Trade Context API Endpoint

## Objective
Build the GET /api/members/journal/context endpoint for pre-trade context lookups.

## Target Files
- CREATE: app/api/members/journal/context/route.ts

## Requirements
- GET endpoint accepting query params: setupType (optional), symbol (optional)
- Returns compact context object:
  - Last 5 trades of setup type: win rate, avg P&L, avg hold time
  - Last 5 trades of symbol: win rate, avg P&L
  - Current streak status (wins/losses in a row)
  - Best time of day for this setup (hourly breakdown)
- Auth required (Supabase session check)
- Response cached per symbol/setup for 5 minutes (R-004 mitigation)
- Zero-division guards on all calculations
- p95 response time < 500ms

## Interface
\`\`\`typescript
interface PreTradeContext {
  setupType?: {
    recentTrades: number
    winRate: number | null
    avgPnl: number | null
    avgHoldMinutes: number | null
  }
  symbol?: {
    recentTrades: number
    winRate: number | null
    avgPnl: number | null
  }
  streak: {
    type: 'win' | 'loss' | 'none'
    count: number
  }
  bestTimeOfDay?: {
    hour: number
    winRate: number
    sampleSize: number
  }
}
\`\`\`

${COMMON_CONTEXT}
`,
}

// ─── Main ───────────────────────────────────────────────────────────────────

const sliceId = process.argv[2]

if (!sliceId || sliceId === '--help') {
  console.log(`
Agent Prompt Generator — Trade Journal Refactor

Usage: npx tsx scripts/journal-refactor/agent-prompts.ts <slice-id>

Available slices: ${Object.keys(SLICE_PROMPTS).join(', ')}
  `)
  process.exit(0)
}

const slicePrompt = SLICE_PROMPTS[sliceId]
if (!slicePrompt) {
  console.error(`Unknown slice: ${sliceId}. Available: ${Object.keys(SLICE_PROMPTS).join(', ')}`)
  process.exit(1)
}

console.log(slicePrompt)
