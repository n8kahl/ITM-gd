'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Analytics } from '@/lib/analytics'
import type { MouseEvent } from 'react'

const NAV_STALL_THRESHOLD_MS = 2200

type PendingNavigation = {
  href: string
  pathname: string
  label: string
  sourcePathname: string
  startedAt: number
}

type ResolvedNavigation = {
  href: string
  pathname: string
}

function isModifiedMouseEvent(event: MouseEvent<HTMLElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

function resolveHref(href: string): ResolvedNavigation | null {
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

type NavigationStatus = 'idle' | 'navigating' | 'stalled'

type MemberNavigationState = {
  status: NavigationStatus
  targetHref: string | null
  targetPathname: string | null
  targetLabel: string | null
}

const IDLE_NAVIGATION_STATE: MemberNavigationState = {
  status: 'idle',
  targetHref: null,
  targetPathname: null,
  targetLabel: null,
}

export function useMemberNavHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const pendingNavigationRef = useRef<PendingNavigation | null>(null)
  const fallbackTimerRef = useRef<number | null>(null)
  const [navigationState, setNavigationState] = useState<MemberNavigationState>(IDLE_NAVIGATION_STATE)

  const clearPendingNavigation = useCallback(() => {
    pendingNavigationRef.current = null
    setNavigationState(IDLE_NAVIGATION_STATE)
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }, [])

  const scheduleStallTimer = useCallback((pending: PendingNavigation) => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current)
    }

    fallbackTimerRef.current = window.setTimeout(() => {
      const currentPending = pendingNavigationRef.current
      if (!currentPending) return
      if (currentPending.pathname !== pending.pathname) return
      if (window.location.pathname !== currentPending.sourcePathname) return

      const durationMs = Date.now() - currentPending.startedAt
      setNavigationState({
        status: 'stalled',
        targetHref: currentPending.href,
        targetPathname: currentPending.pathname,
        targetLabel: currentPending.label,
      })

      Analytics.trackMemberNavLifecycle('stall', {
        from: currentPending.sourcePathname,
        to: currentPending.pathname,
        target: currentPending.href,
        label: currentPending.label,
        durationMs,
      })
    }, NAV_STALL_THRESHOLD_MS)
  }, [])

  const beginNavigation = useCallback((pending: PendingNavigation) => {
    pendingNavigationRef.current = pending
    setNavigationState({
      status: 'navigating',
      targetHref: pending.href,
      targetPathname: pending.pathname,
      targetLabel: pending.label,
    })

    Analytics.trackMemberNavLifecycle('start', {
      from: pending.sourcePathname,
      to: pending.pathname,
      target: pending.href,
      label: pending.label,
    })

    scheduleStallTimer(pending)
  }, [scheduleStallTimer])

  useEffect(() => {
    const pending = pendingNavigationRef.current
    if (!pending) return
    if (pathname === pending.sourcePathname) return

    const durationMs = Date.now() - pending.startedAt
    Analytics.trackMemberNavLifecycle('success', {
      from: pending.sourcePathname,
      to: pathname,
      target: pending.href,
      label: pending.label,
      durationMs,
    })

    const clearTimerId = window.setTimeout(() => {
      clearPendingNavigation()
    }, 0)

    return () => {
      window.clearTimeout(clearTimerId)
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

    event.preventDefault()

    const currentPath = window.location.pathname
    const pending = pendingNavigationRef.current
    if (pending && pending.pathname === target.pathname && pending.sourcePathname === currentPath) {
      return
    }

    beginNavigation({
      ...target,
      label,
      sourcePathname: currentPath,
      startedAt: Date.now(),
    })

    try {
      router.push(target.href)
    } catch (error) {
      console.error('Failed to navigate to member route:', error)
      clearPendingNavigation()
    }
  }, [beginNavigation, clearPendingNavigation, router])

  const retryPendingNavigation = useCallback(() => {
    const pending = pendingNavigationRef.current
    if (!pending) return

    Analytics.trackMemberNavLifecycle('retry', {
      from: window.location.pathname,
      to: pending.pathname,
      target: pending.href,
      label: pending.label,
    })

    const retriedPending: PendingNavigation = {
      ...pending,
      sourcePathname: window.location.pathname,
      startedAt: Date.now(),
    }

    beginNavigation(retriedPending)

    try {
      router.push(retriedPending.href)
    } catch (error) {
      console.error('Failed to retry member route navigation:', error)
      clearPendingNavigation()
    }
  }, [beginNavigation, clearPendingNavigation, router])

  return {
    handleMemberNavClick,
    isNavigationPending: navigationState.status === 'navigating',
    isNavigationStalled: navigationState.status === 'stalled',
    navigationTargetPathname: navigationState.targetPathname,
    navigationTargetLabel: navigationState.targetLabel,
    retryPendingNavigation,
  }
}
