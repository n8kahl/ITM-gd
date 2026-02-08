'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  sendMessage as apiSendMessage,
  getSessions as apiGetSessions,
  getSessionMessages as apiGetSessionMessages,
  deleteSession as apiDeleteSession,
  AICoachAPIError,
  type ChatMessageResponse,
  type ChatSession,
  type ChartTimeframe,
} from '@/lib/api/ai-coach'
import type { ChartRequest } from '@/components/ai-coach/center-panel'

// ============================================
// TYPES
// ============================================

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  functionCalls?: ChatMessageResponse['functionCalls']
  isOptimistic?: boolean
}

interface AICoachChatState {
  messages: ChatMessage[]
  sessions: ChatSession[]
  currentSessionId: string | null
  isSending: boolean
  isLoadingSessions: boolean
  isLoadingMessages: boolean
  error: string | null
  rateLimitInfo: {
    queryCount?: number
    queryLimit?: number
    resetDate?: string
  } | null
  chartRequest: ChartRequest | null
}

// ============================================
// HOOK
// ============================================

export function useAICoachChat() {
  const { session } = useMemberAuth()

  const [state, setState] = useState<AICoachChatState>({
    messages: [],
    sessions: [],
    currentSessionId: null,
    isSending: false,
    isLoadingSessions: false,
    isLoadingMessages: false,
    error: null,
    rateLimitInfo: null,
    chartRequest: null,
  })

  // Ref to prevent double-sends
  const sendingRef = useRef(false)

  // Get auth token
  const getToken = useCallback((): string | null => {
    return session?.access_token || null
  }, [session])

  // ============================================
  // LOAD SESSIONS
  // ============================================

  const loadSessions = useCallback(async () => {
    const token = getToken()
    if (!token) return

    setState(prev => ({ ...prev, isLoadingSessions: true, error: null }))

    try {
      const result = await apiGetSessions(token, 20)
      setState(prev => ({
        ...prev,
        sessions: result.sessions,
        isLoadingSessions: false,
      }))
    } catch (error) {
      const message = error instanceof AICoachAPIError
        ? error.apiError.message
        : 'Failed to load sessions'
      setState(prev => ({
        ...prev,
        isLoadingSessions: false,
        error: message,
      }))
    }
  }, [getToken])

  // Load sessions on mount
  useEffect(() => {
    if (session?.access_token) {
      loadSessions()
    }
  }, [session?.access_token, loadSessions])

  // ============================================
  // SEND MESSAGE
  // ============================================

  const sendMessage = useCallback(async (text: string) => {
    const token = getToken()
    if (!token || !text.trim() || sendingRef.current) return

    sendingRef.current = true

    // Generate or use current session ID
    const sessionId = state.currentSessionId || crypto.randomUUID()

    // Optimistic user message
    const userMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
      isOptimistic: true,
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      currentSessionId: sessionId,
      isSending: true,
      error: null,
    }))

    try {
      const response = await apiSendMessage(sessionId, text.trim(), token)

      // Replace optimistic message and add assistant response
      const confirmedUserMessage: ChatMessage = {
        ...userMessage,
        isOptimistic: false,
      }

      const assistantMessage: ChatMessage = {
        id: response.messageId,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        functionCalls: response.functionCalls,
      }

      // Check if AI called show_chart function
      let newChartRequest: ChartRequest | null = null
      if (response.functionCalls) {
        const showChartCall = response.functionCalls.find(fc => fc.function === 'show_chart')
        if (showChartCall) {
          const args = showChartCall.arguments as { symbol?: string; timeframe?: string }
          const result = showChartCall.result as {
            symbol?: string
            timeframe?: string
            levels?: {
              resistance?: Array<{ name: string; price: number; distance?: string }>
              support?: Array<{ name: string; price: number; distance?: string }>
              indicators?: { vwap?: number; atr14?: number }
            }
          } | undefined

          newChartRequest = {
            symbol: args.symbol || 'SPX',
            timeframe: (args.timeframe || '1D') as ChartTimeframe,
            levels: result?.levels,
          }
        }
      }

      setState(prev => ({
        ...prev,
        messages: [
          ...prev.messages.filter(m => m.id !== userMessage.id),
          confirmedUserMessage,
          assistantMessage,
        ],
        isSending: false,
        ...(newChartRequest ? { chartRequest: newChartRequest } : {}),
      }))

      // Refresh sessions list to get updated titles/counts
      loadSessions()
    } catch (error) {
      if (error instanceof AICoachAPIError && error.isRateLimited) {
        setState(prev => ({
          ...prev,
          isSending: false,
          error: error.apiError.message,
          rateLimitInfo: {
            queryCount: error.apiError.queryCount,
            queryLimit: error.apiError.queryLimit,
            resetDate: error.apiError.resetDate,
          },
        }))
      } else {
        const message = error instanceof AICoachAPIError
          ? error.apiError.message
          : 'Failed to send message. Please try again.'
        setState(prev => ({
          ...prev,
          isSending: false,
          error: message,
        }))
      }
    } finally {
      sendingRef.current = false
    }
  }, [getToken, state.currentSessionId, loadSessions])

  // ============================================
  // SESSION MANAGEMENT
  // ============================================

  const newSession = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      currentSessionId: null,
      error: null,
      rateLimitInfo: null,
    }))
  }, [])

  const selectSession = useCallback(async (sessionId: string) => {
    // If already selected, do nothing
    if (sessionId === state.currentSessionId) return

    const token = getToken()
    if (!token) return

    setState(prev => ({
      ...prev,
      currentSessionId: sessionId,
      messages: [],
      isLoadingMessages: true,
      error: null,
    }))

    try {
      const result = await apiGetSessionMessages(sessionId, token)

      const loadedMessages: ChatMessage[] = result.messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.timestamp,
          functionCalls: msg.functionCalls,
        }))

      setState(prev => ({
        ...prev,
        messages: loadedMessages,
        isLoadingMessages: false,
      }))
    } catch (error) {
      const message = error instanceof AICoachAPIError
        ? error.apiError.message
        : 'Failed to load messages'
      setState(prev => ({
        ...prev,
        isLoadingMessages: false,
        error: message,
      }))
    }
  }, [state.currentSessionId, getToken])

  const removeSession = useCallback(async (sessionId: string) => {
    const token = getToken()
    if (!token) return

    try {
      await apiDeleteSession(sessionId, token)

      setState(prev => {
        const updatedSessions = prev.sessions.filter(s => s.id !== sessionId)
        const isCurrentSession = prev.currentSessionId === sessionId

        return {
          ...prev,
          sessions: updatedSessions,
          ...(isCurrentSession ? {
            currentSessionId: null,
            messages: [],
          } : {}),
        }
      })
    } catch (error) {
      const message = error instanceof AICoachAPIError
        ? error.apiError.message
        : 'Failed to delete session'
      setState(prev => ({ ...prev, error: message }))
    }
  }, [getToken])

  // ============================================
  // UTILITIES
  // ============================================

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    // State
    messages: state.messages,
    sessions: state.sessions,
    currentSessionId: state.currentSessionId,
    isSending: state.isSending,
    isLoadingSessions: state.isLoadingSessions,
    isLoadingMessages: state.isLoadingMessages,
    error: state.error,
    rateLimitInfo: state.rateLimitInfo,
    chartRequest: state.chartRequest,

    // Actions
    sendMessage,
    newSession,
    selectSession,
    deleteSession: removeSession,
    loadSessions,
    clearError,
  }
}
