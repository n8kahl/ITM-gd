/**
 * AI Coach Backend API Client
 *
 * Calls the Express backend (port 3001) for chat, sessions, and market data.
 * Uses Supabase JWT for authentication.
 */

function resolveApiBase(): string {
  const configured = (
    process.env.NEXT_PUBLIC_AI_COACH_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  ).trim()

  let resolved = configured || 'http://localhost:3001'

  // Ensure the URL has a protocol so fetch() treats it as absolute.
  if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) {
    resolved = `https://${resolved}`
  }

  const isLocalHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname.toLowerCase())

  // Local host should default to local backend even if production URL is set in .env.local.
  const preferLocalInDev = process.env.NEXT_PUBLIC_FORCE_REMOTE_AI_COACH !== 'true'
  if (
    isLocalHost &&
    preferLocalInDev &&
    /railway\.app/i.test(resolved)
  ) {
    return 'http://localhost:3001'
  }

  return resolved.replace(/\/+$/, '')
}

export const API_BASE = resolveApiBase()

// Log resolved URL once at module load for debugging
if (typeof window !== 'undefined') {
  console.log('[AI Coach] API_BASE:', API_BASE)
}

// ============================================
// TYPES
// ============================================

export interface ChatMessageResponse {
  sessionId: string
  messageId: string
  role: 'assistant'
  content: string
  functionCalls?: Array<{
    function: string
    arguments: Record<string, unknown>
    result: unknown
  }>
  contractAudit?: {
    passed: boolean
    intents: string[]
    symbols: string[]
    requiredFunctions: string[]
    calledFunctions: string[]
    blockingViolations: string[]
    warnings: string[]
  }
  tokensUsed: number
  responseTime: number
}

export interface ChatSession {
  id: string
  title: string
  message_count: number
  created_at: string
  updated_at: string
  expires_at?: string | null
}

export type ChartTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D'

export interface ChartBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ChartIndicatorPoint {
  time: number
  value: number
}

export interface ChartMACDPoint extends ChartIndicatorPoint {
  signal: number
  histogram: number
}

export interface ChartProviderIndicators {
  source: 'massive'
  timespan: 'minute' | 'hour' | 'day' | 'week' | 'month'
  ema8: ChartIndicatorPoint[]
  ema21: ChartIndicatorPoint[]
  rsi14: ChartIndicatorPoint[]
  macd: ChartMACDPoint[]
}

export interface ChartDataResponse {
  symbol: string
  timeframe: ChartTimeframe
  bars: ChartBar[]
  count: number
  timestamp: string
  cached: boolean
  providerIndicators?: ChartProviderIndicators
}

export type FibonacciTimeframe = 'daily' | '1h' | '15m' | '5m'

export interface FibonacciLevelsResponse {
  symbol: string
  timeframe: FibonacciTimeframe
  direction: 'retracement' | 'extension'
  levels: {
    level_0: number
    level_236: number
    level_382: number
    level_500: number
    level_618: number
    level_786: number
    level_100: number
  }
  currentPrice: number
  calculatedAt: string
}

export type SymbolSearchType = 'index' | 'etf' | 'stock'

export interface SymbolSearchItem {
  symbol: string
  name: string
  type: SymbolSearchType
  exchange: string | null
}

export interface SymbolSearchResponse {
  results: SymbolSearchItem[]
}

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  functionCalls?: Array<{
    function: string
    arguments: Record<string, unknown>
    result: unknown
  }>
  tokensUsed?: number
  timestamp: string
}

export interface SessionMessagesResponse {
  messages: SessionMessage[]
  total: number
  hasMore: boolean
}

// ============================================
// OPTIONS TYPES
// ============================================

export interface OptionContract {
  strike: number
  last: number
  bid: number
  ask: number
  volume: number
  openInterest: number
  impliedVolatility: number
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  rho: number | null
  inTheMoney: boolean
  intrinsicValue: number
  extrinsicValue: number
}

export interface OptionsChainResponse {
  symbol: string
  currentPrice: number
  expiry: string
  daysToExpiry: number
  ivRank: number
  options: {
    calls: OptionContract[]
    puts: OptionContract[]
  }
}

export interface ExpirationsResponse {
  symbol: string
  expirations: string[]
  count: number
}

export interface OptionsMatrixCellMetrics {
  volume: number
  openInterest: number
  impliedVolatility: number | null
  gex: number
}

export interface OptionsMatrixCell {
  expiry: string
  strike: number
  call: OptionContract | null
  put: OptionContract | null
  metrics: OptionsMatrixCellMetrics
}

export interface OptionsMatrixResponse {
  symbol: string
  currentPrice: number
  expirations: string[]
  strikes: number[]
  cells: OptionsMatrixCell[]
  generatedAt: string
  cacheKey: string
}

export interface GEXStrikeData {
  strike: number
  gexValue: number
  callGamma: number
  putGamma: number
  callOI: number
  putOI: number
}

export interface GEXKeyLevel {
  strike: number
  gexValue: number
  type: 'support' | 'resistance' | 'magnet'
}

export interface GEXProfileResponse {
  symbol: string
  spotPrice: number
  gexByStrike: GEXStrikeData[]
  flipPoint: number | null
  maxGEXStrike: number | null
  keyLevels: GEXKeyLevel[]
  regime: 'positive_gamma' | 'negative_gamma'
  implication: string
  calculatedAt: string
  expirationsAnalyzed: string[]
}

export interface ZeroDTEExpectedMove {
  totalExpectedMove: number
  usedMove: number
  usedPct: number
  remainingMove: number
  remainingPct: number
  minutesLeft: number
  openPrice: number
  currentPrice: number
  atmStrike: number | null
}

export interface ZeroDTEThetaProjection {
  time: string
  estimatedValue: number
  thetaDecay: number
  pctRemaining: number
}

export interface ZeroDTEThetaClock {
  strike: number
  type: 'call' | 'put'
  currentValue: number
  thetaPerDay: number
  projections: ZeroDTEThetaProjection[]
}

export interface ZeroDTEGammaProfile {
  strike: number
  type: 'call' | 'put'
  currentDelta: number
  gammaPerDollar: number
  dollarDeltaChangePerPoint: number
  leverageMultiplier: number
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme'
}

