'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  sendMessage as apiSendMessage,
  streamMessage as apiStreamMessage,
  getSessions as apiGetSessions,
  getSessionMessages as apiGetSessionMessages,
  deleteSession as apiDeleteSession,
  AICoachAPIError,
  type ChatMessageResponse,
  type ChatSession,
  type ChartTimeframe,
  type StreamDoneData,
} from '@/lib/api/ai-coach'
import type { ChartRequest } from '@/components/ai-coach/center-panel'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  functionCalls?: ChatMessageResponse['functionCalls']
  isOptimistic?: boolean
  isStreaming?: boolean
  streamStatus?: string
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

  const sendingRef = useRef(false)

  // Use a ref for the token so callbacks don't depend on the session object
  const tokenRef = useRef<string | null>(session?.access_token || null)
  tokenRef.current = session?.access_token || null

  // AbortController for cancelling in-flight requests on unmount
  const abortControllerRef = useRef<AbortController | null>(null)

  // Stable getter — never recreated
  const getToken = useCallback((): string | null => {
    return tokenRef.current
  }, [])

  const loadSessions = useCallback(async () => {
    const token = getToken()
    if (!token) return
    setState(prev => ({ ...prev, isLoadingSessions: true, error: null }))
    try {
      const result = await apiGetSessions(token, 20)
      setState(prev => ({ ...prev, sessions: result.sessions, isLoadingSessions: false }))
    } catch (error) {
      console.error('[AI Coach] loadSessions error:', error)
      const message = error instanceof AICoachAPIError ? error.apiError.message : 'Failed to load sessions'
      setState(prev => ({ ...prev, isLoadingSessions: false, error: message }))
    }
  }, [getToken])

  useEffect(() => {
    if (session?.access_token) { loadSessions() }
  }, [session?.access_token]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentSessionIdRef = useRef<string | null>(state.currentSessionId)
  currentSessionIdRef.current = state.currentSessionId

  // Cleanup: abort in-flight requests on unmount
  useEffect(() => {
    return () => { abortControllerRef.current?.abort() }
  }, [])

  /**
   * Extract chart request from function calls
   */
  const extractChartRequest = useCallback((functionCalls: ChatMessageResponse['functionCalls']): ChartRequest | null => {
    if (!functionCalls) return null
    const showChartCall = functionCalls.find(fc => fc.function === 'show_chart')
    const gexCall = functionCalls.find(fc => fc.function === 'get_gamma_exposure')
    if (!showChartCall && !gexCall) return null

    const showChartArgs = showChartCall?.arguments as { symbol?: string; timeframe?: string } | undefined
    const showChartResult = showChartCall?.result as {
      symbol?: string
      timeframe?: string
      levels?: {
        resistance?: Array<{ name: string; price: number; distance?: string }>
        support?: Array<{ name: string; price: number; distance?: string }>
        indicators?: { vwap?: number; atr14?: number }
      }
    } | undefined

    const gexArgs = gexCall?.arguments as { symbol?: string } | undefined
    const gexResult = gexCall?.result as {
      symbol?: string
      spotPrice?: number
      flipPoint?: number | null
      maxGEXStrike?: number | null
      keyLevels?: Array<{ strike: number; gexValue: number; type: 'support' | 'resistance' | 'magnet' }>
    } | undefined

    const symbol = showChartArgs?.symbol || showChartResult?.symbol || gexArgs?.symbol || gexResult?.symbol || 'SPX'
    const timeframe = (showChartArgs?.timeframe || showChartResult?.timeframe || '1D') as ChartTimeframe
    const levels = showChartResult?.levels
    const gexProfile = gexResult
      ? {
          symbol: gexResult.symbol || symbol,
          spotPrice: gexResult.spotPrice,
          flipPoint: gexResult.flipPoint,
          maxGEXStrike: gexResult.maxGEXStrike,
          keyLevels: gexResult.keyLevels,
        }
      : undefined

    return {
      symbol,
      timeframe,
      levels,
      gexProfile,
    }
  }, [])

  /**
   * Send message with streaming (default) or fallback to non-streaming
   */
  const sendMessage = useCallback(async (text: string) => {
    const token = getToken()
    if (!token || !text.trim() || sendingRef.current) return

    sendingRef.current = true

    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const sessionId = currentSessionIdRef.current || crypto.randomUUID()

    const userMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
      isOptimistic: true,
    }

    // Create a placeholder streaming message
    const streamingMsgId = `streaming-${Date.now()}`
    const streamingMessage: ChatMessage = {
      id: streamingMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      streamStatus: 'Thinking...',
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage, streamingMessage],
      currentSessionId: sessionId,
      isSending: true,
      error: null,
    }))

    try {
      let streamContent = ''
      let doneData: StreamDoneData | null = null
      let usedStreaming = false

      try {
        // Try streaming first
        for await (const event of apiStreamMessage(sessionId, text.trim(), token, controller.signal)) {
          usedStreaming = true

          if (event.type === 'status') {
            const status = event.data as { phase: string; function?: string }
            let statusText = 'Thinking...'
            if (status.phase === 'calling') statusText = `Using ${status.function}...`
            else if (status.phase === 'generating') statusText = 'Writing...'

            setState(prev => ({
              ...prev,
              messages: prev.messages.map(m =>
                m.id === streamingMsgId ? { ...m, streamStatus: statusText } : m
              ),
            }))
          } else if (event.type === 'token') {
            const tokenData = event.data as { content: string }
            streamContent += tokenData.content

            setState(prev => ({
              ...prev,
              messages: prev.messages.map(m =>
                m.id === streamingMsgId
                  ? { ...m, content: streamContent, streamStatus: undefined }
                  : m
              ),
            }))
          } else if (event.type === 'done') {
            doneData = event.data as StreamDoneData
          } else if (event.type === 'error') {
            const errData = event.data as { message: string }
            throw new Error(errData.message)
          }
        }
      } catch (streamError) {
        // If streaming fails and we haven't received any data, fall back to non-streaming
        if (!usedStreaming) {
          const response = await apiSendMessage(sessionId, text.trim(), token, controller.signal)
          streamContent = response.content
          doneData = {
            messageId: response.messageId,
            functionCalls: response.functionCalls,
            tokensUsed: response.tokensUsed,
            responseTime: response.responseTime,
          }
        } else {
          throw streamError
        }
      }

      const confirmedUserMessage: ChatMessage = { ...userMessage, isOptimistic: false }

      const assistantMessage: ChatMessage = {
        id: doneData?.messageId || streamingMsgId,
        role: 'assistant',
        content: streamContent,
        timestamp: new Date().toISOString(),
        functionCalls: doneData?.functionCalls,
        isStreaming: false,
      }

      const newChartRequest = extractChartRequest(doneData?.functionCalls)

      setState(prev => ({
        ...prev,
        messages: [
          ...prev.messages.filter(m => m.id !== userMessage.id && m.id !== streamingMsgId),
          confirmedUserMessage,
          assistantMessage,
        ],
        isSending: false,
        ...(newChartRequest ? { chartRequest: newChartRequest } : {}),
      }))

      loadSessions()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') { return }

      if (error instanceof AICoachAPIError && error.isUnauthorized) {
        setState(prev => ({
          ...prev,
          isSending: false,
          messages: prev.messages.filter(m => m.id !== streamingMsgId),
          error: 'Your session has expired. Please sign in again.',
        }))
        return
      }

      console.error('[AI Coach] sendMessage error:', error)

      if (error instanceof AICoachAPIError && error.isRateLimited) {
        setState(prev => ({
          ...prev,
          isSending: false,
          messages: prev.messages.filter(m => m.id !== streamingMsgId),
          error: error.apiError.message,
          rateLimitInfo: { queryCount: error.apiError.queryCount, queryLimit: error.apiError.queryLimit, resetDate: error.apiError.resetDate },
        }))
      } else {
        const message = error instanceof AICoachAPIError ? error.apiError.message : 'Failed to send message. Please try again.'
        setState(prev => ({
          ...prev,
          isSending: false,
          messages: prev.messages.filter(m => m.id !== streamingMsgId),
          error: message,
        }))
      }
    } finally {
      sendingRef.current = false
    }
  }, [getToken, loadSessions, extractChartRequest])

  const newSession = useCallback(() => {
    setState(prev => ({ ...prev, messages: [], currentSessionId: null, error: null, rateLimitInfo: null }))
  }, [])

  const selectSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionIdRef.current) return
    const token = getToken()
    if (!token) return
    setState(prev => ({ ...prev, currentSessionId: sessionId, messages: [], isLoadingMessages: true, error: null }))
    try {
      const result = await apiGetSessionMessages(sessionId, token)
      const loadedMessages: ChatMessage[] = result.messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({ id: msg.id, role: msg.role as 'user' | 'assistant', content: msg.content, timestamp: msg.timestamp, functionCalls: msg.functionCalls }))
      setState(prev => ({ ...prev, messages: loadedMessages, isLoadingMessages: false }))
    } catch (error) {
      const message = error instanceof AICoachAPIError ? error.apiError.message : 'Failed to load messages'
      setState(prev => ({ ...prev, isLoadingMessages: false, error: message }))
    }
  }, [getToken])

  const removeSession = useCallback(async (sessionId: string) => {
    const token = getToken()
    if (!token) return
    try {
      await apiDeleteSession(sessionId, token)
      setState(prev => {
        const updatedSessions = prev.sessions.filter(s => s.id !== sessionId)
        const isCurrentSession = prev.currentSessionId === sessionId
        return { ...prev, sessions: updatedSessions, ...(isCurrentSession ? { currentSessionId: null, messages: [] } : {}) }
      })
    } catch (error) {
      const message = error instanceof AICoachAPIError ? error.apiError.message : 'Failed to delete session'
      setState(prev => ({ ...prev, error: message }))
    }
  }, [getToken])

  const clearError = useCallback(() => { setState(prev => ({ ...prev, error: null })) }, [])

  return useMemo(() => ({
    messages: state.messages, sessions: state.sessions, currentSessionId: state.currentSessionId,
    isSending: state.isSending, isLoadingSessions: state.isLoadingSessions, isLoadingMessages: state.isLoadingMessages,
    error: state.error, rateLimitInfo: state.rateLimitInfo, chartRequest: state.chartRequest,
    sendMessage, newSession, selectSession, deleteSession: removeSession, loadSessions, clearError,
  }), [
    state.messages, state.sessions, state.currentSessionId, state.isSending, state.isLoadingSessions,
    state.isLoadingMessages, state.error, state.rateLimitInfo, state.chartRequest,
    sendMessage, newSession, selectSession, removeSession, loadSessions, clearError,
  ])
}
