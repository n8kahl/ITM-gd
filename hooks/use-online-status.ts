'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const HEALTHCHECK_INTERVAL_MS = 45_000
const HEALTHCHECK_TIMEOUT_MS = 4_000

export type OnlineStatus = 'online' | 'degraded' | 'offline'

type OnlineStatusState = {
  status: OnlineStatus
  isChecking: boolean
  lastCheckedAt: number | null
  lastHealthyAt: number | null
}

export function useOnlineStatus() {
  const [state, setState] = useState<OnlineStatusState>({
    status: 'online',
    isChecking: false,
    lastCheckedAt: null,
    lastHealthyAt: null,
  })
  const mountedRef = useRef(true)
  const inFlightRef = useRef<AbortController | null>(null)

  const checkHeartbeat = useCallback(async () => {
    if (typeof window === 'undefined') return false

    if (!navigator.onLine) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          status: 'offline',
          isChecking: false,
          lastCheckedAt: Date.now(),
        }))
      }
      return false
    }

    if (inFlightRef.current) {
      inFlightRef.current.abort()
    }

    const controller = new AbortController()
    inFlightRef.current = controller
    const timeoutId = window.setTimeout(() => {
      controller.abort()
    }, HEALTHCHECK_TIMEOUT_MS)

    if (mountedRef.current) {
      setState((prev) => ({ ...prev, isChecking: true }))
    }

    try {
      const response = await fetch('/api/health?scope=members-shell', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      })

      const now = Date.now()
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          status: response.ok ? 'online' : 'degraded',
          isChecking: false,
          lastCheckedAt: now,
          lastHealthyAt: response.ok ? now : prev.lastHealthyAt,
        }))
      }

      return response.ok
    } catch {
      if (!mountedRef.current) return false

      setState((prev) => ({
        ...prev,
        status: navigator.onLine ? 'degraded' : 'offline',
        isChecking: false,
        lastCheckedAt: Date.now(),
      }))

      return false
    } finally {
      window.clearTimeout(timeoutId)
      if (inFlightRef.current === controller) {
        inFlightRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true

    const handleOnline = () => {
      void checkHeartbeat()
    }

    const handleOffline = () => {
      setState((prev) => ({
        ...prev,
        status: 'offline',
        isChecking: false,
        lastCheckedAt: Date.now(),
      }))
    }

    if (typeof window !== 'undefined') {
      if (navigator.onLine) {
        void checkHeartbeat()
      } else {
        handleOffline()
      }

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }

    const intervalId = window.setInterval(() => {
      void checkHeartbeat()
    }, HEALTHCHECK_INTERVAL_MS)

    return () => {
      mountedRef.current = false
      window.clearInterval(intervalId)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      inFlightRef.current?.abort()
      inFlightRef.current = null
    }
  }, [checkHeartbeat])

  return {
    ...state,
    retry: checkHeartbeat,
    isOnline: state.status === 'online',
    isDegraded: state.status === 'degraded',
    isOffline: state.status === 'offline',
  }
}
