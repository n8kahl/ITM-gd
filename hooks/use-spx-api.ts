'use client'

import useSWR, { type SWRConfiguration } from 'swr'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

type SPXKey = [url: string, token: string]
const browserSupabase = createBrowserSupabase()

function trimMessage(input: string, max = 240): string {
  const normalized = input.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized
}

function parseSPXErrorMessage(status: number, contentType: string, rawBody: string): string {
  const body = rawBody || ''

  if (contentType.includes('application/json')) {
    try {
      const parsed = JSON.parse(body) as { message?: unknown; error?: unknown }
      const message = typeof parsed.message === 'string'
        ? parsed.message
        : typeof parsed.error === 'string'
          ? parsed.error
          : ''

      if (message) {
        return trimMessage(message)
      }
    } catch {
      // Fall through to generic handling.
    }
  }

  if (/<!doctype html/i.test(body) || /<html/i.test(body)) {
    return `SPX service unavailable (${status}).`
  }

  const plain = trimMessage(body)
  if (plain) {
    return plain
  }

  return `SPX request failed (${status})`
}

const fetcher = async <T>(key: SPXKey): Promise<T> => {
  const [url, token] = key
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'
  if (!isLocalHost && token.startsWith('e2e:')) {
    throw new Error('Invalid test session token detected. Please sign out and sign in again.')
  }

  const requestWithToken = (accessToken: string) => fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  let activeToken = token
  let response = await requestWithToken(activeToken)

  if (response.status === 401) {
    try {
      const {
        data: { session },
      } = await browserSupabase.auth.getSession()
      const refreshedToken = session?.access_token
      if (refreshedToken && refreshedToken !== activeToken) {
        activeToken = refreshedToken
        response = await requestWithToken(activeToken)
      }
    } catch {
      // Keep original 401 response path below.
    }
  }

  if (!response.ok) {
    const text = await response.text()
    const contentType = response.headers.get('content-type') || ''
    throw new Error(parseSPXErrorMessage(response.status, contentType, text))
  }

  const payload = await response.json() as Record<string, unknown>
  if (payload && payload.degraded === true) {
    throw new Error('SPX service is running in degraded mode. Live data temporarily unavailable.')
  }

  return payload as T
}

export function useSPXQuery<T>(
  endpoint: string,
  config?: SWRConfiguration<T, Error>,
) {
  const { session, isLoading: authLoading } = useMemberAuth()
  const token = session?.access_token

  const { data, error, isLoading, mutate } = useSWR<T, Error>(
    !authLoading && token ? [endpoint, token] : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 1500,
      errorRetryCount: 1,
      errorRetryInterval: 5000,
      ...(config || {}),
    },
  )

  return {
    data,
    error,
    isLoading,
    mutate,
    hasSession: Boolean(token),
  }
}

export async function postSPX<T>(endpoint: string, token: string, body: Record<string, unknown>): Promise<T> {
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : ''
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'
  if (!isLocalHost && token.startsWith('e2e:')) {
    throw new Error('Invalid test session token detected. Please sign out and sign in again.')
  }

  const requestWithToken = (accessToken: string) => fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  let activeToken = token
  let response = await requestWithToken(activeToken)

  if (response.status === 401) {
    try {
      const {
        data: { session },
      } = await browserSupabase.auth.getSession()
      const refreshedToken = session?.access_token
      if (refreshedToken && refreshedToken !== activeToken) {
        activeToken = refreshedToken
        response = await requestWithToken(activeToken)
      }
    } catch {
      // Keep original 401 path below.
    }
  }

  if (!response.ok) {
    const text = await response.text()
    const contentType = response.headers.get('content-type') || ''
    throw new Error(parseSPXErrorMessage(response.status, contentType, text))
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/event-stream')) {
    const raw = await response.text()
    const match = raw.match(/data:\s*(\{.*\})/)
    if (match && match[1]) {
      return JSON.parse(match[1]) as T
    }
    throw new Error('Invalid SSE payload from coach endpoint')
  }

  return response.json() as Promise<T>
}
