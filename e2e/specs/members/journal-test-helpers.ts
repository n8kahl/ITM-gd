import type { Page, Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

export const E2E_USER_ID = '00000000-0000-4000-8000-000000000001'

export type MockJournalEntry = {
  id: string
  user_id: string
  trade_date: string
  symbol: string
  direction: 'long' | 'short'
  contract_type: 'stock' | 'call' | 'put'
  entry_price: number | null
  exit_price: number | null
  position_size: number | null
  pnl: number | null
  pnl_percentage: number | null
  is_winner: boolean | null
  is_open: boolean
  entry_timestamp: string | null
  exit_timestamp: string | null
  stop_loss: number | null
  initial_target: number | null
  hold_duration_min: number | null
  mfe_percent: number | null
  mae_percent: number | null
  strike_price: number | null
  expiration_date: string | null
  dte_at_entry: number | null
  iv_at_entry: number | null
  delta_at_entry: number | null
  theta_at_entry: number | null
  gamma_at_entry: number | null
  vega_at_entry: number | null
  underlying_at_entry: number | null
  underlying_at_exit: number | null
  mood_before: 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful' | null
  mood_after: 'confident' | 'neutral' | 'anxious' | 'frustrated' | 'excited' | 'fearful' | null
  discipline_score: number | null
  followed_plan: boolean | null
  deviation_notes: string | null
  strategy: string | null
  setup_notes: string | null
  execution_notes: string | null
  lessons_learned: string | null
  tags: string[]
  rating: number | null
  screenshot_url: string | null
  screenshot_storage_path: string | null
  ai_analysis: {
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    entry_quality: string
    exit_quality: string
    risk_management: string
    lessons: string[]
    scored_at: string
  } | null
  market_context: null
  import_id: string | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface JournalMockState {
  entries: MockJournalEntry[]
  nextId: number
  importKeys: Set<string>
}

function nowIso(): string {
  return new Date().toISOString()
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true'
  return fallback
}

function calculatePnl(
  direction: 'long' | 'short',
  entryPrice: number | null,
  exitPrice: number | null,
  positionSize: number | null,
): number | null {
  if (entryPrice == null || exitPrice == null) return null
  const size = positionSize && positionSize > 0 ? positionSize : 1
  const perUnit = direction === 'short' ? entryPrice - exitPrice : exitPrice - entryPrice
  return Math.round(perUnit * size * 100) / 100
}

function calculatePnlPercentage(
  direction: 'long' | 'short',
  entryPrice: number | null,
  exitPrice: number | null,
): number | null {
  if (entryPrice == null || exitPrice == null || entryPrice === 0) return null
  const perUnit = direction === 'short' ? entryPrice - exitPrice : exitPrice - entryPrice
  return Math.round(((perUnit / entryPrice) * 100) * 10_000) / 10_000
}

export function createMockEntry(partial: Partial<MockJournalEntry>): MockJournalEntry {
  const timestamp = nowIso()
  const direction = partial.direction ?? 'long'
  const entryPrice = partial.entry_price ?? null
  const exitPrice = partial.exit_price ?? null
  const positionSize = partial.position_size ?? 1
  const pnl = partial.pnl ?? calculatePnl(direction, entryPrice, exitPrice, positionSize)

  return {
    id: partial.id ?? `entry-${Math.random().toString(36).slice(2, 10)}`,
    user_id: partial.user_id ?? E2E_USER_ID,
    trade_date: partial.trade_date ?? timestamp,
    symbol: (partial.symbol ?? 'SPY').toUpperCase(),
    direction,
    contract_type: partial.contract_type ?? 'stock',
    entry_price: entryPrice,
    exit_price: exitPrice,
    position_size: positionSize,
    pnl,
    pnl_percentage: partial.pnl_percentage ?? calculatePnlPercentage(direction, entryPrice, exitPrice),
    is_winner: partial.is_winner ?? (pnl == null ? null : pnl > 0),
    is_open: partial.is_open ?? false,
    entry_timestamp: partial.entry_timestamp ?? null,
    exit_timestamp: partial.exit_timestamp ?? null,
    stop_loss: partial.stop_loss ?? null,
    initial_target: partial.initial_target ?? null,
    hold_duration_min: partial.hold_duration_min ?? null,
    mfe_percent: partial.mfe_percent ?? null,
    mae_percent: partial.mae_percent ?? null,
    strike_price: partial.strike_price ?? null,
    expiration_date: partial.expiration_date ?? null,
    dte_at_entry: partial.dte_at_entry ?? null,
    iv_at_entry: partial.iv_at_entry ?? null,
    delta_at_entry: partial.delta_at_entry ?? null,
    theta_at_entry: partial.theta_at_entry ?? null,
    gamma_at_entry: partial.gamma_at_entry ?? null,
    vega_at_entry: partial.vega_at_entry ?? null,
    underlying_at_entry: partial.underlying_at_entry ?? null,
    underlying_at_exit: partial.underlying_at_exit ?? null,
    mood_before: partial.mood_before ?? null,
    mood_after: partial.mood_after ?? null,
    discipline_score: partial.discipline_score ?? null,
    followed_plan: partial.followed_plan ?? null,
    deviation_notes: partial.deviation_notes ?? null,
    strategy: partial.strategy ?? null,
    setup_notes: partial.setup_notes ?? null,
    execution_notes: partial.execution_notes ?? null,
    lessons_learned: partial.lessons_learned ?? null,
    tags: partial.tags ?? [],
    rating: partial.rating ?? null,
    screenshot_url: partial.screenshot_url ?? null,
    screenshot_storage_path: partial.screenshot_storage_path ?? null,
    ai_analysis: partial.ai_analysis ?? null,
    market_context: null,
    import_id: partial.import_id ?? null,
    is_favorite: partial.is_favorite ?? false,
    created_at: partial.created_at ?? timestamp,
    updated_at: partial.updated_at ?? timestamp,
  }
}

export async function enableMemberBypass(page: Page): Promise<void> {
  await authenticateAsMember(page, { bypassMiddleware: true })
  await page.context().addCookies([
    {
      name: 'e2e_bypass_auth',
      value: '1',
      domain: '127.0.0.1',
      path: '/',
    },
    {
      name: 'e2e_bypass_auth',
      value: '1',
      domain: 'localhost',
      path: '/',
    },
  ])
}

export async function setupMemberShellMocks(page: Page): Promise<void> {
  await page.route('**/api/config/roles*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.route('**/api/config/tabs*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'home', path: '/members' },
          { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'book', path: '/members/journal' },
          { tab_id: 'library', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 3, label: 'Library', icon: 'book-open', path: '/members/library' },
          { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 4, label: 'Profile', icon: 'user', path: '/members/profile' },
        ],
      }),
    })
  })
}

