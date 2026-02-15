'use client'

import { useCallback, useState } from 'react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { postSPX, useSPXQuery } from '@/hooks/use-spx-api'
import type { CoachMessage } from '@/lib/types/spx-command-center'

interface CoachStateResponse {
  messages: CoachMessage[]
  generatedAt: string
}

export function useSPXCoach() {
  const { session } = useMemberAuth()
  const [isSending, setIsSending] = useState(false)

  const query = useSPXQuery<CoachStateResponse>('/api/spx/coach/state', {
    refreshInterval: 5_000,
  })

  const sendMessage = useCallback(async (prompt: string, setupId?: string | null) => {
    if (!session?.access_token) {
      throw new Error('Missing session token for SPX coach request')
    }

    setIsSending(true)
    try {
      const message = await postSPX<CoachMessage>('/api/spx/coach/message', session.access_token, {
        prompt,
        setupId: setupId || undefined,
      })

      await query.mutate((prev) => {
        if (!prev) {
          return {
            messages: [message],
            generatedAt: new Date().toISOString(),
          }
        }

        return {
          ...prev,
          messages: [message, ...prev.messages],
          generatedAt: new Date().toISOString(),
        }
      }, false)

      return message
    } finally {
      setIsSending(false)
    }
  }, [query, session?.access_token])

  return {
    messages: query.data?.messages || [],
    generatedAt: query.data?.generatedAt || null,
    isLoading: query.isLoading,
    isSending,
    error: query.error,
    mutate: query.mutate,
    sendMessage,
  }
}