export interface ZeroDTEContractSnapshot {
  strike: number
  type: 'call' | 'put'
  last: number
  volume: number
  openInterest: number
  gamma: number | null
  theta: number | null
}

export interface ZeroDTEAnalysisResponse {
  symbol: string
  marketDate: string
  hasZeroDTE: boolean
  message: string
  expectedMove: ZeroDTEExpectedMove | null
  thetaClock: ZeroDTEThetaClock | null
  gammaProfile: ZeroDTEGammaProfile | null
  topContracts: ZeroDTEContractSnapshot[]
}

export interface IVRankAnalysis {
  currentIV: number | null
  ivRank: number | null
  ivPercentile: number | null
  iv52wkHigh: number | null
  iv52wkLow: number | null
  ivTrend: 'rising' | 'falling' | 'stable' | 'unknown'
}

export interface IVSkewAnalysis {
  skew25delta: number | null
  skew10delta: number | null
  skewDirection: 'put_heavy' | 'call_heavy' | 'balanced' | 'unknown'
  interpretation: string
}

export interface IVTermStructurePoint {
  date: string
  dte: number
  atmIV: number
}

export interface IVAnalysisResponse {
  symbol: string
  currentPrice: number
  asOf: string
  ivRank: IVRankAnalysis
  skew: IVSkewAnalysis
  termStructure: {
    expirations: IVTermStructurePoint[]
    shape: 'contango' | 'backwardation' | 'flat'
    inversionPoint?: string
  }
}

export interface EarningsCalendarEvent {
  symbol: string
  date: string
  time: 'BMO' | 'AMC' | 'DURING'
  confirmed: boolean
  name?: string | null
  epsEstimate?: number | null
  revenueEstimate?: number | null
  source?: 'massive_reference' | 'alpha_vantage' | 'tmx_corporate_events'
}

export interface EarningsCalendarResponse {
  watchlist: string[]
  daysAhead: number
  count: number
  events: EarningsCalendarEvent[]
}

export interface EarningsHistoricalMove {
  date: string
  expectedMove: number
  actualMove: number
  direction: 'up' | 'down'
  surprise: 'beat' | 'miss' | 'in-line' | 'unknown'
}

export interface EarningsStrategy {
  name: string
  description: string
  setup: Record<string, unknown>
  riskReward: string
  bestWhen: string
  expectedMaxLoss: string
  expectedMaxGain: string
  probability: number
}

export interface EarningsAnalysisResponse {
  symbol: string
  earningsDate: string | null
  daysUntil: number | null
  expectedMove: {
    points: number
    pct: number
  }
  historicalMoves: EarningsHistoricalMove[]
  avgHistoricalMove: number
  moveOverpricing: number
  currentIV: number | null
  preEarningsIVRank: number | null
  projectedIVCrushPct: number | null
  straddlePricing: {
    atmStraddle: number
    referenceExpiry: string | null
    assessment: 'overpriced' | 'underpriced' | 'fair'
  }
  suggestedStrategies: EarningsStrategy[]
  asOf: string
}

export type PositionType = 'call' | 'put' | 'stock'

export interface PositionInput {
  symbol: string
  type: PositionType
  strike?: number
  expiry?: string
  quantity: number
  entryPrice: number
  entryDate: string
}

export interface PositionAnalysis {
  position: PositionInput
  currentValue: number
  costBasis: number
  pnl: number
  pnlPct: number
  daysHeld: number
  daysToExpiry: number
  breakeven: number | null
  maxGain: number | string
  maxLoss: number | string
  riskRewardRatio?: number
  greeks: {
    delta: number
    gamma: number
    theta: number
    vega: number
    rho?: number
  }
}

export type PositionAdviceType = 'take_profit' | 'stop_loss' | 'time_decay'
export type PositionAdviceUrgency = 'low' | 'medium' | 'high'

export interface PositionAdvice {
  positionId: string
  type: PositionAdviceType
  urgency: PositionAdviceUrgency
  message: string
  suggestedAction: Record<string, unknown>
}

export interface PositionLiveSnapshot {
  id: string
  symbol: string
  type: PositionType
  strike?: number
  expiry?: string
  quantity: number
  entryPrice: number
  entryDate: string
  currentPrice: number
  currentValue: number
  costBasis: number
  pnl: number
  pnlPct: number
  daysHeld: number
  daysToExpiry?: number
  breakeven?: number
  maxGain?: number | string
  maxLoss?: number | string
  riskRewardRatio?: number
  greeks?: {
    delta: number
    gamma: number
    theta: number
    vega: number
    rho?: number
  }
  updatedAt: string
}

export interface LivePositionsResponse {
  positions: PositionLiveSnapshot[]
  count: number
  timestamp: string
}

export interface PositionAdviceResponse {
  advice: PositionAdvice[]
  count: number
  generatedAt: string
}

export interface PortfolioAnalysis {
  positions: PositionAnalysis[]
  portfolio: {
    totalValue: number
    totalCostBasis: number
    totalPnl: number
    totalPnlPct: number
    portfolioGreeks: {
      delta: number
      gamma: number
      theta: number
      vega: number
    }
    risk: {
      maxLoss: number | string
      maxGain: number | string
      buyingPowerUsed?: number
    }
    riskAssessment: {
      overall: string
      warnings: string[]
    }
  }
}

export interface APIError {
  error: string
  message: string
  queryCount?: number
  queryLimit?: number
  resetDate?: string
  retryAfter?: number
}

// ============================================
// HELPERS
// ============================================

/**
 * Enhanced fetch with automatic 401 retry
 * On 401, attempts to refresh the session before retrying once.
 */
async function fetchWithAuth(
  url: string,
  options: RequestInit & { headers: Record<string, string> },
  token: string,
  signal?: AbortSignal
): Promise<Response> {
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  }

  const response = await fetch(url, { ...options, headers, signal })

  if (response.status === 401) {
    // Token might be expired - throw specific error so hook can handle refresh
    const error: APIError = await response.json().catch(() => ({
      error: 'Unauthorized',
      message: 'Session expired. Please sign in again.',
    }))
    throw new AICoachAPIError(401, error)
  }

  return response
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Send a chat message and receive AI response
 */
