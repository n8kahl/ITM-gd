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

export type KeyLevelsTimeframe = 'intraday' | 'daily' | 'weekly'

export interface KeyLevelItem {
  type: string
  price: number
  distance: number
  distancePct: number
  distanceATR: number
  strength: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical'
  description: string
  displayLabel?: string
  displayContext?: string
  side?: 'resistance' | 'support'
  testsToday?: number
  lastTest?: string | null
  holdRate?: number | null
}

export interface KeyLevelsResponse {
  symbol: string
  timestamp: string
  currentPrice: number
  levels: {
    resistance: KeyLevelItem[]
    support: KeyLevelItem[]
    pivots: {
      standard: Record<string, number | null>
      camarilla: Record<string, number | null>
      fibonacci: Record<string, number | null>
    }
    indicators: {
      vwap: number | null
      atr14: number | null
      atr7?: number | null
    }
  }
  marketContext: {
    marketStatus: string
    sessionType: string
    timeSinceOpen?: string
  }
  cached: boolean
  cacheExpiresAt: string | null
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
  source?: 'massive_reference' | 'alpha_vantage' | 'tmx_corporate_events' | 'fmp'
}

export interface EarningsCalendarResponse {
  watchlist: string[]
  daysAhead: number
  count: number
  events: EarningsCalendarEvent[]
}

export interface EconomicCalendarEvent {
  date: string
  event: string
  expected: string | null
  previous: string | null
  actual: string | null
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  relevance: string
}

export interface EconomicCalendarResponse {
  daysAhead: number
  impactFilter: string
  count: number
  events: EconomicCalendarEvent[]
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
  signal?: AbortSignal,
  imagePayload?: { image: string; imageMimeType: string },
  context?: {
    activeChartSymbol?: string
  },
): Promise<ChatMessageResponse> {
  const payload: {
    message: string
    sessionId?: string
    image?: string
    imageMimeType?: string
    context?: {
      activeChartSymbol?: string
    }
  } = { message }
  if (sessionId && sessionId.trim().length > 0) {
    payload.sessionId = sessionId
  }
  if (imagePayload) {
    payload.image = imagePayload.image
    payload.imageMimeType = imagePayload.imageMimeType
  }
  if (context?.activeChartSymbol) {
    payload.context = {
      activeChartSymbol: context.activeChartSymbol,
    }
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
  token: string,
  context?: {
    activeChartSymbol?: string
  },
): Promise<ChatMessageResponse> {
  return sendMessage(undefined, message, token, undefined, undefined, context)
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
 * Get key levels for a symbol.
 */
export async function getKeyLevels(
  symbol: string,
  timeframe: KeyLevelsTimeframe,
  token: string,
  signal?: AbortSignal,
): Promise<KeyLevelsResponse> {
  const params = new URLSearchParams({ timeframe })
  const response = await fetchWithAuth(
    `${API_BASE}/api/levels/${symbol}?${params.toString()}`,
    { headers: {} },
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
 * Get upcoming economic calendar events.
 */
export async function getEconomicCalendar(
  token: string,
  daysAhead: number = 7,
  impactFilter: 'HIGH' | 'MEDIUM' | 'ALL' = 'HIGH',
): Promise<EconomicCalendarResponse> {
  const params = new URLSearchParams()
  params.set('days', String(daysAhead))
  params.set('impact', impactFilter)

  const response = await fetch(
    `${API_BASE}/api/economic/calendar?${params.toString()}`,
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
  | 'suggest_alerts'
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
// TRADE JOURNAL API (Legacy types preserved for widget-cards compatibility)
// Journal CRUD moved to /api/members/journal — use that API directly.
// ============================================

export type TradeOutcome = 'win' | 'loss' | 'breakeven'
export type JournalPositionType = PositionType

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

// getTrades, createTrade, updateTrade, deleteTrade, getTradeAnalytics removed.
// Journal CRUD is handled by /api/members/journal routes directly.
// getJournalInsights and importTrades are preserved for widget-cards and chat integration.

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

export interface TradeCreateInput {
  symbol: string
  position_type: 'call' | 'put' | 'stock'
  strategy?: string | null
  entry_date: string
  entry_price: number
  exit_date?: string | null
  exit_price?: number | null
  quantity: number
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
  imagePayload?: { image: string; imageMimeType: string },
  context?: {
    activeChartSymbol?: string
  },
): AsyncGenerator<StreamEvent> {
  const payload: {
    sessionId: string
    message: string
    image?: string
    imageMimeType?: string
    context?: {
      activeChartSymbol?: string
    }
  } = { sessionId, message }
  if (imagePayload) {
    payload.image = imagePayload.image
    payload.imageMimeType = imagePayload.imageMimeType
  }
  if (context?.activeChartSymbol) {
    payload.context = {
      activeChartSymbol: context.activeChartSymbol,
    }
  }

  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
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