function applyQueryFilters(entries: MockJournalEntry[], url: URL): MockJournalEntry[] {
  let filtered = [...entries]

  const startDate = url.searchParams.get('startDate')
  const endDate = url.searchParams.get('endDate')
  const symbol = url.searchParams.get('symbol')
  const direction = url.searchParams.get('direction')
  const contractType = url.searchParams.get('contractType')
  const isWinner = url.searchParams.get('isWinner')
  const isOpen = url.searchParams.get('isOpen')
  const tags = url.searchParams.get('tags')

  if (startDate) {
    const start = new Date(startDate).getTime()
    filtered = filtered.filter((entry) => new Date(entry.trade_date).getTime() >= start)
  }

  if (endDate) {
    const end = new Date(endDate).getTime()
    filtered = filtered.filter((entry) => new Date(entry.trade_date).getTime() <= end)
  }

  if (symbol) {
    const upper = symbol.trim().toUpperCase()
    filtered = filtered.filter((entry) => entry.symbol.includes(upper))
  }

  if (direction === 'long' || direction === 'short') {
    filtered = filtered.filter((entry) => entry.direction === direction)
  }

  if (contractType === 'stock' || contractType === 'call' || contractType === 'put') {
    filtered = filtered.filter((entry) => entry.contract_type === contractType)
  }

  if (isWinner === 'true' || isWinner === 'false') {
    const winnerFlag = isWinner === 'true'
    filtered = filtered.filter((entry) => entry.is_winner === winnerFlag)
  }

  if (isOpen === 'true' || isOpen === 'false') {
    const openFlag = isOpen === 'true'
    filtered = filtered.filter((entry) => entry.is_open === openFlag)
  }

  if (tags) {
    const tagSet = new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))
    if (tagSet.size > 0) {
      filtered = filtered.filter((entry) => entry.tags.some((tag) => tagSet.has(tag)))
    }
  }

  const sortBy = url.searchParams.get('sortBy') ?? 'trade_date'
  const sortDir = url.searchParams.get('sortDir') ?? 'desc'

  filtered.sort((a, b) => {
    const multiplier = sortDir === 'asc' ? 1 : -1

    if (sortBy === 'symbol') {
      return a.symbol.localeCompare(b.symbol) * multiplier
    }

    if (sortBy === 'pnl') {
      const left = a.pnl ?? 0
      const right = b.pnl ?? 0
      return (left - right) * multiplier
    }

    return (new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()) * multiplier
  })

  return filtered
}

