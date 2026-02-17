'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'

function ageSeconds(timestamp: string): number {
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) return 0
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000))
}

function formatPremium(premium: number): string {
  const abs = Math.abs(premium)
  if (abs >= 1_000_000_000) return `$${(premium / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(premium / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(premium / 1_000).toFixed(0)}K`
  return `$${premium.toFixed(0)}`
}

function relativeAge(timestamp: string): string {
  const seconds = ageSeconds(timestamp)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m`
}

export function FlowTicker() {
  const { flowEvents, spxPrice, selectedSetup } = useSPXCommandCenter()

  const ranked = useMemo(() => {
    return [...flowEvents]
      .map((event) => {
        const ageMin = Math.max(0.25, ageSeconds(event.timestamp) / 60)
        const score = event.premium / ageMin
        return { ...event, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [flowEvents])

  // Flow conviction: does flow align with the selected setup direction?
  const conviction = useMemo(() => {
    if (!selectedSetup || ranked.length === 0) return null

    const setupDir = selectedSetup.direction
    const aligned = ranked.filter((e) => e.direction === setupDir)
    const opposed = ranked.filter((e) => e.direction !== setupDir)

    const alignedPremium = aligned.reduce((s, e) => s + e.premium, 0)
    const opposedPremium = opposed.reduce((s, e) => s + e.premium, 0)
    const gross = alignedPremium + opposedPremium

    if (gross <= 0) return null

    const alignPct = Math.round((alignedPremium / gross) * 100)
    const confirms = alignPct >= 55
    const contradicts = alignPct < 40

    return {
      alignPct,
      confirms,
      contradicts,
      label: confirms
        ? `FLOW CONFIRMS ${alignPct}%`
        : contradicts
          ? `FLOW DIVERGES ${100 - alignPct}%`
          : `FLOW MIXED ${alignPct}%`,
    }
  }, [ranked, selectedSetup])

  const bullishPremium = ranked.filter((e) => e.direction === 'bullish').reduce((s, e) => s + e.premium, 0)
  const bearishPremium = ranked.filter((e) => e.direction === 'bearish').reduce((s, e) => s + e.premium, 0)
  const grossPremium = bullishPremium + bearishPremium
  const bullishShare = grossPremium > 0 ? (bullishPremium / grossPremium) * 100 : 50

  if (flowEvents.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/45">
        Flow warming up…
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      {/* Row 1: Tug-of-war + conviction badge */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-white/45">Flow</span>

        {/* Tug-of-war bar — compact */}
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${Math.max(5, Math.min(95, bullishShare))}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <span className="text-emerald-200">{formatPremium(bullishPremium)}</span>
          <span className="text-white/30">|</span>
          <span className="text-rose-200">{formatPremium(bearishPremium)}</span>
        </div>

        {conviction && (
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]',
              conviction.confirms
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                : conviction.contradicts
                  ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                  : 'border-amber-400/30 bg-amber-500/10 text-amber-200',
            )}
          >
            {conviction.label}
          </span>
        )}
      </div>

      {/* Row 2: Top flow events — horizontal compact chips */}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {ranked.slice(0, 4).map((event) => {
          const nearEntry = selectedSetup && spxPrice > 0 && event.symbol === 'SPX'
            ? Math.abs(event.strike - ((selectedSetup.entryZone.low + selectedSetup.entryZone.high) / 2)) < 25
            : false

          return (
            <span
              key={event.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-mono',
                event.direction === 'bullish'
                  ? 'border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100'
                  : 'border-rose-400/20 bg-rose-500/[0.06] text-rose-100',
                nearEntry && 'ring-1 ring-champagne/40',
              )}
            >
              <span className="font-medium">{event.symbol} {event.type.toUpperCase().slice(0, 3)}</span>
              <span>{event.strike}</span>
              <span className="text-white/40">{formatPremium(event.premium)}</span>
              <span className="text-white/30">{relativeAge(event.timestamp)}</span>
              {nearEntry && <span className="text-champagne text-[8px]">●</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}
