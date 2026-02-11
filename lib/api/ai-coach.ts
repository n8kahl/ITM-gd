/**
 * AI Coach Backend API Client
 *
 * Calls the Express backend (port 3001) for chat, sessions, and market data.
 * Uses Supabase JWT for authentication.
 */

function resolveApiBase(): string {
  const url = process.env.NEXT_PUBLIC_AI_COACH_API_URL
  if (!url) return 'http://localhost:3001'
  // Ensure the URL has a protocol so fetch() treats it as absolute
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
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

export interface ScreenshotAnalysisResponse {
  positions: ExtractedPosition[]
  positionCount: number
  broker?: string
  accountValue?: number
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
  if (options?.strategy) params.set('strategy', options.strategy)
  if (options?.outcome) params.set('outcome', options.outcome)

  const response = await fetch(`${API_BASE}/api/journal/trades?${params}`, {
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
 * Create a new trade entry
 */
export async function createTrade(
  trade: TradeCreateInput,
  token: string
): Promise<TradeEntry> {
  const response = await fetch(`${API_BASE}/api/journal/trades`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(trade),
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
 * Update a trade entry
 */
export async function updateTrade(
  id: string,
  updates: Partial<TradeCreateInput>,
  token: string
): Promise<TradeEntry> {
  const response = await fetch(`${API_BASE}/api/journal/trades/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
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
 * Delete a trade entry
 */
export async function deleteTrade(
  id: string,
  token: string
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/journal/trades/${id}`, {
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

/**
 * Get trade performance analytics
 */
export async function getTradeAnalytics(
  token: string
): Promise<TradeAnalyticsResponse> {
  const response = await fetch(`${API_BASE}/api/journal/analytics`, {
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
  if (options?.forceRefresh) params.set('forceRefresh', 'true')

  const response = await fetch(`${API_BASE}/api/journal/insights?${params}`, {
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
 * Import trades from CSV/broker data
 */
export async function importTrades(
  trades: TradeCreateInput[],
  token: string,
  broker?: string
): Promise<{ imported: number; total: number }> {
  const response = await fetch(`${API_BASE}/api/journal/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ trades, broker }),
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
  options?: { status?: TrackedSetupStatus },
  signal?: AbortSignal
): Promise<{ trackedSetups: TrackedSetup[] }> {
  const params = new URLSearchParams()
  if (options?.status) params.set('status', options.status)

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

// ============================================
// STREAMING CHAT API
// ============================================

export interface StreamEvent {
  type: 'session' | 'status' | 'token' | 'done' | 'error'
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
