'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Analytics } from '@/lib/analytics'

export function AnalyticsProvider() {
  const pathname = usePathname()

  useEffect(() => {
    Analytics.initialize()
  }, [])

  useEffect(() => {
    if (!pathname) return
    Analytics.trackPageView(pathname)
  }, [pathname])

  return null
}
