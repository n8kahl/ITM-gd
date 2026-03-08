'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Analytics } from '@/lib/analytics'
import type { MouseEvent } from 'react'

const NAV_STALL_FALLBACK_MS = 4500

type PendingNavigation = {
  href: string
  pathname: string
}

function isModifiedMouseEvent(event: MouseEvent<HTMLElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

function resolveHref(href: string): PendingNavigation | null {
  if (typeof window === 'undefined') return null

  try {
    const url = new URL(href, window.location.origin)
    return {
      href: url.pathname + url.search + url.hash,
      pathname: url.pathname,
    }
  } catch {
    return null
  }
}

export function useMemberNavHandler() {
  const pathname = usePathname()
  const pendingNavigationRef = useRef<PendingNavigation | null>(null)
  const fallbackTimerRef = useRef<number | null>(null)

  const clearPendingNavigation = useCallback(() => {
    pendingNavigationRef.current = null
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (pendingNavigationRef.current?.pathname === pathname) {
      clearPendingNavigation()
    }
  }, [pathname, clearPendingNavigation])

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current)
      }
    }
  }, [])

  const handleMemberNavClick = useCallback((
    event: MouseEvent<HTMLElement>,
    href: string,
    label: string,
    onNavigateStart?: () => void,
  ) => {
    try {
      Analytics.trackMemberNavItem(label)
    } catch (error) {
      console.error('Failed to track member nav item click:', error)
    }

    onNavigateStart?.()

    if (typeof window === 'undefined') return
    if (event.defaultPrevented) return
    if (isModifiedMouseEvent(event)) return

    const target = resolveHref(href)
    if (!target) return

    if (target.pathname === window.location.pathname) {
      clearPendingNavigation()
      return
    }

    if (pendingNavigationRef.current) {
      event.preventDefault()
      window.location.assign(target.href)
      clearPendingNavigation()
      return
    }

    pendingNavigationRef.current = target
    fallbackTimerRef.current = window.setTimeout(() => {
      const pending = pendingNavigationRef.current
      if (!pending) return

      if (window.location.pathname !== pending.pathname) {
        window.location.assign(pending.href)
      }

      clearPendingNavigation()
    }, NAV_STALL_FALLBACK_MS)
  }, [clearPendingNavigation])

  return { handleMemberNavClick }
}
