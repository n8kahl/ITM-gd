'use client'

import useSWR, { type SWRConfiguration } from 'swr'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

type SPXKey = [url: string, token: string]

const fetcher = async <T>(key: SPXKey): Promise<T> => {
  const [url, token] = key
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `SPX request failed (${response.status})`)
  }

  return response.json() as Promise<T>
}

export function useSPXQuery<T>(
  endpoint: string,
  config?: SWRConfiguration<T, Error>,
) {
  const { session } = useMemberAuth()
  const token = session?.access_token

  const { data, error, isLoading, mutate } = useSWR<T, Error>(
    token ? [endpoint, token] : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 1500,
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
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `SPX POST failed (${response.status})`)
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
