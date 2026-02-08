/**
 * AI Coach Backend API Client
 *
 * Calls the Express backend (port 3001) for chat, sessions, and market data.
 * Uses Supabase JWT for authentication.
 */

const API_BASE = process.env.NEXT_PUBLIC_AI_COACH_API_URL || 'http://localhost:3001'

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
  tokensUsed: number
  responseTime: number
}

export interface ChatSession {
  id: string
  title: string
  message_count: number
  created_at: string
  updated_at: string
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

export interface ChartDataResponse {
  symbol: string
  timeframe: ChartTimeframe
  bars: ChartBar[]
  count: number
  timestamp: string
  cached: boolean
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

export interface APIError {
  error: string
  message: string
  queryCount?: number
  queryLimit?: number
  resetDate?: string
  retryAfter?: number
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Send a chat message and receive AI response
 */
export async function sendMessage(
  sessionId: string,
  message: string,
  token: string
): Promise<ChatMessageResponse> {
  const response = await fetch(`${API_BASE}/api/chat/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId, message }),
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
 * Get user's chat sessions
 */
export async function getSessions(
  token: string,
  limit: number = 10
): Promise<{ sessions: ChatSession[]; count: number }> {
  const response = await fetch(`${API_BASE}/api/chat/sessions?limit=${limit}`, {
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
 * Delete a chat session
 */
export async function deleteSession(
  sessionId: string,
  token: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
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
 * Get messages for a specific session
 */
export async function getSessionMessages(
  sessionId: string,
  token: string,
  limit: number = 50,
  offset: number = 0
): Promise<SessionMessagesResponse> {
  const response = await fetch(
    `${API_BASE}/api/chat/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
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
 * Get chart OHLCV data for a symbol
 */
export async function getChartData(
  symbol: string,
  timeframe: ChartTimeframe,
  token: string
): Promise<ChartDataResponse> {
  const response = await fetch(
    `${API_BASE}/api/chart/${symbol}?timeframe=${timeframe}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
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
    return this.status === 403
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isServiceUnavailable(): boolean {
    return this.status === 503
  }
}
