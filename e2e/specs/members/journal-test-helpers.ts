import type { Page, Route } from '@playwright/test'

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
  await page.setExtraHTTPHeaders({
    'x-e2e-bypass-auth': '1',
  })
}

export async function setupMemberShellMocks(page: Page): Promise<void> {
  await page.route('**/api/config/roles', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.route('**/api/config/tabs', async (route: Route) => {
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
      const symbol = String(row.symbol ?? row.Symbol ?? '').trim().toUpperCase()
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