export async function setupJournalCrudMocks(
  page: Page,
  initialEntries: MockJournalEntry[] = [],
): Promise<JournalMockState> {
  const state: JournalMockState = {
    entries: [...initialEntries],
    nextId: initialEntries.length + 1,
    importKeys: new Set<string>(),
  }

  await page.route('**/api/members/journal**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname !== '/api/members/journal') {
      await route.fallback()
      return
    }

    if (request.method() === 'GET') {
      const filtered = applyQueryFilters(state.entries, url)
      const total = filtered.length

      const limit = Number(url.searchParams.get('limit') ?? '100')
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const safeLimit = Number.isFinite(limit) ? Math.min(500, Math.max(1, Math.round(limit))) : 100
      const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.round(offset)) : 0

      const paged = filtered.slice(safeOffset, safeOffset + safeLimit)

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: paged,
          total,
          streaks: {
            current_streak: total > 0 ? 2 : 0,
            longest_streak: total > 0 ? 5 : 0,
          },
        }),
      })
      return
    }

    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>
      const timestamp = nowIso()
      const id = `entry-${state.nextId++}`
      const direction = body.direction === 'short' ? 'short' : 'long'
      const entryPrice = toNumber(body.entry_price)
      const exitPrice = toNumber(body.exit_price)
      const positionSize = toNumber(body.position_size)

      const pnl = toNumber(body.pnl) ?? calculatePnl(direction, entryPrice, exitPrice, positionSize)
      const pnlPercentage = toNumber(body.pnl_percentage) ?? calculatePnlPercentage(direction, entryPrice, exitPrice)

      const created = createMockEntry({
        id,
        user_id: E2E_USER_ID,
        trade_date: typeof body.trade_date === 'string' ? body.trade_date : timestamp,
        symbol: typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : 'UNKNOWN',
        direction,
        contract_type: body.contract_type === 'call' || body.contract_type === 'put' ? body.contract_type : 'stock',
        entry_price: entryPrice,
        exit_price: exitPrice,
        position_size: positionSize,
        pnl,
        pnl_percentage: pnlPercentage,
        is_open: toBoolean(body.is_open, false),
        strategy: typeof body.strategy === 'string' && body.strategy.trim().length > 0 ? body.strategy.trim() : null,
        setup_notes: typeof body.setup_notes === 'string' && body.setup_notes.trim().length > 0 ? body.setup_notes.trim() : null,
        execution_notes: typeof body.execution_notes === 'string' && body.execution_notes.trim().length > 0 ? body.execution_notes.trim() : null,
        lessons_learned: typeof body.lessons_learned === 'string' && body.lessons_learned.trim().length > 0 ? body.lessons_learned.trim() : null,
        screenshot_url: typeof body.screenshot_url === 'string' && body.screenshot_url.trim().length > 0
          ? body.screenshot_url.trim()
          : null,
        screenshot_storage_path: typeof body.screenshot_storage_path === 'string' && body.screenshot_storage_path.trim().length > 0
          ? body.screenshot_storage_path.trim()
          : null,
        tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)).filter(Boolean) : [],
        created_at: timestamp,
        updated_at: timestamp,
      })

      state.entries.unshift(created)

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: created }),
      })
      return
    }

    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>
      const id = typeof body.id === 'string' ? body.id : ''
      const index = state.entries.findIndex((entry) => entry.id === id)

      if (index < 0) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Entry not found' }),
        })
        return
      }

      const existing = state.entries[index]
      const direction = body.direction === 'short' || body.direction === 'long'
        ? body.direction
        : existing.direction
      const entryPrice = toNumber(body.entry_price ?? existing.entry_price)
      const exitPrice = toNumber(body.exit_price ?? existing.exit_price)
      const positionSize = toNumber(body.position_size ?? existing.position_size)

      const nextPnl = Object.prototype.hasOwnProperty.call(body, 'pnl')
        ? toNumber(body.pnl)
        : calculatePnl(direction, entryPrice, exitPrice, positionSize)

      const nextPnlPercentage = Object.prototype.hasOwnProperty.call(body, 'pnl_percentage')
        ? toNumber(body.pnl_percentage)
        : calculatePnlPercentage(direction, entryPrice, exitPrice)

      const updated: MockJournalEntry = {
        ...existing,
        ...body,
        symbol: typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : existing.symbol,
        direction,
        contract_type: body.contract_type === 'call' || body.contract_type === 'put' || body.contract_type === 'stock'
          ? body.contract_type
          : existing.contract_type,
        entry_price: entryPrice,
        exit_price: exitPrice,
        position_size: positionSize,
        pnl: nextPnl,
        pnl_percentage: nextPnlPercentage,
        is_winner: nextPnl == null ? null : nextPnl > 0,
        is_open: Object.prototype.hasOwnProperty.call(body, 'is_open') ? toBoolean(body.is_open) : existing.is_open,
        is_favorite: Object.prototype.hasOwnProperty.call(body, 'is_favorite') ? toBoolean(body.is_favorite) : existing.is_favorite,
        mood_before: (body.mood_before as MockJournalEntry['mood_before']) ?? existing.mood_before,
        mood_after: (body.mood_after as MockJournalEntry['mood_after']) ?? existing.mood_after,
        discipline_score: toNumber(body.discipline_score) ?? existing.discipline_score,
        followed_plan: Object.prototype.hasOwnProperty.call(body, 'followed_plan') ? toBoolean(body.followed_plan) : existing.followed_plan,
        tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)).filter(Boolean) : existing.tags,
        updated_at: nowIso(),
      }

      state.entries[index] = updated

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: updated }),
      })
      return
    }

    if (request.method() === 'DELETE') {
      const id = url.searchParams.get('id')
      state.entries = state.entries.filter((entry) => entry.id !== id)

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
      return
    }

    await route.fulfill({
      status: 405,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    })
  })

  return state
}

