'use client'

import { useMemo } from 'react'
import { Activity, Dot, Target } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { InfoTip } from '@/components/ui/info-tip'
import { cn } from '@/lib/utils'

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '--'
  return value.toLocaleString()
}

function getAgeMs(timestamp: string | null): number | null {
  if (!timestamp) return null
  const parsed = Date.parse(timestamp)
  if (Number.isNaN(parsed)) return null
  return Math.max(Date.now() - parsed, 0)
}

function formatFreshness(ageMs: number | null): string {
  if (ageMs == null) return '--'
  const seconds = Math.floor(ageMs / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
}

function flowBiasLabel(flowEvents: Array<{ direction: 'bullish' | 'bearish'; premium: number }>): string {
  if (flowEvents.length === 0) return 'flow warming'
  const bullish = flowEvents
    .filter((event) => event.direction === 'bullish')
    .reduce((sum, event) => sum + event.premium, 0)
  const bearish = flowEvents
    .filter((event) => event.direction === 'bearish')
    .reduce((sum, event) => sum + event.premium, 0)
  const gross = bullish + bearish
  const bullishPct = gross > 0 ? Math.round((bullish / gross) * 100) : 50
  if (bullishPct >= 60) return `bullish pressure ${bullishPct}%`
  if (bullishPct <= 40) return `bearish pressure ${100 - bullishPct}%`
  return `balanced flow ${bullishPct}%`
}

export function SPXHeader() {
  const {
    spxPrice,
    basis,
    regime,
    prediction,
    activeSetups,
    flowEvents,
    snapshotGeneratedAt,
    priceStreamConnected,
    priceStreamError,
  } = useSPXCommandCenter()

  const basisColor = basis?.current != null && basis.current >= 0 ? 'text-emerald-300' : 'text-rose-300'
  const snapshotAgeMs = getAgeMs(snapshotGeneratedAt)
  const snapshotFreshness = formatFreshness(snapshotAgeMs)
  const actionableCount = useMemo(
    () => activeSetups.filter((setup) => setup.status === 'ready' || setup.status === 'triggered').length,
    [activeSetups],
  )

  const postureDirection = prediction
    ? prediction.direction.bullish >= prediction.direction.bearish
      ? 'bullish'
      : 'bearish'
    : 'neutral'
  const postureLabel = `${(regime || 'unknown').toUpperCase()} ${postureDirection.toUpperCase()}${prediction ? ` ${prediction.confidence.toFixed(0)}%` : ''}`
  const actionLine = `${actionableCount} setups actionable · ${(regime || 'unknown')} regime · ${flowBiasLabel(flowEvents.slice(0, 10))}`

  return (
    <header className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-white/[0.015] to-emerald-500/[0.035] px-4 py-3 md:px-5 md:py-4">
      <div className="pointer-events-none absolute -right-24 -top-24 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-300" />
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">SPX Command Center</p>
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">LIVE</span>
            <InfoTip label="What is SPX Command Center?">
              Real-time decision cockpit for SPX options: setups, levels, flow, and coaching are fused so you can act from one view.
            </InfoTip>
          </div>
          <h1 className="mt-1 font-serif text-3xl leading-tight text-ivory md:text-4xl">
            {formatPrice(spxPrice)}
          </h1>
          <p className="mt-1 text-sm text-white/80">{actionLine}</p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-2 md:min-w-[360px]">
          <div className="col-span-2 rounded-xl border border-champagne/30 bg-champagne/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">Market Posture</p>
            <p className="font-mono text-sm text-champagne">{postureLabel}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Basis</p>
            <p className={cn('font-mono text-lg', basisColor)}>{basis ? formatSigned(basis.current) : '--'}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Actionable</p>
            <p className="font-mono text-lg text-emerald-200">{actionableCount}</p>
          </div>
          {prediction && (
            <div className="col-span-2 grid grid-cols-3 gap-2 text-xs text-white/75">
              <span className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-1">↑ {prediction.direction.bullish.toFixed(0)}%</span>
              <span className="rounded-md border border-rose-400/20 bg-rose-500/10 px-1.5 py-1">↓ {prediction.direction.bearish.toFixed(0)}%</span>
              <span className="rounded-md border border-white/20 bg-white/[0.05] px-1.5 py-1">↔ {prediction.direction.neutral.toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2 text-xs text-white/65">
        <Activity className="h-3.5 w-3.5 text-emerald-300" />
        <span>Sniper briefing bar active</span>
        <Dot className="h-4 w-4 text-emerald-300" />
        <span>Pro Tier</span>
        <span
          className={cn(
            'ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]',
            priceStreamConnected
              ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
              : 'border-amber-400/35 bg-amber-500/15 text-amber-200',
          )}
          title={priceStreamConnected ? 'WebSocket tick stream connected' : (priceStreamError || 'WebSocket reconnecting')}
        >
          {priceStreamConnected ? 'WS Live' : 'WS Retry'}
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]',
            snapshotAgeMs != null && snapshotAgeMs < 20_000
              ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200'
              : 'border-white/20 bg-white/5 text-white/65',
          )}
          title={snapshotGeneratedAt ? `Snapshot generated ${new Date(snapshotGeneratedAt).toLocaleTimeString()}` : 'Snapshot timestamp unavailable'}
        >
          Snapshot {snapshotFreshness}
        </span>
      </div>
    </header>
  )
}
