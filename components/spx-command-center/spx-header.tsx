'use client'

import { useMemo, useState } from 'react'
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
  const [expandedMetric, setExpandedMetric] = useState<'posture' | 'basis' | 'actionable' | null>(null)
  const actionableCount = useMemo(
    () => activeSetups.filter((setup) => setup.status === 'ready' || setup.status === 'triggered').length,
    [activeSetups],
  )
  const topConfluence = useMemo(() => {
    const counts = new Map<string, number>()
    for (const setup of activeSetups) {
      for (const source of setup.confluenceSources || []) {
        counts.set(source, (counts.get(source) || 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
  }, [activeSetups])

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
          <button
            type="button"
            onClick={() => setExpandedMetric((prev) => (prev === 'posture' ? null : 'posture'))}
            className="col-span-2 rounded-xl border border-champagne/30 bg-champagne/10 px-3 py-2 text-left"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">Market Posture</p>
            <p className="font-mono text-sm text-champagne">{postureLabel}</p>
          </button>
          <button
            type="button"
            onClick={() => setExpandedMetric((prev) => (prev === 'basis' ? null : 'basis'))}
            className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Basis</p>
            <p className={cn('font-mono text-lg', basisColor)}>{basis ? formatSigned(basis.current) : '--'}</p>
          </button>
          <button
            type="button"
            onClick={() => setExpandedMetric((prev) => (prev === 'actionable' ? null : 'actionable'))}
            className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-left"
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">Actionable</p>
            <p className="font-mono text-lg text-emerald-200">{actionableCount}</p>
          </button>
          {prediction && (
            <div className="col-span-2 grid grid-cols-3 gap-2 text-xs text-white/75">
              <span className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-1">↑ {prediction.direction.bullish.toFixed(0)}%</span>
              <span className="rounded-md border border-rose-400/20 bg-rose-500/10 px-1.5 py-1">↓ {prediction.direction.bearish.toFixed(0)}%</span>
              <span className="rounded-md border border-white/20 bg-white/[0.05] px-1.5 py-1">↔ {prediction.direction.neutral.toFixed(0)}%</span>
            </div>
          )}
          {expandedMetric === 'posture' && (
            <div className="col-span-2 rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-xs text-white/70">
              <p>Use posture to decide strategy family: trending favors continuation, compression favors selective breakout or mean-reversion with confirmation.</p>
              <p className="mt-1">Confidence: {prediction ? `${prediction.confidence.toFixed(0)}%` : '--'}.</p>
            </div>
          )}
          {expandedMetric === 'basis' && (
            <div className="col-span-2 rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-xs text-white/70">
              <p>SPX/SPY basis helps detect dislocations. Expanding basis can indicate divergence risk; contracting basis can indicate alignment.</p>
              <p className="mt-1 font-mono text-white/60">
                EMA5 {basis?.ema5?.toFixed(2) || '--'} · EMA20 {basis?.ema20?.toFixed(2) || '--'} · Z {basis?.zscore?.toFixed(2) || '--'}
              </p>
            </div>
          )}
          {expandedMetric === 'actionable' && (
            <div className="col-span-2 rounded-lg border border-white/15 bg-black/30 px-2.5 py-2 text-xs text-white/70">
              <p>Actionable setups are `READY` or `TRIGGERED`. Top confluence drivers right now:</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {topConfluence.length === 0 ? (
                  <span className="text-white/55">No confluence tags yet.</span>
                ) : (
                  topConfluence.map(([source, count]) => (
                    <span key={source} className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-100">
                      {source} ({count})
                    </span>
                  ))
                )}
              </div>
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