// ---------------------------------------------------------------------------
// AI Grade Factories & Mocks
// ---------------------------------------------------------------------------

export type MockAIAnalysis = {
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  entry_quality: string
  exit_quality: string
  risk_management: string
  lessons: string[]
  scored_at: string
}

export function createMockAIAnalysis(grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'B'): MockAIAnalysis {
  const lessons: Record<string, string[]> = {
    A: ['Excellent entry timing', 'Strong risk/reward discipline'],
    B: ['Good entry with minor timing slip', 'Solid exit near target'],
    C: ['Average timing', 'Consider tighter stops'],
    D: ['Late entry reduced R:R', 'Exit was panic-driven'],
    F: ['Entered against trend', 'No stop loss placed'],
  }

  return {
    grade,
    entry_quality: `${grade}-level entry quality. Entered ${grade === 'A' ? 'at optimal level' : 'with room for improvement'}.`,
    exit_quality: `Exit was ${grade <= 'B' ? 'well-timed' : 'suboptimal'}. Managed risk ${grade <= 'C' ? 'adequately' : 'poorly'}.`,
    risk_management: `Risk management rated ${grade}. Position sizing was ${grade <= 'B' ? 'appropriate' : 'oversized'}.`,
    lessons: lessons[grade] ?? ['Review trade plan adherence'],
    scored_at: new Date().toISOString(),
  }
}

export function createMockDraftEntry(partial: Partial<MockJournalEntry> = {}): MockJournalEntry {
  return createMockEntry({
    ...partial,
    is_open: true,
    exit_price: null,
    pnl: null,
    pnl_percentage: null,
    is_winner: null,
  })
}

export function createMockFavoriteEntry(partial: Partial<MockJournalEntry> = {}): MockJournalEntry {
  return createMockEntry({
    is_favorite: true,
    ...partial,
  })
}

// ---------------------------------------------------------------------------
// Analytics Mocks
// ---------------------------------------------------------------------------

export interface MockAnalyticsPayload {
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number
  total_pnl: number
  avg_pnl: number
  expectancy: number
  profit_factor: number
  sharpe_ratio: number
  sortino_ratio: number
  max_drawdown: number
  equity_curve: Array<{ date: string; cumulative_pnl: number; drawdown: number }>
  monthly_pnl: Array<{ month: string; pnl: number }>
  symbol_stats: Array<{ symbol: string; trades: number; pnl: number; win_rate: number }>
  direction_stats: Array<{ direction: string; trades: number; pnl: number; win_rate: number }>
  hourly_pnl: Array<{ hour: number; pnl: number; count: number }>
  day_of_week_pnl: Array<{ day: string; pnl: number; count: number }>
  r_multiple_distribution: Array<{ bucket: string; count: number }>
  mfe_mae_scatter: Array<{ mfe: number; mae: number; pnl: number }>
}

