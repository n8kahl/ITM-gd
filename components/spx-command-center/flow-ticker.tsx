'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSPXFlowContext } from '@/contexts/spx/SPXFlowContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { SPX_SHORTCUT_EVENT } from '@/lib/spx/shortcut-events'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'

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
  const { selectedSetup } = useSPXSetupContext()
  const { flowEvents } = useSPXFlowContext()
  const { spxPrice } = useSPXPriceContext()
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const handleShortcutToggle = () => {
      setExpanded((previous) => {
        const next = !previous
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.FLOW_MODE_TOGGLED, {
          mode: next ? 'expanded' : 'compact',
          rankedCount: flowEvents.length,
          hasSelectedSetup: Boolean(selectedSetup),
          source: 'keyboard_shortcut',
        })
        return next
      })
    }

    window.addEventListener(SPX_SHORTCUT_EVENT.FLOW_TOGGLE, handleShortcutToggle as EventListener)
    return () => {
      window.removeEventListener(SPX_SHORTCUT_EVENT.FLOW_TOGGLE, handleShortcutToggle as EventListener)
    }
  }, [flowEvents.length, selectedSetup])

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
  const topEvent = ranked[0] ?? null
  const entryMid =
    selectedSetup
      ? (selectedSetup.entryZone.low + selectedSetup.entryZone.high) / 2
      : null

  if (flowEvents.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/55">
        Flow warming up…
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.025] to-white/[0.01] px-3 py-2.5" data-testid="spx-flow-ticker">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-white/45">Flow</span>
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400/75 transition-[width] duration-500" style={{ width: `${Math.max(5, Math.min(95, bullishShare))}%` }} />
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

      <div className="mt-2 flex items-center justify-between gap-2">
        {topEvent ? (
          <div
            className={cn(
              'inline-flex min-w-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-mono',
              topEvent.direction === 'bullish'
                ? 'border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100'
                : 'border-rose-400/20 bg-rose-500/[0.06] text-rose-100',
            )}
          >
            <span className="font-medium">{topEvent.symbol} {topEvent.type.toUpperCase().slice(0, 3)}</span>
            <span>{topEvent.strike}</span>
            <span className="text-white/40">{formatPremium(topEvent.premium)}</span>
            <span className="text-white/30">{relativeAge(topEvent.timestamp)}</span>
            {entryMid != null && spxPrice > 0 && topEvent.symbol === 'SPX' && Math.abs(topEvent.strike - entryMid) <= 20 && (
              <span className="rounded border border-champagne/35 bg-champagne/10 px-1 py-0 text-[8px] uppercase tracking-[0.08em] text-champagne">
                Near Entry
              </span>
            )}
          </div>
        ) : (
          <span className="text-[10px] text-white/45">No ranked event.</span>
        )}

        <button
          type="button"
          data-testid="spx-flow-toggle"
          onClick={() => {
            const next = !expanded
            setExpanded(next)
            trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.FLOW_MODE_TOGGLED, {
              mode: next ? 'expanded' : 'compact',
              rankedCount: ranked.length,
              hasSelectedSetup: Boolean(selectedSetup),
            })
          }}
          className="shrink-0 min-h-[36px] rounded border border-white/15 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white/85 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/65"
        >
          {expanded ? 'Compact' : `Expand (${Math.max(0, ranked.length - 1)})`}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5" data-testid="spx-flow-expanded">
          {ranked.slice(1).map((event) => {
            const nearEntry = entryMid != null && spxPrice > 0 && event.symbol === 'SPX'
              ? Math.abs(event.strike - entryMid) <= 20
              : false

            return (
              <div
                key={event.id}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-mono',
                  event.direction === 'bullish'
                    ? 'border-emerald-400/20 bg-emerald-500/[0.05] text-emerald-100'
                    : 'border-rose-400/20 bg-rose-500/[0.05] text-rose-100',
                )}
              >
                <span className="font-medium">{event.symbol}</span>
                <span>{event.type.toUpperCase().slice(0, 3)}</span>
                <span>{event.strike}</span>
                <span className="ml-auto text-white/40">{formatPremium(event.premium)}</span>
                <span className="text-white/30">{relativeAge(event.timestamp)}</span>
                {nearEntry && (
                  <span className="rounded border border-champagne/35 bg-champagne/10 px-1 py-0 text-[8px] uppercase tracking-[0.08em] text-champagne">
                    Near Entry
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
