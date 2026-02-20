'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { cn } from '@/lib/utils'

interface GEXAmbientGlowProps {
  className?: string
  intensity?: 'normal' | 'boosted'
}

const GLOW_DEBOUNCE_MS = 220

export function GEXAmbientGlow({ className, intensity = 'normal' }: GEXAmbientGlowProps) {
  const { gexProfile } = useSPXAnalyticsContext()
  const { spxPrice } = useSPXPriceContext()
  const [background, setBackground] = useState<string>('none')

  const nextBackground = useMemo(() => {
    const strikes = gexProfile?.combined?.gexByStrike
    if (!strikes || strikes.length === 0 || !Number.isFinite(spxPrice) || spxPrice <= 0) {
      return 'none'
    }

    const maxAbsGex = Math.max(...strikes.map((strike) => Math.abs(strike.gex)), 1)
    const magnitudeCutoff = intensity === 'boosted' ? 0.18 : 0.3
    const maxOpacity = intensity === 'boosted' ? 0.16 : 0.08
    const significant = [...strikes]
      .filter((strike) => Math.abs(strike.gex) >= maxAbsGex * magnitudeCutoff)
      .sort((left, right) => Math.abs(right.gex) - Math.abs(left.gex))
      .slice(0, intensity === 'boosted' ? 10 : 6)

    if (significant.length === 0) return 'none'

    const approximateVisibleRange = intensity === 'boosted' ? 82 : 60
    return significant.map((strike) => {
      const distance = strike.strike - spxPrice
      const yPercent = 50 - (distance / approximateVisibleRange) * 50
      const clampedY = Math.max(5, Math.min(95, yPercent))
      const rgb = strike.gex >= 0 ? '16, 185, 129' : '251, 113, 133'
      const opacity = Math.min(maxOpacity, (Math.abs(strike.gex) / maxAbsGex) * maxOpacity)
      const stopAlpha = intensity === 'boosted' ? 74 : 70
      const haloHeight = intensity === 'boosted' ? 108 : 90
      return `radial-gradient(ellipse 95% ${haloHeight}px at 50% ${clampedY}%, rgba(${rgb}, ${opacity}) 0%, rgba(${rgb}, 0) ${stopAlpha}%)`
    }).join(', ')
  }, [gexProfile, intensity, spxPrice])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setBackground(nextBackground)
    }, GLOW_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [nextBackground])

  if (background === 'none') return null

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-[5] transition-[background] duration-500', className)}
      style={{ background }}
      aria-hidden
    />
  )
}