export function createMockAnalyticsPayload(tradeCount = 30): MockAnalyticsPayload {
  const winRate = 0.62
  const winCount = Math.round(tradeCount * winRate)
  const loseCount = tradeCount - winCount

  const curve: MockAnalyticsPayload['equity_curve'] = []
  let cumPnl = 0
  let peak = 0
  for (let i = 0; i < tradeCount; i++) {
    const isWin = i < winCount
    const delta = isWin ? 50 + Math.random() * 100 : -(30 + Math.random() * 80)
    cumPnl += delta
    peak = Math.max(peak, cumPnl)
    curve.push({
      date: `2026-02-${String((i % 28) + 1).padStart(2, '0')}`,
      cumulative_pnl: Math.round(cumPnl * 100) / 100,
      drawdown: peak > 0 ? Math.round(((peak - cumPnl) / peak) * 10000) / 100 : 0,
    })
  }

  return {
    total_trades: tradeCount,
    winning_trades: winCount,
    losing_trades: loseCount,
    win_rate: winRate,
    total_pnl: Math.round(cumPnl * 100) / 100,
    avg_pnl: Math.round((cumPnl / tradeCount) * 100) / 100,
    expectancy: Math.round((cumPnl / tradeCount) * 100) / 100,
    profit_factor: 1.8,
    sharpe_ratio: 1.2,
    sortino_ratio: 1.5,
    max_drawdown: 8.5,
    equity_curve: curve,
    monthly_pnl: [
      { month: '2026-01', pnl: 450 },
      { month: '2026-02', pnl: Math.round(cumPnl - 450) },
    ],
    symbol_stats: [
      { symbol: 'SPY', trades: 15, pnl: 320, win_rate: 0.67 },
      { symbol: 'AAPL', trades: 8, pnl: 180, win_rate: 0.63 },
      { symbol: 'TSLA', trades: 7, pnl: -50, win_rate: 0.43 },
    ],
    direction_stats: [
      { direction: 'long', trades: 20, pnl: 600, win_rate: 0.65 },
      { direction: 'short', trades: 10, pnl: -150, win_rate: 0.5 },
    ],
    hourly_pnl: [
      { hour: 9, pnl: 200, count: 8 },
      { hour: 10, pnl: 150, count: 6 },
      { hour: 14, pnl: -80, count: 5 },
    ],
    day_of_week_pnl: [
      { day: 'Mon', pnl: 100, count: 6 },
      { day: 'Tue', pnl: 200, count: 7 },
      { day: 'Wed', pnl: -50, count: 5 },
      { day: 'Thu', pnl: 80, count: 6 },
      { day: 'Fri', pnl: 120, count: 6 },
    ],
    r_multiple_distribution: [
      { bucket: '<-2R', count: 2 },
      { bucket: '-2R to -1R', count: 5 },
      { bucket: '-1R to 0R', count: 4 },
      { bucket: '0R to 1R', count: 6 },
      { bucket: '1R to 2R', count: 8 },
      { bucket: '>2R', count: 5 },
    ],
    mfe_mae_scatter: [
      { mfe: 2.5, mae: -0.5, pnl: 120 },
      { mfe: 1.0, mae: -1.5, pnl: -60 },
      { mfe: 3.0, mae: -0.3, pnl: 200 },
    ],
  }
}

export interface MockBiasPayload {
  signals: Array<{
    label: string
    description: string
    confidence: number
    evidence: string
    recommendation: string
  }>
  analysis_period_days: number
  trade_count: number
}

export function createMockBiasPayload(): MockBiasPayload {
  return {
    signals: [
      {
        label: 'Loss Aversion',
        description: 'You tend to hold losing trades longer than winning trades.',
        confidence: 0.75,
        evidence: 'Average hold time for losers (45min) is 2x winners (22min).',
        recommendation: 'Set time-based exit rules for losing positions.',
      },
      {
        label: 'Recency Bias',
        description: 'Recent trade outcomes are influencing position sizing.',
        confidence: 0.55,
        evidence: 'Position sizes increased 30% after a 3-trade win streak.',
        recommendation: 'Use fixed position sizing rules regardless of recent outcomes.',
      },
    ],
    analysis_period_days: 30,
    trade_count: 30,
  }
}

