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
