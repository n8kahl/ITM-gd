'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useSPXFlowContext } from '@/contexts/spx/SPXFlowContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import type { FlowWindowRange, FlowWindowSummary } from '@/lib/types/spx-command-center'
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

type FlowWindowBias = 'bullish' | 'bearish' | 'neutral'

const WINDOW_MINUTES: Record<FlowWindowRange, number> = {
  '5m': 5,
  '15m': 15,
  '30m': 30,
}

function inferBias(flowScore: number, totalPremium: number): FlowWindowBias {
  if (totalPremium < 25_000) return 'neutral'
  if (flowScore >= 57) return 'bullish'
  if (flowScore <= 43) return 'bearish'
  return 'neutral'
}

function summarizeFlowWindows(flowEvents: ReturnType<typeof useSPXFlowContext>['flowEvents']): Record<FlowWindowRange, FlowWindowSummary> {
  const nowMs = Date.now()
  const validEvents = flowEvents
    .map((event) => {
      const eventMs = Date.parse(event.timestamp)
      if (!Number.isFinite(eventMs)) return null
      return { ...event, eventMs }
    })
    .filter((event): event is (typeof flowEvents[number] & { eventMs: number }) => Boolean(event))

  return (['5m', '15m', '30m'] as FlowWindowRange[]).reduce((acc, window) => {
    const windowMs = WINDOW_MINUTES[window] * 60_000
    const cutoff = nowMs - windowMs
    const scoped = validEvents.filter((event) => event.eventMs >= cutoff && event.eventMs <= nowMs)
    const bullishPremium = scoped
      .filter((event) => event.direction === 'bullish')
      .reduce((sum, event) => sum + event.premium, 0)
    const bearishPremium = scoped
      .filter((event) => event.direction === 'bearish')
      .reduce((sum, event) => sum + event.premium, 0)
    const totalPremium = bullishPremium + bearishPremium
    const flowScore = totalPremium > 0 ? (bullishPremium / totalPremium) * 100 : 50

    acc[window] = {
      window,
      startAt: new Date(cutoff).toISOString(),
      endAt: new Date(nowMs).toISOString(),
      flowScore,
      bias: inferBias(flowScore, totalPremium),
      eventCount: scoped.length,
      sweepCount: scoped.filter((event) => event.type === 'sweep').length,
      blockCount: scoped.filter((event) => event.type === 'block').length,
      bullishPremium,
      bearishPremium,
      totalPremium,
    }
    return acc
  }, {} as Record<FlowWindowRange, FlowWindowSummary>)
}

function selectPrimaryWindow(windows: Record<FlowWindowRange, FlowWindowSummary>): FlowWindowRange {
  if (windows['5m'].eventCount >= 2 || windows['5m'].totalPremium >= 50_000) return '5m'
  if (windows['15m'].eventCount >= 2 || windows['15m'].totalPremium >= 50_000) return '15m'
  return '30m'
}

export function FlowTicker() {
  const { selectedSetup } = useSPXSetupContext()
  const { flowEvents, flowAggregation } = useSPXFlowContext()
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
  const windows = useMemo(() => (
    flowAggregation?.windows || summarizeFlowWindows(flowEvents)
  ), [flowAggregation?.windows, flowEvents])
  const primaryWindow = useMemo(() => (
    flowAggregation?.primaryWindow || selectPrimaryWindow(windows)
  ), [flowAggregation?.primaryWindow, windows])

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
  const primarySummary = windows[primaryWindow]
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
        <span className="shrink-0 text-[10px] uppercase tracking-[0.1em] text-white/45">
          Flow ({primaryWindow})
        </span>
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

      <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[9px] font-mono">
        {(['5m', '15m', '30m'] as FlowWindowRange[]).map((window) => {
          const summary = windows[window]
          const institutional = summary.sweepCount + summary.blockCount
          return (
            <div
              key={window}
              className={cn(
                'rounded border px-1.5 py-1',
                window === primaryWindow
                  ? 'border-emerald-300/35 bg-emerald-500/[0.09]'
                  : 'border-white/12 bg-white/[0.02]',
              )}
            >
              <div className="flex items-center justify-between text-white/60">
                <span>{window}</span>
                <span>{summary.flowScore.toFixed(0)}</span>
              </div>
              <div className={cn(
                'mt-0.5 text-[8px] uppercase tracking-[0.08em]',
                summary.bias === 'bullish'
                  ? 'text-emerald-200'
                  : summary.bias === 'bearish'
                    ? 'text-rose-200'
                    : 'text-amber-200',
              )}>
                {summary.bias} · {institutional} inst
              </div>
            </div>
          )
        })}
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

        {primarySummary && (
          <span className="hidden rounded border border-white/15 bg-white/[0.03] px-2 py-1 text-[9px] font-mono text-white/65 md:inline">
            {primarySummary.eventCount} ev · {formatPremium(primarySummary.totalPremium)}
          </span>
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