export interface MockSetupPerformancePayload {
  setups: Array<{
    setup_type: string
    trades: number
    win_rate: number
    avg_pnl: number
    total_pnl: number
  }>
  regimes: Array<{
    regime: string
    trades: number
    win_rate: number
    avg_pnl: number
  }>
}

export function createMockSetupPerformancePayload(): MockSetupPerformancePayload {
  return {
    setups: [
      { setup_type: 'Breakout', trades: 12, win_rate: 0.75, avg_pnl: 85, total_pnl: 1020 },
      { setup_type: 'Pullback', trades: 8, win_rate: 0.63, avg_pnl: 45, total_pnl: 360 },
      { setup_type: 'Reversal', trades: 5, win_rate: 0.4, avg_pnl: -20, total_pnl: -100 },
    ],
    regimes: [
      { regime: 'Low VIX (calm)', trades: 15, win_rate: 0.73, avg_pnl: 65 },
      { regime: 'Trending Up', trades: 10, win_rate: 0.7, avg_pnl: 55 },
      { regime: 'High VIX (elevated)', trades: 5, win_rate: 0.4, avg_pnl: -30 },
    ],
  }
}

export async function setupJournalAnalyticsMocks(page: Page): Promise<void> {
  const analyticsPayload = createMockAnalyticsPayload()
  const biasPayload = createMockBiasPayload()

  await page.route('**/api/members/journal/analytics**', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: analyticsPayload }),
    })
  })

  await page.route('**/api/members/journal/biases**', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: biasPayload }),
    })
  })
}

export async function setupJournalGradeMock(
  page: Page,
  analysisOverride?: MockAIAnalysis,
): Promise<void> {
  await page.route('**/api/members/journal/grade', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    const body = route.request().postDataJSON() as { entryIds?: string[] }
    const entryIds = Array.isArray(body.entryIds) ? body.entryIds : []
    const analysis = analysisOverride ?? createMockAIAnalysis('B')

    const data = entryIds.map((id) => ({
      id,
      ai_analysis: analysis,
      grade: analysis.grade,
    }))

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    })
  })
}

export async function setupJournalGradeMockError(page: Page): Promise<void> {
  await page.route('**/api/members/journal/grade', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'AI grading service unavailable' }),
    })
  })
}

export async function setupSetupPerformanceMock(page: Page): Promise<void> {
  const payload = createMockSetupPerformancePayload()

  await page.route('**/api/members/journal/context**', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: payload }),
    })
  })
}

// ---------------------------------------------------------------------------
// Import Mocks
// ---------------------------------------------------------------------------

export async function setupJournalImportMock(page: Page, state: JournalMockState): Promise<void> {
  await page.route('**/api/members/journal/import', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) })
      return
    }

    const body = route.request().postDataJSON() as {
      broker: string
      fileName: string
      rows: Array<Record<string, string>>
    }

    const rows = Array.isArray(body.rows) ? body.rows : []

    let inserted = 0
    let duplicates = 0
    let errors = 0

    for (const row of rows) {
      const symbol = String(
        row.symbol
        ?? row.Symbol
        ?? row.Ticker
        ?? row['Ticker Symbol']
        ?? row.underlying
        ?? row.Underlying
        ?? row['Underlying Symbol']
        ?? row['Security Symbol']
        ?? row.Name
        ?? row.name
        ?? row.Instrument
        ?? '',
      ).trim().toUpperCase()
      const date = String(row.trade_date ?? row.entry_date ?? row.Date ?? '').trim() || nowIso().slice(0, 10)
      const entryPriceRaw = row.entry_price ?? row.entryPrice ?? row['Entry Price'] ?? ''
      const entryPrice = Number(entryPriceRaw)
      const priceBucket = Number.isFinite(entryPrice) ? entryPrice.toFixed(2) : 'na'
      const dedupeKey = `${symbol}:${date}:${priceBucket}`

      if (!symbol) {
        errors += 1
        continue
      }

      if (state.importKeys.has(dedupeKey)) {
        duplicates += 1
        continue
      }

      state.importKeys.add(dedupeKey)
      inserted += 1

      state.entries.unshift(createMockEntry({
        id: `entry-${state.nextId++}`,
        symbol,
        trade_date: new Date(`${date}T14:30:00.000Z`).toISOString(),
        entry_price: Number.isFinite(entryPrice) ? entryPrice : null,
        exit_price: null,
        position_size: 1,
        pnl: null,
        is_open: true,
      }))
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          importId: `import-${Date.now()}`,
          inserted,
          duplicates,
          errors,
        },
      }),
    })
  })
}
