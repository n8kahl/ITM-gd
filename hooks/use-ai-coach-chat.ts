'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  sendMessage as apiSendMessage,
  getSessions as apiGetSessions,
  deleteSession as apiDeleteSession,
  AICoachAPIError,
  type ChatMessageResponse,
  type ChatSession,
} from '@/lib/api/ai-coach'

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

      setState(prev => ({
        ...prev,
        messages: [
          ...prev.messages.filter(m => m.id !== userMessage.id),
          confirmedUserMessage,
          assistantMessage,
        ],
        isSending: false,
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

    setState(prev => ({
      ...prev,
      currentSessionId: sessionId,
      messages: [],
      isLoadingMessages: true,
      error: null,
    }))

    // Note: The backend doesn't have a "get messages for session" endpoint yet.
    // For Phase 2, we load sessions but start fresh when selecting.
    // Messages will be loaded from the backend's conversation history
    // when the user sends their next message (the backend loads history internally).
    setState(prev => ({
      ...prev,
      isLoadingMessages: false,
    }))
  }, [state.currentSessionId])

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

    // Actions
    sendMessage,
    newSession,
    selectSession,
    deleteSession: removeSession,
    loadSessions,
    clearError,
  }
}