export async function sendMessage(
  sessionId: string | undefined,
  message: string,
  token: string,
  signal?: AbortSignal
): Promise<ChatMessageResponse> {
  const payload: { message: string; sessionId?: string } = { message }
  if (sessionId && sessionId.trim().length > 0) {
    payload.sessionId = sessionId
  }

  const response = await fetchWithAuth(
    `${API_BASE}/api/chat/message`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token,
    signal
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Send a chat message without requiring an existing session (backend auto-creates one)
 */
export async function sendChatMessage(
  message: string,
  token: string
): Promise<ChatMessageResponse> {
  return sendMessage(undefined, message, token)
}

/**
 * Get user's chat sessions
 */
export async function getSessions(
  token: string,
  limit: number = 10,
  signal?: AbortSignal
): Promise<{ sessions: ChatSession[]; count: number }> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/chat/sessions?limit=${limit}`,
    { headers: {} },
    token,
    signal
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Delete a chat session
 */
export async function deleteSession(
  sessionId: string,
  token: string,
  signal?: AbortSignal
): Promise<{ success: boolean; message: string }> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/chat/sessions/${sessionId}`,
    { method: 'DELETE', headers: {} },
    token,
    signal
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Get messages for a specific session
 */
export async function getSessionMessages(
  sessionId: string,
  token: string,
  limit: number = 50,
  offset: number = 0,
  signal?: AbortSignal
): Promise<SessionMessagesResponse> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/chat/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`,
    { headers: {} },
    token,
    signal
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Get chart OHLCV data for a symbol
 */
export async function getChartData(
  symbol: string,
  timeframe: ChartTimeframe,
  token: string,
  signal?: AbortSignal,
  options?: {
    includeIndicators?: boolean
  },
): Promise<ChartDataResponse> {
  const params = new URLSearchParams({ timeframe })
  if (options?.includeIndicators) {
    params.set('includeIndicators', 'true')
  }

  const response = await fetchWithAuth(
    `${API_BASE}/api/chart/${symbol}?${params.toString()}`,
    { headers: {} },
    token,
    signal
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Get Fibonacci retracement levels for a symbol.
 */
export async function getFibonacciLevels(
  symbol: string,
  timeframe: FibonacciTimeframe,
  token: string,
  lookback: number = 20,
  signal?: AbortSignal,
): Promise<FibonacciLevelsResponse> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/fibonacci`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol,
        timeframe,
        lookback,
      }),
    },
    token,
    signal,
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Search symbols for autocomplete workflows.
 */
