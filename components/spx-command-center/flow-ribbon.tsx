'use client'

import { useMemo } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXFlowContext } from '@/contexts/spx/SPXFlowContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { buildFlowTelemetrySnapshot } from '@/lib/spx/flow-telemetry'
import { cn } from '@/lib/utils'

function formatPremium(premium: number): string {
  const abs = Math.abs(premium)
  if (abs >= 1_000_000_000) return `$${(premium / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(premium / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(premium / 1_000).toFixed(0)}K`
  return `$${premium.toFixed(0)}`
}

export function FlowRibbon({ className }: { className?: string }) {
  const { flowEvents, flowAggregation } = useSPXFlowContext()
  const { dataHealth } = useSPXAnalyticsContext()
  const { selectedSetup, inTradeSetup } = useSPXSetupContext()
  const scopedSetup = inTradeSetup || selectedSetup

  const telemetry = useMemo(
    () => buildFlowTelemetrySnapshot({
      flowEvents,
      flowAggregation,
    }),
    [flowAggregation, flowEvents],
  )

  const alignment = useMemo(() => {
    const gross = telemetry.bullishPremium5m + telemetry.bearishPremium5m
    if (!scopedSetup || gross <= 0) return null
    const directionalPremium = scopedSetup.direction === 'bullish'
      ? telemetry.bullishPremium5m
      : telemetry.bearishPremium5m
    const alignmentPct = Math.round((directionalPremium / gross) * 100)
    if (alignmentPct >= 55) return { label: `FLOW CONFIRMS ${alignmentPct}%`, tone: 'confirm' as const }
    if (alignmentPct < 40) return { label: `FLOW DIVERGES ${100 - alignmentPct}%`, tone: 'diverge' as const }
    return { label: `FLOW MIXED ${alignmentPct}%`, tone: 'mixed' as const }
  }, [scopedSetup, telemetry.bearishPremium5m, telemetry.bullishPremium5m])

  const freshnessLabel = useMemo(() => {
    const ageMs = telemetry.latestEventAgeMs
    if (ageMs == null) return '--'
    const seconds = Math.floor(ageMs / 1000)
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m`
  }, [telemetry.latestEventAgeMs])

  if (telemetry.events5m === 0) {
    return (
      <div
        className={cn(
          'pointer-events-none rounded-lg border border-white/10 bg-[#0A0A0B]/75 px-2.5 py-1.5 backdrop-blur',
          className,
        )}
        data-testid="spx-flow-ribbon"
      >
        <p className={cn(
          'text-[10px] font-mono uppercase tracking-[0.1em]',
          telemetry.isStale ? 'text-amber-200/80' : 'text-white/45',
        )}>
          {telemetry.isStale ? 'Flow stale - awaiting live prints' : 'Flow warming up...'}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'pointer-events-none rounded-lg border border-white/12 bg-[#0A0A0B]/78 px-2.5 py-2 backdrop-blur',
        className,
      )}
      data-testid="spx-flow-ribbon"
    >
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-white/55">Flow</span>
        <span className={cn(
          'rounded border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-[0.08em]',
          telemetry.isStale
            ? 'border-amber-300/35 bg-amber-500/12 text-amber-200'
            : dataHealth === 'healthy'
              ? 'border-emerald-300/30 bg-emerald-500/12 text-emerald-200'
              : 'border-white/20 bg-white/[0.05] text-white/70',
        )}>
          {telemetry.isStale ? 'stale' : 'live'} · {freshnessLabel}
        </span>
        <div className="h-1.5 min-w-[92px] flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400/80 transition-[width] duration-300"
            style={{ width: `${Math.max(6, Math.min(94, telemetry.bullishShare5m))}%` }}
          />
        </div>
        <span className="text-[9px] font-mono text-emerald-200">{formatPremium(telemetry.bullishPremium5m)}</span>
        <span className="text-[9px] font-mono text-white/30">|</span>
        <span className="text-[9px] font-mono text-rose-200">{formatPremium(telemetry.bearishPremium5m)}</span>
      </div>
      <p className="mt-1 text-[8px] font-mono uppercase tracking-[0.08em] text-white/55">
        1m {telemetry.events1m} prints · 5m {telemetry.events5m} prints · sweeps {telemetry.sweepCount5m} · blocks {telemetry.blockCount5m} · net {telemetry.netPremium5m >= 0 ? '+' : ''}{formatPremium(telemetry.netPremium5m)}
      </p>
      {alignment && (
        <p
          className={cn(
            'mt-1 text-[8px] font-mono uppercase tracking-[0.08em]',
            alignment.tone === 'confirm'
              ? 'text-emerald-200/85'
              : alignment.tone === 'diverge'
                ? 'text-rose-200/85'
                : 'text-amber-200/85',
          )}
        >
          {alignment.label}
        </p>
      )}
    </div>
  )
}