export async function searchSymbols(
  query: string,
  token: string,
  limit: number = 20,
  signal?: AbortSignal
): Promise<SymbolSearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  const response = await fetchWithAuth(
    `${API_BASE}/api/symbols/search?${params}`,
    { headers: {} },
    token,
    signal
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

// ============================================
// OPTIONS API FUNCTIONS
// ============================================

/**
 * Get options chain for a symbol
 */
export async function getOptionsChain(
  symbol: string,
  token: string,
  expiry?: string,
  strikeRange: number = 10
): Promise<OptionsChainResponse> {
  const params = new URLSearchParams({ strikeRange: strikeRange.toString() })
  if (expiry) params.set('expiry', expiry)

  const response = await fetch(
    `${API_BASE}/api/options/${symbol}/chain?${params}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Get available expiration dates for a symbol
 */
export async function getExpirations(
  symbol: string,
  token: string
): Promise<ExpirationsResponse> {
  const response = await fetch(
    `${API_BASE}/api/options/${symbol}/expirations`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Get multi-expiration options matrix for heatmap workflows.
 */
export async function getOptionsMatrix(
  symbol: string,
  token: string,
  options?: {
    expirations?: number
    strikes?: number
  }
): Promise<OptionsMatrixResponse> {
  const params = new URLSearchParams()
  if (typeof options?.expirations === 'number') params.set('expirations', String(options.expirations))
  if (typeof options?.strikes === 'number') params.set('strikes', String(options.strikes))

  const query = params.toString()
  const url = `${API_BASE}/api/options/${symbol}/matrix${query ? `?${query}` : ''}`

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Get gamma exposure profile for an options symbol
 */
export async function getGammaExposure(
  symbol: string,
  token: string,
  options?: {
    expiry?: string
    strikeRange?: number
    maxExpirations?: number
    forceRefresh?: boolean
  }
): Promise<GEXProfileResponse> {
  const params = new URLSearchParams()
  if (options?.expiry) params.set('expiry', options.expiry)
  if (options?.strikeRange) params.set('strikeRange', options.strikeRange.toString())
  if (options?.maxExpirations) params.set('maxExpirations', options.maxExpirations.toString())
  if (options?.forceRefresh) params.set('forceRefresh', 'true')

  const query = params.toString()
  const url = `${API_BASE}/api/options/${symbol}/gex${query ? `?${query}` : ''}`

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Get 0DTE analytics for a symbol.
 */
export async function getZeroDTEAnalysis(
  symbol: string,
  token: string,
  options?: {
    strike?: number
    type?: 'call' | 'put'
  }
): Promise<ZeroDTEAnalysisResponse> {
  const params = new URLSearchParams()
  if (typeof options?.strike === 'number') params.set('strike', options.strike.toString())
  if (options?.type) params.set('type', options.type)

  const query = params.toString()
  const url = `${API_BASE}/api/options/${symbol}/0dte${query ? `?${query}` : ''}`

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Get implied volatility analysis profile for a symbol.
 */
export async function getIVAnalysis(
  symbol: string,
  token: string,
  options?: {
    expiry?: string
    strikeRange?: number
    maxExpirations?: number
    forceRefresh?: boolean
  }
): Promise<IVAnalysisResponse> {
  const params = new URLSearchParams()
  if (options?.expiry) params.set('expiry', options.expiry)
  if (options?.strikeRange) params.set('strikeRange', options.strikeRange.toString())
  if (options?.maxExpirations) params.set('maxExpirations', options.maxExpirations.toString())
  if (options?.forceRefresh) params.set('forceRefresh', 'true')

  const query = params.toString()
  const url = `${API_BASE}/api/options/${symbol}/iv${query ? `?${query}` : ''}`

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Get upcoming earnings calendar for optional watchlist.
 */
export async function getEarningsCalendar(
  token: string,
  watchlist?: string[],
  days: number = 14,
): Promise<EarningsCalendarResponse> {
  const params = new URLSearchParams()
  if (Array.isArray(watchlist) && watchlist.length > 0) {
    params.set('watchlist', watchlist.join(','))
  }
  params.set('days', String(days))

  const response = await fetch(
    `${API_BASE}/api/earnings/calendar?${params.toString()}`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Get symbol-specific earnings analysis.
 */
export async function getEarningsAnalysis(
  symbol: string,
  token: string,
): Promise<EarningsAnalysisResponse> {
  const response = await fetch(
    `${API_BASE}/api/earnings/${symbol}/analysis`,
    { headers: { 'Authorization': `Bearer ${token}` } },
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Analyze a single position
 */
export async function analyzePosition(
  position: PositionInput,
  token: string
): Promise<PositionAnalysis> {
  const response = await fetch(`${API_BASE}/api/positions/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ position }),
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Analyze a portfolio of positions
 */
export async function analyzePortfolio(
  positions: PositionInput[],
  token: string
): Promise<PortfolioAnalysis> {
  const response = await fetch(`${API_BASE}/api/positions/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ positions }),
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Refresh and fetch all live open positions for the current user.
 */
export async function getLivePositions(
  token: string
): Promise<LivePositionsResponse> {
  const response = await fetch(`${API_BASE}/api/positions/live`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Fetch proactive position management advice for one position or all open positions.
 */
export async function getPositionAdvice(
  token: string,
  positionId?: string
): Promise<PositionAdviceResponse> {
  const params = new URLSearchParams()
  if (positionId) params.set('positionId', positionId)
  const query = params.toString()

  const response = await fetch(`${API_BASE}/api/positions/advice${query ? `?${query}` : ''}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

// ============================================
// SCREENSHOT API
// ============================================

export interface ExtractedPosition {
  symbol: string
  type: 'call' | 'put' | 'stock'
  strike?: number
  expiry?: string
  quantity: number
  entryPrice: number
  currentPrice?: number
  pnl?: number
  confidence: number
}

export type ScreenshotIntent =
  | 'single_position'
  | 'portfolio'
  | 'options_chain'
  | 'pnl_card'
  | 'chart'
  | 'unknown'

export type ScreenshotActionId =
  | 'add_to_monitor'
  | 'log_trade'
  | 'analyze_next_steps'
  | 'create_setup'
  | 'set_alert'
  | 'review_journal_context'

export interface ScreenshotSuggestedAction {
  id: ScreenshotActionId
  label: string
  description: string
}

export interface ScreenshotAnalysisResponse {
  positions: ExtractedPosition[]
  positionCount: number
  broker?: string
  accountValue?: number
  intent: ScreenshotIntent
  suggestedActions: ScreenshotSuggestedAction[]
  warnings: string[]
}

/**
 * Analyze a broker screenshot to extract positions
 */
export async function analyzeScreenshot(
  imageBase64: string,
  mimeType: string,
  token: string
): Promise<ScreenshotAnalysisResponse> {
  const response = await fetch(`${API_BASE}/api/screenshot/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ image: imageBase64, mimeType }),
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

// ============================================
// TRADE JOURNAL API
// ============================================

export type TradeOutcome = 'win' | 'loss' | 'breakeven'
export type JournalPositionType = PositionType

export interface TradeEntry {
  id: string
  user_id: string
  symbol: string
  position_type: JournalPositionType
  strategy?: string
  entry_date: string
  entry_price: number
  exit_date?: string
  exit_price?: number
  quantity: number
  pnl?: number
  pnl_pct?: number
  trade_outcome?: TradeOutcome
  hold_time_days?: number
  exit_reason?: string
  lessons_learned?: string
  tags: string[]
  auto_generated?: boolean
  session_context?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface TradeCreateInput {
  symbol: string
  position_type: JournalPositionType
  strategy?: string
  entry_date: string
  entry_price: number
  exit_date?: string
  exit_price?: number
  quantity: number
  exit_reason?: string
  lessons_learned?: string
  tags?: string[]
}

export interface TradesListResponse {
  trades: TradeEntry[]
  total: number
  hasMore: boolean
}

export interface TradeAnalyticsSummary {
  totalTrades: number
  wins: number
  losses: number
  breakeven: number
  winRate: number
  totalPnl: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  avgHoldDays: number
}

export interface TradeAnalyticsResponse {
  summary: TradeAnalyticsSummary
  equityCurve: Array<{ date: string; pnl: number }>
  byStrategy: Record<string, { count: number; pnl: number; winRate: number }>
}

export interface JournalInsightsSummary {
  summary: string
  tradeCount: number
  timeOfDay: {
    summary: string
    buckets?: Array<{
      bucket: string
      trades: number
      wins: number
      losses: number
      winRate: number
      avgPnl: number
    }>
  }
  setupAnalysis: {
    summary: string
    setups?: Array<{
      setup: string
      trades: number
      wins: number
      losses: number
      winRate: number
      avgPnl: number
    }>
  }
  behavioral: {
    revengeTradingIncidents?: number
    overtrading?: {
      summary: string
      thresholdPerDay: number
      winRateHighActivity: number | null
      winRateLowActivity: number | null
    }
    holdTime?: {
      summary: string
      avgWinnerHoldDays: number
      avgLoserHoldDays: number
    }
  }
  riskManagement: {
    summary: string
    avgRealizedRiskReward?: number | null
    stopAdherencePct?: number | null
    positionSizingCv?: number | null
  }
}

export interface JournalInsightsResponse {
  userId: string
  period: {
    start: string
    end: string
    days: number
  }
  insights: JournalInsightsSummary
  cached: boolean
}

interface MembersApiSuccess<T> {
  success: true
  data: T
  [key: string]: unknown
}

interface MembersApiError {
  success?: false
  error?: string
  message?: string
}

interface MembersJournalEntry {
  id: string
  user_id?: string
  symbol?: string
  contract_type?: JournalPositionType
  strategy?: string | null
  trade_date?: string
  entry_price?: number | null
  exit_price?: number | null
  position_size?: number | null
  pnl?: number | null
  pnl_percentage?: number | null
  is_open?: boolean
  hold_duration_min?: number | null
  execution_notes?: string | null
  lessons_learned?: string | null
  tags?: string[]
  market_context?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

interface MembersJournalAnalytics {
  period_start: string
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number | null
  total_pnl: number
  avg_pnl: number | null
  profit_factor: number | null
  avg_hold_minutes: number | null
  hourly_pnl: Array<{ hour: number; pnl: number; count: number }>
  symbol_stats: Array<{ symbol: string; pnl: number; count: number; win_rate: number }>
  equity_curve: Array<{ date: string; equity: number; drawdown: number }>
}

function toIsoDateFromDay(value?: string): string {
  if (!value) return new Date().toISOString()
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return new Date().toISOString()
  return new Date(parsed).toISOString()
}

function toTradeOutcome(pnl: number | null | undefined): TradeOutcome | undefined {
  if (typeof pnl !== 'number' || !Number.isFinite(pnl)) return undefined
  if (pnl > 0) return 'win'
  if (pnl < 0) return 'loss'
  return 'breakeven'
}

function mapMembersEntryToTradeEntry(entry: MembersJournalEntry): TradeEntry {
  const pnl = typeof entry.pnl === 'number' ? entry.pnl : null
  const holdDays = typeof entry.hold_duration_min === 'number'
    ? Math.max(0, Math.round((entry.hold_duration_min / 1440) * 10) / 10)
    : null

  return {
    id: entry.id,
    user_id: entry.user_id || '',
    symbol: entry.symbol || '',
    position_type: entry.contract_type || 'stock',
    strategy: entry.strategy || undefined,
    entry_date: entry.trade_date || new Date().toISOString(),
    entry_price: typeof entry.entry_price === 'number' ? entry.entry_price : 0,
    exit_date: entry.is_open ? undefined : (entry.trade_date || undefined),
    exit_price: typeof entry.exit_price === 'number' ? entry.exit_price : undefined,
    quantity: typeof entry.position_size === 'number' && Number.isFinite(entry.position_size)
      ? Math.max(1, Math.round(entry.position_size))
      : 1,
    pnl: pnl ?? undefined,
    pnl_pct: typeof entry.pnl_percentage === 'number' ? entry.pnl_percentage : undefined,
    trade_outcome: entry.is_open ? undefined : toTradeOutcome(pnl),
    hold_time_days: holdDays ?? undefined,
    exit_reason: entry.execution_notes || undefined,
    lessons_learned: entry.lessons_learned || undefined,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    auto_generated: false,
    session_context: entry.market_context || undefined,
    created_at: entry.created_at || new Date().toISOString(),
    updated_at: entry.updated_at || new Date().toISOString(),
  }
}

async function parseMembersError(response: Response): Promise<APIError> {
  const payload: MembersApiError = await response.json().catch(() => ({}))
  return {
    error: payload.error || 'Network error',
    message: payload.error || payload.message || `Request failed with status ${response.status}`,
  }
}

function buildMembersAuthHeaders(token?: string): HeadersInit {
  return token
    ? { 'Authorization': `Bearer ${token}` }
    : {}
}

function buildJournalInsightsFromAnalytics(
  analytics: MembersJournalAnalytics,
  period: '7d' | '30d' | '90d',
): JournalInsightsResponse {
  const hourBuckets = analytics.hourly_pnl
    .slice()
    .sort((a, b) => a.hour - b.hour)
    .map((bucket) => {
      const wins = Math.max(0, Math.round((bucket.count * Math.max(0, Math.min(100, bucket.pnl >= 0 ? 60 : 40))) / 100))
      const losses = Math.max(0, bucket.count - wins)
      return {
        bucket: `${String(bucket.hour).padStart(2, '0')}:00`,
        trades: bucket.count,
        wins,
        losses,
        winRate: bucket.count > 0 ? (wins / bucket.count) * 100 : 0,
        avgPnl: bucket.count > 0 ? bucket.pnl / bucket.count : 0,
      }
    })

  const setups = analytics.symbol_stats.slice(0, 6).map((row) => ({
    setup: row.symbol,
    trades: row.count,
    wins: Math.round((row.win_rate / 100) * row.count),
    losses: Math.max(0, row.count - Math.round((row.win_rate / 100) * row.count)),
    winRate: row.win_rate,
    avgPnl: row.count > 0 ? row.pnl / row.count : 0,
  }))

  const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const start = analytics.period_start
  const end = new Date().toISOString()
  const summary = analytics.total_trades === 0
    ? 'No trades in selected period yet.'
    : `Win rate ${Number(analytics.win_rate || 0).toFixed(1)}% across ${analytics.total_trades} trades with total P&L ${analytics.total_pnl >= 0 ? '+' : ''}$${analytics.total_pnl.toFixed(2)}.`

  return {
    userId: 'current-user',
    period: { start, end, days: periodDays },
    insights: {
      summary,
      tradeCount: analytics.total_trades,
      timeOfDay: {
        summary: hourBuckets.length > 0
          ? 'Performance varies by session hour; prioritize highest win-rate windows.'
          : 'Not enough trades to evaluate time-of-day edge.',
        buckets: hourBuckets,
      },
      setupAnalysis: {
        summary: setups.length > 0
          ? 'Best-performing symbols surfaced from recent journal history.'
          : 'Not enough setup data to rank patterns yet.',
        setups,
      },
      behavioral: {
        revengeTradingIncidents: 0,
      },
      riskManagement: {
        summary: analytics.profit_factor != null
          ? `Profit factor ${analytics.profit_factor.toFixed(2)} with average hold ${((analytics.avg_hold_minutes || 0) / 1440).toFixed(1)} days.`
          : 'Insufficient closed trades for robust risk metrics.',
      },
    },
    cached: false,
  }
}

/**
 * Get trades with optional filters
 */
export async function getTrades(
  token: string,
  options?: {
    limit?: number
    offset?: number
    symbol?: string
    strategy?: string
    outcome?: TradeOutcome
  }
): Promise<TradesListResponse> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', options.limit.toString())
  if (options?.offset) params.set('offset', options.offset.toString())
  if (options?.symbol) params.set('symbol', options.symbol)
  if (options?.strategy) params.set('strategy', options.strategy) // server-side filter not currently supported
  if (options?.outcome === 'win') params.set('isWinner', 'true')
  if (options?.outcome === 'loss') params.set('isWinner', 'false')
  params.set('sortBy', 'trade_date')
  params.set('sortDir', 'desc')

  const response = await fetch(`/api/members/journal?${params.toString()}`, {
    headers: buildMembersAuthHeaders(token),
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await parseMembersError(response)
    throw new AICoachAPIError(response.status, error)
  }

  const payload = await response.json() as {
    success?: boolean
    data?: MembersJournalEntry[]
    total?: number
  }

  const allTrades = Array.isArray(payload.data)
    ? payload.data.map((entry) => mapMembersEntryToTradeEntry(entry))
    : []

  const filtered = options?.outcome === 'breakeven'
    ? allTrades.filter((trade) => trade.trade_outcome === 'breakeven')
    : allTrades

  const total = typeof payload.total === 'number' ? payload.total : filtered.length
  const offset = options?.offset ?? 0

  return {
    trades: filtered,
    total,
    hasMore: offset + filtered.length < total,
  }
}

/**
 * Create a new trade entry
 */
export async function createTrade(
  trade: TradeCreateInput,
  token: string
): Promise<TradeEntry> {
  const response = await fetch('/api/members/journal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildMembersAuthHeaders(token),
    },
    credentials: 'include',
    body: JSON.stringify({
      symbol: trade.symbol,
      contract_type: trade.position_type,
      strategy: trade.strategy,
      trade_date: toIsoDateFromDay(trade.entry_date),
      entry_price: trade.entry_price,
      exit_price: trade.exit_price ?? null,
      position_size: trade.quantity,
      is_open: trade.exit_price == null,
      exit_timestamp: trade.exit_date ? toIsoDateFromDay(trade.exit_date) : null,
      execution_notes: trade.exit_reason ?? null,
      lessons_learned: trade.lessons_learned ?? null,
      tags: trade.tags ?? [],
    }),
  })

  if (!response.ok) {
    const error = await parseMembersError(response)
    throw new AICoachAPIError(response.status, error)
  }

  const payload = await response.json() as MembersApiSuccess<MembersJournalEntry>
  return mapMembersEntryToTradeEntry(payload.data)
}

/**
 * Update a trade entry
 */
export async function updateTrade(
  id: string,
  updates: Partial<TradeCreateInput>,
  token: string
): Promise<TradeEntry> {
  const response = await fetch('/api/members/journal', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...buildMembersAuthHeaders(token),
    },
    credentials: 'include',
    body: JSON.stringify({
      id,
      symbol: updates.symbol,
      contract_type: updates.position_type,
      strategy: updates.strategy,
      trade_date: updates.entry_date ? toIsoDateFromDay(updates.entry_date) : undefined,
      entry_price: updates.entry_price,
      exit_price: updates.exit_price,
      position_size: updates.quantity,
      is_open: updates.exit_price == null ? undefined : false,
      exit_timestamp: updates.exit_date ? toIsoDateFromDay(updates.exit_date) : undefined,
      execution_notes: updates.exit_reason,
      lessons_learned: updates.lessons_learned,
      tags: updates.tags,
    }),
  })

  if (!response.ok) {
    const error = await parseMembersError(response)
    throw new AICoachAPIError(response.status, error)
  }

  const payload = await response.json() as MembersApiSuccess<MembersJournalEntry>
  return mapMembersEntryToTradeEntry(payload.data)
}

/**
 * Delete a trade entry
 */
export async function deleteTrade(
  id: string,
  token: string
): Promise<{ success: boolean }> {
  const response = await fetch(`/api/members/journal?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildMembersAuthHeaders(token),
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await parseMembersError(response)
    throw new AICoachAPIError(response.status, error)
  }

  const payload = await response.json() as { success?: boolean }
  return { success: payload.success !== false }
}

/**
 * Get trade performance analytics
 */
export async function getTradeAnalytics(
  token: string
): Promise<TradeAnalyticsResponse> {
  const response = await fetch('/api/members/journal/analytics?period=all', {
    headers: buildMembersAuthHeaders(token),
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await parseMembersError(response)
    throw new AICoachAPIError(response.status, error)
  }

  const payload = await response.json() as MembersApiSuccess<MembersJournalAnalytics>
  const analytics = payload.data

  const equityCurve = analytics.equity_curve.map((point, index) => ({
    date: point.date,
    pnl: index === 0
      ? point.equity
      : point.equity - (analytics.equity_curve[index - 1]?.equity || 0),
  }))

  let avgWin = 0
  let avgLoss = 0
  let byStrategy: Record<string, { count: number; pnl: number; winRate: number }> = {}

  try {
    const detailResponse = await fetch('/api/members/journal?limit=500&offset=0&sortBy=trade_date&sortDir=desc', {
      headers: buildMembersAuthHeaders(token),
      credentials: 'include',
    })

    if (detailResponse.ok) {
      const detailPayload = await detailResponse.json() as { data?: MembersJournalEntry[] }
      const closedTrades = (detailPayload.data || [])
        .map((entry) => mapMembersEntryToTradeEntry(entry))
        .filter((entry) => entry.trade_outcome != null)

      const wins = closedTrades.filter((entry) => typeof entry.pnl === 'number' && entry.pnl > 0)
      const losses = closedTrades.filter((entry) => typeof entry.pnl === 'number' && entry.pnl < 0)

      avgWin = wins.length > 0
        ? wins.reduce((sum, entry) => sum + (entry.pnl || 0), 0) / wins.length
        : 0
      avgLoss = losses.length > 0
        ? losses.reduce((sum, entry) => sum + (entry.pnl || 0), 0) / losses.length
        : 0

      const strategyMap: Record<string, { count: number; pnl: number; wins: number }> = {}
      for (const trade of closedTrades) {
        const key = trade.strategy?.trim() || 'Unspecified'
        if (!strategyMap[key]) {
          strategyMap[key] = { count: 0, pnl: 0, wins: 0 }
        }
        strategyMap[key].count += 1
        strategyMap[key].pnl += trade.pnl || 0
        if ((trade.pnl || 0) > 0) strategyMap[key].wins += 1
      }

      byStrategy = Object.fromEntries(
        Object.entries(strategyMap).map(([key, value]) => ([
          key,
          {
            count: value.count,
            pnl: value.pnl,
            winRate: value.count > 0 ? (value.wins / value.count) * 100 : 0,
          },
        ])),
      )
    }
  } catch {
    // Keep summary available if optional detail query fails.
  }

  return {
    summary: {
      totalTrades: analytics.total_trades,
      wins: analytics.winning_trades,
      losses: analytics.losing_trades,
      breakeven: Math.max(0, analytics.total_trades - analytics.winning_trades - analytics.losing_trades),
      winRate: Number(analytics.win_rate || 0),
      totalPnl: analytics.total_pnl,
      avgWin,
      avgLoss,
      profitFactor: Number(analytics.profit_factor || 0),
      avgHoldDays: Number((analytics.avg_hold_minutes || 0) / 1440),
    },
    equityCurve,
    byStrategy,
  }
}

/**
 * Get journal pattern insights for a lookback period.
 */
export async function getJournalInsights(
  token: string,
  options?: {
    period?: '7d' | '30d' | '90d'
    forceRefresh?: boolean
  },
): Promise<JournalInsightsResponse> {
  const params = new URLSearchParams()
  if (options?.period) params.set('period', options.period)
  const response = await fetch(`/api/members/journal/analytics?${params.toString() || 'period=30d'}`, {
    headers: buildMembersAuthHeaders(token),
    credentials: 'include',
  })

  if (!response.ok) {
    const error = await parseMembersError(response)
    throw new AICoachAPIError(response.status, error)
  }

  const payload = await response.json() as MembersApiSuccess<MembersJournalAnalytics>
  return buildJournalInsightsFromAnalytics(payload.data, options?.period || '30d')
}

/**
 * Import trades from CSV/broker data
 */
export async function importTrades(
  trades: TradeCreateInput[],
  token: string,
  broker?: string
): Promise<{ imported: number; total: number }> {
  const response = await fetch('/api/members/journal/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildMembersAuthHeaders(token),
    },
    credentials: 'include',
    body: JSON.stringify({
      broker: broker || 'interactive_brokers',
      fileName: 'ai-coach-import.json',
      rows: trades.map((trade) => ({
        symbol: trade.symbol,
        contract_type: trade.position_type,
        strategy: trade.strategy,
        entry_date: trade.entry_date,
        entry_price: trade.entry_price,
        exit_date: trade.exit_date,
        exit_price: trade.exit_price,
        quantity: trade.quantity,
      })),
    }),
  })

  if (!response.ok) {
    const error = await parseMembersError(response)
    throw new AICoachAPIError(response.status, error)
  }

  const payload = await response.json() as MembersApiSuccess<{
    inserted?: number
  }>

  return {
    imported: Number(payload.data.inserted || 0),
    total: trades.length,
  }
}

// ============================================
// ALERTS API
// ============================================

export type AlertType = 'price_above' | 'price_below' | 'level_approach' | 'level_break' | 'volume_spike'
export type AlertStatus = 'active' | 'triggered' | 'cancelled'

export interface AlertEntry {
  id: string
  user_id: string
  symbol: string
  alert_type: AlertType
  target_value: number
  condition_met: boolean
  triggered_at?: string
  notification_sent: boolean
  notification_channels: string[]
  status: AlertStatus
  notes?: string
  created_at: string
  expires_at?: string
}

export interface AlertCreateInput {
  symbol: string
  alert_type: AlertType
  target_value: number
  notification_channels?: string[]
  notes?: string
  expires_at?: string
}

export interface AlertsListResponse {
  alerts: AlertEntry[]
  total: number
}

/**
 * Get alerts with optional filters
 */
export async function getAlerts(
  token: string,
  options?: { status?: AlertStatus; symbol?: string }
): Promise<AlertsListResponse> {
  const params = new URLSearchParams()
  if (options?.status) params.set('status', options.status)
  if (options?.symbol) params.set('symbol', options.symbol)

  const response = await fetch(`${API_BASE}/api/alerts?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Create a new alert
 */
export async function createAlert(
  alert: AlertCreateInput,
  token: string
): Promise<AlertEntry> {
  const response = await fetch(`${API_BASE}/api/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(alert),
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Cancel an active alert
 */
export async function cancelAlert(
  id: string,
  token: string
): Promise<AlertEntry> {
  const response = await fetch(`${API_BASE}/api/alerts/${id}/cancel`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

/**
 * Delete an alert
 */
export async function deleteAlert(
  id: string,
  token: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/alerts/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

// ============================================
// SCANNER API
// ============================================

export interface ScanOpportunity {
  id: string
  type: 'technical' | 'options'
  setupType: string
  symbol: string
  direction: 'bullish' | 'bearish' | 'neutral'
  score: number
  confidence: number
  currentPrice: number
  description: string
  suggestedTrade?: {
    strategy: string
    strikes?: number[]
    expiry?: string
    entry?: number
    stopLoss?: number
    target?: number
    estimatedCredit?: number
    estimatedDebit?: number
    maxProfit?: string
    maxLoss?: string
    probability?: string
  }
  metadata: Record<string, unknown>
  scannedAt: string
}

export interface ScanResult {
  opportunities: ScanOpportunity[]
  symbols: string[]
  scanDurationMs: number
  scannedAt: string
}

/**
 * Run opportunity scanner directly (without going through AI chat)
 */
export async function scanOpportunities(
  token: string,
  options?: { symbols?: string[]; includeOptions?: boolean }
): Promise<ScanResult> {
  const params = new URLSearchParams()
  if (options?.symbols) params.set('symbols', options.symbols.join(','))
  if (options?.includeOptions === false) params.set('include_options', 'false')

  const response = await fetchWithAuth(
    `${API_BASE}/api/scanner/scan?${params}`,
    { headers: {} },
    token,
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

// ============================================
// WATCHLIST API
// ============================================

export interface Watchlist {
  id: string
  user_id: string
  name: string
  symbols: string[]
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface WatchlistResponse {
  watchlists: Watchlist[]
  defaultWatchlist?: Watchlist
}

export async function getWatchlists(
  token: string,
  signal?: AbortSignal
): Promise<WatchlistResponse> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/watchlist`,
    { headers: {} },
    token,
    signal
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

export async function createWatchlist(
  token: string,
  payload: { name: string; symbols: string[]; isDefault?: boolean }
): Promise<{ watchlist: Watchlist; watchlists: Watchlist[]; defaultWatchlist?: Watchlist }> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/watchlist`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

export async function updateWatchlist(
  id: string,
  token: string,
  payload: { name?: string; symbols?: string[]; isDefault?: boolean }
): Promise<{ watchlist: Watchlist; watchlists: Watchlist[]; defaultWatchlist?: Watchlist }> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/watchlist/${id}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

export async function deleteWatchlist(
  id: string,
  token: string
): Promise<{ success: boolean; watchlists: Watchlist[]; defaultWatchlist?: Watchlist }> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/watchlist/${id}`,
    {
      method: 'DELETE',
      headers: {},
    },
    token
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

// ============================================
// MORNING BRIEF API
// ============================================

export interface MorningBrief {
  generatedAt: string
  marketDate: string
  marketStatus?: {
    status: string
    session: string
    message: string
    nextOpen?: string
    timeUntilOpen?: string
    timeSinceOpen?: string
    closingTime?: string
  }
  watchlist: string[]
  overnightSummary?: {
    futuresDirection: 'up' | 'down' | 'flat'
    futuresChange: number
    futuresChangePct: number
    gapAnalysis: Array<{
      symbol: string
      gapSize: number
      gapPct: number
      gapType: 'up' | 'down' | 'flat'
      atrRatio: number | null
      historicalFillRate: number | null
    }>
  }
  spxSpyCorrelation?: {
    spxPrice: number
    spyPrice: number
    ratio: number
    spxExpectedMove: number | null
    spyExpectedMove: number | null
  }
  keyLevelsToday?: Array<Record<string, unknown>>
  economicEvents?: Array<Record<string, unknown>>
  earningsToday?: Array<Record<string, unknown>>
  openPositionStatus?: Array<Record<string, unknown>>
  watchItems?: string[]
  aiSummary?: string
}

export interface MorningBriefResponse {
  brief: MorningBrief
  marketDate: string
  viewed: boolean
  cached: boolean
}

export async function getMorningBrief(
  token: string,
  options?: { force?: boolean },
  signal?: AbortSignal
): Promise<MorningBriefResponse> {
  const params = new URLSearchParams()
  if (options?.force) params.set('force', 'true')

  const response = await fetchWithAuth(
    `${API_BASE}/api/brief/today${params.toString() ? `?${params}` : ''}`,
    { headers: {} },
    token,
    signal
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

export async function setMorningBriefViewed(
  token: string,
  viewed: boolean
): Promise<{ success: boolean; marketDate: string; viewed: boolean }> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/brief/today`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewed }),
    },
    token
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

// ============================================
// TRACKED SETUPS API
// ============================================

export type TrackedSetupStatus = 'active' | 'triggered' | 'invalidated' | 'archived'
export type TrackedSetupsListStatus = Exclude<TrackedSetupStatus, 'invalidated'>

export interface TrackedSetup {
  id: string
  user_id: string
  source_opportunity_id: string | null
  symbol: string
  setup_type: string
  direction: 'bullish' | 'bearish' | 'neutral'
  status: TrackedSetupStatus
  opportunity_data: Record<string, unknown>
  notes: string | null
  tracked_at: string
  triggered_at: string | null
  invalidated_at: string | null
  created_at: string
  updated_at: string
}

export async function getTrackedSetups(
  token: string,
  options?: { status?: TrackedSetupsListStatus; view?: 'active' | 'history' },
  signal?: AbortSignal
): Promise<{ trackedSetups: TrackedSetup[] }> {
  const params = new URLSearchParams()
  if (options?.status) params.set('status', options.status)
  if (options?.view) params.set('view', options.view)

  const response = await fetchWithAuth(
    `${API_BASE}/api/tracked-setups${params.toString() ? `?${params}` : ''}`,
    { headers: {} },
    token,
    signal
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

export async function trackSetup(
  token: string,
  payload: {
    source_opportunity_id?: string
    symbol: string
    setup_type: string
    direction: 'bullish' | 'bearish' | 'neutral'
    opportunity_data: Record<string, unknown>
    notes?: string | null
  }
): Promise<{ trackedSetup: TrackedSetup | null; duplicate?: boolean }> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/tracked-setups`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

export async function updateTrackedSetup(
  id: string,
  token: string,
  payload: { status?: TrackedSetupStatus; notes?: string | null }
): Promise<{ trackedSetup: TrackedSetup }> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/tracked-setups/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

export async function deleteTrackedSetup(
  id: string,
  token: string
): Promise<{ success: boolean }> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/tracked-setups/${id}`,
    {
      method: 'DELETE',
      headers: {},
    },
    token
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

export async function deleteTrackedSetupsBulk(
  ids: string[],
  token: string,
): Promise<{ success: boolean; requestedCount: number; deletedCount: number; deletedIds: string[] }> {
  const response = await fetchWithAuth(
    `${API_BASE}/api/tracked-setups`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    },
    token,
  )

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  return response.json()
}

// ============================================
// STREAMING CHAT API
// ============================================

export interface StreamEvent {
  type: 'session' | 'status' | 'token' | 'function_result' | 'done' | 'error'
  data: unknown
}

export interface StreamDoneData {
  messageId: string
  functionCalls?: ChatMessageResponse['functionCalls']
  contractAudit?: ChatMessageResponse['contractAudit']
  tokensUsed: number
  responseTime: number
}

/**
 * Send a chat message with SSE streaming response.
 * Returns an async generator that yields stream events.
 */
export async function* streamMessage(
  sessionId: string,
  message: string,
  token: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId, message }),
    signal,
  })

  if (!response.ok) {
    const error: APIError = await response.json().catch(() => ({
      error: 'Network error',
      message: `Request failed with status ${response.status}`,
    }))
    throw new AICoachAPIError(response.status, error)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE events from buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      let currentEvent = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7)
        } else if (line.startsWith('data: ') && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6))
            yield { type: currentEvent as StreamEvent['type'], data }
          } catch {
            // Skip malformed JSON
          }
          currentEvent = ''
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ============================================
// ERROR CLASS
// ============================================

export class AICoachAPIError extends Error {
  status: number
  apiError: APIError

  constructor(status: number, apiError: APIError) {
    super(apiError.message)
    this.name = 'AICoachAPIError'
    this.status = status
    this.apiError = apiError
  }

  get isRateLimited(): boolean {
    return this.status === 429 || this.status === 403
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isServiceUnavailable(): boolean {
    return this.status === 503
  }
}
